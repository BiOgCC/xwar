/**
 * Research Routes — Country research tree unlock/fetch.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { countries, governments, players, countryResearch } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

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
