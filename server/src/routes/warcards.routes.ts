import { Router } from 'express'
import { db } from '../db/connection.js'
import { players, warCards } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { warCardEmitter } from '../services/warCard.service.js'

const router = Router()

// All warcard routes require auth
router.use(requireAuth as any)

// ── GET /api/warcards ── Fetch all war cards for current player
router.get('/', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    // Also trigger an asynchronous evaluation to catch up
    warCardEmitter.emit('player_action', playerId)

    const myCards = await db.select().from(warCards).where(eq(warCards.playerId, playerId))
    res.json({ success: true, cards: myCards })

  } catch (err) {
    console.error('[WAR CARDS] Fetch error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/warcards/all ── Fetch public card leaderboard (Hall of Fame)
router.get('/all', async (req, res) => {
  try {
    const allCardsQuery = await db.select({
      id: warCards.id,
      playerId: warCards.playerId,
      playerName: players.name,
      cardDefId: warCards.cardDefId,
      earnedAt: warCards.earnedAt,
      minted: warCards.minted
    })
    .from(warCards)
    .innerJoin(players, eq(warCards.playerId, players.id))
    .limit(200)

    res.json({ success: true, cards: allCardsQuery })
  } catch (err) {
    console.error('[WAR CARDS] Fetch all error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/warcards/:playerId ── Fetch public war cards for another player
router.get('/:id', async (req, res) => {
  try {
    const otherPlayerId = req.params.id

    const myCards = await db.select().from(warCards).where(eq(warCards.playerId, otherPlayerId))
    res.json({ success: true, cards: myCards })

  } catch (err) {
    console.error('[WAR CARDS] Fetch other player error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── GET /api/warcards/export ── Generate shareable card collection text
router.get('/export', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const [player] = await db.select({ name: players.name }).from(players).where(eq(players.id, playerId)).limit(1)
    const myCards = await db.select().from(warCards).where(eq(warCards.playerId, playerId))

    const playerName = player?.name || 'Unknown'
    const lines = [`🃏 ${playerName}'s War Cards (${myCards.length})`]
    for (const card of myCards) {
      lines.push(`  ✦ ${card.cardDefId} — earned ${new Date(card.earnedAt!).toLocaleDateString()}`)
    }

    res.json({ success: true, text: lines.join('\n') })
  } catch (err) {
    console.error('[WAR CARDS] Export error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
