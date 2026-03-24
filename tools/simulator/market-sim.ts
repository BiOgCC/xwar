// ══════════════════════════════════════════════════════════════
// DETERMINISTIC FLOW SIMULATOR — Market (Pure Supply/Demand)
// No noise. Price = f(supply, demand, mean_reversion). Identical every run.
// ══════════════════════════════════════════════════════════════

import type { SimMarketTicker, SimMarketOrder, SimStock } from './types'

const TAX_RATE = 0.01

// ── Resource definitions ──
export const RESOURCE_DEFS = [
  { id: 'oil',       basePrice: 0.16,  category: 'Construction' },
  { id: 'scrap',     basePrice: 0.22,  category: 'Construction' },
  { id: 'materialX', basePrice: 1.62,  category: 'Construction' },
  { id: 'bitcoin',   basePrice: 85.00, category: 'Construction' },
  { id: 'bread',     basePrice: 1.81,  category: 'Food' },
  { id: 'steak',     basePrice: 3.50,  category: 'Food' },
  { id: 'sushi',     basePrice: 7.19,  category: 'Food' },
  { id: 'fish',      basePrice: 3.44,  category: 'Food' },
  { id: 'wagyu',     basePrice: 9.50,  category: 'Food' },
  { id: 'wheat',     basePrice: 0.08,  category: 'Food' },
  { id: 'blueBullets',   basePrice: 0.62, category: 'Ammo' },
  { id: 'greenBullets',  basePrice: 0.17, category: 'Ammo' },
  { id: 'purpleBullets', basePrice: 2.51, category: 'Ammo' },
  { id: 'redBullets',    basePrice: 0.08, category: 'Ammo' },
  { id: 'lootBoxes',     basePrice: 34.79, category: 'Cases' },
  { id: 'militaryBoxes', basePrice: 3.46,  category: 'Cases' },
  { id: 'badgesOfHonor', basePrice: 15.00, category: 'Military' },
  { id: 'magicTea',  basePrice: 31.70, category: 'Buffs' },
  { id: 'energyLeaves',  basePrice: 0.07,  category: 'Buffs' },
] as const

export class SimMarket {
  tickers: Record<string, SimMarketTicker> = {}
  totalTaxCollected = 0

  // Track net buy/sell pressure per resource per tick (deterministic)
  private netDemand: Record<string, number> = {}

  constructor() {
    RESOURCE_DEFS.forEach(r => {
      this.tickers[r.id] = {
        resourceId: r.id,
        price: r.basePrice,
        basePrice: r.basePrice,
        priceHistory: Array(24).fill(r.basePrice),
        totalVolumeBuy: 0,
        totalVolumeSell: 0,
        recentBuyVolume: 0,
        recentSellVolume: 0,
      }
      this.netDemand[r.id] = 0
    })
  }

  getPrice(resourceId: string): number {
    return this.tickers[resourceId]?.price ?? 0
  }

  /** Record a deterministic buy/sell (no order matching, just price pressure) */
  placeOrder(order: Omit<SimMarketOrder, 'id'>): { filled: boolean; tax: number } {
    const ticker = this.tickers[order.resourceId]
    if (!ticker) return { filled: false, tax: 0 }

    if (order.type === 'buy') {
      ticker.recentBuyVolume += order.amount
      ticker.totalVolumeBuy += order.amount
      this.netDemand[order.resourceId] += order.amount
    } else {
      ticker.recentSellVolume += order.amount
      ticker.totalVolumeSell += order.amount
      this.netDemand[order.resourceId] -= order.amount
    }

    const total = order.amount * order.pricePerUnit
    const tax = Math.floor(total * TAX_RATE)
    this.totalTaxCollected += tax
    return { filled: true, tax }
  }

  /**
   * Deterministic price tick.
   * newPrice = price + meanReversion + supplyDemandPressure
   * NO random noise.
   */
  tickPrices(): void {
    for (const id of Object.keys(this.tickers)) {
      const t = this.tickers[id]

      // Mean reversion: 5% pull toward historical average
      const avg = t.priceHistory.reduce((a, b) => a + b, 0) / t.priceHistory.length
      const reversion = (avg - t.price) * 0.05

      // Supply/demand: net demand moves price proportionally
      const totalVol = t.recentBuyVolume + t.recentSellVolume
      let pressure = 0
      if (totalVol > 0) {
        const netBias = (t.recentBuyVolume - t.recentSellVolume) / totalVol
        pressure = netBias * 0.03 * t.price
      }

      // No noise — deterministic only
      const newPrice = Math.max(0.01, +(t.price + reversion + pressure).toFixed(2))
      t.priceHistory = [...t.priceHistory.slice(1), newPrice]
      t.price = newPrice

      // Reset
      t.recentBuyVolume = 0
      t.recentSellVolume = 0
      this.netDemand[id] = 0
    }
  }

  getPriceSnapshot(): Record<string, number> {
    const snap: Record<string, number> = {}
    for (const [id, t] of Object.entries(this.tickers)) snap[id] = t.price
    return snap
  }
}

// ── Stock Simulation (deterministic) ──

export class SimStockMarket {
  stocks: SimStock[] = []

  constructor(countryCodes: string[]) {
    // Deterministic starting prices based on country code hash
    this.stocks = countryCodes.map((code, i) => ({
      code,
      price: 100 + i * 15,    // deterministic spread
      history: Array(6).fill(100 + i * 15),
      fundamentalScore: 100,
    }))
  }

  /** Deterministic stock price tick: price = 0.7 × fundamental + 0.3 × current ± war penalty */
  tickPrices(countryMetrics: Record<string, { divisions: number; companies: number; treasury: number; atWar: boolean; population: number }>): void {
    this.stocks.forEach(stock => {
      const cm = countryMetrics[stock.code]
      if (!cm) return

      const fundamental = Math.max(5, Math.floor(
        (cm.companies * 15 + cm.divisions * 5 + cm.treasury * 0.00005) / (cm.population * 0.0008)
      ))
      stock.fundamentalScore = fundamental

      const blended = fundamental * 0.7 + stock.price * 0.3
      const warEffect = cm.atWar ? -stock.price * 0.02 : stock.price * 0.01
      const newPrice = Math.max(5, Math.floor(blended + warEffect))

      stock.history = [...stock.history.slice(-29), newPrice]
      stock.price = newPrice
    })
  }

  getPriceSnapshot(): Record<string, number> {
    const snap: Record<string, number> = {}
    this.stocks.forEach(s => { snap[s.code] = s.price })
    return snap
  }
}
