/**
 * leyLineGenerator.server.ts
 *
 * Auto-generates the three canonical ley lines (Dominion, Prosperity,
 * Convergence) for any country given its ordered list of region IDs.
 *
 * Called by:
 *   • POST /api/admin/ley-lines/generate-all  — seed every country
 *   • POST /api/admin/ley-lines/generate/:cc  — seed one country
 *   • Migration scripts
 *
 * Strategy:
 *   Given N regions sorted by geographic convention (order in REGION_DEFS):
 *   - DOMINION    → first half  (western / northern corridor)
 *   - PROSPERITY  → last half   (eastern / southern corridor)
 *   - CONVERGENCE → middle third, bridging the two
 *
 * Bonuses are archetype-standard — admin can override afterwards via PATCH.
 */

import type { LeyLineDef } from '../types/leyline.types.js'

// ── Country → continent map ──────────────────────────────────────────────────

type Continent =
  | 'north_america' | 'south_america' | 'europe'
  | 'africa' | 'asia' | 'oceania'

export const COUNTRY_CONTINENT: Record<string, Continent> = {
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  CU: 'north_america', BS: 'north_america',
  BR: 'south_america', AR: 'south_america', CO: 'south_america',
  VE: 'south_america', PE: 'south_america', CL: 'south_america',
  EC: 'south_america', BO: 'south_america', PY: 'south_america',
  UY: 'south_america', GY: 'south_america', SR: 'south_america',
  DE: 'europe', GB: 'europe', FR: 'europe', ES: 'europe', IT: 'europe',
  PL: 'europe', UA: 'europe', RO: 'europe', NL: 'europe', BE: 'europe',
  SE: 'europe', NO: 'europe', FI: 'europe', DK: 'europe', AT: 'europe',
  CH: 'europe', CZ: 'europe', PT: 'europe', GR: 'europe', HU: 'europe',
  IE: 'europe', IS: 'europe', RS: 'europe', BY: 'europe', BG: 'europe',
  SK: 'europe', HR: 'europe', LT: 'europe', LV: 'europe', EE: 'europe',
  SI: 'europe', BA: 'europe', AL: 'europe', MK: 'europe', ME: 'europe',
  MD: 'europe', TR: 'europe',
  RU: 'asia', CN: 'asia', JP: 'asia', IN: 'asia', KR: 'asia', KP: 'asia',
  TW: 'asia', TH: 'asia', VN: 'asia', PH: 'asia', MY: 'asia', ID: 'asia',
  MM: 'asia', BD: 'asia', PK: 'asia', AF: 'asia', IQ: 'asia', IR: 'asia',
  SA: 'asia', AE: 'asia', IL: 'asia', SY: 'asia', JO: 'asia', LB: 'asia',
  YE: 'asia', OM: 'asia', KW: 'asia', QA: 'asia', GE: 'asia', AM: 'asia',
  AZ: 'asia', KZ: 'asia', UZ: 'asia', TM: 'asia', KG: 'asia', TJ: 'asia',
  MN: 'asia', NP: 'asia', LK: 'asia', KH: 'asia', LA: 'asia',
  NG: 'africa', ZA: 'africa', EG: 'africa', KE: 'africa', ET: 'africa',
  TZ: 'africa', GH: 'africa', CI: 'africa', CM: 'africa', AO: 'africa',
  MZ: 'africa', MG: 'africa', MA: 'africa', DZ: 'africa', TN: 'africa',
  LY: 'africa', SD: 'africa', SS: 'africa', UG: 'africa', SN: 'africa',
  ML: 'africa', BF: 'africa', NE: 'africa', TD: 'africa', CD: 'africa',
  CG: 'africa', CF: 'africa', GA: 'africa', GQ: 'africa', MW: 'africa',
  ZM: 'africa', ZW: 'africa', BW: 'africa', NA: 'africa', SO: 'africa',
  ER: 'africa', MR: 'africa',
  AU: 'oceania', NZ: 'oceania', PG: 'oceania',
}

// ── Archetype bonus templates ─────────────────────────────────────────────────

const ARCHETYPE_BONUSES = {
  dominion: {
    bonuses:   { weaponProduction: 0.20, troopDamage: 0.10, deploymentSpeed: 0.15 },
    tradeoffs: { infraMaintenance: 0.10 },
  },
  prosperity: {
    bonuses:   { taxIncome: 0.20, tradeIncome: 0.15, populationGrowth: 0.10 },
    tradeoffs: { armyUpkeep: 0.05 },
  },
  convergence: {
    bonuses:   { navalSupport: 0.15, researchSpeed: 0.15, oilExtraction: 0.10 },
    tradeoffs: { foodYield: -0.10 },
  },
} as const

