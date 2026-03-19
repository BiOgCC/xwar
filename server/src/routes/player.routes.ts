import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills, playerSpecialization } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

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

export default router
