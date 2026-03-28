/**
 * XWAR 15-Day Population Simulation
 * 100 players: 66 Eco / 34 Fighter
 * Standalone — no store/server deps. All formulas inlined from codebase.
 * Usage: npx tsx scripts/sim_15day.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : path.dirname(__filename2)

// ═══════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════

interface SimPlayer {
  id: number; name: string; type: 'eco' | 'fighter'
  // Resources
  money: number; bitcoin: number; oil: number; materialX: number; scrap: number
  bread: number; sushi: number; wagyu: number
  greenBullets: number; blueBullets: number; purpleBullets: number; redBullets: number
  lootBoxes: number; militaryBoxes: number; badgesOfHonor: number
  // Bars
  stamina: number; maxStamina: number
  hunger: number; maxHunger: number
  work: number; maxWork: number
  enterprise: number; maxEnterprise: number
  // XP / Level
  level: number; xp: number; xpToNext: number; skillPoints: number
  // Skills (0-10)
  milSkills: { attack: number; critRate: number; critDamage: number; precision: number; stamina: number; hunger: number; armor: number; dodge: number }
  ecoSkills: { work: number; entrepreneurship: number; production: number; prospection: number; industrialist: number }
  // Companies
  companies: SimCompany[]
  // Combat stats cache
  equippedAmmo: 'none' | 'green' | 'blue' | 'purple' | 'red'
  // KPIs
  kpi: SimKPI
}

interface SimCompany {
  type: string; level: number; productionProgress: number; productionMax: number
}

interface SimKPI {
  moneyEarned: number; moneySpent: number
  damageDealt: number; attackCount: number
  workCount: number; enterpriseCount: number; produceCount: number
  casinoSpins: number; casinoWon: number; casinoLost: number
  stockBought: number; stockSold: number; stockProfit: number
  bondBets: number; bondWon: number; bondLost: number
  warRewards: number; bountyEarned: number; bountySpent: number
  dailyRewards: number; bohEarned: number
  marketBuyVolume: number; marketSellVolume: number; marketProfit: number
  contractIncome: number; xpGained: number; levelsGained: number
  crashBets: number; crashWon: number; crashLost: number
  bjBets: number; bjWon: number; bjLost: number
}

// ═══════════════════════════════════════════════
//  CONSTANTS (from codebase)
// ═══════════════════════════════════════════════

const TOTAL_PLAYERS = 100
const ECO_COUNT = 66
const FIGHTER_COUNT = 34
const SIM_DAYS = 15
const TICKS_PER_DAY = 48 // 30-min ticks, 24h = 48
const FULL_RECOVERY_TICKS = 24 // 12h = 24 ticks

// Casino wheel probabilities (simplified EV model)
const WHEEL_100K = { ev: 0.90, bustPct: 0.32 }
const WHEEL_250K = { ev: 0.88, bustPct: 0.38 }
const WHEEL_500K = { ev: 0.88, bustPct: 0.45 }

// Daily reward cycle (7 days)
const DAILY_REWARDS = [
  { money: 10000, btc: 0 }, { money: 15000, btc: 0 }, { money: 20000, btc: 0 },
  { money: 25000, btc: 1 }, { money: 30000, btc: 0 }, { money: 35000, btc: 1 },
  { money: 50000, btc: 2 },
]

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════

function rand(min: number, max: number) { return min + Math.random() * (max - min) }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)) }
function deviate(v: number) { return v * (0.9 + Math.random() * 0.2) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function xpForLevel(level: number): number {
  if (level <= 10) return 100; if (level <= 20) return 150; return 200
}

function freshKPI(): SimKPI {
  return {
    moneyEarned: 0, moneySpent: 0, damageDealt: 0, attackCount: 0,
    workCount: 0, enterpriseCount: 0, produceCount: 0,
    casinoSpins: 0, casinoWon: 0, casinoLost: 0,
    stockBought: 0, stockSold: 0, stockProfit: 0,
    bondBets: 0, bondWon: 0, bondLost: 0,
    warRewards: 0, bountyEarned: 0, bountySpent: 0,
    dailyRewards: 0, bohEarned: 0,
    marketBuyVolume: 0, marketSellVolume: 0, marketProfit: 0,
    contractIncome: 0, xpGained: 0, levelsGained: 0,
    crashBets: 0, crashWon: 0, crashLost: 0,
    bjBets: 0, bjWon: 0, bjLost: 0,
  }
}

// ═══════════════════════════════════════════════
//  PLAYER GENERATION
// ═══════════════════════════════════════════════

function allocateSkills(points: number, milPct: number): SimPlayer['milSkills'] & SimPlayer['ecoSkills'] {
  const milPts = Math.floor(points * milPct)
  const ecoPts = points - milPts

  const milKeys = ['attack', 'critRate', 'critDamage', 'precision', 'stamina', 'hunger', 'armor', 'dodge'] as const
  const ecoKeys = ['work', 'entrepreneurship', 'production', 'prospection', 'industrialist'] as const

  const mil: any = {}; const eco: any = {}
  milKeys.forEach(k => mil[k] = 0); ecoKeys.forEach(k => eco[k] = 0)

  // Distribute military points (weighted toward combat stats)
  const milWeights = [3, 2, 2, 2, 1, 1, 1, 1] // attack, crit, critDmg, precision, etc.
  let totalMilW = milWeights.reduce((a, b) => a + b, 0)
  let remMil = milPts
  for (let i = 0; i < milKeys.length && remMil > 0; i++) {
    const target = Math.min(10, Math.floor(milPts * milWeights[i] / totalMilW))
    // Cost: sum(1..target) = target*(target+1)/2
    const cost = target * (target + 1) / 2
    if (cost <= remMil) { mil[milKeys[i]] = target; remMil -= cost }
    else {
      // Fill as much as possible
      let lvl = 0
      while (remMil >= lvl + 1 && lvl < 10) { lvl++; remMil -= lvl }
      mil[milKeys[i]] = lvl
    }
  }

  // Distribute economic points
  const ecoWeights = [3, 2, 2, 1, 1]
  let remEco = ecoPts
  for (let i = 0; i < ecoKeys.length && remEco > 0; i++) {
    const target = Math.min(10, Math.floor(ecoPts * ecoWeights[i] / ecoWeights.reduce((a, b) => a + b, 0)))
    let lvl = 0
    while (remEco >= lvl + 1 && lvl < target) { lvl++; remEco -= lvl }
    eco[ecoKeys[i]] = lvl
  }

  return { ...mil, ...eco }
}

function createPlayer(id: number, type: 'eco' | 'fighter'): SimPlayer {
  // Vary starting level: eco 5-15, fighter 8-18
  const level = type === 'eco' ? randInt(5, 15) : randInt(8, 18)
  const skillPoints = level * 4
  const milPct = type === 'fighter' ? 0.80 : 0.30
  const skills = allocateSkills(skillPoints, milPct)

  const maxStamina = 120 + (skills.stamina || 0) * 24
  const maxHunger = 6 + (skills.hunger || 0)
  const maxWork = 120 + (skills.work || 0) * 24
  const maxEnterprise = 120 + (skills.entrepreneurship || 0) * 18

  // Starting companies (eco: 3-5, fighter: 1-2)
  const compCount = type === 'eco' ? randInt(3, 5) : randInt(1, 2)
  const compTypes = ['bitcoin_miner', 'wheat_farm', 'fish_farm', 'steak_farm', 'bakery', 'oil_refinery']
  const companies: SimCompany[] = Array.from({ length: compCount }, () => ({
    type: compTypes[randInt(0, compTypes.length - 1)],
    level: randInt(1, type === 'eco' ? 5 : 3),
    productionProgress: 0,
    productionMax: 100,
  }))

  return {
    id, name: `${type === 'eco' ? 'E' : 'F'}${String(id).padStart(3, '0')}`, type,
    money: type === 'eco' ? randInt(300000, 800000) : randInt(200000, 500000),
    bitcoin: randInt(5, 20), oil: randInt(5000, 50000), materialX: randInt(5000, 50000),
    scrap: randInt(1000, 10000),
    bread: randInt(50, 200), sushi: randInt(30, 100), wagyu: randInt(10, 50),
    greenBullets: randInt(50, 200), blueBullets: randInt(30, 100),
    purpleBullets: randInt(10, 50), redBullets: randInt(5, 20),
    lootBoxes: randInt(0, 5), militaryBoxes: randInt(0, 3), badgesOfHonor: randInt(0, 5),
    stamina: maxStamina, maxStamina, hunger: maxHunger, maxHunger,
    work: maxWork, maxWork, enterprise: maxEnterprise, maxEnterprise,
    level, xp: 0, xpToNext: xpForLevel(level), skillPoints: 0,
    milSkills: {
      attack: skills.attack || 0, critRate: skills.critRate || 0,
      critDamage: skills.critDamage || 0, precision: skills.precision || 0,
      stamina: skills.stamina || 0, hunger: skills.hunger || 0,
      armor: skills.armor || 0, dodge: skills.dodge || 0,
    },
    ecoSkills: {
      work: skills.work || 0, entrepreneurship: skills.entrepreneurship || 0,
      production: skills.production || 0, prospection: skills.prospection || 0,
      industrialist: skills.industrialist || 0,
    },
    companies, equippedAmmo: type === 'fighter' ? 'green' : 'none',
    kpi: freshKPI(),
  }
}

// ═══════════════════════════════════════════════
//  COMBAT ENGINE (from stats.ts + playerStore.attack)
// ═══════════════════════════════════════════════

function computeDamage(p: SimPlayer): number {
  const ms = p.milSkills
  let baseDmg = 100 + ms.attack * 20
  const rawHitRate = 50 + ms.precision * 5
  const hitRate = Math.min(90, rawHitRate)
  const overflowCrit = Math.max(0, rawHitRate - 90) * 0.5
  let critRate = Math.min(66, 20 + ms.critRate * 4) + overflowCrit
  const critMult = 1.5 + (ms.critDamage * 20) / 200
  const armor = ms.armor * 5
  const dodge = 5 + ms.dodge * 3

  // Ammo multiplier
  let ammoMult = 1.0
  if (p.equippedAmmo === 'green' && p.greenBullets > 0) ammoMult = 1.1
  else if (p.equippedAmmo === 'blue' && p.blueBullets > 0) ammoMult = 1.2
  else if (p.equippedAmmo === 'purple' && p.purpleBullets > 0) ammoMult = 1.4
  else if (p.equippedAmmo === 'red' && p.redBullets > 0) { ammoMult = 1.4; critRate += 10 }

  // Hit check
  const didHit = Math.random() * 100 < hitRate
  const isCrit = Math.random() * 100 < critRate
  let mult = ammoMult
  if (isCrit) mult *= critMult
  let dmg = didHit ? Math.floor(baseDmg * mult) : Math.floor(baseDmg * mult * 0.66)

  // Armor mitigation
  const mit = armor / (armor + 100)
  dmg = Math.max(1, Math.floor(dmg * (1 - mit)))

  return Math.floor(deviate(dmg))
}

// ═══════════════════════════════════════════════
//  ACTION FUNCTIONS
// ═══════════════════════════════════════════════

function doAttack(p: SimPlayer): void {
  if (p.stamina < 10) return
  p.stamina -= 10
  const dmg = computeDamage(p)
  p.kpi.damageDealt += dmg
  p.kpi.attackCount++
  // Consume ammo
  if (p.equippedAmmo !== 'none') {
    const key = `${p.equippedAmmo}Bullets` as keyof SimPlayer
    if ((p[key] as number) > 0) (p as any)[key]--
    else p.equippedAmmo = 'none'
  }
  // XP
  gainXP(p, 25)
  // BOH: every 5000 damage → 1 BOH (simplified)
  const threshold = p.level <= 10 ? 2000 : p.level <= 20 ? 5000 : 10000
  if (p.kpi.damageDealt % threshold < dmg) { p.badgesOfHonor++; p.kpi.bohEarned++ }
  // 7% loot chance
  if (Math.random() < 0.07) p.lootBoxes++
}

function doWork(p: SimPlayer): void {
  if (p.work < 10) return
  p.work -= 10
  const earnings = Math.floor((1500 + p.ecoSkills.work * 200) * deviate(1.0))
  // 1% per skill level double pay
  const doubled = Math.random() < p.ecoSkills.work * 0.01
  const final = doubled ? earnings * 2 : earnings
  p.money += final; p.kpi.moneyEarned += final; p.kpi.workCount++
  gainXP(p, 8)
}

function doEnterprise(p: SimPlayer): void {
  if (p.enterprise < 10 || p.companies.length === 0) return
  p.enterprise -= 10
  const comp = p.companies[randInt(0, p.companies.length - 1)]
  const fill = Math.floor((10 + p.ecoSkills.production * 5) * deviate(1.0))
  const doubled = Math.random() < p.ecoSkills.entrepreneurship * 0.01
  comp.productionProgress += doubled ? fill * 2 : fill
  p.kpi.enterpriseCount++
  gainXP(p, 10)
}

function doProduce(p: SimPlayer): void {
  for (const comp of p.companies) {
    if (comp.productionProgress < comp.productionMax) continue
    const cycles = Math.floor(comp.productionProgress / comp.productionMax)
    comp.productionProgress -= cycles * comp.productionMax
    p.kpi.produceCount += cycles
    // Reward based on type
    for (let i = 0; i < cycles; i++) {
      switch (comp.type) {
        case 'bitcoin_miner': {
          const cash = randInt(2000, 8000) * comp.level
          p.money += cash; p.kpi.moneyEarned += cash
          if (Math.random() < 0.15 * comp.level) { p.bitcoin++; p.kpi.moneyEarned += 5000 }
          break
        }
        case 'wheat_farm': p.bread += randInt(5, 15) * comp.level; break
        case 'fish_farm': p.sushi += randInt(3, 10) * comp.level; break
        case 'steak_farm': p.wagyu += randInt(2, 6) * comp.level; break
        case 'bakery': { if (p.bread > 0) { p.bread--; const v = randInt(1500, 3000); p.money += v; p.kpi.moneyEarned += v } break }
        case 'oil_refinery': p.oil += randInt(100, 500) * comp.level; break
        default: { const v = randInt(1000, 5000); p.money += v; p.kpi.moneyEarned += v }
      }
    }
    gainXP(p, 5 * cycles)
  }
}

function eatFood(p: SimPlayer): boolean {
  if (p.hunger <= 0) return false
  if (p.wagyu > 0) { p.wagyu--; p.hunger--; p.stamina += Math.floor(p.maxStamina * 0.45); return true }
  if (p.sushi > 0) { p.sushi--; p.hunger--; p.stamina += Math.floor(p.maxStamina * 0.30); return true }
  if (p.bread > 0) { p.bread--; p.hunger--; p.stamina += Math.floor(p.maxStamina * 0.15); return true }
  return false
}

function doCasinoWheel(p: SimPlayer): void {
  // Eco: conservative $100K tier, Fighter: $250K-$500K
  let bet: number, bustPct: number, multipliers: number[], mWeights: number[]
  if (p.type === 'eco') {
    bet = 100_000; bustPct = 0.32
    multipliers = [1.5, 1.5, 2, 2, 3]; mWeights = [28, 10, 12, 6, 8]
  } else if (Math.random() < 0.5) {
    bet = 250_000; bustPct = 0.38
    multipliers = [1.5, 1.5, 2, 3, 5]; mWeights = [12, 10, 10, 8, 4]
  } else {
    bet = 500_000; bustPct = 0.45
    multipliers = [2, 2, 3, 5, 10]; mWeights = [10, 4, 8, 5, 3]
  }
  if (p.money < bet) return
  p.money -= bet; p.kpi.moneySpent += bet; p.kpi.casinoSpins++
  if (Math.random() < bustPct) {
    p.kpi.casinoLost += bet
  } else {
    // Pick weighted multiplier from the non-bust segments
    const totalW = mWeights.reduce((a, b) => a + b, 0)
    let roll = Math.random() * totalW; let idx = 0
    for (let i = 0; i < mWeights.length; i++) { roll -= mWeights[i]; if (roll <= 0) { idx = i; break } }
    const payout = Math.floor(bet * multipliers[idx])
    p.money += payout; p.kpi.casinoWon += payout; p.kpi.moneyEarned += payout
  }
}

function doBlackjack(p: SimPlayer): void {
  const bet = p.type === 'eco' ? 10_000 : randInt(1, 3) === 1 ? 100_000 : 50_000
  if (p.money < bet) return
  p.money -= bet; p.kpi.moneySpent += bet; p.kpi.bjBets++
  // Simplified: house edge ~2%, player wins ~48%, loses ~49%, push ~3%
  const roll = Math.random()
  if (roll < 0.03) { p.money += bet; /* push */ }
  else if (roll < 0.03 + 0.05) { const payout = Math.floor(bet * 2.5); p.money += payout; p.kpi.bjWon += payout; p.kpi.moneyEarned += payout } // BJ
  else if (roll < 0.03 + 0.05 + 0.43) { p.money += bet * 2; p.kpi.bjWon += bet * 2; p.kpi.moneyEarned += bet * 2 } // win
  else { p.kpi.bjLost += bet } // lose
}

