// src/engine/stats.ts
// Pure player combat stat computation — no store dependencies

export interface PlayerCombatStats {
  attackDamage: number
  critRate: number
  critMultiplier: number
  armorBlock: number
  dodgeChance: number
  hitRate: number
  overflowCrit: number  // Extra crit rate from hit rate overflow past 90%
}

export interface SkillLevels {
  attack: number
  critRate: number
  critDamage: number
  precision: number
  stamina: number
  hunger: number
  armor: number
  dodge: number
}

export interface EquipmentStats {
  damage: number
  critRate: number
  critDamage: number
  armor: number
  dodge: number
  precision: number
}

/**
 * Compute player combat stats from skill levels and equipment.
 * This is the single source of truth for player stat formulas.
 */
export function computePlayerCombatStats(skills: SkillLevels, equipment: EquipmentStats): PlayerCombatStats {
  const rawHitRate = 50 + equipment.precision + skills.precision * 5
  const overflowCrit = Math.max(0, rawHitRate - 90) * 0.5  // 50% of overflow → bonus crit
  return {
    attackDamage: 100 + equipment.damage + skills.attack * 20,
    critRate: Math.min(66, 20 + equipment.critRate + skills.critRate * 4),
    critMultiplier: 1.5 + (equipment.critDamage + skills.critDamage * 20) / 200,
    armorBlock: equipment.armor + skills.armor * 5,
    dodgeChance: 5 + equipment.dodge + skills.dodge * 3,
    hitRate: Math.min(90, rawHitRate),
    overflowCrit,
  }
}

/**
 * Compute base stats from skills only (no equipment).
 */
export function computeBaseSkillStats(skills: SkillLevels): PlayerCombatStats {
  return computePlayerCombatStats(skills, { damage: 0, critRate: 0, critDamage: 0, armor: 0, dodge: 0, precision: 0 })
}

/**
 * Aggregate equipment stats from an array of equipped items.
 */
export function aggregateEquipmentStats(equippedItems: any[]): EquipmentStats {
  const stats: EquipmentStats = { damage: 0, critRate: 0, critDamage: 0, armor: 0, dodge: 0, precision: 0 }
  equippedItems.forEach((item: any) => {
    if (item.stats.damage) stats.damage += item.stats.damage
    if (item.stats.critRate) stats.critRate += item.stats.critRate
    if (item.stats.critDamage) stats.critDamage += item.stats.critDamage
    if (item.stats.armor) stats.armor += item.stats.armor
    if (item.stats.dodge) stats.dodge += item.stats.dodge
    if (item.stats.precision) stats.precision += item.stats.precision
  })
  return stats
}
