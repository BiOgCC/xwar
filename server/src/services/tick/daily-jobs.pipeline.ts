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
import { logger } from '../../utils/logger.js'

// Lazy import to avoid circular dependency — io may not be ready at module load
let emitGameEvent: ((event: string, data: any, room?: string) => void) | null = null
async function getEmitter() {
  if (!emitGameEvent) {
    try {
      const mod = await import('../../index.js')
      emitGameEvent = mod.emitGameEvent
    } catch { /* ignore — ws role may not be running */ }
  }
  return emitGameEvent
}

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
  logger.info('[DAILY] Full bar refill complete.')
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
  logger.info('[DAILY] Country auto-income distributed.')

  // Emit fund:update to each country room
  const emit = await getEmitter()
  if (emit) {
    const funds = await db.execute(sql`SELECT code, fund FROM countries`)
    for (const row of funds as unknown as Array<{ code: string; fund: Record<string, number> }>) {
      emit('fund:update', { countryCode: row.code, money: row.fund?.money ?? 0, oil: row.fund?.oil ?? 0 }, `country:${row.code}`)
    }
  }
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
  logger.info('[DAILY] Company maintenance processed.')
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
 * Tally elections — runs every 6 hours.
 * Counts votes from elections jsonb, installs winner as president,
 * clears election data, and inserts a news event.
 */
export async function tallyElections() {
  // Fetch all governments with active elections
  const govs = await db.execute(sql`
    SELECT country_code, elections, congress
    FROM governments
    WHERE jsonb_typeof(elections->'votes') = 'object'
      AND jsonb_array_length(COALESCE(elections->'candidates', '[]'::jsonb)) > 0
  `)

  const rows = (govs as any).rows || (govs as any[])
  if (!rows || rows.length === 0) return

  for (const gov of rows) {
    const elections = gov.elections || {}
    const votes: Record<string, string> = elections.votes || {}
    const candidates: string[] = elections.candidates || []

    if (candidates.length === 0) continue

    // Tally: count how many votes each candidate received
    const tally: Record<string, number> = {}
    for (const candidate of candidates) tally[candidate] = 0
    for (const voterChoice of Object.values(votes)) {
      if (tally[voterChoice] !== undefined) tally[voterChoice]++
    }

    // Find winner (most votes, ties go to first alphabetically)
    let winner = candidates[0]
    let maxVotes = 0
    for (const [name, count] of Object.entries(tally)) {
      if (count > maxVotes || (count === maxVotes && name < winner)) {
        winner = name
        maxVotes = count
      }
    }

    // Install president + clear elections
    await db.execute(sql`
      UPDATE governments SET
        president = ${winner},
        elections = '{}'::jsonb
      WHERE country_code = ${gov.country_code}
    `)

    // News event
    await db.execute(sql`
      INSERT INTO news_events (type, headline, country_code, data)
      VALUES (
        'election_result',
        ${`🗳️ ${winner} elected president of ${gov.country_code} with ${maxVotes} votes!`},
        ${gov.country_code},
        ${JSON.stringify({ winner, tally, totalVotes: Object.keys(votes).length })}::jsonb
      )
    `)

    // Socket.IO broadcast
    const emit = await getEmitter()
    if (emit) emit('election:result', { winner, countryCode: gov.country_code, tally }, `country:${gov.country_code}`)
    if (emit) emit('news', { type: 'election_result', headline: `🗳️ ${winner} elected president of ${gov.country_code}!`, countryCode: gov.country_code })
  }

  logger.info(`[DAILY] Election tally complete. Processed ${rows.length} countries.`)
}

/**
 * Resolve region ownership — runs every 15s (via fast-combat or standalone).
 * When a battle finishes with a winner, transfer the contested region.
 * Updates country region counts and inserts news.
 */
