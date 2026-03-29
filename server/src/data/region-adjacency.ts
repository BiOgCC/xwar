/**
 * Region adjacency map — extracted from client regionStore.ts REGION_DEFS.
 * Used server-side for supply line BFS and attack adjacency validation.
 * 
 * Format: regionId → { countryCode, adjacent: string[] }
 */

export interface RegionNode {
  cc: string          // country code that "originally owns" this region
  adj: string[]       // adjacent region IDs
}

export const REGION_ADJACENCY: Record<string, RegionNode> = {
  // ── United States (50 States) ──
  'US-WA': { cc: 'US', adj: ['US-OR','US-ID','CA-BC'] },
  'US-OR': { cc: 'US', adj: ['US-WA','US-CA','US-NV','US-ID'] },
  'US-CA': { cc: 'US', adj: ['US-OR','US-NV','US-AZ','MX-BC'] },
  'US-NV': { cc: 'US', adj: ['US-OR','US-CA','US-ID','US-UT','US-AZ'] },
  'US-ID': { cc: 'US', adj: ['US-WA','US-OR','US-NV','US-MT','US-WY','US-UT','CA-BC','CA-AB'] },
  'US-MT': { cc: 'US', adj: ['US-ID','US-WY','US-ND','US-SD','CA-AB','CA-SK'] },
  'US-WY': { cc: 'US', adj: ['US-MT','US-ID','US-UT','US-CO','US-NE','US-SD'] },
  'US-UT': { cc: 'US', adj: ['US-ID','US-NV','US-WY','US-CO','US-AZ','US-NM'] },
  'US-CO': { cc: 'US', adj: ['US-WY','US-UT','US-NM','US-NE','US-KS','US-OK'] },
  'US-AZ': { cc: 'US', adj: ['US-CA','US-NV','US-UT','US-NM','MX-SO'] },
  'US-NM': { cc: 'US', adj: ['US-AZ','US-UT','US-CO','US-OK','US-TX','MX-CH'] },
  'US-ND': { cc: 'US', adj: ['US-MT','US-SD','US-MN','CA-SK','CA-MB'] },
  'US-SD': { cc: 'US', adj: ['US-ND','US-MT','US-WY','US-NE','US-MN','US-IA'] },
  'US-NE': { cc: 'US', adj: ['US-SD','US-WY','US-CO','US-KS','US-IA','US-MO'] },
  'US-KS': { cc: 'US', adj: ['US-NE','US-CO','US-OK','US-MO'] },
  'US-OK': { cc: 'US', adj: ['US-KS','US-CO','US-NM','US-TX','US-MO','US-AR'] },
  'US-TX': { cc: 'US', adj: ['US-OK','US-NM','US-AR','US-LA','MX-CH','MX-CO','MX-TM'] },
  'US-MN': { cc: 'US', adj: ['US-ND','US-SD','US-IA','US-WI','CA-MB','CA-ON'] },
  'US-IA': { cc: 'US', adj: ['US-MN','US-SD','US-NE','US-MO','US-WI','US-IL'] },
  'US-MO': { cc: 'US', adj: ['US-IA','US-NE','US-KS','US-OK','US-AR','US-IL','US-KY','US-TN'] },
  'US-AR': { cc: 'US', adj: ['US-MO','US-OK','US-TX','US-LA','US-MS','US-TN'] },
  'US-LA': { cc: 'US', adj: ['US-TX','US-AR','US-MS'] },
  'US-WI': { cc: 'US', adj: ['US-MN','US-IA','US-IL','US-MI','CA-ON'] },
  'US-IL': { cc: 'US', adj: ['US-WI','US-IA','US-MO','US-IN','US-KY'] },
  'US-MS': { cc: 'US', adj: ['US-AR','US-LA','US-TN','US-AL'] },
  'US-MI': { cc: 'US', adj: ['US-WI','US-IN','US-OH','CA-ON'] },
  'US-IN': { cc: 'US', adj: ['US-IL','US-MI','US-OH','US-KY'] },
  'US-KY': { cc: 'US', adj: ['US-IL','US-IN','US-OH','US-WV','US-VA','US-TN','US-MO'] },
  'US-TN': { cc: 'US', adj: ['US-KY','US-MO','US-AR','US-MS','US-AL','US-GA','US-NC','US-VA'] },
  'US-AL': { cc: 'US', adj: ['US-TN','US-MS','US-FL','US-GA'] },
  'US-OH': { cc: 'US', adj: ['US-MI','US-IN','US-KY','US-WV','US-PA','CA-ON'] },
  'US-WV': { cc: 'US', adj: ['US-OH','US-PA','US-MD','US-VA','US-KY'] },
  'US-VA': { cc: 'US', adj: ['US-WV','US-KY','US-TN','US-NC','US-MD'] },
  'US-NC': { cc: 'US', adj: ['US-VA','US-TN','US-GA','US-SC'] },
  'US-SC': { cc: 'US', adj: ['US-NC','US-GA'] },
  'US-GA': { cc: 'US', adj: ['US-TN','US-AL','US-FL','US-SC','US-NC'] },
  'US-FL': { cc: 'US', adj: ['US-GA','US-AL','CU-HA','BS-NP'] },
  'US-PA': { cc: 'US', adj: ['US-OH','US-WV','US-MD','US-NJ','US-NY','US-DE'] },
  'US-NY': { cc: 'US', adj: ['US-PA','US-NJ','US-CT','US-MA','US-VT','CA-ON','CA-QC'] },
  'US-NJ': { cc: 'US', adj: ['US-PA','US-NY','US-DE'] },
  'US-DE': { cc: 'US', adj: ['US-PA','US-NJ','US-MD'] },
  'US-MD': { cc: 'US', adj: ['US-PA','US-WV','US-VA','US-DE'] },
  'US-CT': { cc: 'US', adj: ['US-NY','US-MA','US-RI'] },
  'US-MA': { cc: 'US', adj: ['US-NY','US-CT','US-RI','US-VT','US-NH'] },
  'US-RI': { cc: 'US', adj: ['US-CT','US-MA'] },
  'US-VT': { cc: 'US', adj: ['US-NY','US-MA','US-NH','CA-QC'] },
  'US-NH': { cc: 'US', adj: ['US-VT','US-MA','US-ME'] },
  'US-ME': { cc: 'US', adj: ['US-NH','CA-QC','CA-NB'] },
  'US-AK': { cc: 'US', adj: ['CA-YT','RU-FE'] },
  'US-HI': { cc: 'US', adj: [] },

  // ── Canada (13) ──
  'CA-BC': { cc: 'CA', adj: ['CA-AB','CA-YT','CA-NT','US-WA','US-ID','US-MT'] },
  'CA-AB': { cc: 'CA', adj: ['CA-BC','CA-SK','CA-NT','US-MT','US-ID'] },
  'CA-SK': { cc: 'CA', adj: ['CA-AB','CA-MB','CA-NT','US-MT','US-ND'] },
  'CA-MB': { cc: 'CA', adj: ['CA-SK','CA-ON','CA-NU','US-ND','US-MN'] },
  'CA-ON': { cc: 'CA', adj: ['CA-MB','CA-QC','US-MN','US-WI','US-MI','US-OH','US-NY'] },
  'CA-QC': { cc: 'CA', adj: ['CA-ON','CA-NB','CA-NL','US-NY','US-VT','US-ME'] },
  'CA-NB': { cc: 'CA', adj: ['CA-QC','CA-NS','CA-PE','US-ME'] },
  'CA-NS': { cc: 'CA', adj: ['CA-NB','CA-PE'] },
  'CA-PE': { cc: 'CA', adj: ['CA-NB','CA-NS'] },
  'CA-NL': { cc: 'CA', adj: ['CA-QC'] },
  'CA-YT': { cc: 'CA', adj: ['CA-BC','CA-NT','US-AK'] },
  'CA-NT': { cc: 'CA', adj: ['CA-YT','CA-BC','CA-AB','CA-SK','CA-NU'] },
  'CA-NU': { cc: 'CA', adj: ['CA-NT','CA-MB'] },

  // ── Russia (20) ──
  'RU-MO': { cc: 'RU', adj: ['RU-SP','RU-WR','RU-VG'] },
  'RU-SP': { cc: 'RU', adj: ['RU-MO','RU-WR','RU-KR'] },
  'RU-KR': { cc: 'RU', adj: ['RU-SP','RU-AR'] },
  'RU-AR': { cc: 'RU', adj: ['RU-KR','RU-WR','RU-KO'] },
  'RU-WR': { cc: 'RU', adj: ['RU-MO','RU-SP','RU-VG','RU-CC','DE-BB'] },
  'RU-VG': { cc: 'RU', adj: ['RU-MO','RU-WR','RU-UR','RU-CC','RU-KO'] },
  'RU-CC': { cc: 'RU', adj: ['RU-WR','RU-VG','TR-EA'] },
  'RU-KO': { cc: 'RU', adj: ['RU-AR','RU-VG','RU-UR'] },
  'RU-UR': { cc: 'RU', adj: ['RU-VG','RU-KO','RU-TY','RU-OM'] },
  'RU-TY': { cc: 'RU', adj: ['RU-UR','RU-OM','RU-KH'] },
  'RU-OM': { cc: 'RU', adj: ['RU-UR','RU-TY','RU-NV'] },
  'RU-NV': { cc: 'RU', adj: ['RU-OM','RU-KH','RU-AL'] },
  'RU-KH': { cc: 'RU', adj: ['RU-TY','RU-NV','RU-IR'] },
  'RU-AL': { cc: 'RU', adj: ['RU-NV','CN-XJ'] },
  'RU-IR': { cc: 'RU', adj: ['RU-KH','RU-BU','RU-SK'] },
  'RU-BU': { cc: 'RU', adj: ['RU-IR','RU-SK','CN-MG'] },
  'RU-SK': { cc: 'RU', adj: ['RU-IR','RU-BU','RU-KM','RU-MG'] },
  'RU-MG': { cc: 'RU', adj: ['RU-SK','RU-KM','RU-FE'] },
  'RU-KM': { cc: 'RU', adj: ['RU-MG','RU-SK'] },
  'RU-FE': { cc: 'RU', adj: ['RU-MG','RU-BU','CN-MC','JP-HK','US-AK'] },

  // ── China (20) ──
  'CN-XJ': { cc: 'CN', adj: ['CN-TB','CN-QH','CN-GS','RU-AL'] },
  'CN-TB': { cc: 'CN', adj: ['CN-XJ','CN-QH','CN-SC','IN-KA'] },
  'CN-QH': { cc: 'CN', adj: ['CN-XJ','CN-TB','CN-GS','CN-SC'] },
  'CN-GS': { cc: 'CN', adj: ['CN-XJ','CN-QH','CN-SC','CN-SX','CN-NM'] },
  'CN-NM': { cc: 'CN', adj: ['CN-GS','CN-SX','CN-HB','CN-LN','CN-JL','CN-HL','CN-MG'] },
  'CN-MG': { cc: 'CN', adj: ['CN-NM','CN-GS','RU-BU'] },
  'CN-HL': { cc: 'CN', adj: ['CN-NM','CN-JL','CN-MC'] },
  'CN-JL': { cc: 'CN', adj: ['CN-HL','CN-NM','CN-LN'] },
  'CN-LN': { cc: 'CN', adj: ['CN-JL','CN-NM','CN-HB'] },
  'CN-MC': { cc: 'CN', adj: ['CN-HL','CN-JL','RU-FE'] },
  'CN-BJ': { cc: 'CN', adj: ['CN-HB','CN-LN','CN-SX'] },
  'CN-HB': { cc: 'CN', adj: ['CN-BJ','CN-LN','CN-NM','CN-SX','CN-SD','CN-HN'] },
  'CN-SX': { cc: 'CN', adj: ['CN-HB','CN-NM','CN-GS','CN-HN'] },
  'CN-SD': { cc: 'CN', adj: ['CN-HB','CN-HN','CN-JS'] },
  'CN-SC': { cc: 'CN', adj: ['CN-TB','CN-QH','CN-GS','CN-HN','CN-GZ','CN-YN'] },
  'CN-HN': { cc: 'CN', adj: ['CN-HB','CN-SX','CN-SD','CN-SC','CN-GZ','CN-GD'] },
  'CN-JS': { cc: 'CN', adj: ['CN-SD','CN-HN','CN-GD','JP-KY'] },
  'CN-YN': { cc: 'CN', adj: ['CN-SC','CN-GZ','IN-NE'] },
  'CN-GZ': { cc: 'CN', adj: ['CN-SC','CN-YN','CN-HN','CN-GD'] },
  'CN-GD': { cc: 'CN', adj: ['CN-HN','CN-GZ','CN-JS'] },

  // ── Germany (16) ──
  'DE-SH': { cc: 'DE', adj: ['DE-HH','DE-NI','DE-MV'] },
  'DE-HH': { cc: 'DE', adj: ['DE-SH','DE-NI'] },
  'DE-MV': { cc: 'DE', adj: ['DE-SH','DE-NI','DE-BB'] },
  'DE-NI': { cc: 'DE', adj: ['DE-SH','DE-HH','DE-MV','DE-BB','DE-ST','DE-TH','DE-HE','DE-NW','DE-HB'] },
  'DE-HB': { cc: 'DE', adj: ['DE-NI'] },
  'DE-BB': { cc: 'DE', adj: ['DE-MV','DE-NI','DE-ST','DE-SN','DE-BE','RU-WR'] },
  'DE-BE': { cc: 'DE', adj: ['DE-BB'] },
  'DE-ST': { cc: 'DE', adj: ['DE-NI','DE-BB','DE-SN','DE-TH'] },
  'DE-NW': { cc: 'DE', adj: ['DE-NI','DE-HE','DE-RP','GB-LN'] },
  'DE-HE': { cc: 'DE', adj: ['DE-NI','DE-TH','DE-NW','DE-RP','DE-BW','DE-BY'] },
  'DE-TH': { cc: 'DE', adj: ['DE-NI','DE-ST','DE-SN','DE-HE','DE-BY'] },
  'DE-SN': { cc: 'DE', adj: ['DE-BB','DE-ST','DE-TH','DE-BY'] },
  'DE-RP': { cc: 'DE', adj: ['DE-NW','DE-HE','DE-BW','DE-SL'] },
  'DE-SL': { cc: 'DE', adj: ['DE-RP'] },
  'DE-BW': { cc: 'DE', adj: ['DE-HE','DE-RP','DE-BY'] },
  'DE-BY': { cc: 'DE', adj: ['DE-HE','DE-TH','DE-SN','DE-BW'] },

  // ── Japan (8) ──
  'JP-HK': { cc: 'JP', adj: ['JP-TH','RU-FE'] },
  'JP-TH': { cc: 'JP', adj: ['JP-HK','JP-KT'] },
  'JP-KT': { cc: 'JP', adj: ['JP-TH','JP-CB','JP-KS'] },
  'JP-CB': { cc: 'JP', adj: ['JP-KT','JP-KS'] },
  'JP-KS': { cc: 'JP', adj: ['JP-KT','JP-CB','JP-CG'] },
  'JP-CG': { cc: 'JP', adj: ['JP-KS','JP-SK','JP-KY'] },
  'JP-SK': { cc: 'JP', adj: ['JP-CG','JP-KY'] },
  'JP-KY': { cc: 'JP', adj: ['JP-CG','JP-SK','CN-JS'] },

  // ── United Kingdom (10) ──
  'GB-SC': { cc: 'GB', adj: ['GB-NE'] },
  'GB-NE': { cc: 'GB', adj: ['GB-SC','GB-YH','GB-NW'] },
  'GB-NW': { cc: 'GB', adj: ['GB-NE','GB-YH','GB-WM','GB-WA'] },
  'GB-YH': { cc: 'GB', adj: ['GB-NE','GB-NW','GB-WM','GB-EM'] },
  'GB-WM': { cc: 'GB', adj: ['GB-NW','GB-YH','GB-EM','GB-SW','GB-WA'] },
  'GB-EM': { cc: 'GB', adj: ['GB-YH','GB-WM','GB-EN'] },
  'GB-EN': { cc: 'GB', adj: ['GB-EM','GB-LN','DE-NW'] },
  'GB-LN': { cc: 'GB', adj: ['GB-EN','GB-WM','GB-SW','DE-NW'] },
  'GB-SW': { cc: 'GB', adj: ['GB-WM','GB-LN','GB-WA'] },
  'GB-WA': { cc: 'GB', adj: ['GB-NW','GB-WM','GB-SW'] },

  // ── Brazil (15) ──
  'BR-AM': { cc: 'BR', adj: ['BR-PA','BR-RO','BR-MT'] },
  'BR-PA': { cc: 'BR', adj: ['BR-AM','BR-MA','BR-MT','BR-TO'] },
  'BR-MA': { cc: 'BR', adj: ['BR-PA','BR-PI','BR-TO'] },
  'BR-RO': { cc: 'BR', adj: ['BR-AM','BR-MT'] },
  'BR-MT': { cc: 'BR', adj: ['BR-AM','BR-PA','BR-RO','BR-TO','BR-GO','BR-MS'] },
  'BR-TO': { cc: 'BR', adj: ['BR-PA','BR-MA','BR-MT','BR-GO','BR-BA'] },
  'BR-PI': { cc: 'BR', adj: ['BR-MA','BR-CE','BR-BA'] },
  'BR-CE': { cc: 'BR', adj: ['BR-PI','BR-BA','NG-LG'] },
  'BR-BA': { cc: 'BR', adj: ['BR-TO','BR-PI','BR-CE','BR-GO','BR-MG'] },
  'BR-GO': { cc: 'BR', adj: ['BR-MT','BR-TO','BR-BA','BR-MG','BR-MS'] },
  'BR-MS': { cc: 'BR', adj: ['BR-MT','BR-GO','BR-SP'] },
  'BR-MG': { cc: 'BR', adj: ['BR-BA','BR-GO','BR-SP','BR-RJ'] },
  'BR-SP': { cc: 'BR', adj: ['BR-MS','BR-GO','BR-MG','BR-RJ','BR-RS'] },
  'BR-RJ': { cc: 'BR', adj: ['BR-MG','BR-SP'] },
  'BR-RS': { cc: 'BR', adj: ['BR-SP'] },

  // ── India (16) ──
  'IN-KA': { cc: 'IN', adj: ['IN-PB','IN-HP','CN-TB'] },
  'IN-PB': { cc: 'IN', adj: ['IN-KA','IN-HP','IN-HR','IN-RJ'] },
  'IN-HP': { cc: 'IN', adj: ['IN-KA','IN-PB','IN-HR','IN-UP'] },
  'IN-HR': { cc: 'IN', adj: ['IN-PB','IN-HP','IN-DL','IN-RJ','IN-UP'] },
  'IN-DL': { cc: 'IN', adj: ['IN-HR','IN-UP'] },
  'IN-RJ': { cc: 'IN', adj: ['IN-PB','IN-HR','IN-UP','IN-GJ','IN-MP'] },
  'IN-UP': { cc: 'IN', adj: ['IN-HP','IN-HR','IN-DL','IN-RJ','IN-MP','IN-WB','IN-BI'] },
  'IN-GJ': { cc: 'IN', adj: ['IN-RJ','IN-MP','IN-MH'] },
  'IN-MP': { cc: 'IN', adj: ['IN-RJ','IN-UP','IN-GJ','IN-MH','IN-OR'] },
  'IN-WB': { cc: 'IN', adj: ['IN-UP','IN-BI','IN-OR','IN-NE'] },
  'IN-BI': { cc: 'IN', adj: ['IN-UP','IN-WB','IN-OR'] },
  'IN-NE': { cc: 'IN', adj: ['IN-WB','CN-YN'] },
  'IN-MH': { cc: 'IN', adj: ['IN-GJ','IN-MP','IN-KR','IN-TN'] },
  'IN-OR': { cc: 'IN', adj: ['IN-MP','IN-WB','IN-BI','IN-TN'] },
  'IN-KR': { cc: 'IN', adj: ['IN-MH','IN-TN'] },
  'IN-TN': { cc: 'IN', adj: ['IN-KR','IN-MH','IN-OR'] },

  // ── Nigeria (7) ──
  'NG-LG': { cc: 'NG', adj: ['NG-SW','NG-SS','BR-CE'] },
  'NG-SW': { cc: 'NG', adj: ['NG-LG','NG-NC','NG-SS'] },
  'NG-SS': { cc: 'NG', adj: ['NG-LG','NG-SW','NG-SE'] },
  'NG-SE': { cc: 'NG', adj: ['NG-SS','NG-NC'] },
  'NG-NC': { cc: 'NG', adj: ['NG-SW','NG-SE','NG-NE','NG-NW'] },
  'NG-NW': { cc: 'NG', adj: ['NG-NC','NG-NE'] },
  'NG-NE': { cc: 'NG', adj: ['NG-NC','NG-NW','TR-SE'] },

  // ── Turkey (8) ──
  'TR-IS': { cc: 'TR', adj: ['TR-MA','TR-BS','DE-BB'] },
  'TR-MA': { cc: 'TR', adj: ['TR-IS','TR-AN','TR-AE'] },
  'TR-BS': { cc: 'TR', adj: ['TR-IS','TR-AN','TR-EA'] },
  'TR-AE': { cc: 'TR', adj: ['TR-MA','TR-AN','TR-MD'] },
  'TR-AN': { cc: 'TR', adj: ['TR-MA','TR-BS','TR-AE','TR-MD','TR-EA'] },
  'TR-MD': { cc: 'TR', adj: ['TR-AE','TR-AN','TR-SE'] },
  'TR-EA': { cc: 'TR', adj: ['TR-BS','TR-AN','TR-SE','RU-CC'] },
  'TR-SE': { cc: 'TR', adj: ['TR-MD','TR-EA','NG-NE'] },

  // ── Mexico (11) ──
  'MX-BC': { cc: 'MX', adj: ['MX-SO','US-CA'] },
  'MX-SO': { cc: 'MX', adj: ['MX-BC','MX-CH','US-AZ'] },
  'MX-CH': { cc: 'MX', adj: ['MX-SO','MX-DU','MX-CO','US-NM','US-TX'] },
  'MX-CO': { cc: 'MX', adj: ['MX-CH','MX-DU','MX-NL','MX-TM','US-TX'] },
  'MX-NL': { cc: 'MX', adj: ['MX-CO','MX-TM','MX-SL'] },
  'MX-TM': { cc: 'MX', adj: ['MX-CO','MX-NL','MX-SL','US-TX'] },
  'MX-DU': { cc: 'MX', adj: ['MX-CH','MX-CO','MX-SL','MX-JA'] },
  'MX-SL': { cc: 'MX', adj: ['MX-NL','MX-TM','MX-DU','MX-JA','MX-MC'] },
  'MX-JA': { cc: 'MX', adj: ['MX-DU','MX-SL','MX-MC'] },
  'MX-MC': { cc: 'MX', adj: ['MX-SL','MX-JA','MX-YU','CU-HA'] },
  'MX-YU': { cc: 'MX', adj: ['MX-MC','CU-HA'] },

  // ── Cuba (3) ──
  'CU-HA': { cc: 'CU', adj: ['CU-CT','CU-SG','US-FL','MX-MC','MX-YU','BS-NP'] },
  'CU-CT': { cc: 'CU', adj: ['CU-HA','CU-SG'] },
  'CU-SG': { cc: 'CU', adj: ['CU-HA','CU-CT'] },

  // ── Bahamas (2) ──
  'BS-NP': { cc: 'BS', adj: ['BS-GI','CU-HA','US-FL','OC-ATL-W'] },
  'BS-GI': { cc: 'BS', adj: ['BS-NP'] },

  // ── Oceans ──
  'OC-ATL-W': { cc: 'OC', adj: ['US-NY','US-MA','US-FL','CA-NS','BS-NP','OC-ATL-C'] },
  'OC-ATL-C': { cc: 'OC', adj: ['OC-ATL-W','OC-ATL-E'] },
  'OC-ATL-E': { cc: 'OC', adj: ['OC-ATL-C','GB-SW','GB-WA'] },
  'OC-PAC':   { cc: 'OC', adj: ['US-CA','US-OR','MX-BC','JP-KT','JP-HK','CN-JS','CN-GD','CA-BC'] },
  'OC-IND':   { cc: 'OC', adj: ['IN-TN','IN-GJ','IN-WB','NG-SE'] },
  'OC-MED':   { cc: 'OC', adj: ['TR-AE','TR-MD','TR-MA','DE-BY'] },
}

