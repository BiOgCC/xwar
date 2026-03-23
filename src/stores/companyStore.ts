import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useWorldStore, getCountryResourceBonus, type DepositType } from './worldStore'
import { useResearchStore } from './researchStore'
import { api } from '../api/client'

import type { CompanyType, Company, CompanyTemplate, DepositEvent, JobListing, CompanyTransaction } from '../types/company.types'
export type { CompanyType, Company, CompanyTemplate, DepositEvent, JobListing, CompanyTransaction }

// Employment tax rate (10%)
const TAX_RATE = 0.10

// Map company types to deposit types for bonus matching
const COMPANY_DEPOSIT_MAP: Partial<Record<CompanyType, DepositType>> = {
  wheat_farm: 'wheat',
  fish_farm: 'fish',
  steak_farm: 'steak',
  oil_refinery: 'oil',
  materialx_refiner: 'materialx',
  bakery: 'wheat',
  sushi_bar: 'fish',
  wagyu_grill: 'steak',
}

const getProductionContribution = (prodSkill: number, companyLevel: number = 1) => {
  const baseProd = 10 + (prodSkill * 5) + companyLevel
  const variance = Math.max(1, Math.floor(baseProd * 0.1))
  const minProd = baseProd - variance
  const maxProd = baseProd + variance
  return Math.floor(minProd + Math.random() * (maxProd - minProd + 1))
}

const triggerEconomicModifiers = (triggerSource: 'work' | 'enterprise' | 'produce'): string => {
  const skills = useSkillsStore.getState()
  const worldStore = useWorldStore.getState()
  let msg = ''
  
  // Prospection deposit discovery — only on Work/Enterprise AND requires owning a Prospection Center
  if (triggerSource === 'work' || triggerSource === 'enterprise') {
    const companies = useCompanyStore.getState().companies
    const ownsProspector = companies.some(c => c.type === 'prospection_center')
    
    if (ownsProspector) {
      const prospChance = skills.economic.prospection * 0.02  // 2% per level, max 20%
      if (Math.random() < prospChance) {
        const undiscovered = worldStore.deposits.filter(d => !d.discoveredBy)
        if (undiscovered.length > 0) {
          const deposit = undiscovered[Math.floor(Math.random() * undiscovered.length)]
          const player = usePlayerStore.getState()
          
          // Reward: oil 2000-4000 / matX 150-300, 2 BTC, $5000-10000
          const oilAmount = 2000 + Math.floor(Math.random() * 2001)
          const matXAmount = 150 + Math.floor(Math.random() * 151)
          const cashAmount = 5000 + Math.floor(Math.random() * 5001)
          
          // Grant items based on deposit type
          if (deposit.type === 'materialx') {
            usePlayerStore.getState().addResource('materialX', matXAmount, 'deposit_discovery')
          } else {
            usePlayerStore.getState().addResource(deposit.type, oilAmount, 'deposit_discovery')
          }
          usePlayerStore.getState().addResource('bitcoin', 2, 'deposit_discovery')
          usePlayerStore.getState().earnMoney(cashAmount)
          
          // Discover it in worldStore
          worldStore.discoverDeposit(deposit.id, player.name)
          
          const country = worldStore.getCountry(deposit.countryCode)
          const itemLabel = deposit.type === 'materialx' ? `+${matXAmount} matX` : `+${oilAmount} ${deposit.type}`
          msg += ` 🎉 Discovered ${deposit.type} deposit in ${country?.name || deposit.countryCode}! ${itemLabel}, +2₿, +$${cashAmount.toLocaleString()}`
        } else {
          // Fallback: small resource bonus
          const resources: Array<'Oil' | 'MaterialX'> = ['Oil', 'MaterialX']
          const resource = resources[Math.floor(Math.random() * resources.length)]
          const bonusAmount = 50
          if (resource === 'Oil') {
            usePlayerStore.getState().addResource('oil', bonusAmount, 'prospection_fallback')
          } else {
            usePlayerStore.getState().addResource('materialX', Math.floor(bonusAmount / 5), 'prospection_fallback')
          }
          msg += ` 🎉 Found ${resource}!`
        }
      }
    }
  }

  // Industrialist: scrap + matX bonuses on produce/enterprise
  const indLevel = skills.economic.industrialist || 0
  if (indLevel > 0) {
    // Scrap: 1% per level chance, 100-600 scrap
    const scrapChance = indLevel * 0.01
    if (Math.random() < scrapChance) {
      const scrapAmount = 100 + Math.floor(Math.random() * 501)
      usePlayerStore.getState().addResource('scrap', scrapAmount, 'industrialist_scrap')
      msg += ` 🔧 Industrialist found ${scrapAmount} scrap!`
    }
    // MatX: 1% per level chance, 20-80 matX
    const matXChance = indLevel * 0.01
    if (Math.random() < matXChance) {
      const matXAmount = 20 + Math.floor(Math.random() * 61)
      usePlayerStore.getState().addResource('materialX', matXAmount, 'industrialist_matx')
      msg += ` ⚛️ Industrialist refined ${matXAmount} matX!`
    }
  }
  
  return msg
}



