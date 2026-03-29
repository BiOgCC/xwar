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
import { sql, and, lte } from 'drizzle-orm'
import { armies, armyMembers, players, newsEvents, companies, countries, regionalDeposits } from '../../db/schema.js'
import { logger } from '../../utils/logger.js'

// Map company types to deposit types for bonus matching
const COMPANY_DEPOSIT_MAP: Record<string, string> = {
  wheat_farm: 'wheat',
  fish_farm: 'fish',
  steak_farm: 'steak',
  oil_refinery: 'oil',
  materialx_refiner: 'materialx',
  bakery: 'wheat',
  sushi_bar: 'fish',
  wagyu_grill: 'steak',
}

// Lazy emitter — avoids circular dep at module load time
let _emitGameEvent: ((event: string, data: unknown, room?: string) => void) | null = null
async function getEmitter() {
  if (!_emitGameEvent) {
    try {
      const mod = await import('../../index.js')
      _emitGameEvent = mod.emitGameEvent
    } catch { /* ws role may not be running */ }
  }
  return _emitGameEvent
}

interface SalaryRecipient {
  playerId: string
  role: string
  amount: number
}

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
 * Oil upkeep cost per company level.
 *   oilCost  = total oil deducted from owner per tick
 *   countryTax = portion deposited into host country fund.oil (~20%)
 */
const OIL_UPKEEP_PER_LEVEL: Record<number, { oilCost: number; countryTax: number }> = {
  1: { oilCost: 5,   countryTax: 1 },
  2: { oilCost: 10,  countryTax: 2 },
  3: { oilCost: 18,  countryTax: 4 },
  4: { oilCost: 30,  countryTax: 6 },
  5: { oilCost: 50,  countryTax: 10 },
  6: { oilCost: 80,  countryTax: 16 },
  7: { oilCost: 120, countryTax: 24 },
}

/** Grace period: new companies don't pay upkeep for the first 24 hours */
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000

/**
 * Compute production multiplier based on how long a company has been starved.
 *   0-24h starved → 50% production
 *   24-72h starved → 25% production
 *   72h+ starved → 0% production
 */
function getStarvationMultiplier(oilStarvedSince: Date | null): number {
  if (!oilStarvedSince) return 1.0
  const starvedMs = Date.now() - oilStarvedSince.getTime()
  if (starvedMs < 24 * 60 * 60 * 1000) return 0.5        // 0-24h → 50%
  if (starvedMs < 72 * 60 * 60 * 1000) return 0.25       // 24-72h → 25%
  return 0                                                 // 72h+ → 0%
}

/**
 * Accumulate production points for all active companies.
 * PP gained = effectiveLevel × (1 + locationBonus/100) × starvationMultiplier
 *
 * OIL UPKEEP: Each tick, every company consumes oil from its owner.
 *   - If owner has enough oil → deduct oil, deposit tax to country, clear starvation
 *   - If owner lacks oil → mark oil_starved_since (if not already set), apply degradation
 *   - Grace period: companies < 24h old skip upkeep
 *
 * Location bonus comes from:
 *   - Conquered resources: +5% per unique type, +0.5% 2nd, +0.25% 3rd+
 *   - Active regional deposits matching the company's resource type
 * Skips disabled companies.
 */
