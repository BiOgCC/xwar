/**
 * Raid Boss Routes — Damage Race system.
 * Hunters attack (stamina), Eco players fund (money → x2 boss dmg).
 * Winner decided by who dealt more damage when 20min timer expires.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and, desc } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills, raidEvents, raidParticipants, items } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const STAMINA_COST = 5
const MIN_FUND = 500
const BASE_DAMAGE = 50  // base damage if player has no skills
const MERC_DMG_PER_DOLLAR = 2  // $1 → 2 boss damage

// ═══════════════════════════════════════════════
//  GET /api/raid/active — Current active raid event
// ═══════════════════════════════════════════════

router.get('/active', async (_req, res) => {
  try {
    const [event] = await db.select().from(raidEvents)
      .where(eq(raidEvents.status, 'active'))
      .limit(1)

    if (!event) {
      res.json({ success: true, event: null, participants: [] })
      return
    }

    // Get all participants
    const participants = await db.select({
      id: raidParticipants.id,
      playerId: raidParticipants.playerId,
      playerName: players.name,
      side: raidParticipants.side,
      totalDmg: raidParticipants.totalDmg,
      totalFunded: raidParticipants.totalFunded,
      hits: raidParticipants.hits,
    })
    .from(raidParticipants)
    .innerJoin(players, eq(raidParticipants.playerId, players.id))
    .where(eq(raidParticipants.eventId, event.id))

    res.json({
      success: true,
      event: {
        id: event.id,
        name: event.name,
        rank: event.rank,
        countryCode: event.countryCode,
        status: event.status,
        baseBounty: event.baseBounty,
        supportPool: event.supportPool,
        totalHunterDmg: event.totalHunterDmg,
        totalBossDmg: event.totalBossDmg,
        currentTick: event.currentTick,
        startedAt: event.startedAt?.getTime(),
        expiresAt: event.expiresAt.getTime(),
      },
      participants: participants.map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        side: p.side,
        totalDmg: p.totalDmg,
        totalFunded: p.totalFunded,
        hits: p.hits,
      })),
    })
  } catch (err) {
    console.error('[RAID] Active error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/raid/attack — Hunter attacks the boss
// ═══════════════════════════════════════════════

const attackSchema = z.object({
  eventId: z.string().uuid(),
})

router.post('/attack', requireAuth as any, validate(attackSchema), async (req, res) => {
  try {
    const { playerId, playerName } = (req as AuthRequest).player!
    const { eventId } = req.body

    // Fetch event
    const [event] = await db.select().from(raidEvents)
      .where(and(eq(raidEvents.id, eventId), eq(raidEvents.status, 'active')))
      .limit(1)
    if (!event) { res.status(404).json({ error: 'Raid event not found or ended' }); return }

    // Check if player is already a supporter (side-lock)
    const [existing] = await db.select().from(raidParticipants)
      .where(and(eq(raidParticipants.eventId, eventId), eq(raidParticipants.playerId, playerId)))
      .limit(1)
    if (existing && existing.side === 'supporter') {
      res.status(400).json({ error: "You're supporting this boss — pick a side!" }); return
    }

    // Check stamina
    const [player] = await db.select({
      stamina: players.stamina,
    }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || Number(player.stamina) < STAMINA_COST) {
      res.status(400).json({ error: `Need ${STAMINA_COST} stamina` }); return
    }

    // Get player skills for damage calculation
    const [skills] = await db.select().from(playerSkills)
      .where(eq(playerSkills.playerId, playerId)).limit(1)

    const attackSkill = skills?.attack || 0
    const critRate = skills?.critRate || 0
    const critDmg = skills?.critDamage || 0
    const precisionSkill = skills?.precision || 0

    // Fetch equipped items
    const equippedItems = await db.select({ stats: items.stats }).from(items)
      .where(and(eq(items.ownerId, playerId), eq(items.equipped, true)))

    // Aggregate equipment stats
    const equipment = { damage: 0, critRate: 0, critDamage: 0, armor: 0, dodge: 0, precision: 0 }
    equippedItems.forEach((item) => {
      const st = item.stats as any
      if (st.damage) equipment.damage += st.damage
      if (st.critRate) equipment.critRate += st.critRate
      if (st.critDamage) equipment.critDamage += st.critDamage
      if (st.armor) equipment.armor += st.armor
      if (st.dodge) equipment.dodge += st.dodge
      if (st.precision) equipment.precision += st.precision
    })

    // Calculate damage (mirrors exact computePlayerCombatStats formula)
    const rawHitRate = 50 + equipment.precision + precisionSkill * 5
    const overflowCrit = Math.max(0, rawHitRate - 90) * 0.5
    
    const attackDamage = 100 + equipment.damage + attackSkill * 20
    const finalCritRate = 10 + equipment.critRate + critRate * 5 + overflowCrit
    const critMultiplier = 1.5 + (equipment.critDamage + critDmg * 20) / 200

    // ±15% organic variance so hits don't feel robotic
    const variance = 0.85 + Math.random() * 0.30
    const variedDamage = Math.round(attackDamage * variance)

    const isCrit = Math.random() * 100 < finalCritRate
    const damage = isCrit ? Math.floor(variedDamage * critMultiplier) : variedDamage

    // Atomic: deduct stamina + add damage
    await db.update(players).set({
      stamina: sql`${players.stamina} - ${STAMINA_COST}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.stamina} >= ${STAMINA_COST}`
    )

    const [updatedEvent] = await db.update(raidEvents).set({
      totalHunterDmg: sql`${raidEvents.totalHunterDmg} + ${damage}`,
    }).where(eq(raidEvents.id, eventId)).returning({
      totalHunterDmg: raidEvents.totalHunterDmg,
      totalBossDmg: raidEvents.totalBossDmg,
    })

    // Upsert participant
    if (existing) {
      await db.update(raidParticipants).set({
        totalDmg: sql`${raidParticipants.totalDmg} + ${damage}`,
        hits: sql`${raidParticipants.hits} + 1`,
      }).where(eq(raidParticipants.id, existing.id))
    } else {
      await db.insert(raidParticipants).values({
        eventId,
        playerId,
        side: 'fighter',
        totalDmg: damage,
        totalFunded: 0,
        hits: 1,
      })
    }

    const critTag = isCrit ? ' 💥 CRIT!' : ''
    res.json({
      success: true,
      damage,
      isCrit,
      totalHunterDmg: updatedEvent.totalHunterDmg,
      totalBossDmg: updatedEvent.totalBossDmg,
      message: `⚔️ ${damage} hunter damage!${critTag}`,
    })
  } catch (err) {
    console.error('[RAID] Attack error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/raid/fund — Eco player funds the boss
// ═══════════════════════════════════════════════

const fundSchema = z.object({
  eventId: z.string().uuid(),
  amount: z.number().int().min(MIN_FUND).max(1_000_000),
})

router.post('/fund', requireAuth as any, validate(fundSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { eventId, amount } = req.body

    // Fetch event
    const [event] = await db.select().from(raidEvents)
      .where(and(eq(raidEvents.id, eventId), eq(raidEvents.status, 'active')))
      .limit(1)
    if (!event) { res.status(404).json({ error: 'Raid event not found or ended' }); return }

    // Check if player is already a fighter (side-lock)
    const [existing] = await db.select().from(raidParticipants)
      .where(and(eq(raidParticipants.eventId, eventId), eq(raidParticipants.playerId, playerId)))
      .limit(1)
    if (existing && existing.side === 'fighter') {
      res.status(400).json({ error: "You're fighting this boss — pick a side!" }); return
    }

    // Deduct money atomically
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${amount}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${amount}`
    ).returning({ newBalance: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${amount.toLocaleString()}` }); return
    }

    const bossDmg = amount * MERC_DMG_PER_DOLLAR

    // Update event
    const [updatedEvent] = await db.update(raidEvents).set({
      totalBossDmg: sql`${raidEvents.totalBossDmg} + ${bossDmg}`,
      supportPool: sql`${raidEvents.supportPool} + ${amount}`,
    }).where(eq(raidEvents.id, eventId)).returning({
      totalHunterDmg: raidEvents.totalHunterDmg,
      totalBossDmg: raidEvents.totalBossDmg,
      supportPool: raidEvents.supportPool,
    })

    // Upsert participant
    if (existing) {
      await db.update(raidParticipants).set({
        totalFunded: sql`${raidParticipants.totalFunded} + ${amount}`,
        hits: sql`${raidParticipants.hits} + 1`,
      }).where(eq(raidParticipants.id, existing.id))
    } else {
      await db.insert(raidParticipants).values({
        eventId,
        playerId,
        side: 'supporter',
        totalDmg: 0,
        totalFunded: amount,
        hits: 1,
      })
    }

    res.json({
      success: true,
      funded: amount,
      bossDmg,
      totalHunterDmg: updatedEvent.totalHunterDmg,
      totalBossDmg: updatedEvent.totalBossDmg,
      supportPool: updatedEvent.supportPool,
      message: `💰 $${amount.toLocaleString()} → +${bossDmg.toLocaleString()} eco damage!`,
    })
  } catch (err) {
    console.error('[RAID] Fund error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/raid/history — Last 10 completed raids
// ═══════════════════════════════════════════════

router.get('/history', async (_req, res) => {
  try {
    const events = await db.select().from(raidEvents)
      .where(sql`${raidEvents.status} != 'active'`)
      .orderBy(desc(raidEvents.finishedAt))
      .limit(10)

    res.json({
      success: true,
      events: events.map(e => ({
        id: e.id,
        name: e.name,
        rank: e.rank,
        countryCode: e.countryCode,
        status: e.status,
        baseBounty: e.baseBounty,
        supportPool: e.supportPool,
        totalHunterDmg: e.totalHunterDmg,
        totalBossDmg: e.totalBossDmg,
        startedAt: e.startedAt?.getTime(),
        expiresAt: e.expiresAt.getTime(),
        finishedAt: e.finishedAt?.getTime(),
      })),
    })
  } catch (err) {
    console.error('[RAID] History error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
