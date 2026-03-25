/**
 * Admin / Debug Router — dev-only, gated by NODE_ENV !== 'production'.
 *
 * ── Country Randomizer ──
 * GET  /api/admin/country/:cc/preview     — current regions + ley lines for a country
 * POST /api/admin/country/:cc/randomize   — randomly assign regions & regenerate ley lines
 *
 * GET  /api/admin/stats                       — live game stats
 * POST /api/admin/tick                        — force-run any cron pipeline
 * POST /api/admin/give                        — grant resources to a player
 * GET  /api/admin/logs                        — last 100 news_events
 * POST /api/admin/disrupt-route               — force-disrupt a trade route
 * POST /api/admin/reset-player                — reset player to starter state
 *
 * ── Ley Line Admin ──
 * GET  /api/admin/ley-lines                   — list all DB-defined lines
 * POST /api/admin/ley-lines                   — create a new line
 * GET  /api/admin/ley-lines/:id               — get single line
 * PATCH /api/admin/ley-lines/:id              — update a line (partial)
 * DELETE /api/admin/ley-lines/:id             — delete a line
 * POST /api/admin/ley-lines/:id/enable        — enable a disabled line
 * POST /api/admin/ley-lines/:id/disable       — disable without deleting
 * POST /api/admin/ley-lines/generate/:cc      — auto-generate 3 lines for country
 * POST /api/admin/ley-lines/generate-all      — auto-generate for ALL countries
 * POST /api/admin/ley-lines/run-engine        — force-run the ley line engine
 */
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, battles, wars, tradeRouteState, newsEvents, leyLineDefs, regionOwnership } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { runFastCombatPipeline } from '../services/tick/fast-combat.pipeline.js'
import { runMediumSimPipeline } from '../services/tick/medium-sim.pipeline.js'
import { runSlowEconomyPipeline } from '../services/tick/slow-economy.pipeline.js'
import { runDailyJobsPipeline } from '../services/tick/daily-jobs.pipeline.js'
import { runLeyLineEngine } from '../pipelines/leyline.engine.js'
import { generateLeyLinesForCountry, COUNTRY_CONTINENT } from '../config/leyLineGenerator.server.js'
import { LEY_LINE_DEFS } from '../config/leyLineRegistry.server.js'

const router = Router()

// ── Dev-only guard ──
router.use((_req: Request, res: Response, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).end(); return
  }
  next()
})

const ok = (res: Response, result: unknown) =>
  res.json({ ok: true, executedAt: new Date().toISOString(), result })

