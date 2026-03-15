import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useWorldStore, getCountryResourceBonus, type DepositType } from './worldStore'

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
  location: string // Country ISO code
  disabledUntil?: number // Timestamp when company becomes active again (nuke effect)
}

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

const triggerEconomicModifiers = (): string => {
  const skills = useSkillsStore.getState()
  const worldStore = useWorldStore.getState()
  let msg = ''
  
  // Prospection (5% per level) – discover a regional deposit
  const prospChance = skills.economic.prospection * 0.05
  if (Math.random() < prospChance) {
    const undiscovered = worldStore.deposits.filter(d => !d.discoveredBy)
    if (undiscovered.length > 0) {
      const deposit = undiscovered[Math.floor(Math.random() * undiscovered.length)]
      const player = usePlayerStore.getState()
      
      // Reward: 100-166 items, 3 BTC, $100-166
      const itemAmount = 100 + Math.floor(Math.random() * 67)
      const cashAmount = 100 + Math.floor(Math.random() * 67)
      
      // Grant items based on deposit type
      switch (deposit.type) {
        case 'wheat': usePlayerStore.setState(s => ({ wheat: s.wheat + itemAmount })); break
        case 'fish': usePlayerStore.setState(s => ({ fish: s.fish + itemAmount })); break
        case 'steak': usePlayerStore.setState(s => ({ steak: s.steak + itemAmount })); break
        case 'oil': usePlayerStore.setState(s => ({ oil: s.oil + itemAmount })); break
        case 'materialx': usePlayerStore.setState(s => ({ materialX: s.materialX + itemAmount })); break
      }
      usePlayerStore.setState(s => ({ bitcoin: s.bitcoin + 3, money: s.money + cashAmount }))
      
      // Discover it in worldStore
      worldStore.discoverDeposit(deposit.id, player.name)
      
      const country = worldStore.getCountry(deposit.countryCode)
      msg += ` 🎉 Discovered ${deposit.type} deposit in ${country?.name || deposit.countryCode}! +${itemAmount} ${deposit.type}, +3₿, +$${cashAmount}`
    } else {
      // Fallback: small resource bonus
      const resources: Array<'Oil' | 'MaterialX'> = ['Oil', 'MaterialX']
      const resource = resources[Math.floor(Math.random() * resources.length)]
      const bonusAmount = 50
      if (resource === 'Oil') {
        usePlayerStore.setState((s) => ({ oil: s.oil + bonusAmount }))
      } else {
        usePlayerStore.setState((s) => ({ materialX: s.materialX + Math.floor(bonusAmount / 5) }))
      }
      msg += ` 🎉 Found ${resource}!`
    }
  }

  // Industrialist (5% per level)
  const indChance = skills.economic.industrialist * 0.05
  if (Math.random() < indChance) {
    usePlayerStore.setState((s) => ({ bitcoin: s.bitcoin + 1 }))
    msg += ` ₿ Found Bitcoin!`
  }
  
  return msg
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

  // Add deposit bonus (30%) if there's an active deposit matching this company type
  const depositType = COMPANY_DEPOSIT_MAP[company.type]
  if (depositType) {
    const hasDeposit = worldStore.deposits.some(
      d => d.countryCode === company.location && d.type === depositType && d.active
    )
    if (hasDeposit) bonus += 30
  }

  // Add citizen deposit bonus (10%) if player is citizen and country has any active deposit
  const player = usePlayerStore.getState()
  if (player.country === company.location && country.activeDepositBonus) {
    bonus += country.activeDepositBonus.bonus
  }

  return bonus
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
  companyId: string       // Links to a real company
  employerName: string
  companyType: CompanyType
  companyLevel: number
  payPerPP: number        // Payment per Production Point
  productionBonus: number
  location: string        // Country ISO code
}

const MOCK_JOBS: JobListing[] = [
  { id: 'job-1', companyId: 'npc-1', employerName: 'AgriCorp', companyType: 'wheat_farm', companyLevel: 3, payPerPP: 2.0, productionBonus: 15, location: 'US' },
  { id: 'job-2', companyId: 'npc-2', employerName: 'PetroMax', companyType: 'oil_refinery', companyLevel: 2, payPerPP: 3.0, productionBonus: 10, location: 'RU' },
  { id: 'job-3', companyId: 'npc-3', employerName: 'SushiTown', companyType: 'sushi_bar', companyLevel: 4, payPerPP: 2.5, productionBonus: 20, location: 'JP' },
  { id: 'job-4', companyId: 'npc-4', employerName: 'RefineX Labs', companyType: 'materialx_refiner', companyLevel: 2, payPerPP: 4.0, productionBonus: 10, location: 'DE' },
  { id: 'job-5', companyId: 'npc-5', employerName: 'MegaMeats', companyType: 'steak_farm', companyLevel: 5, payPerPP: 2.0, productionBonus: 25, location: 'BR' },
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
  moveCompany: (companyId: string, newCountryCode: string) => boolean
  doEnterprise: (companyId: string) => { message: string, type: string } | null
  produceCompany: (companyId: string) => { message: string, type: string } | null
  doWork: () => { message: string, type: string, cashFound?: number } | null
  setActiveJob: (jobId: string | null) => void
  postJob: (companyId: string, payPerPP: number) => boolean
  removeJob: (companyId: string) => void
  prospect: (companyId: string) => DepositEvent | null
  getBuildableTypes: () => CompanyType[]
  processTick: () => void
  nukeCountry: (targetCountryCode: string) => number
}

let companyCounter = 2

