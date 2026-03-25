/**
 * seed-all-ley-lines.ts
 *
 * Seeds 3 ley lines (DOMINION / PROSPERITY / CONVERGENCE) for EVERY country
 * in the COUNTRY_CONTINENT map.
 *
 * Strategy:
 *  1. Check region_ownership for real region IDs per country
 *  2. Fall back to synthetic block IDs  <CC>-R1 … <CC>-R6  for countries
 *     that have no ownership rows yet (so every country always gets 3 lines)
 *  3. ON CONFLICT DO UPDATE so it is safe to re-run
 *
 * Run:
 *   npx tsx scripts/seed-all-ley-lines.ts
 */
import 'dotenv/config'
import postgres from 'postgres'
import {
  generateLeyLinesForCountry,
  COUNTRY_CONTINENT,
} from '../src/config/leyLineGenerator.server.js'

const sql = postgres(process.env.DATABASE_URL!, { max: 3 })

const BATCH = 20

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗')
  console.log('║   XWAR — Seed All Country Ley Lines       ║')
  console.log('╚═══════════════════════════════════════════╝\n')

  // ── Step 1: ensure table exists ──────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ley_line_defs (
      id           VARCHAR(32)  PRIMARY KEY,
      name         VARCHAR(128) NOT NULL,
      continent    VARCHAR(32)  NOT NULL,
      archetype    VARCHAR(16)  NOT NULL,
      blocks       JSONB        NOT NULL DEFAULT '[]',
      bonuses      JSONB        NOT NULL DEFAULT '{}',
      tradeoffs    JSONB        NOT NULL DEFAULT '{}',
      enabled      BOOLEAN      DEFAULT TRUE,
      auto_gen     BOOLEAN      DEFAULT FALSE,
      country_code VARCHAR(4),
      created_at   TIMESTAMPTZ  DEFAULT NOW(),
      updated_at   TIMESTAMPTZ  DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_lld_country  ON ley_line_defs (country_code)`
  await sql`CREATE INDEX IF NOT EXISTS idx_lld_arch     ON ley_line_defs (archetype)`
  await sql`CREATE INDEX IF NOT EXISTS idx_lld_enabled  ON ley_line_defs (enabled)`
  console.log('✓ Table ready')

  // ── Step 2: fetch real region_ownership data ──────────────────────────────
  let ownershipRows: { cc: string; region_id: string }[] = []
  try {
    ownershipRows = await sql<{ cc: string; region_id: string }[]>`
      SELECT DISTINCT country_code AS cc, region_id
      FROM region_ownership
      WHERE country_code IS NOT NULL
      ORDER BY cc, region_id
    `
    console.log(`✓ Loaded ${ownershipRows.length} ownership rows from DB`)
  } catch {
    console.warn('⚠ region_ownership table not found — will use synthetic IDs')
  }

  // Group by country
  const byCountry = new Map<string, string[]>()
  for (const row of ownershipRows) {
    if (!row.cc) continue
    if (!byCountry.has(row.cc)) byCountry.set(row.cc, [])
    byCountry.get(row.cc)!.push(row.region_id)
  }

  // ── Step 3: build full list of countries + their region IDs ──────────────
  const allCountries = Object.keys(COUNTRY_CONTINENT)
  console.log(`\n✦ Targeting ${allCountries.length} countries\n`)

  const all: { cc: string; regionIds: string[] }[] = allCountries.map(cc => {
    const real = byCountry.get(cc) ?? []
    if (real.length >= 3) return { cc, regionIds: real }

    // Synthetic fallback — 6 ordered block IDs so the generator gets a spread
    const synth = [`${cc}-R1`,`${cc}-R2`,`${cc}-R3`,`${cc}-R4`,`${cc}-R5`,`${cc}-R6`]
    return { cc, regionIds: [...real, ...synth].slice(0, Math.max(real.length, 6)) }
  })

  // ── Step 4: batch-insert ──────────────────────────────────────────────────
  let inserted = 0
  let updated  = 0
  const now    = new Date().toISOString()

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH)
    const rows: string[] = []

    for (const { cc, regionIds } of batch) {
      const gen = generateLeyLinesForCountry({ countryCode: cc, regionIds })
      for (const line of Object.values(gen)) {
        rows.push(`${cc}/${line.id}`)
        await sql`
          INSERT INTO ley_line_defs
            (id, name, continent, archetype, blocks, bonuses, tradeoffs,
             enabled, auto_gen, country_code, created_at, updated_at)
          VALUES (
            ${line.id}, ${line.name}, ${line.continent}, ${line.archetype},
            ${JSON.stringify(line.blocks)}::jsonb,
            ${JSON.stringify(line.bonuses)}::jsonb,
            ${JSON.stringify(line.tradeoffs)}::jsonb,
            TRUE, TRUE, ${cc},
            ${now}::timestamptz, ${now}::timestamptz
          )
          ON CONFLICT (id) DO UPDATE SET
            name        = EXCLUDED.name,
            blocks      = EXCLUDED.blocks,
            bonuses     = EXCLUDED.bonuses,
            tradeoffs   = EXCLUDED.tradeoffs,
            continent   = EXCLUDED.continent,
            country_code= EXCLUDED.country_code,
            updated_at  = EXCLUDED.updated_at
        `.then(() => inserted++)
          .catch(() => updated++)  // shouldn't happen — but safety net
      }

      const source = byCountry.has(cc) ? 'real' : 'synth'
      process.stdout.write(`  ✓ ${cc} [${source}]\n`)
    }
  }

  // ── Step 5: final count ───────────────────────────────────────────────────
  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM ley_line_defs
  `

  console.log('\n╔═══════════════════════════════════════════╗')
  console.log(`║  ✅ Done!  Total lines in DB: ${count.padEnd(13)}║`)
  console.log(`║  Countries processed: ${String(allCountries.length).padEnd(19)}║`)
  console.log('╚═══════════════════════════════════════════╝\n')

  await sql.end()
}

main().catch(err => {
  console.error('\n[SEED] Fatal:', err)
  process.exit(1)
})
