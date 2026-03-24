// ══════════════════════════════════════════════════════════════
// SIMULATOR — Core Types & Configuration
// ══════════════════════════════════════════════════════════════

import type { PlayerCombatStats, DivisionType } from './data'

// ── Simulation Configuration ──

export interface SimConfig {
  days: number              // How many game-days to simulate
  agentsPerCountry: number  // Agents spawned per active country
  ticksPerDay: number       // Combat ticks per day (economy ticks)
  countries: string[]       // ISO codes of active countries
  seed?: number             // RNG seed for reproducibility
  verbose: boolean          // Print per-day details
}

export const DEFAULT_CONFIG: SimConfig = {
  days: 100,
  agentsPerCountry: 3,
  ticksPerDay: 48,          // 1 tick every 30min = 48/day
  countries: ['US', 'RU', 'CN', 'DE', 'BR', 'IN', 'NG', 'JP', 'GB', 'TR'],
  verbose: false,
}

// ── Agent Types ──

export type AgentStrategy = 'war' | 'economy' | 'balanced'

export interface SimAgent {
  id: string
  name: string
  countryCode: string
  strategy: AgentStrategy
  level: number

  // Resources
  money: number
  oil: number
  materialX: number
  scrap: number
  bitcoin: number
  bread: number
  sushi: number
  wagyu: number
  wheat: number
  fish: number
  steak: number
  greenBullets: number
  blueBullets: number
  purpleBullets: number
  redBullets: number
  lootBoxes: number
  militaryBoxes: number
  badgesOfHonor: number
  magicTea: number

  // Bars (regen each tick)
  stamina: number
  maxStamina: number
  hunger: number
  maxHunger: number
  work: number
  maxWork: number
  entrepreneurship: number
  maxEntrepreneurship: number

  // Production
  productionBar: number
  productionBarMax: number
  companiesOwned: number

  // Combat stats (derived from skills)
  combatStats: PlayerCombatStats
  skills: { attack: number; critRate: number; critDamage: number; precision: number; armor: number; dodge: number; stamina: number; production: number; work: number; prospection: number; industrialist: number }

  // Divisions owned
  divisions: SimDivision[]

  // Tracking
  totalDamageDealt: number
  totalMoneyEarned: number
  totalMoneySpent: number
  totalItemsProduced: number
  totalDivisionsLost: number
  totalDivisionsRecruited: number
  totalBattlesWon: number
  totalBattlesLost: number
}

// ── Division (lightweight for sim) ──

export interface SimDivision {
  id: string
  type: DivisionType
  ownerId: string
  countryCode: string
  health: number
  maxHealth: number
  manpower: number
  maxManpower: number
  experience: number
  status: 'ready' | 'in_combat' | 'destroyed' | 'recovering'
  starModifiers: { atkDmgMult: number; hitRate: number; critRateMult: number; critDmgMult: number; healthMult: number; dodgeMult: number; armorMult: number; attackSpeed: number }
  killCount: number
  battlesSurvived: number
  dayRecruited: number
  totalDamageDealt: number
  upkeepPaid: number       // total oil+matX upkeep spent over lifetime
}

// ── Market Types ──

export interface SimMarketTicker {
  resourceId: string
  price: number
  basePrice: number
  priceHistory: number[]
  totalVolumeBuy: number
  totalVolumeSell: number
  recentBuyVolume: number
  recentSellVolume: number
}

export interface SimMarketOrder {
  id: string
  type: 'buy' | 'sell'
  resourceId: string
  amount: number
  pricePerUnit: number
  agentId: string
  countryCode: string
}

export interface SimTradeRecord {
  resourceId: string
  amount: number
  price: number
  buyerCountry: string
  sellerCountry: string
  day: number
}

// ── Stock Types ──

export interface SimStock {
  code: string
  price: number
  history: number[]
  fundamentalScore: number
}

// ── Country Economy ──

export interface SimCountry {
  code: string
  name: string
  population: number
  treasury: number
  oilReserves: number
  scrapReserves: number
  materialXReserves: number
  bitcoinReserves: number
  
  // Infra
  portLevel: number
  airportLevel: number
  bunkerLevel: number
  militaryBaseLevel: number

