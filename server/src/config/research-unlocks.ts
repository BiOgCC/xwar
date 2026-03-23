/**
 * Research unlock registry — defines what each unlock key does.
 * Used by /api/research and enforced at relevant action endpoints.
 */

export interface UnlockDef {
  label: string
  requiredLevel: number
  effect: string
  researchDurationMs: number  // how long it takes to complete
  cost: number                // money cost to start
}

export const MILITARY_UNLOCKS: Record<string, UnlockDef> = {
  stealth_bomber: {
    label: 'Stealth Bomber',
    requiredLevel: 3,
    effect: 'unlocks_division_type:stealth',
    researchDurationMs: 4 * 60 * 60 * 1000,  // 4 hours
    cost: 500_000,
  },
  submarine: {
    label: 'Submarine Division',
    requiredLevel: 4,
    effect: 'unlocks_division_type:submarine',
    researchDurationMs: 6 * 60 * 60 * 1000,  // 6 hours
    cost: 750_000,
  },
  cyber_warfare_ops: {
    label: 'Cyber Warfare Ops',
    requiredLevel: 5,
    effect: 'multiplier:cyber_damage:1.5',
    researchDurationMs: 8 * 60 * 60 * 1000,  // 8 hours
    cost: 1_000_000,
  },
  advanced_artillery: {
    label: 'Advanced Artillery',
    requiredLevel: 3,
    effect: 'multiplier:division_damage:1.2',
    researchDurationMs: 3 * 60 * 60 * 1000,
    cost: 300_000,
  },
}

export const ECONOMY_UNLOCKS: Record<string, UnlockDef> = {
  company_tier5: {
    label: 'Company Tier 5 Upgrade',
    requiredLevel: 2,
    effect: 'unlocks_company_level:5',
    researchDurationMs: 2 * 60 * 60 * 1000,  // 2 hours
    cost: 200_000,
  },
  trade_route_bonus: {
    label: 'Trade Route Efficiency',
    requiredLevel: 3,
    effect: 'multiplier:trade_income:1.25',
    researchDurationMs: 3 * 60 * 60 * 1000,
    cost: 350_000,
  },
  market_fee_reduction: {
    label: 'Market Fee Reduction',
    requiredLevel: 4,
    effect: 'multiplier:market_fee:0.75',
    researchDurationMs: 4 * 60 * 60 * 1000,
    cost: 500_000,
  },
  supply_chain_ops: {
    label: 'Supply Chain Optimisation',
    requiredLevel: 2,
    effect: 'multiplier:production_speed:1.15',
    researchDurationMs: 2 * 60 * 60 * 1000,
    cost: 150_000,
  },
}

export const ALL_UNLOCKS = { ...MILITARY_UNLOCKS, ...ECONOMY_UNLOCKS }

/** Returns the type of unlock ('military' | 'economy' | null) */
export function unlockType(key: string): 'military' | 'economy' | null {
  if (key in MILITARY_UNLOCKS) return 'military'
  if (key in ECONOMY_UNLOCKS) return 'economy'
  return null
}
