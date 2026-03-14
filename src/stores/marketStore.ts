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
}

export const useMarketStore = create<MarketState>((set) => ({
  resources: [
    {
      id: 'food',
      name: 'Food',
      icon: '🌾',
      price: 12.5,
      change24h: 3.2,
      volume: 284000,
      priceHistory: [10, 11.2, 10.8, 11.5, 12, 11.8, 12.5, 13, 12.2, 11.9, 12.5],
    },
    {
      id: 'oil',
      name: 'Oil',
      icon: '🛢️',
      price: 28.7,
      change24h: -1.8,
      volume: 156000,
      priceHistory: [30, 29.5, 30.2, 29, 28.5, 29.1, 28.3, 27.8, 28.9, 29.2, 28.7],
    },
    {
      id: 'materialX',
      name: 'Material X',
      icon: '⚛️',
      price: 450,
      change24h: 12.5,
      volume: 8200,
      priceHistory: [380, 390, 410, 400, 420, 435, 415, 440, 455, 445, 450],
    },
    {
      id: 'equipment',
      name: 'Equipment',
      icon: '⚔️',
      price: 85,
      change24h: 0.5,
      volume: 42000,
      priceHistory: [82, 83, 84, 85, 83, 84.5, 86, 84, 85, 84.5, 85],
    },
  ],

  recentOrders: [
    { id: 'o1', type: 'buy', resource: 'Food', amount: 500, price: 12.5, player: 'TankGod_99', timestamp: Date.now() - 120000 },
    { id: 'o2', type: 'sell', resource: 'Oil', amount: 200, price: 29.0, player: 'OilBaron_X', timestamp: Date.now() - 300000 },
    { id: 'o3', type: 'buy', resource: 'Material X', amount: 10, price: 448, player: 'NukeMaster', timestamp: Date.now() - 600000 },
    { id: 'o4', type: 'sell', resource: 'Equipment', amount: 50, price: 86, player: 'WarFactory', timestamp: Date.now() - 900000 },
  ],

  executeTrade: (resourceId, type, amount) =>
    set((state) => {
      const resource = state.resources.find((r) => r.id === resourceId)
      if (!resource) return state

      const priceImpact = type === 'buy' ? 0.5 : -0.5
      return {
        resources: state.resources.map((r) =>
          r.id === resourceId
            ? {
                ...r,
                price: Math.max(0.1, r.price + priceImpact),
                volume: r.volume + amount,
                priceHistory: [...r.priceHistory.slice(1), r.price + priceImpact],
              }
            : r
        ),
        recentOrders: [
          {
            id: `o-${Date.now()}`,
            type,
            resource: resource.name,
            amount,
            price: resource.price,
            player: 'Commander_X',
            timestamp: Date.now(),
          },
          ...state.recentOrders.slice(0, 9),
        ],
      }
    }),
}))
