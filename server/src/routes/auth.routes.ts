import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills, playerSpecialization, items } from '../db/schema.js'
import { signToken } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { generateStarterKit } from '../services/inventory.service.js'

const router = Router()

// ── Schemas ──
const registerSchema = z.object({
  name: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  password: z.string().min(6).max(128),
  countryCode: z.string().length(2).toUpperCase().default('US'),
})

const loginSchema = z.object({
  name: z.string(),
  password: z.string(),
})

// ── POST /api/auth/register ──
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, password, countryCode } = req.body

    // Check if name taken
    const existing = await db.select({ id: players.id }).from(players).where(eq(players.name, name)).limit(1)
    if (existing.length > 0) {
      res.status(409).json({ error: 'Username already taken' })
      return
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create player
    const [player] = await db.insert(players).values({
      name,
      passwordHash,
      countryCode,
      money: 5000000,
      wheat: 100,
      fish: 100,
      steak: 100,
      bread: 50,
      sushi: 50,
      wagyu: 50,
      lootBoxes: 3,
    }).returning({ id: players.id, name: players.name })

    // Create skills row
    await db.insert(playerSkills).values({ playerId: player.id })

    // Create specialization row
    await db.insert(playerSpecialization).values({ playerId: player.id })

    // Generate starter kit (T1-T3 equipment)
    const starterItems = generateStarterKit(player.id)
    if (starterItems.length > 0) {
      await db.insert(items).values(starterItems)
    }

    // Generate token
    const token = signToken({ playerId: player.id, playerName: player.name })

    res.status(201).json({
      token,
      player: { id: player.id, name: player.name },
    })
  } catch (err) {
    console.error('[AUTH] Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/auth/login ──
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { name, password } = req.body

    const [player] = await db.select({
      id: players.id,
      name: players.name,
      passwordHash: players.passwordHash,
    }).from(players).where(eq(players.name, name)).limit(1)

    if (!player) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const valid = await bcrypt.compare(password, player.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Update last login
    await db.update(players).set({ lastLogin: new Date() }).where(eq(players.id, player.id))

    const token = signToken({ playerId: player.id, playerName: player.name })

    res.json({ token, player: { id: player.id, name: player.name } })
  } catch (err) {
    console.error('[AUTH] Login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
