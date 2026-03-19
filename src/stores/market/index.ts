// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Barrel Export (single useMarketStore)
// ══════════════════════════════════════════════════════════════════
//
// Composes all market slices into one Zustand store and re-exports
// every type / constant so consumers only need:
//   import { useMarketStore, RESOURCE_DEFS, ... } from '../stores/market'
//

import { create } from 'zustand'
import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useInventoryStore } from '../inventoryStore'
import { useArmyStore } from '../army'
import { useWorldStore } from '../worldStore'
import { useGovernmentStore } from '../governmentStore'
import {
  type MarketState, type ResourceId, type MarketOrder,
  RESOURCE_DEFS, STALE_CLEANUP_AGE_MS,
} from './types'
import { mkTicker, mkId } from './helpers'

// Slice functions
import { placeResourceOrder, matchResourceOrders } from './resourceMarket'
import { placeEquipmentSellOrder, buyEquipment } from './equipmentMarket'
import { placeDivisionSellOrder, buyDivision } from './divisionMarket'
import { tickPrices } from './priceTicker'
import { placeCountryOrder } from './countryTrading'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── Cancel Order (handles all item types) ──
// `isSystem` bypasses ownership check (used by expiry)
function cancelOrderFn(
  set: Set, get: Get, orderId: string, isSystem = false
): { success: boolean; message: string } {
  const order = get().orders.find(o => o.id === orderId && (o.status === 'open' || o.status === 'partial'))
  if (!order) return { success: false, message: 'Order not found or already filled' }

  if (!isSystem) {
    const player = usePlayerStore.getState()

    if (order.source === 'country') {
      // M4: Only president of that country can cancel country orders
      const gov = useGovernmentStore.getState().governments[order.countryCode]
      if (!gov || gov.president !== player.name)
        return { success: false, message: 'Only the president can cancel country orders' }
    } else if (order.playerId !== player.name) {
      return { success: false, message: 'Not your order' }
    }
  }

  // Refund locked assets
  if (order.itemType === 'resource') {
    const def = RESOURCE_DEFS.find(r => r.id === order.resourceId)
    if (def) {
      const remaining = order.amount - order.filledAmount
      if (order.type === 'buy') {
        const refund = remaining * order.pricePerUnit
        if (order.source === 'country') {
          useWorldStore.getState().addTreasuryTax(order.countryCode, refund)
        } else {
          usePlayerStore.setState(s => ({ money: s.money + refund }))
        }
      } else {
        if (order.source === 'country' && def.fundKey) {
          useWorldStore.getState().addToFund(order.countryCode, def.fundKey, remaining)
        } else {
          usePlayerStore.setState(s => ({
            [def.playerKey]: ((s as unknown as Record<string, number>)[def.playerKey] ?? 0) + remaining,
          } as any))
        }
      }
    }
  } else if (order.itemType === 'equipment' && order.equipItemId) {
    // Return equipment to inventory (set location back, listing fee NOT refunded)
    useInventoryStore.setState(s => ({
      items: s.items.map(i => i.id === order.equipItemId ? {
        ...i, location: 'inventory' as const, equipped: false,
      } : i)
    }))
  } else if (order.itemType === 'division' && order.divisionId) {
    // Unlock division
    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, [order.divisionId!]: {
        ...s.divisions[order.divisionId!], status: 'ready' as any,
      }}
    }))
  }

  set(s => ({
    orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' as const } : o),
  }))

  return { success: true, message: 'Order cancelled' }
}

// ── Expire old orders (returns items/resources to owners) ──
// M1: Uses isSystem=true to bypass ownership check
function expireOldOrdersFn(set: Set, get: Get): void {
  const now = Date.now()
  const expirable = get().orders.filter(o =>
    (o.status === 'open' || o.status === 'partial') && now >= o.expiresAt
  )

  for (const order of expirable) {
    cancelOrderFn(set, get, order.id, true) // system call — bypass ownership check
    // Override status to 'expired' instead of 'cancelled'
    set(s => ({
      orders: s.orders.map(o => o.id === order.id ? { ...o, status: 'expired' as const } : o),
    }))
  }
}

