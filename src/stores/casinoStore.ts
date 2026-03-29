import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'
import { useInventoryStore, WEAPON_SUBTYPES } from './inventoryStore'
import type { EquipTier, EquipSlot, EquipItem } from './inventoryStore'

/* ══════════════════════════════════════════════
   XWAR Warzone Casino — Tiered Reward Tables
   ══════════════════════════════════════════════ */

const C1 = '#d4a017' // golden yellow
const C2 = '#2d2d2d' // dark gray
const C3 = '#6b7280' // clear gray

export interface WheelSegment {
  label: string
  type: 'multiply' | 'item' | 'bankrupt'
  multiplier: number
  itemTier?: EquipTier
  color: string
  bgColor: string
  probability: number
}

// ─── $50K TABLE ─── Conservative: small multipliers, T4 items, ~90% return
// EV ≈ (28%×1.5 + 18%×2 + 8%×3 + 14% items) ≈ 0.42+0.36+0.24 = ~0.90 + items
const WHEEL_50K: WheelSegment[] = [
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C1, probability: 18 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 7 },
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C3, probability: 12 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C1, probability: 6 },
  { label: 'T4 ITEM',  type: 'item',     multiplier: 0,    color: '#a78bfa', bgColor: C2, probability: 8,  itemTier: 't4' },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C3, probability: 6 },
  { label: '×3',       type: 'multiply', multiplier: 3,    color: '#fbbf24', bgColor: C1, probability: 8 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 7 },
  { label: 'T4 ITEM',  type: 'item',     multiplier: 0,    color: '#a78bfa', bgColor: C3, probability: 6,  itemTier: 't4' },
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C1, probability: 10 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 6 },
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C3, probability: 6 },
]

// ─── $250K TABLE ─── Balanced: mid multipliers, T4+T5 items, ~88% return
// EV ≈ (22%×1.5 + 10%×2 + 8%×3 + 4%×5 + 12% items) ≈ 0.33+0.20+0.24+0.20 = ~0.88 + items
const WHEEL_250K: WheelSegment[] = [
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C1, probability: 10 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 8 },
  { label: '×3',       type: 'multiply', multiplier: 3,    color: '#fbbf24', bgColor: C3, probability: 8 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C1, probability: 8 },
  { label: 'T4 ITEM',  type: 'item',     multiplier: 0,    color: '#a78bfa', bgColor: C2, probability: 7,  itemTier: 't4' },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C3, probability: 8 },
  { label: '×5',       type: 'multiply', multiplier: 5,    color: '#fbbf24', bgColor: C1, probability: 4 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 7 },
  { label: 'T5 ITEM',  type: 'item',     multiplier: 0,    color: '#c084fc', bgColor: C3, probability: 5,  itemTier: 't5' },
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C1, probability: 12 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 7 },
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C3, probability: 10 },
]

// ─── $500K TABLE ─── High risk: big multipliers, T5+T6 items, ~88% return
// EV ≈ (14%×2 + 8%×3 + 5%×5 + 3%×10 + 8% items) ≈ 0.28+0.24+0.25+0.30 = ~0.88 + items
const WHEEL_500K: WheelSegment[] = [
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C1, probability: 10 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 9 },
  { label: '×3',       type: 'multiply', multiplier: 3,    color: '#fbbf24', bgColor: C3, probability: 8 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C1, probability: 9 },
  { label: 'T5 ITEM',  type: 'item',     multiplier: 0,    color: '#c084fc', bgColor: C2, probability: 5,  itemTier: 't5' },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C3, probability: 9 },
  { label: '×5',       type: 'multiply', multiplier: 5,    color: '#fbbf24', bgColor: C1, probability: 5 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 9 },
  { label: 'T6 ITEM',  type: 'item',     multiplier: 0,    color: '#f0abfc', bgColor: C3, probability: 3,  itemTier: 't6' },
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C1, probability: 4 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 9 },
  { label: '×10',      type: 'multiply', multiplier: 10,   color: '#f0abfc', bgColor: C3, probability: 3 },
]

export const BET_TIERS = [
  { amount: 100_000,   label: '$100K' },
  { amount: 250_000,   label: '$250K' },
  { amount: 500_000,   label: '$500K' },
]

// Map bet amount → its wheel segments
export const TIER_WHEELS: Record<number, WheelSegment[]> = {
  100_000: WHEEL_50K,
  250_000: WHEEL_250K,
  500_000: WHEEL_500K,
}

export function getSegmentsForBet(bet: number): WheelSegment[] {
  return TIER_WHEELS[bet] || WHEEL_50K
}

// Weighted random pick for a given segments array
function weightedRandomIndex(segments: WheelSegment[]): number {
  const totalWeight = segments.reduce((sum, s) => sum + s.probability, 0)
  let roll = Math.random() * totalWeight
  for (let i = 0; i < segments.length; i++) {
    roll -= segments[i].probability
    if (roll <= 0) return i
  }
  return segments.length - 1
}

export type CasinoPhase = 'idle' | 'spinning' | 'result'

