/**
 * Country → Terrain mapping for battle stage backgrounds.
 * Each country is assigned a terrain type that determines the BattleAvatar background.
 */

export type TerrainType = 'urban' | 'jungle' | 'desert'

/** Map country ISO code → terrain type. Defender's country determines the stage. */
export const COUNTRY_TERRAIN: Record<string, TerrainType> = {
  // ── Urban (developed/industrial nations) ──
  'US': 'urban', 'CA': 'urban', 'GB': 'urban', 'DE': 'urban', 'FR': 'urban',
  'JP': 'urban', 'KR': 'urban', 'IT': 'urban', 'ES': 'urban', 'NL': 'urban',
  'BE': 'urban', 'SE': 'urban', 'NO': 'urban', 'FI': 'urban', 'DK': 'urban',
  'AT': 'urban', 'CH': 'urban', 'CZ': 'urban', 'PT': 'urban', 'GR': 'urban',
  'PL': 'urban', 'IE': 'urban', 'IS': 'urban', 'TW': 'urban', 'SG': 'urban',
  'IL': 'urban', 'AE': 'urban', 'QA': 'urban', 'KW': 'urban',
  'AU': 'urban', 'NZ': 'urban', 'RU': 'urban', 'UA': 'urban',
  'CN': 'urban', 'IN': 'urban', 'TR': 'urban', 'MX': 'urban',
  'AR': 'urban', 'CL': 'urban', 'HU': 'urban', 'RO': 'urban',
  'RS': 'urban', 'HR': 'urban', 'SK': 'urban', 'SI': 'urban',
  'BG': 'urban', 'BY': 'urban', 'EE': 'urban', 'LV': 'urban', 'LT': 'urban',

  // ── Jungle (tropical/equatorial nations) ──
  'BR': 'jungle', 'CO': 'jungle', 'VE': 'jungle', 'PE': 'jungle',
  'EC': 'jungle', 'BO': 'jungle', 'PY': 'jungle', 'UY': 'jungle',
  'GY': 'jungle', 'SR': 'jungle', 'CU': 'jungle', 'BS': 'jungle',
  'GT': 'jungle', 'HN': 'jungle', 'SV': 'jungle', 'NI': 'jungle',
  'CR': 'jungle', 'PA': 'jungle', 'DO': 'jungle', 'HT': 'jungle', 'JM': 'jungle',
  'TH': 'jungle', 'VN': 'jungle', 'PH': 'jungle', 'MY': 'jungle',
  'ID': 'jungle', 'MM': 'jungle', 'KH': 'jungle', 'LA': 'jungle',
  'BD': 'jungle', 'LK': 'jungle', 'NP': 'jungle', 'BN': 'jungle',
  'NG': 'jungle', 'GH': 'jungle', 'CI': 'jungle', 'CM': 'jungle',
  'CD': 'jungle', 'CG': 'jungle', 'GA': 'jungle', 'GQ': 'jungle',
  'KE': 'jungle', 'TZ': 'jungle', 'UG': 'jungle', 'ET': 'jungle',
  'MZ': 'jungle', 'MG': 'jungle', 'RW': 'jungle', 'BI': 'jungle',
  'PG': 'jungle', 'SN': 'jungle', 'ML': 'jungle', 'BF': 'jungle',
  'SL': 'jungle', 'LR': 'jungle', 'TG': 'jungle', 'BJ': 'jungle',
  'AO': 'jungle', 'ZM': 'jungle', 'ZW': 'jungle', 'MW': 'jungle',
  'CF': 'jungle', 'SS': 'jungle', 'SO': 'jungle',

  // ── Desert (arid/Middle East/Saharan nations) ──
  'SA': 'desert', 'IQ': 'desert', 'IR': 'desert', 'SY': 'desert',
  'JO': 'desert', 'LB': 'desert', 'YE': 'desert', 'OM': 'desert',
  'EG': 'desert', 'LY': 'desert', 'TN': 'desert', 'DZ': 'desert',
  'MA': 'desert', 'SD': 'desert', 'TD': 'desert', 'NE': 'desert',
  'MR': 'desert', 'AF': 'desert', 'PK': 'desert',
  'KZ': 'desert', 'UZ': 'desert', 'TM': 'desert', 'KG': 'desert', 'TJ': 'desert',
  'MN': 'desert', 'KP': 'desert', 'GE': 'desert', 'AM': 'desert', 'AZ': 'desert',
  'ZA': 'desert', 'BW': 'desert', 'NA': 'desert', 'ER': 'desert', 'DJ': 'desert',
  'BA': 'desert', 'AL': 'desert', 'MK': 'desert', 'ME': 'desert', 'MD': 'desert',
  'TT': 'desert', 'BZ': 'desert',
}

/** Get terrain for a country, defaults to 'urban' */
export function getCountryTerrain(countryCode: string): TerrainType {
  return COUNTRY_TERRAIN[countryCode] || 'urban'
}

/** Get the background image path for a terrain type */
export function getTerrainBackground(terrain: TerrainType): string {
  return `/assets/stages/${terrain}.png`
}
