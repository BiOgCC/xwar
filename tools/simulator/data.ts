// ══════════════════════════════════════════════════════════════
// DETERMINISTIC FLOW SIMULATOR — Standalone Game Data
// All combat uses EXPECTED VALUES. Zero randomness.
// ══════════════════════════════════════════════════════════════

// ── Division Types & Templates ──

export type DivisionType = 'recon' | 'assault' | 'sniper' | 'rpg' | 'jeep' | 'tank' | 'jet' | 'warship' | 'submarine'

export interface DivisionTemplate {
  id: DivisionType
  name: string
  category: 'land' | 'air' | 'naval'
  group: 'infantry' | 'mechanized'
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  manpowerCost: number
  recruitCost: { money: number; oil: number; materialX: number; scrap: number }
  upkeepCost: { oil: number; materialX: number }
  attackSpeed: number
}

export const DIVISION_TEMPLATES: Record<DivisionType, DivisionTemplate> = {
  recon: {
    id: 'recon', name: 'Recon Squad', category: 'land', group: 'infantry',
    atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 1.50,
    healthMult: 24.0, dodgeMult: 1.30, armorMult: 1.30,
    manpowerCost: 200,
    recruitCost: { money: 40000, oil: 400, materialX: 150, scrap: 200 },
    upkeepCost: { oil: 40, materialX: 15 },
    attackSpeed: 1.5,
  },
  assault: {
    id: 'assault', name: 'Assault Infantry', category: 'land', group: 'infantry',
    atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 1.60,
    healthMult: 28.8, dodgeMult: 0.90, armorMult: 1.30,
    manpowerCost: 350,
    recruitCost: { money: 60000, oil: 600, materialX: 250, scrap: 350 },
    upkeepCost: { oil: 60, materialX: 25 },
    attackSpeed: 1,
  },
  sniper: {
    id: 'sniper', name: 'Sniper Division', category: 'land', group: 'infantry',
    atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.56, critDmgMult: 2.50,
    healthMult: 24.0, dodgeMult: 1.60, armorMult: 1.20,
    manpowerCost: 150,
    recruitCost: { money: 80000, oil: 500, materialX: 300, scrap: 400 },
    upkeepCost: { oil: 50, materialX: 30 },
    attackSpeed: 0.6,
  },
  rpg: {
    id: 'rpg', name: 'RPG Squadron', category: 'land', group: 'infantry',
    atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 2.00,
    healthMult: 30.0, dodgeMult: 0.70, armorMult: 1.30,
    manpowerCost: 250,
    recruitCost: { money: 100000, oil: 800, materialX: 400, scrap: 500 },
    upkeepCost: { oil: 80, materialX: 40 },
    attackSpeed: 0.8,
  },
  jeep: {
    id: 'jeep', name: 'Recon Jeeps', category: 'land', group: 'mechanized',
    atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 1.70,
    healthMult: 30.0, dodgeMult: 1.50, armorMult: 1.50,
    manpowerCost: 150,
    recruitCost: { money: 100000, oil: 1500, materialX: 600, scrap: 400 },
    upkeepCost: { oil: 150, materialX: 60 },
    attackSpeed: 1.3,
  },
  tank: {
    id: 'tank', name: 'Tank Battalion', category: 'land', group: 'mechanized',
    atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 1.80,
    healthMult: 36.0, dodgeMult: 0.80, armorMult: 2.00,
    manpowerCost: 200,
    recruitCost: { money: 150000, oil: 2500, materialX: 1000, scrap: 600 },
    upkeepCost: { oil: 250, materialX: 100 },
    attackSpeed: 0.5,
  },
  jet: {
    id: 'jet', name: 'Jet Fighters', category: 'air', group: 'mechanized',
    atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.75, critDmgMult: 2.80,
    healthMult: 26.0, dodgeMult: 1.40, armorMult: 1.20,
    manpowerCost: 100,
    recruitCost: { money: 200000, oil: 3000, materialX: 1200, scrap: 700 },
    upkeepCost: { oil: 300, materialX: 120 },
    attackSpeed: 0.7,
  },
  warship: {
    id: 'warship', name: 'Warship Fleet', category: 'naval', group: 'mechanized',
    atkDmgMult: 0.30, hitRate: 0.60, critRateMult: 1.35, critDmgMult: 2.20,
    healthMult: 40.0, dodgeMult: 0.70, armorMult: 2.50,
    manpowerCost: 250,
    recruitCost: { money: 250000, oil: 4000, materialX: 1500, scrap: 800 },
    upkeepCost: { oil: 400, materialX: 150 },
    attackSpeed: 0.4,
  },
  submarine: {
    id: 'submarine', name: 'Submarine Fleet', category: 'naval', group: 'mechanized',
    atkDmgMult: 0.35, hitRate: 0.85, critRateMult: 1.50, critDmgMult: 2.50,
    healthMult: 50.0, dodgeMult: 1.20, armorMult: 3.00,
    manpowerCost: 300,
    recruitCost: { money: 300000, oil: 6000, materialX: 2500, scrap: 1200 },
    upkeepCost: { oil: 600, materialX: 250 },
    attackSpeed: 0.3,
  },
}

