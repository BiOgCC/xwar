import { create } from 'zustand'

export type PlayerRole = 'military' | 'business' | 'politics'

export interface PlayerState {
  name: string
  role: PlayerRole
  rank: number
  maxRank: number
  country: string
  countryCode: string
  money: number
  food: number
  oil: number
  materialX: number
  companiesOwned: number
  attack: () => void
  buyResource: (resource: 'food' | 'oil' | 'materialX', amount: number, cost: number) => void
  earnMoney: (amount: number) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  name: 'Commander_X',
  role: 'military',
  rank: 12,
  maxRank: 100,
  country: 'United States',
  countryCode: 'US',
  money: 45200,
  food: 1840,
  oil: 920,
  materialX: 38,
  companiesOwned: 3,

  attack: () =>
    set((state) => ({
      food: Math.max(0, state.food - 50),
      oil: Math.max(0, state.oil - 25),
      money: state.money + 800,
      rank: Math.min(state.maxRank, state.rank + 0.5),
    })),

  buyResource: (resource, amount, cost) =>
    set((state) => ({
      money: Math.max(0, state.money - cost),
      [resource]: state[resource] + amount,
    })),

  earnMoney: (amount) =>
    set((state) => ({ money: state.money + amount })),
}))
