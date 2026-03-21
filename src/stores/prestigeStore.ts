import { create } from 'zustand'
import { usePlayerStore } from './playerStore'

// ====== TITLES ======

export const MILITARY_TITLES = [
  'Supreme Commander',
  'Field Marshal',
  'General of the Army',
  'Army General',
  'Lieutenant General',
] as const

export const ECONOMIC_TITLES = [
  'Chief Industrial Strategist',
  'Grand Economic Architect',
  'High Commissioner of Industry',
  'Senior Resource Director',
  'Principal Economic Advisor',
] as const

// ====== TYPES ======

export type PrestigeCategory = 'military' | 'economic'

export interface PrestigeRanking {
  rankingId: string
  weekNumber: number
  playerId: string
  playerName: string
  category: PrestigeCategory
  rankPosition: number // 1-5
  title: string
  score: number
}

export interface PrestigePlayer {
  prestigeId: string
  playerId: string
  playerName: string
  weekNumber: number
  category: PrestigeCategory
  title: string
  blueprintCreated: boolean
  cooldownUntilWeek: number // can't get prestige again until this week
}

export interface PrestigeBlueprint {
  blueprintId: string
  creatorPlayerId: string
  creatorPlayerName: string
  weekNumber: number
  itemName: string
  itemType: 'weapon' | 'helmet' | 'chest' | 'legs' | 'gloves' | 'boots' | 'ring' | 'crown'
  category: PrestigeCategory
  bonusStats: Record<string, number>
  tradable: boolean
  singleUse: boolean
  listedOnMarket: boolean
  marketPrice: number
  createdAt: number
}

export interface PrestigeItem {
  itemId: string
  blueprintId: string
  craftedBy: string
  craftedByName: string
  inventedBy: string
  inventedByName: string
  itemName: string
  itemType: string
  category: PrestigeCategory
  bonusStats: Record<string, number>
  durability: 'infinite'
  equipped: boolean
  serverWeek: number
  createdAt: number
}

export interface PrestigeArchiveEntry {
  archiveId: string
  weekNumber: number
  playerId: string
  playerName: string
  category: PrestigeCategory
  rankPosition: number
  title: string
  score: number
  itemCreated: string | null
}

// ====== PRESTIGE COSTS ======

export const PRESTIGE_COSTS = {
  createBlueprint: 5,   // Bitcoin to create a blueprint
  craftItem: 10,        // Bitcoin to craft an item from blueprint
}

// ====== MILITARY PRESTIGE ITEM GENERATION ======

const MILITARY_ITEM_NAMES = [
  'Crown of the Titan', 'Crown of the Warlord', 'Crown of the Siege',
  'Crown of the Vanguard', 'Crown of Shadows', 'Crown of Thunder',
  'Crown of the Eclipse', 'Crown of the Berserker', 'Crown of Crimson',
  'Crown of Dominion',
]

const MILITARY_ITEM_TYPES: ('crown')[] = ['crown']

function generateMilitaryStats(): Record<string, number> {
  const stats: Record<string, number> = {}
  stats['damage'] = 4 + Math.floor(Math.random() * 5) // 4-8%
  stats['crit_damage'] = 8 + Math.floor(Math.random() * 8) // 8-15%
  // Random situational bonus
  const situational = ['attack_damage', 'defense_damage', 'damage_vs_sworn_enemy', 'damage_with_allies', 'bunker_damage']
  const picked = situational[Math.floor(Math.random() * situational.length)]
  stats[picked] = 6 + Math.floor(Math.random() * 8) // 6-13%
  return stats
}

// ====== ECONOMIC PRESTIGE ITEM GENERATION ======

const ECONOMIC_ITEM_NAMES = [
  'Ring of the Industrial Mind', 'Ring of the Golden Prospect', 'Ring of Arcane Insight',
  'Ring of the Forge Master', 'Ring of the Midas Touch', 'Ring of the Overlord',
  'Ring of the Diviner', 'Ring of the Tycoon', 'Ring of Precision',
  'Ring of Administration',
]

const ECONOMIC_ITEM_TYPES: ('ring')[] = ['ring']

// ====== PRESTIGE ITEM IMAGE HELPER ======

export function getPrestigeItemImage(category: PrestigeCategory): string {
  return category === 'military'
    ? '/assets/items/prestige_crown.png'
    : '/assets/items/prestige_ring.png'
}

