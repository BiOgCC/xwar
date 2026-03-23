/**
 * seed-russia-ownership.ts
 *
 * Seeds the region_ownership table with Russia (RU) controlling
 * all 20 Russian region IDs, so the ley line engine can compute
 * active lines on the next tick.
 *
 * Run: npx tsx scripts/seed-russia-ownership.ts
 */
import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../src/db/schema.js'
import { sql } from 'drizzle-orm'

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString, { max: 1 })
const db = drizzle(client, { schema })

const RUSSIA_REGIONS = [
  'RU-MO', 'RU-SP', 'RU-KR', 'RU-AR', 'RU-WR',
  'RU-VG', 'RU-CC', 'RU-KO', 'RU-UR', 'RU-TY',
  'RU-OM', 'RU-NV', 'RU-KH', 'RU-AL', 'RU-IR',
  'RU-BU', 'RU-SK', 'RU-MG', 'RU-KM', 'RU-FE',
]

async function seed() {
  console.log(`[SEED] Inserting ${RUSSIA_REGIONS.length} Russian region ownerships...`)

  const now = new Date().toISOString()

  for (const regionId of RUSSIA_REGIONS) {
    await db.execute(sql`
      INSERT INTO region_ownership (region_id, country_code, alliance_id, captured_at, updated_at)
      VALUES (${regionId}, 'RU', NULL, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (region_id) DO UPDATE SET
        country_code = 'RU',
        updated_at   = ${now}::timestamptz
    `)
    console.log(`  ✓ ${regionId} → RU`)
  }

  console.log('\n[SEED] Done! The next ley line engine tick will compute RU line activation.')
  console.log('Lines that should activate:')
  console.log('  ⚡ RU-DOMINION  (The Siberian Spine) — RU-MO, RU-UR, RU-TY, RU-KH, RU-IR, RU-SK, RU-FE')
  console.log('  ⚡ RU-PROSPERITY (The Iron Silk Road) — RU-WR, RU-MO, RU-VG, RU-OM, RU-NV, RU-AL')
  console.log('  ⚡ RU-CONVERGENCE (The Arctic Veil)  — RU-KR, RU-AR, RU-KO, RU-TY, RU-MG, RU-KM')

  await client.end()
}

seed().catch(err => {
  console.error('[SEED] Error:', err)
  process.exit(1)
})
