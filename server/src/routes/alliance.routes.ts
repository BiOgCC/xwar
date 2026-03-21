import { Router } from 'express'
import { db } from '../db/connection.js'
import { players, alliances } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth as any)

// ── GET /api/alliance ── Get all alliances (public info)
router.get('/', async (_req, res) => {
  try {
    const allAlliances = await db.select().from(alliances)
    res.json({ alliances: allAlliances })
  } catch (err) {
    console.error('[ALLIANCE] Get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/alliance/:id ── Get single alliance
router.get('/:id', async (req, res) => {
  try {
    const [alliance] = await db.select().from(alliances).where(eq(alliances.id, req.params.id)).limit(1)
    if (!alliance) { res.status(404).json({ error: 'Alliance not found' }); return }
    res.json({ alliance })
  } catch (err) {
    console.error('[ALLIANCE] Get single error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/create ── Create an alliance
router.post('/create', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { name, tag } = req.body

    if (!name || name.length < 3) {
      res.status(400).json({ error: 'Alliance name must be at least 3 characters' })
      return
    }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    if ((player.money ?? 0) < 500_000) {
      res.status(400).json({ error: 'Need 500,000 money to create an alliance' })
      return
    }

    // Check if player is already in an alliance (members array JSON check)
    const existingAlliance = await db.execute(sql`
      SELECT id FROM alliances
      WHERE members @> ${JSON.stringify([{ id: playerId }])}::jsonb OR leader_id = ${playerId}
      LIMIT 1
    `)

    if ((existingAlliance as any).rows?.length > 0) {
      res.status(400).json({ error: 'You are already in an alliance' })
      return
    }

    // Deduct money
    await db.update(players).set({ money: (player.money ?? 0) - 500_000 }).where(eq(players.id, playerId))

    const [newAlliance] = await db.insert(alliances).values({
      name,
      tag: tag || null,
      leaderId: playerId,
      members: [{ id: playerId, name: player.name, role: 'leader' }],
    }).returning()

    res.json({ success: true, alliance: newAlliance })
  } catch (err) {
    console.error('[ALLIANCE] Create error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/join ── Join an alliance (simplified, instantly joins for now)
router.post('/join', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { allianceId } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    // Check if already in an alliance
    const existing = await db.execute(sql`
      SELECT id FROM alliances
      WHERE members @> ${JSON.stringify([{ id: playerId }])}::jsonb OR leader_id = ${playerId}
      LIMIT 1
    `)
    if ((existing as any).rows?.length > 0) {
      res.status(400).json({ error: 'You are already in an alliance' })
      return
    }

    // Add to alliance members
    await db.execute(sql`
      UPDATE alliances
      SET members = members || ${JSON.stringify([{ id: playerId, name: player.name, role: 'member' }])}::jsonb
      WHERE id = ${allianceId}
    `)

    res.json({ success: true, message: 'Joined alliance' })
  } catch (err) {
    console.error('[ALLIANCE] Join error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/donate ── Donate money to alliance treasury
router.post('/donate', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { amount } = req.body

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid donation amount' })
      return
    }

    // Note: Wrapping in transaction to prevent racing
    await db.transaction(async (tx) => {
      const [player] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1)
      if ((player.money ?? 0) < amount) throw new Error('Not enough money')

      // Find alliance the player is in
      const resQuery = await tx.execute(sql`SELECT id FROM alliances WHERE members @> ${JSON.stringify([{ id: playerId }])}::jsonb OR leader_id = ${playerId} FOR UPDATE LIMIT 1`)
      const allianceId = (resQuery as any).rows?.[0]?.id

      if (!allianceId) throw new Error('Not in an alliance')

      // Deduct from player, add to alliance
      await tx.execute(sql`UPDATE players SET money = money - ${amount} WHERE id = ${playerId}`)
      await tx.execute(sql`UPDATE alliances SET treasury = treasury + ${amount} WHERE id = ${allianceId}`)
    })

    res.json({ success: true, message: `Donated ${amount} to alliance` })
  } catch (err: any) {
    if (err.message === 'Not enough money' || err.message === 'Not in an alliance') {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[ALLIANCE] Donate error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/withdraw ── Withdraw from alliance treasury (Leader only)
router.post('/withdraw', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { amount } = req.body

    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid withdraw amount' })
      return
    }

    await db.transaction(async (tx) => {
      const [alliance] = await tx.execute(sql`SELECT * FROM alliances WHERE leader_id = ${playerId} FOR UPDATE`)
      const a = (alliance as any).rows?.[0]
      if (!a) throw new Error('Not authorized or not leader of any alliance')

      if (a.treasury < amount) throw new Error('Alliance treasury has insufficient funds')

      // Anti-proxy mechanic: 2% of withdrawal is burned into the void permanently
      const tax = Math.floor(amount * 0.02)
      const afterTax = amount - tax

      await tx.execute(sql`UPDATE alliances SET treasury = treasury - ${amount} WHERE id = ${a.id}`)
      await tx.execute(sql`UPDATE players SET money = money + ${afterTax} WHERE id = ${playerId}`)
    })

    res.json({ success: true, message: `Withdrew ${amount} with a 2% anti-proxy tax.` })
  } catch (err: any) {
    if (err.message) {
      res.status(400).json({ error: err.message })
      return
    }
    console.error('[ALLIANCE] Withdraw error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/leave ── Leave your alliance
router.post('/leave', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    // Find alliance
    const resQuery = await db.execute(sql`
      SELECT id, leader_id, members FROM alliances
      WHERE members @> ${JSON.stringify([{ id: playerId }])}::jsonb OR leader_id = ${playerId}
      LIMIT 1
    `)
    const alliance = (resQuery as any).rows?.[0]
    if (!alliance) { res.status(400).json({ error: 'Not in any alliance' }); return }

    if (alliance.leader_id === playerId) {
      res.status(400).json({ error: 'Leaders cannot leave. Transfer leadership or disband first.' })
      return
    }

    // Remove from members jsonb array
    const members = (alliance.members as any[]) || []
    const updated = members.filter((m: any) => m.id !== playerId)

    await db.update(alliances).set({ members: updated }).where(eq(alliances.id, alliance.id))

    res.json({ success: true, message: 'Left alliance.' })
  } catch (err) {
    console.error('[ALLIANCE] Leave error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/war/propose ── Propose declaring war
router.post('/war/propose', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { targetAllianceId, reason } = req.body

    if (!targetAllianceId) {
      res.status(400).json({ error: 'Target alliance ID required' }); return
    }

    // Must be alliance leader
    const [alliance] = await db.select().from(alliances).where(eq(alliances.leaderId, playerId)).limit(1)
    if (!alliance) { res.status(403).json({ error: 'Only alliance leaders can propose wars.' }); return }

    const [target] = await db.select().from(alliances).where(eq(alliances.id, targetAllianceId)).limit(1)
    if (!target) { res.status(404).json({ error: 'Target alliance not found' }); return }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)

    // Store proposal in alliance members or a lightweight jsonb approach
    // We'll use a simple jsonb column approach via raw SQL
    const members = (alliance.members as any[]) || []
    const proposal = {
      id: `war_${Date.now()}`,
      targetAllianceId,
      targetName: target.name,
      reason: reason || 'No reason given',
      proposedBy: player?.name || 'Unknown',
      proposedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      votesFor: [playerId],
      votesAgainst: [] as string[],
      status: 'pending',
    }

    // Store war proposals in a simple approach via jsonb
    await db.execute(sql`
      UPDATE alliances SET
        members = jsonb_set(
          COALESCE(members, '[]'::jsonb),
          '{0,warProposals}',
          COALESCE((members->0->'warProposals'), '[]'::jsonb) || ${JSON.stringify(proposal)}::jsonb
        )
      WHERE id = ${alliance.id}
    `)

    res.json({ success: true, proposal, message: `War proposed against ${target.name}! Alliance must vote.` })
  } catch (err) {
    console.error('[ALLIANCE] War propose error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/alliance/war/vote ── Vote on war proposal
router.post('/war/vote', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { allianceId, proposalId, vote } = req.body

    if (!allianceId || !proposalId || !['for', 'against'].includes(vote)) {
      res.status(400).json({ error: 'Invalid parameters' }); return
    }

    const [alliance] = await db.select().from(alliances).where(eq(alliances.id, allianceId)).limit(1)
    if (!alliance) { res.status(404).json({ error: 'Alliance not found' }); return }

    // Verify membership
    const members = (alliance.members as any[]) || []
    const isMember = members.some((m: any) => m.id === playerId) || alliance.leaderId === playerId
    if (!isMember) { res.status(403).json({ error: 'Not in this alliance.' }); return }

    // Find war proposal (stored on first member's warProposals)
    const leaderMember = members[0] || {}
    const proposals = leaderMember.warProposals || []
    const proposal = proposals.find((p: any) => p.id === proposalId)

    if (!proposal || proposal.status !== 'pending') {
      res.status(404).json({ error: 'Proposal not found or already resolved.' }); return
    }

    if (proposal.votesFor.includes(playerId) || proposal.votesAgainst.includes(playerId)) {
      res.status(400).json({ error: 'Already voted.' }); return
    }

    if (vote === 'for') proposal.votesFor.push(playerId)
    else proposal.votesAgainst.push(playerId)

    // Check majority
    const majority = Math.floor(members.length / 2) + 1
    if (proposal.votesFor.length >= majority) {
      proposal.status = 'declared'
    } else if (proposal.votesAgainst.length >= majority) {
      proposal.status = 'rejected'
    }

    // Update stored proposals
    leaderMember.warProposals = proposals
    members[0] = leaderMember
    await db.update(alliances).set({ members }).where(eq(alliances.id, allianceId))

    res.json({
      success: true,
      status: proposal.status,
      message: `Vote: ${vote}. Status: ${proposal.status}`,
    })
  } catch (err) {
    console.error('[ALLIANCE] War vote error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

