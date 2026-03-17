import { create } from 'zustand'

export type LawType = 'declare_war' | 'propose_peace' | 'impeach_president' | 'tax_change' | 'declare_sworn_enemy' | 'authorize_nuclear_action' | 'propose_alliance' | 'break_alliance'
export type LawStatus = 'active' | 'passed' | 'failed'

// ── National Fund ──
export interface NationalFund {
  money: number
  oil: number
  scraps: number
  materialX: number
  bitcoin: number
  jets: number // T6 weapons
}

export type NationalFundKey = keyof NationalFund

export const DEFAULT_NATIONAL_FUND: NationalFund = {
  money: 50000000,
  oil: 5000000,
  scraps: 5000000,
  materialX: 5000000,
  bitcoin: 50000,
  jets: 100,
}

// Keep NUKE_COST for backward compatibility
export const NUKE_COST: NationalFund = {
  money: 0,
  oil: 10000,
  scraps: 10000,
  materialX: 10000,
  bitcoin: 100,
  jets: 1,
}

// ── NuclearFund type alias for backward compat ──
export type NuclearFund = NationalFund

// ── Citizen ──
export interface Citizen {
  id: string
  name: string
  level: number
  role: 'president' | 'congress' | 'citizen'
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
  warBonus: number       // +2% attack per point
  economyBonus: number   // +2% company production per point
  techBonus: number      // +2% cyber success per point
  defenseBonus: number   // +2% bunker/infra strength per point
  diplomacyBonus: number // +1 alliance slot per point
}

export const DEFAULT_IDEOLOGY_POINTS: IdeologyPoints = {
  warBonus: 0,
  economyBonus: 0,
  techBonus: 0,
  defenseBonus: 0,
  diplomacyBonus: 0,
}

// ── Contribution Missions ──
export interface ContributionMission {
  id: string
  operationId: string           // e.g. 'resource_intel', 'assault', 'nuclear'
  operationType: 'cyber' | 'military' | 'nuclear'
  countryCode: string
  status: 'active' | 'completed' | 'expired'
  requiredResources: Partial<NationalFund>   // target amounts
  contributedResources: Partial<NationalFund> // current progress
  requiredItems: { jets?: number; tanks?: number }  // checked, not consumed (except nuclear)
  contributors: Record<string, number>  // playerName → total $ value contributed
  startedAt: number
  expiresAt: number             // startedAt + 7 days
  startedBy: string
}

const MISSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 1 week

export interface Government {
  countryId: string
  president: string | null
  congress: string[]
  candidates: Candidate[]
  taxRate: number
  swornEnemy: string | null
  alliances: string[] // ISO codes of allied countries
  empireName: string | null
  ideology: IdeologyType | null
  ideologyPoints: IdeologyPoints
  nuclearAuthorized: boolean
  nationalFund: NationalFund
  citizens: Citizen[]
}

export interface GovernmentState {
  autoDefenseEnabled: boolean
  setAutoDefense: (enabled: boolean) => void
  governments: Record<string, Government>
  laws: Record<string, Law>
  contributionMissions: Record<string, ContributionMission>
  nextElectionAt: number

  registerCandidate: (countryId: string, citizenId: string, name: string) => void
  voteForCandidate: (countryId: string, voterId: string, candidateId: string) => void
  proposeLaw: (law: Omit<Law, 'id' | 'votesFor' | 'votesAgainst' | 'status' | 'proposedAt' | 'expiresAt'>) => void
  voteOnLaw: (lawId: string, voterId: string, vote: 'for' | 'against') => void
  resolveElections: () => void
  resolveLaws: () => void
  donateToFund: (countryId: string, resource: NationalFundKey, amount: number) => boolean
  spendFromFund: (countryId: string, costs: Partial<NationalFund>) => boolean
  launchNuke: (fromCountry: string, targetCountry: string) => void
  stealNationalFund: (targetId: string, attackerId: string, percentage: number) => void
  // Contribution missions
  startContributionMission: (opId: string, opType: 'cyber' | 'military' | 'nuclear', countryCode: string, startedBy: string, required: Partial<NationalFund>, requiredItems?: { jets?: number; tanks?: number }) => string | null
  contributeToMission: (missionId: string, resource: NationalFundKey, amount: number, playerName: string) => boolean
  checkExpiredMissions: () => void
  isMissionCompleted: (opId: string, countryCode: string) => boolean
  getActiveMission: (opId: string, countryCode: string) => ContributionMission | null
}

