/**
 * Market Routes — Buy/sell items and resources.
 * All trades are atomic: deduct → transfer → log.
 */
import { Router } from 'express'
import { z } from 'zod'
import { eq, sql, and, desc } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { players, items, marketOrders, tradeHistory, countries } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

// Market tax rate (goes to seller's country treasury)
const MARKET_TAX_RATE = 0.05

// ═══════════════════════════════════════════════
//  POST /api/market/sell — List item or resource for sale
// ═══════════════════════════════════════════════

const sellSchema = z.object({
  itemType: z.string().min(1).max(16),          // 'weapon', 'food', 'oil', 'scrap', etc.
  resourceId: z.string().max(32).optional(),     // item UUID for equipment, null for bulk
  amount: z.number().int().positive().max(999999),
  pricePerUnit: z.number().positive().max(999_999_999),
})

router.post('/sell', requireAuth as any, validate(sellSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { itemType, resourceId, amount, pricePerUnit } = req.body

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    // For equipment listings, verify ownership and lock the item
    if (resourceId) {
      const [item] = await db.select().from(items).where(eq(items.id, resourceId)).limit(1)
      if (!item) { res.status(404).json({ error: 'Item not found' }); return }
      if (item.ownerId !== playerId) { res.status(403).json({ error: 'Not your item' }); return }
    } else {
      // Bulk resource: verify player has enough
      const resourceCol = getResourceColumn(itemType)
      if (resourceCol) {
        const [p] = await db.select({ val: resourceCol }).from(players).where(eq(players.id, playerId)).limit(1)
        if (!p || (p.val as number ?? 0) < amount) {
          res.status(400).json({ error: `Not enough ${itemType}` }); return
        }
        // Deduct resource atomically
        await db.update(players).set({
          [itemType]: sql`${resourceCol} - ${amount}`,
        }).where(sql`${players.id} = ${playerId} AND ${resourceCol} >= ${amount}`)
      }
    }

    const totalPrice = Math.floor(amount * pricePerUnit)

    const [order] = await db.insert(marketOrders).values({
      playerId,
      type: 'sell',
      itemType,
      resourceId: resourceId || null,
      amount,
      pricePerUnit: pricePerUnit.toString(),
      totalPrice: totalPrice.toString(),
      equipSnapshot: resourceId ? {} : null,
      source: 'player',
      countryCode: player.countryCode,
      status: 'open',
    }).returning()

    res.json({ success: true, orderId: order.id, message: `Listed ${amount} ${itemType} for $${totalPrice.toLocaleString()}` })
  } catch (err) {
    console.error('[MARKET] Sell error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/market/buy — Purchase from listing
// ═══════════════════════════════════════════════

const buySchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive().optional(), // for partial fills
})

router.post('/buy', requireAuth as any, validate(buySchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { orderId, amount: requestedAmount } = req.body

    const [order] = await db.select().from(marketOrders).where(eq(marketOrders.id, orderId)).limit(1)
    if (!order || order.status !== 'open') { res.status(400).json({ error: 'Order not available' }); return }
    if (order.playerId === playerId) { res.status(400).json({ error: 'Cannot buy your own listing' }); return }

    const available = (order.amount ?? 0) - (order.filledAmount ?? 0)
    const buyAmount = Math.min(requestedAmount ?? available, available)
    if (buyAmount <= 0) { res.status(400).json({ error: 'Nothing left to buy' }); return }

    const pricePerUnit = parseFloat(order.pricePerUnit ?? '0')
    const totalCost = Math.floor(buyAmount * pricePerUnit)
    const tax = Math.floor(totalCost * MARKET_TAX_RATE)
    const sellerReceives = totalCost - tax

    // Deduct buyer's money atomically
    const deductResult = await db.update(players).set({
      money: sql`${players.money} - ${totalCost}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.money} >= ${totalCost}`
    ).returning({ newBalance: players.money })

    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough money. Need $${totalCost.toLocaleString()}` }); return
    }

    // Pay seller atomically
    await db.update(players).set({
      money: sql`${players.money} + ${sellerReceives}`,
    }).where(eq(players.id, order.playerId!))

    // Transfer resource/item to buyer
    if (order.resourceId) {
      // Item transfer
      await db.update(items).set({ ownerId: playerId }).where(eq(items.id, order.resourceId))
    } else {
      // Bulk resource: add to buyer
      const resourceCol = getResourceColumn(order.itemType)
      if (resourceCol) {
        await db.update(players).set({
          [order.itemType]: sql`${resourceCol} + ${buyAmount}`,
        }).where(eq(players.id, playerId))
      }
    }

    // Apply tax to seller's country
    if (order.countryCode && tax > 0) {
      await db.execute(sql`
        UPDATE countries SET fund = jsonb_set(
          COALESCE(fund, '{"money":0}'::jsonb), '{money}',
          to_jsonb(COALESCE((fund->>'money')::bigint, 0) + ${tax})
        ) WHERE code = ${order.countryCode}
      `)
    }

    // Update order status
    const newFilled = (order.filledAmount ?? 0) + buyAmount
    const newStatus = newFilled >= (order.amount ?? 0) ? 'filled' : 'open'
    await db.update(marketOrders).set({
      filledAmount: newFilled,
      status: newStatus,
    }).where(eq(marketOrders.id, orderId))

    // Log trade
    await db.insert(tradeHistory).values({
      resourceId: order.resourceId,
      itemType: order.itemType,
      buyerId: playerId,
      sellerId: order.playerId,
      amount: buyAmount,
      pricePerUnit: pricePerUnit.toString(),
      totalPrice: totalCost.toString(),
      tax: tax.toString(),
    })

    res.json({
      success: true,
      bought: buyAmount,
      totalCost,
      tax,
      newBalance: deductResult[0].newBalance,
      message: `Bought ${buyAmount} ${order.itemType} for $${totalCost.toLocaleString()}`,
    })
  } catch (err) {
    console.error('[MARKET] Buy error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  POST /api/market/cancel — Cancel own listing
// ═══════════════════════════════════════════════

const cancelSchema = z.object({
  orderId: z.string().uuid(),
})

router.post('/cancel', requireAuth as any, validate(cancelSchema), async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { orderId } = req.body

    const [order] = await db.select().from(marketOrders).where(eq(marketOrders.id, orderId)).limit(1)
    if (!order) { res.status(404).json({ error: 'Order not found' }); return }
    if (order.playerId !== playerId) { res.status(403).json({ error: 'Not your order' }); return }
    if (order.status !== 'open') { res.status(400).json({ error: 'Order is already closed' }); return }

    // Return unfilled resources to player
    const unfilled = (order.amount ?? 0) - (order.filledAmount ?? 0)
    if (unfilled > 0 && !order.resourceId) {
      const resourceCol = getResourceColumn(order.itemType)
      if (resourceCol) {
        await db.update(players).set({
          [order.itemType]: sql`${resourceCol} + ${unfilled}`,
        }).where(eq(players.id, playerId))
      }
    }

    await db.update(marketOrders).set({ status: 'cancelled' }).where(eq(marketOrders.id, orderId))

    res.json({ success: true, message: 'Order cancelled.' })
  } catch (err) {
    console.error('[MARKET] Cancel error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/market/listings — Browse open listings
// ═══════════════════════════════════════════════

router.get('/listings', async (req, res) => {
  try {
    const listings = await db.select().from(marketOrders)
      .where(eq(marketOrders.status, 'open'))
      .orderBy(desc(marketOrders.createdAt))
      .limit(100)

    res.json({ success: true, listings })
  } catch (err) {
    console.error('[MARKET] Listings error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════
//  GET /api/market/my-orders — Player's orders
// ═══════════════════════════════════════════════

router.get('/my-orders', requireAuth as any, async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const orders = await db.select().from(marketOrders)
      .where(eq(marketOrders.playerId, playerId))
      .orderBy(desc(marketOrders.createdAt))
      .limit(50)

    res.json({ success: true, orders })
  } catch (err) {
    console.error('[MARKET] My orders error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── Resource column mapper ──
function getResourceColumn(itemType: string) {
  const map: Record<string, any> = {
    oil: players.oil,
    scrap: players.scrap,
    materialX: players.materialX,
    bread: players.bread,
    sushi: players.sushi,
    wagyu: players.wagyu,
    bitcoin: players.bitcoin,
    wheat: players.wheat,
    fish: players.fish,
    steak: players.steak,
  }
  return map[itemType] || null
}

export default router
