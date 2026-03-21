import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useNewsStore } from './newsStore'
import { casinoApi } from '../api/casino'

/* ══════════════════════════════════════════════
   XWAR Crash — "Missile Launch" — INSTANT
   Now server-authoritative.
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
  totalRounds: number
  wins: number
  losses: number
  isRequesting: boolean
  
  _tickInterval: ReturnType<typeof setInterval> | null
  _resetTimer: ReturnType<typeof setTimeout> | null

  placeBet: (amount: number) => Promise<void>
  cashOut: () => Promise<void>
  _tick: () => void
  _cleanup: () => void
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
  isRequesting: false,
  _tickInterval: null,
  _resetTimer: null,

  placeBet: async (amount: number) => {
    const s = get()
    if (s.phase !== 'idle' || s.isRequesting) return

    set({ isRequesting: true })
    try {
      const res = await casinoApi.crashBet(amount)
      
      set({
        phase: 'flying',
        playerBet: res.bet,
        playerCashedOut: false,
        playerPayout: 0,
        currentMultiplier: 1.00,
        crashPoint: res.crashPoint,
        isRequesting: false,
      })

      // Start the multiplier tick locally to visualize flight
      get()._cleanup()
      const tickInterval = setInterval(() => get()._tick(), TICK_MS)
      set({ _tickInterval: tickInterval })
      
      // Snappy UI deduction locally (backend already deducted it)
      usePlayerStore.getState().spendMoney(amount)
      usePlayerStore.getState().incrementCasinoSpins()

    } catch (err: any) {
      console.error('Crash bet failed', err)
      set({ isRequesting: false })
    }
  },

  cashOut: async () => {
    const s = get()
    if (s.phase !== 'flying' || s.playerCashedOut || s.isRequesting) return

    set({ isRequesting: true })
    try {
      // we freeze the local multiplier for UI, but server is authoritative
      const freezeMult = s.currentMultiplier
      
      // Stop the game tick locally
      if (s._tickInterval) { clearInterval(s._tickInterval); }
      
      const res = await casinoApi.crashCashout(freezeMult)
      
      if (res.crashed) {
        // We actually crashed before our request hit!
        usePlayerStore.getState().addCasinoLoss(s.playerBet)
        
        set({
          phase: 'crashed',
          currentMultiplier: res.crashPoint,
          _tickInterval: null,
          losses: s.losses + 1,
          totalRounds: s.totalRounds + 1,
          history: [res.crashPoint, ...s.history].slice(0, 20),
          isRequesting: false
        })
      } else {
        // We won
        usePlayerStore.getState().earnMoney(res.payout)
        
        if (res.cashoutMultiplier! >= 5) {
          const name = usePlayerStore.getState().name
          useNewsStore.getState().pushEvent(
            'casino',
            `🚀 ${name} cashed out at ×${res.cashoutMultiplier!.toFixed(2)} on Crash — +$${res.payout.toLocaleString()}!`
          )
        }

        set({
          phase: 'won',
          playerCashedOut: true,
          playerPayout: res.payout,
          currentMultiplier: res.cashoutMultiplier!,
          wins: s.wins + 1,
          totalRounds: s.totalRounds + 1,
          history: [res.cashoutMultiplier!, ...s.history].slice(0, 20),
          _tickInterval: null,
          isRequesting: false
        })
      }

      // Auto-reset to idle after displaying result
      const resetTimer = setTimeout(() => {
        set({ phase: 'idle', _resetTimer: null })
      }, CRASH_DISPLAY_MS)
      set({ _resetTimer: resetTimer })

    } catch (err: any) {
      console.error('Crash cashout failed', err)
      set({ isRequesting: false })
      
      // If it failed, we assume it crashed server-side and report it
      // Actually we just let it resume ticking if it was a network error
      // or we can call backend to check state.
      if (err.message?.includes('active crash')) {
        // If "no active crash", it crashed. Let the local tick finish it.
        if (s._tickInterval) { clearInterval(s._tickInterval); }
        const tickInterval = setInterval(() => get()._tick(), TICK_MS)
        set({ _tickInterval: tickInterval })
      }
    }
  },

  _tick: () => {
    const s = get()
    if (s.phase !== 'flying') return

    const newMult = Math.round((s.currentMultiplier * (1 + GROWTH_RATE)) * 1000) / 1000

    if (newMult >= s.crashPoint) {
      // Crash Point reached locally
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

      if (s.crashPoint >= 15) {
        useNewsStore.getState().pushEvent('casino', `🚀 Crash missile survived to ×${s.crashPoint.toFixed(2)}!`)
      }

      const resetTimer = setTimeout(() => {
        set({ phase: 'idle', _resetTimer: null })
      }, CRASH_DISPLAY_MS)
      set({ _resetTimer: resetTimer })
      
      // Cleanup server session (ignore result since we handled it visually)
      casinoApi.crashReport().catch(console.error)
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
