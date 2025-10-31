import { Address } from '@graphprotocol/graph-ts'

export const POSITION_REGISTRY = Address.fromString('0xeE156D8ea7b96a5524CcC3CF9283ab85E80E9534')
export const MASTER_ORACLE = Address.fromString('0xd31F42cf356e02689d1720B5FFaA6FC7229D255b')

// NOTE: Subgraph expects lowercase addresses, so make sure to use token-oracle pairs with lowercase addresses.
export const TOKEN_ORACLES = new Map<string, string>()
// xUSD/USD - EOracle
TOKEN_ORACLES.set('0x6eaf19b2fc24552925db245f9ff613157a7dbb4c', '0x51d947b18f546696c31d9a1c81b55d84e6d8e959')
// USDT0/USD - Chainlink
TOKEN_ORACLES.set('0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb', '0x70b77fcdbe2293423e41add2fb599808396807bc')
