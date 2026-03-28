/**
 * Battle Routes — REST endpoints for player-initiated battle actions.
 * All authenticated via JWT (requireAuth middleware).
 */

import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { battleService } from '../services/battle.service.js'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players } from '../db/schema.js'

const router = Router()

// ═══════════════════════════════════════════════
//  GET /api/battle/active — List all active battles
// ═══════════════════════════════════════════════

router.get('/active', (_req, res) => {
  try {
    const battles = battleService.getActiveBattles()
    res.json({
      success: true,
      count: battles.length,
      battles: battles.map(b => ({
        id: b.id,
        type: b.type,
        attackerId: b.attackerId,
        defenderId: b.defenderId,
        regionName: b.regionName,
        status: b.status,
        ticksElapsed: b.ticksElapsed,
        attackerRoundsWon: b.attackerRoundsWon,
        defenderRoundsWon: b.defenderRoundsWon,
        attackerDamage: b.attacker.damageDealt,
        defenderDamage: b.defender.damageDealt,
        attackerDivisions: b.attacker.engagedDivisionIds.length,
        defenderDivisions: b.defender.engagedDivisionIds.length,
        rounds: b.rounds,
        startedAt: b.startedAt,
      })),
    })
  } catch (err) {
    console.error('[Battle] Error listing active battles:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/battle/:id — Get full battle state
// ═══════════════════════════════════════════════

router.get('/:id', (req, res) => {
  try {
    const battle = battleService.getBattle(req.params.id)
    if (!battle) {
      res.status(404).json({ error: 'Battle not found' })
      return
    }
    res.json({ success: true, battle })
  } catch (err) {
    console.error('[Battle] Error getting battle:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/launch — Launch a new battle
// ═══════════════════════════════════════════════

const launchSchema = z.object({
  attackerCode: z.string().min(2).max(4),
  defenderCode: z.string().min(2).max(4),
  regionName: z.string().min(1).max(64),
  type: z.enum(['assault', 'invasion', 'occupation', 'sabotage', 'naval_strike', 'air_strike']).default('invasion'),
})

router.post('/launch', requireAuth as any, validate(launchSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { attackerCode, defenderCode, regionName, type } = req.body

    // Verify the player belongs to the attacker country
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.countryCode !== attackerCode) {
      res.status(403).json({ error: 'You can only launch battles for your own country.' })
      return
    }

    const result = await battleService.launchBattle(attackerCode, defenderCode, regionName, type)
    if (!result.success) {
      console.error('[Battle] Launch rejected:', result.message, { attackerCode, defenderCode, regionName, type })
      res.status(400).json({ error: result.message })
      return
    }

    res.json({ success: true, message: result.message, battleId: result.battleId })
  } catch (err) {
    console.error('[Battle] Launch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/attack — Player attack action
// ═══════════════════════════════════════════════

router.post('/:id/attack', requireAuth as any, async (req, res) => {
  try {
    const { playerId, playerName } = (req as AuthRequest).player!
    const battleId = req.params.id
    const forceSide = req.body?.side as 'attacker' | 'defender' | undefined

    // Fetch player's country
    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) {
      res.status(400).json({ error: 'Player has no country.' })
      return
    }

    const result = await battleService.playerAttack(battleId, playerId, playerName, player.countryCode, forceSide)
    res.json({ success: result.damage > 0, ...result })
  } catch (err) {
    console.error('[Battle] Attack error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/defend — Player defend action
// ═══════════════════════════════════════════════

router.post('/:id/defend', requireAuth as any, async (req, res) => {
  try {
    const { playerId, playerName } = (req as AuthRequest).player!
    const battleId = req.params.id

    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) {
      res.status(400).json({ error: 'Player has no country.' })
      return
    }

    const result = await battleService.playerDefend(battleId, playerId, playerName, player.countryCode)
    res.json({ success: result.blocked > 0, ...result })
  } catch (err) {
    console.error('[Battle] Defend error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/deploy — Deploy divisions
// ═══════════════════════════════════════════════

const deploySchema = z.object({
  divisionIds: z.array(z.string().uuid()).min(1).max(50),
  side: z.enum(['attacker', 'defender']),
})

router.post('/:id/deploy', requireAuth as any, validate(deploySchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const battleId = req.params.id
    const { divisionIds, side } = req.body

    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) {
      res.status(400).json({ error: 'Player has no country.' })
      return
    }

    const result = await battleService.deployDivisions(battleId, divisionIds, side, player.countryCode)
    if (!result.success) {
      res.status(400).json({ error: result.message })
      return
    }

    res.json({ success: true, message: result.message })
  } catch (err) {
    console.error('[Battle] Deploy error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/recall/:divId — Recall a division
// ═══════════════════════════════════════════════

const recallSchema = z.object({
  side: z.enum(['attacker', 'defender']),
})

router.post('/:id/recall/:divId', requireAuth as any, validate(recallSchema), async (req, res) => {
  try {
    const battleId = req.params.id
    const divisionId = req.params.divId
    const { side } = req.body

    const result = await battleService.recallDivision(battleId, divisionId, side)
    if (!result.success) {
      res.status(400).json({ error: result.message })
      return
    }

    res.json({ success: true, message: result.message })
  } catch (err) {
    console.error('[Battle] Recall error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/order — Set tactical order
// ═══════════════════════════════════════════════

const orderSchema = z.object({
  side: z.enum(['attacker', 'defender']),
  order: z.enum(['none', 'charge', 'fortify', 'precision', 'blitz']),
})

router.post('/:id/order', requireAuth as any, validate(orderSchema), async (req, res) => {
  try {
    const battleId = req.params.id
    const { side, order } = req.body

    const success = battleService.setOrder(battleId, side, order)
    if (!success) {
      res.status(400).json({ error: 'Battle not found or not active.' })
      return
    }

    res.json({ success: true, message: `Tactical order set to ${order.toUpperCase()}.` })
  } catch (err) {
    console.error('[Battle] Order error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/surge — Activate adrenaline surge
// ═══════════════════════════════════════════════

router.post('/:id/surge', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const battleId = req.params.id

    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) {
      res.status(400).json({ error: 'Player has no country.' })
      return
    }

    const result = battleService.activateSurge(battleId, playerId, player.countryCode)
    res.json(result)
  } catch (err) {
    console.error('[Battle] Surge error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/battle/:id/adrenaline — Get player adrenaline state
// ═══════════════════════════════════════════════

router.get('/:id/adrenaline', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const battleId = req.params.id
    const state = battleService.getAdrenalineState(battleId, playerId)
    res.json({ success: true, ...state })
  } catch (err) {
    console.error('[Battle] Adrenaline error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