function doCrash(p: SimPlayer): void {
  const bet = p.type === 'eco' ? 10_000 : randInt(50_000, 100_000)
  if (p.money < bet) return
  p.money -= bet; p.kpi.moneySpent += bet; p.kpi.crashBets++
  // House edge ~4%: crashPt = 0.96 / (1 - uniform), capped
  const u = Math.random()
  const crashPt = Math.min(100, 0.96 / (1 - u))
  const cashoutTarget = p.type === 'eco' ? 1.5 : 2.0 + Math.random()
  if (crashPt >= cashoutTarget) {
    const payout = Math.floor(bet * cashoutTarget)
    p.money += payout; p.kpi.crashWon += payout; p.kpi.moneyEarned += payout
  } else {
    p.kpi.crashLost += bet
  }
}

function doStockTrade(p: SimPlayer): void {
  // Buy or sell with ~50/50 chance, profit follows random walk
  const isBuy = Math.random() < 0.6
  const amount = randInt(50_000, 200_000)
  if (isBuy && p.money >= amount) {
    p.money -= amount; p.kpi.moneySpent += amount; p.kpi.stockBought += amount
  } else if (!isBuy && p.kpi.stockBought > 0) {
    // Sell: stock returns ~0.5-1.5% per day on average, +/- noise
    const returnPct = (Math.random() - 0.45) * 0.03 // slight positive bias
    const value = Math.floor(amount * (1 + returnPct))
    p.money += value; p.kpi.moneyEarned += value; p.kpi.stockSold += value
    p.kpi.stockProfit += value - amount
  }
}

