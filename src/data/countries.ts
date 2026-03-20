/**
 * XWAR — Master Country Data
 * Single source of truth for country names, ISO codes, and flag emojis.
 * All stores and components should import from here.
 */

/** ISO code → full country name */
export const COUNTRY_NAMES: Record<string, string> = {
  // Core
  US: 'United States', RU: 'Russia', CN: 'China', DE: 'Germany',
  BR: 'Brazil', IN: 'India', NG: 'Nigeria', JP: 'Japan',
  GB: 'United Kingdom', TR: 'Turkey', CA: 'Canada', MX: 'Mexico',
  CU: 'Cuba', BS: 'Bahamas',
  // Europe
  FR: 'France', ES: 'Spain', IT: 'Italy', PL: 'Poland', UA: 'Ukraine', RO: 'Romania',
  NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden', NO: 'Norway', FI: 'Finland', DK: 'Denmark',
  AT: 'Austria', CH: 'Switzerland', CZ: 'Czech Republic', PT: 'Portugal', GR: 'Greece', HU: 'Hungary',
  IE: 'Ireland', IS: 'Iceland', RS: 'Serbia', BY: 'Belarus', BG: 'Bulgaria', SK: 'Slovakia',
  HR: 'Croatia', LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia', SI: 'Slovenia', BA: 'Bosnia and Herzegovina',
  AL: 'Albania', MK: 'North Macedonia', ME: 'Montenegro', MD: 'Moldova', XK: 'Kosovo',
  // Americas
  AR: 'Argentina', CO: 'Colombia', VE: 'Venezuela', PE: 'Peru', CL: 'Chile', EC: 'Ecuador',
  BO: 'Bolivia', PY: 'Paraguay', UY: 'Uruguay', GY: 'Guyana', SR: 'Suriname',
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panama',
  DO: 'Dominican Republic', HT: 'Haiti', JM: 'Jamaica', TT: 'Trinidad and Tobago',
  // Asia
  KR: 'South Korea', KP: 'North Korea', TW: 'Taiwan', TH: 'Thailand', VN: 'Vietnam', PH: 'Philippines',
  MY: 'Malaysia', ID: 'Indonesia', MM: 'Myanmar', BD: 'Bangladesh', PK: 'Pakistan', AF: 'Afghanistan',
  IQ: 'Iraq', IR: 'Iran', SA: 'Saudi Arabia', AE: 'United Arab Emirates', IL: 'Israel', SY: 'Syria',
  JO: 'Jordan', LB: 'Lebanon', YE: 'Yemen', OM: 'Oman', KW: 'Kuwait', QA: 'Qatar',
  GE: 'Georgia', AM: 'Armenia', AZ: 'Azerbaijan', KZ: 'Kazakhstan', UZ: 'Uzbekistan', TM: 'Turkmenistan',
  KG: 'Kyrgyzstan', TJ: 'Tajikistan', MN: 'Mongolia', NP: 'Nepal', LK: 'Sri Lanka', LA: 'Laos',
  KH: 'Cambodia', BN: 'Brunei', SG: 'Singapore',
  // Africa
  ZA: 'South Africa', EG: 'Egypt', KE: 'Kenya', ET: 'Ethiopia', TZ: 'Tanzania', GH: 'Ghana',
  CI: 'Ivory Coast', CM: 'Cameroon', AO: 'Angola', MZ: 'Mozambique', MG: 'Madagascar', MA: 'Morocco',
  DZ: 'Algeria', TN: 'Tunisia', LY: 'Libya', SD: 'Sudan', SS: 'South Sudan', UG: 'Uganda',
  SN: 'Senegal', ML: 'Mali', BF: 'Burkina Faso', NE: 'Niger', TD: 'Chad', CD: 'DR Congo',
  CG: 'Congo', CF: 'Central African Republic', GA: 'Gabon', GQ: 'Equatorial Guinea', MW: 'Malawi', ZM: 'Zambia',
  ZW: 'Zimbabwe', BW: 'Botswana', NA: 'Namibia', SO: 'Somalia', ER: 'Eritrea', DJ: 'Djibouti',
  RW: 'Rwanda', BI: 'Burundi', SL: 'Sierra Leone', LR: 'Liberia', GM: 'Gambia', GW: 'Guinea-Bissau',
  MR: 'Mauritania', LS: 'Lesotho', SZ: 'Eswatini', TG: 'Togo', BJ: 'Benin',
  // Oceania
  AU: 'Australia', NZ: 'New Zealand', PG: 'Papua New Guinea', FJ: 'Fiji',
}

/** Full country name → ISO code (reverse lookup) */
export const COUNTRY_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([iso, name]) => [name, iso])
)

