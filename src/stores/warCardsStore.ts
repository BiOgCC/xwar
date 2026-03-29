import { create } from 'zustand'
import { api } from '../api/client'
import { usePlayerStore } from './playerStore'

import type { CardCategory, CardRarity, CardConditionContext, WarCardDefinition, EarnedWarCard, WeeklyTracking } from '../types/war.types'
export type { CardCategory, CardRarity, CardConditionContext, WarCardDefinition, EarnedWarCard, WeeklyTracking }

export const CARD_CATEGORY_META: Record<CardCategory, { label: string; color: string; icon: string }> = {
  milestone: { label: 'Milestone', color: '#f59e0b', icon: '🏆' },
  timed:     { label: 'Timed',     color: '#06b6d4', icon: '⏱️' },
  combat:    { label: 'Combat',    color: '#ef4444', icon: '⚔️' },
  economic:  { label: 'Economic',  color: '#22d38a', icon: '💰' },
  shame:     { label: 'Shame',     color: '#f472b6', icon: '🤡' },
}

export const CARD_RARITY_META: Record<CardRarity, { label: string; color: string; glowEffect: string }> = {
  common:    { label: 'Common',    color: '#9ca3af', glowEffect: 'none' },
  uncommon:  { label: 'Uncommon',  color: '#22d38a', glowEffect: 'glow' },
  rare:      { label: 'Rare',      color: '#3b82f6', glowEffect: 'pulse' },
  epic:      { label: 'Epic',      color: '#a855f7', glowEffect: 'shimmer' },
  legendary: { label: 'Legendary', color: '#f59e0b', glowEffect: 'animated-gold' },
}

// ====== CARD DEFINITIONS ======

