import { Address, BigDecimal, BigInt, Bytes, log } from '@graphprotocol/graph-ts'
import { MASTER_ORACLE, TOKEN_ORACLES } from '../utils/address'
import { MasterOracle } from '../../generated/templates/Position/MasterOracle'
import { ChainlinkOracle } from '../../generated/templates/Position/ChainlinkOracle'
import { ADDRESS_ZERO, BIG_DECIMAL_18, BIG_DECIMAL_ZERO, BIG_INT_ZERO } from './constants'

function getOracleAddress(token: Address): Address | null {
  if (TOKEN_ORACLES.has(token.toHexString())) {
    const oracleAddress = TOKEN_ORACLES.get(token.toHexString())
    return Address.fromString(oracleAddress)
  }
  return null
}

function getQuote(token: Address, amount: BigInt): BigDecimal | null {
  const oracleAddress = getOracleAddress(token)

  if (!oracleAddress) {
    return null
  }
  const chainlinkOracle = ChainlinkOracle.bind(oracleAddress)

  // Get price data
  const roundData = chainlinkOracle.latestRoundData()
  const price = roundData.value1

  // Calculate final amount considering both price and token decimals
  const priceDecimals = chainlinkOracle.decimals()
  // ChainlinkOracle interface decimals function just like any ERC20
  const tokenDecimals = ChainlinkOracle.bind(token).decimals()

  const priceScaleDivisor = BigInt.fromI32(10).pow(u8(priceDecimals)).toBigDecimal()
  const tokenScaleDivisor = BigInt.fromI32(10).pow(u8(tokenDecimals)).toBigDecimal()

  // Convert to BigDecimal before the division
  return amount.times(price).toBigDecimal().div(priceScaleDivisor).div(tokenScaleDivisor)
}

export function quoteTokenToUsd(token: Bytes, amount: BigInt): BigDecimal {
  if (amount.equals(BIG_INT_ZERO) || token.equals(ADDRESS_ZERO)) return BIG_DECIMAL_ZERO

  const primaryQuote = getQuote(Address.fromBytes(token), amount)
  if (primaryQuote) return primaryQuote

  // Fallback to MasterOracle
  const oracle = MasterOracle.bind(MASTER_ORACLE)
  const quote = oracle.quoteTokenToUsd(Address.fromBytes(token), amount)
  return quote.toBigDecimal().div(BIG_DECIMAL_18)
}
