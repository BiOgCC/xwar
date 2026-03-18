import { create } from 'zustand'
import { usePlayerStore } from './playerStore'

export type EquipTier = 't1' | 't2' | 't3' | 't4' | 't5' | 't6'
export type ArmorSlot = 'helmet' | 'chest' | 'legs' | 'gloves' | 'boots'
export type WeaponSlot = 'weapon'
export type VehicleSlot = 'vehicle'
export type EquipSlot = ArmorSlot | WeaponSlot | VehicleSlot
export type EquipCategory = 'armor' | 'weapon' | 'vehicle'
export type WeaponSubtype = 'knife' | 'gun' | 'rifle' | 'sniper' | 'tank' | 'rpg' | 'jet' | 'warship'

// Which weapon subtypes are available at each tier
export const WEAPON_SUBTYPES: Record<EquipTier, WeaponSubtype[]> = {
  t1: ['knife'],
  t2: ['gun'],
  t3: ['rifle'],
  t4: ['sniper'],
  t5: ['tank', 'rpg'],
  t6: ['jet', 'warship'],
}

export interface EquipStats {
  damage?: number
  critRate?: number
  critDamage?: number
  armor?: number
  dodge?: number
  precision?: number
}

export interface EquipItem {
  id: string
  name: string
  slot: EquipSlot
  category: EquipCategory
  tier: EquipTier
  equipped: boolean
  durability: number
  stats: EquipStats
  weaponSubtype?: WeaponSubtype
}

export const TIER_ORDER: EquipTier[] = ['t1', 't2', 't3', 't4', 't5', 't6']

export const TIER_COLORS: Record<EquipTier, string> = {
  t1: '#9ca3af',
  t2: '#22d38a',
  t3: '#3b82f6',
  t4: '#a855f7',
  t5: '#f59e0b',
  t6: '#ef4444',
}

export const TIER_LABELS: Record<EquipTier, string> = {
  t1: 'Common (T1)',
  t2: 'Uncommon (T2)',
  t3: 'Rare (T3)',
  t4: 'Epic (T4)',
  t5: 'Legendary (T5)',
  t6: 'Mythic (T6)',
}

export const ARMOR_SLOTS: ArmorSlot[] = ['helmet', 'chest', 'legs', 'gloves', 'boots']
export const WEAPON_SLOTS: WeaponSlot[] = ['weapon']
export const VEHICLE_SLOTS: VehicleSlot[] = ['vehicle']

export const SLOT_ICONS: Record<EquipSlot, string> = {
  helmet: '⛑️',
  chest: '🦺',
  legs: '🩳',
  gloves: '🧤',
  boots: '🥾',
  weapon: '⚔️',
  vehicle: '🚢',
}

// Map generated image assets
export function getItemImagePath(tier: EquipTier, slot: EquipSlot, category: EquipCategory, weaponSubtype?: WeaponSubtype): string | null {
  // Weapon subtypes with their own icons
  if (category === 'weapon' && weaponSubtype === 'rpg') return '/assets/items/t5_weapon.png'
  if (category === 'weapon' && weaponSubtype === 'warship') return '/assets/items/t6_weapon_warship.png'

  if (tier === 't6') {
    if (category === 'vehicle') return '/assets/items/t6_weapon_warship.png'
    if (category === 'weapon') return '/assets/items/t6_weapon_jet.png'
  }
  
  return `/assets/items/${tier}_${slot}.png`
}

// Scrap returns per tier
export const SCRAP_VALUES: Record<EquipTier, number> = {
  t1: 6,
  t2: 18,
  t3: 56,
  t4: 162,
  t5: 486,
  t6: 1480,
}

export interface InventoryState {
  items: EquipItem[]

  openLootBox: () => { item: EquipItem; scrap: number; money: number } | null
  dismantleItem: (itemId: string) => number // returns scrap gained
  equipItem: (itemId: string) => void
  unequipItem: (itemId: string) => void
  removeItem: (itemId: string) => void
  addItem: (item: EquipItem) => void
  degradeEquippedItems: (amount: number) => void
  degradeItem: (itemId: string, amount: number) => void
  getEquipped: () => EquipItem[]
}

