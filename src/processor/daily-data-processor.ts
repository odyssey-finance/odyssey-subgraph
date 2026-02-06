import { Bytes, BigInt } from '@graphprotocol/graph-ts'
import {
  Position,
  PositionDailyData,
  PositionRegistry,
  PositionRegistryDailyData,
  SmartAccount,
  SmartAccountDailyData,
} from '../../generated/schema'
import { POSITION_REGISTRY } from '../utils/address'
import { SECONDS_PER_DAY } from '../utils/constants'

function getDailyDataId(entityId: Bytes, dayId: BigInt): string {
  return entityId.toHex().concat('-').concat(dayId.toString())
}

function saveRegistryDailyData(
  positionRegistry: PositionRegistry,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): PositionRegistryDailyData {
  const dailyDataId = getDailyDataId(positionRegistry.id, dayId)
  const dailyData = new PositionRegistryDailyData(dailyDataId)
  dailyData.dayStartTimestamp = dayStartTimestamp
  dailyData.createdAt = blockTimestamp
  dailyData.positionCount = positionRegistry.positionCount
  dailyData.smartAccountCount = positionRegistry.smartAccountCount
  dailyData.positionRegistry = positionRegistry.id
  dailyData.save()
  return dailyData
}

function saveSmartAccountDailyData(
  smartAccount: SmartAccount,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
  registryDailyData: PositionRegistryDailyData,
): SmartAccountDailyData {
  const dailyDataId = getDailyDataId(smartAccount.id, dayId)
  let dailyData = SmartAccountDailyData.load(dailyDataId)
  if (dailyData) return dailyData

  dailyData = new SmartAccountDailyData(dailyDataId)
  dailyData.dayStartTimestamp = dayStartTimestamp
  dailyData.createdAt = blockTimestamp
  dailyData.smartAccount = smartAccount.id
  dailyData.positionRegistryDailyData = registryDailyData.id
  dailyData.save()
  return dailyData
}

function savePositionDailyData(
  position: Position,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
  smartAccountDailyData: SmartAccountDailyData,
): PositionDailyData {
  const dailyDataId = getDailyDataId(position.id, dayId)
  let dailyData = PositionDailyData.load(dailyDataId)

  if (!dailyData) {
    dailyData = new PositionDailyData(dailyDataId)
    dailyData.dayStartTimestamp = dayStartTimestamp
    dailyData.createdAt = blockTimestamp
    dailyData.position = position.id
    dailyData.smartAccountDailyData = smartAccountDailyData.id
  }

  dailyData.pricePerShare = position.pricePerShare
  dailyData.totalDeposited = position.totalDeposited
  dailyData.totalBorrowed = position.totalBorrowed
  dailyData.save()
  return dailyData
}

/**
 * Creates daily snapshots for all entities.
 * - First event of day: iterates through all entities to create baseline snapshots
 * - Subsequent events: only updates the specific position that triggered the event
 */
export function createDailyData(position: Position, timestamp: BigInt): void {
  const positionRegistry = PositionRegistry.load(POSITION_REGISTRY)
  if (!positionRegistry) return

  const dayId = timestamp.div(SECONDS_PER_DAY)
  const dayStartTimestamp = dayId.times(SECONDS_PER_DAY)

  const registryDailyDataId = getDailyDataId(positionRegistry.id, dayId)
  let registryDailyData = PositionRegistryDailyData.load(registryDailyDataId)

  if (!registryDailyData) {
    // First event of the day - create baseline snapshots for all existing entities
    registryDailyData = saveRegistryDailyData(positionRegistry, timestamp, dayId, dayStartTimestamp)

    const smartAccounts = positionRegistry.smartAccounts.load()
    for (let i = 0; i < smartAccounts.length; i++) {
      const smartAccount = SmartAccount.load(smartAccounts[i].id)
      if (!smartAccount) continue

      const smartAccountDailyData = saveSmartAccountDailyData(
        smartAccount,
        timestamp,
        dayId,
        dayStartTimestamp,
        registryDailyData,
      )

      const positions = smartAccount.positions.load()
      for (let j = 0; j < positions.length; j++) {
        const pos = Position.load(positions[j].id)
        if (!pos) continue

        savePositionDailyData(pos, timestamp, dayId, dayStartTimestamp, smartAccountDailyData)
      }
    }
  }

  // Update registry counts (may have changed since first event - new positions etc)
  registryDailyData.positionCount = positionRegistry.positionCount
  registryDailyData.smartAccountCount = positionRegistry.smartAccountCount
  registryDailyData.save()

  // Ensure smart account daily data exists (handles new smart account creation mid-day)
  const sa = SmartAccount.load(position.owner)
  if (!sa) return

  const smartAccountDailyData = saveSmartAccountDailyData(sa, timestamp, dayId, dayStartTimestamp, registryDailyData)

  // Update the specific position's daily data with latest values
  savePositionDailyData(position, timestamp, dayId, dayStartTimestamp, smartAccountDailyData)
}
