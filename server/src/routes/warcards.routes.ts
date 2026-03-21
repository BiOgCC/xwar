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

// ── POST /api/warcards/mint/:id ── Web3 Minting placeholder
router.post('/mint/:id', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const cardId = req.params.id

    const [card] = await db.select().from(warCards).where(eq(warCards.id, cardId)).limit(1)

    if (!card || card.playerId !== playerId) {
      res.status(404).json({ error: 'Card not found or not owned by you' })
      return
    }

    if (card.minted) {
      res.status(400).json({ error: 'Card already minted on-chain' })
      return
    }

    // Mock Web3 mint transaction logic here
    await db.update(warCards).set({ minted: true }).where(eq(warCards.id, cardId))

    res.json({ success: true, message: 'Successfully minted card to blockchain' })

  } catch (err) {
    console.error('[WAR CARDS] Mint error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
