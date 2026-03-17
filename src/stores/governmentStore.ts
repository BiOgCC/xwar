import { create } from 'zustand'
import { type DivisionType, type StarQuality, type StatModifiers, DIVISION_TEMPLATES, rollStarQuality, getEffectiveManpower, getEffectiveHealth } from './armyStore'
import { useWorldStore } from './worldStore'
import { usePlayerStore } from './playerStore'
import { useArmyStore } from './armyStore'

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

export interface DivisionListing {
  id: string
  divisionType: DivisionType
  starQuality: StarQuality
  statModifiers: StatModifiers
  price: number           // sale price with ±5% variation
  listedAt: number
  expiresAt: number       // listedAt + random 10-15h
  rerollCount: number     // how many times this listing has been rerolled
}

// Random expiry between 10 and 15 hours
function randomListingDuration(): number {
  return (10 + Math.random() * 5) * 60 * 60 * 1000
}

const MAX_DISMISSALS_PER_DAY = 3
const REROLL_BASE_COST = 500  // scrap
const REROLL_MULTIPLIER = 3   // 500 → 1500 → 4500 → ...

// ── Military Contracts ──
export interface MilitaryContract {
  id: string
  playerId: string
  countryCode: string
  investedAmount: number
  profitRate: number         // 0.11 = 11%
  lockedAt: number
  unlocksAt: number          // lockedAt + 24h
  status: 'locked' | 'claimable' | 'claimed'
}

const CONTRACT_PROFIT_RATE = 0.11
const CONTRACT_MIN = 100_000
const CONTRACT_MAX = 1_000_000
const CONTRACT_LOCK_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Infrastructure → eligible division types
const INFRA_DIVISION_MAP: Record<string, { types: DivisionType[]; getLevel: (c: { bunkerLevel: number; militaryBaseLevel: number; airportLevel: number; portLevel: number }) => number }> = {
  infantry: {
    types: ['recon', 'assault', 'sniper', 'rpg'],
    getLevel: (c) => c.bunkerLevel + c.militaryBaseLevel,
  },
  mechanized: {
    types: ['jeep', 'tank'],
    getLevel: (c) => c.militaryBaseLevel,
  },
  air: {
    types: ['jet'],
    getLevel: (c) => c.airportLevel,
  },
  naval: {
    types: ['warship'],
    getLevel: (c) => c.portLevel,
  },
}

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
  divisionShop: DivisionListing[]
}

export interface GovernmentState {
  autoDefenseEnabled: boolean
  setAutoDefense: (enabled: boolean) => void
  governments: Record<string, Government>
  laws: Record<string, Law>
  contributionMissions: Record<string, ContributionMission>
  playerDismissals: Record<string, { count: number; resetAt: number }>  // playerId → daily dismiss tracking
  militaryContracts: MilitaryContract[]
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
  // Division shop
  getShopQuota: (countryCode: string) => { category: string; maxSlots: number; currentSlots: number }[]
  spawnShopDivisions: (countryCode: string) => void
  buyFromShop: (countryCode: string, listingId: string) => { success: boolean; message: string }
  cleanExpiredListings: (countryCode: string) => void
  dismissListing: (countryCode: string, listingId: string, playerId: string) => { success: boolean; message: string }
  rerollListing: (countryCode: string, listingId: string) => { success: boolean; message: string }
  getRerollCost: (listing: DivisionListing) => number
  getDismissalsLeft: (playerId: string) => number
  // Military contracts
  createContract: (countryCode: string, amount: number) => { success: boolean; message: string }
  claimContract: (contractId: string) => { success: boolean; message: string }
  processContractMaturity: () => void
  spawnInstantDivision: (countryCode: string, investmentAmount?: number) => void
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
    divisionShop: [],
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
  playerDismissals: {},
  militaryContracts: [],
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

  // ── Division Shop ──────────────────────────────────────────

  getShopQuota: (countryCode) => {
    const country = useWorldStore.getState().countries.find(c => c.code === countryCode)
    const gov = get().governments[countryCode]
    if (!country || !gov) return []

    const playerCount = gov.citizens.length
    const halfPlayers = Math.max(1, Math.floor(playerCount / 2))

    return Object.entries(INFRA_DIVISION_MAP).map(([category, info]) => {
      const infraLevel = info.getLevel(country)
      const maxSlots = infraLevel * halfPlayers
      const currentSlots = gov.divisionShop.filter(l => info.types.includes(l.divisionType)).length
      return { category, maxSlots, currentSlots }
    })
  },

