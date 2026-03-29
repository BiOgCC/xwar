import { EventEmitter } from 'events'
import { db } from '../db/connection.js'
import { players, warCards } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'

export const warCardEmitter = new EventEmitter()

// ═══════════════════════════════════════════════
//  CARD DEFINITIONS — synced with frontend warCardsStore.ts
//  Only cards evaluable from player stats rows are included here.
//  Battle-context cards are evaluated via evaluateBattleCards().
// ═══════════════════════════════════════════════

interface CardDef {
  type: string          // player column name
  threshold: number
  firstOnly: boolean    // only one player can ever earn it
}

const STAT_CARD_DEFS: Record<string, CardDef> = {
  // ── Milestone ──
  'milestone_100k_dmg':   { type: 'damageDone',        threshold: 100_000,    firstOnly: true },
  'milestone_1m_dmg':     { type: 'damageDone',        threshold: 1_000_000,  firstOnly: true },
  'milestone_1m_money':   { type: 'money',             threshold: 1_000_000,  firstOnly: true },
  'milestone_10m_money':  { type: 'money',             threshold: 10_000_000, firstOnly: true },
  'milestone_1k_items':   { type: 'itemsProduced',     threshold: 1_000,      firstOnly: true },

  // ── Economic ──
  'econ_market_maker':    { type: 'itemsProduced',     threshold: 100,        firstOnly: true },  // approx: 100 production cycles

  // ── Shame ──
  'shame_silenced':       { type: 'muteCount',         threshold: 3,          firstOnly: false },
  'shame_motor_mouth':    { type: 'muteCount',         threshold: 10,         firstOnly: false },
  'shame_persona_non_grata': { type: 'muteCount',      threshold: 25,         firstOnly: false },
  'shame_cannon_fodder':  { type: 'deathCount',        threshold: 1_000,      firstOnly: false },
  'shame_white_flag':     { type: 'battlesLost',       threshold: 50,         firstOnly: false },
  'shame_clown_street':   { type: 'totalCasinoLosses', threshold: 500_000,    firstOnly: false },
  'shame_broke_again':    { type: 'bankruptcyCount',   threshold: 5,          firstOnly: false },
  'shame_country_hopper': { type: 'countrySwitches',   threshold: 10,         firstOnly: false },
  'shame_addicted':       { type: 'casinoSpins',       threshold: 10_000,     firstOnly: false },
  'shame_pyromaniac':     { type: 'itemsDestroyed',    threshold: 500,        firstOnly: false },
}

// DB column name → snake_case mapping for the players table
const COLUMN_MAP: Record<string, string> = {
  damageDone: 'damage_done',
  money: 'money',
  itemsProduced: 'items_produced',
  muteCount: 'mute_count',
  deathCount: 'death_count',
  battlesLost: 'battles_lost',
  totalCasinoLosses: 'total_casino_losses',
  bankruptcyCount: 'bankruptcy_count',
  countrySwitches: 'country_switches',
  casinoSpins: 'casino_spins',
  itemsDestroyed: 'items_destroyed',
}

// ═══════════════════════════════════════════════
//  STAT-BASED CARD EVALUATION (triggered on player_action)
// ═══════════════════════════════════════════════

warCardEmitter.on('player_action', async (playerId: string) => {
  try {
    // 1. Fetch current player stats
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) return

    // 2. Fetch already earned cards for this player
    const existingCards = await db.select().from(warCards).where(eq(warCards.playerId, playerId))
    const earnedDefIds = new Set(existingCards.map(c => c.cardDefId))

    const newCardsToMint: { playerId: string; cardDefId: string; minted: boolean }[] = []

    // 3. Evaluate all stat-based cards
    for (const [defId, criteria] of Object.entries(STAT_CARD_DEFS)) {
      if (earnedDefIds.has(defId)) continue // Already has it

      // For firstOnly cards, check if anyone already earned it
      if (criteria.firstOnly) {
        const [existing] = await db.select({ id: warCards.id })
          .from(warCards)
          .where(eq(warCards.cardDefId, defId))
          .limit(1)
        if (existing) continue // Someone else already claimed it
      }

      const colName = COLUMN_MAP[criteria.type]
      if (!colName) continue

      const statValue = Number((player as any)[criteria.type] ?? 0)

      if (statValue >= criteria.threshold) {
        newCardsToMint.push({
          playerId,
          cardDefId: defId,
          minted: false,
        })
      }
    }

    // 4. Issue new cards
    if (newCardsToMint.length > 0) {
      await db.insert(warCards).values(newCardsToMint)
      console.log(`[WAR CARDS] Awarded ${newCardsToMint.length} new cards for player ${playerId}: ${newCardsToMint.map(c => c.cardDefId).join(', ')}`)
    }

  } catch (err) {
    console.error('[WAR CARDS] Stat evaluation error:', err)
  }
})

