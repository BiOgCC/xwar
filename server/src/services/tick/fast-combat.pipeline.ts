/**
 * FAST COMBAT PIPELINE — Every 15 seconds
 *
 * Handles time-critical combat simulation:
 * - Battle round resolution (damage accumulation → round winner)
 * - Division training progress
 * - Division recovery (post-battle healing)
 *
 * All operations use batch SQL — no per-player loops.
 */
import { db } from '../../db/connection.js'
import { sql } from 'drizzle-orm'

/**
 * Advance training progress for all divisions in 'training' status.
 * Each tick adds 1 progress point. When progress >= 100, division becomes 'ready'.
 */
async function tickTraining() {
  // Advance training progress by 1 per tick for all training divisions
  await db.execute(sql`
    UPDATE divisions
    SET training_progress = training_progress + 1
    WHERE status = 'training'
      AND auto_training = true
  `)

  // Graduate divisions that completed training
  await db.execute(sql`
    UPDATE divisions
    SET status = 'ready',
        training_progress = 0
    WHERE status = 'training'
      AND training_progress >= 100
  `)
}

/**
 * Tick recovery for damaged divisions.
 * Decrements recovery_ticks_needed; when 0, division returns to 'ready'.
 */
async function tickRecovery() {
  // Decrement recovery counter
  await db.execute(sql`
    UPDATE divisions
    SET recovery_ticks_needed = recovery_ticks_needed - 1
    WHERE status = 'recovering'
      AND recovery_ticks_needed > 0
  `)

  // Divisions that finished recovery become ready
  await db.execute(sql`
    UPDATE divisions
    SET status = 'ready',
        recovery_ticks_needed = 0
    WHERE status = 'recovering'
      AND recovery_ticks_needed <= 0
  `)
}

/**
 * Run all fast combat pipeline operations.
 * Called every 15 seconds by the scheduler.
 */
export async function runFastCombatPipeline() {
  const start = Date.now()

  await tickTraining()
  await tickRecovery()
  // NOTE: Battle resolution (resolveTicksAndRounds, processHOICombatTick)
  // will be added here when the battle service migration is complete.
  // For now these remain client-side.

  const elapsed = Date.now() - start
  if (elapsed > 5000) {
    console.warn(`[FAST-COMBAT] Pipeline took ${elapsed}ms (>5s threshold)`)
  }
}
