// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Resource Order Book & Matching Engine
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useWorldStore } from '../worldStore'
import type { MarketState, ResourceId, MarketOrder, TradeRecord } from './types'
import { RESOURCE_DEFS, TAX_RATE, ORDER_EXPIRY_MS } from './types'
import { mkId, getPlayerResource, adjustPlayerResource, round2 } from './helpers'
import { useArmyStore } from '../army'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── Safety caps ──
const MAX_ORDER_AMOUNT = 100_000     // max units per single order
const MAX_PRICE_MULTIPLIER = 100     // max pricePerUnit = basePrice × 100

// ── Place Resource Order ──
export function placeResourceOrder(
  set: Set, get: Get,
  type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number
): { success: boolean; message: string } {
  if (amount <= 0 || pricePerUnit <= 0)
    return { success: false, message: 'Invalid amount or price' }

  const def = RESOURCE_DEFS.find(r => r.id === resourceId)
  if (!def) return { success: false, message: 'Unknown resource' }

  // M3: Amount cap
  if (amount > MAX_ORDER_AMOUNT)
    return { success: false, message: `Max ${MAX_ORDER_AMOUNT.toLocaleString()} units per order` }

  // M2: Price cap
  const maxPrice = round2(def.basePrice * MAX_PRICE_MULTIPLIER)
  if (pricePerUnit > maxPrice)
    return { success: false, message: `Max price for ${def.name}: $${maxPrice.toLocaleString()} (${MAX_PRICE_MULTIPLIER}× base)` }

  const player = usePlayerStore.getState()
  const totalPrice = round2(amount * pricePerUnit)

  if (type === 'buy') {
    if (player.money < totalPrice)
      return { success: false, message: `Need $${totalPrice.toFixed(2)}, have $${player.money.toFixed(2)}` }
    if (!usePlayerStore.getState().spendMoney(totalPrice))
      return { success: false, message: 'Transaction failed' }
  } else {
    const owned = getPlayerResource(def)
    if (owned < amount)
      return { success: false, message: `Need ${amount} ${def.name}, have ${owned}` }
    adjustPlayerResource(def, -amount)
  }

  const order: MarketOrder = {
    id: mkId('ord'), type, itemType: 'resource', resourceId,
    amount, pricePerUnit, totalPrice,
    playerId: player.name, countryCode: player.countryCode || 'US',
    source: 'player', createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
  }

  set(s => ({ orders: [...s.orders, order] }))
  matchResourceOrders(set, get, resourceId)

  return { success: true, message: `${type.toUpperCase()} order placed: ${amount}× ${def.name} @ $${pricePerUnit.toFixed(2)}` }
}

