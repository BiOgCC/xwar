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
  militaryUnits, muMembers, companies,
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

    // Auto-seat player as president if no one holds the position for their country
    const playerCountry = player.countryCode
    if (playerCountry && governmentMap[playerCountry] && !governmentMap[playerCountry].president) {
      await db.update(governments).set({ president: player.id }).where(eq(governments.countryCode, playerCountry))
      governmentMap[playerCountry] = { ...governmentMap[playerCountry], president: player.id }
      logger.info(`[GAME] Auto-seated ${player.name} (${player.id}) as president of ${playerCountry}`)
    }

    // ── Active Battles (in-memory from battleService, plus any DB-only ones) ──
    const activeBattles = battleService.getActiveBattles()
    const battlesMap: Record<string, any> = {}
    for (const b of activeBattles) { battlesMap[b.id] = b }

    // Also check DB for battles not yet loaded into memory (e.g., after server restart)
    try {
      const { sql: sqlTag } = await import('drizzle-orm')
      const dbActiveBattles = await db.execute(sqlTag`
        SELECT id, attacker_id, defender_id, region_name, status,
               attacker_rounds_won, defender_rounds_won,
               attacker_damage, defender_damage, created_at
        FROM battles WHERE status = 'active'
      `)
      for (const r of dbActiveBattles as any[]) {
        if (!battlesMap[r.id]) {
          // Build a minimal battle shell for the client
          battlesMap[r.id] = {
            id: r.id, type: 'invasion',
            attackerId: r.attacker_id, defenderId: r.defender_id,
            regionName: r.region_name, status: r.status,
            ticksElapsed: 0,
            startedAt: new Date(r.created_at).getTime(),
            attacker: { countryCode: r.attacker_id, divisionIds: [], engagedDivisionIds: [], damageDealt: Number(r.attacker_damage ?? 0), manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0 },
            defender: { countryCode: r.defender_id, divisionIds: [], engagedDivisionIds: [], damageDealt: Number(r.defender_damage ?? 0), manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0 },
            attackerRoundsWon: r.attacker_rounds_won ?? 0, defenderRoundsWon: r.defender_rounds_won ?? 0,
            rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: new Date(r.created_at).getTime() }],
            currentTick: { attackerDamage: 0, defenderDamage: 0 },
            combatLog: [], attackerDamageDealers: {}, defenderDamageDealers: {},
            damageFeed: [], divisionCooldowns: {},
            attackerOrder: 'none', defenderOrder: 'none',
            orderMessage: '', motd: '',
          }
        }
      }
      // Trigger memory restore if any DB-only battles found
      const memIds = new Set(activeBattles.map(b => b.id))
      const hasDbOnly = (dbActiveBattles as any[]).some(r => !memIds.has(r.id))
      if (hasDbOnly) {
        battleService.restoreFromDB().catch(() => {})
      }
    } catch (e) { /* DB query failed, use in-memory only */ }

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

    // ── Military Unit (Guild) ──
    const [playerMuMembership] = await db.select().from(muMembers)
      .where(eq(muMembers.playerId, player.id)).limit(1)
    let muData: any = null
    if (playerMuMembership) {
      const [muUnit] = await db.select().from(militaryUnits)
        .where(eq(militaryUnits.id, playerMuMembership.unitId)).limit(1)
      if (muUnit) {
        const muMemberRows = await db.select().from(muMembers)
          .where(eq(muMembers.unitId, muUnit.id))
        muData = { unit: { ...muUnit, members: muMemberRows }, membership: playerMuMembership }
      }
    }

    // ── Companies ──
    const playerCompanies = await db.select().from(companies).where(eq(companies.ownerId, playerId))

    // ── Alliances ──
    const allianceRows = await db.select().from(alliances)

    // ── Daily Rewards ──
    const [daily] = await db.select().from(dailyRewards).where(eq(dailyRewards.playerId, playerId)).limit(1)

    // ── Trade Routes ──
    const tradeRoutes = await db.select().from(tradeRouteState)

    // ── News ──
    const news = await db.select().from(newsEvents).limit(20)

    // ── Occupation map: build { [regionName]: controllerCode } from all countries ──
    // This allows the frontend regionStore to restore controlledBy on login
    const occupationMap: Record<string, string> = {}
    for (const c of allCountries) {
      const occ = (c as any).occupiedRegions as Record<string, string> | null
      if (occ && typeof occ === 'object') {
        for (const [regionName, _originalOwner] of Object.entries(occ)) {
          occupationMap[regionName] = c.code  // regionName → current controller (the conqueror)
        }
      }
    }

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
      mu: muData,
      companies: playerCompanies,
      alliances: allianceRows,
      daily: daily ?? null,
      tradeRoutes,
      news,
      occupationMap,  // { [regionName]: controllerCode } — used to restore controlledBy on login
    })
  } catch (err) {
    logger.error(err, '[GAME] State hydration error')
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
