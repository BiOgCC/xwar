import { create } from 'zustand'

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
  itemType: 'weapon' | 'helmet' | 'chest' | 'legs' | 'gloves' | 'boots'
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

// ====== MILITARY PRESTIGE ITEM GENERATION ======

const MILITARY_ITEM_NAMES = [
  'Titan Assault Gauntlets', 'Warlord\'s Fury Blade', 'Siege Breaker Helm',
  'Ironclad Vanguard Plate', 'Shadow Strike Rifle', 'Dominator Greaves',
  'Thunder Fist Knuckles', 'Eclipse War Boots', 'Berserker\'s Edge',
  'Crimson Commander Armor',
]

const MILITARY_ITEM_TYPES: ('weapon' | 'helmet' | 'chest' | 'legs' | 'gloves' | 'boots')[] =
  ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots']

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
  'Helm of the Industrial Mind', 'Prospector\'s Golden Crown', 'Architect\'s Insight Visor',
  'Forge Master Gauntlets', 'Midas Touch Gloves', 'Industrial Overlord Helm',
  'Resource Diviner\'s Cap', 'Tycoon\'s Command Gloves', 'Engineer\'s Precision Grip',
  'Grand Administrator\'s Coronet',
]

const ECONOMIC_ITEM_TYPES: ('helmet' | 'gloves')[] = ['helmet', 'gloves']

function generateEconomicStats(): Record<string, number> {
  return {
    prospection: 10 + Math.floor(Math.random() * 10), // 10-19
    industrialist: 8 + Math.floor(Math.random() * 8), // 8-15
    production_efficiency: 3 + Math.floor(Math.random() * 6), // 3-8%
    resource_discovery_chance: 2 + Math.floor(Math.random() * 4), // 2-5%
  }
}

// ====== MOCK PLAYER SCORES (for demo) ======

function generateMockRankings(weekNumber: number): { military: PrestigeRanking[]; economic: PrestigeRanking[] } {
  const militaryPlayers = [
    { id: 'IronMarshal', score: 125000 + Math.floor(Math.random() * 50000) },
    { id: 'TitanSlayer', score: 110000 + Math.floor(Math.random() * 40000) },
    { id: 'RedBaron', score: 95000 + Math.floor(Math.random() * 35000) },
    { id: 'StormFury', score: 80000 + Math.floor(Math.random() * 30000) },
    { id: 'WarDrake', score: 70000 + Math.floor(Math.random() * 25000) },
    { id: 'Commander_X', score: 60000 + Math.floor(Math.random() * 20000) },
    { id: 'BladeRunner', score: 50000 + Math.floor(Math.random() * 15000) },
    { id: 'NightFury', score: 40000 + Math.floor(Math.random() * 10000) },
  ].sort((a, b) => b.score - a.score)

  const economicPlayers = [
    { id: 'IronTycoon', score: 200000 + Math.floor(Math.random() * 80000) },
    { id: 'MegaMiner', score: 180000 + Math.floor(Math.random() * 60000) },
    { id: 'ResourceKing', score: 150000 + Math.floor(Math.random() * 50000) },
    { id: 'DeepCore', score: 120000 + Math.floor(Math.random() * 40000) },
    { id: 'GoldProspector', score: 100000 + Math.floor(Math.random() * 30000) },
    { id: 'Commander_X', score: 90000 + Math.floor(Math.random() * 25000) },
    { id: 'CraftKing', score: 70000 + Math.floor(Math.random() * 20000) },
    { id: 'TradeGuild', score: 50000 + Math.floor(Math.random() * 15000) },
  ].sort((a, b) => b.score - a.score)

  const military: PrestigeRanking[] = militaryPlayers.slice(0, 5).map((p, i) => ({
    rankingId: `mr_${weekNumber}_${i}`,
    weekNumber,
    playerId: p.id,
    playerName: p.id,
    category: 'military' as PrestigeCategory,
    rankPosition: i + 1,
    title: MILITARY_TITLES[i],
    score: p.score,
  }))

  const economic: PrestigeRanking[] = economicPlayers.slice(0, 5).map((p, i) => ({
    rankingId: `er_${weekNumber}_${i}`,
    weekNumber,
    playerId: p.id,
    playerName: p.id,
    category: 'economic' as PrestigeCategory,
    rankPosition: i + 1,
    title: ECONOMIC_TITLES[i],
    score: p.score,
  }))

  return { military, economic }
}

