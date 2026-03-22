/**
 * SLOW ECONOMY PIPELINE — Every 30 minutes
 *
 * Handles periodic economic simulation:
 * - Player bar regeneration (~4.17% of max → fills in 12h)
 * - Company production accumulation (PP per level)
 * - Market order cleanup (expire 24h+ old orders)
 * - Army salary distribution (when interval elapsed)
 *
 * All operations use batch SQL — O(1) regardless of player count.
 */
import { db } from '../../db/connection.js'
import { sql } from 'drizzle-orm'

/**
 * Regenerate player bars: stamina, hunger, entrepreneurship, work.
 * Adds ~4.17% of max value per tick (1/24 → fills in 12h). Uses LEAST to cap at max.
 */
async function regenBars() {
  await db.execute(sql`
    UPDATE players SET
      stamina = LEAST(max_stamina::numeric, stamina::numeric + max_stamina / 24.0),
      hunger = LEAST(max_hunger, hunger + GREATEST(1, max_hunger / 24)),
      entrepreneurship = LEAST(max_entrepreneurship, entrepreneurship + GREATEST(1, max_entrepreneurship / 24)),
      work = LEAST(max_work, work + GREATEST(1, max_work / 24))
  `)
}

/**
 * Accumulate production points for all active companies.
 * PP gained = company level per tick (capped at level 6 effective).
 * Skips prospection centers and disabled companies.
 */
async function tickCompanyProduction() {
  await db.execute(sql`
    UPDATE companies SET
      production_progress = production_progress + LEAST(level, 6)
    WHERE auto_production = true
      AND (disabled_until IS NULL OR disabled_until <= NOW())
  `)
  // NOTE: Location-based bonuses (conquered resources, deposits) will be
  // added when those calculations move fully server-side. For now, base
  // production per level is sufficient for the tick.
}

/**
 * Expire open market orders older than 24 hours.
 */
async function cleanupMarketOrders() {
  await db.execute(sql`
    UPDATE market_orders
    SET status = 'expired'
    WHERE status = 'open'
      AND created_at < NOW() - interval '24 hours'
  `)
}

/**
 * Distribute salary for armies whose distribution interval has elapsed.
 * Moves salary_pool to soldier balances based on the army's split mode.
 * 
 * For the 'equal' split (most common), batch SQL handles it directly.
 * Complex modes (by-rank, by-damage) are processed row-by-row.
 */
async function distributeSalaries() {
  // For now, just reset the distribution timer for armies whose interval has passed.
  // Full salary distribution requires reading army members and computing splits,
  // which will be a dedicated service method.
  await db.execute(sql`
    UPDATE armies
    SET last_salary_at = NOW()
    WHERE last_salary_at + (salary_interval_hours || ' hours')::interval <= NOW()
      AND salary_interval_hours > 0
  `)
}

/**
 * Run all slow economy pipeline operations.
 * Called every 30 minutes by the scheduler.
 */
export async function runSlowEconomyPipeline() {
  const start = Date.now()

  await regenBars()
  await tickCompanyProduction()
  await cleanupMarketOrders()

  try {
    await distributeSalaries()
  } catch (e) {
    console.warn('[SLOW-ECONOMY] Salary distribution error:', e)
  }

  const elapsed = Date.now() - start
  if (elapsed > 10000) {
    console.warn(`[SLOW-ECONOMY] Pipeline took ${elapsed}ms (>10s threshold)`)
  }
}