let itemCounter = 0

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateStats(category: EquipCategory, slot: EquipSlot, tier: EquipTier, weaponSubtype?: WeaponSubtype): { name: string, stats: EquipStats, weaponSubtype?: WeaponSubtype } {
  const tLevel = parseInt(tier[1], 10) // 1 to 6
  
  if (category === 'weapon') {
    // T1: Knife (20-49 dmg, 5% crit)
    // T2: Gun (50-80 dmg, 6-10% crit)
    // T3: Rifle (81-120 dmg, 11-15% crit)
    // T4: Sniper (121-150 dmg, 16-20% crit)
    // T5: Tank (151-199 dmg, 21-30% crit)  |  RPG (same stats)
    // T6: Jet (200-300 dmg, 31-49% crit)   |  Warship (same stats)
    
    // Handle subtypes for T5 and T6
    if (tier === 't5' && weaponSubtype === 'rpg') {
      return { name: 'RPG', stats: { damage: randomInt(151, 199), critRate: randomInt(21, 30) }, weaponSubtype: 'rpg' }
    }
    if (tier === 't6' && weaponSubtype === 'warship') {
      return { name: 'Warship', stats: { damage: randomInt(200, 300), critRate: randomInt(31, 49) }, weaponSubtype: 'warship' }
    }
    
    switch (tier) {
      case 't1': return { name: 'Knife', stats: { damage: randomInt(20, 49), critRate: 5 }, weaponSubtype: 'knife' }
      case 't2': return { name: 'Gun', stats: { damage: randomInt(50, 80), critRate: randomInt(6, 10) }, weaponSubtype: 'gun' }
      case 't3': return { name: 'Rifle', stats: { damage: randomInt(81, 120), critRate: randomInt(11, 15) }, weaponSubtype: 'rifle' }
      case 't4': return { name: 'Sniper', stats: { damage: randomInt(121, 150), critRate: randomInt(16, 20) }, weaponSubtype: 'sniper' }
      case 't5': return { name: 'Tank', stats: { damage: randomInt(151, 199), critRate: randomInt(21, 30) }, weaponSubtype: 'tank' }
      case 't6': return { name: 'Jet', stats: { damage: randomInt(200, 300), critRate: randomInt(31, 49) }, weaponSubtype: 'jet' }
    }
  } else if (category === 'vehicle') {
    if (tier === 't6') {
      return { name: 'T6 Warship', stats: { damage: randomInt(301, 400), critRate: randomInt(40, 49) } }
    } else {
      return { name: `T${tLevel} Vehicle`, stats: { damage: randomInt(10 * tLevel, 20 * tLevel) } } // Fallback
    }
  } else {
    // Armor
    // Helmet: 20% crit damage per tier
    // Chest/Legs: 5% armor per tier
    // Boots: 5% dodge per tier
    // Gloves: 5% precision per tier
    const namePrefix = TIER_LABELS[tier].split(' ')[0]
    switch (slot) {
      case 'helmet': {
        const base = 20 * tLevel
        return { name: `${namePrefix} Helmet`, stats: { critDamage: randomInt(Math.max(1, base - 8), base) } }
      }
      case 'chest': {
        const base = 5 * tLevel
        return { name: `${namePrefix} Chestplate`, stats: { armor: randomInt(Math.max(1, base - 3), base) } }
      }
      case 'legs': {
        const base = 5 * tLevel
        return { name: `${namePrefix} Legging`, stats: { armor: randomInt(Math.max(1, base - 3), base) } }
      }
      case 'boots': {
        const base = 5 * tLevel
        return { name: `${namePrefix} Boots`, stats: { dodge: randomInt(Math.max(1, base - 3), base) } }
      }
      case 'gloves': {
        const base = 5 * tLevel
        return { name: `${namePrefix} Gloves`, stats: { precision: randomInt(Math.max(1, base - 4), base) } }
      }
    }
  }
  return { name: 'Unknown Item', stats: {} }
}

