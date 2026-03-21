import { create } from 'zustand'

import type { NationalFund, NationalFundKey, DepositType, RegionalDeposit, ConqueredResourceType, Country, War } from '../types/world.types'
export type { NationalFund, NationalFundKey, DepositType, RegionalDeposit, ConqueredResourceType, Country, War }

// Tiered seed funds scaled by country economic size
const FUND_LARGE: NationalFund  = { money: 50_000_000, oil: 5_000_000, scrap: 5_000_000, materialX: 5_000_000, bitcoin: 50_000, jets: 100 }
const FUND_MEDIUM: NationalFund = { money: 20_000_000, oil: 2_000_000, scrap: 2_000_000, materialX: 2_000_000, bitcoin: 20_000, jets: 40 }
const FUND_SMALL: NationalFund  = { money: 5_000_000,  oil: 500_000,  scrap: 500_000,  materialX: 500_000,  bitcoin: 5_000,  jets: 10 }
const FUND_TINY: NationalFund   = { money: 1_000_000,  oil: 100_000,  scrap: 100_000,  materialX: 100_000,  bitcoin: 1_000,  jets: 2 }

type FundTier = 'large' | 'medium' | 'small' | 'tiny'
function getFundForTier(tier: FundTier): NationalFund {
  const base = tier === 'large' ? FUND_LARGE : tier === 'medium' ? FUND_MEDIUM : tier === 'small' ? FUND_SMALL : FUND_TINY
  return { ...base }
}

export const CONQUERED_RESOURCE_TYPES: ConqueredResourceType[] = ['Iron', 'Titanium', 'Saltpeter', 'Rubber', 'Silicon', 'Uranium']

/** Calculate the total production bonus from a country's conquered resources */
export function getCountryResourceBonus(resources: ConqueredResourceType[]): number {
  const counts: Record<string, number> = {}
  resources.forEach(r => { counts[r] = (counts[r] || 0) + 1 })
  let bonus = 0
  Object.values(counts).forEach((count) => {
    if (count >= 1) bonus += 5     // 1st of type = +5%
    if (count >= 2) bonus += 0.5   // 2nd of same = +0.5%
    if (count >= 3) bonus += 0.25  // 3rd of same = +0.25%
  })
  return bonus
}

