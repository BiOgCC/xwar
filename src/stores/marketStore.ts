import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useArmyStore } from './armyStore'

export interface MarketResource {
  id: string
  name: string
  icon: string
  price: number
  change24h: number
  volume: number
  priceHistory: number[]
}

export interface MarketOrder {
  id: string
  type: 'buy' | 'sell'
  resource: string
  amount: number
  price: number
  player: string
  timestamp: number
}

export interface DivisionListing {
  id: string
  divisionId: string
  sellerId: string
  sellerCountry: string
  price: number
  divName: string
  divType: string
  divLevel: number
  divStars: number
  divHealth: number
  divMaxHealth: number
  divManpower: number
  divMaxManpower: number
  listedAt: number
}

export interface MarketState {
  resources: MarketResource[]
  recentOrders: MarketOrder[]
  divisionListings: DivisionListing[]
  executeTrade: (resourceId: string, type: 'buy' | 'sell', amount: number) => void
  listDivision: (divisionId: string, price: number) => { success: boolean; message: string }
  buyDivision: (listingId: string) => { success: boolean; message: string }
  delistDivision: (listingId: string) => { success: boolean; message: string }
  /** Called every economy tick (30 min) to randomly fluctuate prices */
  tickPrices: () => void
}

const mkRes = (id: string, name: string, icon: string, price: number, change: number, vol: number): MarketResource => ({
  id, name, icon, price, change24h: change, volume: vol,
  priceHistory: Array.from({ length: 11 }, (_, i) => +(price * (0.92 + Math.random() * 0.16)).toFixed(2)),
})

