import { create } from 'zustand'
import { type DivisionType, type StarQuality, type StatModifiers, DIVISION_TEMPLATES, rollStarQuality, getEffectiveManpower, getEffectiveHealth } from './army'
import { useWorldStore, type NationalFund, type NationalFundKey } from './worldStore'
import { usePlayerStore } from './playerStore'
import { useArmyStore } from './army'
import { useInventoryStore } from './inventoryStore'
import { useMarketStore } from './market'
import { api } from '../api/client'

import type { LawType, LawStatus, Citizen, Law, Candidate, IdeologyType, IdeologyPoints, ContributionMission, DivisionListing, MilitaryContract, Government, ContributionEntry, CitizenContributions } from '../types/government.types'
export type { LawType, LawStatus, Citizen, Law, Candidate, IdeologyType, IdeologyPoints, ContributionMission, DivisionListing, MilitaryContract, Government, ContributionEntry, CitizenContributions }
import { computePoliticalPower, resolveElectionResults, aggregateContributionsSinceJoin, MIN_COALITION_SIZE, PP_ROLLING_WINDOW_MS, type WeightedVote } from '../engine/elections'
export { computePoliticalPower, resolveElectionResults, MIN_COALITION_SIZE, PP_ROLLING_WINDOW_MS }

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
  // ── Weighted Democracy (PP) ──
  citizenContributions: Record<string, CitizenContributions>  // citizenId → rolling contribution log
  electionVotes: Record<string, WeightedVote[]>  // countryCode → votes cast this cycle

  fetchGovernment: (countryCode: string) => Promise<void>
  fetchCitizens: (countryCode: string) => Promise<void>
  setTaxRate: (countryCode: string, taxRate: number) => Promise<{success: boolean, message: string}>
  buildInfrastructure: (countryCode: string, building: 'port'|'airport'|'military_base'|'bunker') => Promise<{success: boolean, message: string}>
  nationalizeCompany: (countryCode: string, companyId: string) => Promise<{success: boolean, message: string}>

  registerCandidate: (countryId: string, citizenId: string, name: string) => void
  voteForCandidate: (countryCode: string, candidateName: string) => Promise<{success: boolean, message: string}>
  // ── Weighted Democracy (PP) actions ──
  recordContribution: (citizenId: string, type: 'damage' | 'production' | 'donation', amount: number) => void
  getPoliticalPower: (citizenId: string) => number
  castWeightedVote: (countryCode: string, voterId: string, candidateId: string) => { success: boolean; message: string }
  proposeLaw: (countryCode: string, lawType: string, targetCountryId?: string, newValue?: number) => Promise<{ success: boolean; message: string }>
  voteOnLaw: (countryCode: string, proposalId: string, vote: 'for' | 'against') => Promise<{ success: boolean; message: string }>
  resolveElections: () => void
  resolveLaws: () => void
  donateToFund: (countryId: string, resource: NationalFundKey, amount: number) => Promise<boolean>
  spendFromFund: (countryId: string, costs: Partial<NationalFund>) => boolean
  startEnrichment: (countryCode: string) => Promise<{ success: boolean; message: string }>
  launchNuke: (fromCountry: string, targetCountry: string) => Promise<{ success: boolean; message: string }>
  authorizeNuke: (countryCode: string) => Promise<{ success: boolean; message: string }>
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
  processBudgetDistribution: (ticksPerDay: number) => Promise<void>
  // Armed Forces
  donateToArmedForces: (countryCode: string, divisionId: string, source: 'player' | 'army', armyId?: string) => { success: boolean; message: string }
  recruitFreeFromShop: (countryCode: string, listingId: string) => { success: boolean; message: string }
  recruitEquipmentFromMarket: (countryCode: string, orderId: string) => { success: boolean; message: string }
  buyCasesForCountry: (countryCode: string, quantity: number) => { success: boolean; message: string }
  appointRole: (countryCode: string, targetId: string, role: 'vicepresident' | 'minister' | 'congress' | 'citizen') => { success: boolean; message: string }
  appointPosition: (countryCode: string, position: 'vicePresident' | 'defenseMinister' | 'ecoMinister', targetPlayerId: string | null) => Promise<{ success: boolean; message: string }>
  appointCongressMember: (countryCode: string, targetPlayerId: string, action: 'add' | 'remove') => Promise<{ success: boolean; message: string }>
  // Revolt system
  canTriggerRevolt: (countryCode: string, playerId: string) => boolean
  // Citizen dividend
  setCitizenDividend: (countryId: string, percent: number) => Promise<{ success: boolean; message: string }>
  processCitizenDividend: (ticksPerDay: number) => void
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
    vicePresident: null,
    defenseMinister: null,
    ecoMinister: null,
    congress: [president, ...congress.slice(0, 4)],
    candidates: [],
    taxRate: 10,
    swornEnemy: null,
    alliances: [],
    empireName: null,
    ideology: null,
    ideologyPoints: { ...DEFAULT_IDEOLOGY_POINTS },
    nuclearAuthorized: false,
    enrichmentStartedAt: null,
    enrichmentCompletedAt: null,
    nukeReady: false,
    citizens: mockCitizens(code, president, congress),
    divisionShop: [],
    militaryBudgetPercent: 5,
    armedForces: [],
    lastFreeRecruitAt: 0,
    equipmentVault: [],
    embargoes: [],
    conscriptionActive: false,
    importTariff: 0,
    minimumWage: 0,
    stateMilitaryUnits: [],
    citizenDividendPercent: 0,
    laws: { proposals: [] },
  }
}