/** ISO code → flag emoji */
export const FLAG_EMOJIS: Record<string, string> = {
  US: '🇺🇸', RU: '🇷🇺', CN: '🇨🇳', DE: '🇩🇪', BR: '🇧🇷', IN: '🇮🇳',
  NG: '🇳🇬', JP: '🇯🇵', GB: '🇬🇧', TR: '🇹🇷', CA: '🇨🇦', MX: '🇲🇽',
  CU: '🇨🇺', BS: '🇧🇸',
  FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', PL: '🇵🇱', UA: '🇺🇦', RO: '🇷🇴',
  NL: '🇳🇱', BE: '🇧🇪', SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮', DK: '🇩🇰',
  AT: '🇦🇹', CH: '🇨🇭', CZ: '🇨🇿', PT: '🇵🇹', GR: '🇬🇷', HU: '🇭🇺',
  IE: '🇮🇪', IS: '🇮🇸', RS: '🇷🇸', BY: '🇧🇾', BG: '🇧🇬', SK: '🇸🇰',
  HR: '🇭🇷', LT: '🇱🇹', LV: '🇱🇻', EE: '🇪🇪', SI: '🇸🇮', BA: '🇧🇦',
  AL: '🇦🇱', MK: '🇲🇰', ME: '🇲🇪', MD: '🇲🇩', XK: '🇽🇰',
  AR: '🇦🇷', CO: '🇨🇴', VE: '🇻🇪', PE: '🇵🇪', CL: '🇨🇱', EC: '🇪🇨',
  BO: '🇧🇴', PY: '🇵🇾', UY: '🇺🇾', GY: '🇬🇾', SR: '🇸🇷',
  GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', NI: '🇳🇮', CR: '🇨🇷', PA: '🇵🇦',
  DO: '🇩🇴', HT: '🇭🇹', JM: '🇯🇲', TT: '🇹🇹',
  KR: '🇰🇷', KP: '🇰🇵', TW: '🇹🇼', TH: '🇹🇭', VN: '🇻🇳', PH: '🇵🇭',
  MY: '🇲🇾', ID: '🇮🇩', MM: '🇲🇲', BD: '🇧🇩', PK: '🇵🇰', AF: '🇦🇫',
  IQ: '🇮🇶', IR: '🇮🇷', SA: '🇸🇦', AE: '🇦🇪', IL: '🇮🇱', SY: '🇸🇾',
  JO: '🇯🇴', LB: '🇱🇧', YE: '🇾🇪', OM: '🇴🇲', KW: '🇰🇼', QA: '🇶🇦',
  GE: '🇬🇪', AM: '🇦🇲', AZ: '🇦🇿', KZ: '🇰🇿', UZ: '🇺🇿', TM: '🇹🇲',
  KG: '🇰🇬', TJ: '🇹🇯', MN: '🇲🇳', NP: '🇳🇵', LK: '🇱🇰', LA: '🇱🇦',
  KH: '🇰🇭', BN: '🇧🇳', SG: '🇸🇬',
  ZA: '🇿🇦', EG: '🇪🇬', KE: '🇰🇪', ET: '🇪🇹', TZ: '🇹🇿', GH: '🇬🇭',
  CI: '🇨🇮', CM: '🇨🇲', AO: '🇦🇴', MZ: '🇲🇿', MG: '🇲🇬', MA: '🇲🇦',
  DZ: '🇩🇿', TN: '🇹🇳', LY: '🇱🇾', SD: '🇸🇩', SS: '🇸🇸', UG: '🇺🇬',
  SN: '🇸🇳', ML: '🇲🇱', BF: '🇧🇫', NE: '🇳🇪', TD: '🇹🇩', CD: '🇨🇩',
  CG: '🇨🇬', CF: '🇨🇫', GA: '🇬🇦', GQ: '🇬🇶', MW: '🇲🇼', ZM: '🇿🇲',
  ZW: '🇿🇼', BW: '🇧🇼', NA: '🇳🇦', SO: '🇸🇴', ER: '🇪🇷', DJ: '🇩🇯',
  RW: '🇷🇼', BI: '🇧🇮', SL: '🇸🇱', LR: '🇱🇷', GM: '🇬🇲', GW: '🇬🇼',
  MR: '🇲🇷', LS: '🇱🇸', SZ: '🇸🇿', TG: '🇹🇬', BJ: '🇧🇯',
  AU: '🇦🇺', NZ: '🇳🇿', PG: '🇵🇬', FJ: '🇫🇯',
}

// ── Utility functions ──

export function getCountryName(iso: string): string {
  return COUNTRY_NAMES[iso] || iso
}

export function getCountryFlag(iso: string): string {
  return FLAG_EMOJIS[iso] || '🏳️'
}

/** Returns a flag image URL from flagcdn.com for cross-platform rendering */
export function getCountryFlagUrl(iso: string, width: number = 40): string {
  return `https://flagcdn.com/w${width}/${iso.toLowerCase()}.png`
}
