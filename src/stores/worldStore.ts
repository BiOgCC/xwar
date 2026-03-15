import { create } from 'zustand'

export interface Country {
  name: string
  code: string
  controller: string
  empire: string | null
  population: number
  regions: number
  military: number
  treasury: number
  color: string
  conqueredResources: ConqueredResourceType[]
  activeDepositBonus: { type: DepositType; bonus: number } | null
  portLevel: number
  airportLevel: number
  bunkerLevel: number
  militaryBaseLevel: number
  taxExempt: boolean
}

export interface War {
  id: string
  attacker: string
  defender: string
  startedAt: number
  status: 'active' | 'ceasefire' | 'ended'
}

// ── Regional Deposits ──
export type DepositType = 'wheat' | 'fish' | 'steak' | 'oil' | 'materialx'

export interface RegionalDeposit {
  id: string
  type: DepositType
  countryCode: string
  bonus: number        // 30
  discoveredBy: string | null
  active: boolean
}

// ── Conquered Resources ──
export type ConqueredResourceType = 'Iron' | 'Titanium' | 'Saltpeter' | 'Rubber' | 'Silicon' | 'Uranium'
export const CONQUERED_RESOURCE_TYPES: ConqueredResourceType[] = ['Iron', 'Titanium', 'Saltpeter', 'Rubber', 'Silicon', 'Uranium']

/** Calculate the total production bonus from a country's conquered resources */
export function getCountryResourceBonus(resources: ConqueredResourceType[]): number {
  const counts: Record<string, number> = {}
  resources.forEach(r => { counts[r] = (counts[r] || 0) + 1 })
  let bonus = 0
  Object.values(counts).forEach((count) => {
    if (count >= 1) bonus += 5     // 1st of type = +5%
    if (count >= 2) bonus += 0.5   // 2nd of same = +0.5%
    if (count >= 3) bonus += 0.25  // 3rd of same = +0.25%
  })
  return bonus
}

// Map of ISO codes to array of adjacent ISO codes
export const ADJACENCY_MAP: Record<string, string[]> = {
  'US': ['CA', 'MX', 'CU', 'BS', 'RU', 'GB', 'BR', 'DE'],
  'CA': ['US'],
  'MX': ['US', 'CU'],
  'CU': ['US', 'MX', 'BS'],
  'BS': ['US', 'CU'],
  'RU': ['US', 'CN', 'JP', 'TR', 'DE'],
  'CN': ['RU', 'IN', 'JP'],
  'DE': ['RU', 'GB', 'TR', 'US'],
  'BR': ['US', 'NG'],
  'IN': ['CN'],
  'NG': ['BR', 'TR'],
  'JP': ['CN', 'RU', 'US'],
  'GB': ['US', 'DE'],
  'TR': ['RU', 'DE', 'NG'],
}

