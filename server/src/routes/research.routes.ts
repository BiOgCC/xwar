/**
 * Research Routes — Country research tree unlock/fetch.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { countries, governments, players, countryResearch, newsEvents } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { MILITARY_UNLOCKS, ECONOMY_UNLOCKS, unlockType } from '../config/research-unlocks.js'

const router = Router()

// ═══════════════════════════════════════════════
//  Research node definitions (mirrors frontend researchStore)
// ═══════════════════════════════════════════════

interface ResearchNode { id: string; cost: number }

const MILITARY_DOCTRINE: ResearchNode[] = [
  { id: 'mil_1', cost: 50000 },
  { id: 'mil_2', cost: 100000 },
  { id: 'mil_3', cost: 150000 },
  { id: 'mil_4', cost: 200000 },
  { id: 'mil_5', cost: 300000 },
  { id: 'mil_6', cost: 400000 },
  { id: 'mil_7', cost: 500000 },
]

const ECONOMIC_THEORY: ResearchNode[] = [
  { id: 'eco_1', cost: 50000 },
  { id: 'eco_2', cost: 100000 },
  { id: 'eco_3', cost: 150000 },
  { id: 'eco_4', cost: 200000 },
  { id: 'eco_5', cost: 300000 },
  { id: 'eco_6', cost: 400000 },
  { id: 'eco_7', cost: 500000 },
]

// ═══════════════════════════════════════════════
//  GET /api/research/:countryCode — Fetch unlocked nodes
// ═══════════════════════════════════════════════

router.get('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params
    const [row] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, countryCode)).limit(1)

    res.json({
      success: true,
      research: row
        ? { military: row.militaryUnlocked, economy: row.economyUnlocked }
        : { military: [], economy: [] },
    })
  } catch (err) {
    console.error('[RESEARCH] Fetch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/research/unlock — Unlock a research node
// ═══════════════════════════════════════════════

const unlockSchema = z.object({
  countryCode: z.string().min(2).max(4),
  tree: z.enum(['military', 'economy']),
  nodeId: z.string().min(3).max(8),
})

router.post('/unlock', requireAuth as any, validate(unlockSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, tree, nodeId } = req.body

    // Verify caller is president or congress
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player) { res.status(404).json({ error: 'Not found' }); return }

    const congress = (gov.congress as string[]) || []
    const isPresident = gov.president === player.name
    const isCongress = congress.includes(player.name!)
    if (!isPresident && !isCongress) {
      res.status(403).json({ error: 'Only president or congress can unlock research.' }); return
    }

    // Verify player's country matches
    if (player.countryCode !== countryCode) {
      res.status(400).json({ error: 'Not your country.' }); return
    }

    // Get current research
    let [research] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, countryCode)).limit(1)

    if (!research) {
      // Create default row
      await db.insert(countryResearch).values({ countryCode })
      ;[research] = await db.select().from(countryResearch)
        .where(eq(countryResearch.countryCode, countryCode)).limit(1)
    }

    const nodes = tree === 'military' ? MILITARY_DOCTRINE : ECONOMIC_THEORY
    const unlocked = (tree === 'military' ? research.militaryUnlocked : research.economyUnlocked) as string[]

    // Already unlocked?
    if (unlocked.includes(nodeId)) {
      res.status(400).json({ error: 'Already researched.' }); return
    }

    // Find node index and verify prerequisite
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx < 0) { res.status(400).json({ error: 'Invalid node.' }); return }
    if (idx > 0 && !unlocked.includes(nodes[idx - 1].id)) {
      res.status(400).json({ error: 'Must unlock previous research first.' }); return
    }

    const cost = nodes[idx].cost

    // Deduct from country treasury (atomic)
    const deductResult = await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          fund, '{money}',
          to_jsonb(COALESCE((fund->>'money')::bigint, 0) - ${cost})
        )
      WHERE code = ${countryCode}
        AND COALESCE((fund->>'money')::bigint, 0) >= ${cost}
      RETURNING code
    `)

    if ((deductResult as any).length === 0) {
      res.status(400).json({ error: `Treasury needs $${cost.toLocaleString()} for this research.` }); return
    }

    // Add to unlocked list
    const newUnlocked = [...unlocked, nodeId]
    const column = tree === 'military' ? 'military_unlocked' : 'economy_unlocked'
    await db.execute(sql`
      UPDATE country_research SET ${sql.raw(column)} = ${JSON.stringify(newUnlocked)}::jsonb
      WHERE country_code = ${countryCode}
    `)

    res.json({ success: true, message: `Research unlocked: ${nodeId}`, unlocked: newUnlocked })
  } catch (err) {
    console.error('[RESEARCH] Unlock error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

// ── Additional endpoints using the new unlock registry ─────────────────────────

// GET /api/research/available
router.get('/available', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ countryCode: players.countryCode })
      .from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) {
      res.status(400).json({ error: 'Player has no country', code: 'NO_COUNTRY' }); return
    }
    const [research] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, player.countryCode)).limit(1)
    const militaryDone = (research?.militaryUnlocked ?? []) as string[]
    const economyDone  = (research?.economyUnlocked  ?? []) as string[]
    const currentQueue = research?.currentResearch as { key: string; type: string; startedAt: string; durationMs: number; endsAt: string } | null
    res.json({
      success: true,
      countryCode: player.countryCode,
      currentResearch: currentQueue,
      military: Object.entries(MILITARY_UNLOCKS).map(([key, def]) => ({
        key, type: 'military', ...def,
        unlocked: militaryDone.includes(key),
        inProgress: currentQueue?.key === key,
      })),
      economy: Object.entries(ECONOMY_UNLOCKS).map(([key, def]) => ({
        key, type: 'economy', ...def,
        unlocked: economyDone.includes(key),
        inProgress: currentQueue?.key === key,
      })),
    })
  } catch (err) {
    console.error('[RESEARCH] available error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// POST /api/research/start — start a research item from the unlock registry
router.post('/start', requireAuth as any, validate(z.object({ unlockKey: z.string() })), async (req, res) => {
  try {
    const { unlockKey } = req.body
    const { playerId, playerName } = (req as AuthRequest).player!
    const type = unlockType(unlockKey)
    if (!type) { res.status(400).json({ error: 'Unknown unlock key', code: 'UNKNOWN_UNLOCK' }); return }
    const def = (type === 'military' ? MILITARY_UNLOCKS : ECONOMY_UNLOCKS)[unlockKey]
    if (!def) { res.status(400).json({ error: 'Unknown unlock key', code: 'UNKNOWN_UNLOCK' }); return }
    const [player] = await db.select({ countryCode: players.countryCode, money: players.money })
      .from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'Player has no country', code: 'NO_COUNTRY' }); return }
    if ((player.money ?? 0) < def.cost) {
      res.status(400).json({ error: `Insufficient funds. Research costs $${def.cost.toLocaleString()}`, code: 'INSUFFICIENT_FUNDS' }); return
    }
    const [research] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, player.countryCode)).limit(1)
    const currentQueue = research?.currentResearch as { key: string } | null
    if (currentQueue) {
      res.status(409).json({ error: `Research in progress: ${currentQueue.key}`, code: 'RESEARCH_IN_PROGRESS' }); return
    }
    const done = ((type === 'military' ? research?.militaryUnlocked : research?.economyUnlocked) ?? []) as string[]
    if (done.includes(unlockKey)) { res.status(409).json({ error: 'Already unlocked', code: 'ALREADY_UNLOCKED' }); return }
    const now = new Date()
    const endsAt = new Date(now.getTime() + def.researchDurationMs)
    const queue = { key: unlockKey, type, startedAt: now.toISOString(), durationMs: def.researchDurationMs, endsAt: endsAt.toISOString() }
    await db.transaction(async (tx) => {
      await tx.update(players).set({ money: (player.money ?? 0) - def.cost }).where(eq(players.id, playerId))
      await tx.insert(countryResearch).values({ countryCode: player.countryCode!, currentResearch: queue })
        .onConflictDoUpdate({ target: countryResearch.countryCode, set: { currentResearch: queue } })
      await tx.insert(newsEvents).values({
        type: 'research_started',
        headline: `🔬 ${playerName} started research: ${def.label} (${player.countryCode})`,
        body: null, countryCode: player.countryCode,
        data: { unlockKey, type, endsAt: endsAt.toISOString() },
      })
    })
    res.json({ success: true, unlockKey, endsAt: endsAt.toISOString(), cost: def.cost })
  } catch (err) {
    console.error('[RESEARCH] start error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// GET /api/research/status — current queue + auto-complete if done
router.get('/status', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ countryCode: players.countryCode })
      .from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'Player has no country', code: 'NO_COUNTRY' }); return }
    let [research] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, player.countryCode)).limit(1)
    const now = new Date()
    let currentQ = research?.currentResearch as { key: string; type: 'military'|'economy'; endsAt: string } | null
    if (currentQ && new Date(currentQ.endsAt) <= now) {
      const field = currentQ.type === 'military' ? 'military_unlocked' : 'economy_unlocked'
      const done = ((currentQ.type === 'military' ? research?.militaryUnlocked : research?.economyUnlocked) ?? []) as string[]
      if (!done.includes(currentQ.key)) {
        await db.execute(sql`UPDATE country_research SET ${sql.raw(field)} = ${JSON.stringify([...done, currentQ.key])}::jsonb, current_research = NULL WHERE country_code = ${player.countryCode}`)
      } else {
        await db.update(countryResearch).set({ currentResearch: null }).where(eq(countryResearch.countryCode, player.countryCode!))
      }
      currentQ = null
      ;[research] = await db.select().from(countryResearch).where(eq(countryResearch.countryCode, player.countryCode!)).limit(1)
    }
    res.json({
      success: true, countryCode: player.countryCode,
      currentResearch: currentQ,
      militaryUnlocked: (research?.militaryUnlocked ?? []) as string[],
      economyUnlocked: (research?.economyUnlocked ?? []) as string[],
    })
  } catch (err) {
    console.error('[RESEARCH] status error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})
