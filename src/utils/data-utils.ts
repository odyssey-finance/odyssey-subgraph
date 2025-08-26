import { BigInt, Bytes } from '@graphprotocol/graph-ts'
import { BIG_INT_ZERO } from './constants'
import { Position } from '../../generated/schema'

export function getDailyDataId(entityId: Bytes, dayId: BigInt): string {
  return entityId.toHex().concat('-').concat(dayId.toString())
}

/**
 * Validates if a position is eligible for daily data update.
 * A position is NEVER_OPENED if openedAt == 0 and closedAt == 0
 *               CLOSED if openedAt > 0 and closedAt > 0
 *               OPENED is openedAt > 0 and closedAt == 0
 * @returns true if the position:
 * - Has been opened (openedAt > 0 && closedAt == 0)
 * - Has deposits (totalDeposited > 0)
 */
export function isPositionEligibleForUpdate(position: Position): boolean {
  return (
    position.openedAt.gt(BIG_INT_ZERO) &&
    position.closedAt.equals(BIG_INT_ZERO) &&
    position.totalDeposited.gt(BIG_INT_ZERO)
  )
}