// ── Player Combat Stats ──

export interface PlayerCombatStats {
  attackDamage: number
  critRate: number            // percentage 0–100
  critMultiplier: number      // e.g. 1.5
  armorBlock: number
  dodgeChance: number         // percentage 0–100
  hitRate: number             // percentage 0–100 (capped 90)
  overflowCrit: number        // bonus crit from hit>90
}

export interface SkillLevels {
  attack: number; critRate: number; critDamage: number; precision: number
  stamina: number; hunger: number; armor: number; dodge: number
}

export function computePlayerCombatStats(skills: SkillLevels): PlayerCombatStats {
  const rawHitRate = 50 + skills.precision * 5
  const overflowCrit = Math.max(0, rawHitRate - 90) * 0.5
  return {
    attackDamage: 100 + skills.attack * 20,
    critRate: 10 + skills.critRate * 5,
    critMultiplier: 1.5 + (skills.critDamage * 20) / 200,
    armorBlock: skills.armor * 5,
    dodgeChance: 5 + skills.dodge * 3,
    hitRate: Math.min(90, rawHitRate),
    overflowCrit,
  }
}

// ── Star Modifiers (deterministic: use 2★ average for all divisions) ──

export interface StarModifiers {
  atkDmgMult: number; hitRate: number; critRateMult: number; critDmgMult: number
  healthMult: number; dodgeMult: number; armorMult: number; attackSpeed: number
}

// Weighted-average star: E[star] ≈ 2.25 → bonus ≈ 0.0625 → round to 2★ = 0.015 avg modifier
export const AVG_STAR_MODS: StarModifiers = {
  atkDmgMult: 0.015, hitRate: 0.008, critRateMult: 0.015,
  critDmgMult: 0.015, healthMult: 0.015, dodgeMult: 0.008,
  armorMult: 0.015, attackSpeed: 0.005,
}

// ══════════════════════════════════════════════════════════════
// DETERMINISTIC COMBAT — Expected Value Calculations
// ══════════════════════════════════════════════════════════════

/**
 * Compute the EXPECTED damage per tick of one division.
 * No randomness — uses exact probabilities as multipliers.
 *
 * ExpectedDmg = attacksPerTick × hitRate × baseDmg × (1 + critRate × (critMult - 1))
 */
export function computeExpectedDPS(
  playerStats: PlayerCombatStats,
  template: DivisionTemplate,
  starMods: StarModifiers,
  manpower: number,
  healthRatio: number,  // current_hp / max_hp (0–1)
  experience: number,
): number {
  const divLevel = Math.floor(experience / 10)

  // Template multipliers with star bonuses
  const tAtkDmg = template.atkDmgMult * (1 + starMods.atkDmgMult)
  const tHitRate = Math.min(0.95, template.hitRate * (1 + starMods.hitRate) + divLevel * 0.01)
  const tCritRate = template.critRateMult * (1 + starMods.critRateMult) + divLevel * 0.01
  const tCritDmg = template.critDmgMult * (1 + starMods.critDmgMult) + divLevel * 0.01
  const tAtkSpeed = (template.attackSpeed || 1.0) * (1 + starMods.attackSpeed)

  // Attacks per tick (attackSpeed determines how many swings per tick)
  const attacksPerTick = 1.0 / tAtkSpeed

  // Base damage per swing
  const baseDmg = (playerStats.attackDamage + manpower * 3) * (tAtkDmg + divLevel * 0.01)

  // Effective crit rate (capped at 100%)
  const effectiveCritRate = Math.min(1.0, (playerStats.critRate * tCritRate) / 100)
  const effectiveCritMult = playerStats.critMultiplier * tCritDmg

  // Expected damage per hit (includes crit expectation)
  // E[dmg] = baseDmg × (1 - critRate + critRate × critMult)
  const expectedDmgPerHit = baseDmg * (1 - effectiveCritRate + effectiveCritRate * effectiveCritMult)

  // Apply hit rate (probability of connecting)
  const expectedDmgPerSwing = expectedDmgPerHit * tHitRate

  // Apply health scaling (lower HP = lower damage)
  const healthScaled = expectedDmgPerSwing * healthRatio

  // Total expected DPS
  return Math.max(1, Math.floor(healthScaled * attacksPerTick))
}

/**
 * Compute the EXPECTED damage received after armor/dodge mitigation.
 * No randomness — dodge reduces by percentage, armor reduces by mitigation curve.
 */
export function computeExpectedDamageReceived(
  rawDmg: number,
  playerStats: PlayerCombatStats,
  template: DivisionTemplate,
  starMods: StarModifiers,
): number {
  // Dodge: reduces incoming damage by dodge% (not binary, but proportional)
  const dodgeRate = Math.min(0.5, ((playerStats.dodgeChance || 5) * template.dodgeMult * (1 + starMods.dodgeMult)) / 100)
  const afterDodge = rawDmg * (1 - dodgeRate)

  // Armor mitigation: armor / (armor + 100)
  const totalArmor = (playerStats.armorBlock || 0) * template.armorMult * (1 + starMods.armorMult)
  const armorMitigation = totalArmor / (totalArmor + 100)
  const afterArmor = afterDodge * (1 - armorMitigation)

  // Global defender reduction (matches the 1.35 in original code)
  const finalDmg = afterArmor / 1.35

  return Math.max(1, Math.floor(finalDmg))
}

