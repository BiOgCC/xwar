// src/engine/economy.ts
// Pure economy functions — no store dependencies. Used by stores AND simulation.

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

// ====== WAR REWARDS ======

export interface WarRewards {
  baseMoney: number       // Fixed reward for winning side
  totalMoney: number      // Total reward
}

/**
 * Get rewards for winning a region war.
 * Base: $100k for winning side, $15k consolation for losing side.
 */
export function getWarRewards(won: boolean, researchMult = 1.0): WarRewards {
  if (!won) {
    const consolation = Math.floor(15000 * researchMult)
    return { baseMoney: 15000, totalMoney: consolation }
  }
  const baseMoney = 100000
  return { baseMoney, totalMoney: Math.floor(baseMoney * researchMult) }
}

/**
 * Calculate a player's share of war rewards based on their damage contribution.
 * Prevents alt-account farming by paying proportionally to impact.
 *
 * @param totalPool   Total money in the reward pool (from getWarRewards)
 * @param playerDmg   Damage dealt by this player
 * @param totalDmg    Total damage dealt by the entire winning/losing side
 * @returns           This player's money share (floored to integer)
 *
 * Rules:
 * - Share = pool × (playerDmg / totalDmg)
 * - Minimum: 5% of pool (so any participant gets something)
 * - Maximum: 60% of pool (so one whale can't vacuum everything)
 * - If playerDmg is 0, returns 0 (no reward for non-contributors)
 */
export function getWarRewardShare(totalPool: number, playerDmg: number, totalDmg: number): number {
  if (playerDmg <= 0 || totalDmg <= 0) return 0

  const rawShare = totalPool * (playerDmg / totalDmg)
  const minShare = totalPool * 0.05
  const maxShare = totalPool * 0.60

  return Math.floor(Math.max(minShare, Math.min(maxShare, rawShare)))
}
