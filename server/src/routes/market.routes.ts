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

// Market tax rate (goes to seller's country treasury) — aligned with frontend TAX_RATE
const MARKET_TAX_RATE = 0.01

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
    let equipSnapshot: any = null
    if (resourceId) {
      const [item] = await db.select().from(items).where(eq(items.id, resourceId)).limit(1)
      if (!item) { res.status(404).json({ error: 'Item not found' }); return }
      if (item.ownerId !== playerId) { res.status(403).json({ error: 'Not your item' }); return }
      if (item.location !== 'inventory') { res.status(400).json({ error: 'Item not in inventory' }); return }
      if (item.equipped) { res.status(400).json({ error: 'Unequip item first' }); return }
      // Lock item to market
      await db.update(items).set({ location: 'market', equipped: false }).where(eq(items.id, resourceId))
      // Build equipSnapshot for marketplace display
      equipSnapshot = {
        name: item.name, tier: item.tier, slot: item.slot,
        category: item.category, stats: item.stats,
        durability: item.durability, weaponSubtype: item.weaponSubtype,
      }
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
      equipSnapshot: equipSnapshot,
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
      // Item transfer: change owner and reset location back to inventory
      await db.update(items).set({ ownerId: playerId, location: 'inventory', equipped: false }).where(eq(items.id, order.resourceId))
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

    // Unlock equipment items back to inventory
    if (order.resourceId && order.itemType === 'equipment') {
      await db.update(items).set({ location: 'inventory' }).where(eq(items.id, order.resourceId))
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

// ═══════════════════════════════════════════════
//  NPC MARKET MAKER — Server-side liquidity seeding
// ═══════════════════════════════════════════════

/** Base prices for NPC orders (mirrors frontend RESOURCE_DEFS) */
const NPC_RESOURCE_BASE_PRICES: Record<string, number> = {
  oil: 0.16,
  scrap: 0.22,
  materialX: 1.62,
  bitcoin: 85.00,
  bread: 1.81,
  sushi: 7.19,
  wagyu: 9.50,
  wheat: 0.08,
  fish: 3.44,
  steak: 3.50,
}
const NPC_SPREAD = 0.20  // ±20% from base price

let npcSeeded = false

async function seedNpcOrders(): Promise<{ seeded: number }> {
  // Check if NPC orders already exist
  const [existing] = await db.select({ count: sql<number>`count(*)` })
    .from(marketOrders)
    .where(and(
      eq(marketOrders.source, 'npc'),
      eq(marketOrders.status, 'open')
    ))
  if ((existing?.count ?? 0) > 0) {
    npcSeeded = true
    return { seeded: 0 }
  }

  const npcOrders: any[] = []
  for (const [resourceId, basePrice] of Object.entries(NPC_RESOURCE_BASE_PRICES)) {
    const buyPrice = +(basePrice * (1 - NPC_SPREAD)).toFixed(2)
    const sellPrice = +(basePrice * (1 + NPC_SPREAD)).toFixed(2)
    const buyQty = 500 + Math.floor(Math.random() * 500)
    const sellQty = 500 + Math.floor(Math.random() * 500)

    // NPC Buy order (bid)
    npcOrders.push({
      playerId: null,
      type: 'buy',
      itemType: 'resource',
      resourceId,
      amount: buyQty,
      filledAmount: 0,
      pricePerUnit: buyPrice.toString(),
      totalPrice: (buyQty * buyPrice).toFixed(2),
      source: 'npc',
      countryCode: 'NPC',
      status: 'open',
    })

    // NPC Sell order (ask)
    npcOrders.push({
      playerId: null,
      type: 'sell',
      itemType: 'resource',
      resourceId,
      amount: sellQty,
      filledAmount: 0,
      pricePerUnit: sellPrice.toString(),
      totalPrice: (sellQty * sellPrice).toFixed(2),
      source: 'npc',
      countryCode: 'NPC',
      status: 'open',
    })
  }

  if (npcOrders.length > 0) {
    await db.insert(marketOrders).values(npcOrders)
  }

  npcSeeded = true
  console.log(`[MARKET] Seeded ${npcOrders.length} NPC orders for ${Object.keys(NPC_RESOURCE_BASE_PRICES).length} resources`)
  return { seeded: npcOrders.length }
}

// Auto-seed on first listings request
const originalListingsHandler = router.stack?.find((l: any) => l.route?.path === '/listings')
if (!originalListingsHandler) {
  // Add a middleware that auto-seeds NPC orders on first GET /listings
  router.use('/listings', async (_req, _res, next) => {
    if (!npcSeeded) {
      try { await seedNpcOrders() } catch (e) { console.error('[MARKET] NPC auto-seed failed:', e) }
    }
    next()
  })
}

// ═══════════════════════════════════════════════
//  POST /api/market/seed-npc — Admin: force re-seed NPC orders
// ═══════════════════════════════════════════════

router.post('/seed-npc', requireAuth as any, async (req, res) => {
  try {
    // Clear existing NPC orders first
    await db.delete(marketOrders).where(eq(marketOrders.source, 'npc'))
    npcSeeded = false
    const result = await seedNpcOrders()
    res.json({ success: true, ...result, message: `Re-seeded ${result.seeded} NPC orders` })
  } catch (err) {
    console.error('[MARKET] NPC seed error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

