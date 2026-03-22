// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Equipment Marketplace
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useInventoryStore, type EquipItem } from '../inventoryStore'
import { useWorldStore } from '../worldStore'
import type { MarketState, MarketOrder, TradeRecord } from './types'
import { TAX_RATE, LISTING_FEE_RATE, ORDER_EXPIRY_MS, MIN_EQUIP_PRICE } from './types'
import { mkId } from './helpers'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── List Equipment for Sale ──
export function placeEquipmentSellOrder(
  set: Set, get: Get,
  equipItemId: string, price: number
): { success: boolean; message: string } {
  const inv = useInventoryStore.getState()
  const item = inv.items.find(i => i.id === equipItemId)
  if (!item) return { success: false, message: 'Item not found in inventory' }
  if (item.equipped) return { success: false, message: 'Unequip item first' }

  // Per-tier minimum price
  const minPrice = MIN_EQUIP_PRICE[item.tier] || 100
  if (price < minPrice) return { success: false, message: `Minimum price for ${item.tier.toUpperCase()}: $${minPrice.toLocaleString()}` }

  // Check not already listed
  if (get().orders.some(o => o.equipItemId === equipItemId && o.status === 'open'))
    return { success: false, message: 'Item already listed' }

  const player = usePlayerStore.getState()

  // 2% listing fee (non-refundable) → goes to country fund
  const listingFee = Math.ceil(price * LISTING_FEE_RATE)
  if (!usePlayerStore.getState().spendMoney(listingFee))
    return { success: false, message: `Listing fee: $${listingFee.toLocaleString()} (2%) — insufficient funds` }
  const countryCode = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(countryCode, listingFee)

  // Lock item in market (set location instead of removing)
  useInventoryStore.setState(s => ({
    items: s.items.map(i => i.id === equipItemId ? { ...i, location: 'market' as const, equipped: false } : i)
  }))

  const order: MarketOrder = {
    id: mkId('eqord'), type: 'sell', itemType: 'equipment',
    equipItemId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode,
    source: 'player', createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    equipSnapshot: {
      name: item.name, tier: item.tier, slot: item.slot,
      category: item.category, stats: { ...item.stats },
      durability: item.durability, weaponSubtype: item.weaponSubtype,
      superforged: item.superforged,
    },
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Listed ${item.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ── Buy Equipment (instant fill) ──
export function buyEquipment(
  set: Set, get: Get,
  orderId: string
): { success: boolean; message: string } {
  const order = get().orders.find(o => o.id === orderId && o.itemType === 'equipment' && o.status === 'open')
  if (!order) return { success: false, message: 'Listing not found' }

  const player = usePlayerStore.getState()
  if (order.playerId === player.name) return { success: false, message: 'Cannot buy your own item' }
  if (player.money < order.totalPrice) return { success: false, message: 'Not enough money' }

  // Deduct buyer money
  if (!usePlayerStore.getState().spendMoney(order.totalPrice))
    return { success: false, message: 'Not enough money' }

  // Tax (1% of sale price to buyer's country)
  const tax = Math.round(order.totalPrice * TAX_RATE)
  const sellerGets = order.totalPrice - tax

  // Credit seller
  usePlayerStore.getState().earnMoney(sellerGets)

  // Give item to buyer (update location back to inventory)
  if (order.equipItemId) {
    useInventoryStore.setState(s => ({
      items: s.items.map(i => i.id === order.equipItemId ? {
        ...i, location: 'inventory' as const, equipped: false,
      } : i)
    }))
  } else if (order.equipSnapshot) {
    // Fallback: create item from snapshot if original ID doesn't exist
    const newItem: EquipItem = {
      id: order.equipItemId || mkId('eq'), name: order.equipSnapshot.name,
      slot: order.equipSnapshot.slot as EquipItem['slot'],
      category: order.equipSnapshot.category as EquipItem['category'],
      tier: order.equipSnapshot.tier as EquipItem['tier'],
      equipped: false,
      durability: order.equipSnapshot.durability,
      stats: { ...order.equipSnapshot.stats } as EquipItem['stats'],
      weaponSubtype: order.equipSnapshot.weaponSubtype as EquipItem['weaponSubtype'],
      superforged: order.equipSnapshot.superforged,
      location: 'inventory',
    }
    useInventoryStore.getState().addItem(newItem)
  }

  // Tax to buyer's country
  const buyerCountry = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(buyerCountry, tax)

  // Record trade
  const trade: TradeRecord = {
    id: mkId('tr'), buyOrderId: 'instant', sellOrderId: orderId,
    itemType: 'equipment', equipItemId: order.equipItemId,
    amount: 1, pricePerUnit: order.totalPrice, totalPrice: order.totalPrice,
    tax, buyer: player.name, seller: order.playerId,
    buyerCountry, sellerCountry: order.countryCode,
    timestamp: Date.now(),
  }

  set(s => ({
    orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'filled' as const, filledAmount: 1 } : o),
    trades: [trade, ...s.trades].slice(0, 200),
  }))

  return { success: true, message: `Bought ${order.equipSnapshot?.name} for $${order.totalPrice.toLocaleString()}! (Tax: $${tax})` }
}