function doWarBond(p: SimPlayer): void {
  const betAmt = p.type === 'eco' ? randInt(10_000, 50_000) : randInt(50_000, 200_000)
  if (p.money < betAmt) return
  p.money -= betAmt; p.kpi.moneySpent += betAmt; p.kpi.bondBets++
  const durIdx = randInt(0, 2)
  const mults = [1.5, 1.75, 2.0]
  // ~50% win rate
  if (Math.random() < 0.50) {
    const payout = Math.floor(betAmt * mults[durIdx])
    p.money += payout; p.kpi.bondWon += payout; p.kpi.moneyEarned += payout
  } else {
    p.kpi.bondLost += betAmt
  }
}

function doMarketTrade(p: SimPlayer): void {
  // Sell resources for money
  const resources: Array<{ key: keyof SimPlayer; basePrice: number }> = [
    { key: 'oil', basePrice: 0.5 }, { key: 'materialX', basePrice: 3.0 },
    { key: 'scrap', basePrice: 0.2 },
  ]
  const res = resources[randInt(0, resources.length - 1)]
  const qty = Math.min(randInt(100, 1000), (p[res.key] as number))
  if (qty <= 0) return
  const price = Math.floor(qty * res.basePrice * deviate(1.0) * 0.95) // 5% tax
  ;(p as any)[res.key] -= qty
  p.money += price; p.kpi.moneyEarned += price; p.kpi.marketSellVolume += qty; p.kpi.marketProfit += price
}

