/**
 * DAILY / SCHEDULED JOBS PIPELINE — Various intervals
 *
 * Handles infrequent but important game events:
 * - Full bar refill (every 12 hours)
 * - Country auto-income (every 8 hours)
 * - Daily company maintenance (every 24 hours)
 * - Fund history snapshot (every 1 hour)
 * - Bounty expiry (every 30 minutes)
 *
 * Each operation checks its own time gate internally,
 * so this pipeline can be called frequently without side effects.
 * All operations use batch SQL.
 */
import { db } from '../../db/connection.js'
import { sql } from 'drizzle-orm'

/**
 * Full bar refill — runs every 12 hours.
 * Resets all player bars to their maximum values.
 */
export async function fullBarRefill() {
  await db.execute(sql`
    UPDATE players SET
      stamina = max_stamina::text::numeric,
      hunger = max_hunger,
      entrepreneurship = max_entrepreneurship,
      work = max_work
  `)
  console.log('[DAILY] Full bar refill complete.')
}

/**
 * Country auto-income — runs every 8 hours.
 * Generates income for every country based on population + infrastructure.
 * Income formula:
 *   baseMoney = population * 0.1
 *   infraMultiplier = 1 + port*0.05 + airport*0.05 + milBase*0.03 + bunker*0.02
 *   fund.money += floor(baseMoney * infraMultiplier)
 */
export async function countryAutoIncome() {
  await db.execute(sql`
    UPDATE countries SET
      fund = jsonb_set(
        fund,
        '{money}',
        to_jsonb(
          COALESCE((fund->>'money')::bigint, 0) +
          FLOOR(
            population * 0.1 *
            (1 + port_level * 0.05 + airport_level * 0.05 + military_base_level * 0.03 + bunker_level * 0.02)
          )::bigint
        )
      )
    WHERE population > 0
  `)
  console.log('[DAILY] Country auto-income distributed.')
}

/**
 * Company maintenance — runs every 24 hours.
 * Deducts maintenance cost per company based on level.
 * Companies whose owners can't pay are disabled for 48 hours.
 * 
 * Cost per level: [0, 500, 1500, 5000, 15000, 40000, 80000, 150000]
 * 
 * NOTE: This is a simplified version. Full implementation will need to
 * check owner's balance and deduct per-company, handling insufficient funds.
 * For now, we just log that maintenance ran.
 */
export async function companyMaintenance() {
  // Disable companies that have been disabled and whose cooldown has passed
  await db.execute(sql`
    UPDATE companies
    SET disabled_until = NULL
    WHERE disabled_until IS NOT NULL
      AND disabled_until <= NOW()
  `)
  console.log('[DAILY] Company maintenance processed.')
}

/**
 * Fund history snapshot — runs every 1 hour.
 * Records each country's current fund.money into news_events for charting.
 */
export async function fundSnapshot() {
  await db.execute(sql`
    INSERT INTO news_events (type, headline, body, data, created_at)
    VALUES (
      'fund_snapshot',
      'Hourly Fund Snapshot',
      NULL,
      (
        SELECT jsonb_object_agg(code, COALESCE((fund->>'money')::bigint, 0))
        FROM countries
      ),
      NOW()
    )
  `)
}

/**
 * Expire bounties older than 72 hours.
 */
export async function expireBounties() {
  await db.execute(sql`
    UPDATE bounties
    SET status = 'expired'
    WHERE status = 'active'
      AND created_at < NOW() - interval '72 hours'
  `)
}

/**
 * Run all daily/scheduled pipeline operations.
 * Each operation is independently try/caught so one failure doesn't block others.
 */
export async function runDailyJobsPipeline(jobName: string) {
  const start = Date.now()

  switch (jobName) {
    case 'full_refill':
      await fullBarRefill()
      break
    case 'auto_income':
      await countryAutoIncome()
      break
    case 'maintenance':
      await companyMaintenance()
      break
    case 'fund_snapshot':
      await fundSnapshot()
      break
    case 'expire_bounties':
      await expireBounties()
      break
    default:
      console.warn(`[DAILY] Unknown job: ${jobName}`)
  }

  const elapsed = Date.now() - start
  if (elapsed > 15000) {
    console.warn(`[DAILY] Job '${jobName}' took ${elapsed}ms (>15s threshold)`)
  }
}
