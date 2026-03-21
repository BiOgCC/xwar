/**
 * Skills Routes — Upgrade player skills + specialization XP.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, playerSkills, playerSpecialization } from '../db/schema.js'
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

// ═══════════════════════════════════════════════
//  GET /api/skills/specialization — Get all specialization XP + tiers
// ═══════════════════════════════════════════════

router.get('/specialization', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    let [spec] = await db.select().from(playerSpecialization).where(eq(playerSpecialization.playerId, playerId)).limit(1)
    if (!spec) {
      const [newSpec] = await db.insert(playerSpecialization).values({ playerId }).returning()
      spec = newSpec
    }
    res.json({ success: true, specialization: spec })
  } catch (err) {
    console.error('[SKILLS] Specialization get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/skills/specialization/grant — Grant XP (server-side only)
// ═══════════════════════════════════════════════

const SPEC_TYPES = ['military', 'economic', 'politician', 'mercenary', 'influencer'] as const
const TIER_THRESHOLDS = [0, 500, 2000, 6000, 15000, 35000, 70000, 120000, 200000, 350000, 500000]

const grantSchema = z.object({
  specType: z.enum(SPEC_TYPES),
  xp: z.number().int().positive().max(50000),
})

router.post('/specialization/grant', requireAuth as any, validate(grantSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { specType, xp } = req.body

    const xpCol = `${specType}_xp` as const
    const tierCol = `${specType}_tier` as const

    // Ensure row exists
    let [spec] = await db.select().from(playerSpecialization).where(eq(playerSpecialization.playerId, playerId)).limit(1)
    if (!spec) {
      const [newSpec] = await db.insert(playerSpecialization).values({ playerId }).returning()
      spec = newSpec
    }

    const currentXp = (spec as any)[`${specType}Xp`] ?? 0
    const newXp = currentXp + xp

    // Calculate new tier
    let newTier = 0
    for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
      if (newXp >= TIER_THRESHOLDS[i]) {
        newTier = i
        break
      }
    }

    await db.execute(sql`
      UPDATE player_specialization SET
        ${sql.raw(xpCol)} = ${newXp},
        ${sql.raw(tierCol)} = ${newTier}
      WHERE player_id = ${playerId}
    `)

    res.json({
      success: true,
      specType,
      xp: newXp,
      tier: newTier,
      message: `+${xp} ${specType} XP (Tier ${newTier})`,
    })
  } catch (err) {
    console.error('[SKILLS] Specialization grant error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

