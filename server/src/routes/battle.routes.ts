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
//  SHARED: normalizeBattle() — consistent client shape
//  Works for both in-memory Battle objects and raw DB rows
// ═══════════════════════════════════════════════

function normalizeBattle(b: any, source: 'memory' | 'db' = 'memory'): any {
  const isDb = source === 'db'
  const attackerId = isDb ? (b.attacker_id ?? b.attackerId ?? '') : (b.attackerId ?? '')
  const defenderId = isDb ? (b.defender_id ?? b.defenderId ?? '') : (b.defenderId ?? '')
  const startedAt = b.startedAt
    ? (typeof b.startedAt === 'number' ? b.startedAt : new Date(b.startedAt).getTime())
    : (b.started_at ? new Date(b.started_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : Date.now()))

  const atkDmg = isDb ? Number(b.attacker_damage ?? 0) : (b.attacker?.damageDealt ?? 0)
  const defDmg = isDb ? Number(b.defender_damage ?? 0) : (b.defender?.damageDealt ?? 0)

  // Restore rounds — prefer JSONB column, fallback to empty round
  const rounds = Array.isArray(b.rounds) && b.rounds.length > 0
    ? b.rounds
    : [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: atkDmg, defenderDmgTotal: defDmg, status: 'active', startedAt }]

  const combatLog = Array.isArray(b.combat_log) && b.combat_log.length > 0
    ? b.combat_log
    : Array.isArray(b.combatLog) && b.combatLog.length > 0
      ? b.combatLog
      : Array.isArray(b.battleLog) && b.battleLog.length > 0
        ? b.battleLog
        : []

  const engaged = b.engaged_divisions ?? b.engagedDivisions ?? { attacker: [], defender: [] }
  const atkEngaged: string[] = engaged.attacker ?? b.attacker?.engagedDivisionIds ?? []
  const defEngaged: string[] = engaged.defender ?? b.defender?.engagedDivisionIds ?? []

  return {
    id: b.id,
    type: b.type ?? 'invasion',
    attackerId,
    defenderId,
    regionName: isDb ? (b.region_name ?? b.regionName ?? '') : (b.regionName ?? ''),
    startedAt,
    ticksElapsed: b.ticksElapsed ?? 0,
    status: b.status ?? 'active',
    winner: b.winner ?? null,
    finishedAt: b.finishedAt ?? (b.finished_at ? new Date(b.finished_at).getTime() : null),
    attacker: b.attacker ?? {
      countryCode: attackerId,
      divisionIds: atkEngaged,
      engagedDivisionIds: atkEngaged,
      damageDealt: atkDmg, manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0,
    },
    defender: b.defender ?? {
      countryCode: defenderId,
      divisionIds: defEngaged,
      engagedDivisionIds: defEngaged,
      damageDealt: defDmg, manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0,
    },
    attackerRoundsWon: b.attackerRoundsWon ?? b.attacker_rounds_won ?? 0,
    defenderRoundsWon: b.defenderRoundsWon ?? b.defender_rounds_won ?? 0,
    rounds,
    currentTick: b.currentTick ?? { attackerDamage: 0, defenderDamage: 0 },
    combatLog,
    attackerDamageDealers: b.attackerDamageDealers ?? b.attacker_damage_dealers ?? {},
    defenderDamageDealers: b.defenderDamageDealers ?? b.defender_damage_dealers ?? {},
    damageFeed: b.damageFeed ?? [],
    divisionCooldowns: b.divisionCooldowns ?? {},
    attackerOrder: b.attackerOrder ?? b.attacker_order ?? 'none',
    defenderOrder: b.defenderOrder ?? b.defender_order ?? 'none',
    orderMessage: b.orderMessage ?? '',
    motd: b.motd ?? '',
    playerBattleStats: b.playerBattleStats ?? b.player_battle_stats ?? {},
    adrenalineState: b.adrenalineState ?? b.adrenaline_state ?? {},
    divisionHealthState: b.divisionHealthState ?? b.division_health_state ?? {},
    source,
  }
}

// ═══════════════════════════════════════════════
//  GET /api/battle/active — List all active battles
// ═══════════════════════════════════════════════

