import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR — Stock Market Store
   Country shares, market pool, bonds, transaction log
   ══════════════════════════════════════════════ */

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
}

export interface Holding {
  code: string
  shares: number
  avgBuyPrice: number
}

// ── Transaction Log ──
export interface Transaction {
  id: string
  type: 'buy' | 'sell' | 'bond_open' | 'bond_close'
  code: string           // stock/bond country code
  qty: number
  price: number
  total: number
  pnl?: number           // profit/loss for sells and bond closes
  timestamp: number
  playerName: string
}

// ── Binary Options Bonds ──
export type BondDirection = 'up' | 'down'

export interface Bond {
  id: string
  countryCode: string
  direction: BondDirection  // player bets UP or DOWN
  entryPrice: number        // price at open
  betAmount: number         // how much player wagered
  openedAt: number
  expiresAt: number         // auto-close window
  status: 'open' | 'won' | 'lost'
  closePrice?: number
  payout?: number
}

const BOND_DURATIONS = [
  { label: '1 MIN', ms: 60_000, multiplier: 1.8 },
  { label: '5 MIN', ms: 300_000, multiplier: 1.6 },
  { label: '15 MIN', ms: 900_000, multiplier: 1.4 },
]

export { BOND_DURATIONS }

// Major economies
const STOCK_COUNTRIES = [
  { code: 'US', name: 'United States', basePrice: 850 },
  { code: 'CN', name: 'China', basePrice: 620 },
  { code: 'RU', name: 'Russia', basePrice: 380 },
  { code: 'GB', name: 'United Kingdom', basePrice: 720 },
  { code: 'DE', name: 'Germany', basePrice: 680 },
  { code: 'FR', name: 'France', basePrice: 640 },
  { code: 'JP', name: 'Japan', basePrice: 710 },
  { code: 'BR', name: 'Brazil', basePrice: 340 },
  { code: 'IN', name: 'India', basePrice: 420 },
  { code: 'KR', name: 'South Korea', basePrice: 560 },
]

function initPrice(base: number): number {
  return Math.floor(base * (0.9 + Math.random() * 0.2))
}

function initHistory(basePrice: number): StockTick[] {
  const ticks: StockTick[] = []
  let p = basePrice
  const now = Date.now()
  for (let i = 29; i >= 0; i--) {
    const change = (Math.random() - 0.48) * basePrice * 0.03
    p = Math.max(10, Math.floor(p + change))
    ticks.push({ price: p, timestamp: now - i * 60000 })
  }
  return ticks
}

const INITIAL_POOL = 10_000_000

export interface StockState {
  stocks: CountryStock[]
  portfolio: Holding[]
  totalInvested: number
  totalRealized: number
  marketPool: number           // shared liquidity pool
  transactions: Transaction[]  // global transaction log
  bonds: Bond[]                // player's active/closed bonds

  buyShares: (code: string, qty: number) => { success: boolean; message: string }
  sellShares: (code: string, qty: number) => { success: boolean; message: string }
  openBond: (code: string, direction: BondDirection, betAmount: number, durationIdx: number) => { success: boolean; message: string }
  closeBond: (bondId: string) => { success: boolean; message: string }
  resolveExpiredBonds: () => void
  tickMarket: () => void
  getStock: (code: string) => CountryStock | undefined
  getHolding: (code: string) => Holding | undefined
  getPortfolioValue: () => number
}

