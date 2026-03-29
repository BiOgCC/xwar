/**
 * Cyber Operations Routes — Mission Board + Breach Protocol puzzle system.
 *
 * Flow:
 *  1. GET  /board            → view country's mission board
 *  2. POST /contribute       → run a shift (fill 1 slot, 48h per-player cooldown)
 *  3. POST /launch           → spend charges to launch a cyber operation
 *  4. POST /puzzle/start     → start a breach protocol puzzle for an operation
 *  5. POST /puzzle/move      → submit a move in an active puzzle
 *  6. GET  /puzzle/race/:id  → 5v5 race status for an operation
 *  7. GET  /active           → active deployed operations
 *  8. GET  /reports          → completed operation history
 *  9. GET  /effects/:code    → active effects on a country
 * 10. GET  /ops              → list all operations
 */
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db/connection.js'
import { countries, players, missionBoards, cyberOps, playerSpecialization, breachAttempts, playerSkills } from '../db/schema.js'
import { eq, sql, and } from 'drizzle-orm'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  generateSeed, getDifficulty, isRaceMode,
  createBreachState, processMove as processBreachMove,
  getClientGrid, type MoveAction, type BreachState,
} from '../services/breach-protocol.js'

const router = Router()
router.use(requireAuth as any)

// ═══════════════════════════════════════════════
//  OPERATION DEFINITIONS (10 cyber ops)
// ═══════════════════════════════════════════════

type CyberOpId =
  | 'resource_intel' | 'military_intel' | 'infrastructure_scan' | 'blueprint_loot'
  | 'company_sabotage' | 'logistics_disruption' | 'bunker_override' | 'power_grid_attack'
  | 'disinformation' | 'botnet_attack'

interface OpDef {
  id: CyberOpId
  pillar: 'espionage' | 'sabotage' | 'propaganda'
  chargesRequired: number // T1/T2 = 1, T3/T4 = 2
  successChance: number
  detectionChance: number
  durationMs: number
}

const OPS: Record<CyberOpId, OpDef> = {
  // T1-T2 Espionage (1 charge)
  resource_intel:        { id: 'resource_intel',        pillar: 'espionage',   chargesRequired: 1, successChance: 80, detectionChance: 30, durationMs: 1800000 },
  military_intel:        { id: 'military_intel',        pillar: 'espionage',   chargesRequired: 1, successChance: 80, detectionChance: 30, durationMs: 1800000 },
  infrastructure_scan:   { id: 'infrastructure_scan',   pillar: 'espionage',   chargesRequired: 1, successChance: 80, detectionChance: 30, durationMs: 1800000 },
  blueprint_loot:        { id: 'blueprint_loot',        pillar: 'espionage',   chargesRequired: 1, successChance: 80, detectionChance: 30, durationMs: 1800000 },
  // T3 Sabotage (2 charges)
  company_sabotage:      { id: 'company_sabotage',      pillar: 'sabotage',    chargesRequired: 2, successChance: 80, detectionChance: 30, durationMs: 86400000 },
  logistics_disruption:  { id: 'logistics_disruption',  pillar: 'sabotage',    chargesRequired: 2, successChance: 85, detectionChance: 20, durationMs: 172800000 },
  bunker_override:       { id: 'bunker_override',       pillar: 'sabotage',    chargesRequired: 2, successChance: 80, detectionChance: 30, durationMs: 86400000 },
  power_grid_attack:     { id: 'power_grid_attack',     pillar: 'sabotage',    chargesRequired: 2, successChance: 80, detectionChance: 30, durationMs: 5400000 },
  // T4 Propaganda (2 charges)
  disinformation:        { id: 'disinformation',        pillar: 'propaganda',  chargesRequired: 2, successChance: 80, detectionChance: 30, durationMs: 1800000 },
  botnet_attack:         { id: 'botnet_attack',         pillar: 'propaganda',  chargesRequired: 2, successChance: 80, detectionChance: 30, durationMs: 3600000 },
}

const VALID_OPS = Object.keys(OPS) as CyberOpId[]

function isStaminaRace(operationId: string): boolean {
  const op = OPS[operationId as CyberOpId]
  return op?.pillar === 'sabotage' // only sabotage uses stamina race; propaganda resolves instantly
}

function getRaceWindowMs(operationId: string): number {
  return 10 * 60 * 60 * 1000 // 10 hours (sabotage stamina race + puzzle window)
}

// Contribution costs
const SHIFT_COST = { stamina: 30, work: 10 }
const SHIFT_COOLDOWN_MS = 0 // TEMP: disabled for testing (was 12h)
const SABOTAGE_STAMINA_COST = 10
const SABOTAGE_BASE_POINTS = 3
const SHIFT_XP_REWARD = 50 // espionage spec XP
const SLOTS_PER_BOARD = 5

// ═══════════════════════════════════════════════
//  GET /api/cyber/boards — ALL operation boards for this country
// ═══════════════════════════════════════════════

