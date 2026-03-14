import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useSkillsStore } from './skillsStore'

export type CompanyType = 
  | 'bitcoin_miner' 
  | 'wheat_farm' | 'fish_farm' | 'steak_farm'
  | 'bakery' | 'sushi_bar' | 'wagyu_grill'
  | 'green_ammo_factory' | 'blue_ammo_factory' | 'purple_ammo_factory'
  | 'oil_refinery' | 'materialx_refiner' | 'prospection_center'

export interface Company {
  id: string
  type: CompanyType
  level: number
  autoProduction: boolean
  productionProgress: number
  productionMax: number
}

export interface CompanyTemplate {
  type: CompanyType
  label: string
  icon: string
  color: string
  desc: string
  produces: string
  buildCost: { money: number; bitcoin: number }
  baseProductionMax: number
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
    desc: 'Converts 10 Wheat into 1 Bread.', produces: 'Bread',
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
    desc: 'Spends ₿ to scan for MaterialX & Oil deposits. Rewards country + citizen + businessman.', produces: 'Deposits',
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

export function getProductionBonus(level: number): number {
  return level * 5
}

export interface DepositEvent {
  id: string
  resource: 'Oil' | 'MaterialX'
  country: string
  bitcoinReward: number
  timestamp: number
}

export interface JobListing {
  id: string
  employerName: string
  companyType: CompanyType
  companyLevel: number
  payPerWork: number
  productionBonus: number
}

const MOCK_JOBS: JobListing[] = [
  { id: 'job-1', employerName: 'AgriCorp', companyType: 'wheat_farm', companyLevel: 3, payPerWork: 120, productionBonus: 15 },
  { id: 'job-2', employerName: 'PetroMax', companyType: 'oil_refinery', companyLevel: 2, payPerWork: 200, productionBonus: 10 },
  { id: 'job-3', employerName: 'SushiTown', companyType: 'sushi_bar', companyLevel: 4, payPerWork: 150, productionBonus: 20 },
  { id: 'job-4', employerName: 'RefineX Labs', companyType: 'materialx_refiner', companyLevel: 2, payPerWork: 250, productionBonus: 10 },
  { id: 'job-5', employerName: 'MegaMeats', companyType: 'steak_farm', companyLevel: 5, payPerWork: 180, productionBonus: 25 },
]

export interface CompanyTransaction {
  id: string
  message: string
  timestamp: number
}

export interface CompanyState {
  companies: Company[]
  deposits: DepositEvent[]
  jobs: JobListing[]
  transactions: CompanyTransaction[]
  activeJobId: string | null

  buildCompany: (type: CompanyType) => boolean
  upgradeCompany: (companyId: string) => boolean
  doEnterprise: (companyId: string) => { message: string, type: string } | null
  produceCompany: (companyId: string) => { message: string, type: string } | null
  doWork: () => { message: string, type: string, cashFound?: number } | null
  setActiveJob: (jobId: string | null) => void
  prospect: (companyId: string) => DepositEvent | null
  getBuildableTypes: () => CompanyType[]
  processTick: () => void
}

let companyCounter = 2

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [
    { id: 'comp-1', type: 'bitcoin_miner', level: 1, autoProduction: false, productionProgress: 0, productionMax: 100 },
    { id: 'comp-2', type: 'wheat_farm', level: 1, autoProduction: false, productionProgress: 0, productionMax: 80 },
  ],

  deposits: [],
  jobs: MOCK_JOBS,
  transactions: [],
  activeJobId: null,

  getBuildableTypes: () => BUILDABLE_TYPES,
  setActiveJob: (jobId) => set({ activeJobId: jobId }),

