import { create } from 'zustand'
import { useInventoryStore } from './inventoryStore'
import { useSkillsStore } from './skillsStore'

export type PlayerRole = 'military' | 'business' | 'politics'

export interface PlayerState {
  name: string
  role: PlayerRole
  rank: number
  maxRank: number
  country: string
  countryCode: string

  // Resources
  money: number
  food: number // Legacy, keeping for compatibility if needed elsewhere temporarily
  wheat: number
  fish: number
  steak: number
  bread: number
  sushi: number
  wagyu: number
  greenBullets: number
  blueBullets: number
  purpleBullets: number
  redBullets: number

  oil: number
  materialX: number
  scrap: number
  bitcoin: number
  companiesOwned: number
  lootBoxes: number
  lootChancePool: number

  // XP & Leveling
  level: number
  experience: number
  experienceToNext: number
  skillPoints: number

  // Bars
  stamina: number
  maxStamina: number
  hunger: number
  maxHunger: number
  entrepreneurship: number
  maxEntrepreneurship: number
  work: number
  maxWork: number

  // Production
  productionBar: number
  productionBarMax: number

  // Specialization & Stats
  specialization: { military: number; economic: number }
  damageDone: number
  itemsProduced: number
  equippedAmmo: 'none' | 'green' | 'blue' | 'purple' | 'red'

  // Actions
  attack: () => { damage: number, isCrit: boolean, isDodged: boolean }
  equipAmmo: (type: 'none' | 'green' | 'blue' | 'purple' | 'red') => void
  consumeFood: (type: 'bread' | 'sushi' | 'wagyu') => boolean
  buyResource: (resource: 'food' | 'oil' | 'materialX', amount: number, cost: number) => void
  earnMoney: (amount: number) => void
  gainXP: (amount: number) => void
  consumeBar: (bar: 'stamina' | 'hunger' | 'entrepreneurship' | 'work', amount: number) => void
  doWork: () => void
  doEntrepreneurship: () => void
  produce: (industrialistLevel: number) => void
  addScrap: (amount: number) => void
  spendMoney: (amount: number) => boolean
  spendMaterialX: (amount: number) => boolean
  spendOil: (amount: number) => boolean
  spendScraps: (amount: number) => boolean
  spendBitcoin: (amount: number) => boolean
  regenerateBars: () => void
}

