import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { casinoApi } from '../api/casino'

/* ══════════════════════════════════════════════
   XWAR Slot Machine — 3 Reels, Military Themed
   Server-Authoritative!
   ══════════════════════════════════════════════ */

export const SLOT_SYMBOLS = ['rifle', 'grenade', 'medal', 'swords', 'shield', 'skull', 'badge', 'star'] as const
export type SlotSymbol = typeof SLOT_SYMBOLS[number]

export const SYMBOL_INFO: Record<SlotSymbol, { img: string; label: string }> = {
  rifle:   { img: '/assets/slots/rifle.png',   label: 'Rifle' },
  grenade: { img: '/assets/slots/grenade.png', label: 'Grenade' },
  medal:   { img: '/assets/slots/medal.png',   label: 'Medal' },
  swords:  { img: '/assets/slots/swords.png',  label: 'Swords' },
  shield:  { img: '/assets/slots/shield.png',  label: 'Shield' },
  skull:   { img: '/assets/slots/skull.png',   label: 'Skull' },
  badge:   { img: '/assets/slots/badge.png',   label: 'Badge' },
  star:    { img: '/assets/slots/star.png',    label: 'Star' },
}

export const SLOTS_BETS = [5_000, 25_000, 50_000, 100_000, 250_000]

export type SlotsPhase = 'idle' | 'spinning' | 'result'

export interface SlotsState {
  phase: SlotsPhase
  bet: number
  reels: [SlotSymbol, SlotSymbol, SlotSymbol]
  reelStrips: [SlotSymbol[], SlotSymbol[], SlotSymbol[]]
  resultText: string
  resultType: 'jackpot' | 'win' | 'lose' | null
  payout: number
  totalSpins: number
  wins: number
  losses: number
  jackpots: number
  isRequesting: boolean

  spin: (betAmount: number) => Promise<void>
  resolveResult: () => void
  reset: () => void
}

// Generate a random strip ending with target for animation
function generateStrip(target: SlotSymbol, length: number = 20): SlotSymbol[] {
  const strip: SlotSymbol[] = []
  for (let i = 0; i < length - 1; i++) {
    strip.push(SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)])
  }
  strip.push(target)
  return strip
}

export const useSlotsStore = create<SlotsState>((set, get) => ({
  phase: 'idle',
  bet: 0,
  reels: ['rifle', 'grenade', 'medal'],
  reelStrips: [[], [], []],
  resultText: '',
  resultType: null,
  payout: 0,
  totalSpins: 0,
  wins: 0,
  losses: 0,
  jackpots: 0,
  isRequesting: false,

  spin: async (betAmount: number) => {
    const s = get()
    if (s.phase === 'spinning' || s.isRequesting) return

    set({ isRequesting: true })
    try {
      const res = await casinoApi.spinSlots(betAmount)
      
      const r1 = res.reels[0] as SlotSymbol
      const r2 = res.reels[1] as SlotSymbol
      const r3 = res.reels[2] as SlotSymbol

      const strip1 = generateStrip(r1, 15)
      const strip2 = generateStrip(r2, 20)
      const strip3 = generateStrip(r3, 25)

      // Snappy deduction
      usePlayerStore.getState().spendMoney(betAmount)
      usePlayerStore.getState().incrementCasinoSpins()

      set({
        phase: 'spinning',
        bet: betAmount,
        reels: [r1, r2, r3],
        reelStrips: [strip1, strip2, strip3],
        // Save the result from backend so resolveResult can apply it
        resultText: res.resultText,
        resultType: res.resultType,
        payout: res.payout,
        isRequesting: false,
      })
    } catch (err) {
      console.error('Slots spin failed', err)
      set({ isRequesting: false })
    }
  },

  resolveResult: () => {
    const s = get()
    if (s.phase !== 'spinning') return

    const player = usePlayerStore.getState()

    if (s.payout > 0) {
      player.earnMoney(s.payout)
    } else {
      player.addCasinoLoss(s.bet)
    }

    set({
      phase: 'result',
      totalSpins: s.totalSpins + 1,
      wins: s.resultType !== 'lose' ? s.wins + 1 : s.wins,
      losses: s.resultType === 'lose' ? s.losses + 1 : s.losses,
      jackpots: s.resultType === 'jackpot' ? s.jackpots + 1 : s.jackpots,
    })
  },

  reset: () => {
    set({
      phase: 'idle',
      resultText: '',
      resultType: null,
      payout: 0,
    })
  },
}))
