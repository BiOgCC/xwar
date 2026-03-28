import { create } from 'zustand'
import { getResearch as fetchResearchApi, selectResearchApi, contributeRPApi } from '../api/client'

// ====== RESEARCH NODE DEFINITIONS ======

export interface ResearchNode {
  id: string
  name: string
  icon: string
  rpRequired: number     // RP needed from collective citizen effort
  description: string
  effect: string         // Human-readable effect
}

export const MILITARY_DOCTRINE: ResearchNode[] = [
  { id: 'mil_1', name: 'Combat Drills',     icon: 'medal',     rpRequired: 100,   description: 'Sharpened combat techniques',    effect: '+5% manual attack damage' },
  { id: 'mil_2', name: 'Field Tactics',     icon: 'clipboard', rpRequired: 250,   description: 'Battlefield coordination',        effect: '+5% hit rate' },
  { id: 'mil_3', name: 'Hardened Armor',    icon: 'castle',    rpRequired: 500,   description: 'Reinforced defensive gear',       effect: '+10% armor for citizens' },
  { id: 'mil_4', name: 'Precision Strike',  icon: 'crosshair', rpRequired: 1000,  description: 'Lethal precision training',       effect: '+10% crit damage' },
  { id: 'mil_5', name: 'Tactical Ops',      icon: 'skull',     rpRequired: 2000,  description: 'Advanced tactical doctrine',      effect: '+15% tactical order effectiveness' },
  { id: 'mil_6', name: 'Counter-Intel',     icon: 'zap',       rpRequired: 3500,  description: 'Evasion and counter-measures',    effect: '+10% dodge chance' },
  { id: 'mil_7', name: 'Total War',         icon: 'flame',     rpRequired: 5000,  description: 'Full national mobilization',      effect: '+5% all combat stats' },
]

export const ECONOMIC_THEORY: ResearchNode[] = [
  { id: 'eco_1', name: 'Labor Reform',      icon: 'hammer',    rpRequired: 100,   description: 'Worker efficiency programs',      effect: '+10% work earnings' },
  { id: 'eco_2', name: 'Trade Routes',      icon: 'ship',      rpRequired: 250,   description: 'International commerce',          effect: '+5% production output' },
  { id: 'eco_3', name: 'Prospection Tech',  icon: 'landmark',  rpRequired: 500,   description: 'Advanced prospection methods',    effect: '+10% prospection find chance' },
  { id: 'eco_4', name: 'Industrial Policy', icon: 'factory',   rpRequired: 1000,  description: 'Manufacturing subsidies',         effect: '+10% company output' },
  { id: 'eco_5', name: 'Tax Efficiency',    icon: 'coins',     rpRequired: 2000,  description: 'Streamlined tax collection',      effect: '+15% country auto-income' },
  { id: 'eco_6', name: 'Resource Mastery',  icon: 'package',   rpRequired: 3500,  description: 'Efficient resource extraction',   effect: '+10% all resource gains' },
  { id: 'eco_7', name: 'Superpower',        icon: 'star',      rpRequired: 5000,  description: 'Global economic dominance',       effect: '+10% all economy' },
]

// ====== STORE ======

export interface ActiveResearch {
  nodeId: string
  tree: 'military' | 'economy'
  rpCollected: number
  rpRequired: number
  startedAt: number
  contributors: Record<string, number>  // playerName → rp contributed
}

export interface CountryResearch {
  military: string[]   // IDs of unlocked military nodes
  economy: string[]    // IDs of unlocked economy nodes
}

export interface ResearchState {
  research: Record<string, CountryResearch>
  activeResearch: Record<string, ActiveResearch | null>  // countryCode → active
  totalRpContributed: Record<string, number>  // countryCode → cumulative RP

  getResearch: (countryCode: string) => CountryResearch
  getActive: (countryCode: string) => ActiveResearch | null
  getTotalRp: (countryCode: string) => number
  canSelect: (countryCode: string, tree: 'military' | 'economy', nodeId: string) => boolean
  selectResearch: (countryCode: string, tree: 'military' | 'economy', nodeId: string) => Promise<{ success: boolean; message: string }>
  contributeRP: (rp: number, source?: string) => void
  fetchResearch: (countryCode: string) => Promise<void>

  // Bonus getters
  getMilitaryBonuses: (countryCode: string) => MilitaryBonuses
  getEconomyBonuses: (countryCode: string) => EconomyBonuses
}

export interface MilitaryBonuses {
  attackDamageBonus: number    // mil_1: +5% manual attack damage
  hitRateBonus: number         // mil_2: +5% hit rate
  armorBonus: number           // mil_3: +10% armor
  critDmgBonus: number         // mil_4: +10% crit damage
  tacticalOpsBonus: number     // mil_5: +15% tactical order effectiveness
  dodgeBonus: number           // mil_6: +10% dodge chance
  allCombatBonus: number       // mil_7: +5% all combat stats
}

