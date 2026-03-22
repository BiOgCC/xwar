/**
 * XWAR — Cron Service (Unified Tick Scheduler)
 *
 * 4 independent pipelines, each running at its own cadence:
 *
 *   FAST COMBAT    — every 15s  — training, recovery, (future: battles)
 *   MEDIUM SIM     — every 60s  — stock prices, bonds
 *   SLOW ECONOMY   — every 30m  — bars, companies, market, salary
 *   DAILY JOBS     — various    — full refill, income, maintenance, snapshots
 *
 * Each pipeline has isolated error handling — one failure
 * cannot cascade to other pipelines.
 *
 * All operations use batch SQL for O(1) scaling regardless of player count.
 */
import cron from 'node-cron'
import { logger } from '../utils/logger.js'
import { runFastCombatPipeline } from './tick/fast-combat.pipeline.js'
import { runMediumSimPipeline } from './tick/medium-sim.pipeline.js'
import { runSlowEconomyPipeline } from './tick/slow-economy.pipeline.js'
import { runDailyJobsPipeline } from './tick/daily-jobs.pipeline.js'

/**
 * Initialize all cron jobs.
 * Call this once at server startup.
 */
export function initCronJobs() {
  logger.info('[CRON] Initializing tick pipelines...')

  // ═══════════════════════════════════════════════
  //  FAST COMBAT — every 15 seconds
  // ═══════════════════════════════════════════════
  cron.schedule('*/15 * * * * *', async () => {
    try {
      await runFastCombatPipeline()
    } catch (err) {
      logger.error(err, '[CRON][FAST-COMBAT] Pipeline error:')
    }
  })

  // ═══════════════════════════════════════════════
  //  MEDIUM SIMULATION — every 60 seconds
  // ═══════════════════════════════════════════════
  cron.schedule('* * * * *', async () => {
    try {
      await runMediumSimPipeline()
    } catch (err) {
      logger.error(err, '[CRON][MEDIUM-SIM] Pipeline error:')
    }
  })

  // ═══════════════════════════════════════════════
  //  SLOW ECONOMY — every 30 minutes
  // ═══════════════════════════════════════════════
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runSlowEconomyPipeline()
    } catch (err) {
      logger.error(err, '[CRON][SLOW-ECONOMY] Pipeline error:')
    }
  })

  // ═══════════════════════════════════════════════
  //  DAILY / SCHEDULED JOBS
  // ═══════════════════════════════════════════════

  // Full bar refill — every 12 hours (00:00, 12:00 UTC)
  cron.schedule('0 */12 * * *', async () => {
    try {
      await runDailyJobsPipeline('full_refill')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] full_refill error:')
    }
  })

  // Country auto-income — every 8 hours (00:00, 08:00, 16:00 UTC)
  cron.schedule('0 */8 * * *', async () => {
    try {
      await runDailyJobsPipeline('auto_income')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] auto_income error:')
    }
  })

  // Company maintenance — once per day at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      await runDailyJobsPipeline('maintenance')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] maintenance error:')
    }
  })

  // Fund history snapshot — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await runDailyJobsPipeline('fund_snapshot')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] fund_snapshot error:')
    }
  })

  // Bounty expiry — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runDailyJobsPipeline('expire_bounties')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] expire_bounties error:')
    }
  })

  // Election tally — every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
  cron.schedule('0 */6 * * *', async () => {
    try {
      await runDailyJobsPipeline('tally_elections')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] tally_elections error:')
    }
  })

  // Region ownership resolve — every 60 seconds
  cron.schedule('* * * * *', async () => {
    try {
      await runDailyJobsPipeline('resolve_regions')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] resolve_regions error:')
    }
  })

  // Cyber effects restoration — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runDailyJobsPipeline('restore_cyber')
    } catch (err) {
      logger.error(err, '[CRON][DAILY] restore_cyber error:')
    }
  })

  // ═══════════════════════════════════════════════
  //  RAID BOSS — Tick every 10 seconds
  // ═══════════════════════════════════════════════
  cron.schedule('*/10 * * * * *', async () => {
    try {
      await processRaidBossTick()
    } catch (err) {
      logger.error(err, '[CRON][RAID] Boss tick error:')
    }
  })

  // ═══════════════════════════════════════════════
  //  RAID BOSS — Spawn check every 30 minutes
  // ═══════════════════════════════════════════════
  cron.schedule('*/30 * * * *', async () => {
    try {
      await trySpawnRaidBoss()
    } catch (err) {
      logger.error(err, '[CRON][RAID] Boss spawn error:')
    }
  })

  logger.info('[CRON] All pipelines initialized:')
  logger.info('  ⚔️  Fast Combat     — every 15s  (training, recovery)')
  logger.info('  📈 Medium Sim      — every 60s  (stocks, bonds)')
  logger.info('  🏭 Slow Economy    — every 30m  (bars, companies, market, salary)')
  logger.info('  🎯 Raid Boss Tick  — every 10s  (boss auto-damage, timer)')
  logger.info('  🎯 Raid Boss Spawn — every 30m  (15% chance)')
  logger.info('  📅 Daily Jobs:')
  logger.info('      • Full bar refill   — every 12h')
  logger.info('      • Country income    — every 8h')
  logger.info('      • Maintenance       — daily at 00:00 UTC')
  logger.info('      • Fund snapshot     — every 1h')
  logger.info('      • Bounty expiry     — every 30m')
  logger.info('      • Election tally    — every 6h')
  logger.info('      • Region resolve    — every 60s')
  logger.info('      • Cyber restore     — every 30m')
}

