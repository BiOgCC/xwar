// ══════════════════════════════════════════════════════════════
// DETERMINISTIC FLOW SIMULATOR — AI Agent Strategies
// All decisions are deterministic. Zero Math.random().
// ══════════════════════════════════════════════════════════════

import { computePlayerCombatStats, getWorkEarnings, getRecruitCost, DIVISION_TEMPLATES, AVG_STAR_MODS } from './data'
import type { DivisionType } from './data'
import type { SimAgent, SimDivision, AgentStrategy } from './types'
import type { SimMarket } from './market-sim'

let _agentCounter = 0
let _divCounter = 0

// ── Agent Factory ──

export function createAgent(countryCode: string, strategy: AgentStrategy, level: number): SimAgent {
  _agentCounter++
  const skillPoints = level * 4
  const skills = distributeSkills(strategy, skillPoints)
  const combatStats = computePlayerCombatStats({ ...skills, hunger: 0 })

  return {
    id: `agent_${_agentCounter}`,
    name: `${strategy}_${countryCode}_${_agentCounter}`,
    countryCode, strategy, level,
    money: 50000 + level * 10000,
    oil: 5000, materialX: 2000, scrap: 3000, bitcoin: 5,
    bread: 50, sushi: 20, wagyu: 10,
    wheat: 200, fish: 100, steak: 100,
    greenBullets: 100, blueBullets: 50, purpleBullets: 20, redBullets: 5,
    lootBoxes: 3, militaryBoxes: 2, badgesOfHonor: 3, staminaPills: 0,
    stamina: 100, maxStamina: 100,
    hunger: 5, maxHunger: 5,
    work: 100, maxWork: 100,
    entrepreneurship: 100, maxEntrepreneurship: 100,
    productionBar: 0, productionBarMax: 100,
    companiesOwned: strategy === 'economy' ? 3 : strategy === 'balanced' ? 2 : 1,
    combatStats, skills,
    divisions: [],
    totalDamageDealt: 0, totalMoneyEarned: 0, totalMoneySpent: 0,
    totalItemsProduced: 0, totalDivisionsLost: 0, totalDivisionsRecruited: 0,
    totalBattlesWon: 0, totalBattlesLost: 0,
  }
}

function distributeSkills(strategy: AgentStrategy, points: number) {
  const s = { attack: 0, critRate: 0, critDamage: 0, precision: 0, armor: 0, dodge: 0, stamina: 0, production: 0, work: 0, prospection: 0, industrialist: 0 }
  if (strategy === 'war') {
    const combat = Math.floor(points * 0.7), econ = points - combat
    s.attack = Math.floor(combat * 0.30); s.critRate = Math.floor(combat * 0.20)
    s.critDamage = Math.floor(combat * 0.20); s.precision = Math.floor(combat * 0.15)
    s.armor = Math.floor(combat * 0.10); s.dodge = combat - s.attack - s.critRate - s.critDamage - s.precision - s.armor
    s.production = Math.floor(econ * 0.5); s.work = econ - s.production
  } else if (strategy === 'economy') {
    const combat = Math.floor(points * 0.3), econ = points - combat
    s.attack = Math.floor(combat * 0.5); s.armor = combat - s.attack
    s.production = Math.floor(econ * 0.30); s.work = Math.floor(econ * 0.25)
    s.industrialist = Math.floor(econ * 0.20); s.prospection = econ - s.production - s.work - s.industrialist
  } else {
    const half = Math.floor(points * 0.5), econ = points - half
    s.attack = Math.floor(half * 0.25); s.critRate = Math.floor(half * 0.20)
    s.critDamage = Math.floor(half * 0.15); s.precision = Math.floor(half * 0.15)
    s.armor = Math.floor(half * 0.15); s.dodge = half - s.attack - s.critRate - s.critDamage - s.precision - s.armor
    s.production = Math.floor(econ * 0.35); s.work = Math.floor(econ * 0.35)
    s.industrialist = econ - s.production - s.work
  }
  return s
}

// ── Division Factory (deterministic: always uses AVG_STAR_MODS) ──

