import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { casinoApi } from '../api/casino'

export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export function calculateHand(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (!card.faceUp) continue
    if (card.rank === 'A') { total += 11; aces++ }
    else if (['K', 'Q', 'J'].includes(card.rank)) total += 10
    else total += parseInt(card.rank)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export type BjPhase = 'betting' | 'playing' | 'dealer_turn' | 'result'
export type BjResult = 'win' | 'lose' | 'push' | 'blackjack' | null

export const BJ_BETS = [10_000, 50_000, 100_000, 250_000, 500_000]

export interface BlackjackState {
  phase: BjPhase
  bet: number
  playerHand: Card[]
  dealerHand: Card[]
  result: BjResult
  resultText: string
  payout: number
  handsPlayed: number
  wins: number
  losses: number
  pushes: number
  blackjacks: number
  isRequesting: boolean

  placeBet: (amount: number) => Promise<void>
  hit: () => Promise<void>
  stand: () => Promise<void>
  newRound: () => void
}

export const useBlackjackStore = create<BlackjackState>((set, get) => ({
  phase: 'betting',
  bet: 0,
  playerHand: [],
  dealerHand: [],
  result: null,
  resultText: '',
  payout: 0,
  handsPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  isRequesting: false,

  placeBet: async (amount: number) => {
    const s = get()
    if (s.phase !== 'betting' || s.isRequesting) return

    set({ isRequesting: true })
    try {
      const res = await casinoApi.startBlackjack(amount)
      
      const pHand = res.playerHand.map(c => ({ suit: c.suit as Suit, rank: c.rank as Rank, faceUp: true }))
      const dHand = res.dealerHand.map((c, i) => ({ suit: c.suit as Suit, rank: c.rank as Rank, faceUp: i === 0 }))
      
      // Setup ui values
      usePlayerStore.getState().spendMoney(amount)
      usePlayerStore.getState().incrementCasinoSpins()

      if (res.phase === 'done') {
        if (res.payout && res.payout > 0) usePlayerStore.getState().earnMoney(res.payout)
        
        // Finalize state
        dHand.forEach(c => c.faceUp = true)
        set({
          phase: 'result', bet: amount, playerHand: pHand, dealerHand: dHand,
          result: res.result || null, resultText: res.resultText || '', payout: res.payout || 0,
          handsPlayed: s.handsPlayed + 1,
          wins: res.result === 'win' || res.result === 'blackjack' ? s.wins + 1 : s.wins,
          losses: res.result === 'lose' ? s.losses + 1 : s.losses,
          pushes: res.result === 'push' ? s.pushes + 1 : s.pushes,
          blackjacks: res.result === 'blackjack' ? s.blackjacks + 1 : s.blackjacks,
          isRequesting: false
        })
      } else {
        set({ phase: 'playing', bet: amount, playerHand: pHand, dealerHand: dHand, isRequesting: false })
      }
    } catch (err) {
      console.error(err)
      set({ isRequesting: false })
    }
  },

  hit: async () => {
    const s = get()
    if (s.phase !== 'playing' || s.isRequesting) return

    set({ isRequesting: true })
    try {
      const res = await casinoApi.hitBlackjack()
      
      const pHand = res.playerHand.map(c => ({ suit: c.suit as Suit, rank: c.rank as Rank, faceUp: true }))
      const dHand = res.dealerHand.map((c, i) => ({ suit: c.suit as Suit, rank: c.rank as Rank, faceUp: i === 0 }))
      
      if (res.phase === 'done') {
        dHand.forEach(c => c.faceUp = true)
        set({
          phase: 'result', playerHand: pHand, dealerHand: dHand,
          result: res.result || null, resultText: res.resultText || '', payout: res.payout || 0,
          handsPlayed: s.handsPlayed + 1,
          wins: res.result === 'win' ? s.wins + 1 : s.wins,
          losses: res.result === 'lose' ? s.losses + 1 : s.losses,
          isRequesting: false
        })
      } else {
        set({ playerHand: pHand, dealerHand: dHand, isRequesting: false })
      }
    } catch (err) {
      console.error(err)
      set({ isRequesting: false })
    }
  },

  stand: async () => {
    const s = get()
    if (s.phase !== 'playing' || s.isRequesting) return

    set({ isRequesting: true })
    try {
      const res = await casinoApi.standBlackjack()
      
      const pHand = res.playerHand.map(c => ({ suit: c.suit as Suit, rank: c.rank as Rank, faceUp: true }))
      const dHand = res.dealerHand.map(c => ({ suit: c.suit as Suit, rank: c.rank as Rank, faceUp: true }))
      
      if (res.payout && res.payout > 0) usePlayerStore.getState().earnMoney(res.payout)

      set({
        phase: 'result', playerHand: pHand, dealerHand: dHand,
        result: res.result, resultText: res.resultText, payout: res.payout,
        handsPlayed: s.handsPlayed + 1,
        wins: res.result === 'win' ? s.wins + 1 : s.wins,
        losses: res.result === 'lose' ? s.losses + 1 : s.losses,
        pushes: res.result === 'push' ? s.pushes + 1 : s.pushes,
        isRequesting: false
      })
    } catch (err) {
      console.error(err)
      set({ isRequesting: false })
    }
  },

  newRound: () => {
    set({
      phase: 'betting', bet: 0, playerHand: [], dealerHand: [],
      result: null, resultText: '', payout: 0,
    })
  },
}))
