/**
 * Government Routes — Tax, infrastructure, elections.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, countries, governments, companies, wars } from '../db/schema.js'
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
//  GET /api/gov/citizens/:code — Get all citizens of a country
// ═══════════════════════════════════════════════

router.get('/citizens/:code', async (req, res) => {
  try {
    const { code } = req.params

    // Get all players in this country
    const citizenRows = await db.select({
      id: players.id,
      name: players.name,
      level: players.level,
      avatar: players.avatar,
      damageDone: players.damageDone,
      createdAt: players.createdAt,
    }).from(players).where(eq(players.countryCode, code))

    // Get government to derive roles
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, code)).limit(1)
    const congress: string[] = Array.isArray(gov?.congress) ? (gov.congress as string[]) : []

    // Build citizen list with roles
    const citizens = citizenRows.map(p => {
      let role: string = 'citizen'
      if (gov) {
        if (gov.president === p.name) role = 'president'
        else if (gov.vicePresident === p.name) role = 'vicepresident'
        else if (gov.defenseMinister === p.name) role = 'defense_minister'
        else if (gov.ecoMinister === p.name) role = 'eco_minister'
        else if (congress.includes(p.name!)) role = 'congress'
      }
      return {
        id: p.id,
        name: p.name,
        level: p.level ?? 1,
        role,
        avatar: p.avatar,
        damageDone: p.damageDone ?? 0,
        joinedAt: p.createdAt ? p.createdAt.getTime() : Date.now(),
      }
    })

    // Sort by level descending
    citizens.sort((a, b) => b.level - a.level)

    res.json({ success: true, citizens, population: citizens.length })
  } catch (err) {
    console.error('[GOV] Citizens error:', err)
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

const ALL_LAW_TYPES = [
  'declare_war', 'propose_peace', 'impeach_president', 'tax_change',
  'declare_sworn_enemy', 'propose_alliance', 'break_alliance',
  'authorize_nuclear_action', 'print_money', 'trade_embargo', 'lift_embargo',
  'conscription', 'end_conscription', 'import_tariff', 'minimum_wage',
  'military_spending_change', 'nationalize_company_law',
] as const

const proposeSchema = z.object({
  countryCode: z.string().min(2).max(4),
  lawType: z.enum(ALL_LAW_TYPES),
  targetCountryId: z.string().optional(),
  newValue: z.number().optional(),
})

router.post('/propose-law', requireAuth as any, validate(proposeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, lawType, targetCountryId, newValue } = req.body

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

    // Validate target for diplomacy laws
    const needsTarget = ['declare_war', 'propose_peace', 'declare_sworn_enemy',
      'propose_alliance', 'break_alliance', 'trade_embargo', 'lift_embargo'].includes(lawType)
    if (needsTarget && !targetCountryId) {
      res.status(400).json({ error: 'Target country is required for this law type.' }); return
    }

    const lawsData = (gov.laws as any) || {}
    const proposals = lawsData.proposals || []

    const proposal = {
      id: `law_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lawType,
      targetCountryId: targetCountryId || null,
      newValue: newValue ?? null,
      proposedBy: player.name,
      proposedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
      votesFor: [player.name],
      votesAgainst: [] as string[],
      status: 'pending',
    }

    proposals.push(proposal)
    lawsData.proposals = proposals

    await db.update(governments).set({ laws: lawsData }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Law proposed: ${lawType}`, proposal })
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

    const lawsData = (gov.laws as any) || {}
    const proposals = lawsData.proposals || []
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
    let effectApplied = ''

    if (proposal.votesFor.length >= majority) {
      proposal.status = 'passed'
      effectApplied = await applyLawEffect(countryCode, proposal, gov)
    } else if (proposal.votesAgainst.length >= majority) {
      proposal.status = 'rejected'
    }

    lawsData.proposals = proposals
    await db.update(governments).set({ laws: lawsData }).where(eq(governments.countryCode, countryCode))

    const msg = `Vote cast: ${vote}. Status: ${proposal.status}` + (effectApplied ? ` — ${effectApplied}` : '')
    res.json({ success: true, message: msg, status: proposal.status })
  } catch (err) {
    console.error('[GOV] Vote law error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/** Apply a passed law's effect to the database */
