import { EventEmitter } from 'events'
import { db } from '../db/connection.js'
import { players, warCards } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'

export const warCardEmitter = new EventEmitter()

const CARD_DEFS = {
  // Level milestones
  'lvl_10': { type: 'level', threshold: 10 },
  'lvl_50': { type: 'level', threshold: 50 },
  
  // Damage milestones
  'dmg_1m': { type: 'damageDone', threshold: 1_000_000 },
  'dmg_10m': { type: 'damageDone', threshold: 10_000_000 },
  
  // Money milestones
  'money_100k': { type: 'money', threshold: 100_000 },
  'money_1m': { type: 'money', threshold: 1_000_000 },
  
  // Production milestones
  'prod_100': { type: 'itemsProduced', threshold: 100 },
  'prod_1000': { type: 'itemsProduced', threshold: 1000 },

  // Shame milestones
  'casino_loss_1m': { type: 'totalCasinoLosses', threshold: 1_000_000 },
  'death_10': { type: 'deathCount', threshold: 10 },
}

warCardEmitter.on('player_action', async (playerId: string) => {
  try {
    // 1. Fetch current player stats
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) return

    // 2. Fetch already earned cards
    const existingCards = await db.select().from(warCards).where(eq(warCards.playerId, playerId))
    const earnedDefIds = new Set(existingCards.map(c => c.cardDefId))

    const newCardsToMint = []

    // 3. Evaluate all cards
    for (const [defId, criteria] of Object.entries(CARD_DEFS)) {
      if (earnedDefIds.has(defId)) continue // Already has it

      const statValue = Number(player[criteria.type as keyof typeof player]) || 0
      
      if (statValue >= criteria.threshold) {
        newCardsToMint.push({
          playerId,
          cardDefId: defId,
          minted: false
        })
      }
    }

    // 4. Issue new cards
    if (newCardsToMint.length > 0) {
      await db.insert(warCards).values(newCardsToMint)
      console.log(`[WAR CARDS] Found and minted ${newCardsToMint.length} new cards for player ${playerId}`)
    }

  } catch (err) {
    console.error('[WAR CARDS] Evaluation error:', err)
  }
})
