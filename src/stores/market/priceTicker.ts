// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Price Ticker (supply/demand-driven simulation)
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import type { MarketState, ResourceId } from './types'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

/**
 * Tick all resource prices. Combines:
 * 1. Mean-reversion toward historical average
 * 2. Supply/demand pressure from recent buy vs sell volume
 * 3. Random noise (capped)
 *
 * Resets recentBuyVolume / recentSellVolume each tick.
 */
export function tickPrices(set: Set, get: Get): void {
  set(state => {
    const newTickers = { ...state.tickers }

    for (const id of Object.keys(newTickers) as ResourceId[]) {
      const t = newTickers[id]

      // ── Mean reversion ──
      const avg = t.priceHistory.reduce((a, b) => a + b, 0) / t.priceHistory.length
      const reversion = (avg - t.price) * 0.05

      // ── Supply / demand pressure ──
      const totalRecentVol = t.recentBuyVolume + t.recentSellVolume
      let pressure = 0
      if (totalRecentVol > 0) {
        // Normalized net buy pressure: +1 = all buys, -1 = all sells
        const netBias = (t.recentBuyVolume - t.recentSellVolume) / totalRecentVol
        pressure = netBias * 0.03 * t.price  // up to ±3% push per tick
      }

      // ── Random noise ──
      const noise = (Math.random() - 0.5) * 0.04 * t.price

      // ── Compute new price ──
      const newPrice = Math.max(0.01, +(t.price + reversion + pressure + noise).toFixed(2))
      const oldBase = t.priceHistory[0] || t.price

      const updatedHistory = [...t.priceHistory.slice(1), newPrice]
      newTickers[id] = {
        ...t,
        price: newPrice,
        change24h: +((newPrice / oldBase - 1) * 100).toFixed(1),
        volume: t.volume + Math.floor(Math.random() * 500),
        // Derive high/low from sliding window instead of accumulating
        high24h: Math.max(...updatedHistory),
        low24h: Math.min(...updatedHistory),
        priceHistory: updatedHistory,
        // Reset volume tracking for next window
        recentBuyVolume: 0,
        recentSellVolume: 0,
      }
    }

    return { tickers: newTickers }
  })
}
