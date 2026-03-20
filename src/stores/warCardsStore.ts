import { create } from 'zustand'

import type { CardCategory, CardRarity, CardConditionContext, WarCardDefinition, EarnedWarCard, NFTMintState, NFTStatus, WeeklyTracking } from '../types/war.types'
export type { CardCategory, CardRarity, CardConditionContext, WarCardDefinition, EarnedWarCard, NFTMintState, NFTStatus, WeeklyTracking }

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

function emptyNFT(): NFTStatus {
  return { mintState: 'unminted' }
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
    condition: () => false, // Evaluated specially at week end
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
    condition: (ctx) => !!ctx.battleIsLargest, // Evaluated by record-tracking logic
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

  // ── SHAME (auto-spawn — these you can't avoid) ──
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
  weeklyTracking: WeeklyTracking
  /** Server-wide record for highest single hit */
  highestSingleHit: { playerId: string; playerName: string; damage: number } | null

  // ── Actions ──
  /** Main check routine — call after key game events */
  checkAndAwardCards: (playerId: string, playerName: string, ctx: Partial<CardConditionContext>, battleId?: string) => EarnedWarCard[]
  /** Get all cards earned by a player */
  getPlayerCards: (playerId: string) => EarnedWarCard[]
  /** Check if a first-only card has been claimed */
  isCardClaimed: (cardDefId: string) => boolean
  /** Get the full definition for a card */
  getCardDef: (cardDefId: string) => WarCardDefinition | undefined
  /** Hall of Fame — all earned cards sorted by date */
  getHallOfFame: () => EarnedWarCard[]
  /** Player leaderboard by card count */
  getLeaderboard: () => { playerId: string; playerName: string; count: number }[]

  // ── Weekly ──
  /** Track weekly damage for a player */
  addWeeklyDamage: (playerId: string, amount: number) => void
  /** Track weekly money for a player */
  addWeeklyMoney: (playerId: string, amount: number) => void
  /** Roll over to a new week — evaluate weekly cards, reset tracking */
  rolloverWeek: (newWeekNumber: number) => void

  // ── Records ──
  /** Check and update the highest single-hit record */
  checkSingleHitRecord: (playerId: string, playerName: string, damage: number, battleId?: string) => boolean

  // ── NFT ──
  /** Request minting for an earned card */
  requestMint: (earnedCardId: string, network: string) => { success: boolean; message: string }
  /** Callback when minting completes (from external service) */
  confirmMint: (earnedCardId: string, tokenId: string, txHash: string, metadataCID: string) => void
  /** Mark a mint as failed */
  failMint: (earnedCardId: string) => void
  /** Generate NFT metadata JSON for a card (for IPFS upload) */
  generateNFTMetadata: (earnedCardId: string) => object | null
}

// Week calculation (shared with prestigeStore)
const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000
const SERVER_EPOCH = new Date('2026-01-01').getTime()
const currentWeek = Math.floor((Date.now() - SERVER_EPOCH) / WEEK_DURATION) + 1

let earnedCardCounter = 0

