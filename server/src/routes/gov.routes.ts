/**
 * Government Routes — Tax, infrastructure, elections.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, countries, governments, companies } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// ═══════════════════════════════════════════════
//  GET /api/gov/country/:code — Get government state
// ═══════════════════════════════════════════════

router.get('/country/:code', async (req, res) => {
  try {
    const { code } = req.params
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, code)).limit(1)
    const [country] = await db.select().from(countries).where(eq(countries.code, code)).limit(1)
    res.json({ success: true, government: gov, country })
  } catch (err) {
    console.error('[GOV] Country error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/set-tax — Set country tax rate (president only)
// ═══════════════════════════════════════════════

const taxSchema = z.object({
  countryCode: z.string().min(2).max(4),
  taxRate: z.number().int().min(0).max(75),
})

router.post('/set-tax', requireAuth as any, validate(taxSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, taxRate } = req.body

    // Verify caller is president
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can set tax rates.' }); return
    }

    await db.update(governments).set({ taxRate }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Tax rate set to ${taxRate}%` })
  } catch (err) {
    console.error('[GOV] Set tax error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/build-infra — Build infrastructure
// ═══════════════════════════════════════════════

const infraSchema = z.object({
  countryCode: z.string().min(2).max(4),
  building: z.enum(['port', 'airport', 'military_base', 'bunker']),
})

const INFRA_COSTS: Record<string, number> = {
  port: 500_000,
  airport: 750_000,
  military_base: 1_000_000,
  bunker: 1_500_000,
}

const INFRA_COLUMN_MAP: Record<string, string> = {
  port: 'port_level',
  airport: 'airport_level',
  military_base: 'military_base_level',
  bunker: 'bunker_level',
}

router.post('/build-infra', requireAuth as any, validate(infraSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, building } = req.body

    // Verify president
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can build infrastructure.' }); return
    }

    const cost = INFRA_COSTS[building]
    const column = INFRA_COLUMN_MAP[building]

    // Deduct from country treasury (atomic)
    const result = await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          fund, '{money}',
          to_jsonb(COALESCE((fund->>'money')::bigint, 0) - ${cost})
        ),
        ${sql.raw(column)} = ${sql.raw(column)} + 1
      WHERE code = ${countryCode}
        AND COALESCE((fund->>'money')::bigint, 0) >= ${cost}
      RETURNING ${sql.raw(column)} AS new_level
    `)

    if ((result as any).length === 0) {
      res.status(400).json({ error: `Treasury doesn't have $${cost.toLocaleString()} for ${building}` }); return
    }

    res.json({ success: true, message: `${building} upgraded!` })
  } catch (err) {
    console.error('[GOV] Build infra error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/nationalize — Nationalize a company
// ═══════════════════════════════════════════════

const nationalizeSchema = z.object({
  countryCode: z.string().min(2).max(4),
  companyId: z.string().uuid(),
})

router.post('/nationalize', requireAuth as any, validate(nationalizeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, companyId } = req.body

    // President check
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can nationalize.' }); return
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.location !== countryCode) { res.status(400).json({ error: 'Company is not in your country.' }); return }

    // Compensation = 50% of creation cost
    const compensation = 50_000
    if (company.ownerId) {
      await db.update(players).set({
        money: sql`${players.money} + ${compensation}`,
      }).where(eq(players.id, company.ownerId))
    }

    // Transfer ownership to null (state-owned)
    await db.update(companies).set({ ownerId: null as any }).where(eq(companies.id, companyId))

    res.json({ success: true, message: 'Company nationalized.' })
  } catch (err) {
    console.error('[GOV] Nationalize error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/vote — Cast election vote
// ═══════════════════════════════════════════════

const voteSchema = z.object({
  countryCode: z.string().min(2).max(4),
  candidateName: z.string().min(1).max(32),
})

router.post('/vote', requireAuth as any, validate(voteSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, candidateName } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.countryCode !== countryCode) {
      res.status(400).json({ error: 'You can only vote in your own country.' }); return
    }

    // Store vote in elections jsonb
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    if (!gov) { res.status(404).json({ error: 'No government found' }); return }

    const elections = (gov.elections as any) || {}
    const votes = elections.votes || {}
    votes[player.name!] = candidateName
    elections.votes = votes

    await db.update(governments).set({ elections }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Voted for ${candidateName}.` })
  } catch (err) {
    console.error('[GOV] Vote error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
