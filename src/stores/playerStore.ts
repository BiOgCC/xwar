import { create } from 'zustand'
import { useInventoryStore } from './inventoryStore'
import { useSkillsStore } from './skillsStore'
import { useSpecializationStore } from './specializationStore'
import { useWarCardsStore } from './warCardsStore'

export type PlayerRole = 'military' | 'business' | 'politics'

// ── Military Rank System ──
export type MilitaryRank = 'private' | 'corporal' | 'sergeant' | 'lieutenant' | 'captain' | 'colonel' | 'general'

const RANK_TABLE: { minLevel: number; rank: MilitaryRank; label: string }[] = [
  { minLevel: 30, rank: 'general',    label: 'General' },
  { minLevel: 25, rank: 'colonel',    label: 'Colonel' },
  { minLevel: 20, rank: 'captain',    label: 'Captain' },
  { minLevel: 15, rank: 'lieutenant', label: 'Lieutenant' },
  { minLevel: 10, rank: 'sergeant',   label: 'Sergeant' },
  { minLevel: 5,  rank: 'corporal',   label: 'Corporal' },
  { minLevel: 1,  rank: 'private',    label: 'Private' },
]

export function getMilitaryRank(level: number): { rank: MilitaryRank; label: string } {
  for (const entry of RANK_TABLE) {
    if (level >= entry.minLevel) return { rank: entry.rank, label: entry.label }
  }
  return { rank: 'private', label: 'Private' }
}

export { RANK_TABLE }

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
  militaryBoxes: number
  staminaPills: number
  energyLeaves: number
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
  enlistedArmyId: string | null
  heroBuffTicksLeft: number  // HERO buff: +10% division damage, 120 ticks
  heroBuffBattleId: string | null  // Which battle the HERO buff is active on
  avatar: string  // Path to selected avatar image

  // Shame counters (auto-tracked for War Cards)
  muteCount: number
  deathCount: number
  battlesLost: number
  totalCasinoLosses: number
  bankruptcyCount: number
  countrySwitches: number
  casinoSpins: number
  itemsDestroyed: number

  // Actions
  setAvatar: (path: string) => void
  attack: () => { damage: number, isCrit: boolean, isDodged: boolean }
  equipAmmo: (type: 'none' | 'green' | 'blue' | 'purple' | 'red') => void
  consumeFood: (type: 'bread' | 'sushi' | 'wagyu') => boolean
  buyResource: (resource: 'food' | 'oil' | 'materialX', amount: number, cost: number) => void
  buyItem: (itemKey: keyof PlayerState, amount: number, cost: number) => boolean
  sellItem: (itemKey: keyof PlayerState, amount: number, price: number) => boolean
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

  // Shame counter increments
  incrementMuteCount: () => void
  incrementDeathCount: (amount?: number) => void
  incrementBattlesLost: () => void
  addCasinoLoss: (amount: number) => void
  incrementBankruptcy: () => void
  incrementCountrySwitch: () => void
  incrementCasinoSpins: (amount?: number) => void
  incrementItemsDestroyed: (amount?: number) => void
  /** Check shame cards and award any that are newly earned */
  checkShameCards: () => void
}

