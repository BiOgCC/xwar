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

// ── All Ley Line definitions ──

// ── Russia / Eurasia ──

const RU_DOMINION: LeyLineDef = {
  id:        'RU-DOMINION',
  name:      'The Siberian Spine',
  continent: 'asia',
  archetype: 'dominion',
  blocks: [
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
    'US-WA', 'US-OR', 'US-CA', 'US-NV', 'US-AZ',
  ],
  bonuses:   { navalSupport: 0.20, researchSpeed: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.10 },
}

// ── Japan ──
const JP_DOMINION: LeyLineDef = {
  id: 'JP-DOMINION', name: 'Japan — the Jade Spine', continent: 'asia', archetype: 'dominion',
  blocks: ['JP-HK', 'JP-TH', 'JP-KT', 'JP-CB'],
  bonuses: { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const JP_PROSPERITY: LeyLineDef = {
  id: 'JP-PROSPERITY', name: 'Japan — the Silk Tributary', continent: 'asia', archetype: 'prosperity',
  blocks: ['JP-CB', 'JP-KS', 'JP-CG', 'JP-SK'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const JP_CONVERGENCE: LeyLineDef = {
  id: 'JP-CONVERGENCE', name: 'Japan — the Dragon Gate', continent: 'asia', archetype: 'convergence',
  blocks: ['JP-TH', 'JP-KT', 'JP-CB', 'JP-KY'],
  bonuses: { navalSupport: 0.15, researchSpeed: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.10 },
}

// ── China ──
const CN_DOMINION: LeyLineDef = {
  id: 'CN-DOMINION', name: 'China — the Dragon Spine', continent: 'asia', archetype: 'dominion',
  blocks: ['CN-XJ', 'CN-NM', 'CN-HL', 'CN-JL', 'CN-LN', 'CN-BJ'],
  bonuses: { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const CN_PROSPERITY: LeyLineDef = {
  id: 'CN-PROSPERITY', name: 'China — the Yellow River Road', continent: 'asia', archetype: 'prosperity',
  blocks: ['CN-GS', 'CN-SX', 'CN-HN', 'CN-SD', 'CN-JS', 'CN-GD'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const CN_CONVERGENCE: LeyLineDef = {
  id: 'CN-CONVERGENCE', name: 'China — the Silk Meridian', continent: 'asia', archetype: 'convergence',
  blocks: ['CN-TB', 'CN-QH', 'CN-SC', 'CN-YN', 'CN-GZ'],
  bonuses: { navalSupport: 0.15, researchSpeed: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.10 },
}

// ── Germany ──
const DE_DOMINION: LeyLineDef = {
  id: 'DE-DOMINION', name: 'Germany — the Iron Cross', continent: 'europe', archetype: 'dominion',
  blocks: ['DE-SH', 'DE-NI', 'DE-NW', 'DE-HE', 'DE-BW', 'DE-BY'],
  bonuses: { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const DE_PROSPERITY: LeyLineDef = {
  id: 'DE-PROSPERITY', name: 'Germany — the Rhine Corridor', continent: 'europe', archetype: 'prosperity',
  blocks: ['DE-HH', 'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-BW'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const DE_CONVERGENCE: LeyLineDef = {
  id: 'DE-CONVERGENCE', name: 'Germany — the Old Meridian', continent: 'europe', archetype: 'convergence',
  blocks: ['DE-BB', 'DE-BE', 'DE-ST', 'DE-TH', 'DE-SN'],
  bonuses: { navalSupport: 0.10, researchSpeed: 0.20, techBaseline: 0.10 },
  tradeoffs: { foodYield: -0.05 },
}

// ── United Kingdom ──
const GB_DOMINION: LeyLineDef = {
  id: 'GB-DOMINION', name: 'UK — the Northern Bastion', continent: 'europe', archetype: 'dominion',
  blocks: ['GB-SC', 'GB-NE', 'GB-NW', 'GB-YH'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, navalSupport: 0.20 },
  tradeoffs: { infraMaintenance: 0.08 },
}
const GB_PROSPERITY: LeyLineDef = {
  id: 'GB-PROSPERITY', name: 'UK — the Thames Artery', continent: 'europe', archetype: 'prosperity',
  blocks: ['GB-EM', 'GB-EN', 'GB-LN', 'GB-SW'],
  bonuses: { taxIncome: 0.25, tradeIncome: 0.20, populationGrowth: 0.08 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const GB_CONVERGENCE: LeyLineDef = {
  id: 'GB-CONVERGENCE', name: 'UK — the Celtic Crossing', continent: 'europe', archetype: 'convergence',
  blocks: ['GB-WA', 'GB-WM', 'GB-LN'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.15, politicalPower: 0.10 },
  tradeoffs: { foodYield: -0.08 },
}

// ── Brazil ──
const BR_DOMINION: LeyLineDef = {
  id: 'BR-DOMINION', name: 'Brazil — the Amazon Heights', continent: 'south_america', archetype: 'dominion',
  blocks: ['BR-AM', 'BR-PA', 'BR-MA', 'BR-RO'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, deploymentRange: 0.15 },
  tradeoffs: { infraMaintenance: 0.12 },
}
const BR_PROSPERITY: LeyLineDef = {
  id: 'BR-PROSPERITY', name: 'Brazil — the Amazon Wealth', continent: 'south_america', archetype: 'prosperity',
  blocks: ['BR-MT', 'BR-GO', 'BR-MS', 'BR-SP', 'BR-RJ'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, resourceExtraction: 0.20 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const BR_CONVERGENCE: LeyLineDef = {
  id: 'BR-CONVERGENCE', name: 'Brazil — the Southern Cross', continent: 'south_america', archetype: 'convergence',
  blocks: ['BR-TO', 'BR-BA', 'BR-MG', 'BR-RS'],
  bonuses: { navalSupport: 0.15, populationGrowth: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.05 },
}

// ── India ──
const IN_DOMINION: LeyLineDef = {
  id: 'IN-DOMINION', name: 'India — the Northern Bastion', continent: 'asia', archetype: 'dominion',
  blocks: ['IN-KA', 'IN-PB', 'IN-HR', 'IN-UP', 'IN-BI'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.15, deploymentSpeed: 0.10 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const IN_PROSPERITY: LeyLineDef = {
  id: 'IN-PROSPERITY', name: 'India — the Ganges Road', continent: 'asia', archetype: 'prosperity',
  blocks: ['IN-GJ', 'IN-RJ', 'IN-MP', 'IN-MH', 'IN-TN'],
  bonuses: { taxIncome: 0.15, tradeIncome: 0.15, populationGrowth: 0.20 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const IN_CONVERGENCE: LeyLineDef = {
  id: 'IN-CONVERGENCE', name: 'India — the Eastern Arc', continent: 'asia', archetype: 'convergence',
  blocks: ['IN-WB', 'IN-NE', 'IN-OR', 'IN-KR'],
  bonuses: { navalSupport: 0.15, researchSpeed: 0.10, resourceExtraction: 0.15 },
  tradeoffs: { foodYield: -0.08 },
}

// ── Canada ──
const CA_DOMINION: LeyLineDef = {
  id: 'CA-DOMINION', name: 'Canada — the Northern Shield', continent: 'north_america', archetype: 'dominion',
  blocks: ['CA-BC', 'CA-AB', 'CA-SK', 'CA-MB'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, deploymentRange: 0.20 },
  tradeoffs: { infraMaintenance: 0.15 },
}
const CA_PROSPERITY: LeyLineDef = {
  id: 'CA-PROSPERITY', name: 'Canada — the St Lawrence Artery', continent: 'north_america', archetype: 'prosperity',
  blocks: ['CA-ON', 'CA-QC', 'CA-NB', 'CA-NS'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.20, oilExtraction: 0.15 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const CA_CONVERGENCE: LeyLineDef = {
  id: 'CA-CONVERGENCE', name: 'Canada — the Arctic Meridian', continent: 'north_america', archetype: 'convergence',
  blocks: ['CA-YT', 'CA-NT', 'CA-NU', 'CA-NL'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.10, resourceExtraction: 0.20 },
  tradeoffs: { foodYield: -0.15, populationGrowth: -0.10 },
}

// ── Mexico ──
const MX_DOMINION: LeyLineDef = {
  id: 'MX-DOMINION', name: 'Mexico — the Northern Frontier', continent: 'north_america', archetype: 'dominion',
  blocks: ['MX-BC', 'MX-SO', 'MX-CH', 'MX-CO', 'MX-NL'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const MX_PROSPERITY: LeyLineDef = {
  id: 'MX-PROSPERITY', name: 'Mexico — the Gulf Corridor', continent: 'north_america', archetype: 'prosperity',
  blocks: ['MX-TM', 'MX-SL', 'MX-JA', 'MX-MC', 'MX-YU'],
  bonuses: { taxIncome: 0.15, tradeIncome: 0.20, oilExtraction: 0.20 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const MX_CONVERGENCE: LeyLineDef = {
  id: 'MX-CONVERGENCE', name: 'Mexico — the Pacific Gateway', continent: 'north_america', archetype: 'convergence',
  blocks: ['MX-DU', 'MX-JA', 'MX-MC'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.10, tradeIncome: 0.10 },
  tradeoffs: { foodYield: -0.05 },
}

// ── Nigeria ──
const NG_DOMINION: LeyLineDef = {
  id: 'NG-DOMINION', name: 'Nigeria — the Savanna Ridge', continent: 'africa', archetype: 'dominion',
  blocks: ['NG-NW', 'NG-NC', 'NG-NE'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.15, deploymentSpeed: 0.10 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const NG_PROSPERITY: LeyLineDef = {
  id: 'NG-PROSPERITY', name: 'Nigeria — the Niger Delta', continent: 'africa', archetype: 'prosperity',
  blocks: ['NG-LG', 'NG-SW', 'NG-SS'],
  bonuses: { taxIncome: 0.15, oilExtraction: 0.30, tradeIncome: 0.15 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const NG_CONVERGENCE: LeyLineDef = {
  id: 'NG-CONVERGENCE', name: 'Nigeria — the Rift Crossing', continent: 'africa', archetype: 'convergence',
  blocks: ['NG-SE', 'NG-NC', 'NG-SW'],
  bonuses: { navalSupport: 0.10, populationGrowth: 0.20, resourceExtraction: 0.15 },
  tradeoffs: { foodYield: -0.08 },
}

// ── Turkey ──
const TR_DOMINION: LeyLineDef = {
  id: 'TR-DOMINION', name: 'Turkey — the Anatolian Spine', continent: 'asia', archetype: 'dominion',
  blocks: ['TR-IS', 'TR-MA', 'TR-AN', 'TR-EA', 'TR-SE'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.15, deploymentSpeed: 0.10 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const TR_PROSPERITY: LeyLineDef = {
  id: 'TR-PROSPERITY', name: 'Turkey — the Bosphorus Route', continent: 'asia', archetype: 'prosperity',
  blocks: ['TR-IS', 'TR-MA', 'TR-AE', 'TR-MD'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.25, navalSupport: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const TR_CONVERGENCE: LeyLineDef = {
  id: 'TR-CONVERGENCE', name: 'Turkey — the Black Sea Gate', continent: 'asia', archetype: 'convergence',
  blocks: ['TR-BS', 'TR-AN', 'TR-EA'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.10, deploymentRange: 0.15 },
  tradeoffs: { foodYield: -0.08 },
}

export const LEY_LINE_DEFS: LeyLineDef[] = [
  // Russia
  RU_DOMINION, RU_PROSPERITY, RU_CONVERGENCE,
  // North America (continental)
  NA_PROSPERITY, NA_DOMINION, NA_CONVERGENCE,
  // Canada
  CA_DOMINION, CA_PROSPERITY, CA_CONVERGENCE,
  // Mexico
  MX_DOMINION, MX_PROSPERITY, MX_CONVERGENCE,
  // Japan
  JP_DOMINION, JP_PROSPERITY, JP_CONVERGENCE,
  // China
  CN_DOMINION, CN_PROSPERITY, CN_CONVERGENCE,
  // Germany
  DE_DOMINION, DE_PROSPERITY, DE_CONVERGENCE,
  // United Kingdom
  GB_DOMINION, GB_PROSPERITY, GB_CONVERGENCE,
  // Brazil
  BR_DOMINION, BR_PROSPERITY, BR_CONVERGENCE,
  // India
  IN_DOMINION, IN_PROSPERITY, IN_CONVERGENCE,
  // Nigeria
  NG_DOMINION, NG_PROSPERITY, NG_CONVERGENCE,
  // Turkey
  TR_DOMINION, TR_PROSPERITY, TR_CONVERGENCE,
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