// Map of ISO codes to array of adjacent ISO codes
export const ADJACENCY_MAP: Record<string, string[]> = {
  // North America
  'US': ['CA', 'MX', 'CU', 'BS', 'RU', 'GB', 'BR', 'DE'],
  'CA': ['US'],
  'MX': ['US', 'CU', 'GT', 'BZ'],
  'CU': ['US', 'MX', 'BS', 'JM', 'HT'],
  'BS': ['US', 'CU'],
  // Central America & Caribbean
  'GT': ['MX', 'HN', 'SV'],
  'HN': ['GT', 'SV', 'NI'],
  'SV': ['GT', 'HN'],
  'NI': ['HN', 'CR'],
  'CR': ['NI', 'PA'],
  'PA': ['CR', 'CO'],
  'JM': ['CU', 'HT'],
  'HT': ['CU', 'DO', 'JM'],
  'DO': ['HT'],
  'TT': ['VE'],
  // South America
  'BR': ['US', 'NG', 'AR', 'CO', 'VE', 'GY', 'SR', 'PE', 'BO', 'PY', 'UY'],
  'AR': ['BR', 'CL', 'BO', 'PY', 'UY'],
  'CO': ['PA', 'VE', 'BR', 'PE', 'EC'],
  'VE': ['CO', 'BR', 'GY', 'TT'],
  'PE': ['CO', 'BR', 'BO', 'EC', 'CL'],
  'CL': ['AR', 'PE', 'BO'],
  'EC': ['CO', 'PE'],
  'BO': ['BR', 'AR', 'PE', 'CL', 'PY'],
  'PY': ['BR', 'AR', 'BO'],
  'UY': ['BR', 'AR'],
  'GY': ['VE', 'BR', 'SR'],
  'SR': ['GY', 'BR'],
  // Europe
  'GB': ['US', 'DE', 'FR', 'IE', 'NO', 'IS'],
  'DE': ['RU', 'GB', 'TR', 'US', 'FR', 'NL', 'BE', 'DK', 'PL', 'CZ', 'AT', 'CH'],
  'FR': ['GB', 'DE', 'ES', 'IT', 'BE', 'CH'],
  'ES': ['FR', 'PT', 'MA'],
  'IT': ['FR', 'AT', 'CH', 'SI', 'HR'],
  'PL': ['DE', 'CZ', 'SK', 'UA', 'BY', 'LT', 'RU'],
  'UA': ['PL', 'SK', 'HU', 'RO', 'MD', 'BY', 'RU'],
  'RO': ['UA', 'MD', 'HU', 'RS', 'BG'],
  'NL': ['DE', 'BE'],
  'BE': ['NL', 'DE', 'FR'],
  'SE': ['NO', 'FI', 'DK'],
  'NO': ['SE', 'FI', 'RU', 'GB', 'IS'],
  'FI': ['SE', 'NO', 'RU'],
  'DK': ['DE', 'SE'],
  'AT': ['DE', 'IT', 'CH', 'CZ', 'SK', 'HU', 'SI'],
  'CH': ['DE', 'FR', 'IT', 'AT'],
  'CZ': ['DE', 'PL', 'SK', 'AT'],
  'PT': ['ES'],
  'GR': ['AL', 'MK', 'BG', 'TR'],
  'HU': ['AT', 'SK', 'UA', 'RO', 'RS', 'HR', 'SI'],
  'IE': ['GB'],
  'IS': ['NO', 'GB'],
  'RS': ['HU', 'RO', 'BG', 'MK', 'AL', 'ME', 'BA', 'HR'],
  'BY': ['PL', 'UA', 'RU', 'LT', 'LV'],
  'BG': ['RO', 'RS', 'MK', 'GR', 'TR'],
  'SK': ['PL', 'CZ', 'AT', 'HU', 'UA'],
  'HR': ['SI', 'HU', 'RS', 'BA', 'ME', 'IT'],
  'LT': ['PL', 'BY', 'LV', 'RU'],
  'LV': ['LT', 'BY', 'EE', 'RU'],
  'EE': ['LV', 'RU', 'FI'],
  'SI': ['IT', 'AT', 'HU', 'HR'],
  'BA': ['HR', 'RS', 'ME'],
  'AL': ['ME', 'RS', 'MK', 'GR'],
  'MK': ['RS', 'BG', 'GR', 'AL'],
  'ME': ['HR', 'BA', 'RS', 'AL'],
  'MD': ['UA', 'RO'],
  // Russia & Central Asia
  'RU': ['US', 'CN', 'JP', 'TR', 'DE', 'FI', 'NO', 'PL', 'UA', 'BY', 'LT', 'LV', 'EE', 'GE', 'AZ', 'KZ', 'MN'],
  'KZ': ['RU', 'CN', 'KG', 'UZ', 'TM'],
  'UZ': ['KZ', 'KG', 'TJ', 'TM', 'AF'],
  'TM': ['KZ', 'UZ', 'AF', 'IR'],
  'KG': ['KZ', 'UZ', 'TJ', 'CN'],
  'TJ': ['KG', 'UZ', 'AF', 'CN'],
  // East Asia
  'CN': ['RU', 'IN', 'JP', 'KZ', 'KG', 'TJ', 'AF', 'PK', 'NP', 'MM', 'LA', 'VN', 'KP', 'MN', 'TW'],
  'JP': ['CN', 'RU', 'US', 'KR', 'TW'],
  'KR': ['JP', 'KP'],
  'KP': ['CN', 'KR', 'RU'],
  'TW': ['CN', 'JP', 'PH'],
  'MN': ['RU', 'CN'],
  // Southeast Asia
  'TH': ['MM', 'LA', 'KH', 'MY'],
  'VN': ['CN', 'LA', 'KH'],
  'PH': ['TW', 'MY', 'ID'],
  'MY': ['TH', 'ID', 'BN', 'SG', 'PH'],
  'ID': ['MY', 'PG', 'PH', 'AU'],
  'MM': ['CN', 'TH', 'LA', 'BD', 'IN'],
  'LA': ['CN', 'VN', 'KH', 'TH', 'MM'],
  'KH': ['VN', 'TH', 'LA'],
  'BN': ['MY'],
  'SG': ['MY'],
  // South Asia
  'IN': ['CN', 'PK', 'BD', 'NP', 'MM', 'LK'],
  'PK': ['IN', 'CN', 'AF', 'IR'],
  'BD': ['IN', 'MM'],
  'NP': ['IN', 'CN'],
  'LK': ['IN'],
  'AF': ['PK', 'CN', 'TJ', 'UZ', 'TM', 'IR'],
  // Middle East
  'TR': ['RU', 'DE', 'NG', 'GR', 'BG', 'GE', 'AM', 'AZ', 'IR', 'IQ', 'SY'],
  'IR': ['TR', 'IQ', 'AF', 'PK', 'TM', 'AZ', 'AM'],
  'IQ': ['TR', 'IR', 'SY', 'JO', 'SA', 'KW'],
  'SA': ['IQ', 'JO', 'YE', 'OM', 'AE', 'QA', 'KW', 'EG'],
  'AE': ['SA', 'OM'],
  'IL': ['SY', 'JO', 'LB', 'EG'],
  'SY': ['TR', 'IQ', 'JO', 'IL', 'LB'],
  'JO': ['SY', 'IQ', 'SA', 'IL'],
  'LB': ['SY', 'IL'],
  'YE': ['SA', 'OM'],
  'OM': ['SA', 'AE', 'YE'],
  'KW': ['SA', 'IQ'],
  'QA': ['SA'],
  'GE': ['RU', 'TR', 'AM', 'AZ'],
  'AM': ['GE', 'TR', 'AZ', 'IR'],
  'AZ': ['RU', 'GE', 'AM', 'IR'],
  // North Africa
  'EG': ['SA', 'IL', 'LY', 'SD'],
  'LY': ['EG', 'TN', 'DZ', 'TD', 'SD', 'NE'],
  'TN': ['LY', 'DZ'],
  'DZ': ['TN', 'LY', 'MA', 'NE', 'ML', 'MR'],
  'MA': ['DZ', 'ES', 'MR'],
  // West Africa
  'NG': ['BR', 'TR', 'CM', 'TD', 'NE', 'BJ', 'GH'],
  'GH': ['CI', 'TG', 'BF', 'NG'],
  'CI': ['GH', 'ML', 'BF', 'LR', 'GW', 'SN'],
  'SN': ['MR', 'ML', 'GM', 'GW', 'CI'],
  'ML': ['DZ', 'MR', 'SN', 'CI', 'BF', 'NE'],
  'BF': ['ML', 'NE', 'GH', 'CI', 'TG', 'BJ'],
  'NE': ['DZ', 'LY', 'NG', 'TD', 'ML', 'BF', 'BJ'],
  'GM': ['SN'],
  'GW': ['SN', 'CI'],
  'SL': ['LR', 'CI'],
  'LR': ['SL', 'CI'],
  'TG': ['GH', 'BF', 'BJ'],
  'BJ': ['TG', 'BF', 'NE', 'NG'],
  'MR': ['MA', 'DZ', 'ML', 'SN'],
  // Central Africa
  'CM': ['NG', 'TD', 'CF', 'CG', 'GA', 'GQ'],
  'TD': ['NG', 'CM', 'CF', 'LY', 'NE', 'SD'],
  'CF': ['CM', 'TD', 'SD', 'CD', 'CG'],
  'CD': ['CF', 'CG', 'AO', 'ZM', 'TZ', 'BI', 'RW', 'UG', 'SS'],
  'CG': ['CM', 'CF', 'CD', 'GA', 'AO'],
  'GA': ['CM', 'CG', 'GQ'],
  'GQ': ['CM', 'GA'],
  // East Africa
  'KE': ['ET', 'SO', 'TZ', 'UG', 'SS'],
  'ET': ['KE', 'SO', 'ER', 'DJ', 'SS', 'SD'],
  'TZ': ['KE', 'UG', 'RW', 'BI', 'CD', 'ZM', 'MW', 'MZ'],
  'UG': ['KE', 'TZ', 'CD', 'RW', 'SS'],
  'SS': ['SD', 'ET', 'KE', 'UG', 'CD', 'CF'],
  'SD': ['EG', 'LY', 'TD', 'CF', 'SS', 'ET', 'ER'],
  'SO': ['KE', 'ET', 'DJ'],
  'ER': ['ET', 'SD', 'DJ'],
  'DJ': ['ER', 'ET', 'SO'],
  'RW': ['UG', 'TZ', 'BI', 'CD'],
  'BI': ['RW', 'TZ', 'CD'],
  // Southern Africa
  'ZA': ['BW', 'NA', 'MZ', 'ZW', 'LS', 'SZ'],
  'AO': ['CD', 'CG', 'ZM', 'NA', 'BW'],
  'MZ': ['TZ', 'MW', 'ZM', 'ZW', 'ZA', 'SZ'],
  'ZM': ['CD', 'TZ', 'MW', 'MZ', 'ZW', 'BW', 'NA', 'AO'],
  'ZW': ['ZM', 'MZ', 'ZA', 'BW'],
  'BW': ['ZA', 'NA', 'ZM', 'ZW'],
  'NA': ['AO', 'ZM', 'BW', 'ZA'],
  'MW': ['TZ', 'MZ', 'ZM'],
  'MG': ['MZ'],
  'LS': ['ZA'],
  'SZ': ['ZA', 'MZ'],
  // Oceania
  'AU': ['ID', 'PG', 'NZ'],
  'NZ': ['AU'],
  'PG': ['ID', 'AU'],
}

