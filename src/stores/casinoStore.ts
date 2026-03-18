import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useInventoryStore, generateStats, WEAPON_SUBTYPES } from './inventoryStore'
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

// ─── $50K TABLE ─── Conservative: small multipliers, T4 items, ~88% return
// EV ≈ (25%×1.5 + 15%×2 + 5%×3 + 13% items) = 0.375+0.30+0.15 = 0.825 + items
const WHEEL_50K: WheelSegment[] = [
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C1, probability: 15 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 9 },
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C3, probability: 10 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C1, probability: 9 },
  { label: 'T4 ITEM',  type: 'item',     multiplier: 0,    color: '#a78bfa', bgColor: C2, probability: 8,  itemTier: 't4' },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C3, probability: 8 },
  { label: '×3',       type: 'multiply', multiplier: 3,    color: '#fbbf24', bgColor: C1, probability: 5 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 9 },
  { label: 'T4 ITEM',  type: 'item',     multiplier: 0,    color: '#a78bfa', bgColor: C3, probability: 5,  itemTier: 't4' },
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C1, probability: 10 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 7 },
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C3, probability: 5 },
]

// ─── $250K TABLE ─── Balanced: mid multipliers, T4+T5 items, ~85% return
// EV ≈ (18%×1.5 + 12%×2 + 6%×3 + 3%×5 + 10% items) = 0.27+0.24+0.18+0.15 = 0.84 + items
const WHEEL_250K: WheelSegment[] = [
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C1, probability: 8 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 10 },
  { label: '×3',       type: 'multiply', multiplier: 3,    color: '#fbbf24', bgColor: C3, probability: 6 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C1, probability: 11 },
  { label: 'T4 ITEM',  type: 'item',     multiplier: 0,    color: '#a78bfa', bgColor: C2, probability: 6,  itemTier: 't4' },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C3, probability: 10 },
  { label: '×5',       type: 'multiply', multiplier: 5,    color: '#fbbf24', bgColor: C1, probability: 3 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 10 },
  { label: 'T5 ITEM',  type: 'item',     multiplier: 0,    color: '#c084fc', bgColor: C3, probability: 4,  itemTier: 't5' },
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C1, probability: 10 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 10 },
  { label: '×1.5',     type: 'multiply', multiplier: 1.5,  color: '#fbbf24', bgColor: C3, probability: 8 },
]

// ─── $500K TABLE ─── High risk: big multipliers, T5+T6 items, ~82% return
// EV ≈ (12%×2 + 8%×3 + 4%×5 + 2%×10 + 6% items) = 0.24+0.24+0.20+0.20 = 0.88 + items (but more bust)
const WHEEL_500K: WheelSegment[] = [
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C1, probability: 8 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 12 },
  { label: '×3',       type: 'multiply', multiplier: 3,    color: '#fbbf24', bgColor: C3, probability: 5 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C1, probability: 12 },
  { label: 'T5 ITEM',  type: 'item',     multiplier: 0,    color: '#c084fc', bgColor: C2, probability: 4,  itemTier: 't5' },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C3, probability: 12 },
  { label: '×5',       type: 'multiply', multiplier: 5,    color: '#fbbf24', bgColor: C1, probability: 4 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 12 },
  { label: 'T6 ITEM',  type: 'item',     multiplier: 0,    color: '#f0abfc', bgColor: C3, probability: 2,  itemTier: 't6' },
  { label: '×2',       type: 'multiply', multiplier: 2,    color: '#fbbf24', bgColor: C1, probability: 4 },
  { label: 'BUST',     type: 'bankrupt', multiplier: 0,    color: '#fca5a5', bgColor: C2, probability: 13 },
  { label: '×10',      type: 'multiply', multiplier: 10,   color: '#f0abfc', bgColor: C3, probability: 2 },
]

export const BET_TIERS = [
  { amount: 50_000,    label: '$50K' },
  { amount: 250_000,   label: '$250K' },
  { amount: 500_000,   label: '$500K' },
]

// Map bet amount → its wheel segments
export const TIER_WHEELS: Record<number, WheelSegment[]> = {
  50_000:  WHEEL_50K,
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
  history: { segment: WheelSegment; bet: number }[]
  totalSpins: number
  totalWon: number
  totalLost: number
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
  history: [],
  totalSpins: 0,
  totalWon: 0,
  totalLost: 0,

  spinForBet: (betAmount: number) => {
    const player = usePlayerStore.getState()
    if (player.money < betAmount || get().phase === 'spinning') return

    // Player pays the bet
    player.spendMoney(betAmount)

    // 10% of bet goes to player's country treasury
    const betTax = Math.floor(betAmount * 0.10)
    useWorldStore.getState().addTreasuryTax(player.countryCode, betTax)

    const segments = getSegmentsForBet(betAmount)
    const winIndex = weightedRandomIndex(segments)
    const segCount = segments.length
    const segAngle = 360 / segCount
    const targetSegCenter = winIndex * segAngle + segAngle / 2
    // CSS rotate() is clockwise: to put segment at top pointer, rotate by (360 - center)
    const landAngle = 360 - targetSegCenter
    const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360
    const finalAngle = fullSpins + landAngle + spinCounter * 360 * 10
    spinCounter++

    set({
      phase: 'spinning',
      currentBet: betAmount,
      targetAngle: finalAngle,
      resultIndex: winIndex,
      activeSegments: segments,
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
        // Payout created from thin air
        const payout = Math.floor(s.currentBet * segment.multiplier)
        player.earnMoney(payout)

        // 10% of winnings taxed to country treasury
        const winTax = Math.floor(payout * 0.10)
        useWorldStore.getState().addTreasuryTax(player.countryCode, winTax)

        winText = 'YOU WON!'
        winAmount = `$${payout.toLocaleString()}`
        break
      }
      case 'item': {
        // Item created from thin air
        const tier = segment.itemTier || 't4'
        const allSlots: EquipSlot[] = ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots']
        const slot = allSlots[Math.floor(Math.random() * allSlots.length)]
        const category = slot === 'weapon' ? 'weapon' as const : 'armor' as const
        const subtype = slot === 'weapon' ? WEAPON_SUBTYPES[tier][Math.floor(Math.random() * WEAPON_SUBTYPES[tier].length)] : undefined
        const result = generateStats(category, slot, tier, subtype)

        const newItem: EquipItem = {
          id: `casino_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `🎰 ${result.name}`,
          slot, category, tier,
          equipped: false,
          durability: 100,
          stats: result.stats,
          weaponSubtype: result.weaponSubtype,
        }
        useInventoryStore.getState().addItem(newItem)
        winText = 'JACKPOT!'
        winAmount = `${tier.toUpperCase()} ${slot.toUpperCase()}`
        break
      }
      case 'bankrupt': {
        // Money already lost (deducted on bet), 10% bet tax already sent
        winText = 'BANKRUPT!'
        winAmount = `LOST $${s.currentBet.toLocaleString()}`
        winType = 'lose'
        break
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
    })
  },
}))
