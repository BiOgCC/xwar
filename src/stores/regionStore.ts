import { create } from 'zustand'
import { useWorldStore } from './worldStore'
import { useArmyStore, DIVISION_TEMPLATES } from './army'
import type { Division } from './army/types'
import { usePlayerStore } from './playerStore'
import { getCountryName } from '../data/countries'

// ====== REGION MODEL ======

export interface Region {
  id: string
  name: string
  countryCode: string
  controlledBy: string
  captureProgress: number
  attackedBy: string | null
  assignedArmyId: string | null
  position: [number, number]
  adjacent: string[]
  defense: number
  isOcean?: boolean
  fishingBonus: number
  oilYield: number
  tradeRouteValue: number
  isBlockaded: boolean
  debris: { scrap: number; materialX: number; militaryBoxes: number }
  scavengeCount: number  // How many times this debris pile has been scavenged (max 4)
  // Revolt system
  revoltPressure: number       // 0–100, Homeland Bonus scales linearly
  revoltCooldownUntil: number  // timestamp: no auto-trigger until after this
  noDefenderTicks: number      // consecutive ticks with 0 occupier divisions — auto-lib at 300
  revoltBattleId: string | null // active revolt battle ID
  revoltTriggerType: 'manual' | 'auto' | null // how the current revolt was triggered
}

// ====== NAMED REGION DEFINITIONS ======

interface RegionDef {
  id: string; name: string; countryCode: string
  offsetX: number; offsetY: number
  adjacent: string[]; defense: number
  isOcean?: boolean
  fishingBonus?: number; oilYield?: number; tradeRouteValue?: number
}

const R = (id: string, name: string, cc: string, ox: number, oy: number, adj: string[], def: number, isOcean: boolean = false, fishingBonus = 0, oilYield = 0, tradeRouteValue = 0): RegionDef =>
  ({ id, name, countryCode: cc, offsetX: ox, offsetY: oy, adjacent: adj, defense: def, isOcean, fishingBonus, oilYield, tradeRouteValue })

