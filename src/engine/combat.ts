// src/engine/combat.ts
// Pure combat math — no store dependencies. Used by battleStore AND simulation.

import type { PlayerCombatStats } from './stats'

// ====== TYPES (still used by battleStore inline logic) ======

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
  critDmgMult: number
  speedMult: number
}

export interface AuraBonus {
  critDmgPct: number
  dodgePct: number
  attackPct: number
  precisionPct: number
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
  atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1,
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
 * Compute damage for a manual player attack click.
 */
export function computePlayerAttack(playerStats: PlayerCombatStats): { damage: number; isCrit: boolean } {
  const isCrit = Math.random() * 100 < playerStats.critRate
  const damage = isCrit
    ? Math.floor(playerStats.attackDamage * playerStats.critMultiplier)
    : playerStats.attackDamage

  return { damage, isCrit }
}
