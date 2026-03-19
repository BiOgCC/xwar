// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Country Fund Trading (president-only)
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useWorldStore } from '../worldStore'
import { useGovernmentStore } from '../governmentStore'
import type { MarketState, ResourceId, MarketOrder } from './types'
import { RESOURCE_DEFS, ORDER_EXPIRY_MS } from './types'
import { mkId, round2 } from './helpers'
import { matchResourceOrders } from './resourceMarket'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

export function placeCountryOrder(
  set: Set, get: Get,
  type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number
): { success: boolean; message: string } {
  if (amount <= 0 || pricePerUnit <= 0)
    return { success: false, message: 'Invalid amount or price' }

  const def = RESOURCE_DEFS.find(r => r.id === resourceId)
  if (!def || !def.fundKey)
    return { success: false, message: 'Resource cannot be traded from country fund' }

  const player = usePlayerStore.getState()
  const countryCode = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[countryCode]
  if (!gov || gov.president !== player.name)
    return { success: false, message: 'Only the president can trade from the national fund' }

  const ws = useWorldStore.getState()
  const country = ws.getCountry(countryCode)
  if (!country) return { success: false, message: 'Country not found' }

  const totalPrice = round2(amount * pricePerUnit)

  if (type === 'buy') {
    if (country.fund.money < totalPrice)
      return { success: false, message: `National fund needs $${totalPrice.toFixed(2)}` }
    ws.spendFromFund(countryCode, { money: totalPrice })
  } else {
    const available = country.fund[def.fundKey]
    if (available < amount)
      return { success: false, message: `National fund has ${available} ${def.name}, need ${amount}` }
    ws.spendFromFund(countryCode, { [def.fundKey]: amount })
  }

  const order: MarketOrder = {
    id: mkId('cntord'), type, itemType: 'resource', resourceId,
    amount, pricePerUnit, totalPrice,
    playerId: player.name, countryCode,
    source: 'country', createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
  }

  set(s => ({ orders: [...s.orders, order] }))
  matchResourceOrders(set, get, resourceId)

  return { success: true, message: `Country ${type.toUpperCase()}: ${amount}× ${def.name} @ $${pricePerUnit.toFixed(2)}` }
}