function generateEconomicStats(): Record<string, number> {
  return {
    prospection: 10 + Math.floor(Math.random() * 10), // 10-19
    industrialist: 8 + Math.floor(Math.random() * 8), // 8-15
    production_efficiency: 3 + Math.floor(Math.random() * 6), // 3-8%
    resource_discovery_chance: 2 + Math.floor(Math.random() * 4), // 2-5%
  }
}

// Rankings will be computed from real player data by the backend.
// No mock data is seeded — the store starts empty.

// ====== STORE ======

export interface PrestigeState {
  currentWeek: number
  weekStartedAt: number
  rankings: PrestigeRanking[]
  prestigePlayers: PrestigePlayer[]
  blueprints: PrestigeBlueprint[]
  items: PrestigeItem[]
  archive: PrestigeArchiveEntry[]
  lastHourlySnapshotAt: number

  // Actions
  calculateWeeklyRankings: () => void
  processHourlySnapshot: () => void
  createBlueprint: (playerId: string, playerName: string) => { success: boolean; message: string; blueprint?: PrestigeBlueprint }
  craftItem: (blueprintId: string, crafterId: string, crafterName: string) => { success: boolean; message: string; item?: PrestigeItem }
  listBlueprintOnMarket: (blueprintId: string, price: number) => boolean
  buyBlueprint: (blueprintId: string, buyerId: string) => { success: boolean; message: string }
  equipPrestigeItem: (itemId: string) => void
  unequipPrestigeItem: (itemId: string) => void
  getPlayerPrestige: (playerId: string) => PrestigePlayer | null
  getPlayerTitle: (playerId: string) => string | null
}

let bpCounter = 0
let itemCounter = 0

// Calculate initial week number
const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000
const SERVER_EPOCH = new Date('2026-01-01').getTime()
const currentWeek = Math.floor((Date.now() - SERVER_EPOCH) / WEEK_DURATION) + 1

