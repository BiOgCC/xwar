import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useInventoryStore, rollItemOfTier, TIER_ORDER, type EquipItem, type EquipTier } from './inventoryStore'

/* ══════════════════════════════════════════════
   XWAR Blackjack — Player vs House
   10% of bet → country fund, winnings from thin air
   ══════════════════════════════════════════════ */

// ── Card types ──
export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  suit: Suit
  rank: Rank
  faceUp: boolean
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: true })
    }
  }
  // Shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function cardValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (['K', 'Q', 'J'].includes(rank)) return 10
  return parseInt(rank)
}

export function calculateHand(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (!card.faceUp) continue
    total += cardValue(card.rank)
    if (card.rank === 'A') aces++
  }
  // Reduce aces from 11 to 1 as needed
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

// Calculate total including face-down cards (for dealer logic)
function calculateHandAll(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += cardValue(card.rank)
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && calculateHandAll(cards) === 21
}

export type BjPhase = 'betting' | 'playing' | 'dealer_turn' | 'result'
export type BjResult = 'win' | 'lose' | 'push' | 'blackjack' | null

export const BJ_BETS = [10_000, 50_000, 100_000, 250_000, 500_000]

export interface BlackjackState {
  phase: BjPhase
  bet: number
  playerHand: Card[]
  dealerHand: Card[]
  deck: Card[]
  result: BjResult
  resultText: string
  payout: number
  // Stats
  handsPlayed: number
  wins: number
  losses: number
  pushes: number
  blackjacks: number
  // Item bet
  betItem: EquipItem | null
  wonItem: EquipItem | null
  itemLost: boolean
  // Actions
  placeBet: (amount: number) => void
  placeBetWithItem: (itemId: string) => void
  hit: () => void
  stand: () => void
  doubleDown: () => void
  newRound: () => void
  clearItemResult: () => void
}

