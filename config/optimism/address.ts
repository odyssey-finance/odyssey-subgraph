import { Address } from '@graphprotocol/graph-ts'

export const POSITION_REGISTRY = Address.fromString('0xeE156D8ea7b96a5524CcC3CF9283ab85E80E9534')
export const MASTER_ORACLE = Address.fromString('0x0aac835162D368F246dc71628AfcD6d2930c47d3')
// NOTE: Subgraph expects lowercase addresses, so make sure to use token-oracle pairs with lowercase addresses.
export const TOKEN_ORACLES = new Map<string, string>()
