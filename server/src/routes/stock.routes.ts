/**
 * Stock Exchange Routes — Buy/sell country stocks, view holdings.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, countryStocks, stockHoldings, bonds } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const STOCK_TAX_RATE = 0.02

// ═══════════════════════════════════════════════
//  POST /api/stock/buy
// ═══════════════════════════════════════════════

const buySchema = z.object({
  countryCode: z.string().min(2).max(4),
  shares: z.number().int().positive().max(10000),
})

router.post('/buy', requireAuth as any, validate(buySchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, shares } = req.body

    // Get current stock price
    const [stock] = await db.select().from(countryStocks).where(eq(countryStocks.countryCode, countryCode)).limit(1)
    if (!stock) { res.status(404).json({ error: 'Stock not found' }); return }

    const pricePerShare = parseFloat(stock.price ?? '100')
    const totalCost = Math.ceil(shares * pricePerShare)
    const tax = Math.floor(totalCost * STOCK_TAX_RATE)
    const totalWithTax = totalCost + tax

    // Deduct money atomically
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${totalWithTax}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${totalWithTax}`
    ).returning({ newBalance: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${totalWithTax.toLocaleString()}` }); return
    }

    // Create stock holding
    await db.insert(stockHoldings).values({
      playerId,
      countryCode,
      shares,
      buyPrice: pricePerShare.toString(),
    })

    // Update volume
    await db.update(countryStocks).set({
      volume: sql`${countryStocks.volume} + ${shares}`,
    }).where(eq(countryStocks.countryCode, countryCode))

    res.json({
      success: true,
      shares,
      pricePerShare,
      totalCost: totalWithTax,
      newBalance: deductResult[0].newBalance,
      message: `Bought ${shares} ${countryCode} shares at $${pricePerShare.toFixed(2)}/share`,
    })
  } catch (err) {
    console.error('[STOCK] Buy error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/stock/sell
// ═══════════════════════════════════════════════

const sellSchema = z.object({
  holdingId: z.string().uuid(),
})

router.post('/sell', requireAuth as any, validate(sellSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { holdingId } = req.body

    const [holding] = await db.select().from(stockHoldings).where(eq(stockHoldings.id, holdingId)).limit(1)
    if (!holding) { res.status(404).json({ error: 'Holding not found' }); return }
    if (holding.playerId !== playerId) { res.status(403).json({ error: 'Not your holding' }); return }

    // Get current price
    const [stock] = await db.select().from(countryStocks).where(eq(countryStocks.countryCode, holding.countryCode!)).limit(1)
    if (!stock) { res.status(404).json({ error: 'Stock not found' }); return }

    const currentPrice = parseFloat(stock.price ?? '100')
    const proceeds = Math.floor(holding.shares * currentPrice)
    const tax = Math.floor(proceeds * STOCK_TAX_RATE)
    const netProceeds = proceeds - tax

    // Add money to player
    await db.update(players).set({
      money: sql`${players.money} + ${netProceeds}`,
    }).where(eq(players.id, playerId))

    // Delete holding
    await db.delete(stockHoldings).where(eq(stockHoldings.id, holdingId))

    // Update volume
    await db.update(countryStocks).set({
      volume: sql`${countryStocks.volume} + ${holding.shares}`,
    }).where(eq(countryStocks.countryCode, holding.countryCode!))

    const buyPrice = parseFloat(holding.buyPrice)
    const profit = netProceeds - Math.floor(holding.shares * buyPrice)

    res.json({
      success: true,
      shares: holding.shares,
      sellPrice: currentPrice,
      proceeds: netProceeds,
      profit,
      message: `Sold ${holding.shares} shares for $${netProceeds.toLocaleString()} (${profit >= 0 ? '+' : ''}$${profit.toLocaleString()})`,
    })
  } catch (err) {
    console.error('[STOCK] Sell error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/stock/prices — All stock prices
// ═══════════════════════════════════════════════

router.get('/prices', async (_req, res) => {
  try {
    const stocks = await db.select().from(countryStocks)
    res.json({ success: true, stocks })
  } catch (err) {
    console.error('[STOCK] Prices error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/stock/my-holdings — Player's holdings
// ═══════════════════════════════════════════════

router.get('/my-holdings', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const holdings = await db.select().from(stockHoldings).where(eq(stockHoldings.playerId, playerId))
    res.json({ success: true, holdings })
  } catch (err) {
    console.error('[STOCK] My holdings error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/stock/bond/open — Open a binary bond (up/down bet)
// ═══════════════════════════════════════════════

const bondSchema = z.object({
  countryCode: z.string().min(2).max(4),
  direction: z.enum(['up', 'down']),
  amount: z.number().int().positive().max(10_000_000),
  duration: z.enum(['5', '15', '30']), // minutes
})

router.post('/bond/open', requireAuth as any, validate(bondSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { countryCode, direction, amount, duration } = req.body

    // Get current price
    const [stock] = await db.select().from(countryStocks).where(eq(countryStocks.countryCode, countryCode)).limit(1)
    if (!stock) { res.status(404).json({ error: 'Stock not found' }); return }

    // Deduct money
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${amount}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${amount}`
    ).returning({ newBalance: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${amount.toLocaleString()}` }); return
    }

    const durationMinutes = parseInt(duration)
    const maturityAt = new Date(Date.now() + durationMinutes * 60 * 1000)

    // Payout multiplier based on duration
    const multipliers: Record<string, number> = { '5': 1.7, '15': 1.85, '30': 2.0 }
    const multiplier = multipliers[duration]

    const currentPrice = parseFloat(stock.price ?? '100')

    const [bond] = await db.insert(bonds).values({
      playerId,
      countryCode,
      amount,
      direction,
      openPrice: currentPrice.toString(),
      interestRate: multiplier.toString(),
      maturityAt,
      status: 'active',
    }).returning()

    res.json({
      success: true,
      bond: {
        ...bond,
        payout: Math.floor(amount * multiplier),
      },
      message: `Bond opened: ${direction.toUpperCase()} on ${countryCode} at $${currentPrice.toFixed(2)} for ${durationMinutes}m (${multiplier}x payout)`,
    })
  } catch (err) {
    console.error('[STOCK] Bond open error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/stock/bond/settle — Settle a matured bond
// ═══════════════════════════════════════════════

const settleSchema = z.object({
  bondId: z.string().uuid(),
})

router.post('/bond/settle', requireAuth as any, validate(settleSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { bondId } = req.body

    const [bond] = await db.select().from(bonds).where(eq(bonds.id, bondId)).limit(1)
    if (!bond) { res.status(404).json({ error: 'Bond not found' }); return }
    if (bond.playerId !== playerId) { res.status(403).json({ error: 'Not your bond' }); return }
    if (bond.status !== 'active') { res.status(400).json({ error: 'Bond already settled' }); return }

    // Check maturity
    if (new Date() < bond.maturityAt) {
      res.status(400).json({ error: 'Bond has not matured yet' }); return
    }

    // Get current price to determine win/loss
    const [stock] = await db.select().from(countryStocks).where(eq(countryStocks.countryCode, bond.countryCode!)).limit(1)
    if (!stock) { res.status(404).json({ error: 'Stock not found' }); return }

    const currentPrice = parseFloat(stock.price ?? '100')
    const openPrice = parseFloat(bond.openPrice ?? '100')
    const direction = bond.direction ?? 'up'
    const multiplier = parseFloat(bond.interestRate ?? '1.8')
    const payout = Math.floor(bond.amount * multiplier)

    // Compare live price against stored openPrice + direction
    const priceWentUp = currentPrice > openPrice
    const priceWentDown = currentPrice < openPrice
    const won = (direction === 'up' && priceWentUp) || (direction === 'down' && priceWentDown) 

    if (won) {
      await db.update(players).set({
        money: sql`${players.money} + ${payout}`,
      }).where(eq(players.id, playerId))
    }

    await db.update(bonds).set({ status: won ? 'won' : 'lost' }).where(eq(bonds.id, bondId))

    res.json({
      success: true,
      won,
      payout: won ? payout : 0,
      message: won ? `Bond WON! +$${payout.toLocaleString()}` : `Bond expired. Better luck next time.`,
    })
  } catch (err) {
    console.error('[STOCK] Bond settle error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/stock/bond/my-bonds — Player's bonds
// ═══════════════════════════════════════════════

router.get('/bond/my-bonds', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const playerBonds = await db.select().from(bonds).where(eq(bonds.playerId, playerId))
    res.json({ success: true, bonds: playerBonds })
  } catch (err) {
    console.error('[STOCK] My bonds error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