export const useCompanyStore = create<CompanyState>((set, get) => ({
  companies: [
    { id: 'comp-1', type: 'bitcoin_miner', level: 1, autoProduction: true, productionProgress: 0, productionMax: 100, location: 'US' },
    { id: 'comp-2', type: 'wheat_farm', level: 1, autoProduction: true, productionProgress: 0, productionMax: 80, location: 'US' },
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
      autoProduction: true,
      productionProgress: 0,
      productionMax: template.baseProductionMax,
      location: player.country, // Defaults to player's country
    }

    set((s) => ({ companies: [...s.companies, newComp] }))
    usePlayerStore.setState((s) => ({ companiesOwned: s.companiesOwned + 1 }))
    return true
  },

  upgradeCompany: (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company) return false
    if (company.level >= COMPANY_MAX_LEVEL) return false

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
          ? { ...c, level: c.level + 1, autoProduction: true }
          : c
      ),
    }))
    return true
  },

  moveCompany: (companyId, newCountryCode) => {
    const state = get()
    const company = state.companies.find(c => c.id === companyId)
    if (!company) return false

    const player = usePlayerStore.getState()
    const moveCost = 500
    if (player.money < moveCost) return false

    player.spendMoney(moveCost)
    set(s => ({
      companies: s.companies.map(c =>
        c.id === companyId ? { ...c, location: newCountryCode } : c
      ),
    }))
    return true
  },

  postJob: (companyId, payPerPP) => {
    const state = get()
    const company = state.companies.find(c => c.id === companyId)
    if (!company || company.type === 'prospection_center') return false

    // Remove any existing job for this company
    const filtered = state.jobs.filter(j => j.companyId !== companyId)

    const player = usePlayerStore.getState()
    const template = COMPANY_TEMPLATES[company.type]
    const bonus = getLocationBonus(company)

    const newJob: JobListing = {
      id: `job-player-${Date.now()}`,
      companyId: company.id,
      employerName: player.name,
      companyType: company.type,
      companyLevel: company.level,
      payPerPP,
      productionBonus: bonus,
      location: company.location,
    }

    set({ jobs: [...filtered, newJob] })
    return true
  },

  removeJob: (companyId) => {
    set(s => ({ jobs: s.jobs.filter(j => j.companyId !== companyId) }))
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
    const prodSkill = skills.economic.production

    // Production input = base + skill variance
    const prodInput = getProductionContribution(prodSkill, company.level)
    const bonus = getLocationBonus(company)
    const fill = prodInput * (1 + bonus / 100)

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
    const bonusMsg = triggerEconomicModifiers()

    return { 
      message: `+${Math.floor(fill)} production (${bonus}% bonus)${bonusMsg}`,
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
    const bonus = getLocationBonus(company)

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

    const bonusMsg = triggerEconomicModifiers()
    result += bonusMsg

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
    const prodSkill = skills.economic.production

    // Production input = base + skill variance
    const prodInput = getProductionContribution(prodSkill, job.companyLevel)
    const contribution = Math.floor(prodInput * (1 + job.productionBonus / 100))

    // Pay = contribution * payPerPP
    const grossPay = Math.floor(contribution * job.payPerPP)
    const totalTax = Math.floor(grossPay * TAX_RATE)
    const employeeTax = Math.floor(totalTax / 2)
    const employerTax = totalTax - employeeTax
    const netPay = grossPay - employeeTax

    // Consume work bar, give net pay to employee
    usePlayerStore.setState((s) => ({
      work: Math.max(0, s.work - 10),
      money: s.money + netPay,
      specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
    }))

    // Send tax to country treasury
    useWorldStore.getState().addTreasuryTax(job.location, totalTax)

    // Add contribution to the employer's company production (if it's a player company)
    const employerCompany = state.companies.find(c => c.id === job.companyId)
    if (employerCompany) {
      set(s => ({
        companies: s.companies.map(c =>
          c.id === job.companyId
            ? { ...c, productionProgress: c.productionProgress + contribution }
            : c
        )
      }))
    }

    const bonusMsg = triggerEconomicModifiers()

    player.gainXP(8)
    return {
      message: `+$${netPay} pay (${contribution}PP × $${job.payPerPP}/PP, Tax: $${totalTax})${bonusMsg}`,
      type: 'work',
      cashFound: netPay
    }
  },

  prospect: (companyId) => {
    const state = get()
    const company = state.companies.find((c) => c.id === companyId)
    if (!company || company.type !== 'prospection_center') return null

    const player = usePlayerStore.getState()
    if (player.bitcoin < 1) return null
    if (player.stamina < 10) return null

    // Spend resources
    usePlayerStore.setState({ bitcoin: player.bitcoin - 1 })
    player.consumeBar('stamina', 10)

    // Get prospection skill level for bonus chance
    const skills = useSkillsStore.getState()
    const prospectionLevel = skills.economic.prospection || 0

    // Base chance from company level + prospection skill bonus (5% per level)
    const chance = 0.10 + company.level * 0.05 + prospectionLevel * 0.05
    const found = Math.random() < chance

    if (found) {
      const resources: Array<'Oil' | 'MaterialX'> = ['Oil', 'MaterialX']
      const resource = resources[Math.floor(Math.random() * resources.length)]
      const btcReward = 3 + company.level * 2

      usePlayerStore.setState((s) => ({
        bitcoin: s.bitcoin + btcReward,
        money: s.money + 5000,
      }))

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
        if (c.type === 'prospection_center') return c
        // Skip disabled companies
        if (c.disabledUntil && Date.now() < c.disabledUntil) return c
        
        const effectiveLevel = Math.min(6, c.level)
        const bonus = getLocationBonus(c)
        const pointsGenerated = effectiveLevel * (1 + bonus / 100)
        
        return {
          ...c,
          productionProgress: c.productionProgress + pointsGenerated
        }
      })
    }))
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
  }
}))