function xpForLevel(level: number): number {
  // Tiered: 100 XP/level for 1-10, 150 for 11-20, 200 for 21-30
  if (level <= 10) return 100
  if (level <= 20) return 150
  return 200
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  name: 'Commander_X',
  role: 'military',
  rank: 12,
  maxRank: 100,
  country: 'United States',
  countryCode: 'US',
  enlistedArmyId: null,

  // Shame counters
  muteCount: 0,
  deathCount: 0,
  battlesLost: 0,
  totalCasinoLosses: 0,
  bankruptcyCount: 0,
  countrySwitches: 0,
  casinoSpins: 0,
  itemsDestroyed: 0,

  money: 5000000,
  food: 10000,
  wheat: 1000,
  fish: 1000,
  steak: 1000,
  bread: 1000,
  sushi: 1000,
  wagyu: 1000,
  greenBullets: 1000,
  blueBullets: 1000,
  purpleBullets: 1000,
  redBullets: 1000,
  oil: 500000,
  materialX: 500000,
  scrap: 500000,
  bitcoin: 10000,
  companiesOwned: 3,
  lootBoxes: 5,
  militaryBoxes: 5,
  staminaPills: 0,
  energyLeaves: 0,
  lootChancePool: 0,

  level: 12,
  experience: 450,
  experienceToNext: 150, // Level 12 is in tier 11-20 → 150 XP needed
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
  heroBuffTicksLeft: 0,
  heroBuffBattleId: null,
  avatar: '/assets/avatars/avatar_male.png',

  setAvatar: (path) => set({ avatar: path }),
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

    // Specialization bonuses
    const specBonus = useSpecializationStore.getState().getMilitaryBonuses()
    totalDmg = Math.floor(totalDmg * (1 + specBonus.damagePercent / 100))
    totalCritRate += specBonus.critRatePercent

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
    // Record damage for specialization XP
    useSpecializationStore.getState().recordDamage(finalDamage)
    // War Cards: check damage milestones + single-hit record + weekly tracking
    const newState = get()
    const wc = useWarCardsStore.getState()
    wc.addWeeklyDamage(newState.name, finalDamage)
    wc.checkSingleHitRecord(newState.name, newState.name, finalDamage)
    wc.checkAndAwardCards(newState.name, newState.name, {
      totalDamageDone: newState.damageDone,
      totalMoney: newState.money,
      totalItemsProduced: newState.itemsProduced,
      playerLevel: newState.level,
      singleHitDamage: finalDamage,
    })
    return { damage: finalDamage, isCrit, isDodged }
  },

  buyResource: (resource, amount, cost) => {
    set((s) => {
      if (s.money < cost) return {}
      return {
        money: s.money - cost,
        [resource]: (s as any)[resource] + amount,
      }
    })
  },

  buyItem: (itemKey, amount, cost) => {
    let success = false
    set((s) => {
      if (s.money < cost) return {}
      success = true
      return {
        money: s.money - cost,
        [itemKey]: ((s[itemKey] as number) || 0) + amount,
      } as Partial<PlayerState>
    })
    return success
  },

  sellItem: (itemKey, amount, price) => {
    let success = false
    set((s) => {
      const currentAmount = (s[itemKey] as number) || 0
      if (currentAmount < amount) return {}
      success = true
      return {
        money: s.money + price,
        [itemKey]: currentAmount - amount,
      } as Partial<PlayerState>
    })
    return success
  },

  earnMoney: (amount) => {
    set((s) => ({ money: s.money + amount }))
    // War Cards: check money milestones
    const s = get()
    const wc = useWarCardsStore.getState()
    wc.addWeeklyMoney(s.name, amount)
    wc.checkAndAwardCards(s.name, s.name, {
      totalDamageDone: s.damageDone,
      totalMoney: s.money,
      totalItemsProduced: s.itemsProduced,
      playerLevel: s.level,
    })
  },

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

  doWork: () => {
    set((s) => {
      const fill = 20
      return {
        work: Math.max(0, s.work - 10),
        productionBar: Math.min(s.productionBarMax, s.productionBar + fill),
      }
    })
    useSpecializationStore.getState().recordWork()
  },

  doEntrepreneurship: () => {
    set((s) => {
      const fill = 25
      return {
        entrepreneurship: Math.max(0, s.entrepreneurship - 10),
        productionBar: Math.min(s.productionBarMax, s.productionBar + fill),
      }
    })
    useSpecializationStore.getState().recordWork()
  },

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
      useSpecializationStore.getState().recordProduce()
      // War Cards: check items produced milestone
      setTimeout(() => {
        const ps = usePlayerStore.getState()
        useWarCardsStore.getState().checkAndAwardCards(ps.name, ps.name, {
          totalDamageDone: ps.damageDone,
          totalMoney: ps.money,
          totalItemsProduced: ps.itemsProduced + 1,
          playerLevel: ps.level,
        })
      }, 0)
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

  // ── Shame counter increments ──

  incrementMuteCount: () => {
    set(s => ({ muteCount: s.muteCount + 1 }))
    get().checkShameCards()
  },
  incrementDeathCount: (amount = 1) => {
    set(s => ({ deathCount: s.deathCount + amount }))
    get().checkShameCards()
  },
  incrementBattlesLost: () => {
    set(s => ({ battlesLost: s.battlesLost + 1 }))
    get().checkShameCards()
  },
  addCasinoLoss: (amount) => {
    set(s => ({ totalCasinoLosses: s.totalCasinoLosses + amount }))
    get().checkShameCards()
  },
  incrementBankruptcy: () => {
    set(s => ({ bankruptcyCount: s.bankruptcyCount + 1 }))
    get().checkShameCards()
  },
  incrementCountrySwitch: () => {
    set(s => ({ countrySwitches: s.countrySwitches + 1 }))
    get().checkShameCards()
  },
  incrementCasinoSpins: (amount = 1) => {
    set(s => ({ casinoSpins: s.casinoSpins + amount }))
    // Don't check every spin — batch check every 100
    if (get().casinoSpins % 100 === 0) get().checkShameCards()
  },
  incrementItemsDestroyed: (amount = 1) => {
    set(s => ({ itemsDestroyed: s.itemsDestroyed + amount }))
    get().checkShameCards()
  },

  checkShameCards: () => {
    const s = get()
    useWarCardsStore.getState().checkAndAwardCards(s.name, s.name, {
      totalDamageDone: s.damageDone,
      totalMoney: s.money,
      totalItemsProduced: s.itemsProduced,
      playerLevel: s.level,
      muteCount: s.muteCount,
      deathCount: s.deathCount,
      battlesLost: s.battlesLost,
      totalCasinoLosses: s.totalCasinoLosses,
      bankruptcyCount: s.bankruptcyCount,
      countrySwitches: s.countrySwitches,
      casinoSpins: s.casinoSpins,
      itemsDestroyed: s.itemsDestroyed,
    })
  },
}))
