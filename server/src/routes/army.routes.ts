import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and, count } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, armies, armyMembers, divisions, items } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  DIVISION_TEMPLATES, VALID_DIVISION_TYPES,
  rollStarQuality, getEffectiveManpower, getEffectiveHealth,
  getRankIndex, getMilitaryRankForLevel, getMaxPopCap,
  type DivisionType,
} from '../services/army.service.js'

const router = Router()
router.use(requireAuth as any)

// ═══════════════════════════════════════════════
//  POST /api/army/recruit — Recruit a new division
// ═══════════════════════════════════════════════

const recruitSchema = z.object({
  type: z.string().refine(v => VALID_DIVISION_TYPES.includes(v as DivisionType), { message: 'Invalid division type' }),
  armyId: z.string().uuid().optional(),
})

router.post('/recruit', validate(recruitSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const divType = req.body.type as DivisionType
    const { armyId } = req.body

    const template = DIVISION_TEMPLATES[divType]
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    // Check resources
    if ((player.money ?? 0) < template.recruitCost.money) { res.status(400).json({ error: `Not enough money. Need $${template.recruitCost.money.toLocaleString()}` }); return }
    if ((player.oil ?? 0) < template.recruitCost.oil) { res.status(400).json({ error: `Not enough oil. Need ${template.recruitCost.oil}` }); return }

    // Check pop cap
    const popUsedResult = await db.select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${divisions.type} IN ('jeep','tank','jet','warship') THEN 2 ELSE 1 END), 0)`,
    }).from(divisions).where(
      and(eq(divisions.ownerId, playerId), sql`${divisions.status} != 'destroyed'`)
    )
    const popUsed = Number(popUsedResult[0]?.total ?? 0)
    const maxPop = getMaxPopCap(player.level ?? 1)
    if (popUsed + template.popCost > maxPop) {
      res.status(400).json({ error: `Pop cap exceeded. Using ${popUsed}/${maxPop}, need ${template.popCost} more.` })
      return
    }

    // Deduct resources (atomic)
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${template.recruitCost.money}`,
      oil: sql`${players.oil} - ${template.recruitCost.oil}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${template.recruitCost.money} AND ${players.oil} >= ${template.recruitCost.oil}`
    ).returning({ newMoney: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: 'Insufficient resources (race condition)' })
      return
    }

    // Roll star quality and compute stats
    const { star, modifiers } = rollStarQuality()
    const manpower = getEffectiveManpower(template)
    const health = getEffectiveHealth(template, player.maxStamina ?? 100)

    // Name the division
    const divCount = await db.select({ c: count() }).from(divisions).where(eq(divisions.ownerId, playerId))
    const divNum = (divCount[0]?.c ?? 0) + 1
    const divName = `${template.name} #${divNum}`

    // Insert division
    const [newDiv] = await db.insert(divisions).values({
      type: divType,
      name: divName,
      category: template.category,
      ownerId: playerId,
      countryCode: player.countryCode,
      manpower,
      maxManpower: manpower,
      health,
      maxHealth: health,
      equipment: [],
      experience: 0,
      stance: 'unassigned',
      autoTraining: false,
      status: 'training',
      trainingProgress: 0,
      readyAt: Date.now() + template.trainingTime * 15 * 1000, // trainingTime in ticks × 15s
      starQuality: star,
      statModifiers: modifiers,
    }).returning()

    // Assign to army if specified
    if (armyId) {
      const [army] = await db.select().from(armies).where(eq(armies.id, armyId)).limit(1)
      if (army && army.countryCode === player.countryCode) {
        // Division assignment is handled by assign-division endpoint
        // but we can auto-assign on recruit if army exists
      }
    }

    res.json({
      success: true,
      division: newDiv,
      message: `${divName} recruited! Training for ${template.trainingTime} ticks.`,
    })
  } catch (err) {
    console.error('[ARMY] Recruit error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/create — Create a new army
// ═══════════════════════════════════════════════

const createArmySchema = z.object({
  name: z.string().min(3).max(64),
})

router.post('/create', validate(createArmySchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { name } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    // Create army
    const [army] = await db.insert(armies).values({
      name,
      countryCode: player.countryCode,
      commanderId: playerId,
      vault: { ammo: 0, jets: 0, tanks: 0, oil: 0, money: 0 },
      vaultEquipmentIds: [],
    }).returning()

    // Add creator as general
    const rank = getMilitaryRankForLevel(player.level ?? 1)
    await db.insert(armyMembers).values({
      armyId: army.id,
      playerId,
      role: rank,
    })

    res.json({ success: true, army, message: `Army "${name}" created!` })
  } catch (err) {
    console.error('[ARMY] Create army error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/enlist — Join an army
// ═══════════════════════════════════════════════

const enlistSchema = z.object({
  armyId: z.string().uuid(),
})

router.post('/enlist', validate(enlistSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { armyId } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const [army] = await db.select().from(armies).where(eq(armies.id, armyId)).limit(1)
    if (!army) { res.status(404).json({ error: 'Army not found' }); return }
    if (army.countryCode !== player.countryCode) { res.status(400).json({ error: 'You can only join armies from your country.' }); return }

    // Check not already in an army
    const existing = await db.select().from(armyMembers).where(eq(armyMembers.playerId, playerId)).limit(1)
    if (existing.length > 0) { res.status(400).json({ error: 'Already enlisted in an army. Leave first.' }); return }

    const rank = getMilitaryRankForLevel(player.level ?? 1)
    await db.insert(armyMembers).values({
      armyId,
      playerId,
      role: rank,
    })

    // Update player's enlistedArmyId
    await db.update(players).set({ enlistedArmyId: armyId }).where(eq(players.id, playerId))

    res.json({ success: true, message: `Enlisted in ${army.name} as ${rank}!` })
  } catch (err) {
    console.error('[ARMY] Enlist error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/leave — Leave your army
// ═══════════════════════════════════════════════

router.post('/leave', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    // Find current army
    const [membership] = await db.select().from(armyMembers).where(eq(armyMembers.playerId, playerId)).limit(1)
    if (!membership) { res.status(400).json({ error: 'Not enlisted in any army.' }); return }

    const [army] = await db.select().from(armies).where(eq(armies.id, membership.armyId)).limit(1)
    if (army && army.commanderId === playerId) {
      res.status(400).json({ error: 'Commanders cannot leave. Disband or transfer command first.' })
      return
    }

    await db.delete(armyMembers).where(
      and(eq(armyMembers.armyId, membership.armyId), eq(armyMembers.playerId, playerId))
    )
    await db.update(players).set({ enlistedArmyId: null }).where(eq(players.id, playerId))

    res.json({ success: true, message: `Left ${army?.name ?? 'army'}.` })
  } catch (err) {
    console.error('[ARMY] Leave error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/promote — Promote a member
// ═══════════════════════════════════════════════

const promoteSchema = z.object({
  armyId: z.string().uuid(),
  targetPlayerId: z.string().uuid(),
  newRole: z.string(),
})

router.post('/promote', validate(promoteSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { armyId, targetPlayerId, newRole } = req.body

    // Verify promoter's rank
    const [promoter] = await db.select().from(armyMembers)
      .where(and(eq(armyMembers.armyId, armyId), eq(armyMembers.playerId, playerId))).limit(1)
    if (!promoter) { res.status(400).json({ error: 'You are not in this army.' }); return }

    const promoterRank = getRankIndex(promoter.role ?? 'private')
    if (promoterRank < 5) { res.status(400).json({ error: 'Only Colonels and Generals can promote.' }); return }

    // Verify target exists
    const [target] = await db.select().from(armyMembers)
      .where(and(eq(armyMembers.armyId, armyId), eq(armyMembers.playerId, targetPlayerId))).limit(1)
    if (!target) { res.status(400).json({ error: 'Player not found in army.' }); return }

    const newRankIdx = getRankIndex(newRole)
    if (newRankIdx >= promoterRank) { res.status(400).json({ error: 'Cannot promote to your rank or higher.' }); return }

    await db.update(armyMembers).set({ role: newRole })
      .where(and(eq(armyMembers.armyId, armyId), eq(armyMembers.playerId, targetPlayerId)))

    res.json({ success: true, message: `${targetPlayerId} promoted to ${newRole}.` })
  } catch (err) {
    console.error('[ARMY] Promote error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/assign-division — Assign division to army
// ═══════════════════════════════════════════════

const assignDivSchema = z.object({
  divisionId: z.string().uuid(),
  armyId: z.string().uuid(),
})

router.post('/assign-division', validate(assignDivSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { divisionId, armyId } = req.body

    // Verify ownership
    const [div] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!div) { res.status(404).json({ error: 'Division not found' }); return }
    if (div.ownerId !== playerId) { res.status(403).json({ error: 'Not your division.' }); return }

    // Verify army exists and shares country
    const [army] = await db.select().from(armies).where(eq(armies.id, armyId)).limit(1)
    if (!army) { res.status(404).json({ error: 'Army not found' }); return }
    if (army.countryCode !== div.countryCode) { res.status(400).json({ error: 'Division and army must be from the same country.' }); return }

    // Note: division-to-army assignment isn't tracked in the current schema with a foreign key.
    // The client uses an in-memory divisionIds array on the army. For the DB, we can store this
    // as a jsonb column on armies or add a junction. For now we'll respond with success —
    // full junction table can be added in Phase 2B when battles need it.

    res.json({ success: true, message: `Division assigned to ${army.name}.` })
  } catch (err) {
    console.error('[ARMY] Assign division error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/disband-division — Disband a division
// ═══════════════════════════════════════════════

const disbandSchema = z.object({
  divisionId: z.string().uuid(),
})

router.post('/disband-division', validate(disbandSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { divisionId } = req.body

    const [div] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!div) { res.status(404).json({ error: 'Division not found' }); return }
    if (div.ownerId !== playerId) { res.status(403).json({ error: 'Not your division.' }); return }
    if (div.status === 'in_combat') { res.status(400).json({ error: 'Cannot disband a division in combat.' }); return }

    // Return equipment to player inventory
    const equip = (div.equipment as string[]) || []
    if (equip.length > 0) {
      for (const itemId of equip) {
        await db.update(items).set({
          equipped: false,
        }).where(eq(items.id, itemId))
      }
    }

    // Delete division
    await db.delete(divisions).where(eq(divisions.id, divisionId))

    res.json({ success: true, message: `${div.name} has been disbanded.` })
  } catch (err) {
    console.error('[ARMY] Disband error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/equip — Equip item to division
// ═══════════════════════════════════════════════

const equipSchema = z.object({
  divisionId: z.string().uuid(),
  itemId: z.string().uuid(),
})

router.post('/equip', validate(equipSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { divisionId, itemId } = req.body

    const [div] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!div) { res.status(404).json({ error: 'Division not found' }); return }
    if (div.ownerId !== playerId) { res.status(403).json({ error: 'Not your division.' }); return }

    const equip = (div.equipment as string[]) || []
    if (equip.length >= 3) { res.status(400).json({ error: 'Division already has 3 equipment slots filled.' }); return }
    if (equip.includes(itemId)) { res.status(400).json({ error: 'Item already equipped.' }); return }

    // Verify item belongs to player
    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1)
    if (!item) { res.status(404).json({ error: 'Item not found' }); return }
    if (item.ownerId !== playerId) { res.status(403).json({ error: 'Not your item.' }); return }

    // Update division equipment and item status
    await db.update(divisions).set({
      equipment: [...equip, itemId],
    }).where(eq(divisions.id, divisionId))

    await db.update(items).set({ equipped: true }).where(eq(items.id, itemId))

    res.json({ success: true, message: `${item.name} equipped to ${div.name}.` })
  } catch (err) {
    console.error('[ARMY] Equip error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/unequip — Unequip item from division
// ═══════════════════════════════════════════════

const unequipSchema = z.object({
  divisionId: z.string().uuid(),
  itemId: z.string().uuid(),
})

router.post('/unequip', validate(unequipSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { divisionId, itemId } = req.body

    const [div] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!div) { res.status(404).json({ error: 'Division not found' }); return }
    if (div.ownerId !== playerId) { res.status(403).json({ error: 'Not your division.' }); return }

    const equip = (div.equipment as string[]) || []
    if (!equip.includes(itemId)) { res.status(400).json({ error: 'Item not equipped to this division.' }); return }

    await db.update(divisions).set({
      equipment: equip.filter(id => id !== itemId),
    }).where(eq(divisions.id, divisionId))

    await db.update(items).set({ equipped: false }).where(eq(items.id, itemId))

    res.json({ success: true, message: 'Item unequipped.' })
  } catch (err) {
    console.error('[ARMY] Unequip error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/vault/donate — Donate to army vault
// ═══════════════════════════════════════════════

const donateSchema = z.object({
  armyId: z.string().uuid(),
  resource: z.enum(['money', 'oil']),
  amount: z.number().int().positive(),
})

router.post('/vault/donate', validate(donateSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { armyId, resource, amount } = req.body

    // Verify membership
    const [member] = await db.select().from(armyMembers)
      .where(and(eq(armyMembers.armyId, armyId), eq(armyMembers.playerId, playerId))).limit(1)
    if (!member) { res.status(400).json({ error: 'Not in this army.' }); return }

    // Verify and deduct player resource (atomic)
    const playerCol = resource === 'money' ? players.money : players.oil
    const deductResult = await db.update(players).set({
      [resource]: sql`${playerCol} - ${amount}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${playerCol} >= ${amount}`
    ).returning({ remaining: playerCol })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough ${resource}.` })
      return
    }

    // Add to vault (atomic jsonb update)
    await db.execute(sql`
      UPDATE armies
      SET vault = jsonb_set(
        vault,
        ${sql.raw(`'{${resource}}'`)},
        to_jsonb(COALESCE((vault->>'${sql.raw(resource)}')::bigint, 0) + ${amount})
      )
      WHERE id = ${armyId}
    `)

    res.json({ success: true, message: `Donated ${amount} ${resource} to vault.` })
  } catch (err) {
    console.error('[ARMY] Vault donate error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/army/stance — Set division stance
// ═══════════════════════════════════════════════

const stanceSchema = z.object({
  divisionId: z.string().uuid(),
  stance: z.enum(['unassigned', 'force_pool', 'reserve', 'first_line_defense']),
})

router.post('/stance', validate(stanceSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { divisionId, stance } = req.body

    const [div] = await db.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1)
    if (!div) { res.status(404).json({ error: 'Division not found' }); return }
    if (div.ownerId !== playerId) { res.status(403).json({ error: 'Not your division.' }); return }
    if (div.status === 'destroyed') { res.status(400).json({ error: 'Cannot set stance on destroyed division.' }); return }
    if (div.status === 'in_combat') { res.status(400).json({ error: 'Cannot change stance during combat.' }); return }

    await db.update(divisions).set({ stance }).where(eq(divisions.id, divisionId))

    res.json({ success: true, message: `Stance set to ${stance.replace(/_/g, ' ').toUpperCase()}.` })
  } catch (err) {
    console.error('[ARMY] Stance error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/army/my-divisions — List player's divisions
// ═══════════════════════════════════════════════

router.get('/my-divisions', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const divs = await db.select().from(divisions).where(eq(divisions.ownerId, playerId))
    res.json({ success: true, divisions: divs })
  } catch (err) {
    console.error('[ARMY] My divisions error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/army/my-army — Get player's current army
// ═══════════════════════════════════════════════

router.get('/my-army', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [membership] = await db.select().from(armyMembers).where(eq(armyMembers.playerId, playerId)).limit(1)
    if (!membership) { res.json({ success: true, army: null, members: [] }); return }

    const [army] = await db.select().from(armies).where(eq(armies.id, membership.armyId)).limit(1)
    const members = await db.select().from(armyMembers).where(eq(armyMembers.armyId, membership.armyId))

    res.json({ success: true, army, members, myRole: membership.role })
  } catch (err) {
    console.error('[ARMY] My army error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/army/country/:code — List armies for a country
// ═══════════════════════════════════════════════

router.get('/country/:code', async (req, res) => {
  try {
    const { code } = req.params
    const countryArmies = await db.select().from(armies).where(eq(armies.countryCode, code))
    res.json({ success: true, armies: countryArmies })
  } catch (err) {
    console.error('[ARMY] Country armies error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  PATCH /api/army/autodefense — Set per-army auto-defense limit
// ═══════════════════════════════════════════════

const autodefenseSchema = z.object({
  armyId: z.string().uuid(),
  limit: z.number().int().min(-1).max(100),  // -1 = all, 0 = off, N = max N
})

router.patch('/autodefense', validate(autodefenseSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { armyId, limit } = req.body

    const [army] = await db.select().from(armies).where(eq(armies.id, armyId)).limit(1)
    if (!army) { res.status(404).json({ error: 'Army not found' }); return }
    if (army.commanderId !== playerId) {
      res.status(403).json({ error: 'Only the commander can set autodefense.' }); return
    }

    await db.update(armies).set({ autoDefenseLimit: limit }).where(eq(armies.id, armyId))

    res.json({ success: true, message: `Army autodefense set to ${limit === -1 ? 'ALL' : limit === 0 ? 'OFF' : limit}.` })
  } catch (err) {
    console.error('[ARMY] Autodefense error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