// ═══════════════════════════════════════════════
//  BATTLE-CONTEXT CARD EVALUATION
//  Called from battle.service.ts after each attack
// ═══════════════════════════════════════════════

export interface BattleCardContext {
  playerId: string
  battleId: string
  playerDamageInBattle: number
  totalBattleDamage: number
  critsLanded: number
  hitsTaken: number
  singleHitDamage: number
  isComeback: boolean
  isLargestBattle: boolean
  battleDamageRatio: number   // player damage / total battle damage
}

export async function evaluateBattleCards(ctx: BattleCardContext): Promise<string[]> {
  const awarded: string[] = []

  try {
    // Fetch already earned cards for this player
    const existingCards = await db.select({ cardDefId: warCards.cardDefId })
      .from(warCards)
      .where(eq(warCards.playerId, ctx.playerId))
    const earned = new Set(existingCards.map(c => c.cardDefId))

    const toAward: { playerId: string; cardDefId: string; minted: boolean }[] = []

    // combat_dominator: dealt 50%+ of all damage in a battle
    if (!earned.has('combat_dominator') && ctx.battleDamageRatio >= 0.5) {
      const [existing] = await db.select({ id: warCards.id }).from(warCards).where(eq(warCards.cardDefId, 'combat_dominator')).limit(1)
      if (!existing) {
        toAward.push({ playerId: ctx.playerId, cardDefId: 'combat_dominator', minted: false })
        awarded.push('combat_dominator')
      }
    }

    // combat_iron_wall: survived 100+ hits in a single battle
    if (!earned.has('combat_iron_wall') && ctx.hitsTaken >= 100) {
      const [existing] = await db.select({ id: warCards.id }).from(warCards).where(eq(warCards.cardDefId, 'combat_iron_wall')).limit(1)
      if (!existing) {
        toAward.push({ playerId: ctx.playerId, cardDefId: 'combat_iron_wall', minted: false })
        awarded.push('combat_iron_wall')
      }
    }

    // combat_critical_mass: 10+ crits in a single battle
    if (!earned.has('combat_critical_mass') && ctx.critsLanded >= 10) {
      const [existing] = await db.select({ id: warCards.id }).from(warCards).where(eq(warCards.cardDefId, 'combat_critical_mass')).limit(1)
      if (!existing) {
        toAward.push({ playerId: ctx.playerId, cardDefId: 'combat_critical_mass', minted: false })
        awarded.push('combat_critical_mass')
      }
    }

    // combat_comeback: isComeback flag set by battle resolution
    if (!earned.has('combat_comeback') && ctx.isComeback) {
      toAward.push({ playerId: ctx.playerId, cardDefId: 'combat_comeback', minted: false })
      awarded.push('combat_comeback')
    }

    // combat_biggest_battle: isLargestBattle flag
    if (!earned.has('combat_biggest_battle') && ctx.isLargestBattle) {
      toAward.push({ playerId: ctx.playerId, cardDefId: 'combat_biggest_battle', minted: false })
      awarded.push('combat_biggest_battle')
    }

    if (toAward.length > 0) {
      await db.insert(warCards).values(toAward)
      console.log(`[WAR CARDS] Battle cards awarded for ${ctx.playerId}: ${awarded.join(', ')}`)
    }

  } catch (err) {
    console.error('[WAR CARDS] Battle card evaluation error:', err)
  }

  return awarded
}
