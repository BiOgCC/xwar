/**
 * Company Routes — Create, produce, upgrade companies.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, companies } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Company types and costs
const COMPANY_TYPES = ['weapons', 'food', 'mining', 'logistics', 'defense', 'prospection'] as const
const COMPANY_COSTS: Record<string, number> = {
  weapons: 100_000,
  food: 50_000,
  mining: 80_000,
  logistics: 120_000,
  defense: 150_000,
  prospection: 200_000,
}
const UPGRADE_COSTS = [0, 500, 1500, 5000, 15000, 40000, 80000, 150000]

// ═══════════════════════════════════════════════
//  POST /api/company/create
// ═══════════════════════════════════════════════

const createSchema = z.object({
  type: z.enum(COMPANY_TYPES),
})

router.post('/create', requireAuth as any, validate(createSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { type } = req.body
    const cost = COMPANY_COSTS[type] ?? 100_000

    // Atomic deduct
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${cost}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${cost}`
    ).returning({ money: players.money, countryCode: players.countryCode })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${cost.toLocaleString()}` }); return
    }

    const [company] = await db.insert(companies).values({
      type,
      ownerId: playerId,
      level: 1,
      location: deductResult[0].countryCode,
    }).returning()

    res.json({ success: true, company, message: `${type} company created!` })
  } catch (err) {
    console.error('[COMPANY] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/upgrade
// ═══════════════════════════════════════════════

const upgradeSchema = z.object({
  companyId: z.string().uuid(),
})

router.post('/upgrade', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }

    const nextLevel = (company.level ?? 1) + 1
    if (nextLevel > 7) { res.status(400).json({ error: 'Max level reached' }); return }

    const cost = UPGRADE_COSTS[nextLevel] ?? 150000

    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${cost}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${cost}`
    ).returning({ money: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${cost.toLocaleString()}` }); return
    }

    await db.update(companies).set({ level: nextLevel }).where(eq(companies.id, companyId))

    res.json({ success: true, newLevel: nextLevel, message: `Upgraded to level ${nextLevel}!` })
  } catch (err) {
    console.error('[COMPANY] Upgrade error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/toggle-auto — Toggle auto-production
// ═══════════════════════════════════════════════

router.post('/toggle-auto', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }

    await db.update(companies).set({
      autoProduction: !company.autoProduction,
    }).where(eq(companies.id, companyId))

    res.json({ success: true, autoProduction: !company.autoProduction })
  } catch (err) {
    console.error('[COMPANY] Toggle error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/produce — Manual produce
// ═══════════════════════════════════════════════

router.post('/produce', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }
    if ((company.productionProgress ?? 0) < (company.productionMax ?? 100)) {
      res.status(400).json({ error: 'Production not ready yet' }); return
    }

    // Reset progress and give product
    await db.update(companies).set({ productionProgress: 0 }).where(eq(companies.id, companyId))

    // The actual product (items/resources) depends on company type
    // For now, increment the player's relevant resource
    const resourceMap: Record<string, string> = {
      food: 'bread',
      mining: 'scrap',
    }
    const resource = resourceMap[company.type]
    if (resource) {
      const col = resource === 'bread' ? players.bread : players.scrap
      await db.update(players).set({
        [resource]: sql`${col} + ${company.level ?? 1}`,
      }).where(eq(players.id, playerId))
    }

    res.json({ success: true, message: `Produced ${company.level ?? 1} ${company.type} goods!` })
  } catch (err) {
    console.error('[COMPANY] Produce error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/company/my-companies
// ═══════════════════════════════════════════════

router.get('/my-companies', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const myCompanies = await db.select().from(companies).where(eq(companies.ownerId, playerId))
    res.json({ success: true, companies: myCompanies })
  } catch (err) {
    console.error('[COMPANY] My companies error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
