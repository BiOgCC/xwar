import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useArmyStore } from './armyStore'
import { useInventoryStore, type EquipItem } from './inventoryStore'
import { useWorldStore, type NationalFundKey } from './worldStore'
import { useGovernmentStore } from './governmentStore'

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

/** Tradeable resource IDs that map to playerStore keys */
export type ResourceId =
  | 'oil' | 'scrap' | 'materialX' | 'bitcoin'
  | 'bread' | 'steak' | 'sushi' | 'fish' | 'wagyu' | 'wheat'
  | 'blueBullets' | 'greenBullets' | 'purpleBullets' | 'redBullets'
  | 'lootBoxes' | 'militaryBoxes'
  | 'staminaPills' | 'energyLeaves'

/** Resource metadata */
export interface ResourceDef {
  id: ResourceId
  name: string
  icon: string
  category: string
  playerKey: string        // key in playerStore
  fundKey?: NationalFundKey // if tradeable from/to country fund
  basePrice: number
}

export const RESOURCE_DEFS: ResourceDef[] = [
  // Construction
  { id: 'oil',       name: 'Oil',         icon: '🛢️', category: 'Construction', playerKey: 'oil',       fundKey: 'oil',       basePrice: 0.16 },
  { id: 'scrap',     name: 'Scrap',       icon: '🔩',  category: 'Construction', playerKey: 'scrap',     fundKey: 'scraps',    basePrice: 0.22 },
  { id: 'materialX', name: 'Material X',  icon: '⚛️', category: 'Construction', playerKey: 'materialX', fundKey: 'materialX', basePrice: 1.62 },
  { id: 'bitcoin',   name: 'Bitcoin',     icon: '₿',   category: 'Construction', playerKey: 'bitcoin',   fundKey: 'bitcoin',   basePrice: 85.00 },
  // Food
  { id: 'bread',  name: 'Bread',  icon: '🍞', category: 'Food', playerKey: 'bread',  basePrice: 1.81 },
  { id: 'steak',  name: 'Steak',  icon: '🥩', category: 'Food', playerKey: 'steak',  basePrice: 3.50 },
  { id: 'sushi',  name: 'Sushi',  icon: '🍣', category: 'Food', playerKey: 'sushi',  basePrice: 7.19 },
  { id: 'fish',   name: 'Fish',   icon: '🐟', category: 'Food', playerKey: 'fish',   basePrice: 3.44 },
  { id: 'wagyu',  name: 'Wagyu',  icon: '🥩', category: 'Food', playerKey: 'wagyu',  basePrice: 9.50 },
  { id: 'wheat',  name: 'Wheat',  icon: '🌾', category: 'Food', playerKey: 'wheat',  basePrice: 0.08 },
  // Ammo
  { id: 'blueBullets',   name: 'Blue Ammo',   icon: '🔵', category: 'Ammo', playerKey: 'blueBullets',   basePrice: 0.62 },
  { id: 'greenBullets',  name: 'Green Ammo',  icon: '🟢', category: 'Ammo', playerKey: 'greenBullets',  basePrice: 0.17 },
  { id: 'purpleBullets', name: 'Purple Ammo', icon: '🟣', category: 'Ammo', playerKey: 'purpleBullets', basePrice: 2.51 },
  { id: 'redBullets',    name: 'Red Ammo',    icon: '🔴', category: 'Ammo', playerKey: 'redBullets',    basePrice: 0.08 },
  // Cases
  { id: 'lootBoxes',    name: 'Basic Case',   icon: '📦', category: 'Cases', playerKey: 'lootBoxes',    basePrice: 34.79 },
  { id: 'militaryBoxes', name: 'Military Box', icon: '🧰', category: 'Cases', playerKey: 'militaryBoxes', basePrice: 3.46 },
  // Buffs
  { id: 'staminaPills', name: 'Stamina Pill', icon: '💊', category: 'Buffs', playerKey: 'staminaPills', basePrice: 31.70 },
  { id: 'energyLeaves', name: 'Energy Leaf',  icon: '🍃', category: 'Buffs', playerKey: 'energyLeaves', basePrice: 0.07 },
]

