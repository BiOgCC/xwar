// ══════════════════════════════════════════════
// XWAR — World / Country Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export interface NationalFund {
  money: number
  oil: number
  scrap: number
  materialX: number
  bitcoin: number
  jets: number
}

export type NationalFundKey = keyof NationalFund

export type DepositType = 'wheat' | 'fish' | 'steak' | 'oil' | 'materialx'

export interface RegionalDeposit {
  id: string
  type: DepositType
  countryCode: string
  regionId: string          // Region inside the country where the deposit was found
  bonus: number             // 25–33% production bonus
  expiresAt: number         // Timestamp when the deposit expires (0 = not yet discovered)
  discoveredBy: string | null
  active: boolean
}

export type ConqueredResourceType = 'Iron' | 'Titanium' | 'Saltpeter' | 'Rubber' | 'Silicon' | 'Uranium'

export interface Country {
  name: string
  code: string
  controller: string
  empire: string | null
  population: number
  regions: number
  military: number
  fund: NationalFund
  forceVault: NationalFund   // Military budget — funded from country treasury, finances operations & players
  color: string
  conqueredResources: ConqueredResourceType[]
  activeDepositBonus: { type: DepositType; bonus: number } | null
  portLevel: number
  airportLevel: number
  bunkerLevel: number
  militaryBaseLevel: number
  hasPort: boolean
  hasAirport: boolean
  taxExempt: boolean
}

export interface War {
  id: string
  attacker: string
  defender: string
  startedAt: number
  status: 'active' | 'ceasefire' | 'ended'
}
