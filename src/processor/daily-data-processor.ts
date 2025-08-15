import { BigInt } from '@graphprotocol/graph-ts'
import {
  Position,
  PositionDailyData,
  PositionRegistry,
  PositionRegistryDailyData,
  SmartAccount,
  SmartAccountDailyData,
} from '../../generated/schema'
import { BIG_DECIMAL_ZERO } from '../utils/constants'
import { quoteTokenToUsd } from '../utils/oracle'
import { getDailyDataId, isPositionEligibleForUpdate } from '../utils/data-utils'

function loadOrCreateRegistryDailyData(
  positionRegistry: PositionRegistry,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): PositionRegistryDailyData {
  const dailyDataId = getDailyDataId(positionRegistry.id, dayId)
  let dailyData = PositionRegistryDailyData.load(dailyDataId)
  if (!dailyData) {
    dailyData = new PositionRegistryDailyData(dailyDataId)
    dailyData.dayStartTimestamp = dayStartTimestamp
    dailyData.createdAt = blockTimestamp
    dailyData.positionCount = positionRegistry.positionCount
    dailyData.smartAccountCount = positionRegistry.smartAccountCount
    dailyData.totalDepositedUSD = BIG_DECIMAL_ZERO
    dailyData.positionRegistry = positionRegistry.id
    dailyData.save()
  }
  return dailyData
}

function loadOrCreateSmartAccountDailyData(
  smartAccount: SmartAccount,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): SmartAccountDailyData {
  const dailyDataId = getDailyDataId(smartAccount.id, dayId)
  let dailyData = SmartAccountDailyData.load(dailyDataId)
  if (!dailyData) {
    dailyData = new SmartAccountDailyData(dailyDataId)
    dailyData.dayStartTimestamp = dayStartTimestamp
    dailyData.createdAt = blockTimestamp
    dailyData.totalDepositedUSD = BIG_DECIMAL_ZERO
    dailyData.smartAccount = smartAccount.id
    dailyData.save()
  }
  return dailyData
}

function updatePositionDailyData(
  position: Position,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): PositionDailyData | null {
  if (!isPositionEligibleForUpdate(position)) return null

  const dailyDataId = getDailyDataId(position.id, dayId)

  let positionDailyData = PositionDailyData.load(dailyDataId)
  if (!positionDailyData) {
    positionDailyData = new PositionDailyData(dailyDataId)
    positionDailyData.dayStartTimestamp = dayStartTimestamp
    positionDailyData.createdAt = blockTimestamp
    positionDailyData.pricePerShare = position.pricePerShare
    positionDailyData.totalDeposited = position.totalDeposited
    positionDailyData.totalBorrowed = position.totalBorrowed
    if (blockTimestamp == position.updatedAt) {
      positionDailyData.totalDepositedUSD = position.totalDepositedUSD
      positionDailyData.totalBorrowedUSD = position.totalBorrowedUSD
    } else {
      positionDailyData.totalDepositedUSD = quoteTokenToUsd(position.asset, position.totalDeposited)
      positionDailyData.totalBorrowedUSD = quoteTokenToUsd(position.asset, position.totalBorrowed)
    }
    positionDailyData.position = position.id
    positionDailyData.save()
  }
  return positionDailyData
}

function updateSmartAccountDailyData(
  smartAccount: SmartAccount,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): SmartAccountDailyData {
  let saDailyData = loadOrCreateSmartAccountDailyData(smartAccount, blockTimestamp, dayId, dayStartTimestamp)
  let totalDepositedUSD = BIG_DECIMAL_ZERO

  const positions = smartAccount.positions.load()
  for (let j = 0; j < positions.length; j++) {
    const position = Position.load(positions[j].id)
    if (!position) continue

    const positionDailyData = updatePositionDailyData(position, blockTimestamp, dayId, dayStartTimestamp)
    if (positionDailyData) {
      totalDepositedUSD = totalDepositedUSD.plus(positionDailyData.totalDepositedUSD)
    }
  }

  saDailyData.totalDepositedUSD = totalDepositedUSD
  saDailyData.save()
  return saDailyData
}

function isDailyDataUpdated(positionRegistry: PositionRegistry, dayId: BigInt, dayStartTimestamp: BigInt): boolean {
  const dailyDataId = getDailyDataId(positionRegistry.id, dayId)
  const dailyData = PositionRegistryDailyData.load(dailyDataId)

  if (!dailyData) return false

  // If data exists for this day and has been updated, return true
  return dailyData.dayStartTimestamp == dayStartTimestamp
}

export function updateDailyData(
  positionRegistry: PositionRegistry,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): void {
  if (isDailyDataUpdated(positionRegistry, dayId, dayStartTimestamp)) {
    return
  }

  let prDailyData = loadOrCreateRegistryDailyData(positionRegistry, blockTimestamp, dayId, dayStartTimestamp)
  let totalDepositedUSD = BIG_DECIMAL_ZERO

  const smartAccounts = positionRegistry.smartAccounts.load()
  for (let i = 0; i < smartAccounts.length; i++) {
    const smartAccount = SmartAccount.load(smartAccounts[i].id)
    if (!smartAccount) continue

    const saDailyData = updateSmartAccountDailyData(smartAccount, blockTimestamp, dayId, dayStartTimestamp)
    totalDepositedUSD = totalDepositedUSD.plus(saDailyData.totalDepositedUSD)
  }

  prDailyData.totalDepositedUSD = totalDepositedUSD
  prDailyData.save()
}