const REGION_DEFS: RegionDef[] = [
  // ── United States (50 States) ──
  R('US-WA','Washington','US',0.07,0.90,['US-OR','US-ID','CA-BC'],50),
  R('US-OR','Oregon','US',0.07,0.78,['US-WA','US-CA','US-NV','US-ID'],45),
  R('US-CA','California','US',0.05,0.55,['US-OR','US-NV','US-AZ','MX-BC'],65),
  R('US-NV','Nevada','US',0.14,0.58,['US-OR','US-CA','US-ID','US-UT','US-AZ'],40),
  R('US-ID','Idaho','US',0.17,0.78,['US-WA','US-OR','US-NV','US-MT','US-WY','US-UT','CA-BC','CA-AB'],40),
  R('US-MT','Montana','US',0.26,0.90,['US-ID','US-WY','US-ND','US-SD','CA-AB','CA-SK'],40),
  R('US-WY','Wyoming','US',0.29,0.73,['US-MT','US-ID','US-UT','US-CO','US-NE','US-SD'],40),
  R('US-UT','Utah','US',0.22,0.59,['US-ID','US-NV','US-WY','US-CO','US-AZ','US-NM'],45),
  R('US-CO','Colorado','US',0.32,0.58,['US-WY','US-UT','US-NM','US-NE','US-KS','US-OK'],55),
  R('US-AZ','Arizona','US',0.18,0.38,['US-CA','US-NV','US-UT','US-NM','MX-SO'],50),
  R('US-NM','New Mexico','US',0.30,0.38,['US-AZ','US-UT','US-CO','US-OK','US-TX','MX-CH'],45),
  R('US-ND','North Dakota','US',0.41,0.90,['US-MT','US-SD','US-MN','CA-SK','CA-MB'],35),
  R('US-SD','South Dakota','US',0.41,0.78,['US-ND','US-MT','US-WY','US-NE','US-MN','US-IA'],35),
  R('US-NE','Nebraska','US',0.42,0.67,['US-SD','US-WY','US-CO','US-KS','US-IA','US-MO'],40),
  R('US-KS','Kansas','US',0.44,0.56,['US-NE','US-CO','US-OK','US-MO'],40),
  R('US-OK','Oklahoma','US',0.46,0.44,['US-KS','US-CO','US-NM','US-TX','US-MO','US-AR'],45),
  R('US-TX','Texas','US',0.42,0.25,['US-OK','US-NM','US-AR','US-LA','MX-CH','MX-CO','MX-TM'],65),
  R('US-MN','Minnesota','US',0.52,0.87,['US-ND','US-SD','US-IA','US-WI','CA-MB','CA-ON'],45),
  R('US-IA','Iowa','US',0.53,0.70,['US-MN','US-SD','US-NE','US-MO','US-WI','US-IL'],40),
  R('US-MO','Missouri','US',0.55,0.56,['US-IA','US-NE','US-KS','US-OK','US-AR','US-IL','US-KY','US-TN'],50),
  R('US-AR','Arkansas','US',0.55,0.42,['US-MO','US-OK','US-TX','US-LA','US-MS','US-TN'],40),
  R('US-LA','Louisiana','US',0.56,0.27,['US-TX','US-AR','US-MS'],45),
  R('US-WI','Wisconsin','US',0.59,0.80,['US-MN','US-IA','US-IL','US-MI','CA-ON'],45),
  R('US-IL','Illinois','US',0.60,0.62,['US-WI','US-IA','US-MO','US-IN','US-KY'],55),
  R('US-MS','Mississippi','US',0.60,0.33,['US-AR','US-LA','US-TN','US-AL'],40),
  R('US-MI','Michigan','US',0.68,0.78,['US-WI','US-IN','US-OH','CA-ON'],50),
  R('US-IN','Indiana','US',0.65,0.62,['US-IL','US-MI','US-OH','US-KY'],45),
  R('US-KY','Kentucky','US',0.66,0.52,['US-IL','US-IN','US-OH','US-WV','US-VA','US-TN','US-MO'],45),
  R('US-TN','Tennessee','US',0.64,0.45,['US-KY','US-MO','US-AR','US-MS','US-AL','US-GA','US-NC','US-VA'],50),
  R('US-AL','Alabama','US',0.64,0.33,['US-TN','US-MS','US-FL','US-GA'],40),
  R('US-OH','Ohio','US',0.72,0.63,['US-MI','US-IN','US-KY','US-WV','US-PA','CA-ON'],55),
  R('US-WV','West Virginia','US',0.75,0.55,['US-OH','US-PA','US-MD','US-VA','US-KY'],40),
  R('US-VA','Virginia','US',0.78,0.50,['US-WV','US-KY','US-TN','US-NC','US-MD'],55),
  R('US-NC','North Carolina','US',0.77,0.42,['US-VA','US-TN','US-GA','US-SC'],50),
  R('US-SC','South Carolina','US',0.75,0.36,['US-NC','US-GA'],40),
  R('US-GA','Georgia','US',0.70,0.33,['US-TN','US-AL','US-FL','US-SC','US-NC'],50),
  R('US-FL','Florida','US',0.72,0.17,['US-GA','US-AL','CU-HA','BS-NP'],55),
  R('US-PA','Pennsylvania','US',0.80,0.65,['US-OH','US-WV','US-MD','US-NJ','US-NY','US-DE'],55),
  R('US-NY','New York','US',0.84,0.73,['US-PA','US-NJ','US-CT','US-MA','US-VT','CA-ON','CA-QC'],65),
  R('US-NJ','New Jersey','US',0.85,0.62,['US-PA','US-NY','US-DE'],50),
  R('US-DE','Delaware','US',0.83,0.57,['US-PA','US-NJ','US-MD'],35),
  R('US-MD','Maryland','US',0.81,0.55,['US-PA','US-WV','US-VA','US-DE'],50),
  R('US-CT','Connecticut','US',0.88,0.67,['US-NY','US-MA','US-RI'],45),
  R('US-MA','Massachusetts','US',0.90,0.70,['US-NY','US-CT','US-RI','US-VT','US-NH'],55),
  R('US-RI','Rhode Island','US',0.91,0.67,['US-CT','US-MA'],30),
  R('US-VT','Vermont','US',0.88,0.78,['US-NY','US-MA','US-NH','CA-QC'],35),
  R('US-NH','New Hampshire','US',0.90,0.77,['US-VT','US-MA','US-ME'],35),
  R('US-ME','Maine','US',0.94,0.83,['US-NH','CA-QC','CA-NB'],40),
  R('US-AK','Alaska','US',0.02,0.95,['CA-YT','RU-FE'],40),
  R('US-HI','Hawaii','US',0.10,0.05,[],30),

  // ── Canada (13 Provinces & Territories) ──
  R('CA-BC','British Columbia','CA',0.08,0.40,['CA-AB','CA-YT','CA-NT','US-WA','US-ID','US-MT'],50),
  R('CA-AB','Alberta','CA',0.20,0.40,['CA-BC','CA-SK','CA-NT','US-MT','US-ID'],45),
  R('CA-SK','Saskatchewan','CA',0.32,0.40,['CA-AB','CA-MB','CA-NT','US-MT','US-ND'],35),
  R('CA-MB','Manitoba','CA',0.44,0.40,['CA-SK','CA-ON','CA-NU','US-ND','US-MN'],35),
  R('CA-ON','Ontario','CA',0.60,0.30,['CA-MB','CA-QC','US-MN','US-WI','US-MI','US-OH','US-NY'],55),
  R('CA-QC','Quebec','CA',0.76,0.38,['CA-ON','CA-NB','CA-NL','US-NY','US-VT','US-ME'],55),
  R('CA-NB','New Brunswick','CA',0.88,0.22,['CA-QC','CA-NS','CA-PE','US-ME'],35),
  R('CA-NS','Nova Scotia','CA',0.93,0.18,['CA-NB','CA-PE'],30),
  R('CA-PE','Prince Edward Is','CA',0.91,0.25,['CA-NB','CA-NS'],25),
  R('CA-NL','Newfoundland','CA',0.95,0.42,['CA-QC'],30),
  R('CA-YT','Yukon','CA',0.06,0.80,['CA-BC','CA-NT','US-AK'],25),
  R('CA-NT','NW Territories','CA',0.22,0.78,['CA-YT','CA-BC','CA-AB','CA-SK','CA-NU'],20),
  R('CA-NU','Nunavut','CA',0.50,0.82,['CA-NT','CA-MB'],15),

  // ── Russia (20 regions) ──
  R('RU-MO','Moscow','RU',0.07,0.42,['RU-SP','RU-WR','RU-VG'],85),
  R('RU-SP','St Petersburg','RU',0.03,0.55,['RU-MO','RU-WR','RU-KR'],65),
  R('RU-KR','Karelia','RU',0.04,0.68,['RU-SP','RU-AR'],35),
  R('RU-AR','Arkhangelsk','RU',0.10,0.70,['RU-KR','RU-WR','RU-KO'],30),
  R('RU-WR','Western Russia','RU',0.08,0.30,['RU-MO','RU-SP','RU-VG','RU-CC','DE-BB'],60),
  R('RU-VG','Volga','RU',0.16,0.40,['RU-MO','RU-WR','RU-UR','RU-CC','RU-KO'],50),
  R('RU-CC','Caucasus','RU',0.12,0.12,['RU-WR','RU-VG','TR-EA'],60),
  R('RU-KO','Komi','RU',0.18,0.63,['RU-AR','RU-VG','RU-UR'],30),
  R('RU-UR','Ural','RU',0.24,0.45,['RU-VG','RU-KO','RU-TY','RU-OM'],55),
  R('RU-TY','Tyumen','RU',0.30,0.60,['RU-UR','RU-OM','RU-KH'],35),
  R('RU-OM','Omsk','RU',0.33,0.42,['RU-UR','RU-TY','RU-NV'],35),
  R('RU-NV','Novosibirsk','RU',0.40,0.42,['RU-OM','RU-KH','RU-AL'],40),
  R('RU-KH','Krasnoyarsk','RU',0.46,0.60,['RU-TY','RU-NV','RU-IR'],35),
  R('RU-AL','Altai','RU',0.42,0.30,['RU-NV','CN-XJ'],30),
  R('RU-IR','Irkutsk','RU',0.55,0.52,['RU-KH','RU-BU','RU-SK'],30),
  R('RU-BU','Buryatia','RU',0.62,0.42,['RU-IR','RU-SK','CN-MG'],30),
  R('RU-SK','Sakha','RU',0.70,0.65,['RU-IR','RU-BU','RU-KM','RU-MG'],25),
  R('RU-MG','Magadan','RU',0.82,0.60,['RU-SK','RU-KM','RU-FE'],20),
  R('RU-KM','Kamchatka','RU',0.90,0.55,['RU-MG','RU-SK'],20),
  R('RU-FE','Far East','RU',0.85,0.38,['RU-MG','RU-BU','CN-MC','JP-HK','US-AK'],35),

  // ── China (20 Provinces) ──
  R('CN-XJ','Xinjiang','CN',0.10,0.65,['CN-TB','CN-QH','CN-GS','RU-AL'],40),
  R('CN-TB','Tibet','CN',0.12,0.35,['CN-XJ','CN-QH','CN-SC','IN-KA'],30),
  R('CN-QH','Qinghai','CN',0.25,0.50,['CN-XJ','CN-TB','CN-GS','CN-SC'],35),
  R('CN-GS','Gansu','CN',0.35,0.60,['CN-XJ','CN-QH','CN-SC','CN-SX','CN-NM'],40),
  R('CN-NM','Inner Mongolia','CN',0.55,0.85,['CN-GS','CN-SX','CN-HB','CN-LN','CN-JL','CN-HL','CN-MG'],40),
  R('CN-MG','Mongolia Border','CN',0.45,0.80,['CN-NM','CN-GS','RU-BU'],35),
  R('CN-HL','Heilongjiang','CN',0.82,0.92,['CN-NM','CN-JL','CN-MC'],45),
  R('CN-JL','Jilin','CN',0.82,0.80,['CN-HL','CN-NM','CN-LN'],40),
  R('CN-LN','Liaoning','CN',0.78,0.72,['CN-JL','CN-NM','CN-HB'],50),
  R('CN-MC','Manchuria Coast','CN',0.90,0.85,['CN-HL','CN-JL','RU-FE'],45),
  R('CN-BJ','Beijing','CN',0.70,0.62,['CN-HB','CN-LN','CN-SX'],75),
  R('CN-HB','Hebei','CN',0.68,0.55,['CN-BJ','CN-LN','CN-NM','CN-SX','CN-SD','CN-HN'],50),
  R('CN-SX','Shanxi','CN',0.55,0.55,['CN-HB','CN-NM','CN-GS','CN-HN'],45),
  R('CN-SD','Shandong','CN',0.78,0.48,['CN-HB','CN-HN','CN-JS'],55),
  R('CN-SC','Sichuan','CN',0.40,0.35,['CN-TB','CN-QH','CN-GS','CN-HN','CN-GZ','CN-YN'],50),
  R('CN-HN','Henan','CN',0.65,0.42,['CN-HB','CN-SX','CN-SD','CN-SC','CN-GZ','CN-GD'],50),
  R('CN-JS','Jiangsu/Shanghai','CN',0.82,0.38,['CN-SD','CN-HN','CN-GD','JP-KY'],60),
  R('CN-YN','Yunnan','CN',0.35,0.15,['CN-SC','CN-GZ','IN-NE'],40),
  R('CN-GZ','Guizhou','CN',0.48,0.22,['CN-SC','CN-YN','CN-HN','CN-GD'],40),
  R('CN-GD','Guangdong','CN',0.65,0.10,['CN-HN','CN-GZ','CN-JS'],60),

  // ── Germany (16 States) ──
  R('DE-SH','Schleswig-Holstein','DE',0.35,0.92,['DE-HH','DE-NI','DE-MV'],40),
  R('DE-HH','Hamburg','DE',0.40,0.85,['DE-SH','DE-NI'],50),
  R('DE-MV','Mecklenburg','DE',0.65,0.90,['DE-SH','DE-NI','DE-BB'],35),
  R('DE-NI','Lower Saxony','DE',0.32,0.68,['DE-SH','DE-HH','DE-MV','DE-BB','DE-ST','DE-TH','DE-HE','DE-NW','DE-HB'],45),
  R('DE-HB','Bremen','DE',0.28,0.72,['DE-NI'],30),
  R('DE-BB','Brandenburg','DE',0.75,0.72,['DE-MV','DE-NI','DE-ST','DE-SN','DE-BE','RU-WR'],50),
  R('DE-BE','Berlin','DE',0.78,0.70,['DE-BB'],65),
  R('DE-ST','Saxony-Anhalt','DE',0.62,0.62,['DE-NI','DE-BB','DE-SN','DE-TH'],40),
  R('DE-NW','North Rhine-Westphalia','DE',0.18,0.55,['DE-NI','DE-HE','DE-RP','GB-LN'],55),
  R('DE-HE','Hesse','DE',0.38,0.48,['DE-NI','DE-TH','DE-NW','DE-RP','DE-BW','DE-BY'],50),
  R('DE-TH','Thuringia','DE',0.55,0.48,['DE-NI','DE-ST','DE-SN','DE-HE','DE-BY'],40),
  R('DE-SN','Saxony','DE',0.72,0.50,['DE-BB','DE-ST','DE-TH','DE-BY'],45),
  R('DE-RP','Rhineland-Palat','DE',0.20,0.35,['DE-NW','DE-HE','DE-BW','DE-SL'],45),
  R('DE-SL','Saarland','DE',0.12,0.28,['DE-RP'],30),
  R('DE-BW','Baden-Württemberg','DE',0.38,0.22,['DE-HE','DE-RP','DE-BY'],50),
  R('DE-BY','Bavaria','DE',0.62,0.22,['DE-HE','DE-TH','DE-SN','DE-BW'],55),

  // ── Japan (8 Regions) ──
  R('JP-HK','Hokkaido','JP',0.70,0.90,['JP-TH','RU-FE'],50),
  R('JP-TH','Tohoku','JP',0.62,0.72,['JP-HK','JP-KT'],45),
  R('JP-KT','Kanto','JP',0.58,0.58,['JP-TH','JP-CB','JP-KS'],70),
  R('JP-CB','Chubu','JP',0.48,0.52,['JP-KT','JP-KS'],50),
  R('JP-KS','Kansai','JP',0.40,0.42,['JP-KT','JP-CB','JP-CG'],55),
  R('JP-CG','Chugoku','JP',0.28,0.35,['JP-KS','JP-SK','JP-KY'],40),
  R('JP-SK','Shikoku','JP',0.32,0.28,['JP-CG','JP-KY'],35),
  R('JP-KY','Kyushu','JP',0.18,0.20,['JP-CG','JP-SK','CN-JS'],50),

  // ── United Kingdom (10 Regions) ──
  R('GB-SC','Scotland','GB',0.40,0.88,['GB-NE'],50),
  R('GB-NE','North England','GB',0.50,0.68,['GB-SC','GB-YH','GB-NW'],45),
  R('GB-NW','North West','GB',0.40,0.58,['GB-NE','GB-YH','GB-WM','GB-WA'],50),
  R('GB-YH','Yorkshire','GB',0.60,0.58,['GB-NE','GB-NW','GB-WM','GB-EM'],45),
  R('GB-WM','West Midlands','GB',0.48,0.42,['GB-NW','GB-YH','GB-EM','GB-SW','GB-WA'],50),
  R('GB-EM','East Midlands','GB',0.60,0.42,['GB-YH','GB-WM','GB-EN'],45),
  R('GB-EN','East England','GB',0.72,0.35,['GB-EM','GB-LN','DE-NW'],40),
  R('GB-LN','London & SE','GB',0.62,0.25,['GB-EN','GB-WM','GB-SW','DE-NW'],65),
  R('GB-SW','South West','GB',0.38,0.22,['GB-WM','GB-LN','GB-WA'],40),
  R('GB-WA','Wales','GB',0.28,0.38,['GB-NW','GB-WM','GB-SW'],40),

  // ── Brazil (15 States) ──
  R('BR-AM','Amazonas','BR',0.18,0.82,['BR-PA','BR-RO','BR-MT'],30),
  R('BR-PA','Para','BR',0.45,0.82,['BR-AM','BR-MA','BR-MT','BR-TO'],35),
  R('BR-MA','Maranhao','BR',0.60,0.80,['BR-PA','BR-PI','BR-TO'],35),
  R('BR-RO','Rondonia','BR',0.20,0.62,['BR-AM','BR-MT'],30),
  R('BR-MT','Mato Grosso','BR',0.35,0.55,['BR-AM','BR-PA','BR-RO','BR-TO','BR-GO','BR-MS'],40),
  R('BR-TO','Tocantins','BR',0.52,0.60,['BR-PA','BR-MA','BR-MT','BR-GO','BR-BA'],35),
  R('BR-PI','Piaui','BR',0.62,0.68,['BR-MA','BR-CE','BR-BA'],30),
  R('BR-CE','Ceara','BR',0.72,0.75,['BR-PI','BR-BA','NG-LG'],35),
  R('BR-BA','Bahia','BR',0.68,0.50,['BR-TO','BR-PI','BR-CE','BR-GO','BR-MG'],50),
  R('BR-GO','Goias','BR',0.50,0.42,['BR-MT','BR-TO','BR-BA','BR-MG','BR-MS'],40),
  R('BR-MS','Mato G. do Sul','BR',0.38,0.30,['BR-MT','BR-GO','BR-SP'],35),
  R('BR-MG','Minas Gerais','BR',0.62,0.35,['BR-BA','BR-GO','BR-SP','BR-RJ'],50),
  R('BR-SP','Sao Paulo','BR',0.52,0.20,['BR-MS','BR-GO','BR-MG','BR-RJ','BR-RS'],65),
  R('BR-RJ','Rio de Janeiro','BR',0.68,0.22,['BR-MG','BR-SP'],55),
  R('BR-RS','Rio Grande do Sul','BR',0.42,0.08,['BR-SP'],40),

  // ── India (16 States) ──
  R('IN-KA','Kashmir','IN',0.28,0.92,['IN-PB','IN-HP','CN-TB'],60),
  R('IN-PB','Punjab','IN',0.24,0.80,['IN-KA','IN-HP','IN-HR','IN-RJ'],50),
  R('IN-HP','Himachal Pradesh','IN',0.32,0.82,['IN-KA','IN-PB','IN-HR','IN-UP'],40),
  R('IN-HR','Haryana','IN',0.28,0.72,['IN-PB','IN-HP','IN-DL','IN-RJ','IN-UP'],45),
  R('IN-DL','Delhi','IN',0.32,0.70,['IN-HR','IN-UP'],65),
  R('IN-RJ','Rajasthan','IN',0.15,0.58,['IN-PB','IN-HR','IN-UP','IN-GJ','IN-MP'],45),
  R('IN-UP','Uttar Pradesh','IN',0.42,0.65,['IN-HP','IN-HR','IN-DL','IN-RJ','IN-MP','IN-WB','IN-BI'],55),
  R('IN-GJ','Gujarat','IN',0.08,0.45,['IN-RJ','IN-MP','IN-MH'],45),
  R('IN-MP','Madhya Pradesh','IN',0.35,0.48,['IN-RJ','IN-UP','IN-GJ','IN-MH','IN-OR'],50),
  R('IN-WB','West Bengal','IN',0.72,0.55,['IN-UP','IN-BI','IN-OR','IN-NE'],50),
  R('IN-BI','Bihar','IN',0.58,0.62,['IN-UP','IN-WB','IN-OR'],40),
  R('IN-NE','Northeast','IN',0.85,0.65,['IN-WB','CN-YN'],35),
  R('IN-MH','Maharashtra','IN',0.28,0.32,['IN-GJ','IN-MP','IN-KR','IN-TN'],55),
  R('IN-OR','Odisha','IN',0.58,0.40,['IN-MP','IN-WB','IN-BI','IN-TN'],40),
  R('IN-KR','Karnataka','IN',0.28,0.18,['IN-MH','IN-TN'],45),
  R('IN-TN','Tamil Nadu','IN',0.42,0.10,['IN-KR','IN-MH','IN-OR'],50),

  // ── Nigeria (7 Regions) ──
  R('NG-LG','Lagos','NG',0.12,0.30,['NG-SW','NG-SS','BR-CE'],55),
  R('NG-SW','Southwest','NG',0.25,0.45,['NG-LG','NG-NC','NG-SS'],45),
  R('NG-SS','South South','NG',0.35,0.20,['NG-LG','NG-SW','NG-SE'],45),
  R('NG-SE','Southeast','NG',0.55,0.30,['NG-SS','NG-NC'],40),
  R('NG-NC','North Central','NG',0.50,0.55,['NG-SW','NG-SE','NG-NE','NG-NW'],50),
  R('NG-NW','Northwest','NG',0.35,0.75,['NG-NC','NG-NE'],40),
  R('NG-NE','Northeast','NG',0.75,0.75,['NG-NC','NG-NW','TR-SE'],35),

  // ── Turkey (8 Regions) ──
  R('TR-IS','Istanbul','TR',0.15,0.75,['TR-MA','TR-BS','DE-BB'],65),
  R('TR-MA','Marmara','TR',0.22,0.60,['TR-IS','TR-AN','TR-AE'],50),
  R('TR-BS','Black Sea','TR',0.50,0.80,['TR-IS','TR-AN','TR-EA'],40),
  R('TR-AE','Aegean','TR',0.20,0.35,['TR-MA','TR-AN','TR-MD'],45),
  R('TR-AN','Ankara','TR',0.42,0.55,['TR-MA','TR-BS','TR-AE','TR-MD','TR-EA'],60),
  R('TR-MD','Mediterranean','TR',0.42,0.25,['TR-AE','TR-AN','TR-SE'],45),
  R('TR-EA','Eastern Anatolia','TR',0.75,0.55,['TR-BS','TR-AN','TR-SE','RU-CC'],45),
  R('TR-SE','Southeast','TR',0.75,0.25,['TR-MD','TR-EA','NG-NE'],40),

  // ── Mexico (11 States) ──
  R('MX-BC','Baja California','MX',0.05,0.88,['MX-SO','US-CA'],35),
  R('MX-SO','Sonora','MX',0.18,0.82,['MX-BC','MX-CH','US-AZ'],40),
  R('MX-CH','Chihuahua','MX',0.28,0.78,['MX-SO','MX-DU','MX-CO','US-NM','US-TX'],45),
  R('MX-CO','Coahuila','MX',0.40,0.72,['MX-CH','MX-DU','MX-NL','MX-TM','US-TX'],40),
  R('MX-NL','Nuevo Leon','MX',0.48,0.68,['MX-CO','MX-TM','MX-SL'],50),
  R('MX-TM','Tamaulipas','MX',0.55,0.68,['MX-CO','MX-NL','MX-SL','US-TX'],40),
  R('MX-DU','Durango','MX',0.30,0.58,['MX-CH','MX-CO','MX-SL','MX-JA'],35),
  R('MX-SL','San Luis Potosi','MX',0.45,0.48,['MX-NL','MX-TM','MX-DU','MX-JA','MX-MC'],40),
  R('MX-JA','Jalisco','MX',0.35,0.38,['MX-DU','MX-SL','MX-MC'],50),
  R('MX-MC','Mexico City','MX',0.50,0.30,['MX-SL','MX-JA','MX-YU','CU-HA'],65),
  R('MX-YU','Yucatan','MX',0.80,0.35,['MX-MC','CU-HA'],35),

  // ── Cuba (3 Regions) ──
  R('CU-HA','Havana','CU',0.25,0.55,['CU-CT','CU-SG','US-FL','MX-MC','MX-YU','BS-NP'],50),
  R('CU-CT','Central Cuba','CU',0.50,0.48,['CU-HA','CU-SG'],35),
  R('CU-SG','Santiago','CU',0.80,0.42,['CU-HA','CU-CT'],35),

  // ── Bahamas (2 Regions) ──
  R('BS-NP','Nassau','BS',0.40,0.45,['BS-GI','CU-HA','US-FL','OC-ATL-W'],25),
  R('BS-GI','Grand Island','BS',0.60,0.60,['BS-NP'],15),

  // ── Oceans (Strategic Naval Blocks) ──
  R('OC-ATL-W','West Atlantic','OC',0.20,0.50,['US-NY','US-MA','US-FL','CA-NS','BS-NP','OC-ATL-C'],0,true, 50, 100, 500),
  R('OC-ATL-C','Central Atlantic','OC',0.50,0.50,['OC-ATL-W','OC-ATL-E'],0,true, 100, 200, 1000),
  R('OC-ATL-E','East Atlantic','OC',0.80,0.50,['OC-ATL-C','GB-SW','GB-WA','FR-BRE','ES-GAL','PT-LIS'],0,true, 80, 150, 800),
  R('OC-PAC','Pacific Ocean','OC',4.231,0.50,['US-CA','US-OR','MX-BC','JP-KT','JP-HK','CN-JS','CN-GD','CA-BC'],0,true, 150, 250, 1500),
  R('OC-IND','Indian Ocean','OC',2.3077,-0.875,['IN-TN','IN-GJ','IN-WB','NG-SE'],0,true, 120, 300, 900),
  R('OC-MED','Mediterranean Sea','OC',1.323,0.4925,['TR-AE','TR-MD','TR-MA','DE-BY'],0,true, 60, 50, 1200),
]