  // Tracking
  totalTaxCollected: number
  totalWarFundContributed: number
  totalWarFundReceived: number
  totalAutoIncome: number
  totalMilitarySpending: number
  totalInfraSpending: number
  divisionsKilled: number     // enemy divs this country killed
  divisionsLost: number       // own divs this country lost
}

// ── Battle Result ──

export interface SimBattleResult {
  attackerCountry: string
  defenderCountry: string
  winner: 'attacker' | 'defender' | 'draw'
  attackerDivsBefore: number
  defenderDivsBefore: number
  attackerDivsLost: number
  defenderDivsLost: number
  attackerDamageDealt: number
  defenderDamageDealt: number
  ticks: number
  divisionPerformance: Map<string, { type: DivisionType; damageDealt: number; survived: boolean; killCount: number }>
}

// ── Daily Metrics Snapshot ──

export interface DailyMetrics {
  day: number

  // Money Supply
  totalMoneySupply: number        // sum of all agent money + all country treasuries
  moneyCreatedToday: number       // faucets: work, production, war rewards, daily login
  moneyDestroyedToday: number     // sinks: division recruit, upkeep, company maintenance, market taxes, heal costs
  netMoneyFlow: number            // created - destroyed
  inflationRate: number           // % change in total money supply from previous day

  // Items
  itemsCreatedToday: number       // lootboxes opened, production
  itemsDestroyedToday: number     // dismantled, broken (0 durability)
  divisionsRecruited: number
  divisionsDestroyed: number

  // Market
  resourcePrices: Record<string, number>
  marketTradeVolume: number       // total trades today
  marketTaxCollected: number      // 1% tax on all trades

  // Stocks
  stockPrices: Record<string, number>
  bondPayoutsToday: number
  bondLossesToday: number

  // Country Treasuries
  countryTreasuries: Record<string, number>
  warFundPool: number
  warFundDistributed: number

  // Combat
  battlesToday: number
  divisionKillsByType: Record<string, number>   // type → kills
  divisionDeathsByType: Record<string, number>  // type → deaths
  divisionWinRatesByType: Record<string, { wins: number; fights: number }>
  avgDamageByType: Record<string, number>       // type → avg damage per battle

  // Player Economy
  avgPlayerMoney: number
  medianPlayerMoney: number
  giniCoefficient: number         // 0 = perfect equality, 1 = one player has everything
  topPlayerMoney: number
  bottomPlayerMoney: number

  // Money Sources Breakdown
  moneySources: {
    work: number
    production: number
    warRewards: number
    dailyLogin: number
    marketSales: number
    bondWinnings: number
    autoCountryIncome: number
  }

  // Money Sinks Breakdown
  moneySinks: {
    divisionRecruitment: number
    divisionUpkeep: number
    divisionHeal: number
    divisionRevive: number
    companyMaintenance: number
    companyBuilding: number
    marketPurchases: number
    marketTax: number
    bondLosses: number
    foodPurchases: number
  }
}

// ── Final Report ──

export interface SimulationReport {
  config: SimConfig
  dailyMetrics: DailyMetrics[]

  // Aggregated
  finalMoneySupply: number
  totalInflation: number          // % increase from day 0 to final day
  avgDailyInflation: number

  // Division Balance
  divisionROI: Record<string, {
    type: DivisionType
    avgDamagePerBattle: number
    avgSurvivalRate: number
    avgLifetimeDays: number
    avgKills: number
    totalRecruitCost: number
    totalUpkeepCost: number
    avgROI: number                // (total rewards earned) / (recruit + upkeep)
    winRate: number
  }>

  // Market Balance
  resourcePriceFinal: Record<string, number>
  resourcePriceChange: Record<string, number>  // % change from base price

  // Country Rankings
  countryRankings: Array<{
    code: string
    finalTreasury: number
    totalIncome: number
    totalSpending: number
    netBalance: number
    divisionsKilled: number
    divisionsLost: number
    kdRatio: number
  }>

  // Wealth Distribution
  finalGini: number
  wealthDistribution: { poorest20pct: number; richest20pct: number; ratio: number }

  // Division Analysis (deterministic, pre-computed)
  divisionAnalysis?: Record<string, {
    type: string
    expectedDPS: number
    effectiveHP: number
    dpsCostEfficiency: number
    ticksToBreakEven: number
    dailyUpkeepValue: number
    daysToPayForRecruitment: number
    dpsVsInfantry: number
    dpsVsMechanized: number
  }>
}