// Seed some undiscovered deposits across countries
const INITIAL_DEPOSITS: RegionalDeposit[] = [
  { id: 'dep-1',  type: 'wheat',     countryCode: 'US', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-2',  type: 'oil',       countryCode: 'US', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-3',  type: 'fish',      countryCode: 'JP', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-4',  type: 'steak',     countryCode: 'BR', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-5',  type: 'materialx', countryCode: 'RU', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-6',  type: 'oil',       countryCode: 'RU', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-7',  type: 'wheat',     countryCode: 'IN', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-8',  type: 'fish',      countryCode: 'GB', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-9',  type: 'materialx', countryCode: 'CN', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-10', type: 'steak',     countryCode: 'DE', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-11', type: 'oil',       countryCode: 'NG', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-12', type: 'wheat',     countryCode: 'CA', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-13', type: 'fish',      countryCode: 'MX', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-14', type: 'materialx', countryCode: 'TR', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-15', type: 'steak',     countryCode: 'CU', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-16', type: 'oil',       countryCode: 'BS', bonus: 30, discoveredBy: null, active: false },
]

const makeCountry = (name: string, code: string, controller: string, empire: string | null, population: number, regions: number, military: number, treasury: number, color: string, conqueredResources: ConqueredResourceType[] = []): Country => ({
  name, code, controller, empire, population, regions, military, treasury, color, conqueredResources, activeDepositBonus: null, portLevel: 1, airportLevel: 1, bunkerLevel: 1, militaryBaseLevel: 1, taxExempt: false,
})

export interface WorldState {
  countries: Country[]
  wars: War[]
  deposits: RegionalDeposit[]
  turn: number
  nextTurnIn: number
  
  // Actions
  declareWar: (attackerIso: string, defenderIso: string) => void
  canAttack: (attackerIso: string, defenderIso: string) => boolean
  addTreasuryTax: (countryCode: string, amount: number) => void
  discoverDeposit: (depositId: string, playerName: string) => void
  getCountry: (code: string) => Country | undefined
  occupyCountry: (targetIso: string, conquerorIso: string, taxExempt: boolean) => void
}

export const useWorldStore = create<WorldState>((set, get) => ({
  turn: 247,
  nextTurnIn: 342,

  deposits: INITIAL_DEPOSITS,

  countries: [
    makeCountry('United States', 'US', 'Player Alliance', 'NATO', 32000, 12, 95, 1200000, '#4f8ef7', ['Iron', 'Titanium']),
    makeCountry('Russia', 'RU', 'Red Army', 'Eastern Bloc', 28000, 18, 88, 890000, '#c0392b', ['Saltpeter', 'Iron']),
    makeCountry('China', 'CN', 'Dragon Force', 'Eastern Bloc', 45000, 14, 82, 1500000, '#e74c3c', ['Silicon', 'Rubber']),
    makeCountry('Germany', 'DE', 'Euro Corps', 'NATO', 18000, 4, 65, 720000, '#f39c12', ['Titanium']),
    makeCountry('Brazil', 'BR', 'Amazonia', null, 22000, 8, 55, 340000, '#27ae60', ['Rubber']),
    makeCountry('India', 'IN', 'Bengal Tigers', null, 38000, 10, 70, 680000, '#e67e22', ['Iron']),
    makeCountry('Nigeria', 'NG', 'West African Union', null, 15000, 5, 40, 180000, '#16a085', ['Uranium']),
    makeCountry('Japan', 'JP', 'Rising Sun', 'NATO', 20000, 3, 72, 950000, '#e84393', ['Silicon']),
    makeCountry('United Kingdom', 'GB', 'Crown Forces', 'NATO', 16000, 3, 68, 560000, '#8e44ad', ['Saltpeter']),
    makeCountry('Turkey', 'TR', 'Ottoman Revival', 'Eastern Bloc', 14000, 4, 58, 290000, '#00b894', ['Rubber']),
    makeCountry('Canada', 'CA', 'Northern Guard', 'NATO', 12000, 8, 45, 380000, '#74b9ff', ['Uranium']),
    makeCountry('Mexico', 'MX', 'Cartel Coalition', null, 18000, 6, 40, 250000, '#fd9644', ['Iron']),
    makeCountry('Cuba', 'CU', 'Caribbean Command', 'Eastern Bloc', 6000, 2, 35, 90000, '#b71540', ['Saltpeter']),
    makeCountry('Bahamas', 'BS', 'Island Syndicate', null, 2000, 1, 15, 150000, '#0abde3', []),
  ],

  wars: [
    { id: 'w1', attacker: 'US', defender: 'RU', startedAt: Date.now() - 86400000 * 3, status: 'active' },
    { id: 'w2', attacker: 'CN', defender: 'JP', startedAt: Date.now() - 86400000 * 1, status: 'active' },
    { id: 'w3', attacker: 'US', defender: 'CU', startedAt: Date.now() - 86400000 * 2, status: 'active' },
    { id: 'w4', attacker: 'US', defender: 'CA', startedAt: Date.now() - 86400000 * 1, status: 'active' },
    { id: 'w5', attacker: 'RU', defender: 'DE', startedAt: Date.now() - 86400000 * 1, status: 'active' },
  ],

  getCountry: (code) => get().countries.find(c => c.code === code),

  occupyCountry: (targetIso, conquerorIso, taxExempt) => set((state) => ({
    countries: state.countries.map(c => {
      if (c.code === targetIso) {
        return { ...c, empire: conquerorIso, taxExempt }
      }
      return c
    })
  })),

  addTreasuryTax: (countryCode, amount) => set((s) => ({
    countries: s.countries.map(c =>
      c.code === countryCode ? { ...c, treasury: c.treasury + amount } : c
    )
  })),

  discoverDeposit: (depositId, playerName) => set((s) => ({
    deposits: s.deposits.map(d =>
      d.id === depositId ? { ...d, discoveredBy: playerName, active: true } : d
    ),
    // Set country active deposit bonus (non-cumulative, replaces any existing)
    countries: s.countries.map(c => {
      const dep = s.deposits.find(d => d.id === depositId)
      if (!dep || c.code !== dep.countryCode) return c
      return { ...c, activeDepositBonus: { type: dep.type, bonus: 10 } }
    })
  })),

  canAttack: (attackerIso, defenderIso) => {
    const adjacent = ADJACENCY_MAP[attackerIso] || []
    if (!adjacent.includes(defenderIso)) return false
    
    const state = get()
    const activeWar = state.wars.find(w => 
      w.status === 'active' && 
      ((w.attacker === attackerIso && w.defender === defenderIso) || 
       (w.attacker === defenderIso && w.defender === attackerIso))
    )
    return !!activeWar
  },

  declareWar: (attackerIso, defenderIso) => set((state) => {
    const existing = state.wars.find(w => 
      w.status === 'active' && 
      ((w.attacker === attackerIso && w.defender === defenderIso) || 
       (w.attacker === defenderIso && w.defender === attackerIso))
    )
    if (existing) return state

    const newWar: War = {
      id: `war_${Date.now()}_${attackerIso}_${defenderIso}`,
      attacker: attackerIso,
      defender: defenderIso,
      startedAt: Date.now(),
      status: 'active'
    }

    return { wars: [...state.wars, newWar] }
  })
}))
