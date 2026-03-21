// src/engine/economy.ts
// Pure economy functions — no store dependencies. Used by stores AND simulation.

import { DIVISION_TEMPLATES } from '../stores/army/types'

// ====== DAILY REWARDS ======

export interface DailyRewardResult {
  money: number
  bitcoin: number
  militaryBoxes: number
}

/**
 * Get daily login reward value for a given streak day (1-7 cycle).
 * Day 7 is the jackpot day.
 */
export function getDailyRewardValue(streakDay: number): DailyRewardResult {
  const day = ((streakDay - 1) % 7) + 1 // Normalize to 1-7

  const rewards: Record<number, DailyRewardResult> = {
    1: { money: 10000, bitcoin: 0, militaryBoxes: 0 },
    2: { money: 15000, bitcoin: 0, militaryBoxes: 0 },
    3: { money: 20000, bitcoin: 0, militaryBoxes: 1 },
    4: { money: 25000, bitcoin: 1, militaryBoxes: 0 },
    5: { money: 30000, bitcoin: 0, militaryBoxes: 1 },
    6: { money: 35000, bitcoin: 1, militaryBoxes: 1 },
    7: { money: 50000, bitcoin: 2, militaryBoxes: 2 },
  }

  return rewards[day] || rewards[1]
}

// ====== WORK ======

/**
 * Get money earned per work action based on work skill level.
 * Base = 1500, +200 per skill level.
 * @param researchMult Optional multiplier from Economic Theory research (e.g. 1.10 = +10%)
 */
export function getWorkEarnings(workSkillLevel: number, researchMult = 1.0): number {
  return Math.floor((1500 + workSkillLevel * 200) * researchMult)
}

// ====== DIVISION COSTS ======

export interface RecruitCost {
  money: number
  oil: number
  materialX: number
  scrap: number
}

/**
 * Get the recruitment cost for a given division type.
 * @param researchMult Optional multiplier from Economic Theory research (e.g. 0.90 = -10%)
 */
export function getRecruitCost(divisionType: string, researchMult = 1.0): RecruitCost {
  const template = (DIVISION_TEMPLATES as Record<string, any>)[divisionType]
  if (!template) return { money: 0, oil: 0, materialX: 0, scrap: 0 }
  return {
    money: Math.floor(template.recruitCost.money * researchMult),
    oil: template.recruitCost.oil,
    materialX: template.recruitCost.materialX,
    scrap: template.recruitCost.scrap,
  }
}

/**
 * Get the money cost to heal a division from currentHp to maxHp.
 * Formula: missing HP × 15.
 * @param researchMult Optional multiplier from Economic Theory research (e.g. 0.90 = -10%)
 */
export function getHealCost(currentHp: number, maxHp: number, researchMult = 1.0): number {
  const missingHp = Math.max(0, maxHp - currentHp)
  return Math.floor(missingHp * 15 * researchMult)
}

/**
 * Get the money cost to revive a destroyed division.
 * Formula: 50% of original recruit cost (25% if insured).
 * @param researchMult Optional multiplier from Economic Theory research (e.g. 0.85 = -15%)
 */
export function getReviveCost(divisionType: string, insured = false, researchMult = 1.0): number {
  const template = (DIVISION_TEMPLATES as Record<string, any>)[divisionType]
  if (!template) return 0
  const basePct = insured ? 0.25 : 0.50
  return Math.floor(template.recruitCost.money * basePct * researchMult)
}

// ====== WAR REWARDS ======

export interface WarRewards {
  baseMoney: number       // Fixed reward for winning side
  killBounty: number      // Per enemy division killed
  totalMoney: number      // baseMoney + (kills × killBounty)
}

/**
 * Get rewards for winning a region war.
 * Base: $100k for winning side.
 * Kill bounty: $5k per enemy division killed.
 * @param researchMult Optional multiplier from Economic Theory research (e.g. 1.25 = +25%)
 */
export function getWarRewards(enemyDivsKilled: number, won: boolean, researchMult = 1.0): WarRewards {
  if (!won) {
    // Losers get a consolation of $15k + $2k per kill
    const consolation = Math.floor((15000 + enemyDivsKilled * 2000) * researchMult)
    return { baseMoney: 15000, killBounty: 2000, totalMoney: consolation }
  }
  const baseMoney = 100000
  const killBounty = 5000
  return { baseMoney, killBounty, totalMoney: Math.floor((baseMoney + enemyDivsKilled * killBounty) * researchMult) }
}

// ====== DIVISION INSURANCE ======

/**
 * Get the insurance cost for a division before battle.
 * Cost: 10% of recruit price. Halves revive cost if destroyed.
 */
export function getInsuranceCost(divisionType: string): number {
  const template = (DIVISION_TEMPLATES as Record<string, any>)[divisionType]
  if (!template) return 0
  return Math.floor(template.recruitCost.money * 0.10)
}

// ====== DIVISION HP ======

/**
 * Get effective max health for a division type given maxStamina.
 */
export function getEffectiveMaxHealth(divisionType: string, maxStamina: number): number {
  const template = (DIVISION_TEMPLATES as Record<string, any>)[divisionType]
  if (!template) return 100
  return Math.floor(template.healthMult * maxStamina)
}
