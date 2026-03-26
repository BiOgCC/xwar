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
export type LeyLineType = 'land' | 'sea'

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

/** Data specific to sea lines (trade routes) */
export interface SeaLineData {
  from: string
  fromCountry: string
  fromCoords: [number, number]
  to: string
  toCountry: string
  toCoords: [number, number]
  resourceTypes: string[]
  oil: number           // per-tick oil yield
  fish: number          // per-tick fish yield (converted → money)
  tradedGoods: number   // per-tick money yield
  lengthNm: number      // route length in nautical miles
}

export interface LeyLineDef {
  id: string
  name: string
  lineType: LeyLineType
  continent: Continent
  archetype: LeyLineArchetype
  blocks: string[]       // region IDs forming the corridor (land lines)
  bonuses: LeyLineBonus  // positive = buffs (land lines)
  tradeoffs: LeyLineBonus // values here are applied as penalties (land lines)
  seaData?: SeaLineData   // present only for lineType === 'sea'
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
  lineType:  'land',
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
  lineType:  'land',
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
  lineType:  'land',
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
  lineType:  'land',
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
  lineType:  'land',
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
  lineType:  'land',
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
  id: 'JP-DOMINION', name: 'Japan — the Jade Spine', lineType: 'land', continent: 'asia', archetype: 'dominion',
  blocks: ['JP-HK', 'JP-TH', 'JP-KT', 'JP-CB'],
  bonuses: { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const JP_PROSPERITY: LeyLineDef = {
  id: 'JP-PROSPERITY', name: 'Japan — the Silk Tributary', lineType: 'land', continent: 'asia', archetype: 'prosperity',
  blocks: ['JP-CB', 'JP-KS', 'JP-CG', 'JP-SK'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const JP_CONVERGENCE: LeyLineDef = {
  id: 'JP-CONVERGENCE', name: 'Japan — the Dragon Gate', lineType: 'land', continent: 'asia', archetype: 'convergence',
  blocks: ['JP-TH', 'JP-KT', 'JP-CB', 'JP-KY'],
  bonuses: { navalSupport: 0.15, researchSpeed: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.10 },
}

// ── China ──
const CN_DOMINION: LeyLineDef = {
  id: 'CN-DOMINION', name: 'China — the Dragon Spine', lineType: 'land', continent: 'asia', archetype: 'dominion',
  blocks: ['CN-XJ', 'CN-NM', 'CN-HL', 'CN-JL', 'CN-LN', 'CN-BJ'],
  bonuses: { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const CN_PROSPERITY: LeyLineDef = {
  id: 'CN-PROSPERITY', name: 'China — the Yellow River Road', lineType: 'land', continent: 'asia', archetype: 'prosperity',
  blocks: ['CN-GS', 'CN-SX', 'CN-HN', 'CN-SD', 'CN-JS', 'CN-GD'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const CN_CONVERGENCE: LeyLineDef = {
  id: 'CN-CONVERGENCE', name: 'China — the Silk Meridian', lineType: 'land', continent: 'asia', archetype: 'convergence',
  blocks: ['CN-TB', 'CN-QH', 'CN-SC', 'CN-YN', 'CN-GZ'],
  bonuses: { navalSupport: 0.15, researchSpeed: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.10 },
}

// ── Germany ──
const DE_DOMINION: LeyLineDef = {
  id: 'DE-DOMINION', name: 'Germany — the Iron Cross', lineType: 'land', continent: 'europe', archetype: 'dominion',
  blocks: ['DE-SH', 'DE-NI', 'DE-NW', 'DE-HE', 'DE-BW', 'DE-BY'],
  bonuses: { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const DE_PROSPERITY: LeyLineDef = {
  id: 'DE-PROSPERITY', name: 'Germany — the Rhine Corridor', lineType: 'land', continent: 'europe', archetype: 'prosperity',
  blocks: ['DE-HH', 'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-BW'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const DE_CONVERGENCE: LeyLineDef = {
  id: 'DE-CONVERGENCE', name: 'Germany — the Old Meridian', lineType: 'land', continent: 'europe', archetype: 'convergence',
  blocks: ['DE-BB', 'DE-BE', 'DE-ST', 'DE-TH', 'DE-SN'],
  bonuses: { navalSupport: 0.10, researchSpeed: 0.20, techBaseline: 0.10 },
  tradeoffs: { foodYield: -0.05 },
}

// ── United Kingdom ──
const GB_DOMINION: LeyLineDef = {
  id: 'GB-DOMINION', name: 'UK — the Northern Bastion', lineType: 'land', continent: 'europe', archetype: 'dominion',
  blocks: ['GB-SC', 'GB-NE', 'GB-NW', 'GB-YH'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, navalSupport: 0.20 },
  tradeoffs: { infraMaintenance: 0.08 },
}
const GB_PROSPERITY: LeyLineDef = {
  id: 'GB-PROSPERITY', name: 'UK — the Thames Artery', lineType: 'land', continent: 'europe', archetype: 'prosperity',
  blocks: ['GB-EM', 'GB-EN', 'GB-LN', 'GB-SW'],
  bonuses: { taxIncome: 0.25, tradeIncome: 0.20, populationGrowth: 0.08 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const GB_CONVERGENCE: LeyLineDef = {
  id: 'GB-CONVERGENCE', name: 'UK — the Celtic Crossing', lineType: 'land', continent: 'europe', archetype: 'convergence',
  blocks: ['GB-WA', 'GB-WM', 'GB-LN'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.15, politicalPower: 0.10 },
  tradeoffs: { foodYield: -0.08 },
}

// ── Brazil ──
const BR_DOMINION: LeyLineDef = {
  id: 'BR-DOMINION', name: 'Brazil — the Amazon Heights', lineType: 'land', continent: 'south_america', archetype: 'dominion',
  blocks: ['BR-AM', 'BR-PA', 'BR-MA', 'BR-RO'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, deploymentRange: 0.15 },
  tradeoffs: { infraMaintenance: 0.12 },
}
const BR_PROSPERITY: LeyLineDef = {
  id: 'BR-PROSPERITY', name: 'Brazil — the Amazon Wealth', lineType: 'land', continent: 'south_america', archetype: 'prosperity',
  blocks: ['BR-MT', 'BR-GO', 'BR-MS', 'BR-SP', 'BR-RJ'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.15, resourceExtraction: 0.20 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const BR_CONVERGENCE: LeyLineDef = {
  id: 'BR-CONVERGENCE', name: 'Brazil — the Southern Cross', lineType: 'land', continent: 'south_america', archetype: 'convergence',
  blocks: ['BR-TO', 'BR-BA', 'BR-MG', 'BR-RS'],
  bonuses: { navalSupport: 0.15, populationGrowth: 0.15, oilExtraction: 0.10 },
  tradeoffs: { foodYield: -0.05 },
}

// ── India ──
const IN_DOMINION: LeyLineDef = {
  id: 'IN-DOMINION', name: 'India — the Northern Bastion', lineType: 'land', continent: 'asia', archetype: 'dominion',
  blocks: ['IN-KA', 'IN-PB', 'IN-HR', 'IN-UP', 'IN-BI'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.15, deploymentSpeed: 0.10 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const IN_PROSPERITY: LeyLineDef = {
  id: 'IN-PROSPERITY', name: 'India — the Ganges Road', lineType: 'land', continent: 'asia', archetype: 'prosperity',
  blocks: ['IN-GJ', 'IN-RJ', 'IN-MP', 'IN-MH', 'IN-TN'],
  bonuses: { taxIncome: 0.15, tradeIncome: 0.15, populationGrowth: 0.20 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const IN_CONVERGENCE: LeyLineDef = {
  id: 'IN-CONVERGENCE', name: 'India — the Eastern Arc', lineType: 'land', continent: 'asia', archetype: 'convergence',
  blocks: ['IN-WB', 'IN-NE', 'IN-OR', 'IN-KR'],
  bonuses: { navalSupport: 0.15, researchSpeed: 0.10, resourceExtraction: 0.15 },
  tradeoffs: { foodYield: -0.08 },
}

// ── Canada ──
const CA_DOMINION: LeyLineDef = {
  id: 'CA-DOMINION', name: 'Canada — the Northern Shield', lineType: 'land', continent: 'north_america', archetype: 'dominion',
  blocks: ['CA-BC', 'CA-AB', 'CA-SK', 'CA-MB'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, deploymentRange: 0.20 },
  tradeoffs: { infraMaintenance: 0.15 },
}
const CA_PROSPERITY: LeyLineDef = {
  id: 'CA-PROSPERITY', name: 'Canada — the St Lawrence Artery', lineType: 'land', continent: 'north_america', archetype: 'prosperity',
  blocks: ['CA-ON', 'CA-QC', 'CA-NB', 'CA-NS'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.20, oilExtraction: 0.15 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const CA_CONVERGENCE: LeyLineDef = {
  id: 'CA-CONVERGENCE', name: 'Canada — the Arctic Meridian', lineType: 'land', continent: 'north_america', archetype: 'convergence',
  blocks: ['CA-YT', 'CA-NT', 'CA-NU', 'CA-NL'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.10, resourceExtraction: 0.20 },
  tradeoffs: { foodYield: -0.15, populationGrowth: -0.10 },
}

// ── Mexico ──
const MX_DOMINION: LeyLineDef = {
  id: 'MX-DOMINION', name: 'Mexico — the Northern Frontier', lineType: 'land', continent: 'north_america', archetype: 'dominion',
  blocks: ['MX-BC', 'MX-SO', 'MX-CH', 'MX-CO', 'MX-NL'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.10, deploymentSpeed: 0.15 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const MX_PROSPERITY: LeyLineDef = {
  id: 'MX-PROSPERITY', name: 'Mexico — the Gulf Corridor', lineType: 'land', continent: 'north_america', archetype: 'prosperity',
  blocks: ['MX-TM', 'MX-SL', 'MX-JA', 'MX-MC', 'MX-YU'],
  bonuses: { taxIncome: 0.15, tradeIncome: 0.20, oilExtraction: 0.20 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const MX_CONVERGENCE: LeyLineDef = {
  id: 'MX-CONVERGENCE', name: 'Mexico — the Pacific Gateway', lineType: 'land', continent: 'north_america', archetype: 'convergence',
  blocks: ['MX-DU', 'MX-JA', 'MX-MC'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.10, tradeIncome: 0.10 },
  tradeoffs: { foodYield: -0.05 },
}

// ── Nigeria ──
const NG_DOMINION: LeyLineDef = {
  id: 'NG-DOMINION', name: 'Nigeria — the Savanna Ridge', lineType: 'land', continent: 'africa', archetype: 'dominion',
  blocks: ['NG-NW', 'NG-NC', 'NG-NE'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.15, deploymentSpeed: 0.10 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const NG_PROSPERITY: LeyLineDef = {
  id: 'NG-PROSPERITY', name: 'Nigeria — the Niger Delta', lineType: 'land', continent: 'africa', archetype: 'prosperity',
  blocks: ['NG-LG', 'NG-SW', 'NG-SS'],
  bonuses: { taxIncome: 0.15, oilExtraction: 0.30, tradeIncome: 0.15 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const NG_CONVERGENCE: LeyLineDef = {
  id: 'NG-CONVERGENCE', name: 'Nigeria — the Rift Crossing', lineType: 'land', continent: 'africa', archetype: 'convergence',
  blocks: ['NG-SE', 'NG-NC', 'NG-SW'],
  bonuses: { navalSupport: 0.10, populationGrowth: 0.20, resourceExtraction: 0.15 },
  tradeoffs: { foodYield: -0.08 },
}

// ── Turkey ──
const TR_DOMINION: LeyLineDef = {
  id: 'TR-DOMINION', name: 'Turkey — the Anatolian Spine', lineType: 'land', continent: 'asia', archetype: 'dominion',
  blocks: ['TR-IS', 'TR-MA', 'TR-AN', 'TR-EA', 'TR-SE'],
  bonuses: { weaponProduction: 0.15, troopDamage: 0.15, deploymentSpeed: 0.10 },
  tradeoffs: { infraMaintenance: 0.10 },
}
const TR_PROSPERITY: LeyLineDef = {
  id: 'TR-PROSPERITY', name: 'Turkey — the Bosphorus Route', lineType: 'land', continent: 'asia', archetype: 'prosperity',
  blocks: ['TR-IS', 'TR-MA', 'TR-AE', 'TR-MD'],
  bonuses: { taxIncome: 0.20, tradeIncome: 0.25, navalSupport: 0.10 },
  tradeoffs: { armyUpkeep: 0.05 },
}
const TR_CONVERGENCE: LeyLineDef = {
  id: 'TR-CONVERGENCE', name: 'Turkey — the Black Sea Gate', lineType: 'land', continent: 'asia', archetype: 'convergence',
  blocks: ['TR-BS', 'TR-AN', 'TR-EA'],
  bonuses: { navalSupport: 0.20, researchSpeed: 0.10, deploymentRange: 0.15 },
  tradeoffs: { foodYield: -0.08 },
}

// ══════════════════════════════════════════════
//  SEA LEY LINES (former Trade Routes)
// ══════════════════════════════════════════════

const SEA_NORTH_ATLANTIC: LeyLineDef = {
  id: 'north-atlantic-lane', name: 'North Atlantic Lane', lineType: 'sea',
  continent: 'north_america', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'New York', fromCountry: 'US', fromCoords: [-74, 40.71], to: 'Rotterdam', toCountry: 'NL', toCoords: [4.48, 51.92], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 1400, lengthNm: 3459 },
}
const SEA_SUEZ: LeyLineDef = {
  id: 'suez-canal-lane', name: 'Suez Canal Lane', lineType: 'sea',
  continent: 'africa', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Port Said', fromCountry: 'EG', fromCoords: [32.3, 31.26], to: 'Jebel Ali', toCountry: 'AE', toCoords: [55.03, 25.01], resourceTypes: ['oil', 'goods'], oil: 350, fish: 0, tradedGoods: 1200, lengthNm: 3927 },
}
const SEA_HORMUZ: LeyLineDef = {
  id: 'hormuz-strait-lane', name: 'Hormuz Strait Lane', lineType: 'sea',
  continent: 'asia', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Dubai', fromCountry: 'AE', fromCoords: [55.27, 25.2], to: 'Mumbai', toCountry: 'IN', toCoords: [72.88, 19.08], resourceTypes: ['oil'], oil: 500, fish: 0, tradedGoods: 0, lengthNm: 1491 },
}
const SEA_PANAMA: LeyLineDef = {
  id: 'panama-canal-lane', name: 'Panama Canal Lane', lineType: 'sea',
  continent: 'north_america', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Colón', fromCountry: 'PA', fromCoords: [-79.9, 9.36], to: 'Los Angeles', toCountry: 'US', toCoords: [-118.25, 33.75], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 1500, lengthNm: 3990 },
}
const SEA_CAPE: LeyLineDef = {
  id: 'cape-route', name: 'Cape Route', lineType: 'sea',
  continent: 'africa', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Cape Town', fromCountry: 'ZA', fromCoords: [18.42, -33.92], to: 'Rotterdam', toCountry: 'NL', toCoords: [4.48, 51.92], resourceTypes: ['oil', 'goods'], oil: 280, fish: 0, tradedGoods: 900, lengthNm: 8333 },
}
const SEA_SOUTH_CHINA: LeyLineDef = {
  id: 'south-china-sea-lane', name: 'South China Sea Lane', lineType: 'sea',
  continent: 'asia', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Shanghai', fromCountry: 'CN', fromCoords: [121.47, 31.23], to: 'Singapore', toCountry: 'SG', toCoords: [103.82, 1.35], resourceTypes: ['goods'], oil: 200, fish: 0, tradedGoods: 3200, lengthNm: 2500 },
}
const SEA_MEDITERRANEAN: LeyLineDef = {
  id: 'mediterranean-lane', name: 'Mediterranean Lane', lineType: 'sea',
  continent: 'europe', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Barcelona', fromCountry: 'IT', fromCoords: [2.17, 41.39], to: 'Istanbul', toCountry: 'TR', toCoords: [28.98, 41.01], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 2100, lengthNm: 1800 },
}
const SEA_ENGLISH_CHANNEL: LeyLineDef = {
  id: 'english-channel-lane', name: 'English Channel Lane', lineType: 'sea',
  continent: 'europe', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Rotterdam', fromCountry: 'NL', fromCoords: [4.48, 51.92], to: 'London', toCountry: 'GB', toCoords: [-0.12, 51.51], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 1000, lengthNm: 227 },
}
const SEA_MALACCA: LeyLineDef = {
  id: 'malacca-strait-lane', name: 'Malacca Strait Lane', lineType: 'sea',
  continent: 'asia', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Singapore', fromCountry: 'SG', fromCoords: [103.85, 1.29], to: 'Shanghai', toCountry: 'CN', toCoords: [121.47, 31.23], resourceTypes: ['oil', 'goods'], oil: 200, fish: 0, tradedGoods: 800, lengthNm: 3023 },
}
const SEA_PACIFIC: LeyLineDef = {
  id: 'trans-pacific-lane', name: 'Trans-Pacific Lane', lineType: 'sea',
  continent: 'asia', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Tokyo', fromCountry: 'JP', fromCoords: [139.69, 35.69], to: 'Los Angeles', toCountry: 'US', toCoords: [-118.24, 34.05], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 3900, lengthNm: 5500 },
}
const SEA_ARABIAN: LeyLineDef = {
  id: 'arabian-sea-lane', name: 'Arabian Sea Lane', lineType: 'sea',
  continent: 'asia', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Mumbai', fromCountry: 'IN', fromCoords: [72.88, 19.08], to: 'Mombasa', toCountry: 'KE', toCoords: [39.66, -4.05], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 2700, lengthNm: 5800 },
}
const SEA_BALTIC: LeyLineDef = {
  id: 'baltic-lane', name: 'Baltic Lane', lineType: 'sea',
  continent: 'europe', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Rotterdam', fromCountry: 'NL', fromCoords: [4.47, 51.92], to: 'St. Petersburg', toCountry: 'RU', toCoords: [30.32, 59.93], resourceTypes: ['oil', 'goods'], oil: 100, fish: 0, tradedGoods: 1500, lengthNm: 1400 },
}
const SEA_EAST_AFRICA: LeyLineDef = {
  id: 'east-africa-lane', name: 'East Africa Lane', lineType: 'sea',
  continent: 'africa', archetype: 'prosperity', blocks: [], bonuses: {}, tradeoffs: {},
  seaData: { from: 'Mombasa', fromCountry: 'KE', fromCoords: [39.66, -4.05], to: 'Djibouti', toCountry: 'DJ', toCoords: [43.15, 11.59], resourceTypes: ['goods'], oil: 0, fish: 0, tradedGoods: 1200, lengthNm: 4200 },
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
  // Sea Lines (IDs match trade-routes.geojson)
  SEA_MALACCA, SEA_SUEZ, SEA_PANAMA, SEA_HORMUZ, SEA_CAPE,
  SEA_ENGLISH_CHANNEL, SEA_NORTH_ATLANTIC, SEA_PACIFIC,
  SEA_SOUTH_CHINA, SEA_MEDITERRANEAN, SEA_ARABIAN, SEA_BALTIC, SEA_EAST_AFRICA,
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

/** Get the Ley Line(s) that a given region belongs to (land lines only) */
export function getLeyLinesForRegion(regionId: string): LeyLineDef[] {
  return LEY_LINE_DEFS.filter(l => l.lineType === 'land' && l.blocks.includes(regionId))
}

/** Get resonance definition for a continent */
export function getResonance(c: Continent): ContinentalResonance | undefined {
  return CONTINENTAL_RESONANCE.find(r => r.continent === c)
}

/** All unique country codes involved in a Ley Line */
export function getCountriesInLine(line: LeyLineDef): string[] {
  if (line.lineType === 'sea' && line.seaData) {
    return [line.seaData.fromCountry, line.seaData.toCountry].filter((v, i, a) => a.indexOf(v) === i)
  }
  const ccs = new Set<string>()
  line.blocks.forEach(b => {
    const cc = b.split('-')[0]
    ccs.add(cc)
  })
  return [...ccs]
}

/** Get only land or sea lines */
export function getLeyLinesByType(type: LeyLineType): LeyLineDef[] {
  return LEY_LINE_DEFS.filter(l => l.lineType === type)
}

