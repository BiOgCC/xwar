/**
 * Casino Routes — All casino game endpoints
 * All outcomes are determined server-side with crypto-safe RNG
 */
import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  spinSlots, SLOTS_BETS,
  blackjackStart, blackjackHit, blackjackStand, BJ_BETS,
  crashBet, crashCashout, crashReportCrash, CRASH_BETS,
  spinWheel, WHEEL_BETS,
} from '../services/casino.service.js'

const router = Router()
router.use(requireAuth as any)

// ═══════════════════════════════════════
//  SLOTS
// ═══════════════════════════════════════

router.post('/slots/spin', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bet } = req.body

    if (!bet || !SLOTS_BETS.includes(bet)) {
      res.status(400).json({ error: `Invalid bet. Valid: ${SLOTS_BETS.join(', ')}` })
      return
    }

    const result = await spinSlots(playerId, bet)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'Insufficient funds') { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Slots error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════
//  BLACKJACK
// ═══════════════════════════════════════

router.post('/blackjack/start', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bet } = req.body

    if (!bet || !BJ_BETS.includes(bet)) {
      res.status(400).json({ error: `Invalid bet. Valid: ${BJ_BETS.join(', ')}` })
      return
    }

    const result = await blackjackStart(playerId, bet)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'Insufficient funds') { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Blackjack start error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/blackjack/hit', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const result = await blackjackHit(playerId)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'No active game') { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Blackjack hit error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/blackjack/stand', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const result = await blackjackStand(playerId)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'No active game') { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Blackjack stand error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════
//  CRASH
// ═══════════════════════════════════════

router.post('/crash/bet', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bet } = req.body

    if (!bet || !CRASH_BETS.includes(bet)) {
      res.status(400).json({ error: `Invalid bet. Valid: ${CRASH_BETS.join(', ')}` })
      return
    }

    const result = await crashBet(playerId, bet)
    res.json(result)
  } catch (err: any) {
    if (['Insufficient funds', 'Already in a round'].includes(err.message)) { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Crash bet error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/crash/cashout', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { multiplier } = req.body

    if (!multiplier || multiplier < 1 || multiplier > 200) {
      res.status(400).json({ error: 'Invalid multiplier' })
      return
    }

    const result = await crashCashout(playerId, multiplier)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'No active crash round') { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Crash cashout error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/crash/report-crash', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const result = crashReportCrash(playerId)
    res.json(result || { error: 'No session' })
  } catch (err) {
    console.error('[CASINO] Crash report error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════
//  WHEEL (Casino Spin)
// ═══════════════════════════════════════

router.post('/wheel/spin', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bet } = req.body

    if (!bet || !WHEEL_BETS.includes(bet)) {
      res.status(400).json({ error: `Invalid bet. Valid: ${WHEEL_BETS.join(', ')}` })
      return
    }

    const result = await spinWheel(playerId, bet)
    res.json(result)
  } catch (err: any) {
    if (err.message === 'Insufficient funds') { res.status(400).json({ error: err.message }); return }
    console.error('[CASINO] Wheel error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
