/**
 * leyLineCache.ts — In-memory read-through cache for ley line state.
 *
 * The engine pipeline writes here after each computation cycle.
 * API routes read from here — no DB hit on GET endpoints.
 * getBonusesForCountry() is the fast-path used by battle.service and
 * the economy pipeline.
 */

import type {
  LineComputedState,
  NodeState,
  MergedBuff,
  LeyLineBonus,
} from '../types/leyline.types.js'

export const leyLineCache = {
  /** Map<lineId, computed state> */
  lineStates: new Map<string, LineComputedState>(),

  /** Map<`${regionId}:${lineId}`, node state> */
  nodeStates: new Map<string, NodeState>(),

  /** Map<countryCode, merged buff totals> */
  countryBuffs: new Map<string, MergedBuff>(),

  /** ISO timestamp of the last successful engine run */
  lastComputedAt: null as Date | null,

  /** Whether the cache has been populated at least once */
  get initialized(): boolean {
    return this.lastComputedAt !== null
  },
}

/**
 * Returns the merged bonuses for a country from the cache.
 * Returns zeroed-out bonuses if the country has no active lines.
 */
export function getBonusesForCountry(countryCode: string): {
  bonuses: LeyLineBonus
  tradeoffs: LeyLineBonus
  resonanceLevel: string | null
} {
  const buff = leyLineCache.countryBuffs.get(countryCode)
  return {
    bonuses:        (buff?.mergedBonuses  ?? {}) as LeyLineBonus,
    tradeoffs:      (buff?.mergedTradeoffs ?? {}) as LeyLineBonus,
    resonanceLevel: buff?.resonanceLevel ?? null,
  }
}

/**
 * Quick helper for combat damage modifier.
 * Used by battle.service.ts.
 */
export function getLeyLineCombatMods(countryCode: string): {
  damageMult: number
  armorMult:  number
  speedMult:  number
} {
  const { bonuses, tradeoffs } = getBonusesForCountry(countryCode)
  return {
    damageMult: 1.0 + (bonuses.weaponProduction ?? 0) + (bonuses.troopDamage ?? 0) + (bonuses.weaponDamage ?? 0),
    armorMult:  1.0 - (tradeoffs.defenderBonus  ?? 0),
    speedMult:  1.0 + (bonuses.troopMovementSpeed ?? 0),
  }
}
