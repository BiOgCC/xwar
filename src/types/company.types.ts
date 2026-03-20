// ══════════════════════════════════════════════
// XWAR — Company Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export type CompanyType =
  | 'bitcoin_miner'
  | 'wheat_farm' | 'fish_farm' | 'steak_farm'
  | 'bakery' | 'sushi_bar' | 'wagyu_grill'
  | 'green_ammo_factory' | 'blue_ammo_factory' | 'purple_ammo_factory'
  | 'oil_refinery' | 'materialx_refiner' | 'prospection_center'

export interface Company {
  id: string
  type: CompanyType
  level: number
  autoProduction: boolean
  productionProgress: number
  productionMax: number
  location: string
  disabledUntil?: number
}

export interface CompanyTemplate {
  type: CompanyType
  label: string
  icon: string
  color: string
  desc: string
  produces: string
  buildCost: { money: number; bitcoin: number }
  baseProductionMax: number
}

export interface DepositEvent {
  id: string
  resource: 'Oil' | 'MaterialX'
  country: string
  bitcoinReward: number
  timestamp: number
}

export interface JobListing {
  id: string
  companyId: string
  employerName: string
  companyType: CompanyType
  companyLevel: number
  payPerPP: number
  productionBonus: number
  location: string
}

export interface CompanyTransaction {
  id: string
  message: string
  timestamp: number
}
