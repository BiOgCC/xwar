// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Types, Constants & Resource Definitions
// ══════════════════════════════════════════════════════════════════

import type { NationalFundKey } from '../worldStore'

// ── Constants ──
export const TAX_RATE = 0.01             // 1 % transaction tax
export const LISTING_FEE_RATE = 0.02     // 2 % listing fee (equipment), non-refundable → country fund
export const ORDER_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000  // 7 days
export const MAX_TRADES_HISTORY = 200    // recent trades cap
export const STALE_CLEANUP_AGE_MS = 2 * 60 * 60 * 1000  // filled/cancelled orders removed after 2 h

// ── Minimum Equipment Prices by Tier ──
export const MIN_EQUIP_PRICE: Record<string, number> = {
  t1: 100,  t2: 300,  t3: 1000,  t4: 4000,  t5: 15000,  t6: 60000,
}

// ── Resource Identifiers ──
export type ResourceId =
  | 'oil' | 'scrap' | 'materialX' | 'bitcoin'
  | 'bread' | 'steak' | 'sushi' | 'fish' | 'wagyu' | 'wheat'
  | 'blueBullets' | 'greenBullets' | 'purpleBullets' | 'redBullets'
  | 'lootBoxes' | 'militaryBoxes'
  | 'staminaPills' | 'energyLeaves'

// ── Resource Metadata ──
export interface ResourceDef {
  id: ResourceId
  name: string
  icon: string
  iconImage?: string
  category: string
  playerKey: string
  fundKey?: NationalFundKey
  basePrice: number
}

export const RESOURCE_DEFS: ResourceDef[] = [
  // Construction
  { id: 'oil',       name: 'Oil',         icon: '🛢️', iconImage: '/assets/items/icon_oil.png',       category: 'Construction', playerKey: 'oil',       fundKey: 'oil',       basePrice: 0.16 },
  { id: 'scrap',     name: 'Scrap',       icon: '🔩',  iconImage: '/assets/items/icon_scrap.png',     category: 'Construction', playerKey: 'scrap',     fundKey: 'scraps',    basePrice: 0.22 },
  { id: 'materialX', name: 'Material X',  icon: '⚛️', iconImage: '/assets/items/icon_materialx.png', category: 'Construction', playerKey: 'materialX', fundKey: 'materialX', basePrice: 1.62 },
  { id: 'bitcoin',   name: 'Bitcoin',     icon: '₿',   iconImage: '/assets/items/icon_bitcoin.png',   category: 'Construction', playerKey: 'bitcoin',   fundKey: 'bitcoin',   basePrice: 85.00 },
  // Food
  { id: 'bread',  name: 'Bread',  icon: '🍞', iconImage: '/assets/food/bread.png',  category: 'Food', playerKey: 'bread',  basePrice: 1.81 },
  { id: 'steak',  name: 'Steak',  icon: '🥩', category: 'Food', playerKey: 'steak',  basePrice: 3.50 },
  { id: 'sushi',  name: 'Sushi',  icon: '🍣', iconImage: '/assets/food/sushi.png',  category: 'Food', playerKey: 'sushi',  basePrice: 7.19 },
  { id: 'fish',   name: 'Fish',   icon: '🐟', category: 'Food', playerKey: 'fish',   basePrice: 3.44 },
  { id: 'wagyu',  name: 'Wagyu',  icon: '🥩', iconImage: '/assets/food/wagyu.png',  category: 'Food', playerKey: 'wagyu',  basePrice: 9.50 },
  { id: 'wheat',  name: 'Wheat',  icon: '🌾', category: 'Food', playerKey: 'wheat',  basePrice: 0.08 },
  // Ammo
  { id: 'blueBullets',   name: 'Blue Ammo',   icon: '🔵', iconImage: '/assets/items/ammo_blue.png',   category: 'Ammo', playerKey: 'blueBullets',   basePrice: 0.62 },
  { id: 'greenBullets',  name: 'Green Ammo',  icon: '🟢', iconImage: '/assets/items/ammo_green.png',  category: 'Ammo', playerKey: 'greenBullets',  basePrice: 0.17 },
  { id: 'purpleBullets', name: 'Purple Ammo', icon: '🟣', iconImage: '/assets/items/ammo_purple.png', category: 'Ammo', playerKey: 'purpleBullets', basePrice: 2.51 },
  { id: 'redBullets',    name: 'Red Ammo',    icon: '🔴', iconImage: '/assets/items/ammo_red.png',    category: 'Ammo', playerKey: 'redBullets',    basePrice: 0.08 },
  // Cases
  { id: 'lootBoxes',     name: 'Civilian Loot Box', icon: '📦', iconImage: '/assets/items/lootbox_civilian.png', category: 'Cases', playerKey: 'lootBoxes',    basePrice: 34.79 },
  { id: 'militaryBoxes', name: 'Military Loot Box', icon: '🧰', iconImage: '/assets/items/lootbox_military.png', category: 'Cases', playerKey: 'militaryBoxes', basePrice: 3.46 },
  // Buffs
  { id: 'staminaPills', name: 'Stamina Pill', icon: '💊', category: 'Buffs', playerKey: 'staminaPills', basePrice: 31.70 },
  { id: 'energyLeaves', name: 'Energy Leaf',  icon: '🍃', category: 'Buffs', playerKey: 'energyLeaves', basePrice: 0.07 },
]

