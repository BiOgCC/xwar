import { create } from 'zustand'

export type LawType = 'declare_war' | 'propose_peace' | 'impeach_president' | 'tax_change' | 'declare_sworn_enemy' | 'authorize_nuclear_action'
export type LawStatus = 'active' | 'passed' | 'failed'

export interface NuclearFund {
  oil: number
  scraps: number
  materialX: number
  bitcoin: number
  jets: number
}

export const NUKE_COST: NuclearFund = {
  oil: 10000,
  scraps: 10000,
  materialX: 10000,
  bitcoin: 100,
  jets: 1,
}

export interface Law {
  id: string
  countryId: string // ISO code
  proposerId: string
  type: LawType
  targetCountryId?: string // Used for war/peace
  newValue?: number // Used for tax changes, etc.
  votesFor: string[] // Array of citizen/congress IDs
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

export interface Government {
  countryId: string // ISO code
  president: string | null
  congress: string[] // Array of citizen IDs (max 5)
  candidates: Candidate[]
  taxRate: number // Default 10%
  swornEnemy: string | null
  nuclearAuthorized: boolean
  nuclearFund: NuclearFund
}

const DEFAULT_FUND: NuclearFund = { oil: 0, scraps: 0, materialX: 0, bitcoin: 0, jets: 0 }

export interface GovernmentState {
  governments: Record<string, Government>
  laws: Record<string, Law>
  nextElectionAt: number

  // Actions
  registerCandidate: (countryId: string, citizenId: string, name: string) => void
  voteForCandidate: (countryId: string, voterId: string, candidateId: string) => void
  proposeLaw: (law: Omit<Law, 'id' | 'votesFor' | 'votesAgainst' | 'status' | 'proposedAt' | 'expiresAt'>) => void
  voteOnLaw: (lawId: string, voterId: string, vote: 'for' | 'against') => void
  resolveElections: () => void
  resolveLaws: () => void
  donateToFund: (countryId: string, resource: keyof NuclearFund, amount: number) => boolean
  launchNuke: (fromCountry: string, targetCountry: string) => void
}

export const useGovernmentStore = create<GovernmentState>((set, get) => ({
  governments: {
    'US': { countryId: 'US', president: 'Commander_X', congress: ['Commander_X', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'RU': { countryId: 'RU', president: 'AI_Commander_Putin', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'CN': { countryId: 'CN', president: 'AI_Commander_Xi', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'DE': { countryId: 'DE', president: 'AI_Commander_Scholz', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'BR': { countryId: 'BR', president: 'AI_Commander_Lula', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'IN': { countryId: 'IN', president: 'AI_Commander_Modi', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'NG': { countryId: 'NG', president: 'AI_Commander_Tinubu', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'JP': { countryId: 'JP', president: 'AI_Commander_Kishida', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'GB': { countryId: 'GB', president: 'AI_Commander_Sunak', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'TR': { countryId: 'TR', president: 'AI_Commander_Erdogan', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'CA': { countryId: 'CA', president: 'AI_Commander_Trudeau', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'MX': { countryId: 'MX', president: 'AI_Commander_Sheinbaum', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'CU': { countryId: 'CU', president: 'AI_Commander_DiazCanel', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
    'BS': { countryId: 'BS', president: 'AI_Commander_Davis', congress: ['AI_Rep_1', 'AI_Rep_2', 'AI_Rep_3', 'AI_Rep_4', 'AI_Rep_5'], candidates: [], taxRate: 10, swornEnemy: null, nuclearAuthorized: false, nuclearFund: { ...DEFAULT_FUND } },
  },
  laws: {},
  nextElectionAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now

  registerCandidate: (countryId, citizenId, name) => set((state) => {
    const gov = state.governments[countryId]
    if (!gov) return state
    
    // Prevent duplicate registration
    if (gov.candidates.find(c => c.id === citizenId)) return state

    return {
      governments: {
        ...state.governments,
        [countryId]: {
          ...gov,
          candidates: [...gov.candidates, { id: citizenId, name, votes: 0 }]
        }
      }
    }
  }),

  voteForCandidate: (countryId, voterId, candidateId) => set((state) => {
    // In a real app we'd track who voters voted for to prevent double voting.
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

    // Ensure proposer is either president or congress
    const isGovOfficial = gov.president === lawData.proposerId || gov.congress.includes(lawData.proposerId)
    if (!isGovOfficial) return state // Only gov can propose laws

    const id = `law_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    return {
      laws: {
        ...state.laws,
        [id]: {
          ...lawData,
          id,
          votesFor: [], // Proposer must vote manually in Congress
          votesAgainst: [],
          proposedAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 real hours to vote
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
    // Only congress votes on laws in this system (President might have veto power, but skipping for simplicity now)
    if (!isCongress) return state

    // Remove previous vote if any
    const votesFor = law.votesFor.filter(id => id !== voterId)
    const votesAgainst = law.votesAgainst.filter(id => id !== voterId)

    if (vote === 'for') votesFor.push(voterId)
    if (vote === 'against') votesAgainst.push(voterId)

    const updatedLaw = { ...law, votesFor, votesAgainst }

    // Check if we hit majority early (1 vote for testing purposes!)
    if (votesFor.length >= 1) {
      updatedLaw.status = 'passed'
    } else if (votesAgainst.length >= 3) {
      updatedLaw.status = 'failed'
    }

    return {
      laws: {
        ...state.laws,
        [lawId]: updatedLaw
      }
    }
  }),

  resolveElections: () => set((state) => {
    if (Date.now() < state.nextElectionAt) return state

    const newGovs = { ...state.governments }

    Object.keys(newGovs).forEach(countryId => {
      const gov = newGovs[countryId]
      if (gov.candidates.length === 0) return // No candidates, keep existing

      // Sort candidates by votes descending
      const sorted = [...gov.candidates].sort((a, b) => b.votes - a.votes)
      
      const newPresident = sorted[0].id
      // Next 5 become congress
      const newCongress = sorted.slice(1, 6).map(c => c.id)

      newGovs[countryId] = {
        ...gov,
        president: newPresident,
        congress: newCongress.length > 0 ? newCongress : gov.congress, // keep old congress if not enough runners
        candidates: [] // Reset candidates for next term
      }
    })

    return {
      governments: newGovs,
      nextElectionAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 more days
    }
  }),

  resolveLaws: () => set((state) => {
    const now = Date.now()
    let changed = false
    const newLaws = { ...state.laws }

    Object.values(newLaws).forEach(law => {
      if (law.status === 'active' && now > law.expiresAt) {
        changed = true
        // If it expires, it fails if it didn't already hit majority
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
          nuclearFund: {
            ...gov.nuclearFund,
            [resource]: gov.nuclearFund[resource] + amount,
          },
        },
      },
    })
    return true
  },

  launchNuke: (fromCountry, targetCountry) => set((state) => {
    const gov = state.governments[fromCountry]
    if (!gov || !gov.nuclearAuthorized) return state

    // Check if fund meets requirements
    const fund = gov.nuclearFund
    if (fund.oil < NUKE_COST.oil || fund.scraps < NUKE_COST.scraps ||
        fund.materialX < NUKE_COST.materialX || fund.bitcoin < NUKE_COST.bitcoin ||
        fund.jets < NUKE_COST.jets) {
      return state // Not enough resources
    }

    // Deduct costs and revoke authorization
    return {
      governments: {
        ...state.governments,
        [fromCountry]: {
          ...gov,
          nuclearAuthorized: false,
          nuclearFund: {
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
}))