  spawnShopDivisions: (countryCode) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return
    const country = useWorldStore.getState().countries.find(c => c.code === countryCode)
    if (!country) return

    const playerCount = gov.citizens.length
    const halfPlayers = Math.max(1, Math.floor(playerCount / 2))
    const now = Date.now()
    let newListings = [...gov.divisionShop]
    let changed = false

    for (const [, info] of Object.entries(INFRA_DIVISION_MAP)) {
      const infraLevel = info.getLevel(country)
      const maxSlots = infraLevel * halfPlayers
      const currentSlots = newListings.filter(l => info.types.includes(l.divisionType)).length
      const emptySlots = maxSlots - currentSlots

      for (let i = 0; i < emptySlots; i++) {
        // 2% chance per empty slot per tick
        if (Math.random() > 0.02) continue

        // Pick random type from this category
        const divType = info.types[Math.floor(Math.random() * info.types.length)]
        const template = DIVISION_TEMPLATES[divType]
        const { star, modifiers } = rollStarQuality()
        // Price: recruitCost.money × 1.2 × (0.95 to 1.05)
        const basePrice = template.recruitCost.money * 1.2
        const price = Math.floor(basePrice * (0.95 + Math.random() * 0.10))

        newListings.push({
          id: `shop_${countryCode}_${now}_${Math.random().toString(36).substr(2, 6)}`,
          divisionType: divType,
          starQuality: star,
          statModifiers: modifiers,
          price,
          listedAt: now,
          expiresAt: now + randomListingDuration(),
          rerollCount: 0,
        })
        changed = true
      }
    }

