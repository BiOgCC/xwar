/**
 * Seed script — populates countries, governments, deposits, and country stocks.
 * Run with: npm run db:seed
 */
import 'dotenv/config'
import { db } from './connection.js'
import { countries, governments, regionalDeposits, countryStocks } from './schema.js'

interface CountrySeed {
  code: string; name: string; controller: string; empire: string | null
  population: number; regions: number; military: number; fundTier: string; color: string
  conqueredResources: string[]
}

type FundTier = 'large' | 'medium' | 'small' | 'tiny'

const FUND_TIERS: Record<FundTier, object> = {
  large:  { money: 50_000_000, oil: 5_000_000, scraps: 5_000_000, materialX: 5_000_000, bitcoin: 50_000, jets: 100 },
  medium: { money: 20_000_000, oil: 2_000_000, scraps: 2_000_000, materialX: 2_000_000, bitcoin: 20_000, jets: 40 },
  small:  { money: 5_000_000,  oil: 500_000,  scraps: 500_000,  materialX: 500_000,  bitcoin: 5_000,  jets: 10 },
  tiny:   { money: 1_000_000,  oil: 100_000,  scraps: 100_000,  materialX: 100_000,  bitcoin: 1_000,  jets: 2 },
}

const COUNTRIES: CountrySeed[] = [
  // ── North America ──
  { code:'US', name:'United States',       controller:'Player Alliance',    empire:'NATO',         population:32000, regions:12, military:95, fundTier:'large',  color:'#4f8ef7', conqueredResources:['Iron','Titanium'] },
  { code:'CA', name:'Canada',              controller:'Northern Guard',     empire:'NATO',         population:12000, regions:8,  military:45, fundTier:'medium', color:'#74b9ff', conqueredResources:['Uranium'] },
  { code:'MX', name:'Mexico',              controller:'Cartel Coalition',   empire:null,           population:18000, regions:6,  military:40, fundTier:'medium', color:'#fd9644', conqueredResources:['Iron'] },
  { code:'CU', name:'Cuba',                controller:'Caribbean Command',  empire:'Eastern Bloc', population:6000,  regions:2,  military:35, fundTier:'small',  color:'#b71540', conqueredResources:['Saltpeter'] },
  { code:'BS', name:'Bahamas',             controller:'Island Syndicate',   empire:null,           population:2000,  regions:1,  military:15, fundTier:'tiny',   color:'#0abde3', conqueredResources:[] },
  { code:'JM', name:'Jamaica',             controller:'Island Syndicate',   empire:null,           population:2500,  regions:1,  military:12, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'HT', name:'Haiti',               controller:'Caribbean Command',  empire:null,           population:8000,  regions:1,  military:10, fundTier:'tiny',   color:'#e17055', conqueredResources:[] },
  { code:'DO', name:'Dominican Republic',  controller:'Caribbean Command',  empire:null,           population:7000,  regions:1,  military:18, fundTier:'tiny',   color:'#0984e3', conqueredResources:[] },
  { code:'PR', name:'Puerto Rico',         controller:'Player Alliance',    empire:'NATO',         population:3000,  regions:1,  military:10, fundTier:'tiny',   color:'#6c5ce7', conqueredResources:[] },
  { code:'TT', name:'Trinidad & Tobago',   controller:'Caribbean Command',  empire:null,           population:1500,  regions:1,  military:14, fundTier:'tiny',   color:'#e84393', conqueredResources:['Iron'] },
  { code:'GT', name:'Guatemala',           controller:'Central Forces',     empire:null,           population:8000,  regions:2,  military:20, fundTier:'tiny',   color:'#00b894', conqueredResources:[] },
  { code:'BZ', name:'Belize',              controller:'Central Forces',     empire:null,           population:600,   regions:1,  military:8,  fundTier:'tiny',   color:'#2980b9', conqueredResources:[] },
  { code:'HN', name:'Honduras',            controller:'Central Forces',     empire:null,           population:7000,  regions:2,  military:18, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'SV', name:'El Salvador',         controller:'Central Forces',     empire:null,           population:5000,  regions:1,  military:16, fundTier:'tiny',   color:'#1abc9c', conqueredResources:[] },
  { code:'NI', name:'Nicaragua',           controller:'Central Forces',     empire:'Eastern Bloc', population:5000,  regions:2,  military:15, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'CR', name:'Costa Rica',          controller:'Central Forces',     empire:null,           population:4000,  regions:1,  military:5,  fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'PA', name:'Panama',              controller:'Canal Authority',    empire:null,           population:3500,  regions:1,  military:12, fundTier:'small',  color:'#f39c12', conqueredResources:[] },

  // ── South America ──
  { code:'BR', name:'Brazil',              controller:'Amazonia',           empire:null,           population:22000, regions:8,  military:55, fundTier:'medium', color:'#27ae60', conqueredResources:['Rubber'] },
  { code:'AR', name:'Argentina',           controller:'Pampas Regiment',    empire:null,           population:14000, regions:6,  military:50, fundTier:'medium', color:'#74b9ff', conqueredResources:['Iron'] },
  { code:'CO', name:'Colombia',            controller:'Andean Command',     empire:null,           population:18000, regions:5,  military:45, fundTier:'medium', color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'VE', name:'Venezuela',           controller:'Bolivarian Guard',   empire:'Eastern Bloc', population:12000, regions:4,  military:40, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'PE', name:'Peru',                controller:'Andean Command',     empire:null,           population:18000, regions:5,  military:42, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron','Uranium'] },
  { code:'CL', name:'Chile',               controller:'Pacific Command',    empire:null,           population:10000, regions:4,  military:48, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'EC', name:'Ecuador',             controller:'Andean Command',     empire:null,           population:11000, regions:3,  military:30, fundTier:'small',  color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'BO', name:'Bolivia',             controller:'Andean Command',     empire:null,           population:8000,  regions:3,  military:28, fundTier:'small',  color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'PY', name:'Paraguay',            controller:'Pampas Regiment',    empire:null,           population:6000,  regions:2,  military:22, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'UY', name:'Uruguay',             controller:'Pampas Regiment',    empire:null,           population:3500,  regions:2,  military:20, fundTier:'tiny',   color:'#74b9ff', conqueredResources:[] },
  { code:'GY', name:'Guyana',              controller:'Amazonia',           empire:null,           population:2000,  regions:1,  military:10, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'SR', name:'Suriname',            controller:'Amazonia',           empire:null,           population:700,   regions:1,  military:8,  fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },

  // ── Europe ──
  { code:'RU', name:'Russia',              controller:'Red Army',           empire:'Eastern Bloc', population:28000, regions:18, military:88, fundTier:'large',  color:'#c0392b', conqueredResources:['Saltpeter','Iron'] },
  { code:'DE', name:'Germany',             controller:'Euro Corps',         empire:'NATO',         population:18000, regions:4,  military:65, fundTier:'large',  color:'#f39c12', conqueredResources:['Titanium'] },
  { code:'FR', name:'France',              controller:'French Republic',    empire:'NATO',         population:16000, regions:4,  military:70, fundTier:'large',  color:'#2980b9', conqueredResources:['Titanium'] },
  { code:'GB', name:'United Kingdom',      controller:'Crown Forces',       empire:'NATO',         population:16000, regions:3,  military:68, fundTier:'large',  color:'#8e44ad', conqueredResources:['Saltpeter'] },
  { code:'IT', name:'Italy',               controller:'Italian Legion',     empire:'NATO',         population:14000, regions:4,  military:58, fundTier:'medium', color:'#1abc9c', conqueredResources:['Saltpeter'] },
  { code:'ES', name:'Spain',               controller:'Iberian Guard',      empire:'NATO',         population:12000, regions:4,  military:52, fundTier:'medium', color:'#d4ac0d', conqueredResources:['Iron'] },
  { code:'PL', name:'Poland',              controller:'Polish Hussars',     empire:'NATO',         population:10000, regions:4,  military:55, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'UA', name:'Ukraine',             controller:'Free Ukraine',       empire:null,           population:11000, regions:5,  military:60, fundTier:'medium', color:'#3498db', conqueredResources:['Saltpeter'] },
  { code:'NL', name:'Netherlands',         controller:'Euro Corps',         empire:'NATO',         population:8000,  regions:2,  military:50, fundTier:'medium', color:'#f39c12', conqueredResources:[] },
  { code:'BE', name:'Belgium',             controller:'Euro Corps',         empire:'NATO',         population:7000,  regions:2,  military:45, fundTier:'medium', color:'#f39c12', conqueredResources:[] },
  { code:'SE', name:'Sweden',              controller:'Nordic Command',     empire:'NATO',         population:8000,  regions:3,  military:52, fundTier:'medium', color:'#3498db', conqueredResources:['Iron'] },
  { code:'NO', name:'Norway',              controller:'Nordic Command',     empire:'NATO',         population:5000,  regions:2,  military:48, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'FI', name:'Finland',             controller:'Nordic Command',     empire:'NATO',         population:5000,  regions:3,  military:50, fundTier:'medium', color:'#4f8ef7', conqueredResources:['Iron'] },
  { code:'DK', name:'Denmark',             controller:'Nordic Command',     empire:'NATO',         population:4000,  regions:1,  military:42, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'CH', name:'Switzerland',         controller:'Alpine Guard',       empire:null,           population:6000,  regions:2,  military:40, fundTier:'medium', color:'#e74c3c', conqueredResources:[] },
  { code:'AT', name:'Austria',             controller:'Alpine Guard',       empire:'NATO',         population:6000,  regions:2,  military:42, fundTier:'medium', color:'#e74c3c', conqueredResources:[] },
  { code:'PT', name:'Portugal',            controller:'Iberian Guard',      empire:'NATO',         population:7000,  regions:2,  military:40, fundTier:'small',  color:'#27ae60', conqueredResources:[] },
  { code:'GR', name:'Greece',              controller:'Hellenic Forces',    empire:'NATO',         population:9000,  regions:3,  military:45, fundTier:'small',  color:'#3498db', conqueredResources:[] },
  { code:'CZ', name:'Czech Republic',      controller:'Euro Corps',         empire:'NATO',         population:7000,  regions:2,  military:40, fundTier:'small',  color:'#3498db', conqueredResources:[] },
  { code:'SK', name:'Slovakia',            controller:'Euro Corps',         empire:'NATO',         population:4000,  regions:2,  military:32, fundTier:'small',  color:'#3498db', conqueredResources:[] },
  { code:'HU', name:'Hungary',             controller:'Euro Corps',         empire:null,           population:7000,  regions:2,  military:38, fundTier:'small',  color:'#27ae60', conqueredResources:[] },
  { code:'RO', name:'Romania',             controller:'Black Sea Guard',    empire:'NATO',         population:12000, regions:3,  military:45, fundTier:'small',  color:'#27ae60', conqueredResources:['Iron'] },
  { code:'BG', name:'Bulgaria',            controller:'Black Sea Guard',    empire:'NATO',         population:6000,  regions:2,  military:38, fundTier:'small',  color:'#27ae60', conqueredResources:[] },
  { code:'RS', name:'Serbia',              controller:'Balkan Command',     empire:null,           population:6000,  regions:2,  military:40, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'HR', name:'Croatia',             controller:'Balkan Command',     empire:'NATO',         population:3500,  regions:2,  military:32, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'BA', name:'Bosnia',              controller:'Balkan Command',     empire:null,           population:3000,  regions:2,  military:28, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'SI', name:'Slovenia',            controller:'Alpine Guard',       empire:'NATO',         population:2000,  regions:1,  military:28, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'ME', name:'Montenegro',          controller:'Balkan Command',     empire:null,           population:700,   regions:1,  military:18, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'MK', name:'North Macedonia',     controller:'Balkan Command',     empire:'NATO',         population:2000,  regions:1,  military:20, fundTier:'tiny',   color:'#f1c40f', conqueredResources:[] },
  { code:'AL', name:'Albania',             controller:'Balkan Command',     empire:'NATO',         population:2500,  regions:1,  military:20, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'LT', name:'Lithuania',           controller:'Baltic Command',     empire:'NATO',         population:2500,  regions:1,  military:28, fundTier:'tiny',   color:'#f1c40f', conqueredResources:[] },
  { code:'LV', name:'Latvia',              controller:'Baltic Command',     empire:'NATO',         population:1800,  regions:1,  military:25, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'EE', name:'Estonia',             controller:'Baltic Command',     empire:'NATO',         population:1500,  regions:1,  military:24, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'BY', name:'Belarus',             controller:'Red Army',           empire:'Eastern Bloc', population:8000,  regions:2,  military:42, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'MD', name:'Moldova',             controller:'Black Sea Guard',    empire:null,           population:2500,  regions:1,  military:15, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'IE', name:'Ireland',             controller:'Crown Forces',       empire:'NATO',         population:4000,  regions:1,  military:18, fundTier:'small',  color:'#27ae60', conqueredResources:[] },
  { code:'IS', name:'Iceland',             controller:'Nordic Command',     empire:'NATO',         population:500,   regions:1,  military:10, fundTier:'tiny',   color:'#4f8ef7', conqueredResources:[] },
  { code:'LU', name:'Luxembourg',          controller:'Euro Corps',         empire:'NATO',         population:600,   regions:1,  military:12, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'MT', name:'Malta',               controller:'Euro Corps',         empire:'NATO',         population:500,   regions:1,  military:10, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'CY', name:'Cyprus',              controller:'Hellenic Forces',    empire:'NATO',         population:1000,  regions:1,  military:12, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'GE', name:'Georgia',             controller:'Caucasus Guard',     empire:null,           population:3500,  regions:2,  military:25, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'AM', name:'Armenia',             controller:'Caucasus Guard',     empire:null,           population:2500,  regions:1,  military:22, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'AZ', name:'Azerbaijan',          controller:'Caucasus Guard',     empire:null,           population:7000,  regions:2,  military:35, fundTier:'small',  color:'#3498db', conqueredResources:['Iron'] },
  { code:'XK', name:'Kosovo',              controller:'Balkan Command',     empire:null,           population:1500,  regions:1,  military:15, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },

  // ── Middle East ──
  { code:'TR', name:'Turkey',              controller:'Ottoman Revival',    empire:'Eastern Bloc', population:14000, regions:4,  military:58, fundTier:'medium', color:'#00b894', conqueredResources:['Rubber'] },
  { code:'SA', name:'Saudi Arabia',        controller:'Desert Shield',      empire:null,           population:10000, regions:5,  military:60, fundTier:'large',  color:'#27ae60', conqueredResources:['Iron'] },
  { code:'IL', name:'Israel',              controller:'Iron Dome',          empire:'NATO',         population:5000,  regions:1,  military:80, fundTier:'medium', color:'#2980b9', conqueredResources:['Silicon'] },
  { code:'IR', name:'Iran',                controller:'Persian Guard',      empire:'Eastern Bloc', population:18000, regions:6,  military:65, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'IQ', name:'Iraq',                controller:'Desert Command',     empire:'Eastern Bloc', population:16000, regions:4,  military:45, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'SY', name:'Syria',               controller:'Desert Command',     empire:'Eastern Bloc', population:10000, regions:3,  military:35, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'JO', name:'Jordan',              controller:'Desert Shield',      empire:'NATO',         population:7000,  regions:2,  military:32, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'LB', name:'Lebanon',             controller:'Desert Command',     empire:null,           population:4000,  regions:1,  military:20, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'AE', name:'UAE',                 controller:'Desert Shield',      empire:null,           population:5000,  regions:2,  military:45, fundTier:'large',  color:'#27ae60', conqueredResources:[] },
  { code:'QA', name:'Qatar',               controller:'Desert Shield',      empire:null,           population:1500,  regions:1,  military:30, fundTier:'medium', color:'#8e44ad', conqueredResources:[] },
  { code:'KW', name:'Kuwait',              controller:'Desert Shield',      empire:'NATO',         population:2500,  regions:1,  military:28, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'BH', name:'Bahrain',             controller:'Desert Shield',      empire:'NATO',         population:900,   regions:1,  military:15, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'OM', name:'Oman',                controller:'Desert Shield',      empire:null,           population:3500,  regions:2,  military:30, fundTier:'small',  color:'#27ae60', conqueredResources:[] },
  { code:'YE', name:'Yemen',               controller:'Desert Command',     empire:null,           population:18000, regions:3,  military:25, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'PS', name:'Palestine',           controller:'Desert Command',     empire:null,           population:3500,  regions:1,  military:12, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },

  // ── Asia ──
  { code:'CN', name:'China',               controller:'Dragon Force',       empire:'Eastern Bloc', population:45000, regions:14, military:82, fundTier:'large',  color:'#e74c3c', conqueredResources:['Silicon','Rubber'] },
  { code:'JP', name:'Japan',               controller:'Rising Sun',         empire:'NATO',         population:20000, regions:3,  military:72, fundTier:'large',  color:'#e84393', conqueredResources:['Silicon'] },
  { code:'KR', name:'South Korea',         controller:'K-Force',            empire:'NATO',         population:14000, regions:3,  military:75, fundTier:'large',  color:'#3498db', conqueredResources:['Silicon'] },
  { code:'KP', name:'North Korea',         controller:'Juche Command',      empire:'Eastern Bloc', population:13000, regions:3,  military:60, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'IN', name:'India',               controller:'Bengal Tigers',      empire:null,           population:38000, regions:10, military:70, fundTier:'medium', color:'#e67e22', conqueredResources:['Iron'] },
  { code:'PK', name:'Pakistan',            controller:'Green Crescent',     empire:null,           population:35000, regions:6,  military:68, fundTier:'medium', color:'#27ae60', conqueredResources:['Uranium'] },
  { code:'BD', name:'Bangladesh',          controller:'Bengal Tigers',      empire:null,           population:25000, regions:3,  military:30, fundTier:'small',  color:'#27ae60', conqueredResources:[] },
  { code:'LK', name:'Sri Lanka',           controller:'Bengal Tigers',      empire:null,           population:6000,  regions:2,  military:22, fundTier:'tiny',   color:'#f1c40f', conqueredResources:[] },
  { code:'NP', name:'Nepal',               controller:'Himalaya Guard',     empire:null,           population:10000, regions:2,  military:18, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'BT', name:'Bhutan',              controller:'Himalaya Guard',     empire:null,           population:700,   regions:1,  military:10, fundTier:'tiny',   color:'#f39c12', conqueredResources:[] },
  { code:'MN', name:'Mongolia',            controller:'Steppe Riders',      empire:null,           population:3000,  regions:3,  military:22, fundTier:'tiny',   color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'TH', name:'Thailand',            controller:'Indochina Command',  empire:null,           population:18000, regions:4,  military:45, fundTier:'medium', color:'#f39c12', conqueredResources:[] },
  { code:'VN', name:'Vietnam',             controller:'Indochina Command',  empire:'Eastern Bloc', population:20000, regions:5,  military:48, fundTier:'medium', color:'#e74c3c', conqueredResources:['Rubber'] },
  { code:'MM', name:'Myanmar',             controller:'Indochina Command',  empire:null,           population:16000, regions:4,  military:35, fundTier:'small',  color:'#f1c40f', conqueredResources:[] },
  { code:'KH', name:'Cambodia',            controller:'Indochina Command',  empire:null,           population:9000,  regions:2,  military:20, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'LA', name:'Laos',                controller:'Indochina Command',  empire:'Eastern Bloc', population:5000,  regions:2,  military:18, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'MY', name:'Malaysia',            controller:'ASEAN Pact',         empire:null,           population:14000, regions:3,  military:42, fundTier:'medium', color:'#e74c3c', conqueredResources:['Rubber'] },
  { code:'SG', name:'Singapore',           controller:'ASEAN Pact',         empire:null,           population:5000,  regions:1,  military:52, fundTier:'medium', color:'#e74c3c', conqueredResources:[] },
  { code:'ID', name:'Indonesia',           controller:'ASEAN Pact',         empire:null,           population:28000, regions:7,  military:55, fundTier:'medium', color:'#e74c3c', conqueredResources:['Rubber','Iron'] },
  { code:'PH', name:'Philippines',         controller:'ASEAN Pact',         empire:'NATO',         population:16000, regions:4,  military:38, fundTier:'medium', color:'#3498db', conqueredResources:[] },
  { code:'TW', name:'Taiwan',              controller:'Rising Sun',         empire:'NATO',         population:10000, regions:1,  military:72, fundTier:'medium', color:'#3498db', conqueredResources:['Silicon'] },
  { code:'HK', name:'Hong Kong',           controller:'Dragon Force',       empire:'Eastern Bloc', population:5000,  regions:1,  military:30, fundTier:'medium', color:'#e74c3c', conqueredResources:[] },
  { code:'KZ', name:'Kazakhstan',          controller:'Steppe Riders',      empire:'Eastern Bloc', population:12000, regions:4,  military:35, fundTier:'medium', color:'#3498db', conqueredResources:['Uranium','Iron'] },
  { code:'UZ', name:'Uzbekistan',          controller:'Steppe Riders',      empire:'Eastern Bloc', population:18000, regions:3,  military:28, fundTier:'small',  color:'#27ae60', conqueredResources:['Iron'] },
  { code:'TM', name:'Turkmenistan',        controller:'Steppe Riders',      empire:'Eastern Bloc', population:4000,  regions:2,  military:22, fundTier:'small',  color:'#27ae60', conqueredResources:['Iron'] },
  { code:'KG', name:'Kyrgyzstan',          controller:'Steppe Riders',      empire:'Eastern Bloc', population:4000,  regions:2,  military:18, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'TJ', name:'Tajikistan',          controller:'Steppe Riders',      empire:'Eastern Bloc', population:7000,  regions:2,  military:20, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'AF', name:'Afghanistan',         controller:'Desert Command',     empire:null,           population:24000, regions:5,  military:30, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },

  // ── Africa ──
  { code:'NG', name:'Nigeria',             controller:'West African Union', empire:null,           population:15000, regions:5,  military:40, fundTier:'small',  color:'#16a085', conqueredResources:['Uranium'] },
  { code:'ZA', name:'South Africa',        controller:'Rainbow Command',    empire:null,           population:14000, regions:4,  military:52, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'EG', name:'Egypt',               controller:'Pharaoh Guard',      empire:null,           population:20000, regions:5,  military:62, fundTier:'medium', color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'ET', name:'Ethiopia',            controller:'Horn of Africa',     empire:null,           population:22000, regions:5,  military:42, fundTier:'small',  color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'DZ', name:'Algeria',             controller:'Maghreb Command',    empire:null,           population:16000, regions:5,  military:48, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'MA', name:'Morocco',             controller:'Maghreb Command',    empire:null,           population:14000, regions:3,  military:40, fundTier:'small',  color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'TN', name:'Tunisia',             controller:'Maghreb Command',    empire:null,           population:8000,  regions:2,  military:32, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'LY', name:'Libya',               controller:'Maghreb Command',    empire:null,           population:5000,  regions:3,  military:30, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'SD', name:'Sudan',               controller:'Horn of Africa',     empire:null,           population:18000, regions:4,  military:30, fundTier:'small',  color:'#27ae60', conqueredResources:['Iron'] },
  { code:'SS', name:'South Sudan',         controller:'Horn of Africa',     empire:null,           population:8000,  regions:2,  military:18, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'SO', name:'Somalia',             controller:'Horn of Africa',     empire:null,           population:9000,  regions:2,  military:15, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'KE', name:'Kenya',               controller:'East African Force', empire:null,           population:16000, regions:3,  military:35, fundTier:'small',  color:'#e74c3c', conqueredResources:[] },
  { code:'TZ', name:'Tanzania',            controller:'East African Force', empire:null,           population:18000, regions:3,  military:30, fundTier:'small',  color:'#3498db', conqueredResources:['Iron'] },
  { code:'UG', name:'Uganda',              controller:'East African Force', empire:null,           population:14000, regions:2,  military:25, fundTier:'tiny',   color:'#f1c40f', conqueredResources:[] },
  { code:'MZ', name:'Mozambique',          controller:'East African Force', empire:null,           population:14000, regions:3,  military:22, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },
  { code:'ZM', name:'Zambia',              controller:'East African Force', empire:null,           population:9000,  regions:2,  military:20, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron','Uranium'] },
  { code:'ZW', name:'Zimbabwe',            controller:'East African Force', empire:null,           population:10000, regions:2,  military:22, fundTier:'tiny',   color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'GH', name:'Ghana',               controller:'West African Union', empire:null,           population:13000, regions:2,  military:28, fundTier:'small',  color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'CI', name:'Ivory Coast',         controller:'West African Union', empire:null,           population:12000, regions:2,  military:25, fundTier:'small',  color:'#f39c12', conqueredResources:[] },
  { code:'CM', name:'Cameroon',            controller:'West African Union', empire:null,           population:14000, regions:3,  military:28, fundTier:'small',  color:'#27ae60', conqueredResources:['Iron'] },
  { code:'SN', name:'Senegal',             controller:'West African Union', empire:null,           population:9000,  regions:2,  military:22, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'ML', name:'Mali',                controller:'Sahel Force',        empire:null,           population:10000, regions:3,  military:18, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },
  { code:'NE', name:'Niger',               controller:'Sahel Force',        empire:null,           population:12000, regions:3,  military:15, fundTier:'tiny',   color:'#f39c12', conqueredResources:['Uranium'] },
  { code:'BF', name:'Burkina Faso',        controller:'Sahel Force',        empire:null,           population:10000, regions:2,  military:14, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'TD', name:'Chad',                controller:'Sahel Force',        empire:null,           population:9000,  regions:3,  military:18, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'CD', name:'DR Congo',            controller:'Central Africa',     empire:null,           population:22000, regions:5,  military:28, fundTier:'small',  color:'#3498db', conqueredResources:['Iron','Uranium'] },
  { code:'CG', name:'Congo',               controller:'Central Africa',     empire:null,           population:6000,  regions:2,  military:18, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },
  { code:'AO', name:'Angola',              controller:'Central Africa',     empire:null,           population:15000, regions:3,  military:30, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'NA', name:'Namibia',             controller:'Rainbow Command',    empire:null,           population:2000,  regions:2,  military:18, fundTier:'tiny',   color:'#f39c12', conqueredResources:['Uranium'] },
  { code:'BW', name:'Botswana',            controller:'Rainbow Command',    empire:null,           population:2500,  regions:1,  military:16, fundTier:'tiny',   color:'#3498db', conqueredResources:['Iron'] },
  { code:'MG', name:'Madagascar',          controller:'East African Force', empire:null,           population:14000, regions:3,  military:15, fundTier:'tiny',   color:'#e84393', conqueredResources:[] },
  { code:'MW', name:'Malawi',              controller:'East African Force', empire:null,           population:10000, regions:2,  military:14, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'RW', name:'Rwanda',              controller:'East African Force', empire:null,           population:9000,  regions:1,  military:20, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'BI', name:'Burundi',             controller:'East African Force', empire:null,           population:8000,  regions:1,  military:12, fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'ER', name:'Eritrea',             controller:'Horn of Africa',     empire:null,           population:4000,  regions:1,  military:20, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'DJ', name:'Djibouti',            controller:'Horn of Africa',     empire:null,           population:600,   regions:1,  military:12, fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'GN', name:'Guinea',              controller:'West African Union', empire:null,           population:8000,  regions:2,  military:15, fundTier:'tiny',   color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'GW', name:'Guinea-Bissau',       controller:'West African Union', empire:null,           population:1500,  regions:1,  military:8,  fundTier:'tiny',   color:'#f1c40f', conqueredResources:[] },
  { code:'SL', name:'Sierra Leone',        controller:'West African Union', empire:null,           population:5000,  regions:1,  military:10, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'LR', name:'Liberia',             controller:'West African Union', empire:null,           population:4000,  regions:1,  military:8,  fundTier:'tiny',   color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'TG', name:'Togo',                controller:'West African Union', empire:null,           population:5000,  regions:1,  military:10, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'BJ', name:'Benin',               controller:'West African Union', empire:null,           population:7000,  regions:1,  military:12, fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'GA', name:'Gabon',               controller:'Central Africa',     empire:null,           population:1800,  regions:1,  military:15, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },
  { code:'GQ', name:'Equatorial Guinea',   controller:'Central Africa',     empire:null,           population:700,   regions:1,  military:10, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },
  { code:'MR', name:'Mauritania',          controller:'Sahel Force',        empire:null,           population:4000,  regions:2,  military:14, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },
  { code:'CF', name:'Central African Rep.',controller:'Central Africa',     empire:null,           population:4000,  regions:2,  military:10, fundTier:'tiny',   color:'#f1c40f', conqueredResources:[] },
  { code:'ST', name:'São Tomé & Príncipe', controller:'Central Africa',     empire:null,           population:200,   regions:1,  military:5,  fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'CV', name:'Cape Verde',          controller:'West African Union', empire:null,           population:500,   regions:1,  military:5,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'KM', name:'Comoros',             controller:'East African Force', empire:null,           population:700,   regions:1,  military:5,  fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'MU', name:'Mauritius',           controller:'East African Force', empire:null,           population:1200,  regions:1,  military:8,  fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'SC', name:'Seychelles',          controller:'East African Force', empire:null,           population:100,   regions:1,  military:5,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'LS', name:'Lesotho',             controller:'Rainbow Command',    empire:null,           population:2000,  regions:1,  military:8,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'SZ', name:'Eswatini',            controller:'Rainbow Command',    empire:null,           population:1100,  regions:1,  military:8,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'MR', name:'Mauritania',          controller:'Sahel Force',        empire:null,           population:4000,  regions:2,  military:14, fundTier:'tiny',   color:'#27ae60', conqueredResources:['Iron'] },

  // ── Oceania ──
  { code:'AU', name:'Australia',           controller:'ANZAC Force',        empire:'NATO',         population:8000,  regions:6,  military:55, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron','Uranium'] },
  { code:'NZ', name:'New Zealand',         controller:'ANZAC Force',        empire:'NATO',         population:3000,  regions:2,  military:32, fundTier:'small',  color:'#3498db', conqueredResources:['Iron'] },
  { code:'PG', name:'Papua New Guinea',    controller:'Pacific Command',    empire:null,           population:7000,  regions:3,  military:18, fundTier:'tiny',   color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'FJ', name:'Fiji',                controller:'Pacific Command',    empire:null,           population:700,   regions:1,  military:8,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'SB', name:'Solomon Islands',     controller:'Pacific Command',    empire:null,           population:500,   regions:1,  military:5,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'VU', name:'Vanuatu',             controller:'Pacific Command',    empire:null,           population:300,   regions:1,  military:4,  fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'WS', name:'Samoa',               controller:'Pacific Command',    empire:null,           population:200,   regions:1,  military:4,  fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'TO', name:'Tonga',               controller:'Pacific Command',    empire:null,           population:100,   regions:1,  military:3,  fundTier:'tiny',   color:'#e74c3c', conqueredResources:[] },
  { code:'KI', name:'Kiribati',            controller:'Pacific Command',    empire:null,           population:100,   regions:1,  military:2,  fundTier:'tiny',   color:'#74b9ff', conqueredResources:[] },
  { code:'FM', name:'Micronesia',          controller:'Pacific Command',    empire:'NATO',         population:100,   regions:1,  military:2,  fundTier:'tiny',   color:'#27ae60', conqueredResources:[] },
  { code:'PW', name:'Palau',               controller:'Pacific Command',    empire:'NATO',         population:20,    regions:1,  military:2,  fundTier:'tiny',   color:'#74b9ff', conqueredResources:[] },
  { code:'MH', name:'Marshall Islands',   controller:'Pacific Command',    empire:'NATO',         population:40,    regions:1,  military:2,  fundTier:'tiny',   color:'#74b9ff', conqueredResources:[] },
  { code:'NR', name:'Nauru',               controller:'Pacific Command',    empire:null,           population:10,    regions:1,  military:2,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
  { code:'TV', name:'Tuvalu',              controller:'Pacific Command',    empire:null,           population:10,    regions:1,  military:2,  fundTier:'tiny',   color:'#3498db', conqueredResources:[] },
]

const DEPOSITS = [
  { type: 'wheat',     countryCode: 'US', bonus: 30 },
  { type: 'oil',       countryCode: 'US', bonus: 30 },
  { type: 'fish',      countryCode: 'JP', bonus: 30 },
  { type: 'steak',     countryCode: 'BR', bonus: 30 },
  { type: 'materialx', countryCode: 'RU', bonus: 30 },
  { type: 'oil',       countryCode: 'RU', bonus: 30 },
  { type: 'wheat',     countryCode: 'IN', bonus: 30 },
  { type: 'fish',      countryCode: 'GB', bonus: 30 },
  { type: 'materialx', countryCode: 'CN', bonus: 30 },
  { type: 'steak',     countryCode: 'DE', bonus: 30 },
  { type: 'oil',       countryCode: 'NG', bonus: 30 },
  { type: 'wheat',     countryCode: 'CA', bonus: 30 },
  { type: 'oil',       countryCode: 'SA', bonus: 30 },
  { type: 'oil',       countryCode: 'IR', bonus: 30 },
  { type: 'oil',       countryCode: 'AE', bonus: 25 },
  { type: 'oil',       countryCode: 'KZ', bonus: 25 },
  { type: 'wheat',     countryCode: 'UA', bonus: 25 },
  { type: 'fish',      countryCode: 'NO', bonus: 25 },
  { type: 'steak',     countryCode: 'AR', bonus: 25 },
  { type: 'steak',     countryCode: 'AU', bonus: 25 },
  { type: 'fish',      countryCode: 'ID', bonus: 20 },
  { type: 'rubber',    countryCode: 'MY', bonus: 30 },
  { type: 'rubber',    countryCode: 'VN', bonus: 25 },
  { type: 'wheat',     countryCode: 'FR', bonus: 20 },
]

async function seed() {
  // Deduplicate countries by code (in case of duplicate entries like MR)
  const seen = new Set<string>()
  const uniqueCountries = COUNTRIES.filter(c => {
    if (seen.has(c.code)) return false
    seen.add(c.code)
    return true
  })

  console.log(`🌍 Seeding ${uniqueCountries.length} countries...`)

  for (const c of uniqueCountries) {
    await db.insert(countries).values({
      code: c.code,
      name: c.name,
      controller: c.controller,
      empire: c.empire,
      population: c.population,
      regions: c.regions,
      military: c.military,
      color: c.color,
      fund: FUND_TIERS[c.fundTier as FundTier] || FUND_TIERS.small,
      conqueredResources: c.conqueredResources,
    }).onConflictDoNothing()
  }

  console.log(`  ✓ ${uniqueCountries.length} countries seeded`)

  // Governments
  console.log('🏛️  Seeding governments...')
  for (const c of uniqueCountries) {
    await db.insert(governments).values({
      countryCode: c.code,
      president: null,
      taxRate: 25,
      congress: [],
      laws: {},
    }).onConflictDoNothing()
  }
  console.log(`  ✓ ${uniqueCountries.length} governments seeded`)

  // Deposits
  console.log('⛏️  Seeding deposits...')
  for (const d of DEPOSITS) {
    await db.insert(regionalDeposits).values({
      type: d.type,
      countryCode: d.countryCode,
      bonus: d.bonus,
      active: false,
    }).onConflictDoNothing()
  }
  console.log(`  ✓ ${DEPOSITS.length} deposits seeded`)

  // Country stocks
  console.log('📈 Seeding stocks...')
  for (const c of uniqueCountries) {
    await db.insert(countryStocks).values({
      countryCode: c.code,
      price: '100',
      openPrice: '100',
      high: '100',
      low: '100',
      volume: 0,
      history: [],
    }).onConflictDoNothing()
  }
  console.log(`  ✓ ${uniqueCountries.length} country stocks seeded`)

  console.log('\n✅ Seed complete!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
