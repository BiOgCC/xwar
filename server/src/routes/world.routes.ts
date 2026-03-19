import { Router } from 'express'
import { db } from '../db/connection.js'
import { countries, wars, regionalDeposits } from '../db/schema.js'

const router = Router()

// ── GET /api/world/countries ── All countries (public)
router.get('/countries', async (_req, res) => {
  try {
    const allCountries = await db.select().from(countries)
    res.json({ countries: allCountries })
  } catch (err) {
    console.error('[WORLD] Countries error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/world/wars ── Active wars (public)
router.get('/wars', async (_req, res) => {
  try {
    const allWars = await db.select().from(wars)
    res.json({ wars: allWars })
  } catch (err) {
    console.error('[WORLD] Wars error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/world/deposits ── Regional deposits (public)
router.get('/deposits', async (_req, res) => {
  try {
    const allDeposits = await db.select().from(regionalDeposits)
    res.json({ deposits: allDeposits })
  } catch (err) {
    console.error('[WORLD] Deposits error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