  buildCompany: (type) => {
    const template = COMPANY_TEMPLATES[type]
    const player = usePlayerStore.getState()

    if (player.money < template.buildCost.money || player.bitcoin < template.buildCost.bitcoin) {
      return false
    }

    player.spendMoney(template.buildCost.money)
    usePlayerStore.setState(s => ({ bitcoin: s.bitcoin - template.buildCost.bitcoin }))

    const newComp: Company = {
      id: `comp-${++companyCounter}-${Date.now()}`,
      type,
      level: 1,
      autoProduction: false,
      productionProgress: 0,
      productionMax: template.baseProductionMax,
    }

    set((s) => ({ companies: [...s.companies, newComp] }))
    usePlayerStore.setState((s) => ({ companiesOwned: s.companiesOwned + 1 }))
    return true
  },

  upgradeCompany: (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return false

    const cost = getUpgradeCost(company.level)
    const player = usePlayerStore.getState()

    if (player.bitcoin < cost.bitcoin) {
      return false
    }

    usePlayerStore.setState((s) => ({
      bitcoin: s.bitcoin - cost.bitcoin,
    }))

    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId
          ? { ...c, level: c.level + 1, autoProduction: c.level + 1 >= 3 }
          : c
      ),
    }))
    return true
  },

  /** Enterprise: owner works on their OWN company to fill its production bar */
  doEnterprise: (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return null
    if (company.type === 'prospection_center') return null

    const player = usePlayerStore.getState()
    if (player.entrepreneurship <= 0) return { message: 'No entrepreneurship points left', type: 'error' }

    const skills = useSkillsStore.getState()
    const entSkill = skills.economic.entrepreneurship
    const prodSkill = skills.economic.production

    // Base fill = 20 + entrepreneurship skill bonus + production skill bonus
    const bonus = getProductionBonus(company.level)
    const fill = (20 + entSkill * 2 + prodSkill) * (1 + bonus / 100)

    usePlayerStore.setState((s) => ({
      entrepreneurship: Math.max(0, s.entrepreneurship - 10),
      specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
    }))

    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId
          ? { ...c, productionProgress: c.productionProgress + fill }
          : c
      ),
    }))

    player.gainXP(10)
    return { 
      message: `+${Math.floor(fill)} production (${bonus}% bonus)`,
      type: 'enterprise' 
    }
  },

  /** Produce: can be clicked any time points are > 0 */
  produceCompany: (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company || company.productionProgress <= 0) return null

    const points = company.productionProgress
    const player = usePlayerStore.getState()
    const bonus = getProductionBonus(company.level)

    let result = ''
    let usedPoints = points

    switch (company.type) {
      case 'bitcoin_miner': {
        const moneyEarned = Math.floor(points * (1 + bonus / 100))
        usePlayerStore.setState(s => ({ money: s.money + moneyEarned }))
        result = `+$${moneyEarned}`
        const btcChance = Math.min(0.05, 0.01 + (points * 0.00066))
        if (Math.random() < btcChance) {
          usePlayerStore.setState(s => ({ bitcoin: s.bitcoin + 1 }))
          result += ' & 1 ₿ bonus!'
        }
        break
      }
      case 'wheat_farm': {
        const output = Math.max(1, Math.floor(points * 0.5))
        usePlayerStore.setState(s => ({ wheat: s.wheat + output }))
        result = `+${output} Wheat`
        break
      }
      case 'fish_farm': {
        const output = Math.max(1, Math.floor(points * 0.5))
        usePlayerStore.setState(s => ({ fish: s.fish + output }))
        result = `+${output} Fish`
        break
      }
      case 'steak_farm': {
        const output = Math.max(1, Math.floor(points * 0.5))
        usePlayerStore.setState(s => ({ steak: s.steak + output }))
        result = `+${output} Steak`
        break
      }
      case 'bakery': {
        const affordable = Math.floor(player.wheat / 10)
        const possible = Math.max(1, Math.floor(points * 0.1))
        const count = Math.min(affordable, possible)
        if (count <= 0) return { message: 'Not enough Wheat (Need 10/Bread)', type: 'error' }
        usePlayerStore.setState(s => ({ wheat: s.wheat - 10 * count, bread: s.bread + count }))
        result = `+${count} Bread`
        usedPoints = (count === possible) ? points : count * 10
        break
      }
      case 'sushi_bar': {
        const affordable = Math.floor(player.fish / 1)
        const possible = Math.max(1, Math.floor(points * 0.1))
        const count = Math.min(affordable, possible)
        if (count <= 0) return { message: 'Not enough Fish (Need 1/Sushi)', type: 'error' }
        usePlayerStore.setState(s => ({ fish: s.fish - 1 * count, sushi: s.sushi + count }))
        result = `+${count} Sushi`
        usedPoints = (count === possible) ? points : count * 10
        break
      }
      case 'wagyu_grill': {
        const affordable = Math.floor(player.steak / 1)
        const possible = Math.max(1, Math.floor(points * 0.1))
        const count = Math.min(affordable, possible)
        if (count <= 0) return { message: 'Not enough Steak (Need 1/Wagyu)', type: 'error' }
        usePlayerStore.setState(s => ({ steak: s.steak - 1 * count, wagyu: s.wagyu + count }))
        result = `+${count} Wagyu`
        usedPoints = (count === possible) ? points : count * 10
        break
      }
      case 'green_ammo_factory': {
        const possible = Math.floor(points / 1)
        if (possible <= 0) return { message: 'Need at least 1 PP', type: 'error' }
        const count = Math.min(player.materialX, possible)
        if (count <= 0) return { message: 'Not enough MaterialX', type: 'error' }
        usePlayerStore.setState(s => ({ materialX: s.materialX - count, greenBullets: s.greenBullets + count }))
        result = `+${count} Green Bullets`
        usedPoints = count * 1
        if (points >= company.productionMax && Math.random() < 0.10) {
          usePlayerStore.setState(s => ({ redBullets: s.redBullets + 1 }))
          result += ' & 1 🔴 RED BULLET!'
        }
        break
      }
      case 'blue_ammo_factory': {
        const possible = Math.floor(points / 3)
        if (possible <= 0) return { message: 'Need at least 3 PP', type: 'error' }
        const count = Math.min(Math.floor(player.materialX / 3), possible)
        if (count <= 0) return { message: 'Not enough MaterialX', type: 'error' }
        usePlayerStore.setState(s => ({ materialX: s.materialX - count * 3, blueBullets: s.blueBullets + count }))
        result = `+${count} Blue Bullets`
        usedPoints = count * 3
        if (points >= company.productionMax && Math.random() < 0.10) {
          usePlayerStore.setState(s => ({ redBullets: s.redBullets + 1 }))
          result += ' & 1 🔴 RED BULLET!'
        }
        break
      }
      case 'purple_ammo_factory': {
        const possible = Math.floor(points / 9)
        if (possible <= 0) return { message: 'Need at least 9 PP', type: 'error' }
        const count = Math.min(Math.floor(player.materialX / 9), possible)
        if (count <= 0) return { message: 'Not enough MaterialX', type: 'error' }
        usePlayerStore.setState(s => ({ materialX: s.materialX - count * 9, purpleBullets: s.purpleBullets + count }))
        result = `+${count} Purple Bullets`
        usedPoints = count * 9
        if (points >= company.productionMax && Math.random() < 0.10) {
          usePlayerStore.setState(s => ({ redBullets: s.redBullets + 1 }))
          result += ' & 1 🔴 RED BULLET!'
        }
        break
      }
      case 'oil_refinery': {
        const output = Math.max(1, Math.floor(points * 0.5))
        usePlayerStore.setState(s => ({ oil: s.oil + output }))
        result = `+${output} Oil`
        break
      }
      case 'materialx_refiner': {
        const output = Math.max(1, Math.floor(points * 0.25))
        usePlayerStore.setState(s => ({ materialX: s.materialX + output }))
        result = `+${output} MaterialX`
        break
      }
      default:
        return null
    }

    // Deduct used points
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId ? { ...c, productionProgress: Math.max(0, c.productionProgress - usedPoints) } : c
      ),
    }))

    usePlayerStore.setState((s) => ({
      itemsProduced: s.itemsProduced + 1
    }))
    player.gainXP(20)

    const tx: CompanyTransaction = {
      id: `tx-${Date.now()}`,
      message: `${COMPANY_TEMPLATES[company.type].label}: ${result}`,
      timestamp: Date.now()
    }
    set(s => ({ transactions: [tx, ...s.transactions].slice(0, 50) }))

    return { message: result, type: 'produce' }
  },

  /** Work: worker works on their active job */
  doWork: () => {
    const state = get()
    if (!state.activeJobId) return { message: 'No active job selected', type: 'error' }
    
    const job = state.jobs.find((j) => j.id === state.activeJobId)
    if (!job) return { message: 'Invalid job', type: 'error' }

    const player = usePlayerStore.getState()
    if (player.work <= 0) return { message: 'No work points left', type: 'error' }

    const skills = useSkillsStore.getState()
    const workSkill = skills.economic.work
    const prodSkill = skills.economic.production

    // Production contribution = base + worker skills + employer bonus
    const contribution = Math.floor((15 + workSkill * 2 + prodSkill) * (1 + job.productionBonus / 100))

    // Consume work bar
    usePlayerStore.setState((s) => ({
      work: Math.max(0, s.work - 10),
      money: s.money + job.payPerWork,
      specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
    }))

    // Prospection: chance to find deposit for country
    const prospSkill = skills.economic.prospection
    const prospChance = prospSkill * 0.02
    let depositMsg = ''
    if (Math.random() < prospChance) {
      const resources: Array<'Oil' | 'MaterialX'> = ['Oil', 'MaterialX']
      const resource = resources[Math.floor(Math.random() * resources.length)]
      const bonusAmount = 50
      if (resource === 'Oil') {
        usePlayerStore.setState((s) => ({ oil: s.oil + bonusAmount }))
      } else {
        usePlayerStore.setState((s) => ({ materialX: s.materialX + Math.floor(bonusAmount / 5) }))
      }
      depositMsg = ` 🎉 Found ${resource} deposit!`
    }

    player.gainXP(8)
    return {
      message: `+$${job.payPerWork} pay, +${contribution} contributed${depositMsg}`,
      type: 'work',
      cashFound: job.payPerWork
    }
  },

  prospect: (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company || company.type !== 'prospection_center') return null

    const player = usePlayerStore.getState()
    if (player.bitcoin < 1) return null

    usePlayerStore.setState({ bitcoin: player.bitcoin - 1 })

    const chance = 0.10 + company.level * 0.05
    const found = Math.random() < chance

    if (found) {
      // Only MaterialX and Oil deposits
      const resources: Array<'Oil' | 'MaterialX'> = ['Oil', 'MaterialX']
      const resource = resources[Math.floor(Math.random() * resources.length)]
      const btcReward = 3 + company.level * 2

      // Businessman jackpot
      usePlayerStore.setState((s) => ({
        bitcoin: s.bitcoin + btcReward,
        money: s.money + 5000,
      }))

      // Country + citizen bonus
      const bonusAmount = 100 * company.level
      if (resource === 'Oil') {
        usePlayerStore.setState((s) => ({ oil: s.oil + bonusAmount }))
      } else {
        usePlayerStore.setState((s) => ({ materialX: s.materialX + Math.floor(bonusAmount / 10) }))
      }

      const deposit: DepositEvent = {
        id: `dep-${Date.now()}`,
        resource,
        country: player.country,
        bitcoinReward: btcReward,
        timestamp: Date.now(),
      }

      set((s) => ({ deposits: [...s.deposits, deposit] }))
      player.gainXP(100)
      return deposit
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
        // Only normal producing companies gain points, prospection_center doesn't
        if (c.type === 'prospection_center') return c
        
        const effectiveLevel = Math.min(6, c.level)
        const bonus = getProductionBonus(c.level)
        const pointsGenerated = effectiveLevel * (1 + bonus / 100)
        
        return {
          ...c,
          productionProgress: c.productionProgress + pointsGenerated
        }
      })
    }))
  }
}))