const CARD_DEFINITIONS: WarCardDefinition[] = [
  // ── MILESTONE ──
  {
    id: 'milestone_100k_dmg',
    name: 'Hundred Thousand Club',
    description: 'First player to deal 100,000 total damage.',
    flavorText: '"The first cut is the deepest."',
    category: 'milestone', rarity: 'common', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalDamageDone >= 100_000,
  },
  {
    id: 'milestone_1m_money',
    name: 'The Millionaire',
    description: 'First player to accumulate $1,000,000.',
    flavorText: '"Money talks. A million dollars screams."',
    category: 'milestone', rarity: 'uncommon', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalMoney >= 1_000_000,
  },
  {
    id: 'milestone_1m_dmg',
    name: 'Million Damage',
    description: 'First player to deal 1,000,000 total damage.',
    flavorText: '"A million reasons to fear you."',
    category: 'milestone', rarity: 'rare', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalDamageDone >= 1_000_000,
  },
  {
    id: 'milestone_10m_money',
    name: 'Ten Million Mogul',
    description: 'First player to accumulate $10,000,000.',
    flavorText: '"At this point, it\'s not about the money anymore."',
    category: 'milestone', rarity: 'epic', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalMoney >= 10_000_000,
  },
  {
    id: 'milestone_1k_items',
    name: 'Industrial Giant',
    description: 'First player to produce 1,000 items.',
    flavorText: '"The factory never sleeps."',
    category: 'milestone', rarity: 'uncommon', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalItemsProduced >= 1_000,
  },

  // ── TIMED ──
  {
    id: 'timed_1m_dmg_week',
    name: 'Blitzkrieg',
    description: 'First player to deal 1,000,000 damage within a single week.',
    flavorText: '"Seven days. One million reasons."',
    category: 'timed', rarity: 'legendary', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.weeklyDamage >= 1_000_000,
  },
  {
    id: 'timed_weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Deal the most damage in a week.',
    flavorText: '"This week belongs to you."',
    category: 'timed', rarity: 'rare', firstOnly: false, weekly: true,
    condition: () => false, // Evaluated at week end on backend
  },
  {
    id: 'timed_top1_dmg_10w',
    name: 'War Machine',
    description: 'Hold #1 damage for 10 consecutive weeks.',
    flavorText: '"Ten weeks on top. An era of dominance."',
    category: 'timed', rarity: 'legendary', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.consecutiveWeeksTopDamage >= 10,
  },
  {
    id: 'timed_top1_econ_10w',
    name: 'Economic Overlord',
    description: 'Hold #1 economy for 10 consecutive weeks.',
    flavorText: '"The invisible hand belongs to you."',
    category: 'timed', rarity: 'legendary', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.consecutiveWeeksTopEconomy >= 10,
  },

  // ── COMBAT ──
  {
    id: 'combat_one_shot',
    name: 'One-Shot Wonder',
    description: 'Record the highest single-hit damage ever on the server.',
    flavorText: '"One shot. One legend."',
    category: 'combat', rarity: 'epic', firstOnly: false, weekly: false,
    condition: () => false, // Evaluated by record-tracking logic
  },
  {
    id: 'combat_dominator',
    name: 'Battle Dominator',
    description: 'Deal 50%+ of all damage in a single battle.',
    flavorText: '"This wasn\'t a battle. It was a demonstration."',
    category: 'combat', rarity: 'rare', firstOnly: true, weekly: false,
    condition: (ctx) => {
      if (!ctx.battleDamageDealt || !ctx.battleTotalDamage) return false
      return ctx.battleDamageDealt / ctx.battleTotalDamage >= 0.5
    },
  },
  {
    id: 'combat_iron_wall',
    name: 'Iron Wall',
    description: 'Survive 100+ hits in a single battle.',
    flavorText: '"They hit the wall. The wall hit back."',
    category: 'combat', rarity: 'uncommon', firstOnly: true, weekly: false,
    condition: (ctx) => (ctx.battleHitsTaken ?? 0) >= 100,
  },
  {
    id: 'combat_critical_mass',
    name: 'Critical Mass',
    description: 'Land 10+ critical hits in a single battle.',
    flavorText: '"Precision is the deadliest weapon."',
    category: 'combat', rarity: 'uncommon', firstOnly: true, weekly: false,
    condition: (ctx) => (ctx.battleCritsLanded ?? 0) >= 10,
  },
  {
    id: 'combat_biggest_battle',
    name: 'Titan of War',
    description: 'Deal the most damage in the largest battle on the server.',
    flavorText: '"When the world went to war, you stood tallest."',
    category: 'combat', rarity: 'legendary', firstOnly: false, weekly: false,
    condition: (ctx) => !!ctx.battleIsLargest,
  },
  {
    id: 'combat_comeback',
    name: 'Biggest Comeback',
    description: 'Flip a battle from 50%+ points deficit with the enemy at 599 points.',
    flavorText: '"They had 599. You had something better: willpower."',
    category: 'combat', rarity: 'legendary', firstOnly: false, weekly: false,
    condition: (ctx) => !!ctx.battleIsComeback,
  },

  // ── ECONOMIC ──
  {
    id: 'econ_casino_royale',
    name: 'Casino Royale',
    description: 'First to win $20,000,000 in a single casino session.',
    flavorText: '"Twenty million reasons the house should fear you."',
    category: 'economic', rarity: 'legendary', firstOnly: true, weekly: false,
    condition: (ctx) => (ctx.casinoSessionWinnings ?? 0) >= 20_000_000,
  },
  {
    id: 'econ_market_maker',
    name: 'Market Maker',
    description: 'Complete 100 market transactions.',
    flavorText: '"Buy low, sell high, repeat."',
    category: 'economic', rarity: 'uncommon', firstOnly: true, weekly: false,
    condition: (ctx) => (ctx.marketTransactions ?? 0) >= 100,
  },
  {
    id: 'econ_bond_king',
    name: 'Bond King',
    description: 'First to earn $2,000,000 profit on a single bond exchange.',
    flavorText: '"Two million on one trade. The market remembers."',
    category: 'economic', rarity: 'epic', firstOnly: true, weekly: false,
    condition: (ctx) => (ctx.bondExchangeProfit ?? 0) >= 2_000_000,
  },
  {
    id: 'econ_case_addict',
    name: 'Case Addict',
    description: 'First player to open 10,000 cases.',
    flavorText: '"Just one more. Famous last words."',
    category: 'economic', rarity: 'rare', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalCasesOpened >= 10_000,
  },
  {
    id: 'econ_master_crafter',
    name: 'Master Crafter',
    description: 'First player to craft 1,000 items.',
    flavorText: '"A thousand creations. Each one a masterpiece."',
    category: 'economic', rarity: 'rare', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalItemsCrafted >= 1_000,
  },
  {
    id: 'econ_scrap_lord',
    name: 'Scrap Lord',
    description: 'First player to dismantle 20,000 items.',
    flavorText: '"Nothing is wasted. Everything is recycled."',
    category: 'economic', rarity: 'epic', firstOnly: true, weekly: false,
    condition: (ctx) => ctx.totalItemsDismantled >= 20_000,
  },

  // ── SHAME ──
  {
    id: 'shame_silenced',
    name: 'Silenced',
    description: 'Get muted by admins 3 times.',
    flavorText: '"Some people just can\'t help themselves."',
    category: 'shame', rarity: 'common', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.muteCount ?? 0) >= 3,
  },
  {
    id: 'shame_motor_mouth',
    name: 'Motor Mouth',
    description: 'Get muted by admins 10 times.',
    flavorText: '"Banned from every bar in the country."',
    category: 'shame', rarity: 'uncommon', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.muteCount ?? 0) >= 10,
  },
  {
    id: 'shame_persona_non_grata',
    name: 'Persona Non Grata',
    description: 'Get muted by admins 25 times.',
    flavorText: '"Even the bots blocked you."',
    category: 'shame', rarity: 'rare', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.muteCount ?? 0) >= 25,
  },
  {
    id: 'shame_cannon_fodder',
    name: 'Cannon Fodder',
    description: 'Die 1,000 times in battle.',
    flavorText: '"The enemy\'s favorite target."',
    category: 'shame', rarity: 'uncommon', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.deathCount ?? 0) >= 1_000,
  },
  {
    id: 'shame_white_flag',
    name: 'White Flag',
    description: 'Lose 50 battles.',
    flavorText: '"Strategic retreat... again."',
    category: 'shame', rarity: 'common', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.battlesLost ?? 0) >= 50,
  },
  {
    id: 'shame_clown_street',
    name: 'Clown of Wall Street',
    description: 'Lose $500,000 total in the casino.',
    flavorText: '"The casino sends a thank-you card."',
    category: 'shame', rarity: 'rare', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.totalCasinoLosses ?? 0) >= 500_000,
  },
  {
    id: 'shame_broke_again',
    name: 'Broke Again',
    description: 'Go bankrupt 5 times.',
    flavorText: '"Money comes and goes... mostly goes."',
    category: 'shame', rarity: 'uncommon', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.bankruptcyCount ?? 0) >= 5,
  },
  {
    id: 'shame_country_hopper',
    name: 'Country Hopper',
    description: 'Switch countries 10 times.',
    flavorText: '"Loyalty is just a word."',
    category: 'shame', rarity: 'common', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.countrySwitches ?? 0) >= 10,
  },
  {
    id: 'shame_addicted',
    name: 'Addicted',
    description: 'Spin the casino 10,000 times.',
    flavorText: '"Just one more spin..."',
    category: 'shame', rarity: 'epic', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.casinoSpins ?? 0) >= 10_000,
  },
  {
    id: 'shame_pyromaniac',
    name: 'Pyromaniac',
    description: 'Destroy 500 items total.',
    flavorText: '"If it exists, it burns."',
    category: 'shame', rarity: 'uncommon', firstOnly: false, weekly: false,
    condition: (ctx) => (ctx.itemsDestroyed ?? 0) >= 500,
  },
]