export const COMPANY_TEMPLATES: Record<CompanyType, CompanyTemplate> = {
  bitcoin_miner: {
    type: 'bitcoin_miner', label: 'Bitcoin Miner', icon: '₿', color: '#f59e0b',
    desc: 'Mines bitcoin and money each cycle. Higher levels = better odds.', produces: 'Money & ₿',
    buildCost: { money: 5000, bitcoin: 1 }, baseProductionMax: 100,
  },
  wheat_farm: {
    type: 'wheat_farm', label: 'Wheat Farm', icon: '🌾', color: '#facc15',
    desc: 'Produces raw Wheat used for bread.', produces: 'Wheat',
    buildCost: { money: 2000, bitcoin: 1 }, baseProductionMax: 80,
  },
  fish_farm: {
    type: 'fish_farm', label: 'Fish Farm', icon: '🐟', color: '#38bdf8',
    desc: 'Produces raw Fish used for sushi.', produces: 'Fish',
    buildCost: { money: 2500, bitcoin: 1 }, baseProductionMax: 80,
  },
  steak_farm: {
    type: 'steak_farm', label: 'Steak Farm', icon: '🥩', color: '#f87171',
    desc: 'Produces raw Steak used for wagyu.', produces: 'Steak',
    buildCost: { money: 3000, bitcoin: 1 }, baseProductionMax: 80,
  },
  bakery: {
    type: 'bakery', label: 'Bakery', icon: '🍞', color: '#fcd34d',
    desc: 'Converts 1 Wheat into 1 Bread.', produces: 'Bread',
    buildCost: { money: 5000, bitcoin: 1 }, baseProductionMax: 100,
  },
  sushi_bar: {
    type: 'sushi_bar', label: 'Sushi Bar', icon: '🍣', color: '#f472b6',
    desc: 'Converts 1 Fish into 1 Sushi.', produces: 'Sushi',
    buildCost: { money: 8000, bitcoin: 1 }, baseProductionMax: 100,
  },
  wagyu_grill: {
    type: 'wagyu_grill', label: 'Wagyu Grill', icon: '🍱', color: '#ef4444',
    desc: 'Converts 1 Steak into 1 Wagyu.', produces: 'Wagyu',
    buildCost: { money: 12000, bitcoin: 1 }, baseProductionMax: 100,
  },
  green_ammo_factory: {
    type: 'green_ammo_factory', label: 'Green Ammo Factory', icon: '🟢', color: '#22d38a',
    desc: 'Crafts Green Bullets (1 MatX + 1 PP = 1 Bullet). 10% chance for Red on full bar.', produces: 'Green Bullets',
    buildCost: { money: 10000, bitcoin: 1 }, baseProductionMax: 100,
  },
  blue_ammo_factory: {
    type: 'blue_ammo_factory', label: 'Blue Ammo Factory', icon: '🔵', color: '#3b82f6',
    desc: 'Crafts Blue Bullets (3 MatX + 3 PP = 1 Bullet). 10% chance for Red on full bar.', produces: 'Blue Bullets',
    buildCost: { money: 20000, bitcoin: 1 }, baseProductionMax: 120,
  },
  purple_ammo_factory: {
    type: 'purple_ammo_factory', label: 'Purple Ammo Factory', icon: '🟣', color: '#a855f7',
    desc: 'Crafts Purple Bullets (9 MatX + 9 PP = 1 Bullet). 10% chance for Red on full bar.', produces: 'Purple Bullets',
    buildCost: { money: 50000, bitcoin: 1 }, baseProductionMax: 150,
  },
  oil_refinery: {
    type: 'oil_refinery', label: 'Oil Refinery', icon: '🛢️', color: '#a855f7',
    desc: 'Refines crude oil. Essential for upgrades and fuel.', produces: 'Oil',
    buildCost: { money: 10000, bitcoin: 1 }, baseProductionMax: 100,
  },
  materialx_refiner: {
    type: 'materialx_refiner', label: 'MaterialX Refiner', icon: '⚛️', color: '#ec4899',
    desc: 'Refines raw MaterialX from deposits. Requires a deposit to operate.', produces: 'MaterialX',
    buildCost: { money: 15000, bitcoin: 1 }, baseProductionMax: 120,
  },
  prospection_center: {
    type: 'prospection_center', label: 'Prospection Center', icon: '⛏️', color: '#ef4444',
    desc: 'Spends ₿ to scan for deposits. Rewards country + citizen + businessman.', produces: 'Deposits',
    buildCost: { money: 25000, bitcoin: 1 }, baseProductionMax: 100,
  },
}