export interface CasinoState {
  phase: CasinoPhase
  currentBet: number
  targetAngle: number
  resultIndex: number
  activeSegments: WheelSegment[]
  lastWinText: string
  lastWinAmount: string
  lastWinType: 'win' | 'lose' | null
  lastWonItem: EquipItem | null
  history: { segment: WheelSegment; bet: number }[]
  totalSpins: number
  totalWon: number
  totalLost: number
  casinoPool: number
  // Server-resolved outcome (do NOT use for local money/item grants)
  _serverPayout: number
  _serverItem: EquipItem | null
  spinForBet: (betAmount: number) => void
  resolveResult: () => void
  resetCasino: () => void
}

let spinCounter = 0

export const useCasinoStore = create<CasinoState>((set, get) => ({
  phase: 'idle',
  currentBet: 0,
  targetAngle: 0,
  resultIndex: 0,
  activeSegments: WHEEL_50K,
  lastWinText: '',
  lastWinAmount: '',
  lastWinType: null,
  lastWonItem: null,
  history: [],
  totalSpins: 0,
  totalWon: 0,
  totalLost: 0,
  casinoPool: 5_000_000,  // Seeded at $5M — losers fund winners
  _serverPayout: 0,
  _serverItem: null,

  spinForBet: (betAmount: number) => {
    const player = usePlayerStore.getState()
    if (player.money < betAmount || get().phase === 'spinning') return

    const segments = getSegmentsForBet(betAmount)
    const segCount = segments.length
    const segAngle = 360 / segCount

    // Start spinning immediately with a placeholder index (will be replaced when server responds)
    const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360
    spinCounter++

    set({
      phase: 'spinning',
      currentBet: betAmount,
      activeSegments: segments,
      _serverPayout: 0,
      _serverItem: null,
    })

    // Call backend — server deducts money, rolls RNG, inserts item to DB
    import('../api/client').then(async ({ casinoWheelSpin }) => {
      try {
        const res: any = await casinoWheelSpin(betAmount)
        // res = { index, segment, payout, resultType, itemTier, item? }
        const idx: number = typeof res.index === 'number' ? res.index : 0
        const targetSegCenter = idx * segAngle + segAngle / 2
        const landAngle = 360 - targetSegCenter
        const finalAngle = fullSpins + landAngle + spinCounter * 360 * 10

        set({
          targetAngle: finalAngle,
          resultIndex: idx,
          _serverPayout: res.payout ?? 0,
          _serverItem: res.item ?? null,
        })

        // Deduct money from local state immediately (server already deducted)
        player.spendMoney(betAmount)
        player.incrementCasinoSpins()
      } catch (err: any) {
        // Spin failed (e.g. insufficient funds server-side) — cancel
        console.error('[Casino] Wheel spin failed:', err.message)
        set({ phase: 'idle' })
      }
    })
  },

  resolveResult: () => {
    const s = get()
    if (s.phase !== 'spinning') return

    const segment = s.activeSegments[s.resultIndex]
    const player = usePlayerStore.getState()

    let winText = ''
    let winAmount = ''
    let winType: 'win' | 'lose' = 'win'

    switch (segment.type) {
      case 'multiply': {
        // Apply server-validated payout (never trust client calculation)
        const payout = s._serverPayout
        if (payout > 0) {
          player.earnMoney(payout)
        }
        winText = 'YOU WON!'
        winAmount = `$${payout.toLocaleString()}`
        break
      }
      case 'item': {
        // Item was inserted in DB by the server; add to local inventory from server response
        const item = s._serverItem
        if (item) {
          useInventoryStore.getState().addItem(item)
          set({ lastWonItem: item })
          winAmount = `${(item.tier || '').toUpperCase()} ${(item.slot || '').toUpperCase()}`
        } else {
          winAmount = segment.label
        }
        winText = 'JACKPOT!'
        break
      }
      case 'bankrupt': {
        // Money already deducted server-side
        winText = 'BANKRUPT!'
        winAmount = `LOST $${s.currentBet.toLocaleString()}`
        winType = 'lose'
        player.addCasinoLoss(s.currentBet)
        break
      }
    }

    // Push to news ticker
    if (winType === 'win') {
      const betLabel = BET_TIERS.find(t => t.amount === s.currentBet)?.label || `$${s.currentBet.toLocaleString()}`
      if (segment.type === 'item') {
        useNewsStore.getState().pushEvent('casino', `${player.name} hit JACKPOT on ${betLabel} bet — won ${winAmount}!`)
      } else if (segment.multiplier >= 5) {
        useNewsStore.getState().pushEvent('casino', `${player.name} won BIG at the casino — ${winAmount} on a ${betLabel} bet!`)
      }
    }

    set(prev => ({
      phase: 'result',
      lastWinText: winText,
      lastWinAmount: winAmount,
      lastWinType: winType,
      totalSpins: prev.totalSpins + 1,
      totalWon: winType === 'win' ? prev.totalWon + 1 : prev.totalWon,
      totalLost: winType === 'lose' ? prev.totalLost + 1 : prev.totalLost,
      history: [
        { segment, bet: prev.currentBet },
        ...prev.history,
      ].slice(0, 15),
    }))
  },

  resetCasino: () => {
    set({
      phase: 'idle',
      currentBet: 0,
      lastWinText: '',
      lastWinAmount: '',
      lastWinType: null,
      lastWonItem: null,
    })
  },
}))