// ====== STORE ======

export interface WarCardsState {
  cardDefinitions: WarCardDefinition[]
  earnedCards: EarnedWarCard[]

  // ── Actions ──
  fetchAllCards: () => Promise<void>
  fetchMyCards: () => Promise<void>
  /** Get all cards earned by a player (by UUID) */
  getPlayerCards: (playerId: string) => EarnedWarCard[]
  /** Check if a first-only card has been claimed */
  isCardClaimed: (cardDefId: string) => boolean
  /** Get the full definition for a card */
  getCardDef: (cardDefId: string) => WarCardDefinition | undefined
  /** Hall of Fame — all earned cards sorted by date */
  getHallOfFame: () => EarnedWarCard[]
  /** Player leaderboard by card count */
  getLeaderboard: () => { playerId: string; playerName: string; count: number }[]
  /** Export collection summary as shareable text */
  exportCollection: (playerName: string) => string
}

export const useWarCardsStore = create<WarCardsState>((set, get) => ({
  cardDefinitions: CARD_DEFINITIONS,
  earnedCards: [],

  // ── API Fetchers ──
  fetchAllCards: async () => {
    try {
      const res: any = await api.get('/warcards/all')
      if (res.success && res.cards) {
        set(s => {
          const fetched: EarnedWarCard[] = res.cards.map((c: any) => ({
            id: c.id,
            cardDefId: c.cardDefId,
            playerId: c.playerId,
            playerName: c.playerName || 'Unknown',
            earnedAt: new Date(c.earnedAt).getTime(),
          }))

          const myPlayerId = usePlayerStore.getState().id
          const existingMyCards = s.earnedCards.filter(e => e.playerId === myPlayerId)
          const fetchedOthers = fetched.filter(e => e.playerId !== myPlayerId)

          return { earnedCards: [...existingMyCards, ...fetchedOthers] }
        })
      }
    } catch (e) { console.error('Error fetching war cards', e) }
  },

  fetchMyCards: async () => {
    try {
      const res: any = await api.get('/warcards')
      if (res.success && res.cards) {
        const playerId = usePlayerStore.getState().id
        const playerName = usePlayerStore.getState().name
        const myMapped: EarnedWarCard[] = res.cards.map((c: any) => ({
          id: c.id,
          cardDefId: c.cardDefId,
          playerId: c.playerId || playerId,
          playerName,
          earnedAt: new Date(c.earnedAt).getTime(),
        }))
        // Only override my cards, keeping others for Hall of Fame
        set(s => ({
          earnedCards: [
            ...s.earnedCards.filter(e => e.playerId !== playerId),
            ...myMapped,
          ],
        }))
      }
    } catch (e) { console.error('Error fetching my cards', e) }
  },

  getPlayerCards: (playerId) => get().earnedCards.filter(e => e.playerId === playerId),

  isCardClaimed: (cardDefId) => get().earnedCards.some(e => e.cardDefId === cardDefId),

  getCardDef: (cardDefId) => get().cardDefinitions.find(d => d.id === cardDefId),

  getHallOfFame: () => [...get().earnedCards].sort((a, b) => b.earnedAt - a.earnedAt),

  getLeaderboard: () => {
    const counts: Record<string, { playerName: string; count: number }> = {}
    for (const e of get().earnedCards) {
      if (!counts[e.playerId]) counts[e.playerId] = { playerName: e.playerName, count: 0 }
      counts[e.playerId].count++
    }
    return Object.entries(counts)
      .map(([playerId, data]) => ({ playerId, ...data }))
      .sort((a, b) => b.count - a.count)
  },

  exportCollection: (playerName: string) => {
    const state = get()
    const myCards = state.earnedCards.filter(e => e.playerName === playerName)
    if (myCards.length === 0) return `🃏 ${playerName}'s War Cards: None earned yet.`

    const lines = [`🃏 **${playerName}'s War Cards** (${myCards.length}/${state.cardDefinitions.length})\n`]
    const byCategory: Record<string, { def: WarCardDefinition; earned: EarnedWarCard }[]> = {}

    for (const earned of myCards) {
      const def = state.getCardDef(earned.cardDefId)
      if (!def) continue
      if (!byCategory[def.category]) byCategory[def.category] = []
      byCategory[def.category].push({ def, earned })
    }

    for (const [cat, cards] of Object.entries(byCategory)) {
      const meta = CARD_CATEGORY_META[cat as CardCategory]
      lines.push(`${meta.icon} **${meta.label}**`)
      for (const { def } of cards) {
        const rarMeta = CARD_RARITY_META[def.rarity]
        lines.push(`  ${rarMeta.label} — ${def.name}`)
      }
    }

    return lines.join('\n')
  },
}))
