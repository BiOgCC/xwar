import { Router } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills, playerSpecialization, items, governments } from '../db/schema.js'
import { v4 as uuidv4 } from 'uuid'
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

// ── GET /api/player/all ── Lightweight player directory
router.get('/all', async (req, res) => {
  try {
    const allPlayers = await db.select({
      name: players.name,
      country: players.countryCode,
    }).from(players)

    res.json({ success: true, players: allPlayers })
  } catch (err) {
    console.error('[PLAYER] Get all error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/player/country ── Player's country info + gov role
router.get('/country', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    const [player] = await db.select({
      id: players.id,
      countryCode: players.countryCode,
    }).from(players).where(eq(players.id, playerId)).limit(1)

    if (!player || !player.countryCode) {
      res.status(404).json({ error: 'Player not found' })
      return
    }

    const { countryCode } = player

    // Get government for this country
    const [gov] = await db.select().from(governments)
      .where(eq(governments.countryCode, countryCode)).limit(1)

    // Determine this player's gov role
    let govRole: string = 'citizen'
    if (gov) {
      if (gov.president === playerId) govRole = 'president'
      else if (gov.vicePresident === playerId) govRole = 'vice_president'
      else if (gov.defenseMinister === playerId) govRole = 'defense_minister'
      else if (gov.ecoMinister === playerId) govRole = 'eco_minister'
      else {
        const congressRaw = gov.congress as unknown
        const congress: string[] = Array.isArray(congressRaw) ? congressRaw : []
        if (congress.includes(playerId)) govRole = 'congress_member'
      }
    }

    // Population = count of players in this country
    const [countResult] = await db.execute(
      sql`SELECT COUNT(*) as count FROM players WHERE country_code = ${countryCode}`
    )
    const population = Number((countResult as any)?.count ?? 0)

    res.json({
      countryCode,
      govRole,
      population,
      government: gov ? {
        presidentId: gov.president,
        vicePresidentId: gov.vicePresident,
        defenseMinisterId: gov.defenseMinister,
        ecoMinisterId: gov.ecoMinister,
      } : null,
    })
  } catch (err) {
    console.error('[PLAYER] Country info error:', err)
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
      await db.update(players).set({ maxStamina: 120 + (currentLevel + 1) * 24 }).where(eq(players.id, playerId))
    } else if (skill === 'hunger') {
      await db.update(players).set({ maxHunger: 6 + (currentLevel + 1) }).where(eq(players.id, playerId))
    } else if (skill === 'work') {
      await db.update(players).set({ maxWork: 120 + (currentLevel + 1) * 24 }).where(eq(players.id, playerId))
    } else if (skill === 'entrepreneurship') {
      await db.update(players).set({ maxEntrepreneurship: 120 + (currentLevel + 1) * 18 }).where(eq(players.id, playerId))
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

// ── POST /api/player/daily-reward ── Claim escalating daily reward
router.post('/daily-reward', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)

    if (!player) {
      res.status(404).json({ error: 'Player not found' })
      return
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000
    const getDayStartUTC = (timestamp = Date.now()) => {
      const d = new Date(timestamp)
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }

    const nowUTC = getDayStartUTC()
    const lastClaimedAt = player.lastRewardClaimed ? player.lastRewardClaimed.getTime() : 0
    const lastUTC = getDayStartUTC(lastClaimedAt)

    if (lastClaimedAt > 0 && nowUTC <= lastUTC) {
      res.status(400).json({ error: 'Come back tomorrow!' })
      return
    }

    const daysMissed = (nowUTC - lastUTC) / ONE_DAY_MS
    let newStreak = player.loginStreak ?? 0

    if (lastClaimedAt > 0 && daysMissed > 1) {
      newStreak = 0
    }

    newStreak = (newStreak % 7) + 1

    // Build Reward
    const updates: Partial<typeof players.$inferInsert> = {
      loginStreak: newStreak,
      lastRewardClaimed: new Date(),
    }
    
    let grantedMoney = 0
    let message = `Day ${newStreak} reward claimed!`

    if (newStreak === 1) {
      grantedMoney = 50_000
      updates.bread = (player.bread ?? 0) + 5
    } else if (newStreak === 2) {
      grantedMoney = 75_000
      updates.sushi = (player.sushi ?? 0) + 5
    } else if (newStreak === 3) {
      grantedMoney = 100_000
      updates.wagyu = (player.wagyu ?? 0) + 5
      updates.lootBoxes = (player.lootBoxes ?? 0) + 1
    } else if (newStreak === 4) {
      grantedMoney = 150_000
      updates.magicTea = (player.magicTea ?? 0) + 2
    } else if (newStreak === 5) {
      grantedMoney = 200_000
      updates.militaryBoxes = (player.militaryBoxes ?? 0) + 1
    } else if (newStreak === 6) {
      grantedMoney = 300_000
      updates.bitcoin = (player.bitcoin ?? 0) + 3
    } else if (newStreak === 7) {
      grantedMoney = 500_000
      // Grant T5 Item
      const slots = ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots'] as const
      const slot = slots[Math.floor(Math.random() * slots.length)]
      const category = slot === 'weapon' ? 'weapon' : 'armor'
      
      const WEAPON_SUBTYPES = ['assault_rifle', 'sniper', 'shotgun', 'smg', 'lmg', 'pistol', 'melee']
      const subtype = slot === 'weapon' ? WEAPON_SUBTYPES[Math.floor(Math.random() * WEAPON_SUBTYPES.length)] : null

      // Simplified stats for server generation (client can format it)
      const newDmg = slot === 'weapon' ? 200 + Math.floor(Math.random() * 50) : 0
      const newArmor = slot !== 'weapon' ? 40 + Math.floor(Math.random() * 20) : 0

      await db.insert(items).values({
        id: uuidv4(),
        ownerId: playerId,
        name: `🎁 Daily ${tierText(slot)}`,
        slot,
        category,
        tier: 't5',
        weaponSubtype: subtype,
        stats: { damage: newDmg, armor: newArmor },
        equipped: false,
        durability: '100',
        location: 'inventory'
      })
    }

    function tierText(slot: string) {
      return slot.charAt(0).toUpperCase() + slot.slice(1)
    }

    if (grantedMoney > 0) {
      updates.money = (Number(player.money) || 0) + grantedMoney
      // Track economy ledger
      await earnMoney(playerId, grantedMoney)
    }

    await db.update(players).set(updates).where(eq(players.id, playerId))

    res.json({ success: true, message, streak: newStreak, grantedMoney })
  } catch (err) {
    console.error('[PLAYER] Daily reward error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

