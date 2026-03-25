/**
 * migrate-ley-line-defs.ts
 *
 * Creates the `ley_line_defs` table and seeds it with:
 *   1. All hardcoded lines from leyLineRegistry.server.ts
 *   2. Auto-generated lines for every country in region_ownership
 *
 * Run: npx tsx scripts/migrate-ley-line-defs.ts
 */
import 'dotenv/config'
import postgres from 'postgres'
import { LEY_LINE_DEFS } from '../src/config/leyLineRegistry.server.js'
import { generateLeyLinesForCountry, COUNTRY_CONTINENT } from '../src/config/leyLineGenerator.server.js'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function migrate() {
  console.log('[MIGRATE] Creating ley_line_defs table...')

  await sql`
    CREATE TABLE IF NOT EXISTS ley_line_defs (
      id           VARCHAR(32) PRIMARY KEY,
      name         VARCHAR(128) NOT NULL,
      continent    VARCHAR(32)  NOT NULL,
      archetype    VARCHAR(16)  NOT NULL,
      blocks       JSONB        NOT NULL DEFAULT '[]',
      bonuses      JSONB        NOT NULL DEFAULT '{}',
      tradeoffs    JSONB        NOT NULL DEFAULT '{}',
      enabled      BOOLEAN DEFAULT TRUE,
      auto_gen     BOOLEAN DEFAULT FALSE,
      country_code VARCHAR(4),
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX IF NOT EXISTS idx_ley_defs_continent  ON ley_line_defs (continent)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ley_defs_country    ON ley_line_defs (country_code)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ley_defs_archetype  ON ley_line_defs (archetype)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ley_defs_enabled    ON ley_line_defs (enabled)`

  console.log('[MIGRATE] Table ready.')
  console.log('\n[SEED] Inserting hardcoded (static registry) lines...')

  const now = new Date().toISOString()

  // 1. Hardcoded registry lines
  for (const line of LEY_LINE_DEFS) {
    const cc = line.blocks[0]?.split('-')[0] ?? null
    await sql`
      INSERT INTO ley_line_defs
        (id, name, continent, archetype, blocks, bonuses, tradeoffs, enabled, auto_gen, country_code, created_at, updated_at)
      VALUES (
        ${line.id}, ${line.name}, ${line.continent}, ${line.archetype},
        ${JSON.stringify(line.blocks)}::jsonb, ${JSON.stringify(line.bonuses)}::jsonb, ${JSON.stringify(line.tradeoffs)}::jsonb,
        TRUE, FALSE, ${cc}, ${now}::timestamptz, ${now}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        name       = EXCLUDED.name,
        blocks     = EXCLUDED.blocks,
        bonuses    = EXCLUDED.bonuses,
        tradeoffs  = EXCLUDED.tradeoffs,
        updated_at = EXCLUDED.updated_at
    `
    console.log(`  ✓ [static] ${line.id} — ${line.name}`)
  }

  // 2. Auto-generate for every country in region_ownership
  console.log('\n[SEED] Auto-generating lines for all countries in region_ownership...')

  const ownershipRows = await sql<{ cc: string; region_id: string }[]>`
    SELECT DISTINCT country_code AS cc, region_id FROM region_ownership ORDER BY cc, region_id
  `

  // Group region IDs by country
  const byCountry = new Map<string, string[]>()
  for (const row of ownershipRows) {
    if (!row.cc) continue
    if (!byCountry.has(row.cc)) byCountry.set(row.cc, [])
    byCountry.get(row.cc)!.push(row.region_id)
  }

  let generated = 0; let skipped = 0

  for (const [cc, regionIds] of byCountry) {
    if (regionIds.length < 2) { skipped++; console.log(`  ⚠ ${cc} — only ${regionIds.length} region(s), skipped`); continue }

    const lines = generateLeyLinesForCountry({ countryCode: cc, regionIds })

    for (const line of Object.values(lines)) {
      await sql`
        INSERT INTO ley_line_defs
          (id, name, continent, archetype, blocks, bonuses, tradeoffs, enabled, auto_gen, country_code, created_at, updated_at)
        VALUES (
          ${line.id}, ${line.name}, ${line.continent}, ${line.archetype},
          ${JSON.stringify(line.blocks)}::jsonb, ${JSON.stringify(line.bonuses)}::jsonb, ${JSON.stringify(line.tradeoffs)}::jsonb,
          TRUE, TRUE, ${cc}, ${now}::timestamptz, ${now}::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          name       = EXCLUDED.name,
          blocks     = EXCLUDED.blocks,
          bonuses    = EXCLUDED.bonuses,
          tradeoffs  = EXCLUDED.tradeoffs,
          updated_at = EXCLUDED.updated_at
      `
      generated++
    }
    console.log(`  ✓ [auto] ${cc} → ${Object.values(lines).map(l => l.id).join(', ')}`)
  }

  // 3. Also generate for all known countries even without ownership rows (continent map)
  console.log('\n[SEED] Generating for COUNTRY_CONTINENT map entries without ownership rows...')
  for (const cc of Object.keys(COUNTRY_CONTINENT)) {
    if (byCountry.has(cc)) continue  // already done

    // Use static registry block IDs as fallback
    const { LEY_LINE_DEFS: defs } = await import('../src/config/leyLineRegistry.server.js')
    const staticRegions = defs
      .filter((l: any) => l.blocks.some((b: string) => b.startsWith(`${cc}-`)))
      .flatMap((l: any) => (l.blocks as string[]).filter(b => b.startsWith(`${cc}-`)))

    const regionIds = [...new Set(staticRegions)]
    if (regionIds.length < 2) { skipped++; continue }

    const lines = generateLeyLinesForCountry({ countryCode: cc, regionIds })
    for (const line of Object.values(lines)) {
      await sql`
        INSERT INTO ley_line_defs
          (id, name, continent, archetype, blocks, bonuses, tradeoffs, enabled, auto_gen, country_code, created_at, updated_at)
        VALUES (
          ${line.id}, ${line.name}, ${line.continent}, ${line.archetype},
          ${JSON.stringify(line.blocks)}::jsonb, ${JSON.stringify(line.bonuses)}::jsonb, ${JSON.stringify(line.tradeoffs)}::jsonb,
          TRUE, TRUE, ${cc}, ${now}::timestamptz, ${now}::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `
      generated++
    }
    console.log(`  ✓ [static-fallback] ${cc} → ${Object.values(lines).map(l => l.id).join(', ')}`)
  }

  const total = await sql<[{ count: number }]>`SELECT COUNT(*) AS count FROM ley_line_defs`
  console.log(`\n[MIGRATE] Done! Total lines in DB: ${total[0].count}  (generated: ${generated}, skipped: ${skipped})`)

  await sql.end()
}

migrate().catch(err => {
  console.error('[MIGRATE] Fatal error:', err)
  process.exit(1)
})
