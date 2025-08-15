import { BigInt } from '@graphprotocol/graph-ts'
import { PositionRegistry } from '../../generated/schema'
import { POSITION_REGISTRY } from '../utils/address'
import { BIG_INT_ZERO, SECONDS_PER_DAY } from '../utils/constants'
import { updateDailyData } from './daily-data-processor'
import { updateLiveData } from './live-data-processor'

export function updateData(timestamp: BigInt): void {
  const positionRegistry = PositionRegistry.load(POSITION_REGISTRY)
  if (!positionRegistry || positionRegistry.positionCount.equals(BIG_INT_ZERO)) return

  const dayId = timestamp.div(SECONDS_PER_DAY)
  const dayStartTimestamp = dayId.times(SECONDS_PER_DAY)

  updateDailyData(positionRegistry, timestamp, dayId, dayStartTimestamp)
  updateLiveData(positionRegistry, dayId, timestamp)
}