// ── Matching Engine ──
export function matchResourceOrders(set: Set, get: Get, resourceId: ResourceId): void {
  const state = get()
  const buys = state.orders
    .filter(o => o.resourceId === resourceId && o.type === 'buy' && o.status === 'open' && o.itemType === 'resource')
    .sort((a, b) => b.pricePerUnit - a.pricePerUnit) // highest buy first

  const sells = state.orders
    .filter(o => o.resourceId === resourceId && o.type === 'sell' && o.status === 'open' && o.itemType === 'resource')
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit) // cheapest sell first

  if (buys.length === 0 || sells.length === 0) return

  const updatedOrders = [...state.orders]
  const newTrades: TradeRecord[] = []

  for (const buyOrder of buys) {
    let buyRemaining = buyOrder.amount - buyOrder.filledAmount
    if (buyRemaining <= 0) continue

    for (const sellOrder of sells) {
      if (sellOrder.pricePerUnit > buyOrder.pricePerUnit) break
      let sellRemaining = sellOrder.amount - sellOrder.filledAmount
      if (sellRemaining <= 0) continue

      // H2: Self-trade guard — skip if same player (unless one is country source)
      if (
        buyOrder.playerId === sellOrder.playerId &&
        buyOrder.source === 'player' && sellOrder.source === 'player'
      ) continue

      const matchPrice = sellOrder.pricePerUnit
      const matchAmount = Math.min(buyRemaining, sellRemaining)
      const matchTotal = round2(matchAmount * matchPrice)
      const tax = Math.round(matchTotal * TAX_RATE)

      // Buyer locked at their buy price — refund excess
      const buyerLocked = matchAmount * buyOrder.pricePerUnit
      const excess = round2(buyerLocked - matchTotal)

      // Deliver resources to buyer
      const def = RESOURCE_DEFS.find(r => r.id === resourceId)!
      if (buyOrder.source === 'country' && def.fundKey) {
        useWorldStore.getState().addToFund(buyOrder.countryCode, def.fundKey, matchAmount)
      } else if (buyOrder.source === 'force_vault' && buyOrder.armyId) {
        // Deliver to army vault (only oil is storable)
        const vaultKey = resourceId === 'oil' ? 'oil' : null
        if (vaultKey) {
          useArmyStore.setState(s => {
            const army = s.armies[buyOrder.armyId!]
            if (!army) return s
            return { armies: { ...s.armies, [buyOrder.armyId!]: {
              ...army, vault: { ...army.vault, [vaultKey]: army.vault[vaultKey] + matchAmount },
            }}}
          })
        } else {
          // Non-storable resource → credit to the ordering player directly
          adjustPlayerResource(def, matchAmount)
        }
      } else {
        adjustPlayerResource(def, matchAmount)
      }

      // Refund buyer excess
      if (excess > 0) {
        if (buyOrder.source === 'country') {
          useWorldStore.getState().addTreasuryTax(buyOrder.countryCode, excess)
        } else if (buyOrder.source === 'force_vault' && buyOrder.armyId) {
          useArmyStore.setState(s => {
            const army = s.armies[buyOrder.armyId!]
            if (!army) return s
            return { armies: { ...s.armies, [buyOrder.armyId!]: {
              ...army, vault: { ...army.vault, money: army.vault.money + excess },
            }}}
          })
        } else {
          usePlayerStore.getState().earnMoney(excess)
        }
      }

      // Pay seller (minus tax)
      const sellerGets = matchTotal - tax
      if (sellOrder.source === 'country') {
        useWorldStore.getState().addTreasuryTax(sellOrder.countryCode, sellerGets)
      } else if (sellOrder.source === 'force_vault' && sellOrder.armyId) {
        useArmyStore.setState(s => {
          const army = s.armies[sellOrder.armyId!]
          if (!army) return s
          return { armies: { ...s.armies, [sellOrder.armyId!]: {
            ...army, vault: { ...army.vault, money: army.vault.money + sellerGets },
          }}}
        })
      } else {
        usePlayerStore.getState().earnMoney(sellerGets)
      }

      // Tax to buyer's country fund
      useWorldStore.getState().addTreasuryTax(buyOrder.countryCode, tax)

      // Update fill amounts
      const buyIdx = updatedOrders.findIndex(o => o.id === buyOrder.id)
      const sellIdx = updatedOrders.findIndex(o => o.id === sellOrder.id)
      if (buyIdx >= 0) {
        updatedOrders[buyIdx] = {
          ...updatedOrders[buyIdx],
          filledAmount: updatedOrders[buyIdx].filledAmount + matchAmount,
          status: updatedOrders[buyIdx].filledAmount + matchAmount >= buyOrder.amount ? 'filled' : 'partial',
        }
      }
      if (sellIdx >= 0) {
        updatedOrders[sellIdx] = {
          ...updatedOrders[sellIdx],
          filledAmount: updatedOrders[sellIdx].filledAmount + matchAmount,
          status: updatedOrders[sellIdx].filledAmount + matchAmount >= sellOrder.amount ? 'filled' : 'partial',
        }
      }

      buyOrder.filledAmount += matchAmount
      sellOrder.filledAmount += matchAmount

      newTrades.push({
        id: mkId('tr'), buyOrderId: buyOrder.id, sellOrderId: sellOrder.id,
        itemType: 'resource', resourceId,
        amount: matchAmount, pricePerUnit: matchPrice, totalPrice: matchTotal,
        tax, buyer: buyOrder.playerId, seller: sellOrder.playerId,
        buyerCountry: buyOrder.countryCode, sellerCountry: sellOrder.countryCode,
        timestamp: Date.now(),
      })

      // Update ticker
      const tickers = { ...get().tickers }
      const ticker = tickers[resourceId]
      if (ticker) {
        const oldPrice = ticker.priceHistory[0] || ticker.price
        tickers[resourceId] = {
          ...ticker,
          price: matchPrice,
          volume: ticker.volume + matchAmount,
          change24h: +((matchPrice / oldPrice - 1) * 100).toFixed(1),
          high24h: Math.max(ticker.high24h, matchPrice),
          low24h: Math.min(ticker.low24h, matchPrice),
          priceHistory: [...ticker.priceHistory.slice(1), matchPrice],
          recentBuyVolume: ticker.recentBuyVolume + matchAmount,
          recentSellVolume: ticker.recentSellVolume + matchAmount, // H3: Fixed — was missing
        }
        set({ tickers })
      }

      buyRemaining -= matchAmount
      if (buyRemaining <= 0) break
    }
  }

  if (newTrades.length > 0) {
    set({
      orders: updatedOrders,
      trades: [...newTrades, ...get().trades].slice(0, 200),
    })
  }
}
