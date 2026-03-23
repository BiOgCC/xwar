import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function check() {
  // Full alliance row dump
  const alliances = await sql`SELECT id, name, members FROM alliances`
  console.log('Alliances:', JSON.stringify(alliances, null, 2))

  // Full ownership for US/CA/MX regions
  const rows = await sql`SELECT region_id, country_code, alliance_id FROM region_ownership WHERE country_code IN ('US','CA','MX') ORDER BY region_id LIMIT 10`
  console.log('\nNA region_ownership sample:', JSON.stringify(rows))

  await sql.end()
}

check().catch(e => { console.error(e.message); process.exit(1) })
