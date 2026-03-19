// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Division Marketplace
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useArmyStore } from '../armyStore'
import { useWorldStore } from '../worldStore'
import type { MarketState, MarketOrder, TradeRecord } from './types'
import { TAX_RATE, LISTING_FEE_RATE, ORDER_EXPIRY_MS } from './types'
import { mkId } from './helpers'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── Max divisions a player can own (soft cap) ──
const MAX_PLAYER_DIVISIONS = 20

// ── List Division for Sale ──
export function placeDivisionSellOrder(
  set: Set, get: Get,
  divisionId: string, price: number
): { success: boolean; message: string } {
  if (price < 1_000) return { success: false, message: 'Minimum price $1,000' }
  if (price > 10_000_000) return { success: false, message: 'Maximum price $10,000,000' }

  const armyStore = useArmyStore.getState()
  const player = usePlayerStore.getState()
  const div = armyStore.divisions[divisionId]
  if (!div) return { success: false, message: 'Division not found' }
  if (div.ownerId !== player.name) return { success: false, message: 'Not your division' }
  if (div.status === 'in_combat') return { success: false, message: 'Cannot sell divs in combat' }
  if (div.status === 'destroyed') return { success: false, message: 'Cannot sell destroyed divs' }
  if (get().orders.some(o => o.divisionId === divisionId && o.status === 'open'))
    return { success: false, message: 'Division already listed' }

  // 2% listing fee (non-refundable) → country fund
  const listingFee = Math.ceil(price * LISTING_FEE_RATE)
  if (player.money < listingFee)
    return { success: false, message: `Listing fee: $${listingFee.toLocaleString()} (2%) — insufficient funds` }

  usePlayerStore.setState(s => ({ money: s.money - listingFee }))
  const countryCode = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(countryCode, listingFee)

  // Lock division (set status to 'listed')
  useArmyStore.setState(s => ({
    divisions: { ...s.divisions, [divisionId]: { ...s.divisions[divisionId], status: 'listed' as any } }
  }))

  const divLevel = Math.floor((div.experience || 0) / 10)
  const order: MarketOrder = {
    id: mkId('divord'), type: 'sell', itemType: 'division',
    divisionId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode,
    source: 'player', createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    divSnapshot: {
      name: div.name, type: div.type, level: divLevel,
      stars: div.starQuality || 1,
      health: div.health, maxHealth: div.maxHealth,
      manpower: div.manpower, maxManpower: div.maxManpower,
    },
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Listed ${div.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ── Buy Division (instant fill) ──
export function buyDivision(
  set: Set, get: Get,
  orderId: string
): { success: boolean; message: string } {
  const order = get().orders.find(o => o.id === orderId && o.itemType === 'division' && o.status === 'open')
  if (!order || !order.divisionId) return { success: false, message: 'Listing not found' }

  const player = usePlayerStore.getState()
  if (order.playerId === player.name) return { success: false, message: 'Cannot buy your own division' }
  if (player.money < order.totalPrice) return { success: false, message: 'Not enough money' }

  const armyStore = useArmyStore.getState()
  const div = armyStore.divisions[order.divisionId]
  if (!div) return { success: false, message: 'Division no longer exists' }

  // Soft cap check: count buyer's current divisions
  const buyerDivCount = Object.values(armyStore.divisions).filter(
    d => d.ownerId === player.name && d.status !== 'destroyed'
  ).length
  if (buyerDivCount >= MAX_PLAYER_DIVISIONS) {
    return { success: false, message: `Division cap reached (${buyerDivCount}/${MAX_PLAYER_DIVISIONS}). Dismiss or sell divisions first.` }
  }

  // Deduct buyer money
  usePlayerStore.setState(s => ({ money: s.money - order.totalPrice }))

  // Tax
  const tax = Math.round(order.totalPrice * TAX_RATE)
  const sellerGets = order.totalPrice - tax

  // Credit seller
  usePlayerStore.setState(s => ({ money: s.money + sellerGets }))

  // Transfer ownership directly via setState — clear equipment, set new owner
  useArmyStore.setState(s => ({
    divisions: { ...s.divisions, [order.divisionId!]: {
      ...s.divisions[order.divisionId!],
      ownerId: player.name,
      countryCode: player.countryCode || 'US',
      status: 'ready' as any,
      equipment: [],  // Equipment cleared — buyer gets a clean division
    }}
  }))

  // Tax to buyer's country
  const buyerCountry = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(buyerCountry, tax)

  // Record trade
  const trade: TradeRecord = {
    id: mkId('tr'), buyOrderId: 'instant', sellOrderId: orderId,
    itemType: 'division', divisionId: order.divisionId,
    amount: 1, pricePerUnit: order.totalPrice, totalPrice: order.totalPrice,
    tax, buyer: player.name, seller: order.playerId,
    buyerCountry, sellerCountry: order.countryCode,
    timestamp: Date.now(),
  }

  set(s => ({
    orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'filled' as const, filledAmount: 1 } : o),
    trades: [trade, ...s.trades].slice(0, 200),
  }))

  return { success: true, message: `Bought ${order.divSnapshot?.name} for $${order.totalPrice.toLocaleString()}!` }
}
