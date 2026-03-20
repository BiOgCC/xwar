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
import { runFastCombatPipeline } from './tick/fast-combat.pipeline.js'
import { runMediumSimPipeline } from './tick/medium-sim.pipeline.js'
import { runSlowEconomyPipeline } from './tick/slow-economy.pipeline.js'
import { runDailyJobsPipeline } from './tick/daily-jobs.pipeline.js'

/**
 * Initialize all cron jobs.
 * Call this once at server startup.
 */
export function initCronJobs() {
  console.log('[CRON] Initializing tick pipelines...')

  // ═══════════════════════════════════════════════
  //  FAST COMBAT — every 15 seconds
  // ═══════════════════════════════════════════════
  cron.schedule('*/15 * * * * *', async () => {
    try {
      await runFastCombatPipeline()
    } catch (err) {
      console.error('[CRON][FAST-COMBAT] Pipeline error:', err)
    }
  })

  // ═══════════════════════════════════════════════
  //  MEDIUM SIMULATION — every 60 seconds
  // ═══════════════════════════════════════════════
  cron.schedule('* * * * *', async () => {
    try {
      await runMediumSimPipeline()
    } catch (err) {
      console.error('[CRON][MEDIUM-SIM] Pipeline error:', err)
    }
  })

  // ═══════════════════════════════════════════════
  //  SLOW ECONOMY — every 30 minutes
  // ═══════════════════════════════════════════════
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runSlowEconomyPipeline()
    } catch (err) {
      console.error('[CRON][SLOW-ECONOMY] Pipeline error:', err)
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
      console.error('[CRON][DAILY] full_refill error:', err)
    }
  })

  // Country auto-income — every 8 hours (00:00, 08:00, 16:00 UTC)
  cron.schedule('0 */8 * * *', async () => {
    try {
      await runDailyJobsPipeline('auto_income')
    } catch (err) {
      console.error('[CRON][DAILY] auto_income error:', err)
    }
  })

  // Company maintenance — once per day at midnight UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      await runDailyJobsPipeline('maintenance')
    } catch (err) {
      console.error('[CRON][DAILY] maintenance error:', err)
    }
  })

  // Fund history snapshot — every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await runDailyJobsPipeline('fund_snapshot')
    } catch (err) {
      console.error('[CRON][DAILY] fund_snapshot error:', err)
    }
  })

  // Bounty expiry — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runDailyJobsPipeline('expire_bounties')
    } catch (err) {
      console.error('[CRON][DAILY] expire_bounties error:', err)
    }
  })

  console.log('[CRON] All pipelines initialized:')
  console.log('  ⚔️  Fast Combat     — every 15s  (training, recovery)')
  console.log('  📈 Medium Sim      — every 60s  (stocks, bonds)')
  console.log('  🏭 Slow Economy    — every 30m  (bars, companies, market, salary)')
  console.log('  📅 Daily Jobs:')
  console.log('      • Full bar refill   — every 12h')
  console.log('      • Country income    — every 8h')
  console.log('      • Maintenance       — daily at 00:00 UTC')
  console.log('      • Fund snapshot     — every 1h')
  console.log('      • Bounty expiry     — every 30m')
}