// ====== STORE ======

export interface PrestigeState {
  currentWeek: number
  weekStartedAt: number
  rankings: PrestigeRanking[]
  prestigePlayers: PrestigePlayer[]
  blueprints: PrestigeBlueprint[]
  items: PrestigeItem[]
  archive: PrestigeArchiveEntry[]

  // Actions
  calculateWeeklyRankings: () => void
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
  // Generate initial mock data
  const initRankings = generateMockRankings(currentWeek)
  const allRankings = [...initRankings.military, ...initRankings.economic]

  // Generate archive for previous weeks
  const archiveEntries: PrestigeArchiveEntry[] = []
  for (let w = Math.max(1, currentWeek - 3); w < currentWeek; w++) {
    const pastRankings = generateMockRankings(w)
    ;[...pastRankings.military, ...pastRankings.economic].forEach(r => {
      archiveEntries.push({
        archiveId: `arch_${w}_${r.rankingId}`,
        weekNumber: w,
        playerId: r.playerId,
        playerName: r.playerName,
        category: r.category,
        rankPosition: r.rankPosition,
        title: r.title,
        score: r.score,
        itemCreated: null,
      })
    })
  }

  // Create prestige players from current rankings
  const initPrestigePlayers: PrestigePlayer[] = allRankings.map(r => ({
    prestigeId: `pp_${r.rankingId}`,
    playerId: r.playerId,
    playerName: r.playerName,
    weekNumber: r.weekNumber,
    category: r.category,
    title: r.title,
    blueprintCreated: false,
    cooldownUntilWeek: r.weekNumber + 2,
  }))

  return {
    currentWeek,
    weekStartedAt: SERVER_EPOCH + (currentWeek - 1) * WEEK_DURATION,
    rankings: allRankings,
    prestigePlayers: initPrestigePlayers,
    blueprints: [],
    items: [],
    archive: archiveEntries,

    calculateWeeklyRankings: () => set((state) => {
      const newWeek = state.currentWeek + 1
      const newRankings = generateMockRankings(newWeek)
      const allNew = [...newRankings.military, ...newRankings.economic]

      // Filter out players on cooldown
      const validPrestige = allNew.filter(r => {
        const existing = state.prestigePlayers.find(pp => pp.playerId === r.playerId)
        return !existing || existing.cooldownUntilWeek <= newWeek
      })

      // Archive current week
      const newArchive: PrestigeArchiveEntry[] = state.rankings.map(r => {
        const pp = state.prestigePlayers.find(pp => pp.playerId === r.playerId && pp.weekNumber === state.currentWeek)
        return {
          archiveId: `arch_${state.currentWeek}_${r.rankingId}`,
          weekNumber: state.currentWeek,
          playerId: r.playerId,
          playerName: r.playerName,
          category: r.category,
          rankPosition: r.rankPosition,
          title: r.title,
          score: r.score,
          itemCreated: pp?.blueprintCreated ? 'Yes' : null,
        }
      })

      const newPrestigePlayers: PrestigePlayer[] = validPrestige.slice(0, 10).map(r => ({
        prestigeId: `pp_${r.rankingId}`,
        playerId: r.playerId,
        playerName: r.playerName,
        weekNumber: newWeek,
        category: r.category,
        title: r.title,
        blueprintCreated: false,
        cooldownUntilWeek: newWeek + 2,
      }))

      return {
        currentWeek: newWeek,
        weekStartedAt: Date.now(),
        rankings: allNew,
        prestigePlayers: newPrestigePlayers,
        archive: [...state.archive, ...newArchive],
      }
    }),

    createBlueprint: (playerId, playerName) => {
      const state = get()
      const pp = state.prestigePlayers.find(p => p.playerId === playerId && p.weekNumber === state.currentWeek)
      if (!pp) return { success: false, message: 'You do not have Prestige status this week.' }
      if (pp.blueprintCreated) return { success: false, message: 'You already created a blueprint this week.' }

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
  }
})
