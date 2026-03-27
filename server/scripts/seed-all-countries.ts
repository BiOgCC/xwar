/**
 * Safe country completion seed — fills governments, country_research, country_ley_line_buff
 * for every country that already exists in the DB. Uses raw SQL to avoid schema mismatch
 * with the citizen_dividend_percent column that hasnot been migrated yet.
 * 
 * Run with: npx tsx scripts/seed-all-countries.ts
 */
import 'dotenv/config'
import { db } from '../src/db/connection.js'
import { sql } from 'drizzle-orm'

async function seed() {
  console.log('📋 Fetching all countries from DB...')
  const rows = await db.execute(sql`SELECT code FROM countries ORDER BY code`)
  const codes: string[] = (rows as any[]).map((r: any) => r.code)
  console.log(`  Found ${codes.length} countries`)

  // ── Governments (safe columns only — skip citizen_dividend_percent) ──
  console.log('🏛️  Seeding governments (safe columns)...')
  let govCount = 0
  for (const code of codes) {
    await db.execute(sql`
      INSERT INTO governments (country_code, tax_rate, congress, laws, nuclear_authorized, elections)
      VALUES (${code}, 25, '[]'::jsonb, '{}'::jsonb, false, '{}'::jsonb)
      ON CONFLICT (country_code) DO NOTHING
    `)
    govCount++
  }
  console.log(`  ✓ ${govCount} governments seeded`)

  // ── Country Research ──
  console.log('🔬 Seeding country_research...')
  let resCount = 0
  for (const code of codes) {
    await db.execute(sql`
      INSERT INTO country_research (country_code, military_unlocked, economy_unlocked, current_research)
      VALUES (${code}, '[]'::jsonb, '[]'::jsonb, 'null'::jsonb)
      ON CONFLICT (country_code) DO NOTHING
    `)
    resCount++
  }
  console.log(`  ✓ ${resCount} country_research rows seeded`)

  // ── Country Stocks (if missing) ──
  console.log('📈 Seeding country_stocks...')
  let stockCount = 0
  for (const code of codes) {
    await db.execute(sql`
      INSERT INTO country_stocks (country_code, price, open_price, high, low, volume, history)
      VALUES (${code}, '100.00', '100.00', '100.00', '100.00', 0, '[]'::jsonb)
      ON CONFLICT (country_code) DO NOTHING
    `)
    stockCount++
  }
  console.log(`  ✓ ${stockCount} country_stocks rows seeded`)

  // ── Country Ley Line Buff ──
  console.log('✨ Seeding country_ley_line_buff...')
  let buffCount = 0
  for (const code of codes) {
    await db.execute(sql`
      INSERT INTO country_ley_line_buff (country_code, active_line_ids, merged_bonuses, merged_tradeoffs)
      VALUES (${code}, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)
      ON CONFLICT (country_code) DO NOTHING
    `)
    buffCount++
  }
  console.log(`  ✓ ${buffCount} ley line buff rows seeded`)

  console.log('\n✅ All countries fully initialized!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Seed failed:', err?.message ?? err)
  process.exit(1)
})
