import { PositionOpened, PositionClosed, FeatureCalled } from '../../generated/templates/Position/Position'
import { Position } from '../../generated/schema'
import { ADDRESS_ZERO, BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO } from '../utils/constants'
import { PositionInfo } from '../utils/position-info'
import { updateData } from '../processor/data-processor'
import { quoteTokenToUsd } from '../utils/oracle'

export function handlePositionOpened(event: PositionOpened): void {
  const position = Position.load(event.address)!
  position.openedAt = event.block.timestamp
  position.updatedAt = position.openedAt
  position.closedAt = BIG_INT_ZERO // in case we are reusing position
  position.txCount = position.txCount.plus(BIG_INT_ONE)
  position.totalAllocated = event.params.pushed
  position.asset = event.params.asset

  const info = new PositionInfo(event.address)
  position.borrowToken = info.borrowToken()
  position.pricePerShare = info.pricePerShare()
  position.totalDeposited = info.totalDeposited()
  position.totalDepositedUSD = quoteTokenToUsd(position.asset, position.totalDeposited)
  position.totalBorrowed = info.totalBorrowed()
  position.totalBorrowedUSD = quoteTokenToUsd(position.borrowToken, position.totalBorrowed)
  position.isOutdated = info.isOutdated()

  position.save()

  updateData(event.block.timestamp)
}

export function handlePositionClosed(event: PositionClosed): void {
  const position = Position.load(event.address)!
  position.totalAllocated = event.params.pulled
  position.closedAt = event.block.timestamp
  position.updatedAt = position.closedAt
  position.txCount = BIG_INT_ZERO
  position.asset = ADDRESS_ZERO
  position.borrowToken = ADDRESS_ZERO
  position.pricePerShare = BIG_INT_ZERO
  position.totalDeposited = BIG_INT_ZERO
  position.totalDepositedUSD = BIG_DECIMAL_ZERO
  position.totalBorrowed = BIG_INT_ZERO
  position.totalBorrowedUSD = BIG_DECIMAL_ZERO

  const info = new PositionInfo(event.address)
  position.isOutdated = info.isOutdated()

  position.save()

  updateData(event.block.timestamp)
}

export function handleFeatureCalled(event: FeatureCalled): void {
  const position = Position.load(event.address)!
  position.txCount = position.txCount.plus(BIG_INT_ONE)
  position.totalAllocated = event.params.allocatedAfter

  const info = new PositionInfo(event.address)
  position.pricePerShare = info.pricePerShare()
  position.totalDeposited = info.totalDeposited()
  position.totalDepositedUSD = quoteTokenToUsd(position.asset, position.totalDeposited)
  position.totalBorrowed = info.totalBorrowed()
  position.totalBorrowedUSD = quoteTokenToUsd(position.borrowToken, position.totalBorrowed)
  position.isOutdated = info.isOutdated()
  position.updatedAt = event.block.timestamp
  position.save()

  updateData(event.block.timestamp)
}
