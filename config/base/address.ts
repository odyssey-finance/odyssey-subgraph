import { Address } from '@graphprotocol/graph-ts'

export const POSITION_REGISTRY = Address.fromString('0xeE156D8ea7b96a5524CcC3CF9283ab85E80E9534')
export const MASTER_ORACLE = Address.fromString('0x99866a6074ADb027f09c9AF31929dB5941D36DA7')
// NOTE: Subgraph expects lowercase addresses, so make sure to use token-oracle pairs with lowercase addresses.
export const TOKEN_ORACLES = new Map<string, string>()
