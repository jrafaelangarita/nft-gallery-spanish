import { denyList, statemineDenyList } from '@/utils/constants'

export function getDenyList(prefix: string): string[] | undefined {
  switch (prefix) {
    case 'rmrk':
      return denyList
    case 'statemine':
    case 'westmint':
      return statemineDenyList
    default:
      return undefined
  }
}

export function isRemark(prefix: string): boolean {
  return prefix === 'rmrk'
}

export function getSupportedClient(prefix: string): 'subquery' | 'subsquid' {
  switch (prefix) {
    case 'statemine':
    case 'westmint':
    case 'rmrk':
      return 'subquery'
    case 'bsx':
      return 'subsquid'
    default:
      return 'subsquid'
  }
}

export function prefixBuildOnText(prefix: string): string {
  switch (prefix) {
    case 'bsx':
      return 'Basilisk NFT Pallet'
    case 'statemine':
    case 'westmint':
      return 'Statemine Unique Pallet'
    case 'moonsama':
      return 'EVM Smart Contracts'
    default:
      return 'RMRK Protocol'
  }
}

export const hasMarketplace = (prefix: string): boolean =>
  ['rmrk', 'bsx'].includes(prefix)
