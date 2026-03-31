/**
 * Region Routes — Server-authoritative region state.
 * GET  /api/regions               — Fetch all region states
 * POST /api/regions/:id/transfer  — Government-authorized territory transfer
 * POST /api/regions/:id/infrastructure — Build/toggle region infrastructure
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { regionOwnership, countries, governments, players } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// ═══════════════════════════════════════════════
//  GET /api/regions — Fetch all region ownership state
// ═══════════════════════════════════════════════

router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(regionOwnership)
    res.json({ success: true, regions: rows })
  } catch (err) {
    console.error('[REGION] List error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/regions/:id/transfer — Gov-authorized territory transfer
// ═══════════════════════════════════════════════

const transferSchema = z.object({
  targetCountry: z.string().min(2).max(4),
})

router.post('/:id/transfer', requireAuth as any, validate(transferSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const regionId = req.params.id

    // Look up caller's country
    const [player] = await db.select({ countryCode: players.countryCode }).from(players)
      .where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'Player has no country.' }); return }

    const callerCountry = player.countryCode

    // Verify caller is president or defense minister
    const [gov] = await db.select().from(governments)
      .where(eq(governments.countryCode, callerCountry)).limit(1)
    if (!gov) { res.status(404).json({ error: 'Government not found.' }); return }

    const isPresident = gov.president === playerId
    const isDefMin = gov.defenseMinister === playerId
    if (!isPresident && !isDefMin) {
      res.status(403).json({ error: 'Only the president or defense minister can transfer territory.' }); return
    }

    // Verify region exists and is controlled by caller's country
    const [region] = await db.select().from(regionOwnership)
      .where(eq(regionOwnership.regionId, regionId)).limit(1)
    if (!region) { res.status(404).json({ error: 'Region not found in ownership table.' }); return }
    if (region.countryCode !== callerCountry) {
      res.status(403).json({ error: 'Your country does not control this region.' }); return
    }

    // Verify target country exists
    const { targetCountry } = req.body
    const [target] = await db.select({ code: countries.code }).from(countries)
      .where(eq(countries.code, targetCountry)).limit(1)
    if (!target) { res.status(404).json({ error: 'Target country not found.' }); return }

    // Execute transfer
    await db.update(regionOwnership).set({
      countryCode: targetCountry,
      capturedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(regionOwnership.regionId, regionId))

    // Also update the occupiedRegions JSONB on both countries
    // Remove from ceder's occupiedRegions
    await db.execute(sql`
      UPDATE countries SET occupied_regions = COALESCE(occupied_regions, '{}'::jsonb) - ${regionId}
      WHERE code = ${callerCountry}
    `)
    // Add to target's occupiedRegions (record original owner as the region prefix)
    const originalOwner = regionId.split('-')[0] // e.g. 'US' from 'US-CA'
    if (originalOwner !== targetCountry) {
      await db.execute(sql`
        UPDATE countries SET occupied_regions = jsonb_set(
          COALESCE(occupied_regions, '{}'::jsonb),
          ${sql.raw(`'{${regionId}}'`)},
          ${sql.raw(`'"${originalOwner}"'`)}
        )
        WHERE code = ${targetCountry}
      `)
    }

    // Emit socket event for real-time sync
    const io = (global as any).__xwar_io
    if (io) {
      io.emit('region:transfer', { regionId, from: callerCountry, to: targetCountry })
    }

    console.log(`[REGION] Territory transfer: ${regionId} from ${callerCountry} → ${targetCountry} (by ${playerId})`)
    res.json({ success: true, message: `${regionId} transferred to ${targetCountry}.` })
  } catch (err) {
    console.error('[REGION] Transfer error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/regions/:id/infrastructure — Build/toggle infra
// ═══════════════════════════════════════════════

const INFRA_KEYS = ['bunkerLevel', 'militaryBaseLevel', 'portLevel', 'airportLevel', 'missileLauncherLevel'] as const

const INFRA_COSTS: Record<string, number> = {
  bunkerLevel: 1_500_000,
  militaryBaseLevel: 1_000_000,
  portLevel: 500_000,
  airportLevel: 750_000,
  missileLauncherLevel: 2_000_000,
}

const INFRA_DB_COLUMN: Record<string, string> = {
  bunkerLevel: 'bunker_level',
  militaryBaseLevel: 'military_base_level',
  portLevel: 'port_level',
  airportLevel: 'airport_level',
  missileLauncherLevel: 'missile_launcher_level',
}

const infraSchema = z.object({
  infraKey: z.enum(INFRA_KEYS),
  action: z.enum(['build', 'toggle']).default('build'),
})

router.post('/:id/infrastructure', requireAuth as any, validate(infraSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const regionId = req.params.id
    const { infraKey, action } = req.body

    // Look up caller's country
    const [player] = await db.select({ countryCode: players.countryCode }).from(players)
      .where(eq(players.id, playerId)).limit(1)
    if (!player?.countryCode) { res.status(400).json({ error: 'Player has no country.' }); return }

    const callerCountry = player.countryCode

    // Verify caller is president, defense minister, or eco minister
    const [gov] = await db.select().from(governments)
      .where(eq(governments.countryCode, callerCountry)).limit(1)
    if (!gov) { res.status(404).json({ error: 'Government not found.' }); return }

    const isPresident = gov.president === playerId
    const isDefMin = gov.defenseMinister === playerId
    const isEcoMin = gov.ecoMinister === playerId
    if (!isPresident && !isDefMin && !isEcoMin) {
      res.status(403).json({ error: 'Only government officials can manage infrastructure.' }); return
    }

    // Verify region exists and is controlled by caller's country
    const [region] = await db.select().from(regionOwnership)
      .where(eq(regionOwnership.regionId, regionId)).limit(1)
    if (!region) { res.status(404).json({ error: 'Region not found in ownership table.' }); return }
    if (region.countryCode !== callerCountry) {
      res.status(403).json({ error: 'Your country does not control this region.' }); return
    }

    if (action === 'toggle') {
      // Toggle infra enabled/disabled
      const currentEnabled = (region.infraEnabled as Record<string, boolean>) ?? {}
      const newEnabled = { ...currentEnabled, [infraKey]: !currentEnabled[infraKey] }
      await db.update(regionOwnership).set({
        infraEnabled: newEnabled,
        updatedAt: new Date(),
      }).where(eq(regionOwnership.regionId, regionId))

      res.json({ success: true, message: `${infraKey} ${newEnabled[infraKey] ? 'enabled' : 'disabled'}.`, infraEnabled: newEnabled })
      return
    }

    // Build: upgrade infra level
    const cost = INFRA_COSTS[infraKey]
    const dbCol = INFRA_DB_COLUMN[infraKey]

    // Atomic: deduct from country fund + increment level
    const result = await db.execute(sql`
      WITH fund_check AS (
        SELECT code FROM countries
        WHERE code = ${callerCountry}
          AND COALESCE((fund->>'money')::bigint, 0) >= ${cost}
      )
      UPDATE countries SET
        fund = jsonb_set(
          fund, '{money}',
          to_jsonb(COALESCE((fund->>'money')::bigint, 0) - ${cost})
        )
      WHERE code = (SELECT code FROM fund_check)
      RETURNING code
    `)

    const rows = Array.isArray(result) ? result : (result as any)?.rows ?? []
    if (rows.length === 0) {
      res.status(400).json({ error: `Treasury doesn't have $${cost.toLocaleString()} for ${infraKey}.` }); return
    }

    // Increment region infra level
    await db.execute(sql`
      UPDATE region_ownership SET
        ${sql.raw(dbCol)} = COALESCE(${sql.raw(dbCol)}, 0) + 1,
        updated_at = NOW()
      WHERE region_id = ${regionId}
    `)

    const currentLevel = (region as any)[infraKey] ?? 0
    console.log(`[REGION] Infrastructure: ${regionId} ${infraKey} upgraded to ${currentLevel + 1} (cost: $${cost.toLocaleString()})`)
    res.json({ success: true, message: `${infraKey} upgraded to level ${currentLevel + 1}!`, newLevel: currentLevel + 1 })
  } catch (err) {
    console.error('[REGION] Infrastructure error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