// ====== COUNTRY BOUNDING BOXES ======
const COUNTRY_BOUNDS: Record<string, [number, number, number, number]> = {
  'US': [-125, 24, -66, 50], 'CA': [-141, 42, -52, 84],
  'RU': [27, 41, 180, 77], 'CN': [73, 18, 135, 54],
  'DE': [6, 47, 15, 55], 'JP': [129, 31, 146, 46],
  'GB': [-8, 50, 2, 59], 'BR': [-74, -34, -35, 6],
  'IN': [68, 7, 97, 36], 'NG': [3, 4, 15, 14],
  'TR': [26, 36, 45, 42], 'MX': [-118, 14, -87, 33],
  'CU': [-85, 19, -74, 23], 'BS': [-80, 22, -73, 28],
  'OC': [-75, 20, -10, 60] // North Atlantic approx bounds
}

function computeRegions(): Region[] {
  return REGION_DEFS.map(def => {
    const b = COUNTRY_BOUNDS[def.countryCode]
    const lng = b ? b[0] + def.offsetX * (b[2] - b[0]) : 0
    const lat = b ? b[1] + def.offsetY * (b[3] - b[1]) : 0
    return {
      id: def.id, name: def.name, countryCode: def.countryCode,
      controlledBy: def.countryCode, captureProgress: 0,
      attackedBy: null, assignedArmyId: null,
      position: [lng, lat] as [number, number],
      adjacent: def.adjacent, defense: def.defense,
      isOcean: def.isOcean,
      fishingBonus: def.fishingBonus || 0,
      oilYield: def.oilYield || 0,
      tradeRouteValue: def.tradeRouteValue || 0,
      isBlockaded: false,
      debris: { scrap: 0, materialX: 0, militaryBoxes: 0 },
      scavengeCount: 0,
      revoltPressure: 0,
      revoltCooldownUntil: 0,
      noDefenderTicks: 0,
      revoltBattleId: null,
      revoltTriggerType: null,
    }
  })
}

