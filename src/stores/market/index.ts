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
import { useMissionStore } from '../missionStore'
import { api } from '../../api/client'
import {
  type MarketState, type ResourceId, type MarketOrder,
  RESOURCE_DEFS, STALE_CLEANUP_AGE_MS,
} from './types'
import { mkTicker, mkId } from './helpers'

// Slice functions
// NOTE: placeResourceOrder & matchResourceOrders from ./resourceMarket are DEPRECATED
// (overridden below to use backend API). Import removed to avoid confusion.
import { placeEquipmentSellOrder, buyEquipment, placeVaultEquipmentSellOrder, buyEquipmentToVault } from './equipmentMarket'
import { placeDivisionSellOrder, placeVaultDivisionSellOrder, placeCountryDivisionSellOrder, buyDivision } from './divisionMarket'
import { tickPrices } from './priceTicker'
import { placeCountryOrder, placeForceVaultOrder } from './countryTrading'

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
    } else if (order.source === 'force_vault' && order.armyId) {
      // Only commander/colonel of the army can cancel vault orders
      const army = useArmyStore.getState().armies[order.armyId]
      if (!army) return { success: false, message: 'Army not found' }
      const member = army.members.find(m => m.playerId === player.name)
      const isCommander = army.commanderId === player.name
      const hasControl = isCommander || (member && ['colonel', 'general'].includes(member.role))
      if (!hasControl) return { success: false, message: 'Only Commander/Colonel can cancel vault orders' }
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
        } else if (order.source === 'force_vault' && order.armyId) {
          useArmyStore.setState(s => {
            const army = s.armies[order.armyId!]
            if (!army) return s
            return { armies: { ...s.armies, [order.armyId!]: {
              ...army, vault: { ...army.vault, money: army.vault.money + refund },
            }}}
          })
        } else {
          usePlayerStore.getState().earnMoney(refund)
        }
      } else {
        if (order.source === 'country' && def.fundKey) {
          useWorldStore.getState().addToFund(order.countryCode, def.fundKey, remaining)
        } else if (order.source === 'force_vault' && order.armyId) {
          const vaultKey = order.resourceId === 'oil' ? 'oil' : order.resourceId === 'materialX' ? 'materialX' : null
          if (vaultKey) {
            useArmyStore.setState(s => {
              const army = s.armies[order.armyId!]
              if (!army) return s
              return { armies: { ...s.armies, [order.armyId!]: {
                ...army, vault: { ...army.vault, [vaultKey]: (army.vault as any)[vaultKey] + remaining },
              }}}
            })
          }
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

    fetchListings: async () => {
      try {
        const res: any = await api.get('/market/listings')
        if (res.success) set({ orders: res.listings })
      } catch (err) { console.error('Market fetchListings err:', err) }
    },

    fetchMyOrders: async () => {
      try {
        const res: any = await api.get('/market/my-orders')
        if (res.success) {
          set(s => {
            const openOrders = s.orders.filter(o => o.playerId !== usePlayerStore.getState().name)
            return { orders: [...openOrders, ...res.orders] }
          })
        }
      } catch (e) { console.error(e) }
    },

    // Resource trading
    placeResourceOrder: async (type, resourceId, amount, pricePerUnit) => {
      if (type === 'sell') {
        try {
          const res: any = await api.post('/market/sell', { itemType: resourceId, amount, pricePerUnit })
          useMissionStore.getState().trackMarket()
          return { success: true, message: res.message }
        } catch (e: any) { return { success: false, message: e.message } }
      } else {
        // Auto-match buys with existing asks from the API
        const asks = get().orders.filter(o => o.itemType === 'resource' && o.resourceId === resourceId && o.type === 'sell' && o.pricePerUnit <= pricePerUnit).sort((a,b) => a.pricePerUnit - b.pricePerUnit)
        let remaining = amount
        let filled = 0
        for (const ask of asks) {
          if (remaining <= 0) break
          const available = ask.amount - ask.filledAmount
          const buyAmt = Math.min(available, remaining)
          try {
            const res: any = await api.post('/market/buy', { orderId: ask.id, amount: buyAmt })
            if (res.success) { remaining -= buyAmt; filled += buyAmt }
          } catch (e) { break }
        }
        if (filled > 0) {
          useMissionStore.getState().trackMarket()
          return { success: true, message: `Bought ${filled} ${resourceId}` }
        }
        return { success: false, message: 'No matching sellers found at that price.' }
      }
    },
    matchResourceOrders: (_resourceId) => {}, // DEPRECATED: matching is server-side via market.routes.ts

    // Equipment
    placeEquipmentSellOrder: async (equipItemId, price) => {
      try {
        const res: any = await api.post('/market/sell', { itemType: 'equipment', resourceId: equipItemId, amount: 1, pricePerUnit: price })
        return { success: true, message: res.message }
      } catch (e: any) { return { success: false, message: e.message } }
    },
    buyEquipment: async (orderId) => {
      try {
        const res: any = await api.post('/market/buy', { orderId })
        useMissionStore.getState().trackMarket()
        return { success: true, message: res.message }
      } catch (e: any) { return { success: false, message: e.message } }
    },
    placeVaultEquipmentSellOrder: async (armyId, equipItemId, price) => placeVaultEquipmentSellOrder(set, get, armyId, equipItemId, price),
    buyEquipmentToVault: async (armyId, orderId) => buyEquipmentToVault(set, get, armyId, orderId),

    // Divisions
    placeDivisionSellOrder: async (divisionId, price) => {
      try {
        const res: any = await api.post('/market/sell', { itemType: 'division', resourceId: divisionId, amount: 1, pricePerUnit: price })
        return { success: true, message: res.message }
      } catch (e: any) { return { success: false, message: e.message } }
    },
    placeVaultDivisionSellOrder: async (armyId, divisionId, price) => placeVaultDivisionSellOrder(set, get, armyId, divisionId, price),
    placeCountryDivisionSellOrder: async (countryCode, divisionId, price) => placeCountryDivisionSellOrder(set, get, countryCode, divisionId, price),
    buyDivision: async (orderId) => {
      try {
        const res: any = await api.post('/market/buy', { orderId })
        useMissionStore.getState().trackMarket()
        return { success: true, message: res.message }
      } catch (e: any) { return { success: false, message: e.message } }
    },

    // Force vault fund
    placeForceVaultOrder: async (armyId, type, resourceId, amount, pricePerUnit) => placeForceVaultOrder(set, get, armyId, type, resourceId, amount, pricePerUnit),

    // Country fund
    placeCountryOrder: async (type, resourceId, amount, pricePerUnit) => placeCountryOrder(set, get, type, resourceId, amount, pricePerUnit),

    // Cancel (any type)
    cancelOrder: async (orderId) => {
      try {
        const res: any = await api.post('/market/cancel', { orderId })
        return { success: true, message: res.message }
      } catch (e: any) { return { success: false, message: e.message } }
    },

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
