// ══════════════════════════════════════════════
// XWAR — Inventory / Equipment Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export type EquipTier = 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7'
export type ArmorSlot = 'helmet' | 'chest' | 'legs' | 'gloves' | 'boots'
export type WeaponSlot = 'weapon'
export type VehicleSlot = 'vehicle'
export type EquipSlot = ArmorSlot | WeaponSlot | VehicleSlot
export type EquipCategory = 'armor' | 'weapon' | 'vehicle'
export type WeaponSubtype = 'knife' | 'gun' | 'rifle' | 'sniper' | 'tank' | 'rpg' | 'jet' | 'warship' | 'submarine'

export interface EquipStats {
  damage?: number
  critRate?: number
  critDamage?: number
  armor?: number
  dodge?: number
  precision?: number
}

export type ItemLocation = 'inventory' | 'vault' | 'market' | 'country_vault'

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
  superforged?: boolean
  location: ItemLocation

}

export type LootBoxRewardType = 'item' | 'money' | 'resources'

export interface LootBoxResult {
  rewardType: LootBoxRewardType
  item?: EquipItem
  money: number
  scrap: number
  oil: number
  badgesOfHonor?: number
}
