/**
 * Bounty Routes — Place and claim bounties on players.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, bounties } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const MIN_BOUNTY = 10_000

// ═══════════════════════════════════════════════
//  POST /api/bounty/place — Place bounty on a player
// ═══════════════════════════════════════════════

const placeSchema = z.object({
  targetId: z.string().uuid(),
  reward: z.number().int().min(MIN_BOUNTY).max(10_000_000),
  reason: z.string().max(200).optional(),
})

router.post('/place', requireAuth as any, validate(placeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { targetId, reward, reason } = req.body

    if (targetId === playerId) { res.status(400).json({ error: "Can't bounty yourself." }); return }

    // Verify target exists
    const [target] = await db.select({ name: players.name }).from(players).where(eq(players.id, targetId)).limit(1)
    if (!target) { res.status(404).json({ error: 'Target player not found' }); return }

    // Deduct money atomically
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${reward}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${reward}`
    ).returning({ newBalance: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${reward.toLocaleString()}` }); return
    }

    const [bounty] = await db.insert(bounties).values({
      targetId,
      placedBy: playerId,
      reward,
      reason: reason || null,
    }).returning()

    res.json({
      success: true,
      bounty,
      message: `Bounty of $${reward.toLocaleString()} placed on ${target.name}!`,
    })
  } catch (err) {
    console.error('[BOUNTY] Place error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/bounty/claim — Claim a bounty
// ═══════════════════════════════════════════════

const claimSchema = z.object({
  bountyId: z.string().uuid(),
})

router.post('/claim', requireAuth as any, validate(claimSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bountyId } = req.body

    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId)).limit(1)
    if (!bounty) { res.status(404).json({ error: 'Bounty not found' }); return }
    if (bounty.status !== 'active') { res.status(400).json({ error: 'Bounty is no longer active' }); return }
    if (bounty.placedBy === playerId) { res.status(400).json({ error: "Can't claim your own bounty" }); return }

    // Mark bounty as claimed atomically
    const updated = await db.update(bounties).set({
      status: 'claimed',
      claimedBy: playerId,
    }).where(
      sql`${bounties.id} = ${bountyId} AND ${bounties.status} = 'active'`
    ).returning()

    if (updated.length === 0) {
      res.status(400).json({ error: 'Bounty already claimed' }); return
    }

    // Pay claimer
    await db.update(players).set({
      money: sql`${players.money} + ${bounty.reward}`,
    }).where(eq(players.id, playerId))

    res.json({
      success: true,
      reward: bounty.reward,
      message: `Bounty claimed! +$${bounty.reward.toLocaleString()}`,
    })
  } catch (err) {
    console.error('[BOUNTY] Claim error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/bounty/active — List active bounties
// ═══════════════════════════════════════════════

router.get('/active', async (_req, res) => {
  try {
    const activeBounties = await db.select().from(bounties).where(eq(bounties.status, 'active'))
    res.json({ success: true, bounties: activeBounties })
  } catch (err) {
    console.error('[BOUNTY] Active error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
