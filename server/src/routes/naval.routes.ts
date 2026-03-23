import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, navalOperations, countries } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { battleService } from '../services/battle.service.js'
import { emitGameEvent } from '../index.js'

const router = Router()

// ── GET /api/naval/active ──
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
      battleId: navalOperations.battleId,
      createdAt: navalOperations.createdAt,
    })
    .from(navalOperations)
    .where(eq(navalOperations.status, 'recruiting'))

    const opsWithNames = await Promise.all(activeOps.map(async op => {
      const [p] = await db.select({ name: players.name }).from(players).where(eq(players.id, op.initiatorId)).limit(1)
      return { ...op, initiatorName: p?.name || 'Unknown' }
    }))

    res.json({ success: true, operations: opsWithNames })
  } catch (err) {
    console.error('[NAVAL] get active ops error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
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
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// ── POST /api/naval/join/:opId ──
router.post('/join/:opId', requireAuth as any, async (req, res) => {
  try {
    const { opId } = req.params
    const { playerName } = (req as AuthRequest).player!

    const [op] = await db.select().from(navalOperations).where(eq(navalOperations.id, opId)).limit(1)
    if (!op || op.status !== 'recruiting') {
      res.status(400).json({ error: 'Operation is no longer recruiting', code: 'OP_CLOSED' }); return
    }

    const currentPlayers = op.playersJoined as string[]
    if (currentPlayers.includes(playerName)) {
      res.status(400).json({ error: 'Already joined this operation', code: 'ALREADY_JOINED' }); return
    }

    if (currentPlayers.length >= 6) {
      res.status(400).json({ error: 'Naval operation is full (max 6)', code: 'OP_FULL' }); return
    }

    const newPlayersList = [...currentPlayers, playerName]
    await db.update(navalOperations)
      .set({ playersJoined: newPlayersList })
      .where(eq(navalOperations.id, opId))

    res.json({ success: true, message: `Joined operation targeting ${op.targetRegion}`, playersJoined: newPlayersList })
  } catch (err) {
    console.error('[NAVAL] join error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// ── POST /api/naval/launch/:opId ──
// Creates a real battle via battleService and links battle_id back.
router.post('/launch/:opId', requireAuth as any, async (req, res) => {
  try {
    const { opId } = req.params
    const { playerId } = (req as AuthRequest).player!

    const [op] = await db.select().from(navalOperations).where(eq(navalOperations.id, opId)).limit(1)
    if (!op) {
      res.status(404).json({ error: 'Operation not found', code: 'NOT_FOUND' }); return
    }
    if (op.initiatorId !== playerId) {
      res.status(403).json({ error: 'Only the initiator can launch this operation', code: 'FORBIDDEN' }); return
    }
    if (op.status !== 'recruiting') {
      res.status(400).json({ error: 'Operation already launched or closed', code: 'ALREADY_LAUNCHED' }); return
    }

    // Determine attacker country from initiator
    const [initiatorPlayer] = await db.select({ countryCode: players.countryCode })
      .from(players).where(eq(players.id, playerId)).limit(1)
    const attackerCode = initiatorPlayer?.countryCode ?? 'XX'

    // Find defender country by matching region name
    const allCountries = await db.select({ code: countries.code, name: countries.name }).from(countries)
    const defenderCountry = allCountries.find(c =>
      op.targetRegion.toLowerCase().includes(c.name.toLowerCase()) ||
      op.targetRegion.toLowerCase().includes(c.code.toLowerCase())
    )
    const defenderCode = defenderCountry?.code ?? attackerCode

    // Launch battle via battle service
    const result = await battleService.launchBattle(attackerCode, defenderCode, op.targetRegion, 'naval_strike')

    if (!result.success || !result.battleId) {
      res.status(400).json({ error: result.message, code: 'BATTLE_FAILED' }); return
    }

    // Update operation status and link battle_id
    await db.update(navalOperations)
      .set({ status: 'launched', launchedAt: new Date(), battleId: result.battleId })
      .where(eq(navalOperations.id, opId))

    // Broadcast to target country room
    emitGameEvent('battle:started', {
      battleId: result.battleId,
      operationId: opId,
      attackerCode,
      defenderCode,
      targetRegion: op.targetRegion,
      type: 'naval_strike',
      playersJoined: op.playersJoined,
    }, `country:${defenderCode}`)

    res.json({ success: true, operationId: opId, battleId: result.battleId, message: result.message })
  } catch (err) {
    console.error('[NAVAL] launch error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

export default router
