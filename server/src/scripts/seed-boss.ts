import 'dotenv/config'
import postgres from 'postgres'

const db = postgres(process.env.DATABASE_URL!)
const now = new Date()
const expiresAt = new Date(now.getTime() + 20 * 60 * 1000)

// Seed a new raid boss
const result = await db`
  INSERT INTO raid_events (name, rank, country_code, status, base_bounty, support_pool, total_hunter_dmg, total_boss_dmg, current_tick, expires_at)
  VALUES ('Steel Cobra', 'elite', 'DE', 'active', 120000, 0, 0, 0, 0, ${expiresAt})
  RETURNING id, name
`
console.log('Seeded boss:', result)
await db.end()
process.exit(0)
