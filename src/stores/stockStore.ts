import { create } from 'zustand'
import { api } from '../api/client'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'
import { useCompanyStore } from './companyStore'
import { useArmyStore } from './army'
import { useBattleStore } from './battleStore'
import { useInventoryStore } from './inventoryStore'
import { useRegionStore } from './regionStore'
import { rateLimiter } from '../engine/AntiExploit'
import { useGovernmentStore } from './governmentStore'

import type { StockTick, CountryStock, Holding, StockTransaction, BondDirection, Bond } from '../types/stock.types'
export type { StockTick, CountryStock, Holding, BondDirection, Bond }

// Re-export Transaction with original name for backward compat
export type Transaction = StockTransaction
export type { StockTransaction }

const BOND_DURATIONS = [
  { label: '5 MIN',  ms:  5 * 60_000, multiplier: 1.5 },
  { label: '15 MIN', ms: 15 * 60_000, multiplier: 1.75 },
  { label: '30 MIN', ms: 30 * 60_000, multiplier: 2.0 },
]

export { BOND_DURATIONS }

// ══════════════════════════════════════════════
// FUNDAMENTALS-BASED PRICE CALCULATION
// Price = f(companies, regions, divisions, equipment, fire, treasury) / population
// ══════════════════════════════════════════════

const WEIGHTS = {
  companies:    15,      // economic engine — slow growth
  regions:      8,       // territorial expansion — war reward
  divisions:    5,       // military power — depletes in war
  equipment:    0.5,     // military resources — consumed in combat
  combatDamage: 0.002,   // fire/aggression — grows during war
  treasury:     0.00005, // national wealth — taxes/spending
  popDivisor:   0.0008,  // population normalization
} as const

export function calculateFundamentals(countryCode: string): number {
  // 1. Companies in this country
  const companies = useCompanyStore.getState().companies.filter(c => c.location === countryCode)
  const companyScore = companies.reduce((sum, c) => sum + c.level, 0)

  // 2. Regions controlled by this country
  const regions = useRegionStore.getState().regions.filter(r => r.controlledBy === countryCode)
  const regionScore = regions.length

  // 3. Military divisions belonging to this country (alive only)
  const allDivisions = Object.values(useArmyStore.getState().divisions)
  const countryDivs = allDivisions.filter(d => d.countryCode === countryCode && d.status !== 'destroyed')
  const divisionScore = countryDivs.reduce((sum, d) => sum + (d.manpower / Math.max(1, d.maxManpower)), 0)

  // 4. Equipment value — items assigned to country's divisions
  const items = useInventoryStore.getState().items
  const divIds = new Set(countryDivs.map(d => d.id))
  const equipmentScore = items
    .filter(i => i.location === 'division' && i.assignedToDivision && divIds.has(i.assignedToDivision))
    .reduce((sum, i) => {
      const tierValue = { t1: 10, t2: 25, t3: 50, t4: 100, t5: 200 }[i.tier as string] || 10
      return sum + tierValue * (i.durability / 100)
    }, 0)

  // 5. Combat damage dealt by this country (across all active battles)
  const battles = Object.values(useBattleStore.getState().battles)
  let combatDamage = 0
  battles.forEach(b => {
    if (b.status !== 'active') return
    if (b.attackerId === countryCode) combatDamage += (b.attacker.damageDealt || 0)
    if (b.defenderId === countryCode) combatDamage += (b.defender.damageDealt || 0)
  })

  // 6. Treasury (money in national fund)
  const country = useWorldStore.getState().getCountry(countryCode)
  const treasury = country?.fund.money || 0
  const population = country?.population || 1000

  // Composite value
  const rawValue = (
    companyScore   * WEIGHTS.companies +
    regionScore    * WEIGHTS.regions +
    divisionScore  * WEIGHTS.divisions +
    equipmentScore * WEIGHTS.equipment +
    combatDamage   * WEIGHTS.combatDamage +
    treasury       * WEIGHTS.treasury
  ) / (population * WEIGHTS.popDivisor)

  return Math.max(5, Math.floor(rawValue))
}

export interface StockState {
  stocks: CountryStock[]
  portfolio: Holding[]
  totalInvested: number
  totalRealized: number
  marketPool: number           // shared liquidity pool (legacy local)
  stockPool: number            // server-side stock pool balance
  bondPool: number             // server-side bond pool balance
  transactions: Transaction[]  // global transaction log
  bonds: Bond[]                // player's active/closed bonds
  lastSessionBoundaryAt: number // timestamp of last 12h session boundary
  lastResetBandAt: number       // timestamp of last 24h price correction