export const usePrestigeStore = create<PrestigeState>((set, get) => {
  return {
    currentWeek,
    weekStartedAt: SERVER_EPOCH + (currentWeek - 1) * WEEK_DURATION,
    rankings: [],
    prestigePlayers: [],
    blueprints: [],
    items: [],
    archive: [],
    lastHourlySnapshotAt: 0,

    // TODO: Backend will compute rankings from real player stats and push them here.
    // For now, this just advances the week counter.
    calculateWeeklyRankings: () => set((state) => ({
      currentWeek: state.currentWeek + 1,
      weekStartedAt: Date.now(),
    })),

    createBlueprint: (playerId, playerName) => {
      const state = get()
      const pp = state.prestigePlayers.find(p => p.playerId === playerId && p.weekNumber === state.currentWeek)
      if (!pp) return { success: false, message: 'You do not have Prestige status this week.' }
      if (pp.blueprintCreated) return { success: false, message: 'You already created a blueprint this week.' }

      // Bitcoin cost
      const player = usePlayerStore.getState()
      if (player.bitcoin < PRESTIGE_COSTS.createBlueprint) {
        return { success: false, message: `Need ${PRESTIGE_COSTS.createBlueprint} Bitcoin to create a blueprint.` }
      }
      player.spendBitcoin(PRESTIGE_COSTS.createBlueprint)

      const isMilitary = pp.category === 'military'
      const itemNames = isMilitary ? MILITARY_ITEM_NAMES : ECONOMIC_ITEM_NAMES
      const itemTypes = isMilitary ? MILITARY_ITEM_TYPES : ECONOMIC_ITEM_TYPES
      const stats = isMilitary ? generateMilitaryStats() : generateEconomicStats()

      const blueprint: PrestigeBlueprint = {
        blueprintId: `pbp_${++bpCounter}_${Date.now()}`,
        creatorPlayerId: playerId,
        creatorPlayerName: playerName,
        weekNumber: state.currentWeek,
        itemName: itemNames[Math.floor(Math.random() * itemNames.length)],
        itemType: itemTypes[Math.floor(Math.random() * itemTypes.length)],
        category: pp.category,
        bonusStats: stats,
        tradable: true,
        singleUse: true,
        listedOnMarket: false,
        marketPrice: 0,
        createdAt: Date.now(),
      }

      set({
        blueprints: [...state.blueprints, blueprint],
        prestigePlayers: state.prestigePlayers.map(p =>
          p.playerId === playerId && p.weekNumber === state.currentWeek
            ? { ...p, blueprintCreated: true } : p
        ),
      })

      return { success: true, message: `Blueprint "${blueprint.itemName}" created!`, blueprint }
    },

    craftItem: (blueprintId, crafterId, crafterName) => {
      const state = get()
      const bp = state.blueprints.find(b => b.blueprintId === blueprintId)
      if (!bp) return { success: false, message: 'Blueprint not found.' }

      // Bitcoin cost
      const player = usePlayerStore.getState()
      if (player.bitcoin < PRESTIGE_COSTS.craftItem) {
        return { success: false, message: `Need ${PRESTIGE_COSTS.craftItem} Bitcoin to craft a prestige item.` }
      }
      player.spendBitcoin(PRESTIGE_COSTS.craftItem)

      // Check player doesn't already have a prestige item equipped
      const existingEquipped = state.items.find(i => i.craftedBy === crafterId && i.equipped)
      // They can craft but only equip one at a time — no restriction on crafting itself

      const item: PrestigeItem = {
        itemId: `pitem_${++itemCounter}_${Date.now()}`,
        blueprintId: bp.blueprintId,
        craftedBy: crafterId,
        craftedByName: crafterName,
        inventedBy: bp.creatorPlayerId,
        inventedByName: bp.creatorPlayerName,
        itemName: bp.itemName,
        itemType: bp.itemType,
        category: bp.category,
        bonusStats: { ...bp.bonusStats },
        durability: 'infinite',
        equipped: false,
        serverWeek: bp.weekNumber,
        createdAt: Date.now(),
      }

      // Destroy blueprint (single use)
      set({
        blueprints: state.blueprints.filter(b => b.blueprintId !== blueprintId),
        items: [...state.items, item],
      })

      return { success: true, message: `Crafted "${item.itemName}" — eternal durability!`, item }
    },

    listBlueprintOnMarket: (blueprintId, price) => {
      const state = get()
      const bp = state.blueprints.find(b => b.blueprintId === blueprintId)
      if (!bp || !bp.tradable) return false

      set({
        blueprints: state.blueprints.map(b =>
          b.blueprintId === blueprintId ? { ...b, listedOnMarket: true, marketPrice: price } : b
        ),
      })
      return true
    },

    buyBlueprint: (blueprintId, buyerId) => {
      const state = get()
      const bp = state.blueprints.find(b => b.blueprintId === blueprintId && b.listedOnMarket)
      if (!bp) return { success: false, message: 'Blueprint not available.' }
      if (bp.creatorPlayerId === buyerId) return { success: false, message: 'Cannot buy your own blueprint.' }

      // Transfer ownership
      set({
        blueprints: state.blueprints.map(b =>
          b.blueprintId === blueprintId
            ? { ...b, listedOnMarket: false, creatorPlayerId: buyerId } : b
        ),
      })

      return { success: true, message: `Purchased "${bp.itemName}" blueprint!` }
    },

    equipPrestigeItem: (itemId) => set((state) => ({
      // Unequip all others first (only 1 at a time)
      items: state.items.map(i => ({
        ...i,
        equipped: i.itemId === itemId ? true : (i.craftedBy === state.items.find(x => x.itemId === itemId)?.craftedBy ? false : i.equipped),
      })),
    })),

    unequipPrestigeItem: (itemId) => set((state) => ({
      items: state.items.map(i => i.itemId === itemId ? { ...i, equipped: false } : i),
    })),

    getPlayerPrestige: (playerId) => {
      const state = get()
      return state.prestigePlayers.find(p => p.playerId === playerId && p.weekNumber === state.currentWeek) || null
    },

    getPlayerTitle: (playerId) => {
      const state = get()
      const pp = state.prestigePlayers.find(p => p.playerId === playerId && p.weekNumber === state.currentWeek)
      return pp?.title || null
    },

    processHourlySnapshot: () => {
      const ONE_HOUR_MS = 60 * 60 * 1000
      const now = Date.now()
      const state = get()
      if (now - state.lastHourlySnapshotAt < ONE_HOUR_MS) return

      // Check if the week has rolled over
      const newWeek = Math.floor((now - SERVER_EPOCH) / WEEK_DURATION) + 1
      if (newWeek > state.currentWeek) {
        // Trigger weekly rollover (calculateWeeklyRankings will advance the week)
        get().calculateWeeklyRankings()
      }

      // Mark snapshot taken (rankings recalculation is deferred to backend)
      set({ lastHourlySnapshotAt: now })
    },
  }
})