function doBountyActivity(p: SimPlayer, allPlayers: SimPlayer[]): void {
  if (p.type !== 'fighter') return
  // Place bounty 10% of the time
  if (Math.random() < 0.10 && p.money >= 50_000) {
    const amount = randInt(10_000, 100_000)
    p.money -= amount; p.kpi.moneySpent += amount; p.kpi.bountySpent += amount
  }
  // Claim bounty 5% of the time
  if (Math.random() < 0.05) {
    const reward = randInt(10_000, 100_000)
    p.money += reward; p.kpi.moneyEarned += reward; p.kpi.bountyEarned += reward
  }
}

function doContract(p: SimPlayer): void {
  if (Math.random() < 0.05) { // 5% chance per tick
    const reward = randInt(10_000, 50_000)
    p.money += reward; p.kpi.moneyEarned += reward; p.kpi.contractIncome += reward
  }
}

function doDailyReward(p: SimPlayer, day: number): void {
  const reward = DAILY_REWARDS[(day - 1) % 7]
  p.money += reward.money; p.bitcoin += reward.btc
  p.kpi.moneyEarned += reward.money; p.kpi.dailyRewards += reward.money
}

function doWarReward(p: SimPlayer): void {
  // Simulate getting war rewards based on participation
  if (p.kpi.attackCount === 0) return
  const won = Math.random() < 0.5
  if (won) {
    const reward = Math.floor(randInt(5_000, 60_000) * (p.type === 'fighter' ? 1.5 : 0.8))
    p.money += reward; p.kpi.moneyEarned += reward; p.kpi.warRewards += reward
  } else {
    const consolation = randInt(2_000, 15_000)
    p.money += consolation; p.kpi.moneyEarned += consolation; p.kpi.warRewards += consolation
  }
}

function gainXP(p: SimPlayer, amount: number): void {
  p.xp += amount; p.kpi.xpGained += amount
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext; p.level++; p.kpi.levelsGained++
    p.skillPoints += 4; p.xpToNext = xpForLevel(p.level)
  }
}

function regenBars(p: SimPlayer, isFullRecovery: boolean): void {
  if (isFullRecovery) {
    p.stamina = p.maxStamina; p.hunger = p.maxHunger; p.work = p.maxWork; p.enterprise = p.maxEnterprise
  } else {
    const rate = 1 / 24
    p.stamina = Math.min(p.maxStamina, p.stamina + p.maxStamina * rate)
    p.hunger = Math.min(p.maxHunger, p.hunger + p.maxHunger * rate)
    p.work = Math.min(p.maxWork, p.work + p.maxWork * rate)
    p.enterprise = Math.min(p.maxEnterprise, p.enterprise + p.maxEnterprise * rate)
  }
}

function companyTick(p: SimPlayer): void {
  for (const c of p.companies) {
    const effectiveLevel = Math.min(6, c.level)
    c.productionProgress += effectiveLevel
  }
}

