// ══════════════════════════════════════════════
// XWAR — War Cards / Achievement Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export type CardCategory = 'milestone' | 'timed' | 'combat' | 'economic' | 'shame'
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface CardConditionContext {
  totalDamageDone: number
  totalMoney: number
  totalItemsProduced: number
  playerLevel: number
  totalCasesOpened: number
  totalItemsCrafted: number
  totalItemsDismantled: number
  singleHitDamage?: number
  battleDamageDealt?: number
  battleTotalDamage?: number
  battleTicksElapsed?: number
  battleCritsLanded?: number
  battleHitsTaken?: number
  battleIsLargest?: boolean
  battleIsComeback?: boolean
  weeklyDamage: number
  weeklyMoney: number
  consecutiveWeeksTopDamage: number
  consecutiveWeeksTopEconomy: number
  casinoSessionWinnings?: number
  marketTransactions?: number
  bondExchangeProfit?: number
  muteCount?: number
  deathCount?: number
  battlesLost?: number
  totalCasinoLosses?: number
  bankruptcyCount?: number
  countrySwitches?: number
  casinoSpins?: number
  itemsDestroyed?: number
}

export interface WarCardDefinition {
  id: string
  name: string
  description: string
  flavorText: string
  category: CardCategory
  rarity: CardRarity
  firstOnly: boolean
  weekly: boolean
  condition: (ctx: CardConditionContext) => boolean
}

export type NFTMintState = 'unminted' | 'pending' | 'minted' | 'failed'

export interface NFTStatus {
  mintState: NFTMintState
  tokenId?: string
  txHash?: string
  network?: string
  metadataCID?: string
  mintedAt?: number
}

export interface EarnedWarCard {
  id: string
  cardDefId: string
  playerId: string
  playerName: string
  earnedAt: number
  weekNumber?: number
  recordValue?: number
  battleId?: string
  nft: NFTStatus
}

export interface WeeklyTracking {
  weekNumber: number
  damageByPlayer: Record<string, number>
  moneyByPlayer: Record<string, number>
}
