import { create } from 'zustand'

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

export interface MarketState {
  resources: MarketResource[]
  recentOrders: MarketOrder[]
  executeTrade: (resourceId: string, type: 'buy' | 'sell', amount: number) => void
  /** Called every economy tick (30 min) to randomly fluctuate prices */
  tickPrices: () => void
}

const mkRes = (id: string, name: string, icon: string, price: number, change: number, vol: number): MarketResource => ({
  id, name, icon, price, change24h: change, volume: vol,
  priceHistory: Array.from({ length: 11 }, (_, i) => +(price * (0.92 + Math.random() * 0.16)).toFixed(2)),
})

export const useMarketStore = create<MarketState>((set) => ({
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