export const useWarCardsStore = create<WarCardsState>((set, get) => ({
  cardDefinitions: CARD_DEFINITIONS,
  earnedCards: [],
  weeklyTracking: { weekNumber: currentWeek, damageByPlayer: {}, moneyByPlayer: {} },
  highestSingleHit: null,

  // ── Check & Award ──
  checkAndAwardCards: (playerId, playerName, partialCtx, battleId) => {
    const state = get()
    const weekly = state.weeklyTracking
    const awarded: EarnedWarCard[] = []

    // Build full context with defaults
    const ctx: CardConditionContext = {
      totalDamageDone: 0,
      totalMoney: 0,
      totalItemsProduced: 0,
      playerLevel: 0,
      totalCasesOpened: 0,
      totalItemsCrafted: 0,
      totalItemsDismantled: 0,
      weeklyDamage: weekly.damageByPlayer[playerId] ?? 0,
      weeklyMoney: weekly.moneyByPlayer[playerId] ?? 0,
      consecutiveWeeksTopDamage: 0,
      consecutiveWeeksTopEconomy: 0,
      ...partialCtx,
    }

    for (const def of state.cardDefinitions) {
      // Skip weekly cards (handled by rolloverWeek)
      if (def.weekly) continue

      // Skip first-only cards that are already claimed
      if (def.firstOnly && state.earnedCards.some(e => e.cardDefId === def.id)) continue

      // Skip cards this player already has (non-first-only, non-weekly)
      if (!def.firstOnly && state.earnedCards.some(e => e.cardDefId === def.id && e.playerId === playerId)) continue

      // Check condition
      if (!def.condition(ctx)) continue

      // Award!
      const earned: EarnedWarCard = {
        id: `wc_${++earnedCardCounter}_${Date.now()}`,
        cardDefId: def.id,
        playerId,
        playerName,
        earnedAt: Date.now(),
        recordValue: getRecordValue(def, ctx),
        battleId,
        nft: emptyNFT(),
      }
      awarded.push(earned)
    }

    if (awarded.length > 0) {
      set(s => ({ earnedCards: [...s.earnedCards, ...awarded] }))
    }

    return awarded
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

  // ── Weekly Tracking ──
  addWeeklyDamage: (playerId, amount) => set(s => ({
    weeklyTracking: {
      ...s.weeklyTracking,
      damageByPlayer: {
        ...s.weeklyTracking.damageByPlayer,
        [playerId]: (s.weeklyTracking.damageByPlayer[playerId] ?? 0) + amount,
      },
    },
  })),

  addWeeklyMoney: (playerId, amount) => set(s => ({
    weeklyTracking: {
      ...s.weeklyTracking,
      moneyByPlayer: {
        ...s.weeklyTracking.moneyByPlayer,
        [playerId]: (s.weeklyTracking.moneyByPlayer[playerId] ?? 0) + amount,
      },
    },
  })),

  rolloverWeek: (newWeekNumber) => {
    const state = get()
    const weekly = state.weeklyTracking

    // Find the "Weekly Warrior" winner (most damage this week)
    const weeklyWarriorDef = state.cardDefinitions.find(d => d.id === 'timed_weekly_warrior')
    if (weeklyWarriorDef) {
      const entries = Object.entries(weekly.damageByPlayer)
      if (entries.length > 0) {
        entries.sort((a, b) => b[1] - a[1])
        const [winnerId, winnerDmg] = entries[0]
        // Award the weekly card
        const earned: EarnedWarCard = {
          id: `wc_${++earnedCardCounter}_${Date.now()}`,
          cardDefId: 'timed_weekly_warrior',
          playerId: winnerId,
          playerName: winnerId, // In a real system, resolve to display name
          earnedAt: Date.now(),
          weekNumber: weekly.weekNumber,
          recordValue: winnerDmg,
          nft: emptyNFT(),
        }
        set(s => ({ earnedCards: [...s.earnedCards, earned] }))
      }
    }

    // Reset tracking
    set({ weeklyTracking: { weekNumber: newWeekNumber, damageByPlayer: {}, moneyByPlayer: {} } })
  },

  // ── Records ──
  checkSingleHitRecord: (playerId, playerName, damage, battleId) => {
    const state = get()
    const current = state.highestSingleHit

    if (current && current.damage >= damage) return false

    // New record!
    set({ highestSingleHit: { playerId, playerName, damage } })

    // Award (or re-award) the "One-Shot Wonder" card
    // Remove previous holder's card if it exists
    const existingCards = state.earnedCards.filter(e => e.cardDefId !== 'combat_one_shot')
    const earned: EarnedWarCard = {
      id: `wc_${++earnedCardCounter}_${Date.now()}`,
      cardDefId: 'combat_one_shot',
      playerId,
      playerName,
      earnedAt: Date.now(),
      recordValue: damage,
      battleId,
      nft: emptyNFT(),
    }
    set({ earnedCards: [...existingCards, earned] })
    return true
  },

  // ── NFT Scaffolding ──
  requestMint: (earnedCardId, network) => {
    const state = get()
    const card = state.earnedCards.find(e => e.id === earnedCardId)
    if (!card) return { success: false, message: 'Card not found.' }
    if (card.nft.mintState === 'minted') return { success: false, message: 'Already minted.' }
    if (card.nft.mintState === 'pending') return { success: false, message: 'Mint already in progress.' }

    // Mark as pending
    set(s => ({
      earnedCards: s.earnedCards.map(e =>
        e.id === earnedCardId
          ? { ...e, nft: { ...e.nft, mintState: 'pending' as NFTMintState, network } }
          : e
      ),
    }))

    // TODO: In production, call external minting service here
    // e.g., fetch('/api/mint', { method: 'POST', body: JSON.stringify(metadata) })
    console.log(`[WarCards NFT] Mint requested for card ${earnedCardId} on ${network}`)

    return { success: true, message: 'Minting initiated. This may take a few minutes.' }
  },

  confirmMint: (earnedCardId, tokenId, txHash, metadataCID) => {
    set(s => ({
      earnedCards: s.earnedCards.map(e =>
        e.id === earnedCardId
          ? { ...e, nft: { ...e.nft, mintState: 'minted' as NFTMintState, tokenId, txHash, metadataCID, mintedAt: Date.now() } }
          : e
      ),
    }))
  },

  failMint: (earnedCardId) => {
    set(s => ({
      earnedCards: s.earnedCards.map(e =>
        e.id === earnedCardId
          ? { ...e, nft: { ...e.nft, mintState: 'failed' as NFTMintState } }
          : e
      ),
    }))
  },

  generateNFTMetadata: (earnedCardId) => {
    const state = get()
    const earned = state.earnedCards.find(e => e.id === earnedCardId)
    if (!earned) return null
    const def = state.cardDefinitions.find(d => d.id === earned.cardDefId)
    if (!def) return null

    return {
      name: `XWAR: ${def.name}`,
      description: def.description,
      image: '', // TODO: Generate or link card artwork
      external_url: 'https://xwar.io', // TODO: Replace with real URL
      attributes: [
        { trait_type: 'Category', value: CARD_CATEGORY_META[def.category].label },
        { trait_type: 'Rarity', value: CARD_RARITY_META[def.rarity].label },
        { trait_type: 'Earned By', value: earned.playerName },
        { trait_type: 'Earned At', value: new Date(earned.earnedAt).toISOString() },
        ...(earned.recordValue ? [{ trait_type: 'Record Value', value: earned.recordValue }] : []),
        ...(earned.weekNumber ? [{ trait_type: 'Week', value: earned.weekNumber }] : []),
        { trait_type: 'First Only', value: def.firstOnly ? 'Yes' : 'No' },
      ],
    }
  },
}))

// ====== HELPERS ======

function getRecordValue(def: WarCardDefinition, ctx: CardConditionContext): number | undefined {
  switch (def.id) {
    case 'milestone_100k_dmg':
    case 'milestone_1m_dmg':
      return ctx.totalDamageDone
    case 'milestone_1m_money':
    case 'milestone_10m_money':
      return ctx.totalMoney
    case 'milestone_1k_items':
      return ctx.totalItemsProduced
    case 'timed_1m_dmg_week':
      return ctx.weeklyDamage
    case 'timed_top1_dmg_10w':
      return ctx.consecutiveWeeksTopDamage
    case 'timed_top1_econ_10w':
      return ctx.consecutiveWeeksTopEconomy
    case 'combat_dominator':
    case 'combat_biggest_battle':
      return ctx.battleDamageDealt
    case 'combat_iron_wall':
      return ctx.battleHitsTaken
    case 'combat_critical_mass':
      return ctx.battleCritsLanded
    case 'econ_casino_royale':
      return ctx.casinoSessionWinnings
    case 'econ_market_maker':
      return ctx.marketTransactions
    case 'econ_bond_king':
      return ctx.bondExchangeProfit
    case 'econ_case_addict':
      return ctx.totalCasesOpened
    case 'econ_master_crafter':
      return ctx.totalItemsCrafted
    case 'econ_scrap_lord':
      return ctx.totalItemsDismantled
    default:
      return undefined
  }
}
