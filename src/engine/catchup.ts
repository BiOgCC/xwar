/**
 * Catch-Up Mechanics — XP Acceleration for Newcomers
 *
 * Players below the server median level receive an XP multiplier that
 * fades to 1.0 as they approach the median.  Players at or above the
 * median receive no bonus (multiplier = 1.0) — they are never penalised.
 *
 * Formula:
 *   multiplier = 1 + (medianLevel - playerLevel) * RATE
 *   clamped to [1.0, MAX_MULTIPLIER]
 *
 * The server median level is maintained in worldStore and recalculated
 * periodically from all registered player levels.
 */

// How much bonus per level below the median (5% per level gap)
const CATCH_UP_RATE = 0.05

// Hard cap so the multiplier never gets absurd
const MAX_MULTIPLIER = 2.0

// Minimum multiplier — veterans are never penalised
const MIN_MULTIPLIER = 1.0

/**
 * Returns the XP catch-up multiplier for a given player level.
 * @param playerLevel  The player's current level
 * @param serverMedianLevel  The current server median level
 * @returns Multiplier ≥ 1.0 (up to 2.0)
 */
export function getCatchUpXPMultiplier(
  playerLevel: number,
  serverMedianLevel: number,
): number {
  if (serverMedianLevel <= 0 || playerLevel >= serverMedianLevel) {
    return MIN_MULTIPLIER
  }
  const gap = serverMedianLevel - playerLevel
  const raw = 1 + gap * CATCH_UP_RATE
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, raw))
}

/**
 * Apply the catch-up multiplier to a raw XP amount and return the
 * boosted value (always integer, at least 1).
 */
export function applyCatchUpXP(
  rawXP: number,
  playerLevel: number,
  serverMedianLevel: number,
): number {
  const mult = getCatchUpXPMultiplier(playerLevel, serverMedianLevel)
  return Math.max(1, Math.floor(rawXP * mult))
}

export { CATCH_UP_RATE, MAX_MULTIPLIER }
