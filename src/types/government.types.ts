// ══════════════════════════════════════════════
// XWAR — Government Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

import type { NationalFund } from './world.types'
import type { DivisionType, StarQuality, StatModifiers } from '../stores/army'

export type LawType = 'declare_war' | 'propose_peace' | 'impeach_president' | 'tax_change' | 'declare_sworn_enemy' | 'authorize_nuclear_action' | 'propose_alliance' | 'break_alliance'
export type LawStatus = 'active' | 'passed' | 'failed'

export interface Citizen {
  id: string
  name: string
  level: number
  role: 'president' | 'vicepresident' | 'minister' | 'congress' | 'citizen'
  joinedAt: number
}

export interface Law {
  id: string
  countryId: string
  proposerId: string
  type: LawType
  targetCountryId?: string
  newValue?: number
  votesFor: string[]
  votesAgainst: string[]
  proposedAt: number
  expiresAt: number
  status: LawStatus
}

export interface Candidate {
  id: string
  name: string
  votes: number
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

export interface DivisionListing {
  id: string
  divisionType: DivisionType
  starQuality: StarQuality
  statModifiers: StatModifiers
  price: number
  listedAt: number
  expiresAt: number
  rerollCount: number
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
  congress: string[]
  candidates: Candidate[]
  taxRate: number
  swornEnemy: string | null
  alliances: string[]
  empireName: string | null
  ideology: IdeologyType | null
  ideologyPoints: IdeologyPoints
  nuclearAuthorized: boolean
  citizens: Citizen[]
  divisionShop: DivisionListing[]
  militaryBudgetPercent: number
  armedForces: string[]  // Division IDs owned by the government (defense-only reserve)
  lastFreeRecruitAt: number  // timestamp of last free 12h recruit
  equipmentVault: string[]   // Item IDs owned by the government (from market purchases)
}