  fetchStocks: () => Promise<void>
  fetchHoldings: () => Promise<void>
  fetchPoolBalances: () => Promise<void>
  buyShares: (code: string, qty: number) => Promise<{ success: boolean; message: string }>
  sellShares: (holdingId: string) => Promise<{ success: boolean; message: string }>
  openBond: (code: string, direction: BondDirection, betAmount: number, durationIdx: number) => Promise<{ success: boolean; message: string }>
  closeBond: (bondId: string) => Promise<{ success: boolean; message: string }>
  resolveExpiredBonds: () => void
  tickMarket: () => void
  processSessionBoundary: () => void
  processResetBand: () => void
  getStock: (code: string) => CountryStock | undefined
  getHolding: (code: string) => Holding | undefined
  getPortfolioValue: () => number
}

export const useStockStore = create<StockState>((set, get) => {
  return {
    stocks: [],
    portfolio: [],
    totalInvested: 0,
    totalRealized: 0,
    marketPool: 0,
    stockPool: 0,
    bondPool: 0,
    transactions: [],
    bonds: [],
    lastSessionBoundaryAt: Date.now(),
    lastResetBandAt: Date.now(),

    // Fetch data from backend
    fetchStocks: async () => {
      try {
        const res: any = await api.get('/stock/prices')
        if (res.success && res.stocks) {
          const world = useWorldStore.getState()
          // Map DB models to frontend format (DB uses countryCode, frontend uses code)
          const mapped: CountryStock[] = res.stocks.map((s: any) => {
            const price = parseFloat(s.price)
            const country = world.getCountry(s.countryCode)
            return {
              code: s.countryCode,
              name: country?.name || s.countryCode,
              price,
              prevPrice: parseFloat(s.prevPrice || s.openPrice || s.price),
              history: typeof s.history === 'string' ? JSON.parse(s.history) : (s.history || [{ price, timestamp: Date.now() }]),
              volume: s.volume || 0,
              netBuyVolume: 0,
            }
          })
          set({ stocks: mapped })
        }
      } catch (e) { console.error('Error fetching stocks:', e) }
    },
    fetchHoldings: async () => {
      try {
        const res: any = await api.get('/stock/my-holdings')
        if (res.success && res.holdings) {
          const mapped = res.holdings.map((h: any) => ({
            id: h.id,
            code: h.countryCode,
            shares: h.shares,
            avgBuyPrice: parseFloat(h.buyPrice)
          }))
          set({ portfolio: mapped })
        }
      } catch (e) { console.error('Error fetching holdings:', e) }
    },
    fetchPoolBalances: async () => {
      try {
        const res: any = await api.get('/stock/pools')
        if (res.success) {
          set({ stockPool: res.stockPool ?? 0, bondPool: res.bondPool ?? 0 })
        }
      } catch (e) { console.error('Error fetching pool balances:', e) }
    },

    buyShares: async (code, qty) => {
      if (!rateLimiter.check('stock.buy')) return { success: false, message: 'Too fast! Wait a moment.' }
      if (qty <= 0) return { success: false, message: 'Invalid quantity' }

      // Embargo check
      const playerCountry = usePlayerStore.getState().countryCode || 'US'
      const gov = useGovernmentStore.getState().governments[playerCountry]
      if (gov && (gov.embargoes || []).includes(code)) {
        return { success: false, message: `🚫 Embargo in effect — cannot buy ${code} stocks during war` }
      }

      try {
        const res: any = await api.post('/stock/buy', { countryCode: code, shares: qty })
        if (res.success) {
          await get().fetchStocks()
          await get().fetchHoldings()
          usePlayerStore.setState({ money: res.newBalance })
          return { success: true, message: res.message }
        }
        return { success: false, message: 'Could not buy shares' }
      } catch (e: any) {
        return { success: false, message: e.message || 'Error buying shares' }
      }
    },

    sellShares: async (holdingId) => {
      if (!rateLimiter.check('stock.sell')) return { success: false, message: 'Too fast! Wait a moment.' }

      // Embargo check — look up the holding's country code
      const holding = get().portfolio.find(h => h.id === holdingId)
      if (holding) {
        const playerCountry = usePlayerStore.getState().countryCode || 'US'
        const gov = useGovernmentStore.getState().governments[playerCountry]
        if (gov && (gov.embargoes || []).includes(holding.code)) {
          return { success: false, message: `🚫 Embargo in effect — cannot sell ${holding.code} stocks during war` }
        }
      }

      try {
        const res: any = await api.post('/stock/sell', { holdingId })
        if (res.success) {
          await get().fetchStocks()
          await get().fetchHoldings()
          // Sync from backend balance — no earnMoney() money creation
          usePlayerStore.setState({ money: res.newBalance })
          await get().fetchPoolBalances()
          return { success: true, message: res.message }
        }
        return { success: false, message: res.error || 'Could not sell shares' }
      } catch (e: any) {
        return { success: false, message: e.message || 'Error selling shares' }
      }
    },

    // ── Binary Options Bonds ──

    openBond: async (code, direction, betAmount, durationIdx) => {
      if (!rateLimiter.check('stock.bond')) return { success: false, message: 'Too fast! Wait a moment.' }

      // Embargo check
      const playerCountry = usePlayerStore.getState().countryCode || 'US'
      const govCheck = useGovernmentStore.getState().governments[playerCountry]
      if (govCheck && (govCheck.embargoes || []).includes(code)) {
        return { success: false, message: `🚫 Embargo in effect — cannot open bonds on ${code} during war` }
      }

      const player = usePlayerStore.getState()
      const stock = get().stocks.find(s => s.code === code)
      if (!stock) return { success: false, message: 'Stock not found' }
      if (betAmount < 10_000) return { success: false, message: 'Minimum bet: $10,000' }
      if (player.money < betAmount) return { success: false, message: 'Insufficient funds' }

      const duration = BOND_DURATIONS[durationIdx]
      if (!duration) return { success: false, message: 'Invalid duration' }

      // Map duration index to API duration string
      const durationMap: Record<number, string> = { 0: '5', 1: '15', 2: '30' }

      try {
        const res: any = await api.post('/stock/bond/open', {
          countryCode: code,
          direction,
          amount: betAmount,
          duration: durationMap[durationIdx] || '5',
        })
        if (res.success) {
          // Sync player money from backend
          usePlayerStore.setState({ money: player.money - betAmount })
          await get().fetchPoolBalances()

          // Add bond to local state
          const bond: Bond = {
            id: res.bond?.id || `bond_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
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
            transactions: [tx, ...s.transactions].slice(0, 50),
          }))

          return { success: true, message: res.message || `Opened ${direction.toUpperCase()} bond on ${code} @ $${stock.price} — ${duration.label}` }
        }
        return { success: false, message: res.error || 'Could not open bond' }
      } catch (e: any) {
        return { success: false, message: e.message || 'Error opening bond' }
      }
    },

    closeBond: async (bondId) => {
      const state = get()
      const bond = state.bonds.find(b => b.id === bondId && b.status === 'open')
      if (!bond) return { success: false, message: 'Bond not found or already closed' }

      // Bonds cannot be closed early — must wait for expiry
      const now = Date.now()
      if (now < bond.expiresAt) {
        const remaining = Math.ceil((bond.expiresAt - now) / 1000)
        const min = Math.floor(remaining / 60)
        const sec = remaining % 60
        return { success: false, message: `Bond locked — ${min}:${sec.toString().padStart(2, '0')} remaining` }
      }

      try {
        const res: any = await api.post('/stock/bond/settle', { bondId })
        if (res.success) {
          const won = res.won
          const payout = res.payout || 0

          // Sync from backend balance
          if (won && res.newBalance !== undefined) {
            usePlayerStore.setState({ money: res.newBalance })
          }
          await get().fetchPoolBalances()

          const stock = state.stocks.find(s => s.code === bond.countryCode)
          const closePrice = stock?.price ?? bond.entryPrice

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
            transactions: [tx, ...s.transactions].slice(0, 50),
          }))

          if (won && payout >= 100_000) {
            useNewsStore.getState().pushEvent('economy',
              `${usePlayerStore.getState().name} won $${payout.toLocaleString()} on a ${bond.direction.toUpperCase()} bond!`
            )
          }

          return {
            success: true,
            message: res.message || (won
              ? `WON! ${bond.direction.toUpperCase()} bond paid $${payout.toLocaleString()}`
              : `LOST! ${bond.direction.toUpperCase()} bond — better luck next time`),
          }
        }
        return { success: false, message: res.error || 'Could not settle bond' }
      } catch (e: any) {
        return { success: false, message: e.message || 'Error settling bond' }
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

      // Auto-seed: if stocks array is empty, populate from world countries
      if (get().stocks.length === 0) {
        const world = useWorldStore.getState()
        const countries = world.countries
        if (countries.length > 0) {
          const now = Date.now()
          const newStocks: CountryStock[] = countries.map(c => {
            const fundamental = calculateFundamentals(c.code)
            const price = Math.max(5, fundamental)
            // Seed 5 ticks of history with small variance
            const history: StockTick[] = Array.from({ length: 5 }, (_, i) => ({
              price: Math.max(5, Math.floor(price * (1 + (Math.random() - 0.5) * 0.06))),
              timestamp: now - (5 - i) * 60000,
            }))
            history.push({ price, timestamp: now })
            return {
              code: c.code,
              name: c.name,
              price,
              prevPrice: price,
              history,
              volume: 0,
              netBuyVolume: 0,
            }
          })
          set({ stocks: newStocks })
        }
        return // skip the normal tick this round — stocks were just seeded
      }

      set(s => ({
        stocks: s.stocks.map(stock => {
          // 1. Fundamentals-driven base price
          const fundamental = calculateFundamentals(stock.code)

          // 2. Volume pressure: net buy volume shifts price
          const volumePressure = (stock.netBuyVolume / 1000) * 0.5

          // 3. Small noise (±1.5% with slight upward drift)
          const noise = (Math.random() - 0.48) * stock.price * 0.03

          // 4. Blend: 70% fundamentals, 30% previous price (smooth transitions)
          const blended = fundamental * 0.7 + stock.price * 0.3
          const newPrice = Math.max(5, Math.floor(blended + volumePressure + noise))
          const newTick: StockTick = { price: newPrice, timestamp: Date.now() }

          // Decay volume pressure 10% per tick (mean-reversion)
          const decayedVolume = Math.floor(stock.netBuyVolume * 0.9)

          return {
            ...stock,
            prevPrice: stock.price,
            price: newPrice,
            netBuyVolume: decayedVolume,
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

    processSessionBoundary: () => {
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
      const now = Date.now()
      const state = get()
      if (now - state.lastSessionBoundaryAt < TWELVE_HOURS_MS) return

      // Auto-resolve all open bonds at session boundary
      const openBonds = state.bonds.filter(b => b.status === 'open')
      openBonds.forEach(bond => get().closeBond(bond.id))

      // Apply macro health shifts to each stock
      const world = useWorldStore.getState()
      const activeWars = world.wars.filter(w => w.status === 'active')
      const warCountries = new Set<string>()
      activeWars.forEach(w => {
        warCountries.add(w.attacker)
        warCountries.add(w.defender)
      })

      set(s => ({
        stocks: s.stocks.map(stock => {
          const country = world.getCountry(stock.code)
          if (!country) return stock

          let shift = 0
          if (warCountries.has(stock.code)) {
            // At war: 5-15% drop
            shift = -(0.05 + Math.random() * 0.10)
          } else {
            // Peace: 2-8% gain (weighted by treasury health)
            const treasuryHealth = Math.min(1, country.fund.money / 20_000_000)
            shift = (0.02 + Math.random() * 0.06) * (0.5 + treasuryHealth * 0.5)
          }

          const newPrice = Math.max(5, Math.floor(stock.price * (1 + shift)))
          const newTick: StockTick = { price: newPrice, timestamp: now }

          return {
            ...stock,
            prevPrice: stock.price,
            price: newPrice,
            history: [...stock.history.slice(-29), newTick],
          }
        }),
        lastSessionBoundaryAt: now,
      }))

      useNewsStore.getState().pushEvent('economy', '📊 Stock market session boundary — prices adjusted based on country health')
    },

    processResetBand: () => {
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
      const now = Date.now()
      const state = get()
      if (now - state.lastResetBandAt < TWENTY_FOUR_HOURS_MS) return

      // 50% chance of triggering
      if (Math.random() > 0.5) {
        set({ lastResetBandAt: now })
        return
      }

      set(s => ({
        lastResetBandAt: now,
        stocks: s.stocks.map(stock => {
          // Calculate 7-day moving average from history
          const recentPrices = stock.history.slice(-30) // ~30 ticks ≈ several days
          if (recentPrices.length < 5) return stock

          const avg = recentPrices.reduce((sum, t) => sum + t.price, 0) / recentPrices.length
          const deviation = (stock.price - avg) / avg

          // Only correct if deviation exceeds 30%
          if (Math.abs(deviation) < 0.30) return stock

          // Pull 10% toward the mean
          const correction = (avg - stock.price) * 0.10
          const newPrice = Math.max(5, Math.floor(stock.price + correction))
          const newTick: StockTick = { price: newPrice, timestamp: now }

          return {
            ...stock,
            prevPrice: stock.price,
            price: newPrice,
            history: [...stock.history.slice(-29), newTick],
          }
        }),
      }))

      useNewsStore.getState().pushEvent('economy', '📉 Market stabilization: extreme price deviations corrected')
    },
  }
})
