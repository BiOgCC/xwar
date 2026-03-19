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

// Core 14 + Extended countries (matching worldStore.ts)
const COUNTRIES: CountrySeed[] = [
  // ── Core 14 ──
  { code:'US', name:'United States', controller:'Player Alliance', empire:'NATO', population:32000, regions:12, military:95, fundTier:'large', color:'#4f8ef7', conqueredResources:['Iron','Titanium'] },
  { code:'RU', name:'Russia', controller:'Red Army', empire:'Eastern Bloc', population:28000, regions:18, military:88, fundTier:'large', color:'#c0392b', conqueredResources:['Saltpeter','Iron'] },
  { code:'CN', name:'China', controller:'Dragon Force', empire:'Eastern Bloc', population:45000, regions:14, military:82, fundTier:'large', color:'#e74c3c', conqueredResources:['Silicon','Rubber'] },
  { code:'DE', name:'Germany', controller:'Euro Corps', empire:'NATO', population:18000, regions:4, military:65, fundTier:'large', color:'#f39c12', conqueredResources:['Titanium'] },
  { code:'BR', name:'Brazil', controller:'Amazonia', empire:null, population:22000, regions:8, military:55, fundTier:'medium', color:'#27ae60', conqueredResources:['Rubber'] },
  { code:'IN', name:'India', controller:'Bengal Tigers', empire:null, population:38000, regions:10, military:70, fundTier:'medium', color:'#e67e22', conqueredResources:['Iron'] },
  { code:'NG', name:'Nigeria', controller:'West African Union', empire:null, population:15000, regions:5, military:40, fundTier:'small', color:'#16a085', conqueredResources:['Uranium'] },
  { code:'JP', name:'Japan', controller:'Rising Sun', empire:'NATO', population:20000, regions:3, military:72, fundTier:'large', color:'#e84393', conqueredResources:['Silicon'] },
  { code:'GB', name:'United Kingdom', controller:'Crown Forces', empire:'NATO', population:16000, regions:3, military:68, fundTier:'large', color:'#8e44ad', conqueredResources:['Saltpeter'] },
  { code:'TR', name:'Turkey', controller:'Ottoman Revival', empire:'Eastern Bloc', population:14000, regions:4, military:58, fundTier:'medium', color:'#00b894', conqueredResources:['Rubber'] },
  { code:'CA', name:'Canada', controller:'Northern Guard', empire:'NATO', population:12000, regions:8, military:45, fundTier:'medium', color:'#74b9ff', conqueredResources:['Uranium'] },
  { code:'MX', name:'Mexico', controller:'Cartel Coalition', empire:null, population:18000, regions:6, military:40, fundTier:'medium', color:'#fd9644', conqueredResources:['Iron'] },
  { code:'CU', name:'Cuba', controller:'Caribbean Command', empire:'Eastern Bloc', population:6000, regions:2, military:35, fundTier:'small', color:'#b71540', conqueredResources:['Saltpeter'] },
  { code:'BS', name:'Bahamas', controller:'Island Syndicate', empire:null, population:2000, regions:1, military:15, fundTier:'small', color:'#0abde3', conqueredResources:[] },
  // ── Europe ──
  { code:'FR', name:'France', controller:'French Republic', empire:'NATO', population:16000, regions:4, military:70, fundTier:'large', color:'#2980b9', conqueredResources:['Titanium'] },
  { code:'ES', name:'Spain', controller:'Iberian Guard', empire:'NATO', population:12000, regions:4, military:52, fundTier:'medium', color:'#d4ac0d', conqueredResources:['Iron'] },
  { code:'IT', name:'Italy', controller:'Italian Legion', empire:'NATO', population:14000, regions:4, military:58, fundTier:'medium', color:'#1abc9c', conqueredResources:['Saltpeter'] },
  { code:'PL', name:'Poland', controller:'Polish Hussars', empire:'NATO', population:10000, regions:4, military:55, fundTier:'medium', color:'#e74c3c', conqueredResources:['Iron'] },
  { code:'UA', name:'Ukraine', controller:'Free Ukraine', empire:null, population:11000, regions:5, military:60, fundTier:'medium', color:'#3498db', conqueredResources:['Saltpeter'] },
  { code:'KR', name:'South Korea', controller:'K-Force', empire:'NATO', population:14000, regions:3, military:75, fundTier:'large', color:'#3498db', conqueredResources:['Silicon'] },
  { code:'AU', name:'Australia', controller:'ANZAC Force', empire:'NATO', population:8000, regions:6, military:55, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron','Uranium'] },
  { code:'ZA', name:'South Africa', controller:'Rainbow Command', empire:null, population:14000, regions:4, military:52, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'EG', name:'Egypt', controller:'Pharaoh Guard', empire:null, population:20000, regions:5, military:62, fundTier:'medium', color:'#f1c40f', conqueredResources:['Iron'] },
  { code:'SA', name:'Saudi Arabia', controller:'Desert Shield', empire:null, population:10000, regions:5, military:60, fundTier:'large', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'IL', name:'Israel', controller:'Iron Dome', empire:'NATO', population:5000, regions:1, military:80, fundTier:'medium', color:'#2980b9', conqueredResources:['Silicon'] },
  { code:'IR', name:'Iran', controller:'Persian Guard', empire:'Eastern Bloc', population:18000, regions:6, military:65, fundTier:'medium', color:'#27ae60', conqueredResources:['Iron'] },
  { code:'PK', name:'Pakistan', controller:'Green Crescent', empire:null, population:35000, regions:6, military:68, fundTier:'medium', color:'#27ae60', conqueredResources:['Uranium'] },
]

const DEPOSITS = [
  { type: 'wheat', countryCode: 'US', bonus: 30 },
  { type: 'oil', countryCode: 'US', bonus: 30 },
  { type: 'fish', countryCode: 'JP', bonus: 30 },
  { type: 'steak', countryCode: 'BR', bonus: 30 },
  { type: 'materialx', countryCode: 'RU', bonus: 30 },
  { type: 'oil', countryCode: 'RU', bonus: 30 },
  { type: 'wheat', countryCode: 'IN', bonus: 30 },
  { type: 'fish', countryCode: 'GB', bonus: 30 },
  { type: 'materialx', countryCode: 'CN', bonus: 30 },
  { type: 'steak', countryCode: 'DE', bonus: 30 },
  { type: 'oil', countryCode: 'NG', bonus: 30 },
  { type: 'wheat', countryCode: 'CA', bonus: 30 },
]

async function seed() {
  console.log('🌍 Seeding countries...')

  for (const c of COUNTRIES) {
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

  console.log(`  ✓ ${COUNTRIES.length} countries seeded`)

  // Governments
  console.log('🏛️  Seeding governments...')
  for (const c of COUNTRIES) {
    await db.insert(governments).values({
      countryCode: c.code,
      president: null,
      taxRate: 25,
      congress: [],
      laws: {},
    }).onConflictDoNothing()
  }
  console.log(`  ✓ ${COUNTRIES.length} governments seeded`)

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
  for (const c of COUNTRIES) {
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
  console.log(`  ✓ ${COUNTRIES.length} country stocks seeded`)

  console.log('\n✅ Seed complete!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
