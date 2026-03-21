// src/engine/combat.ts
// Pure combat math — no store dependencies. Used by battleStore AND simulation.

import type { PlayerCombatStats } from './stats'

// ====== INPUT TYPES ======

export interface DivisionCombatInput {
  manpower: number
  health: number
  maxHealth: number
  experience: number
  type: string
  name: string
}

export interface DivisionTemplate {
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  attackSpeed: number
  manpowerCost: number
}

export interface StarModifiers {
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  attackSpeed: number
}

export interface EquipBonus {
  bonusAtk: number
  bonusCritRate: number
  bonusCritDmg: number
  bonusArmor: number
  bonusDodge: number
  bonusHitRate: number
  bonusSpeed: number
  bonusHP: number
}

export interface OrderEffects {
  atkMult: number
  armorMult: number
  dodgeMult: number
  hitBonus: number
  critBonus: number
  speedMult: number
}

export interface AuraBonus {
  critDmgPct: number
  dodgePct: number
  attackPct: number
  precisionPct: number
}

// ====== OUTPUT TYPES ======

export interface DivisionAttackResult {
  totalDamage: number
  crits: number
  misses: number
  attacks: number
}

export interface DamageToDefenderResult {
  finalDmg: number
  dodged: boolean
}

// ====== DEFAULT VALUES ======

export const EMPTY_STAR_MODS: StarModifiers = {
  atkDmgMult: 0, hitRate: 0, critRateMult: 0, critDmgMult: 0,
  healthMult: 0, dodgeMult: 0, armorMult: 0, attackSpeed: 0,
}

export const EMPTY_EQUIP_BONUS: EquipBonus = {
  bonusAtk: 0, bonusCritRate: 0, bonusCritDmg: 0, bonusArmor: 0,
  bonusDodge: 0, bonusHitRate: 0, bonusSpeed: 0, bonusHP: 0,
}

export const NO_ORDER: OrderEffects = {
  atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, speedMult: 1,
}

export const NO_AURA: AuraBonus = {
  critDmgPct: 0, dodgePct: 0, attackPct: 0, precisionPct: 0,
}

// ====== PURE FUNCTIONS ======

/** Random ±10% deviation for combat variability */
export function deviate(v: number): number {
  return v * (0.9 + Math.random() * 0.2)
}

/**
 * Compute one tick of a single division's offensive output.
 * Returns total damage dealt, crit count, miss count, and number of attacks.
 * 
 * @param cooldownAccum - The accumulated attack speed for this division (pass in, get back updated)
 * @returns [result, newCooldown]
 */
export function computeDivisionAttack(
  playerStats: PlayerCombatStats,
  div: DivisionCombatInput,
  template: DivisionTemplate,
  starMods: StarModifiers,
  equipBonus: EquipBonus,
  orderEffects: OrderEffects,
  aura: AuraBonus,
  cooldownAccum: number,
  heroBuffActive: boolean,
): [DivisionAttackResult, number] {
  const result: DivisionAttackResult = { totalDamage: 0, crits: 0, misses: 0, attacks: 0 }

  // Apply star quality modifiers to template stats
  const tAtkDmg = template.atkDmgMult * (1 + starMods.atkDmgMult)
  const tHitRate = template.hitRate * (1 + starMods.hitRate)
  const tCritRate = template.critRateMult * (1 + starMods.critRateMult)
  const tCritDmg = template.critDmgMult * (1 + starMods.critDmgMult)
  const tAtkSpeed = (template.attackSpeed || 1.0) * (1 + starMods.attackSpeed)

  // Attack speed accumulation
  const as = (tAtkSpeed - equipBonus.bonusSpeed) * orderEffects.speedMult
  cooldownAccum += 1.0

  while (cooldownAccum >= as) {
    cooldownAccum -= as
    result.attacks++

    const divLevel = Math.floor((div.experience || 0) / 10)

    // Hit check
    const effectiveHitRate = Math.min(0.95, tHitRate + divLevel * 0.01 + orderEffects.hitBonus + aura.precisionPct / 100 + equipBonus.bonusHitRate)
    if (Math.random() > effectiveHitRate) {
      result.misses++
      continue
    }

    // Base damage: player attack + manpower×3 + equipAtk, scaled by division's attack mult
    let dmg = Math.floor((playerStats.attackDamage + div.manpower * 3 + equipBonus.bonusAtk) * (tAtkDmg + divLevel * 0.01))

    // Apply aura attack bonus
    dmg = Math.floor(dmg * (1 + aura.attackPct / 100))

    // Apply HERO buff (+10%)
    if (heroBuffActive) dmg = Math.floor(dmg * 1.10)

    // Crit check
    const effectiveCritRate = deviate((playerStats.critRate + orderEffects.critBonus + equipBonus.bonusCritRate) * (tCritRate + divLevel * 0.01))
    if (Math.random() * 100 < effectiveCritRate) {
      const effectiveCritMult = playerStats.critMultiplier * (tCritDmg + divLevel * 0.01) * (1 + aura.critDmgPct / 100) + equipBonus.bonusCritDmg / 100
      dmg = Math.floor(dmg * effectiveCritMult)
      result.crits++
    }

    // Strength scaling (HP ratio)
    const strength = div.health / div.maxHealth
    dmg = Math.floor(dmg * strength)

    // Order attack multiplier
    dmg = Math.floor(dmg * orderEffects.atkMult)

    // ±10% deviation
    dmg = Math.floor(deviate(dmg))

    result.totalDamage += Math.max(1, dmg)
  }

  return [result, cooldownAccum]
}

/**
 * Compute the damage actually applied to a defending division after dodge and armor.
 * Returns the final HP damage and whether the hit was dodged.
 */
export function computeDamageToDefender(
  rawDmgPerDiv: number,
  playerStats: PlayerCombatStats,
  template: DivisionTemplate,
  equipBonus: EquipBonus,
  orderEffects: OrderEffects,
  aura: AuraBonus,
): DamageToDefenderResult {
  // Dodge check
  const dodgeChance = deviate((playerStats.dodgeChance || 5) * template.dodgeMult * orderEffects.dodgeMult * (1 + aura.dodgePct / 100) + equipBonus.bonusDodge) / 100
  if (Math.random() < dodgeChance) {
    return { finalDmg: 0, dodged: true }
  }

  // Armor % mitigation: armor / (armor + 100)
  const totalArmor = ((playerStats.armorBlock || 0) + equipBonus.bonusArmor) * template.armorMult * orderEffects.armorMult
  const armorMitigation = totalArmor / (totalArmor + 100)
  let finalDmg = Math.max(1, Math.floor(rawDmgPerDiv * (1 - armorMitigation)))

  // Health multiplier scaling
  finalDmg = Math.max(1, Math.floor(finalDmg / 1.35)) // healthMult divider x1.35

  return { finalDmg, dodged: false }
}

/**
 * Compute damage for a manual player attack click.
 */
export function computePlayerAttack(playerStats: PlayerCombatStats): { damage: number; isCrit: boolean } {
  const isCrit = Math.random() * 100 < playerStats.critRate
  const damage = isCrit
    ? Math.floor(playerStats.attackDamage * playerStats.critMultiplier)
    : playerStats.attackDamage

  return { damage, isCrit }
}
