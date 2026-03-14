import { create } from 'zustand'
import { useInventoryStore } from './inventoryStore'

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

  // XP & Leveling
  level: number
  experience: number
  experienceToNext: number
  skillPoints: number

  // Bars
  health: number
  maxHealth: number
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
  attack: () => void
  equipAmmo: (type: 'none' | 'green' | 'blue' | 'purple' | 'red') => void
  consumeFood: (type: 'bread' | 'sushi' | 'wagyu') => boolean
  buyResource: (resource: 'food' | 'oil' | 'materialX', amount: number, cost: number) => void
  earnMoney: (amount: number) => void
  gainXP: (amount: number) => void
  consumeBar: (bar: 'health' | 'hunger' | 'entrepreneurship' | 'work', amount: number) => void
  doWork: () => void
  doEntrepreneurship: () => void
  produce: (industrialistLevel: number) => void
  addScrap: (amount: number) => void
  spendMoney: (amount: number) => boolean
  spendMaterialX: (amount: number) => boolean
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
  wheat: 0,
  fish: 0,
  steak: 0,
  bread: 0,
  sushi: 0,
  wagyu: 0,
  greenBullets: 0,
  blueBullets: 0,
  purpleBullets: 0,
  redBullets: 0,
  oil: 920,
  materialX: 38,
  scrap: 0,
  bitcoin: 0,
  companiesOwned: 3,
  lootBoxes: 5,

  level: 1,
  experience: 0,
  experienceToNext: 100,
  skillPoints: 5,

  health: 100,
  maxHealth: 100,
  hunger: 80,
  maxHunger: 100,
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
      
      const healthGain = type === 'wagyu' ? 30 : type === 'sushi' ? 20 : 10
      consumed = true
      
      return {
        [type]: s[type] - 1,
        hunger: Math.max(0, s.hunger - 1),
        health: Math.min(s.maxHealth, s.health + healthGain)
      }
    })
    return consumed
  },

  attack: () =>
    set((s) => {
      // Handle Ammo Consumption & Multiplier
      let damageMultiplier = 1.0
      let usedAmmo = s.equippedAmmo
      let ammoCount = usedAmmo !== 'none' ? s[`${usedAmmo}Bullets` as keyof PlayerState] as number : 0

      if (usedAmmo !== 'none' && ammoCount > 0) {
        if (usedAmmo === 'green') damageMultiplier = 1.1
        else if (usedAmmo === 'blue') damageMultiplier = 1.2
        else if (usedAmmo === 'purple') damageMultiplier = 1.4
        else if (usedAmmo === 'red') damageMultiplier = 1.4 // Crit handled by combat engine later

        ammoCount -= 1
      } else {
        usedAmmo = 'none' // Force unequip if empty
      }

      // Base attack logic & Stats Integration
      let totalDmg = 150
      let totalCritRate = 0
      let totalCritDmg = 0

      const invStore = useInventoryStore.getState()
      const equipped = invStore.getEquipped()
      
      equipped.forEach((item: any) => {
        if (item.stats.damage) totalDmg += item.stats.damage
        if (item.stats.critRate) totalCritRate += item.stats.critRate
        if (item.stats.critDamage) totalCritDmg += item.stats.critDamage
      })

      if (usedAmmo === 'red') {
        totalCritRate += 10
      }

      const isCrit = Math.random() < (totalCritRate / 100)
      let finalMultiplier = damageMultiplier
      
      if (isCrit) {
        finalMultiplier *= (1.5 + (totalCritDmg / 100))
      }

      const finalDamage = Math.floor(totalDmg * finalMultiplier)

      const xpGain = 25
      let newXP = s.experience + xpGain
      let newLevel = s.level
      let newSP = s.skillPoints
      let nextXP = s.experienceToNext
      while (newXP >= nextXP) {
        newXP -= nextXP
        newLevel++
        newSP++
        nextXP = xpForLevel(newLevel)
      }

      const updates: Partial<PlayerState> = {
        food: Math.max(0, s.food - 50),
        oil: Math.max(0, s.oil - 25),
        money: s.money + 800,
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

      // 30% chance to drop a lootbox
      if (Math.random() < 0.3) {
        updates.lootBoxes = s.lootBoxes + 1
      }

      return updates
    }),

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
        newSP++
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
      const chance = industrialistLevel * 0.03
      const foundBitcoin = Math.random() < chance
      const xpGain = 30
      let newXP = s.experience + xpGain
      let newLevel = s.level
      let newSP = s.skillPoints
      let nextXP = s.experienceToNext
      while (newXP >= nextXP) {
        newXP -= nextXP
        newLevel++
        newSP++
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

  regenerateBars: () => set((state) => {
    const p = 0.05
    return {
      health: Math.min(state.maxHealth, state.health + (state.maxHealth * p)),
      hunger: Math.min(state.maxHunger, state.hunger + (state.maxHunger * p)),
      entrepreneurship: Math.min(state.maxEntrepreneurship, state.entrepreneurship + (state.maxEntrepreneurship * p)),
      work: Math.min(state.maxWork, state.work + (state.maxWork * p)),
    }
  }),
}))