async function applyLawEffect(countryCode: string, proposal: any, gov: any): Promise<string> {
  const target = proposal.targetCountryId
  const value = proposal.newValue

  switch (proposal.lawType) {
    case 'tax_change': {
      const rate = Math.max(0, Math.min(100, value ?? 25))
      await db.update(governments).set({ taxRate: rate }).where(eq(governments.countryCode, countryCode))
      return `Tax rate set to ${rate}%`
    }
    case 'declare_war': {
      if (!target) return ''
      // Insert war record
      await db.insert(wars).values({ attackerCode: countryCode, defenderCode: target })
      return `War declared on ${target}`
    }
    case 'propose_peace': {
      if (!target) return ''
      // End active wars between the two countries
      await db.update(wars).set({ status: 'ended' })
        .where(sql`(${wars.attackerCode} = ${countryCode} AND ${wars.defenderCode} = ${target})
          OR (${wars.attackerCode} = ${target} AND ${wars.defenderCode} = ${countryCode})`)
      return `Peace with ${target}`
    }
    case 'impeach_president': {
      await db.update(governments).set({ president: null })
        .where(eq(governments.countryCode, countryCode))
      return 'President impeached'
    }
    case 'declare_sworn_enemy': {
      if (!target) return ''
      await db.update(governments).set({ swornEnemy: target })
        .where(eq(governments.countryCode, countryCode))
      return `Sworn enemy: ${target}`
    }
    case 'propose_alliance': {
      if (!target) return ''
      const myAlliances = ((gov.alliances as string[]) || []).filter((a: string) => a !== target)
      myAlliances.push(target)
      await db.update(governments).set({ alliances: myAlliances })
        .where(eq(governments.countryCode, countryCode))
      // Also add mutual alliance to target
      const [targetGov] = await db.select().from(governments).where(eq(governments.countryCode, target)).limit(1)
      if (targetGov) {
        const theirAlliances = ((targetGov.alliances as string[]) || []).filter((a: string) => a !== countryCode)
        theirAlliances.push(countryCode)
        await db.update(governments).set({ alliances: theirAlliances })
          .where(eq(governments.countryCode, target))
      }
      return `Alliance with ${target}`
    }
    case 'break_alliance': {
      if (!target) return ''
      const myA = ((gov.alliances as string[]) || []).filter((a: string) => a !== target)
      await db.update(governments).set({ alliances: myA })
        .where(eq(governments.countryCode, countryCode))
      // Remove mutual
      const [tGov] = await db.select().from(governments).where(eq(governments.countryCode, target)).limit(1)
      if (tGov) {
        const theirA = ((tGov.alliances as string[]) || []).filter((a: string) => a !== countryCode)
        await db.update(governments).set({ alliances: theirA })
          .where(eq(governments.countryCode, target))
      }
      return `Alliance broken with ${target}`
    }
    case 'authorize_nuclear_action': {
      await db.update(governments).set({ nuclearAuthorized: true })
        .where(eq(governments.countryCode, countryCode))
      return 'Nuclear action authorized'
    }
    case 'print_money': {
      if (!value || value <= 0) return ''
      // Add money to country fund
      const fund = (gov.fund as any) || { money: 0 }
      fund.money = (fund.money || 0) + value
      await db.update(countries).set({ fund })
        .where(eq(countries.code, countryCode))
      return `Printed $${value.toLocaleString()}`
    }
    case 'trade_embargo': {
      if (!target) return ''
      const embargoes = ((gov.embargoes as string[]) || []).filter((e: string) => e !== target)
      embargoes.push(target)
      await db.update(governments).set({ embargoes })
        .where(eq(governments.countryCode, countryCode))
      return `Trade embargo on ${target}`
    }
    case 'lift_embargo': {
      if (!target) return ''
      const emb = ((gov.embargoes as string[]) || []).filter((e: string) => e !== target)
      await db.update(governments).set({ embargoes: emb })
        .where(eq(governments.countryCode, countryCode))
      return `Embargo lifted on ${target}`
    }
    case 'conscription': {
      await db.update(governments).set({ conscriptionActive: true })
        .where(eq(governments.countryCode, countryCode))
      return 'Conscription activated'
    }
    case 'end_conscription': {
      await db.update(governments).set({ conscriptionActive: false })
        .where(eq(governments.countryCode, countryCode))
      return 'Conscription ended'
    }
    case 'import_tariff': {
      const tariff = Math.max(0, Math.min(50, value ?? 0))
      await db.update(governments).set({ importTariff: tariff })
        .where(eq(governments.countryCode, countryCode))
      return `Import tariff set to ${tariff}%`
    }
    case 'minimum_wage': {
      const wage = Math.max(0, value ?? 0)
      await db.update(governments).set({ minimumWage: wage })
        .where(eq(governments.countryCode, countryCode))
      return `Minimum wage set to $${wage.toLocaleString()}`
    }
    case 'military_spending_change': {
      const pct = Math.max(0, Math.min(50, value ?? 0))
      await db.update(governments).set({ militaryBudgetPercent: pct })
        .where(eq(governments.countryCode, countryCode))
      return `Military budget set to ${pct}%`
    }
    case 'nationalize_company_law': {
      return 'Nationalization approved (requires separate action)'
    }
    default:
      return ''
  }
}

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
//  POST /api/gov/start-enrichment — Begin nuclear enrichment (7-day timer)
// ═══════════════════════════════════════════════

