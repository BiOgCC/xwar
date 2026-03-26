/**
 * Game State Route — GET /api/game/state
 * Aggregates all critical data for the authenticated player into a single
 * hydration payload. Called once on login/reconnect to sync client stores.
 */

import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { logger } from '../utils/logger.js'
import {
  players, playerSkills, playerSpecialization, items,
  countries, governments, wars, battles as battlesTable,
  marketOrders, countryStocks, stockHoldings, bonds,
  bounties, armies, armyMembers, alliances,
  dailyRewards, tradeRouteState, newsEvents,
} from '../db/schema.js'
import { battleService } from '../services/battle.service.js'

const router = Router()

router.get('/state', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    // ── Player ──
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const [spec] = await db.select().from(playerSpecialization).where(eq(playerSpecialization.playerId, playerId)).limit(1)

    // ── Inventory ──
    const inventory = await db.select().from(items).where(eq(items.ownerId, playerId))

    // ── Countries & Wars ──
    const allCountries = await db.select().from(countries)
    const activeWars = await db.select().from(wars).where(eq(wars.status, 'active'))

    // ── Governments ──
    const govRows = await db.select().from(governments)
    const governmentMap: Record<string, any> = {}
    for (const g of govRows) { governmentMap[g.countryCode] = g }

    // ── Active Battles (in-memory from battleService) ──
    const activeBattles = battleService.getActiveBattles()
    const battlesMap: Record<string, any> = {}
    for (const b of activeBattles) { battlesMap[b.id] = b }

    // ── Market ──
    const openOrders = await db.select().from(marketOrders).where(eq(marketOrders.status, 'open'))

    // ── Stocks ──
    const stockRows = await db.select().from(countryStocks)
    const holdings = await db.select().from(stockHoldings).where(eq(stockHoldings.playerId, playerId))
    const playerBonds = await db.select().from(bonds).where(eq(bonds.playerId, playerId))

    // ── Bounties ──
    const activeBounties = await db.select().from(bounties).where(eq(bounties.status, 'active'))

    // ── Army / MU ──
    const playerArmy = player.enlistedArmyId
      ? await db.select().from(armies).where(eq(armies.id, player.enlistedArmyId)).limit(1)
      : []
    const armyMembersRows = player.enlistedArmyId
      ? await db.select().from(armyMembers).where(eq(armyMembers.armyId, player.enlistedArmyId))
      : []

    // ── Alliances ──
    const allianceRows = await db.select().from(alliances)

    // ── Daily Rewards ──
    const [daily] = await db.select().from(dailyRewards).where(eq(dailyRewards.playerId, playerId)).limit(1)

    // ── Trade Routes ──
    const tradeRoutes = await db.select().from(tradeRouteState)

    // ── News ──
    const news = await db.select().from(newsEvents).limit(20)

    // ── Assemble Response ──
    res.json({
      player: {
        ...player,
        passwordHash: undefined, // Never expose
        skills: skills ?? {},
        specialization: spec ?? {},
      },
      inventory,
      countries: allCountries,
      wars: activeWars,
      government: governmentMap,
      battles: battlesMap,
      market: {
        orders: openOrders,
      },
      stocks: stockRows,
      holdings,
      bonds: playerBonds,
      bounties: activeBounties,
      army: playerArmy[0] ?? null,
      armyMembers: armyMembersRows,
      alliances: allianceRows,
      daily: daily ?? null,
      tradeRoutes,
      news,
    })
  } catch (err) {
    logger.error(err, '[GAME] State hydration error')
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