// ── GET /api/admin/stats ──
router.get('/stats', async (_req, res) => {
  try {
    const countPlayers = await db.execute(sql`SELECT COUNT(*) AS count FROM players`)
    const countBattles = await db.execute(sql`SELECT COUNT(*) AS count FROM battles WHERE status = 'active'`)
    const countWars    = await db.execute(sql`SELECT COUNT(*) AS count FROM wars WHERE status = 'active'`)
    const totalMoney   = await db.execute(sql`SELECT COALESCE(SUM(money),0) AS total FROM players`)

    const playerCount   = Number((countPlayers[0] as Record<string, unknown>)?.count ?? 0)
    const activeBattles = Number((countBattles[0] as Record<string, unknown>)?.count ?? 0)
    const activeWars    = Number((countWars[0]    as Record<string, unknown>)?.count ?? 0)
    const totalInCirc   = Number((totalMoney[0]   as Record<string, unknown>)?.total ?? 0)

    const disrupted = await db.select({ routeId: tradeRouteState.routeId })
      .from(tradeRouteState)
      .where(sql`disrupted_until > NOW()`)

    ok(res, {
      playerCount,
      activeBattles,
      activeWars,
      totalMoneyInCirculation: totalInCirc,
      disruptedTradeRoutes: disrupted.map(d => d.routeId),
    })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/tick ──
router.post('/tick', validate(z.object({
  pipeline: z.enum(['fast', 'medium', 'slow', 'daily']),
  job: z.string().optional(),
})), async (req, res) => {
  try {
    const { pipeline, job } = req.body
    let result: string
    if (pipeline === 'fast') { await runFastCombatPipeline(); result = 'fast-combat pipeline executed' }
    else if (pipeline === 'medium') { await runMediumSimPipeline(); result = 'medium-sim pipeline executed' }
    else if (pipeline === 'slow') { await runSlowEconomyPipeline(); result = 'slow-economy pipeline executed' }
    else if (pipeline === 'daily' && job) { await runDailyJobsPipeline(job); result = `daily job '${job}' executed` }
    else { res.status(400).json({ error: 'For daily pipeline, provide job name', code: 'MISSING_JOB' }); return }
    ok(res, { pipeline, result })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/give ──
router.post('/give', validate(z.object({
  playerId: z.string().uuid(),
  money: z.number().int().optional(),
  oil: z.number().int().optional(),
  materialX: z.number().int().optional(),
  bitcoin: z.number().int().optional(),
})), async (req, res) => {
  try {
    const { playerId, money = 0, oil = 0, materialX = 0, bitcoin = 0 } = req.body
    const [player] = await db.select({ id: players.id, name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' }); return }
    await db.update(players).set({
      money: sql`${players.money} + ${money}`,
      oil: sql`${players.oil} + ${oil}`,
      materialX: sql`${players.materialX} + ${materialX}`,
      bitcoin: sql`${players.bitcoin} + ${bitcoin}`,
    }).where(eq(players.id, playerId))
    ok(res, { playerId, name: player.name, granted: { money, oil, materialX, bitcoin } })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── GET /api/admin/logs ──
router.get('/logs', async (_req, res) => {
  try {
    const logs = await db.select().from(newsEvents).orderBy(desc(newsEvents.createdAt)).limit(100)
    ok(res, logs)
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/disrupt-route ──
router.post('/disrupt-route', validate(z.object({
  routeId: z.string(),
  minutes: z.number().int().min(1).max(1440).default(30),
})), async (req, res) => {
  try {
    const { routeId, minutes } = req.body
    const disruptedUntil = new Date(Date.now() + minutes * 60 * 1000)
    await db.insert(tradeRouteState).values({
      routeId,
      disruptedUntil,
      disruptedReason: 'admin force-disruption',
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: tradeRouteState.routeId,
      set: { disruptedUntil, disruptedReason: 'admin force-disruption', updatedAt: new Date() },
    })
    ok(res, { routeId, disruptedUntil: disruptedUntil.toISOString() })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/reset-player ──
router.post('/reset-player', validate(z.object({ playerId: z.string().uuid() })), async (req, res) => {
  try {
    const { playerId } = req.body
    const [player] = await db.select({ id: players.id, name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' }); return }
    await db.update(players).set({
      money: 10000,
      oil: 0, materialX: 0, scrap: 0, bitcoin: 0,
      wheat: 0, fish: 0, steak: 0, bread: 0,
      stamina: '120', maxStamina: 120,
      hunger: 6, maxHunger: 6,
      entrepreneurship: 120, maxEntrepreneurship: 120,
      work: 120, maxWork: 120,
      level: 1, experience: 0, expToNext: 100, skillPoints: 0,
      damageDone: 0, deathCount: 0, battlesLost: 0,
    }).where(eq(players.id, playerId))
    ok(res, { playerId, name: player.name, reset: true })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
//  LEY LINE ADMIN — Full CRUD + generation
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/ley-lines ──────────────────────────────────────────────────
// List all lines: DB-defined rows first, then static registry fallback
router.get('/ley-lines', async (_req, res) => {
  try {
    const dbLines = await db.select().from(leyLineDefs).orderBy(leyLineDefs.continent, leyLineDefs.countryCode, leyLineDefs.archetype)

    // Also include hardcoded lines not yet in DB (for visibility)
    const dbIds = new Set(dbLines.map(l => l.id))
    const staticOnly = LEY_LINE_DEFS.filter(l => !dbIds.has(l.id)).map(l => ({ ...l, enabled: true, autoGen: false, source: 'static' }))

    ok(res, {
      count: dbLines.length + staticOnly.length,
      dbLines,
      staticFallbackLines: staticOnly,
    })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/ley-lines ─────────────────────────────────────────────────
// Create a new line manually
const LeyLineSchema = z.object({
  id:          z.string().min(3).max(32),
  name:        z.string().min(3).max(128),
  continent:   z.enum(['north_america','south_america','europe','africa','asia','oceania']),
  archetype:   z.enum(['dominion','prosperity','convergence']),
  blocks:      z.array(z.string()).min(2),
  bonuses:     z.record(z.number()).default({}),
  tradeoffs:   z.record(z.number()).default({}),
  countryCode: z.string().length(2).optional(),
  enabled:     z.boolean().default(true),
})

router.post('/ley-lines', validate(LeyLineSchema), async (req, res) => {
  try {
    const now = new Date()
    await db.insert(leyLineDefs).values({
      ...req.body,
      autoGen: false,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: leyLineDefs.id,
      set: { ...req.body, updatedAt: now },
    })
    ok(res, { created: req.body.id })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── GET /api/admin/ley-lines/generate-all ────────────────────────────────────
// MUST come before /:id
router.post('/ley-lines/generate-all', async (_req, res) => {
  try {
    // Get all distinct country codes from region_ownership
    const rows = await db.selectDistinct({ cc: regionOwnership.countryCode }).from(regionOwnership)
    const countryCodes = rows.map(r => r.cc).filter(Boolean) as string[]

    // Also include countries from the continent map (even without ownership rows)
    const allCCs = [...new Set([...countryCodes, ...Object.keys(COUNTRY_CONTINENT)])]

    let generated = 0
    let skipped   = 0
    const now     = new Date()

    for (const cc of allCCs) {
      // Get ordered region IDs for this country
      const ownerRows = await db
        .select({ regionId: regionOwnership.regionId })
        .from(regionOwnership)
        .where(eq(regionOwnership.countryCode, cc))

      const regionIds = ownerRows.map(r => r.regionId)
      if (regionIds.length < 2) { skipped++; continue }

      const lines = generateLeyLinesForCountry({ countryCode: cc, regionIds })

      for (const line of Object.values(lines)) {
        await db.insert(leyLineDefs).values({
          id:          line.id,
          name:        line.name,
          continent:   line.continent,
          archetype:   line.archetype,
          blocks:      line.blocks,
          bonuses:     line.bonuses,
          tradeoffs:   line.tradeoffs,
          countryCode: cc,
          enabled:     true,
          autoGen:     true,
          createdAt:   now,
          updatedAt:   now,
        }).onConflictDoUpdate({
          target: leyLineDefs.id,
          set: {
            name: line.name, blocks: line.blocks,
            bonuses: line.bonuses, tradeoffs: line.tradeoffs,
            updatedAt: now,
          },
        })
        generated++
      }
    }

    ok(res, { generated, skipped, total: allCCs.length })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/ley-lines/generate/:cc ───────────────────────────────────
// Auto-generate 3 lines for one country
router.post('/ley-lines/generate/:cc', async (req, res) => {
  try {
    const cc = req.params.cc.toUpperCase()

    const ownerRows = await db
      .select({ regionId: regionOwnership.regionId })
      .from(regionOwnership)
      .where(eq(regionOwnership.countryCode, cc))

    const regionIds = ownerRows.map(r => r.regionId)

    if (regionIds.length < 2) {
      // Fall back to static registry region IDs for this country
      const staticRegions = LEY_LINE_DEFS
        .filter(l => l.blocks.some(b => b.startsWith(`${cc}-`)))
        .flatMap(l => l.blocks.filter(b => b.startsWith(`${cc}-`)))
      if (staticRegions.length < 2) {
        res.status(400).json({ error: `Not enough regions for ${cc}`, code: 'INSUFFICIENT_REGIONS' })
        return
      }
      regionIds.push(...staticRegions)
    }

    const lines = generateLeyLinesForCountry({ countryCode: cc, regionIds: [...new Set(regionIds)] })
    const now   = new Date()

    for (const line of Object.values(lines)) {
      await db.insert(leyLineDefs).values({
        id:          line.id,
        name:        line.name,
        continent:   line.continent,
        archetype:   line.archetype,
        blocks:      line.blocks,
        bonuses:     line.bonuses,
        tradeoffs:   line.tradeoffs,
        countryCode: cc,
        enabled:     true,
        autoGen:     true,
        createdAt:   now,
        updatedAt:   now,
      }).onConflictDoUpdate({
        target: leyLineDefs.id,
        set: {
          name: line.name, blocks: line.blocks,
          bonuses: line.bonuses, tradeoffs: line.tradeoffs,
          updatedAt: now,
        },
      })
    }

    ok(res, { cc, generated: Object.values(lines).map(l => ({ id: l.id, name: l.name, blocks: l.blocks.length })) })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/ley-lines/run-engine ─────────────────────────────────────
router.post('/ley-lines/run-engine', async (_req, res) => {
  try {
    const result = await runLeyLineEngine()
    ok(res, {
      lines:        result.lineStates.size,
      nodes:        result.nodeStates.size,
      countries:    result.countryBuffs.size,
      activations:  result.newActivations,
      deactivations:result.newDeactivations,
      computedAt:   result.computedAt.toISOString(),
    })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── GET /api/admin/ley-lines/:id ─────────────────────────────────────────────
router.get('/ley-lines/:id', async (req, res) => {
  try {
    const [row] = await db.select().from(leyLineDefs).where(eq(leyLineDefs.id, req.params.id)).limit(1)
    if (!row) {
      // Check static fallback
      const staticLine = LEY_LINE_DEFS.find(l => l.id === req.params.id)
      if (!staticLine) { res.status(404).json({ error: 'Line not found', code: 'NOT_FOUND' }); return }
      res.json({ ...staticLine, enabled: true, autoGen: false, source: 'static' }); return
    }
    ok(res, row)
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── PATCH /api/admin/ley-lines/:id ───────────────────────────────────────────
// Partial update — admin edits name, blocks, bonuses, etc.
router.patch('/ley-lines/:id', validate(LeyLineSchema.partial().omit({ id: true })), async (req, res) => {
  try {
    const { id } = req.params
    const updates = { ...req.body, updatedAt: new Date() }
    const result = await db.update(leyLineDefs).set(updates).where(eq(leyLineDefs.id, id))
    ok(res, { updated: id, fields: Object.keys(req.body) })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── DELETE /api/admin/ley-lines/:id ──────────────────────────────────────────
router.delete('/ley-lines/:id', async (req, res) => {
  try {
    await db.delete(leyLineDefs).where(eq(leyLineDefs.id, req.params.id))
    ok(res, { deleted: req.params.id })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/ley-lines/:id/enable ─────────────────────────────────────
router.post('/ley-lines/:id/enable', async (req, res) => {
  try {
    await db.update(leyLineDefs).set({ enabled: true, updatedAt: new Date() }).where(eq(leyLineDefs.id, req.params.id))
    ok(res, { id: req.params.id, enabled: true })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── POST /api/admin/ley-lines/:id/disable ────────────────────────────────────
router.post('/ley-lines/:id/disable', async (req, res) => {
  try {
    await db.update(leyLineDefs).set({ enabled: false, updatedAt: new Date() }).where(eq(leyLineDefs.id, req.params.id))
    ok(res, { id: req.params.id, enabled: false })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
//  COUNTRY RANDOMIZER — preview & randomize regions + ley lines for any country
//
//  GET  /api/admin/country/:cc/preview    — current regions + ley lines
//  POST /api/admin/country/:cc/randomize  — randomly assign regions & regen ley lines
// ══════════════════════════════════════════════════════════════════════════════

router.get('/country/:cc/preview', async (req, res) => {
  try {
    const cc = req.params.cc.toUpperCase()
    if (!COUNTRY_CONTINENT[cc]) {
      res.status(400).json({ error: `Unknown country code: ${cc}`, code: 'UNKNOWN_CC' }); return
    }
    const [regions, lines] = await Promise.all([
      db.select().from(regionOwnership).where(eq(regionOwnership.countryCode, cc)),
      db.select().from(leyLineDefs).where(eq(leyLineDefs.countryCode, cc)),
    ])
    ok(res, {
      cc,
      continent:    COUNTRY_CONTINENT[cc],
      regionCount:  regions.length,
      regions:      regions.map(r => ({ regionId: r.regionId, allianceId: r.allianceId, capturedAt: r.capturedAt })),
      leyLineCount: lines.length,
      leyLines:     lines.map(l => ({ id: l.id, name: l.name, archetype: l.archetype, blocks: l.blocks, enabled: l.enabled })),
    })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

router.post('/country/:cc/randomize', validate(z.object({
  regionCount: z.number().int().min(2).max(20).optional(),
  clear:       z.boolean().optional().default(false),
})), async (req, res) => {
  try {
    const cc = req.params.cc.toUpperCase()
    if (!COUNTRY_CONTINENT[cc]) {
      res.status(400).json({ error: `Unknown country code: ${cc}`, code: 'UNKNOWN_CC' }); return
    }

    const { clear = false } = req.body
    const totalRegions: number = req.body.regionCount ?? (4 + Math.floor(Math.random() * 6))

    // Build pool from real region IDs for this country (server-side lookup)
    // Real IDs example: JP-HK, JP-TH, JP-KT, JP-CB, JP-KS, JP-CG, JP-SK, JP-KY
    // We derive them from DB ownership rows first, then fall back to synthetic
    const existingRows = await db
      .select({ regionId: regionOwnership.regionId })
      .from(regionOwnership)
      .where(eq(regionOwnership.countryCode, cc))

    // Also include any real regions already known from ley line defs for this country
    const existingLeyLines = await db
      .select({ blocks: leyLineDefs.blocks })
      .from(leyLineDefs)
      .where(eq(leyLineDefs.countryCode, cc))

    const knownReal: string[] = [
      ...existingRows.map(r => r.regionId),
      ...existingLeyLines.flatMap(l => l.blocks as string[]),
    ].filter(id => id.startsWith(`${cc}-`) && !id.match(/-R\d+$/)) // exclude fake R1-style IDs

    // Build pool: prefer real IDs, fallback to synthetic only if needed
    const realPool = [...new Set(knownReal)]
    const syntheticFallback = Array.from({ length: 20 }, (_, i) => `${cc}-R${i + 1}`)
    const pool = realPool.length >= 2 ? realPool : syntheticFallback
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const chosen = pool.slice(0, totalRegions)
    const now    = new Date()

    if (clear) {
      await db.delete(regionOwnership).where(eq(regionOwnership.countryCode, cc))
    }

    for (const regionId of chosen) {
      await db.insert(regionOwnership).values({
        regionId,
        countryCode: cc,
        allianceId:  null,
        capturedAt:  now,
        updatedAt:   now,
      }).onConflictDoUpdate({
        target: regionOwnership.regionId,
        set:    { countryCode: cc, updatedAt: now },
      })
    }

    const lines = generateLeyLinesForCountry({ countryCode: cc, regionIds: chosen })
    const generatedIds: string[] = []

    for (const line of Object.values(lines)) {
      await db.insert(leyLineDefs).values({
        id:          line.id,
        name:        line.name,
        continent:   line.continent,
        archetype:   line.archetype,
        blocks:      line.blocks,
        bonuses:     line.bonuses,
        tradeoffs:   line.tradeoffs,
        countryCode: cc,
        enabled:     true,
        autoGen:     true,
        createdAt:   now,
        updatedAt:   now,
      }).onConflictDoUpdate({
        target: leyLineDefs.id,
        set: {
          name:      line.name,
          blocks:    line.blocks,
          bonuses:   line.bonuses,
          tradeoffs: line.tradeoffs,
          updatedAt: now,
        },
      })
      generatedIds.push(line.id)
    }

    ok(res, {
      cc,
      continent:         COUNTRY_CONTINENT[cc],
      cleared:           clear,
      regionsAssigned:   chosen,
      regionCount:       chosen.length,
      leyLinesGenerated: generatedIds,
      leyLines:          Object.values(lines).map(l => ({
        id:        l.id,
        name:      l.name,
        archetype: l.archetype,
        blocks:    l.blocks,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

export default router