function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  name: 'Commander_X',
  role: 'military',
  rank: 12,
  maxRank: 100,
  country: 'United States',
  countryCode: 'US',

  money: 45200,
  food: 1840,
  wheat: 10,
  fish: 10,
  steak: 10,
  bread: 10,
  sushi: 10,
  wagyu: 10,
  greenBullets: 300,
  blueBullets: 0,
  purpleBullets: 0,
  redBullets: 0,
  oil: 920,
  materialX: 38,
  scrap: 0,
  bitcoin: 10,
  companiesOwned: 3,
  lootBoxes: 5,
  lootChancePool: 0,

  level: 12,
  experience: 450,
  experienceToNext: 650,
  skillPoints: 49,

  stamina: 100,
  maxStamina: 100,
  hunger: 5,
  maxHunger: 5,
  entrepreneurship: 100,
  maxEntrepreneurship: 100,
  work: 100,
  maxWork: 100,

  productionBar: 0,
  productionBarMax: 100,

  specialization: { military: 0, economic: 0 },
  damageDone: 0,
  itemsProduced: 0,
  equippedAmmo: 'none',

  equipAmmo: (type) => set({ equippedAmmo: type }),

  consumeFood: (type) => {
    let consumed = false
    set((s) => {
      if (s[type] <= 0 || s.hunger <= 0) return {}
      
      const staminaGain = type === 'wagyu' ? 30 : type === 'sushi' ? 20 : 10
      consumed = true
      
      return {
        [type]: s[type] - 1,
        hunger: Math.max(0, s.hunger - 1),
        stamina: Math.min(s.maxStamina, s.stamina + staminaGain)
      }
    })
    return consumed
  },

  attack: () => {
    const s = get()
    // Handle Ammo Consumption & Multiplier
    let damageMultiplier = 1.0
    let usedAmmo = s.equippedAmmo
    let ammoCount = usedAmmo !== 'none' ? s[`${usedAmmo}Bullets` as keyof PlayerState] as number : 0

    if (usedAmmo !== 'none' && ammoCount > 0) {
      if (usedAmmo === 'green') damageMultiplier = 1.1
      else if (usedAmmo === 'blue') damageMultiplier = 1.2
      else if (usedAmmo === 'purple') damageMultiplier = 1.4
      else if (usedAmmo === 'red') damageMultiplier = 1.4
      ammoCount -= 1
    } else {
      usedAmmo = 'none'
    }

    // Base attack logic & Stats Integration
    let totalDmg = 100
    let totalCritRate = 10
    let totalCritDmg = 100
    
    const invStore = useInventoryStore.getState()
    const equipped = invStore.getEquipped()
    
    let totalArmor = 0
    let totalDodge = 5
    let totalPrecision = 0
    equipped.forEach((item: any) => {
      if (item.stats.damage) totalDmg += item.stats.damage
      if (item.stats.critRate) totalCritRate += item.stats.critRate
      if (item.stats.critDamage) totalCritDmg += item.stats.critDamage
      if (item.stats.armor) totalArmor += item.stats.armor
      if (item.stats.dodge) totalDodge += item.stats.dodge
      if (item.stats.precision) totalPrecision += item.stats.precision
    })

    const milSkills = useSkillsStore.getState().military
    totalDmg += milSkills.attack * 20
    totalCritRate += milSkills.critRate * 5
    totalCritDmg += milSkills.critDamage * 20
    totalArmor += milSkills.armor * 5
    totalDodge += milSkills.dodge * 5
    totalPrecision += milSkills.precision * 5

    // Hit Rate Check: base 50% + equipment + skills
    const totalHitRate = Math.min(100, 50 + totalPrecision)
    const didHit = Math.random() * 100 < totalHitRate

    // Dodge Check & Stamina Cost Calculation
    const isDodged = Math.random() < (totalDodge / 100)
    let staminaCost = 0
    
    if (!isDodged) {
      staminaCost = Math.max(0, 10 - (10 * (totalArmor / 100)))
      invStore.degradeEquippedItems(1) // Item durability damage
    }

    if (s.stamina < staminaCost) return { damage: 0, isCrit: false, isDodged: false } // Not enough stamina

    if (usedAmmo === 'red') {
      totalCritRate += 10
    }

    const isCrit = Math.random() < (totalCritRate / 100)
    let finalMultiplier = damageMultiplier
    
    if (isCrit) {
      finalMultiplier *= (1.5 + (totalCritDmg / 100))
    }

    const finalDamage = didHit ? Math.floor(totalDmg * finalMultiplier) : Math.floor(totalDmg * finalMultiplier * 0.66)

    const xpGain = 25
    let newXP = s.experience + xpGain
    let newLevel = s.level
    let newSP = s.skillPoints
    let nextXP = s.experienceToNext
    while (newXP >= nextXP) {
      newXP -= nextXP
      newLevel++
      newSP += 4
      nextXP = xpForLevel(newLevel)
    }

    const updates: Partial<PlayerState> = {
      stamina: Math.max(0, s.stamina - staminaCost),
      rank: Math.min(s.maxRank, s.rank + 0.5),
      experience: newXP,
      level: newLevel,
      skillPoints: newSP,
      experienceToNext: nextXP,
      damageDone: s.damageDone + finalDamage,
      specialization: { ...s.specialization, military: s.specialization.military + 1 },
      equippedAmmo: usedAmmo
    }

    if (usedAmmo !== 'none') {
      (updates as any)[`${usedAmmo}Bullets`] = ammoCount
    }

    // 7% accumulative loot chance
    let newPool = s.lootChancePool + 7
    let boxesGranted = Math.floor(newPool / 100)
    newPool -= boxesGranted * 100
    
    if (Math.random() * 100 < newPool) {
      boxesGranted++
      newPool = 0
    }

    if (boxesGranted > 0) {
      updates.lootBoxes = s.lootBoxes + boxesGranted
    }
    updates.lootChancePool = newPool

    set(updates)
    return { damage: finalDamage, isCrit, isDodged }
  },

  buyResource: (resource, amount, cost) =>
    set((s) => ({
      money: Math.max(0, s.money - cost),
      [resource]: (s as any)[resource] + amount,
    })),

  earnMoney: (amount) =>
    set((s) => ({ money: s.money + amount })),

  gainXP: (amount) =>
    set((s) => {
      let newXP = s.experience + amount
      let newLevel = s.level
      let newSP = s.skillPoints
      let nextXP = s.experienceToNext
      while (newXP >= nextXP) {
        newXP -= nextXP
        newLevel++
        newSP += 4
        nextXP = xpForLevel(newLevel)
      }
      return {
        experience: newXP,
        level: newLevel,
        skillPoints: newSP,
        experienceToNext: nextXP,
      }
    }),

  consumeBar: (bar, amount) =>
    set((s) => ({
      [bar]: Math.max(0, s[bar] - amount),
    })),

  doWork: () =>
    set((s) => {
      const fill = 20
      return {
        work: Math.max(0, s.work - 10),
        productionBar: Math.min(s.productionBarMax, s.productionBar + fill),
        specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
      }
    }),

  doEntrepreneurship: () =>
    set((s) => {
      const fill = 25
      return {
        entrepreneurship: Math.max(0, s.entrepreneurship - 10),
        productionBar: Math.min(s.productionBarMax, s.productionBar + fill),
        specialization: { ...s.specialization, economic: s.specialization.economic + 1 },
      }
    }),

  produce: (industrialistLevel: number) =>
    set((s) => {
      if (s.productionBar < s.productionBarMax) return {}
      const chance = industrialistLevel * 0.05
      const foundBitcoin = Math.random() < chance
      const xpGain = 30
      let newXP = s.experience + xpGain
      let newLevel = s.level
      let newSP = s.skillPoints
      let nextXP = s.experienceToNext
      while (newXP >= nextXP) {
        newXP -= nextXP
        newLevel++
        newSP += 4
        nextXP = xpForLevel(newLevel)
      }
      return {
        productionBar: 0,
        itemsProduced: s.itemsProduced + 1,
        bitcoin: foundBitcoin ? s.bitcoin + 1 : s.bitcoin,
        experience: newXP,
        level: newLevel,
        skillPoints: newSP,
        experienceToNext: nextXP,
      }
    }),

  addScrap: (amount) =>
    set((s) => ({ scrap: s.scrap + amount })),

  spendMoney: (amount) => {
    const s = get()
    if (s.money < amount) return false
    set({ money: s.money - amount })
    return true
  },

  spendMaterialX: (amount) => {
    const s = get()
    if (s.materialX < amount) return false
    set({ materialX: s.materialX - amount })
    return true
  },

  spendOil: (amount) => {
    const s = get()
    if (s.oil < amount) return false
    set({ oil: s.oil - amount })
    return true
  },

  spendScraps: (amount) => {
    const s = get()
    if (s.scrap < amount) return false
    set({ scrap: s.scrap - amount })
    return true
  },

  spendBitcoin: (amount) => {
    const s = get()
    if (s.bitcoin < amount) return false
    set({ bitcoin: s.bitcoin - amount })
    return true
  },

  regenerateBars: () => set((state) => {
    const p = 0.05
    return {
      stamina: Math.min(state.maxStamina, state.stamina + (state.maxStamina * p)),
      hunger: Math.min(state.maxHunger, state.hunger + (state.maxHunger * p)),
      entrepreneurship: Math.min(state.maxEntrepreneurship, state.entrepreneurship + (state.maxEntrepreneurship * p)),
      work: Math.min(state.maxWork, state.work + (state.maxWork * p)),
    }
  }),
}))
