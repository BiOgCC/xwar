/**
 * Research Routes — Player-driven RP (Research Points) system.
 *
 * President selects which node to research → citizens contribute RP through
 * gameplay (fight, work, produce, donate) → node auto-unlocks when bar fills.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { countries, governments, players, countryResearch, newsEvents } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// ═══════════════════════════════════════════════
//  Research node definitions with RP thresholds
// ═══════════════════════════════════════════════

interface ResearchNode {
  id: string
  name: string
  rpRequired: number
  effect: string
}

const MILITARY_DOCTRINE: ResearchNode[] = [
  { id: 'mil_1', name: 'Combat Drills',     rpRequired: 100,   effect: '+5% manual attack damage' },
  { id: 'mil_2', name: 'Field Tactics',     rpRequired: 250,   effect: '+5% hit rate' },
  { id: 'mil_3', name: 'Hardened Armor',    rpRequired: 500,   effect: '+10% armor for citizens' },
  { id: 'mil_4', name: 'Precision Strike',  rpRequired: 1000,  effect: '+10% crit damage' },
  { id: 'mil_5', name: 'Tactical Ops',      rpRequired: 2000,  effect: '+15% tactical order effectiveness' },
  { id: 'mil_6', name: 'Counter-Intel',     rpRequired: 3500,  effect: '+10% dodge chance' },
  { id: 'mil_7', name: 'Total War',         rpRequired: 5000,  effect: '+5% all combat stats' },
]

const ECONOMIC_THEORY: ResearchNode[] = [
  { id: 'eco_1', name: 'Labor Reform',      rpRequired: 100,   effect: '+10% work earnings' },
  { id: 'eco_2', name: 'Trade Routes',      rpRequired: 250,   effect: '+5% production output' },
  { id: 'eco_3', name: 'Prospection Tech',  rpRequired: 500,   effect: '+10% prospection find chance' },
  { id: 'eco_4', name: 'Industrial Policy', rpRequired: 1000,  effect: '+10% company output' },
  { id: 'eco_5', name: 'Tax Efficiency',    rpRequired: 2000,  effect: '+15% country auto-income' },
  { id: 'eco_6', name: 'Resource Mastery',  rpRequired: 3500,  effect: '+10% all resource gains' },
  { id: 'eco_7', name: 'Superpower',        rpRequired: 5000,  effect: '+10% all economy' },
]

function getNode(tree: string, nodeId: string): ResearchNode | undefined {
  const nodes = tree === 'military' ? MILITARY_DOCTRINE : ECONOMIC_THEORY
  return nodes.find(n => n.id === nodeId)
}

function getNodes(tree: string): ResearchNode[] {
  return tree === 'military' ? MILITARY_DOCTRINE : ECONOMIC_THEORY
}

// ═══════════════════════════════════════════════
//  GET /api/research/:countryCode — Full research state
// ═══════════════════════════════════════════════

router.get('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params
    const [row] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, countryCode)).limit(1)

    const activeResearch = row?.currentResearch as any || null

    // Build node lists with RP info
    const milUnlocked = ((row?.militaryUnlocked ?? []) as string[])
    const ecoUnlocked = ((row?.economyUnlocked ?? []) as string[])

    // Calculate total RP contributed (completed nodes + active progress)
    let totalRpContributed = 0
    // Sum RP from completed military nodes
    for (const nodeId of milUnlocked) {
      const node = MILITARY_DOCTRINE.find(n => n.id === nodeId)
      if (node) totalRpContributed += node.rpRequired
    }
    // Sum RP from completed economy nodes
    for (const nodeId of ecoUnlocked) {
      const node = ECONOMIC_THEORY.find(n => n.id === nodeId)
      if (node) totalRpContributed += node.rpRequired
    }
    // Add active research progress
    if (activeResearch?.rpCollected) {
      totalRpContributed += activeResearch.rpCollected
    }

    res.json({
      success: true,
      research: {
        military: milUnlocked,
        economy: ecoUnlocked,
      },
      activeResearch: activeResearch ? {
        nodeId: activeResearch.nodeId,
        tree: activeResearch.tree,
        rpCollected: activeResearch.rpCollected || 0,
        rpRequired: activeResearch.rpRequired || 0,
        startedAt: activeResearch.startedAt,
        contributors: activeResearch.contributors || {},
      } : null,
      totalRpContributed,
      nodes: {
        military: MILITARY_DOCTRINE.map(n => ({ ...n, unlocked: milUnlocked.includes(n.id) })),
        economy: ECONOMIC_THEORY.map(n => ({ ...n, unlocked: ecoUnlocked.includes(n.id) })),
      },
    })
  } catch (err) {
    console.error('[RESEARCH] Fetch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/research/select — President picks active research
// ═══════════════════════════════════════════════

const selectSchema = z.object({
  countryCode: z.string().min(2).max(4),
  tree: z.enum(['military', 'economy']),
  nodeId: z.string().min(3).max(8),
})

router.post('/select', requireAuth as any, validate(selectSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, tree, nodeId } = req.body

    // Only president can select
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player) { res.status(404).json({ error: 'Not found' }); return }

    // Auto-assign president if country has none and player belongs to this country
    if (!gov.president && player.countryCode === countryCode) {
      await db.update(governments).set({ president: player.name }).where(eq(governments.countryCode, countryCode))
      gov.president = player.name
    }

    if ((gov.president || '').toLowerCase() !== (player.name || '').toLowerCase()) {
      console.warn(`[RESEARCH] President auth failed: gov.president="${gov.president}" vs player.name="${player.name}" (id=${playerId}, country=${countryCode})`)
      res.status(403).json({ error: 'Only the president can select research.' }); return
    }
    if (player.countryCode !== countryCode) {
      res.status(400).json({ error: 'Not your country.' }); return
    }

    // Get current research state
    let [research] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, countryCode)).limit(1)

    if (!research) {
      await db.insert(countryResearch).values({ countryCode })
      ;[research] = await db.select().from(countryResearch)
        .where(eq(countryResearch.countryCode, countryCode)).limit(1)
    }

    // Check if there's already active research
    const current = research.currentResearch as any
    if (current && current.nodeId) {
      res.status(400).json({ error: `Research already in progress: ${current.nodeId}. Complete it first.` }); return
    }

    // Validate node
    const node = getNode(tree, nodeId)
    if (!node) { res.status(400).json({ error: 'Invalid research node.' }); return }

    // Check not already unlocked
    const unlocked = (tree === 'military' ? research.militaryUnlocked : research.economyUnlocked) as string[]
    if (unlocked.includes(nodeId)) {
      res.status(400).json({ error: 'Already researched.' }); return
    }

    // Check sequential prerequisite
    const nodes = getNodes(tree)
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx > 0 && !unlocked.includes(nodes[idx - 1].id)) {
      res.status(400).json({ error: 'Must complete previous research first.' }); return
    }

    // Set active research
    const activeResearch = {
      nodeId,
      tree,
      rpCollected: 0,
      rpRequired: node.rpRequired,
      startedAt: Date.now(),
      contributors: {},
    }

    await db.update(countryResearch)
      .set({ currentResearch: activeResearch })
      .where(eq(countryResearch.countryCode, countryCode))

    // News event
    await db.insert(newsEvents).values({
      type: 'research_started',
      headline: `🔬 ${countryCode} began researching: ${node.name}`,
      body: null,
      countryCode,
      data: { nodeId, tree, rpRequired: node.rpRequired },
    })

    res.json({
      success: true,
      message: `Research started: ${node.name}! Citizens can now contribute RP.`,
      activeResearch,
    })
  } catch (err) {
    console.error('[RESEARCH] Select error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/research/contribute — Any citizen contributes RP
// ═══════════════════════════════════════════════

const contributeSchema = z.object({
  rp: z.number().int().min(1).max(50),
  source: z.string().max(32).optional(),
})

router.post('/contribute', requireAuth as any, validate(contributeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { rp, source } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'No country.' }); return }

    const countryCode = player.countryCode!

    // Get current research
    const [research] = await db.select().from(countryResearch)
      .where(eq(countryResearch.countryCode, countryCode)).limit(1)

    if (!research) { res.json({ success: false, message: 'No research data.' }); return }

    const current = research.currentResearch as any
    if (!current || !current.nodeId) {
      res.json({ success: false, message: 'No active research. President must select one.' }); return
    }

    // Add RP
    const contributors = current.contributors || {}
    const playerName = player.name || playerId
    contributors[playerName] = (contributors[playerName] || 0) + rp
    const newRp = (current.rpCollected || 0) + rp
    const rpRequired = current.rpRequired || 1

    if (newRp >= rpRequired) {
      // Node complete! Unlock it
      const tree = current.tree as 'military' | 'economy'
      const unlocked = (tree === 'military' ? research.militaryUnlocked : research.economyUnlocked) as string[]
      const newUnlocked = [...unlocked, current.nodeId]
      const column = tree === 'military' ? 'military_unlocked' : 'economy_unlocked'

      await db.execute(sql`
        UPDATE country_research SET
          ${sql.raw(column)} = ${JSON.stringify(newUnlocked)}::jsonb,
          current_research = NULL
        WHERE country_code = ${countryCode}
      `)

      const node = getNode(tree, current.nodeId)

      // News event
      await db.insert(newsEvents).values({
        type: 'research_completed',
        headline: `🎉 ${countryCode} completed research: ${node?.name || current.nodeId}!`,
        body: null,
        countryCode,
        data: { nodeId: current.nodeId, tree, contributors, totalRp: newRp },
      })

      // Broadcast via WebSocket
      try {
        const { emitGameEvent } = await import('../index.js')
        emitGameEvent('research:completed', {
          countryCode, nodeId: current.nodeId, tree,
          nodeName: node?.name, effect: node?.effect,
        }, `country:${countryCode}`)
      } catch { /* ws may not be running */ }

      res.json({
        success: true,
        completed: true,
        message: `Research complete: ${node?.name}! ${node?.effect}`,
        nodeId: current.nodeId,
      })
    } else {
      // Update progress
      const updated = { ...current, rpCollected: newRp, contributors }
      await db.update(countryResearch)
        .set({ currentResearch: updated })
        .where(eq(countryResearch.countryCode, countryCode))

      res.json({
        success: true,
        completed: false,
        rpCollected: newRp,
        rpRequired,
        progress: Math.round((newRp / rpRequired) * 100),
      })
    }
  } catch (err) {
    console.error('[RESEARCH] Contribute error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