export const useGovernmentStore = create<GovernmentState>((set, get) => ({
  autoDefenseLimit: -1,
  setAutoDefenseLimit: (limit) => {
    set({ autoDefenseLimit: limit })
    // Persist to backend (fire-and-forget)
    import('../api/client').then(({ setCountryAutoDefense }) => {
      const player = (window as any).__xwar_player_country || 'US'
      setCountryAutoDefense(player, limit).catch(() => {})
    })
  },
  governments: {},
  laws: {},
  contributionMissions: {},
  playerDismissals: {},
  militaryContracts: [],
  nextElectionAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  citizenContributions: {},
  electionVotes: {},

  registerCandidate: (countryId, citizenId, name) => set((state) => {
    const gov = state.governments[countryId]
    if (!gov) return state
    if (gov.candidates.find(c => c.id === citizenId)) return state
    return {
      governments: {
        ...state.governments,
        [countryId]: { ...gov, candidates: [...gov.candidates, { id: citizenId, name, votes: 0, weightedVotes: 0, voterIds: [] }] }
      }
    }
  }),

  fetchGovernment: async (countryCode) => {
    try {
      const res: any = await api.get(`/gov/country/${countryCode}`)
      const existing = get().governments[countryCode]

      // Build government object — fallback to empty defaults if no DB row yet
      const raw = res.government ?? {}
      if (raw.enrichmentStartedAt) raw.enrichmentStartedAt = new Date(raw.enrichmentStartedAt).getTime()
      if (raw.enrichmentCompletedAt) raw.enrichmentCompletedAt = new Date(raw.enrichmentCompletedAt).getTime()

      const gov: Government = {
        countryId: countryCode,
        president: raw.president ?? existing?.president ?? null,
        vicePresident: raw.vicePresident ?? raw.vice_president ?? existing?.vicePresident ?? null,
        defenseMinister: raw.defenseMinister ?? raw.defense_minister ?? existing?.defenseMinister ?? null,
        ecoMinister: raw.ecoMinister ?? raw.eco_minister ?? existing?.ecoMinister ?? null,
        congress: raw.congress ?? existing?.congress ?? [],
        candidates: existing?.candidates ?? [],
        taxRate: raw.taxRate ?? raw.tax_rate ?? existing?.taxRate ?? 10,
        swornEnemy: raw.swornEnemy ?? raw.sworn_enemy ?? existing?.swornEnemy ?? null,
        alliances: raw.alliances ?? existing?.alliances ?? [],
        empireName: existing?.empireName ?? null,
        ideology: existing?.ideology ?? null,
        ideologyPoints: existing?.ideologyPoints ?? { ...DEFAULT_IDEOLOGY_POINTS },
        nuclearAuthorized: raw.nuclearAuthorized ?? raw.nuclear_authorized ?? existing?.nuclearAuthorized ?? false,
        enrichmentStartedAt: raw.enrichmentStartedAt ?? existing?.enrichmentStartedAt ?? null,
        enrichmentCompletedAt: raw.enrichmentCompletedAt ?? existing?.enrichmentCompletedAt ?? null,
        nukeReady: existing?.nukeReady ?? false,
        citizens: existing?.citizens ?? [],
        divisionShop: existing?.divisionShop ?? [],
        militaryBudgetPercent: raw.militaryBudgetPercent ?? raw.military_budget_percent ?? existing?.militaryBudgetPercent ?? 5,
        armedForces: existing?.armedForces ?? [],
        lastFreeRecruitAt: existing?.lastFreeRecruitAt ?? 0,
        equipmentVault: existing?.equipmentVault ?? [],
        embargoes: raw.embargoes ?? existing?.embargoes ?? [],
        conscriptionActive: raw.conscriptionActive ?? raw.conscription_active ?? existing?.conscriptionActive ?? false,
        importTariff: raw.importTariff ?? raw.import_tariff ?? existing?.importTariff ?? 0,
        minimumWage: raw.minimumWage ?? raw.minimum_wage ?? existing?.minimumWage ?? 0,
        stateMilitaryUnits: existing?.stateMilitaryUnits ?? [],
        citizenDividendPercent: raw.citizenDividendPercent ?? raw.citizen_dividend_percent ?? existing?.citizenDividendPercent ?? 0,
        laws: raw.laws ?? existing?.laws ?? { proposals: [] },
      }

      set(s => ({
        governments: {
          ...s.governments,
          [countryCode]: gov
        }
      }))
    } catch (err) {
      console.error('[Government] Fetch failed', err)
      // Even on error — seed an empty placeholder so the panel can render
      if (!get().governments[countryCode]) {
        set(s => ({
          governments: {
            ...s.governments,
            [countryCode]: {
              countryId: countryCode, president: null, vicePresident: null,
              defenseMinister: null, ecoMinister: null, congress: [],
              candidates: [], taxRate: 10, swornEnemy: null, alliances: [],
              empireName: null, ideology: null, ideologyPoints: { ...DEFAULT_IDEOLOGY_POINTS },
              nuclearAuthorized: false, enrichmentStartedAt: null, enrichmentCompletedAt: null,
              nukeReady: false, citizens: [], divisionShop: [], militaryBudgetPercent: 5,
              armedForces: [], lastFreeRecruitAt: 0, equipmentVault: [],
              embargoes: [], conscriptionActive: false, importTariff: 0,
              minimumWage: 0, stateMilitaryUnits: [], citizenDividendPercent: 0,
              laws: { proposals: [] },
            }
          }
        }))
      }
    }
  },


  fetchCitizens: async (countryCode) => {
    try {
      const { getCitizens } = await import('../api/client')
      const res = await getCitizens(countryCode)
      if (res.success && res.citizens) {
        set(s => {
          const gov = s.governments[countryCode]
          if (!gov) return s

          // Map citizens and also extract government roles from the response
          const citizenList = (res.citizens || []).map(c => ({
            id: c.id,
            name: c.name,
            level: c.level,
            role: (c.role || 'citizen') as Citizen['role'],
            joinedAt: c.joinedAt,
          }))

          // Sync government fields from citizen roles (backend is source of truth)
          const pres = citizenList.find(c => c.role === 'president')
          const vp = citizenList.find(c => c.role === 'vicepresident')
          const defMin = citizenList.find(c => c.role === 'defense_minister')
          const ecoMin = citizenList.find(c => c.role === 'eco_minister')
          const congressMembers = citizenList.filter(c => c.role === 'congress').map(c => c.name)

          return {
            governments: {
              ...s.governments,
              [countryCode]: {
                ...gov,
                citizens: citizenList,
                // Sync from citizen roles → gov fields to keep them consistent
                president: pres?.name ?? gov.president,
                vicePresident: vp?.name ?? gov.vicePresident,
                defenseMinister: defMin?.name ?? gov.defenseMinister,
                ecoMinister: ecoMin?.name ?? gov.ecoMinister,
                congress: congressMembers.length > 0 ? congressMembers : gov.congress,
              },
            },
          }
        })
        // Sync live population count to worldStore
        useWorldStore.getState().updateCountryPopulation(countryCode, res.citizens.length)
      }
    } catch (err) {
      console.error('[Government] Fetch citizens failed', err)
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

  proposeLaw: async (countryCode, lawType, targetCountryId, newValue) => {
    try {
      const { proposeLawApi } = await import('../api/client')
      const res = await proposeLawApi(countryCode, lawType, targetCountryId, newValue)
      // Refresh government state from server to get new proposal list
      get().fetchGovernment(countryCode)
      return { success: res.success, message: res.message || 'Law proposed.' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to propose law.' }
    }
  },

  voteOnLaw: async (countryCode, proposalId, vote) => {
    try {
      const { voteLawApi } = await import('../api/client')
      const res = await voteLawApi(countryCode, proposalId, vote)
      // Refresh government state to get updated proposals
      get().fetchGovernment(countryCode)
      return { success: res.success, message: res.message || `Vote cast: ${vote}` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to vote.' }
    }
  },

  resolveElections: () => set((state) => {
    if (Date.now() < state.nextElectionAt) return state
    const newGovs = { ...state.governments }
    Object.keys(newGovs).forEach(countryId => {
      const gov = newGovs[countryId]
      if (gov.candidates.length === 0) return

      // Use weighted democracy engine
      const votes = state.electionVotes[countryId] || []
      const candidateNames: Record<string, string> = {}
      gov.candidates.forEach(c => { candidateNames[c.id] = c.name })

      const result = resolveElectionResults(votes, candidateNames, MIN_COALITION_SIZE)

      if (result.winnerId) {
        const newPresident = result.winnerId
        // Congress = next top candidates (up to 5), from rankings
        const newCongress = result.rankings
          .slice(1, 6)
          .map(c => c.id)
        newGovs[countryId] = {
          ...gov,
          president: newPresident,
          congress: newCongress.length > 0 ? newCongress : gov.congress,
          candidates: [],
        }

        // Specialization: politician XP for election winner
        try {
          import('./specializationStore').then(({ useSpecializationStore }) => {
            import('./playerStore').then(({ usePlayerStore }) => {
              const player = usePlayerStore.getState()
              if (player.name === newPresident) {
                const totalVotes = result.rankings.reduce((s: number, c: any) => s + (c.weightedVotes || c.votes || 0), 0)
                const winnerVotes = (result.rankings[0] as any)?.weightedVotes || (result.rankings[0] as any)?.votes || 0
                const votePercent = totalVotes > 0 ? (winnerVotes / totalVotes) * 100 : 0
                useSpecializationStore.getState().recordElectionWin(votePercent)
              }
            })
          }).catch(() => {})
        } catch (_) {}
      } else {
        // No winner — keep current president, reset candidates
        newGovs[countryId] = { ...gov, candidates: [] }
      }

      // Specialization: holdOffice passive XP for current president
      try {
        import('./specializationStore').then(({ useSpecializationStore }) => {
          import('./playerStore').then(({ usePlayerStore }) => {
            const player = usePlayerStore.getState()
            if (player.name === newGovs[countryId].president) {
              useSpecializationStore.getState().recordHoldOffice()
            }
          })
        }).catch(() => {})
      } catch (_) {}
    })
    return {
      governments: newGovs,
      nextElectionAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      electionVotes: {},  // Reset votes for next cycle
    }
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

  donateToFund: async (countryId, resource, amount) => {
    if (amount <= 0) return false
    try {
      const { donateToCountryFund } = await import('../api/client')
      const res = await donateToCountryFund(countryId, resource, amount)
      if (res.success) {
        // Optimistically update local player state
        const player = usePlayerStore.getState()
        if (resource === 'money') player.spendMoney(amount)
        else if (resource === 'oil') player.spendOil(amount)
        else if (resource === 'scrap') player.spendScrap(amount)
        else if (resource === 'materialX') player.spendMaterialX(amount)
        else if (resource === 'bitcoin') player.spendBitcoin(amount)
        // Update country fund locally
        useWorldStore.getState().addToFund(countryId, resource as any, amount)
        // Specialization hooks: economic + politician XP from donations
        try {
          const { useSpecializationStore } = await import('./specializationStore')
          const spec = useSpecializationStore.getState()
          if (resource === 'money') {
            spec.recordDonate(amount)
            spec.recordPoliticianDonate(amount)
          } else {
            // Non-money donations still grant some spec XP based on value estimate
            spec.recordDonate(amount * 10)
            spec.recordPoliticianDonate(amount * 10)
          }
          // RP contribution from donations
          const { useResearchStore } = await import('./researchStore')
          useResearchStore.getState().contributeRP(3, 'donation')
        } catch (_) {}
        return true
      }
      return false
    } catch (err) {
      console.error('[Gov] Donate to fund failed:', err)
      return false
    }
  },

  spendFromFund: (countryId, costs) => {
    // Delegate to worldStore
    return useWorldStore.getState().spendFromFund(countryId, costs)
  },

  startEnrichment: async (countryCode) => {
    try {
      const { startEnrichmentApi } = await import('../api/client')
      const res = await startEnrichmentApi(countryCode)
      if (res.success) {
        // Update local state with enrichment timestamps
        const state = get()
        const gov = state.governments[countryCode]
        if (gov) {
          set({
            governments: {
              ...state.governments,
              [countryCode]: {
                ...gov,
                enrichmentStartedAt: res.enrichmentStartedAt ? new Date(res.enrichmentStartedAt).getTime() : Date.now(),
                enrichmentCompletedAt: res.enrichmentCompletedAt ? new Date(res.enrichmentCompletedAt).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000,
                nukeReady: false,
              },
            },
          })
        }
      }
      return { success: res.success, message: res.message }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to start enrichment.' }
    }
  },

  launchNuke: async (fromCountry, targetCountry) => {
    try {
      const { launchNukeApi } = await import('../api/client')
      const res = await launchNukeApi(fromCountry, targetCountry)
      if (res.success) {
        // Reset local nuclear state
        const state = get()
        const gov = state.governments[fromCountry]
        if (gov) {
          set({
            governments: {
              ...state.governments,
              [fromCountry]: {
                ...gov,
                nuclearAuthorized: false,
                enrichmentStartedAt: null,
                enrichmentCompletedAt: null,
                nukeReady: false,
              },
            },
          })
        }
      }
      return { success: res.success, message: res.message }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to launch nuclear strike.' }
    }
  },

  authorizeNuke: async (countryCode) => {
    try {
      const { authorizeNukeApi } = await import('../api/client')
      const res = await authorizeNukeApi(countryCode)
      if (res.success) {
        const state = get()
        const gov = state.governments[countryCode]
        if (gov) {
          set({
            governments: {
              ...state.governments,
              [countryCode]: { ...gov, nuclearAuthorized: true },
            },
          })
        }
      }
      return { success: res.success, message: res.message }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to authorize nuclear program.' }
    }
  },

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

    const playerCount = (gov.citizens || []).length
    const halfPlayers = Math.max(1, Math.floor(playerCount / 2))

    return Object.entries(INFRA_DIVISION_MAP).map(([category, info]) => {
      const infraLevel = info.getLevel(country)
      const maxSlots = infraLevel * halfPlayers
      const currentSlots = (gov.divisionShop || []).filter(l => info.types.includes(l.divisionType)).length
      return { category, maxSlots, currentSlots }
    })
  },

  spawnShopDivisions: (countryCode) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return
    const country = useWorldStore.getState().countries.find(c => c.code === countryCode)
    if (!country) return

    const playerCount = (gov.citizens || []).length
    const halfPlayers = Math.max(1, Math.floor(playerCount / 2))
    const now = Date.now()
    let newListings = [...(gov.divisionShop || [])]
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
      deployedToPMC: false,
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
    const filtered = (gov.divisionShop || []).filter(l => now < l.expiresAt)
    if (filtered.length !== (gov.divisionShop || []).length) {
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
      const currentSlots = (gov.divisionShop || []).filter(l => info.types.includes(l.divisionType)).length
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

  processBudgetDistribution: async (ticksPerDay) => {
    const state = get()
    const ws = useWorldStore.getState()
    const { useMUStore: MUStore } = await import('./muStore')
    const muState = MUStore.getState()
    const allUnits = Object.values(muState.units)

    const MIN_ACTIVE_FIGHTERS = 3
    const MAX_SHARE = 0.40  // 40% cap per MU
    const JOIN_COOLDOWN_MS = 24 * 60 * 60 * 1000  // 24h

    Object.values(state.governments).forEach(gov => {
      if (gov.militaryBudgetPercent <= 0) return
      const country = ws.getCountry(gov.countryId)
      if (!country) return

      const pct = gov.militaryBudgetPercent / 100
      const ticks = Math.max(1, ticksPerDay)
      const budgetMoney = country.fund.money > 0 ? Math.floor(country.fund.money * pct / ticks) : 0
      if (budgetMoney <= 0) return

      // Find MUs belonging to this country
      const countryMUs = allUnits.filter(u => u.countryCode === gov.countryId)
      if (countryMUs.length === 0) return

      // Calculate eligible MUs and their damage
      const now = Date.now()
      const eligible: { id: string; damage: number }[] = []
      let totalDamage = 0

      countryMUs.forEach(mu => {
        const cycleDmg = mu.cycleDamage || {}
        // Filter out members who joined < 24h ago (anti-alt cooldown)
        const members = mu.members || []
        let qualifiedFighters = 0
        let qualifiedDamage = 0

        for (const [name, dmg] of Object.entries(cycleDmg)) {
          if (dmg <= 0) continue
          const member = members.find(m => m.name === name)
          if (!member) continue
          // 24h join cooldown
          if (now - member.joinedAt < JOIN_COOLDOWN_MS) continue
          qualifiedFighters++
          qualifiedDamage += dmg
        }

        // State MUs: lower threshold (1 fighter) and 1.5× damage weight
        const isState = mu.isStateOwned === true
        const minFighters = isState ? 1 : MIN_ACTIVE_FIGHTERS
        const damageWeight = isState ? 1.5 : 1.0

        // Must have at least minFighters unique qualified fighters
        if (qualifiedFighters >= minFighters && qualifiedDamage > 0) {
          const weightedDamage = Math.floor(qualifiedDamage * damageWeight)
          eligible.push({ id: mu.id, damage: weightedDamage })
          totalDamage += weightedDamage
        }
      })

      if (eligible.length === 0 || totalDamage <= 0) return

      // Calculate shares with 40% cap
      let shares = eligible.map(e => ({
        id: e.id,
        rawShare: e.damage / totalDamage,
        share: Math.min(MAX_SHARE, e.damage / totalDamage),
      }))

      // Normalize shares so they sum to 1.0
      const totalShare = shares.reduce((sum, s) => sum + s.share, 0)
      if (totalShare > 0) {
        shares = shares.map(s => ({ ...s, share: s.share / totalShare }))
      }

      // Spend from country fund
      const ok = ws.spendFromFund(gov.countryId, { money: budgetMoney })
      if (!ok) return

      // Credit each MU vault
      shares.forEach(s => {
        const payout = Math.floor(budgetMoney * s.share)
        if (payout > 0) {
          MUStore.getState().creditBudgetPayout(s.id, payout)
        }
      })
    })

    // Reset all cycle damage for next cycle
    MUStore.getState().resetAllCycleDamage()
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
      deployedToPMC: false,
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

  // ── Revolt System ──
  canTriggerRevolt: (countryCode, playerId) => {
    const gov = get().governments[countryCode]
    if (!gov) return false
    const citizen = gov.citizens.find(c => c.id === playerId)
    if (!citizen) return false
    return citizen.role === 'president' || citizen.role === 'vicepresident' || citizen.role === 'minister'
  },

  // ── Weighted Democracy (PP) Implementation ──

  recordContribution: (citizenId, type, amount) => {
    if (amount <= 0) return
    const state = get()
    const existing = state.citizenContributions[citizenId] || { citizenId, entries: [] }
    const entry: ContributionEntry = { type, amount, timestamp: Date.now() }
    set({
      citizenContributions: {
        ...state.citizenContributions,
        [citizenId]: {
          citizenId,
          entries: [...existing.entries, entry],
        },
      },
    })
  },

  getPoliticalPower: (citizenId) => {
    const state = get()
    const record = state.citizenContributions[citizenId]
    if (!record || record.entries.length === 0) {
      return computePoliticalPower({ damage: 0, itemsProduced: 0, donations: 0 })
    }
    // Find citizen's joinedAt from their country government
    let joinedAt = 0
    for (const gov of Object.values(state.governments)) {
      const citizen = gov.citizens.find(c => c.id === citizenId)
      if (citizen) { joinedAt = citizen.joinedAt; break }
    }
    const contributions = aggregateContributionsSinceJoin(record.entries, joinedAt, Date.now())
    return computePoliticalPower(contributions)
  },

  castWeightedVote: (countryCode, voterId, candidateId) => {
    const state = get()
    const gov = state.governments[countryCode]
    if (!gov) return { success: false, message: 'Government not found.' }

    // Voter must be a citizen
    const citizen = gov.citizens.find(c => c.id === voterId)
    if (!citizen) return { success: false, message: 'You are not a citizen of this country.' }

    // Candidate must exist
    const candidate = gov.candidates.find(c => c.id === candidateId)
    if (!candidate) return { success: false, message: 'Candidate not found.' }

    // Check if voter already voted this cycle
    const existingVotes = state.electionVotes[countryCode] || []
    if (existingVotes.some(v => v.voterId === voterId)) {
      return { success: false, message: 'You have already voted this election cycle.' }
    }

    // Compute voter's PP
    const pp = get().getPoliticalPower(voterId)

    const vote: WeightedVote = { voterId, candidateId, weight: pp }
    set({
      electionVotes: {
        ...state.electionVotes,
        [countryCode]: [...existingVotes, vote],
      },
    })

    return { success: true, message: `Vote cast with ${pp.toFixed(1)} Political Power!` }
  },

  // ── Citizen Dividend ──
  setCitizenDividend: async (countryId, percent) => {
    const clamped = Math.max(0, Math.min(30, Math.round(percent)))
    const gov = get().governments[countryId]
    if (!gov) return { success: false, message: 'Government not found.' }

    // President-only check
    const player = usePlayerStore.getState()
    if (gov.president !== player.name) {
      return { success: false, message: 'Only the president can set citizen dividend.' }
    }

    // Persist via API
    try {
      const res: any = await api.post('/gov/set-citizen-dividend', { countryCode: countryId, percent: clamped })
      if (!res.success) return { success: false, message: res.error || 'Failed to set dividend' }
    } catch (e: any) {
      return { success: false, message: e.message || 'Server error' }
    }

    set(s => ({
      governments: {
        ...s.governments,
        [countryId]: { ...s.governments[countryId], citizenDividendPercent: clamped },
      },
    }))

    return { success: true, message: `Citizen dividend set to ${clamped}%` }
  },

  processCitizenDividend: (ticksPerDay) => {
    const state = get()
    const worldState = useWorldStore.getState()
    const ps = usePlayerStore.getState()
    const playerCountry = ps.countryCode || 'US'

    // Only process for the player's country
    const gov = state.governments[playerCountry]
    if (!gov || gov.citizenDividendPercent <= 0) return

    const country = worldState.getCountry(playerCountry)
    if (!country || country.fund.money <= 0) return

    const citizenCount = gov.citizens.length
    if (citizenCount <= 0) return

    // Calculate per-tick dividend from treasury
    const dailyPercent = gov.citizenDividendPercent / 100
    const dividendPerTick = Math.floor(country.fund.money * dailyPercent / Math.max(1, ticksPerDay))
    if (dividendPerTick <= 0) return

    const perCitizen = Math.floor(dividendPerTick / citizenCount)
    if (perCitizen <= 0) return

    const totalSpend = perCitizen * citizenCount

    // Deduct from country fund
    useWorldStore.getState().spendFromFund(playerCountry, { money: totalSpend })

    // Credit the local player their share
    ps.earnMoney(perCitizen)

    // Log in economy ledger
    worldState.recordEconFlow('citizen_dividend', totalSpend, 'destroyed')
    worldState.recordEconFlow('citizen_dividend_payout', perCitizen, 'created')
  },

  appointPosition: async (countryCode, position, targetPlayerId) => {
    try {
      const res: any = await api.post('/gov/appoint', { countryCode, position, targetPlayerId })
      // Update local state immediately
      set(s => {
        const gov = s.governments[countryCode]
        if (!gov) return s
        return {
          governments: {
            ...s.governments,
            [countryCode]: { ...gov, [position]: targetPlayerId }
          }
        }
      })
      return { success: true, message: res.message || 'Position updated' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Appointment failed' }
    }
  },

  appointCongressMember: async (countryCode, targetPlayerId, action) => {
    try {
      const res: any = await api.post('/gov/appoint-congress', { countryCode, targetPlayerId, action })
      // Update local congress list from response
      if (res.congress) {
        set(s => {
          const gov = s.governments[countryCode]
          if (!gov) return s
          return {
            governments: {
              ...s.governments,
              [countryCode]: { ...gov, congress: res.congress }
            }
          }
        })
      }
      return { success: true, message: res.message || 'Congress updated' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Congress update failed' }
    }
  },
}))

