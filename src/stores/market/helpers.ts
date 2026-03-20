// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Shared Helpers
// ══════════════════════════════════════════════════════════════════

import { usePlayerStore } from '../playerStore'
import type { ResourceDef, MarketTicker, ResourceId } from './types'

/** Generate a unique prefixed ID */
export function mkId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Create an initial ticker for a resource */
export function mkTicker(id: ResourceId, price: number): MarketTicker {
  return {
    resourceId: id,
    price,
    change24h: +(Math.random() * 8 - 4).toFixed(1),
    volume: Math.floor(5000 + Math.random() * 100000),
    high24h: +(price * (1 + Math.random() * 0.05)).toFixed(2),
    low24h: +(price * (1 - Math.random() * 0.05)).toFixed(2),
    priceHistory: Array.from({ length: 24 }, () =>
      +(price * (0.94 + Math.random() * 0.12)).toFixed(2)
    ),
    recentBuyVolume: 0,
    recentSellVolume: 0,
  }
}

/**
 * Type-safe getter for player resources by dynamic key.
 */
export function getPlayerResource(def: ResourceDef): number {
  const player = usePlayerStore.getState()
  return (player as unknown as Record<string, number>)[def.playerKey] ?? 0
}

/**
 * Type-safe setter for player resources by dynamic key.
 * Adjusts the value by `delta` (positive = add, negative = subtract).
 */
export function adjustPlayerResource(def: ResourceDef, delta: number): void {
  usePlayerStore.setState(s => ({
    [def.playerKey]: Math.max(0, ((s as unknown as Record<string, number>)[def.playerKey] ?? 0) + delta),
  } as any))
}

/** Round to 2 decimal places to avoid floating point artifacts */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