export const useStockStore = create<StockState>((set, get) => {
  const initialStocks: CountryStock[] = STOCK_COUNTRIES.map(sc => {
    const price = initPrice(sc.basePrice)
    return { code: sc.code, name: sc.name, price, prevPrice: price, history: initHistory(price), volume: 0 }
  })

  return {
    stocks: initialStocks,
    portfolio: [],
    totalInvested: 0,
    totalRealized: 0,
    marketPool: INITIAL_POOL,
    transactions: [],
    bonds: [],

    buyShares: (code, qty) => {
      if (qty <= 0) return { success: false, message: 'Invalid quantity' }

      const stock = get().stocks.find(s => s.code === code)
      if (!stock) return { success: false, message: 'Stock not found' }

      const totalCost = stock.price * qty

      const player = usePlayerStore.getState()
      if (player.money < totalCost) {
        return { success: false, message: `Need $${totalCost.toLocaleString()}` }
      }

      // Player pays
      player.spendMoney(totalCost)

      // 1% to country treasury, 99% to market pool
      const toCountry = Math.floor(totalCost * 0.01)
      const toPool = totalCost - toCountry
      useWorldStore.getState().addTreasuryTax(code, toCountry)

      const tx: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'buy', code, qty, price: stock.price, total: totalCost,
        timestamp: Date.now(), playerName: player.name,
      }

      set(s => {
        const existing = s.portfolio.find(h => h.code === code)
        let newPortfolio: Holding[]
        if (existing) {
          const totalShares = existing.shares + qty
          const avgPrice = Math.floor((existing.avgBuyPrice * existing.shares + stock.price * qty) / totalShares)
          newPortfolio = s.portfolio.map(h => h.code === code ? { ...h, shares: totalShares, avgBuyPrice: avgPrice } : h)
        } else {
          newPortfolio = [...s.portfolio, { code, shares: qty, avgBuyPrice: stock.price }]
        }

        return {
          portfolio: newPortfolio,
          stocks: s.stocks.map(st => st.code === code ? { ...st, volume: st.volume + qty } : st),
          totalInvested: s.totalInvested + totalCost,
          marketPool: s.marketPool + toPool,
          transactions: [tx, ...s.transactions].slice(0, 50),
        }
      })

      if (qty >= 50) {
        useNewsStore.getState().pushEvent('economy', `${player.name} bought ${qty} shares of ${stock.name} at $${stock.price}/share`)
      }

      return { success: true, message: `Bought ${qty} ${code} @ $${stock.price}` }
    },

    sellShares: (code, qty) => {
      if (qty <= 0) return { success: false, message: 'Invalid quantity' }

      const holding = get().portfolio.find(h => h.code === code)
      if (!holding || holding.shares < qty) return { success: false, message: 'Insufficient shares' }

      const stock = get().stocks.find(s => s.code === code)
      if (!stock) return { success: false, message: 'Stock not found' }

      const totalRevenue = stock.price * qty

      // Pool pays the sell (liquidity provider)
      if (get().marketPool < totalRevenue) {
        return { success: false, message: 'Market pool has insufficient liquidity. Try fewer shares.' }
      }

      // 1% sell tax to country treasury
      const sellTax = Math.floor(totalRevenue * 0.01)
      useWorldStore.getState().addTreasuryTax(code, sellTax)

      // Pay player from pool (minus tax)
      const netRevenue = totalRevenue - sellTax
      usePlayerStore.getState().earnMoney(netRevenue)

      const pnl = (stock.price - holding.avgBuyPrice) * qty

      const tx: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'sell', code, qty, price: stock.price, total: totalRevenue,
        pnl, timestamp: Date.now(), playerName: usePlayerStore.getState().name,
      }

      set(s => {
        let newPortfolio: Holding[]
        if (holding.shares === qty) {
          newPortfolio = s.portfolio.filter(h => h.code !== code)
        } else {
          newPortfolio = s.portfolio.map(h => h.code === code ? { ...h, shares: h.shares - qty } : h)
        }

        return {
          portfolio: newPortfolio,
          stocks: s.stocks.map(st => st.code === code ? { ...st, volume: st.volume + qty } : st),
          totalRealized: s.totalRealized + totalRevenue,
          marketPool: s.marketPool - totalRevenue,
          transactions: [tx, ...s.transactions].slice(0, 50),
        }
      })

      if (qty >= 50) {
        useNewsStore.getState().pushEvent('economy', `${usePlayerStore.getState().name} sold ${qty} shares of ${stock.name}`)
      }

      return { success: true, message: `Sold ${qty} ${code} @ $${stock.price} (P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()})` }
    },

    // ── Binary Options Bonds ──

    openBond: (code, direction, betAmount, durationIdx) => {
      const player = usePlayerStore.getState()
      const stock = get().stocks.find(s => s.code === code)
      if (!stock) return { success: false, message: 'Stock not found' }
      if (betAmount < 10_000) return { success: false, message: 'Minimum bet: $10,000' }
      if (player.money < betAmount) return { success: false, message: 'Insufficient funds' }

      const duration = BOND_DURATIONS[durationIdx]
      if (!duration) return { success: false, message: 'Invalid duration' }

      player.spendMoney(betAmount)

      // Bet goes to market pool
      const bond: Bond = {
        id: `bond_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        countryCode: code,
        direction,
        entryPrice: stock.price,
        betAmount,
        openedAt: Date.now(),
        expiresAt: Date.now() + duration.ms,
        status: 'open',
      }

      const tx: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'bond_open', code, qty: 1, price: stock.price, total: betAmount,
        timestamp: Date.now(), playerName: player.name,
      }

      set(s => ({
        bonds: [bond, ...s.bonds],
        marketPool: s.marketPool + betAmount,
        transactions: [tx, ...s.transactions].slice(0, 50),
      }))

      return { success: true, message: `Opened ${direction.toUpperCase()} bond on ${code} @ $${stock.price} — ${duration.label}` }
    },

    closeBond: (bondId) => {
      const state = get()
      const bond = state.bonds.find(b => b.id === bondId && b.status === 'open')
      if (!bond) return { success: false, message: 'Bond not found or already closed' }

      const stock = state.stocks.find(s => s.code === bond.countryCode)
      if (!stock) return { success: false, message: 'Stock not found' }

      const closePrice = stock.price
      const priceWentUp = closePrice > bond.entryPrice
      const priceWentDown = closePrice < bond.entryPrice
      const won = (bond.direction === 'up' && priceWentUp) || (bond.direction === 'down' && priceWentDown)

      // Find matching duration multiplier
      const elapsed = Date.now() - bond.openedAt
      const matchDuration = BOND_DURATIONS.find(d => bond.expiresAt - bond.openedAt === d.ms)
      const multiplier = matchDuration?.multiplier || 1.5

      let payout = 0
      if (won) {
        payout = Math.floor(bond.betAmount * multiplier)
        // Pay from pool
        const actualPayout = Math.min(payout, state.marketPool)
        usePlayerStore.getState().earnMoney(actualPayout)
        payout = actualPayout
      }

      const tx: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'bond_close', code: bond.countryCode, qty: 1,
        price: closePrice, total: won ? payout : 0,
        pnl: won ? payout - bond.betAmount : -bond.betAmount,
        timestamp: Date.now(), playerName: usePlayerStore.getState().name,
      }

      set(s => ({
        bonds: s.bonds.map(b => b.id === bondId ? {
          ...b, status: won ? 'won' as const : 'lost' as const,
          closePrice, payout: won ? payout : 0,
        } : b),
        marketPool: won ? s.marketPool - payout : s.marketPool,
        transactions: [tx, ...s.transactions].slice(0, 50),
      }))

      if (won && payout >= 100_000) {
        useNewsStore.getState().pushEvent('economy',
          `${usePlayerStore.getState().name} won $${payout.toLocaleString()} on a ${bond.direction.toUpperCase()} bond!`
        )
      }

      return {
        success: true,
        message: won
          ? `WON! ${bond.direction.toUpperCase()} bond paid $${payout.toLocaleString()} (×${multiplier})`
          : `LOST! ${bond.direction.toUpperCase()} bond — price went ${priceWentUp ? 'UP' : priceWentDown ? 'DOWN' : 'FLAT'}`,
      }
    },

    resolveExpiredBonds: () => {
      const state = get()
      const now = Date.now()
      const expired = state.bonds.filter(b => b.status === 'open' && now >= b.expiresAt)

      expired.forEach(bond => {
        get().closeBond(bond.id)
      })
    },

    tickMarket: () => {
      // First resolve expired bonds
      get().resolveExpiredBonds()

      set(s => ({
        stocks: s.stocks.map(stock => {
          const volatility = 0.05
          const drift = 0.001
          const change = (Math.random() - 0.48 + drift) * stock.price * volatility
          const newPrice = Math.max(10, Math.floor(stock.price + change))
          const newTick: StockTick = { price: newPrice, timestamp: Date.now() }

          return {
            ...stock,
            prevPrice: stock.price,
            price: newPrice,
            history: [...stock.history.slice(-29), newTick],
          }
        }),
      }))
    },

    getStock: (code) => get().stocks.find(s => s.code === code),
    getHolding: (code) => get().portfolio.find(h => h.code === code),

    getPortfolioValue: () => {
      const stocks = get().stocks
      return get().portfolio.reduce((total, h) => {
        const stock = stocks.find(s => s.code === h.code)
        return total + (stock ? stock.price * h.shares : 0)
      }, 0)
    },
  }
})
