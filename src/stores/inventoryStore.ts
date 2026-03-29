import { create } from 'zustand'
import { api } from '../api/client'
import { usePlayerStore } from './playerStore'
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
  if (weaponSubtype === 'submarine') return `/assets/items/${prefix}t7_weapon_submarine.png`

  if (tier === 't6') {
    if (category === 'vehicle') return `/assets/items/${prefix}t6_weapon_warship.png`
    if (category === 'weapon') return `/assets/items/${prefix}t6_weapon_jet.png`
  }
  
  if (tier === 't7') {
    if (category === 'vehicle') return `/assets/items/${prefix}t7_weapon_submarine.png`
    // Armor slots have their own T7 images
    return `/assets/items/${prefix}t7_${slot}.png`
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
  openSupplyBox: () => Promise<LootBoxResult | null>
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

// NOTE: Item generation (generateStats, rollItemOfTier, etc.) has been moved
// to server/src/services/inventory.service.ts. All item creation is now
// server-authoritative via API calls.

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
      if (!res.success || !res.item) return null

      // Decrement box count (server already did, reflect locally)
      usePlayerStore.getState().removeResource('militaryBoxes', 1, 'milbox_open')

      set(s => ({ items: [...s.items, res.item], totalCasesOpened: s.totalCasesOpened + 1 }))
      return { rewardType: 'item' as LootBoxRewardType, item: res.item, scrap: 0, money: 0, oil: 0, badgesOfHonor: 0 }
    } catch(e: any) {
      console.error('Military box error:', e.message)
      return null
    }
  },

  openSupplyBox: async () => {
    if (!rateLimiter.check('openSupplyBox')) return null
    const playerStore = usePlayerStore.getState()
    if (playerStore.supplyBoxes <= 0) return null

    try {
      const res: any = await api.post('/inventory/open-box', { boxType: 'supply' })
      if (!res.success) return null

      // Reflect box decrement locally (server already applied)
      usePlayerStore.getState().removeResource('supplyBoxes', 1, 'supplybox_open')

      let rewardType: LootBoxRewardType = 'resources'
      let scrap = 0, money = 0, oil = 0

      if (res.rewardType === 'resources' && res.scrap) {
        usePlayerStore.getState().addResource('scrap', res.scrap, 'supply_box')
        scrap = res.scrap
      } else if (res.rewardType === 'bullets' && res.bulletType && res.bulletAmount) {
        usePlayerStore.getState().addResource(res.bulletType, res.bulletAmount, 'supply_box')
        money = res.bulletAmount
      } else if (res.rewardType === 'food' && res.foodType && res.foodAmount) {
        usePlayerStore.getState().addResource(res.foodType, res.foodAmount, 'supply_box')
        oil = res.foodAmount
      }

      set(s => ({ totalCasesOpened: s.totalCasesOpened + 1 }))
      return { rewardType, scrap, money, oil, badgesOfHonor: 0 }
    } catch(e: any) {
      console.error('Supply box error:', e.message)
      return null
    }
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
