import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR Crash — "Missile Launch" — INSTANT
   
   Simple single-player crash:
   1. Pick a bet amount → click BET
   2. Missile launches INSTANTLY
   3. Multiplier climbs — cash out anytime
   4. If it crashes before you cash out, you lose
   5. Repeat immediately
   
   No rounds, no waiting, no bots.
   15% of each bet → country treasury
   House edge ~9% (EV ≈ 0.91)
   ══════════════════════════════════════════════ */

export const CRASH_BETS = [10_000, 50_000, 100_000, 250_000, 500_000]

const TICK_MS = 50
const GROWTH_RATE = 0.0065
const CRASH_DISPLAY_MS = 2500 // show crash result for 2.5s before reset

export type CrashPhase = 'idle' | 'flying' | 'crashed' | 'won'

export interface CrashState {
  phase: CrashPhase
  currentMultiplier: number
  crashPoint: number
  playerBet: number
  playerCashedOut: boolean
  playerPayout: number
  history: number[]
  // Stats
  totalRounds: number
  wins: number
  losses: number
  // Internal
  _tickInterval: ReturnType<typeof setInterval> | null
  _resetTimer: ReturnType<typeof setTimeout> | null
  // Actions
  placeBet: (amount: number) => void
  cashOut: () => void
  _tick: () => void
  _cleanup: () => void
}

function generateCrashPoint(): number {
  const houseEdge = 0.09
  const r = Math.random()
  if (r < 0.01) return 100  // rare moon shot
  let crashAt = (1 - houseEdge) / r
  crashAt = Math.max(1.10, crashAt)
  return Math.min(100, Math.round(crashAt * 100) / 100)
}

export const useCrashStore = create<CrashState>((set, get) => ({
  phase: 'idle',
  currentMultiplier: 1.00,
  crashPoint: 1.00,
  playerBet: 0,
  playerCashedOut: false,
  playerPayout: 0,
  history: [],
  totalRounds: 0,
  wins: 0,
  losses: 0,
  _tickInterval: null,
  _resetTimer: null,

  placeBet: (amount: number) => {
    const s = get()
    if (s.phase !== 'idle') return

    const player = usePlayerStore.getState()
    if (player.money < amount) return

    // Deduct money and tax
    player.spendMoney(amount)
    const tax = Math.floor(amount * 0.15)
    useWorldStore.getState().addTreasuryTax(player.countryCode, tax)
    player.incrementCasinoSpins()

    // Generate crash point and LAUNCH IMMEDIATELY
    const crashPoint = generateCrashPoint()

    set({
      phase: 'flying',
      playerBet: amount,
      playerCashedOut: false,
      playerPayout: 0,
      currentMultiplier: 1.00,
      crashPoint,
    })

    // Start the multiplier tick
    const tickInterval = setInterval(() => get()._tick(), TICK_MS)
    set({ _tickInterval: tickInterval })
  },

  cashOut: () => {
    const s = get()
    if (s.phase !== 'flying') return
    if (s.playerCashedOut) return

    // Stop the game
    if (s._tickInterval) { clearInterval(s._tickInterval); }

    const payout = Math.floor(s.playerBet * s.currentMultiplier)
    usePlayerStore.getState().earnMoney(payout)

    // News for big wins
    if (s.currentMultiplier >= 5) {
      const name = usePlayerStore.getState().name
      useNewsStore.getState().pushEvent(
        'casino',
        `🚀 ${name} cashed out at ×${s.currentMultiplier.toFixed(2)} on Crash — +$${payout.toLocaleString()}!`
      )
    }

    set({
      phase: 'won',
      playerCashedOut: true,
      playerPayout: payout,
      wins: s.wins + 1,
      totalRounds: s.totalRounds + 1,
      history: [s.currentMultiplier, ...s.history].slice(0, 20),
      _tickInterval: null,
    })

    // Auto-reset to idle after displaying result
    const resetTimer = setTimeout(() => {
      set({ phase: 'idle', _resetTimer: null })
    }, CRASH_DISPLAY_MS)
    set({ _resetTimer: resetTimer })
  },

  _tick: () => {
    const s = get()
    if (s.phase !== 'flying') return

    const newMult = Math.round((s.currentMultiplier * (1 + GROWTH_RATE)) * 1000) / 1000

    if (newMult >= s.crashPoint) {
      // CRASH!
      if (s._tickInterval) { clearInterval(s._tickInterval) }

      usePlayerStore.getState().addCasinoLoss(s.playerBet)

      set({
        phase: 'crashed',
        currentMultiplier: s.crashPoint,
        _tickInterval: null,
        losses: s.losses + 1,
        totalRounds: s.totalRounds + 1,
        history: [s.crashPoint, ...s.history].slice(0, 20),
      })

      // News for spectacular crashes
      if (s.crashPoint >= 15) {
        useNewsStore.getState().pushEvent('casino', `🚀 Crash missile survived to ×${s.crashPoint.toFixed(2)}!`)
      }

      // Auto-reset to idle after showing crash
      const resetTimer = setTimeout(() => {
        set({ phase: 'idle', _resetTimer: null })
      }, CRASH_DISPLAY_MS)
      set({ _resetTimer: resetTimer })
    } else {
      set({ currentMultiplier: newMult })
    }
  },

  _cleanup: () => {
    const s = get()
    if (s._tickInterval) clearInterval(s._tickInterval)
    if (s._resetTimer) clearTimeout(s._resetTimer)
  },
}))
