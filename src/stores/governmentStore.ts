import { create } from 'zustand'
import { type DivisionType, type StarQuality, type StatModifiers, DIVISION_TEMPLATES, rollStarQuality, getEffectiveManpower, getEffectiveHealth } from './army'
import { useWorldStore, type NationalFund, type NationalFundKey } from './worldStore'
import { usePlayerStore } from './playerStore'
import { useArmyStore } from './army'
import { useInventoryStore } from './inventoryStore'
import { useMarketStore } from './market'
import { api } from '../api/client'

import type { LawType, LawStatus, Citizen, Law, Candidate, IdeologyType, IdeologyPoints, ContributionMission, DivisionListing, MilitaryContract, Government } from '../types/government.types'
export type { LawType, LawStatus, Citizen, Law, Candidate, IdeologyType, IdeologyPoints, ContributionMission, DivisionListing, MilitaryContract, Government }

// Re-export for backward compatibility
export type { NationalFund, NationalFundKey }

// Helper: get country fund from worldStore (single source of truth)
export function getCountryFund(countryCode: string): NationalFund {
  const country = useWorldStore.getState().getCountry(countryCode)
  return country?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
}

// Keep NUKE_COST
export const NUKE_COST: NationalFund = {
  money: 0,
  oil: 10000,
  scrap: 10000,
  materialX: 10000,
  bitcoin: 100,
  jets: 1,
}

// ── NuclearFund type alias for backward compat ──
export type NuclearFund = NationalFund

export const DEFAULT_IDEOLOGY_POINTS: IdeologyPoints = {
  warBonus: 0,
  economyBonus: 0,
  techBonus: 0,
  defenseBonus: 0,
  diplomacyBonus: 0,
}

const MISSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 1 week

// Random expiry between 10 and 15 hours
function randomListingDuration(): number {
  return (10 + Math.random() * 5) * 60 * 60 * 1000
}

const MAX_DISMISSALS_PER_DAY = 3
const REROLL_BASE_COST = 500  // scrap
const REROLL_MULTIPLIER = 3   // 500 → 1500 → 4500 → ...

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

export interface GovernmentState {
  /** Country-level autodefense limit: -1 = all divisions, 0 = off, N = max N divisions */
  autoDefenseLimit: number
  setAutoDefenseLimit: (limit: number) => void
  governments: Record<string, Government>
  laws: Record<string, Law>
  contributionMissions: Record<string, ContributionMission>
  playerDismissals: Record<string, { count: number; resetAt: number }>  // playerId → daily dismiss tracking
  militaryContracts: MilitaryContract[]
  nextElectionAt: number

  fetchGovernment: (countryCode: string) => Promise<void>
  setTaxRate: (countryCode: string, taxRate: number) => Promise<{success: boolean, message: string}>
  buildInfrastructure: (countryCode: string, building: 'port'|'airport'|'military_base'|'bunker') => Promise<{success: boolean, message: string}>
  nationalizeCompany: (countryCode: string, companyId: string) => Promise<{success: boolean, message: string}>

  registerCandidate: (countryId: string, citizenId: string, name: string) => void
  voteForCandidate: (countryCode: string, candidateName: string) => Promise<{success: boolean, message: string}>
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
  // Military budget
  setMilitaryBudget: (countryId: string, percent: number) => { success: boolean; message: string }
  processBudgetDistribution: (ticksPerDay: number) => void
  // Armed Forces
  donateToArmedForces: (countryCode: string, divisionId: string, source: 'player' | 'army', armyId?: string) => { success: boolean; message: string }
  recruitFreeFromShop: (countryCode: string, listingId: string) => { success: boolean; message: string }
  recruitEquipmentFromMarket: (countryCode: string, orderId: string) => { success: boolean; message: string }
  buyCasesForCountry: (countryCode: string, quantity: number) => { success: boolean; message: string }
  appointRole: (countryCode: string, targetId: string, role: 'vicepresident' | 'minister' | 'congress' | 'citizen') => { success: boolean; message: string }
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
    citizens: mockCitizens(code, president, congress),
    divisionShop: [],
    militaryBudgetPercent: 5,
    armedForces: [],
    lastFreeRecruitAt: 0,
    equipmentVault: [],
  }
}