// ====== SCAVENGE MISSIONS ======

export interface ScavengeMission {
  id: string
  regionId: string
  playerId: string
  divisionIds: string[]
  startedAt: number
  endsAt: number
  waveIndex: number  // 0-3 (which share this mission gets)
}

// 4 scavenge waves: first-come-first-served
const SCAVENGE_SHARES = [0.61, 0.19, 0.15, 0.05]
const SCAVENGE_DURATION = 30 * 60 * 1000  // 30 minutes

// ====== NAVAL PATROL MISSIONS ======

export interface NavalPatrolMission {
  id: string
  regionId: string
  playerId: string
  divisionIds: string[]   // Naval divisions assigned (warship/submarine)
  startedAt: number
  active: boolean
}

// National fund income per patrol tick: OIL 324 ± 54, Money 635 ± 35
const PATROL_OIL_BASE = 324
const PATROL_OIL_VARIANCE = 54
const PATROL_MONEY_BASE = 635
const PATROL_MONEY_VARIANCE = 35

// ====== STORE ======
export interface RegionState {
  regions: Region[]
  scavengeMissions: ScavengeMission[]
  navalPatrols: NavalPatrolMission[]
  initialized: boolean
  getRegion: (id: string) => Region | undefined
  getCountryRegions: (cc: string) => Region[]
  getAttackableRegions: (playerIso: string, targetIso: string) => Region[]
  canAttackRegion: (regionId: string, playerIso: string) => boolean
  attackRegion: (regionId: string, attackerIso: string, armyId?: string) => void
  stopAttack: (regionId: string) => void
  tickCapture: () => void
  resetCountryRegions: (cc: string) => void
  updateBoundsFromGeoJSON: (geojson: any, isoKey?: string) => void
  processOceanIncome: () => void
  addDebris: (regionId: string, scrap: number, materialX: number, militaryBoxes: number) => void
  startScavenge: (regionId: string, divisionIds: string[]) => { success: boolean; message: string }
  processScavengeTick: () => void
  // Naval Patrol
  startNavalPatrol: (regionId: string) => { success: boolean; message: string }
  stopNavalPatrol: (regionId: string) => { success: boolean; message: string }
  getPlayerPatrol: (regionId: string) => NavalPatrolMission | undefined
  processNavalPatrolIncome: () => void
  // Revolt system
  processRevoltTick: () => void
  triggerRevolt: (regionId: string, triggerType: 'manual' | 'auto') => { success: boolean; message: string }
  liberateRegion: (regionId: string, mockMessage?: string) => void
  getHomelandBonus: (regionId: string) => { atkMult: number; dodgeMult: number; playerDmgMult: number }
}

