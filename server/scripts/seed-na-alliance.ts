/**
 * seed-na-alliance.ts
 *
 * Creates a "NATO" seed alliance for US/CA/MX so that the 3 NA ley lines
 * can activate (they span multiple countries — needs alliance to unify).
 * Updates region_ownership.alliance_id for all NA regions.
 *
 * Run: npx tsx scripts/seed-na-alliance.ts
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

const NA_COUNTRIES = ['US', 'CA', 'MX']

// All NA ley line regions
const NA_REGIONS = [
  // NA-PROSPERITY
  'CA-NL', 'CA-QC', 'CA-NB', 'CA-NS',
  'US-ME', 'US-NH', 'US-VT', 'US-MA', 'US-CT', 'US-RI',
  'US-NY', 'US-NJ', 'US-PA', 'US-DE', 'US-MD',
  'US-VA', 'US-NC', 'US-SC', 'US-GA', 'US-FL',
  // NA-DOMINION
  'CA-ON', 'US-MI', 'US-OH', 'US-IN', 'US-IL', 'US-WI', 'US-MN', 'CA-MB',
  // NA-CONVERGENCE
  'CA-BC', 'US-WA', 'US-OR', 'US-CA', 'MX-BC',
]

const REGION_TO_COUNTRY: Record<string, string> = {}
NA_REGIONS.forEach(r => {
  const cc = r.split('-')[0]
  REGION_TO_COUNTRY[r] = cc
})

async function seed() {
  const now = new Date().toISOString()

  // 1. Upsert the NATO alliance
  const [existing] = await sql`SELECT id FROM alliances WHERE name = 'NATO (Seed)'`
  let allianceId: string

  if (existing) {
    allianceId = existing.id as string
    console.log(`[SEED] Using existing NATO alliance: ${allianceId}`)
  } else {
    const members = NA_COUNTRIES.map(cc => ({ countryCode: cc, role: 'member' }))
    const [created] = await sql`
      INSERT INTO alliances (name, tag, members, created_at)
      VALUES ('NATO (Seed)', 'NATO', ${JSON.stringify(members)}::jsonb, ${now}::timestamptz)
      RETURNING id
    `
    allianceId = created.id as string
    console.log(`[SEED] Created NATO alliance: ${allianceId}`)
  }

  // 2. Update all NA regions to reference this alliance
  const unique = [...new Set(NA_REGIONS)]
  for (const regionId of unique) {
    const countryCode = REGION_TO_COUNTRY[regionId]
    await sql`
      INSERT INTO region_ownership (region_id, country_code, alliance_id, captured_at, updated_at)
      VALUES (${regionId}, ${countryCode}, ${allianceId}::uuid, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (region_id) DO UPDATE SET
        country_code = ${countryCode},
        alliance_id  = ${allianceId}::uuid,
        updated_at   = ${now}::timestamptz
    `
    console.log(`  ✓ ${regionId} → ${countryCode} [NATO]`)
  }

  console.log('\n[SEED] Done!')
  console.log('All 3 NA lines controlled by NATO alliance → will activate on next engine tick.')

  await sql.end()
}

seed().catch(err => {
  console.error('[SEED] Error:', err)
  process.exit(1)
})
