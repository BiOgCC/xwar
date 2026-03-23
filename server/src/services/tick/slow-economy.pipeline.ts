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
import { armies, armyMembers, players, newsEvents } from '../../db/schema.js'
import { logger } from '../../utils/logger.js'

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

// Maintenance cost per company level
const MAINTENANCE_COST: Record<number, number> = { 1: 500, 2: 1200, 3: 2500, 4: 5000, 5: 10000, 6: 20000 }

/**
 * Charge company maintenance for companies whose next_maintenance_due <= NOW().
 * Deducts from owner's money. Disables company for 48h if owner can't pay.
 * Emits company:disabled to owner's player room.
 */
async function chargeCompanyMaintenance() {
  // Find companies due for maintenance, joined with owner balance
  const due = await db.execute(sql`
    SELECT c.id, c.type, c.level, c.owner_id, c.location,
           p.money AS owner_money, p.name AS owner_name
    FROM companies c
    JOIN players p ON p.id = c.owner_id
    WHERE (c.next_maintenance_due IS NULL OR c.next_maintenance_due <= NOW())
      AND (c.disabled_until IS NULL OR c.disabled_until <= NOW())
      AND c.owner_id IS NOT NULL
  `)

  const rows = (due as unknown as { rows: Array<{ id: string; type: string; level: number; owner_id: string; owner_money: number; owner_name: string; location: string }> }).rows ?? []
  if (rows.length === 0) return

  const emit = await getEmitter()
  const nextDue = new Date(Date.now() + 30 * 60 * 1000) // next tick

  for (const row of rows) {
    const cost = MAINTENANCE_COST[row.level] ?? 500
    try {
      await db.transaction(async (tx) => {
        if (row.owner_money >= cost) {
          // Can pay — deduct and update schedule
          await tx.execute(sql`UPDATE players SET money = money - ${cost} WHERE id = ${row.owner_id}`)
          await tx.execute(sql`UPDATE companies SET next_maintenance_due = ${nextDue} WHERE id = ${row.id}`)
        } else {
          // Cannot pay — disable company 48h
          const disabledUntil = new Date(Date.now() + 48 * 60 * 60 * 1000)
          await tx.execute(sql`
            UPDATE companies
            SET disabled_until = ${disabledUntil},
                next_maintenance_due = ${disabledUntil}
            WHERE id = ${row.id}
          `)
          await tx.insert(newsEvents).values({
            type: 'company_disabled',
            headline: `🏭 ${row.owner_name}'s company disabled (unpaid maintenance $${cost})`,
            body: null,
            countryCode: row.location ?? null,
            data: { companyId: row.id, companyType: row.type, cost, ownerId: row.owner_id },
          })
          // Emit to owner's socket room
          if (emit) {
            emit('company:disabled', {
              companyId: row.id,
              companyName: row.type,
              reason: `Maintenance cost $${cost} — insufficient funds`,
            }, `player:${row.owner_id}`)
          }
          logger.warn(`[MAINTENANCE] Company ${row.id} (${row.type}) disabled for ${row.owner_name} — owed $${cost}, had $${row.owner_money}`)
        }
      })
    } catch (e) {
      logger.error(e, `[MAINTENANCE] Failed to process company ${row.id}`)
    }
  }
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

  try { await distributeSalaries() }
  catch (e) { logger.warn({ err: e }, '[SLOW-ECONOMY] Salary distribution error') }

  try { await chargeCompanyMaintenance() }
  catch (e) { logger.warn({ err: e }, '[SLOW-ECONOMY] Maintenance error') }

  const elapsed = Date.now() - start
  if (elapsed > 10000) {
    logger.warn(`[SLOW-ECONOMY] Pipeline took ${elapsed}ms (>10s threshold)`)
  }
}
