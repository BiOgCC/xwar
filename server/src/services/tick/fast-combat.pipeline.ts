/**
 * FAST COMBAT PIPELINE — Every 15 seconds
 *
 * Handles time-critical combat simulation:
 * - Battle round resolution (damage accumulation → round winner)
 * - Ground-point calculation per tick
 * - Division damage & health processing
 *
 * All operations use batch SQL — no per-player loops.
 */

import { battleService } from '../battle.service.js'
import { logger } from '../../utils/logger.js'

/**
 * Run all fast combat pipeline operations.
 * Called every 15 seconds by the cron scheduler.
 */
export async function runFastCombatPipeline() {
  try {
    await battleService.processCombatTick()
  } catch (err) {
    logger.error(err, '[FastCombat] processCombatTick failed:')
  }
}
