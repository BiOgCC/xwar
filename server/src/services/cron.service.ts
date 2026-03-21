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

  logger.info('[CRON] All pipelines initialized:')
  logger.info('  ⚔️  Fast Combat     — every 15s  (training, recovery)')
  logger.info('  📈 Medium Sim      — every 60s  (stocks, bonds)')
  logger.info('  🏭 Slow Economy    — every 30m  (bars, companies, market, salary)')
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
