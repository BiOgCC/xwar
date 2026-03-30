// ══════════════════════════════════════════════
// XWAR — Government Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

import type { NationalFund } from './world.types'


export type LawType =
  | 'declare_war' | 'propose_peace' | 'impeach_president'
  | 'tax_change' | 'declare_sworn_enemy'
  | 'authorize_nuclear_action' | 'propose_alliance' | 'break_alliance'
  // Economic & military policy laws
  | 'print_money' | 'trade_embargo' | 'lift_embargo'
  | 'conscription' | 'end_conscription'
  | 'import_tariff' | 'minimum_wage'
  | 'military_spending_change' | 'nationalize_company_law'

export type LawStatus = 'active' | 'passed' | 'failed'

export interface Citizen {
  id: string
  name: string
  level: number
  role: 'president' | 'vicepresident' | 'defense_minister' | 'eco_minister' | 'minister' | 'congress' | 'citizen'
  joinedAt: number
}

export interface Law {
  id: string
  countryId: string
  proposerId: string
  type: LawType
  targetCountryId?: string
  newValue?: number
  stringValue?: string   // for company IDs, etc.
  votesFor: string[]
  votesAgainst: string[]
  proposedAt: number
  expiresAt: number
  status: LawStatus
}

export interface Candidate {
  id: string
  name: string
  votes: number            // legacy flat count (kept for compat)
  weightedVotes: number    // total PP-weighted vote tally
  voterIds: string[]       // unique voter IDs (for coalition threshold)
}

/** A single timestamped contribution entry for PP rolling window. */
export interface ContributionEntry {
  type: 'damage' | 'production' | 'donation'
  amount: number
  timestamp: number
}

/** Per-citizen rolling contribution log for Political Power computation. */
export interface CitizenContributions {
  citizenId: string
  entries: ContributionEntry[]
}

export type IdeologyType = 'militarist' | 'capitalist' | 'technocrat' | 'expansionist'

export interface IdeologyPoints {
  warBonus: number
  economyBonus: number
  techBonus: number
  defenseBonus: number
  diplomacyBonus: number
}

export interface ContributionMission {
  id: string
  operationId: string
  operationType: 'cyber' | 'military' | 'nuclear'
  countryCode: string
  status: 'active' | 'completed' | 'expired'
  requiredResources: Partial<NationalFund>
  contributedResources: Partial<NationalFund>
  requiredItems: { jets?: number; tanks?: number }
  contributors: Record<string, number>
  startedAt: number
  expiresAt: number
  startedBy: string
}


export interface MilitaryContract {
  id: string
  playerId: string
  countryCode: string
  investedAmount: number
  profitRate: number
  lockedAt: number
  unlocksAt: number
  status: 'locked' | 'claimable' | 'claimed'
}

export interface Government {
  countryId: string
  president: string | null
  vicePresident: string | null
  defenseMinister: string | null
  ecoMinister: string | null
  congress: string[]
  candidates: Candidate[]
  taxRate: number
  swornEnemy: string | null
  alliances: string[]
  empireName: string | null
  ideology: IdeologyType | null
  ideologyPoints: IdeologyPoints
  nuclearAuthorized: boolean
  enrichmentStartedAt: number | null   // timestamp when enrichment began
  enrichmentCompletedAt: number | null  // enrichmentStartedAt + 7 days
  nukeReady: boolean                    // true once enrichment countdown completes
  citizens: Citizen[]
  militaryBudgetPercent: number
  equipmentVault: string[]   // Item IDs owned by the government (from market purchases)
  // Country policies (set via laws)
  embargoes: string[]          // country codes we're embargoing
  conscriptionActive: boolean
  importTariff: number         // 0-50%
  minimumWage: number          // 0 = disabled
  stateMilitaryUnits: string[] // MU IDs owned by the government
  citizenDividendPercent: number  // 0-30%, president sets, auto-distributes treasury to citizens
  laws: { proposals?: any[] }  // Server-sourced law proposal list
}
