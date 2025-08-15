import { Address, BigInt } from '@graphprotocol/graph-ts'
import {
  OwnershipTransferred,
  PositionDeployed as PositionDeployedEvent,
  StrategyAdded as StrategyAddedEvent,
  PositionRegistry as PositionRegistryContract,
  IsActiveUpdated,
  FeeCollectorUpdated,
  FeePolicyUpdated,
  ImplementationUpdated,
} from '../../generated/PositionRegistry/PositionRegistry'
import { PositionRegistry, Position, Strategy, SmartAccount } from '../../generated/schema'
import { Position as PositionTemplate } from '../../generated/templates'
import { ADDRESS_ZERO, BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from '../utils/constants'

function loadOrCreateSmartAccount(id: Address, timestamp: BigInt): SmartAccount {
  let smartAccount = SmartAccount.load(id)
  if (!smartAccount) {
    smartAccount = new SmartAccount(id)
    smartAccount.positionCount = BIG_INT_ZERO
    smartAccount.positionRegistry = ADDRESS_ZERO
    smartAccount.totalDepositedUSD = BIG_DECIMAL_ZERO
    smartAccount.updatedAt = timestamp
    smartAccount.save()
  }
  return smartAccount
}

export function handlePositionDeployed(event: PositionDeployedEvent): void {
  const timestamp = event.block.timestamp
  // at this point we know that positionRegistry is initialized
  const registry = PositionRegistry.load(event.address)!
  registry.updatedAt = timestamp

  // Set PositionRegistry in SmartAccount. This update mark smartAccount as Odyssey smartAccount.
  const smartAccount = loadOrCreateSmartAccount(event.params.owner, timestamp)
  if (smartAccount.positionRegistry == ADDRESS_ZERO) {
    smartAccount.positionRegistry = registry.id
    registry.smartAccountCount = registry.smartAccountCount.plus(BIG_INT_ONE)
  }

  // create new position entity
  const position = new Position(event.params.position)
  position.owner = smartAccount.id
  position.strategyId = event.params.strategyId
  position.createdAt = timestamp
  position.updatedAt = timestamp
  position.openedAt = BIG_INT_ZERO
  position.closedAt = BIG_INT_ZERO
  position.txCount = BIG_INT_ZERO
  position.totalAllocated = BIG_INT_ZERO
  position.totalDeposited = BIG_INT_ZERO
  position.totalDepositedUSD = BIG_DECIMAL_ZERO
  position.totalBorrowed = BIG_INT_ZERO
  position.totalBorrowedUSD = BIG_DECIMAL_ZERO
  position.pricePerShare = BIG_INT_ZERO
  position.asset = ADDRESS_ZERO
  position.borrowToken = ADDRESS_ZERO
  position.isOutdated = false

  smartAccount.updatedAt = timestamp
  smartAccount.positionCount = smartAccount.positionCount.plus(BIG_INT_ONE)

  registry.positionCount = registry.positionCount.plus(BIG_INT_ONE)

  // create new datasource for the position
  PositionTemplate.create(event.params.position)
  position.save()

  smartAccount.save()
  registry.save()
}

export function handleStrategyAdded(event: StrategyAddedEvent): void {
  const strategy = new Strategy(event.params.strategyId.toString())

  // at this point we know that positionRegistry is initialized
  strategy.positionRegistry = PositionRegistry.load(event.address)!.id

  strategy.implementation = event.params.implementation
  strategy.feePolicy = event.params.feePolicy
  strategy.isActive = true
  strategy.save()
}

export function handleIsActiveUpdated(event: IsActiveUpdated): void {
  const strategy = Strategy.load(event.params.strategyId.toString())!
  strategy.isActive = event.params.isActive
  strategy.save()
}

export function handleFeePolicyUpdated(event: FeePolicyUpdated): void {
  const strategy = Strategy.load(event.params.strategyId.toString())!
  strategy.feePolicy = event.params.newFeePolicy
  strategy.save()
}

export function handleImplementationUpdated(event: ImplementationUpdated): void {
  const strategy = Strategy.load(event.params.strategyId.toString())!
  strategy.implementation = event.params.newImplementation
  strategy.save()
}

// This handler will create PositionRegistry entity and also update owner.
export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let positionRegistry = PositionRegistry.load(event.address)
  if (!positionRegistry) {
    positionRegistry = new PositionRegistry(event.address)
    positionRegistry.feeCollector = PositionRegistryContract.bind(event.address).feeCollector()
    positionRegistry.positionCount = BIG_INT_ZERO
    positionRegistry.smartAccountCount = BIG_INT_ZERO
    positionRegistry.totalDepositedUSD = BIG_DECIMAL_ZERO
  }
  // update the owner
  positionRegistry.owner = event.params.newOwner
  positionRegistry.updatedAt = event.block.timestamp
  positionRegistry.save()
}

export function handleFeeCollectorUpdated(event: FeeCollectorUpdated): void {
  const positionRegistry = PositionRegistry.load(event.address)!
  positionRegistry.feeCollector = event.params.newFeeCollector
  positionRegistry.updatedAt = event.block.timestamp
  positionRegistry.save()
}