// ═══════════════════════════════════════════════
//  DAILY PLAYER BEHAVIOR
// ═══════════════════════════════════════════════

function simulateTick(p: SimPlayer, tick: number, day: number, allPlayers: SimPlayer[]): void {
  const isFullRecovery = tick % FULL_RECOVERY_TICKS === 0
  regenBars(p, isFullRecovery)
  companyTick(p)

  if (p.type === 'eco') {
    // Priority: work → enterprise → produce → eat → light fight → market/stocks
    let workBudget = Math.min(5, Math.floor(p.work / 10))
    while (workBudget-- > 0 && p.work >= 10) doWork(p)
    let entBudget = Math.min(3, Math.floor(p.enterprise / 10))
    while (entBudget-- > 0 && p.enterprise >= 10 && p.companies.length > 0) doEnterprise(p)
    doProduce(p)
    while (p.hunger > 0 && p.stamina < p.maxStamina * 0.5 && (p.bread > 0 || p.sushi > 0 || p.wagyu > 0)) eatFood(p)
    // Light combat — eco players fight 1-2 times per tick max
    let fightBudget = Math.min(2, Math.floor(p.stamina / 10))
    while (fightBudget-- > 0 && p.stamina >= 10) doAttack(p)
    // Economic activities (periodic)
    if (tick % 4 === 0) doMarketTrade(p)
    if (tick % 8 === 0) doStockTrade(p)
    if (tick % 16 === 0) doCasinoWheel(p)
    if (tick % 32 === 0) doBlackjack(p)
    if (tick % 32 === 0) doWarBond(p)
    if (tick % 48 === 0) doCrash(p)
    doContract(p)
  } else {
    // Fighter: eat → fight ALL stamina → minimal work → aggressive gambling
    // Eat aggressively to maximize stamina
    while (p.hunger > 0 && p.stamina < p.maxStamina * 0.8 && (p.wagyu > 0 || p.sushi > 0 || p.bread > 0)) eatFood(p)
    // Fight until stamina depleted — fighters dump ALL stamina
    while (p.stamina >= 10) doAttack(p)
    // Minimal economy
    let fWorkBudget = Math.min(2, Math.floor(p.work / 10))
    while (fWorkBudget-- > 0 && p.work >= 10) doWork(p)
    if (p.enterprise >= 10 && p.companies.length > 0) doEnterprise(p)
    doProduce(p)
    // Aggressive gambling (more frequent than eco)
    if (tick % 4 === 0) doCasinoWheel(p)
    if (tick % 8 === 0) doBlackjack(p)
    if (tick % 6 === 0) doWarBond(p)
    if (tick % 12 === 0) doCrash(p)
    if (tick % 16 === 0) doStockTrade(p)
    doBountyActivity(p, allPlayers)
    doContract(p)
  }
}

// ═══════════════════════════════════════════════
//  MAIN SIMULATION
// ═══════════════════════════════════════════════