router.get('/boards', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'No country' }); return }

    // Fetch filling boards for this country
    const boards = await db.select().from(missionBoards)
      .where(and(
        eq(missionBoards.countryCode, player.countryCode),
        eq(missionBoards.status, 'filling')
      ))

    // Also check ALL boards (including used) for per-operation cooldown
    const allBoards = await db.select({ operationType: missionBoards.operationType, contributors: missionBoards.contributors })
      .from(missionBoards)
      .where(eq(missionBoards.countryCode, player.countryCode))

    // Check player's per-operation cooldowns
    const now = Date.now()
    const cooldowns: Record<string, string> = {} // operationType -> endsAt
    let globalCooldownEndsAt: string | null = null
    for (const b of allBoards) {
      const contribs = (b.contributors as any[]) || []
      const myPast = contribs.find((c: any) => c.playerId === playerId)
      if (myPast) {
        const lastShift = new Date(myPast.contributedAt).getTime()
        if (now - lastShift < SHIFT_COOLDOWN_MS) {
          const ends = new Date(lastShift + SHIFT_COOLDOWN_MS).toISOString()
          if (!cooldowns[b.operationType] || ends > cooldowns[b.operationType]) {
            cooldowns[b.operationType] = ends
          }
          if (!globalCooldownEndsAt || ends > globalCooldownEndsAt) globalCooldownEndsAt = ends
        }
      }
    }

    // Build a map: operationType -> board data
    const boardMap: Record<string, any> = {}
    for (const b of boards) {
      const contribs = (b.contributors as any[]) || []
      boardMap[b.operationType] = {
        id: b.id,
        slotsFilled: b.slotsFilled ?? 0,
        slotsRequired: b.slotsRequired ?? SLOTS_PER_BOARD,
        status: b.status,
        contributors: contribs.map((c: any) => ({
          playerName: c.playerName,
          contributedAt: c.contributedAt,
        })),
        isFull: (b.slotsFilled ?? 0) >= (b.slotsRequired ?? SLOTS_PER_BOARD),
        playerJoined: contribs.some((c: any) => c.playerId === playerId),
        cooldownEndsAt: cooldowns[b.operationType] || null,
      }
    }

    res.json({
      success: true,
      boards: boardMap,
      cooldowns,
      cooldownEndsAt: globalCooldownEndsAt, // backward compat
      shiftCost: SHIFT_COST,
    })
  } catch (err) {
    console.error('[CYBER] Boards error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Keep old /board for backwards compat
router.get('/board', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'No country' }); return }

    // Return a dummy response so UI doesn't crash
    res.json({
      success: true,
      board: { id: '', cycle: 1, status: 'filling', slotsFilled: 0, slotsRequired: 5, contributors: [] },
      totalCharges: 0,
      canContribute: false,
      cooldownEndsAt: null,
      alreadyContributed: false,
      shiftCost: SHIFT_COST,
    })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/cyber/contribute — Fill 1 slot on a specific operation
// ═══════════════════════════════════════════════