export function recruitDivision(agent: SimAgent, type: DivisionType, day: number): SimDivision | null {
  const template = DIVISION_TEMPLATES[type]
  if (!template) return null
  const cost = getRecruitCost(type)
  if (agent.money < cost.money || agent.oil < cost.oil || agent.materialX < cost.materialX || agent.scrap < cost.scrap) return null

  agent.money -= cost.money; agent.oil -= cost.oil; agent.materialX -= cost.materialX; agent.scrap -= cost.scrap
  agent.totalMoneySpent += cost.money

  const maxHealth = Math.floor(template.healthMult * agent.maxStamina)

  const div: SimDivision = {
    id: `div_${++_divCounter}`, type, ownerId: agent.id, countryCode: agent.countryCode,
    health: maxHealth, maxHealth, manpower: template.manpowerCost, maxManpower: template.manpowerCost,
    experience: 0, status: 'ready',
    starModifiers: { ...AVG_STAR_MODS },  // Deterministic: every div gets average star quality
    killCount: 0, battlesSurvived: 0, dayRecruited: day, totalDamageDealt: 0, upkeepPaid: 0,
  }
  agent.divisions.push(div)
  agent.totalDivisionsRecruited++
  return div
}

// ── Agent Daily Actions (fully deterministic) ──

export interface DayEconomyTracking {
  moneyFromWork: number; moneyFromProduction: number; moneyFromDailyLogin: number
  moneySpentRecruitment: number; moneySpentUpkeep: number; moneySpentHeal: number
  moneySpentFood: number; moneySpentCompanyMaint: number
  itemsProduced: number; divisionsRecruited: number
}

