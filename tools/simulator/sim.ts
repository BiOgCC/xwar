// ══════════════════════════════════════════════════════════════
// DETERMINISTIC FLOW SIMULATOR — Main Loop
// Every run produces IDENTICAL output given the same config.
// ══════════════════════════════════════════════════════════════

import { DIVISION_TEMPLATES, getWarRewards, computeAllDivisionAnalysis, computePlayerCombatStats, AVG_STAR_MODS } from './data'
import type { DivisionType, PlayerCombatStats } from './data'
import { SimMarket, SimStockMarket } from './market-sim'
import { createAgent, agentTickDay } from './agents'
import { simulateBattle } from './combat-sim'
import type { SimConfig, SimAgent, SimCountry, DailyMetrics, SimulationReport } from './types'
import { DEFAULT_CONFIG } from './types'

// ── Country Factory ──

function createSimCountry(code: string, pop: number): SimCountry {
  return {
    code, name: code, population: pop,
    treasury: 5_000_000, oilReserves: 500_000, scrapReserves: 500_000,
    materialXReserves: 500_000, bitcoinReserves: 5000,
    portLevel: 1, airportLevel: 1, bunkerLevel: 1, militaryBaseLevel: 1,
    totalTaxCollected: 0, totalWarFundContributed: 0, totalWarFundReceived: 0,
    totalAutoIncome: 0, totalMilitarySpending: 0, totalInfraSpending: 0,
    divisionsKilled: 0, divisionsLost: 0,
  }
}

const COUNTRY_POPS: Record<string, number> = {
  US: 32000, RU: 28000, CN: 45000, DE: 18000, BR: 22000,
  IN: 38000, NG: 15000, JP: 20000, GB: 16000, TR: 14000,
}

// ── Gini Coefficient ──

function computeGini(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n === 0) return 0
  const sum = sorted.reduce((a, b) => a + b, 0)
  if (sum === 0) return 0
  let giniSum = 0
  sorted.forEach((v, i) => { giniSum += (2 * (i + 1) - n - 1) * v })
  return giniSum / (n * sum)
}

// ── Deterministic war pairing ──
// Fixed round-robin: each pair fights for 2 weeks, then rotates
function getWarPairsForDay(countries: string[], day: number): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const rotation = Math.floor((day - 1) / 14) // rotate every 2 weeks
  const codes = [...countries]
  // Shift by rotation to create different pairings
  const shifted = [...codes.slice(rotation % codes.length), ...codes.slice(0, rotation % codes.length)]
  for (let i = 0; i < Math.floor(shifted.length / 2); i++) {
    pairs.push([shifted[i], shifted[shifted.length - 1 - i]])
  }
  return pairs
}

// ══════════════════════════════════════════════════════════════
// MAIN SIMULATION
// ══════════════════════════════════════════════════════════════

