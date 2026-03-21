/**
 * Company Routes — Create, produce, upgrade companies.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, companies, jobs, companyTransactions, regionalDeposits, playerSkills, countries } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const COMPANY_TYPES = [
  'wheat_farm', 'fish_farm', 'steak_farm',
  'bakery', 'sushi_bar', 'wagyu_grill',
  'green_ammo_factory', 'blue_ammo_factory', 'purple_ammo_factory',
  'oil_refinery', 'materialx_refiner', 'bitcoin_miner', 'prospection_center'
] as const

const COMPANY_COSTS: Record<string, { money: number, bitcoin: number }> = {
  bitcoin_miner: { money: 5000, bitcoin: 1 },
  wheat_farm: { money: 2000, bitcoin: 1 },
  fish_farm: { money: 2500, bitcoin: 1 },
  steak_farm: { money: 3000, bitcoin: 1 },
  bakery: { money: 5000, bitcoin: 1 },
  sushi_bar: { money: 8000, bitcoin: 1 },
  wagyu_grill: { money: 12000, bitcoin: 1 },
  green_ammo_factory: { money: 10000, bitcoin: 1 },
  blue_ammo_factory: { money: 20000, bitcoin: 1 },
  purple_ammo_factory: { money: 50000, bitcoin: 1 },
  oil_refinery: { money: 10000, bitcoin: 1 },
  materialx_refiner: { money: 15000, bitcoin: 1 },
  prospection_center: { money: 25000, bitcoin: 1 },
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
    const cost = COMPANY_COSTS[type] || { money: 10000, bitcoin: 1 }

    // Atomic deduct
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${cost.money}`,
      bitcoin: sql`${players.bitcoin} - ${cost.bitcoin}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${cost.money} AND ${players.bitcoin} >= ${cost.bitcoin}`
    ).returning({ money: players.money, countryCode: players.countryCode })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough resources. Need $${cost.money.toLocaleString()} and ${cost.bitcoin} BTC` }); return
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

    await db.insert(companyTransactions).values({
      playerId, companyId, message: `Upgraded to level ${nextLevel}!`
    })

    res.json({ success: true, newLevel: nextLevel, message: `Upgraded to level ${nextLevel}!` })
  } catch (err) {
    console.error('[COMPANY] Upgrade error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/move
// ═══════════════════════════════════════════════

const moveSchema = z.object({
  companyId: z.string().uuid(),
  newLocation: z.string().length(4),
})

router.post('/move', requireAuth as any, validate(moveSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId, newLocation } = req.body
    const MOVE_COST = 500

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }

    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${MOVE_COST}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${MOVE_COST}`
    ).returning()

    if (deductResult.length === 0) {
      res.status(400).json({ error: 'Not enough money ($500 needed to move)' }); return
    }

    await db.update(companies).set({ location: newLocation }).where(eq(companies.id, companyId))
    
    // Also update any active jobs
    await db.update(jobs).set({ location: newLocation }).where(eq(jobs.companyId, companyId))

    await db.insert(companyTransactions).values({
      playerId, companyId, message: `Moved company to ${newLocation} for $500`
    })

    res.json({ success: true, message: `Company moved to ${newLocation}!` })
  } catch (err) {
    console.error('[COMPANY] Move error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/prospect
// ═══════════════════════════════════════════════

router.post('/prospect', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company || company.type !== 'prospection_center') { res.status(400).json({ error: 'Invalid company for prospection' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.bitcoin! < 1 || parseFloat(String(player.stamina)) < 10) {
      res.status(400).json({ error: 'Need 1 BTC and 10 Stamina' }); return
    }

    // Deduct cost
    await db.update(players).set({
      bitcoin: sql`${players.bitcoin} - 1`,
      stamina: sql`${players.stamina} - 10`,
      experience: sql`${players.experience} + 15`
    }).where(eq(players.id, playerId))

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const prospectionLevel = skills?.prospection || 0
    const chance = (company.level || 1) * 0.05 + prospectionLevel * 0.05

    let foundDeposit = null
    const btcReward = 3 + (company.level || 1) * 2

    if (Math.random() < chance) {
      const resources = ['oil', 'materialx'] as const
      const resource = resources[Math.floor(Math.random() * resources.length)]
      
      const newDeposit = await db.insert(regionalDeposits).values({
        type: resource,
        countryCode: player.countryCode,
        bonus: 30,
        discoveredBy: playerId,
        active: true
      }).returning()

      const bonusAmount = 100 * (company.level || 1)
      const matXBonus = Math.floor(bonusAmount / 10)

      await db.update(players).set({
        bitcoin: sql`${players.bitcoin} + ${btcReward}`,
        money: sql`${players.money} + 5000`,
        oil: resource === 'oil' ? sql`${players.oil} + ${bonusAmount}` : players.oil,
        materialX: resource === 'materialx' ? sql`${players.materialX} + ${matXBonus}` : players.materialX,
        experience: sql`${players.experience} + 85` // Extra XP
      }).where(eq(players.id, playerId))

      foundDeposit = newDeposit[0]
      
      await db.insert(companyTransactions).values({
        playerId, companyId, message: `Prospection SUCCESS! Found ${resource} in ${player.countryCode}. Earned ${btcReward} BTC!`
      })
    } else {
      await db.insert(companyTransactions).values({
        playerId, companyId, message: `Prospection failed. Try again.`
      })
    }

    res.json({ success: true, deposit: foundDeposit, message: foundDeposit ? `Found ${foundDeposit.type} deposit!` : 'No deposit found.' })
  } catch (err) {
    console.error('[COMPANY] Prospect error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/enterprise
// ═══════════════════════════════════════════════

router.post('/enterprise', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || (player.entrepreneurship || 0) < 10) { res.status(400).json({ error: 'Need 10 Entrepreneurship' }); return }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const prodSkill = skills?.production || 0
    const baseProd = 10 + (prodSkill * 5) + (company.level || 1)

    // Base contribution
    const contribution = baseProd // Simplifying without RNG variance for consistent backend

    await db.update(players).set({
      entrepreneurship: sql`${players.entrepreneurship} - 10`,
      experience: sql`${players.experience} + 10`
    }).where(eq(players.id, playerId))

    await db.update(companies).set({
      productionProgress: sql`${companies.productionProgress} + ${contribution}`
    }).where(eq(companies.id, companyId))

    await db.insert(companyTransactions).values({
      playerId, companyId, message: `Owner worked: +${contribution} PP.`
    })

    res.json({ success: true, contribution, message: `Worked for +${contribution} PP!` })
  } catch (err) {
    console.error('[COMPANY] Enterprise error:', err)
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
    
    const points = company.productionProgress ?? 0
    if (points <= 0) {
      res.status(400).json({ error: 'No production progress' }); return
    }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)

    let result = ''
    let usedPoints = points
    const updateData: any = {}

    switch (company.type) {
      case 'bitcoin_miner': {
        const moneyEarned = Math.floor(points)
        updateData.money = sql`${players.money} + ${moneyEarned}`
        result = `+$${moneyEarned}`
        const btcChance = Math.min(0.05, 0.01 + (points * 0.00066))
        if (Math.random() < btcChance) {
          updateData.bitcoin = sql`${players.bitcoin} + 1`
          result += ' & 1 ₿ bonus!'
        }
        break
      }
      case 'wheat_farm': {
        const output = Math.max(1, Math.floor(points * 0.5))
        updateData.wheat = sql`${players.wheat} + ${output}`
        result = `+${output} Wheat`
        break
      }
      case 'fish_farm': {
        const output = Math.max(1, Math.floor(points * 0.5))
        updateData.fish = sql`${players.fish} + ${output}`
        result = `+${output} Fish`
        break
      }
      case 'steak_farm': {
        const output = Math.max(1, Math.floor(points * 0.5))
        updateData.steak = sql`${players.steak} + ${output}`
        result = `+${output} Steak`
        break
      }
      case 'bakery': {
        const affordable = Math.floor((player.wheat || 0) / 10)
        const possible = Math.max(1, Math.floor(points * 0.1))
        const count = Math.min(affordable, possible)
        if (count <= 0) { res.status(400).json({ error: 'Not enough Wheat (Need 10/Bread)' }); return }
        updateData.wheat = sql`${players.wheat} - ${10 * count}`
        updateData.bread = sql`${players.bread} + ${count}`
        result = `+${count} Bread`
        usedPoints = (count === possible) ? points : count * 10
        break
      }
      case 'sushi_bar': {
        const affordable = Math.floor((player.fish || 0) / 1)
        const possible = Math.max(1, Math.floor(points * 0.1))
        const count = Math.min(affordable, possible)
        if (count <= 0) { res.status(400).json({ error: 'Not enough Fish (Need 1/Sushi)' }); return }
        updateData.fish = sql`${players.fish} - ${1 * count}`
        updateData.sushi = sql`${players.sushi} + ${count}`
        result = `+${count} Sushi`
        usedPoints = (count === possible) ? points : count * 10
        break
      }
      case 'wagyu_grill': {
        const affordable = Math.floor((player.steak || 0) / 1)
        const possible = Math.max(1, Math.floor(points * 0.1))
        const count = Math.min(affordable, possible)
        if (count <= 0) { res.status(400).json({ error: 'Not enough Steak (Need 1/Wagyu)' }); return }
        updateData.steak = sql`${players.steak} - ${1 * count}`
        updateData.wagyu = sql`${players.wagyu} + ${count}`
        result = `+${count} Wagyu`
        usedPoints = (count === possible) ? points : count * 10
        break
      }
      case 'green_ammo_factory': {
        const possible = Math.floor(points / 1)
        if (possible <= 0) { res.status(400).json({ error: 'Need at least 1 PP' }); return }
        const count = Math.min(Number(player.materialX || 0), possible)
        if (count <= 0) { res.status(400).json({ error: 'Not enough MaterialX' }); return }
        updateData.materialX = sql`${players.materialX} - ${count}`
        updateData.greenBullets = sql`${players.greenBullets} + ${count}`
        result = `+${count} Green Bullets`
        usedPoints = count * 1
        const indBonus = Math.min(0.40, ((skills?.industrialist || 0) * 0.05))
        if (points >= (company.productionMax || 100) && Math.random() < (0.10 + indBonus)) {
          updateData.redBullets = sql`${players.redBullets} + 1`
          result += ' & 1 🔴 RED BULLET!'
        }
        break
      }
      case 'blue_ammo_factory': {
        const possible = Math.floor(points / 3)
        if (possible <= 0) { res.status(400).json({ error: 'Need at least 3 PP' }); return }
        const count = Math.min(Math.floor(Number(player.materialX || 0) / 3), possible)
        if (count <= 0) { res.status(400).json({ error: 'Not enough MaterialX' }); return }
        updateData.materialX = sql`${players.materialX} - ${count * 3}`
        updateData.blueBullets = sql`${players.blueBullets} + ${count}`
        result = `+${count} Blue Bullets`
        usedPoints = count * 3
        const indBonus = Math.min(0.40, ((skills?.industrialist || 0) * 0.05))
        if (points >= (company.productionMax || 100) && Math.random() < (0.10 + indBonus)) {
          updateData.redBullets = sql`${players.redBullets} + 1`
          result += ' & 1 🔴 RED BULLET!'
        }
        break
      }
      case 'purple_ammo_factory': {
        const possible = Math.floor(points / 9)
        if (possible <= 0) { res.status(400).json({ error: 'Need at least 9 PP' }); return }
        const count = Math.min(Math.floor(Number(player.materialX || 0) / 9), possible)
        if (count <= 0) { res.status(400).json({ error: 'Not enough MaterialX' }); return }
        updateData.materialX = sql`${players.materialX} - ${count * 9}`
        updateData.purpleBullets = sql`${players.purpleBullets} + ${count}`
        result = `+${count} Purple Bullets`
        usedPoints = count * 9
        const indBonus = Math.min(0.40, ((skills?.industrialist || 0) * 0.05))
        if (points >= (company.productionMax || 100) && Math.random() < (0.10 + indBonus)) {
          updateData.redBullets = sql`${players.redBullets} + 1`
          result += ' & 1 🔴 RED BULLET!'
        }
        break
      }
      case 'oil_refinery': {
        const output = Math.max(1, Math.floor(points * 0.5))
        updateData.oil = sql`${players.oil} + ${output}`
        result = `+${output} Oil`
        break
      }
      case 'materialx_refiner': {
        const output = Math.max(1, Math.floor(points * 0.25))
        updateData.materialX = sql`${players.materialX} + ${output}`
        result = `+${output} MaterialX`
        break
      }
      default:
        res.status(400).json({ error: 'Invalid company type for production' }); return
    }

    // Apply player updates
    updateData.itemsProduced = sql`${players.itemsProduced} + 1`
    updateData.experience = sql`${players.experience} + 20`
    await db.update(players).set(updateData).where(eq(players.id, playerId))

    // Deduct used points
    await db.update(companies).set({
      productionProgress: Math.max(0, points - usedPoints)
    }).where(eq(companies.id, companyId))
    
    await db.insert(companyTransactions).values({
      playerId, companyId, message: result
    })

    res.json({ success: true, message: result })
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
    const transactions = await db.select().from(companyTransactions)
      .where(eq(companyTransactions.playerId, playerId))
      .orderBy(sql`${companyTransactions.timestamp} DESC`)
      .limit(50)

    res.json({ success: true, companies: myCompanies, transactions })
  } catch (err) {
    console.error('[COMPANY] My companies error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/company/jobs
// ═══════════════════════════════════════════════

router.get('/jobs', requireAuth as any, async (req, res) => {
  try {
    const allJobs = await db.select().from(jobs)
    res.json({ success: true, jobs: allJobs })
  } catch (err) {
    console.error('[COMPANY] Jobs list error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/post-job
// ═══════════════════════════════════════════════

const postJobSchema = z.object({
  companyId: z.string().uuid(),
  payPerPP: z.number().min(0.1).max(100),
})

router.post('/post-job', requireAuth as any, validate(postJobSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId, payPerPP } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }
    if (company.type === 'prospection_center') { res.status(400).json({ error: 'Cannot post jobs here' }); return }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)

    // Remove any existing job
    await db.delete(jobs).where(eq(jobs.companyId, companyId))

    // Insert new
    const [newJob] = await db.insert(jobs).values({
      companyId,
      employerName: player.name,
      companyType: company.type,
      companyLevel: company.level || 1,
      payPerPP: payPerPP.toString(),
      productionBonus: 0, // Placeholder
      location: company.location,
    }).returning()

    await db.insert(companyTransactions).values({
      playerId, companyId, message: `Posted job offering $${payPerPP}/PP.`
    })

    res.json({ success: true, message: 'Job posted successfully!', job: newJob })
  } catch (err) {
    console.error('[COMPANY] Post job error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/remove-job
// ═══════════════════════════════════════════════

const removeJobSchema = z.object({
  companyId: z.string().uuid(),
})

router.post('/remove-job', requireAuth as any, validate(removeJobSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { companyId } = req.body

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.ownerId !== playerId) { res.status(403).json({ error: 'Not your company' }); return }

    await db.delete(jobs).where(eq(jobs.companyId, companyId))

    await db.insert(companyTransactions).values({
      playerId, companyId, message: `Removed job listing.`
    })

    res.json({ success: true, message: 'Job removed.' })
  } catch (err) {
    console.error('[COMPANY] Remove job error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/company/work
// ═══════════════════════════════════════════════

const workSchema = z.object({
  jobId: z.string().uuid(),
})

router.post('/work', requireAuth as any, validate(workSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { jobId } = req.body

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }

    const [company] = await db.select().from(companies).where(eq(companies.id, job.companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Employer company not found' }); return }

    const [employee] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!employee || (employee.work || 0) < 10) { res.status(400).json({ error: 'Need 10 Work points' }); return }

    const [employer] = await db.select().from(players).where(eq(players.id, company.ownerId!)).limit(1)
    if (!employer) { res.status(404).json({ error: 'Employer not found' }); return }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const prodSkill = skills?.production || 0
    const baseProd = 10 + (prodSkill * 5) + (company.level || 1)
    const contribution = baseProd 

    const payPerPP = parseFloat(String(job.payPerPP))
    const grossPay = Math.floor(contribution * payPerPP)
    const TAX_RATE = 0.10
    const totalTax = Math.floor(grossPay * TAX_RATE)
    const employeeTax = Math.floor(totalTax / 2)
    const employerTax = totalTax - employeeTax
    const netPay = grossPay - employeeTax
    const totalEmployerCost = grossPay + employerTax

    if (employer.money! < totalEmployerCost) {
      res.status(400).json({ error: 'Employer cannot afford wages and taxes' }); return
    }

    // Process Employer (pay salary, get PP)
    await db.update(players).set({ money: sql`${players.money} - ${totalEmployerCost}` }).where(eq(players.id, employer.id))
    await db.update(companies).set({ productionProgress: sql`${companies.productionProgress} + ${contribution}` }).where(eq(companies.id, company.id))

    // Process Employee (get net pay, lose work, gain xp)
    await db.update(players).set({
      money: sql`${players.money} + ${netPay}`,
      work: sql`${players.work} - 10`,
      experience: sql`${players.experience} + 8`
    }).where(eq(players.id, playerId))

    // Process Tax to Country
    if (job.location) {
      const [country] = await db.select().from(countries).where(eq(countries.code, job.location)).limit(1)
      if (country) {
        const currentFund = country.fund as any || { money: 0 }
        currentFund.money = (currentFund.money || 0) + totalTax
        await db.update(countries).set({ fund: currentFund }).where(eq(countries.code, job.location))
      }
    }

    // Add TX for Employer
    await db.insert(companyTransactions).values({
      playerId: employer.id, companyId: company.id, message: `Paid $${totalEmployerCost} total to ${employee.name} for ${contribution} PP.`
    })
    // Add TX for Employee
    await db.insert(companyTransactions).values({
      playerId, companyId: company.id, message: `Worked for ${employer.name}, earned $${netPay}.`
    })

    res.json({ success: true, netPay, contribution, employerCost: totalEmployerCost, message: `Worked! Earned $${netPay}` })
  } catch (err) {
    console.error('[COMPANY] Work error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
