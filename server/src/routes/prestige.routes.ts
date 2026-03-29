/**
 * Prestige Routes — Server-authoritative prestige rankings & items.
 * Live-computed rankings (no weekly rotation for alpha).
 */

import { Router } from 'express'
import { db } from '../db/connection.js'
import { players, prestigeItems } from '../db/schema.js'
import { eq, sql, desc } from 'drizzle-orm'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth as any)

// ═══════════════════════════════════════════════
//  Titles for top-5 players
// ═══════════════════════════════════════════════

const MILITARY_TITLES = [
  'Supreme Commander',
  'Field Marshal',
  'General of the Army',
  'Army General',
  'Lieutenant General',
]

const ECONOMIC_TITLES = [
  'Chief Industrial Strategist',
  'Grand Economic Architect',
  'High Commissioner of Industry',
  'Senior Resource Director',
  'Principal Economic Advisor',
]

// ═══════════════════════════════════════════════
//  Week calculation
// ═══════════════════════════════════════════════

const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000
const SERVER_EPOCH = new Date('2026-01-01').getTime()

function getCurrentWeek(): number {
  return Math.floor((Date.now() - SERVER_EPOCH) / WEEK_DURATION) + 1
}

// ═══════════════════════════════════════════════
//  GET /api/prestige/rankings — Live-computed rankings
// ═══════════════════════════════════════════════

