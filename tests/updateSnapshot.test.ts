import { createMockedFunction, newMockEvent } from 'matchstick-as'
import { assert, describe, test, clearStore, afterEach } from 'matchstick-as/assembly/index'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { POSITION_ADDRESS } from './utils/addresses'
import { createPositionDeployedEvent, openPosition } from './utils/setup'
import { createSnapshot } from '../src/processor/snapshot-processor'
import { Position } from '../generated/schema'
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
    createSnapshot(position, newMockEvent().block.timestamp)

    assert.entityCount(entityType, 1)
    // given borrow is zero, totalDeposited is same as totalAllocated for this test.
    assert.fieldEquals(entityType, id, 'totalDeposited', totalAllocated.toString())
    assert.fieldEquals(entityType, id, 'pricePerShare', pricePerShare.toString())
  })

  test('Baseline loop refetches stale on-chain values for untouched positions', () => {
    // Day 0: open position A with a known pricePerShare. This also writes A's day-0 snapshot.
    const stalePrice = BigInt.fromI32(100)
    const freshPrice = BigInt.fromI32(200)
    const allocated = BigInt.fromI32(1000)
    openPosition(allocated, stalePrice, false)
    const day0Ts = newMockEvent().block.timestamp

    // Deploy a second position B owned by a different SA so we have a non-A trigger
    // for the day-1 snapshot run.
    const SA2 = Address.fromString('0x000000000000000000000000000000000000000C')
    const POSITION_B = Address.fromString('0x000000000000000000000000000000000000000D')
    handlePositionDeployed(createPositionDeployedEvent(SA2, BigInt.fromI32(2), POSITION_B))

    // Simulate on-chain drift on A: the contract now returns a new pricePerShare,
    // but no Position event has fired for A so the Position entity is still at stalePrice.
    createMockedFunction(POSITION_ADDRESS, 'pricePerShare', 'pricePerShare():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(freshPrice),
    ])
    createMockedFunction(POSITION_ADDRESS, 'depositedAmount', 'depositedAmount():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(allocated),
    ])
    createMockedFunction(POSITION_ADDRESS, 'borrowedAmount', 'borrowedAmount():(uint256)').returns([
      ethereum.Value.fromUnsignedBigInt(BigInt.zero()),
    ])

    // Day 1: createSnapshot triggered by B. Baseline loop runs and must refresh A from chain.
    const day1Ts = day0Ts.plus(SECONDS_PER_DAY)
    const b = Position.load(POSITION_B)!
    createSnapshot(b, day1Ts)

    const aDay1Id = POSITION_ADDRESS.toHex().concat('-').concat(day1Ts.div(SECONDS_PER_DAY).toString())
    assert.fieldEquals('PositionSnapshot', aDay1Id, 'pricePerShare', freshPrice.toString())
    // Live entity should also be refreshed, not just the snapshot.
    assert.fieldEquals('Position', POSITION_ADDRESS.toHex(), 'pricePerShare', freshPrice.toString())
  })
})
