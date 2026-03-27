/**
 * Migration: Add Vice President, Defense Minister, Eco Minister columns to governments table
 */
import { db } from '../src/db/connection.js'
import { sql } from 'drizzle-orm'

async function migrate() {
  console.log('Adding government position columns...')
  await db.execute(sql`
    ALTER TABLE governments
      ADD COLUMN IF NOT EXISTS vice_president VARCHAR(32),
      ADD COLUMN IF NOT EXISTS defense_minister VARCHAR(32),
      ADD COLUMN IF NOT EXISTS eco_minister VARCHAR(32)
  `)
  console.log('✅ Migration complete: vice_president, defense_minister, eco_minister added to governments table')
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
