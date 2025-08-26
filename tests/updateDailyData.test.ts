import { newMockEvent } from 'matchstick-as'
import { assert, describe, test, clearStore, afterAll } from 'matchstick-as/assembly/index'
import { BigInt } from '@graphprotocol/graph-ts'
import { POSITION_ADDRESS } from './utils/addresses'
import { openPosition } from './utils/setup'
import { updateData } from '../src/processor/data-processor'
import { BIG_DECIMAL_18 } from '../src/utils/constants'

describe('Daily Data: polling block handler', () => {
  afterAll(() => {
    clearStore()
  })

  test('Handle daily data', () => {
    const entityType = 'PositionDailyData'
    // positionAddress-dayId. for tests it is '0x0000000000000000000000000000000000000005-0'
    const id = POSITION_ADDRESS.toHex().concat('-0')

    const totalAllocated = BigInt.fromI32(1000)
    const totalAllocatedUSD = totalAllocated.toBigDecimal().div(BIG_DECIMAL_18)
    const pricePerShare = BigInt.fromI32(121)
    const isOutdated = true
    openPosition(totalAllocated, pricePerShare, isOutdated)
    updateData(newMockEvent().block.timestamp)

    assert.entityCount(entityType, 1)
    // given borrow is zero, totalDeposited is same as totalAllocated for this test.
    assert.fieldEquals(entityType, id, 'totalDeposited', totalAllocated.toString())
    assert.fieldEquals(entityType, id, 'totalDepositedUSD', totalAllocatedUSD.toString())
    assert.fieldEquals(entityType, id, 'pricePerShare', pricePerShare.toString())
  })
})
