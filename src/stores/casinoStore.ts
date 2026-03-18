import { create } from 'zustand'
import { usePlayerStore } from './playerStore'

// ── Wheel Segments ──
// Each segment defines a prize. Rewards SCALE with bet tier.
// multiplier × betAmount = actual payout for money prizes.
// resource prizes also scale: base × tierMultiplier

export interface WheelSegment {
  label: string
  type: 'money' | 'scrap' | 'oil' | 'bankrupt' | 'multiply' | 'materialX'
  multiplier: number      // For money: payout = bet × multiplier. For resources: base amount
  color: string
  bgColor: string
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: '2x',         type: 'multiply',  multiplier: 2,    color: '#fff',    bgColor: '#fbbf24' },
  { label: 'SCRAP',      type: 'scrap',     multiplier: 500,  color: '#fff',    bgColor: '#f59e0b' },
  { label: '3x',         type: 'multiply',  multiplier: 3,    color: '#fff',    bgColor: '#ef4444' },
  { label: 'BANKRUPT',   type: 'bankrupt',  multiplier: 0,    color: '#fff',    bgColor: '#ef4444' },
  { label: 'OIL',        type: 'oil',       multiplier: 150,  color: '#fff',    bgColor: '#06b6d4' },
  { label: '5x',         type: 'multiply',  multiplier: 5,    color: '#fff',    bgColor: '#a855f7' },
  { label: 'MAT-X',      type: 'materialX', multiplier: 100,  color: '#fff',    bgColor: '#6366f1' },
  { label: 'BANKRUPT',   type: 'bankrupt',  multiplier: 0,    color: '#fff',    bgColor: '#dc2626' },
  { label: '1.5x',       type: 'multiply',  multiplier: 1.5,  color: '#fff',    bgColor: '#3b82f6' },
  { label: 'SCRAP',      type: 'scrap',     multiplier: 200,  color: '#fff',    bgColor: '#d97706' },
  { label: '10x',        type: 'multiply',  multiplier: 10,   color: '#fff',    bgColor: '#ec4899' },
  { label: 'OIL',        type: 'oil',       multiplier: 300,  color: '#fff',    bgColor: '#0891b2' },
]

export const BET_TIERS = [
  { amount: 100000, label: '$100,000' },
  { amount: 200000, label: '$200,000' },
  { amount: 300000, label: '$300,000' },
]

// Tier multiplier for resource prizes — higher bet = better resources
function getTierMultiplier(betAmount: number): number {
  if (betAmount >= 300000) return 3
  if (betAmount >= 200000) return 2
  return 1
}

export type CasinoPhase = 'idle' | 'spinning' | 'result'

export interface CasinoState {
  phase: CasinoPhase
  currentBet: number
  targetAngle: number      // Final rotation angle for CSS
  resultIndex: number      // Winning segment index
  lastWinText: string
  lastWinAmount: string
  lastWinType: 'win' | 'lose' | null
  history: { segment: WheelSegment; bet: number }[]
  totalSpins: number
  totalWon: number
  totalLost: number

  // Actions
  spinForBet: (betAmount: number) => void
  resolveResult: () => void
  betAgain: () => void
  resetCasino: () => void
}

let spinCounter = 0

export const useCasinoStore = create<CasinoState>((set, get) => ({
  phase: 'idle',
  currentBet: 0,
  targetAngle: 0,
  resultIndex: 0,
  lastWinText: '',
  lastWinAmount: '',
  lastWinType: null,
  history: [],
  totalSpins: 0,
  totalWon: 0,
  totalLost: 0,

  spinForBet: (betAmount: number) => {
    const player = usePlayerStore.getState()
    if (player.money < betAmount) return
    if (get().phase === 'spinning') return

    // Deduct bet
    player.spendMoney(betAmount)

    // Pick random segment
    const segCount = WHEEL_SEGMENTS.length
    const winIndex = Math.floor(Math.random() * segCount)

    // Calculate rotation: multiple full spins + land on the segment
    // Segments go clockwise. Segment 0 is at the top.
    // Each segment spans (360/segCount) degrees.
    // We want the pointer (at top, 0°) to land in the middle of winIndex.
    const segAngle = 360 / segCount
    // The wheel rotates clockwise, so to land on segment winIndex,
    // we need to rotate so that segment is at the top (pointer position).
    // Segment i center is at i * segAngle + segAngle/2 from the start.
    const targetSegCenter = winIndex * segAngle + segAngle / 2
    const fullSpins = (5 + Math.floor(Math.random() * 3)) * 360 // 5-7 full rotations
    const finalAngle = fullSpins + targetSegCenter + (spinCounter * 360 * 10) // accumulate to keep spinning forward

    spinCounter++

    set({
      phase: 'spinning',
      currentBet: betAmount,
      targetAngle: finalAngle,
      resultIndex: winIndex,
    })
  },

  resolveResult: () => {
    const s = get()
    if (s.phase !== 'spinning') return

    const segment = WHEEL_SEGMENTS[s.resultIndex]
    const tierMult = getTierMultiplier(s.currentBet)
    const player = usePlayerStore.getState()

    let winText = ''
    let winAmount = ''
    let winType: 'win' | 'lose' = 'win'

    switch (segment.type) {
      case 'multiply': {
        const payout = Math.floor(s.currentBet * segment.multiplier)
        player.earnMoney(payout)
        winText = 'YOU WON!'
        winAmount = `$${payout.toLocaleString()}`
        break
      }
      case 'money': {
        const payout = Math.floor(s.currentBet * segment.multiplier)
        player.earnMoney(payout)
        winText = 'YOU WON!'
        winAmount = `$${payout.toLocaleString()}`
        break
      }
      case 'scrap': {
        const amount = Math.floor(segment.multiplier * tierMult)
        player.addScrap(amount)
        winText = 'YOU WON!'
        winAmount = `${amount.toLocaleString()} SCRAP`
        break
      }
      case 'oil': {
        const amount = Math.floor(segment.multiplier * tierMult)
        usePlayerStore.setState(ps => ({ oil: ps.oil + amount }))
        winText = 'YOU WON!'
        winAmount = `${amount.toLocaleString()} OIL`
        break
      }
      case 'materialX': {
        const amount = Math.floor(segment.multiplier * tierMult)
        usePlayerStore.setState(ps => ({ materialX: ps.materialX + amount }))
        winText = 'YOU WON!'
        winAmount = `${amount.toLocaleString()} MATERIAL-X`
        break
      }
      case 'bankrupt': {
        winText = 'BANKRUPT'
        winAmount = `LOST $${s.currentBet.toLocaleString()}`
        winType = 'lose'
        break
      }
    }

    const isWin = winType === 'win'

    set(prev => ({
      phase: 'result',
      lastWinText: winText,
      lastWinAmount: winAmount,
      lastWinType: winType,
      totalSpins: prev.totalSpins + 1,
      totalWon: isWin ? prev.totalWon + 1 : prev.totalWon,
      totalLost: !isWin ? prev.totalLost + 1 : prev.totalLost,
      history: [
        { segment, bet: prev.currentBet },
        ...prev.history,
      ].slice(0, 15),
    }))
  },

  betAgain: () => {
    const s = get()
    if (s.phase !== 'result') return
    // Re-spin at the same bet tier
    get().spinForBet(s.currentBet)
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