export const useGovernmentStore = create<GovernmentState>((set, get) => ({
  autoDefenseLimit: -1,
  setAutoDefenseLimit: (limit) => set({ autoDefenseLimit: limit }),
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

  fetchGovernment: async (countryCode) => {
    try {
      const res: any = await api.get(`/gov/country/${countryCode}`)
      if (res.government) {
        set(s => ({
          governments: {
            ...s.governments,
            [countryCode]: res.government
          }
        }))
      }
    } catch (err) {
      console.error('[Government] Fetch failed', err)
    }
  },

  setTaxRate: async (countryCode, taxRate) => {
    try {
      const res: any = await api.post('/gov/set-tax', { countryCode, taxRate })
      set(s => {
        const gov = s.governments[countryCode]
        if (!gov) return s
        return {
          governments: {
            ...s.governments,
            [countryCode]: { ...gov, taxRate }
          }
        }
      })
      return { success: true, message: res.message || 'Tax rate updated' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to set tax rate' }
    }
  },

  buildInfrastructure: async (countryCode, building) => {
    try {
      const res: any = await api.post('/gov/build-infra', { countryCode, building })
      // The state of infrastructure is kept in country/worldStore.
      // A global refresh or websocket event should update the UI.
      return { success: true, message: res.message || `${building} built` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Build failed' }
    }
  },

  nationalizeCompany: async (countryCode, companyId) => {
    try {
      const res: any = await api.post('/gov/nationalize', { countryCode, companyId })
      return { success: true, message: res.message || 'Company nationalized' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Nationalize failed' }
    }
  },

  voteForCandidate: async (countryCode, candidateName) => {
    try {
      const res: any = await api.post('/gov/vote', { countryCode, candidateName })
      return { success: true, message: res.message || 'Vote cast' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Vote failed' }
    }
  },

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
    // Require majority + at least 2 votes to pass; 3 against to fail
    if (votesFor.length >= 2 && votesFor.length > votesAgainst.length) updatedLaw.status = 'passed'
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
    if (!gov || amount <= 0) return false

    // Deduct from player first (enforced at store level)
    const player = usePlayerStore.getState()
    const balanceMap: Record<NationalFundKey, number> = {
      money: player.money, oil: player.oil, scrap: player.scrap,
      materialX: player.materialX, bitcoin: player.bitcoin, jets: 0,
    }
    if (balanceMap[resource] < amount) return false

    if (resource === 'money') player.spendMoney(amount)
    else if (resource === 'oil') player.spendOil(amount)
    else if (resource === 'scrap') player.spendScrap(amount)
    else if (resource === 'materialX') player.spendMaterialX(amount)
    else if (resource === 'bitcoin') player.spendBitcoin(amount)
    else return false  // jets handled separately via inventory

    // Add to country fund
    useWorldStore.getState().addToFund(countryId, resource, amount)
    return true
  },

  spendFromFund: (countryId, costs) => {
    // Delegate to worldStore
    return useWorldStore.getState().spendFromFund(countryId, costs)
  },

  launchNuke: (fromCountry, _targetCountry) => set((state) => {
    const gov = state.governments[fromCountry]
    if (!gov || !gov.nuclearAuthorized) return state
    // Deduct nuke costs via worldStore
    useWorldStore.getState().spendFromFund(fromCountry, {
      oil: NUKE_COST.oil,
      scrap: NUKE_COST.scrap,
      materialX: NUKE_COST.materialX,
      bitcoin: NUKE_COST.bitcoin,
      jets: NUKE_COST.jets,
    })
    return {
      governments: {
        ...state.governments,
        [fromCountry]: {
          ...gov,
          nuclearAuthorized: false,
        },
      },
    }
  }),

  stealNationalFund: (targetId, attackerId, percentage) => {
    const pct = percentage / 100
    const targetFund = getCountryFund(targetId)
    const keys: NationalFundKey[] = ['money', 'oil', 'scrap', 'materialX', 'bitcoin', 'jets']
    const ws = useWorldStore.getState()
    keys.forEach(k => {
      const amount = Math.floor(targetFund[k] * pct)
      if (amount > 0) {
        // Deduct from target, add to attacker
        ws.spendFromFund(targetId, { [k]: amount })
        ws.addToFund(attackerId, k, amount)
      }
    })
  },

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

    // NOTE: Do NOT add to national fund here — resources were already deducted from
    // the player by the UI caller. The mission tracks contributions separately.
    // Adding to fund here would double-count resources.
    const gov = state.governments[mission.countryCode]
    if (gov) {
      set({
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

    // Add money to national fund via worldStore
    useWorldStore.getState().addTreasuryTax(countryCode, listing.price)

    // Remove listing from shop
    const newShop = [...gov.divisionShop]
    newShop.splice(listingIdx, 1)

    set({
      governments: {
        ...state.governments,
        [countryCode]: { ...gov, divisionShop: newShop },
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
    if (cost > 0) player.spendScrap(cost)

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

    // Add to national fund via worldStore
    useWorldStore.getState().addTreasuryTax(countryCode, amount)

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

    const fullPayout = Math.floor(contract.investedAmount * (1 + contract.profitRate))

    // Country fund pays 0.33× of the total payout as profit
    // Player always gets their capital back; profit comes from the fund
    const maxFundContribution = Math.floor(fullPayout * 0.33)
    const fund = getCountryFund(contract.countryCode)
    const fundAvailable = fund?.money ?? 0
    const fundContribution = Math.min(fundAvailable, maxFundContribution)

    // Deduct the fund's contribution
    if (fundContribution > 0) {
      useWorldStore.getState().spendFromFund(contract.countryCode, { money: fundContribution })
    }

    // Player gets: their original investment + whatever the fund contributed
    const actualPayout = contract.investedAmount + fundContribution
    player.earnMoney(actualPayout)

    // Mark as claimed
    const newContracts = [...state.militaryContracts]
    newContracts[idx] = { ...contract, status: 'claimed' }
    set({ militaryContracts: newContracts })

    const profit = actualPayout - contract.investedAmount
    return { success: true, message: `Claimed $${actualPayout.toLocaleString()}! ($${contract.investedAmount.toLocaleString()} + $${profit.toLocaleString()} profit)` }
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

  // ====== MILITARY BUDGET DISTRIBUTION ======

  setMilitaryBudget: (countryId, percent) => {
    const state = get()
    const gov = state.governments[countryId]
    if (!gov) return { success: false, message: 'Government not found.' }
    const player = usePlayerStore.getState()
    if (gov.president !== player.name) return { success: false, message: 'Only the president can set the military budget.' }
    const clamped = Math.max(0, Math.min(50, percent))
    set(s => ({
      governments: {
        ...s.governments,
        [countryId]: { ...s.governments[countryId], militaryBudgetPercent: clamped },
      },
    }))
    return { success: true, message: `Military budget set to ${clamped}% of daily treasury.` }
  },

  processBudgetDistribution: (ticksPerDay) => {
    const state = get()
    const ws = useWorldStore.getState()
    const armyStore = useArmyStore.getState()

    Object.values(state.governments).forEach(gov => {
      if (gov.militaryBudgetPercent <= 0) return
      const country = ws.getCountry(gov.countryId)
      if (!country || country.fund.money <= 0) return

      // Calculate per-tick budget: (fund × budgetPercent%) / ticksPerDay
      const dailyBudget = country.fund.money * (gov.militaryBudgetPercent / 100)
      const perTickBudget = Math.floor(dailyBudget / Math.max(1, ticksPerDay))
      if (perTickBudget <= 0) return

      // Find all armies for this country
      const countryArmies = Object.values(armyStore.armies).filter(a => a.countryCode === gov.countryId)
      if (countryArmies.length === 0) return

      // Distribute equally among armies
      const perArmy = Math.floor(perTickBudget / countryArmies.length)
      if (perArmy <= 0) return

      const totalDrain = perArmy * countryArmies.length
      // Drain from country fund
      ws.spendFromFund(gov.countryId, { money: totalDrain })

      // Add to each army's salary pool
      countryArmies.forEach(army => {
        useArmyStore.setState(s => ({
          armies: {
            ...s.armies,
            [army.id]: {
              ...s.armies[army.id],
              salaryPool: (s.armies[army.id].salaryPool || 0) + perArmy,
            },
          },
        }))
      })
    })
  },

  // ====== ARMED FORCES ======

  donateToArmedForces: (countryCode, divisionId, source, armyId) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }
    const player = usePlayerStore.getState()
    const armyStore = useArmyStore.getState()
    const div = armyStore.divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found.' }
    if (div.status === 'in_combat' || div.status === 'destroyed' || div.status === 'listed')
      return { success: false, message: 'Division is not available for donation.' }

    if (source === 'player') {
      if (div.ownerId !== player.name) return { success: false, message: 'Not your division.' }
    } else if (source === 'army') {
      if (!armyId) return { success: false, message: 'Army ID required.' }
      const army = armyStore.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }
      if (army.commanderId !== player.name)
        return { success: false, message: 'Only the commander can donate army divisions.' }
      if (!army.divisionIds.includes(divisionId))
        return { success: false, message: 'Division is not in this army.' }
      // Remove from army
      useArmyStore.setState(s => ({
        armies: { ...s.armies, [armyId]: {
          ...s.armies[armyId],
          divisionIds: s.armies[armyId].divisionIds.filter(id => id !== divisionId),
        }},
      }))
    }

    // Transfer division ownership to government
    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, [divisionId]: {
        ...s.divisions[divisionId],
        ownerId: `GOV_${countryCode}`,
        countryCode,
        status: 'ready' as any,
        equipment: [],
        stance: 'first_line_defense' as any,
      }},
    }))

    // Add to armed forces
    set(s => ({
      governments: {
        ...s.governments,
        [countryCode]: {
          ...s.governments[countryCode],
          armedForces: [...s.governments[countryCode].armedForces, divisionId],
        },
      },
    }))

    return { success: true, message: `Donated ${div.name} to ${countryCode} Armed Forces!` }
  },

  recruitFreeFromShop: (countryCode, listingId) => {
    const FREE_RECRUIT_COOLDOWN = 12 * 60 * 60 * 1000  // 12 hours
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const player = usePlayerStore.getState()
    const isOfficial = gov.president === player.name ||
      gov.citizens.some(c => c.id === player.name && (c.role === 'vicepresident' || c.role === 'minister'))
    if (!isOfficial)
      return { success: false, message: 'Only president, VP, or minister can recruit.' }

    // Cooldown check
    const now = Date.now()
    if (now - gov.lastFreeRecruitAt < FREE_RECRUIT_COOLDOWN) {
      const remainH = Math.ceil((FREE_RECRUIT_COOLDOWN - (now - gov.lastFreeRecruitAt)) / 3600000)
      return { success: false, message: `Free recruit on cooldown. ${remainH}h remaining.` }
    }

    const listingIdx = gov.divisionShop.findIndex(l => l.id === listingId)
    if (listingIdx === -1) return { success: false, message: 'Listing not found in shop.' }
    const listing = gov.divisionShop[listingIdx]

    // Create division for armed forces
    const template = DIVISION_TEMPLATES[listing.divisionType]
    const divId = `af_${countryCode}_${now}_${Math.random().toString(36).substr(2, 6)}`
    const division = {
      id: divId,
      type: listing.divisionType,
      name: `${template.name} (${listing.starQuality}★)`,
      category: template.category,
      ownerId: `GOV_${countryCode}`,
      countryCode,
      manpower: getEffectiveManpower(template),
      maxManpower: getEffectiveManpower(template),
      health: getEffectiveHealth(template),
      maxHealth: getEffectiveHealth(template),
      equipment: [] as string[],
      experience: 0,
      stance: 'first_line_defense' as const,
      autoTrainingEnabled: false,
      status: 'training' as const,
      trainingProgress: 0,
      readyAt: now + (template.trainingTime * 15_000),
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

    // Remove listing from shop, update cooldown, add to armed forces
    const newShop = [...gov.divisionShop]
    newShop.splice(listingIdx, 1)
    set(s => ({
      governments: {
        ...s.governments,
        [countryCode]: {
          ...s.governments[countryCode],
          divisionShop: newShop,
          lastFreeRecruitAt: now,
          armedForces: [...s.governments[countryCode].armedForces, divId],
        },
      },
    }))

    return { success: true, message: `Recruited ${template.name} (${listing.starQuality}★) into Armed Forces for free!` }
  },

  recruitEquipmentFromMarket: (countryCode, orderId) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const player = usePlayerStore.getState()
    const isOfficial = gov.president === player.name ||
      gov.citizens.some(c => c.id === player.name && (c.role === 'vicepresident' || c.role === 'minister'))
    if (!isOfficial)
      return { success: false, message: 'Only president, VP, or minister can buy for the country.' }

    // Find the market order
    const mktState = useMarketStore.getState()
    const order = mktState.orders.find((o: any) => o.id === orderId && o.itemType === 'equipment' && o.status === 'open')
    if (!order) return { success: false, message: 'Market listing not found.' }

    // Pay from national fund
    const ws = useWorldStore.getState()
    const country = ws.getCountry(countryCode)
    if (!country || country.fund.money < order.totalPrice)
      return { success: false, message: `National fund insufficient. Need $${order.totalPrice.toLocaleString()}.` }

    ws.spendFromFund(countryCode, { money: order.totalPrice })

    // Tax
    const tax = Math.round(order.totalPrice * 0.01)
    const sellerGets = order.totalPrice - tax

    // Credit seller
    usePlayerStore.getState().earnMoney(sellerGets)

    // Move item to country vault
    const eqId = order.equipItemId
    if (eqId) {
      useInventoryStore.setState((s: any) => ({
        items: s.items.map((i: any) => i.id === eqId ? {
          ...i, location: 'country_vault' as const, equipped: false,
        } : i)
      }))

      // Add to equipment vault
      set(s => ({
        governments: {
          ...s.governments,
          [countryCode]: {
            ...s.governments[countryCode],
            equipmentVault: [...(s.governments[countryCode].equipmentVault || []), eqId],
          },
        },
      }))
    }

    // Tax to country
    ws.addTreasuryTax(countryCode, tax)

    // Mark order as filled
    useMarketStore.setState((s: any) => ({
      orders: s.orders.map((o: any) => o.id === orderId ? { ...o, status: 'filled', filledAmount: 1 } : o),
    }))

    return { success: true, message: `Country purchased ${order.equipSnapshot?.name || 'item'} for $${order.totalPrice.toLocaleString()} from national fund!` }
  },

  buyCasesForCountry: (countryCode, quantity) => {
    const CASE_PRICE = 500  // per case
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const player = usePlayerStore.getState()
    const isOfficial = gov.president === player.name ||
      gov.citizens.some(c => c.id === player.name && (c.role === 'vicepresident' || c.role === 'minister'))
    if (!isOfficial)
      return { success: false, message: 'Only president, VP, or minister can buy cases for the country.' }

    const totalCost = CASE_PRICE * quantity
    const ws = useWorldStore.getState()
    const country = ws.getCountry(countryCode)
    if (!country || country.fund.money < totalCost)
      return { success: false, message: `National fund insufficient. Need $${totalCost.toLocaleString()}.` }

    ws.spendFromFund(countryCode, { money: totalCost })

    // Open cases immediately and put items in country vault
    const inv = useInventoryStore.getState()
    for (let i = 0; i < quantity; i++) {
      // Generate a random item using the loot box logic — simplified: call openLootBox internally
      // For now, give the cases to the official who opened them (they handle distribution)
    }
    // Give cases to the official acting on behalf of the country
    usePlayerStore.setState(s => ({ lootBoxes: s.lootBoxes + quantity }))

    return { success: true, message: `Purchased ${quantity} cases for $${totalCost.toLocaleString()} from national fund! Cases added to your inventory for distribution.` }
  },

  appointRole: (countryCode, targetId, role) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    const player = usePlayerStore.getState()
    if (gov.president !== player.name)
      return { success: false, message: 'Only the president can appoint roles.' }

    const citizen = gov.citizens.find(c => c.id === targetId)
    if (!citizen) return { success: false, message: 'Citizen not found.' }
    if (targetId === player.name) return { success: false, message: 'Cannot change your own role.' }

    // Validate: only 1 VP, max 3 ministers
    if (role === 'vicepresident') {
      const existingVP = gov.citizens.find(c => c.role === 'vicepresident')
      if (existingVP && existingVP.id !== targetId)
        return { success: false, message: `${existingVP.name} is already Vice President. Demote them first.` }
    }
    if (role === 'minister') {
      const ministerCount = gov.citizens.filter(c => c.role === 'minister' && c.id !== targetId).length
      if (ministerCount >= 3)
        return { success: false, message: 'Maximum 3 ministers allowed. Demote one first.' }
    }

    set(s => ({
      governments: {
        ...s.governments,
        [countryCode]: {
          ...s.governments[countryCode],
          citizens: s.governments[countryCode].citizens.map(c =>
            c.id === targetId ? { ...c, role } : c
          ),
        },
      },
    }))

    const roleLabel = role === 'vicepresident' ? 'Vice President' : role.charAt(0).toUpperCase() + role.slice(1)
    return { success: true, message: `${citizen.name} appointed as ${roleLabel}!` }
  },
}))
