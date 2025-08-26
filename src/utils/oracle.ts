import { Address, BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { MASTER_ORACLE } from '../utils/address'
import { MasterOracle } from '../../generated/templates/Position/MasterOracle'
import { ADDRESS_ZERO, BIG_DECIMAL_18, BIG_DECIMAL_ZERO, BIG_INT_ZERO } from './constants'

export function quoteTokenToUsd(token: Bytes, amount: BigInt): BigDecimal {
  if (amount.equals(BIG_INT_ZERO) || token.equals(ADDRESS_ZERO)) return BIG_DECIMAL_ZERO

  const oracle: MasterOracle = MasterOracle.bind(MASTER_ORACLE)
  const quote = oracle.quoteTokenToUsd(Address.fromBytes(token), amount)
  return quote.toBigDecimal().div(BIG_DECIMAL_18)
}
