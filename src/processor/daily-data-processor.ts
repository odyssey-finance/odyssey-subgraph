import { Bytes, BigInt } from '@graphprotocol/graph-ts'
import {
  Position,
  PositionDailyData,
  PositionRegistry,
  PositionRegistryDailyData,
  SmartAccount,
  SmartAccountDailyData,
} from '../../generated/schema'
import { POSITION_REGISTRY } from '../utils/address'
import { BIG_INT_ZERO, SECONDS_PER_DAY } from '../utils/constants'

function getDailyDataId(entityId: Bytes, dayId: BigInt): string {
  return entityId.toHex().concat('-').concat(dayId.toString())
}

function createRegistryDailyData(
  positionRegistry: PositionRegistry,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): PositionRegistryDailyData {
  const dailyDataId = getDailyDataId(positionRegistry.id, dayId)
  let dailyData = PositionRegistryDailyData.load(dailyDataId)
  if (dailyData) return dailyData

  dailyData = new PositionRegistryDailyData(dailyDataId)
  dailyData.dayStartTimestamp = dayStartTimestamp
  dailyData.createdAt = blockTimestamp
  dailyData.positionCount = positionRegistry.positionCount
  dailyData.smartAccountCount = positionRegistry.smartAccountCount
  dailyData.positionRegistry = positionRegistry.id
  dailyData.save()

  return dailyData
}

function createSmartAccountDailyData(
  smartAccount: SmartAccount,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): SmartAccountDailyData {
  const dailyDataId = getDailyDataId(smartAccount.id, dayId)
  let dailyData = SmartAccountDailyData.load(dailyDataId)
  if (dailyData) return dailyData

  dailyData = new SmartAccountDailyData(dailyDataId)
  dailyData.dayStartTimestamp = dayStartTimestamp
  dailyData.createdAt = blockTimestamp
  dailyData.smartAccount = smartAccount.id
  dailyData.save()
  return dailyData
}

function createPositionDailyData(
  position: Position,
  blockTimestamp: BigInt,
  dayId: BigInt,
  dayStartTimestamp: BigInt,
): PositionDailyData {
  const dailyDataId = getDailyDataId(position.id, dayId)
  let dailyData = PositionDailyData.load(dailyDataId)
  if (dailyData) return dailyData

  dailyData = new PositionDailyData(dailyDataId)
  dailyData.dayStartTimestamp = dayStartTimestamp
  dailyData.createdAt = blockTimestamp
  dailyData.pricePerShare = position.pricePerShare
  dailyData.totalDeposited = position.totalDeposited
  dailyData.totalBorrowed = position.totalBorrowed
  dailyData.position = position.id
  dailyData.save()
  return dailyData
}

/**
 * Creates daily snapshots for all entities if not already created for the day.
 * Called after position events to capture daily state.
 */
export function createDailyData(timestamp: BigInt): void {
  const positionRegistry = PositionRegistry.load(POSITION_REGISTRY)
  if (!positionRegistry || positionRegistry.positionCount.equals(BIG_INT_ZERO)) return

  const dayId = timestamp.div(SECONDS_PER_DAY)
  const dayStartTimestamp = dayId.times(SECONDS_PER_DAY)

  createRegistryDailyData(positionRegistry, timestamp, dayId, dayStartTimestamp)

  const smartAccounts = positionRegistry.smartAccounts.load()
  for (let i = 0; i < smartAccounts.length; i++) {
    const smartAccount = SmartAccount.load(smartAccounts[i].id)
    if (!smartAccount) continue

    createSmartAccountDailyData(smartAccount, timestamp, dayId, dayStartTimestamp)

    const positions = smartAccount.positions.load()
    for (let j = 0; j < positions.length; j++) {
      const position = Position.load(positions[j].id)
      if (!position) continue

      createPositionDailyData(position, timestamp, dayId, dayStartTimestamp)
    }
  }
}