router.post('/contribute', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { operationType } = req.body || {}

    if (!operationType || !VALID_OPS.includes(operationType)) {
      res.status(400).json({ error: 'Invalid operation type' }); return
    }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }
    if (!player.countryCode) { res.status(400).json({ error: 'No country' }); return }

    // Verify bars
    if (parseFloat(String(player.stamina)) < SHIFT_COST.stamina) {
      res.status(400).json({ error: `Need ${SHIFT_COST.stamina} stamina` }); return
    }
    if ((player.work ?? 0) < SHIFT_COST.work) {
      res.status(400).json({ error: `Need ${SHIFT_COST.work} work energy` }); return
    }

    // Check per-operation cooldown (only boards of the SAME operation type)
    const sameOpBoards = await db.select({ contributors: missionBoards.contributors })
      .from(missionBoards)
      .where(and(
        eq(missionBoards.countryCode, player.countryCode),
        eq(missionBoards.operationType, operationType),
      ))

    const now = Date.now()
    for (const b of sameOpBoards) {
      const contribs = (b.contributors as any[]) || []
      const myPast = contribs.find((c: any) => c.playerId === playerId)
      if (myPast) {
        const lastShift = new Date(myPast.contributedAt).getTime()
        if (now - lastShift < SHIFT_COOLDOWN_MS) {
          const endsAt = new Date(lastShift + SHIFT_COOLDOWN_MS).toISOString()
          res.status(400).json({ error: `Cooldown active for this op until ${new Date(endsAt).toLocaleTimeString()}` }); return
        }
      }
    }

    // Find or create this operation's board
    let [board] = await db.select().from(missionBoards)
      .where(and(
        eq(missionBoards.countryCode, player.countryCode),
        eq(missionBoards.operationType, operationType),
        eq(missionBoards.status, 'filling')
      ))
      .limit(1)

    if (!board) {
      const [newBoard] = await db.insert(missionBoards).values({
        countryCode: player.countryCode,
        operationType,
        cycle: 1,
        status: 'filling',
        slotsRequired: SLOTS_PER_BOARD,
        slotsFilled: 0,
        charges: 0,
        contributors: [],
      }).returning()
      board = newBoard
    }

    // Check if board is already full
    if ((board.slotsFilled ?? 0) >= (board.slotsRequired ?? SLOTS_PER_BOARD)) {
      res.status(400).json({ error: 'This operation is fully staffed. Launch it!' }); return
    }

    // Check if player already on THIS operation's board
    const contributors = (board.contributors as any[]) || []
    if (contributors.some((c: any) => c.playerId === playerId)) {
      res.status(400).json({ error: 'You already joined this operation.' }); return
    }

    // Deduct resources
    await db.update(players).set({
      stamina: sql`${players.stamina} - ${SHIFT_COST.stamina}`,
      work: sql`${players.work} - ${SHIFT_COST.work}`,
    }).where(eq(players.id, playerId))

    // Add to board
    const newContributors = [
      ...contributors,
      { playerId, playerName: player.name, contributedAt: new Date().toISOString() }
    ]
    const newSlotsFilled = (board.slotsFilled ?? 0) + 1
    const boardFull = newSlotsFilled >= (board.slotsRequired ?? SLOTS_PER_BOARD)

    await db.update(missionBoards).set({
      contributors: newContributors,
      slotsFilled: newSlotsFilled,
      ...(boardFull ? { status: 'ready' } : {}),
    }).where(eq(missionBoards.id, board.id))

    // Grant specialization XP
    await db.execute(sql`
      INSERT INTO player_specialization (player_id, military_xp)
      VALUES (${playerId}, ${SHIFT_XP_REWARD})
      ON CONFLICT (player_id) DO UPDATE SET
        military_xp = player_specialization.military_xp + ${SHIFT_XP_REWARD}
    `)

    res.json({
      success: true,
      operationType,
      slotsFilled: newSlotsFilled,
      slotsRequired: board.slotsRequired,
      boardFull,
      xpGained: SHIFT_XP_REWARD,
      message: boardFull
        ? `🔧 ${operationType} fully staffed! Ready to launch!`
        : `🔧 Joined! ${newSlotsFilled}/${board.slotsRequired} operators assigned.`,
    })
  } catch (err) {
    console.error('[CYBER] Contribute error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/cyber/launch — Launch when operation board is full
// ═══════════════════════════════════════════════

const launchSchema = z.object({
  operationType: z.enum(VALID_OPS as [string, ...string[]]),
  targetCountry: z.string().min(2).max(4).optional(),
  targetRegion: z.string().optional(),
  targetPlayer: z.string().optional(),
})

router.post('/launch', validate(launchSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { operationType, targetCountry, targetRegion, targetPlayer } = req.body

    const op = OPS[operationType as CyberOpId]
    if (!op) { res.status(400).json({ error: 'Unknown operation type.' }); return }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'No country' }); return }

    if (targetCountry && targetCountry === player.countryCode) {
      res.status(400).json({ error: 'Cannot target your own country.' }); return
    }

    // All ops can launch with 1+ player
    const [board] = await db.select().from(missionBoards)
      .where(and(
        eq(missionBoards.countryCode, player.countryCode),
        eq(missionBoards.operationType, operationType),
        sql`${missionBoards.slotsFilled} >= 1`,
      ))
      .limit(1)

    if (!board) {
      res.status(400).json({
        error: 'Need at least 1 player assigned to launch this operation.',
      }); return
    }

    const slotsFilled = board.slotsFilled ?? 1
    // Each extra player beyond the first adds +4% success
    const successBonus = (slotsFilled - 1) * 4
    const finalSuccess = Math.min(100, op.successChance + successBonus)

    // Mark this board as used
    await db.update(missionBoards).set({ status: 'used' as any }).where(eq(missionBoards.id, board.id))

    // Operation goes into puzzle_phase — effects are applied after puzzle resolution
    const expiresAt = new Date(Date.now() + op.durationMs)
    const isPropaganda = op.pillar === 'propaganda'

    const [cyberOp] = await db.insert(cyberOps).values({
      boardId: board.id,
      operationId: operationType,
      pillar: op.pillar,
      countryCode: player.countryCode,
      launchedBy: playerId,
      targetCountry: targetCountry || null,
      targetRegion: targetRegion || null,
      targetPlayer: targetPlayer || null,
      status: isPropaganda ? 'completed' : 'puzzle_phase',
      result: {
        operationType,
        raceMode: isRaceMode(operationType),
        sabotageRace: isStaminaRace(operationType) && !isPropaganda,
        slotsFilled,
        successBonus,
        finalSuccess,
        ...(isStaminaRace(operationType) && !isPropaganda ? { raceCounter: { attacker: 0, defender: 0, contributions: [] } } : {}),
      },
      expiresAt,
    }).returning()

    // ── Propaganda: resolve immediately (no puzzle/race) ──
    if (isPropaganda) {
      const succeeded = Math.random() * 100 < finalSuccess
      await applyOperationResult(cyberOp, succeeded)

      res.json({
        success: true,
        operationId: cyberOp.id,
        phase: 'completed',
        succeeded,
        slotsFilled,
        successBonus,
        finalSuccess,
        message: succeeded
          ? `📰 Propaganda operation successful! Effect applied to ${targetCountry}`
          : `📰 Propaganda operation failed — target defenses held.`,
      })
      return
    }

    // News: operation launched (outcome TBD after puzzle)
    await db.execute(sql`
      INSERT INTO news_events (type, headline, country_code, data)
      VALUES (
        'cyber_attack',
        ${`🖥️ ${player.countryCode} launched ${operationType.replace(/_/g, ' ')} against ${targetCountry || 'unknown'}! Breach Protocol initiated.`},
        ${player.countryCode},
        ${JSON.stringify({ op: operationType, target: targetCountry, phase: 'puzzle' })}::jsonb
      )
    `)

    res.json({
      success: true,
      operationId: cyberOp.id,
      phase: 'puzzle',
      raceMode: isRaceMode(operationType),
      slotsFilled,
      successBonus,
      finalSuccess,
      message: isStaminaRace(operationType)
        ? `⚔️ Stamina Race initiated! ${slotsFilled}/5 operators. 10h to fight!`
        : `🖥️ Breach Protocol initiated! ${slotsFilled}/5 operators (+${successBonus}% bonus). Solo puzzle — hack the grid!`,
    })
  } catch (err) {
    console.error('[CYBER] Launch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/cyber/active — Active deployed operations
// ═══════════════════════════════════════════════

router.get('/active', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.json({ success: true, operations: [] }); return }

    // Our outgoing operations
    const outgoing = await db.select().from(cyberOps)
      .where(and(
        eq(cyberOps.countryCode, player.countryCode),
        sql`${cyberOps.status} IN ('deploying', 'completed', 'puzzle_phase')`,
        sql`${cyberOps.expiresAt} > NOW()`
      ))

    // Incoming attacks against our country (for defender side)
    const incoming = await db.select().from(cyberOps)
      .where(and(
        eq(cyberOps.targetCountry, player.countryCode),
        sql`${cyberOps.status} = 'puzzle_phase'`,
        sql`${cyberOps.expiresAt} > NOW()`
      ))

    const ops = [
      ...outgoing.map(o => ({ ...o, isIncoming: false })),
      ...incoming.map(o => ({ ...o, isIncoming: true })),
    ]

    res.json({ success: true, operations: ops })
  } catch (err) {
    console.error('[CYBER] Active error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/cyber/stats — Country + personal operation stats
// ═══════════════════════════════════════════════

router.get('/stats', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.json({ success: true, country: null, personal: null }); return }

    // Country stats from cyber_ops
    const countryOps = await db.select().from(cyberOps)
      .where(eq(cyberOps.countryCode, player.countryCode))

    const countryStats = {
      totalLaunched: countryOps.length,
      successful: countryOps.filter(o => (o.result as any)?.succeeded === true).length,
      failed: countryOps.filter(o => (o.result as any)?.succeeded === false).length,
      detected: countryOps.filter(o => (o.result as any)?.detected === true).length,
      inProgress: countryOps.filter(o => o.status === 'puzzle_phase').length,
      byPillar: {
        espionage: countryOps.filter(o => o.pillar === 'espionage').length,
        sabotage: countryOps.filter(o => o.pillar === 'sabotage').length,
        propaganda: countryOps.filter(o => o.pillar === 'propaganda').length,
      },
    }

    // Personal stats
    const myOps = countryOps.filter(o => o.launchedBy === playerId)
    const personalStats = {
      opsLaunched: myOps.length,
      successful: myOps.filter(o => (o.result as any)?.succeeded === true).length,
      failed: myOps.filter(o => (o.result as any)?.succeeded === false).length,
    }

    // Top co-contributors (from boards where player contributed)
    const myBoards = await db.select().from(missionBoards)
      .where(eq(missionBoards.countryCode, player.countryCode))
    const coPlayerCounts: Record<string, number> = {}
    for (const b of myBoards) {
      const contribs = (b.contributors as any[]) || []
      const iJoined = contribs.some((c: any) => c.playerId === playerId)
      if (iJoined) {
        for (const c of contribs) {
          if (c.playerId !== playerId) {
            coPlayerCounts[c.playerName || c.playerId] = (coPlayerCounts[c.playerName || c.playerId] || 0) + 1
          }
        }
      }
    }
    const topCoPlayers = Object.entries(coPlayerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    // Breach puzzle stats
    const myAttempts = await db.select().from(breachAttempts)
      .where(eq(breachAttempts.playerId, playerId))
    const puzzleStats = {
      puzzlesPlayed: myAttempts.length,
      puzzlesWon: myAttempts.filter(a => a.won).length,
      defended: myAttempts.filter(a => a.side === 'defender').length,
    }

    res.json({
      success: true,
      country: countryStats,
      personal: personalStats,
      topCoPlayers,
      puzzle: puzzleStats,
    })
  } catch (err) {
    console.error('[CYBER] Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/cyber/reports — Completed operation history
// ═══════════════════════════════════════════════

router.get('/reports', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    const reports = await db.select().from(cyberOps)
      .where(eq(cyberOps.launchedBy, playerId))
      .orderBy(sql`${cyberOps.deployedAt} DESC`)
      .limit(50)

    res.json({ success: true, reports })
  } catch (err) {
    console.error('[CYBER] Reports error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  SABOTAGE STAMINA RACE
// ═══════════════════════════════════════════════

const sabotageContributeSchema = z.object({
  cyberOpId: z.string().uuid(),
  side: z.enum(['attacker', 'defender']),
})

router.post('/sabotage/contribute', validate(sabotageContributeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { cyberOpId, side } = req.body

    // Validate op exists and is a stamina race in puzzle_phase
    const [op] = await db.select().from(cyberOps).where(eq(cyberOps.id, cyberOpId)).limit(1)
    if (!op) { res.status(404).json({ error: 'Operation not found' }); return }
    if (op.status !== 'puzzle_phase') { res.status(400).json({ error: 'Operation is not active' }); return }
    const opResult = (op.result as any) || {}
    if (!opResult.sabotageRace) { res.status(400).json({ error: 'This operation does not use stamina race' }); return }

    // Check time window
    const raceWindow = getRaceWindowMs(op.operationId)
    const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
    if (Date.now() - deployedTime > raceWindow) {
      res.status(400).json({ error: 'Race window has expired' }); return
    }

    // Validate side
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'No country' }); return }

    if (side === 'attacker' && player.countryCode !== op.countryCode) {
      res.status(403).json({ error: 'Only attacking country can contribute as attacker' }); return
    }
    if (side === 'defender' && player.countryCode !== op.targetCountry) {
      res.status(403).json({ error: 'Only target country can contribute as defender' }); return
    }

    // Check stamina
    const staminaVal = Number(player.stamina ?? 0)
    if (staminaVal < SABOTAGE_STAMINA_COST) {
      res.status(400).json({ error: `Not enough stamina (need ${SABOTAGE_STAMINA_COST}, have ${Math.floor(staminaVal)})` }); return
    }

    // Load skills for multiplier
    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const sk = skills || { industrialist: 0, prospection: 0, precision: 0, critRate: 0, armor: 0, dodge: 0 }

    // Calculate points: base × (1 + skill multipliers)
    const multiplier = 1
      + (sk.industrialist ?? 0) * 0.02
      + (sk.prospection ?? 0) * 0.02
      + (sk.precision ?? 0) * 0.03
      + (sk.armor ?? 0) * 0.01
      + (sk.dodge ?? 0) * 0.01

    let points = Math.round(SABOTAGE_BASE_POINTS * multiplier * 10) / 10

    // Crit check: critRate% chance to double
    const critRoll = Math.random() * 100
    const isCrit = critRoll < (sk.critRate ?? 0)
    if (isCrit) points *= 2

    // Deduct stamina directly in SQL (avoids JS parsing issues)
    await db.execute(sql`UPDATE players SET stamina = GREATEST(0, stamina::numeric - ${SABOTAGE_STAMINA_COST})::text::numeric(6,1) WHERE id = ${playerId}`)

    // Update race counter on the op
    const result = (op.result as any) || {}
    const counter = result.raceCounter || { attacker: 0, defender: 0, contributions: [] }
    counter[side] = (counter[side] || 0) + points
    counter.contributions = counter.contributions || []
    counter.contributions.push({
      playerId,
      playerName: player.name,
      side,
      points,
      isCrit,
      multiplier: Math.round(multiplier * 100) / 100,
      timestamp: Date.now(),
    })
    result.raceCounter = counter

    await db.update(cyberOps).set({ result }).where(eq(cyberOps.id, cyberOpId))

    res.json({
      success: true,
      points,
      isCrit,
      multiplier: Math.round(multiplier * 100) / 100,
      totals: { attacker: counter.attacker, defender: counter.defender },
    })
  } catch (err) {
    console.error('[CYBER] Sabotage contribute error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Sabotage error: ${msg}` })
  }
})

router.get('/sabotage/race/:opId', async (req, res) => {
  try {
    const { opId } = req.params

    const [op] = await db.select().from(cyberOps).where(eq(cyberOps.id, opId)).limit(1)
    if (!op) { res.status(404).json({ error: 'Operation not found' }); return }

    const result = (op.result as any) || {}
    const counter = result.raceCounter || { attacker: 0, defender: 0, contributions: [] }

    const raceWindow = getRaceWindowMs(op.operationId)
    const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
    const timeRemaining = Math.max(0, raceWindow - (Date.now() - deployedTime))

    res.json({
      success: true,
      attacker: counter.attacker,
      defender: counter.defender,
      contributions: (counter.contributions || []).slice(-20), // last 20
      timeRemaining,
      resolved: op.status !== 'puzzle_phase',
      status: op.status,
    })
  } catch (err) {
    console.error('[CYBER] Sabotage race error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/cyber/effects/:code — Active effects on a country
// ═══════════════════════════════════════════════

router.get('/effects/:code', async (req, res) => {
  try {
    const { code } = req.params

    const effects = await db.select().from(cyberOps)
      .where(
        and(
          eq(cyberOps.status, 'completed'),
          sql`${cyberOps.pillar} IN ('sabotage', 'propaganda')`,
          sql`${cyberOps.expiresAt} > NOW()`,
          sql`${cyberOps.targetCountry} = ${code}`
        )
      )

    res.json({ success: true, effects })
  } catch (err) {
    console.error('[CYBER] Effects error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/cyber/ops — List available operations + charge costs
// ═══════════════════════════════════════════════

router.get('/ops', async (_req, res) => {
  res.json({
    success: true,
    operations: Object.values(OPS).map(op => ({
      id: op.id,
      pillar: op.pillar,
      chargesRequired: op.chargesRequired,
      successChance: op.successChance,
      detectionChance: op.detectionChance,
      raceMode: isRaceMode(op.id),
    })),
  })
})

// ═══════════════════════════════════════════════
//  BREACH PROTOCOL — Puzzle Minigame
// ═══════════════════════════════════════════════

// In-memory puzzle state (active puzzles by attempt ID)
const activePuzzles: Map<string, BreachState> = new Map()

// Auto-clean stale puzzles older than 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, state] of activePuzzles) {
    const start = state.moves.length > 0 ? Date.now() : 0
    // Simple heuristic: remove if no activity in 30 min
    if (activePuzzles.size > 1000) activePuzzles.delete(id)
  }
}, 5 * 60 * 1000)

const RACE_WINDOW_MS = 10 * 60 * 60 * 1000 // 10 hours default puzzle window

// ── POST /api/cyber/puzzle/start ──

const startPuzzleSchema = z.object({
  cyberOpId: z.string().uuid(),
  side: z.enum(['attacker', 'defender']),
})

router.post('/puzzle/start', validate(startPuzzleSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { cyberOpId, side } = req.body

    // Verify the operation exists and is in puzzle_phase
    const [op] = await db.select().from(cyberOps).where(eq(cyberOps.id, cyberOpId)).limit(1)
    if (!op) { res.status(404).json({ error: 'Operation not found' }); return }
    if (op.status !== 'puzzle_phase') {
      res.status(400).json({ error: 'Operation is not in puzzle phase' }); return
    }

    // Check race window (15 min)
    const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
    if (Date.now() - deployedTime > RACE_WINDOW_MS) {
      res.status(400).json({ error: 'Puzzle window has expired (15 min)' }); return
    }

    // Validate side
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    if (side === 'attacker' && player.countryCode !== op.countryCode) {
      res.status(403).json({ error: 'Only players from the attacking country can play as attacker' }); return
    }
    if (side === 'defender') {
      if (player.countryCode !== op.targetCountry) {
        res.status(403).json({ error: 'Only players from the target country can defend' }); return
      }
      // Defender must have contributed to any board of the same pillar
      const opPillar = OPS[op.operationId as CyberOpId]?.pillar
      if (opPillar) {
        const myBoards = player.countryCode ? await db.select().from(missionBoards)
          .where(eq(missionBoards.countryCode, player.countryCode)) : []
        const hasContrib = myBoards.some(b => {
          const contribs = (b.contributors as any[]) || []
          const opDef = OPS[b.operationType as CyberOpId]
          return opDef?.pillar === opPillar && contribs.some((c: any) => c.playerId === playerId)
        })
        if (!hasContrib) {
          res.status(403).json({ error: `You must have a slot on a ${opPillar} operation to defend` }); return
        }
      }
    }

    // Check max 5 players per side
    const existingAttempts = await db.select().from(breachAttempts)
      .where(and(
        eq(breachAttempts.cyberOpId, cyberOpId),
        eq(breachAttempts.side, side)
      ))

    if (existingAttempts.length >= 5) {
      res.status(400).json({ error: `Maximum 5 ${side} players reached` }); return
    }

    // Check player hasn't already attempted
    if (existingAttempts.some(a => a.playerId === playerId)) {
      res.status(400).json({ error: 'You already have a puzzle for this operation' }); return
    }

    // Espionage ops allow 1 defender (the target country can counter)
    if (!isRaceMode(op.operationId) && side === 'defender') {
      const defenderAttempts = existingAttempts.filter(a => a.side === 'defender')
      if (defenderAttempts.length >= 1) {
        res.status(400).json({ error: 'A defender is already assigned to this operation' }); return
      }
    }

    // Generate puzzle
    const seed = generateSeed(cyberOpId, playerId)
    const difficulty = getDifficulty(op.operationId)
    const state = createBreachState(seed, difficulty)

    // Save attempt to DB
    const [attempt] = await db.insert(breachAttempts).values({
      cyberOpId,
      playerId,
      side,
      gridSeed: seed,
      gridSize: difficulty.gridSize,
      integrity: difficulty.startIntegrity,
    }).returning()

    // Store state in memory
    activePuzzles.set(attempt.id, state)

    res.json({
      success: true,
      attemptId: attempt.id,
      grid: getClientGrid(state),
      raceMode: isRaceMode(op.operationId),
      side,
      timeRemaining: Math.max(0, RACE_WINDOW_MS - (Date.now() - deployedTime)),
    })
  } catch (err) {
    console.error('[CYBER] Puzzle start error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Puzzle error: ${msg}` })
  }
})

// ── POST /api/cyber/puzzle/move ──

const moveSchema = z.object({
  attemptId: z.string().uuid(),
  x: z.number().int().min(0).max(15),
  y: z.number().int().min(0).max(15),
  action: z.enum(['click', 'scan', 'bypass', 'decrypt']),
})

router.post('/puzzle/move', validate(moveSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { attemptId, x, y, action } = req.body

    // Verify ownership
    const [attempt] = await db.select().from(breachAttempts)
      .where(eq(breachAttempts.id, attemptId)).limit(1)
    if (!attempt) { res.status(404).json({ error: 'Attempt not found' }); return }
    if (attempt.playerId !== playerId) { res.status(403).json({ error: 'Not your puzzle' }); return }
    if (attempt.completedAt) { res.status(400).json({ error: 'Puzzle already completed' }); return }

    // Get state (or recreate from seed if server restarted)
    let state = activePuzzles.get(attemptId)
    if (!state) {
      // Recreate from seed (replay stored moves)
      const difficulty = getDifficulty(
        (await db.select({ opId: cyberOps.operationId }).from(cyberOps)
          .where(eq(cyberOps.id, attempt.cyberOpId!)).limit(1))?.[0]?.opId || 'resource_intel'
      )
      state = createBreachState(attempt.gridSeed, difficulty)
      // Replay past moves
      const pastMoves = (attempt.moves as any[]) || []
      for (const m of pastMoves) {
        processBreachMove(state, { x: m.x, y: m.y, action: m.action as MoveAction })
      }
      activePuzzles.set(attemptId, state)
    }

    // Process move
    const result = processBreachMove(state, { x, y, action: action as MoveAction })

    if (!result.valid) {
      res.status(400).json({ error: result.result }); return
    }

    // If game ended, persist to DB
    if (result.won || result.lost) {
      await db.update(breachAttempts).set({
        won: result.won,
        integrity: result.integrity,
        nodesCollected: result.nodesCollected,
        moves: state.moves,
        toolsUsed: state.tools,
        completedAt: new Date(),
      }).where(eq(breachAttempts.id, attemptId))

      activePuzzles.delete(attemptId)

      // Check if race is resolved (for 5v5 ops)
      if (attempt.cyberOpId) {
        await checkRaceResolution(attempt.cyberOpId)
      }
    } else {
      // Persist moves periodically (every 5 moves)
      if (state.moves.length % 5 === 0) {
        await db.update(breachAttempts).set({
          moves: state.moves,
          integrity: result.integrity,
          nodesCollected: result.nodesCollected,
        }).where(eq(breachAttempts.id, attemptId))
      }
    }

    res.json({
      success: true,
      result: result.result,
      grid: getClientGrid(state),
      revealed: result.revealed,
      gameOver: result.won || result.lost,
      won: result.won,
    })
  } catch (err) {
    console.error('[CYBER] Puzzle move error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/cyber/puzzle/race/:opId — Race status ──

router.get('/puzzle/race/:opId', async (req, res) => {
  try {
    const { opId } = req.params

    const [op] = await db.select().from(cyberOps).where(eq(cyberOps.id, opId)).limit(1)
    if (!op) { res.status(404).json({ error: 'Operation not found' }); return }

    const attempts = await db.select({
      id: breachAttempts.id,
      side: breachAttempts.side,
      won: breachAttempts.won,
      integrity: breachAttempts.integrity,
      nodesCollected: breachAttempts.nodesCollected,
      completedAt: breachAttempts.completedAt,
      playerId: breachAttempts.playerId,
    }).from(breachAttempts)
      .where(eq(breachAttempts.cyberOpId, opId))

    const attackers = attempts.filter(a => a.side === 'attacker')
    const defenders = attempts.filter(a => a.side === 'defender')

    const attackerWins = attackers.filter(a => a.won).length
    const defenderWins = defenders.filter(a => a.won).length

    const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
    const timeRemaining = Math.max(0, RACE_WINDOW_MS - (Date.now() - deployedTime))

    res.json({
      success: true,
      raceMode: isRaceMode(op.operationId),
      status: op.status,
      timeRemaining,
      attackers: { joined: attackers.length, wins: attackerWins, max: 5 },
      defenders: { joined: defenders.length, wins: defenderWins, max: 5 },
      resolved: op.status !== 'puzzle_phase',
    })
  } catch (err) {
    console.error('[CYBER] Race status error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * Check if a 5v5 race operation should be resolved.
 * Called after each puzzle completion, or periodically for sabotage ops.
 */
async function checkRaceResolution(cyberOpId: string) {
  const [op] = await db.select().from(cyberOps).where(eq(cyberOps.id, cyberOpId)).limit(1)
  if (!op || op.status !== 'puzzle_phase') return

  // ── Stamina race: counter-based resolution (sabotage + propaganda) ──
  if (isStaminaRace(op.operationId)) {
    const raceWindow = getRaceWindowMs(op.operationId)
    const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
    const windowExpired = Date.now() - deployedTime > raceWindow
    if (!windowExpired) return // Still in progress

    const result = (op.result as any) || {}
    const counter = result.raceCounter || { attacker: 0, defender: 0, contributions: [] }
    const succeeded = counter.attacker > counter.defender

    // Reward winning contributors
    const contributions = counter.contributions || []
    const winningSide = succeeded ? 'attacker' : 'defender'
    const winnerContribs = contributions.filter((c: any) => c.side === winningSide)
    const uniqueWinners = [...new Set(winnerContribs.map((c: any) => c.playerId))]

    for (const winnerId of uniqueWinners) {
      const moneyReward = 5000 + Math.floor(Math.random() * 10001) // $5k-$15k
      const lootBoxes = 1 + Math.floor(Math.random() * 3) // 1-3 loot boxes
      await db.execute(sql`UPDATE players SET money = money + ${moneyReward}, loot_boxes = loot_boxes + ${lootBoxes} WHERE id = ${winnerId}`)
    }

    // +2 divisions to winning country
    const winningCountry = succeeded ? op.countryCode : op.targetCountry
    if (winningCountry) {
      await db.execute(sql`UPDATE countries SET military = military + 2 WHERE code = ${winningCountry}`)
    }

    result.raceCounter = counter
    result.winningSide = winningSide
    result.winnersRewarded = uniqueWinners.length

    await applyOperationResult(op, succeeded, {
      attackerPoints: counter.attacker,
      defenderPoints: counter.defender,
      winningSide,
      winnersCount: uniqueWinners.length,
      sabotageRace: true,
    })
    return
  }

  // For solo/espionage ops: check attacker + possible defender
  if (!isRaceMode(op.operationId)) {
    const attempts = await db.select().from(breachAttempts)
      .where(eq(breachAttempts.cyberOpId, cyberOpId))

    const attacker = attempts.find(a => a.side === 'attacker')
    const defender = attempts.find(a => a.side === 'defender')

    // Wait for attacker to finish
    if (!attacker?.completedAt) return

    // If there's a defender, wait for them too (or window expired)
    const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
    const windowExpired = Date.now() - deployedTime > RACE_WINDOW_MS
    if (defender && !defender.completedAt && !windowExpired) return

    let succeeded = !!attacker.won

    // If defender participated, compare results
    if (defender?.completedAt || (defender && windowExpired)) {
      const attackerScore = (attacker.nodesCollected ?? 0) + (attacker.won ? 100 : 0)
      const defenderScore = (defender.nodesCollected ?? 0) + (defender.won ? 100 : 0)

      if (defenderScore >= attackerScore && defender.completedAt) {
        // Defender wins — operation fails, defender's country gets +1 division
        succeeded = false
        if (op.targetCountry) {
          await db.execute(sql`
            UPDATE countries SET military = military + 1 WHERE code = ${op.targetCountry}
          `)
        }
      }
    }

    await applyOperationResult(op, succeeded, defender ? {
      attackerWins: attacker.won ? 1 : 0,
      defenderWins: defender.won ? 1 : 0,
      attackerNodes: attacker.nodesCollected ?? 0,
      defenderNodes: defender?.nodesCollected ?? 0,
      defenderBlocked: !succeeded && !!defender.completedAt,
    } : undefined)
    return
  }

  // For race mode: check if all puzzles are done OR window expired
  const allAttempts = await db.select().from(breachAttempts)
    .where(eq(breachAttempts.cyberOpId, cyberOpId))

  const allDone = allAttempts.every(a => a.completedAt !== null)
  const deployedTime = op.deployedAt ? new Date(op.deployedAt).getTime() : Date.now()
  const windowExpired = Date.now() - deployedTime > RACE_WINDOW_MS

  if (!allDone && !windowExpired) return // Still in progress

  // Tally results
  const attackerWins = allAttempts.filter(a => a.side === 'attacker' && a.won).length
  const defenderWins = allAttempts.filter(a => a.side === 'defender' && a.won).length

  const attackerTotal = allAttempts.filter(a => a.side === 'attacker').length
  const defenderTotal = allAttempts.filter(a => a.side === 'defender').length

  // Attacker wins if: more wins, or equal wins but defenders had fewer players
  const succeeded = attackerWins > defenderWins ||
    (attackerWins === defenderWins && defenderTotal === 0)

  await applyOperationResult(op, succeeded, {
    attackerWins, defenderWins, attackerTotal, defenderTotal,
  })
}

/**
 * Apply the final result of a cyber operation after the puzzle phase.
 */
async function applyOperationResult(op: any, succeeded: boolean, raceData?: any) {
  const resultData: any = {
    succeeded,
    operationType: op.operationId,
    pillar: op.pillar,
    raceData: raceData || null,
    slotsFilled: (op.result as any)?.slotsFilled ?? 0,
    successBonus: (op.result as any)?.successBonus ?? 0,
    launchedAt: op.deployedAt,
    targetCountry: op.targetCountry,
  }

  if (succeeded) {
    // ── Sabotage effects ──
    if (op.operationId === 'bunker_override' && op.targetCountry) {
      await db.execute(sql`UPDATE countries SET bunker_level = GREATEST(1, bunker_level / 2) WHERE code = ${op.targetCountry}`)
      resultData.effect = 'Bunker defense halved'
    }
    if (op.operationId === 'logistics_disruption' && op.targetCountry) {
      const pick = Math.random() < 0.5 ? 'port_level' : 'airport_level'
      await db.execute(sql`UPDATE countries SET ${sql.raw(pick)} = 0 WHERE code = ${op.targetCountry}`)
      resultData.effect = `${pick.replace('_level', '')} disabled`
    }
    if (op.operationId === 'company_sabotage') resultData.effect = '20% production stolen for 24h'
    if (op.operationId === 'power_grid_attack') resultData.effect = '33% companies disabled for 90 min'

    // ── Botnet Attack: 300k fake damage to a battle for 30 min ──
    if (op.operationId === 'botnet_attack' && op.targetCountry) {
      // Store as a timed cyber effect — battle system can query active botnet effects
      const botnetExpires = new Date(Date.now() + 30 * 60 * 1000) // 30 min
      await db.execute(sql`
        INSERT INTO cyber_ops (board_id, operation_id, pillar, country_code, launched_by, target_country, status, result, expires_at, deployed_at)
        VALUES (
          ${op.boardId}, 'botnet_effect', 'propaganda', ${op.countryCode}, ${op.launchedBy},
          ${op.targetCountry}, 'active_effect',
          ${JSON.stringify({ effectType: 'botnet_damage', damage: 300000, expiresAt: botnetExpires.toISOString() })}::jsonb,
          ${botnetExpires.toISOString()}::timestamp,
          NOW()
        )
      `)
      await db.execute(sql`
        INSERT INTO news_events (type, headline, country_code, data)
        VALUES ('cyber_attack', ${`🤖 BOTNET ATTACK: ${op.countryCode} deployed a botnet against ${op.targetCountry}, dealing 300K fake damage to combat logs for 30 minutes!`}, ${op.countryCode}, ${JSON.stringify({ op: 'botnet_attack', target: op.targetCountry, damage: 300000 })}::jsonb)
      `)
      resultData.effect = '300K fake damage injected into enemy combat logs for 30 minutes'
      resultData.report = {
        type: 'Botnet Deployment Report',
        summary: `Botnet successfully deployed against ${op.targetCountry}`,
        fakeDamage: 300000,
        duration: '30 minutes',
        expiresAt: botnetExpires.toISOString(),
      }
    }

    // ── Disinformation: post fake news event ──
    if (op.operationId === 'disinformation' && op.targetCountry) {
      const fakeHeadlines = [
        { type: 'attack', headline: `⚠️ BREAKING: ${op.targetCountry} has launched a surprise attack on multiple fronts!` },
        { type: 'attack', headline: `🚨 ${op.targetCountry} military forces spotted mobilizing near the border!` },
        { type: 'ally', headline: `🤝 ${op.targetCountry} signs secret military alliance with a foreign power!` },
        { type: 'ally', headline: `📋 LEAKED: ${op.targetCountry} negotiating defense pact behind closed doors!` },
        { type: 'war', headline: `⚔️ ${op.targetCountry} declares state of emergency — war preparations underway!` },
        { type: 'war', headline: `🔥 ${op.targetCountry} military command issues war declaration!` },
        { type: 'deposit', headline: `💰 ${op.targetCountry} treasury reports massive capital flight — 80% reserves depleted!` },
        { type: 'deposit', headline: `📉 ${op.targetCountry} central bank collapses! Citizens withdrawing all funds!` },
        { type: 'attack', headline: `🎯 Intelligence reports: ${op.targetCountry} planning nuclear strike!` },
        { type: 'war', headline: `🛡️ ${op.targetCountry} conscripting all citizens — total war declared!` },
      ]
      const pick = fakeHeadlines[Math.floor(Math.random() * fakeHeadlines.length)]
      await db.execute(sql`
        INSERT INTO news_events (type, headline, country_code, data)
        VALUES ('breaking_news', ${pick.headline}, ${op.targetCountry}, ${JSON.stringify({ fake: true, source: op.countryCode, category: pick.type })}::jsonb)
      `)
      resultData.effect = `Fake ${pick.type} news planted in ${op.targetCountry} feed`
      resultData.report = {
        type: 'Disinformation Report',
        summary: `Fake news successfully planted`,
        category: pick.type,
        headline: pick.headline,
        note: 'Target population will see this as legitimate news',
      }
    }

    // ── Espionage: themed reports ──
    if (op.targetCountry) {
      const [country] = await db.select().from(countries).where(eq(countries.code, op.targetCountry)).limit(1)

      if (op.operationId === 'resource_intel' && country) {
        const fund = (country.fund as any) || {}
        resultData.report = {
          type: 'Resource Intelligence',
          summary: `Economic scan of ${country.name}`,
          treasury: fund.money ?? 0,
          oilReserves: fund.oil ?? 0,
          scrapStockpile: fund.scraps ?? 0,
          materialX: fund.materialX ?? 0,
          bitcoin: fund.bitcoin ?? 0,
          population: country.population,
          taxExempt: country.taxExempt,
        }
        resultData.effect = 'Resource stockpiles revealed'
      }
      if (op.operationId === 'military_intel' && country) {
        resultData.report = {
          type: 'Military Intelligence',
          summary: `Military assessment of ${country.name}`,
          militaryStrength: country.military,
          bunkerLevel: country.bunkerLevel,
          militaryBaseLevel: country.militaryBaseLevel,
          regions: country.regions,
          population: country.population,
        }
        resultData.effect = 'Military disposition revealed'
      }
      if (op.operationId === 'infrastructure_scan' && country) {
        resultData.report = {
          type: 'Infrastructure Scan',
          summary: `Infrastructure analysis of ${country.name}`,
          portLevel: country.portLevel,
          airportLevel: country.airportLevel,
          bunkerLevel: country.bunkerLevel,
          militaryBaseLevel: country.militaryBaseLevel,
          hasPort: country.hasPort,
          hasAirport: country.hasAirport,
          regions: country.regions,
        }
        resultData.effect = 'Infrastructure layout mapped'
      }
      if (op.operationId === 'blueprint_loot') {
        resultData.report = {
          type: 'Blueprint Extraction',
          summary: `Blueprint data extracted from ${op.targetCountry}`,
          note: 'Classified technical schematics acquired',
        }
        resultData.effect = 'Blueprint data stolen'
      }
    }

    // ── Espionage rewards (not blueprint_loot) ──
    const REWARD_OPS = ['resource_intel', 'military_intel', 'infrastructure_scan']
    if (REWARD_OPS.includes(op.operationId)) {
      // Money reward: $2,000 - $5,000
      const moneyReward = 2000 + Math.floor(Math.random() * 3001)
      if (op.launchedBy) {
        await db.execute(sql`UPDATE players SET money = money + ${moneyReward} WHERE id = ${op.launchedBy}`)
      }
      // +1 division to launcher's country
      if (op.countryCode) {
        await db.execute(sql`UPDATE countries SET military = military + 1 WHERE code = ${op.countryCode}`)
      }
      resultData.rewards = {
        money: moneyReward,
        divisions: 1,
      }
    }
  }

  // Detection check
  const opDef = OPS[op.operationId as CyberOpId]
  const detected = Math.random() * 100 < (opDef?.detectionChance ?? 30)
  resultData.detected = detected

  await db.update(cyberOps).set({
    status: succeeded ? 'completed' : 'failed',
    result: resultData,
  }).where(eq(cyberOps.id, op.id))

  // News
  const headline = succeeded
    ? `🖥️ ${op.countryCode} successfully ran ${op.operationId.replace(/_/g, ' ')} against ${op.targetCountry || 'unknown'}!`
    : `🖥️ ${op.countryCode} failed to ${op.operationId.replace(/_/g, ' ')} ${op.targetCountry || ''}!`
  await db.execute(sql`
    INSERT INTO news_events (type, headline, country_code, data)
    VALUES (
      'cyber_attack',
      ${headline},
      ${op.countryCode},
      ${JSON.stringify({ op: op.operationId, target: op.targetCountry, succeeded, detected })}::jsonb
    )
  `)
}

// ── Auto-resolve expired sabotage races every 2 minutes ──
setInterval(async () => {
  try {
    const expiredOps = await db.select({ id: cyberOps.id }).from(cyberOps)
      .where(and(
        eq(cyberOps.status, 'puzzle_phase' as any),
        sql`${cyberOps.deployedAt} < NOW() - INTERVAL '${sql.raw(String(RACE_WINDOW_MS / 1000))} seconds'`,
      ))

    for (const op of expiredOps) {
      await checkRaceResolution(op.id)
    }
  } catch (err) {
    console.error('[CYBER] Auto-resolve timer error:', err)
  }
}, 2 * 60 * 1000) // every 2 min

export default router
