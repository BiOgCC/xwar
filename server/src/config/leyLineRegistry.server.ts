/**
 * leyLineRegistry.server.ts
 *
 * Server-side mirror of the frontend leyLineRegistry.
 * Keeps the same data — no React/Zustand imports, pure Node.js-safe.
 *
 * Source of truth for block lists, bonuses, and resonance rules used by
 * the Ley Line Engine pipeline.
 */

import type {
  LeyLineDef,
  LeyLineArchetype,
  Continent,
} from '../types/leyline.types.js'

export type { LeyLineDef, LeyLineArchetype, Continent }

// ── Archetype metadata (color / label for news events) ──

export const ARCHETYPE_META: Record<LeyLineArchetype, { label: string; color: string }> = {
  dominion:    { label: 'Line of Dominion',    color: '#ef4444' },
  prosperity:  { label: 'Line of Prosperity',  color: '#eab308' },
  convergence: { label: 'Line of Convergence', color: '#a855f7' },
}

// ── All definitions ──

// ── Russia / Eurasia ──

const RU_DOMINION: LeyLineDef = {
  id:        'RU-DOMINION',
  name:      'The Siberian Spine',
  continent: 'asia',
  archetype: 'dominion',
  blocks: [
    // Western military heartland → Central Siberia → Pacific
    'RU-MO', 'RU-UR', 'RU-TY', 'RU-KH', 'RU-IR', 'RU-SK', 'RU-FE',
  ],
  bonuses:   { weaponProduction: 0.20, troopMovementSpeed: 0.15, deploymentRange: 0.10 },
  tradeoffs: { armyUpkeep: 0.10 },
}

const RU_PROSPERITY: LeyLineDef = {
  id:        'RU-PROSPERITY',
  name:      'The Iron Silk Road',
  continent: 'europe',
  archetype: 'prosperity',
  blocks: [
    // European Russia trade corridor
    'RU-WR', 'RU-MO', 'RU-VG', 'RU-OM', 'RU-NV', 'RU-AL',
  ],
  bonuses:   { taxIncome: 0.20, oilExtraction: 0.25, tradeIncome: 0.15 },
  tradeoffs: { defenderBonus: -0.10 },
}

const RU_CONVERGENCE: LeyLineDef = {
  id:        'RU-CONVERGENCE',
  name:      'The Arctic Veil',
  continent: 'europe',
  archetype: 'convergence',
  blocks: [
    // Arctic/Northern Russia corridor — sparse, strategic
    'RU-KR', 'RU-AR', 'RU-KO', 'RU-TY', 'RU-MG', 'RU-KM',
  ],
  bonuses:   { researchSpeed: 0.15, navalSupport: 0.20, resourceExtraction: 0.10 },
  tradeoffs: { foodYield: -0.20, populationGrowth: -0.10 },
}

// ── North America ──

const NA_PROSPERITY: LeyLineDef = {
  id:        'NA-PROSPERITY',
  name:      'The Atlantic Corridor',
  continent: 'north_america',
  archetype: 'prosperity',
  blocks: [
    // US Eastern seaboard trade corridor
    'US-ME', 'US-NH', 'US-VT', 'US-MA', 'US-CT', 'US-RI',
    'US-NY', 'US-NJ', 'US-PA', 'US-DE', 'US-MD',
    'US-VA', 'US-NC', 'US-SC', 'US-GA', 'US-FL',
  ],
  bonuses:   { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}

const NA_DOMINION: LeyLineDef = {
  id:        'NA-DOMINION',
  name:      'The Great Lakes Forge',
  continent: 'north_america',
  archetype: 'dominion',
  blocks: [
    // US industrial heartland
    'US-MI', 'US-OH', 'US-IN', 'US-IL', 'US-WI', 'US-MN',
    'US-MO', 'US-KY', 'US-WV', 'US-PA',
  ],
  bonuses:   { weaponProduction: 0.25, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}

const NA_CONVERGENCE: LeyLineDef = {
  id:        'NA-CONVERGENCE',
  name:      'The Pacific Frontier',
  continent: 'north_america',
  archetype: 'convergence',
  blocks: [
    // US West Coast corridor
    'US-WA', 'US-OR', 'US-CA', 'US-NV', 'US-AZ',
  ],
  bonuses:   { navalSupport: 0.20, researchSpeed: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.10 },
}

export const LEY_LINE_DEFS: LeyLineDef[] = [
  RU_DOMINION,
  RU_PROSPERITY,
  RU_CONVERGENCE,
  NA_PROSPERITY,
  NA_DOMINION,
  NA_CONVERGENCE,
  // SA / AF / AS-other / OC — future
]


// ── Continental resonance (continent-level buffs when all 3 archetypes held) ──

export interface ContinentalResonance {
  continent: Continent
  name:      string
  bonus:     Record<string, number>
  scope:     'continent' | 'global'
}

export const CONTINENTAL_RESONANCE: ContinentalResonance[] = [
  { continent: 'north_america', name: 'Arsenal of Democracy',    bonus: { weaponDamage: 0.10 },              scope: 'continent' },
  { continent: 'south_america', name: 'Fortress of the New World', bonus: { defenderBonus: 0.15 },             scope: 'continent' },
  { continent: 'europe',        name: 'Iron Curtain Protocol',    bonus: { armyUpkeep: -0.10 },               scope: 'continent' },
  { continent: 'africa',        name: 'Heart of the World',       bonus: { resourceExtraction: 0.15 },         scope: 'global' },
  { continent: 'asia',          name: 'Mandate of Heaven',        bonus: { politicalPower: 0.10 },             scope: 'global' },
  { continent: 'oceania',       name: 'Pacific Doctrine',         bonus: { navalAirEffectiveness: 0.15 },      scope: 'global' },
]

// Groups archetypes per continent — used by resonance check
export const CONTINENT_ARCHETYPES: Record<Continent, LeyLineArchetype[]> = {
  north_america: ['prosperity', 'dominion', 'convergence'],
  south_america: ['prosperity', 'dominion', 'convergence'],
  europe:        ['prosperity', 'dominion', 'convergence'],
  africa:        ['prosperity', 'dominion', 'convergence'],
  asia:          ['prosperity', 'dominion', 'convergence'],
  oceania:       ['prosperity', 'dominion', 'convergence'],
}

// ── Diminishing returns for same-country multi-line holding ──

export const DIMINISHING_RETURNS = [1.0, 0.50, 0.25] as const

// ── Cross-continental resonance tiers ──

export const CROSS_CONTINENTAL_TIERS = [
  { setsRequired: 2, name: 'Dual Meridian', allStatBonus: 0.05 },
  { setsRequired: 3, name: 'Tri-Apex',      allStatBonus: 0.10 },
  { setsRequired: 4, name: 'World Axis',    allStatBonus: 0.15 },
] as const
