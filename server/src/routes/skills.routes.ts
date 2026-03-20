/**
 * Skills Routes — Upgrade player skills.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const MILITARY_SKILLS = ['attack', 'critRate', 'critDamage', 'armor', 'dodge', 'precision'] as const
const ECONOMIC_SKILLS = ['production', 'prospection', 'industrialist', 'trade', 'investor', 'espionage'] as const
const ALL_SKILLS = [...MILITARY_SKILLS, ...ECONOMIC_SKILLS]

// Skill column name mapping (camelCase → snake_case)
const SKILL_COL_MAP: Record<string, string> = {
  attack: 'attack',
  critRate: 'crit_rate',
  critDamage: 'crit_damage',
  armor: 'armor',
  dodge: 'dodge',
  precision: 'precision_',
  production: 'production',
  prospection: 'prospection',
  industrialist: 'industrialist',
  trade: 'trade',
  investor: 'investor',
  espionage: 'espionage',
}

const MAX_SKILL_LEVEL = 10
const SP_PER_UPGRADE = 1

// ═══════════════════════════════════════════════
//  POST /api/skills/upgrade
// ═══════════════════════════════════════════════

const upgradeSchema = z.object({
  skill: z.string().refine(s => ALL_SKILLS.includes(s as any), { message: 'Invalid skill name' }),
})

router.post('/upgrade', requireAuth as any, validate(upgradeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { skill } = req.body

    // Check player has skill points
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }
    if ((player.skillPoints ?? 0) < SP_PER_UPGRADE) {
      res.status(400).json({ error: 'Not enough skill points' }); return
    }

    // Check current level
    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    if (!skills) {
      // Create skill row if missing
      await db.insert(playerSkills).values({ playerId })
    }

    const colName = SKILL_COL_MAP[skill]
    if (!colName) { res.status(400).json({ error: 'Unknown skill' }); return }

    // Check max level
    const currentLevel = skills ? (skills as any)[colName.replace('_', '')] ?? 0 : 0
    if (currentLevel >= MAX_SKILL_LEVEL) {
      res.status(400).json({ error: `${skill} is already at max level (${MAX_SKILL_LEVEL})` }); return
    }

    // Atomic: deduct SP and increment skill
    await db.update(players).set({
      skillPoints: sql`${players.skillPoints} - ${SP_PER_UPGRADE}`,
    }).where(sql`${players.id} = ${playerId} AND ${players.skillPoints} >= ${SP_PER_UPGRADE}`)

    await db.execute(sql`
      UPDATE player_skills
      SET ${sql.raw(colName)} = LEAST(${MAX_SKILL_LEVEL}, COALESCE(${sql.raw(colName)}, 0) + 1)
      WHERE player_id = ${playerId}
    `)

    res.json({ success: true, message: `${skill} upgraded to level ${currentLevel + 1}!` })
  } catch (err) {
    console.error('[SKILLS] Upgrade error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/skills/my-skills
// ═══════════════════════════════════════════════

router.get('/my-skills', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const [player] = await db.select({ sp: players.skillPoints }).from(players).where(eq(players.id, playerId)).limit(1)

    res.json({
      success: true,
      skills: skills || {},
      availablePoints: player?.sp ?? 0,
    })
  } catch (err) {
    console.error('[SKILLS] My skills error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