const BUILDABLE_TYPES: CompanyType[] = [
  'wheat_farm', 'fish_farm', 'steak_farm',
  'bakery', 'sushi_bar', 'wagyu_grill',
  'green_ammo_factory', 'blue_ammo_factory', 'purple_ammo_factory',
  'oil_refinery', 'materialx_refiner', 'bitcoin_miner', 'prospection_center'
]

export function getUpgradeCost(currentLevel: number) {
  return { bitcoin: 1 }
}

export const COMPANY_MAX_LEVEL = 7

export function getProductionBonus(level: number): number {
  return 0 // Company level does not add production bonus %
}

/** Get the full location-aware bonus for a company */
export function getLocationBonus(company: Company): number {
  const worldStore = useWorldStore.getState()
  const country = worldStore.getCountry(company.location)
  if (!country) return getProductionBonus(company.level)

  let bonus = getProductionBonus(company.level)

  // Add country conquered resource bonus
  bonus += getCountryResourceBonus(country.conqueredResources)

  // Add deposit bonus if there's an active deposit matching this company type
  const depositType = COMPANY_DEPOSIT_MAP[company.type]
  if (depositType) {
    const matchingDeposit = worldStore.deposits.find(
      d => d.countryCode === company.location && d.type === depositType && d.active
    )
    if (matchingDeposit) bonus += matchingDeposit.bonus
  }

  // Add citizen deposit bonus (10%) if player is citizen and country has any active deposit
  const player = usePlayerStore.getState()
  if (player.country === company.location && country.activeDepositBonus) {
    bonus += country.activeDepositBonus.bonus
  }

  return bonus
}



export interface CompanyState {
  companies: Company[]
  deposits: DepositEvent[]
  jobs: JobListing[]
  transactions: CompanyTransaction[]
  activeJobId: string | null

  fetchAll: () => Promise<void>
  buildCompany: (type: CompanyType) => Promise<boolean>
  upgradeCompany: (companyId: string) => Promise<boolean>
  moveCompany: (companyId: string, newCountryCode: string) => Promise<boolean>
  doEnterprise: (companyId: string) => Promise<{ message: string, type: string } | null>
  produceCompany: (companyId: string) => Promise<{ message: string, type: string } | null>
  collectAll: () => Promise<{ collected: number; messages: string[] }>
  doWork: () => Promise<{ message: string, type: string, cashFound?: number } | null>
  setActiveJob: (jobId: string | null) => void
  postJob: (companyId: string, payPerPP: number) => Promise<boolean>
  removeJob: (companyId: string) => Promise<void>
  prospect: (companyId: string) => Promise<DepositEvent | null>
  getBuildableTypes: () => CompanyType[]
  processTick: () => void
  nukeCountry: (targetCountryCode: string) => number
  processMaintenanceTick: () => void
}

