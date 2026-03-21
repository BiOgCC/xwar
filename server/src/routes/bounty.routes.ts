/**
 * Bounty Routes — Place and claim bounties on players.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and, gt, inArray } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, bounties } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const MIN_BOUNTY = 10_000
const BOUNTY_EXPIRE_MS = 24 * 60 * 60 * 1000 // 24 hours

// ═══════════════════════════════════════════════
//  POST /api/bounty/place — Place bounty on a player
// ═══════════════════════════════════════════════

const placeSchema = z.object({
  targetName: z.string(),
  reward: z.number().int().min(MIN_BOUNTY).max(10_000_000),
  reason: z.string().max(200).optional(),
})

router.post('/place', requireAuth as any, validate(placeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { targetName, reward, reason } = req.body

    const [me] = await db.select({ name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    if (targetName === me.name) { res.status(400).json({ error: "Can't bounty yourself." }); return }

    // Verify target exists
    const [target] = await db.select().from(players).where(eq(players.name, targetName)).limit(1)
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

    const expiresAt = new Date(Date.now() + BOUNTY_EXPIRE_MS)

    const [bounty] = await db.insert(bounties).values({
      targetId: target.id,
      placedBy: playerId,
      reward,
      reason: reason || null,
      status: 'active',
      hunters: [],
      expiresAt,
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
    
    // Check if player is a hunter
    const [me] = await db.select({ name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    const hunters = (bounty.hunters as string[]) || []
    if (!hunters.includes(me.name)) {
      res.status(400).json({ error: 'You must be hunting this target to claim the bounty' }); return
    }

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

    // News event
    const [target] = await db.select({ name: players.name }).from(players).where(eq(players.id, bounty.targetId!)).limit(1)
    await db.execute(sql`
      INSERT INTO news_events (type, headline, data)
      VALUES (
        'bounty_claimed',
        ${`🎯 ${me.name} claimed $${bounty.reward.toLocaleString()} bounty on ${target?.name || 'Unknown'}!`},
        ${JSON.stringify({ claimer: me.name, target: target?.name, reward: bounty.reward })}::jsonb
      )
    `)

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
//  POST /api/bounty/subscribe/:id
// ═══════════════════════════════════════════════
router.post('/subscribe/:id', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const bountyId = req.params.id

    const [me] = await db.select({ name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId)).limit(1)
    
    if (!bounty) { res.status(404).json({ error: 'Bounty not found' }); return }
    if (bounty.status !== 'active') { res.status(400).json({ error: 'Bounty not active' }); return }
    if (bounty.targetId === playerId) { res.status(400).json({ error: "Can't hunt yourself" }); return }

    const hunters = (bounty.hunters as string[]) || []
    if (hunters.includes(me.name)) {
      res.status(400).json({ error: 'Already hunting this target' }); return
    }

    await db.update(bounties).set({
      hunters: [...hunters, me.name],
    }).where(eq(bounties.id, bountyId))

    res.json({ success: true, message: 'You are now hunting this target!' })
  } catch (err) {
    console.error('[BOUNTY] Subscribe error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/bounty/unsubscribe/:id
// ═══════════════════════════════════════════════
router.post('/unsubscribe/:id', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const bountyId = req.params.id

    const [me] = await db.select({ name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    const [bounty] = await db.select().from(bounties).where(eq(bounties.id, bountyId)).limit(1)
    
    if (!bounty) { res.status(404).json({ error: 'Bounty not found' }); return }

    const hunters = (bounty.hunters as string[]) || []
    const newHunters = hunters.filter(h => h !== me.name)

    await db.update(bounties).set({
      hunters: newHunters,
    }).where(eq(bounties.id, bountyId))

    res.json({ success: true, message: 'No longer hunting this target' })
  } catch (err) {
    console.error('[BOUNTY] Unsubscribe error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/bounty/active — List active bounties
// ═══════════════════════════════════════════════

router.get('/active', async (_req, res) => {
  try {
    const now = new Date()
    
    // Join bounties with target player to get target details
    const activeBountiesQuery = await db.select({
      id: bounties.id,
      targetPlayer: players.name,
      targetCountry: players.countryCode,
      reward: bounties.reward,
      reason: bounties.reason,
      createdAt: bounties.createdAt,
      expiresAt: bounties.expiresAt,
      hunters: bounties.hunters,
      placedById: bounties.placedBy,
    })
    .from(bounties)
    .innerJoin(players, eq(bounties.targetId, players.id))
    .where(and(
      eq(bounties.status, 'active'),
      gt(bounties.expiresAt, now)
    ))

    // Fetch placer names (manual lookup to avoid a complex join)
    const placerIds = [...new Set(activeBountiesQuery.map(q => q.placedById).filter(Boolean))] as string[]
    let placersMap: Record<string, string> = {}
    
    if (placerIds.length > 0) {
      // get placer names
      const allPlacers = await db.select({ id: players.id, name: players.name })
        .from(players)
        .where(inArray(players.id, placerIds))
      
      allPlacers.forEach(p => placersMap[p.id] = p.name)
    }

    const mappedBounties = activeBountiesQuery.map(q => ({
      id: q.id,
      targetPlayer: q.targetPlayer,
      targetCountry: q.targetCountry,
      placedBy: q.placedById ? (placersMap[q.placedById] || 'System') : 'System',
      amount: Number(q.reward),
      reason: q.reason || 'Wanted dead or alive',
      createdAt: q.createdAt?.getTime() || Date.now(),
      expiresAt: q.expiresAt?.getTime() || (Date.now() + BOUNTY_EXPIRE_MS),
      claimed: false,
      hunters: q.hunters || [],
    }))

    res.json({ success: true, bounties: mappedBounties })
  } catch (err) {
    console.error('[BOUNTY] Active error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