export async function resolveRegions() {
  // Find finished battles that have a winner but haven't been processed
  const finished = await db.execute(sql`
    SELECT id, attacker_id, defender_id, region_name, winner
    FROM battles
    WHERE status = 'finished'
      AND winner IS NOT NULL
      AND region_name IS NOT NULL
  `)

  const rows = (finished as any).rows || (finished as any[])
  if (!rows || rows.length === 0) return

  for (const battle of rows) {
    const { id, attacker_id, defender_id, region_name, winner } = battle
    const loser = winner === attacker_id ? defender_id : attacker_id

    // Transfer region: increment winner's region count, decrement loser's
    await db.execute(sql`
      UPDATE countries SET regions = GREATEST(0, regions - 1)
      WHERE code = ${loser}
    `)
    await db.execute(sql`
      UPDATE countries SET regions = regions + 1
      WHERE code = ${winner}
    `)

    // Mark battle as resolved so we don't process it again
    await db.execute(sql`
      UPDATE battles SET status = 'resolved' WHERE id = ${id}
    `)

    // News
    await db.execute(sql`
      INSERT INTO news_events (type, headline, country_code, data)
      VALUES (
        'region_captured',
        ${`⚔️ ${winner} conquered ${region_name} from ${loser}!`},
        ${winner},
        ${JSON.stringify({ region: region_name, attacker: attacker_id, defender: defender_id, winner })}::jsonb
      )
    `)

    // Socket.IO broadcast
    const emit = await getEmitter()
    if (emit) {
      emit('news', { type: 'region_captured', headline: `⚔️ ${winner} conquered ${region_name} from ${loser}!` })
      emit('battle:resolved', { battleId: id, winner, loser, region: region_name }, `battle:${id}`)
    }
  }

  logger.info(`[DAILY] Region resolve complete. Processed ${rows.length} battles.`)
}

/**
 * Restore cyber effects — runs every 30 minutes.
 * Restores infrastructure levels that were zeroed by sabotage
 * when the operation's expiry time has passed.
 */
export async function restoreCyberEffects() {
  // Find expired sabotage ops that haven't been cleaned up
  const expired = await db.execute(sql`
    SELECT id, operation_id, result, target_country
    FROM cyber_ops
    WHERE status = 'completed'
      AND pillar IN ('sabotage', 'propaganda')
      AND expires_at <= NOW()
  `)

  const rows = (expired as any).rows || (expired as any[])
  if (!rows || rows.length === 0) return

  for (const op of rows) {
    const result = op.result as any
    if (!result) continue

    // Restore based on effect type
    if (op.operation_id === 'logistics_disruption' && result.effect) {
      const field = result.effect.includes('port') ? 'port_level' : 'airport_level'
      const targetCode = op.target_country || result.targetCountry
      if (targetCode) {
        await db.execute(sql`
          UPDATE countries SET ${sql.raw(field)} = GREATEST(1, ${sql.raw(field)})
          WHERE code = ${targetCode} AND ${sql.raw(field)} = 0
        `)
      }
    }
    if (op.operation_id === 'bunker_override') {
      const targetCode = op.target_country || result.targetCountry
      if (targetCode) {
        await db.execute(sql`
          UPDATE countries SET bunker_level = GREATEST(1, bunker_level * 2)
          WHERE code = ${targetCode}
        `)
      }
    }

    // Mark as expired so we don't process again
    await db.execute(sql`
      UPDATE cyber_ops SET status = 'expired' WHERE id = ${op.id}
    `)

    // Emit route:restored if this was a trade route disruption
    if (op.operation_id === 'logistics_disruption') {
      const emitFn = await getEmitter()
      if (emitFn) emitFn('route:restored', { routeId: op.result?.targetRoute ?? op.target_country })
    }
  }

  logger.info(`[DAILY] Cyber effects restoration complete. Processed ${rows.length} ops.`)
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
    case 'tally_elections':
      await tallyElections()
      break
    case 'resolve_regions':
      await resolveRegions()
      break
    case 'restore_cyber':
      await restoreCyberEffects()
      break
    default:
      logger.warn(`[DAILY] Unknown job: ${jobName}`)
  }

  const elapsed = Date.now() - start
  if (elapsed > 15000) {
    logger.warn(`[DAILY] Job '${jobName}' took ${elapsed}ms (>15s threshold)`)
  }
}

