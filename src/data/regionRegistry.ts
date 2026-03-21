/**
 * regionRegistry.ts — Flat lookup of all hardcoded region IDs/names/countries.
 *
 * This is the single source of truth for region metadata used by
 * Military, Cyber, and Battle systems to present region pickers.
 * The data mirrors the REGION_DEFS in regionStore.ts.
 */

export interface RegionMeta {
  id: string        // e.g. "US-WA"
  name: string      // e.g. "Washington"
  countryCode: string // e.g. "US"
}

// ── Build registry from the same defs used in regionStore ──

const R = (id: string, name: string, cc: string): RegionMeta => ({ id, name, countryCode: cc })

const REGION_LIST: RegionMeta[] = [
  // ── United States (50 States) ──
  R('US-WA','Washington','US'), R('US-OR','Oregon','US'), R('US-CA','California','US'),
  R('US-NV','Nevada','US'), R('US-ID','Idaho','US'), R('US-MT','Montana','US'),
  R('US-WY','Wyoming','US'), R('US-UT','Utah','US'), R('US-CO','Colorado','US'),
  R('US-AZ','Arizona','US'), R('US-NM','New Mexico','US'), R('US-ND','North Dakota','US'),
  R('US-SD','South Dakota','US'), R('US-NE','Nebraska','US'), R('US-KS','Kansas','US'),
  R('US-OK','Oklahoma','US'), R('US-TX','Texas','US'), R('US-MN','Minnesota','US'),
  R('US-IA','Iowa','US'), R('US-MO','Missouri','US'), R('US-AR','Arkansas','US'),
  R('US-LA','Louisiana','US'), R('US-WI','Wisconsin','US'), R('US-IL','Illinois','US'),
  R('US-MS','Mississippi','US'), R('US-MI','Michigan','US'), R('US-IN','Indiana','US'),
  R('US-KY','Kentucky','US'), R('US-TN','Tennessee','US'), R('US-AL','Alabama','US'),
  R('US-OH','Ohio','US'), R('US-WV','West Virginia','US'), R('US-VA','Virginia','US'),
  R('US-NC','North Carolina','US'), R('US-SC','South Carolina','US'), R('US-GA','Georgia','US'),
  R('US-FL','Florida','US'), R('US-PA','Pennsylvania','US'), R('US-NY','New York','US'),
  R('US-NJ','New Jersey','US'), R('US-DE','Delaware','US'), R('US-MD','Maryland','US'),
  R('US-CT','Connecticut','US'), R('US-MA','Massachusetts','US'), R('US-RI','Rhode Island','US'),
  R('US-VT','Vermont','US'), R('US-NH','New Hampshire','US'), R('US-ME','Maine','US'),
  R('US-AK','Alaska','US'), R('US-HI','Hawaii','US'),

  // ── Canada (13 Provinces & Territories) ──
  R('CA-BC','British Columbia','CA'), R('CA-AB','Alberta','CA'), R('CA-SK','Saskatchewan','CA'),
  R('CA-MB','Manitoba','CA'), R('CA-ON','Ontario','CA'), R('CA-QC','Quebec','CA'),
  R('CA-NB','New Brunswick','CA'), R('CA-NS','Nova Scotia','CA'), R('CA-PE','Prince Edward Is','CA'),
  R('CA-NL','Newfoundland','CA'), R('CA-YT','Yukon','CA'), R('CA-NT','NW Territories','CA'),
  R('CA-NU','Nunavut','CA'),

  // ── Russia (20 regions) ──
  R('RU-MO','Moscow','RU'), R('RU-SP','St Petersburg','RU'), R('RU-KR','Karelia','RU'),
  R('RU-AR','Arkhangelsk','RU'), R('RU-WR','Western Russia','RU'), R('RU-VG','Volga','RU'),
  R('RU-CC','Caucasus','RU'), R('RU-KO','Komi','RU'), R('RU-UR','Ural','RU'),
  R('RU-TY','Tyumen','RU'), R('RU-OM','Omsk','RU'), R('RU-NV','Novosibirsk','RU'),
  R('RU-KH','Krasnoyarsk','RU'), R('RU-AL','Altai','RU'), R('RU-IR','Irkutsk','RU'),
  R('RU-BU','Buryatia','RU'), R('RU-SK','Sakha','RU'), R('RU-MG','Magadan','RU'),
  R('RU-KM','Kamchatka','RU'), R('RU-FE','Far East','RU'),

  // ── China (20 Provinces) ──
  R('CN-XJ','Xinjiang','CN'), R('CN-TB','Tibet','CN'), R('CN-QH','Qinghai','CN'),
  R('CN-GS','Gansu','CN'), R('CN-NM','Inner Mongolia','CN'), R('CN-MG','Mongolia Border','CN'),
  R('CN-HL','Heilongjiang','CN'), R('CN-JL','Jilin','CN'), R('CN-LN','Liaoning','CN'),
  R('CN-MC','Manchuria Coast','CN'), R('CN-BJ','Beijing','CN'), R('CN-HB','Hebei','CN'),
  R('CN-SX','Shanxi','CN'), R('CN-SD','Shandong','CN'), R('CN-SC','Sichuan','CN'),
  R('CN-HN','Henan','CN'), R('CN-JS','Jiangsu/Shanghai','CN'), R('CN-YN','Yunnan','CN'),
  R('CN-GZ','Guizhou','CN'), R('CN-GD','Guangdong','CN'),

  // ── Germany (16 States) ──
  R('DE-SH','Schleswig-Holstein','DE'), R('DE-HH','Hamburg','DE'), R('DE-MV','Mecklenburg','DE'),
  R('DE-NI','Lower Saxony','DE'), R('DE-HB','Bremen','DE'), R('DE-BB','Brandenburg','DE'),
  R('DE-BE','Berlin','DE'), R('DE-ST','Saxony-Anhalt','DE'), R('DE-NW','North Rhine-Westphalia','DE'),
  R('DE-HE','Hesse','DE'), R('DE-TH','Thuringia','DE'), R('DE-SN','Saxony','DE'),
  R('DE-RP','Rhineland-Palat','DE'), R('DE-SL','Saarland','DE'), R('DE-BW','Baden-Württemberg','DE'),
  R('DE-BY','Bavaria','DE'),

  // ── Japan (8 Regions) ──
  R('JP-HK','Hokkaido','JP'), R('JP-TH','Tohoku','JP'), R('JP-KT','Kanto','JP'),
  R('JP-CB','Chubu','JP'), R('JP-KS','Kansai','JP'), R('JP-CG','Chugoku','JP'),
  R('JP-SK','Shikoku','JP'), R('JP-KY','Kyushu','JP'),

  // ── United Kingdom (10 Regions) ──
  R('GB-SC','Scotland','GB'), R('GB-NE','North England','GB'), R('GB-NW','North West','GB'),
  R('GB-YH','Yorkshire','GB'), R('GB-WM','West Midlands','GB'), R('GB-EM','East Midlands','GB'),
  R('GB-EN','East England','GB'), R('GB-LN','London & SE','GB'), R('GB-SW','South West','GB'),
  R('GB-WA','Wales','GB'),

  // ── Brazil (15 States) ──
  R('BR-AM','Amazonas','BR'), R('BR-PA','Para','BR'), R('BR-MA','Maranhao','BR'),
  R('BR-RO','Rondonia','BR'), R('BR-MT','Mato Grosso','BR'), R('BR-TO','Tocantins','BR'),
  R('BR-PI','Piaui','BR'), R('BR-CE','Ceara','BR'), R('BR-BA','Bahia','BR'),
  R('BR-GO','Goias','BR'), R('BR-MS','Mato G. do Sul','BR'), R('BR-MG','Minas Gerais','BR'),
  R('BR-SP','Sao Paulo','BR'), R('BR-RJ','Rio de Janeiro','BR'), R('BR-RS','Rio Grande do Sul','BR'),

  // ── India (16 States) ──
  R('IN-KA','Kashmir','IN'), R('IN-PB','Punjab','IN'), R('IN-HP','Himachal Pradesh','IN'),
  R('IN-HR','Haryana','IN'), R('IN-DL','Delhi','IN'), R('IN-RJ','Rajasthan','IN'),
  R('IN-UP','Uttar Pradesh','IN'), R('IN-GJ','Gujarat','IN'), R('IN-MP','Madhya Pradesh','IN'),
  R('IN-WB','West Bengal','IN'), R('IN-BI','Bihar','IN'), R('IN-NE','Northeast','IN'),
  R('IN-MH','Maharashtra','IN'), R('IN-OR','Odisha','IN'), R('IN-KR','Karnataka','IN'),
  R('IN-TN','Tamil Nadu','IN'),

  // ── Nigeria (7 Regions) ──
  R('NG-LG','Lagos','NG'), R('NG-SW','Southwest','NG'), R('NG-SS','South South','NG'),
  R('NG-SE','Southeast','NG'), R('NG-NC','North Central','NG'), R('NG-NW','Northwest','NG'),
  R('NG-NE','Northeast','NG'),

  // ── Turkey (8 Regions) ──
  R('TR-IS','Istanbul','TR'), R('TR-MA','Marmara','TR'), R('TR-BS','Black Sea','TR'),
  R('TR-AE','Aegean','TR'), R('TR-AN','Ankara','TR'), R('TR-MD','Mediterranean','TR'),
  R('TR-EA','Eastern Anatolia','TR'), R('TR-SE','Southeast','TR'),

  // ── Mexico (11 States) ──
  R('MX-BC','Baja California','MX'), R('MX-SO','Sonora','MX'), R('MX-CH','Chihuahua','MX'),
  R('MX-CO','Coahuila','MX'), R('MX-NL','Nuevo Leon','MX'), R('MX-TM','Tamaulipas','MX'),
  R('MX-DU','Durango','MX'), R('MX-SL','San Luis Potosi','MX'), R('MX-JA','Jalisco','MX'),
  R('MX-MC','Mexico City','MX'), R('MX-YU','Yucatan','MX'),

  // ── Cuba (3 Regions) ──
  R('CU-HA','Havana','CU'), R('CU-CT','Central Cuba','CU'), R('CU-SG','Santiago','CU'),

  // ── Bahamas (2 Regions) ──
  R('BS-NP','Nassau','BS'), R('BS-GI','Grand Island','BS'),

  // ── Oceans (6 Strategic Naval Blocks) ──
  R('OC-ATL-W','West Atlantic','OC'), R('OC-ATL-C','Central Atlantic','OC'),
  R('OC-ATL-E','East Atlantic','OC'), R('OC-PAC','Pacific Ocean','OC'),
  R('OC-IND','Indian Ocean','OC'), R('OC-MED','Mediterranean Sea','OC'),
]

// ── Lookup maps ──

/** Region ID → metadata */
export const REGION_REGISTRY: Record<string, RegionMeta> = Object.fromEntries(
  REGION_LIST.map(r => [r.id, r])
)

/** Country code → all its regions */
const _byCountry = new Map<string, RegionMeta[]>()
REGION_LIST.forEach(r => {
  if (!_byCountry.has(r.countryCode)) _byCountry.set(r.countryCode, [])
  _byCountry.get(r.countryCode)!.push(r)
})

/** Get all regions for a country code (e.g. "US" → 50 regions) */
export function getRegionsForCountry(cc: string): RegionMeta[] {
  return _byCountry.get(cc) || []
}

/** Get a single region by ID */
export function getRegionById(id: string): RegionMeta | undefined {
  return REGION_REGISTRY[id]
}

/** All country codes that have hardcoded regions */
export const COUNTRIES_WITH_REGIONS = [..._byCountry.keys()]

/** Total count of hardcoded regions */
export const TOTAL_REGION_COUNT = REGION_LIST.length