router.get('/active', async (_req, res) => {
  try {
    // 1. Get in-memory active battles
    const memBattles = battleService.getActiveBattles()

    // 2. Also query DB for any active battles (catches ones after server restart)
    const { db } = await import('../db/connection.js')
    const { sql: sqlTag } = await import('drizzle-orm')
    const dbRows = await db.execute(sqlTag`
      SELECT id, attacker_id, defender_id, region_name, status,
             attacker_rounds_won, defender_rounds_won,
             attacker_damage, defender_damage, created_at
      FROM battles WHERE status = 'active'
    `)

    // Restore any DB battles not yet in memory
    const memIds = new Set(memBattles.map(b => b.id))
    const dbOnlyIds = (dbRows as any[]).filter(r => !memIds.has(r.id))
    if (dbOnlyIds.length > 0) {
      // Trigger restore (fire-and-forget is fine, DB has the source of truth)
      battleService.restoreFromDB().catch(() => {})
    }

    // Full normalized battles — memory ones first, then DB-only extras
    const combined = [
      ...memBattles.map(b => normalizeBattle(b, 'memory')),
      ...dbOnlyIds.map((r: any) => normalizeBattle(r, 'db')),
    ]

    res.json({ success: true, count: combined.length, battles: combined })
  } catch (err) {
    console.error('[Battle] Error listing active battles:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/battle/:id — Get full battle state
// ═══════════════════════════════════════════════

router.get('/:id', async (req, res) => {
  try {
    const memBattle = battleService.getBattle(req.params.id)
    if (memBattle) {
      res.json({ success: true, battle: normalizeBattle(memBattle, 'memory'), source: 'memory' })
      return
    }

    // Not in memory — query DB with ALL new JSONB columns
    const { db: dbConn } = await import('../db/connection.js')
    const { sql: sqlTag } = await import('drizzle-orm')
    const rows = await dbConn.execute(sqlTag`
      SELECT id, attacker_id, defender_id, region_name, type, status,
             attacker_rounds_won, defender_rounds_won,
             attacker_damage, defender_damage, winner, started_at, finished_at,
             rounds, combat_log, battle_log,
             attacker_damage_dealers, defender_damage_dealers,
             engaged_divisions, attacker_order, defender_order,
             adrenaline_state, player_battle_stats, division_health_state
      FROM battles WHERE id = ${req.params.id} LIMIT 1
    `)
    if ((rows as any[]).length === 0) {
      res.status(404).json({ error: 'Battle not found' })
      return
    }
    const r = (rows as any[])[0]
    // Restore to memory if still active so next tick fires correctly
    if (r.status === 'active') { battleService.restoreFromDB().catch(() => {}) }

    res.json({ success: true, battle: normalizeBattle(r, 'db'), source: 'db' })
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

// ═══════════════════════════════════════════════
//  POST /api/battle/:id/admin-end — Admin force-end a battle
//  Body: { winner: 'attacker' | 'defender', adminPassword: string }
// ═══════════════════════════════════════════════

const ADMIN_BATTLE_PASSWORD = 'svt123!@'

router.post('/:id/admin-end', async (req, res) => {
  try {
    const { winner, adminPassword } = req.body
    if (adminPassword !== ADMIN_BATTLE_PASSWORD) {
      res.status(403).json({ error: 'Invalid admin password.' })
      return
    }
    if (!winner || !['attacker', 'defender'].includes(winner)) {
      res.status(400).json({ error: 'winner must be "attacker" or "defender".' })
      return
    }

    const battle = battleService.getBattle(req.params.id)
    if (!battle) {
      res.status(404).json({ error: 'Battle not found.' })
      return
    }
    if (battle.status !== 'active') {
      res.status(400).json({ error: 'Battle is not active.' })
      return
    }

    // Force-set the winner and finalize
    await battleService.adminForceEnd(req.params.id, winner as 'attacker' | 'defender')

    res.json({
      success: true,
      message: `Battle force-ended. Winner: ${winner === 'attacker' ? battle.attackerId : battle.defenderId}`,
      battleId: req.params.id,
      winner: winner === 'attacker' ? battle.attackerId : battle.defenderId,
    })
  } catch (err) {
    console.error('[Battle] Admin force-end error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
