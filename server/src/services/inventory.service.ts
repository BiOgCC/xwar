/**
 * Inventory Service — server-side item generation (RNG moved from client)
 * Mirrors the logic from src/stores/inventoryStore.ts
 */

type EquipTier = 't1' | 't2' | 't3' | 't4' | 't5' | 't6'
type EquipSlot = 'helmet' | 'chest' | 'legs' | 'gloves' | 'boots' | 'weapon' | 'vehicle'
type EquipCategory = 'armor' | 'weapon' | 'vehicle'
type WeaponSubtype = 'knife' | 'gun' | 'rifle' | 'sniper' | 'tank' | 'rpg' | 'jet' | 'warship'

interface EquipStats {
  damage?: number
  critRate?: number
  critDamage?: number
  armor?: number
  dodge?: number
  precision?: number
}

const ARMOR_SLOTS: EquipSlot[] = ['helmet', 'chest', 'legs', 'gloves', 'boots']

const WEAPON_SUBTYPES: Record<EquipTier, WeaponSubtype[]> = {
  t1: ['knife'], t2: ['gun'], t3: ['rifle'], t4: ['sniper'],
  t5: ['tank', 'rpg'], t6: ['jet', 'warship'],
}

const TIER_LABELS: Record<EquipTier, string> = {
  t1: 'Common', t2: 'Uncommon', t3: 'Rare', t4: 'Epic', t5: 'Legendary', t6: 'Mythic',
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateStats(
  category: EquipCategory, slot: EquipSlot, tier: EquipTier, weaponSubtype?: WeaponSubtype
): { name: string; stats: EquipStats; weaponSubtype?: WeaponSubtype } {
  const tLevel = parseInt(tier[1], 10)

  if (category === 'weapon') {
    if (tier === 't5' && weaponSubtype === 'rpg')
      return { name: 'RPG', stats: { damage: randomInt(151, 199), critRate: randomInt(21, 30) }, weaponSubtype: 'rpg' }
    if (tier === 't6' && weaponSubtype === 'warship')
      return { name: 'Warship', stats: { damage: randomInt(200, 300), critRate: randomInt(31, 49) }, weaponSubtype: 'warship' }

    switch (tier) {
      case 't1': return { name: 'Knife', stats: { damage: randomInt(20, 49), critRate: 5 }, weaponSubtype: 'knife' }
      case 't2': return { name: 'Gun', stats: { damage: randomInt(50, 80), critRate: randomInt(6, 10) }, weaponSubtype: 'gun' }
      case 't3': return { name: 'Rifle', stats: { damage: randomInt(81, 120), critRate: randomInt(11, 15) }, weaponSubtype: 'rifle' }
      case 't4': return { name: 'Sniper', stats: { damage: randomInt(121, 150), critRate: randomInt(16, 20) }, weaponSubtype: 'sniper' }
      case 't5': return { name: 'Tank', stats: { damage: randomInt(151, 199), critRate: randomInt(21, 30) }, weaponSubtype: 'tank' }
      case 't6': return { name: 'Jet', stats: { damage: randomInt(200, 300), critRate: randomInt(31, 49) }, weaponSubtype: 'jet' }
    }
  } else if (category === 'vehicle') {
    return { name: `T${tLevel} Vehicle`, stats: { damage: randomInt(10 * tLevel, 20 * tLevel) } }
  } else {
    const namePrefix = TIER_LABELS[tier]
    switch (slot) {
      case 'helmet': return { name: `${namePrefix} Helmet`, stats: { critDamage: randomInt(Math.max(1, 20 * tLevel - 8), 20 * tLevel) } }
      case 'chest':  return { name: `${namePrefix} Chestplate`, stats: { armor: randomInt(Math.max(1, 5 * tLevel - 3), 5 * tLevel) } }
      case 'legs':   return { name: `${namePrefix} Legging`, stats: { armor: randomInt(Math.max(1, 5 * tLevel - 3), 5 * tLevel) } }
      case 'boots':  return { name: `${namePrefix} Boots`, stats: { dodge: randomInt(Math.max(1, 5 * tLevel - 3), 5 * tLevel) } }
      case 'gloves': return { name: `${namePrefix} Gloves`, stats: { precision: randomInt(Math.max(1, 5 * tLevel - 4), 5 * tLevel) } }
    }
  }
  return { name: 'Unknown', stats: {} }
}

function rollItemOfTier(tier: EquipTier, ownerId: string) {
  let category: EquipCategory = Math.random() < 0.66 ? 'armor' : 'weapon'
  let slot: EquipSlot = 'weapon'

  if (tier === 't6' && Math.random() < 0.20) {
    category = 'vehicle'; slot = 'vehicle'
  } else if (category === 'armor') {
    slot = ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)]
  }

  let subtype: WeaponSubtype | undefined
  if (category === 'weapon') {
    const subtypes = WEAPON_SUBTYPES[tier]
    subtype = subtypes[Math.floor(Math.random() * subtypes.length)]
  }

  const result = generateStats(category, slot, tier, subtype)

  return {
    ownerId,
    name: result.name,
    slot,
    category,
    tier,
    equipped: false,
    durability: '100',
    weaponSubtype: result.weaponSubtype || null,
    location: 'inventory' as const,
    stats: result.stats,
  }
}

/** Roll a loot box item (civilian: T1 50%, T2 39%, T3 7%, T4 3%, T5 0.85%, T6 0.15%) */
export function rollLootBoxItem(ownerId: string) {
  const rT = Math.random() * 100
  let tier: EquipTier = 't1'
  if (rT < 0.15) tier = 't6'
  else if (rT < 1.00) tier = 't5'
  else if (rT < 4.00) tier = 't4'
  else if (rT < 11.00) tier = 't3'
  else if (rT < 50.00) tier = 't2'
  return rollItemOfTier(tier, ownerId)
}

/** Roll a military box item (T3: 30%, T4: 25%, T5: 18%, T6: 7%) */
export function rollMilitaryBoxItem(ownerId: string) {
  const rT = Math.random() * 100
  let tier: EquipTier = 't3'
  if (rT < 7.00) tier = 't6'
  else if (rT < 25.00) tier = 't5'
  else if (rT < 50.00) tier = 't4'
  else if (rT < 80.00) tier = 't3'
  else if (rT < 95.00) tier = 't2'
  else tier = 't1'
  return rollItemOfTier(tier, ownerId)
}

/** Generate starter kit for new player (T1-T3 equipment, T3 equipped) */
export function generateStarterKit(ownerId: string) {
  const kit: ReturnType<typeof rollItemOfTier>[] = []
  const slots: EquipSlot[] = ['helmet', 'chest', 'legs', 'gloves', 'boots', 'weapon']
  const tiers: EquipTier[] = ['t1', 't2', 't3']

  tiers.forEach(tier => {
    slots.forEach(slot => {
      const category: EquipCategory = slot === 'weapon' ? 'weapon' : 'armor'
      const subtype = slot === 'weapon' ? WEAPON_SUBTYPES[tier][0] : undefined
      const result = generateStats(category, slot, tier, subtype)
      kit.push({
        ownerId,
        name: result.name,
        slot,
        category,
        tier,
        equipped: tier === 't3', // Equip T3 set by default
        durability: '100',
        weaponSubtype: result.weaponSubtype || null,
        location: 'inventory' as const,
        stats: result.stats,
      })
    })
  })

  return kit
}
