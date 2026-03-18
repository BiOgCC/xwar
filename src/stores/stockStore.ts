import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR — Stock Market Store
   Country-based shares, price fluctuation, buy/sell
   ══════════════════════════════════════════════ */

export interface StockTick {
  price: number
  timestamp: number
}

export interface CountryStock {
  code: string
  name: string
  price: number         // current price per share
  prevPrice: number     // previous tick price
  history: StockTick[]  // price history (last 30 ticks)
  volume: number        // total traded this session
}

export interface Holding {
  code: string
  shares: number
  avgBuyPrice: number
}

// Major economies for the stock market
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

// Generate initial price with slight randomness
function initPrice(base: number): number {
  return Math.floor(base * (0.9 + Math.random() * 0.2))
}

// Initial history with some natural-looking variation
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

const TX_TAX_RATE = 0.02 // 2% transaction tax

export interface StockState {
  stocks: CountryStock[]
  portfolio: Holding[]
  totalInvested: number
  totalRealized: number

  buyShares: (code: string, qty: number) => { success: boolean; message: string }
  sellShares: (code: string, qty: number) => { success: boolean; message: string }
  tickMarket: () => void
  getStock: (code: string) => CountryStock | undefined
  getHolding: (code: string) => Holding | undefined
  getPortfolioValue: () => number
}

export const useStockStore = create<StockState>((set, get) => {
  // Initialize stocks
  const initialStocks: CountryStock[] = STOCK_COUNTRIES.map(sc => {
    const price = initPrice(sc.basePrice)
    return {
      code: sc.code,
      name: sc.name,
      price,
      prevPrice: price,
      history: initHistory(price),
      volume: 0,
    }
  })

  return {
    stocks: initialStocks,
    portfolio: [],
    totalInvested: 0,
    totalRealized: 0,

    buyShares: (code, qty) => {
      if (qty <= 0) return { success: false, message: 'Invalid quantity' }

      const stock = get().stocks.find(s => s.code === code)
      if (!stock) return { success: false, message: 'Stock not found' }

      const totalCost = stock.price * qty
      const tax = Math.floor(totalCost * TX_TAX_RATE)
      const totalWithTax = totalCost + tax

      const player = usePlayerStore.getState()
      if (player.money < totalWithTax) {
        return { success: false, message: `Need $${totalWithTax.toLocaleString()} (incl. 2% tax)` }
      }

      // Deduct money
      player.spendMoney(totalWithTax)

      // Tax to country treasury
      useWorldStore.getState().addTreasuryTax(code, tax)

      // Update portfolio
      set(s => {
        const existing = s.portfolio.find(h => h.code === code)
        let newPortfolio: Holding[]

        if (existing) {
          const totalShares = existing.shares + qty
          const avgPrice = Math.floor((existing.avgBuyPrice * existing.shares + stock.price * qty) / totalShares)
          newPortfolio = s.portfolio.map(h =>
            h.code === code ? { ...h, shares: totalShares, avgBuyPrice: avgPrice } : h
          )
        } else {
          newPortfolio = [...s.portfolio, { code, shares: qty, avgBuyPrice: stock.price }]
        }

        // Bump volume
        const newStocks = s.stocks.map(st =>
          st.code === code ? { ...st, volume: st.volume + qty } : st
        )

        return {
          portfolio: newPortfolio,
          stocks: newStocks,
          totalInvested: s.totalInvested + totalCost,
        }
      })

      // News for big buys (100+ shares)
      if (qty >= 100) {
        const playerName = usePlayerStore.getState().name
        useNewsStore.getState().pushEvent('economy',
          `${playerName} bought ${qty} shares of ${stock.name} at $${stock.price}/share`
        )
      }

      return { success: true, message: `Bought ${qty} ${code} @ $${stock.price} (-$${tax.toLocaleString()} tax)` }
    },

    sellShares: (code, qty) => {
      if (qty <= 0) return { success: false, message: 'Invalid quantity' }

      const holding = get().portfolio.find(h => h.code === code)
      if (!holding || holding.shares < qty) {
        return { success: false, message: 'Insufficient shares' }
      }

      const stock = get().stocks.find(s => s.code === code)
      if (!stock) return { success: false, message: 'Stock not found' }

      const totalRevenue = stock.price * qty
      const tax = Math.floor(totalRevenue * TX_TAX_RATE)
      const netRevenue = totalRevenue - tax

      // Pay player (from thin air)
      usePlayerStore.getState().earnMoney(netRevenue)

      // Tax to country treasury
      useWorldStore.getState().addTreasuryTax(code, tax)

      set(s => {
        let newPortfolio: Holding[]
        if (holding.shares === qty) {
          newPortfolio = s.portfolio.filter(h => h.code !== code)
        } else {
          newPortfolio = s.portfolio.map(h =>
            h.code === code ? { ...h, shares: h.shares - qty } : h
          )
        }

        const newStocks = s.stocks.map(st =>
          st.code === code ? { ...st, volume: st.volume + qty } : st
        )

        return {
          portfolio: newPortfolio,
          stocks: newStocks,
          totalRealized: s.totalRealized + netRevenue,
        }
      })

      // News for big sells
      if (qty >= 100) {
        const playerName = usePlayerStore.getState().name
        useNewsStore.getState().pushEvent('economy',
          `${playerName} sold ${qty} shares of ${stock.name} at $${stock.price}/share`
        )
      }

      return { success: true, message: `Sold ${qty} ${code} @ $${stock.price} (-$${tax.toLocaleString()} tax)` }
    },

    tickMarket: () => {
      set(s => ({
        stocks: s.stocks.map(stock => {
          // Price change: ±5% random walk with slight upward bias
          const volatility = 0.05
          const drift = 0.001 // tiny upward bias
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