/**
 * Capital region for each country — first region in their territory.
 * Used for supply line BFS origin.
 */
export const CAPITAL_REGIONS: Record<string, string> = {
  'US': 'US-NY', 'CA': 'CA-ON', 'RU': 'RU-MO', 'CN': 'CN-BJ',
  'DE': 'DE-BE', 'JP': 'JP-KT', 'GB': 'GB-LN', 'BR': 'BR-SP',
  'IN': 'IN-DL', 'NG': 'NG-LG', 'TR': 'TR-IS', 'MX': 'MX-MC',
  'CU': 'CU-HA', 'BS': 'BS-NP',
}

/**
 * BFS: Check if targetRegionId is reachable from the capital of countryCode,
 * traversing only regions where controlledBy === countryCode.
 * 
 * @param countryCode - The country checking supply lines
 * @param targetRegionId - The region to check reachability for
 * @param controlledRegions - Set of region IDs where controlledBy === countryCode
 * @returns true if connected to capital, false if supply line is cut
 */
export function isConnectedToCapital(
  countryCode: string,
  targetRegionId: string,
  controlledRegions: Set<string>,
): boolean {
  const capitalId = CAPITAL_REGIONS[countryCode]
  if (!capitalId) return true  // unknown country = no penalty

  // If the target IS the capital, it's connected
  if (targetRegionId === capitalId) return true

  // If the capital is not controlled, nothing is connected
  if (!controlledRegions.has(capitalId)) return false

  // BFS from capital through controlled regions
  const visited = new Set<string>()
  const queue: string[] = [capitalId]
  visited.add(capitalId)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === targetRegionId) return true

    const node = REGION_ADJACENCY[current]
    if (!node) continue

    for (const neighbor of node.adj) {
      if (visited.has(neighbor)) continue
      if (!controlledRegions.has(neighbor)) continue
      visited.add(neighbor)
      queue.push(neighbor)
    }
  }

  return false
}
