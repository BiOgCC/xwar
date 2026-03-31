/**
 * FAST COMBAT PIPELINE — Every 2 minutes (120s)
 *
 * Handles time-critical combat simulation:
 * - Battle round resolution (damage accumulation → round winner)
 * - Ground-point calculation per tick
 *
 * All operations use batch SQL — no per-player loops.
 */

import { battleService } from '../battle.service.js'
import { logger } from '../../utils/logger.js'

/**
 * Run all fast combat pipeline operations.
 * Called every 2 minutes by the cron scheduler.
 */
export async function runFastCombatPipeline() {
  try {
    await battleService.processCombatTick()
  } catch (err) {
    logger.error(err, '[FastCombat] processCombatTick failed:')
  }
}
