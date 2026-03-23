/**
 * seed-na-ownership.ts
 *
 * Seeds region_ownership for all North American ley line blocks
 * so the NA lines activate exactly like the Russian ones.
 *
 * Run: npx tsx scripts/seed-na-ownership.ts
 */
import 'dotenv/config'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!, { max: 1 })

// All NA ley line regions with their natural owners
const NA_REGIONS: Array<{ regionId: string; countryCode: string }> = [
  // NA-PROSPERITY — Atlantic Corridor
  { regionId: 'CA-NL', countryCode: 'CA' },
  { regionId: 'CA-QC', countryCode: 'CA' },
  { regionId: 'CA-NB', countryCode: 'CA' },
  { regionId: 'CA-NS', countryCode: 'CA' },
  { regionId: 'US-ME', countryCode: 'US' },
  { regionId: 'US-NH', countryCode: 'US' },
  { regionId: 'US-VT', countryCode: 'US' },
  { regionId: 'US-MA', countryCode: 'US' },
  { regionId: 'US-CT', countryCode: 'US' },
  { regionId: 'US-RI', countryCode: 'US' },
  { regionId: 'US-NY', countryCode: 'US' },
  { regionId: 'US-NJ', countryCode: 'US' },
  { regionId: 'US-PA', countryCode: 'US' },
  { regionId: 'US-DE', countryCode: 'US' },
  { regionId: 'US-MD', countryCode: 'US' },
  { regionId: 'US-VA', countryCode: 'US' },
  { regionId: 'US-NC', countryCode: 'US' },
  { regionId: 'US-SC', countryCode: 'US' },
  { regionId: 'US-GA', countryCode: 'US' },
  { regionId: 'US-FL', countryCode: 'US' },

  // NA-DOMINION — Great Lakes Forge
  { regionId: 'CA-ON', countryCode: 'CA' },
  { regionId: 'US-MI', countryCode: 'US' },
  { regionId: 'US-OH', countryCode: 'US' },
  { regionId: 'US-IN', countryCode: 'US' },
  { regionId: 'US-IL', countryCode: 'US' },
  { regionId: 'US-WI', countryCode: 'US' },
  { regionId: 'US-MN', countryCode: 'US' },
  { regionId: 'CA-MB', countryCode: 'CA' },

  // NA-CONVERGENCE — Pacific Rim
  { regionId: 'CA-BC', countryCode: 'CA' },
  { regionId: 'US-WA', countryCode: 'US' },
  { regionId: 'US-OR', countryCode: 'US' },
  { regionId: 'US-CA', countryCode: 'US' },
  { regionId: 'MX-BC', countryCode: 'MX' },
]

async function seed() {
  console.log(`[SEED] Inserting ${NA_REGIONS.length} North American region ownerships...`)
  const now = new Date().toISOString()

  // Deduplicate (some regions may appear in multiple lines)
  const seen = new Set<string>()
  const unique = NA_REGIONS.filter(r => {
    if (seen.has(r.regionId)) return false
    seen.add(r.regionId)
    return true
  })

  for (const { regionId, countryCode } of unique) {
    await client`
      INSERT INTO region_ownership (region_id, country_code, alliance_id, captured_at, updated_at)
      VALUES (${regionId}, ${countryCode}, NULL, ${now}::timestamptz, ${now}::timestamptz)
      ON CONFLICT (region_id) DO UPDATE SET
        country_code = ${countryCode},
        updated_at   = ${now}::timestamptz
    `
    console.log(`  ✓ ${regionId} → ${countryCode}`)
  }

  // Summary
  console.log('\n[SEED] Done! Lines that will activate on next engine tick:')
  console.log('  ⚡ NA-PROSPERITY  (The Atlantic Corridor) — US/CA nodes')
  console.log('  ⚡ NA-DOMINION    (The Great Lakes Forge) — US/CA nodes (mixed → alliance required for full eff)')
  console.log('  ⚡ NA-CONVERGENCE (The Pacific Rim)       — US/CA/MX nodes')

  await client.end()
}

seed().catch(err => {
  console.error('[SEED] Error:', err)
  process.exit(1)
})
