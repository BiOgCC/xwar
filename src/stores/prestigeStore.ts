import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import {
  getPrestigeRankings,
  getPrestigeArchive,
  getPrestigeItems,
  createPrestigeBlueprint as apiCreateBlueprint,
  craftPrestigeItem as apiCraftItem,
  listPrestigeBlueprintOnMarket as apiListBlueprint,
  buyPrestigeBlueprint as apiBuyBlueprint,
} from '../api/client'

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
  createBlueprint: 5,   // Badges of Honor to create a blueprint
  craftItem: 10,        // Badges of Honor to craft an item from blueprint
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
  // API-backed fetchers (with fallback)
  fetchRankings: (week?: number) => Promise<void>
  fetchItems: (playerId?: string) => Promise<void>
  fetchArchive: (week: number) => Promise<void>
}

let bpCounter = 0
let itemCounter = 0

// Calculate initial week number
const WEEK_DURATION = 7 * 24 * 60 * 60 * 1000
const SERVER_EPOCH = new Date('2026-01-01').getTime()
const currentWeek = Math.floor((Date.now() - SERVER_EPOCH) / WEEK_DURATION) + 1

import { api } from '../api/client'

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
      // Fire API call, update state from response
      api.post('/prestige/blueprint/create', {}).then((res: any) => {
        if (res.success && res.item) {
          // Refresh items from backend
          get().fetchItems()
          get().fetchRankings()
        }
      }).catch(() => {})

      // Optimistic: check locally if player has enough badges
      const player = usePlayerStore.getState()
      if (player.badgesOfHonor < PRESTIGE_COSTS.createBlueprint) {
        return { success: false, message: `Need ${PRESTIGE_COSTS.createBlueprint} Badges of Honor.` }
      }
      return { success: true, message: 'Creating prestige item...' }
    },

    craftItem: (blueprintId, crafterId, crafterName) => {
      // In alpha, crafting is merged into blueprint creation on the backend
      return { success: false, message: 'Use Create Blueprint to directly create prestige items.' }
    },

    listBlueprintOnMarket: (blueprintId, price) => {
      // Not available in alpha
      return false
    },

    buyBlueprint: (blueprintId, buyerId) => {
      // Not available in alpha
      return { success: false, message: 'Prestige market not available in alpha.' }
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

      // Attempt to fetch from backend API (fire-and-forget)
      get().fetchRankings().catch(() => {})
      get().fetchItems().catch(() => {})

      // Mark snapshot taken (rankings recalculation is deferred to backend)
      set({ lastHourlySnapshotAt: now })
    },

    // ── API-backed fetchers (graceful fallback) ──

    fetchRankings: async (week?: number) => {
      try {
        const res = await getPrestigeRankings(week)
        if (res.success) {
          set({
            rankings: res.rankings,
            prestigePlayers: res.prestigePlayers || get().prestigePlayers,
            currentWeek: res.currentWeek || get().currentWeek,
          })
        }
      } catch {
        // Backend not available — keep existing state
      }
    },

    fetchItems: async (playerId?: string) => {
      try {
        const res = await getPrestigeItems(playerId)
        if (res.success) {
          set({
            items: res.items || get().items,
            blueprints: res.blueprints || get().blueprints,
          })
        }
      } catch {
        // Backend not available — keep existing state
      }
    },

    fetchArchive: async (week: number) => {
      try {
        const res = await getPrestigeArchive(week)
        if (res.success && res.archive) {
          // Merge into existing archive (avoiding duplicates)
          const existing = new Set(get().archive.map(a => a.archiveId))
          const merged = [...get().archive, ...res.archive.filter((a: any) => !existing.has(a.archiveId))]
          set({ archive: merged })
        }
      } catch {
        // Backend not available — keep existing state
      }
    },
  }
})
