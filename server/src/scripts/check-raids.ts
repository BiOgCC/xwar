import 'dotenv/config'
import postgres from 'postgres'

const db = postgres(process.env.DATABASE_URL!)
const r = await db`SELECT id, name, status, expires_at, total_hunter_dmg, total_boss_dmg FROM raid_events ORDER BY expires_at DESC LIMIT 5`
console.log(JSON.stringify(r, null, 2))
await db.end()