function runSimulation(): void {
  console.log('═══════════════════════════════════════════════════')
  console.log('  XWAR 15-Day Population Simulation')
  console.log('  100 Players: 66 Eco / 34 Fighter')
  console.log('═══════════════════════════════════════════════════\n')

  // Create players
  const players: SimPlayer[] = []
  for (let i = 0; i < ECO_COUNT; i++) players.push(createPlayer(i, 'eco'))
  for (let i = 0; i < FIGHTER_COUNT; i++) players.push(createPlayer(ECO_COUNT + i, 'fighter'))

  // Snapshot initial state
  const initialMoney = { eco: 0, fighter: 0 }
  players.forEach(p => { initialMoney[p.type] += p.money })

  // Run simulation
  for (let day = 1; day <= SIM_DAYS; day++) {
    // Daily reward at start of day
    players.forEach(p => doDailyReward(p, day))

    // 48 ticks per day
    for (let tick = 0; tick < TICKS_PER_DAY; tick++) {
      const globalTick = (day - 1) * TICKS_PER_DAY + tick
      players.forEach(p => simulateTick(p, globalTick, day, players))
    }

    // End of day: war rewards for active combatants
    players.forEach(p => doWarReward(p))

    if (day % 5 === 0 || day === SIM_DAYS) {
      console.log(`  Day ${day}/${SIM_DAYS} complete`)
    }
  }

  // ═══════ REPORT ═══════
  const eco = players.filter(p => p.type === 'eco')
  const fig = players.filter(p => p.type === 'fighter')

  const agg = (arr: SimPlayer[], fn: (p: SimPlayer) => number) => {
    const vals = arr.map(fn)
    const sum = vals.reduce((a, b) => a + b, 0)
    return { sum, avg: Math.floor(sum / arr.length), med: vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)] }
  }

  const fmt = (n: number) => n.toLocaleString()

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  KPI COMPARISON: ECO (66) vs FIGHTER (34)')
  console.log('═══════════════════════════════════════════════════\n')

  const rows: [string, string, string, string][] = [
    ['KPI', 'ECO (avg)', 'FIGHTER (avg)', 'RATIO (F/E)'],
    ['─'.repeat(30), '─'.repeat(14), '─'.repeat(14), '─'.repeat(12)],
  ]

  const addRow = (label: string, ecoVal: number, figVal: number) => {
    const ratio = ecoVal > 0 ? (figVal / ecoVal).toFixed(2) : '∞'
    rows.push([label.padEnd(30), fmt(Math.floor(ecoVal)).padStart(14), fmt(Math.floor(figVal)).padStart(14), String(ratio).padStart(12)])
  }

  const eA = (fn: (k: SimKPI) => number) => agg(eco, p => fn(p.kpi)).avg
  const fA = (fn: (k: SimKPI) => number) => agg(fig, p => fn(p.kpi)).avg

  addRow('💰 Money Earned (total)', eA(k => k.moneyEarned), fA(k => k.moneyEarned))
  addRow('💸 Money Spent (total)', eA(k => k.moneySpent), fA(k => k.moneySpent))
  addRow('💵 Net Money', eA(k => k.moneyEarned - k.moneySpent), fA(k => k.moneyEarned - k.moneySpent))
  addRow('📊 Final Balance', agg(eco, p => p.money).avg, agg(fig, p => p.money).avg)
  addRow('', 0, 0)
  addRow('⚔️  Damage Dealt', eA(k => k.damageDealt), fA(k => k.damageDealt))
  addRow('🗡️  Attack Count', eA(k => k.attackCount), fA(k => k.attackCount))
  addRow('🎖️  BOH Earned', eA(k => k.bohEarned), fA(k => k.bohEarned))
  addRow('🎁 Loot Boxes', agg(eco, p => p.lootBoxes).avg, agg(fig, p => p.lootBoxes).avg)
  addRow('', 0, 0)
  addRow('🔨 Work Actions', eA(k => k.workCount), fA(k => k.workCount))
  addRow('💼 Enterprise Actions', eA(k => k.enterpriseCount), fA(k => k.enterpriseCount))
  addRow('⚙️  Produce Actions', eA(k => k.produceCount), fA(k => k.produceCount))
  addRow('', 0, 0)
  addRow('🎰 Casino Wheel Spins', eA(k => k.casinoSpins), fA(k => k.casinoSpins))
  addRow('🎰 Casino Net P&L', eA(k => k.casinoWon - k.casinoLost), fA(k => k.casinoWon - k.casinoLost))
  addRow('🃏 Blackjack Hands', eA(k => k.bjBets), fA(k => k.bjBets))
  addRow('🃏 Blackjack Net P&L', eA(k => k.bjWon - k.bjLost), fA(k => k.bjWon - k.bjLost))
  addRow('🚀 Crash Rounds', eA(k => k.crashBets), fA(k => k.crashBets))
  addRow('🚀 Crash Net P&L', eA(k => k.crashWon - k.crashLost), fA(k => k.crashWon - k.crashLost))
  addRow('', 0, 0)
  addRow('📈 Stock Buy Volume', eA(k => k.stockBought), fA(k => k.stockBought))
  addRow('📉 Stock Profit', eA(k => k.stockProfit), fA(k => k.stockProfit))
  addRow('🔮 War Bond Bets', eA(k => k.bondBets), fA(k => k.bondBets))
  addRow('🔮 Bond Net P&L', eA(k => k.bondWon - k.bondLost), fA(k => k.bondWon - k.bondLost))
  addRow('', 0, 0)
  addRow('🏪 Market Sell Volume', eA(k => k.marketSellVolume), fA(k => k.marketSellVolume))
  addRow('🏪 Market Profit', eA(k => k.marketProfit), fA(k => k.marketProfit))
  addRow('🏆 War Rewards', eA(k => k.warRewards), fA(k => k.warRewards))
  addRow('🎯 Bounty Earned', eA(k => k.bountyEarned), fA(k => k.bountyEarned))
  addRow('🎯 Bounty Spent', eA(k => k.bountySpent), fA(k => k.bountySpent))
  addRow('📜 Contract Income', eA(k => k.contractIncome), fA(k => k.contractIncome))
  addRow('🎁 Daily Rewards', eA(k => k.dailyRewards), fA(k => k.dailyRewards))
  addRow('', 0, 0)
  addRow('⬆️  XP Gained', eA(k => k.xpGained), fA(k => k.xpGained))
  addRow('⬆️  Levels Gained', eA(k => k.levelsGained), fA(k => k.levelsGained))
  addRow('📊 Final Level', agg(eco, p => p.level).avg, agg(fig, p => p.level).avg)

  for (const row of rows) console.log(`  ${row.join('  ')}`)

  // ═══════ PARTICIPATION ═══════
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  PARTICIPATION RATES')
  console.log('═══════════════════════════════════════════════════\n')

  const combatPart = (arr: SimPlayer[]) => arr.filter(p => p.kpi.attackCount > 0).length / arr.length * 100
  const workPart = (arr: SimPlayer[]) => arr.filter(p => p.kpi.workCount > 0).length / arr.length * 100
  const casinoPart = (arr: SimPlayer[]) => arr.filter(p => p.kpi.casinoSpins > 0).length / arr.length * 100
  const stockPart = (arr: SimPlayer[]) => arr.filter(p => p.kpi.stockBought > 0).length / arr.length * 100

  console.log(`  Combat:  Eco ${combatPart(eco).toFixed(0)}% | Fighter ${combatPart(fig).toFixed(0)}%`)
  console.log(`  Work:    Eco ${workPart(eco).toFixed(0)}% | Fighter ${workPart(fig).toFixed(0)}%`)
  console.log(`  Casino:  Eco ${casinoPart(eco).toFixed(0)}% | Fighter ${casinoPart(fig).toFixed(0)}%`)
  console.log(`  Stocks:  Eco ${stockPart(eco).toFixed(0)}% | Fighter ${stockPart(fig).toFixed(0)}%`)

  // ═══════ BALANCE ASSESSMENT ═══════
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  BALANCE ASSESSMENT')
  console.log('═══════════════════════════════════════════════════\n')

  const ecoNetMoney = eA(k => k.moneyEarned - k.moneySpent)
  const figNetMoney = fA(k => k.moneyEarned - k.moneySpent)
  const ecoDmg = eA(k => k.damageDealt)
  const figDmg = fA(k => k.damageDealt)

  console.log(`  Money Earning Ratio (Fighter/Eco): ${(figNetMoney / Math.max(1, ecoNetMoney)).toFixed(2)}x`)
  console.log(`  Damage Ratio (Fighter/Eco):        ${(figDmg / Math.max(1, ecoDmg)).toFixed(2)}x`)
  console.log(`  Combat Participation Gap:           ${(combatPart(fig) - combatPart(eco)).toFixed(0)}pp`)
  console.log('')

  if (figDmg / Math.max(1, ecoDmg) > 5) console.log('  ⚠️  FIGHTERS deal 5x+ more damage — expected, fighters are combat-focused')
  else if (figDmg / Math.max(1, ecoDmg) > 3) console.log('  ✅ FIGHTERS deal 3-5x more damage — good combat specialization benefit')
  else console.log('  ⚠️  FIGHTERS deal <3x damage — combat specialization may be too weak')

  if (ecoNetMoney > figNetMoney * 1.5) console.log('  ✅ ECO players earn 1.5x+ more net money — expected economic advantage')
  else if (ecoNetMoney > figNetMoney) console.log('  ✅ ECO players earn more net money — economy works')
  else console.log('  ⚠️  FIGHTERS earn more net money than ECO — economy may be unbalanced')

  // ═══════ TOP PLAYERS ═══════
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  TOP 5 DAMAGE DEALERS')
  console.log('═══════════════════════════════════════════════════\n')
  const topDmg = [...players].sort((a, b) => b.kpi.damageDealt - a.kpi.damageDealt).slice(0, 5)
  topDmg.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.type.toUpperCase()}) — ${fmt(p.kpi.damageDealt)} dmg, ${fmt(p.kpi.attackCount)} attacks, Lv${p.level}`))

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  TOP 5 MONEY EARNERS')
  console.log('═══════════════════════════════════════════════════\n')
  const topMoney = [...players].sort((a, b) => b.kpi.moneyEarned - a.kpi.moneyEarned).slice(0, 5)
  topMoney.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.type.toUpperCase()}) — $${fmt(p.kpi.moneyEarned)} earned, Balance: $${fmt(p.money)}, Lv${p.level}`))

  // Write markdown report
  writeReport(players, eco, fig, initialMoney)
}