router.get('/rankings', async (req, res) => {
  try {
    const currentWeek = getCurrentWeek()

    // Top 5 military (by damage_done)
    const milPlayers = await db.select({
      id: players.id,
      name: players.name,
      damageDone: players.damageDone,
    }).from(players)
      .orderBy(desc(players.damageDone))
      .limit(5)

    const milRankings = milPlayers.map((p, i) => ({
      rankingId: `mil_${currentWeek}_${i}`,
      weekNumber: currentWeek,
      playerId: p.id,
      playerName: p.name,
      category: 'military',
      rankPosition: i + 1,
      title: MILITARY_TITLES[i] || '',
      score: Number(p.damageDone ?? 0),
    }))

    // Top 5 economic (by money + items_produced * 100)
    const ecoPlayers = await db.select({
      id: players.id,
      name: players.name,
      money: players.money,
      itemsProduced: players.itemsProduced,
    }).from(players)
      .orderBy(sql`COALESCE(money, 0) + COALESCE(items_produced, 0) * 100 DESC`)
      .limit(5)

    const ecoRankings = ecoPlayers.map((p, i) => ({
      rankingId: `eco_${currentWeek}_${i}`,
      weekNumber: currentWeek,
      playerId: p.id,
      playerName: p.name,
      category: 'economic',
      rankPosition: i + 1,
      title: ECONOMIC_TITLES[i] || '',
      score: Number(p.money ?? 0) + Number(p.itemsProduced ?? 0) * 100,
    }))

    // Build prestigePlayers from top-5 entries
    const prestigePlayers = [...milRankings, ...ecoRankings].map(r => ({
      prestigeId: `pp_${r.playerId}_${r.category}_${currentWeek}`,
      playerId: r.playerId,
      playerName: r.playerName,
      weekNumber: currentWeek,
      category: r.category,
      title: r.title,
      blueprintCreated: false, // TODO: check from prestige_items
      cooldownUntilWeek: 0,
    }))

    res.json({
      success: true,
      rankings: [...milRankings, ...ecoRankings],
      prestigePlayers,
      currentWeek,
    })
  } catch (err) {
    console.error('[Prestige] Rankings error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/prestige/archive/:week — Historical data
// ═══════════════════════════════════════════════

router.get('/archive/:week', async (req, res) => {
  // For alpha: return empty. Full archive requires weekly snapshots.
  res.json({ success: true, archive: [] })
})

// ═══════════════════════════════════════════════
//  GET /api/prestige/items — Prestige items & blueprints
// ═══════════════════════════════════════════════

router.get('/items', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const queryPlayerId = (req.query.playerId as string) || playerId

    const itemRows = await db.select().from(prestigeItems)
      .where(eq(prestigeItems.ownerId, queryPlayerId))

    res.json({
      success: true,
      items: itemRows,
      blueprints: [], // Blueprints are ephemeral (not persisted in alpha)
    })
  } catch (err) {
    console.error('[Prestige] Items error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/prestige/blueprint/create
// ═══════════════════════════════════════════════

router.post('/blueprint/create', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const currentWeek = getCurrentWeek()
    const BADGE_COST = 5

    // Check player is in top 5
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) {
      res.status(404).json({ error: 'Player not found' })
      return
    }

    // Simple eligibility: check if player is in top 5 damage or top 5 economy
    const milTop5 = await db.select({ id: players.id }).from(players)
      .orderBy(desc(players.damageDone)).limit(5)
    const ecoTop5 = await db.select({ id: players.id }).from(players)
      .orderBy(sql`COALESCE(money, 0) + COALESCE(items_produced, 0) * 100 DESC`).limit(5)

    const isMilitary = milTop5.some(p => p.id === playerId)
    const isEconomic = ecoTop5.some(p => p.id === playerId)

    if (!isMilitary && !isEconomic) {
      res.status(403).json({ error: 'You must be in the Top 5 to create a prestige blueprint.' })
      return
    }

    // Check badges of honor
    const badges = Number(player.badgesOfHonor ?? 0)
    if (badges < BADGE_COST) {
      res.status(400).json({ error: `Need ${BADGE_COST} Badges of Honor (you have ${badges}).` })
      return
    }

    // Deduct badges
    await db.update(players).set({
      badgesOfHonor: badges - BADGE_COST,
    }).where(eq(players.id, playerId))

    // Generate item
    const category = isMilitary ? 'military' : 'economic'
    const militaryNames = ['Crown of the Titan', 'Crown of the Warlord', 'Crown of Shadows', 'Crown of Thunder', 'Crown of Dominion']
    const economicNames = ['Ring of the Industrial Mind', 'Ring of the Golden Prospect', 'Ring of the Midas Touch', 'Ring of the Tycoon', 'Ring of Precision']
    const names = category === 'military' ? militaryNames : economicNames

    const bonusStats = category === 'military'
      ? { damage: 4 + Math.floor(Math.random() * 5), crit_damage: 8 + Math.floor(Math.random() * 8) }
      : { prospection: 10 + Math.floor(Math.random() * 10), industrialist: 8 + Math.floor(Math.random() * 8) }

    const [newItem] = await db.insert(prestigeItems).values({
      ownerId: playerId,
      category,
      subcategory: category === 'military' ? 'crown' : 'ring',
      equipped: false,
      bonusStats,
      craftedBy: player.name,
    }).returning()

    res.json({
      success: true,
      message: `Prestige ${category === 'military' ? 'Crown' : 'Ring'} created!`,
      item: newItem,
    })
  } catch (err) {
    console.error('[Prestige] Blueprint create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/prestige/craft — Simplified for alpha (direct creation)
// ═══════════════════════════════════════════════

router.post('/craft', async (req, res) => {
  // In alpha, blueprint creation and crafting are merged into /blueprint/create
  res.json({ success: false, message: 'Use /blueprint/create to directly create prestige items.' })
})

// ═══════════════════════════════════════════════
//  POST /api/prestige/blueprint/list — List on market (placeholder)
// ═══════════════════════════════════════════════

router.post('/blueprint/list', async (req, res) => {
  res.json({ success: false, message: 'Prestige market not available in alpha.' })
})

// ═══════════════════════════════════════════════
//  POST /api/prestige/blueprint/buy — Buy from market (placeholder)
// ═══════════════════════════════════════════════

router.post('/blueprint/buy', async (req, res) => {
  res.json({ success: false, message: 'Prestige market not available in alpha.' })
})

// ═══════════════════════════════════════════════
//  POST /api/prestige/equip/:id — Equip a prestige item
// ═══════════════════════════════════════════════

router.post('/equip/:id', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const itemId = req.params.id

    // Unequip all prestige items first
    await db.update(prestigeItems).set({ equipped: false }).where(eq(prestigeItems.ownerId, playerId))

    // Equip the selected one
    await db.update(prestigeItems).set({ equipped: true }).where(eq(prestigeItems.id, itemId))

    res.json({ success: true, message: 'Prestige item equipped.' })
  } catch (err) {
    console.error('[Prestige] Equip error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/prestige/unequip/:id — Unequip a prestige item
// ═══════════════════════════════════════════════

router.post('/unequip/:id', async (req, res) => {
  try {
    const itemId = req.params.id
    await db.update(prestigeItems).set({ equipped: false }).where(eq(prestigeItems.id, itemId))
    res.json({ success: true, message: 'Prestige item unequipped.' })
  } catch (err) {
    console.error('[Prestige] Unequip error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
