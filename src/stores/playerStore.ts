import { create } from 'zustand'
import { useInventoryStore } from './inventoryStore'
import { useSkillsStore } from './skillsStore'
import { useSpecializationStore } from './specializationStore'
import { useWarCardsStore } from './warCardsStore'
import { rateLimiter, validateEarn, validateSpend, logSuspicion } from '../engine/AntiExploit'
import { applyCatchUpXP } from '../engine/catchup'
import { useWorldStore } from './worldStore'
import { useAllianceStore, getIdeologyBonus } from './allianceStore'

import type { PlayerRole, MilitaryRank } from '../types/player.types'
export type { PlayerRole, MilitaryRank }

// Economy ledger hook — registered by worldStore to avoid circular deps
let _econFlowHook: ((source: string, amount: number, type: 'created' | 'destroyed', resource?: string) => void) | null = null
export function registerEconFlowHook(hook: (source: string, amount: number, type: 'created' | 'destroyed', resource?: string) => void) {
  _econFlowHook = hook
}

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
  supplyBoxes: number
  badgesOfHonor: number
  magicTea: number
  energyLeaves: number

  // Magic Tea buff/debuff timestamps
  magicTeaBuffUntil: number   // +80% damage, +10% crit rate for 12h
  magicTeaDebuffUntil: number // -90% damage for 12h after buff expires
  lootChancePool: number

  // BOH combat farming state
  bohDamageAccumulator: number
  bohEarnedFromDamageToday: number
  bohLastDayReset: number
  bohDailyBonusClaimed: boolean

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
  lastFullRecoveryAt: number  // timestamp of last 12h full bar refill

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
  consumeMagicTea: () => boolean
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
  spendScrap: (amount: number) => boolean
  spendBitcoin: (amount: number) => boolean
  spendBadgesOfHonor: (amount: number) => boolean
  addResource: (key: string, amount: number, source: string) => void
  removeResource: (key: string, amount: number, source: string) => boolean
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

  /** Fetch the live player state from backend */
  fetchPlayer: () => Promise<void>
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
  supplyBoxes: 0,
  badgesOfHonor: 5,
  magicTea: 0,
  energyLeaves: 0,
  magicTeaBuffUntil: 0,
  magicTeaDebuffUntil: 0,
  lootChancePool: 0,

  bohDamageAccumulator: 0,
  bohEarnedFromDamageToday: 0,
  bohLastDayReset: 0,
  bohDailyBonusClaimed: false,

  level: 12,
  experience: 450,
  experienceToNext: 150, // Level 12 is in tier 11-20 → 150 XP needed
  skillPoints: 5,

  stamina: 120,
  maxStamina: 120,
  hunger: 6,
  maxHunger: 6,
  entrepreneurship: 120,
  maxEntrepreneurship: 120,
  work: 120,
  maxWork: 120,
  lastFullRecoveryAt: Date.now(),

  productionBar: 0,
  productionBarMax: 100,

  specialization: { military: 0, economic: 0 },
  damageDone: 0,
  itemsProduced: 0,
  equippedAmmo: 'none',
  heroBuffTicksLeft: 0,
  heroBuffBattleId: null,
  avatar: '/assets/avatars/avatar_male.png',

  setAvatar: (path) => {
    set({ avatar: path })
    import('../api/client').then(({ setAvatar }) => setAvatar(path).catch(() => {}))
  },
  equipAmmo: (type) => {
    set({ equippedAmmo: type })
    import('../api/client').then(({ equipAmmoApi }) => equipAmmoApi(type).catch(() => {}))
  },

  consumeFood: (type) => {
    if (!rateLimiter.check('consumeFood')) return false
    let consumed = false
    set((s) => {
      if (s[type] <= 0 || Math.floor(s.hunger) <= 0) return {}
      
      const staminaPct = type === 'wagyu' ? 0.45 : type === 'sushi' ? 0.30 : 0.15
      const staminaGain = Math.floor(s.maxStamina * staminaPct)
      consumed = true
      
      return {
        [type]: s[type] - 1,
        hunger: Math.max(0, s.hunger - 1),
        stamina: s.stamina + staminaGain
      }
    })
    if (consumed) {
      import('../api/client').then(({ eatFoodApi }) => eatFoodApi(type).catch(() => {}))
    }
    return consumed
  },

  consumeMagicTea: () => {
    if (!rateLimiter.check('consumeMagicTea')) return false
    const s = get()
    if (s.magicTea <= 0) return false
    // Can't stack — already have an active buff or debuff
    const now = Date.now()
    if (now < s.magicTeaBuffUntil || now < s.magicTeaDebuffUntil) return false
    const TWELVE_HOURS = 12 * 60 * 60 * 1000
    const buffUntil = now + TWELVE_HOURS
    const debuffUntil = buffUntil + TWELVE_HOURS
    set({
      magicTea: s.magicTea - 1,
      magicTeaBuffUntil: buffUntil,
      magicTeaDebuffUntil: debuffUntil,
    })
    return true
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
    totalDodge += milSkills.dodge * 3
    totalPrecision += milSkills.precision * 5

    // Specialization bonuses
    const specBonus = useSpecializationStore.getState().getMilitaryBonuses()
    totalDmg = Math.floor(totalDmg * (1 + specBonus.damagePercent / 100))
    totalCritRate += specBonus.critRatePercent

    // Hit Rate Check: base 50% + equipment + skills, soft-capped at 90%
    const rawHitRate = 50 + totalPrecision
    const totalHitRate = Math.min(90, rawHitRate)
    const overflowCrit = Math.max(0, rawHitRate - 90) * 0.5  // overflow → bonus crit
    const didHit = Math.random() * 100 < totalHitRate

    // Dodge Check & Stamina Cost Calculation
    const isDodged = Math.random() < (totalDodge / 100)

    if (!isDodged) {
      invStore.degradeEquippedItems(1) // Item durability damage
    }

    if (usedAmmo === 'red') {
      totalCritRate += 10
    }
    // Add overflow crit from hit rate
    totalCritRate += overflowCrit

    const isCrit = Math.random() < (totalCritRate / 100)
    let finalMultiplier = damageMultiplier
    
    if (isCrit) {
      finalMultiplier *= (1.5 + (totalCritDmg / 200))
    }

    let finalDamage = didHit ? Math.floor(totalDmg * finalMultiplier) : Math.floor(totalDmg * finalMultiplier * 0.66)
    // Armor % mitigation: armor / (armor + 100)
    const armorMitigation = totalArmor / (totalArmor + 100)
    finalDamage = Math.max(1, Math.floor(finalDamage * (1 - armorMitigation)))

    const xpGain = applyCatchUpXP(25, s.level, useWorldStore.getState().serverMedianLevel)
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
      stamina: Math.max(0, s.stamina - 10),
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

    // ── BOH Combat Farming ──
    // Reset daily counters at 00:00 UTC
    const todayUTC = Math.floor(Date.now() / 86400000)
    let bohToday = s.bohEarnedFromDamageToday
    let bohBonusClaimed = s.bohDailyBonusClaimed
    let bohBadges = s.badgesOfHonor
    if (todayUTC > s.bohLastDayReset) {
      bohToday = 0
      bohBonusClaimed = false
      ;(updates as any).bohLastDayReset = todayUTC
    }

    // Daily fighting bonus: 1 free 🎖️ on first damage of the day
    if (!bohBonusClaimed) {
      bohBadges += 1
      bohBonusClaimed = true
      if (_econFlowHook) _econFlowHook('daily_fight_bonus', 1, 'created', 'badgesOfHonor')
    }

    // Tiered threshold + diminishing returns
    const baseThreshold = s.level <= 10 ? 2000 : s.level <= 20 ? 5000 : 10000
    const diminish = Math.pow(2, Math.max(0, bohToday - 5))
    const effectiveThreshold = baseThreshold * diminish
    let bohAccum = s.bohDamageAccumulator + finalDamage
    let bohEarned = 0
    while (bohAccum >= effectiveThreshold && bohEarned < 3) {
      bohAccum -= effectiveThreshold
      bohEarned++
    }
    if (bohEarned > 0) {
      bohBadges += bohEarned
      bohToday += bohEarned
      if (_econFlowHook) _econFlowHook('damage_threshold', bohEarned, 'created', 'badgesOfHonor')
    }
    ;(updates as any).badgesOfHonor = bohBadges
    ;(updates as any).bohDamageAccumulator = bohAccum
    ;(updates as any).bohEarnedFromDamageToday = bohToday
    ;(updates as any).bohDailyBonusClaimed = bohBonusClaimed

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
    useAllianceStore.getState().contributeIdeologyXP(1)
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
    // Persist attack to backend (fire-and-forget)
    import('../api/client').then(({ attackApi }) => attackApi().catch(() => {}))
    return { damage: finalDamage, isCrit, isDodged }
  },

  buyResource: (resource, amount, cost) => {
    let bought = false
    set((s) => {
      if (s.money < cost) return {}
      bought = true
      return {
        money: s.money - cost,
        [resource]: (s as any)[resource] + amount,
      }
    })
    if (bought) {
      if (_econFlowHook) _econFlowHook('market_buy', cost, 'destroyed', 'money')
      if (_econFlowHook) _econFlowHook('market_buy', amount, 'created', resource)
    }
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
    if (success) {
      if (_econFlowHook) _econFlowHook('shop_buy', cost, 'destroyed', 'money')
      if (_econFlowHook) _econFlowHook('shop_buy', amount, 'created', itemKey as string)
    }
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
    if (success) {
      if (_econFlowHook) _econFlowHook('shop_sell', price, 'created', 'money')
      if (_econFlowHook) _econFlowHook('shop_sell', amount, 'destroyed', itemKey as string)
    }
    return success
  },

  earnMoney: (amount) => {
    if (!validateEarn(amount, 'earnMoney')) return
    const allianceBonus = getIdeologyBonus(useAllianceStore.getState().getPlayerAlliance())
    const activeIdeology = useAllianceStore.getState().getPlayerAlliance()?.activeIdeology
    const finalAmount = activeIdeology === 'syndicate' ? Math.floor(amount * allianceBonus) : amount
    set((s) => ({ money: s.money + finalAmount }))
    // Track in economy ledger
    if (_econFlowHook) _econFlowHook('player_earn', finalAmount, 'created', 'money')
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
      const medianLevel = useWorldStore.getState().serverMedianLevel
      const boosted = applyCatchUpXP(amount, s.level, medianLevel)
      let newXP = s.experience + boosted
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
      if (Math.floor(s.work) < 10) return {}
      const productionLevel = useSkillsStore.getState().economic.production
      const activeIdeology = useAllianceStore.getState().getPlayerAlliance()?.activeIdeology
      const syndicateBonus = activeIdeology === 'syndicate' ? getIdeologyBonus(useAllianceStore.getState().getPlayerAlliance()) : 1
      const fill = (20 + productionLevel * 2) * syndicateBonus
      // Prospection: chance to find bonus scrap
      const prospectionLevel = useSkillsStore.getState().economic.prospection
      const prospectChance = prospectionLevel * 0.03  // 3% per level, up to 30%
      const foundScrap = Math.random() < prospectChance
      const bonusScrap = foundScrap ? (5 + prospectionLevel * 2) : 0
      return {
        work: Math.max(0, s.work - 10),
        productionBar: Math.min(s.productionBarMax, s.productionBar + fill),
        scrap: s.scrap + bonusScrap,
      }
    })
    useSpecializationStore.getState().recordWork()
    useAllianceStore.getState().contributeIdeologyXP(1)
  },

  doEntrepreneurship: () => {
    set((s) => {
      if (Math.floor(s.entrepreneurship) < 10) return {}
      const productionLevel = useSkillsStore.getState().economic.production
      const activeIdeology = useAllianceStore.getState().getPlayerAlliance()?.activeIdeology
      const syndicateBonus = activeIdeology === 'syndicate' ? getIdeologyBonus(useAllianceStore.getState().getPlayerAlliance()) : 1
      const fill = (25 + productionLevel * 2) * syndicateBonus
      return {
        entrepreneurship: Math.max(0, s.entrepreneurship - 10),
        productionBar: Math.min(s.productionBarMax, s.productionBar + fill),
      }
    })
    useSpecializationStore.getState().recordWork()
    useAllianceStore.getState().contributeIdeologyXP(1)
  },

  produce: (industrialistLevel: number) =>
    set((s) => {
      if (s.productionBar < s.productionBarMax) return {}
      const chance = industrialistLevel * 0.02
      const foundBitcoin = Math.random() < chance
      // Industrialist scrap: 1% per PP consumed per level → roll per level
      const scrapChance = industrialistLevel * 0.01  // 1% per level, max 10%
      const bonusScrap = Math.random() < scrapChance ? (100 + industrialistLevel * 50) : 0
      const medianLevel = useWorldStore.getState().serverMedianLevel
      const xpGain = applyCatchUpXP(30, s.level, medianLevel)
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
      useAllianceStore.getState().contributeIdeologyXP(1)
      if (bonusScrap > 0 && _econFlowHook) _econFlowHook('produce_scrap', bonusScrap, 'created', 'scrap')
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
        scrap: s.scrap + bonusScrap,
        experience: newXP,
        level: newLevel,
        skillPoints: newSP,
        experienceToNext: nextXP,
      }
    }),

  addScrap: (amount) => {
    set((s) => ({ scrap: s.scrap + amount }))
    if (_econFlowHook) _econFlowHook('scrap_gain', amount, 'created', 'scrap')
  },

  spendMoney: (amount) => {
    if (!validateSpend(amount, 'spendMoney')) return false
    const s = get()
    if (s.money < amount) return false
    set({ money: s.money - amount })
    // Track in economy ledger
    if (_econFlowHook) _econFlowHook('player_spend', amount, 'destroyed', 'money')
    return true
  },

  spendMaterialX: (amount) => {
    const s = get()
    if (s.materialX < amount) return false
    set({ materialX: s.materialX - amount })
    if (_econFlowHook) _econFlowHook('player_spend', amount, 'destroyed', 'materialX')
    return true
  },

  spendOil: (amount) => {
    const s = get()
    if (s.oil < amount) return false
    set({ oil: s.oil - amount })
    if (_econFlowHook) _econFlowHook('player_spend', amount, 'destroyed', 'oil')
    return true
  },

  spendScrap: (amount) => {
    const s = get()
    if (s.scrap < amount) return false
    set({ scrap: s.scrap - amount })
    if (_econFlowHook) _econFlowHook('player_spend', amount, 'destroyed', 'scrap')
    return true
  },

  spendBitcoin: (amount) => {
    const s = get()
    if (s.bitcoin < amount) return false
    set({ bitcoin: s.bitcoin - amount })
    if (_econFlowHook) _econFlowHook('player_spend', amount, 'destroyed', 'bitcoin')
    return true
  },

  spendBadgesOfHonor: (amount) => {
    const s = get()
    if (s.badgesOfHonor < amount) return false
    set({ badgesOfHonor: s.badgesOfHonor - amount })
    if (_econFlowHook) _econFlowHook('player_spend', amount, 'destroyed', 'badgesOfHonor')
    return true
  },

  addResource: (key, amount, source) => {
    if (amount <= 0) return
    set((s) => ({ [key]: ((s as any)[key] || 0) + amount } as any))
    if (_econFlowHook) _econFlowHook(source, amount, 'created', key)
  },

  removeResource: (key, amount, source) => {
    if (amount <= 0) return false
    const s = get()
    const current = (s as any)[key] || 0
    if (current < amount) return false
    set({ [key]: current - amount } as any)
    if (_econFlowHook) _econFlowHook(source, amount, 'destroyed', key)
    return true
  },

  regenerateBars: () => set((state) => {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
    const now = Date.now()

    // Full refill every 12 hours
    if (now - state.lastFullRecoveryAt >= TWELVE_HOURS_MS) {
      return {
        stamina: state.maxStamina,
        hunger: state.maxHunger,
        entrepreneurship: state.maxEntrepreneurship,
        work: state.maxWork,
        lastFullRecoveryAt: now,
      }
    }

    // Normal tick regen (~4.17% per 30min economy tick → fills in 12h = 24 ticks)
    const p = 1 / 24
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

  fetchPlayer: async () => {
    try {
      const { api } = await import('../api/client')
      const res = await api.get<Partial<PlayerState>>('/player')
      if (res && res.name) {
        set(res)
      }
    } catch (err) {
      console.error('Failed to fetch player state:', err)
    }
  },
}))
