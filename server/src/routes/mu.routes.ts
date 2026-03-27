/**
 * Military Unit (Guild / PMC) Routes
 * MUs are guilds that give bonuses to players — NOT division-based.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, militaryUnits, muMembers, countries } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// ═══════════════════════════════════════════════
//  GET /api/mu/list — List all MUs (or by country)
// ═══════════════════════════════════════════════

router.get('/list', async (req, res) => {
  try {
    const { country } = req.query
    let units
    if (country && typeof country === 'string') {
      units = await db.select().from(militaryUnits).where(eq(militaryUnits.countryCode, country))
    } else {
      units = await db.select().from(militaryUnits)
    }

    // Attach member counts
    const result = await Promise.all(units.map(async (u) => {
      const members = await db.select().from(muMembers).where(eq(muMembers.unitId, u.id))
      return { ...u, members }
    }))

    res.json({ success: true, units: result })
  } catch (err) {
    console.error('[MU] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/mu/:id — Get single MU with members
// ═══════════════════════════════════════════════

router.get('/:id', async (req, res) => {
  try {
    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, req.params.id)).limit(1)
    if (!unit) { res.status(404).json({ error: 'Unit not found' }); return }
    const members = await db.select().from(muMembers).where(eq(muMembers.unitId, unit.id))
    res.json({ success: true, unit: { ...unit, members } })
  } catch (err) {
    console.error('[MU] Get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/create — Create a new MU ($50,000)
// ═══════════════════════════════════════════════

const createSchema = z.object({
  name: z.string().min(1).max(64),
  regionId: z.string().optional(),
})

router.post('/create', requireAuth as any, validate(createSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { name, regionId } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    // Check not already in a MU
    const existing = await db.select().from(muMembers).where(eq(muMembers.playerId, player.name!)).limit(1)
    if (existing.length > 0) { res.status(400).json({ error: 'Already in a Military Unit.' }); return }

    const CREATE_COST = 50_000
    if ((player.money ?? 0) < CREATE_COST) { res.status(400).json({ error: `Need $${CREATE_COST.toLocaleString()}.` }); return }

    // Deduct money
    await db.update(players).set({ money: (player.money ?? 0) - CREATE_COST }).where(eq(players.id, playerId))

    // Create unit
    const [newUnit] = await db.insert(militaryUnits).values({
      name: name.trim(),
      ownerId: player.name!,
      ownerName: player.name!,
      ownerCountry: player.countryCode || 'US',
      countryCode: player.countryCode || 'US',
      regionId: regionId || '',
      transactions: [{
        id: `txn_${Date.now()}_init`, type: 'deposit', amount: CREATE_COST,
        currency: 'money', playerName: player.name, description: 'Unit creation fee', timestamp: Date.now(),
      }],
    }).returning()

    // Add creator as commander
    await db.insert(muMembers).values({
      unitId: newUnit.id,
      playerId: player.name!,
      playerName: player.name!,
      level: player.level ?? 1,
      countryCode: player.countryCode || 'US',
      role: 'commander',
      totalDamage: player.damageDone ?? 0,
    })

    res.json({ success: true, message: `Military Unit "${name}" created!`, unitId: newUnit.id })
  } catch (err) {
    console.error('[MU] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/join — Direct join an MU
// ═══════════════════════════════════════════════

const joinSchema = z.object({ unitId: z.string().uuid() })

router.post('/join', requireAuth as any, validate(joinSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { unitId } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const existing = await db.select().from(muMembers).where(eq(muMembers.playerId, player.name!)).limit(1)
    if (existing.length > 0) { res.status(400).json({ error: 'Already in a Military Unit.' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (!unit) { res.status(404).json({ error: 'Unit not found.' }); return }

    const memberCount = await db.select().from(muMembers).where(eq(muMembers.unitId, unitId))
    const upgrades = (unit.upgrades as any) || { barracks: 0 }
    const maxMembers = 8 + (upgrades.barracks ?? 0) * 2
    if (memberCount.length >= maxMembers) { res.status(400).json({ error: `Unit is full (${maxMembers} max).` }); return }

    await db.insert(muMembers).values({
      unitId,
      playerId: player.name!,
      playerName: player.name!,
      level: player.level ?? 1,
      countryCode: player.countryCode || 'US',
      role: 'member',
      totalDamage: player.damageDone ?? 0,
    })

    res.json({ success: true, message: `Joined "${unit.name}"!` })
  } catch (err) {
    console.error('[MU] Join error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/leave — Leave current MU
// ═══════════════════════════════════════════════

router.post('/leave', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [membership] = await db.select().from(muMembers).where(eq(muMembers.playerId, player.name!)).limit(1)
    if (!membership) { res.status(400).json({ error: 'Not in a Military Unit.' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, membership.unitId)).limit(1)
    if (!unit) { res.status(404).json({ error: 'Unit not found.' }); return }

    // Owner can't leave if others remain (player-owned MUs only)
    if (!unit.isStateOwned && unit.ownerId === player.name) {
      const allMembers = await db.select().from(muMembers).where(eq(muMembers.unitId, unit.id))
      if (allMembers.length > 1) { res.status(400).json({ error: 'Transfer ownership before leaving.' }); return }
    }

    // Remove membership
    await db.delete(muMembers).where(and(eq(muMembers.unitId, membership.unitId), eq(muMembers.playerId, player.name!)))

    // If player-owned and last member, delete unit
    if (!unit.isStateOwned) {
      const remaining = await db.select().from(muMembers).where(eq(muMembers.unitId, unit.id))
      if (remaining.length === 0) {
        await db.delete(militaryUnits).where(eq(militaryUnits.id, unit.id))
      }
    }

    res.json({ success: true, message: 'Left the Military Unit.' })
  } catch (err) {
    console.error('[MU] Leave error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/donate — Donate money or resource
// ═══════════════════════════════════════════════

const donateSchema = z.object({
  unitId: z.string().uuid(),
  currency: z.string().min(1),  // 'money' | resourceId
  amount: z.number().int().positive(),
  message: z.string().optional(),
})

router.post('/donate', requireAuth as any, validate(donateSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { unitId, currency, amount, message } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (!unit) { res.status(404).json({ error: 'Unit not found.' }); return }

    const vault = (unit.vault as any) || { treasury: 0, resources: {} }
    const transactions = (unit.transactions as any[]) || []
    const donations = (unit.donations as any[]) || []

    if (currency === 'money') {
      if ((player.money ?? 0) < amount) { res.status(400).json({ error: 'Insufficient funds.' }); return }
      await db.update(players).set({ money: (player.money ?? 0) - amount }).where(eq(players.id, playerId))
      vault.treasury = (vault.treasury || 0) + amount
    } else {
      // Resource donation
      const playerAmount = (player as any)[currency] ?? 0
      if (playerAmount < amount) { res.status(400).json({ error: `Not enough ${currency}.` }); return }
      await db.update(players).set({ [currency]: playerAmount - amount } as any).where(eq(players.id, playerId))
      vault.resources = vault.resources || {}
      vault.resources[currency] = (vault.resources[currency] || 0) + amount
    }

    transactions.push({
      id: `txn_${Date.now()}`, type: 'deposit', amount, currency,
      playerName: player.name, description: `Donated ${amount} ${currency}`, timestamp: Date.now(),
    })
    donations.push({
      id: `don_${Date.now()}`, donorName: player.name, donorCountry: player.countryCode || 'US',
      amount, currency, message: message || '', timestamp: Date.now(),
    })

    await db.update(militaryUnits).set({
      vault, transactions: transactions.slice(-50), donations: donations.slice(-100),
    }).where(eq(militaryUnits.id, unitId))

    res.json({ success: true, message: `Donated ${amount} ${currency} to ${unit.name}!` })
  } catch (err) {
    console.error('[MU] Donate error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/distribute — Distribute vault resource to members
// ═══════════════════════════════════════════════

const distributeSchema = z.object({
  unitId: z.string().uuid(),
  resourceId: z.string().min(1),
  amount: z.number().int().positive(),
})

router.post('/distribute', requireAuth as any, validate(distributeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { unitId, resourceId, amount } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (!unit) { res.status(404).json({ error: 'Unit not found.' }); return }

    // Check commander/owner
    const [membership] = await db.select().from(muMembers)
      .where(and(eq(muMembers.unitId, unitId), eq(muMembers.playerId, player.name!))).limit(1)
    if (!membership || (membership.role !== 'commander' && unit.ownerId !== player.name)) {
      res.status(403).json({ error: 'Only commanders can distribute.' }); return
    }

    const vault = (unit.vault as any) || { treasury: 0, resources: {} }
    const currentQty = resourceId === 'money' ? vault.treasury : (vault.resources?.[resourceId] || 0)
    if (currentQty < amount) { res.status(400).json({ error: `Vault only has ${currentQty} ${resourceId}.` }); return }

    const allMembers = await db.select().from(muMembers).where(eq(muMembers.unitId, unitId))
    const perMember = Math.floor(amount / allMembers.length)
    if (perMember < 1) { res.status(400).json({ error: 'Not enough to distribute 1 per member.' }); return }
    const totalUsed = perMember * allMembers.length

    // Update vault
    if (resourceId === 'money') {
      vault.treasury -= totalUsed
    } else {
      vault.resources[resourceId] = (vault.resources[resourceId] || 0) - totalUsed
    }

    const transactions = (unit.transactions as any[]) || []
    transactions.push({
      id: `txn_${Date.now()}`, type: 'withdraw', amount: totalUsed, currency: resourceId,
      playerName: player.name, description: `Distributed ${perMember} ${resourceId} each to ${allMembers.length} members`,
      timestamp: Date.now(),
    })

    await db.update(militaryUnits).set({
      vault, transactions: transactions.slice(-50),
    }).where(eq(militaryUnits.id, unitId))

    // Credit each member's player account
    for (const member of allMembers) {
      const [mp] = await db.select().from(players).where(eq(players.name, member.playerId)).limit(1)
      if (mp) {
        if (resourceId === 'money') {
          await db.update(players).set({ money: (mp.money ?? 0) + perMember }).where(eq(players.id, mp.id))
        } else {
          const cur = (mp as any)[resourceId] ?? 0
          await db.update(players).set({ [resourceId]: cur + perMember } as any).where(eq(players.id, mp.id))
        }
      }
    }

    res.json({ success: true, message: `Distributed ${perMember} ${resourceId} to each member (${totalUsed} total).` })
  } catch (err) {
    console.error('[MU] Distribute error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/upgrade — Purchase an upgrade track level
// ═══════════════════════════════════════════════

const upgradeSchema = z.object({
  unitId: z.string().uuid(),
  track: z.enum(['barracks', 'warDoctrine', 'logistics', 'intelligence']),
})

const UPGRADE_COSTS: Record<string, number[]> = {
  barracks:     [10000, 25000, 50000, 100000, 250000],
  warDoctrine:  [15000, 35000, 75000, 150000, 300000],
  logistics:    [10000, 25000, 50000, 100000, 250000],
  intelligence: [12000, 30000, 60000, 120000, 275000],
}

router.post('/upgrade', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { unitId, track } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (!unit) { res.status(404).json({ error: 'Unit not found.' }); return }

    // Check commander/owner
    const [membership] = await db.select().from(muMembers)
      .where(and(eq(muMembers.unitId, unitId), eq(muMembers.playerId, player.name!))).limit(1)
    if (!membership || (membership.role !== 'commander' && unit.ownerId !== player.name)) {
      res.status(403).json({ error: 'Only commanders/owner can upgrade.' }); return
    }

    const upgrades = (unit.upgrades as any) || { barracks: 0, warDoctrine: 0, logistics: 0, intelligence: 0 }
    const currentLevel = upgrades[track] ?? 0
    const costs = UPGRADE_COSTS[track]
    if (!costs || currentLevel >= costs.length) { res.status(400).json({ error: 'Already at max level.' }); return }

    const cost = costs[currentLevel]
    const vault = (unit.vault as any) || { treasury: 0, resources: {} }
    if (vault.treasury < cost) { res.status(400).json({ error: `Treasury needs $${cost.toLocaleString()}.` }); return }

    vault.treasury -= cost
    upgrades[track] = currentLevel + 1

    const transactions = (unit.transactions as any[]) || []
    transactions.push({
      id: `txn_${Date.now()}`, type: 'purchase', amount: cost, currency: 'money',
      playerName: player.name, description: `Upgraded ${track} to Lv.${currentLevel + 1}`, timestamp: Date.now(),
    })

    await db.update(militaryUnits).set({
      vault, upgrades, transactions: transactions.slice(-50),
    }).where(eq(militaryUnits.id, unitId))

    res.json({ success: true, message: `${track} upgraded to Level ${currentLevel + 1}!` })
  } catch (err) {
    console.error('[MU] Upgrade error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/promote — Promote member to commander
// ═══════════════════════════════════════════════

const memberSchema = z.object({
  unitId: z.string().uuid(),
  targetPlayerId: z.string(),
})

router.post('/promote', requireAuth as any, validate(memberSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { unitId, targetPlayerId } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (!unit || unit.ownerId !== player.name) { res.status(403).json({ error: 'Only owner can promote.' }); return }

    await db.update(muMembers).set({ role: 'commander' })
      .where(and(eq(muMembers.unitId, unitId), eq(muMembers.playerId, targetPlayerId)))

    res.json({ success: true, message: `${targetPlayerId} promoted to commander.` })
  } catch (err) {
    console.error('[MU] Promote error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/demote — Demote member to regular
// ═══════════════════════════════════════════════

router.post('/demote', requireAuth as any, validate(memberSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { unitId, targetPlayerId } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (!unit || unit.ownerId !== player.name) { res.status(403).json({ error: 'Only owner can demote.' }); return }

    await db.update(muMembers).set({ role: 'member' })
      .where(and(eq(muMembers.unitId, unitId), eq(muMembers.playerId, targetPlayerId)))

    res.json({ success: true, message: `${targetPlayerId} demoted to member.` })
  } catch (err) {
    console.error('[MU] Demote error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/mu/record-damage — Record combat damage for a member
// ═══════════════════════════════════════════════

const damageSchema = z.object({
  unitId: z.string().uuid(),
  playerName: z.string(),
  damage: z.number().positive(),
})

router.post('/record-damage', requireAuth as any, validate(damageSchema), async (req, res) => {
  try {
    const { unitId, playerName, damage } = req.body

    // Update member stats
    const [member] = await db.select().from(muMembers)
      .where(and(eq(muMembers.unitId, unitId), eq(muMembers.playerId, playerName))).limit(1)
    if (!member) { res.status(404).json({ error: 'Member not found.' }); return }

    await db.update(muMembers).set({
      weeklyDamage: (member.weeklyDamage ?? 0) + damage,
      totalDamage: (member.totalDamage ?? 0) + damage,
      lastActive: new Date(),
    }).where(and(eq(muMembers.unitId, unitId), eq(muMembers.playerId, playerName)))

    // Update unit totals + cycle damage
    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, unitId)).limit(1)
    if (unit) {
      const cycleDamage = (unit.cycleDamage as Record<string, number>) || {}
      cycleDamage[playerName] = (cycleDamage[playerName] || 0) + damage
      await db.update(militaryUnits).set({
        weeklyDamageTotal: (unit.weeklyDamageTotal ?? 0) + damage,
        totalDamageTotal: (unit.totalDamageTotal ?? 0) + damage,
        cycleDamage,
      }).where(eq(militaryUnits.id, unitId))
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[MU] Record damage error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/mu/player-unit — Get the MU the current player belongs to
// ═══════════════════════════════════════════════

router.get('/player-unit', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [membership] = await db.select().from(muMembers).where(eq(muMembers.playerId, player.name!)).limit(1)
    if (!membership) { res.json({ success: true, unit: null, membership: null }); return }

    const [unit] = await db.select().from(militaryUnits).where(eq(militaryUnits.id, membership.unitId)).limit(1)
    const allMembers = unit ? await db.select().from(muMembers).where(eq(muMembers.unitId, unit.id)) : []

    res.json({ success: true, unit: unit ? { ...unit, members: allMembers } : null, membership })
  } catch (err) {
    console.error('[MU] Player unit error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