const ISO3_TO_ISO2: Record<string, string> = {
  'USA':'US','CAN':'CA','RUS':'RU','CHN':'CN','DEU':'DE',
  'JPN':'JP','GBR':'GB','BRA':'BR','IND':'IN','NGA':'NG',
  'TUR':'TR','MEX':'MX','CUB':'CU','BHS':'BS','FRA':'FR',
  'ESP':'ES','ITA':'IT','POL':'PL','UKR':'UA','ROU':'RO',
  'NLD':'NL','BEL':'BE','SWE':'SE','NOR':'NO','FIN':'FI',
  'DNK':'DK','AUT':'AT','CHE':'CH','CZE':'CZ','PRT':'PT',
  'GRC':'GR','HUN':'HU','IRL':'IE','ISL':'IS','SRB':'RS',
  'BLR':'BY','BGR':'BG','SVK':'SK','HRV':'HR','LTU':'LT',
  'LVA':'LV','EST':'EE','SVN':'SI','BIH':'BA','ALB':'AL',
  'MKD':'MK','MNE':'ME','MDA':'MD','ARG':'AR','COL':'CO',
  'VEN':'VE','PER':'PE','CHL':'CL','ECU':'EC','BOL':'BO',
  'PRY':'PY','URY':'UY','GUY':'GY','SUR':'SR','GTM':'GT',
  'HND':'HN','SLV':'SV','NIC':'NI','CRI':'CR','PAN':'PA',
  'DOM':'DO','HTI':'HT','JAM':'JM','KOR':'KR','PRK':'KP',
  'TWN':'TW','THA':'TH','VNM':'VN','PHL':'PH','MYS':'MY',
  'IDN':'ID','MMR':'MM','BGD':'BD','PAK':'PK','AFG':'AF',
  'IRQ':'IQ','IRN':'IR','SAU':'SA','ARE':'AE','ISR':'IL',
  'SYR':'SY','JOR':'JO','LBN':'LB','YEM':'YE','OMN':'OM',
  'KWT':'KW','QAT':'QA','GEO':'GE','ARM':'AM','AZE':'AZ',
  'KAZ':'KZ','UZB':'UZ','TKM':'TM','KGZ':'KG','TJK':'TJ',
  'MNG':'MN','NPL':'NP','LKA':'LK','KHM':'KH','LAO':'LA',
  'ZAF':'ZA','EGY':'EG','KEN':'KE','ETH':'ET','TZA':'TZ',
  'GHA':'GH','CIV':'CI','CMR':'CM','AGO':'AO','MOZ':'MZ',
  'MDG':'MG','MAR':'MA','DZA':'DZ','TUN':'TN','LBY':'LY',
  'SDN':'SD','SSD':'SS','UGA':'UG','SEN':'SN','MLI':'ML',
  'BFA':'BF','NER':'NE','TCD':'TD','COD':'CD','COG':'CG',
  'CAF':'CF','GAB':'GA','GNQ':'GQ','MWI':'MW','ZMB':'ZM',
  'ZWE':'ZW','BWA':'BW','NAM':'NA','SOM':'SO','ERI':'ER',
  'MRT':'MR','AUS':'AU','NZL':'NZ','PNG':'PG',
}

