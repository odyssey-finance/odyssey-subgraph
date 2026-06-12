import { createMockedFunction, newMockEvent } from 'matchstick-as'
import { assert, describe, test, clearStore, afterEach } from 'matchstick-as/assembly/index'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { handleImplementationUpdated, handleStrategyAdded } from '../src/mappings/position-registry'
import { StrategyAdded } from '../generated/PositionRegistry/PositionRegistry'
import { FEE_POLICY_ADDRESS, POSITION_ADDRESS, POSITION_REGISTRY_ADDRESS, STRATEGY_ADDRESS } from './utils/addresses'
import { createImplementationUpdatedEvent, openPosition } from './utils/setup'

function createStrategyAddedEvent(strategyId: BigInt, implementation: Address, feePolicy: Address): StrategyAdded {
  const event = changetype<StrategyAdded>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(new ethereum.EventParam('strategyId', ethereum.Value.fromUnsignedBigInt(strategyId)))
  event.parameters.push(new ethereum.EventParam('implementation', ethereum.Value.fromAddress(implementation)))
  event.parameters.push(new ethereum.EventParam('feePolicy', ethereum.Value.fromAddress(feePolicy)))
  event.address = POSITION_REGISTRY_ADDRESS
  return event
}

describe('PositionRegistry: ImplementationUpdated event', () => {
  afterEach(() => {
    clearStore()
  })

  test('Position isOutdated flag is propagated when strategy implementation changes', () => {
    // Open a position on strategyId=1 (per openPosition helper) with isOutdated=false.
    openPosition(BigInt.fromI32(1000), BigInt.fromI32(100), false)
    handleStrategyAdded(createStrategyAddedEvent(BigInt.fromI32(1), STRATEGY_ADDRESS, FEE_POLICY_ADDRESS))
    assert.fieldEquals('Position', POSITION_ADDRESS.toHex(), 'isOutdated', 'false')

    // Strategy now upgrades implementation; on-chain isOutdated() flips for the old position.
    createMockedFunction(POSITION_ADDRESS, 'isOutdated', 'isOutdated():(bool)').returns([
      ethereum.Value.fromBoolean(true),
    ])
    const newImpl = Address.fromString('0x00000000000000000000000000000000000000F0')
    handleImplementationUpdated(createImplementationUpdatedEvent(BigInt.fromI32(1), newImpl))

    assert.fieldEquals('Position', POSITION_ADDRESS.toHex(), 'isOutdated', 'true')
  })

  test('Positions on other strategies are not touched', () => {
    openPosition(BigInt.fromI32(1000), BigInt.fromI32(100), false)
    handleStrategyAdded(createStrategyAddedEvent(BigInt.fromI32(1), STRATEGY_ADDRESS, FEE_POLICY_ADDRESS))
    handleStrategyAdded(createStrategyAddedEvent(BigInt.fromI32(2), STRATEGY_ADDRESS, FEE_POLICY_ADDRESS))

    // Implementation changes on strategy 2; our position is on strategy 1, must stay false.
    const newImpl = Address.fromString('0x00000000000000000000000000000000000000F0')
    handleImplementationUpdated(createImplementationUpdatedEvent(BigInt.fromI32(2), newImpl))

    assert.fieldEquals('Position', POSITION_ADDRESS.toHex(), 'isOutdated', 'false')
  })
})
