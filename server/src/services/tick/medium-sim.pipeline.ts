/**
 * MEDIUM SIMULATION PIPELINE — Every 60 seconds
 *
 * Handles medium-frequency simulation:
 * - Stock price tick (random walk + noise)
 * - Bond expiry marking (payouts handled separately)
 *
 * All operations use batch SQL — no per-player loops.
 */
import { db } from '../../db/connection.js'
import { sql } from 'drizzle-orm'

/**
 * Update all stock prices with a small random walk.
 * Server-side version: ±0.5% noise per tick.
 * Fundamentals-based pricing will be added when country metrics are fully server-side.
 */
async function tickStockPrices() {
  await db.execute(sql`
    UPDATE country_stocks SET
      price = GREATEST(
        1,
        (price::numeric * (1 + (random() - 0.5) * 0.01))::numeric(14,2)
      ),
      high = GREATEST(high::numeric, price::numeric)::numeric(14,2),
      low  = LEAST(low::numeric, price::numeric)::numeric(14,2)
  `)
}

/**
 * Mark bonds that have passed their maturity date as 'expired'.
 * Actual payout calculation is handled by a separate settlement step
 * to keep SQL simple and money flows atomic.
 */
async function markExpiredBonds() {
  await db.execute(sql`
    UPDATE bonds
    SET status = 'expired'
    WHERE status = 'active'
      AND maturity_at <= NOW()
  `)
}

/**
 * Run all medium simulation pipeline operations.
 * Called every 60 seconds by the scheduler.
 */
export async function runMediumSimPipeline() {
  const start = Date.now()

  await tickStockPrices()

  try {
    await markExpiredBonds()
  } catch (e) {
    console.warn('[MEDIUM-SIM] Bond expiry error:', e)
  }

  const elapsed = Date.now() - start
  if (elapsed > 3000) {
    console.warn(`[MEDIUM-SIM] Pipeline took ${elapsed}ms (>3s threshold)`)
  }
}