export const useRegionStore = create<RegionState>((set, get) => ({
  regions: computeRegions(),
  scavengeMissions: [],
  navalPatrols: [],
  initialized: true,

  getRegion: (id) => get().regions.find(r => r.id === id),
  getCountryRegions: (cc) => get().regions.filter(r => r.countryCode === cc),

  getAttackableRegions: (playerIso, targetIso) => {
    const { regions } = get()
    const world = useWorldStore.getState()
    if (!world.canAttack(playerIso, targetIso)) return []
    
    const owned = new Set(regions.filter(r => r.controlledBy === playerIso).map(r => r.id))
    const ownsInTarget = regions.some(r => r.countryCode === targetIso && r.controlledBy === playerIso)
    
    return regions.filter(r => {
      if (r.countryCode !== targetIso || r.controlledBy !== targetIso) return false
      // Beachhead Landing: if you own 0 regions in the target country, ANY region is a valid beachhead
      if (!ownsInTarget) return true
      // Otherwise, you must expand via adjacency
      return r.adjacent.some(a => owned.has(a))
    })
  },

  canAttackRegion: (regionId, playerIso) => {
    const { regions } = get()
    const t = regions.find(r => r.id === regionId)
    if (!t || t.controlledBy === playerIso) return false
    const world = useWorldStore.getState()
    if (!world.canAttack(playerIso, t.countryCode)) return false
    
    const owned = new Set(regions.filter(r => r.controlledBy === playerIso).map(r => r.id))
    const ownsInTarget = regions.some(r => r.countryCode === t.countryCode && r.controlledBy === playerIso)
    
    if (!ownsInTarget) return true
    return t.adjacent.some(a => owned.has(a))
  },

  attackRegion: (regionId, attackerIso, armyId) => set(s => ({
    regions: s.regions.map(r => r.id === regionId ? { ...r, attackedBy: attackerIso, assignedArmyId: armyId || null, isBlockaded: r.isOcean ? true : r.isBlockaded } : r)
  })),

  stopAttack: (regionId) => set(s => ({
    regions: s.regions.map(r => r.id === regionId ? { ...r, attackedBy: null, captureProgress: 0, assignedArmyId: null, isBlockaded: r.isOcean ? false : r.isBlockaded } : r)
  })),

  tickCapture: () => {
    const armyState = useArmyStore.getState()
    const { regions } = get()
    const updated = regions.map(r => {
      if (!r.attackedBy || r.controlledBy === r.attackedBy) return r
      let totalAtk = 0, totalMp = 0, divIds: string[] = []
      if (r.assignedArmyId) {
        const army = armyState.armies[r.assignedArmyId]
        if (army) {
          const hasNaval = army.divisionIds.some(id => armyState.divisions[id]?.category === 'naval')
          if (r.isOcean && !hasNaval) {
             // Ocean blocks require naval divisions to capture
             return { ...r, attackedBy: null, captureProgress: 0, assignedArmyId: null }
          }
          if (!r.isOcean && hasNaval) {
             // Naval fleets cannot directly capture land without marines/infantry!
             // For now, if an army is PURELY naval, it can't capture land.
             const hasLand = army.divisionIds.some(id => armyState.divisions[id]?.category !== 'naval')
             if (!hasLand) {
                return { ...r, attackedBy: null, captureProgress: 0, assignedArmyId: null }
             }
          }

          divIds = army.divisionIds
          divIds.forEach(id => {
            const d = armyState.divisions[id]
            if (d && d.manpower > 0 && d.status !== 'destroyed') {
              const tmpl = DIVISION_TEMPLATES[d.type]
              totalAtk += Math.floor(tmpl.atkDmgMult * 100); totalMp += d.manpower
            }
          })
        }
      }
      if (totalMp <= 0) return { ...r, attackedBy: null, captureProgress: 0, assignedArmyId: null, isBlockaded: r.isOcean ? false : r.isBlockaded }
      const rate = Math.max(2, Math.min(20, (totalAtk / Math.max(1, r.defense * 10)) * 8))
      const prog = Math.min(100, r.captureProgress + rate)
      const dmg = Math.max(50, r.defense * 15)
      divIds.forEach(id => {
        const d = armyState.divisions[id]
        if (d && d.manpower > 0 && d.status !== 'destroyed') {
          const share = dmg / Math.max(1, divIds.length)
          useArmyStore.setState(s => ({ divisions: { ...s.divisions, [id]: {
            ...s.divisions[id], manpower: Math.max(0, d.manpower - share),
            status: d.manpower - share <= 0 ? 'destroyed' : 'in_combat',
          }}}))
        }
      })
      if (prog >= 100) return { ...r, controlledBy: r.attackedBy, captureProgress: 0, attackedBy: null, assignedArmyId: null, isBlockaded: false }
      return { ...r, captureProgress: prog }
    })
    set({ regions: updated })
  },

  resetCountryRegions: (cc) => set(s => ({
    regions: s.regions.map(r => r.countryCode === cc ? { ...r, controlledBy: cc, captureProgress: 0, attackedBy: null, assignedArmyId: null, isBlockaded: false } : r)
  })),

  updateBoundsFromGeoJSON: (geojson: any, isoKey = 'ISO3166-1-Alpha-3') => {
    const updated = new Map<string, [number, number, number, number]>()
    const featuresByCountry = new Map<string, any[]>()

    // ── Real centroid map: "CC:normalizedName" → [lng, lat] ──
    const centroidMap = new Map<string, [number, number]>()

    // Known name mismatches between REGION_DEFS and GeoJSON feature names
    const NAME_ALIASES: Record<string, string[]> = {
      // Brazil
      'Mato G. do Sul': ['Mato Grosso do Sul'],
      'Rondonia':       ['Rondônia'],
      'Piaui':          ['Piauí'],
      'Ceara':          ['Ceará'],
      'Goias':          ['Goiás'],
      'Para':           ['Pará'],
      'Maranhao':       ['Maranhão'],
      // India
      'Kashmir':        ['Jammu and Kashmir', 'Jammu & Kashmir'],
      // (Northeast alias merged below with Nigeria)
      // China
      'Inner Mongolia': ['Nei Mongol', 'Inner Mongolia Autonomous Region'],
      'Xinjiang':       ['Xinjiang Uyghur Autonomous Region'],
      'Tibet':          ['Xizang Autonomous Region', 'Tibet Autonomous Region'],
      'Jiangsu/Shanghai': ['Jiangsu', 'Shanghai'],
      'Mongolia Border':  ['Mongolia'],
      'Manchuria Coast':  ['Heilongjiang'],
      // Russia
      'Western Russia': ['Smolensk Oblast', 'Bryansk Oblast', 'Smolensk'],
      'Volga':          ['Tatarstan', 'Saratov Oblast', 'Saratov'],
      'Caucasus':       ['Krasnodar Krai', 'Krasnodar'],
      'Komi':           ['Komi Republic', 'Komi'],
      'Tyumen':         ["Tyumen' Oblast", 'Tyumen Oblast', 'Tyumen'],
      'Far East':       ['Khabarovsk Krai', 'Khabarovsk'],
      'Buryatia':       ['Buryatiya', 'Republic of Buryatia'],
      'Karelia':        ['Republic of Karelia'],
      'Arkhangelsk':    ["Arkhangel'sk Oblast", 'Arkhangelsk Oblast'],
      // Germany
      'Mecklenburg':    ['Mecklenburg-Vorpommern'],
      'Lower Saxony':   ['Niedersachsen'],
      'Brandenburg':    ['Brandenburg'],
      'Saxony-Anhalt':  ['Sachsen-Anhalt'],
      'North Rhine-Westphalia': ['Nordrhein-Westfalen'],
      'Thuringia':      ['Thüringen'],
      'Saxony':         ['Sachsen', 'Freistaat Sachsen'],
      'Rhineland-Palat':['Rheinland-Pfalz'],
      'Baden-Württemberg': ['Baden-Württemberg'],
      'Bavaria':        ['Bayern', 'Freistaat Bayern'],
      // UK
      'North England':  ['North East England', 'North East'],
      'East England':   ['East of England'],
      'London & SE':    ['Greater London', 'South East England'],
      'West Midlands':  ['West Midlands (region)', 'West Midlands'],
      'East Midlands':  ['East Midlands (region)', 'East Midlands'],
      'South West':     ['South West England'],
      // Turkey
      'Istanbul':       ['İstanbul', 'Istanbul Province'],
      'Marmara':        ['Bursa', 'Bursa Province'],
      'Black Sea':      ['Trabzon', 'Trabzon Province'],
      'Aegean':         ['İzmir', 'Izmir', 'Izmir Province'],
      'Mediterranean':  ['Antalya', 'Antalya Province'],
      'Eastern Anatolia': ['Erzurum', 'Erzurum Province'],
      // Turkey / Nigeria (shared key — list all aliases, centroid lookup is per-CC)
      'Southeast':      ['Gaziantep', 'Diyarbakır', 'Diyarbakir', 'Enugu State', 'Enugu'],
      // Nigeria
      'Lagos':          ['Lagos State'],
      'Southwest':      ['Oyo State', 'Oyo'],
      'South South':    ['Rivers State', 'Rivers'],
      'North Central':  ['Abuja Federal Capital Territory', 'FCT'],
      'Northwest':      ['Kano State', 'Kano'],
      // India / Nigeria (shared key)
      'Northeast':      ['Assam', 'Meghalaya', 'Arunachal Pradesh', 'Borno State', 'Borno'],
      // Mexico
      'Mexico City':    ['Ciudad de México', 'Distrito Federal', 'Federal District'],
      // Cuba
      'Havana':         ['La Habana', 'Ciudad de La Habana'],
      'Central Cuba':   ['Villa Clara'],
      'Santiago':       ['Santiago de Cuba'],
      // Bahamas
      'Nassau':         ['New Providence'],
      'Grand Island':   ['Grand Bahama', 'Freeport'],
    }

    const norm = (s: string) => s.toLowerCase().trim()

    for (const feat of geojson.features || []) {
      const iso3 = feat.properties?.[isoKey]
      const cc = ISO3_TO_ISO2[iso3]
      if (!cc) continue

      if (!featuresByCountry.has(cc)) featuresByCountry.set(cc, [])
      featuresByCountry.get(cc)!.push(feat)

      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
      let sumLng = 0, sumLat = 0, count = 0

      const walk = (coords: any) => {
        if (typeof coords[0] === 'number') {
          const [lng, lat] = coords
          if (cc === 'RU' && lng < 0) return
          if (cc === 'US' && (lng < -130 || lat > 50)) return
          if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
          sumLng += lng; sumLat += lat; count++
        } else coords.forEach(walk)
      }
      walk(feat.geometry.coordinates)

      if (minLng < maxLng && minLat < maxLat) {
        const existing = updated.get(cc)
        if (existing) {
          updated.set(cc, [
            Math.min(existing[0], minLng), Math.min(existing[1], minLat),
            Math.max(existing[2], maxLng), Math.max(existing[3], maxLat)
          ])
        } else {
          updated.set(cc, [minLng, minLat, maxLng, maxLat])
        }
        COUNTRY_BOUNDS[cc] = updated.get(cc)!
      }

      // Store centroid keyed by ALL available name variants
      if (count > 0) {
        const centroid: [number, number] = [sumLng / count, sumLat / count]
        const names = [
          feat.properties?.name,
          feat.properties?.['name:en'],
          feat.properties?.name_en,
        ].filter(Boolean) as string[]
        names.forEach(n => centroidMap.set(`${cc}:${norm(n)}`, centroid))
      }
    }

    // Helper: find real centroid for a region by name
    const getRealCentroid = (cc: string, name: string): [number, number] | null => {
      const direct = centroidMap.get(`${cc}:${norm(name)}`)
      if (direct) return direct
      for (const alias of (NAME_ALIASES[name] || [])) {
        const match = centroidMap.get(`${cc}:${norm(alias)}`)
        if (match) return match
      }
      return null
    }

    const { regions } = get()
    const defs = REGION_DEFS
    const hardcodedIso2s = new Set(defs.map(d => d.countryCode))
    const nextRegions: Region[] = []

    // 1. Recompute hardcoded regions — real centroid where available, offset fallback otherwise
    regions.forEach(r => {
      if (!hardcodedIso2s.has(r.countryCode)) return

      // Ocean blocks: keep their hardcoded positions (no GeoJSON feature to match)
      if (r.isOcean) { nextRegions.push(r); return }

      const realPos = getRealCentroid(r.countryCode, r.name)
      if (realPos) {
        nextRegions.push({ ...r, position: realPos })
        return
      }

      // Fallback: offset-based position from country bounding box
      const b = COUNTRY_BOUNDS[r.countryCode]
      const d = defs.find(x => x.id === r.id)
      if (b && d) {
        nextRegions.push({ ...r, position: [b[0] + d.offsetX * (b[2] - b[0]), b[1] + d.offsetY * (b[3] - b[1])] as [number, number] })
      } else {
        nextRegions.push(r)
      }
    })

    // 2. Generate missing regions procedurally (all non-hardcoded countries)
    const world = useWorldStore.getState()
    const allGeneratedIds = new Set<string>()

    world.countries.forEach(country => {
      const cc = country.code
      if (hardcodedIso2s.has(cc)) return // Skip hardcoded

      const feats = featuresByCountry.get(cc)
      if (!feats || feats.length === 0) return

      const countryGeneratedIds: string[] = []
      const generatedRegionObjs: Region[] = []

      feats.forEach(feat => {
        const stateName = feat.properties?.name || 'Unknown'
        const id = `${cc}-${stateName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}`
        if (allGeneratedIds.has(id)) return
        allGeneratedIds.add(id)
        countryGeneratedIds.push(id)

        let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
        const walk = (coords: any) => {
          if (typeof coords[0] === 'number') {
            const [lng, lat] = coords
            if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
            if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
          } else coords.forEach(walk)
        }
        walk(feat.geometry.coordinates)

        const cLng = minLng < maxLng ? (minLng + maxLng) / 2 : 0
        const cLat = minLat < maxLat ? (minLat + maxLat) / 2 : 0

        const defense = Math.max(15, Math.floor(country.military / 3))

        let controlledBy = cc
        if (country.empire && country.controller !== 'Player Alliance') {
          controlledBy = country.empire
        }

        generatedRegionObjs.push({
          id, name: stateName, countryCode: cc, controlledBy, captureProgress: 0,
          attackedBy: null, assignedArmyId: null, position: [cLng, cLat], adjacent: [], defense,
          isOcean: false, fishingBonus: 0, oilYield: 0, tradeRouteValue: 0, isBlockaded: false,
          debris: { scrap: 0, materialX: 0, militaryBoxes: 0 }, scavengeCount: 0,
          revoltPressure: 0, revoltCooldownUntil: 0, noDefenderTicks: 0,
          revoltBattleId: null, revoltTriggerType: null,
        })
      })

      // Full internal adjacency for procedurally generated regions
      generatedRegionObjs.forEach(r => {
        r.adjacent = countryGeneratedIds.filter(id => id !== r.id)
        nextRegions.push(r)
      })
    })

    set({ regions: nextRegions })
  },


  processOceanIncome: () => {
    const { regions } = get()
    const worldStore = useWorldStore.getState()
    
    const yieldsByCountry: Record<string, { money: number; oil: number }> = {}
    
    regions.forEach(r => {
      if (r.isOcean && !r.isBlockaded && r.controlledBy !== 'OC') {
        if (!yieldsByCountry[r.controlledBy]) yieldsByCountry[r.controlledBy] = { money: 0, oil: 0 }
        yieldsByCountry[r.controlledBy].money += r.tradeRouteValue || 0
        yieldsByCountry[r.controlledBy].oil += r.oilYield || 0
      }
    })
    
    Object.entries(yieldsByCountry).forEach(([cc, yields]) => {
      if (yields.money > 0) worldStore.addToFund(cc, 'money', yields.money)
      if (yields.oil > 0) worldStore.addToFund(cc, 'oil', yields.oil)
    })
  },

  // ====== DEBRIS & SCAVENGING ======

  addDebris: (regionId, scrap, materialX, militaryBoxes) => set(s => ({
    regions: s.regions.map(r => r.id === regionId ? {
      ...r,
      debris: {
        scrap: r.debris.scrap + scrap,
        materialX: r.debris.materialX + materialX,
        militaryBoxes: r.debris.militaryBoxes + militaryBoxes,
      },
      scavengeCount: 0,  // Reset scavenge count when new debris is added
    } : r)
  })),

  startScavenge: (regionId, divisionIds) => {
    const state = get()
    const region = state.regions.find(r => r.id === regionId)
    if (!region) return { success: false, message: 'Region not found.' }
    if (region.debris.scrap <= 0 && region.debris.materialX <= 0 && region.debris.militaryBoxes <= 0) {
      return { success: false, message: 'No debris to scavenge.' }
    }
    if (region.scavengeCount >= 4) return { success: false, message: 'Debris fully scavenged.' }
    if (divisionIds.length === 0) return { success: false, message: 'Select at least one division.' }

    // Validate: only Recon and Jeep
    const armyStore = useArmyStore.getState()
    const player = usePlayerStore.getState()
    for (const id of divisionIds) {
      const div = armyStore.divisions[id]
      if (!div) return { success: false, message: `Division ${id} not found.` }
      if (div.ownerId !== player.name) return { success: false, message: 'Not your division.' }
      if (div.type !== 'recon' && div.type !== 'jeep') return { success: false, message: 'Only Recon and Jeep can scavenge.' }
      if (div.status !== 'ready') return { success: false, message: `${div.name} is not ready.` }
    }

    // Check if this player already has a mission on this region
    const existing = state.scavengeMissions.find(m => m.regionId === regionId && m.playerId === player.name)
    if (existing) return { success: false, message: 'Already scavenging this region.' }

    const waveIndex = region.scavengeCount
    const now = Date.now()

    // Set divisions to scavenging status
    divisionIds.forEach(id => {
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'scavenging' } }
      }))
    })

    // Increment scavenge count on region
    set(s => ({
      regions: s.regions.map(r => r.id === regionId ? { ...r, scavengeCount: r.scavengeCount + 1 } : r),
      scavengeMissions: [...s.scavengeMissions, {
        id: `scav_${now}`,
        regionId,
        playerId: player.name,
        divisionIds,
        startedAt: now,
        endsAt: now + SCAVENGE_DURATION,
        waveIndex,
      }],
    }))

    const share = SCAVENGE_SHARES[waveIndex]
    return { success: true, message: `Scavenging! Wave ${waveIndex + 1}/4 (${Math.round(share * 100)}% share). Returns in 30 min.` }
  },

  processScavengeTick: () => {
    const state = get()
    const now = Date.now()
    const completed: ScavengeMission[] = []
    const remaining: ScavengeMission[] = []

    state.scavengeMissions.forEach(m => {
      if (now >= m.endsAt) completed.push(m)
      else remaining.push(m)
    })

    if (completed.length === 0) return

    completed.forEach(m => {
      const region = state.regions.find(r => r.id === m.regionId)
      if (!region) return

      const share = SCAVENGE_SHARES[m.waveIndex] || 0
      const scrapGained = Math.floor(region.debris.scrap * share)
      const matXGained = Math.floor(region.debris.materialX * share)
      const boxGained = Math.floor(region.debris.militaryBoxes * share)

      // Award resources to player if they're the mission owner
      const player = usePlayerStore.getState()
      if (player.name === m.playerId) {
        usePlayerStore.setState(s => ({
          scrap: s.scrap + scrapGained,
          materialX: s.materialX + matXGained,
          militaryBoxes: s.militaryBoxes + boxGained,
        }))
        // 10% chance to drop 1 Badge of Honor on scavenge completion
        if (Math.random() < 0.10) {
          player.addResource('badgesOfHonor', 1, 'scavenge_bonus')
        }
      }

      // Return divisions to ready
      m.divisionIds.forEach(id => {
        useArmyStore.setState(s => {
          const div = s.divisions[id]
          if (!div || div.status !== 'scavenging') return s
          return { divisions: { ...s.divisions, [id]: { ...div, status: 'ready' } } }
        })
      })
    })

    set({ scavengeMissions: remaining })
  },

  // ====== NAVAL PATROL ======

  startNavalPatrol: (regionId) => {
    const state = get()
    const region = state.regions.find(r => r.id === regionId)
    if (!region) return { success: false, message: 'Region not found.' }
    if (!region.isOcean) return { success: false, message: 'Can only patrol ocean regions.' }

    const player = usePlayerStore.getState()
    const armyStore = useArmyStore.getState()

    // Check if already patrolling this region
    const existing = state.navalPatrols.find(p => p.regionId === regionId && p.playerId === player.name && p.active)
    if (existing) return { success: false, message: 'Already patrolling this region.' }

    // Find ready naval divisions owned by the player
    const navalDivs = (Object.values(armyStore.divisions) as Division[]).filter(
      d => d.ownerId === player.name && d.category === 'naval' && d.status === 'ready' && d.manpower > 0
    )
    if (navalDivs.length === 0) return { success: false, message: 'No ready naval divisions available. Recruit warships or submarines first.' }

    const divisionIds = navalDivs.map(d => d.id)

    // Set divisions to patrolling status
    divisionIds.forEach(id => {
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'patrolling' } }
      }))
    })

    const now = Date.now()
    set(s => ({
      navalPatrols: [...s.navalPatrols, {
        id: `patrol_${now}`,
        regionId,
        playerId: player.name,
        divisionIds,
        startedAt: now,
        active: true,
      }],
    }))

    return { success: true, message: `⚓ ${divisionIds.length} naval division(s) deployed to patrol ${region.name}! Farming OIL + FISH.` }
  },

  stopNavalPatrol: (regionId) => {
    const state = get()
    const player = usePlayerStore.getState()
    const patrol = state.navalPatrols.find(p => p.regionId === regionId && p.playerId === player.name && p.active)
    if (!patrol) return { success: false, message: 'No active patrol on this region.' }

    // Return divisions to ready
    patrol.divisionIds.forEach(id => {
      useArmyStore.setState(s => {
        const div = s.divisions[id]
        if (!div || div.status !== 'patrolling') return s
        return { divisions: { ...s.divisions, [id]: { ...div, status: 'ready' } } }
      })
    })

    set(s => ({
      navalPatrols: s.navalPatrols.map(p =>
        p.id === patrol.id ? { ...p, active: false } : p
      ),
    }))

    return { success: true, message: 'Naval patrol recalled. Divisions returning to ready.' }
  },

  getPlayerPatrol: (regionId) => {
    const state = get()
    const player = usePlayerStore.getState()
    return state.navalPatrols.find(p => p.regionId === regionId && p.playerId === player.name && p.active)
  },

  processNavalPatrolIncome: () => {
    const state = get()
    const worldStore = useWorldStore.getState()
    const player = usePlayerStore.getState()

    state.navalPatrols.forEach(patrol => {
      if (!patrol.active) return
      const region = state.regions.find(r => r.id === patrol.regionId)
      if (!region || !region.isOcean) return

      // Verify divisions are still alive
      const armyStore = useArmyStore.getState()
      const aliveDivs = patrol.divisionIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status === 'patrolling' && d.manpower > 0
      })
      if (aliveDivs.length === 0) {
        // Auto-stop patrol if no divisions left
        set(s => ({
          navalPatrols: s.navalPatrols.map(p =>
            p.id === patrol.id ? { ...p, active: false } : p
          ),
        }))
        return
      }

      // ── Player-level income: OIL + FISH from region yields ──
      if (patrol.playerId === player.name) {
        const oilGain = region.oilYield || 0
        const fishGain = region.fishingBonus || 0
        if (oilGain > 0 || fishGain > 0) {
          usePlayerStore.setState(s => ({
            oil: s.oil + oilGain,
            fish: s.fish + fishGain,
          }))
        }
      }

      // ── National fund income: OIL 324±54, Money 635±35 ──
      const vary = (base: number, v: number) => base + Math.floor((Math.random() * 2 - 1) * v)
      const fundOil = vary(PATROL_OIL_BASE, PATROL_OIL_VARIANCE)
      const fundMoney = vary(PATROL_MONEY_BASE, PATROL_MONEY_VARIANCE)

      // Add to the controlling country's fund (player's country)
      const cc = player.countryCode
      if (fundOil > 0) worldStore.addToFund(cc, 'oil', fundOil)
      if (fundMoney > 0) worldStore.addToFund(cc, 'money', fundMoney)
    })
  },

  // ====== REVOLT SYSTEM ======

  getHomelandBonus: (regionId) => {
    const region = get().regions.find(r => r.id === regionId)
    if (!region) return { atkMult: 1, dodgeMult: 1, playerDmgMult: 1 }
    const pct = Math.min(100, Math.max(0, region.revoltPressure)) / 100
    return {
      atkMult: 1 + pct * 0.20,        // 0% → +0%, 100% → +20%
      dodgeMult: 1 + pct * 0.15,       // 0% → +0%, 100% → +15%
      playerDmgMult: 1 + pct * 0.30,   // 0% → +0%, 100% → +30%
    }
  },

  processRevoltTick: () => {
    const state = get()
    const now = Date.now()
    const updated = state.regions.map(r => {
      // Only occupied (non-ocean) regions accumulate pressure
      if (r.controlledBy === r.countryCode || r.isOcean) return r

      // Skip if an active revolt battle is already running
      if (r.revoltBattleId) {
        // Track no-defender ticks for auto-liberation
        try {
          const { useBattleStore } = require('./battleStore')
          const battle = useBattleStore.getState().battles[r.revoltBattleId]
          if (battle && battle.status === 'active') {
            const defenderDivs = battle.defender.engagedDivisionIds.length
            const newNoDefTicks = defenderDivs === 0 ? r.noDefenderTicks + 1 : 0
            if (newNoDefTicks >= 300) {
              // Auto-liberation! Occupier had 0 defenders for 300 straight ticks
              setTimeout(() => {
                const regionStore = useRegionStore.getState()
                const countryName = getCountryName(r.countryCode)
                const occupierName = getCountryName(r.controlledBy)
                regionStore.liberateRegion(
                  r.id,
                  `🔥🏳️ ${r.name} has been LIBERATED! ${occupierName} fled like cowards — 300 ticks with ZERO defenders! ${countryName} reclaims their homeland!`
                )
              }, 0)
              return r
            }
            return { ...r, noDefenderTicks: newNoDefTicks }
          }
          // Battle ended — check result
          if (battle && battle.status !== 'active') {
            if (battle.status === 'attacker_won') {
              // Revolt succeeded! Liberation handled by battleStore on victory
              return { ...r, revoltBattleId: null, revoltTriggerType: null, revoltPressure: 0, noDefenderTicks: 0 }
            } else {
              // Revolt failed — reduce pressure based on trigger type
              const retention = r.revoltTriggerType === 'manual' ? 0.50 : 0.67
              return {
                ...r,
                revoltBattleId: null,
                revoltTriggerType: null,
                revoltPressure: Math.floor(r.revoltPressure * retention),
                noDefenderTicks: 0,
              }
            }
          }
        } catch (e) { /* battleStore not yet loaded */ }
        return r
      }

      // Cooldown check
      if (r.revoltCooldownUntil > now) return r

      // Calculate solidarity: how many OTHER regions of the same country are also occupied?
      const siblingOccupied = state.regions.filter(
        sr => sr.id !== r.id && sr.countryCode === r.countryCode && sr.controlledBy !== sr.countryCode && !sr.isOcean
      ).length

      // Pressure increment: base 2 + 0.5 per sibling occupied region
      const pressureRate = 2 + siblingOccupied * 0.5
      const newPressure = Math.min(100, r.revoltPressure + pressureRate)

      // Auto-trigger check at 100%: 2.5% chance per tick (every 30s)
      if (newPressure >= 100) {
        if (Math.random() < 0.025) {
          // Auto-trigger revolt!
          setTimeout(() => {
            useRegionStore.getState().triggerRevolt(r.id, 'auto')
          }, 0)
        }
      }

      return { ...r, revoltPressure: newPressure }
    })

    set({ regions: updated })
  },

  triggerRevolt: (regionId, triggerType) => {
    const state = get()
    const region = state.regions.find(r => r.id === regionId)
    if (!region) return { success: false, message: 'Region not found.' }
    if (region.controlledBy === region.countryCode) return { success: false, message: 'Region is not occupied.' }
    if (region.revoltBattleId) return { success: false, message: 'A revolt battle is already active in this region.' }

    // Launch a revolt battle: the native country attacks the occupier
    try {
      const { useBattleStore } = require('./battleStore')
      const battleStore = useBattleStore.getState()

      // The native country is the attacker (trying to reclaim)
      // The current controller (occupier) is the defender
      battleStore.launchAttack(
        region.countryCode,     // attacker = native country
        region.controlledBy,    // defender = occupier
        region.name,
        'revolt' as any,
        region.id
      )

      // Find the battle ID
      const battles = useBattleStore.getState().battles
      const battleId = Object.keys(battles).find(id =>
        battles[id].regionName === region.name &&
        battles[id].status === 'active' &&
        battles[id].type === 'revolt'
      ) || null

      // Update region state
      set(s => ({
        regions: s.regions.map(r => r.id === regionId ? {
          ...r,
          revoltBattleId: battleId,
          revoltTriggerType: triggerType,
          noDefenderTicks: 0,
        } : r)
      }))

      // Push news event
      try {
        const { useNewsStore } = require('./newsStore')
        const countryName = getCountryName(region.countryCode)
        const occupierName = getCountryName(region.controlledBy)
        const icon = triggerType === 'manual' ? '⚔️🔥' : '🔥💥'
        useNewsStore.getState().pushEvent(
          'war',
          `${icon} REVOLT in ${region.name}! ${countryName} rises against ${occupierName} occupation! (${Math.round(region.revoltPressure)}% Homeland Bonus)`
        )
      } catch (e) { /* newsStore not loaded */ }

      return { success: true, message: `🔥 Revolt triggered in ${region.name}! Battle has begun!` }
    } catch (e) {
      return { success: false, message: 'Failed to launch revolt battle.' }
    }
  },

  liberateRegion: (regionId, mockMessage) => {
    const state = get()
    const region = state.regions.find(r => r.id === regionId)
    if (!region) return

    const prevController = region.controlledBy

    // Flip region control back to native country
    set(s => ({
      regions: s.regions.map(r => r.id === regionId ? {
        ...r,
        controlledBy: r.countryCode,
        revoltPressure: 0,
        revoltBattleId: null,
        revoltTriggerType: null,
        noDefenderTicks: 0,
        revoltCooldownUntil: 0,
        captureProgress: 0,
        attackedBy: null,
        assignedArmyId: null,
      } : r)
    }))

    // End any active occupation
    try {
      const { useOccupationStore } = require('./occupationStore')
      const occStore = useOccupationStore.getState()
      const occupation = Object.values(occStore.occupations).find(
        (o: any) => o.occupiedRegion === region.name && o.occupierId === prevController
      )
      if (occupation) {
        occStore.endOccupation((occupation as any).id)
      }
    } catch (e) { /* occupationStore not loaded */ }

    // End the revolt battle if still active
    if (region.revoltBattleId) {
      try {
        const { useBattleStore } = require('./battleStore')
        const battle = useBattleStore.getState().battles[region.revoltBattleId]
        if (battle && battle.status === 'active') {
          useBattleStore.setState((s: any) => ({
            battles: {
              ...s.battles,
              [region.revoltBattleId!]: { ...battle, status: 'attacker_won' }
            }
          }))
        }
      } catch (e) { /* */ }
    }

    // Push news announcement
    try {
      const { useNewsStore } = require('./newsStore')
      if (mockMessage) {
        useNewsStore.getState().pushEvent('war', mockMessage)
      } else {
        const countryName = getCountryName(region.countryCode)
        useNewsStore.getState().pushEvent(
          'war',
          `🔥🏆 ${region.name} has been LIBERATED! ${countryName} reclaims their homeland!`
        )
      }
    } catch (e) { /* newsStore not loaded */ }
  },
}))