async function tickCompanyProduction() {
  // Fetch all eligible companies with owner oil and country data
  const eligible = await db.execute(sql`
    SELECT c.id, c.type, c.level, c.location, c.owner_id,
           c.created_at, c.oil_starved_since,
           p.oil AS owner_oil,
           co.conquered_resources,
           co.active_deposit_bonus
    FROM companies c
    LEFT JOIN players p ON p.id = c.owner_id
    LEFT JOIN countries co ON co.code = c.location
    WHERE (c.disabled_until IS NULL OR c.disabled_until <= NOW())
  `)

  const rows = (eligible as unknown as {
    rows: Array<{
      id: string; type: string; level: number; location: string;
      owner_id: string; created_at: Date | string | null;
      oil_starved_since: Date | string | null;
      owner_oil: number | string | null;
      conquered_resources: any; active_deposit_bonus: any;
    }>
  }).rows ?? []

  if (rows.length === 0) return

  // Fetch all active deposits for bonus matching
  const activeDepositsResult = await db.execute(sql`
    SELECT country_code, type, bonus FROM regional_deposits WHERE active = true
  `)
  const activeDeposits = (activeDepositsResult as unknown as {
    rows: Array<{ country_code: string; type: string; bonus: number }>
  }).rows ?? []

  // Accumulate oil tax per country for batch update
  const countryOilTax: Record<string, number> = {}

  for (const row of rows) {
    const level = row.level || 1
    const effectiveLevel = Math.min(6, level)
    const upkeep = OIL_UPKEEP_PER_LEVEL[level] || OIL_UPKEEP_PER_LEVEL[7]
    const ownerOil = Number(row.owner_oil ?? 0)

    // ── Grace period check ──
    const createdAt = row.created_at ? new Date(row.created_at) : null
    const isInGracePeriod = createdAt && (Date.now() - createdAt.getTime() < GRACE_PERIOD_MS)

    // ── Oil upkeep logic (skip prospection centers? NO — all types pay) ──
    let canAffordUpkeep = true
    if (!isInGracePeriod) {
      if (ownerOil >= upkeep.oilCost) {
        // Owner can pay — deduct oil, deposit tax
        await db.execute(sql`
          UPDATE players SET oil = oil - ${upkeep.oilCost}
          WHERE id = ${row.owner_id} AND oil >= ${upkeep.oilCost}
        `)

        // Track country tax for batch deposit
        if (row.location) {
          countryOilTax[row.location] = (countryOilTax[row.location] || 0) + upkeep.countryTax
        }

        // Clear starvation if it was set
        if (row.oil_starved_since) {
          await db.execute(sql`
            UPDATE companies SET oil_starved_since = NULL WHERE id = ${row.id}
          `)
        }
      } else {
        canAffordUpkeep = false
        // Mark starvation start if not already starving
        if (!row.oil_starved_since) {
          await db.execute(sql`
            UPDATE companies SET oil_starved_since = NOW() WHERE id = ${row.id}
          `)
        }
      }
    }

    // ── Calculate production points ──
    let locationBonus = 0

    // Conquered resource bonus: +5% per unique type, +0.5% 2nd, +0.25% 3rd+
    const conqueredResources = (row.conquered_resources as string[]) || []
    if (conqueredResources.length > 0) {
      const counts: Record<string, number> = {}
      conqueredResources.forEach((r: string) => { counts[r] = (counts[r] || 0) + 1 })
      Object.values(counts).forEach((count) => {
        if (count >= 1) locationBonus += 5
        if (count >= 2) locationBonus += 0.5
        if (count >= 3) locationBonus += 0.25
      })
    }

    // Active deposit bonus matching company type
    const depositType = COMPANY_DEPOSIT_MAP[row.type]
    if (depositType) {
      const matchingDeposit = activeDeposits.find(
        d => d.country_code === row.location && d.type === depositType
      )
      if (matchingDeposit) locationBonus += matchingDeposit.bonus
    }

    // Starvation multiplier (if can't afford upkeep)
    const starvationMult = canAffordUpkeep
      ? 1.0
      : getStarvationMultiplier(
          row.oil_starved_since ? new Date(row.oil_starved_since) : new Date()
        )

    // Skip PP entirely if starvation multiplier is 0
    if (starvationMult <= 0) continue

    // Prospection centers don't accumulate PP via tick (they use manual prospect action)
    if (row.type === 'prospection_center') continue

    const pointsGenerated = effectiveLevel * (1 + locationBonus / 100) * starvationMult

    await db.execute(sql`
      UPDATE companies
      SET production_progress = production_progress + ${Math.round(pointsGenerated * 100) / 100}
      WHERE id = ${row.id}
    `)
  }

  // ── Batch deposit oil tax to country treasuries ──
  for (const [countryCode, oilAmount] of Object.entries(countryOilTax)) {
    if (oilAmount <= 0) continue
    await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          fund,
          '{oil}',
          to_jsonb(COALESCE((fund->>'oil')::bigint, 0) + ${oilAmount})
        )
      WHERE code = ${countryCode}
    `)
  }

  // Log summary
  const totalOilTaxed = Object.values(countryOilTax).reduce((s, v) => s + v, 0)
  if (totalOilTaxed > 0) {
    logger.info(`[SLOW-ECONOMY] Oil upkeep: ${totalOilTaxed} oil taxed across ${Object.keys(countryOilTax).length} countries`)
  }
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
 * Weighted: commander = 1.5x share, all others = 1.0x share.
 * Runs in a per-army transaction. Emits salary:paid to each player room.
 */
async function distributeSalaries() {
  const now = new Date()

  // Find armies due for salary
  const dueArmies = await db
    .select()
    .from(armies)
    .where(
      and(
        sql`${armies.salaryIntervalHours} > 0`,
        lte(
          sql`${armies.lastSalaryAt} + (${armies.salaryIntervalHours} || ' hours')::interval`,
          sql`NOW()`,
        ),
      ),
    )

  if (dueArmies.length === 0) return

  const emit = await getEmitter()

  for (const army of dueArmies) {
    try {
      // Load members
      const members = await db.select().from(armyMembers).where(sql`${armyMembers.armyId} = ${army.id}`)
      if (members.length === 0) {
        await db.update(armies).set({ lastSalaryAt: now }).where(sql`${armies.id} = ${army.id}`)
        continue
      }

      // Read army fund money
      const fundRaw = army.vault as Record<string, number> | null
      const totalPool = fundRaw?.money ?? 0
      if (totalPool <= 0) {
        await db.update(armies).set({ lastSalaryAt: now }).where(sql`${armies.id} = ${army.id}`)
        continue
      }

      // Compute weighted shares: commander = 1.5 weight, all others = 1.0
      const weights = members.map(m => ({ playerId: m.playerId, role: m.role ?? 'private', weight: m.role === 'commander' ? 1.5 : 1.0 }))
      const totalWeight = weights.reduce((s, w) => s + w.weight, 0)
      const perWeight = Math.floor(totalPool / totalWeight)

      const recipients: SalaryRecipient[] = weights.map(w => ({
        playerId: w.playerId,
        role: w.role,
        amount: Math.floor(perWeight * w.weight),
      }))

      const totalPaid = recipients.reduce((s, r) => s + r.amount, 0)

      // Transactional: deduct from army vault + pay each member
      await db.transaction(async (tx) => {
        // Deduct from army vault
        const newFund = { ...(fundRaw ?? {}), money: Math.max(0, totalPool - totalPaid) }
        await tx.update(armies).set({
          vault: newFund,
          lastSalaryAt: now,
        }).where(sql`${armies.id} = ${army.id}`)

        // Pay each member
        for (const r of recipients) {
          if (r.amount <= 0) continue
          await tx.update(players).set({
            money: sql`${players.money} + ${r.amount}`,
          }).where(sql`${players.id} = ${r.playerId}`)
        }

        // News event
        await tx.insert(newsEvents).values({
          type: 'salary_paid',
          headline: `💰 Army "${army.name}" paid salaries: $${totalPaid.toLocaleString()} to ${recipients.length} soldiers`,
          body: null,
          countryCode: army.countryCode,
          data: { armyId: army.id, totalPaid, recipients: recipients.length },
        })
      })

      // Emit per-player socket events
      if (emit) {
        for (const r of recipients) {
          if (r.amount > 0) {
            emit('salary:paid', { amount: r.amount, armyName: army.name, role: r.role }, `player:${r.playerId}`)
          }
        }
      }

      logger.info(`[SALARY] Army "${army.name}" paid $${totalPaid} to ${recipients.length} members`)
    } catch (e) {
      logger.error(e, `[SALARY] Failed to distribute salary for army ${army.id}`)
    }
  }
}

// Maintenance removed — no-op (aligned with frontend)

/**
 * Run all slow economy pipeline operations.
 * Called every 30 minutes by the scheduler.
 */
export async function runSlowEconomyPipeline() {
  const start = Date.now()

  await regenBars()
  await tickCompanyProduction()
  await cleanupMarketOrders()

  try { await distributeSalaries() }
  catch (e) { logger.warn({ err: e }, '[SLOW-ECONOMY] Salary distribution error') }

  const elapsed = Date.now() - start
  if (elapsed > 10000) {
    logger.warn(`[SLOW-ECONOMY] Pipeline took ${elapsed}ms (>10s threshold)`)
  }
}