// ═══════════════════════════════════════════════
//  Raid Boss Tick Logic
// ═══════════════════════════════════════════════

import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { raidEvents, raidParticipants, players } from '../db/schema.js'

const BOSS_BASE_DMG: Record<string, number> = { grunt: 200, elite: 500, boss: 1200 }

async function processRaidBossTick() {
  // Find active event
  const [event] = await db.select().from(raidEvents)
    .where(eq(raidEvents.status, 'active'))
    .limit(1)
  if (!event) return

  const now = new Date()
  const bossDmg = BOSS_BASE_DMG[event.rank] || 200

  // Boss auto-attacks
  const [updated] = await db.update(raidEvents).set({
    totalBossDmg: sql`${raidEvents.totalBossDmg} + ${bossDmg}`,
    currentTick: sql`${raidEvents.currentTick} + 1`,
  }).where(eq(raidEvents.id, event.id)).returning({
    totalHunterDmg: raidEvents.totalHunterDmg,
    totalBossDmg: raidEvents.totalBossDmg,
  })

  // Check timer expiry
  if (now >= event.expiresAt) {
    const hunterDmg = updated.totalHunterDmg || 0
    const totalBossDmg = updated.totalBossDmg || 0
    const status = hunterDmg > totalBossDmg ? 'hunters_win' : 'boss_survives'

    await db.update(raidEvents).set({
      status,
      finishedAt: now,
    }).where(eq(raidEvents.id, event.id))

    // Pay out winners
    const participants = await db.select().from(raidParticipants)
      .where(eq(raidParticipants.eventId, event.id))

    const totalPot = (event.baseBounty || 0) + (event.supportPool || 0)

    if (status === 'hunters_win') {
      // Fighters get x2 pot split by damage %
      const fighters = participants.filter(p => p.side === 'fighter')
      const totalFighterDmg = fighters.reduce((s, f) => s + (f.totalDmg || 0), 0)
      if (totalFighterDmg > 0) {
        for (const f of fighters) {
          const share = Math.floor(totalPot * 2 * ((f.totalDmg || 0) / totalFighterDmg))
          if (share > 0) {
            await db.update(players).set({
              money: sql`${players.money} + ${share}`,
            }).where(eq(players.id, f.playerId))
          }
        }
      }
      logger.info(`[RAID] ${event.name} eliminated! Hunters win. Pot: $${totalPot * 2}`)
    } else {
      // Supporters get x2 return on their funding
      const supporters = participants.filter(p => p.side === 'supporter')
      for (const s of supporters) {
        const payout = (s.totalFunded || 0) * 2
        if (payout > 0) {
          await db.update(players).set({
            money: sql`${players.money} + ${payout}`,
          }).where(eq(players.id, s.playerId))
        }
      }
      logger.info(`[RAID] ${event.name} survived! Eco wins. Supporters paid x2.`)
    }
  }
}

// ═══════════════════════════════════════════════
//  Raid Boss Spawn Logic
// ═══════════════════════════════════════════════

const NPC_TEMPLATES = [
  { name: 'Rogue Operative', rank: 'grunt' },
  { name: 'Shadow Agent', rank: 'grunt' },
  { name: 'Desert Phantom', rank: 'elite' },
  { name: 'Iron Viper', rank: 'elite' },
  { name: 'The Butcher', rank: 'boss' },
  { name: 'Ghost of Kyiv', rank: 'boss' },
  { name: 'Crimson Jackal', rank: 'grunt' },
  { name: 'Steel Cobra', rank: 'elite' },
]

const BOUNTY_RANGES: Record<string, [number, number]> = {
  grunt: [25_000, 50_000],
  elite: [75_000, 150_000],
  boss:  [200_000, 500_000],
}

const COUNTRIES = ['US', 'RU', 'CN', 'DE', 'BR', 'GB', 'FR', 'JP', 'IN', 'AU', 'KR', 'TR', 'MX', 'AR']

async function trySpawnRaidBoss() {
  // Check if there's already an active boss
  const [existing] = await db.select({ id: raidEvents.id }).from(raidEvents)
    .where(eq(raidEvents.status, 'active'))
    .limit(1)
  if (existing) return

  // 15% chance to spawn
  if (Math.random() > 0.15) return

  const tmpl = NPC_TEMPLATES[Math.floor(Math.random() * NPC_TEMPLATES.length)]
  const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
  const [lo, hi] = BOUNTY_RANGES[tmpl.rank] || [25_000, 50_000]
  const bounty = lo + Math.floor(Math.random() * (hi - lo))

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 20 * 60 * 1000) // 20 minutes

  await db.insert(raidEvents).values({
    name: tmpl.name,
    rank: tmpl.rank,
    countryCode: country,
    status: 'active',
    baseBounty: bounty,
    supportPool: 0,
    totalHunterDmg: 0,
    totalBossDmg: 0,
    currentTick: 0,
    expiresAt,
  })

  logger.info(`[RAID] 🎯 Boss spawned: ${tmpl.name} (${tmpl.rank}) in ${country}, bounty: $${bounty.toLocaleString()}`)
}

