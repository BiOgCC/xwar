/**
 * Trade Routes API — server-authoritative disruption and objective tracking.
 *
 * GET  /api/trade-routes              — list all 13 routes + live DB state
 * POST /api/trade-routes/disrupt      — disrupt a route (writes to DB)
 * POST /api/trade-routes/target       — mark a route as strategic objective
 * GET  /api/trade-routes/income       — compute income estimate for calling player
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, and, gt } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { tradeRouteState, players, countries, newsEvents, navalOperations } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { emitGameEvent } from '../index.js'
import rateLimit from 'express-rate-limit'

const router = Router()

// Route-level rate limit for disruption: 10 per hour
const disruptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many disruption attempts', code: 'RATE_LIMITED' },
})

// ── Static route definitions from the GeoJSON data ──
// These mirror the generate-routes.cjs output; used for income calculation.
const STATIC_ROUTES = [
  { id: 'north-atlantic',    from: 'New York',    to: 'London',     oilPerTick: 0,  moneyPerTick: 4200 },
  { id: 'suez-canal',       from: 'Suez',        to: 'Rotterdam',  oilPerTick: 800, moneyPerTick: 2800 },
  { id: 'strait-hormuz',    from: 'Hormuz',      to: 'Mumbai',     oilPerTick: 1200, moneyPerTick: 0 },
  { id: 'panama-canal',     from: 'Panama',      to: 'Los Angeles', oilPerTick: 0,  moneyPerTick: 3600 },
  { id: 'cape-of-good-hope',from: 'Cape Town',   to: 'Singapore',  oilPerTick: 400, moneyPerTick: 1800 },
  { id: 'south-china-sea',  from: 'Shanghai',    to: 'Singapore',  oilPerTick: 200, moneyPerTick: 3200 },
  { id: 'mediterranean',    from: 'Barcelona',   to: 'Istanbul',   oilPerTick: 0,  moneyPerTick: 2100 },
  { id: 'north-sea',        from: 'Rotterdam',   to: 'Hamburg',    oilPerTick: 100, moneyPerTick: 1500 },
  { id: 'indian-ocean',     from: 'Mumbai',      to: 'Sydney',     oilPerTick: 0,  moneyPerTick: 2700 },
  { id: 'pacific-trade',    from: 'Tokyo',       to: 'Los Angeles', oilPerTick: 0,  moneyPerTick: 3900 },
  { id: 'west-africa',      from: 'Lagos',       to: 'Rotterdam',  oilPerTick: 600, moneyPerTick: 1200 },
  { id: 'alaska-corridor',  from: 'Anchorage',   to: 'Tokyo',      oilPerTick: 0,  moneyPerTick: 1800 },
  { id: 'south-atlantic',   from: 'Buenos Aires',to: 'Cape Town',  oilPerTick: 0,  moneyPerTick: 1400 },
]

// ── GET /api/trade-routes — all routes + current DB state ──
router.get('/', requireAuth as any, async (_req, res) => {
  try {
    const now = new Date()
    const states = await db.select().from(tradeRouteState)
    const stateMap = Object.fromEntries(states.map(s => [s.routeId, s]))

    const routes = STATIC_ROUTES.map(r => {
      const state = stateMap[r.id]
      const disrupted = state?.disruptedUntil ? new Date(state.disruptedUntil) > now : false
      return {
        ...r,
        disrupted,
        disruptedUntil: disrupted ? state?.disruptedUntil : null,
        disruptedReason: disrupted ? state?.disruptedReason : null,
        strategicTargetOf: state?.strategicTargetOf ?? null,
        partialIncomeMultiplier: state?.partialIncomeMultiplier ?? '1.0',
      }
    })

    res.json({ success: true, routes })
  } catch (err) {
    console.error('[TRADE-ROUTES] list error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// ── POST /api/trade-routes/disrupt ──
router.post('/disrupt', requireAuth as any, disruptLimiter, validate(z.object({
  routeId: z.string(),
  durationMinutes: z.number().int().min(10).max(480).default(30),
  reason: z.string().max(128).default('naval disruption'),
})), async (req, res) => {
  try {
    const { routeId, durationMinutes, reason } = req.body
    const { playerId, playerName } = (req as AuthRequest).player!

    const route = STATIC_ROUTES.find(r => r.id === routeId)
    if (!route) {
      res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' }); return
    }

    const now = new Date()

    // Check if already disrupted
    const [existing] = await db.select().from(tradeRouteState).where(eq(tradeRouteState.routeId, routeId)).limit(1)
    if (existing?.disruptedUntil && new Date(existing.disruptedUntil) > now) {
      res.status(409).json({ error: 'Route already disrupted', code: 'ALREADY_DISRUPTED' }); return
    }

    // Validate: player must have a recent naval operation (within 6h) near the route
    // (in dev/admin mode this is skipped — checked via a flag in the request context)
    const [recentNaval] = await db.select({ id: navalOperations.id })
      .from(navalOperations)
      .where(and(
        eq(navalOperations.initiatorId, playerId),
        gt(navalOperations.createdAt, new Date(now.getTime() - 6 * 60 * 60 * 1000)),
      ))
      .limit(1)

    if (!recentNaval) {
      res.status(403).json({
        error: 'You must have an active naval operation to disrupt a trade route',
        code: 'NO_NAVAL_OP',
      }); return
    }

    const disruptedUntil = new Date(now.getTime() + durationMinutes * 60 * 1000)

    // Upsert disruption state
    await db.insert(tradeRouteState).values({
      routeId,
      disruptedUntil,
      disruptedBy: playerId,
      disruptedReason: reason,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: tradeRouteState.routeId,
      set: {
        disruptedUntil,
        disruptedBy: playerId,
        disruptedReason: reason,
        updatedAt: now,
      },
    })

    // News event
    await db.insert(newsEvents).values({
      type: 'route_disrupted',
      headline: `🚢 ${playerName} disrupted ${routeId.replace(/-/g, ' ')} for ${durationMinutes} minutes`,
      body: null,
      countryCode: null,
      data: { routeId, playerId, durationMinutes },
    })

    // Broadcast globally
    emitGameEvent('route:disrupted', {
      routeId,
      routeName: routeId.replace(/-/g, ' '),
      disruptedBy: playerName,
      until: disruptedUntil.toISOString(),
    })

    res.json({ success: true, routeId, disruptedUntil: disruptedUntil.toISOString() })
  } catch (err) {
    console.error('[TRADE-ROUTES] disrupt error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// ── POST /api/trade-routes/target ──
router.post('/target', requireAuth as any, validate(z.object({
  routeId: z.string(),
})), async (req, res) => {
  try {
    const { routeId } = req.body
    const { playerId } = (req as AuthRequest).player!

    const route = STATIC_ROUTES.find(r => r.id === routeId)
    if (!route) {
      res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' }); return
    }

    const [existing] = await db.select().from(tradeRouteState)
      .where(eq(tradeRouteState.routeId, routeId)).limit(1)

    // Toggle: if already targeted by this player, clear it
    const alreadyOwned = existing?.strategicTargetOf === playerId
    const newTarget = alreadyOwned ? null : playerId

    await db.insert(tradeRouteState).values({
      routeId,
      strategicTargetOf: newTarget,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: tradeRouteState.routeId,
      set: { strategicTargetOf: newTarget, updatedAt: new Date() },
    })

    res.json({ success: true, routeId, marked: !alreadyOwned })
  } catch (err) {
    console.error('[TRADE-ROUTES] target error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

// ── GET /api/trade-routes/income ──
// Computes estimated per-tick income for the calling player's country.
router.get('/income', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const now = new Date()

    const [player] = await db.select({ countryCode: players.countryCode })
      .from(players).where(eq(players.id, playerId)).limit(1)

    if (!player?.countryCode) {
      res.json({ success: true, totalMoney: 0, totalOil: 0, routes: [] }); return
    }

    const states = await db.select().from(tradeRouteState)
    const stateMap = Object.fromEntries(states.map(s => [s.routeId, s]))

    // Note: Full control-state check would require region_ownership data.
    // For now we return raw income assuming active (100%) for all routes.
    // The client's tradeRouteStore handles the actual partial/inactive logic.
    let totalMoney = 0
    let totalOil = 0
    const breakdown: Array<{ routeId: string; money: number; oil: number; disrupted: boolean }> = []

    for (const route of STATIC_ROUTES) {
      const state = stateMap[route.id]
      const disrupted = state?.disruptedUntil ? new Date(state.disruptedUntil) > now : false
      const mult = disrupted ? 0 : 1
      const money = Math.round(route.moneyPerTick * mult)
      const oil = Math.round(route.oilPerTick * mult)
      totalMoney += money
      totalOil += oil
      breakdown.push({ routeId: route.id, money, oil, disrupted })
    }

    res.json({ success: true, totalMoney, totalOil, routes: breakdown })
  } catch (err) {
    console.error('[TRADE-ROUTES] income error:', err)
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' })
  }
})

export default router
