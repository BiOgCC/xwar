import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills, playerSpecialization, items } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { calculateAttackDamage, grantXP, spendMoney, earnMoney, consumeBar } from '../services/player.service.js'

const router = Router()

// All player routes require auth
router.use(requireAuth as any)

// ── GET /api/player ── Full player state
router.get('/', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) {
      res.status(404).json({ error: 'Player not found' })
      return
    }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const [spec] = await db.select().from(playerSpecialization).where(eq(playerSpecialization.playerId, playerId)).limit(1)

    // Strip password hash
    const { passwordHash, ...playerData } = player

    res.json({
      ...playerData,
      skills: skills || {},
      specialization: spec || {},
    })
  } catch (err) {
    console.error('[PLAYER] Get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PATCH /api/player/ammo ── Equip ammo type
router.patch('/ammo', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { type } = req.body

    if (!['none', 'green', 'blue', 'purple', 'red'].includes(type)) {
      res.status(400).json({ error: 'Invalid ammo type' })
      return
    }

    await db.update(players).set({ equippedAmmo: type }).where(eq(players.id, playerId))
    res.json({ success: true, equippedAmmo: type })
  } catch (err) {
    console.error('[PLAYER] Ammo error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/player/eat ── Consume food
router.post('/eat', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { type } = req.body

    if (!['bread', 'sushi', 'wagyu'].includes(type)) {
      res.status(400).json({ error: 'Invalid food type' })
      return
    }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const foodCount = player[type as keyof typeof player] as number
    if (foodCount <= 0) { res.status(400).json({ error: `No ${type} remaining` }); return }
    if (player.hunger! <= 0) { res.status(400).json({ error: 'Not hungry' }); return }

    const staminaGain = type === 'wagyu' ? 30 : type === 'sushi' ? 20 : 10
    const currentStamina = parseFloat(player.stamina as string)
    const maxStamina = player.maxStamina!

    await db.update(players).set({
      [type]: foodCount - 1,
      hunger: Math.max(0, player.hunger! - 1),
      stamina: String(Math.min(maxStamina, currentStamina + staminaGain)),
    }).where(eq(players.id, playerId))

    res.json({ success: true, staminaGain })
  } catch (err) {
    console.error('[PLAYER] Eat error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/player/work ── Work action
router.post('/work', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    if (player.work! < 10) {
      res.status(400).json({ error: 'Not enough work energy' })
      return
    }

    const fill = 20
    await db.update(players).set({
      work: Math.max(0, player.work! - 10),
      productionBar: Math.min(player.productionBarMax!, player.productionBar! + fill),
    }).where(eq(players.id, playerId))

    res.json({ success: true, productionBar: Math.min(player.productionBarMax!, player.productionBar! + fill) })
  } catch (err) {
    console.error('[PLAYER] Work error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/player/avatar ── Set avatar
router.patch('/avatar', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { avatar } = req.body

    if (!avatar || typeof avatar !== 'string') {
      res.status(400).json({ error: 'Invalid avatar path' })
      return
    }

    await db.update(players).set({ avatar }).where(eq(players.id, playerId))
    res.json({ success: true, avatar })
  } catch (err) {
    console.error('[PLAYER] Avatar error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════
//  PHASE 2 — New player action routes
// ═══════════════════════════════════════════

// ── POST /api/player/attack ── Server-side damage calculation
router.post('/attack', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    const result = await calculateAttackDamage(playerId)
    const levelInfo = await grantXP(playerId, result.xpGain)

    // 7% accumulative loot chance
    const [p] = await db.select({ lootChancePool: players.lootChancePool, lootBoxes: players.lootBoxes })
      .from(players).where(eq(players.id, playerId)).limit(1)

    let newPool = (p?.lootChancePool || 0) + 7
    let boxesGranted = Math.floor(newPool / 100)
    newPool -= boxesGranted * 100
    if (Math.random() * 100 < newPool) { boxesGranted++; newPool = 0 }

    if (boxesGranted > 0 || newPool !== p?.lootChancePool) {
      await db.update(players).set({
        lootChancePool: newPool,
        lootBoxes: (p?.lootBoxes || 0) + boxesGranted,
      }).where(eq(players.id, playerId))
    }

    res.json({
      ...result,
      ...levelInfo,
      lootBoxesGranted: boxesGranted,
    })
  } catch (err: any) {
    if (err.message === 'Not enough stamina') {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[PLAYER] Attack error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/player/skills ── Allocate skill points
router.post('/skills', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { tree, skill } = req.body

    if (!['military', 'economic'].includes(tree)) {
      res.status(400).json({ error: 'Invalid skill tree' })
      return
    }

    const militarySkills = ['attack', 'critRate', 'critDamage', 'precision', 'stamina', 'hunger', 'armor', 'dodge']
    const economicSkills = ['work', 'entrepreneurship', 'production', 'prospection', 'industrialist']
    const validSkills = tree === 'military' ? militarySkills : economicSkills

    if (!validSkills.includes(skill)) {
      res.status(400).json({ error: 'Invalid skill name' })
      return
    }

    // Get current skills
    let [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    
    if (!skills) {
      // Create default skills row
      await db.insert(playerSkills).values({ playerId })
      ;[skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    }

    const currentLevel = (skills as any)[skill] ?? 0
    if (currentLevel >= 10) { res.status(400).json({ error: 'Skill already at max level' }); return }

    const cost = currentLevel + 1
    const [player] = await db.select({ skillPoints: players.skillPoints }).from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.skillPoints! < cost) {
      res.status(400).json({ error: `Need ${cost} skill points (have ${player?.skillPoints || 0})` })
      return
    }

    // Deduct SP and increment skill
    await db.update(players).set({
      skillPoints: player.skillPoints! - cost,
    }).where(eq(players.id, playerId))

    await db.update(playerSkills).set({
      [skill]: currentLevel + 1,
    }).where(eq(playerSkills.playerId, playerId))

    // Update bar maximums for relevant skills
    if (skill === 'stamina') {
      await db.update(players).set({ maxStamina: 100 + (currentLevel + 1) * 20 }).where(eq(players.id, playerId))
    } else if (skill === 'hunger') {
      await db.update(players).set({ maxHunger: 5 + (currentLevel + 1) }).where(eq(players.id, playerId))
    } else if (skill === 'work') {
      await db.update(players).set({ maxWork: 100 + (currentLevel + 1) * 20 }).where(eq(players.id, playerId))
    } else if (skill === 'entrepreneurship') {
      await db.update(players).set({ maxEntrepreneurship: 100 + (currentLevel + 1) * 15 }).where(eq(players.id, playerId))
    }

    res.json({ success: true, skill, newLevel: currentLevel + 1, skillPointsLeft: player.skillPoints! - cost })
  } catch (err) {
    console.error('[PLAYER] Skills error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/player/consume-bar ── Generic bar consumption
router.post('/consume-bar', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bar, amount } = req.body

    if (!['stamina', 'hunger', 'entrepreneurship', 'work'].includes(bar)) {
      res.status(400).json({ error: 'Invalid bar type' })
      return
    }
    if (!amount || amount <= 0 || amount > 1000) {
      res.status(400).json({ error: 'Invalid amount' })
      return
    }

    const success = await consumeBar(playerId, bar, amount)
    if (!success) {
      res.status(400).json({ error: `Not enough ${bar}` })
      return
    }

    res.json({ success: true })
  } catch (err) {
    console.error('[PLAYER] ConsumeBar error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── PATCH /api/player/country ── Switch country (with 24h cooldown)
router.patch('/country', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode } = req.body

    if (!countryCode || typeof countryCode !== 'string' || countryCode.length > 4) {
      res.status(400).json({ error: 'Invalid country code' })
      return
    }

    // Verify country exists
    const [country] = await db.execute(sql`SELECT code FROM countries WHERE code = ${countryCode}`)
    if (!country) { res.status(404).json({ error: 'Country not found' }); return }

    // Update country + track switch
    await db.execute(sql`
      UPDATE players SET 
        country_code = ${countryCode},
        country_switches = country_switches + 1
      WHERE id = ${playerId}
    `)

    res.json({ success: true, countryCode })
  } catch (err) {
    console.error('[PLAYER] Country switch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

