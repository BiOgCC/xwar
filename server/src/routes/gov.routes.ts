/**
 * Government Routes — Tax, infrastructure, elections.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, countries, governments, companies } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// ═══════════════════════════════════════════════
//  GET /api/gov/country/:code — Get government state
// ═══════════════════════════════════════════════

router.get('/country/:code', async (req, res) => {
  try {
    const { code } = req.params
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, code)).limit(1)
    const [country] = await db.select().from(countries).where(eq(countries.code, code)).limit(1)
    res.json({ success: true, government: gov, country })
  } catch (err) {
    console.error('[GOV] Country error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/set-tax — Set country tax rate (president only)
// ═══════════════════════════════════════════════

const taxSchema = z.object({
  countryCode: z.string().min(2).max(4),
  taxRate: z.number().int().min(0).max(75),
})

router.post('/set-tax', requireAuth as any, validate(taxSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, taxRate } = req.body

    // Verify caller is president
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can set tax rates.' }); return
    }

    await db.update(governments).set({ taxRate }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Tax rate set to ${taxRate}%` })
  } catch (err) {
    console.error('[GOV] Set tax error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/build-infra — Build infrastructure
// ═══════════════════════════════════════════════

const infraSchema = z.object({
  countryCode: z.string().min(2).max(4),
  building: z.enum(['port', 'airport', 'military_base', 'bunker']),
})

const INFRA_COSTS: Record<string, number> = {
  port: 500_000,
  airport: 750_000,
  military_base: 1_000_000,
  bunker: 1_500_000,
}

const INFRA_COLUMN_MAP: Record<string, string> = {
  port: 'port_level',
  airport: 'airport_level',
  military_base: 'military_base_level',
  bunker: 'bunker_level',
}

router.post('/build-infra', requireAuth as any, validate(infraSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, building } = req.body

    // Verify president
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can build infrastructure.' }); return
    }

    const cost = INFRA_COSTS[building]
    const column = INFRA_COLUMN_MAP[building]

    // Deduct from country treasury (atomic)
    const result = await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          fund, '{money}',
          to_jsonb(COALESCE((fund->>'money')::bigint, 0) - ${cost})
        ),
        ${sql.raw(column)} = ${sql.raw(column)} + 1
      WHERE code = ${countryCode}
        AND COALESCE((fund->>'money')::bigint, 0) >= ${cost}
      RETURNING ${sql.raw(column)} AS new_level
    `)

    if ((result as any).length === 0) {
      res.status(400).json({ error: `Treasury doesn't have $${cost.toLocaleString()} for ${building}` }); return
    }

    res.json({ success: true, message: `${building} upgraded!` })
  } catch (err) {
    console.error('[GOV] Build infra error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/nationalize — Nationalize a company
// ═══════════════════════════════════════════════

const nationalizeSchema = z.object({
  countryCode: z.string().min(2).max(4),
  companyId: z.string().uuid(),
})

router.post('/nationalize', requireAuth as any, validate(nationalizeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, companyId } = req.body

    // President check
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can nationalize.' }); return
    }

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1)
    if (!company) { res.status(404).json({ error: 'Company not found' }); return }
    if (company.location !== countryCode) { res.status(400).json({ error: 'Company is not in your country.' }); return }

    // Compensation = 50% of creation cost
    const compensation = 50_000
    if (company.ownerId) {
      await db.update(players).set({
        money: sql`${players.money} + ${compensation}`,
      }).where(eq(players.id, company.ownerId))
    }

    // Transfer ownership to null (state-owned)
    await db.update(companies).set({ ownerId: null as any }).where(eq(companies.id, companyId))

    res.json({ success: true, message: 'Company nationalized.' })
  } catch (err) {
    console.error('[GOV] Nationalize error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/vote — Cast election vote
// ═══════════════════════════════════════════════

const voteSchema = z.object({
  countryCode: z.string().min(2).max(4),
  candidateName: z.string().min(1).max(32),
})

router.post('/vote', requireAuth as any, validate(voteSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, candidateName } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.countryCode !== countryCode) {
      res.status(400).json({ error: 'You can only vote in your own country.' }); return
    }

    // Store vote in elections jsonb
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    if (!gov) { res.status(404).json({ error: 'No government found' }); return }

    const elections = (gov.elections as any) || {}
    const votes = elections.votes || {}
    votes[player.name!] = candidateName
    elections.votes = votes

    await db.update(governments).set({ elections }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Voted for ${candidateName}.` })
  } catch (err) {
    console.error('[GOV] Vote error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/register-candidate — Register for election
// ═══════════════════════════════════════════════

router.post('/register-candidate', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.countryCode !== countryCode) {
      res.status(400).json({ error: 'You can only run for office in your own country.' }); return
    }

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    if (!gov) { res.status(404).json({ error: 'No government found' }); return }

    const elections = (gov.elections as any) || {}
    const candidates = elections.candidates || []

    if (candidates.includes(player.name)) {
      res.status(400).json({ error: 'Already registered as candidate.' }); return
    }

    candidates.push(player.name)
    elections.candidates = candidates

    await db.update(governments).set({ elections }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `${player.name} registered as candidate!` })
  } catch (err) {
    console.error('[GOV] Register candidate error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/propose-law — Congress proposes a law
// ═══════════════════════════════════════════════

const proposeSchema = z.object({
  countryCode: z.string().min(2).max(4),
  lawType: z.enum(['tax_rate', 'minimum_wage', 'import_tax']),
  value: z.number(),
})

router.post('/propose-law', requireAuth as any, validate(proposeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, lawType, value } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player) { res.status(404).json({ error: 'Not found' }); return }

    // Must be president or congress member
    const congress = (gov.congress as string[]) || []
    const isPresident = gov.president === player.name
    const isCongress = congress.includes(player.name!)
    if (!isPresident && !isCongress) {
      res.status(403).json({ error: 'Only president or congress members can propose laws.' }); return
    }

    const laws = (gov.laws as any) || {}
    const proposals = laws.proposals || []

    const proposal = {
      id: `law_${Date.now()}`,
      lawType,
      value,
      proposedBy: player.name,
      proposedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
      votesFor: [player.name],
      votesAgainst: [] as string[],
      status: 'pending',
    }

    proposals.push(proposal)
    laws.proposals = proposals

    await db.update(governments).set({ laws }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Law proposed: ${lawType} = ${value}`, proposal })
  } catch (err) {
    console.error('[GOV] Propose law error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/vote-law — Vote on a law proposal
// ═══════════════════════════════════════════════

const voteLawSchema = z.object({
  countryCode: z.string().min(2).max(4),
  proposalId: z.string(),
  vote: z.enum(['for', 'against']),
})

router.post('/vote-law', requireAuth as any, validate(voteLawSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, proposalId, vote } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player) { res.status(404).json({ error: 'Not found' }); return }

    const congress = (gov.congress as string[]) || []
    const isPresident = gov.president === player.name
    const isCongress = congress.includes(player.name!)
    if (!isPresident && !isCongress) {
      res.status(403).json({ error: 'Only president or congress members can vote on laws.' }); return
    }

    const laws = (gov.laws as any) || {}
    const proposals = laws.proposals || []
    const proposal = proposals.find((p: any) => p.id === proposalId)
    if (!proposal || proposal.status !== 'pending') {
      res.status(404).json({ error: 'Proposal not found or already resolved.' }); return
    }

    // Check already voted
    if (proposal.votesFor.includes(player.name) || proposal.votesAgainst.includes(player.name)) {
      res.status(400).json({ error: 'Already voted on this proposal.' }); return
    }

    if (vote === 'for') proposal.votesFor.push(player.name)
    else proposal.votesAgainst.push(player.name)

    // Check if passed (majority = more for than against, minimum 2 votes for)
    const totalVoters = congress.length + (gov.president ? 1 : 0)
    const majority = Math.floor(totalVoters / 2) + 1
    if (proposal.votesFor.length >= majority) {
      proposal.status = 'passed'
      // Apply the law
      if (proposal.lawType === 'tax_rate') {
        await db.update(governments).set({ taxRate: Math.max(0, Math.min(75, proposal.value)) })
          .where(eq(governments.countryCode, countryCode))
      }
    } else if (proposal.votesAgainst.length >= majority) {
      proposal.status = 'rejected'
    }

    laws.proposals = proposals
    await db.update(governments).set({ laws }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Vote cast: ${vote}. Status: ${proposal.status}` })
  } catch (err) {
    console.error('[GOV] Vote law error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/donate — Donate resources to national fund
// ═══════════════════════════════════════════════

const donateSchema = z.object({
  countryCode: z.string().min(2).max(4),
  resource: z.enum(['money', 'oil', 'scrap', 'materialX', 'bitcoin']),
  amount: z.number().int().positive(),
})

router.post('/donate', requireAuth as any, validate(donateSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, resource, amount } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player || player.countryCode !== countryCode) {
      res.status(400).json({ error: 'Can only donate to your own country.' }); return
    }

    // Map resource to player column
    const colMap: Record<string, any> = {
      money: players.money,
      oil: players.oil,
      scrap: players.scrap,
      materialX: players.materialX,
      bitcoin: players.bitcoin,
    }
    const playerCol = colMap[resource]

    // Deduct from player (atomic)
    const deductResult = await db.update(players).set({
      [resource]: sql`${playerCol} - ${amount}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${playerCol} >= ${amount}`
    ).returning({ remaining: playerCol })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough ${resource}.` }); return
    }

    // Fund key mapping (schema uses 'scraps' for scrap in some places)
    const fundKey = resource === 'scrap' ? 'scraps' : resource

    // Add to country fund (atomic jsonb)
    await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          COALESCE(fund, '{}'::jsonb),
          ${sql.raw(`'{${fundKey}}'`)},
          to_jsonb(COALESCE((fund->>'${sql.raw(fundKey)}')::bigint, 0) + ${amount})
        )
      WHERE code = ${countryCode}
    `)

    res.json({ success: true, message: `Donated ${amount} ${resource} to ${countryCode} treasury.` })
  } catch (err) {
    console.error('[GOV] Donate error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/set-enemy — Declare sworn enemy
// ═══════════════════════════════════════════════

const enemySchema = z.object({
  countryCode: z.string().min(2).max(4),
  enemyCode: z.string().min(2).max(4),
})

router.post('/set-enemy', requireAuth as any, validate(enemySchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, enemyCode } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can declare sworn enemies.' }); return
    }

    if (countryCode === enemyCode) {
      res.status(400).json({ error: 'Cannot declare yourself as enemy.' }); return
    }

    await db.update(governments).set({ swornEnemy: enemyCode }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `${enemyCode} declared as sworn enemy!` })
  } catch (err) {
    console.error('[GOV] Set enemy error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/nuke — Launch nuclear strike
// ═══════════════════════════════════════════════

const nukeSchema = z.object({
  countryCode: z.string().min(2).max(4),
  targetCode: z.string().min(2).max(4),
})

const NUKE_COST = { oil: 10000, scrap: 10000, materialX: 10000, bitcoin: 100, jets: 1 }

router.post('/nuke', requireAuth as any, validate(nukeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, targetCode } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can authorize nuclear strikes.' }); return
    }

    if (!gov.nuclearAuthorized) {
      res.status(403).json({ error: 'Nuclear authorization required from congress first.' }); return
    }

    // Deduct resources from country fund (atomic)
    const result = await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(fund,
                  '{oil}', to_jsonb(COALESCE((fund->>'oil')::bigint, 0) - ${NUKE_COST.oil})),
                '{scraps}', to_jsonb(COALESCE((fund->>'scraps')::bigint, 0) - ${NUKE_COST.scrap})),
              '{materialX}', to_jsonb(COALESCE((fund->>'materialX')::bigint, 0) - ${NUKE_COST.materialX})),
            '{bitcoin}', to_jsonb(COALESCE((fund->>'bitcoin')::bigint, 0) - ${NUKE_COST.bitcoin})),
          '{jets}', to_jsonb(COALESCE((fund->>'jets')::bigint, 0) - ${NUKE_COST.jets}))
      WHERE code = ${countryCode}
        AND COALESCE((fund->>'oil')::bigint, 0) >= ${NUKE_COST.oil}
        AND COALESCE((fund->>'scraps')::bigint, 0) >= ${NUKE_COST.scrap}
        AND COALESCE((fund->>'materialX')::bigint, 0) >= ${NUKE_COST.materialX}
        AND COALESCE((fund->>'bitcoin')::bigint, 0) >= ${NUKE_COST.bitcoin}
        AND COALESCE((fund->>'jets')::bigint, 0) >= ${NUKE_COST.jets}
      RETURNING code
    `)

    if ((result as any).length === 0) {
      res.status(400).json({ error: 'Treasury lacks resources for nuclear strike (10K oil/scrap/matX + 100 BTC + 1 jet).' }); return
    }

    // Apply nuke effect: devastate target infrastructure
    await db.execute(sql`
      UPDATE countries SET
        port_level = GREATEST(1, port_level - 3),
        airport_level = GREATEST(1, airport_level - 3),
        bunker_level = GREATEST(1, bunker_level - 3),
        military_base_level = GREATEST(1, military_base_level - 3)
      WHERE code = ${targetCode}
    `)

    // Reset nuclear authorization
    await db.update(governments).set({ nuclearAuthorized: false }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `☢️ NUCLEAR STRIKE launched against ${targetCode}! Infrastructure devastated.` })
  } catch (err) {
    console.error('[GOV] Nuke error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/authorize-nuke — Congress authorizes nuclear strike
// ═══════════════════════════════════════════════

router.post('/authorize-nuke', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player) { res.status(404).json({ error: 'Not found' }); return }

    const congress = (gov.congress as string[]) || []
    if (!congress.includes(player.name!) && gov.president !== player.name) {
      res.status(403).json({ error: 'Only congress or president can authorize.' }); return
    }

    await db.update(governments).set({ nuclearAuthorized: true }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: 'Nuclear strike authorized by congress.' })
  } catch (err) {
    console.error('[GOV] Authorize nuke error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