// Helper to create mock citizens
function mockCitizens(code: string, president: string, congress: string[]): Citizen[] {
  const now = Date.now()
  const citizens: Citizen[] = [
    { id: president, name: president, level: 50, role: 'president', joinedAt: now - 86400000 * 30 },
  ]
  congress.forEach((m, i) => {
    citizens.push({ id: m, name: m, level: 30 + i * 5, role: 'congress', joinedAt: now - 86400000 * (20 - i) })
  })
  // Add some regular citizens
  for (let i = 1; i <= 8; i++) {
    citizens.push({ id: `${code}_cit_${i}`, name: `Citizen_${code}_${i}`, level: 5 + i * 3, role: 'citizen', joinedAt: now - 86400000 * i })
  }
  return citizens
}

function mkGov(code: string, president: string, congress: string[]): Government {
  return {
    countryId: code,
    president,
    congress: [president, ...congress.slice(0, 4)],
    candidates: [],
    taxRate: 10,
    swornEnemy: null,
    alliances: [],
    empireName: null,
    ideology: null,
    ideologyPoints: { ...DEFAULT_IDEOLOGY_POINTS },
    nuclearAuthorized: false,
    nationalFund: { ...DEFAULT_NATIONAL_FUND },
    citizens: mockCitizens(code, president, congress),
  }
}