/** Quick lookup: playerKey or id → ResourceDef */
export const RESOURCE_BY_KEY: Record<string, ResourceDef> = {}
RESOURCE_DEFS.forEach(r => {
  RESOURCE_BY_KEY[r.id] = r
  RESOURCE_BY_KEY[r.playerKey] = r
})

// ── Market Ticker (live price data) ──
export interface MarketTicker {
  resourceId: ResourceId
  price: number
  change24h: number
  volume: number
  high24h: number
  low24h: number
  priceHistory: number[]   // last 24 data points
  recentBuyVolume: number  // buys in current window
  recentSellVolume: number // sells in current window
}

// ── Order Book ──
export type OrderItemType = 'resource' | 'equipment' | 'division'
export type OrderSource = 'player' | 'country'

export interface MarketOrder {
  id: string
  type: 'buy' | 'sell'
  itemType: OrderItemType
  resourceId?: ResourceId
  equipItemId?: string
  divisionId?: string
  amount: number
  pricePerUnit: number
  totalPrice: number
  playerId: string
  countryCode: string
  source: OrderSource
  createdAt: number
  expiresAt: number          // auto-expiry timestamp
  status: 'open' | 'filled' | 'partial' | 'cancelled' | 'expired'
  filledAmount: number
  listingFee?: number        // non-refundable fee paid on equipment listings
  equipSnapshot?: {
    name: string
    tier: string
    slot: string
    category: string
    stats: Record<string, number>
    durability: number
    weaponSubtype?: string
  }
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
  tax: number
  buyer: string
  seller: string
  buyerCountry: string
  sellerCountry: string
  timestamp: number
}

// ── Store State ──
export interface MarketState {
  tickers: Record<ResourceId, MarketTicker>
  orders: MarketOrder[]
  trades: TradeRecord[]

  // Resource trading
  placeResourceOrder: (type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number) => { success: boolean; message: string }
  matchResourceOrders: (resourceId: ResourceId) => void

  // Equipment
  placeEquipmentSellOrder: (equipItemId: string, price: number) => { success: boolean; message: string }
  buyEquipment: (orderId: string) => { success: boolean; message: string }

  // Divisions
  placeDivisionSellOrder: (divisionId: string, price: number) => { success: boolean; message: string }
  buyDivision: (orderId: string) => { success: boolean; message: string }

  // Country fund
  placeCountryOrder: (type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number) => { success: boolean; message: string }

  // Shared
  cancelOrder: (orderId: string) => { success: boolean; message: string }

  // Maintenance
  tickPrices: () => void
  cleanupStaleOrders: () => void
  expireOldOrders: () => void

  // Queries
  getOrderBook: (resourceId: ResourceId) => { buys: MarketOrder[]; sells: MarketOrder[] }
  getEquipmentListings: () => MarketOrder[]
  getDivisionListings: () => MarketOrder[]
  getMyOrders: () => MarketOrder[]
  getRecentTrades: (limit?: number) => TradeRecord[]
}
