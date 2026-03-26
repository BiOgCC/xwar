/**
 * Admin / Debug Router — dev-only, gated by NODE_ENV !== 'production'.
 *
 * ── Country Randomizer ──
 * GET  /api/admin/country/:cc/preview     — current regions + ley lines for a country
 * POST /api/admin/country/:cc/randomize   — randomly assign regions & regenerate ley lines
 *
 * GET  /api/admin/stats                       — live game stats + economy KPIs
 * GET  /api/admin/economy?window=7|14|30|360   — economy flow data for time window
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
import {
  players, battles, wars, tradeRouteState, newsEvents,
  leyLineDefs, regionOwnership, countries, armies,
  companies, items, marketOrders, tradeHistory, casinoResults,
} from '../db/schema.js'
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

// ── Helper: extract number from raw SQL row ──
const num = (row: Record<string, unknown> | undefined, key: string) =>
  Number(row?.[key] ?? 0)

// ── Helper: compute Gini coefficient from sorted array ──
function computeGini(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  const total = sorted.reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  let sumOfDiffs = 0
  for (let i = 0; i < n; i++) sumOfDiffs += (2 * (i + 1) - n - 1) * sorted[i]
  return sumOfDiffs / (n * total)
}

// ── Player resource columns we track ──
const PLAYER_RESOURCE_COLS = [
  'money', 'oil', 'material_x', 'scrap', 'bitcoin',
  'wheat', 'fish', 'steak', 'bread', 'sushi', 'wagyu',
  'green_bullets', 'blue_bullets', 'purple_bullets', 'red_bullets',
  'loot_boxes', 'military_boxes', 'badges_of_honor',
  'stamina_pills', 'energy_leaves',
] as const

// ── GET /api/admin/stats ──  (lightweight overview, kept for backward compat)
router.get('/stats', async (_req, res) => {
  try {
    const countPlayers = await db.execute(sql`SELECT COUNT(*) AS count FROM players`)
    const countBattles = await db.execute(sql`SELECT COUNT(*) AS count FROM battles WHERE status = 'active'`)
    const countWars    = await db.execute(sql`SELECT COUNT(*) AS count FROM wars WHERE status = 'active'`)
    const totalMoney   = await db.execute(sql`SELECT COALESCE(SUM(money),0) AS total FROM players`)

    const playerCount   = num(countPlayers[0] as Record<string, unknown>, 'count')
    const activeBattles = num(countBattles[0] as Record<string, unknown>, 'count')
    const activeWars    = num(countWars[0]    as Record<string, unknown>, 'count')
    const totalInCirc   = num(totalMoney[0]   as Record<string, unknown>, 'total')

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

// ── GET /api/admin/economy?window=7|14|30|360 ──
// Full economy KPI dashboard data
router.get('/economy', async (req, res) => {
  try {
    const windowDays = Math.min(Math.max(Number(req.query.window) || 7, 1), 366)

    // ── 1. Resource circulation (player inventories) ──
    const resourceSumsSql = PLAYER_RESOURCE_COLS.map(c => `COALESCE(SUM(${c}), 0) AS "${c}"`).join(', ')
    const playerSums = await db.execute(sql.raw(`SELECT ${resourceSumsSql} FROM players`))
    const playerTotals: Record<string, number> = {}
    for (const col of PLAYER_RESOURCE_COLS) {
      playerTotals[col] = num(playerSums[0] as Record<string, unknown>, col)
    }

    // ── 2. Country fund + forceVault totals (JSONB) ──
    const countryRows = await db.execute(sql`
      SELECT
        COALESCE(SUM((fund->>'money')::numeric), 0)     AS fund_money,
        COALESCE(SUM((fund->>'oil')::numeric), 0)       AS fund_oil,
        COALESCE(SUM((fund->>'materialX')::numeric), 0) AS fund_material_x,
        COALESCE(SUM((fund->>'scraps')::numeric), 0)    AS fund_scrap,
        COALESCE(SUM((fund->>'bitcoin')::numeric), 0)   AS fund_bitcoin,
        COALESCE(SUM((force_vault->>'money')::numeric), 0)     AS vault_money,
        COALESCE(SUM((force_vault->>'oil')::numeric), 0)       AS vault_oil,
        COALESCE(SUM((force_vault->>'materialX')::numeric), 0) AS vault_material_x,
        COALESCE(SUM((force_vault->>'scraps')::numeric), 0)    AS vault_scrap,
        COALESCE(SUM((force_vault->>'bitcoin')::numeric), 0)   AS vault_bitcoin
      FROM countries
    `)
    const cr = (countryRows[0] ?? {}) as Record<string, unknown>
    const countryTotals = {
      money:      num(cr, 'fund_money') + num(cr, 'vault_money'),
      oil:        num(cr, 'fund_oil') + num(cr, 'vault_oil'),
      material_x: num(cr, 'fund_material_x') + num(cr, 'vault_material_x'),
      scrap:      num(cr, 'fund_scrap') + num(cr, 'vault_scrap'),
      bitcoin:    num(cr, 'fund_bitcoin') + num(cr, 'vault_bitcoin'),
    }

    // ── 3. Army vault totals (JSONB) ──
    const armyRows = await db.execute(sql`
      SELECT
        COALESCE(SUM((vault->>'money')::numeric), 0) AS army_money,
        COALESCE(SUM((vault->>'oil')::numeric), 0)   AS army_oil
      FROM armies
    `)
    const ar = (armyRows[0] ?? {}) as Record<string, unknown>
    const armyTotals = {
      money: num(ar, 'army_money'),
      oil:   num(ar, 'army_oil'),
    }

    // ── 4. Combined circulation ──
    const circulation: Record<string, number> = { ...playerTotals }
    circulation.money       = (circulation.money ?? 0) + countryTotals.money + armyTotals.money
    circulation.oil         = (circulation.oil ?? 0) + countryTotals.oil + armyTotals.oil
    circulation.material_x  = (circulation.material_x ?? 0) + countryTotals.material_x
    circulation.scrap       = (circulation.scrap ?? 0) + countryTotals.scrap
    circulation.bitcoin     = (circulation.bitcoin ?? 0) + countryTotals.bitcoin

    // ── 5. Per-player KPIs ──
    const allMoneys = await db.execute(sql`SELECT money FROM players ORDER BY money ASC`)
    const moneyArr = (allMoneys as Record<string, unknown>[]).map(r => Number(r.money ?? 0)).sort((a, b) => a - b)
    const playerCount = moneyArr.length
    const totalMoney = moneyArr.reduce((a, b) => a + b, 0)
    const avgMoney = playerCount > 0 ? Math.round(totalMoney / playerCount) : 0
    const medianMoney = playerCount > 0 ? moneyArr[Math.floor(playerCount / 2)] : 0
    const giniCoefficient = computeGini(moneyArr)

    // Top 10 richest
    const top10 = await db.execute(sql`
      SELECT id, name, country_code, money, level
      FROM players ORDER BY money DESC LIMIT 10
    `)

    // Bottom 25% avg vs top 1
    const bottom25Count = Math.max(1, Math.floor(playerCount * 0.25))
    const bottom25Avg = playerCount > 0
      ? Math.round(moneyArr.slice(0, bottom25Count).reduce((a, b) => a + b, 0) / bottom25Count)
      : 0
    const richestMoney = moneyArr.length > 0 ? moneyArr[moneyArr.length - 1] : 0
    const richPoorRatio = bottom25Avg > 0 ? Math.round(richestMoney / bottom25Avg) : 0

    // ── 6. Time-windowed flows ──
    const intervalStr = `${windowDays} days`

    // Trade volume per resource
    const tradeVol = await db.execute(sql.raw(`
      SELECT item_type,
             COUNT(*)::int AS trade_count,
             COALESCE(SUM(amount), 0)::bigint AS total_amount,
             COALESCE(SUM(total_price::numeric), 0)::bigint AS total_value
      FROM trade_history
      WHERE timestamp > NOW() - INTERVAL '${intervalStr}'
      GROUP BY item_type
      ORDER BY total_value DESC
    `))

    // Casino net flow
    const casinoFlow = await db.execute(sql.raw(`
      SELECT
        COALESCE(SUM(payout), 0)::bigint      AS total_payout,
        COALESCE(SUM(bet_amount), 0)::bigint  AS total_bets,
        COUNT(*)::int                          AS total_spins
      FROM casino_results
      WHERE created_at > NOW() - INTERVAL '${intervalStr}'
    `))
    const cf = (casinoFlow[0] ?? {}) as Record<string, unknown>

    // Items created
    const itemsCreated = await db.execute(sql.raw(`
      SELECT tier, COUNT(*)::int AS count
      FROM items
      WHERE created_at > NOW() - INTERVAL '${intervalStr}'
      GROUP BY tier
      ORDER BY tier
    `))

    // New player registrations
    const newPlayers = await db.execute(sql.raw(`
      SELECT COUNT(*)::int AS count
      FROM players
      WHERE created_at > NOW() - INTERVAL '${intervalStr}'
    `))

    // Active players (logged in within window)
    const activePlayers = await db.execute(sql.raw(`
      SELECT COUNT(*)::int AS count
      FROM players
      WHERE last_login > NOW() - INTERVAL '${intervalStr}'
    `))

    // ── 7. Economy health ──
    const openOrders = await db.execute(sql`
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(total_price::numeric), 0)::bigint AS total_value
      FROM market_orders
      WHERE status = 'open'
    `)
    const oo = (openOrders[0] ?? {}) as Record<string, unknown>

    const companyCount = await db.execute(sql`SELECT COUNT(*)::int AS count FROM companies`)
    const totalItems   = await db.execute(sql`SELECT COUNT(*)::int AS count FROM items`)
    const avgLevel     = await db.execute(sql`SELECT COALESCE(AVG(level), 1)::numeric(4,1) AS avg FROM players`)

    // Market velocity = trades per player in window
    const totalTrades = (tradeVol as Record<string, unknown>[]).reduce(
      (sum, r) => sum + Number((r as Record<string, unknown>).trade_count ?? 0), 0
    )
    const marketVelocity = playerCount > 0 ? +(totalTrades / playerCount).toFixed(2) : 0

    ok(res, {
      windowDays,

      // Resource circulation (combined: players + countries + armies)
      circulation,
      // Breakdown
      playerTotals,
      countryTotals,
      armyTotals,

      // Per-player KPIs
      perPlayer: {
        count: playerCount,
        avgMoney,
        medianMoney,
        giniCoefficient: +giniCoefficient.toFixed(4),
        richPoorRatio,
        top10: (top10 as Record<string, unknown>[]).map(r => ({
          id: r.id, name: r.name, countryCode: r.country_code,
          money: Number(r.money), level: Number(r.level),
        })),
      },

      // Time-windowed flows
      flows: {
        tradeVolume: (tradeVol as Record<string, unknown>[]).map(r => ({
          itemType: r.item_type,
          tradeCount: Number(r.trade_count),
          totalAmount: Number(r.total_amount),
          totalValue: Number(r.total_value),
        })),
        casino: {
          totalPayout: num(cf, 'total_payout'),
          totalBets:   num(cf, 'total_bets'),
          netFlow:     num(cf, 'total_payout') - num(cf, 'total_bets'),
          totalSpins:  num(cf, 'total_spins'),
        },
        itemsCreated: (itemsCreated as Record<string, unknown>[]).map(r => ({
          tier: r.tier, count: Number(r.count),
        })),
        newPlayers:    num((newPlayers[0] ?? {}) as Record<string, unknown>, 'count'),
        activePlayers: num((activePlayers[0] ?? {}) as Record<string, unknown>, 'count'),
      },

      // Economy health
      health: {
        marketVelocity,
        openMarketOrders: num(oo, 'count'),
        openOrdersValue:  num(oo, 'total_value'),
        activeCompanies:  num((companyCount[0] ?? {}) as Record<string, unknown>, 'count'),
        totalItems:       num((totalItems[0] ?? {}) as Record<string, unknown>, 'count'),
        avgPlayerLevel:   Number((avgLevel[0] as Record<string, unknown>)?.avg ?? 1),
      },
    })
  } catch (err) {
    console.error('[admin/economy]', err)
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── GET /api/admin/economy/wealth-distribution ──
// Per-level + per-country wealth stats, σ bands, anomaly detection
router.get('/economy/wealth-distribution', async (_req, res) => {
  try {
    // ── 1. Fetch all player data ──
    const allPlayers = await db.execute(sql`
      SELECT id, name, country_code, level, money FROM players ORDER BY level ASC, money ASC
    `) as Record<string, unknown>[]

    // ── 2. Per-level aggregation ──
    const byLevel = new Map<number, { moneys: number[]; players: { id: string; name: string; cc: string; money: number }[] }>()
    for (const p of allPlayers) {
      const lv = Number(p.level ?? 1)
      const m  = Number(p.money ?? 0)
      if (!byLevel.has(lv)) byLevel.set(lv, { moneys: [], players: [] })
      const bucket = byLevel.get(lv)!
      bucket.moneys.push(m)
      bucket.players.push({ id: String(p.id), name: String(p.name), cc: String(p.country_code ?? ''), money: m })
    }

    const stddev = (arr: number[], avg: number) => {
      if (arr.length < 2) return 0
      const sumSq = arr.reduce((s, v) => s + (v - avg) ** 2, 0)
      return Math.sqrt(sumSq / arr.length)
    }

    const levelStats: {
      level: number; count: number; min: number; max: number; avg: number; median: number
      stddev: number; sigma1: number; sigma2: number; sigma3: number
    }[] = []

    const anomalies: {
      playerId: string; playerName: string; countryCode: string
      level: number; money: number; levelAvg: number; levelStddev: number
      sigmaExceeded: number; severity: 'warning' | 'critical' | 'extreme'
    }[] = []

    for (const [lv, bucket] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
      const sorted = [...bucket.moneys].sort((a, b) => a - b)
      const n   = sorted.length
      const sum = sorted.reduce((a, b) => a + b, 0)
      const avg = n > 0 ? sum / n : 0
      const med = n > 0 ? sorted[Math.floor(n / 2)] : 0
      const sd  = stddev(sorted, avg)

      const s1 = avg + sd
      const s2 = avg + 2 * sd
      const s3 = avg + 3 * sd

      levelStats.push({
        level: lv, count: n,
        min: sorted[0] ?? 0, max: sorted[n - 1] ?? 0,
        avg: Math.round(avg), median: med,
        stddev: Math.round(sd),
        sigma1: Math.round(s1), sigma2: Math.round(s2), sigma3: Math.round(s3),
      })

      // ── Anomaly detection ──
      for (const p of bucket.players) {
        if (sd > 0 && p.money > s1) {
          const sigmasAbove = (p.money - avg) / sd
          let severity: 'warning' | 'critical' | 'extreme' = 'warning'
          let sigmaExceeded = 1
          if (p.money > s3) { severity = 'extreme'; sigmaExceeded = 3 }
          else if (p.money > s2) { severity = 'critical'; sigmaExceeded = 2 }

          anomalies.push({
            playerId: p.id, playerName: p.name, countryCode: p.cc,
            level: lv, money: p.money,
            levelAvg: Math.round(avg), levelStddev: Math.round(sd),
            sigmaExceeded, severity,
          })
        }
      }
    }

    // ── 3. Per-country aggregation ──
    const byCountry = new Map<string, number[]>()
    for (const p of allPlayers) {
      const cc = String(p.country_code ?? 'NONE')
      if (!byCountry.has(cc)) byCountry.set(cc, [])
      byCountry.get(cc)!.push(Number(p.money ?? 0))
    }

    const countryStats = [...byCountry.entries()].map(([cc, moneys]) => {
      const sorted = [...moneys].sort((a, b) => a - b)
      const n = sorted.length
      const sum = sorted.reduce((a, b) => a + b, 0)
      const avg = n > 0 ? sum / n : 0
      const sd = stddev(sorted, avg)
      return {
        countryCode: cc, count: n,
        min: sorted[0] ?? 0, max: sorted[n - 1] ?? 0,
        avg: Math.round(avg), median: sorted[Math.floor(n / 2)] ?? 0,
        stddev: Math.round(sd),
      }
    }).sort((a, b) => b.avg - a.avg)

    // ── 4. Overall stats ──
    const allMoneys = allPlayers.map(p => Number(p.money ?? 0)).sort((a, b) => a - b)
    const totalN = allMoneys.length
    const totalSum = allMoneys.reduce((a, b) => a + b, 0)
    const overallAvg = totalN > 0 ? totalSum / totalN : 0
    const overallSd = stddev(allMoneys, overallAvg)

    ok(res, {
      overall: {
        count: totalN,
        min: allMoneys[0] ?? 0,
        max: allMoneys[totalN - 1] ?? 0,
        avg: Math.round(overallAvg),
        median: totalN > 0 ? allMoneys[Math.floor(totalN / 2)] : 0,
        stddev: Math.round(overallSd),
        sigma1: Math.round(overallAvg + overallSd),
        sigma2: Math.round(overallAvg + 2 * overallSd),
        sigma3: Math.round(overallAvg + 3 * overallSd),
      },
      levelStats,
      countryStats,
      anomalies: anomalies.sort((a, b) => b.sigmaExceeded - a.sigmaExceeded || b.money - a.money),
      anomalyCounts: {
        warning:  anomalies.filter(a => a.severity === 'warning').length,
        critical: anomalies.filter(a => a.severity === 'critical').length,
        extreme:  anomalies.filter(a => a.severity === 'extreme').length,
      },
    })
  } catch (err) {
    console.error('[admin/economy/wealth-distribution]', err)
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

    // Verify the country exists in the countries table (FK guard)
    const [countryRow] = await db.select({ code: countries.code }).from(countries).where(eq(countries.code, cc)).limit(1)
    if (!countryRow) {
      res.status(404).json({ error: `Country '${cc}' does not exist in the countries table. Seed it first.`, code: 'COUNTRY_NOT_FOUND' }); return
    }

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


// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/admin/players-list — Full player list for admin panel
// ─────────────────────────────────────────────────────────────────────────────
router.get('/players-list', async (_req, res) => {
  try {
    const rows = await db.select({
      id:          players.id,
      name:        players.name,
      countryCode: players.countryCode,
      level:       players.level,
      money:       players.money,
      role:        players.role,
      lastLogin:   players.lastLogin,
    }).from(players).orderBy(desc(players.lastLogin))

    ok(res, rows)
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})


// ══════════════════════════════════════════════════════════════════════════════
//  COUNTRIES ADMIN — list, search, partial update
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/countries ──────────────────────────────────────────────────
// Returns all countries with a player count per country
router.get('/countries', async (req, res) => {
  try {
    const search = (req.query.search as string | undefined)?.trim().toUpperCase() ?? ''

    const rows = await db.execute(sql`
      SELECT
        c.code,
        c.name,
        c.controller,
        c.empire,
        c.population,
        c.regions,
        c.military,
        c.color,
        c.fund,
        c.conquered_resources AS "conqueredResources",
        COUNT(p.id)::int AS player_count
      FROM countries c
      LEFT JOIN players p ON p.country_code = c.code
      ${search ? sql`WHERE c.code ILIKE ${'%' + search + '%'} OR c.name ILIKE ${'%' + search + '%'}` : sql``}
      GROUP BY c.code, c.name, c.controller, c.empire, c.population, c.regions, c.military, c.color, c.fund, c.conquered_resources
      ORDER BY c.code ASC
    `) as Record<string, unknown>[]

    ok(res, { count: rows.length, countries: rows })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ── PATCH /api/admin/countries/:code ─────────────────────────────────────────
// Partial update: controller, empire, military score
router.patch('/countries/:code', validate(z.object({
  controller: z.string().min(1).max(128).optional(),
  empire:     z.string().max(64).nullable().optional(),
  military:   z.number().int().min(0).max(100).optional(),
  color:      z.string().max(16).optional(),
})), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase()
    const [row] = await db.select({ code: countries.code }).from(countries).where(eq(countries.code, code)).limit(1)
    if (!row) { res.status(404).json({ error: `Country '${code}' not found`, code: 'NOT_FOUND' }); return }

    const updates: Record<string, unknown> = {}
    if (req.body.controller !== undefined) updates.controller = req.body.controller
    if (req.body.empire     !== undefined) updates.empire     = req.body.empire
    if (req.body.military   !== undefined) updates.military   = req.body.military
    if (req.body.color      !== undefined) updates.color      = req.body.color

    if (Object.keys(updates).length === 0) { res.status(400).json({ error: 'No fields to update', code: 'NO_FIELDS' }); return }

    await db.update(countries).set(updates as any).where(eq(countries.code, code))
    ok(res, { updated: code, fields: Object.keys(updates) })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

// ══════════════════════════════════════════════════════════════════════════════
//  PLAYER ADMIN — role management
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/admin/player/:id/role ──────────────────────────────────────────
// Change player specialization role (military / economic / mercenary / politician / influencer)
router.post('/player/:id/role', validate(z.object({
  role: z.enum(['military', 'economic', 'mercenary', 'politician', 'influencer']),
})), async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body
    const [player] = await db.select({ id: players.id, name: players.name, role: players.role })
      .from(players).where(eq(players.id, id)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' }); return }

    await db.update(players).set({ role }).where(eq(players.id, id))
    ok(res, { playerId: id, name: player.name, previousRole: player.role, newRole: role })
  } catch (err) {
    res.status(500).json({ error: String(err), code: 'INTERNAL' })
  }
})

export default router
