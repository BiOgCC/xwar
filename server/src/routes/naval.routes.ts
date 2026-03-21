import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, navalOperations, armies, armyMembers } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// ── GET /api/naval/active ──
// Returns all active naval operations to display in the lobby
router.get('/active', requireAuth as any, async (req, res) => {
  try {
    const activeOps = await db.select({
      id: navalOperations.id,
      initiatorId: navalOperations.initiatorId,
      originRegion: navalOperations.originRegion,
      targetRegion: navalOperations.targetRegion,
      warshipId: navalOperations.warshipId,
      playersJoined: navalOperations.playersJoined,
      status: navalOperations.status,
      createdAt: navalOperations.createdAt,
    })
    .from(navalOperations)
    .where(eq(navalOperations.status, 'recruiting'))

    // Decorate with initiator name
    const opsWithNames = await Promise.all(activeOps.map(async op => {
      const [p] = await db.select({ name: players.name }).from(players).where(eq(players.id, op.initiatorId)).limit(1)
      return { ...op, initiatorName: p?.name || 'Unknown' }
    }))

    res.json({ success: true, operations: opsWithNames })
  } catch (err) {
    console.error('[NAVAL] get active ops error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/naval/initiate ──
router.post('/initiate', requireAuth as any, validate(z.object({
  originRegion: z.string(),
  targetRegion: z.string(),
  warshipId: z.string()
})), async (req, res) => {
  try {
    const { originRegion, targetRegion, warshipId } = req.body
    const { playerId, playerName } = (req as AuthRequest).player!

    const [newOp] = await db.insert(navalOperations).values({
      initiatorId: playerId,
      originRegion,
      targetRegion,
      warshipId,
      playersJoined: [playerName],
      status: 'recruiting',
    }).returning()

    res.json({ success: true, operationId: newOp.id, message: 'Naval strike initiated.' })
  } catch (err) {
    console.error('[NAVAL] initiate error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/naval/join/:opId ──
router.post('/join/:opId', requireAuth as any, async (req, res) => {
  try {
    const { opId } = req.params
    const { playerName } = (req as AuthRequest).player!

    const [op] = await db.select().from(navalOperations).where(eq(navalOperations.id, opId)).limit(1)
    if (!op || op.status !== 'recruiting') {
      res.status(400).json({ error: 'Operation is no longer recruiting' }); return
    }

    const currentPlayers = op.playersJoined as string[]
    if (currentPlayers.includes(playerName)) {
      res.status(400).json({ error: 'Already joined this operation' }); return
    }

    if (currentPlayers.length >= 6) {
      res.status(400).json({ error: 'Naval operation is full (max 6)' }); return
    }

    const newPlayersList = [...currentPlayers, playerName]
    
    await db.update(navalOperations)
      .set({ playersJoined: newPlayersList })
      .where(eq(navalOperations.id, opId))

    res.json({ success: true, message: `Joined operation targeting ${op.targetRegion}`, playersJoined: newPlayersList })
  } catch (err) {
    console.error('[NAVAL] join error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/naval/launch/:opId ──
router.post('/launch/:opId', requireAuth as any, async (req, res) => {
  try {
    const { opId } = req.params
    const { playerId } = (req as AuthRequest).player!

    const [op] = await db.select().from(navalOperations).where(eq(navalOperations.id, opId)).limit(1)
    if (!op) {
      res.status(404).json({ error: 'Operation not found' }); return
    }
    
    if (op.initiatorId !== playerId) {
      res.status(403).json({ error: 'Only the initiator can launch this operation' }); return
    }

    await db.update(navalOperations)
      .set({ status: 'launched', launchedAt: new Date() })
      .where(eq(navalOperations.id, opId))

    // Note: The actual battle initiation logic relies on the socket sync or frontend battleStore directly,
    // so we return success and let the client trigger battleStore.launchAttack(),
    // or we could emit a socket event here. For now we match the current architecture.

    res.json({ success: true, message: 'Operation launched!' })
  } catch (err) {
    console.error('[NAVAL] launch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