export const useMarketStore = create<MarketState>((set, get) => ({
  resources: [
    mkRes('food',      'Food',        '🌾',  12.50,   3.2, 284000),
    mkRes('oil',       'Oil',         '🛢️', 28.70,  -1.8, 156000),
    mkRes('materialX', 'Material X',  '⚛️', 450.00, 12.5,   8200),
    mkRes('equipment', 'Equipment',   '⚔️',  85.00,  0.5,  42000),
    mkRes('scrap',     'Scrap',       '🔩',   0.22,  1.1,  92000),
    mkRes('ammo',      'Ammunition',  '🎯',   0.62,  2.3,  71000),
    mkRes('bitcoin',   'Bitcoin',     '₿',   85.00,  4.8,   5100),
  ],

  recentOrders: [
    { id: 'o1', type: 'buy',  resource: 'Food',       amount: 500, price: 12.5,  player: 'TankGod_99',  timestamp: Date.now() - 120000 },
    { id: 'o2', type: 'sell', resource: 'Oil',        amount: 200, price: 29.0,  player: 'OilBaron_X',  timestamp: Date.now() - 300000 },
    { id: 'o3', type: 'buy',  resource: 'Material X', amount: 10,  price: 448,   player: 'NukeMaster',  timestamp: Date.now() - 600000 },
    { id: 'o4', type: 'sell', resource: 'Equipment',  amount: 50,  price: 86,    player: 'WarFactory',  timestamp: Date.now() - 900000 },
  ],

  divisionListings: [],

  listDivision: (divisionId, price) => {
    const armyStore = useArmyStore.getState()
    const player = usePlayerStore.getState()
    const div = armyStore.divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found' }
    if (div.ownerId !== player.name) return { success: false, message: 'Not your division' }
    if (div.status === 'in_combat') return { success: false, message: 'Cannot sell divisions in combat' }
    if (div.status === 'destroyed') return { success: false, message: 'Cannot sell destroyed divisions' }
    if (price < 1000) return { success: false, message: 'Minimum price is $1,000' }
    if (price > 10000000) return { success: false, message: 'Maximum price is $10,000,000' }
    // Check not already listed
    const existing = get().divisionListings.find((l: DivisionListing) => l.divisionId === divisionId)
    if (existing) return { success: false, message: 'Division already listed' }
    const divLevel = Math.floor((div.experience || 0) / 10)
    const listing: DivisionListing = {
      id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      divisionId, sellerId: player.name, sellerCountry: div.countryCode,
      price, divName: div.name, divType: div.type, divLevel,
      divStars: div.starQuality || 1,
      divHealth: div.health, divMaxHealth: div.maxHealth,
      divManpower: div.manpower, divMaxManpower: div.maxManpower,
      listedAt: Date.now(),
    }
    // Lock division status
    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, [divisionId]: { ...s.divisions[divisionId], status: 'listed' as any } }
    }))
    set(s => ({ divisionListings: [...s.divisionListings, listing] }))
    return { success: true, message: `Listed ${div.name} for $${price.toLocaleString()}` }
  },

  buyDivision: (listingId) => {
    const player = usePlayerStore.getState()
    const listing = get().divisionListings.find((l: DivisionListing) => l.id === listingId)
    if (!listing) return { success: false, message: 'Listing not found' }
    if (listing.sellerId === player.name) return { success: false, message: 'Cannot buy your own division' }
    if (player.money < listing.price) return { success: false, message: 'Not enough money' }
    const armyStore = useArmyStore.getState()
    const div = armyStore.divisions[listing.divisionId]
    if (!div) return { success: false, message: 'Division no longer exists' }
    // Transfer money
    usePlayerStore.setState(s => ({ money: s.money - listing.price }))
    // Transfer ownership
    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, [listing.divisionId]: {
        ...s.divisions[listing.divisionId],
        ownerId: player.name,
        countryCode: player.countryCode || 'US',
        status: 'ready' as any,
      }}
    }))
    // Remove listing
    set(s => ({
      divisionListings: s.divisionListings.filter((l: DivisionListing) => l.id !== listingId)
    }))
    return { success: true, message: `Purchased ${listing.divName} for $${listing.price.toLocaleString()}!` }
  },

  delistDivision: (listingId) => {
    const player = usePlayerStore.getState()
    const listing = get().divisionListings.find((l: DivisionListing) => l.id === listingId)
    if (!listing) return { success: false, message: 'Listing not found' }
    if (listing.sellerId !== player.name) return { success: false, message: 'Not your listing' }
    // Unlock division
    useArmyStore.setState(s => ({
      divisions: { ...s.divisions, [listing.divisionId]: {
        ...s.divisions[listing.divisionId], status: 'ready' as any,
      }}
    }))
    // Remove listing
    set(s => ({
      divisionListings: s.divisionListings.filter((l: DivisionListing) => l.id !== listingId)
    }))
    return { success: true, message: `Removed ${listing.divName} from market` }
  },

  executeTrade: (resourceId, type, amount) =>
    set((state) => {
      const resource = state.resources.find((r) => r.id === resourceId)
      if (!resource) return state

      // Price impact scales with amount traded relative to volume
      const impactBase = type === 'buy' ? 0.5 : -0.5
      const impactScale = Math.min(3, 1 + amount / Math.max(1, resource.volume * 0.01))
      const priceImpact = impactBase * impactScale

      const newPrice = Math.max(0.01, +(resource.price + priceImpact).toFixed(2))
      const newChange = +((newPrice / (resource.priceHistory[0] || resource.price) - 1) * 100).toFixed(1)

      return {
        resources: state.resources.map((r) =>
          r.id === resourceId
            ? {
                ...r,
                price: newPrice,
                change24h: newChange,
                volume: r.volume + amount,
                priceHistory: [...r.priceHistory.slice(1), newPrice],
              }
            : r
        ),
        recentOrders: [
          {
            id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            resource: resource.name,
            amount,
            price: resource.price,
            player: 'Commander_X',
            timestamp: Date.now(),
          },
          ...state.recentOrders.slice(0, 19),
        ],
      }
    }),

  tickPrices: () =>
    set((state) => {
      // Simulate NPC trading activity + natural price drift
      const npcNames = ['TankGod_99', 'OilBaron_X', 'NukeMaster', 'WarFactory', 'AmmoKing', 'ScrapLord', 'CryptoGuy']
      const newOrders: MarketOrder[] = []

      const resources = state.resources.map((r) => {
        // Random drift: -2% to +2%
        const drift = (Math.random() - 0.5) * 0.04 * r.price
        // Mean-reversion toward the avg of price history
        const avg = r.priceHistory.reduce((a, b) => a + b, 0) / r.priceHistory.length
        const reversion = (avg - r.price) * 0.05
        const newPrice = Math.max(0.01, +(r.price + drift + reversion).toFixed(2))
        const newChange = +((newPrice / (r.priceHistory[0] || r.price) - 1) * 100).toFixed(1)

        // Each tick: 30% chance of an NPC order for this resource
        if (Math.random() < 0.3) {
          const npcType = Math.random() < 0.5 ? 'buy' : 'sell'
          const npcAmount = Math.floor(10 + Math.random() * 200)
          newOrders.push({
            id: `npc-${Date.now()}-${r.id}`,
            type: npcType as 'buy' | 'sell',
            resource: r.name,
            amount: npcAmount,
            price: newPrice,
            player: npcNames[Math.floor(Math.random() * npcNames.length)],
            timestamp: Date.now(),
          })
        }

        return {
          ...r,
          price: newPrice,
          change24h: newChange,
          volume: r.volume + Math.floor(Math.random() * 500),
          priceHistory: [...r.priceHistory.slice(1), newPrice],
        }
      })

      return {
        resources,
        recentOrders: [...newOrders, ...state.recentOrders].slice(0, 20),
      }
    }),
}))