export const useBlackjackStore = create<BlackjackState>((set, get) => ({
  phase: 'betting',
  bet: 0,
  playerHand: [],
  dealerHand: [],
  deck: [],
  result: null,
  resultText: '',
  payout: 0,
  handsPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  betItem: null,
  wonItem: null,
  itemLost: false,

  placeBet: (amount: number) => {
    const player = usePlayerStore.getState()
    if (player.money < amount || get().phase !== 'betting') return

    // Deduct bet
    player.spendMoney(amount)

    // 10% tax to country fund
    const tax = Math.floor(amount * 0.10)
    useWorldStore.getState().addTreasuryTax(player.countryCode, tax)

    // Create fresh deck and deal
    const deck = createDeck()
    const playerHand = [
      { ...deck.pop()!, faceUp: true },
      { ...deck.pop()!, faceUp: true },
    ]
    const dealerHand = [
      { ...deck.pop()!, faceUp: true },
      { ...deck.pop()!, faceUp: false }, // hole card face-down
    ]

    // Check for immediate blackjack
    if (isBlackjack(playerHand)) {
      // Reveal dealer hole card
      dealerHand[1].faceUp = true

      if (isBlackjack(dealerHand)) {
        // Both blackjack = push
        const refund = amount
        player.earnMoney(refund)
        set({
          phase: 'result', bet: amount, playerHand, dealerHand, deck,
          result: 'push', resultText: 'PUSH — BOTH BLACKJACK', payout: refund,
          handsPlayed: get().handsPlayed + 1, pushes: get().pushes + 1,
        })
      } else {
        // Player blackjack = 2.5× payout
        const payout = Math.floor(amount * 2.5)
        player.earnMoney(payout)
        set({
          phase: 'result', bet: amount, playerHand, dealerHand, deck,
          result: 'blackjack', resultText: 'BLACKJACK!', payout,
          handsPlayed: get().handsPlayed + 1, blackjacks: get().blackjacks + 1, wins: get().wins + 1,
        })
      }
      return
    }

    set({ phase: 'playing', bet: amount, playerHand, dealerHand, deck })
  },

  placeBetWithItem: (itemId: string) => {
    const inv = useInventoryStore.getState()
    const item = inv.items.find(i => i.id === itemId)
    if (!item || item.equipped || get().phase !== 'betting') return
    // Only T2-T5 can be bet (T6 has no upgrade, T1 is too low)
    const tierIdx = TIER_ORDER.indexOf(item.tier)
    if (tierIdx < 1 || tierIdx >= 5) return // t2=1 through t5=4

    // Create fresh deck and deal
    const deck = createDeck()
    const playerHand = [
      { ...deck.pop()!, faceUp: true },
      { ...deck.pop()!, faceUp: true },
    ]
    const dealerHand = [
      { ...deck.pop()!, faceUp: true },
      { ...deck.pop()!, faceUp: false },
    ]

    // Check for immediate blackjack
    if (isBlackjack(playerHand)) {
      dealerHand[1].faceUp = true

      if (isBlackjack(dealerHand)) {
        // Push — item returned
        set({
          phase: 'result', bet: 0, betItem: item, playerHand, dealerHand, deck,
          result: 'push', resultText: 'PUSH — ITEM SAFE', payout: 0,
          wonItem: null, itemLost: false,
          handsPlayed: get().handsPlayed + 1, pushes: get().pushes + 1,
        })
      } else {
        // Win — upgrade item
        const nextTier = TIER_ORDER[tierIdx + 1] as EquipTier
        const newItem = rollItemOfTier(nextTier)
        inv.removeItem(itemId)
        inv.addItem(newItem)
        set({
          phase: 'result', bet: 0, betItem: item, playerHand, dealerHand, deck,
          result: 'blackjack', resultText: 'BLACKJACK! ITEM UPGRADED!', payout: 0,
          wonItem: newItem, itemLost: false,
          handsPlayed: get().handsPlayed + 1, blackjacks: get().blackjacks + 1, wins: get().wins + 1,
        })
      }
      return
    }

    set({ phase: 'playing', bet: 0, betItem: item, playerHand, dealerHand, deck, wonItem: null, itemLost: false })
  },

  hit: () => {
    const s = get()
    if (s.phase !== 'playing') return

    const deck = [...s.deck]
    const card = deck.pop()!
    card.faceUp = true
    const playerHand = [...s.playerHand, card]
    const total = calculateHand(playerHand)

    if (total > 21) {
      // Bust — reveal dealer hole card
      const dealerHand = s.dealerHand.map(c => ({ ...c, faceUp: true }))
      set({
        playerHand, deck, dealerHand,
        phase: 'result', result: 'lose', resultText: 'BUST!', payout: 0,
        handsPlayed: s.handsPlayed + 1, losses: s.losses + 1,
      })
    } else if (total === 21) {
      // Auto-stand on 21
      set({ playerHand, deck })
      get().stand()
    } else {
      set({ playerHand, deck })
    }
  },

  stand: () => {
    const s = get()
    if (s.phase !== 'playing') return

    // Reveal dealer hole card
    const dealerHand = s.dealerHand.map(c => ({ ...c, faceUp: true }))
    const deck = [...s.deck]

    // Dealer hits until 17+
    while (calculateHandAll(dealerHand) < 17) {
      const card = deck.pop()!
      card.faceUp = true
      dealerHand.push(card)
    }

    const playerTotal = calculateHand(s.playerHand)
    const dealerTotal = calculateHandAll(dealerHand)

    let result: BjResult
    let resultText: string
    let payout = 0

    if (dealerTotal > 21) {
      result = 'win'
      resultText = 'DEALER BUST!'
      payout = s.bet * 2
    } else if (playerTotal > dealerTotal) {
      result = 'win'
      resultText = 'YOU WIN!'
      payout = s.bet * 2
    } else if (playerTotal < dealerTotal) {
      result = 'lose'
      resultText = 'DEALER WINS'
      payout = 0
    } else {
      result = 'push'
      resultText = 'PUSH'
      payout = s.bet // return bet
    }

    if (payout > 0) {
      usePlayerStore.getState().earnMoney(payout)
    }

    // Handle item bet outcome
    const betItem = s.betItem
    let wonItem: EquipItem | null = null
    let itemLost = false

    if (betItem) {
      const inv = useInventoryStore.getState()
      const tierIdx = TIER_ORDER.indexOf(betItem.tier)
      if (result === 'win') {
        // Upgrade — remove old, add new tier
        const nextTier = TIER_ORDER[tierIdx + 1] as EquipTier
        wonItem = rollItemOfTier(nextTier)
        inv.removeItem(betItem.id)
        inv.addItem(wonItem)
        resultText = 'YOU WIN! ITEM UPGRADED!'
      } else if (result === 'lose') {
        // Lose — destroy item
        inv.removeItem(betItem.id)
        itemLost = true
        resultText = 'DEALER WINS — ITEM LOST!'
      }
      // Push — item stays
    }

    const stats: Partial<BlackjackState> = { handsPlayed: s.handsPlayed + 1 }
    if (result === 'win') stats.wins = s.wins + 1
    else if (result === 'lose') stats.losses = s.losses + 1
    else if (result === 'push') stats.pushes = s.pushes + 1

    set({
      phase: 'result', dealerHand, deck,
      result, resultText, payout,
      wonItem, itemLost,
      ...stats,
    })
  },

  doubleDown: () => {
    const s = get()
    if (s.phase !== 'playing' || s.playerHand.length !== 2) return

    const player = usePlayerStore.getState()
    if (player.money < s.bet) return

    // Pay additional bet
    player.spendMoney(s.bet)
    const tax = Math.floor(s.bet * 0.10)
    useWorldStore.getState().addTreasuryTax(player.countryCode, tax)

    const newBet = s.bet * 2
    const deck = [...s.deck]
    const card = deck.pop()!
    card.faceUp = true
    const playerHand = [...s.playerHand, card]
    const total = calculateHand(playerHand)

    if (total > 21) {
      const dealerHand = s.dealerHand.map(c => ({ ...c, faceUp: true }))
      set({
        bet: newBet, playerHand, deck, dealerHand,
        phase: 'result', result: 'lose', resultText: 'BUST!', payout: 0,
        handsPlayed: s.handsPlayed + 1, losses: s.losses + 1,
      })
    } else {
      // Update bet and auto-stand
      set({ bet: newBet, playerHand, deck })
      get().stand()
    }
  },

  newRound: () => {
    set({
      phase: 'betting',
      bet: 0,
      playerHand: [],
      dealerHand: [],
      deck: [],
      result: null,
      resultText: '',
      payout: 0,
      betItem: null,
      wonItem: null,
      itemLost: false,
    })
  },

  clearItemResult: () => {
    set({ wonItem: null, itemLost: false })
  },
}))
