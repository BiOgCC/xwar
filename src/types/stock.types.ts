// ══════════════════════════════════════════════
// XWAR — Stock Market Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export interface StockTick {
  price: number
  timestamp: number
}

export interface CountryStock {
  code: string
  name: string
  price: number
  prevPrice: number
  history: StockTick[]
  volume: number
  netBuyVolume: number  // net buy/sell pressure — positive = buy pressure, decays 10%/tick
}

export interface Holding {
  code: string
  shares: number
  avgBuyPrice: number
}

export interface StockTransaction {
  id: string
  type: 'buy' | 'sell' | 'bond_open' | 'bond_close'
  code: string
  qty: number
  price: number
  total: number
  pnl?: number
  timestamp: number
  playerName: string
}

export type BondDirection = 'up' | 'down'

export interface Bond {
  id: string
  countryCode: string
  direction: BondDirection
  entryPrice: number
  betAmount: number
  openedAt: number
  expiresAt: number
  status: 'open' | 'won' | 'lost'
  closePrice?: number
  payout?: number
}