const enrichmentSchema = z.object({
  countryCode: z.string().min(2).max(4),
})

const NUKE_COST = { oil: 10000, scrap: 10000, materialX: 10000, bitcoin: 100, jets: 1 }
const ENRICHMENT_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

router.post('/start-enrichment', requireAuth as any, validate(enrichmentSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can start enrichment.' }); return
    }

    if (!gov.nuclearAuthorized) {
      res.status(403).json({ error: 'Nuclear authorization required from congress first.' }); return
    }

    if (gov.enrichmentStartedAt) {
      res.status(400).json({ error: 'Enrichment already in progress.' }); return
    }

    // Atomically deduct resources from country fund
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
      res.status(400).json({ error: 'Treasury lacks resources for enrichment (10K oil/scrap/matX + 100 BTC + 1 jet).' }); return
    }

    // Start enrichment timer
    const now = new Date()
    const completedAt = new Date(now.getTime() + ENRICHMENT_DURATION_MS)
    await db.update(governments).set({
      enrichmentStartedAt: now,
      enrichmentCompletedAt: completedAt,
    }).where(eq(governments.countryCode, countryCode))

    res.json({
      success: true,
      message: `☢️ Enrichment program started! Warhead ready in 7 days.`,
      enrichmentStartedAt: now.toISOString(),
      enrichmentCompletedAt: completedAt.toISOString(),
    })
  } catch (err) {
    console.error('[GOV] Start enrichment error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/nuke — Launch nuclear strike (requires completed enrichment)
// ═══════════════════════════════════════════════

const nukeSchema = z.object({
  countryCode: z.string().min(2).max(4),
  targetCode: z.string().min(2).max(4),
})

router.post('/nuke', requireAuth as any, validate(nukeSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, targetCode } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can launch nuclear strikes.' }); return
    }

    // Check enrichment completed
    if (!gov.enrichmentCompletedAt || new Date() < gov.enrichmentCompletedAt) {
      res.status(403).json({ error: 'Enrichment not completed. Warhead is not ready.' }); return
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

    // Reset all nuclear state
    await db.update(governments).set({
      nuclearAuthorized: false,
      enrichmentStartedAt: null,
      enrichmentCompletedAt: null,
    }).where(eq(governments.countryCode, countryCode))

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

    res.json({ success: true, message: 'Nuclear enrichment program authorized by congress.' })
  } catch (err) {
    console.error('[GOV] Authorize nuke error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  PATCH /api/gov/autodefense — Set country auto-defense limit
// ═══════════════════════════════════════════════

const autodefenseSchema = z.object({
  countryCode: z.string().min(2).max(4),
  limit: z.number().int().min(-1).max(100),  // -1 = all, 0 = off, N = max N
})

router.patch('/autodefense', requireAuth as any, validate(autodefenseSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, limit } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can set autodefense.' }); return
    }

    await db.update(countries).set({ autoDefenseLimit: limit }).where(eq(countries.code, countryCode))

    res.json({ success: true, message: `Autodefense set to ${limit === -1 ? 'ALL' : limit === 0 ? 'OFF' : limit}.` })
  } catch (err) {
    console.error('[GOV] Autodefense error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/force-vault/transfer — Transfer fund → forceVault
// ═══════════════════════════════════════════════

const forceVaultTransferSchema = z.object({
  countryCode: z.string().min(2).max(4),
  resource: z.enum(['money', 'oil', 'scraps', 'materialX', 'bitcoin', 'jets']),
  amount: z.number().int().positive(),
})

router.post('/force-vault/transfer', requireAuth as any, validate(forceVaultTransferSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, resource, amount } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can manage the force vault.' }); return
    }

    // Atomic: deduct from fund, add to forceVault
    const result = await db.execute(sql`
      UPDATE countries SET
        fund = jsonb_set(
          fund, ${sql.raw(`'{${resource}}'`)},
          to_jsonb(COALESCE((fund->>'${sql.raw(resource)}')::bigint, 0) - ${amount})
        ),
        force_vault = jsonb_set(
          COALESCE(force_vault, '{}')::jsonb, ${sql.raw(`'{${resource}}'`)},
          to_jsonb(COALESCE((force_vault->>'${sql.raw(resource)}')::bigint, 0) + ${amount})
        )
      WHERE code = ${countryCode}
        AND COALESCE((fund->>'${sql.raw(resource)}')::bigint, 0) >= ${amount}
      RETURNING code
    `)

    if ((result as any).length === 0) {
      res.status(400).json({ error: `Treasury doesn't have enough ${resource}.` }); return
    }

    res.json({ success: true, message: `Transferred ${amount} ${resource} to force vault.` })
  } catch (err) {
    console.error('[GOV] Force vault transfer error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/force-vault/spend — Spend from forceVault
// ═══════════════════════════════════════════════

const forceVaultSpendSchema = z.object({
  countryCode: z.string().min(2).max(4),
  resource: z.enum(['money', 'oil', 'scraps', 'materialX', 'bitcoin', 'jets']),
  amount: z.number().int().positive(),
})

router.post('/force-vault/spend', requireAuth as any, validate(forceVaultSpendSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, resource, amount } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player) { res.status(404).json({ error: 'Not found' }); return }

    // President or congress can spend
    const congress = (gov.congress as string[]) || []
    if (gov.president !== player.name && !congress.includes(player.name!)) {
      res.status(403).json({ error: 'Only president or congress can spend from force vault.' }); return
    }

    const result = await db.execute(sql`
      UPDATE countries SET
        force_vault = jsonb_set(
          COALESCE(force_vault, '{}')::jsonb, ${sql.raw(`'{${resource}}'`)},
          to_jsonb(COALESCE((force_vault->>'${sql.raw(resource)}')::bigint, 0) - ${amount})
        )
      WHERE code = ${countryCode}
        AND COALESCE((force_vault->>'${sql.raw(resource)}')::bigint, 0) >= ${amount}
      RETURNING code
    `)

    if ((result as any).length === 0) {
      res.status(400).json({ error: `Force vault doesn't have enough ${resource}.` }); return
    }

    res.json({ success: true, message: `Spent ${amount} ${resource} from force vault.` })
  } catch (err) {
    console.error('[GOV] Force vault spend error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/set-citizen-dividend — Set citizen dividend %
// ═══════════════════════════════════════════════

const dividendSchema = z.object({
  countryCode: z.string().min(2).max(4),
  percent: z.number().int().min(0).max(30),
})

router.post('/set-citizen-dividend', requireAuth as any, validate(dividendSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, percent } = req.body

    // Verify president
    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can set citizen dividend.' }); return
    }

    await db.update(governments).set({ citizenDividendPercent: percent }).where(eq(governments.countryCode, countryCode))

    res.json({ success: true, message: `Citizen dividend set to ${percent}%` })
  } catch (err) {
    console.error('[GOV] Set citizen dividend error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/appoint — Appoint VP / ministers (president only)
// ═══════════════════════════════════════════════

const appointSchema = z.object({
  countryCode: z.string().min(2).max(4),
  position: z.enum(['vicePresident', 'defenseMinister', 'ecoMinister']),
  playerName: z.string().min(1).max(32).nullable(),
})

const POSITION_COL: Record<string, string> = {
  vicePresident: 'vice_president',
  defenseMinister: 'defense_minister',
  ecoMinister: 'eco_minister',
}

router.post('/appoint', requireAuth as any, validate(appointSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, position, playerName } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can appoint government positions.' }); return
    }

    // If playerName is provided, verify they are a citizen of this country
    if (playerName) {
      const [target] = await db.select().from(players)
        .where(eq(players.name, playerName)).limit(1)
      if (!target || target.countryCode !== countryCode) {
        res.status(400).json({ error: `${playerName} is not a citizen of ${countryCode}.` }); return
      }
    }

    const col = POSITION_COL[position]
    await db.execute(sql`
      UPDATE governments SET ${sql.raw(col)} = ${playerName} WHERE country_code = ${countryCode}
    `)

    const positionLabel: Record<string, string> = {
      vicePresident: 'Vice President',
      defenseMinister: 'Minister of Defense',
      ecoMinister: 'Minister of Economy',
    }

    const msg = playerName
      ? `${playerName} appointed as ${positionLabel[position]}.`
      : `${positionLabel[position]} position cleared.`

    res.json({ success: true, message: msg })
  } catch (err) {
    console.error('[GOV] Appoint error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/gov/appoint-congress — Add/remove congress members (president only)
// ═══════════════════════════════════════════════

const appointCongressSchema = z.object({
  countryCode: z.string().min(2).max(4),
  playerName: z.string().min(1).max(32),
  action: z.enum(['add', 'remove']),
})

router.post('/appoint-congress', requireAuth as any, validate(appointCongressSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, playerName, action } = req.body

    const [gov] = await db.select().from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!gov || !player || gov.president !== player.name) {
      res.status(403).json({ error: 'Only the president can manage congress.' }); return
    }

    const congress = (gov.congress as string[]) || []

    if (action === 'add') {
      // Verify citizenship
      const [target] = await db.select().from(players)
        .where(eq(players.name, playerName)).limit(1)
      if (!target || target.countryCode !== countryCode) {
        res.status(400).json({ error: `${playerName} is not a citizen of ${countryCode}.` }); return
      }
      if (congress.includes(playerName)) {
        res.status(400).json({ error: `${playerName} is already in congress.` }); return
      }
      if (congress.length >= 10) {
        res.status(400).json({ error: 'Congress is full (max 10 members).' }); return
      }
      const newCongress = [...congress, playerName]
      await db.update(governments).set({ congress: newCongress }).where(eq(governments.countryCode, countryCode))
      res.json({ success: true, message: `${playerName} added to congress.`, congress: newCongress })
    } else {
      const newCongress = congress.filter((m: string) => m !== playerName)
      await db.update(governments).set({ congress: newCongress }).where(eq(governments.countryCode, countryCode))
      res.json({ success: true, message: `${playerName} removed from congress.`, congress: newCongress })
    }
  } catch (err) {
    console.error('[GOV] Appoint congress error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
