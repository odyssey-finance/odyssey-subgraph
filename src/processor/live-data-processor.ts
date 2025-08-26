import { BigInt } from '@graphprotocol/graph-ts'
import { Position, PositionDailyData, PositionRegistry, SmartAccount } from '../../generated/schema'
import { getDailyDataId, isPositionEligibleForUpdate } from '../utils/data-utils'
import { BIG_DECIMAL_ZERO } from '../utils/constants'
import { quoteTokenToUsd } from '../utils/oracle'

/**
 * Updates position totalDepositedUSD from its daily data
 * @returns Updated position or null if update failed
 */
function updatePosition(position: Position, dayId: BigInt, blockTimestamp: BigInt): Position | null {
  if (!isPositionEligibleForUpdate(position)) return null

  const dailyData = PositionDailyData.load(getDailyDataId(position.id, dayId))
  if (!dailyData) return null
  if (blockTimestamp == dailyData.createdAt) {
    position.totalDepositedUSD = dailyData.totalDepositedUSD
    position.totalBorrowedUSD = dailyData.totalBorrowedUSD
  } else {
    position.totalDepositedUSD = quoteTokenToUsd(position.asset, position.totalDeposited)
    position.totalBorrowedUSD = quoteTokenToUsd(position.borrowToken, position.totalBorrowed)
  }
  position.updatedAt = blockTimestamp
  position.save()

  return position
}

/**
 * Updates smart account totalDepositedUSD from its positions
 * @returns Updated smart account
 */
function updateSmartAccount(smartAccount: SmartAccount, dayId: BigInt, blockTimestamp: BigInt): SmartAccount {
  let totalDepositedUSD = BIG_DECIMAL_ZERO

  const positions = smartAccount.positions.load()
  for (let i = 0; i < positions.length; i++) {
    const position = Position.load(positions[i].id)
    if (!position) continue

    const updatedPosition = updatePosition(position, dayId, blockTimestamp)
    if (updatedPosition) {
      totalDepositedUSD = totalDepositedUSD.plus(updatedPosition.totalDepositedUSD)
    }
  }

  smartAccount.totalDepositedUSD = totalDepositedUSD
  smartAccount.updatedAt = blockTimestamp
  smartAccount.save()

  return smartAccount
}

/**
 * Updates live data for the entire protocol
 * Processes positions -> smart accounts -> registry hierarchy
 */
export function updateLiveData(positionRegistry: PositionRegistry, dayId: BigInt, blockTimestamp: BigInt): void {
  const smartAccounts = positionRegistry.smartAccounts.load()
  if (!smartAccounts) return

  let totalDepositedUSD = BIG_DECIMAL_ZERO

  for (let i = 0; i < smartAccounts.length; i++) {
    const smartAccount = SmartAccount.load(smartAccounts[i].id)
    if (!smartAccount) continue

    const updatedAccount = updateSmartAccount(smartAccount, dayId, blockTimestamp)
    totalDepositedUSD = totalDepositedUSD.plus(updatedAccount.totalDepositedUSD)
  }

  positionRegistry.totalDepositedUSD = totalDepositedUSD
  positionRegistry.updatedAt = blockTimestamp
  positionRegistry.save()
}
