import { createMockedFunction, newMockEvent } from 'matchstick-as'
import { assert, describe, test, clearStore, afterEach } from 'matchstick-as/assembly/index'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { POSITION_ADDRESS, POSITION_REGISTRY_ADDRESS } from './utils/addresses'
import { createPositionDeployedEvent, openPosition } from './utils/setup'
import { createSnapshot } from '../src/processor/snapshot-processor'
import { handleBlock } from '../src/mappings/position-registry'
import { Position, PositionSnapshot, SmartAccountSnapshot } from '../generated/schema'
import { SECONDS_PER_DAY } from '../src/utils/constants'
import { handlePositionDeployed } from '../src/mappings/position-registry'

describe('Snapshot: polling block handler', () => {
  afterEach(() => {
    clearStore()
  })

  test('Handle snapshot', () => {
    const entityType = 'PositionSnapshot'
    // positionAddress-dayId. for tests it is '0x0000000000000000000000000000000000000005-0'
    const id = POSITION_ADDRESS.toHex().concat('-0')

    const totalAllocated = BigInt.fromI32(1000)
    const pricePerShare = BigInt.fromI32(121)
    const isOutdated = true
    openPosition(totalAllocated, pricePerShare, isOutdated)

    const position = Position.load(POSITION_ADDRESS)!
    createSnapshot(newMockEvent().block.timestamp, position)

    assert.entityCount(entityType, 1)
    // given borrow is zero, totalDeposited is same as totalAllocated for this test.
    assert.fieldEquals(entityType, id, 'totalAllocated', totalAllocated.toString())
    assert.fieldEquals(entityType, id, 'totalDeposited', totalAllocated.toString())
    assert.fieldEquals(entityType, id, 'pricePerShare', pricePerShare.toString())
  })

  test('Block handler refetches stale on-chain values for untouched positions', () => {
    const stalePrice = BigInt.fromI32(100)
    const freshPrice = BigInt.fromI32(200)
    const allocated = BigInt.fromI32(1000)
    openPosition(allocated, stalePrice, false)
    const day0Ts = newMockEvent().block.timestamp

    // Simulate on-chain drift: contract returns a new pricePerShare but no event has fired for A.
    createMockedFunction(POSITION_ADDRESS, 'pricePerShare', 'pricePerShare():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(freshPrice),
    ])
    createMockedFunction(POSITION_ADDRESS, 'totalAllocated', 'totalAllocated():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(allocated),
    ])
    createMockedFunction(POSITION_ADDRESS, 'depositedAmount', 'depositedAmount():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(allocated),
    ])
    createMockedFunction(POSITION_ADDRESS, 'borrowedAmount', 'borrowedAmount():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ])

    // Day 1: poll fires. Baseline runs and refetches A from chain.
    const day1Ts = day0Ts.plus(SECONDS_PER_DAY)
    const block = newMockEvent().block
    block.timestamp = day1Ts
    handleBlock(block)

    const aDay1Id = POSITION_ADDRESS.toHex().concat('-').concat(day1Ts.div(SECONDS_PER_DAY).toString())
    assert.fieldEquals('PositionSnapshot', aDay1Id, 'pricePerShare', freshPrice.toString())
    assert.fieldEquals('Position', POSITION_ADDRESS.toHex(), 'pricePerShare', freshPrice.toString())
  })

  test('Block handler creates daily snapshot on a day with no events', () => {
    openPosition(BigInt.fromI32(1000), BigInt.fromI32(100), false)
    const day0Ts = newMockEvent().block.timestamp

    // Five quiet days, then a poll fires.
    const day5Ts = day0Ts.plus(SECONDS_PER_DAY.times(BigInt.fromI32(5)))
    const dayId = day5Ts.div(SECONDS_PER_DAY).toString()
    const block = newMockEvent().block
    block.timestamp = day5Ts
    handleBlock(block)

    const registryId = POSITION_REGISTRY_ADDRESS.toHex().concat('-').concat(dayId)
    const positionId = POSITION_ADDRESS.toHex().concat('-').concat(dayId)
    assert.fieldEquals('PositionRegistrySnapshot', registryId, 'positionCount', '1')
    assert.fieldEquals('PositionSnapshot', positionId, 'position', POSITION_ADDRESS.toHex())
  })

  test('Unopened position is skipped in baseline loop', () => {
    openPosition(BigInt.fromI32(1000), BigInt.fromI32(100), false)
    const day0Ts = newMockEvent().block.timestamp

    // Deploy a second position but never open it.
    const SA2 = Address.fromString('0x000000000000000000000000000000000000000C')
    const UNOPENED_POSITION = Address.fromString('0x000000000000000000000000000000000000000D')
    handlePositionDeployed(createPositionDeployedEvent(SA2, BigInt.fromI32(2), UNOPENED_POSITION))

    // Day 1 poll: baseline should iterate but skip the unopened position.
    const day1Ts = day0Ts.plus(SECONDS_PER_DAY)
    const dayId = day1Ts.div(SECONDS_PER_DAY).toString()
    const block = newMockEvent().block
    block.timestamp = day1Ts
    handleBlock(block)

    // Opened position A gets a day-1 snapshot.
    assert.fieldEquals(
      'PositionSnapshot',
      POSITION_ADDRESS.toHex().concat('-').concat(dayId),
      'position',
      POSITION_ADDRESS.toHex(),
    )
    // Unopened position has no day-1 snapshot.
    const unopenedSnapshotId = UNOPENED_POSITION.toHex().concat('-').concat(dayId)
    assert.assertNull(PositionSnapshot.load(unopenedSnapshotId))
  })

  test('PositionDeployed alone does not create a snapshot for the new entities', () => {
    openPosition(BigInt.fromI32(1000), BigInt.fromI32(100), false)
    const dayId = newMockEvent().block.timestamp.div(SECONDS_PER_DAY).toString()

    const SA2 = Address.fromString('0x000000000000000000000000000000000000000C')
    const NEW_POSITION = Address.fromString('0x000000000000000000000000000000000000000D')
    handlePositionDeployed(createPositionDeployedEvent(SA2, BigInt.fromI32(2), NEW_POSITION))

    assert.assertNull(SmartAccountSnapshot.load(SA2.toHex().concat('-').concat(dayId)))
    assert.assertNull(PositionSnapshot.load(NEW_POSITION.toHex().concat('-').concat(dayId)))
  })
})