let companyCounter = 2

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [
    { id: 'comp-1', type: 'bitcoin_miner', level: 1, autoProduction: true, productionProgress: 0, productionMax: 100, location: 'US' },
    { id: 'comp-2', type: 'wheat_farm', level: 1, autoProduction: true, productionProgress: 0, productionMax: 80, location: 'US' },
  ],

  deposits: [],
  // Only player-posted jobs appear here — no NPC employers
  jobs: [],
  transactions: [],
  activeJobId: null,

  fetchAll: async () => {
    try {
      const res = await api.get<{ companies: Company[], transactions: CompanyTransaction[] }>('/company/my-companies')
      const jobsRes = await api.get<{ jobs: JobListing[] }>('/company/jobs')
      set({ 
        companies: res.companies || [], 
        transactions: res.transactions || [],
        jobs: jobsRes.jobs || []
      })
    } catch (err) {
      console.error('Failed to fetch companies', err)
    }
  },

  getBuildableTypes: () => BUILDABLE_TYPES,
  setActiveJob: (jobId) => set({ activeJobId: jobId }),

  buildCompany: async (type) => {
    const template = COMPANY_TEMPLATES[type]
    const player = usePlayerStore.getState()

    if (player.money < template.buildCost.money || player.bitcoin < template.buildCost.bitcoin) {
      return false
    }

    // Spend resources first
    player.spendMoney(template.buildCost.money)
    if (!usePlayerStore.getState().spendBitcoin(template.buildCost.bitcoin)) return false

    // Try API; fall back to local creation if unavailable
    const res = await api.post<{ success: boolean, company: Company }>('/company/create', { type }).catch(() => null)

    const newComp: Company = (res && res.success && res.company)
      ? res.company
      : {
          id: `comp-${++companyCounter}-${Date.now()}`,
          type,
          level: 1,
          autoProduction: false,
          productionProgress: 0,
          productionMax: template.baseProductionMax,
          location: player.countryCode || 'US',
        }

    set((s) => ({ companies: [...s.companies, newComp] }))
    usePlayerStore.setState((s) => ({ companiesOwned: s.companiesOwned + 1 }))
    return true
  },

  upgradeCompany: async (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return false
    if (company.level >= COMPANY_MAX_LEVEL) return false

    const cost = getUpgradeCost(company.level)
    const player = usePlayerStore.getState()

    if (player.bitcoin < cost.bitcoin) {
      return false
    }

    const res = await api.post<{ success: boolean }>('/company/upgrade', { companyId }).catch(() => null)
    if (!res || !res.success) return false

    usePlayerStore.setState((s) => ({
      bitcoin: s.bitcoin - cost.bitcoin,
    }))

    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId
          ? { ...c, level: c.level + 1, autoProduction: true }
          : c
      ),
    }))
    return true
  },

  moveCompany: async (companyId, newCountryCode) => {
    const state = get()
    const company = state.companies.find(c => c.id === companyId)
    if (!company) return false

    const player = usePlayerStore.getState()
    const moveCost = 500
    if (player.money < moveCost) return false

    const res = await api.post<{ success: boolean }>('/company/move', { companyId, newLocation: newCountryCode }).catch(() => null)
    if (!res || !res.success) return false

    player.spendMoney(moveCost)
    set(s => ({
      companies: s.companies.map(c =>
        c.id === companyId ? { ...c, location: newCountryCode } : c
      ),
      jobs: s.jobs.map(j => 
        j.companyId === companyId ? { ...j, location: newCountryCode } : j
      )
    }))
    return true
  },

  postJob: async (companyId, payPerPP) => {
    const state = get()
    const company = state.companies.find(c => c.id === companyId)
    if (!company || company.type === 'prospection_center') return false

    let res;
    try {
      res = await api.post<{ success: boolean, job: JobListing }>('/company/post-job', { companyId, payPerPP })
    } catch (e) {
      return false;
    }

    if (!res || !res.success || !res.job) return false

    // Remove any existing job for this company
    const filtered = state.jobs.filter(j => j.companyId !== companyId)

    set({ jobs: [...filtered, res.job] })
    return true
  },

  removeJob: async (companyId) => {
    await api.post('/company/remove-job', { companyId }).catch(() => {})
    set(s => ({ jobs: s.jobs.filter(j => j.companyId !== companyId) }))
  },

  /** Enterprise: owner works on their OWN company to fill its production bar */
  doEnterprise: async (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return null

    let res;
    try {
      res = await api.post<{ success: boolean, contribution: number, message: string }>('/company/enterprise', { companyId })
    } catch (error: any) {
      return { message: error.message || 'Enterprise failed.', type: 'error' }
    }

    if (!res || !res.success) return { message: 'Enterprise failed.', type: 'error' }

    const player = usePlayerStore.getState()
    if (Math.floor(player.entrepreneurship) < 10) return { message: 'Not enough enterprise points (10 required).', type: 'error' }

    usePlayerStore.setState((s) => ({
      entrepreneurship: Math.max(0, s.entrepreneurship - 10),
      specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
    }))

    let fill = res.contribution

    // Enterprise skill: 1% per level chance for double PP
    const entLevel = useSkillsStore.getState().economic.entrepreneurship || 0
    const doubleChance = entLevel * 0.01
    let isDouble = false
    if (doubleChance > 0 && Math.random() < doubleChance) {
      fill *= 2
      isDouble = true
    }

    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId
          ? { ...c, productionProgress: c.productionProgress + fill }
          : c
      ),
    }))

    usePlayerStore.getState().gainXP(10)
    const bonusMsg = triggerEconomicModifiers('enterprise')
    const doubleMsg = isDouble ? ' ⚡ DOUBLE PP!' : ''

    return { 
      message: `+${Math.floor(fill)} production${doubleMsg}${bonusMsg}`,
      type: 'enterprise' 
    }
  },

  /** Produce: can be clicked any time points are > 0 (now fully server-authoritative) */
  produceCompany: async (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company || company.productionProgress <= 0) return null

    const res = await api.post<{ success: boolean, message?: string }>('/company/produce', { companyId }).catch((e) => e)
    if (!res || !res.success) {
      const errorMsg = (res as any)?.response?.data?.error || res?.message || 'Production failed. Missing resources?'
      return { message: errorMsg, type: 'error' }
    }

    // Backend updated everything. Just fetch to re-sync!
    await usePlayerStore.getState().fetchPlayer()
    await state.fetchAll()

    const bonusMsg = triggerEconomicModifiers('produce')
    const finalMessage = (res.message || 'Produced goods!') + bonusMsg

    const tx: CompanyTransaction = {
      id: `tx-${Date.now()}`,
      message: `${COMPANY_TEMPLATES[company.type].label}: ${finalMessage}`,
      timestamp: Date.now()
    }
    set(s => ({ transactions: [tx, ...s.transactions].slice(0, 50) }))

    return { message: finalMessage, type: 'produce' }
  },

  /** Work: worker works on their active job */
  doWork: async () => {
    const state = get()
    if (!state.activeJobId) return { message: 'No active job selected', type: 'error' }
    
    const job = state.jobs.find((j) => j.id === state.activeJobId)
    if (!job) return { message: 'Invalid job', type: 'error' }

    let res;
    try {
      res = await api.post<{ success: boolean, netPay: number, contribution: number, employerCost: number, message: string }>('/company/work', { jobId: state.activeJobId })
    } catch (error: any) {
      return { message: error.message || 'Failed to work. Network error or rejected.', type: 'error' }
    }

    if (!res || !res.success) return { message: 'Failed to work. Network error or rejected.', type: 'error' }

    const player = usePlayerStore.getState()
    if (Math.floor(player.work) < 10) return { message: 'Not enough work points (10 required).', type: 'error' }
    
    // The backend handles money deduction, addition, taxation, and work points.
    // We just need to sync the local player store and potentially the employer company if we own it.
    
    usePlayerStore.setState((s) => ({
      work: Math.max(0, s.work - 10),
      specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
    }))
    // Apply Economic Theory research bonus to work earnings
    const { useResearchStore } = await import('./researchStore')
    const ecoBonuses = useResearchStore.getState().getEconomyBonuses(player.countryCode || 'US')
    let boostedPay = Math.floor(res.netPay * ecoBonuses.workEarningsBonus * ecoBonuses.allEconomyBonus)

    // Work skill: 1% per level chance for double pay
    const workLevel = useSkillsStore.getState().economic.work || 0
    const doubleChance = workLevel * 0.01
    let isDouble = false
    if (doubleChance > 0 && Math.random() < doubleChance) {
      boostedPay *= 2
      isDouble = true
    }

    // Add contribution to the employer's company production (if it's a player company and local player owns it)
    const employerCompany = state.companies.find(c => c.id === job.companyId)
    
    usePlayerStore.getState().earnMoney(boostedPay)
    player.gainXP(8)

    if (employerCompany) {
      set(s => ({
        companies: s.companies.map(c =>
          c.id === job.companyId
            ? { ...c, productionProgress: c.productionProgress + res.contribution }
            : c
        )
      }))
      
      // Since we own the company, we must also deduct the employer's money locally to stay in sync
      usePlayerStore.getState().spendMoney(res.employerCost)
    }

    const bonusMsg = triggerEconomicModifiers('work')
    const doubleMsg = isDouble ? ' ⚡ DOUBLE PAY!' : ''

    return {
      message: res.message + doubleMsg + bonusMsg,
      type: 'work',
      cashFound: boostedPay
    }
  },

  prospect: async (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company || company.type !== 'prospection_center') return null

    const player = usePlayerStore.getState()
    if (player.bitcoin < 1) return null
    if (player.stamina < 10) return null

    // Spend resources BEFORE async call to prevent race conditions
    if (!usePlayerStore.getState().spendBitcoin(1)) return null
    player.consumeBar('stamina', 10)

    const res = await api.post<{ success: boolean, deposit: any }>('/company/prospect', { companyId }).catch(() => null)
    if (!res || !res.success) {
      // Refund on failure
      usePlayerStore.getState().addResource('bitcoin', 1, 'prospect_refund')
      usePlayerStore.setState(s => ({ stamina: s.stamina + 10 }))
      return null
    }

    // Get prospection skill level for bonus chance
    const skills = useSkillsStore.getState()
    const prospectionLevel = skills.economic.prospection || 0

    // Base chance from company level (2% per level) + prospection skill bonus (2% per level)
    const chance = company.level * 0.02 + prospectionLevel * 0.02
    const found = Math.random() < chance

    if (found) {
      // Try to find an undiscovered world deposit (preferring player's country)
      const worldState = useWorldStore.getState()
      const undiscovered = worldState.deposits.filter(d => !d.discoveredBy)
      const inCountry = undiscovered.filter(d => d.countryCode === player.countryCode)
      const deposit = inCountry.length > 0
        ? inCountry[Math.floor(Math.random() * inCountry.length)]
        : undiscovered.length > 0
          ? undiscovered[Math.floor(Math.random() * undiscovered.length)]
          : null

      const btcReward = 5
      const oilReward = (2875 + Math.floor(Math.random() * 1113)) * company.level   // (2875-3987) × level
      const matXReward = (78 + Math.floor(Math.random() * 282)) * company.level      // (78-359) × level
      const cashReward = (4597 + Math.floor(Math.random() * 1991)) * company.level   // (4597-6587) × level
      usePlayerStore.getState().addResource('bitcoin', btcReward, 'prospection_reward')
      usePlayerStore.getState().earnMoney(cashReward)

      if (deposit) {
        // Discover the deposit in worldStore (region assignment, bonus, expiry all handled)
        worldState.discoverDeposit(deposit.id, player.name)
        if (deposit.type === 'materialx') {
          usePlayerStore.getState().addResource('materialX', matXReward, 'prospection_reward')
        } else {
          usePlayerStore.getState().addResource(deposit.type, oilReward, 'prospection_reward')
        }

        const localDeposit: DepositEvent = {
          id: deposit.id,
          resource: deposit.type === 'oil' ? 'Oil' : 'MaterialX',
          country: player.country,
          bitcoinReward: btcReward,
          timestamp: Date.now(),
        }
        set((s) => ({ deposits: [...s.deposits, localDeposit] }))
      } else {
        // Fallback: no undiscovered deposits left, just give resources
        const resources: Array<'Oil' | 'MaterialX'> = ['Oil', 'MaterialX']
        const resource = resources[Math.floor(Math.random() * resources.length)]
        if (resource === 'Oil') {
          usePlayerStore.getState().addResource('oil', oilReward, 'prospection_reward')
        } else {
          usePlayerStore.getState().addResource('materialX', matXReward, 'prospection_reward')
        }
        const localDeposit: DepositEvent = {
          id: `dep-${Date.now()}`,
          resource: 'Oil',
          country: player.country,
          bitcoinReward: btcReward,
          timestamp: Date.now(),
        }
        set((s) => ({ deposits: [...s.deposits, localDeposit] }))
      }

      player.gainXP(100)
      return { id: `dep-${Date.now()}`, resource: 'Oil' as const, country: player.country, bitcoinReward: btcReward, timestamp: Date.now() }
    }

    player.gainXP(15)
    return null
  },

  processTick: () => {
    // Regenerate player bars
    usePlayerStore.getState().regenerateBars()

    // Add production points to companies
    set(s => ({
      companies: s.companies.map(c => {
        if (c.type === 'prospection_center') return c
        // Skip disabled companies
        if (c.disabledUntil && Date.now() < c.disabledUntil) return c
        
        const effectiveLevel = Math.min(6, c.level)
        const bonus = getLocationBonus(c)
        // Apply Economic Theory research bonus to production
        const player = usePlayerStore.getState()
        const ecoBonuses = useResearchStore.getState().getEconomyBonuses(player.countryCode || 'US')
        const pointsGenerated = effectiveLevel * (1 + bonus / 100) * ecoBonuses.productionBonus
        
        return {
          ...c,
          productionProgress: c.productionProgress + pointsGenerated
        }
      })
    }))

    // Auto-collect for level 5+ companies — eco players can forget about limits
    const state = get()
    for (const company of state.companies) {
      if (company.type === 'prospection_center') continue
      if (company.level < 5) continue
      if (company.productionProgress <= 0) continue
      get().produceCompany(company.id)
    }
  },

  nukeCountry: (targetCountryCode: string) => {
    const state = get()
    const targetCompanies = state.companies.filter(c => c.location === targetCountryCode)
    if (targetCompanies.length === 0) return 0

    // Disable 50% of companies randomly
    const shuffled = [...targetCompanies].sort(() => Math.random() - 0.5)
    const toDisable = shuffled.slice(0, Math.ceil(shuffled.length / 2))
    const disableIds = new Set(toDisable.map(c => c.id))
    const disableUntil = Date.now() + 24 * 60 * 60 * 1000 // 24 hours

    set({
      companies: state.companies.map(c =>
        disableIds.has(c.id)
          ? { ...c, disabledUntil: disableUntil }
          : c
      )
    })

    return toDisable.length
  },

  processMaintenanceTick: () => {
    // Maintenance removed — no-op
  },

  collectAll: async () => {
    const state = get()
    const messages: string[] = []
    let collected = 0

    // Produce all owned companies (skip prospectors and empty ones)
    for (const company of state.companies) {
      if (company.type === 'prospection_center') continue
      if (company.productionProgress <= 0) continue

      const result = await get().produceCompany(company.id)
      if (result && result.type !== 'error') {
        collected++
        messages.push(result.message)
      }
    }

    return { collected, messages }
  },
}))