// ═══════════════════════════════════════════════
//  MARKDOWN REPORT
// ═══════════════════════════════════════════════

function writeReport(players: SimPlayer[], eco: SimPlayer[], fig: SimPlayer[], initialMoney: { eco: number; fighter: number }): void {
  const fmt = (n: number) => Math.floor(n).toLocaleString()
  const eA = (fn: (k: SimKPI) => number) => { const v = eco.map(p => fn(p.kpi)); return Math.floor(v.reduce((a, b) => a + b, 0) / v.length) }
  const fA = (fn: (k: SimKPI) => number) => { const v = fig.map(p => fn(p.kpi)); return Math.floor(v.reduce((a, b) => a + b, 0) / v.length) }
  const eS = (fn: (k: SimKPI) => number) => eco.map(p => fn(p.kpi)).reduce((a, b) => a + b, 0)
  const fS = (fn: (k: SimKPI) => number) => fig.map(p => fn(p.kpi)).reduce((a, b) => a + b, 0)

  const ratio = (e: number, f: number) => e > 0 ? (f / e).toFixed(2) : '∞'

  const md = `# XWAR 15-Day Population Simulation Report

> **100 Players** — 66 Eco (66%) / 34 Fighter (34%)
> **Duration:** 15 in-game days (${SIM_DAYS * TICKS_PER_DAY} ticks)

## 💰 Economy Overview

| Metric | ECO (avg/player) | FIGHTER (avg/player) | F/E Ratio |
|--------|------------------:|---------------------:|----------:|
| Money Earned | $${fmt(eA(k=>k.moneyEarned))} | $${fmt(fA(k=>k.moneyEarned))} | ${ratio(eA(k=>k.moneyEarned), fA(k=>k.moneyEarned))} |
| Money Spent | $${fmt(eA(k=>k.moneySpent))} | $${fmt(fA(k=>k.moneySpent))} | ${ratio(eA(k=>k.moneySpent), fA(k=>k.moneySpent))} |
| **Net Money** | **$${fmt(eA(k=>k.moneyEarned-k.moneySpent))}** | **$${fmt(fA(k=>k.moneyEarned-k.moneySpent))}** | **${ratio(eA(k=>k.moneyEarned-k.moneySpent), fA(k=>k.moneyEarned-k.moneySpent))}** |
| Final Balance | $${fmt(eco.reduce((s,p)=>s+p.money,0)/eco.length)} | $${fmt(fig.reduce((s,p)=>s+p.money,0)/fig.length)} | |

## ⚔️ Combat

| Metric | ECO (avg) | FIGHTER (avg) | F/E Ratio |
|--------|----------:|--------------:|----------:|
| Damage Dealt | ${fmt(eA(k=>k.damageDealt))} | ${fmt(fA(k=>k.damageDealt))} | ${ratio(eA(k=>k.damageDealt), fA(k=>k.damageDealt))} |
| Attack Count | ${fmt(eA(k=>k.attackCount))} | ${fmt(fA(k=>k.attackCount))} | ${ratio(eA(k=>k.attackCount), fA(k=>k.attackCount))} |
| Avg Dmg/Attack | ${fmt(eA(k=>k.damageDealt)/Math.max(1,eA(k=>k.attackCount)))} | ${fmt(fA(k=>k.damageDealt)/Math.max(1,fA(k=>k.attackCount)))} | |
| BOH Earned | ${fmt(eA(k=>k.bohEarned))} | ${fmt(fA(k=>k.bohEarned))} | ${ratio(eA(k=>k.bohEarned), fA(k=>k.bohEarned))} |
| War Rewards | $${fmt(eA(k=>k.warRewards))} | $${fmt(fA(k=>k.warRewards))} | ${ratio(eA(k=>k.warRewards), fA(k=>k.warRewards))} |

## 🏭 Production & Work

| Metric | ECO (avg) | FIGHTER (avg) | F/E Ratio |
|--------|----------:|--------------:|----------:|
| Work Actions | ${fmt(eA(k=>k.workCount))} | ${fmt(fA(k=>k.workCount))} | ${ratio(eA(k=>k.workCount), fA(k=>k.workCount))} |
| Enterprise Actions | ${fmt(eA(k=>k.enterpriseCount))} | ${fmt(fA(k=>k.enterpriseCount))} | ${ratio(eA(k=>k.enterpriseCount), fA(k=>k.enterpriseCount))} |
| Produce Actions | ${fmt(eA(k=>k.produceCount))} | ${fmt(fA(k=>k.produceCount))} | ${ratio(eA(k=>k.produceCount), fA(k=>k.produceCount))} |

## 🎰 Gambling

| Metric | ECO (avg) | FIGHTER (avg) | F/E Ratio |
|--------|----------:|--------------:|----------:|
| Casino Wheel Spins | ${fmt(eA(k=>k.casinoSpins))} | ${fmt(fA(k=>k.casinoSpins))} | ${ratio(eA(k=>k.casinoSpins), fA(k=>k.casinoSpins))} |
| Casino Net P&L | $${fmt(eA(k=>k.casinoWon-k.casinoLost))} | $${fmt(fA(k=>k.casinoWon-k.casinoLost))} | |
| Blackjack Hands | ${fmt(eA(k=>k.bjBets))} | ${fmt(fA(k=>k.bjBets))} | ${ratio(eA(k=>k.bjBets), fA(k=>k.bjBets))} |
| Blackjack Net P&L | $${fmt(eA(k=>k.bjWon-k.bjLost))} | $${fmt(fA(k=>k.bjWon-k.bjLost))} | |
| Crash Rounds | ${fmt(eA(k=>k.crashBets))} | ${fmt(fA(k=>k.crashBets))} | ${ratio(eA(k=>k.crashBets), fA(k=>k.crashBets))} |
| Crash Net P&L | $${fmt(eA(k=>k.crashWon-k.crashLost))} | $${fmt(fA(k=>k.crashWon-k.crashLost))} | |

## 📈 Stocks & Bonds

| Metric | ECO (avg) | FIGHTER (avg) | F/E Ratio |
|--------|----------:|--------------:|----------:|
| Stock Buy Volume | $${fmt(eA(k=>k.stockBought))} | $${fmt(fA(k=>k.stockBought))} | ${ratio(eA(k=>k.stockBought), fA(k=>k.stockBought))} |
| Stock Profit | $${fmt(eA(k=>k.stockProfit))} | $${fmt(fA(k=>k.stockProfit))} | |
| Bond Bets | ${fmt(eA(k=>k.bondBets))} | ${fmt(fA(k=>k.bondBets))} | ${ratio(eA(k=>k.bondBets), fA(k=>k.bondBets))} |
| Bond Net P&L | $${fmt(eA(k=>k.bondWon-k.bondLost))} | $${fmt(fA(k=>k.bondWon-k.bondLost))} | |

## 🏪 Market & Contracts

| Metric | ECO (avg) | FIGHTER (avg) | F/E Ratio |
|--------|----------:|--------------:|----------:|
| Market Sell Volume | ${fmt(eA(k=>k.marketSellVolume))} | ${fmt(fA(k=>k.marketSellVolume))} | ${ratio(eA(k=>k.marketSellVolume), fA(k=>k.marketSellVolume))} |
| Market Profit | $${fmt(eA(k=>k.marketProfit))} | $${fmt(fA(k=>k.marketProfit))} | |
| Bounty Earned | $${fmt(eA(k=>k.bountyEarned))} | $${fmt(fA(k=>k.bountyEarned))} | |
| Bounty Spent | $${fmt(eA(k=>k.bountySpent))} | $${fmt(fA(k=>k.bountySpent))} | |
| Contract Income | $${fmt(eA(k=>k.contractIncome))} | $${fmt(fA(k=>k.contractIncome))} | |
| Daily Rewards | $${fmt(eA(k=>k.dailyRewards))} | $${fmt(fA(k=>k.dailyRewards))} | |

## ⬆️ Progression

| Metric | ECO (avg) | FIGHTER (avg) |
|--------|----------:|--------------:|
| XP Gained | ${fmt(eA(k=>k.xpGained))} | ${fmt(fA(k=>k.xpGained))} |
| Levels Gained | ${fmt(eA(k=>k.levelsGained))} | ${fmt(fA(k=>k.levelsGained))} |
| Final Level | ${fmt(Math.floor(eco.reduce((s,p)=>s+p.level,0)/eco.length))} | ${fmt(Math.floor(fig.reduce((s,p)=>s+p.level,0)/fig.length))} |

## 🏆 Aggregate Totals (group sum over 15 days)

| Metric | ECO (66 players) | FIGHTER (34 players) |
|--------|------------------:|---------------------:|
| Total Damage | ${fmt(eS(k=>k.damageDealt))} | ${fmt(fS(k=>k.damageDealt))} |
| Total Money Earned | $${fmt(eS(k=>k.moneyEarned))} | $${fmt(fS(k=>k.moneyEarned))} |
| Total Casino P&L | $${fmt(eS(k=>k.casinoWon+k.bjWon+k.crashWon-k.casinoLost-k.bjLost-k.crashLost))} | $${fmt(fS(k=>k.casinoWon+k.bjWon+k.crashWon-k.casinoLost-k.bjLost-k.crashLost))} |
| Total Work Actions | ${fmt(eS(k=>k.workCount))} | ${fmt(fS(k=>k.workCount))} |
| Total Attacks | ${fmt(eS(k=>k.attackCount))} | ${fmt(fS(k=>k.attackCount))} |

---
*Generated by XWAR 15-Day Simulation — ${new Date().toISOString()}*
`

  const reportPath = path.resolve(__dirname2, 'sim_15day_report.md')
  fs.writeFileSync(reportPath, md, 'utf-8')
  console.log(`\n  📄 Report written to: ${reportPath}`)
}

// Run it
runSimulation()