/** Market price data for a resource (live ticker) */
export interface MarketTicker {
  resourceId: ResourceId
  price: number
  change24h: number
  volume: number
  high24h: number
  low24h: number
  priceHistory: number[]  // last 24 data points
}

// ── Order Book ──

export type OrderItemType = 'resource' | 'equipment' | 'division'
export type OrderSource = 'player' | 'country'

export interface MarketOrder {
  id: string
  type: 'buy' | 'sell'
  itemType: OrderItemType
  resourceId?: ResourceId        // for resource orders
  equipItemId?: string           // for equipment orders
  divisionId?: string            // for division orders
  amount: number                 // qty: 1 for equip/div
  pricePerUnit: number
  totalPrice: number             // amount * pricePerUnit
  playerId: string               // who placed it
  countryCode: string
  source: OrderSource            // 'player' or 'country'
  createdAt: number
  status: 'open' | 'filled' | 'partial' | 'cancelled'
  filledAmount: number
  // Equipment snapshot (for sell orders of equipment)
  equipSnapshot?: {
    name: string
    tier: string
    slot: string
    category: string
    stats: Record<string, number>
    durability: number
    weaponSubtype?: string
  }
  // Division snapshot (for sell orders of divisions)
  divSnapshot?: {
    name: string
    type: string
    level: number
    stars: number
    health: number
    maxHealth: number
    manpower: number
    maxManpower: number
  }
}

/** Filled trade record */
export interface TradeRecord {
  id: string
  buyOrderId: string
  sellOrderId: string
  itemType: OrderItemType
  resourceId?: ResourceId
  equipItemId?: string
  divisionId?: string
  amount: number
  pricePerUnit: number
  totalPrice: number
  tax: number                    // 1% to country fund
  buyer: string
  seller: string
  buyerCountry: string
  sellerCountry: string
  timestamp: number
}

// ══════════════════════════════════════════════════════════════════
// STORE STATE
// ══════════════════════════════════════════════════════════════════

export interface MarketState {
  tickers: Record<ResourceId, MarketTicker>
  orders: MarketOrder[]
  trades: TradeRecord[]

  // Actions
  placeResourceOrder: (type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number) => { success: boolean; message: string }
  placeEquipmentSellOrder: (equipItemId: string, price: number) => { success: boolean; message: string }
  placeDivisionSellOrder: (divisionId: string, price: number) => { success: boolean; message: string }
  buyEquipment: (orderId: string) => { success: boolean; message: string }
  buyDivision: (orderId: string) => { success: boolean; message: string }
  cancelOrder: (orderId: string) => { success: boolean; message: string }
  placeCountryOrder: (type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number) => { success: boolean; message: string }

  // Internal
  matchResourceOrders: (resourceId: ResourceId) => void
  tickPrices: () => void

  // Queries
  getOrderBook: (resourceId: ResourceId) => { buys: MarketOrder[]; sells: MarketOrder[] }
  getEquipmentListings: () => MarketOrder[]
  getDivisionListings: () => MarketOrder[]
  getMyOrders: () => MarketOrder[]
  getRecentTrades: (limit?: number) => TradeRecord[]
}

// ══════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════

function mkTicker(id: ResourceId, price: number): MarketTicker {
  return {
    resourceId: id, price,
    change24h: +(Math.random() * 8 - 4).toFixed(1),
    volume: Math.floor(5000 + Math.random() * 100000),
    high24h: +(price * (1 + Math.random() * 0.05)).toFixed(2),
    low24h: +(price * (1 - Math.random() * 0.05)).toFixed(2),
    priceHistory: Array.from({ length: 24 }, () => +(price * (0.94 + Math.random() * 0.12)).toFixed(2)),
  }
}

function mkId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const TAX_RATE = 0.01 // 1% transaction tax

// ══════════════════════════════════════════════════════════════════
// STORE
// ══════════════════════════════════════════════════════════════════

