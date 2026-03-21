import { create } from 'zustand'
import { useWorldStore } from './worldStore'

// ====== RESEARCH NODE DEFINITIONS ======

export interface ResearchNode {
  id: string
  name: string
  icon: string
  cost: number          // Money from National Fund
  description: string
  effect: string        // Human-readable effect
}

export const MILITARY_DOCTRINE: ResearchNode[] = [
  { id: 'mil_1', name: 'Basic Training',    icon: '🎖️', cost: 50000,  description: 'Improved drill routines',    effect: '+5% division HP' },
  { id: 'mil_2', name: 'Field Tactics',     icon: '📋', cost: 100000, description: 'Battlefield coordination',    effect: '+5% division damage' },
  { id: 'mil_3', name: 'Fortification',     icon: '🏰', cost: 150000, description: 'Hardened defensive positions', effect: '+10% armor all units' },
  { id: 'mil_4', name: 'Combined Arms',     icon: '🎯', cost: 200000, description: 'Multi-branch warfare',        effect: '+5% hit rate' },
  { id: 'mil_5', name: 'Elite Forces',      icon: '💀', cost: 300000, description: 'Special operations doctrine',  effect: '+10% crit damage' },
  { id: 'mil_6', name: 'Rapid Deployment',  icon: '⚡', cost: 400000, description: 'Streamlined logistics',       effect: '-20% training time' },
  { id: 'mil_7', name: 'Total War',         icon: '🔥', cost: 500000, description: 'Full national mobilization',  effect: '+5% all combat stats' },
]

export const ECONOMIC_THEORY: ResearchNode[] = [
  { id: 'eco_1', name: 'Labor Reform',      icon: '⚒️', cost: 50000,  description: 'Worker efficiency programs',  effect: '+10% work earnings' },
  { id: 'eco_2', name: 'Trade Routes',      icon: '🚢', cost: 100000, description: 'International commerce',      effect: '+5% production output' },
  { id: 'eco_3', name: 'Banking System',    icon: '🏦', cost: 150000, description: 'Modern financial services',   effect: '-10% heal cost' },
  { id: 'eco_4', name: 'Industrial Policy', icon: '🏭', cost: 200000, description: 'Manufacturing subsidies',     effect: '-10% recruit cost' },
  { id: 'eco_5', name: 'War Economy',       icon: '💰', cost: 300000, description: 'Military-industrial complex',  effect: '+25% war rewards' },
  { id: 'eco_6', name: 'Supply Lines',      icon: '📦', cost: 400000, description: 'Efficient logistics network',  effect: '-15% revive cost' },
  { id: 'eco_7', name: 'Superpower',        icon: '🌟', cost: 500000, description: 'Global economic dominance',    effect: '+10% all economy' },
]

// ====== STORE ======

export interface CountryResearch {
  military: string[]   // IDs of unlocked military nodes
  economy: string[]    // IDs of unlocked economy nodes
}

export interface ResearchState {
  research: Record<string, CountryResearch>  // countryCode → research

  getResearch: (countryCode: string) => CountryResearch
  canUnlock: (countryCode: string, tree: 'military' | 'economy', nodeId: string) => boolean
  unlockNode: (countryCode: string, tree: 'military' | 'economy', nodeId: string) => { success: boolean; message: string }

  // Bonus getters
  getMilitaryBonuses: (countryCode: string) => MilitaryBonuses
  getEconomyBonuses: (countryCode: string) => EconomyBonuses
}

export interface MilitaryBonuses {
  hpBonus: number           // Multiplicative: 1.0 = no bonus
  damageBonus: number
  armorBonus: number
  hitRateBonus: number
  critDmgBonus: number
  trainingTimeMult: number  // 1.0 = normal, 0.8 = 20% faster
  allCombatBonus: number
}

export interface EconomyBonuses {
  workEarningsBonus: number
  productionBonus: number
  healCostMult: number      // 1.0 = normal, 0.9 = 10% cheaper
  recruitCostMult: number
  warRewardsMult: number    // 1.0 = normal, 1.25 = +25%
  reviveCostMult: number
  allEconomyBonus: number
}

const DEFAULT_RESEARCH: CountryResearch = { military: [], economy: [] }

export const useResearchStore = create<ResearchState>((set, get) => ({
  research: {},

  getResearch: (countryCode) => {
    return get().research[countryCode] || DEFAULT_RESEARCH
  },

  canUnlock: (countryCode, tree, nodeId) => {
    const r = get().getResearch(countryCode)
    const unlocked = tree === 'military' ? r.military : r.economy
    const nodes = tree === 'military' ? MILITARY_DOCTRINE : ECONOMIC_THEORY

    // Already unlocked?
    if (unlocked.includes(nodeId)) return false

    // Find node index
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx < 0) return false

    // First node is always unlockable; others require previous
    if (idx > 0 && !unlocked.includes(nodes[idx - 1].id)) return false

    // Check fund
    const fund = useWorldStore.getState().getCountry(countryCode)?.fund
    if (!fund || fund.money < nodes[idx].cost) return false

    return true
  },

  unlockNode: (countryCode, tree, nodeId) => {
    const state = get()
    if (!state.canUnlock(countryCode, tree, nodeId)) {
      return { success: false, message: 'Cannot unlock this research.' }
    }

    const nodes = tree === 'military' ? MILITARY_DOCTRINE : ECONOMIC_THEORY
    const node = nodes.find(n => n.id === nodeId)!

    // Spend from fund
    const spent = useWorldStore.getState().spendFromFund(countryCode, { money: node.cost })
    if (!spent) return { success: false, message: 'Not enough funds.' }

    // Add to unlocked
    const r = state.getResearch(countryCode)
    const key = tree === 'military' ? 'military' : 'economy'
    const updated: CountryResearch = {
      ...r,
      [key]: [...r[key], nodeId],
    }

    set({
      research: {
        ...state.research,
        [countryCode]: updated,
      },
    })

    return { success: true, message: `Researched: ${node.name}! ${node.effect}` }
  },

  getMilitaryBonuses: (countryCode) => {
    const r = get().getResearch(countryCode)
    const has = (id: string) => r.military.includes(id)
    return {
      hpBonus:          has('mil_1') ? 1.05 : 1.0,
      damageBonus:      has('mil_2') ? 1.05 : 1.0,
      armorBonus:       has('mil_3') ? 1.10 : 1.0,
      hitRateBonus:     has('mil_4') ? 0.05 : 0,
      critDmgBonus:     has('mil_5') ? 1.10 : 1.0,
      trainingTimeMult: has('mil_6') ? 0.80 : 1.0,
      allCombatBonus:   has('mil_7') ? 1.05 : 1.0,
    }
  },

  getEconomyBonuses: (countryCode) => {
    const r = get().getResearch(countryCode)
    const has = (id: string) => r.economy.includes(id)
    return {
      workEarningsBonus: has('eco_1') ? 1.10 : 1.0,
      productionBonus:   has('eco_2') ? 1.05 : 1.0,
      healCostMult:      has('eco_3') ? 0.90 : 1.0,
      recruitCostMult:   has('eco_4') ? 0.90 : 1.0,
      warRewardsMult:    has('eco_5') ? 1.25 : 1.0,
      reviveCostMult:    has('eco_6') ? 0.85 : 1.0,
      allEconomyBonus:   has('eco_7') ? 1.10 : 1.0,
    }
  },
}))
