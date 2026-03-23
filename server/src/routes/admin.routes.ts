/**
 * Admin / Debug Router — dev-only, gated by NODE_ENV !== 'production'.
 *
 * GET  /api/admin/stats          — live game stats
 * POST /api/admin/tick           — force-run any cron pipeline
 * POST /api/admin/give           — grant resources to a player
 * GET  /api/admin/logs           — last 100 news_events
 * POST /api/admin/disrupt-route  — force-disrupt a trade route
 * POST /api/admin/reset-player   — reset player to starter state
 */
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, battles, wars, tradeRouteState, newsEvents } from '../db/schema.js'
import { validate } from '../middleware/validate.js'
import { runFastCombatPipeline } from '../services/tick/fast-combat.pipeline.js'
import { runMediumSimPipeline } from '../services/tick/medium-sim.pipeline.js'
import { runSlowEconomyPipeline } from '../services/tick/slow-economy.pipeline.js'
import { runDailyJobsPipeline } from '../services/tick/daily-jobs.pipeline.js'

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

export default router
