import { create } from 'zustand'
import { api } from '../api/client'
import { usePlayerStore } from './playerStore'
import { useWarCardsStore } from './warCardsStore'
import { rateLimiter } from '../engine/AntiExploit'

import type { EquipTier, ArmorSlot, WeaponSlot, VehicleSlot, EquipSlot, EquipCategory, WeaponSubtype, EquipStats, ItemLocation, EquipItem, LootBoxRewardType, LootBoxResult } from '../types/inventory.types'

// Re-export all types for backward compatibility
export type { EquipTier, ArmorSlot, WeaponSlot, VehicleSlot, EquipSlot, EquipCategory, WeaponSubtype, EquipStats, ItemLocation, EquipItem, LootBoxRewardType, LootBoxResult }

export const TIER_ORDER: EquipTier[] = ['t1', 't2', 't3', 't4', 't5', 't6', 't7']

export const TIER_COLORS: Record<EquipTier, string> = {
  t1: '#9ca3af',
  t2: '#22d38a',
  t3: '#3b82f6',
  t4: '#a855f7',
  t5: '#f59e0b',
  t6: '#ef4444',
  t7: '#06b6d4',
}

export const TIER_LABELS: Record<EquipTier, string> = {
  t1: 'Common (T1)',
  t2: 'Uncommon (T2)',
  t3: 'Rare (T3)',
  t4: 'Epic (T4)',
  t5: 'Legendary (T5)',
  t6: 'Mythic (T6)',
  t7: 'Exotic (T7)',
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
export function getItemImagePath(tier: EquipTier, slot: EquipSlot, category: EquipCategory, weaponSubtype?: WeaponSubtype, superforged?: boolean): string | null {
  const prefix = superforged ? 'reinforced_' : ''

  // Weapon subtypes with their own icons
  if (category === 'weapon' && weaponSubtype === 'rpg') return `/assets/items/${prefix}t5_weapon_rpg.png`
  if (category === 'weapon' && weaponSubtype === 'warship') return `/assets/items/${prefix}t6_weapon_warship.png`
  if (weaponSubtype === 'submarine') return `/assets/items/${prefix ? '' : ''}t6_weapon_warship.png`

  if (tier === 't6') {
    if (category === 'vehicle') return `/assets/items/${prefix}t6_weapon_warship.png`
    if (category === 'weapon') return `/assets/items/${prefix}t6_weapon_jet.png`
  }
  
  if (tier === 't7') {
    return '/assets/items/t6_weapon_warship.png' // Fallback for T7 (no reinforced variant)
  }
  
  return `/assets/items/${prefix}${tier}_${slot}.png`
}

// Scrap returns per tier
export const SCRAP_VALUES: Record<EquipTier, number> = {
  t1: 6,
  t2: 18,
  t3: 56,
  t4: 162,
  t5: 486,
  t6: 1480,
  t7: 4500,
}

// Which weapon subtypes are available at each tier
export const WEAPON_SUBTYPES: Record<EquipTier, WeaponSubtype[]> = {
  t1: ['knife'],
  t2: ['gun'],
  t3: ['rifle'],
  t4: ['sniper'],
  t5: ['tank', 'rpg'],
  t6: ['jet', 'warship'],
  t7: ['submarine'],
}

export interface InventoryState {
  items: EquipItem[]
  /** Lifetime tracking for War Cards */
  totalCasesOpened: number
  totalItemsDismantled: number

  fetchInventory: () => Promise<void>
  openLootBox: () => Promise<LootBoxResult | null>
  openMilitaryBox: () => Promise<LootBoxResult | null>
  dismantleItem: (itemId: string) => Promise<{ success: boolean; scrapGained: number; message: string }>
  sellItem: (itemId: string) => Promise<{ success: boolean; moneyGained: number; message: string }>
  equipItem: (itemId: string) => Promise<{ success: boolean; message: string }>
  unequipItem: (itemId: string) => Promise<{ success: boolean; message: string }>
  removeItem: (itemId: string) => void
  addItem: (item: EquipItem) => void
  degradeEquippedItems: (amount: number) => void
  degradeItem: (itemId: string, amount: number) => void
  getEquipped: () => EquipItem[]
  getPlayerItems: () => EquipItem[]       // Items with location='inventory' (usable by player)
  getItemById: (itemId: string) => EquipItem | undefined  // Any item by ID regardless of location
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
    
    // Handle subtypes for T5 and T6 and T7
    if (tier === 't5' && weaponSubtype === 'rpg') {
      return { name: 'RPG', stats: { damage: randomInt(151, 199), critRate: randomInt(21, 30) }, weaponSubtype: 'rpg' }
    }
    if (tier === 't6' && weaponSubtype === 'warship') {
      return { name: 'Warship', stats: { damage: randomInt(200, 300), critRate: randomInt(31, 49) }, weaponSubtype: 'warship' }
    }
    if (tier === 't7' && weaponSubtype === 'submarine') {
      return { name: 'Submarine', stats: { damage: randomInt(350, 500), critRate: randomInt(40, 60) }, weaponSubtype: 'submarine' }
    }
    
    switch (tier) {
      case 't1': return { name: 'Knife', stats: { damage: randomInt(20, 49), critRate: 5 }, weaponSubtype: 'knife' }
      case 't2': return { name: 'Gun', stats: { damage: randomInt(50, 80), critRate: randomInt(6, 10) }, weaponSubtype: 'gun' }
      case 't3': return { name: 'Rifle', stats: { damage: randomInt(81, 120), critRate: randomInt(11, 15) }, weaponSubtype: 'rifle' }
      case 't4': return { name: 'Sniper', stats: { damage: randomInt(121, 150), critRate: randomInt(16, 20) }, weaponSubtype: 'sniper' }
      case 't5': return { name: 'Tank', stats: { damage: randomInt(151, 199), critRate: randomInt(21, 30) }, weaponSubtype: 'tank' }
      case 't6': return { name: 'Jet', stats: { damage: randomInt(200, 300), critRate: randomInt(31, 49) }, weaponSubtype: 'jet' }
      case 't7': return { name: 'Submarine', stats: { damage: randomInt(350, 500), critRate: randomInt(40, 60) }, weaponSubtype: 'submarine' }
    }
  } else if (category === 'vehicle') {
    if (tier === 't7') {
      return { name: 'T7 Submarine', stats: { damage: randomInt(400, 550), critRate: randomInt(45, 65) } }
    } else if (tier === 't6') {
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
  // Tier chance
  const rT = Math.random() * 100
  let tier: EquipTier = 't1'
  if (rT < 0.05) tier = 't7'
  else if (rT < 0.15) tier = 't6'
  else if (rT < 1.00) tier = 't5'
  else if (rT < 4.00) tier = 't4'
  else if (rT < 11.00) tier = 't3'
  else if (rT < 50.00) tier = 't2'

  return rollItemOfTier(tier)
}

function rollMilitaryBoxItem(): EquipItem {
  // Military Box chance
  const rT = Math.random() * 100
  let tier: EquipTier = 't3'
  if (rT < 2.00) tier = 't7'
  else if (rT < 7.00) tier = 't6'
  else if (rT < 25.00) tier = 't5'
  else if (rT < 50.00) tier = 't4'
  else if (rT < 80.00) tier = 't3'
  else if (rT < 95.00) tier = 't2'
  else tier = 't1'

  return rollItemOfTier(tier)
}

export function rollItemOfTier(tier: EquipTier): EquipItem {
  // Type chance (66% Armor, 34% Weapon, but if T6/T7, 20% chance of Vehicle)
  let category: EquipCategory = Math.random() < 0.66 ? 'armor' : 'weapon'
  let slot: EquipSlot = 'weapon'
  
  if ((tier === 't6' || tier === 't7') && Math.random() < 0.20) {
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
    location: 'inventory',
  }
}

function getStarterKit(): EquipItem[] {
  const kit: EquipItem[] = []
  const slots: EquipSlot[] = ['helmet', 'chest', 'legs', 'gloves', 'boots', 'weapon']
  const tiers: EquipTier[] = ['t1', 't2', 't3', 't4', 't5', 't6']
  
  tiers.forEach(tier => {
    slots.forEach(slot => {
      const category: EquipCategory = slot === 'weapon' ? 'weapon' : 'armor'
      const subtype = slot === 'weapon' ? WEAPON_SUBTYPES[tier][0] : undefined
      const { name, stats, weaponSubtype } = generateStats(category, slot, tier, subtype)
      kit.push({
        id: `start-${tier}-${slot}-${Math.random().toString(36).substring(2, 9)}`,
        name,
        slot,
        category,
        tier,
        equipped: tier === 't3', // Equip T3 set
        durability: 100,
        stats,
        weaponSubtype,
        location: 'inventory',
      })
    })
  })
  // Add a second T5 weapon (rpg) and T6 weapon (warship) for subtype variety
  const rpg = generateStats('weapon', 'weapon', 't5', 'rpg')
  kit.push({ id: `start-t5-rpg-${Math.random().toString(36).substring(2, 9)}`, name: rpg.name, slot: 'weapon', category: 'weapon', tier: 't5', equipped: false, durability: 100, stats: rpg.stats, weaponSubtype: rpg.weaponSubtype, location: 'inventory' })
  const warship = generateStats('weapon', 'weapon', 't6', 'warship')
  kit.push({ id: `start-t6-warship-${Math.random().toString(36).substring(2, 9)}`, name: warship.name, slot: 'weapon', category: 'weapon', tier: 't6', equipped: false, durability: 100, stats: warship.stats, weaponSubtype: warship.weaponSubtype, location: 'inventory' })
  return kit
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  totalCasesOpened: 0,
  totalItemsDismantled: 0,

  fetchInventory: async () => {
    try {
      const res: any = await api.get('/inventory')
      if (res.items) {
        set({ items: res.items })
      }
    } catch (e) {
      console.error('Failed to fetch inventory:', e)
    }
  },

  openLootBox: async () => {
    if (!rateLimiter.check('openLootBox')) return null
    const playerStore = usePlayerStore.getState()
    if (playerStore.lootBoxes <= 0) return null

    try {
      const res: any = await api.post('/inventory/open-box', { boxType: 'loot' })
      if (!res.success) return null
      
      const { item, bonusMoney, bonusScrap } = res
      
      usePlayerStore.getState().removeResource('lootBoxes', 1, 'lootbox_open')
      if (bonusMoney) usePlayerStore.getState().earnMoney(bonusMoney)
      if (bonusScrap) usePlayerStore.getState().addResource('scrap', bonusScrap, 'lootbox_open')

      if (item) {
        set(s => ({ items: [...s.items, item] }))
      }

      // Track case opens
      set(s => ({ totalCasesOpened: s.totalCasesOpened + 1 }))
      const inv = get()
      const ps = usePlayerStore.getState()
      useWarCardsStore.getState().checkAndAwardCards(ps.name, ps.name, {
        totalDamageDone: ps.damageDone,
        totalMoney: ps.money,
        totalItemsProduced: ps.itemsProduced,
        playerLevel: ps.level,
        totalCasesOpened: inv.totalCasesOpened,
        totalItemsDismantled: inv.totalItemsDismantled,
      })

      let rewardType: LootBoxRewardType = 'item'
      if (!item && bonusMoney > 0 && bonusScrap === 0) rewardType = 'money'
      else if (!item) rewardType = 'resources'

      return { rewardType, item, money: bonusMoney || 0, scrap: bonusScrap || 0, oil: 0, badgesOfHonor: 0 }
    } catch(e) { console.error('Lootbox err', e); return null }
  },

  openMilitaryBox: async () => {
    if (!rateLimiter.check('openMilitaryBox')) return null
    const playerStore = usePlayerStore.getState()
    if (playerStore.militaryBoxes <= 0) return null

    try {
      const res: any = await api.post('/inventory/open-box', { boxType: 'military' })
      if (!res.success) return null

      const { item } = res
      usePlayerStore.getState().removeResource('militaryBoxes', 1, 'milbox_open')
      if (item) set(s => ({ items: [...s.items, item] }))

      set(s => ({ totalCasesOpened: s.totalCasesOpened + 1 }))
      const inv = get()
      const ps = usePlayerStore.getState()
      useWarCardsStore.getState().checkAndAwardCards(ps.name, ps.name, {
        totalDamageDone: ps.damageDone,
        totalMoney: ps.money,
        totalItemsProduced: ps.itemsProduced,
        playerLevel: ps.level,
        totalCasesOpened: inv.totalCasesOpened,
        totalItemsDismantled: inv.totalItemsDismantled,
      })

      return { rewardType: 'item' as LootBoxRewardType, item, scrap: 0, money: 0, oil: 0, badgesOfHonor: 0 }
    } catch(e) { console.error('Milbox err', e); return null }
  },

  dismantleItem: async (itemId) => {
    try {
      const res: any = await api.post(`/inventory/dismantle/${itemId}`)
      if (res.success) {
        set((s) => ({
          items: s.items.filter((i) => i.id !== itemId),
          totalItemsDismantled: s.totalItemsDismantled + 1,
        }))
        
        usePlayerStore.getState().addResource('scrap', res.scrapGained || 0, 'item_dismantle')

        // War Cards
        const inv = get()
        const ps = usePlayerStore.getState()
        useWarCardsStore.getState().checkAndAwardCards(ps.name, ps.name, {
          totalDamageDone: ps.damageDone,
          totalMoney: ps.money,
          totalItemsProduced: ps.itemsProduced,
          playerLevel: ps.level,
          totalCasesOpened: inv.totalCasesOpened,
          totalItemsDismantled: inv.totalItemsDismantled,
        })
        return { success: true, scrapGained: res.scrapGained, message: 'Dismantled item' }
      }
      return { success: false, scrapGained: 0, message: res.error || 'Failed to dismantle' }
    } catch (e: any) {
      return { success: false, scrapGained: 0, message: e.message || 'Error dismantling item' }
    }
  },

  sellItem: async (itemId) => {
    try {
      const res: any = await api.post(`/inventory/sell/${itemId}`)
      if (res.success) {
        set((s) => ({
          items: s.items.filter((i) => i.id !== itemId),
        }))
        usePlayerStore.getState().earnMoney(res.moneyGained || 0)
        return { success: true, moneyGained: res.moneyGained, message: 'Item sold' }
      }
      return { success: false, moneyGained: 0, message: res.error || 'Failed to sell' }
    } catch (e: any) {
      return { success: false, moneyGained: 0, message: e.message || 'Error selling item' }
    }
  },

  equipItem: async (itemId) => {
    try {
      const res: any = await api.post(`/inventory/equip/${itemId}`)
      if (res.success) {
        set((s) => {
          const item = s.items.find((i) => i.id === itemId)
          if (!item) return s
          const updated = s.items.map((i) => {
            if (i.id === itemId) return { ...i, equipped: true }
            if (i.slot === item.slot && i.equipped) return { ...i, equipped: false }
            return i
          })
          return { items: updated }
        })
        return { success: true, message: 'Item equipped' }
      }
      return { success: false, message: 'Failed to equip item' }
    } catch (e: any) { return { success: false, message: e.message } }
  },

  unequipItem: async (itemId) => {
    try {
      const res: any = await api.post(`/inventory/unequip/${itemId}`)
      if (res.success) {
        set((s) => ({ items: s.items.map((i) => i.id === itemId ? { ...i, equipped: false } : i) }))
        return { success: true, message: 'Item unequipped' }
      }
      return { success: false, message: 'Failed to unequip item' }
    } catch (e: any) { return { success: false, message: e.message } }
  },

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

  getEquipped: () => get().items.filter((i) => i.equipped && i.location === 'inventory'),

  getPlayerItems: () => get().items.filter((i) => i.location === 'inventory'),

  getItemById: (itemId) => get().items.find((i) => i.id === itemId),
}))