// Seed some undiscovered deposits across countries
const INITIAL_DEPOSITS: RegionalDeposit[] = [
  { id: 'dep-1',  type: 'wheat',     countryCode: 'US', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-2',  type: 'oil',       countryCode: 'US', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-3',  type: 'fish',      countryCode: 'JP', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-4',  type: 'steak',     countryCode: 'BR', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-5',  type: 'materialx', countryCode: 'RU', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-6',  type: 'oil',       countryCode: 'RU', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-7',  type: 'wheat',     countryCode: 'IN', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-8',  type: 'fish',      countryCode: 'GB', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-9',  type: 'materialx', countryCode: 'CN', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-10', type: 'steak',     countryCode: 'DE', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-11', type: 'oil',       countryCode: 'NG', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-12', type: 'wheat',     countryCode: 'CA', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-13', type: 'fish',      countryCode: 'MX', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-14', type: 'materialx', countryCode: 'TR', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-15', type: 'steak',     countryCode: 'CU', bonus: 30, discoveredBy: null, active: false },
  { id: 'dep-16', type: 'oil',       countryCode: 'BS', bonus: 30, discoveredBy: null, active: false },
]

const makeCountry = (name: string, code: string, controller: string, empire: string | null, population: number, regions: number, military: number, fundTier: FundTier, color: string, conqueredResources: ConqueredResourceType[] = []): Country => ({
  name, code, controller, empire, population, regions, military, fund: getFundForTier(fundTier), forceVault: { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }, color, conqueredResources, activeDepositBonus: null, portLevel: 1, airportLevel: 1, bunkerLevel: 1, militaryBaseLevel: 1, hasPort: true, hasAirport: true, taxExempt: false,
})

/** Compute next midnight UTC from now */
function getNextDailyReset(): number {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.getTime()
}

/** Get current UTC date key for economy ledger */
function getUTCDayKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export interface FundSnapshot {
  timestamp: number
  funds: Record<string, number>  // countryCode -> fund.money
}

export interface WorldState {
  countries: Country[]
  wars: War[]
  deposits: RegionalDeposit[]
  turn: number
  nextTurnIn: number
  dailyResetAt: number

  // Catch-up mechanics: median level of all active players on the server
  serverMedianLevel: number
  lastAutoIncomeAt: number  // timestamp of last 8h income tick
  fundHistory: FundSnapshot[]  // treasury snapshots for charting
  lastFundSnapshotAt: number   // timestamp of last hourly snapshot
  
  // War Fund
  warFund: number  // Global pool fed by all active battles
  warFundDamageTracker: Record<string, number>  // countryCode -> total damage dealt today
  warFundBattleOutcomes: Record<string, { wins: number; losses: number }>  // countryCode -> wins/losses today

  // Economy Ledger — tracks money supply flows
  economyLedger: {
    dayKey: string                                // UTC date key for current day
    moneyCreated: Record<string, number>          // source -> total $ created today
    moneyDestroyed: Record<string, number>        // sink -> total $ destroyed today
    totalCreatedToday: number
    totalDestroyedToday: number
    netFlowToday: number                          // created - destroyed
    history: Array<{                              // daily snapshots (last 30 days)
      dayKey: string
      totalCreated: number
      totalDestroyed: number
      netFlow: number
      topSources: Array<{ source: string; amount: number }>
      topSinks: Array<{ source: string; amount: number }>
    }>
  }

  // Actions
  declareWar: (attackerIso: string, defenderIso: string) => void
  endWar: (iso1: string, iso2: string) => void
  printMoney: (countryCode: string, amount: number) => void
  canAttack: (attackerIso: string, defenderIso: string) => boolean
  addTreasuryTax: (countryCode: string, amount: number) => void
  addToFund: (countryCode: string, resource: NationalFundKey, amount: number) => void
  spendFromFund: (countryCode: string, costs: Partial<NationalFund>) => boolean
  transferToForceVault: (countryCode: string, resource: NationalFundKey, amount: number) => boolean
  spendFromForceVault: (countryCode: string, costs: Partial<Record<NationalFundKey, number>>) => boolean
  discoverDeposit: (depositId: string, playerName: string) => void
  getCountry: (code: string) => Country | undefined
  occupyCountry: (targetIso: string, conquerorIso: string, taxExempt: boolean) => void
  getTimeUntilDailyReset: () => number
  processDailyReset: () => void
  processAutoIncome: () => void
  snapshotFundHistory: () => void
  contributeToWarFund: (attackerId: string, defenderId: string) => void
  recordWarFundDamage: (countryCode: string, damage: number) => void
  recordWarFundBattleOutcome: (winnerCode: string, loserCode: string) => void
  distributeWarFund: () => void
  // Economy Ledger
  recordEconFlow: (source: string, amount: number, type: 'created' | 'destroyed') => void
  getEconomySnapshot: () => WorldState['economyLedger']

  // Catch-up: recalculate median from all player levels
  updateServerMedianLevel: (playerLevels: number[]) => void
}

