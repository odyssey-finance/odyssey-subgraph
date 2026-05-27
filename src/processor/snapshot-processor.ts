import { Address, Bytes, BigInt } from '@graphprotocol/graph-ts'
import {
  Position,
  PositionSnapshot,
  PositionRegistry,
  PositionRegistrySnapshot,
  SmartAccount,
  SmartAccountSnapshot,
} from '../../generated/schema'
import { POSITION_REGISTRY } from '../utils/address'
import { BIG_INT_ZERO, SECONDS_PER_DAY } from '../utils/constants'
import { PositionInfo } from '../utils/position-info'

// Fetches on-chain values that the Position entity caches.
function refreshPositionValues(position: Position): void {
  const info = new PositionInfo(Address.fromBytes(position.id))
  position.pricePerShare = info.pricePerShare()
  position.totalDeposited = info.totalDeposited()
  position.totalBorrowed = info.totalBorrowed()
  position.save()
}

function getSnapshotId(entityId: Bytes, dayId: BigInt): string {
  return entityId.toHex().concat('-').concat(dayId.toString())
}

function saveRegistrySnapshot(
  positionRegistry: PositionRegistry,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): PositionRegistrySnapshot {
  const snapshotId = getSnapshotId(positionRegistry.id, dayId)
  const snapshot = new PositionRegistrySnapshot(snapshotId)
  snapshot.dayStartTimestamp = dayStartTimestamp
  snapshot.createdAt = blockTimestamp
  snapshot.positionCount = positionRegistry.positionCount
  snapshot.smartAccountCount = positionRegistry.smartAccountCount
  snapshot.positionRegistry = positionRegistry.id
  snapshot.save()
  return snapshot
}

function saveSmartAccountSnapshot(
  smartAccount: SmartAccount,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
  registrySnapshot: PositionRegistrySnapshot,
): SmartAccountSnapshot {
  const snapshotId = getSnapshotId(smartAccount.id, dayId)
  let snapshot = SmartAccountSnapshot.load(snapshotId)
  if (snapshot) return snapshot

  snapshot = new SmartAccountSnapshot(snapshotId)
  snapshot.dayStartTimestamp = dayStartTimestamp
  snapshot.createdAt = blockTimestamp
  snapshot.smartAccount = smartAccount.id
  snapshot.positionRegistrySnapshot = registrySnapshot.id
  snapshot.save()
  return snapshot
}

function savePositionSnapshot(
  position: Position,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
  smartAccountSnapshot: SmartAccountSnapshot,
): PositionSnapshot {
  const snapshotId = getSnapshotId(position.id, dayId)
  let snapshot = PositionSnapshot.load(snapshotId)

  if (!snapshot) {
    snapshot = new PositionSnapshot(snapshotId)
    snapshot.dayStartTimestamp = dayStartTimestamp
    snapshot.createdAt = blockTimestamp
    snapshot.position = position.id
    snapshot.smartAccountSnapshot = smartAccountSnapshot.id
  }

  snapshot.pricePerShare = position.pricePerShare
  snapshot.totalDeposited = position.totalDeposited
  snapshot.totalBorrowed = position.totalBorrowed
  snapshot.save()
  return snapshot
}

/**
 * Creates daily snapshots for all entities.
 * - First event of day: iterates through all entities to create baseline snapshots
 * - Subsequent events: only updates the specific position that triggered the event
 * Pass position=null for registry-level events that don't tie to a single position.
 */
export function createSnapshot(timestamp: BigInt, position: Position | null): void {
  const positionRegistry = PositionRegistry.load(POSITION_REGISTRY)
  if (!positionRegistry) return

  const dayId = timestamp.div(SECONDS_PER_DAY)
  const dayStartTimestamp = dayId.times(SECONDS_PER_DAY)

  const registrySnapshotId = getSnapshotId(positionRegistry.id, dayId)
  let registrySnapshot = PositionRegistrySnapshot.load(registrySnapshotId)

  if (!registrySnapshot) {
    // First event of the day - create baseline snapshots for all existing entities
    registrySnapshot = saveRegistrySnapshot(positionRegistry, timestamp, dayId, dayStartTimestamp)

    const smartAccounts = positionRegistry.smartAccounts.load()
    for (let i = 0; i < smartAccounts.length; i++) {
      const smartAccount = SmartAccount.load(smartAccounts[i].id)
      if (!smartAccount) continue

      const smartAccountSnapshot = saveSmartAccountSnapshot(
        smartAccount,
        timestamp,
        dayId,
        dayStartTimestamp,
        registrySnapshot,
      )

      const positions = smartAccount.positions.load()
      for (let j = 0; j < positions.length; j++) {
        const pos = Position.load(positions[j].id)
        if (!pos) continue
        // Triggering position is refreshed by the event handler and snapshotted below
        if (position !== null && pos.id.equals(position.id)) continue
        // Unopened position has no meaningful state to snapshot
        if (pos.openedAt.equals(BIG_INT_ZERO)) continue
        // Closed positions have a frozen on-chain pricePerShare — skip the eth_calls
        if (pos.closedAt.gt(BIG_INT_ZERO)) continue

        refreshPositionValues(pos)
        savePositionSnapshot(pos, timestamp, dayId, dayStartTimestamp, smartAccountSnapshot)
      }
    }
  }

  // Update registry counts (may have changed since first event - new positions etc)
  registrySnapshot.positionCount = positionRegistry.positionCount
  registrySnapshot.smartAccountCount = positionRegistry.smartAccountCount
  registrySnapshot.save()

  if (position === null) return

  // Ensure smart account entity exists before creating snapshot (handles mid-day creation)
  const sa = SmartAccount.load(position.owner)
  if (!sa) return // edge case

  // Create or update smart account snapshot (handles mid-day creation)
  const smartAccountSnapshot = saveSmartAccountSnapshot(sa, timestamp, dayId, dayStartTimestamp, registrySnapshot)

  // Update the specific position's snapshot with latest values
  savePositionSnapshot(position, timestamp, dayId, dayStartTimestamp, smartAccountSnapshot)
}