export const useGovernmentStore = create<GovernmentState>((set, get) => ({
  autoDefenseEnabled: true,
  setAutoDefense: (enabled) => set({ autoDefenseEnabled: enabled }),
  governments: {
    'US': mkGov('US', 'Commander_X', ['AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5']),
    'RU': mkGov('RU', 'AI_Commander_Putin', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'CN': mkGov('CN', 'AI_Commander_Xi', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'DE': mkGov('DE', 'AI_Commander_Scholz', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'BR': mkGov('BR', 'AI_Commander_Lula', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'IN': mkGov('IN', 'AI_Commander_Modi', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'NG': mkGov('NG', 'AI_Commander_Tinubu', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'JP': mkGov('JP', 'AI_Commander_Kishida', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'GB': mkGov('GB', 'AI_Commander_Sunak', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'TR': mkGov('TR', 'AI_Commander_Erdogan', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'CA': mkGov('CA', 'AI_Commander_Trudeau', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'MX': mkGov('MX', 'AI_Commander_Sheinbaum', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'CU': mkGov('CU', 'AI_Commander_DiazCanel', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
    'BS': mkGov('BS', 'AI_Commander_Davis', ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4']),
  },
  laws: {},
  contributionMissions: {},
  nextElectionAt: Date.now() + 30 * 24 * 60 * 60 * 1000,

  registerCandidate: (countryId, citizenId, name) => set((state) => {
    const gov = state.governments[countryId]
    if (!gov) return state
    if (gov.candidates.find(c => c.id === citizenId)) return state
    return {
      governments: {
        ...state.governments,
        [countryId]: { ...gov, candidates: [...gov.candidates, { id: citizenId, name, votes: 0 }] }
      }
    }
  }),

  voteForCandidate: (countryId, _voterId, candidateId) => set((state) => {
    const gov = state.governments[countryId]
    if (!gov) return state
    return {
      governments: {
        ...state.governments,
        [countryId]: {
          ...gov,
          candidates: gov.candidates.map(c =>
            c.id === candidateId ? { ...c, votes: c.votes + 1 } : c
          )
        }
      }
    }
  }),

  proposeLaw: (lawData) => set((state) => {
    const gov = state.governments[lawData.countryId]
    if (!gov) return state
    const isGovOfficial = gov.president === lawData.proposerId || gov.congress.includes(lawData.proposerId)
    if (!isGovOfficial) return state

    const id = `law_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      laws: {
        ...state.laws,
        [id]: {
          ...lawData, id,
          votesFor: [],
          votesAgainst: [],
          proposedAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          status: 'active'
        }
      }
    }
  }),

  voteOnLaw: (lawId, voterId, vote) => set((state) => {
    const law = state.laws[lawId]
    if (!law || law.status !== 'active') return state
    const gov = state.governments[law.countryId]
    if (!gov) return state
    const isCongress = gov.congress.includes(voterId)
    if (!isCongress) return state

    const votesFor = law.votesFor.filter(id => id !== voterId)
    const votesAgainst = law.votesAgainst.filter(id => id !== voterId)
    if (vote === 'for') votesFor.push(voterId)
    if (vote === 'against') votesAgainst.push(voterId)

    const updatedLaw = { ...law, votesFor, votesAgainst }
    if (votesFor.length >= 1) updatedLaw.status = 'passed'
    else if (votesAgainst.length >= 3) updatedLaw.status = 'failed'

    return { laws: { ...state.laws, [lawId]: updatedLaw } }
  }),

  resolveElections: () => set((state) => {
    if (Date.now() < state.nextElectionAt) return state
    const newGovs = { ...state.governments }
    Object.keys(newGovs).forEach(countryId => {
      const gov = newGovs[countryId]
      if (gov.candidates.length === 0) return
      const sorted = [...gov.candidates].sort((a, b) => b.votes - a.votes)
      const newPresident = sorted[0].id
      const newCongress = sorted.slice(1, 6).map(c => c.id)
      newGovs[countryId] = {
        ...gov,
        president: newPresident,
        congress: newCongress.length > 0 ? newCongress : gov.congress,
        candidates: []
      }
    })
    return { governments: newGovs, nextElectionAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }
  }),

  resolveLaws: () => set((state) => {
    const now = Date.now()
    let changed = false
    const newLaws = { ...state.laws }
    Object.values(newLaws).forEach(law => {
      if (law.status === 'active' && now > law.expiresAt) {
        changed = true
        newLaws[law.id] = { ...law, status: 'failed' }
      }
    })
    if (!changed) return state
    return { laws: newLaws }
  }),

  donateToFund: (countryId, resource, amount) => {
    const state = get()
    const gov = state.governments[countryId]
    if (!gov) return false
    set({
      governments: {
        ...state.governments,
        [countryId]: {
          ...gov,
          nationalFund: { ...gov.nationalFund, [resource]: gov.nationalFund[resource] + amount },
        },
      },
    })
    return true
  },

  spendFromFund: (countryId, costs) => {
    const state = get()
    const gov = state.governments[countryId]
    if (!gov) return false

    const fund = gov.nationalFund
    // Check all costs
    for (const [key, amount] of Object.entries(costs)) {
      if (amount && fund[key as NationalFundKey] < amount) return false
    }
    // Deduct
    const newFund = { ...fund }
    for (const [key, amount] of Object.entries(costs)) {
      if (amount) newFund[key as NationalFundKey] -= amount
    }
    set({
      governments: {
        ...state.governments,
        [countryId]: { ...gov, nationalFund: newFund },
      },
    })
    return true
  },

  launchNuke: (fromCountry, targetCountry) => set((state) => {
    // Mostly handled outside, just deducting funds here if necessary
    const gov = state.governments[fromCountry]
    if (!gov || !gov.nuclearAuthorized) return state
    const fund = gov.nationalFund
    
    return {
      governments: {
        ...state.governments,
        [fromCountry]: {
          ...gov,
          nuclearAuthorized: false,
          nationalFund: {
            ...fund,
            oil: fund.oil - NUKE_COST.oil,
            scraps: fund.scraps - NUKE_COST.scraps,
            materialX: fund.materialX - NUKE_COST.materialX,
            bitcoin: fund.bitcoin - NUKE_COST.bitcoin,
            jets: fund.jets - NUKE_COST.jets,
          },
        },
      },
    }
  }),

  stealNationalFund: (targetId, attackerId, percentage) => set((state) => {
    const target = state.governments[targetId]
    const attacker = state.governments[attackerId]
    if (!target || !attacker) return state

    const newTargetFund = { ...target.nationalFund }
    const newAttackerFund = { ...attacker.nationalFund }
    const pct = percentage / 100

    const keys: NationalFundKey[] = ['money', 'oil', 'scraps', 'materialX', 'bitcoin', 'jets']
    keys.forEach(k => {
      const amount = Math.floor(target.nationalFund[k] * pct)
      newTargetFund[k] -= amount
      newAttackerFund[k] += amount
    })

    return {
      governments: {
        ...state.governments,
        [targetId]: { ...target, nationalFund: newTargetFund },
        [attackerId]: { ...attacker, nationalFund: newAttackerFund }
      }
    }
  }),

  // ── Contribution Missions ──────────────────────────────────────────

  startContributionMission: (opId, opType, countryCode, startedBy, required, requiredItems) => {
    const state = get()
    // Check no active mission for this op+country already
    const existing = Object.values(state.contributionMissions).find(
      m => m.operationId === opId && m.countryCode === countryCode && m.status === 'active'
    )
    if (existing) return null

    const now = Date.now()
    const id = `cm_${opId}_${countryCode}_${now}`
    const contributed: Partial<NationalFund> = {}
    for (const key of Object.keys(required)) {
      contributed[key as NationalFundKey] = 0
    }

    const mission: ContributionMission = {
      id,
      operationId: opId,
      operationType: opType,
      countryCode,
      status: 'active',
      requiredResources: required,
      contributedResources: contributed,
      requiredItems: requiredItems || {},
      contributors: {},
      startedAt: now,
      expiresAt: now + MISSION_DURATION,
      startedBy,
    }

    set({ contributionMissions: { ...state.contributionMissions, [id]: mission } })
    return id
  },

  contributeToMission: (missionId, resource, amount, playerName) => {
    const state = get()
    const mission = state.contributionMissions[missionId]
    if (!mission || mission.status !== 'active') return false

    const required = mission.requiredResources[resource] ?? 0
    const contributed = mission.contributedResources[resource] ?? 0
    const remaining = Math.max(0, required - contributed)
    if (remaining <= 0) return false

    const actual = Math.min(amount, remaining)
    const newContributed = { ...mission.contributedResources, [resource]: contributed + actual }
    const newContributors = { ...mission.contributors, [playerName]: (mission.contributors[playerName] || 0) + actual }

    // Check if all resources are fully contributed
    let completed = true
    for (const [key, req] of Object.entries(mission.requiredResources)) {
      const curr = key === resource ? contributed + actual : (mission.contributedResources[key as NationalFundKey] ?? 0)
      if (curr < (req ?? 0)) { completed = false; break }
    }

    // Also donate to country national fund
    const gov = state.governments[mission.countryCode]
    if (gov) {
      set({
        governments: {
          ...state.governments,
          [mission.countryCode]: {
            ...gov,
            nationalFund: { ...gov.nationalFund, [resource]: gov.nationalFund[resource] + actual },
          },
        },
        contributionMissions: {
          ...state.contributionMissions,
          [missionId]: {
            ...mission,
            contributedResources: newContributed,
            contributors: newContributors,
            status: completed ? 'completed' : 'active',
          },
        },
      })
    }

    return true
  },

  checkExpiredMissions: () => set((state) => {
    const now = Date.now()
    let changed = false
    const newMissions = { ...state.contributionMissions }
    Object.values(newMissions).forEach(m => {
      if (m.status === 'active' && now > m.expiresAt) {
        changed = true
        newMissions[m.id] = { ...m, status: 'expired' }
      }
    })
    if (!changed) return state
    return { contributionMissions: newMissions }
  }),

  isMissionCompleted: (opId, countryCode) => {
    const state = get()
    return Object.values(state.contributionMissions).some(
      m => m.operationId === opId && m.countryCode === countryCode && m.status === 'completed'
    )
  },

  getActiveMission: (opId, countryCode) => {
    const state = get()
    return Object.values(state.contributionMissions).find(
      m => m.operationId === opId && m.countryCode === countryCode && m.status === 'active'
    ) || null
  },
}))
