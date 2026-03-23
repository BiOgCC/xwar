import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function main() {
  // Check existing alliances
  const alliances = await sql`SELECT id, name FROM alliances LIMIT 10`
  console.log('Existing alliances:', JSON.stringify(alliances))

  // Check alliances table schema
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'alliances'
    ORDER BY ordinal_position
  `
  console.log('Schema:', JSON.stringify(cols))

  await sql.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