// ── Country name → human-readable ────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  US:'United States', CA:'Canada', MX:'Mexico', CU:'Cuba', BS:'Bahamas',
  RU:'Russia',  CN:'China',  DE:'Germany', GB:'United Kingdom', JP:'Japan',
  FR:'France',  ES:'Spain',  IT:'Italy',   BR:'Brazil', IN:'India',
  NG:'Nigeria', TR:'Turkey', KR:'Korea',   SA:'Saudi Arabia', AU:'Australia',
  AR:'Argentina', CO:'Colombia', VE:'Venezuela', PL:'Poland', UA:'Ukraine',
  IR:'Iran', IQ:'Iraq', PK:'Pakistan', AF:'Afghanistan', AE:'UAE',
  NL:'Netherlands', BE:'Belgium', SE:'Sweden', NO:'Norway', FI:'Finland',
  ZA:'South Africa', EG:'Egypt', KE:'Kenya', ET:'Ethiopia',
}

function countryName(cc: string) { return COUNTRY_NAMES[cc] ?? cc }

// ── Line name templates ───────────────────────────────────────────────────────

const DOMINION_NAMES: Record<string, string> = {
  north_america: 'the Eastern Seaboard',
  south_america: 'the Andean Heights',
  europe:        'the Iron Cross',
  africa:        'the Savanna Ridge',
  asia:          'the Jade Spine',
  oceania:       'the Pacific Crest',
}
const PROSPERITY_NAMES: Record<string, string> = {
  north_america: 'the Continental Artery',
  south_america: 'the Amazon Wealth',
  europe:        'the Rhine Corridor',
  africa:        'the Nile Trade Road',
  asia:          'the Silk Tributary',
  oceania:       'the Coral Coast',
}
const CONVERGENCE_NAMES: Record<string, string> = {
  north_america: 'the Heartland Nexus',
  south_america: 'the Southern Cross',
  europe:        'the Old Meridian',
  africa:        'the Rift Crossing',
  asia:          'the Dragon Gate',
  oceania:       'the Island Arc',
}

// ── Main generator ────────────────────────────────────────────────────────────

export interface GeneratorInput {
  countryCode: string
  regionIds:   string[]   // ordered list from REGION_DEFS (or DB)
}

export interface GeneratedLines {
  dominion:    LeyLineDef
  prosperity:  LeyLineDef
  convergence: LeyLineDef
}

export function generateLeyLinesForCountry(input: GeneratorInput): GeneratedLines {
  const { countryCode: cc, regionIds } = input
  const continent = COUNTRY_CONTINENT[cc] ?? 'asia'
  const cName     = countryName(cc)

  // Need at least 3 regions; pad if tiny country
  const regions = regionIds.length >= 3
    ? regionIds
    : [...regionIds, ...regionIds, ...regionIds].slice(0, 3)

  const n     = regions.length
  const third = Math.max(1, Math.floor(n / 3))

  // Dominion    = first segment
  const domBlocks  = regions.slice(0, Math.min(third * 2, n))
  // Prosperity  = last segment
  const prosBlocks = regions.slice(Math.max(0, n - third * 2))
  // Convergence = middle
  const midStart   = Math.floor(n / 4)
  const midEnd     = Math.min(n, midStart + Math.max(third * 2, 3))
  const convBlocks = regions.slice(midStart, midEnd)

  const make = (
    archetype: 'dominion' | 'prosperity' | 'convergence',
    blocks: string[],
    lineName: string,
  ): LeyLineDef => ({
    id:        `${cc}-${archetype.toUpperCase()}`,
    name:      `${cName} — ${lineName}`,
    continent,
    archetype,
    blocks,
    bonuses:   { ...ARCHETYPE_BONUSES[archetype].bonuses },
    tradeoffs: { ...ARCHETYPE_BONUSES[archetype].tradeoffs },
  })

  return {
    dominion:   make('dominion',    dedupe(domBlocks),  DOMINION_NAMES[continent]    ?? 'the Dominion Line'),
    prosperity: make('prosperity',  dedupe(prosBlocks), PROSPERITY_NAMES[continent]  ?? 'the Prosperity Line'),
    convergence:make('convergence', dedupe(convBlocks), CONVERGENCE_NAMES[continent] ?? 'the Convergence Line'),
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)]
}