/**
 * Compute how many ticks a division survives under sustained expected DPS.
 */
export function computeTicksToKill(
  maxHP: number,
  expectedDpsReceived: number,
): number {
  if (expectedDpsReceived <= 0) return Infinity
  return Math.ceil(maxHP / expectedDpsReceived)
}

// ── Economy Functions ──

export function getWorkEarnings(workSkillLevel: number): number {
  return Math.floor(1500 + workSkillLevel * 200)
}

export function getRecruitCost(divisionType: string) {
  const template = DIVISION_TEMPLATES[divisionType as DivisionType]
  if (!template) return { money: 0, oil: 0, materialX: 0, scrap: 0 }
  return { ...template.recruitCost }
}

export function getWarRewards(enemyDivsKilled: number, won: boolean) {
  if (!won) return { baseMoney: 15000, killBounty: 2000, totalMoney: 15000 + enemyDivsKilled * 2000 }
  return { baseMoney: 100000, killBounty: 5000, totalMoney: 100000 + enemyDivsKilled * 5000 }
}

// ── Division Comparative Analysis ──

export interface DivisionAnalysis {
  type: DivisionType
  expectedDPS: number                    // Damage per tick at full HP
  effectiveHP: number                    // HP after armor/dodge mitigation
  dpsCostEfficiency: number              // DPS per $1000 recruited
  ticksToBreakEven: number               // Ticks of combat to earn back recruit cost in war rewards
  dailyUpkeepValue: number               // $ equivalent of daily oil+matX upkeep
  daysToPayForRecruitment: number        // Days of work to afford recruitment
  dpsVsInfantry: number                  // Expected DPS against assault infantry
  dpsVsMechanized: number                // Expected DPS against tank
}

/**
 * Pre-compute a full balance comparison table for all 9 division types.
 * Uses a reference "level 15" player as baseline.
 */
export function computeAllDivisionAnalysis(refStats: PlayerCombatStats, oilPrice: number, matXPrice: number): Record<DivisionType, DivisionAnalysis> {
  const result = {} as Record<DivisionType, DivisionAnalysis>
  const types = Object.keys(DIVISION_TEMPLATES) as DivisionType[]

  types.forEach(type => {
    const t = DIVISION_TEMPLATES[type]
    const maxHP = Math.floor(t.healthMult * 100)

    // DPS at full health
    const dps = computeExpectedDPS(refStats, t, AVG_STAR_MODS, t.manpowerCost, 1.0, 0)

    // Effective HP: how much raw damage needed to kill this unit
    // effectiveHP = maxHP / (1 - dodgeRate) / (1 - armorMitigation) * 1.35
    const dodgeRate = Math.min(0.5, ((refStats.dodgeChance || 5) * t.dodgeMult * (1 + AVG_STAR_MODS.dodgeMult)) / 100)
    const totalArmor = (refStats.armorBlock || 0) * t.armorMult * (1 + AVG_STAR_MODS.armorMult)
    const armorMit = totalArmor / (totalArmor + 100)
    const effectiveHP = Math.floor(maxHP / (1 - dodgeRate) / (1 - armorMit) * 1.35)

    const dailyUpkeep = t.upkeepCost.oil * oilPrice + t.upkeepCost.materialX * matXPrice
    const recruitMoney = t.recruitCost.money
    const dpsPerK = recruitMoney > 0 ? (dps / (recruitMoney / 1000)) : 0

    // Ticks to earn back via war (assume 5000$/kill, kill takes ~effectiveHP/dps ticks)
    const ticksToBreakEven = recruitMoney > 0 ? Math.ceil(recruitMoney / 5000) : 0

    // Days to afford recruitment from work (level 15 player, ~10 work actions/day, ~$4500/action)
    const dailyWorkIncome = 10 * getWorkEarnings(7) // lvl15 balanced = ~7 work skill
    const daysToPayForRec = Math.ceil(recruitMoney / dailyWorkIncome)

    // DPS against specific targets
    const assaultT = DIVISION_TEMPLATES.assault
    const tankT = DIVISION_TEMPLATES.tank
    const dpsVsInfantry = computeExpectedDamageReceived(dps, refStats, assaultT, AVG_STAR_MODS)
    const dpsVsMech = computeExpectedDamageReceived(dps, refStats, tankT, AVG_STAR_MODS)

    result[type] = {
      type, expectedDPS: dps, effectiveHP,
      dpsCostEfficiency: +dpsPerK.toFixed(2),
      ticksToBreakEven, dailyUpkeepValue: +dailyUpkeep.toFixed(2),
      daysToPayForRecruitment: daysToPayForRec,
      dpsVsInfantry, dpsVsMechanized: dpsVsMech,
    }
  })

  return result
}