// ── Cleanup stale orders (remove old filled/cancelled/expired from array) ──
function cleanupStaleOrdersFn(set: Set, get: Get): void {
  const now = Date.now()
  set(s => ({
    orders: s.orders.filter(o => {
      if (o.status === 'open' || o.status === 'partial') return true
      return (now - o.createdAt) < STALE_CLEANUP_AGE_MS
    }),
  }))
}

// ══════════════════════════════════════════════════════════════════
// COMPOSED STORE
// ══════════════════════════════════════════════════════════════════

export const useMarketStore = create<MarketState>((set, get) => {
  // Build initial tickers
  const initTickers: Record<string, MarketState['tickers'][ResourceId]> = {}
  RESOURCE_DEFS.forEach(r => { initTickers[r.id] = mkTicker(r.id, r.basePrice) })

  return {
    tickers: initTickers as MarketState['tickers'],
    orders: [],
    trades: [],

    // Resource trading
    placeResourceOrder: (type, resourceId, amount, pricePerUnit) =>
      placeResourceOrder(set, get, type, resourceId, amount, pricePerUnit),
    matchResourceOrders: (resourceId) =>
      matchResourceOrders(set, get, resourceId),

    // Equipment
    placeEquipmentSellOrder: (equipItemId, price) =>
      placeEquipmentSellOrder(set, get, equipItemId, price),
    buyEquipment: (orderId) =>
      buyEquipment(set, get, orderId),

    // Divisions
    placeDivisionSellOrder: (divisionId, price) =>
      placeDivisionSellOrder(set, get, divisionId, price),
    buyDivision: (orderId) =>
      buyDivision(set, get, orderId),

    // Country fund
    placeCountryOrder: (type, resourceId, amount, pricePerUnit) =>
      placeCountryOrder(set, get, type, resourceId, amount, pricePerUnit),

    // Cancel (any type)
    cancelOrder: (orderId) =>
      cancelOrderFn(set, get, orderId),

    // Maintenance
    tickPrices: () => tickPrices(set, get),
    cleanupStaleOrders: () => cleanupStaleOrdersFn(set, get),
    expireOldOrders: () => expireOldOrdersFn(set, get),

    // Queries
    getOrderBook: (resourceId) => {
      const orders = get().orders.filter(o =>
        o.resourceId === resourceId &&
        (o.status === 'open' || o.status === 'partial') &&
        o.itemType === 'resource'
      )
      return {
        buys: orders.filter(o => o.type === 'buy').sort((a, b) => b.pricePerUnit - a.pricePerUnit),
        sells: orders.filter(o => o.type === 'sell').sort((a, b) => a.pricePerUnit - b.pricePerUnit),
      }
    },

    getEquipmentListings: () =>
      get().orders.filter(o => o.itemType === 'equipment' && o.status === 'open' && o.type === 'sell'),

    getDivisionListings: () =>
      get().orders.filter(o => o.itemType === 'division' && o.status === 'open' && o.type === 'sell'),

    getMyOrders: () => {
      const player = usePlayerStore.getState()
      return get().orders.filter(o =>
        o.playerId === player.name && (o.status === 'open' || o.status === 'partial')
      )
    },

    getRecentTrades: (limit = 20) =>
      get().trades.slice(0, limit),
  }
})

// ── Re-export everything for backward compatibility ──
export type {
  ResourceId, ResourceDef, MarketTicker,
  OrderItemType, OrderSource, MarketOrder, TradeRecord,
  MarketState,
} from './types'

export {
  RESOURCE_DEFS, RESOURCE_BY_KEY,
  TAX_RATE, LISTING_FEE_RATE, ORDER_EXPIRY_MS,
  MIN_EQUIP_PRICE, MAX_TRADES_HISTORY,
} from './types'
