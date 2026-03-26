// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — NPC Market Maker (seeds order book with liquidity)
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import type { MarketState, MarketOrder, ResourceId } from './types'
import { RESOURCE_DEFS, ORDER_EXPIRY_MS } from './types'
import { mkId } from './helpers'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

const NPC_PLAYER_ID = 'Market Maker'
const NPC_COUNTRY = 'NPC'
const SPREAD_PERCENT = 0.20  // ±20% around base price

/**
 * Seeds the order book with NPC buy and sell orders for all resources.
 * Creates a bid-ask spread around the base price for each resource.
 * NPC orders auto-replenish when called (old NPC orders are cleaned first).
 */
export function seedNpcOrders(set: Set, get: Get): void {
  const now = Date.now()
  const state = get()

  // Remove existing NPC orders first
  const nonNpcOrders = state.orders.filter(o => o.playerId !== NPC_PLAYER_ID)

  const npcOrders: MarketOrder[] = []

  for (const def of RESOURCE_DEFS) {
    const base = state.tickers[def.id]?.price || def.basePrice

    // NPC sell order: base + 20% (large quantity)
    const sellPrice = +(base * (1 + SPREAD_PERCENT)).toFixed(2)
    const sellAmount = 500 + Math.floor(Math.random() * 500) // 500-1000 units

    npcOrders.push({
      id: mkId('npc'),
      type: 'sell',
      itemType: 'resource',
      resourceId: def.id,
      amount: sellAmount,
      pricePerUnit: sellPrice,
      totalPrice: +(sellPrice * sellAmount).toFixed(2),
      playerId: NPC_PLAYER_ID,
      countryCode: NPC_COUNTRY,
      source: 'player',
      createdAt: now,
      expiresAt: now + ORDER_EXPIRY_MS,
      status: 'open',
      filledAmount: 0,
    })

    // NPC buy order: base - 20% (large quantity)
    const buyPrice = +(base * (1 - SPREAD_PERCENT)).toFixed(2)
    const buyAmount = 500 + Math.floor(Math.random() * 500)

    npcOrders.push({
      id: mkId('npc'),
      type: 'buy',
      itemType: 'resource',
      resourceId: def.id,
      amount: buyAmount,
      pricePerUnit: buyPrice,
      totalPrice: +(buyPrice * buyAmount).toFixed(2),
      playerId: NPC_PLAYER_ID,
      countryCode: NPC_COUNTRY,
      source: 'player',
      createdAt: now,
      expiresAt: now + ORDER_EXPIRY_MS,
      status: 'open',
      filledAmount: 0,
    })
  }

  set({ orders: [...nonNpcOrders, ...npcOrders] })
  console.log(`[Market] 🏦 Seeded ${npcOrders.length} NPC market maker orders (${RESOURCE_DEFS.length} resources × 2 sides)`)
}
