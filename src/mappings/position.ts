import { PositionOpened, PositionClosed, FeatureCalled } from '../../generated/templates/Position/Position'
import { Position } from '../../generated/schema'
import { BIG_INT_ONE } from '../utils/constants'
import { PositionInfo } from '../utils/position-info'
import { createSnapshot } from '../processor/snapshot-processor'

export function handlePositionOpened(event: PositionOpened): void {
  const position = Position.load(event.address)!
  position.openedAt = event.block.timestamp
  position.updatedAt = position.openedAt
  position.txCount = position.txCount.plus(BIG_INT_ONE)
  position.totalAllocated = event.params.pushed
  position.asset = event.params.asset

  const info = new PositionInfo(event.address)
  position.borrowToken = info.borrowToken()
  position.pricePerShare = info.pricePerShare()
  position.totalDeposited = info.totalDeposited()
  position.totalBorrowed = info.totalBorrowed()
  position.isOutdated = info.isOutdated()

  position.save()

  createSnapshot(event.block.timestamp, position)
}

export function handlePositionClosed(event: PositionClosed): void {
  const position = Position.load(event.address)!
  position.totalAllocated = event.params.pulled
  position.closedAt = event.block.timestamp
  position.updatedAt = position.closedAt
  position.txCount = position.txCount.plus(BIG_INT_ONE)

  const info = new PositionInfo(event.address)
  position.pricePerShare = info.pricePerShare()
  position.totalDeposited = info.totalDeposited()
  position.totalBorrowed = info.totalBorrowed()
  position.isOutdated = info.isOutdated()

  position.save()

  createSnapshot(event.block.timestamp, position)
}

export function handleFeatureCalled(event: FeatureCalled): void {
  const position = Position.load(event.address)!
  position.txCount = position.txCount.plus(BIG_INT_ONE)
  position.totalAllocated = event.params.allocatedAfter

  const info = new PositionInfo(event.address)
  position.pricePerShare = info.pricePerShare()
  position.totalDeposited = info.totalDeposited()
  position.totalBorrowed = info.totalBorrowed()
  position.isOutdated = info.isOutdated()
  position.updatedAt = event.block.timestamp
  position.save()

  createSnapshot(event.block.timestamp, position)
}