export interface EconomyBonuses {
  workEarningsBonus: number    // eco_1: +10% work earnings
  productionBonus: number      // eco_2: +5% production output
  prospectionBonus: number     // eco_3: +10% prospection find chance
  companyOutputBonus: number   // eco_4: +10% company output
  autoIncomeBonus: number      // eco_5: +15% country auto-income
  resourceGainBonus: number    // eco_6: +10% all resource gains
  allEconomyBonus: number      // eco_7: +10% all economy
}

const DEFAULT_RESEARCH: CountryResearch = { military: [], economy: [] }

export const useResearchStore = create<ResearchState>((set, get) => ({
  research: {},
  activeResearch: {},
  totalRpContributed: {},

  getResearch: (countryCode) => {
    return get().research[countryCode] || DEFAULT_RESEARCH
  },

  getActive: (countryCode) => {
    return get().activeResearch[countryCode] || null
  },

  getTotalRp: (countryCode) => {
    return get().totalRpContributed[countryCode] || 0
  },

  canSelect: (countryCode, tree, nodeId) => {
    const r = get().getResearch(countryCode)
    const unlocked = tree === 'military' ? r.military : r.economy
    const nodes = tree === 'military' ? MILITARY_DOCTRINE : ECONOMIC_THEORY

    if (unlocked.includes(nodeId)) return false
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx < 0) return false
    if (idx > 0 && !unlocked.includes(nodes[idx - 1].id)) return false

    // Can't select if there's already active research
    const active = get().getActive(countryCode)
    if (active) return false

    return true
  },

  selectResearch: async (countryCode, tree, nodeId) => {
    try {
      const res = await selectResearchApi(countryCode, tree, nodeId)
      if (res.success && res.activeResearch) {
        set(s => ({
          activeResearch: { ...s.activeResearch, [countryCode]: res.activeResearch },
        }))
      }
      return { success: res.success, message: res.message }
    } catch (err: any) {
      return { success: false, message: err?.response?.data?.error || 'Failed to select research.' }
    }
  },

  contributeRP: (rp, source) => {
    // Fire-and-forget — don't await, don't block gameplay
    contributeRPApi(rp, source).then(res => {
      if (res.completed) {
        // Research completed! Refresh state
        import('./playerStore').then(({ usePlayerStore }) => {
          const iso = usePlayerStore.getState().countryCode
          if (iso) get().fetchResearch(iso)
        })
      } else if (res.success && res.rpCollected !== undefined) {
        // Update local progress
        import('./playerStore').then(({ usePlayerStore }) => {
          const iso = usePlayerStore.getState().countryCode
          if (iso) {
            set(s => {
              const active = s.activeResearch[iso]
              if (!active) return s
              return {
                activeResearch: {
                  ...s.activeResearch,
                  [iso]: { ...active, rpCollected: res.rpCollected! },
                },
                totalRpContributed: {
                  ...s.totalRpContributed,
                  [iso]: (s.totalRpContributed[iso] || 0) + rp,
                },
              }
            })
          }
        })
      }
    }).catch(() => { /* silent */ })
  },

  fetchResearch: async (countryCode) => {
    try {
      const res = await fetchResearchApi(countryCode)
      if (res.success) {
        set(s => ({
          research: {
            ...s.research,
            [countryCode]: {
              military: (res.research?.military as string[]) || [],
              economy: (res.research?.economy as string[]) || [],
            },
          },
          activeResearch: {
            ...s.activeResearch,
            [countryCode]: res.activeResearch || null,
          },
          totalRpContributed: {
            ...s.totalRpContributed,
            [countryCode]: (res as any).totalRpContributed || 0,
          },
        }))
      }
    } catch (err) {
      console.error('[ResearchStore] Fetch failed', err)
    }
  },

  getMilitaryBonuses: (countryCode) => {
    const r = get().getResearch(countryCode)
    const has = (id: string) => r.military.includes(id)
    return {
      attackDamageBonus: has('mil_1') ? 1.05 : 1.0,
      hitRateBonus:      has('mil_2') ? 0.05 : 0,
      armorBonus:        has('mil_3') ? 1.10 : 1.0,
      critDmgBonus:      has('mil_4') ? 1.10 : 1.0,
      tacticalOpsBonus:  has('mil_5') ? 1.15 : 1.0,
      dodgeBonus:        has('mil_6') ? 0.10 : 0,
      allCombatBonus:    has('mil_7') ? 1.05 : 1.0,
    }
  },

  getEconomyBonuses: (countryCode) => {
    const r = get().getResearch(countryCode)
    const has = (id: string) => r.economy.includes(id)
    return {
      workEarningsBonus:  has('eco_1') ? 1.10 : 1.0,
      productionBonus:    has('eco_2') ? 1.05 : 1.0,
      prospectionBonus:   has('eco_3') ? 1.10 : 1.0,
      companyOutputBonus: has('eco_4') ? 1.10 : 1.0,
      autoIncomeBonus:    has('eco_5') ? 1.15 : 1.0,
      resourceGainBonus:  has('eco_6') ? 1.10 : 1.0,
      allEconomyBonus:    has('eco_7') ? 1.10 : 1.0,
    }
  },
}))
