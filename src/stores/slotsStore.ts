import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'

/* ══════════════════════════════════════════════
   XWAR Slot Machine — 3 Reels, Military Themed
   15% of bet → country fund, winnings from thin air
   ══════════════════════════════════════════════ */

// Slot symbols — military themed (keyed by ID)
export const SLOT_SYMBOLS = ['rifle', 'grenade', 'medal', 'swords', 'shield', 'skull', 'badge', 'star'] as const
export type SlotSymbol = typeof SLOT_SYMBOLS[number]

// Image paths and display names
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

// Payout table: 3-of-a-kind multipliers
export const PAYOUTS: Record<SlotSymbol, number> = {
  star:    50,   // Jackpot
  badge:   25,   // Big win
  medal:   15,
  swords:  10,
  rifle:   8,
  grenade: 6,
  shield:  4,
  skull:   3,
}

// 2-of-a-kind pays 1.6× regardless of symbol (raw EV ≈ 0.91)
const TWO_MATCH_MULTIPLIER = 1.6

export const SLOTS_BETS = [5_000, 25_000, 50_000, 100_000, 250_000]

/* ── Weighted symbol distribution ──
   Rare symbols appear less often → jackpots are earned, house edge ~5-10%
   Total weight = 90 */
const SYMBOL_WEIGHTS: [SlotSymbol, number][] = [
  ['skull',   25],  // 27.8%
  ['shield',  22],  // 24.4%
  ['grenade', 16],  // 17.8%
  ['rifle',   12],  // 13.3%
  ['swords',   8],  //  8.9%
  ['medal',    4],  //  4.4%
  ['badge',    2],  //  2.2%
  ['star',     1],  //  1.1%  — jackpot is ~1 in 700k
]
const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((s, [, w]) => s + w, 0) // 90

export type SlotsPhase = 'idle' | 'spinning' | 'result'

export interface SlotsState {
  phase: SlotsPhase
  bet: number
  reels: [SlotSymbol, SlotSymbol, SlotSymbol]
  // For animation: the full reel strips that scroll
  reelStrips: [SlotSymbol[], SlotSymbol[], SlotSymbol[]]
  resultText: string
  resultType: 'jackpot' | 'win' | 'lose' | null
  payout: number
  // Stats
  totalSpins: number
  wins: number
  losses: number
  jackpots: number
  // Actions
  spin: (betAmount: number) => void
  resolveResult: () => void
  reset: () => void
}

function randomSymbol(): SlotSymbol {
  let roll = Math.random() * TOTAL_WEIGHT
  for (const [sym, weight] of SYMBOL_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return sym
  }
  return 'skull' // fallback
}

// Generate a strip of random symbols for animation, ending with the target
function generateStrip(target: SlotSymbol, length: number = 20): SlotSymbol[] {
  const strip: SlotSymbol[] = []
  for (let i = 0; i < length - 1; i++) {
    strip.push(randomSymbol())
  }
  strip.push(target) // last symbol is the result
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

  spin: (betAmount: number) => {
    const player = usePlayerStore.getState()
    if (player.money < betAmount || get().phase === 'spinning') return

    // Deduct bet
    player.spendMoney(betAmount)

    // 15% tax to country fund
    const tax = Math.floor(betAmount * 0.15)
    useWorldStore.getState().addTreasuryTax(player.countryCode, tax)

    // Track casino spins
    player.incrementCasinoSpins()

    // Determine results
    const r1 = randomSymbol()
    const r2 = randomSymbol()
    const r3 = randomSymbol()

    // Generate animation strips
    const strip1 = generateStrip(r1, 15)
    const strip2 = generateStrip(r2, 20)
    const strip3 = generateStrip(r3, 25)

    set({
      phase: 'spinning',
      bet: betAmount,
      reels: [r1, r2, r3],
      reelStrips: [strip1, strip2, strip3],
      resultText: '',
      resultType: null,
      payout: 0,
    })
  },

  resolveResult: () => {
    const s = get()
    if (s.phase !== 'spinning') return

    const [r1, r2, r3] = s.reels
    const player = usePlayerStore.getState()

    let resultText: string
    let resultType: 'jackpot' | 'win' | 'lose'
    let payout = 0

    if (r1 === r2 && r2 === r3) {
      // 3-of-a-kind
      const mult = PAYOUTS[r1]
      payout = s.bet * mult
      const info = SYMBOL_INFO[r1]
      if (r1 === 'star') {
        resultText = `JACKPOT! ⭐⭐⭐`
        resultType = 'jackpot'
      } else {
        resultText = `${info.label} ×3 — ${mult}×!`
        resultType = 'win'
      }
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      // 2-of-a-kind
      payout = s.bet * TWO_MATCH_MULTIPLIER
      const matched = r1 === r2 ? r1 : r2 === r3 ? r2 : r1
      resultText = `PAIR ${SYMBOL_INFO[matched].label} — ${TWO_MATCH_MULTIPLIER}×`
      resultType = 'win'
    } else {
      resultText = 'NO MATCH'
      resultType = 'lose'
      // Track casino loss
      player.addCasinoLoss(s.bet)
    }

    if (payout > 0) {
      player.earnMoney(payout)
    }

    set({
      phase: 'result',
      resultText,
      resultType,
      payout,
      totalSpins: s.totalSpins + 1,
      wins: resultType !== 'lose' ? s.wins + 1 : s.wins,
      losses: resultType === 'lose' ? s.losses + 1 : s.losses,
      jackpots: resultType === 'jackpot' ? s.jackpots + 1 : s.jackpots,
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
