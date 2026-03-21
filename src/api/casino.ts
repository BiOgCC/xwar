import { api } from './client'

export const casinoApi = {
  // Slots
  spinSlots: (bet: number) => api.post<{
    reels: [string, string, string]
    payout: number
    resultType: 'jackpot' | 'win' | 'lose'
    resultText: string
  }>('/casino/slots/spin', { bet }),

  // Blackjack
  startBlackjack: (bet: number) => api.post<{
    playerHand: Array<{ suit: string, rank: string }>
    dealerHand: Array<{ suit: string, rank: string }>
    phase: 'playing' | 'done'
    result?: 'win' | 'lose' | 'push' | 'blackjack'
    resultText?: string
    payout?: number
    playerTotal: number
    dealerTotal?: number
  }>('/casino/blackjack/start', { bet }),

  hitBlackjack: () => api.post<{
    card: { suit: string, rank: string }
    playerHand: Array<{ suit: string, rank: string }>
    dealerHand: Array<{ suit: string, rank: string }>
    phase: 'playing' | 'done'
    result?: 'win' | 'lose' | 'push' | 'blackjack'
    resultText?: string
    payout?: number
    playerTotal: number
    dealerTotal?: number
  }>('/casino/blackjack/hit'),

  standBlackjack: () => api.post<{
    playerHand: Array<{ suit: string, rank: string }>
    dealerHand: Array<{ suit: string, rank: string }>
    phase: 'done'
    result: 'win' | 'lose' | 'push' | 'blackjack'
    resultText: string
    payout: number
    playerTotal: number
    dealerTotal: number
  }>('/casino/blackjack/stand'),

  // Crash
  crashBet: (bet: number) => api.post<{
    hash: string
    bet: number
    crashPoint: number
  }>('/casino/crash/bet', { bet }),

  crashCashout: (multiplier: number) => api.post<{
    success: boolean
    crashed: boolean
    cashoutMultiplier?: number
    payout: number
    crashPoint: number
  }>('/casino/crash/cashout', { multiplier }),

  crashReport: () => api.post<{
    crashPoint: number
  }>('/casino/crash/report-crash'),

  // Wheel
  spinWheel: (bet: number) => api.post<{
    index: number
    segment: string
    payout: number
    resultType: 'win' | 'lose' | 'item'
    itemTier?: string
  }>('/casino/wheel/spin', { bet }),
}