export const useMarketStore = create<MarketState>((set, get) => {
  // Build initial tickers
  const initTickers: Record<string, MarketTicker> = {}
  RESOURCE_DEFS.forEach(r => { initTickers[r.id] = mkTicker(r.id, r.basePrice) })

  return {
    tickers: initTickers as Record<ResourceId, MarketTicker>,
    orders: [],
    trades: [],

    // ══════ RESOURCE ORDERS ══════
    placeResourceOrder: (type, resourceId, amount, pricePerUnit) => {
      if (amount <= 0 || pricePerUnit <= 0) return { success: false, message: 'Invalid amount or price' }
      const def = RESOURCE_DEFS.find(r => r.id === resourceId)
      if (!def) return { success: false, message: 'Unknown resource' }

      const player = usePlayerStore.getState()
      const totalPrice = Math.round(amount * pricePerUnit * 100) / 100

      if (type === 'buy') {
        // Lock money
        if (player.money < totalPrice) return { success: false, message: `Need $${totalPrice.toFixed(2)}, have $${player.money.toFixed(2)}` }
        usePlayerStore.setState(s => ({ money: s.money - totalPrice }))
      } else {
        // Lock resources
        const owned = (player as any)[def.playerKey] as number || 0
        if (owned < amount) return { success: false, message: `Need ${amount} ${def.name}, have ${owned}` }
        usePlayerStore.setState(s => ({ [def.playerKey]: ((s as any)[def.playerKey] as number || 0) - amount } as any))
      }

      const order: MarketOrder = {
        id: mkId('ord'), type, itemType: 'resource', resourceId,
        amount, pricePerUnit, totalPrice,
        playerId: player.name, countryCode: player.countryCode || 'US',
        source: 'player', createdAt: Date.now(),
        status: 'open', filledAmount: 0,
      }

      set(s => ({ orders: [...s.orders, order] }))
      get().matchResourceOrders(resourceId)

      return { success: true, message: `${type.toUpperCase()} order placed: ${amount}× ${def.name} @ $${pricePerUnit.toFixed(2)}` }
    },

    // ══════ EQUIPMENT SELL ══════
    placeEquipmentSellOrder: (equipItemId, price) => {
      if (price < 100) return { success: false, message: 'Minimum price $100' }
      const inv = useInventoryStore.getState()
      const item = inv.items.find(i => i.id === equipItemId)
      if (!item) return { success: false, message: 'Item not found in inventory' }
      if (item.equipped) return { success: false, message: 'Unequip item first' }
      // Check not already listed
      if (get().orders.some(o => o.equipItemId === equipItemId && o.status === 'open')) {
        return { success: false, message: 'Item already listed' }
      }
      const player = usePlayerStore.getState()

      // Remove from inventory (locked in market)
      inv.removeItem(equipItemId)

      const order: MarketOrder = {
        id: mkId('eqord'), type: 'sell', itemType: 'equipment',
        equipItemId, amount: 1, pricePerUnit: price, totalPrice: price,
        playerId: player.name, countryCode: player.countryCode || 'US',
        source: 'player', createdAt: Date.now(),
        status: 'open', filledAmount: 0,
        equipSnapshot: {
          name: item.name, tier: item.tier, slot: item.slot,
          category: item.category, stats: { ...item.stats },
          durability: item.durability, weaponSubtype: item.weaponSubtype,
        },
      }

      set(s => ({ orders: [...s.orders, order] }))
      return { success: true, message: `Listed ${item.name} for $${price.toLocaleString()}` }
    },

    // ══════ DIVISION SELL ══════
    placeDivisionSellOrder: (divisionId, price) => {
      if (price < 1000) return { success: false, message: 'Minimum price $1,000' }
      if (price > 10_000_000) return { success: false, message: 'Maximum price $10,000,000' }
      const armyStore = useArmyStore.getState()
      const player = usePlayerStore.getState()
      const div = armyStore.divisions[divisionId]
      if (!div) return { success: false, message: 'Division not found' }
      if (div.ownerId !== player.name) return { success: false, message: 'Not your division' }
      if (div.status === 'in_combat') return { success: false, message: 'Cannot sell divs in combat' }
      if (div.status === 'destroyed') return { success: false, message: 'Cannot sell destroyed divs' }
      if (get().orders.some(o => o.divisionId === divisionId && o.status === 'open')) {
        return { success: false, message: 'Division already listed' }
      }

      // Lock division
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [divisionId]: { ...s.divisions[divisionId], status: 'listed' as any } }
      }))

      const divLevel = Math.floor((div.experience || 0) / 10)
      const order: MarketOrder = {
        id: mkId('divord'), type: 'sell', itemType: 'division',
        divisionId, amount: 1, pricePerUnit: price, totalPrice: price,
        playerId: player.name, countryCode: player.countryCode || 'US',
        source: 'player', createdAt: Date.now(),
        status: 'open', filledAmount: 0,
        divSnapshot: {
          name: div.name, type: div.type, level: divLevel,
          stars: div.starQuality || 1,
          health: div.health, maxHealth: div.maxHealth,
          manpower: div.manpower, maxManpower: div.maxManpower,
        },
      }

      set(s => ({ orders: [...s.orders, order] }))
      return { success: true, message: `Listed ${div.name} for $${price.toLocaleString()}` }
    },

    // ══════ BUY EQUIPMENT (instant) ══════
    buyEquipment: (orderId) => {
      const order = get().orders.find(o => o.id === orderId && o.itemType === 'equipment' && o.status === 'open')
      if (!order) return { success: false, message: 'Listing not found' }
      const player = usePlayerStore.getState()
      if (order.playerId === player.name) return { success: false, message: 'Cannot buy your own item' }
      if (player.money < order.totalPrice) return { success: false, message: 'Not enough money' }

      // Deduct buyer money
      usePlayerStore.setState(s => ({ money: s.money - order.totalPrice }))

      // Tax
      const tax = Math.round(order.totalPrice * TAX_RATE)
      const sellerGets = order.totalPrice - tax

      // Credit seller (for now just add to their money state if same player context — in multiplayer this would be different)
      // In single-player prototype: seller already removed item, just credit money
      usePlayerStore.setState(s => ({ money: s.money + sellerGets }))

      // Give item to buyer
      if (order.equipSnapshot) {
        const newItem: EquipItem = {
          id: mkId('eq'), name: order.equipSnapshot.name,
          slot: order.equipSnapshot.slot as any, category: order.equipSnapshot.category as any,
          tier: order.equipSnapshot.tier as any, equipped: false,
          durability: order.equipSnapshot.durability,
          stats: { ...order.equipSnapshot.stats } as any,
          weaponSubtype: order.equipSnapshot.weaponSubtype as any,
        }
        useInventoryStore.getState().addItem(newItem)
      }

      // Tax to country
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
        trades: [trade, ...s.trades].slice(0, 100),
      }))

      return { success: true, message: `Bought ${order.equipSnapshot?.name} for $${order.totalPrice.toLocaleString()}! (Tax: $${tax})` }
    },

    // ══════ BUY DIVISION (instant) ══════
    buyDivision: (orderId) => {
      const order = get().orders.find(o => o.id === orderId && o.itemType === 'division' && o.status === 'open')
      if (!order || !order.divisionId) return { success: false, message: 'Listing not found' }
      const player = usePlayerStore.getState()
      if (order.playerId === player.name) return { success: false, message: 'Cannot buy your own division' }
      if (player.money < order.totalPrice) return { success: false, message: 'Not enough money' }

      const armyStore = useArmyStore.getState()
      const div = armyStore.divisions[order.divisionId]
      if (!div) return { success: false, message: 'Division no longer exists' }

      // Deduct buyer money
      usePlayerStore.setState(s => ({ money: s.money - order.totalPrice }))

      // Tax
      const tax = Math.round(order.totalPrice * TAX_RATE)
      const sellerGets = order.totalPrice - tax

      // Credit seller
      usePlayerStore.setState(s => ({ money: s.money + sellerGets }))

      // Transfer ownership
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [order.divisionId!]: {
          ...s.divisions[order.divisionId!],
          ownerId: player.name,
          countryCode: player.countryCode || 'US',
          status: 'ready' as any,
        }}
      }))

      // Tax to country
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
        trades: [trade, ...s.trades].slice(0, 100),
      }))

      return { success: true, message: `Bought ${order.divSnapshot?.name} for $${order.totalPrice.toLocaleString()}!` }
    },

    // ══════ CANCEL ORDER ══════
    cancelOrder: (orderId) => {
      const order = get().orders.find(o => o.id === orderId && o.status === 'open')
      if (!order) return { success: false, message: 'Order not found or already filled' }
      const player = usePlayerStore.getState()
      if (order.playerId !== player.name && order.source !== 'country') {
        return { success: false, message: 'Not your order' }
      }

      // Refund locked assets
      if (order.itemType === 'resource') {
        const def = RESOURCE_DEFS.find(r => r.id === order.resourceId)
        if (def) {
          const remaining = order.amount - order.filledAmount
          if (order.type === 'buy') {
            // Refund locked money
            const refund = remaining * order.pricePerUnit
            if (order.source === 'country') {
              useWorldStore.getState().addTreasuryTax(order.countryCode, refund)
            } else {
              usePlayerStore.setState(s => ({ money: s.money + refund }))
            }
          } else {
            // Return locked resources
            if (order.source === 'country' && def.fundKey) {
              useWorldStore.getState().addToFund(order.countryCode, def.fundKey, remaining)
            } else {
              usePlayerStore.setState(s => ({ [def.playerKey]: ((s as any)[def.playerKey] as number || 0) + remaining } as any))
            }
          }
        }
      } else if (order.itemType === 'equipment' && order.equipSnapshot) {
        // Return equipment to inventory
        const newItem: EquipItem = {
          id: order.equipItemId || mkId('eq'), name: order.equipSnapshot.name,
          slot: order.equipSnapshot.slot as any, category: order.equipSnapshot.category as any,
          tier: order.equipSnapshot.tier as any, equipped: false,
          durability: order.equipSnapshot.durability,
          stats: { ...order.equipSnapshot.stats } as any,
          weaponSubtype: order.equipSnapshot.weaponSubtype as any,
        }
        useInventoryStore.getState().addItem(newItem)
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
    },

    // ══════ COUNTRY FUND ORDERS (president only) ══════
    placeCountryOrder: (type, resourceId, amount, pricePerUnit) => {
      if (amount <= 0 || pricePerUnit <= 0) return { success: false, message: 'Invalid amount or price' }
      const def = RESOURCE_DEFS.find(r => r.id === resourceId)
      if (!def || !def.fundKey) return { success: false, message: 'Resource cannot be traded from country fund' }

      const player = usePlayerStore.getState()
      const countryCode = player.countryCode || 'US'
      const gov = useGovernmentStore.getState().governments[countryCode]
      if (!gov || gov.president !== player.name) {
        return { success: false, message: 'Only the president can trade from the national fund' }
      }

      const ws = useWorldStore.getState()
      const country = ws.getCountry(countryCode)
      if (!country) return { success: false, message: 'Country not found' }

      const totalPrice = Math.round(amount * pricePerUnit * 100) / 100

      if (type === 'buy') {
        // Lock country money
        if (country.fund.money < totalPrice) return { success: false, message: `National fund needs $${totalPrice.toFixed(2)}` }
        ws.spendFromFund(countryCode, { money: totalPrice })
      } else {
        // Lock country resources
        const available = country.fund[def.fundKey]
        if (available < amount) return { success: false, message: `National fund has ${available} ${def.name}, need ${amount}` }
        ws.spendFromFund(countryCode, { [def.fundKey]: amount })
      }

      const order: MarketOrder = {
        id: mkId('cntord'), type, itemType: 'resource', resourceId,
        amount, pricePerUnit, totalPrice,
        playerId: player.name, countryCode,
        source: 'country', createdAt: Date.now(),
        status: 'open', filledAmount: 0,
      }

      set(s => ({ orders: [...s.orders, order] }))
      get().matchResourceOrders(resourceId)

      return { success: true, message: `Country ${type.toUpperCase()}: ${amount}× ${def.name} @ $${pricePerUnit.toFixed(2)}` }
    },

    // ══════ MATCHMAKING ENGINE ══════
    matchResourceOrders: (resourceId) => {
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
          if (sellOrder.pricePerUnit > buyOrder.pricePerUnit) break // no match possible
          let sellRemaining = sellOrder.amount - sellOrder.filledAmount
          if (sellRemaining <= 0) continue

          // Match at the sell price (taker-maker: buyer pays seller's ask)
          const matchPrice = sellOrder.pricePerUnit
          const matchAmount = Math.min(buyRemaining, sellRemaining)
          const matchTotal = Math.round(matchAmount * matchPrice * 100) / 100
          const tax = Math.round(matchTotal * TAX_RATE)

          // Buyer already locked full amount at their buy price; refund excess
          const buyerLocked = matchAmount * buyOrder.pricePerUnit
          const excess = Math.round((buyerLocked - matchTotal) * 100) / 100

          // Deliver resources to buyer
          const def = RESOURCE_DEFS.find(r => r.id === resourceId)!
          if (buyOrder.source === 'country' && def.fundKey) {
            useWorldStore.getState().addToFund(buyOrder.countryCode, def.fundKey, matchAmount)
          } else {
            usePlayerStore.setState(s => ({ [def.playerKey]: ((s as any)[def.playerKey] as number || 0) + matchAmount } as any))
          }

          // Refund buyer excess
          if (excess > 0) {
            if (buyOrder.source === 'country') {
              useWorldStore.getState().addTreasuryTax(buyOrder.countryCode, excess)
            } else {
              usePlayerStore.setState(s => ({ money: s.money + excess }))
            }
          }

          // Pay seller (minus tax)
          const sellerGets = matchTotal - tax
          if (sellOrder.source === 'country') {
            useWorldStore.getState().addTreasuryTax(sellOrder.countryCode, sellerGets)
          } else {
            usePlayerStore.setState(s => ({ money: s.money + sellerGets }))
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

          // Update internal tracking
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

          // Update ticker price to last trade price
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
            }
            set({ tickers })
          }

          buyRemaining -= matchAmount
          if (buyRemaining <= 0) break
        }
      }

      if (newTrades.length > 0) {
        const state2 = get()
        set({
          orders: updatedOrders,
          trades: [...newTrades, ...state2.trades].slice(0, 100),
        })
      }
    },

    // ══════ PRICE TICK ══════
    tickPrices: () => set(state => {
      const newTickers = { ...state.tickers }
      for (const id of Object.keys(newTickers) as ResourceId[]) {
        const t = newTickers[id]
        const drift = (Math.random() - 0.5) * 0.04 * t.price
        const avg = t.priceHistory.reduce((a, b) => a + b, 0) / t.priceHistory.length
        const reversion = (avg - t.price) * 0.05
        const newPrice = Math.max(0.01, +(t.price + drift + reversion).toFixed(2))
        const oldBase = t.priceHistory[0] || t.price
        newTickers[id] = {
          ...t,
          price: newPrice,
          change24h: +((newPrice / oldBase - 1) * 100).toFixed(1),
          volume: t.volume + Math.floor(Math.random() * 500),
          high24h: Math.max(t.high24h, newPrice),
          low24h: Math.min(t.low24h, newPrice),
          priceHistory: [...t.priceHistory.slice(1), newPrice],
        }
      }
      return { tickers: newTickers }
    }),

    // ══════ QUERIES ══════
    getOrderBook: (resourceId) => {
      const orders = get().orders.filter(o => o.resourceId === resourceId && (o.status === 'open' || o.status === 'partial') && o.itemType === 'resource')
      return {
        buys: orders.filter(o => o.type === 'buy').sort((a, b) => b.pricePerUnit - a.pricePerUnit),
        sells: orders.filter(o => o.type === 'sell').sort((a, b) => a.pricePerUnit - b.pricePerUnit),
      }
    },

    getEquipmentListings: () => {
      return get().orders.filter(o => o.itemType === 'equipment' && o.status === 'open' && o.type === 'sell')
    },

    getDivisionListings: () => {
      return get().orders.filter(o => o.itemType === 'division' && o.status === 'open' && o.type === 'sell')
    },

    getMyOrders: () => {
      const player = usePlayerStore.getState()
      return get().orders.filter(o => o.playerId === player.name && (o.status === 'open' || o.status === 'partial'))
    },

    getRecentTrades: (limit = 20) => {
      return get().trades.slice(0, limit)
    },
  }
})
