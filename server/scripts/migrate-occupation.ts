import postgres from 'postgres'
import * as dotenv from 'dotenv'
dotenv.config()

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function migrate() {
  await sql`ALTER TABLE countries ADD COLUMN IF NOT EXISTS occupied_regions jsonb NOT NULL DEFAULT '{}'`
  console.log('✅ occupied_regions column added/verified')
  await sql.end()
}

migrate().catch(e => { console.error(e); process.exit(1) })
