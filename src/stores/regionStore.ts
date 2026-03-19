import { create } from 'zustand'
import { useWorldStore } from './worldStore'
import { useArmyStore, DIVISION_TEMPLATES } from './army'

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
}

// ====== NAMED REGION DEFINITIONS ======

interface RegionDef {
  id: string; name: string; countryCode: string
  offsetX: number; offsetY: number
  adjacent: string[]; defense: number
}

const R = (id: string, name: string, cc: string, ox: number, oy: number, adj: string[], def: number): RegionDef =>
  ({ id, name, countryCode: cc, offsetX: ox, offsetY: oy, adjacent: adj, defense: def })

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
  R('BS-NP','Nassau','BS',0.40,0.45,['BS-GI','CU-HA','US-FL'],25),
  R('BS-GI','Grand Island','BS',0.60,0.60,['BS-NP'],15),
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
    }
  })
}

// ====== STORE ======
export interface RegionState {
  regions: Region[]
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
    regions: s.regions.map(r => r.id === regionId ? { ...r, attackedBy: attackerIso, assignedArmyId: armyId || null } : r)
  })),

  stopAttack: (regionId) => set(s => ({
    regions: s.regions.map(r => r.id === regionId ? { ...r, attackedBy: null, captureProgress: 0, assignedArmyId: null } : r)
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
      if (totalMp <= 0) return { ...r, attackedBy: null, captureProgress: 0, assignedArmyId: null }
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
      if (prog >= 100) return { ...r, controlledBy: r.attackedBy, captureProgress: 0, attackedBy: null, assignedArmyId: null }
      return { ...r, captureProgress: prog }
    })
    set({ regions: updated })
  },

  resetCountryRegions: (cc) => set(s => ({
    regions: s.regions.map(r => r.countryCode === cc ? { ...r, controlledBy: cc, captureProgress: 0, attackedBy: null, assignedArmyId: null } : r)
  })),

  updateBoundsFromGeoJSON: (geojson: any, isoKey = 'ISO3166-1-Alpha-3') => {
    const updated = new Map<string, [number, number, number, number]>()
    const featuresByCountry = new Map<string, any[]>()
    
    for (const feat of geojson.features || []) {
      const iso3 = feat.properties?.[isoKey]
      const cc = ISO3_TO_ISO2[iso3]
      if (!cc) continue
      
      if (!featuresByCountry.has(cc)) featuresByCountry.set(cc, [])
      featuresByCountry.get(cc)!.push(feat)
      
      let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
      const walk = (coords: any) => {
        if (typeof coords[0] === 'number') {
          const [lng, lat] = coords
          if (cc === 'RU' && lng < 0) return
          if (cc === 'US' && (lng < -130 || lat > 50)) return
          if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
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
    }
    
    const { regions } = get()
    const defs = REGION_DEFS
    const hardcodedIso2s = new Set(defs.map(d => d.countryCode))
    const nextRegions: Region[] = []
    
    // 1. Recompute hardcoded regions
    regions.forEach(r => {
      if (hardcodedIso2s.has(r.countryCode)) {
        const b = COUNTRY_BOUNDS[r.countryCode]
        const d = defs.find(x => x.id === r.id)
        if (b && d) {
          nextRegions.push({ ...r, position: [b[0] + d.offsetX * (b[2] - b[0]), b[1] + d.offsetY * (b[3] - b[1])] as [number, number] })
        } else {
          nextRegions.push(r)
        }
      }
    })
    
    // 2. Generate missing regions procedurally
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
          attackedBy: null, assignedArmyId: null, position: [cLng, cLat], adjacent: [], defense
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
}))
