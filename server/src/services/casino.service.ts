/**
 * Casino Service — Server-side RNG for all casino games
 * Prevents client-side manipulation of outcomes
 */
import { db } from '../db/connection.js'
import { players } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'
import { spendMoney, earnMoney } from './player.service.js'
import crypto from 'crypto'

/** Crypto-safe random number between 0 and 1 */
function cryptoRandom(): number {
  const buffer = crypto.randomBytes(4)
  return buffer.readUInt32BE(0) / 0xFFFFFFFF
}

/** Add 15% tax to country fund */
async function addBetTax(playerId: string, betAmount: number) {
  const [p] = await db.select({ countryCode: players.countryCode }).from(players).where(eq(players.id, playerId)).limit(1)
  const tax = Math.floor(betAmount * 0.15)
  if (p?.countryCode) {
    await db.execute(sql`UPDATE countries SET fund = jsonb_set(fund, '{money}', (COALESCE(fund->>'money','0')::bigint + ${tax})::text::jsonb) WHERE code = ${p.countryCode}`)
  }
  await db.execute(sql`UPDATE players SET casino_spins = casino_spins + 1 WHERE id = ${playerId}`)
}

async function trackLoss(playerId: string, amount: number) {
  await db.execute(sql`UPDATE players SET total_casino_losses = total_casino_losses + ${amount} WHERE id = ${playerId}`)
}

// ═══════════════════════════════════════
//  SLOTS
// ═══════════════════════════════════════

const SLOT_SYMBOLS = ['rifle', 'grenade', 'medal', 'swords', 'shield', 'skull', 'badge', 'star'] as const
type SlotSymbol = typeof SLOT_SYMBOLS[number]

const PAYOUTS: Record<SlotSymbol, number> = {
  star: 50, badge: 25, medal: 15, swords: 10,
  rifle: 8, grenade: 6, shield: 4, skull: 3,
}

const SYMBOL_WEIGHTS: [SlotSymbol, number][] = [
  ['skull', 25], ['shield', 22], ['grenade', 16], ['rifle', 12],
  ['swords', 8], ['medal', 4], ['badge', 2], ['star', 1],
]
const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((s, [, w]) => s + w, 0)

function randomSymbol(): SlotSymbol {
  let roll = cryptoRandom() * TOTAL_WEIGHT
  for (const [sym, weight] of SYMBOL_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return sym
  }
  return 'skull'
}

export const SLOTS_BETS = [5_000, 25_000, 50_000, 100_000, 250_000]

export async function spinSlots(playerId: string, betAmount: number) {
  if (!SLOTS_BETS.includes(betAmount)) throw new Error('Invalid bet amount')

  const ok = await spendMoney(playerId, betAmount)
  if (!ok) throw new Error('Insufficient funds')

  await addBetTax(playerId, betAmount)

  const r1 = randomSymbol(), r2 = randomSymbol(), r3 = randomSymbol()

  let payout = 0
  let resultType: 'jackpot' | 'win' | 'lose' = 'lose'
  let resultText = 'NO MATCH'

  if (r1 === r2 && r2 === r3) {
    payout = betAmount * PAYOUTS[r1]
    resultText = r1 === 'star' ? 'JACKPOT! ⭐⭐⭐' : `${r1} ×3 — ${PAYOUTS[r1]}×!`
    resultType = r1 === 'star' ? 'jackpot' : 'win'
  } else if (r1 === r2 || r2 === r3 || r1 === r3) {
    payout = Math.floor(betAmount * 1.6)
    resultType = 'win'
    resultText = 'PAIR — 1.6×'
  }

  if (payout > 0) await earnMoney(playerId, payout)
  else await trackLoss(playerId, betAmount)

  return { reels: [r1, r2, r3], payout, resultType, resultText }
}

// ═══════════════════════════════════════
//  BLACKJACK
// ═══════════════════════════════════════

type Suit = '♠' | '♥' | '♦' | '♣'
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
interface Card { suit: Suit; rank: Rank }