export function agentTickDay(agent: SimAgent, market: SimMarket, day: number): DayEconomyTracking {
  const t: DayEconomyTracking = {
    moneyFromWork: 0, moneyFromProduction: 0, moneyFromDailyLogin: 0,
    moneySpentRecruitment: 0, moneySpentUpkeep: 0, moneySpentHeal: 0,
    moneySpentFood: 0, moneySpentCompanyMaint: 0,
    itemsProduced: 0, divisionsRecruited: 0,
  }

  // 1. Regen bars
  agent.stamina = agent.maxStamina; agent.hunger = agent.maxHunger
  agent.work = agent.maxWork; agent.entrepreneurship = agent.maxEntrepreneurship

  // 2. Daily login (deterministic: fixed weekly pattern)
  const loginDay = ((day - 1) % 7) + 1
  const loginReward = loginDay === 7 ? 50000 : 10000 + (loginDay - 1) * 5000
  agent.money += loginReward; agent.totalMoneyEarned += loginReward; t.moneyFromDailyLogin = loginReward

  // 3. Work (10 actions/day, deterministic earn)
  const workActions = Math.floor(agent.work / 10)
  const earnPerWork = getWorkEarnings(agent.skills.work)
  for (let i = 0; i < workActions; i++) {
    agent.money += earnPerWork; agent.totalMoneyEarned += earnPerWork; t.moneyFromWork += earnPerWork
    agent.productionBar = Math.min(agent.productionBarMax, agent.productionBar + 20 + agent.skills.production * 2)
  }
  agent.work = 0

  // 4. Production (deterministic: expected bitcoin per production cycle)
  while (agent.productionBar >= agent.productionBarMax) {
    agent.productionBar -= agent.productionBarMax; agent.totalItemsProduced++; t.itemsProduced++
    // Deterministic: expected bitcoin = industrialist * 0.05 BTC per cycle
    agent.bitcoin += agent.skills.industrialist * 0.05
    const prodMoney = 1000 + agent.skills.production * 200
    agent.money += prodMoney; agent.totalMoneyEarned += prodMoney; t.moneyFromProduction += prodMoney
  }

  // 5. Eat food (deterministic: always eat all available hunger)
  const mealsEaten = Math.min(agent.hunger, agent.bread)
  agent.bread -= mealsEaten; agent.hunger -= mealsEaten; agent.stamina += mealsEaten * 10
  t.moneySpentFood += mealsEaten * market.getPrice('bread')

  // 6. Company maintenance (deterministic: fixed cost per level)
  const maintCost = [0, 500, 1500, 5000, 15000, 40000, 80000, 150000]
  for (let c = 0; c < agent.companiesOwned; c++) {
    const cost = maintCost[Math.min(3, c + 1)] || 500
    if (agent.money >= cost) { agent.money -= cost; agent.totalMoneySpent += cost; t.moneySpentCompanyMaint += cost }
  }

  // 7. Division upkeep (deterministic: exact oil/matX per division)
  agent.divisions.filter(d => d.status !== 'destroyed').forEach(d => {
    const tmpl = DIVISION_TEMPLATES[d.type]
    if (!tmpl) return
    const oilCost = tmpl.upkeepCost.oil, matCost = tmpl.upkeepCost.materialX
    if (agent.oil >= oilCost && agent.materialX >= matCost) {
      agent.oil -= oilCost; agent.materialX -= matCost
      const costValue = oilCost * market.getPrice('oil') + matCost * market.getPrice('materialX')
      d.upkeepPaid += costValue; t.moneySpentUpkeep += costValue
    }
  })

  // 8. Heal (deterministic: always heal, fixed cost per missing HP)
  agent.divisions.filter(d => d.status !== 'destroyed' && d.health < d.maxHealth).forEach(d => {
    const healCost = Math.floor((d.maxHealth - d.health) * 15)
    if (agent.money >= healCost) { agent.money -= healCost; agent.totalMoneySpent += healCost; t.moneySpentHeal += healCost; d.health = d.maxHealth }
  })

  // 9. Recruitment (deterministic: recruit best affordable div if below target)
  const readyDivs = agent.divisions.filter(d => d.status === 'ready')
  const targetCount = agent.strategy === 'war' ? Math.floor(agent.level / 5) + 4
    : agent.strategy === 'balanced' ? Math.floor(agent.level / 5) + 2
    : Math.max(1, Math.floor(agent.level / 5))

  if (readyDivs.length < targetCount) {
    const priority = getRecruitPriority(agent.strategy, agent.level)
    for (const divType of priority) {
      const cost = getRecruitCost(divType)
      if (agent.money >= cost.money * 1.5) {
        const div = recruitDivision(agent, divType, day)
        if (div) { t.moneySpentRecruitment += cost.money; t.divisionsRecruited++; break }
      }
    }
  }

  // 10. Market: buy resources if low (deterministic thresholds)
  if (agent.oil < 1000 && agent.money > 5000) {
    const amt = 500, cost = amt * market.getPrice('oil')
    if (agent.money >= cost) {
      agent.money -= cost; agent.oil += amt
      market.placeOrder({ type: 'buy', resourceId: 'oil', amount: amt, pricePerUnit: market.getPrice('oil'), agentId: agent.id, countryCode: agent.countryCode })
    }
  }
  if (agent.materialX < 500 && agent.money > 5000) {
    const amt = 200, cost = amt * market.getPrice('materialX')
    if (agent.money >= cost) {
      agent.money -= cost; agent.materialX += amt
      market.placeOrder({ type: 'buy', resourceId: 'materialX', amount: amt, pricePerUnit: market.getPrice('materialX'), agentId: agent.id, countryCode: agent.countryCode })
    }
  }
  if (agent.bread < 20 && agent.money > 1000) {
    const amt = 30, cost = amt * market.getPrice('bread')
    if (agent.money >= cost) {
      agent.money -= cost; agent.bread += amt
      market.placeOrder({ type: 'buy', resourceId: 'bread', amount: amt, pricePerUnit: market.getPrice('bread'), agentId: agent.id, countryCode: agent.countryCode })
    }
  }
  if (agent.scrap < 500 && agent.money > 3000) {
    const amt = 300, cost = amt * market.getPrice('scrap')
    if (agent.money >= cost) {
      agent.money -= cost; agent.scrap += amt
      market.placeOrder({ type: 'buy', resourceId: 'scrap', amount: amt, pricePerUnit: market.getPrice('scrap'), agentId: agent.id, countryCode: agent.countryCode })
    }
  }

  return t
}

function getRecruitPriority(strategy: AgentStrategy, level: number): DivisionType[] {
  if (strategy === 'war') {
    if (level >= 20) return ['submarine', 'jet', 'warship', 'tank', 'assault', 'sniper', 'rpg']
    if (level >= 15) return ['tank', 'jet', 'jeep', 'assault', 'sniper', 'rpg']
    if (level >= 10) return ['tank', 'jeep', 'assault', 'sniper', 'rpg', 'recon']
    return ['assault', 'rpg', 'recon', 'sniper']
  }
  if (strategy === 'economy') return ['recon', 'assault']
  // balanced
  if (level >= 20) return ['tank', 'jet', 'assault', 'sniper', 'jeep']
  if (level >= 15) return ['tank', 'assault', 'sniper', 'jeep', 'recon']
  return ['assault', 'recon', 'sniper']
}
