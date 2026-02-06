import { Address, BigInt } from '@graphprotocol/graph-ts'

export const ADDRESS_ZERO = Address.fromString('0x0000000000000000000000000000000000000000')

export const BIG_INT_ZERO = BigInt.zero()
export const BIG_INT_ONE = BigInt.fromI32(1)

export const SECONDS_PER_DAY = BigInt.fromI32(86400)
