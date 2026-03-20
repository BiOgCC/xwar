/**
 * Stock Exchange Routes — Buy/sell country stocks, view holdings.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, countryStocks, stockHoldings } from '../db/schema.js'
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

export default router
