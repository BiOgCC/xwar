// ══════════════════════════════════════════════════════════════
// DETERMINISTIC FLOW SIMULATOR — Report Generator
// Includes: biweekly snapshots, anomaly detection, equilibrium
// analysis, and division comparison table.
// ══════════════════════════════════════════════════════════════

import type { SimulationReport, DailyMetrics } from './types'
import { RESOURCE_DEFS } from './market-sim'

const BIWEEKLY = 14
const ANOMALY_THRESHOLD = 300

const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', B = '\x1b[34m', M = '\x1b[35m', C = '\x1b[36m', W = '\x1b[37m', RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m'

function fmt$(n: number): string { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }
function fmtPct(n: number): string { return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` }
function fmtPrice(n: number): string { return `$${n.toFixed(2)}` }
function bar(value: number, max: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function printReport(report: SimulationReport): void {
  const { config, dailyMetrics: dm, divisionROI } = report

  console.log(`\n${BOLD}${C}══════════════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${C}  XWAR DETERMINISTIC BALANCE REPORT${RESET}`)
  console.log(`${BOLD}${C}  ${config.days} days · ${config.countries.length} countries · ${config.agentsPerCountry} agents/country${RESET}`)
  console.log(`${DIM}${C}  100% reproducible — zero randomness${RESET}`)
  console.log(`${BOLD}${C}══════════════════════════════════════════════════════════════${RESET}\n`)

  // ═══ 1. MONEY SUPPLY & INFLATION ═══
  console.log(`${BOLD}${Y}━━━ 💰 MONEY SUPPLY & INFLATION ━━━${RESET}`)
  console.log(`  Initial Supply:    ${fmt$(dm[0].totalMoneySupply)}`)
  console.log(`  Final Supply:      ${fmt$(report.finalMoneySupply)}`)
  console.log(`  Total Inflation:   ${report.totalInflation >= 0 ? R : G}${fmtPct(report.totalInflation)}${RESET}`)
  console.log(`  Avg Daily Infl:    ${report.avgDailyInflation >= 0 ? R : G}${fmtPct(report.avgDailyInflation)}${RESET}`)
  console.log()

  const totalSrc = dm.reduce((s, m) => s + m.moneyCreatedToday, 0)
  const totalSink = dm.reduce((s, m) => s + m.moneyDestroyedToday, 0)
  console.log(`  ${G}Total Money Created:    ${fmt$(totalSrc)}${RESET}`)
  console.log(`  ${R}Total Money Destroyed:  ${fmt$(totalSink)}${RESET}`)
  console.log(`  Faucet/Sink Ratio:    ${(totalSrc / Math.max(1, totalSink)).toFixed(1)}x`)
  console.log()

  // Source breakdown
  const srcTotals = {
    work: dm.reduce((s, m) => s + m.moneySources.work, 0),
    production: dm.reduce((s, m) => s + m.moneySources.production, 0),
    dailyLogin: dm.reduce((s, m) => s + m.moneySources.dailyLogin, 0),
    warRewards: dm.reduce((s, m) => s + m.moneySources.warRewards, 0),
    autoCountryIncome: dm.reduce((s, m) => s + m.moneySources.autoCountryIncome, 0),
  }
  const srcTotal = Object.values(srcTotals).reduce((a, b) => a + b, 0) || 1
  console.log(`  ${BOLD}Money SOURCES (faucets):${RESET}`)
  Object.entries(srcTotals).sort(([,a],[,b]) => b - a).forEach(([k, v]) => {
    console.log(`    ${G}${k.padEnd(22)} ${fmt$(v).padStart(15)}  ${DIM}(${(v/srcTotal*100).toFixed(1)}%)${RESET}  ${DIM}${fmt$(Math.floor(v / config.days))}/day${RESET}`)
  })
  console.log()

  const sinkTotals = {
    recruitment: dm.reduce((s, m) => s + m.moneySinks.divisionRecruitment, 0),
    upkeep: dm.reduce((s, m) => s + m.moneySinks.divisionUpkeep, 0),
    heal: dm.reduce((s, m) => s + m.moneySinks.divisionHeal, 0),
    companyMaint: dm.reduce((s, m) => s + m.moneySinks.companyMaintenance, 0),
    marketTax: dm.reduce((s, m) => s + m.moneySinks.marketTax, 0),
    food: dm.reduce((s, m) => s + m.moneySinks.foodPurchases, 0),
  }
  const sinkTotal = Object.values(sinkTotals).reduce((a, b) => a + b, 0) || 1
  console.log(`  ${BOLD}Money SINKS (drains):${RESET}`)
  Object.entries(sinkTotals).sort(([,a],[,b]) => b - a).forEach(([k, v]) => {
    console.log(`    ${R}${k.padEnd(22)} ${fmt$(v).padStart(15)}  ${DIM}(${(v/sinkTotal*100).toFixed(1)}%)${RESET}  ${DIM}${fmt$(Math.floor(v / config.days))}/day${RESET}`)
  })
  console.log()

  // ═══ 2. EQUILIBRIUM ANALYSIS ═══
  console.log(`${BOLD}${Y}━━━ ⚖️  EQUILIBRIUM ANALYSIS ━━━${RESET}`)
  const dailyFaucet = Math.floor(totalSrc / config.days)
  const dailySink = Math.floor(totalSink / config.days)
  const netDaily = dailyFaucet - dailySink
  const perPlayerPerDay = Math.floor(netDaily / (config.agentsPerCountry * config.countries.length))
  console.log(`  Daily Money Created:    ${G}${fmt$(dailyFaucet)}${RESET}`)
  console.log(`  Daily Money Destroyed:  ${R}${fmt$(dailySink)}${RESET}`)
  console.log(`  Net Daily Flow:         ${netDaily >= 0 ? R : G}${fmt$(netDaily)}${RESET}`)
  console.log(`  Net Per Player/Day:     ${perPlayerPerDay >= 0 ? R : G}${fmt$(perPlayerPerDay)}${RESET}`)
  console.log()
  // Estimate days to double money supply
  if (report.avgDailyInflation > 0) {
    const daysToDouble = Math.ceil(100 / report.avgDailyInflation)
    console.log(`  Money supply doubles every: ${R}${daysToDouble} days${RESET}`)
  }
  // Required sink to reach equilibrium
  const requiredSink = dailyFaucet
  const sinkGap = requiredSink - dailySink
  if (sinkGap > 0) {
    console.log(`  Sink deficit:              ${R}${fmt$(sinkGap)}/day${RESET} ${DIM}(need this much more drain for 0% inflation)${RESET}`)
    console.log(`  Suggestions:`)
    console.log(`    • Increase div recruit costs by ${Math.ceil(sinkGap / Math.max(1, sinkTotals.recruitment / config.days) * 100)}%`)
    console.log(`    • Add equipment durability loss worth ${fmt$(sinkGap)}/day`)
    console.log(`    • Add market listing fees of ${fmt$(Math.floor(sinkGap / 3))}/day`)
  }
  console.log()

  // ═══ 3. BIWEEKLY SNAPSHOTS ═══
  console.log(`${BOLD}${Y}━━━ 📊 BIWEEKLY SNAPSHOTS ━━━${RESET}`)
  console.log(`  ${'Period'.padEnd(12)} ${'MoneySupply'.padStart(14)} ${'%Change'.padStart(9)} ${'Gini'.padStart(6)} ${'Divs+'.padStart(7)} ${'Divs-'.padStart(7)} ${'Btls'.padStart(6)} ${'Net$/player'.padStart(13)}`)
  console.log(`  ${'─'.repeat(12)} ${'─'.repeat(14)} ${'─'.repeat(9)} ${'─'.repeat(6)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(6)} ${'─'.repeat(13)}`)

  for (let i = BIWEEKLY - 1; i < dm.length; i += BIWEEKLY) {
    const start = Math.max(0, i - BIWEEKLY + 1)
    const periodStart = dm[start], periodEnd = dm[i]
    const pctChange = periodStart.totalMoneySupply > 0 ? ((periodEnd.totalMoneySupply - periodStart.totalMoneySupply) / periodStart.totalMoneySupply * 100) : 0
    const slice = dm.slice(start, i + 1)
    const divsBuilt = slice.reduce((s, m) => s + m.divisionsRecruited, 0)
    const divsLost = slice.reduce((s, m) => s + m.divisionsDestroyed, 0)
    const battles = slice.reduce((s, m) => s + m.battlesToday, 0)
    const netMoney = slice.reduce((s, m) => s + m.netMoneyFlow, 0)
    const numAgents = config.agentsPerCountry * config.countries.length
    const netPerPlayer = Math.floor(netMoney / numAgents)

    const label = `Day ${start + 1}-${i + 1}`
    const inflColor = pctChange > 5 ? R : pctChange > 2 ? Y : G
    console.log(`  ${label.padEnd(12)} ${fmt$(periodEnd.totalMoneySupply).padStart(14)} ${inflColor}${fmtPct(pctChange).padStart(9)}${RESET} ${periodEnd.giniCoefficient.toFixed(3).padStart(6)} ${String(divsBuilt).padStart(7)} ${String(divsLost).padStart(7)} ${String(battles).padStart(6)} ${fmt$(netPerPlayer).padStart(13)}`)
  }
  console.log()

  // ═══ 4. RESOURCE MARKET PRICES ═══
  console.log(`${BOLD}${Y}━━━ 📈 RESOURCE MARKET PRICES (deterministic) ━━━${RESET}`)
  const resourceIds = RESOURCE_DEFS.map(r => r.id)
  const biweeklyDays = [0, ...Array.from({ length: Math.floor(dm.length / BIWEEKLY) }, (_, i) => (i + 1) * BIWEEKLY - 1)]
  if (biweeklyDays[biweeklyDays.length - 1] !== dm.length - 1) biweeklyDays.push(dm.length - 1)

  const header = 'Resource'.padEnd(16) + biweeklyDays.map(d => `Day ${d + 1}`.padStart(10)).join('') + ' Change'.padStart(10)
  console.log(`  ${header}`)
  console.log(`  ${'─'.repeat(header.length)}`)

  const anomalies: string[] = []
  resourceIds.forEach(id => {
    const def = RESOURCE_DEFS.find(r => r.id === id)!
    let line = `  ${id.padEnd(16)}`
    biweeklyDays.forEach(d => {
      const price = dm[d]?.resourcePrices[id] ?? def.basePrice
      line += fmtPrice(price).padStart(10)
    })
    const finalPrice = dm[dm.length - 1]?.resourcePrices[id] ?? def.basePrice
    const changePct = def.basePrice > 0 ? ((finalPrice - def.basePrice) / def.basePrice * 100) : 0
    const changeColor = Math.abs(changePct) > ANOMALY_THRESHOLD ? R + BOLD : Math.abs(changePct) > 50 ? Y : G
    line += `${changeColor}${fmtPct(changePct).padStart(10)}${RESET}`
    if (Math.abs(changePct) > ANOMALY_THRESHOLD) {
      anomalies.push(`  ${R}⚠️  ${id}: ${changePct > 0 ? '📈 INFLATED' : '📉 DEFLATED'} ${fmtPct(changePct)} (base: ${fmtPrice(def.basePrice)} → ${fmtPrice(finalPrice)})${RESET}`)
    }
    console.log(line)
  })
  if (anomalies.length > 0) { console.log(); anomalies.forEach(a => console.log(a)) }
  else console.log(`\n  ${G}✅ No extreme price anomalies detected${RESET}`)
  console.log()

  // ═══ 5. DIVISION COMPARISON TABLE (deterministic) ═══
  if (report.divisionAnalysis) {
    console.log(`${BOLD}${Y}━━━ 🔬 DIVISION ANALYSIS (expected values, Lvl15 reference) ━━━${RESET}`)
    console.log(`  ${'Type'.padEnd(12)} ${'DPS'.padStart(6)} ${'effHP'.padStart(7)} ${'DPS/$K'.padStart(8)} ${'Upkeep/d'.padStart(9)} ${'Days2Rec'.padStart(9)} ${'vsInf'.padStart(7)} ${'vsMech'.padStart(7)} ${'Verdict'.padStart(10)}`)
    console.log(`  ${'─'.repeat(12)} ${'─'.repeat(6)} ${'─'.repeat(7)} ${'─'.repeat(8)} ${'─'.repeat(9)} ${'─'.repeat(9)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(10)}`)

    const entries = Object.values(report.divisionAnalysis).sort((a,b) => b.dpsCostEfficiency - a.dpsCostEfficiency)
    const maxDPS = Math.max(...entries.map(e => e.expectedDPS))
    const maxHP = Math.max(...entries.map(e => e.effectiveHP))
    entries.forEach(d => {
      // Verdict: compare DPS/cost efficiency
      let verdict = 'FAIR', vClr = W
      if (d.dpsCostEfficiency > 0.5) { verdict = 'STRONG'; vClr = G }
      if (d.dpsCostEfficiency > 1.0) { verdict = 'OP'; vClr = R }
      if (d.dpsCostEfficiency < 0.1) { verdict = 'WEAK'; vClr = Y }

      console.log(`  ${d.type.padEnd(12)} ${String(d.expectedDPS).padStart(6)} ${String(d.effectiveHP).padStart(7)} ${d.dpsCostEfficiency.toFixed(2).padStart(8)} ${fmtPrice(d.dailyUpkeepValue).padStart(9)} ${String(d.daysToPayForRecruitment).padStart(9)} ${String(d.dpsVsInfantry).padStart(7)} ${String(d.dpsVsMechanized).padStart(7)} ${vClr}${verdict.padStart(10)}${RESET}`)
    })
    console.log()
  }

  // ═══ 6. DIVISION BALANCE (from sim) ═══
  console.log(`${BOLD}${Y}━━━ ⚔️  DIVISION BATTLE RESULTS ━━━${RESET}`)
  console.log(`  ${'Type'.padEnd(12)} ${'Recruit$'.padStart(10)} ${'Upkeep$/d'.padStart(10)} ${'AvgDmg'.padStart(8)} ${'WinRate'.padStart(8)} ${'Survival'.padStart(8)} ${'AvgKills'.padStart(8)} ${'Grade'.padStart(6)}`)
  console.log(`  ${'─'.repeat(12)} ${'─'.repeat(10)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(6)}`)

  const divEntries = Object.values(divisionROI).sort((a, b) => b.avgDamagePerBattle - a.avgDamagePerBattle)
  divEntries.forEach(d => {
    const costEff = d.avgDamagePerBattle / Math.max(1, d.totalRecruitCost / 1000)
    const composite = costEff * 0.4 + d.avgSurvivalRate * 100 * 0.3 + d.winRate * 100 * 0.3
    let grade = 'D', gradeClr = R
    if (composite > 80) { grade = 'S'; gradeClr = M }
    else if (composite > 60) { grade = 'A'; gradeClr = G }
    else if (composite > 40) { grade = 'B'; gradeClr = Y }
    else if (composite > 20) { grade = 'C'; gradeClr = W }

    console.log(`  ${d.type.padEnd(12)} ${fmt$(d.totalRecruitCost).padStart(10)} ${fmtPrice(d.totalUpkeepCost).padStart(10)} ${String(d.avgDamagePerBattle).padStart(8)} ${(d.winRate * 100).toFixed(0).padStart(7)}% ${(d.avgSurvivalRate * 100).toFixed(0).padStart(7)}% ${d.avgKills.toFixed(1).padStart(8)} ${gradeClr}${grade.padStart(6)}${RESET}`)
  })
  console.log()

  // ═══ 7. STOCK MARKET ═══
  console.log(`${BOLD}${Y}━━━ 📊 STOCK MARKET ━━━${RESET}`)
  const firstStocks = dm[0].stockPrices, lastStocks = dm[dm.length - 1].stockPrices
  console.log(`  ${'Country'.padEnd(8)} ${'Start'.padStart(8)} ${'End'.padStart(8)} ${'Change'.padStart(10)} ${'Chart'.padStart(22)}`)
  console.log(`  ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(22)}`)
  Object.keys(lastStocks).sort((a, b) => (lastStocks[b] - lastStocks[a])).forEach(code => {
    const start = firstStocks[code] || 50, end = lastStocks[code] || 50
    const pct = start > 0 ? ((end - start) / start * 100) : 0
    const clr = pct > 0 ? G : R
    console.log(`  ${code.padEnd(8)} ${fmt$(start).padStart(8)} ${fmt$(end).padStart(8)} ${clr}${fmtPct(pct).padStart(10)}${RESET} ${bar(end, Math.max(start, end, 100))}`)
  })
  console.log()

  // ═══ 8. COUNTRY RANKINGS ═══
  console.log(`${BOLD}${Y}━━━ 🏛️  COUNTRY RANKINGS ━━━${RESET}`)
  console.log(`  ${'Country'.padEnd(8)} ${'Treasury'.padStart(12)} ${'Income'.padStart(12)} ${'Spending'.padStart(12)} ${'K/D'.padStart(8)} ${'Killed'.padStart(8)} ${'Lost'.padStart(8)}`)
  console.log(`  ${'─'.repeat(8)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(8)}`)
  report.countryRankings.forEach(c => {
    const kdColor = c.kdRatio >= 1 ? G : R
    console.log(`  ${c.code.padEnd(8)} ${fmt$(c.finalTreasury).padStart(12)} ${fmt$(c.totalIncome).padStart(12)} ${fmt$(c.totalSpending).padStart(12)} ${kdColor}${c.kdRatio.toFixed(1).padStart(8)}${RESET} ${String(c.divisionsKilled).padStart(8)} ${String(c.divisionsLost).padStart(8)}`)
  })
  console.log()

  // ═══ 9. WEALTH DISTRIBUTION ═══
  console.log(`${BOLD}${Y}━━━ 💎 WEALTH DISTRIBUTION ━━━${RESET}`)
  console.log(`  Gini Coefficient:    ${report.finalGini.toFixed(3)} ${report.finalGini > 0.6 ? R + '(HIGH INEQUALITY)' : report.finalGini > 0.4 ? Y + '(moderate)' : G + '(healthy)'}${RESET}`)
  console.log(`  Poorest 20%:         ${fmt$(report.wealthDistribution.poorest20pct)}`)
  console.log(`  Richest 20%:         ${fmt$(report.wealthDistribution.richest20pct)}`)
  console.log(`  Rich/Poor Ratio:     ${report.wealthDistribution.ratio.toFixed(1)}x`)
  console.log()

  // ═══ 10. ITEMS & DIVISIONS ═══
  const totalItemsCreated = dm.reduce((s, m) => s + m.itemsCreatedToday, 0)
  const totalItemsDestroyed = dm.reduce((s, m) => s + m.itemsDestroyedToday, 0)
  const totalDivsRecruited = dm.reduce((s, m) => s + m.divisionsRecruited, 0)
  const totalDivsDestroyed = dm.reduce((s, m) => s + m.divisionsDestroyed, 0)
  console.log(`${BOLD}${Y}━━━ 📦 ITEM & DIVISION ECONOMY ━━━${RESET}`)
  console.log(`  Items Created:      ${G}${totalItemsCreated.toLocaleString()}${RESET}    Items Destroyed:    ${R}${totalItemsDestroyed.toLocaleString()}${RESET}`)
  console.log(`  Divs Recruited:     ${G}${totalDivsRecruited.toLocaleString()}${RESET}    Divs Destroyed:     ${R}${totalDivsDestroyed.toLocaleString()}${RESET}`)
  console.log()

  // ═══ 11. BALANCE ALERTS ═══
  console.log(`${BOLD}${Y}━━━ 🚨 BALANCE ALERTS ━━━${RESET}`)
  let alertCount = 0

  if (report.totalInflation > 50) {
    console.log(`  ${R}⚠️  HYPERINFLATION: +${report.totalInflation.toFixed(0)}% — faucet/sink ratio ${(totalSrc / Math.max(1, totalSink)).toFixed(1)}x — need ${fmt$(sinkGap)}/day more drain${RESET}`)
    alertCount++
  } else if (report.totalInflation < -20) {
    console.log(`  ${R}⚠️  DEFLATION: ${fmtPct(report.totalInflation)} — economy too punishing${RESET}`)
    alertCount++
  }
  if (report.finalGini > 0.6) { console.log(`  ${R}⚠️  HIGH INEQUALITY: Gini ${report.finalGini.toFixed(3)}${RESET}`); alertCount++ }
  if (report.wealthDistribution.ratio > 20) { console.log(`  ${R}⚠️  EXTREME WEALTH GAP: ${report.wealthDistribution.ratio.toFixed(0)}× ratio${RESET}`); alertCount++ }

  // Division alerts
  if (report.divisionAnalysis) {
    Object.values(report.divisionAnalysis).forEach(d => {
      if (d.dpsCostEfficiency > 1.0) { console.log(`  ${Y}⚠️  ${d.type.toUpperCase()} COST-EFFICIENT: ${d.dpsCostEfficiency.toFixed(2)} DPS/$K — consider raising recruit cost${RESET}`); alertCount++ }
      if (d.dpsCostEfficiency < 0.05 && d.expectedDPS > 0) { console.log(`  ${Y}⚠️  ${d.type.toUpperCase()} NOT WORTH IT: ${d.dpsCostEfficiency.toFixed(2)} DPS/$K — consider lowering cost or buffing${RESET}`); alertCount++ }
    })
  }

  Object.values(divisionROI).forEach(d => {
    if (d.winRate > 0.75 && d.avgDamagePerBattle > 0) { console.log(`  ${Y}⚠️  ${d.type.toUpperCase()} OVERPOWERED in sim: ${(d.winRate * 100).toFixed(0)}% survival${RESET}`); alertCount++ }
    if (d.winRate < 0.15 && d.avgDamagePerBattle > 0) { console.log(`  ${Y}⚠️  ${d.type.toUpperCase()} UNDERPOWERED in sim: ${(d.winRate * 100).toFixed(0)}% survival${RESET}`); alertCount++ }
  })

  alertCount += anomalies.length
  if (alertCount === 0) console.log(`  ${G}✅ No major balance issues detected!${RESET}`)

  console.log(`\n${BOLD}${C}══════════════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${C}  END OF REPORT — Run again to verify identical results${RESET}`)
  console.log(`${BOLD}${C}══════════════════════════════════════════════════════════════${RESET}\n`)
}