function rollLootBoxItem(): EquipItem {
  // Tier chance (T1: 50%, T2: 39%, T3: 7%, T4: 3%, T5: 0.85%, T6: 0.15%)
  const rT = Math.random() * 100
  let tier: EquipTier = 't1'
  if (rT < 0.15) tier = 't6'
  else if (rT < 1.00) tier = 't5'
  else if (rT < 4.00) tier = 't4'
  else if (rT < 11.00) tier = 't3'
  else if (rT < 50.00) tier = 't2'

  // Type chance (66% Armor, 34% Weapon, but if T6, 20% chance of Vehicle)
  let category: EquipCategory = Math.random() < 0.66 ? 'armor' : 'weapon'
  let slot: EquipSlot = 'weapon'
  
  if (tier === 't6' && Math.random() < 0.20) {
    category = 'vehicle'
    slot = 'vehicle'
  } else if (category === 'armor') {
    slot = ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)]
  }

  // For T5/T6 weapons, randomly pick a subtype
  let subtype: WeaponSubtype | undefined
  if (category === 'weapon') {
    const subtypes = WEAPON_SUBTYPES[tier]
    subtype = subtypes[Math.floor(Math.random() * subtypes.length)]
  }

  const result = generateStats(category, slot, tier, subtype)

  return {
    id: `item-${++itemCounter}-${Date.now()}`,
    name: result.name,
    slot,
    category,
    tier,
    equipped: false,
    durability: 100,
    stats: result.stats,
    weaponSubtype: result.weaponSubtype,
  }
}

function getStarterKit(): EquipItem[] {
  const kit: EquipItem[] = []
  const slots: EquipSlot[] = ['helmet', 'chest', 'legs', 'gloves', 'boots', 'weapon']
  
  for (let i = 0; i < 3; i++) {
    slots.forEach(slot => {
      const category: EquipCategory = slot === 'weapon' ? 'weapon' : 'armor'
      const { name, stats } = generateStats(category, slot, 't3')
      kit.push({
        id: `start-${slot}-${i}-${Math.random().toString(36).substring(2, 9)}`,
        name,
        slot,
        category,
        tier: 't3',
        equipped: i === 0, // Equip first set only
        durability: 100,
        stats
      })
    })
  }
  return kit
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: getStarterKit(),

  openLootBox: () => {
    const playerStore = usePlayerStore.getState()
    if (playerStore.lootBoxes <= 0) return null

    usePlayerStore.setState(s => ({ lootBoxes: s.lootBoxes - 1 }))

    const item = rollLootBoxItem()
    const scrap = randomInt(50, 500)
    const money = randomInt(100, 1000)

    usePlayerStore.setState(s => ({ 
      scrap: s.scrap + scrap,
      money: s.money + money 
    }))

    set(s => ({ items: [...s.items, item] }))
    return { item, scrap, money }
  },

  dismantleItem: (itemId) => {
    const state = get()
    const item = state.items.find((i) => i.id === itemId)
    if (!item || item.equipped) return 0
    const scrapGain = SCRAP_VALUES[item.tier]
    set((s) => ({
      items: s.items.filter((i) => i.id !== itemId),
    }))
    return scrapGain
  },

  equipItem: (itemId) =>
    set((s) => {
      const item = s.items.find((i) => i.id === itemId)
      if (!item) return s
      // Unequip any item in the same slot
      const updated = s.items.map((i) => {
        if (i.id === itemId) return { ...i, equipped: true }
        if (i.slot === item.slot && i.equipped) return { ...i, equipped: false }
        return i
      })
      return { items: updated }
    }),

  unequipItem: (itemId) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === itemId ? { ...i, equipped: false } : i
      ),
    })),

  removeItem: (itemId) =>
    set((s) => ({
      items: s.items.filter((i) => i.id !== itemId),
    })),

  addItem: (item) =>
    set((s) => ({
      items: [...s.items, item],
    })),

  degradeItem: (itemId: string, amount: number) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === itemId ? { ...i, durability: Math.max(0, (i.durability || 100) - amount) } : i
      )
    })),

  degradeEquippedItems: (amount: number) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.equipped ? { ...i, durability: Math.max(0, (i.durability || 100) - amount) } : i
      )
    })),

  getEquipped: () => get().items.filter((i) => i.equipped),
}))
