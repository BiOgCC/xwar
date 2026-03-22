/**
 * leyLineRegistry.ts — Ley Line definitions for all continents.
 *
 * Each continent has exactly 3 Lines: one Dominion (military),
 * one Prosperity (economy), and one Convergence (hybrid).
 * Lines are large geographic corridors that cross national borders.
 *
 * Only North America is populated for the prototype; other continents
 * will be added after validation.
 */

// ── Types ──

export type LeyLineArchetype = 'dominion' | 'prosperity' | 'convergence'

export type Continent =
  | 'north_america'
  | 'south_america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'oceania'

export interface LeyLineBonus {
  taxIncome?:          number // +0.25 = +25%
  populationGrowth?:   number
  weaponProduction?:   number
  troopMovementSpeed?: number
  researchSpeed?:      number
  matxExtraction?:     number
  defenderBonus?:      number
  attackerAdvantage?:  number
  troopDamage?:        number
  foodYield?:          number
  armyUpkeep?:         number // positive = cost INCREASE (trade-off)
  buildSpeed?:         number
  oilExtraction?:      number
  navalSupport?:       number
  deploymentSpeed?:    number
  deploymentRange?:    number
  tradeIncome?:        number
  resourceExtraction?: number // generic raw resources
  techBaseline?:       number
  infraMaintenance?:   number // positive = cost INCREASE
  weaponDamage?:       number
  politicalPower?:     number
  navalAirEffectiveness?: number
}

export interface LeyLineDef {
  id: string
  name: string
  continent: Continent
  archetype: LeyLineArchetype
  blocks: string[]       // region IDs forming the corridor (ordered geographically)
  bonuses: LeyLineBonus  // positive = buffs
  tradeoffs: LeyLineBonus // values here are applied as penalties
}

export interface ContinentalResonance {
  continent: Continent
  name: string
  bonus: LeyLineBonus
  scope: 'continent' | 'global'
}

// ── Archetype metadata ──

export const ARCHETYPE_META: Record<LeyLineArchetype, { label: string; color: string }> = {
  dominion:    { label: 'Line of Dominion',    color: '#ef4444' }, // red
  prosperity:  { label: 'Line of Prosperity',  color: '#eab308' }, // gold
  convergence: { label: 'Line of Convergence', color: '#a855f7' }, // purple
}

// ═══════════════════════════════════════════════════════════════
// NORTH AMERICA
// ═══════════════════════════════════════════════════════════════

const NA_PROSPERITY: LeyLineDef = {
  id: 'NA-PROSPERITY',
  name: 'The Atlantic Corridor',
  continent: 'north_america',
  archetype: 'prosperity',
  blocks: [
    // Canadian Maritimes (4)
    'CA-NL', 'CA-QC', 'CA-NB', 'CA-NS',
    // US East Coast (16)
    'US-ME', 'US-NH', 'US-VT', 'US-MA', 'US-CT', 'US-RI',
    'US-NY', 'US-NJ', 'US-PA', 'US-DE', 'US-MD',
    'US-VA', 'US-NC', 'US-SC', 'US-GA', 'US-FL',
  ],
  bonuses: {
    taxIncome:        0.25,
    populationGrowth: 0.15,
  },
  tradeoffs: {
    defenderBonus: -0.15,
  },
}

const NA_DOMINION: LeyLineDef = {
  id: 'NA-DOMINION',
  name: 'The Great Lakes Forge',
  continent: 'north_america',
  archetype: 'dominion',
  blocks: [
    // Cross-border industrial belt (8 regions, 2 countries)
    'CA-ON', 'US-MI', 'US-OH', 'US-IN', 'US-IL', 'US-WI', 'US-MN', 'CA-MB',
  ],
  bonuses: {
    weaponProduction:   0.20,
    troopMovementSpeed: 0.10,
  },
  tradeoffs: {
    foodYield: -0.15,
  },
}

const NA_CONVERGENCE: LeyLineDef = {
  id: 'NA-CONVERGENCE',
  name: 'The Pacific Rim',
  continent: 'north_america',
  archetype: 'convergence',
  blocks: [
    // West coast spanning 3 countries (5 regions)
    'CA-BC', 'US-WA', 'US-OR', 'US-CA', 'MX-BC',
  ],
  bonuses: {
    researchSpeed:  0.15,
    matxExtraction: 0.10,
  },
  tradeoffs: {
    armyUpkeep: 0.10, // +10% army upkeep cost
  },
}

// ── All Ley Line definitions ──

export const LEY_LINE_DEFS: LeyLineDef[] = [
  NA_PROSPERITY,
  NA_DOMINION,
  NA_CONVERGENCE,
  // South America, Europe, Africa, Asia, Oceania — TBD after prototype
]

// ── Continental Resonance definitions ──

export const CONTINENTAL_RESONANCE: ContinentalResonance[] = [
  {
    continent: 'north_america',
    name: 'Arsenal of Democracy',
    bonus: { weaponDamage: 0.10 },
    scope: 'continent',
  },
  {
    continent: 'south_america',
    name: 'Fortress of the New World',
    bonus: { defenderBonus: 0.15 },
    scope: 'continent',
  },
  {
    continent: 'europe',
    name: 'Iron Curtain Protocol',
    bonus: { armyUpkeep: -0.10 },
    scope: 'continent',
  },
  {
    continent: 'africa',
    name: 'Heart of the World',
    bonus: { resourceExtraction: 0.15 },
    scope: 'global',
  },
  {
    continent: 'asia',
    name: 'Mandate of Heaven',
    bonus: { politicalPower: 0.10 },
    scope: 'global',
  },
  {
    continent: 'oceania',
    name: 'Pacific Doctrine',
    bonus: { navalAirEffectiveness: 0.15 },
    scope: 'global',
  },
]

// ── Diminishing returns for same-country multi-Line activation ──

export const DIMINISHING_RETURNS = [1.0, 0.50, 0.25] as const

// ── Cross-Continental Resonance tiers ──

export const CROSS_CONTINENTAL_TIERS = [
  { setsRequired: 2, name: 'Dual Meridian', allStatBonus: 0.05 },
  { setsRequired: 3, name: 'Tri-Apex',      allStatBonus: 0.10 },
  { setsRequired: 4, name: 'World Axis',    allStatBonus: 0.15 },
] as const

// ── Lookup helpers ──

/** Get all Ley Lines for a continent */
export function getLeyLinesForContinent(c: Continent): LeyLineDef[] {
  return LEY_LINE_DEFS.filter(l => l.continent === c)
}

/** Get the Ley Line(s) that a given region belongs to */
export function getLeyLinesForRegion(regionId: string): LeyLineDef[] {
  return LEY_LINE_DEFS.filter(l => l.blocks.includes(regionId))
}

/** Get resonance definition for a continent */
export function getResonance(c: Continent): ContinentalResonance | undefined {
  return CONTINENTAL_RESONANCE.find(r => r.continent === c)
}

/** All unique country codes involved in a Ley Line */
export function getCountriesInLine(line: LeyLineDef): string[] {
  const ccs = new Set<string>()
  line.blocks.forEach(b => {
    const cc = b.split('-')[0]
    ccs.add(cc)
  })
  return [...ccs]
}