export const useWorldStore = create<WorldState>((set, get) => ({
  turn: 247,
  nextTurnIn: 342,
  dailyResetAt: getNextDailyReset(),
  serverMedianLevel: 10,  // sensible default; recalculated from real player data
  lastAutoIncomeAt: Date.now(),
  fundHistory: [],
  lastFundSnapshotAt: 0,
  warFund: 0,
  warFundDamageTracker: {},
  warFundBattleOutcomes: {},
  economyLedger: {
    dayKey: getUTCDayKey(),
    moneyCreated: {},
    moneyDestroyed: {},
    totalCreatedToday: 0,
    totalDestroyedToday: 0,
    netFlowToday: 0,
    history: [],
  },

  deposits: INITIAL_DEPOSITS,

  countries: [
    // ── Core 14 (original game countries) ──
    makeCountry('United States', 'US', 'Player Alliance', 'NATO', 32000, 12, 95, 'large', '#4f8ef7', ['Iron', 'Titanium']),
    makeCountry('Russia', 'RU', 'Red Army', 'Eastern Bloc', 28000, 18, 88, 'large', '#c0392b', ['Saltpeter', 'Iron']),
    makeCountry('China', 'CN', 'Dragon Force', 'Eastern Bloc', 45000, 14, 82, 'large', '#e74c3c', ['Silicon', 'Rubber']),
    makeCountry('Germany', 'DE', 'Euro Corps', 'NATO', 18000, 4, 65, 'large', '#f39c12', ['Titanium']),
    makeCountry('Brazil', 'BR', 'Amazonia', null, 22000, 8, 55, 'medium', '#27ae60', ['Rubber']),
    makeCountry('India', 'IN', 'Bengal Tigers', null, 38000, 10, 70, 'medium', '#e67e22', ['Iron']),
    makeCountry('Nigeria', 'NG', 'West African Union', null, 15000, 5, 40, 'small', '#16a085', ['Uranium']),
    makeCountry('Japan', 'JP', 'Rising Sun', 'NATO', 20000, 3, 72, 'large', '#e84393', ['Silicon']),
    makeCountry('United Kingdom', 'GB', 'Crown Forces', 'NATO', 16000, 3, 68, 'large', '#8e44ad', ['Saltpeter']),
    makeCountry('Turkey', 'TR', 'Ottoman Revival', 'Eastern Bloc', 14000, 4, 58, 'medium', '#00b894', ['Rubber']),
    makeCountry('Canada', 'CA', 'Northern Guard', 'NATO', 12000, 8, 45, 'medium', '#74b9ff', ['Uranium']),
    makeCountry('Mexico', 'MX', 'Cartel Coalition', null, 18000, 6, 40, 'medium', '#fd9644', ['Iron']),
    makeCountry('Cuba', 'CU', 'Caribbean Command', 'Eastern Bloc', 6000, 2, 35, 'small', '#b71540', ['Saltpeter']),
    makeCountry('Bahamas', 'BS', 'Island Syndicate', null, 2000, 1, 15, 'small', '#0abde3', []),
    makeCountry('Oceania', 'OC', 'OC', null, 0, 3, 0, 'tiny', '#0077be', []),
    // ── Europe ──
    makeCountry('France', 'FR', 'French Republic', 'NATO', 16000, 4, 70, 'large', '#2980b9', ['Titanium']),
    makeCountry('Spain', 'ES', 'Iberian Guard', 'NATO', 12000, 4, 52, 'medium', '#d4ac0d', ['Iron']),
    makeCountry('Italy', 'IT', 'Italian Legion', 'NATO', 14000, 4, 58, 'medium', '#1abc9c', ['Saltpeter']),
    makeCountry('Poland', 'PL', 'Polish Hussars', 'NATO', 10000, 4, 55, 'medium', '#e74c3c', ['Iron']),
    makeCountry('Ukraine', 'UA', 'Free Ukraine', null, 11000, 5, 60, 'medium', '#3498db', ['Saltpeter']),
    makeCountry('Romania', 'RO', 'Dacian Guard', 'NATO', 6000, 3, 38, 'small', '#f1c40f', []),
    makeCountry('Netherlands', 'NL', 'Dutch Commerce', 'NATO', 5000, 2, 40, 'medium', '#e67e22', []),
    makeCountry('Belgium', 'BE', 'Belgian Shield', 'NATO', 3000, 1, 35, 'medium', '#7f8c8d', []),
    makeCountry('Sweden', 'SE', 'Nordic Vanguard', 'NATO', 4000, 3, 48, 'medium', '#2ecc71', []),
    makeCountry('Norway', 'NO', 'Norse Command', 'NATO', 3000, 3, 45, 'medium', '#1abc9c', []),
    makeCountry('Finland', 'FI', 'Finnish Sisu', null, 3000, 2, 50, 'medium', '#ecf0f1', []),
    makeCountry('Denmark', 'DK', 'Viking Corps', 'NATO', 2500, 1, 38, 'medium', '#e74c3c', []),
    makeCountry('Austria', 'AT', 'Alpine Guard', null, 3000, 2, 32, 'medium', '#e74c3c', []),
    makeCountry('Switzerland', 'CH', 'Swiss Neutrality', null, 3000, 1, 40, 'medium', '#e74c3c', []),
    makeCountry('Czech Republic', 'CZ', 'Bohemian Shield', 'NATO', 3500, 2, 35, 'medium', '#2980b9', []),
    makeCountry('Portugal', 'PT', 'Lusitanian Guard', 'NATO', 3000, 2, 30, 'medium', '#27ae60', []),
    makeCountry('Greece', 'GR', 'Hellenic Force', 'NATO', 3500, 3, 42, 'medium', '#3498db', []),
    makeCountry('Hungary', 'HU', 'Magyar Force', 'NATO', 3000, 2, 32, 'medium', '#27ae60', []),
    makeCountry('Ireland', 'IE', 'Celtic Guard', null, 2000, 1, 20, 'medium', '#27ae60', []),
    makeCountry('Iceland', 'IS', 'Arctic Watch', 'NATO', 500, 1, 10, 'medium', '#74b9ff', []),
    makeCountry('Serbia', 'RS', 'Serbian Legion', null, 3000, 2, 40, 'small', '#8e44ad', []),
    makeCountry('Belarus', 'BY', 'Slavic Front', 'Eastern Bloc', 4000, 2, 45, 'small', '#c0392b', []),
    makeCountry('Bulgaria', 'BG', 'Balkan Force', 'NATO', 2500, 2, 30, 'small', '#2ecc71', []),
    makeCountry('Slovakia', 'SK', 'Tatra Guard', 'NATO', 2000, 1, 28, 'small', '#3498db', []),
    makeCountry('Croatia', 'HR', 'Adriatic Command', 'NATO', 1500, 1, 28, 'small', '#e74c3c', []),
    makeCountry('Lithuania', 'LT', 'Baltic Shield', 'NATO', 1200, 1, 25, 'small', '#f39c12', []),
    makeCountry('Latvia', 'LV', 'Baltic Guard', 'NATO', 1000, 1, 22, 'small', '#8e44ad', []),
    makeCountry('Estonia', 'EE', 'Digital Legion', 'NATO', 800, 1, 28, 'small', '#3498db', []),
    makeCountry('Slovenia', 'SI', 'Alpine Force', 'NATO', 1000, 1, 22, 'small', '#27ae60', []),
    makeCountry('Bosnia and Herzegovina', 'BA', 'Bosnian Council', null, 1500, 1, 20, 'small', '#f1c40f', []),
    makeCountry('Albania', 'AL', 'Albanian Eagles', 'NATO', 1200, 1, 18, 'small', '#e74c3c', []),
    makeCountry('North Macedonia', 'MK', 'Macedon Guard', 'NATO', 1000, 1, 15, 'small', '#f39c12', []),
    makeCountry('Montenegro', 'ME', 'Adriatic Watch', 'NATO', 500, 1, 12, 'small', '#2980b9', []),
    makeCountry('Moldova', 'MD', 'Moldovan Guard', null, 1500, 1, 12, 'small', '#3498db', []),
    // ── Americas ──
    makeCountry('Argentina', 'AR', 'Pampas Force', null, 12000, 6, 50, 'medium', '#74b9ff', ['Iron']),
    makeCountry('Colombia', 'CO', 'Andean Command', null, 10000, 4, 45, 'medium', '#f1c40f', []),
    makeCountry('Venezuela', 'VE', 'Bolivarian Guard', 'Eastern Bloc', 8000, 3, 38, 'medium', '#c0392b', ['Rubber']),
    makeCountry('Peru', 'PE', 'Inca Force', null, 8000, 4, 35, 'medium', '#e74c3c', []),
    makeCountry('Chile', 'CL', 'Andes Shield', null, 5000, 3, 42, 'medium', '#2980b9', ['Saltpeter']),
    makeCountry('Ecuador', 'EC', 'Equatorial Guard', null, 4000, 2, 25, 'small', '#f1c40f', []),
    makeCountry('Bolivia', 'BO', 'Altiplano Force', null, 3000, 2, 22, 'small', '#27ae60', []),
    makeCountry('Paraguay', 'PY', 'Guarani Guard', null, 2000, 1, 18, 'small', '#e74c3c', []),
    makeCountry('Uruguay', 'UY', 'Eastern Shield', null, 1500, 1, 20, 'small', '#3498db', []),
    makeCountry('Guyana', 'GY', 'Guyanese Watch', null, 500, 1, 8, 'small', '#27ae60', []),
    makeCountry('Suriname', 'SR', 'Surinam Guard', null, 400, 1, 6, 'small', '#2ecc71', []),
    makeCountry('Guatemala', 'GT', 'Maya Force', null, 3000, 2, 20, 'small', '#3498db', []),
    makeCountry('Honduras', 'HN', 'Central Guard', null, 2000, 1, 15, 'tiny', '#2980b9', []),
    makeCountry('El Salvador', 'SV', 'Pacific Shield', null, 1500, 1, 14, 'small', '#2980b9', []),
    makeCountry('Nicaragua', 'NI', 'Sandinista Force', null, 1500, 1, 15, 'small', '#e74c3c', []),
    makeCountry('Costa Rica', 'CR', 'Pura Vida', null, 1500, 1, 10, 'small', '#27ae60', []),
    makeCountry('Panama', 'PA', 'Canal Guard', null, 1200, 1, 12, 'small', '#2980b9', []),
    makeCountry('Dominican Republic', 'DO', 'Dominican Guard', null, 2500, 1, 18, 'small', '#e74c3c', []),
    makeCountry('Haiti', 'HT', 'Haitian Guard', null, 2000, 1, 10, 'small', '#2980b9', []),
    makeCountry('Jamaica', 'JM', 'Island Force', null, 1000, 1, 10, 'small', '#27ae60', []),
    // ── Asia ──
    makeCountry('South Korea', 'KR', 'K-Force', 'NATO', 14000, 3, 75, 'large', '#3498db', ['Silicon']),
    makeCountry('North Korea', 'KP', 'Juche Guard', 'Eastern Bloc', 6000, 2, 65, 'small', '#e74c3c', ['Uranium']),
    makeCountry('Taiwan', 'TW', 'Pacific Shield', 'NATO', 6000, 1, 60, 'medium', '#2980b9', ['Silicon']),
    makeCountry('Thailand', 'TH', 'Siam Guard', null, 16000, 4, 48, 'medium', '#f39c12', []),
    makeCountry('Vietnam', 'VN', 'Hanoi Command', null, 20000, 5, 55, 'medium', '#e74c3c', []),
    makeCountry('Philippines', 'PH', 'Island Tigers', null, 22000, 4, 35, 'medium', '#2980b9', []),
    makeCountry('Malaysia', 'MY', 'Malay Shield', null, 8000, 3, 38, 'medium', '#f1c40f', []),
    makeCountry('Indonesia', 'ID', 'Nusantara Force', null, 40000, 8, 48, 'medium', '#e74c3c', ['Rubber']),
    makeCountry('Myanmar', 'MM', 'Tatmadaw', null, 12000, 4, 40, 'small', '#27ae60', []),
    makeCountry('Bangladesh', 'BD', 'Bengal Guard', null, 30000, 2, 30, 'medium', '#27ae60', []),
    makeCountry('Pakistan', 'PK', 'Green Crescent', null, 35000, 6, 68, 'medium', '#27ae60', ['Uranium']),
    makeCountry('Afghanistan', 'AF', 'Mountain Guard', null, 8000, 4, 35, 'small', '#8e44ad', []),
    makeCountry('Iraq', 'IQ', 'Mesopotamia Force', null, 10000, 4, 45, 'medium', '#f39c12', ['Iron']),
    makeCountry('Iran', 'IR', 'Persian Guard', 'Eastern Bloc', 18000, 6, 65, 'medium', '#27ae60', ['Iron']),
    makeCountry('Saudi Arabia', 'SA', 'Desert Shield', null, 10000, 5, 60, 'large', '#27ae60', ['Iron']),
    makeCountry('United Arab Emirates', 'AE', 'Gulf Force', null, 4000, 2, 45, 'medium', '#3498db', []),
    makeCountry('Israel', 'IL', 'Iron Dome', 'NATO', 5000, 1, 80, 'medium', '#2980b9', ['Silicon']),
    makeCountry('Syria', 'SY', 'Levant Guard', 'Eastern Bloc', 5000, 2, 35, 'small', '#8e44ad', []),
    makeCountry('Jordan', 'JO', 'Hashemite Guard', null, 3000, 1, 32, 'small', '#e74c3c', []),
    makeCountry('Lebanon', 'LB', 'Cedar Guard', null, 2000, 1, 22, 'small', '#27ae60', []),
    makeCountry('Yemen', 'YE', 'Southern Front', null, 6000, 2, 25, 'small', '#e74c3c', []),
    makeCountry('Oman', 'OM', 'Sultan Guard', null, 2000, 1, 28, 'small', '#f39c12', []),
    makeCountry('Kuwait', 'KW', 'Gulf Watch', null, 1500, 1, 30, 'small', '#2980b9', []),
    makeCountry('Qatar', 'QA', 'Pearl Guard', null, 1000, 1, 25, 'small', '#8e44ad', []),
    makeCountry('Georgia', 'GE', 'Caucasus Guard', null, 2000, 1, 28, 'small', '#e74c3c', []),
    makeCountry('Armenia', 'AM', 'Armenian Front', null, 1500, 1, 30, 'small', '#f39c12', []),
    makeCountry('Azerbaijan', 'AZ', 'Caspian Guard', null, 3000, 2, 35, 'small', '#2980b9', []),
    makeCountry('Kazakhstan', 'KZ', 'Steppe Command', null, 5000, 5, 40, 'medium', '#f1c40f', ['Uranium']),
    makeCountry('Uzbekistan', 'UZ', 'Silk Road Guard', null, 6000, 3, 32, 'small', '#3498db', []),
    makeCountry('Turkmenistan', 'TM', 'Desert Guard', null, 2000, 2, 25, 'small', '#27ae60', []),
    makeCountry('Kyrgyzstan', 'KG', 'Mountain Watch', null, 1500, 1, 18, 'small', '#e74c3c', []),
    makeCountry('Tajikistan', 'TJ', 'Pamir Guard', null, 2000, 1, 18, 'small', '#f39c12', []),
    makeCountry('Mongolia', 'MN', 'Khagan Guard', null, 1200, 3, 22, 'small', '#2980b9', []),
    makeCountry('Nepal', 'NP', 'Gurkha Force', null, 5000, 2, 28, 'small', '#e74c3c', []),
    makeCountry('Sri Lanka', 'LK', 'Lion Guard', null, 4000, 1, 28, 'small', '#f39c12', []),
    makeCountry('Cambodia', 'KH', 'Angkor Guard', null, 4000, 2, 20, 'small', '#2980b9', []),
    makeCountry('Laos', 'LA', 'Mekong Watch', null, 2000, 2, 15, 'small', '#e74c3c', []),
    // ── Africa ──
    makeCountry('South Africa', 'ZA', 'Rainbow Command', null, 14000, 4, 52, 'medium', '#27ae60', ['Iron']),
    makeCountry('Egypt', 'EG', 'Pharaoh Guard', null, 20000, 5, 62, 'medium', '#f1c40f', ['Iron']),
    makeCountry('Kenya', 'KE', 'Savanna Force', null, 10000, 3, 35, 'small', '#e74c3c', []),
    makeCountry('Ethiopia', 'ET', 'Abyssinian Guard', null, 20000, 4, 42, 'small', '#27ae60', []),
    makeCountry('Tanzania', 'TZ', 'Serengeti Force', null, 12000, 3, 30, 'small', '#f1c40f', []),
    makeCountry('Ghana', 'GH', 'Gold Coast Guard', null, 7000, 2, 28, 'small', '#27ae60', []),
    makeCountry('Ivory Coast', 'CI', 'Cote Command', null, 6000, 2, 25, 'small', '#f39c12', []),
    makeCountry('Cameroon', 'CM', 'Lion Force', null, 6000, 3, 28, 'small', '#27ae60', []),
    makeCountry('Angola', 'AO', 'Southern Guard', null, 7000, 3, 35, 'small', '#e74c3c', ['Iron']),
    makeCountry('Mozambique', 'MZ', 'Coastal Guard', null, 6000, 3, 22, 'small', '#27ae60', []),
    makeCountry('Madagascar', 'MG', 'Island Guard', null, 5000, 2, 15, 'small', '#2ecc71', []),
    makeCountry('Morocco', 'MA', 'Atlas Guard', null, 8000, 3, 42, 'medium', '#e74c3c', []),
    makeCountry('Algeria', 'DZ', 'Saharan Shield', null, 10000, 5, 50, 'medium', '#27ae60', ['Iron']),
    makeCountry('Tunisia', 'TN', 'Carthage Guard', null, 3000, 1, 25, 'small', '#e74c3c', []),
    makeCountry('Libya', 'LY', 'Desert Force', null, 4000, 3, 30, 'medium', '#f39c12', ['Iron']),
    makeCountry('Sudan', 'SD', 'Nile Guard', null, 8000, 4, 35, 'small', '#2980b9', []),
    makeCountry('South Sudan', 'SS', 'Freedom Guard', null, 3000, 2, 20, 'small', '#27ae60', []),
    makeCountry('Uganda', 'UG', 'Pearl Guard', null, 8000, 2, 28, 'small', '#f1c40f', []),
    makeCountry('Senegal', 'SN', 'Teranga Force', null, 4000, 2, 22, 'small', '#27ae60', []),
    makeCountry('Mali', 'ML', 'Sahel Guard', null, 4000, 3, 22, 'small', '#f39c12', []),
    makeCountry('Burkina Faso', 'BF', 'Sahel Watch', null, 4000, 2, 18, 'small', '#e74c3c', []),
    makeCountry('Niger', 'NE', 'Desert Watch', null, 5000, 3, 18, 'small', '#f39c12', []),
    makeCountry('Chad', 'TD', 'Saharan Guard', null, 3000, 3, 22, 'small', '#2980b9', []),
    makeCountry('DR Congo', 'CD', 'Congo Force', null, 18000, 6, 30, 'small', '#27ae60', ['Uranium']),
    makeCountry('Congo', 'CG', 'Congo Guard', null, 2000, 1, 15, 'small', '#e74c3c', []),
    makeCountry('Central African Republic', 'CF', 'Central Watch', null, 1500, 2, 12, 'small', '#f1c40f', []),
    makeCountry('Gabon', 'GA', 'Equatorial Guard', null, 1000, 1, 15, 'small', '#27ae60', []),
    makeCountry('Equatorial Guinea', 'GQ', 'Gulf Guard', null, 500, 1, 10, 'small', '#2980b9', []),
    makeCountry('Malawi', 'MW', 'Warm Heart Guard', null, 4000, 1, 15, 'small', '#e74c3c', []),
    makeCountry('Zambia', 'ZM', 'Copper Guard', null, 4000, 2, 22, 'small', '#f39c12', []),
    makeCountry('Zimbabwe', 'ZW', 'Stone City Guard', null, 3500, 2, 25, 'small', '#27ae60', []),
    makeCountry('Botswana', 'BW', 'Diamond Guard', null, 1000, 2, 22, 'small', '#2980b9', []),
    makeCountry('Namibia', 'NA', 'Desert Lions', null, 1200, 2, 18, 'small', '#f1c40f', []),
    makeCountry('Somalia', 'SO', 'Horn Guard', null, 3000, 2, 20, 'small', '#3498db', []),
    makeCountry('Eritrea', 'ER', 'Red Sea Guard', null, 1500, 1, 22, 'small', '#2980b9', []),
    makeCountry('Mauritania', 'MR', 'Saharan Watch', null, 1500, 2, 12, 'small', '#f39c12', []),
    // ── Oceania ──
    makeCountry('Australia', 'AU', 'ANZAC Force', 'NATO', 8000, 6, 55, 'medium', '#27ae60', ['Iron', 'Uranium']),
    makeCountry('New Zealand', 'NZ', 'Kiwi Guard', 'NATO', 2000, 2, 35, 'medium', '#2ecc71', []),
    makeCountry('Papua New Guinea', 'PG', 'Pacific Watch', null, 2000, 2, 12, 'small', '#f39c12', []),
  ],

  wars: [
    { id: 'w1', attacker: 'US', defender: 'RU', startedAt: Date.now() - 86400000 * 3, status: 'active' },
    { id: 'w2', attacker: 'CN', defender: 'JP', startedAt: Date.now() - 86400000 * 1, status: 'active' },
    { id: 'w3', attacker: 'US', defender: 'CU', startedAt: Date.now() - 86400000 * 2, status: 'active' },
    { id: 'w4', attacker: 'US', defender: 'CA', startedAt: Date.now() - 86400000 * 1, status: 'active' },
    { id: 'w5', attacker: 'RU', defender: 'DE', startedAt: Date.now() - 86400000 * 1, status: 'active' },
  ],

  getCountry: (code) => get().countries.find(c => c.code === code),

  occupyCountry: (targetIso, conquerorIso, taxExempt) => set((state) => ({
    countries: state.countries.map(c => {
      if (c.code === targetIso) {
        return { ...c, empire: conquerorIso, taxExempt }
      }
      return c
    })
  })),

  addTreasuryTax: (countryCode, amount) => set((s) => ({
    countries: s.countries.map(c =>
      c.code === countryCode ? { ...c, fund: { ...c.fund, money: c.fund.money + amount } } : c
    )
  })),

  addToFund: (countryCode, resource, amount) => set((s) => ({
    countries: s.countries.map(c =>
      c.code === countryCode ? { ...c, fund: { ...c.fund, [resource]: c.fund[resource] + amount } } : c
    )
  })),

  spendFromFund: (countryCode, costs) => {
    const country = get().countries.find(c => c.code === countryCode)
    if (!country) return false
    // Check all resources
    for (const [key, amount] of Object.entries(costs)) {
      if (amount && country.fund[key as NationalFundKey] < amount) return false
    }
    set((s) => ({
      countries: s.countries.map(c => {
        if (c.code !== countryCode) return c
        const newFund = { ...c.fund }
        for (const [key, amount] of Object.entries(costs)) {
          if (amount) newFund[key as NationalFundKey] -= amount
        }
        return { ...c, fund: newFund }
      })
    }))
    return true
  },

  transferToForceVault: (countryCode: string, resource: NationalFundKey, amount: number) => {
    const country = get().countries.find(c => c.code === countryCode)
    if (!country || amount <= 0) return false
    if (country.fund[resource] < amount) return false
    set((s) => ({
      countries: s.countries.map(c => {
        if (c.code !== countryCode) return c
        return {
          ...c,
          fund: { ...c.fund, [resource]: c.fund[resource] - amount },
          forceVault: { ...c.forceVault, [resource]: c.forceVault[resource] + amount },
        }
      })
    }))
    // Persist to backend (fire-and-forget)
    import('../api/client').then(({ transferToForceVault: apiTransfer }) => {
      const fundKey = resource === 'scrap' ? 'scraps' : resource
      apiTransfer(countryCode, fundKey, amount).catch(() => {})
    })
    return true
  },

  spendFromForceVault: (countryCode: string, costs: Partial<Record<NationalFundKey, number>>) => {
    const country = get().countries.find(c => c.code === countryCode)
    if (!country) return false
    for (const [key, amount] of Object.entries(costs)) {
      if (amount && country.forceVault[key as NationalFundKey] < amount) return false
    }
    set((s) => ({
      countries: s.countries.map(c => {
        if (c.code !== countryCode) return c
        const newVault = { ...c.forceVault }
        for (const [key, amount] of Object.entries(costs)) {
          if (amount) newVault[key as NationalFundKey] -= amount
        }
        return { ...c, forceVault: newVault }
      })
    }))
    // Persist each resource spend to backend (fire-and-forget)
    import('../api/client').then(({ spendFromForceVault: apiSpend }) => {
      for (const [key, amount] of Object.entries(costs)) {
        if (amount && amount > 0) {
          const fundKey = key === 'scrap' ? 'scraps' : key
          apiSpend(countryCode, fundKey, amount).catch(() => {})
        }
      }
    })
    return true
  },

  discoverDeposit: (depositId, playerName) => set((s) => ({
    deposits: s.deposits.map(d =>
      d.id === depositId ? { ...d, discoveredBy: playerName, active: true } : d
    ),
    // Set country active deposit bonus (non-cumulative, replaces any existing)
    countries: s.countries.map(c => {
      const dep = s.deposits.find(d => d.id === depositId)
      if (!dep || c.code !== dep.countryCode) return c
      return { ...c, activeDepositBonus: { type: dep.type, bonus: 10 } }
    })
  })),

  canAttack: (attackerIso, defenderIso) => {
    if (defenderIso === 'OC' || attackerIso === 'OC') return true // Ocean blocks are always attackable

    const adjacent = ADJACENCY_MAP[attackerIso] || []
    if (!adjacent.includes(defenderIso)) return false
    
    const state = get()
    const activeWar = state.wars.find(w => 
      w.status === 'active' && 
      ((w.attacker === attackerIso && w.defender === defenderIso) || 
       (w.attacker === defenderIso && w.defender === attackerIso))
    )
    return !!activeWar
  },

  declareWar: (attackerIso, defenderIso) => set((state) => {
    if (defenderIso === 'OC' || attackerIso === 'OC') return state // No formal war needed for oceans

    const existing = state.wars.find(w => 
      w.status === 'active' && 
      ((w.attacker === attackerIso && w.defender === defenderIso) || 
       (w.attacker === defenderIso && w.defender === attackerIso))
    )
    if (existing) return state

    const newWar: War = {
      id: `war_${Date.now()}_${attackerIso}_${defenderIso}`,
      attacker: attackerIso,
      defender: defenderIso,
      startedAt: Date.now(),
      status: 'active'
    }

    return { wars: [...state.wars, newWar] }
  }),

  endWar: (iso1, iso2) => set((state) => ({
    wars: state.wars.map(w => {
      if (w.status !== 'active') return w
      const match = (w.attacker === iso1 && w.defender === iso2) ||
                    (w.attacker === iso2 && w.defender === iso1)
      return match ? { ...w, status: 'ended' as const } : w
    })
  })),

  printMoney: (countryCode, amount) => {
    if (amount <= 0) return
    set((s) => ({
      countries: s.countries.map(c =>
        c.code === countryCode ? { ...c, fund: { ...c.fund, money: c.fund.money + amount } } : c
      )
    }))
    // Track in economy ledger
    get().recordEconFlow('print_money', amount, 'created')
  },

  getTimeUntilDailyReset: () => {
    const ms = get().dailyResetAt - Date.now()
    return Math.max(0, Math.floor(ms / 1000))
  },

  processDailyReset: () => {
    const state = get()
    if (Date.now() < state.dailyResetAt) return

    // Distribute war fund before resetting
    get().distributeWarFund()

    // Snapshot economy ledger before resetting
    const ledger = state.economyLedger
    const topSources = Object.entries(ledger.moneyCreated)
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
    const topSinks = Object.entries(ledger.moneyDestroyed)
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    const dailySnapshot = {
      dayKey: ledger.dayKey,
      totalCreated: ledger.totalCreatedToday,
      totalDestroyed: ledger.totalDestroyedToday,
      netFlow: ledger.netFlowToday,
      topSources,
      topSinks,
    }

    set({
      dailyResetAt: getNextDailyReset(),
      turn: state.turn + 1,
      warFundDamageTracker: {},
      warFundBattleOutcomes: {},
      // Reset economy ledger for new day, archive previous day
      economyLedger: {
        dayKey: getUTCDayKey(),
        moneyCreated: {},
        moneyDestroyed: {},
        totalCreatedToday: 0,
        totalDestroyedToday: 0,
        netFlowToday: 0,
        history: [dailySnapshot, ...ledger.history].slice(0, 30),
      },
    })
  },

  // ── War Fund: drain 2% from both treasuries into global pool ──
  contributeToWarFund: (attackerId, defenderId) => set(state => {
    const rate = 0.02
    let totalContribution = 0
    const updatedCountries = state.countries.map(c => {
      if (c.code === attackerId || c.code === defenderId) {
        const drain = Math.floor(c.fund.money * rate)
        if (drain > 0) {
          totalContribution += drain
          return { ...c, fund: { ...c.fund, money: c.fund.money - drain } }
        }
      }
      return c
    })
    return {
      countries: updatedCountries,
      warFund: state.warFund + totalContribution,
    }
  }),

  // ── Track damage per country for daily distribution ──
  recordWarFundDamage: (countryCode, damage) => set(state => ({
    warFundDamageTracker: {
      ...state.warFundDamageTracker,
      [countryCode]: (state.warFundDamageTracker[countryCode] || 0) + damage,
    },
  })),

  // ── Record battle outcome for win/loss multiplier ──
  recordWarFundBattleOutcome: (winnerCode, loserCode) => set(state => {
    const outcomes = { ...state.warFundBattleOutcomes }
    if (!outcomes[winnerCode]) outcomes[winnerCode] = { wins: 0, losses: 0 }
    if (!outcomes[loserCode]) outcomes[loserCode] = { wins: 0, losses: 0 }
    outcomes[winnerCode] = { ...outcomes[winnerCode], wins: outcomes[winnerCode].wins + 1 }
    outcomes[loserCode] = { ...outcomes[loserCode], losses: outcomes[loserCode].losses + 1 }
    return { warFundBattleOutcomes: outcomes }
  }),

  // ── 24h distribution: damage-proportional, losers get 0.3x multiplier ──
  distributeWarFund: () => {
    const state = get()
    const pool = state.warFund
    if (pool <= 0) return

    const dmgTracker = state.warFundDamageTracker
    const outcomes = state.warFundBattleOutcomes

    // Calculate weighted damage: winners get 1.0x, losers get 0.3x
    const weightedDmg: Record<string, number> = {}
    let totalWeighted = 0

    for (const [code, rawDmg] of Object.entries(dmgTracker)) {
      const record = outcomes[code] || { wins: 0, losses: 0 }
      // If more losses than wins, apply 0.3x penalty
      const multiplier = record.losses > record.wins ? 0.3 : 1.0
      const weighted = rawDmg * multiplier
      weightedDmg[code] = weighted
      totalWeighted += weighted
    }

    if (totalWeighted <= 0) return

    // Distribute to country treasuries proportionally
    const updatedCountries = state.countries.map(c => {
      const share = weightedDmg[c.code]
      if (!share || share <= 0) return c
      const payout = Math.floor(pool * (share / totalWeighted))
      if (payout <= 0) return c
      return { ...c, fund: { ...c.fund, money: c.fund.money + payout } }
    })

    set({ countries: updatedCountries, warFund: 0 })
    console.log(`[WarFund] Distributed $${pool.toLocaleString()} across ${Object.keys(weightedDmg).length} countries`)
  },

  processAutoIncome: () => set((state) => {
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000
    const now = Date.now()
    if (now - state.lastAutoIncomeAt < EIGHT_HOURS_MS) return state

    // Generate income for every country based on population + infrastructure
    const updatedCountries = state.countries.map(country => {
      const infraMultiplier = 1 +
        (country.portLevel * 0.05) +
        (country.airportLevel * 0.05) +
        (country.militaryBaseLevel * 0.03) +
        (country.bunkerLevel * 0.02)

      const depositBonus = country.conqueredResources.length * 0.03

      const baseMoney = country.population * 0.1
      const baseResource = country.population * 0.005

      const totalMultiplier = infraMultiplier + depositBonus

      const fund = { ...country.fund }
      fund.money += Math.floor(baseMoney * totalMultiplier)
      fund.oil += Math.floor(baseResource * totalMultiplier * 0.3)
      fund.scrap += Math.floor(baseResource * totalMultiplier * 0.3)
      fund.materialX += Math.floor(baseResource * totalMultiplier * 0.2)

      return { ...country, fund }
    })

    return {
      countries: updatedCountries,
      lastAutoIncomeAt: now,
    }
  }),

  snapshotFundHistory: () => set((state) => {
    const ONE_HOUR_MS = 60 * 60 * 1000
    const now = Date.now()
    if (now - state.lastFundSnapshotAt < ONE_HOUR_MS) return state

    const funds: Record<string, number> = {}
    state.countries.forEach(c => { funds[c.code] = c.fund.money })

    const snapshot = { timestamp: now, funds }
    const MAX_SNAPSHOTS = 4320 // 180 days × 24 hours

    return {
      fundHistory: [...state.fundHistory.slice(-(MAX_SNAPSHOTS - 1)), snapshot],
      lastFundSnapshotAt: now,
    }
  }),

  // ── Economy Ledger ──
  recordEconFlow: (source, amount, type) => {
    if (amount <= 0) return
    set(state => {
      const ledger = { ...state.economyLedger }
      if (type === 'created') {
        ledger.moneyCreated = { ...ledger.moneyCreated, [source]: (ledger.moneyCreated[source] || 0) + amount }
        ledger.totalCreatedToday += amount
      } else {
        ledger.moneyDestroyed = { ...ledger.moneyDestroyed, [source]: (ledger.moneyDestroyed[source] || 0) + amount }
        ledger.totalDestroyedToday += amount
      }
      ledger.netFlowToday = ledger.totalCreatedToday - ledger.totalDestroyedToday
      return { economyLedger: ledger }
    })
  },

  getEconomySnapshot: () => get().economyLedger,

  updateServerMedianLevel: (playerLevels: number[]) => {
    if (playerLevels.length === 0) return
    const sorted = [...playerLevels].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0
      ? Math.floor((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]
    set({ serverMedianLevel: Math.max(1, median) })
  },
}))
