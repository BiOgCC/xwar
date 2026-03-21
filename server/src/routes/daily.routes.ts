/**
 * Daily Rewards Routes — 7-day login streak with escalating rewards.
 * UTC-based cooldown: 24h between claims, streak breaks after 48h.
 */
import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, dailyRewards } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()

const COOLDOWN_MS = 24 * 60 * 60 * 1000     // 24 hours
const GRACE_WINDOW_MS = 48 * 60 * 60 * 1000 // 48 hours — streak resets after this

// 7-day reward table (matches frontend dailyRewardStore exactly)
const REWARDS = [
  { day: 1, money: 50_000,  items: { bread: 5 } },
  { day: 2, money: 75_000,  items: { sushi: 5 } },
  { day: 3, money: 100_000, items: { wagyu: 5 }, lootBoxes: 1 },
  { day: 4, money: 150_000, items: { staminaPills: 2 } },
  { day: 5, money: 200_000, militaryBoxes: 1 },
  { day: 6, money: 300_000, bitcoin: 3 },
  { day: 7, money: 500_000, t5Item: true },
] as const

// ═══════════════════════════════════════════════
//  GET /api/daily/status — Check claim status + streak
// ═══════════════════════════════════════════════

router.get('/status', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    const [record] = await db.select().from(dailyRewards)
      .where(eq(dailyRewards.playerId, playerId)).limit(1)

    if (!record) {
      res.json({
        success: true,
        canClaim: true,
        streak: 0,
        nextDay: 1,
        nextReward: REWARDS[0],
        lastClaimedAt: null,
      }); return
    }

    const now = Date.now()
    const lastClaimed = record.lastClaimedAt ? new Date(record.lastClaimedAt).getTime() : 0
    const timeSinceLast = now - lastClaimed
    const canClaim = timeSinceLast >= COOLDOWN_MS
    const streakBroken = timeSinceLast > GRACE_WINDOW_MS

    let streak = record.loginStreak ?? 0
    if (streakBroken) streak = 0

    const nextDay = (streak % 7) + 1

    res.json({
      success: true,
      canClaim,
      streak,
      nextDay,
      nextReward: REWARDS[nextDay - 1],
      lastClaimedAt: record.lastClaimedAt,
      graceExpiresAt: lastClaimed ? new Date(lastClaimed + GRACE_WINDOW_MS).toISOString() : null,
    })
  } catch (err) {
    console.error('[DAILY] Status error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/daily/claim — Claim today's reward
// ═══════════════════════════════════════════════

router.post('/claim', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    // Upsert daily record
    let [record] = await db.select().from(dailyRewards)
      .where(eq(dailyRewards.playerId, playerId)).limit(1)

    if (!record) {
      const [newRecord] = await db.insert(dailyRewards).values({
        playerId,
        loginStreak: 0,
        lastClaimedAt: null,
      }).returning()
      record = newRecord
    }

    const now = Date.now()
    const lastClaimed = record.lastClaimedAt ? new Date(record.lastClaimedAt).getTime() : 0
    const timeSinceLast = now - lastClaimed

    // Cooldown check
    if (lastClaimed > 0 && timeSinceLast < COOLDOWN_MS) {
      const nextAvailable = new Date(lastClaimed + COOLDOWN_MS)
      res.status(400).json({
        error: 'Come back tomorrow!',
        nextAvailable: nextAvailable.toISOString(),
      }); return
    }

    // Determine streak
    let newStreak = record.loginStreak ?? 0
    if (lastClaimed > 0 && timeSinceLast > GRACE_WINDOW_MS) {
      newStreak = 0 // Streak broken
    }
    newStreak = (newStreak % 7) + 1

    const reward = REWARDS[newStreak - 1]

    // Grant money
    await db.update(players).set({
      money: sql`${players.money} + ${reward.money}`,
    }).where(eq(players.id, playerId))

    // Grant items
    if ('items' in reward && reward.items) {
      const items = reward.items as Record<string, number>
      for (const [key, amount] of Object.entries(items)) {
        const colMap: Record<string, any> = {
          bread: players.bread,
          sushi: players.sushi,
          wagyu: players.wagyu,
          staminaPills: players.staminaPills,
        }
        const col = colMap[key]
        if (col) {
          await db.update(players).set({
            [key === 'staminaPills' ? 'staminaPills' : key]: sql`${col} + ${amount}`,
          }).where(eq(players.id, playerId))
        }
      }
    }

    if ('bitcoin' in reward && reward.bitcoin) {
      await db.update(players).set({
        bitcoin: sql`${players.bitcoin} + ${reward.bitcoin}`,
      }).where(eq(players.id, playerId))
    }

    if ('lootBoxes' in reward && reward.lootBoxes) {
      await db.update(players).set({
        lootBoxes: sql`${players.lootBoxes} + ${reward.lootBoxes}`,
      }).where(eq(players.id, playerId))
    }

    if ('militaryBoxes' in reward && reward.militaryBoxes) {
      await db.update(players).set({
        militaryBoxes: sql`${players.militaryBoxes} + ${reward.militaryBoxes}`,
      }).where(eq(players.id, playerId))
    }

    if ('t5Item' in reward && reward.t5Item) {
      await db.update(players).set({
        lootBoxes: sql`${players.lootBoxes} + 1`,
      }).where(eq(players.id, playerId))
    }

    // Update streak record
    await db.update(dailyRewards).set({
      loginStreak: newStreak,
      lastClaimedAt: new Date(),
    }).where(eq(dailyRewards.id, record.id))

    res.json({
      success: true,
      day: newStreak,
      streak: newStreak,
      reward: {
        money: reward.money,
        ...('items' in reward ? { items: reward.items } : {}),
        ...('bitcoin' in reward ? { bitcoin: reward.bitcoin } : {}),
        ...('lootBoxes' in reward ? { lootBoxes: reward.lootBoxes } : {}),
        ...('militaryBoxes' in reward ? { militaryBoxes: reward.militaryBoxes } : {}),
        ...('t5Item' in reward ? { t5Item: true } : {}),
      },
      message: `Day ${newStreak} reward claimed! +$${reward.money.toLocaleString()}`,
    })
  } catch (err) {
    console.error('[DAILY] Claim error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