    if (changed) {
      set({
        governments: {
          ...state.governments,
          [countryCode]: { ...gov, divisionShop: newListings },
        },
      })
    }
  },

  buyFromShop: (countryCode, listingId) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const listingIdx = gov.divisionShop.findIndex(l => l.id === listingId)
    if (listingIdx === -1) return { success: false, message: 'Listing not found.' }
    const listing = gov.divisionShop[listingIdx]

    // Check if expired
    if (Date.now() > listing.expiresAt) return { success: false, message: 'Listing expired.' }

    // Check player has money
    const player = usePlayerStore.getState()
    if (player.money < listing.price) return { success: false, message: `Not enough money. Need $${listing.price.toLocaleString()}.` }

    // Deduct money from player
    player.spendMoney(listing.price)

    // Add money to national fund
    const newFund = { ...gov.nationalFund, money: gov.nationalFund.money + listing.price }

    // Remove listing from shop
    const newShop = [...gov.divisionShop]
    newShop.splice(listingIdx, 1)

    set({
      governments: {
        ...state.governments,
        [countryCode]: { ...gov, divisionShop: newShop, nationalFund: newFund },
      },
    })

    // Create division for player via armyStore
    const template = DIVISION_TEMPLATES[listing.divisionType]
    const armyStore = useArmyStore.getState()
    const divId = `div_shop_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    const division = {
      id: divId,
      type: listing.divisionType,
      name: `${template.name} (${listing.starQuality}★)`,
      category: template.category,
      ownerId: player.name,
      countryCode,
      manpower: getEffectiveManpower(template),
      maxManpower: getEffectiveManpower(template),
      health: getEffectiveHealth(template),
      maxHealth: getEffectiveHealth(template),
      equipment: [] as string[],
      experience: 0,
      stance: 'unassigned' as const,
      autoTrainingEnabled: false,
      status: 'training' as const,
      trainingProgress: 0,
      readyAt: Date.now() + (template.trainingTime * 15_000),
      reinforcing: false,
      reinforceProgress: 0,
      recoveryTicksNeeded: 0,
      killCount: 0,
      battlesSurvived: 0,
      starQuality: listing.starQuality,
      statModifiers: listing.statModifiers,
    }

    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, [divId]: division },
    }))

    return { success: true, message: `Purchased ${template.name} (${listing.starQuality}★) for $${listing.price.toLocaleString()}!` }
  },

  cleanExpiredListings: (countryCode) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return

    const now = Date.now()
    const filtered = gov.divisionShop.filter(l => now < l.expiresAt)
    if (filtered.length !== gov.divisionShop.length) {
      set({
        governments: {
          ...state.governments,
          [countryCode]: { ...gov, divisionShop: filtered },
        },
      })
    }
  },

  getRerollCost: (listing) => {
    if (listing.rerollCount < 2) return 0  // first 2 rerolls are free
    return REROLL_BASE_COST * Math.pow(REROLL_MULTIPLIER, listing.rerollCount - 2)
  },

  getDismissalsLeft: (playerId) => {
    const state = get()
    const record = state.playerDismissals[playerId]
    if (!record || Date.now() > record.resetAt) return MAX_DISMISSALS_PER_DAY
    return Math.max(0, MAX_DISMISSALS_PER_DAY - record.count)
  },

  dismissListing: (countryCode, listingId, playerId) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const listingIdx = gov.divisionShop.findIndex(l => l.id === listingId)
    if (listingIdx === -1) return { success: false, message: 'Listing not found.' }

    // Check daily dismissal limit
    const now = Date.now()
    let record = state.playerDismissals[playerId]
    if (!record || now > record.resetAt) {
      // Reset — new day window (24h from now)
      record = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 }
    }
    if (record.count >= MAX_DISMISSALS_PER_DAY) {
      return { success: false, message: `Dismiss limit reached (${MAX_DISMISSALS_PER_DAY}/day). Resets in ${Math.ceil((record.resetAt - now) / 3600000)}h.` }
    }

    // Remove listing
    const newShop = [...gov.divisionShop]
    newShop.splice(listingIdx, 1)

    set({
      governments: {
        ...state.governments,
        [countryCode]: { ...gov, divisionShop: newShop },
      },
      playerDismissals: {
        ...state.playerDismissals,
        [playerId]: { count: record.count + 1, resetAt: record.resetAt },
      },
    })

    const left = MAX_DISMISSALS_PER_DAY - record.count - 1
    return { success: true, message: `Dismissed! ${left} dismiss${left !== 1 ? 'es' : ''} left today.` }
  },

  rerollListing: (countryCode, listingId) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const listingIdx = gov.divisionShop.findIndex(l => l.id === listingId)
    if (listingIdx === -1) return { success: false, message: 'Listing not found.' }
    const listing = gov.divisionShop[listingIdx]

    // Calculate cost (first 2 are free)
    const cost = listing.rerollCount < 2 ? 0 : REROLL_BASE_COST * Math.pow(REROLL_MULTIPLIER, listing.rerollCount - 2)
    const player = usePlayerStore.getState()
    if (cost > 0 && player.scrap < cost) return { success: false, message: `Not enough scrap. Need ${cost.toLocaleString()}.` }

    // Deduct scrap (only if cost > 0)
    if (cost > 0) player.spendScraps(cost)

    // Reroll star quality + price
    const { star, modifiers } = rollStarQuality()
    const template = DIVISION_TEMPLATES[listing.divisionType]
    const basePrice = template.recruitCost.money * 1.2
    const newPrice = Math.floor(basePrice * (0.95 + Math.random() * 0.10))
    const now = Date.now()

    const newListing: DivisionListing = {
      ...listing,
      starQuality: star,
      statModifiers: modifiers,
      price: newPrice,
      listedAt: now,
      expiresAt: now + randomListingDuration(),
      rerollCount: listing.rerollCount + 1,
    }

    const newShop = [...gov.divisionShop]
    newShop[listingIdx] = newListing

    set({
      governments: {
        ...state.governments,
        [countryCode]: { ...gov, divisionShop: newShop },
      },
    })

    const nextCost = REROLL_BASE_COST * Math.pow(REROLL_MULTIPLIER, newListing.rerollCount)
    return { success: true, message: `Rerolled to ${star}★! Next reroll: ${nextCost.toLocaleString()} scrap.` }
  },

  // ── Military Contracts ───────────────────────────────────────

  spawnInstantDivision: (countryCode, investmentAmount) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return
    const country = useWorldStore.getState().countries.find(c => c.code === countryCode)
    if (!country) return

    const playerCount = gov.citizens.length
    const halfPlayers = Math.max(1, Math.floor(playerCount / 2))

    // Find categories with empty slots
    const candidates: { types: DivisionType[]; emptySlots: number }[] = []
    for (const [, info] of Object.entries(INFRA_DIVISION_MAP)) {
      const infraLevel = info.getLevel(country)
      const maxSlots = infraLevel * halfPlayers
      const currentSlots = gov.divisionShop.filter(l => info.types.includes(l.divisionType)).length
      if (currentSlots < maxSlots) {
        candidates.push({ types: info.types, emptySlots: maxSlots - currentSlots })
      }
    }

    // If no room in any category, pick any random type anyway (contract always spawns one)
    const allTypes: DivisionType[] = Object.values(INFRA_DIVISION_MAP).flatMap(i => i.types)
    const pool = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)].types
      : allTypes

    const divType = pool[Math.floor(Math.random() * pool.length)]
    const template = DIVISION_TEMPLATES[divType]
    const { star, modifiers } = rollStarQuality(investmentAmount)
    const basePrice = template.recruitCost.money * 1.2
    const price = Math.floor(basePrice * (0.95 + Math.random() * 0.10))
    const now = Date.now()

    const newListing: DivisionListing = {
      id: `shop_contract_${countryCode}_${now}_${Math.random().toString(36).substr(2, 6)}`,
      divisionType: divType,
      starQuality: star,
      statModifiers: modifiers,
      price,
      listedAt: now,
      expiresAt: now + randomListingDuration(),
      rerollCount: 0,
    }

    set({
      governments: {
        ...state.governments,
        [countryCode]: { ...gov, divisionShop: [...gov.divisionShop, newListing] },
      },
    })
  },

  createContract: (countryCode, amount) => {
    const player = usePlayerStore.getState()
    if (amount < CONTRACT_MIN) return { success: false, message: `Minimum investment is $${CONTRACT_MIN.toLocaleString()}.` }
    if (amount > CONTRACT_MAX) return { success: false, message: `Maximum investment is $${CONTRACT_MAX.toLocaleString()}.` }
    if (player.money < amount) return { success: false, message: `Not enough money. You have $${player.money.toLocaleString()}.` }

    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    // Deduct money from player
    player.spendMoney(amount)

    // Add to national fund
    const newFund = { ...gov.nationalFund, money: gov.nationalFund.money + amount }

    const now = Date.now()
    const contract: MilitaryContract = {
      id: `contract_${countryCode}_${now}_${Math.random().toString(36).substr(2, 6)}`,
      playerId: player.name,
      countryCode,
      investedAmount: amount,
      profitRate: CONTRACT_PROFIT_RATE,
      lockedAt: now,
      unlocksAt: now + CONTRACT_LOCK_DURATION,
      status: 'locked',
    }

    set({
      governments: {
        ...state.governments,
        [countryCode]: { ...gov, nationalFund: newFund },
      },
      militaryContracts: [...state.militaryContracts, contract],
    })

    // Instantly spawn 1 division
    get().spawnInstantDivision(countryCode, amount)

    const payout = Math.floor(amount * (1 + CONTRACT_PROFIT_RATE))
    return { success: true, message: `Contract signed! $${amount.toLocaleString()} locked for 24h. Payout: $${payout.toLocaleString()}. A new division has been listed!` }
  },

  claimContract: (contractId) => {
    const state = get()
    const idx = state.militaryContracts.findIndex(c => c.id === contractId)
    if (idx === -1) return { success: false, message: 'Contract not found.' }
    const contract = state.militaryContracts[idx]

    const player = usePlayerStore.getState()
    if (contract.playerId !== player.name) return { success: false, message: 'Not your contract.' }
    if (contract.status !== 'claimable') return { success: false, message: 'Contract not yet matured.' }

    const payout = Math.floor(contract.investedAmount * (1 + contract.profitRate))

    // Try to deduct from national fund; if short, create the difference
    const gov = state.governments[contract.countryCode]
    if (gov) {
      const fundDeduction = Math.min(gov.nationalFund.money, payout)
      const newFund = { ...gov.nationalFund, money: gov.nationalFund.money - fundDeduction }
      set({
        governments: {
          ...state.governments,
          [contract.countryCode]: { ...gov, nationalFund: newFund },
        },
      })
    }

    // Credit player
    player.earnMoney(payout)

    // Mark as claimed
    const newContracts = [...state.militaryContracts]
    newContracts[idx] = { ...contract, status: 'claimed' }
    set({ militaryContracts: newContracts })

    return { success: true, message: `Claimed $${payout.toLocaleString()}! ($${contract.investedAmount.toLocaleString()} + $${(payout - contract.investedAmount).toLocaleString()} profit)` }
  },

  processContractMaturity: () => {
    const state = get()
    const now = Date.now()
    let changed = false
    const updated = state.militaryContracts.map(c => {
      if (c.status === 'locked' && now >= c.unlocksAt) {
        changed = true
        return { ...c, status: 'claimable' as const }
      }
      return c
    })
    if (changed) set({ militaryContracts: updated })
  },
}))