export function runSimulation(config: SimConfig = DEFAULT_CONFIG): SimulationReport {
  console.log(`\n🎮 DETERMINISTIC simulation: ${config.days} days, ${config.countries.length} countries, ${config.agentsPerCountry} agents/country\n`)

  // ── Init ──
  const market = new SimMarket()
  const stockMarket = new SimStockMarket(config.countries)
  const countries: Record<string, SimCountry> = {}
  const agents: SimAgent[] = []
  const allDailyMetrics: DailyMetrics[] = []

  // Create countries
  config.countries.forEach(code => {
    countries[code] = createSimCountry(code, COUNTRY_POPS[code] || 10000)
  })

  // Create agents (deterministic: fixed levels per strategy)
  const AGENT_LEVELS: Record<string, number[]> = {
    war:      [10, 15, 20],
    economy:  [10, 15, 20],
    balanced: [10, 15, 20],
  }
  const strategies: AgentStrategy[] = ['war', 'economy', 'balanced']
  config.countries.forEach(code => {
    for (let i = 0; i < config.agentsPerCountry; i++) {
      const strategy = strategies[i % 3] as AgentStrategy
      const levelPool = AGENT_LEVELS[strategy]
      const level = levelPool[i % levelPool.length]
      agents.push(createAgent(code, strategy, level))
    }
  })

  // ══ Day Loop ══
  for (let day = 1; day <= config.days; day++) {
    const dayTracking = {
      moneyCreated: 0, moneyDestroyed: 0,
      itemsCreated: 0, itemsDestroyed: 0,
      divisionsRecruited: 0, divisionsDestroyed: 0,
      battlesToday: 0,
      marketTradeVolume: 0, marketTaxCollected: 0,
      bondPayouts: 0, bondLosses: 0,
      warFundDistributed: 0,
      src: { work: 0, production: 0, dailyLogin: 0, warRewards: 0, marketSales: 0, bondWinnings: 0, autoCountryIncome: 0 },
      sink: { divisionRecruitment: 0, divisionUpkeep: 0, divisionHeal: 0, divisionRevive: 0, companyMaintenance: 0, companyBuilding: 0, marketPurchases: 0, marketTax: 0, bondLosses: 0, foodPurchases: 0 },
      divKills: {} as Record<string, number>,
      divDeaths: {} as Record<string, number>,
      divWinRates: {} as Record<string, { wins: number; fights: number }>,
      divDmgAccum: {} as Record<string, { total: number; count: number }>,
    }

    // ── 1. Agent daily economy ──
    agents.forEach(agent => {
      const t = agentTickDay(agent, market, day)
      dayTracking.moneyCreated += t.moneyFromWork + t.moneyFromProduction + t.moneyFromDailyLogin
      dayTracking.moneyDestroyed += t.moneySpentRecruitment + t.moneySpentUpkeep + t.moneySpentHeal + t.moneySpentCompanyMaint + t.moneySpentFood
      dayTracking.itemsCreated += t.itemsProduced
      dayTracking.divisionsRecruited += t.divisionsRecruited
      dayTracking.src.work += t.moneyFromWork
      dayTracking.src.production += t.moneyFromProduction
      dayTracking.src.dailyLogin += t.moneyFromDailyLogin
      dayTracking.sink.divisionRecruitment += t.moneySpentRecruitment
      dayTracking.sink.divisionUpkeep += t.moneySpentUpkeep
      dayTracking.sink.divisionHeal += t.moneySpentHeal
      dayTracking.sink.companyMaintenance += t.moneySpentCompanyMaint
      dayTracking.sink.foodPurchases += t.moneySpentFood
    })

    // ── 2. Country auto-income (every 3 days) ──
    if (day % 3 === 0) {
      Object.values(countries).forEach(c => {
        const infraMult = 1 + c.portLevel * 0.05 + c.airportLevel * 0.05 + c.militaryBaseLevel * 0.03 + c.bunkerLevel * 0.02
        const baseMoney = Math.floor(c.population * 0.1 * infraMult)
        const baseOil = Math.floor(c.population * 0.005 * infraMult * 0.3)
        c.treasury += baseMoney; c.oilReserves += baseOil
        c.totalAutoIncome += baseMoney
        dayTracking.moneyCreated += baseMoney
        dayTracking.src.autoCountryIncome += baseMoney
      })
    }

    // ── 3. Wars / Battles (deterministic pairing, every 2 days) ──
    if (day % 2 === 0) {
      const warPairs = getWarPairsForDay(config.countries, day)
      warPairs.forEach(([atkCode, defCode]) => {
        const atkAgents = agents.filter(a => a.countryCode === atkCode)
        const defAgents = agents.filter(a => a.countryCode === defCode)

        const atkDivs = atkAgents.flatMap(a => a.divisions.filter(d => d.status === 'ready'))
        const defDivs = defAgents.flatMap(a => a.divisions.filter(d => d.status === 'ready'))
        if (atkDivs.length === 0 || defDivs.length === 0) return

        const battleAtk = atkDivs.slice(0, 8)
        const battleDef = defDivs.slice(0, 8)

        // Use first agent's stats (deterministic since levels are fixed)
        const atkStats = atkAgents[0]?.combatStats
        const defStats = defAgents[0]?.combatStats
        if (!atkStats || !defStats) return

        const result = simulateBattle(battleAtk, battleDef, atkStats, defStats, atkCode, defCode)
        dayTracking.battlesToday++

        // Track division performance
        result.divisionPerformance.forEach((perf) => {
          const tp = perf.type
          if (!dayTracking.divWinRates[tp]) dayTracking.divWinRates[tp] = { wins: 0, fights: 0 }
          dayTracking.divWinRates[tp].fights++
          if (perf.survived) dayTracking.divWinRates[tp].wins++
          if (!dayTracking.divDmgAccum[tp]) dayTracking.divDmgAccum[tp] = { total: 0, count: 0 }
          dayTracking.divDmgAccum[tp].total += perf.damageDealt
          dayTracking.divDmgAccum[tp].count++
          dayTracking.divKills[tp] = (dayTracking.divKills[tp] || 0) + perf.killCount
          if (!perf.survived) dayTracking.divDeaths[tp] = (dayTracking.divDeaths[tp] || 0) + 1
        })

        const atkDestroyed = battleAtk.filter(d => d.status === 'destroyed').length
        const defDestroyed = battleDef.filter(d => d.status === 'destroyed').length
        dayTracking.divisionsDestroyed += atkDestroyed + defDestroyed
        countries[atkCode].divisionsLost += atkDestroyed
        countries[defCode].divisionsLost += defDestroyed
        countries[atkCode].divisionsKilled += defDestroyed
        countries[defCode].divisionsKilled += atkDestroyed

        // War rewards
        const winnerAgents = result.winner === 'attacker' ? atkAgents : defAgents
        const loserKills = result.winner === 'attacker' ? result.defenderDivsLost : result.attackerDivsLost
        const winnerRewards = getWarRewards(loserKills, true)
        const loserRewards = getWarRewards(0, false)

        winnerAgents.forEach(a => {
          const share = Math.floor(winnerRewards.totalMoney / winnerAgents.length)
          a.money += share; a.totalMoneyEarned += share; a.totalBattlesWon++
          dayTracking.moneyCreated += share; dayTracking.src.warRewards += share
        })
        const loserAgents = result.winner === 'attacker' ? defAgents : atkAgents
        loserAgents.forEach(a => {
          const share = Math.floor(loserRewards.totalMoney / loserAgents.length)
          a.money += share; a.totalMoneyEarned += share; a.totalBattlesLost++
          dayTracking.moneyCreated += share; dayTracking.src.warRewards += share
        })

        // War fund: 2% treasury drain
        ;[atkCode, defCode].forEach(code => {
          const drain = Math.floor(countries[code].treasury * 0.02)
          countries[code].treasury -= drain
          countries[code].totalWarFundContributed += drain
          dayTracking.moneyDestroyed += drain
        })

        // Remove destroyed divs
        agents.forEach(a => {
          const before = a.divisions.length
          a.divisions = a.divisions.filter(d => d.status !== 'destroyed')
          a.totalDivisionsLost += before - a.divisions.length
        })
      })
    }

    // ── 4. Market taxes → country treasury ──
    const taxThisTick = market.totalTaxCollected
    dayTracking.marketTaxCollected = taxThisTick
    dayTracking.sink.marketTax += taxThisTick
    const taxPerCountry = Math.floor(taxThisTick / config.countries.length)
    config.countries.forEach(code => {
      countries[code].treasury += taxPerCountry
      countries[code].totalTaxCollected += taxPerCountry
    })
    market.totalTaxCollected = 0

    // ── 5. Tick market prices ──
    market.tickPrices()

    // ── 6. Tick stock prices ──
    const countryMetrics: Record<string, { divisions: number; companies: number; treasury: number; atWar: boolean; population: number }> = {}
    config.countries.forEach(code => {
      const c = countries[code]
      const warPairs = getWarPairsForDay(config.countries, day)
      const totalDivs = agents.filter(a => a.countryCode === code).reduce((sum, a) => sum + a.divisions.filter(d => d.status !== 'destroyed').length, 0)
      const totalCompanies = agents.filter(a => a.countryCode === code).reduce((sum, a) => sum + a.companiesOwned, 0)
      const atWar = warPairs.some(([a, b]) => a === code || b === code)
      countryMetrics[code] = { divisions: totalDivs, companies: totalCompanies, treasury: c.treasury, atWar, population: c.population }
    })
    stockMarket.tickPrices(countryMetrics)

    // ── Collect Daily Metrics ──
    const allMoney = agents.map(a => a.money)
    const totalPlayerMoney = allMoney.reduce((a, b) => a + b, 0)
    const totalTreasury = Object.values(countries).reduce((sum, c) => sum + c.treasury, 0)
    const totalMoneySupply = totalPlayerMoney + totalTreasury
    const sortedMoney = [...allMoney].sort((a, b) => a - b)
    const prevSupply = allDailyMetrics.length > 0 ? allDailyMetrics[allDailyMetrics.length - 1].totalMoneySupply : totalMoneySupply

    const countryTreasuries: Record<string, number> = {}
    config.countries.forEach(code => { countryTreasuries[code] = countries[code].treasury })

    const avgDmgByType: Record<string, number> = {}
    Object.entries(dayTracking.divDmgAccum).forEach(([tp, { total, count }]) => {
      avgDmgByType[tp] = count > 0 ? Math.floor(total / count) : 0
    })

    allDailyMetrics.push({
      day,
      totalMoneySupply,
      moneyCreatedToday: dayTracking.moneyCreated,
      moneyDestroyedToday: dayTracking.moneyDestroyed,
      netMoneyFlow: dayTracking.moneyCreated - dayTracking.moneyDestroyed,
      inflationRate: prevSupply > 0 ? ((totalMoneySupply - prevSupply) / prevSupply) * 100 : 0,
      itemsCreatedToday: dayTracking.itemsCreated,
      itemsDestroyedToday: dayTracking.itemsDestroyed,
      divisionsRecruited: dayTracking.divisionsRecruited,
      divisionsDestroyed: dayTracking.divisionsDestroyed,
      resourcePrices: market.getPriceSnapshot(),
      marketTradeVolume: dayTracking.marketTradeVolume,
      marketTaxCollected: dayTracking.marketTaxCollected,
      stockPrices: stockMarket.getPriceSnapshot(),
      bondPayoutsToday: dayTracking.bondPayouts,
      bondLossesToday: dayTracking.bondLosses,
      countryTreasuries,
      warFundPool: 0,
      warFundDistributed: dayTracking.warFundDistributed,
      battlesToday: dayTracking.battlesToday,
      divisionKillsByType: dayTracking.divKills,
      divisionDeathsByType: dayTracking.divDeaths,
      divisionWinRatesByType: dayTracking.divWinRates,
      avgDamageByType: avgDmgByType,
      avgPlayerMoney: Math.floor(totalPlayerMoney / agents.length),
      medianPlayerMoney: sortedMoney[Math.floor(sortedMoney.length / 2)] || 0,
      giniCoefficient: computeGini(allMoney),
      topPlayerMoney: sortedMoney[sortedMoney.length - 1] || 0,
      bottomPlayerMoney: sortedMoney[0] || 0,
      moneySources: dayTracking.src,
      moneySinks: dayTracking.sink,
    })

    if (config.verbose && day % 14 === 0) {
      const last = allDailyMetrics[allDailyMetrics.length - 1]
      console.log(`  Day ${day}: Supply=$${(totalMoneySupply / 1e6).toFixed(1)}M | Infl=${last.inflationRate.toFixed(2)}% | Gini=${last.giniCoefficient.toFixed(3)} | Battles=${dayTracking.battlesToday} | Divs=${agents.reduce((s,a) => s + a.divisions.length, 0)}`)
    }
  }

  // ══ Build Final Report ══
  const firstMetrics = allDailyMetrics[0]
  const lastMetrics = allDailyMetrics[allDailyMetrics.length - 1]
  const totalInflation = firstMetrics.totalMoneySupply > 0
    ? ((lastMetrics.totalMoneySupply - firstMetrics.totalMoneySupply) / firstMetrics.totalMoneySupply) * 100 : 0

  // Division ROI
  const divROI: SimulationReport['divisionROI'] = {}
  const divTypes = Object.keys(DIVISION_TEMPLATES) as DivisionType[]
  divTypes.forEach(type => {
    const template = DIVISION_TEMPLATES[type]
    const totalFights = allDailyMetrics.reduce((sum, m) => sum + (m.divisionWinRatesByType[type]?.fights || 0), 0)
    const totalWins = allDailyMetrics.reduce((sum, m) => sum + (m.divisionWinRatesByType[type]?.wins || 0), 0)
    const totalKills = allDailyMetrics.reduce((sum, m) => sum + (m.divisionKillsByType[type] || 0), 0)
    const totalDeaths = allDailyMetrics.reduce((sum, m) => sum + (m.divisionDeathsByType[type] || 0), 0)
    const totalRecruited = agents.reduce((sum, a) => sum + a.divisions.filter(d => d.type === type).length, 0) + totalDeaths
    const avgDmg = allDailyMetrics.reduce((sum, m) => sum + (m.avgDamageByType[type] || 0), 0) / Math.max(1, allDailyMetrics.filter(m => m.avgDamageByType[type]).length)

    divROI[type] = {
      type,
      avgDamagePerBattle: Math.floor(avgDmg),
      avgSurvivalRate: totalFights > 0 ? totalWins / totalFights : 0,
      avgLifetimeDays: totalRecruited > 0 ? config.days / Math.max(1, totalDeaths) : config.days,
      avgKills: totalRecruited > 0 ? totalKills / totalRecruited : 0,
      totalRecruitCost: template.recruitCost.money,
      totalUpkeepCost: +(template.upkeepCost.oil * market.getPrice('oil') + template.upkeepCost.materialX * market.getPrice('materialX')).toFixed(2),
      avgROI: 0,
      winRate: totalFights > 0 ? totalWins / totalFights : 0,
    }
  })

  // Resource price change
  const resourcePriceChange: Record<string, number> = {}
  const resourcePriceFinal: Record<string, number> = {}
  Object.entries(lastMetrics.resourcePrices).forEach(([id, price]) => {
    resourcePriceFinal[id] = price
    const base = market.tickers[id]?.basePrice ?? price
    resourcePriceChange[id] = base > 0 ? ((price - base) / base) * 100 : 0
  })

  // Country rankings
  const countryRankings = config.countries.map(code => {
    const c = countries[code]
    return {
      code,
      finalTreasury: c.treasury,
      totalIncome: c.totalAutoIncome + c.totalTaxCollected + c.totalWarFundReceived,
      totalSpending: c.totalMilitarySpending + c.totalInfraSpending + c.totalWarFundContributed,
      netBalance: (c.totalAutoIncome + c.totalTaxCollected + c.totalWarFundReceived) - (c.totalMilitarySpending + c.totalInfraSpending + c.totalWarFundContributed),
      divisionsKilled: c.divisionsKilled,
      divisionsLost: c.divisionsLost,
      kdRatio: c.divisionsLost > 0 ? c.divisionsKilled / c.divisionsLost : c.divisionsKilled,
    }
  }).sort((a, b) => b.finalTreasury - a.finalTreasury)

  // Wealth distribution
  const allMoney = agents.map(a => a.money).sort((a, b) => a - b)
  const n20 = Math.max(1, Math.floor(allMoney.length * 0.2))
  const poorest20 = allMoney.slice(0, n20).reduce((a, b) => a + b, 0)
  const richest20 = allMoney.slice(-n20).reduce((a, b) => a + b, 0)

  // Division analysis (static, pre-computed)
  const refStats = computePlayerCombatStats({ attack: 7, critRate: 5, critDamage: 5, precision: 4, armor: 4, dodge: 3, stamina: 0, hunger: 0 })
  const divisionAnalysis = computeAllDivisionAnalysis(refStats, market.getPrice('oil'), market.getPrice('materialX'))

  return {
    config,
    dailyMetrics: allDailyMetrics,
    finalMoneySupply: lastMetrics.totalMoneySupply,
    totalInflation,
    avgDailyInflation: totalInflation / config.days,
    divisionROI: divROI,
    resourcePriceFinal,
    resourcePriceChange,
    countryRankings,
    finalGini: lastMetrics.giniCoefficient,
    wealthDistribution: { poorest20pct: poorest20, richest20pct: richest20, ratio: poorest20 > 0 ? richest20 / poorest20 : Infinity },
    divisionAnalysis,
  }
}

type AgentStrategy = 'war' | 'economy' | 'balanced'
