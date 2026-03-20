// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Division Marketplace
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useArmyStore } from '../army'
import { useWorldStore } from '../worldStore'
import { useGovernmentStore } from '../governmentStore'
import type { MarketState, MarketOrder, TradeRecord } from './types'
import { TAX_RATE, LISTING_FEE_RATE, ORDER_EXPIRY_MS } from './types'
import { mkId } from './helpers'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── Max divisions a player can own (soft cap) ──
const MAX_PLAYER_DIVISIONS = 20

// ── Vault control ranks ──
const VAULT_CONTROL_RANKS = ['colonel', 'general']

// ── Snapshot helper ──
function divisionSnapshot(div: any) {
  return {
    name: div.name, type: div.type,
    level: Math.floor((div.experience || 0) / 10),
    stars: div.starQuality || 1,
    health: div.health, maxHealth: div.maxHealth,
    manpower: div.manpower, maxManpower: div.maxManpower,
  }
}

// ══════════════════════════════════════════════════════════════════
// PLAYER Sell — player lists their own division
// ══════════════════════════════════════════════════════════════════
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
  if (!usePlayerStore.getState().spendMoney(listingFee)) 
    return { success: false, message: `Listing fee: $${listingFee.toLocaleString()} (2%) — insufficient funds` }
  const countryCode = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(countryCode, listingFee)

  // Lock division (set status to 'listed')
  useArmyStore.setState(s => ({
    divisions: { ...s.divisions, [divisionId]: { ...s.divisions[divisionId], status: 'listed' as any } }
  }))

  const order: MarketOrder = {
    id: mkId('divord'), type: 'sell', itemType: 'division',
    divisionId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode,
    source: 'player', divisionSource: 'player',
    createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    divSnapshot: divisionSnapshot(div),
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Listed ${div.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ══════════════════════════════════════════════════════════════════
// FORCE VAULT Sell — commander/colonel lists army's division
// ══════════════════════════════════════════════════════════════════
export function placeVaultDivisionSellOrder(
  set: Set, get: Get,
  armyId: string, divisionId: string, price: number
): { success: boolean; message: string } {
  if (price < 1_000) return { success: false, message: 'Minimum price $1,000' }
  if (price > 10_000_000) return { success: false, message: 'Maximum price $10,000,000' }

  const armyStore = useArmyStore.getState()
  const player = usePlayerStore.getState()
  const army = armyStore.armies[armyId]
  if (!army) return { success: false, message: 'Army not found' }

  // Rank check — only Commander/Colonel
  const member = army.members.find(m => m.playerId === player.name)
  const isCommander = army.commanderId === player.name
  const hasControl = isCommander || (member && VAULT_CONTROL_RANKS.includes(member.role))
  if (!hasControl)
    return { success: false, message: 'Only Commander/Colonel can list army divisions' }

  // Division must belong to this army
  if (!army.divisionIds.includes(divisionId))
    return { success: false, message: 'Division is not in this army' }

  const div = armyStore.divisions[divisionId]
  if (!div) return { success: false, message: 'Division not found' }
  if (div.status === 'in_combat') return { success: false, message: 'Cannot sell divs in combat' }
  if (div.status === 'destroyed') return { success: false, message: 'Cannot sell destroyed divs' }
  if (get().orders.some(o => o.divisionId === divisionId && o.status === 'open'))
    return { success: false, message: 'Division already listed' }

  // 2% listing fee from army vault (non-refundable) → country fund
  const listingFee = Math.ceil(price * LISTING_FEE_RATE)
  if (army.vault.money < listingFee)
    return { success: false, message: `Vault listing fee: $${listingFee.toLocaleString()} (2%) — insufficient vault funds` }
  useArmyStore.setState(s => ({
    armies: { ...s.armies, [armyId]: {
      ...s.armies[armyId],
      vault: { ...s.armies[armyId].vault, money: s.armies[armyId].vault.money - listingFee },
    }},
  }))
  useWorldStore.getState().addTreasuryTax(army.countryCode, listingFee)

  // Lock division
  useArmyStore.setState(s => ({
    divisions: { ...s.divisions, [divisionId]: { ...s.divisions[divisionId], status: 'listed' as any } }
  }))

  const order: MarketOrder = {
    id: mkId('vdivord'), type: 'sell', itemType: 'division',
    divisionId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode: army.countryCode,
    source: 'force_vault', armyId, divisionSource: 'force_vault',
    createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    divSnapshot: divisionSnapshot(div),
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Army listed ${div.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ══════════════════════════════════════════════════════════════════
// COUNTRY Sell — president lists a country-owned division
// ══════════════════════════════════════════════════════════════════
export function placeCountryDivisionSellOrder(
  set: Set, get: Get,
  countryCode: string, divisionId: string, price: number
): { success: boolean; message: string } {
  if (price < 1_000) return { success: false, message: 'Minimum price $1,000' }
  if (price > 10_000_000) return { success: false, message: 'Maximum price $10,000,000' }

  const player = usePlayerStore.getState()
  const gov = useGovernmentStore.getState().governments[countryCode]
  if (!gov || gov.president !== player.name)
    return { success: false, message: 'Only the president can list country divisions' }

  const armyStore = useArmyStore.getState()
  const div = armyStore.divisions[divisionId]
  if (!div) return { success: false, message: 'Division not found' }
  if (div.countryCode !== countryCode) return { success: false, message: 'Division does not belong to this country' }
  if (div.status === 'in_combat') return { success: false, message: 'Cannot sell divs in combat' }
  if (div.status === 'destroyed') return { success: false, message: 'Cannot sell destroyed divs' }
  if (get().orders.some(o => o.divisionId === divisionId && o.status === 'open'))
    return { success: false, message: 'Division already listed' }

  // 2% listing fee from national fund (non-refundable)
  const listingFee = Math.ceil(price * LISTING_FEE_RATE)
  const ws = useWorldStore.getState()
  const country = ws.getCountry(countryCode)
  if (!country || country.fund.money < listingFee)
    return { success: false, message: `National fund listing fee: $${listingFee.toLocaleString()} (2%) — insufficient` }
  ws.spendFromFund(countryCode, { money: listingFee })

  // Lock division
  useArmyStore.setState(s => ({
    divisions: { ...s.divisions, [divisionId]: { ...s.divisions[divisionId], status: 'listed' as any } }
  }))

  const order: MarketOrder = {
    id: mkId('cdivord'), type: 'sell', itemType: 'division',
    divisionId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode,
    source: 'country', divisionSource: 'country',
    createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    divSnapshot: divisionSnapshot(div),
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Country listed ${div.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ══════════════════════════════════════════════════════════════════
// BUY Division (instant fill — handles all sources)
// ══════════════════════════════════════════════════════════════════
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
  if (!usePlayerStore.getState().spendMoney(order.totalPrice))
    return { success: false, message: 'Not enough money' }

  // Tax
  const tax = Math.round(order.totalPrice * TAX_RATE)
  const sellerGets = order.totalPrice - tax

  // Credit seller based on source
  const divSource = order.divisionSource || order.source || 'player'
  if (divSource === 'force_vault' && order.armyId) {
    // Money goes to army vault
    useArmyStore.setState(s => {
      const army = s.armies[order.armyId!]
      if (!army) return s
      return { armies: { ...s.armies, [order.armyId!]: {
        ...army, vault: { ...army.vault, money: army.vault.money + sellerGets },
      }}}
    })
  } else if (divSource === 'country') {
    // Money goes to national fund
    useWorldStore.getState().addTreasuryTax(order.countryCode, sellerGets)
  } else {
    // Money goes to selling player
    usePlayerStore.getState().earnMoney(sellerGets)
  }

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

  // If division was in an army, remove it from that army
  const allArmies = useArmyStore.getState().armies
  Object.values(allArmies).forEach(army => {
    if (army.divisionIds.includes(order.divisionId!)) {
      useArmyStore.setState(s => ({
        armies: { ...s.armies, [army.id]: {
          ...s.armies[army.id],
          divisionIds: s.armies[army.id].divisionIds.filter(id => id !== order.divisionId),
        }},
      }))
    }
  })

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