const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank })
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(cryptoRandom() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function handTotal(cards: Card[]): number {
  let total = 0, aces = 0
  for (const c of cards) {
    total += c.rank === 'A' ? 11 : ['K','Q','J'].includes(c.rank) ? 10 : parseInt(c.rank)
    if (c.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

export const BJ_BETS = [10_000, 50_000, 100_000, 250_000, 500_000]

// In-memory sessions
const bjSessions = new Map<string, { deck: Card[]; playerHand: Card[]; dealerHand: Card[]; bet: number }>()

export async function blackjackStart(playerId: string, betAmount: number) {
  if (!BJ_BETS.includes(betAmount)) throw new Error('Invalid bet amount')
  const ok = await spendMoney(playerId, betAmount)
  if (!ok) throw new Error('Insufficient funds')
  await addBetTax(playerId, betAmount)

  const deck = createDeck()
  const playerHand = [deck.pop()!, deck.pop()!]
  const dealerHand = [deck.pop()!, deck.pop()!]

  if (handTotal(playerHand) === 21 && playerHand.length === 2) {
    if (handTotal(dealerHand) === 21 && dealerHand.length === 2) {
      await earnMoney(playerId, betAmount)
      return { playerHand, dealerHand, phase: 'done', result: 'push', resultText: 'PUSH — BOTH BLACKJACK', payout: betAmount, playerTotal: 21, dealerTotal: 21 }
    }
    const payout = Math.floor(betAmount * 2.5)
    await earnMoney(playerId, payout)
    return { playerHand, dealerHand, phase: 'done', result: 'blackjack', resultText: 'BLACKJACK!', payout, playerTotal: 21, dealerTotal: handTotal(dealerHand) }
  }

  bjSessions.set(playerId, { deck, playerHand, dealerHand, bet: betAmount })
  return { playerHand, dealerHand: [dealerHand[0]], phase: 'playing', playerTotal: handTotal(playerHand) }
}

export async function blackjackHit(playerId: string) {
  const s = bjSessions.get(playerId)
  if (!s) throw new Error('No active game')
  const card = s.deck.pop()!
  s.playerHand.push(card)
  const total = handTotal(s.playerHand)
  if (total > 21) {
    bjSessions.delete(playerId)
    await trackLoss(playerId, s.bet)
    return { card, playerHand: s.playerHand, dealerHand: s.dealerHand, phase: 'done', result: 'lose', resultText: 'BUST!', payout: 0, playerTotal: total, dealerTotal: handTotal(s.dealerHand) }
  }
  if (total === 21) return blackjackStand(playerId)
  return { card, playerHand: s.playerHand, dealerHand: [s.dealerHand[0]], phase: 'playing', playerTotal: total }
}

export async function blackjackStand(playerId: string) {
  const s = bjSessions.get(playerId)
  if (!s) throw new Error('No active game')
  bjSessions.delete(playerId)
  while (handTotal(s.dealerHand) < 17) s.dealerHand.push(s.deck.pop()!)
  const pt = handTotal(s.playerHand), dt = handTotal(s.dealerHand)
  let result: string, text: string, payout = 0
  if (dt > 21) { result = 'win'; text = 'DEALER BUST!'; payout = s.bet * 2 }
  else if (pt > dt) { result = 'win'; text = 'YOU WIN!'; payout = s.bet * 2 }
  else if (pt < dt) { result = 'lose'; text = 'DEALER WINS' }
  else { result = 'push'; text = 'PUSH'; payout = s.bet }
  if (payout > 0) await earnMoney(playerId, payout)
  if (result === 'lose') await trackLoss(playerId, s.bet)
  return { playerHand: s.playerHand, dealerHand: s.dealerHand, phase: 'done', result, resultText: text, payout, playerTotal: pt, dealerTotal: dt }
}

// ═══════════════════════════════════════
//  CRASH
// ═══════════════════════════════════════

export const CRASH_BETS = [10_000, 50_000, 100_000, 250_000, 500_000]

function generateCrashPoint(): number {
  const r = cryptoRandom()
  if (r < 0.01) return 100
  let cp = (1 - 0.09) / r
  return Math.min(100, Math.max(1.10, Math.round(cp * 100) / 100))
}

const crashSessions = new Map<string, { bet: number; crashPoint: number; startedAt: number }>()

export async function crashBet(playerId: string, betAmount: number) {
  if (!CRASH_BETS.includes(betAmount)) throw new Error('Invalid bet amount')
  if (crashSessions.has(playerId)) throw new Error('Already in a round')
  const ok = await spendMoney(playerId, betAmount)
  if (!ok) throw new Error('Insufficient funds')
  await addBetTax(playerId, betAmount)
  const crashPoint = generateCrashPoint()
  crashSessions.set(playerId, { bet: betAmount, crashPoint, startedAt: Date.now() })
  const hash = crypto.createHash('sha256').update(`${crashPoint}-${playerId}-${Date.now()}`).digest('hex').slice(0, 12)
  return { hash, bet: betAmount }
}

export async function crashCashout(playerId: string, clientMultiplier: number) {
  const s = crashSessions.get(playerId)
  if (!s) throw new Error('No active crash round')
  crashSessions.delete(playerId)

  // Server validates time-based multiplier (can't exceed crash point)
  const elapsed = (Date.now() - s.startedAt) / 1000
  const serverMult = Math.round(Math.pow(1 + 0.0065, elapsed / 0.05) * 100) / 100
  const useMult = Math.min(clientMultiplier, serverMult)

  if (useMult >= s.crashPoint) {
    await trackLoss(playerId, s.bet)
    return { success: false, crashed: true, crashPoint: s.crashPoint, payout: 0 }
  }

  const payout = Math.floor(s.bet * useMult)
  await earnMoney(playerId, payout)
  return { success: true, crashed: false, cashoutMultiplier: useMult, payout, crashPoint: s.crashPoint }
}

export function crashReportCrash(playerId: string) {
  const s = crashSessions.get(playerId)
  if (!s) return null
  crashSessions.delete(playerId)
  // Don't track loss here — it was already tracked via crashCashout failing or timeout
  return { crashPoint: s.crashPoint }
}

// ═══════════════════════════════════════
//  WHEEL (Casino Spin)
// ═══════════════════════════════════════

interface WheelSegment { label: string; type: 'multiply' | 'item' | 'bankrupt'; multiplier: number; itemTier?: string; probability: number }

const WHEEL_100K: WheelSegment[] = [
  { label: '×1.5', type: 'multiply', multiplier: 1.5, probability: 18 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 7 },
  { label: '×2', type: 'multiply', multiplier: 2, probability: 12 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 6 },
  { label: 'T4 ITEM', type: 'item', multiplier: 0, probability: 8, itemTier: 't4' },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 6 },
  { label: '×3', type: 'multiply', multiplier: 3, probability: 8 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 7 },
  { label: 'T4 ITEM', type: 'item', multiplier: 0, probability: 6, itemTier: 't4' },
  { label: '×1.5', type: 'multiply', multiplier: 1.5, probability: 10 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 6 },
  { label: '×2', type: 'multiply', multiplier: 2, probability: 6 },
]
const WHEEL_250K: WheelSegment[] = [
  { label: '×2', type: 'multiply', multiplier: 2, probability: 10 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 8 },
  { label: '×3', type: 'multiply', multiplier: 3, probability: 8 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 8 },
  { label: 'T4 ITEM', type: 'item', multiplier: 0, probability: 7, itemTier: 't4' },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 8 },
  { label: '×5', type: 'multiply', multiplier: 5, probability: 4 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 7 },
  { label: 'T5 ITEM', type: 'item', multiplier: 0, probability: 5, itemTier: 't5' },
  { label: '×1.5', type: 'multiply', multiplier: 1.5, probability: 12 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 7 },
  { label: '×1.5', type: 'multiply', multiplier: 1.5, probability: 10 },
]
const WHEEL_500K: WheelSegment[] = [
  { label: '×2', type: 'multiply', multiplier: 2, probability: 10 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 9 },
  { label: '×3', type: 'multiply', multiplier: 3, probability: 8 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 9 },
  { label: 'T5 ITEM', type: 'item', multiplier: 0, probability: 5, itemTier: 't5' },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 9 },
  { label: '×5', type: 'multiply', multiplier: 5, probability: 5 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 9 },
  { label: 'T6 ITEM', type: 'item', multiplier: 0, probability: 3, itemTier: 't6' },
  { label: '×2', type: 'multiply', multiplier: 2, probability: 4 },
  { label: 'BUST', type: 'bankrupt', multiplier: 0, probability: 9 },
  { label: '×10', type: 'multiply', multiplier: 10, probability: 3 },
]

const TIER_WHEELS: Record<number, WheelSegment[]> = { 100_000: WHEEL_100K, 250_000: WHEEL_250K, 500_000: WHEEL_500K }
export const WHEEL_BETS = [100_000, 250_000, 500_000]

export async function spinWheel(playerId: string, betAmount: number) {
  if (!WHEEL_BETS.includes(betAmount)) throw new Error('Invalid bet amount')
  const ok = await spendMoney(playerId, betAmount)
  if (!ok) throw new Error('Insufficient funds')
  await addBetTax(playerId, betAmount)

  const segments = TIER_WHEELS[betAmount]
  const total = segments.reduce((s, seg) => s + seg.probability, 0)
  let roll = cryptoRandom() * total
  let idx = 0
  for (let i = 0; i < segments.length; i++) { roll -= segments[i].probability; if (roll <= 0) { idx = i; break } }
  const seg = segments[idx]

  let payout = 0, resultType: 'win' | 'lose' | 'item' = 'lose', itemTier: string | undefined

  if (seg.type === 'multiply') { payout = Math.floor(betAmount * seg.multiplier); await earnMoney(playerId, payout); resultType = 'win' }
  else if (seg.type === 'item') { itemTier = seg.itemTier; resultType = 'item' }
  else { await trackLoss(playerId, betAmount) }

  return { index: idx, segment: seg.label, payout, resultType, itemTier }
}
