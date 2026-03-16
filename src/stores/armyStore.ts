import { create } from 'zustand'
import { usePlayerStore, getMilitaryRank } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useInventoryStore, type EquipItem } from './inventoryStore'

// ====== DIVISION TYPES ======

export type DivisionType = 'infantry' | 'mechanic'

export type DivisionCategory = 'land'

// ====== DIVISION TEMPLATE (multipliers applied to player stats) ======

export interface DivisionTemplate {
  id: DivisionType
  name: string
  icon: string
  category: DivisionCategory
  description: string
  // Offensive multipliers (applied to player stats)
  atkDmgMult: number       // × player attackDamage
  hitRate: number           // flat hit rate (0-1)
  critRateMult: number     // × player critRate
  critDmgMult: number      // × player critMultiplier
  // Defensive multipliers (applied to player stats)
  healthMult: number       // × player health per unit of manpower
  dodgeMult: number        // × player dodgeChance
  armorMult: number        // × player armorBlock
  // Costs
  manpowerCost: number
  recruitCost: {
    money: number
    oil: number
    materialX: number
    scrap: number
  }
  trainingTime: number
}

export const DIVISION_TEMPLATES: Record<DivisionType, DivisionTemplate> = {
  infantry: {
    id: 'infantry', name: 'Infantry Division', icon: '🚶', category: 'land',
    description: 'Backbone of any army. Cheap, solid defense. Uses player stats at reduced multipliers.',
    atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 0.80,
    healthMult: 1.20, dodgeMult: 0.90, armorMult: 1.00,
    manpowerCost: 300, trainingTime: 30,
    recruitCost: { money: 50000, oil: 500, materialX: 200, scrap: 300 },
  },
  mechanic: {
    id: 'mechanic', name: 'Mechanized Division', icon: '🚛', category: 'land',
    description: 'Motorized troops. Higher damage, better survivability. Costs more resources.',
    atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 0.90,
    healthMult: 1.50, dodgeMult: 1.10, armorMult: 1.50,
    manpowerCost: 200, trainingTime: 45,
    recruitCost: { money: 120000, oil: 2000, materialX: 800, scrap: 500 },
  },
}

// ====== DIVISION INSTANCE ======

export interface Division {
  id: string
  type: DivisionType
  name: string
  category: DivisionCategory
  ownerId: string        // Player name
  countryCode: string    // Which country's army

  // Health pool: manpower × template.healthMult × playerHealth
  manpower: number       // Current manpower (acts as HP units)
  maxManpower: number    // Max manpower
  morale: number         // 0-100, drops in combat, recovers over time

  equipment: string[]    // Item IDs from player inventory
  experience: number     // 0-100, gained through combat

  status: 'training' | 'ready' | 'in_combat' | 'retreating' | 'recovering' | 'destroyed'
  trainingProgress: number

  // Combat tracking
  killCount: number
  battlesSurvived: number
}

// ====== ARMY GROUP ======

export type MilitaryRankType = 'private' | 'corporal' | 'sergeant' | 'lieutenant' | 'captain' | 'colonel' | 'general'

export interface ArmyMember {
  playerId: string
  role: MilitaryRankType
  joinedAt: number
  contributedPower: number
}

export interface ArmyVault {
  ammo: number
  jets: number
  tanks: number
  oil: number
  money: number
  equipmentIds: string[]
}

export interface ArmyContribution {
  playerId: string
  totalMoneyDonated: number
  totalEquipmentDonated: number
  sponsoredSquadrons: string[]  // Division IDs bought by this eco player
}

export interface ArmyBuff {
  id: string
  name: string
  stat: 'attack' | 'defense' | 'speed' | 'organization'
  percentage: number
  expiresAt: number
  purchasedBy: string
}

export interface BattleOrder {
  id: string
  armyId: string
  orderType: 'attack_region' | 'defend_region' | 'gather_resources' | 'train'
  targetRegion?: string
  issuedBy: string
  issuedAt: number
  expiresAt: number
  damageMultiplier: number   // e.g. 1.2 = +20% damage while following order
  bountyPool: number         // Total money in the bounty
  claimedBy: { playerId: string; damageContribution: number }[]
}

export interface Army {
  id: string
  name: string
  commanderId: string
  countryCode: string
  divisionIds: string[]
  members: ArmyMember[]
  maxSquadSize: number
  vault: ArmyVault
  contributions: ArmyContribution[]
  activeBuffs: ArmyBuff[]
  activeOrders: BattleOrder[]
  deployedToBattleId: string | null  // Active battle this army is deployed to
  deployedProvince: string
  status: 'idle' | 'attacking' | 'defending' | 'moving' | 'regrouping'

  totalManpower: number
  totalAttack: number
  totalDefense: number
}

// ====== STORE ======

export interface ArmyState {
  divisions: Record<string, Division>
  armies: Record<string, Army>

  // Recruitment
  recruitDivision: (type: DivisionType, armyId?: string) => { success: boolean; message: string; divisionId?: string }
  trainDivision: (divisionId: string) => void
  processTrainingTick: () => void // Called each second

  // Equipment
  equipItemToDivision: (divisionId: string, itemId: string) => boolean
  unequipItemFromDivision: (divisionId: string, itemId: string) => boolean
  recalculateDivisionStats: (divisionId: string) => void

  // Army management
  createArmy: (name: string, province: string) => string
  assignDivisionToArmy: (divisionId: string, armyId: string) => boolean
  removeDivisionFromArmy: (divisionId: string) => boolean
  disbandDivision: (divisionId: string) => void
  recalculateArmyTotals: (armyId: string) => void

  // Combat effects
  applyBattleDamage: (divisionId: string, manpowerLoss: number, orgLoss: number, moraleLoss: number, equipDamage: number) => void
  recoverDivision: (divisionId: string) => void

  // Queries
  getDivisionsForCountry: (countryCode: string) => Division[]
  getDivisionsForArmy: (armyId: string) => Division[]
  getArmiesForCountry: (countryCode: string) => Army[]
  getReadyDivisions: (countryCode: string) => Division[]

  // Enlistment
  enlistInArmy: (armyId: string) => { success: boolean; message: string }
  leaveArmy: () => { success: boolean; message: string }
  promoteMember: (armyId: string, playerId: string, newRole: MilitaryRankType) => { success: boolean; message: string }
  getArmyMembers: (armyId: string) => ArmyMember[]

  // Vault & Contributions
  donateToVault: (armyId: string, resource: keyof ArmyVault, amount: number) => { success: boolean; message: string }
  sponsorDivision: (armyId: string, divisionType: DivisionType, targetPlayer: string) => { success: boolean; message: string }
  buyArmyBuff: (armyId: string, stat: ArmyBuff['stat'], percentage: number, durationMs: number, cost: number) => { success: boolean; message: string }

  // Deployment & Aura
  deployArmyToBattle: (armyId: string, battleId: string) => { success: boolean; message: string }
  deployToRegion: (armyId: string, regionCode: string) => { success: boolean; message: string }
  recallArmy: (armyId: string) => { success: boolean; message: string }
  getArmyAV: (armyId: string) => { air: number; ground: number; tanks: number; navy: number; total: number }
  getCompositionAura: (armyId: string) => { critDmgPct: number; dodgePct: number; attackPct: number; precisionPct: number }

  // Battle Orders
  issueOrder: (armyId: string, orderType: BattleOrder['orderType'], targetRegion: string, bountyPool: number, durationMs: number, damageMultiplier: number) => { success: boolean; message: string }
  recordDamageContribution: (armyId: string, orderId: string, playerId: string, damage: number) => void
}

let divCounter = 0
let armyCounter = 0

// ====== INITIAL MOCK DIVISIONS & ARMIES ======

function createInitialDivisions(): Record<string, Division> {
  const divs: Record<string, Division> = {}

  // US Army — 4 infantry, 2 mechanic
  const usDivs: { type: DivisionType; name: string }[] = [
    { type: 'infantry', name: '1st Infantry "Big Red One"' },
    { type: 'infantry', name: '82nd Airborne' },
    { type: 'infantry', name: '101st Airborne' },
    { type: 'infantry', name: '10th Mountain' },
    { type: 'mechanic', name: '1st Armored Brigade' },
    { type: 'mechanic', name: '3rd Mechanized Brigade' },
  ]

  usDivs.forEach((d, i) => {
    const id = `div_us_${i}`
    const t = DIVISION_TEMPLATES[d.type]
    divs[id] = {
      id, type: d.type, name: d.name,
      category: t.category, ownerId: usePlayerStore.getState().name || 'Commander', countryCode: 'US',
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      morale: 80 + i * 3, equipment: [], experience: 20 + i * 5,
      status: 'ready', trainingProgress: t.trainingTime,
      killCount: 0, battlesSurvived: 0,
    }
  })

  // RU Army — 3 infantry, 1 mechanic
  const ruDivs: { type: DivisionType; name: string }[] = [
    { type: 'infantry', name: '4th Guards Division' },
    { type: 'infantry', name: '20th Guards Army' },
    { type: 'infantry', name: '150th Motor Rifle Division' },
    { type: 'mechanic', name: 'T-90 Heavy Armor' },
  ]

  ruDivs.forEach((d, i) => {
    const id = `div_ru_${i}`
    const t = DIVISION_TEMPLATES[d.type]
    divs[id] = {
      id, type: d.type, name: d.name,
      category: t.category, ownerId: 'AI_Commander_Putin', countryCode: 'RU',
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      morale: 75, equipment: [], experience: 30,
      status: 'ready', trainingProgress: t.trainingTime,
      killCount: 0, battlesSurvived: 0,
    }
  })

  // CN Army — 3 infantry, 2 mechanic
  const cnDivs: { type: DivisionType; name: string }[] = [
    { type: 'infantry', name: 'PLA 1st Group Army' },
    { type: 'infantry', name: 'PLA 2nd Group Army' },
    { type: 'infantry', name: 'PLA 3rd Group Army' },
    { type: 'mechanic', name: 'Type 99A Battalion' },
    { type: 'mechanic', name: 'ZBD-04 IFV Brigade' },
  ]

  cnDivs.forEach((d, i) => {
    const id = `div_cn_${i}`
    const t = DIVISION_TEMPLATES[d.type]
    divs[id] = {
      id, type: d.type, name: d.name,
      category: t.category, ownerId: 'AI_Commander_Xi', countryCode: 'CN',
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      morale: 78, equipment: [], experience: 25,
      status: 'ready', trainingProgress: t.trainingTime,
      killCount: 0, battlesSurvived: 0,
    }
  })

  divCounter = Object.keys(divs).length
  return divs
}

function createInitialArmies(divisions: Record<string, Division>): Record<string, Army> {
  const armies: Record<string, Army> = {}

  // US Army Group
  const usDivIds = Object.keys(divisions).filter(k => k.startsWith('div_us_'))
  const playerName = usePlayerStore.getState().name || 'Commander'
  armies['army_us_1'] = {
    id: 'army_us_1', name: 'US Army Group Alpha',
    commanderId: playerName, countryCode: 'US',
    divisionIds: usDivIds, deployedProvince: 'US',
    members: [{ playerId: playerName, role: 'general' as MilitaryRankType, joinedAt: Date.now(), contributedPower: 0 }],
    maxSquadSize: 12,
    vault: { ammo: 0, jets: 0, tanks: 0, oil: 0, money: 0, equipmentIds: [] },
    contributions: [], activeBuffs: [], activeOrders: [],
    deployedToBattleId: null,
    status: 'idle',
    totalManpower: usDivIds.reduce((s, id) => s + divisions[id].manpower, 0),
    totalAttack: usDivIds.length * 100,
    totalDefense: usDivIds.length * 100,
  }

  // RU Army Group
  const ruDivIds = Object.keys(divisions).filter(k => k.startsWith('div_ru_'))
  armies['army_ru_1'] = {
    id: 'army_ru_1', name: 'Russian Western Front',
    commanderId: 'AI_Commander_Putin', countryCode: 'RU',
    divisionIds: ruDivIds, deployedProvince: 'RU',
    members: [{ playerId: 'AI_Commander_Putin', role: 'general' as MilitaryRankType, joinedAt: Date.now(), contributedPower: 0 }],
    maxSquadSize: 12,
    vault: { ammo: 500, jets: 2, tanks: 3, oil: 5000, money: 100000, equipmentIds: [] },
    contributions: [], activeBuffs: [], activeOrders: [],
    deployedToBattleId: null,
    status: 'idle',
    totalManpower: ruDivIds.reduce((s, id) => s + divisions[id].manpower, 0),
    totalAttack: ruDivIds.length * 100,
    totalDefense: ruDivIds.length * 100,
  }

  // CN Army Group
  const cnDivIds = Object.keys(divisions).filter(k => k.startsWith('div_cn_'))
  armies['army_cn_1'] = {
    id: 'army_cn_1', name: 'PLA Northern Command',
    commanderId: 'AI_Commander_Xi', countryCode: 'CN',
    divisionIds: cnDivIds, deployedProvince: 'CN',
    members: [{ playerId: 'AI_Commander_Xi', role: 'general' as MilitaryRankType, joinedAt: Date.now(), contributedPower: 0 }],
    maxSquadSize: 12,
    vault: { ammo: 600, jets: 3, tanks: 5, oil: 8000, money: 200000, equipmentIds: [] },
    contributions: [], activeBuffs: [], activeOrders: [],
    deployedToBattleId: null,
    status: 'idle',
    totalManpower: cnDivIds.reduce((s, id) => s + divisions[id].manpower, 0),
    totalAttack: cnDivIds.length * 100,
    totalDefense: cnDivIds.length * 100,
  }

  armyCounter = Object.keys(armies).length
  return armies
}

const initialDivisions = createInitialDivisions()
const initialArmies = createInitialArmies(initialDivisions)

export const useArmyStore = create<ArmyState>((set, get) => ({
  divisions: initialDivisions,
  armies: initialArmies,

  recruitDivision: (type, armyId) => {
    const template = DIVISION_TEMPLATES[type]
    const player = usePlayerStore.getState()
    const cost = template.recruitCost

    // Check resources
    if (player.money < cost.money) return { success: false, message: 'Not enough money.' }
    if (player.oil < cost.oil) return { success: false, message: 'Not enough oil.' }
    if (player.materialX < cost.materialX) return { success: false, message: 'Not enough Material X.' }
    if (player.scrap < cost.scrap) return { success: false, message: 'Not enough scrap.' }

    // Deduct costs
    player.spendMoney(cost.money)
    player.spendOil(cost.oil)
    player.spendMaterialX(cost.materialX)
    player.spendScraps(cost.scrap)

    const id = `div_${++divCounter}_${Date.now()}`
    const division: Division = {
      id,
      type,
      name: `${template.name} #${divCounter}`,
      category: template.category,
      ownerId: player.name,
      countryCode: player.countryCode || 'US',
      manpower: template.manpowerCost,
      maxManpower: template.manpowerCost,
      morale: 50,
      equipment: [],
      experience: 0,
      status: 'training',
      trainingProgress: 0,
      killCount: 0,
      battlesSurvived: 0,
    }

    set(state => ({
      divisions: { ...state.divisions, [id]: division },
    }))

    // If armyId provided, assign immediately
    if (armyId) {
      get().assignDivisionToArmy(id, armyId)
    }

    return { success: true, message: `${template.name} is now training!`, divisionId: id }
  },

  trainDivision: (divisionId) => {
    // Manually advance training by 1 tick
    set(state => {
      const div = state.divisions[divisionId]
      if (!div || div.status !== 'training') return state

      const template = DIVISION_TEMPLATES[div.type]
      const newProgress = div.trainingProgress + 1
      const isComplete = newProgress >= template.trainingTime

      return {
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            trainingProgress: newProgress,
            status: isComplete ? 'ready' : 'training',
            morale: isComplete ? 70 : div.morale,
          },
        },
      }
    })
  },

  equipItemToDivision: (divisionId, itemId) => {
    const state = get()
    const div = state.divisions[divisionId]
    if (!div) return false
    if (div.equipment.length >= 3) return false // Max 3 equipment slots
    if (div.equipment.includes(itemId)) return false

    set(s => ({
      divisions: {
        ...s.divisions,
        [divisionId]: {
          ...div,
          equipment: [...div.equipment, itemId],
        },
      },
    }))
    return true
  },

  unequipItemFromDivision: (divisionId, itemId) => {
    const state = get()
    const div = state.divisions[divisionId]
    if (!div || !div.equipment.includes(itemId)) return false

    set(s => ({
      divisions: {
        ...s.divisions,
        [divisionId]: {
          ...div,
          equipment: div.equipment.filter(e => e !== itemId),
        },
      },
    }))

    return true
  },

  recalculateDivisionStats: (_divisionId) => {
    // No-op: division stats are now computed at combat time from player stats × template multipliers
  },

  createArmy: (name, province) => {
    const player = usePlayerStore.getState()
    const id = `army_${++armyCounter}_${Date.now()}`

    set(state => ({
      armies: {
        ...state.armies,
        [id]: {
          id, name,
          commanderId: player.name,
          countryCode: player.countryCode || 'US',
          divisionIds: [],
          members: [{ playerId: player.name, role: getMilitaryRank(player.level).rank, joinedAt: Date.now(), contributedPower: 0 }],
          maxSquadSize: 12,
          vault: { ammo: 0, jets: 0, tanks: 0, oil: 0, money: 0, equipmentIds: [] },
          contributions: [], activeBuffs: [], activeOrders: [],
          deployedToBattleId: null,
          deployedProvince: province,
          status: 'idle',
          totalManpower: 0,
          totalAttack: 0,
          totalDefense: 0,
        },
      },
    }))

    return id
  },

  assignDivisionToArmy: (divisionId, armyId) => {
    const state = get()
    const div = state.divisions[divisionId]
    const army = state.armies[armyId]
    if (!div || !army) return false

    // Remove from any current army
    get().removeDivisionFromArmy(divisionId)

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          divisionIds: [...army.divisionIds, divisionId],
        },
      },
    }))

    get().recalculateArmyTotals(armyId)
    return true
  },

  removeDivisionFromArmy: (divisionId) => {
    const state = get()
    let removedFrom: string | null = null

    Object.values(state.armies).forEach(army => {
      if (army.divisionIds.includes(divisionId)) {
        removedFrom = army.id
      }
    })

    if (!removedFrom) return false

    set(s => ({
      armies: {
        ...s.armies,
        [removedFrom!]: {
          ...s.armies[removedFrom!],
          divisionIds: s.armies[removedFrom!].divisionIds.filter(id => id !== divisionId),
        },
      },
    }))

    get().recalculateArmyTotals(removedFrom!)
    return true
  },

  disbandDivision: (divisionId) => {
    get().removeDivisionFromArmy(divisionId)

    set(state => {
      const newDivisions = { ...state.divisions }
      delete newDivisions[divisionId]
      return { divisions: newDivisions }
    })
  },

  recalculateArmyTotals: (armyId) => {
    set(state => {
      const army = state.armies[armyId]
      if (!army) return state

      let totalManpower = 0
      let totalAttack = 0
      let totalDefense = 0

      army.divisionIds.forEach(id => {
        const div = state.divisions[id]
        if (div) {
          totalManpower += div.manpower
          totalAttack += div.manpower  // Simplified: manpower = power proxy
          totalDefense += div.manpower
        }
      })

      return {
        armies: {
          ...state.armies,
          [armyId]: { ...army, totalManpower, totalAttack, totalDefense },
        },
      }
    })
  },

  applyBattleDamage: (divisionId, manpowerLoss, _orgLoss, moraleLoss, equipDamage) => {
    set(state => {
      const div = state.divisions[divisionId]
      if (!div) return state

      const newManpower = Math.max(0, div.manpower - manpowerLoss)
      const newMorale = Math.max(0, div.morale - moraleLoss)

      // Degrade equipment
      if (equipDamage > 0 && div.equipment.length > 0) {
        const invStore = useInventoryStore.getState()
        invStore.degradeEquippedItems(equipDamage)
      }

      const isDestroyed = newManpower <= 0
      const isRetreating = newMorale <= 10 && !isDestroyed

      return {
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            manpower: newManpower,
            morale: newMorale,
            status: isDestroyed ? 'destroyed' : isRetreating ? 'retreating' : div.status,
          },
        },
      }
    })
  },

  recoverDivision: (divisionId) => {
    set(state => {
      const div = state.divisions[divisionId]
      if (!div || div.status === 'destroyed') return state

      return {
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            morale: 100,
            status: 'ready',
          },
        },
      }
    })
  },

  // ====== ARMY TICK (called every combat tick — 15s) ======
  processTrainingTick: () => {
    set(state => {
      const newDivisions = { ...state.divisions }
      let hasChanges = false

      Object.values(newDivisions).forEach(div => {
        let updated = { ...div }
        let changed = false

        // --- Training: progress toward 'ready' ---
        if (div.status === 'training') {
          const template = DIVISION_TEMPLATES[div.type]
          const newProgress = div.trainingProgress + 1
          if (newProgress >= (template?.trainingTime || 30)) {
            updated = { ...updated, trainingProgress: newProgress, status: 'ready', morale: 100 }
          } else {
            updated = { ...updated, trainingProgress: newProgress }
          }
          changed = true
        }

        // --- Retreating: cool down for 3 ticks, then transition to 'recovering' ---
        if (div.status === 'retreating') {
          // Reuse trainingProgress as retreat tick counter
          const retreatTicks = (div.trainingProgress || 0) + 1
          if (retreatTicks >= 3) {
            updated = { ...updated, status: 'recovering', trainingProgress: 0 }
          } else {
            updated = { ...updated, trainingProgress: retreatTicks }
          }
          changed = true
        }

        // --- Recovering: +10 morale/tick, become 'ready' at morale >= 50 ---
        if (div.status === 'recovering') {
          const newMorale = Math.min(100, div.morale + 10)
          if (newMorale >= 50) {
            updated = { ...updated, morale: newMorale, status: 'ready' }
          } else {
            updated = { ...updated, morale: newMorale }
          }
          changed = true
        }

        // --- Ready: passive morale recovery +5/tick up to 100 ---
        if (div.status === 'ready' && div.morale < 100) {
          updated = { ...updated, morale: Math.min(100, div.morale + 5) }
          changed = true
        }

        if (changed) {
          newDivisions[div.id] = updated
          hasChanges = true
        }
      })

      return hasChanges ? { divisions: newDivisions } : state
    })
  },

  getDivisionsForCountry: (countryCode) => {
    return Object.values(get().divisions).filter(d => d.countryCode === countryCode)
  },

  getDivisionsForArmy: (armyId) => {
    const army = get().armies[armyId]
    if (!army) return []
    return army.divisionIds.map(id => get().divisions[id]).filter(Boolean)
  },

  getArmiesForCountry: (countryCode) => {
    return Object.values(get().armies).filter(a => a.countryCode === countryCode)
  },

  getReadyDivisions: (countryCode) => {
    return Object.values(get().divisions).filter(
      d => d.countryCode === countryCode && d.status === 'ready'
    )
  },

  // ====== ENLISTMENT ======

  enlistInArmy: (armyId) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }
    if (army.countryCode !== (player.countryCode || 'US')) return { success: false, message: 'You can only join armies from your country.' }

    // Check if already enlisted anywhere
    const alreadyIn = Object.values(state.armies).find(a => a.members.some(m => m.playerId === player.name))
    if (alreadyIn) return { success: false, message: `Already enlisted in ${alreadyIn.name}. Leave first.` }

    const rank = getMilitaryRank(player.level)
    const newMember: ArmyMember = {
      playerId: player.name,
      role: rank.rank,
      joinedAt: Date.now(),
      contributedPower: 0,
    }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          members: [...army.members, newMember],
        },
      },
    }))

    usePlayerStore.setState({ enlistedArmyId: armyId })
    return { success: true, message: `Enlisted in ${army.name} as ${rank.label}!` }
  },

  leaveArmy: () => {
    const player = usePlayerStore.getState()
    const state = get()
    const currentArmy = Object.values(state.armies).find(a => a.members.some(m => m.playerId === player.name))
    if (!currentArmy) return { success: false, message: 'Not enlisted in any army.' }

    // Commanders can't leave their own army
    if (currentArmy.commanderId === player.name) return { success: false, message: 'Commanders cannot leave. Disband or transfer command first.' }

    set(s => ({
      armies: {
        ...s.armies,
        [currentArmy.id]: {
          ...currentArmy,
          members: currentArmy.members.filter(m => m.playerId !== player.name),
        },
      },
    }))

    usePlayerStore.setState({ enlistedArmyId: null })
    return { success: true, message: `Left ${currentArmy.name}.` }
  },

  promoteMember: (armyId, playerId, newRole) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    // Only colonels+ can promote
    const promoter = army.members.find(m => m.playerId === player.name)
    if (!promoter) return { success: false, message: 'You are not in this army.' }
    const promoterRankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(promoter.role)
    if (promoterRankIdx < 5) return { success: false, message: 'Only Colonels and Generals can promote.' }

    const target = army.members.find(m => m.playerId === playerId)
    if (!target) return { success: false, message: 'Player not found in army.' }

    // Can't promote above your own rank
    const newRoleIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(newRole)
    if (newRoleIdx >= promoterRankIdx) return { success: false, message: 'Cannot promote to your rank or higher.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          members: army.members.map(m =>
            m.playerId === playerId ? { ...m, role: newRole } : m
          ),
        },
      },
    }))

    return { success: true, message: `${playerId} promoted to ${newRole}.` }
  },

  getArmyMembers: (armyId) => {
    const army = get().armies[armyId]
    return army ? army.members : []
  },

  // ====== VAULT & CONTRIBUTIONS ======

  donateToVault: (armyId, resource, amount) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    // Must be a member
    if (!army.members.some(m => m.playerId === player.name)) {
      return { success: false, message: 'You must be enlisted to donate.' }
    }

    // Check player has enough (only money and oil for now)
    if (resource === 'money' && player.money < amount) return { success: false, message: 'Not enough money.' }
    if (resource === 'oil' && player.oil < amount) return { success: false, message: 'Not enough oil.' }

    // Deduct from player
    if (resource === 'money') usePlayerStore.getState().spendMoney(amount)
    else if (resource === 'oil') usePlayerStore.getState().spendOil(amount)

    // Add to vault
    const newVault = { ...army.vault }
    if (resource in newVault && resource !== 'equipmentIds') {
      ;(newVault as any)[resource] += amount
    }

    // Track contribution
    const contributions = [...army.contributions]
    const existing = contributions.find(c => c.playerId === player.name)
    if (existing) {
      existing.totalMoneyDonated += resource === 'money' ? amount : 0
    } else {
      contributions.push({
        playerId: player.name,
        totalMoneyDonated: resource === 'money' ? amount : 0,
        totalEquipmentDonated: 0,
        sponsoredSquadrons: [],
      })
    }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, vault: newVault, contributions },
      },
    }))

    return { success: true, message: `Donated ${amount} ${resource} to ${army.name} vault!` }
  },

  sponsorDivision: (armyId, divisionType, targetPlayer) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    const template = DIVISION_TEMPLATES[divisionType]
    const cost = template.recruitCost

    // Eco player pays the cost
    if (player.money < cost.money) return { success: false, message: 'Not enough money.' }
    if (player.oil < cost.oil) return { success: false, message: 'Not enough oil.' }
    if (player.materialX < cost.materialX) return { success: false, message: 'Not enough Material X.' }
    if (player.scrap < cost.scrap) return { success: false, message: 'Not enough scrap.' }

    player.spendMoney(cost.money)
    player.spendOil(cost.oil)
    player.spendMaterialX(cost.materialX)
    player.spendScraps(cost.scrap)

    // Create division owned by target player
    const id = `div_${++divCounter}_${Date.now()}`
    const division: Division = {
      id, type: divisionType, name: `${template.name} (Sponsored)`,
      category: template.category,
      ownerId: targetPlayer,
      countryCode: army.countryCode,
      manpower: template.manpowerCost, maxManpower: template.manpowerCost,
      morale: 50, equipment: [], experience: 0,
      status: 'training', trainingProgress: 0,
      killCount: 0, battlesSurvived: 0,
    }

    // Track sponsor
    const contributions = [...army.contributions]
    const existing = contributions.find(c => c.playerId === player.name)
    if (existing) {
      existing.sponsoredSquadrons.push(id)
    } else {
      contributions.push({
        playerId: player.name,
        totalMoneyDonated: 0,
        totalEquipmentDonated: 0,
        sponsoredSquadrons: [id],
      })
    }

    set(s => ({
      divisions: { ...s.divisions, [id]: division },
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          divisionIds: [...army.divisionIds, id],
          contributions,
        },
      },
    }))

    return { success: true, message: `Sponsored a ${template.name} for ${targetPlayer}!` }
  },

  buyArmyBuff: (armyId, stat, percentage, durationMs, cost) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    // Captain+ can buy buffs
    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 4) return { success: false, message: 'Only Captains+ can buy army buffs.' }

    if (player.money < cost) return { success: false, message: 'Not enough money.' }
    player.spendMoney(cost)

    const buff: ArmyBuff = {
      id: `buff_${Date.now()}`,
      name: `+${percentage}% ${stat.toUpperCase()}`,
      stat, percentage,
      expiresAt: Date.now() + durationMs,
      purchasedBy: player.name,
    }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          activeBuffs: [...army.activeBuffs, buff],
        },
      },
    }))

    return { success: true, message: `Purchased ${buff.name} buff for ${army.name}!` }
  },

  // ====== DEPLOYMENT & AURA ======

  deployArmyToBattle: (armyId, battleId) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    // Lieutenant+ can deploy
    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 3) return { success: false, message: 'Only Lieutenants+ can deploy armies.' }

    if (army.deployedToBattleId) return { success: false, message: `Already deployed to battle ${army.deployedToBattleId}. Recall first.` }
    if (army.divisionIds.length === 0) return { success: false, message: 'No divisions to deploy.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, deployedToBattleId: battleId, status: 'attacking' as const },
      },
    }))

    return { success: true, message: `${army.name} deployed to battle!` }
  },

  recallArmy: (armyId) => {
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }
    if (!army.deployedToBattleId) return { success: false, message: 'Army is not deployed.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, deployedToBattleId: null, status: 'idle' as const },
      },
    }))

    return { success: true, message: `${army.name} recalled.` }
  },

  deployToRegion: (armyId, regionCode) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    // Lieutenant+ can deploy
    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 3) return { success: false, message: 'Only Lieutenants+ can deploy armies.' }

    if (army.deployedToBattleId) return { success: false, message: 'Army is in battle. Recall from battle first.' }
    if (army.divisionIds.length === 0) return { success: false, message: 'No divisions to deploy.' }

    // No longer updating deployedProvince on divisions (removed from interface)

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, deployedProvince: regionCode, status: 'idle' as const },
      },
    }))

    return { success: true, message: `${army.name} deployed to ${regionCode}!` }
  },

  getArmyAV: (armyId) => {
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { air: 0, ground: 0, tanks: 0, navy: 0, total: 0 }

    let ground = 0

    for (const divId of army.divisionIds) {
      const div = state.divisions[divId]
      if (!div || div.status === 'destroyed') continue
      // AV = manpower × template multiplier (simplified)
      const template = DIVISION_TEMPLATES[div.type]
      ground += div.manpower * template.atkDmgMult * 10
    }

    return { air: 0, ground, tanks: 0, navy: 0, total: ground }
  },

  getCompositionAura: (armyId) => {
    const av = get().getArmyAV(armyId)

    // Air   = +2% critical damage per 1,000 AV
    // Ground = +1% dodge per 1,000 AV
    // Tanks  = +2% basic attack per 1,000 AV
    // Navy   = +5% precision per 1,000 AV
    return {
      critDmgPct: Math.floor(av.air / 1000) * 2,
      dodgePct: Math.floor(av.ground / 1000) * 1,
      attackPct: Math.floor(av.tanks / 1000) * 2,
      precisionPct: Math.floor(av.navy / 1000) * 5,
    }
  },

  // ====== BATTLE ORDERS ======

  issueOrder: (armyId, orderType, targetRegion, bountyPool, durationMs, damageMultiplier) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    // Captain+ can issue orders
    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 4) return { success: false, message: 'Only Captains+ can issue orders.' }

    // Fund bounty from vault
    if (army.vault.money < bountyPool) return { success: false, message: `Not enough vault money. Vault has $${army.vault.money}.` }

    const order: BattleOrder = {
      id: `order_${Date.now()}`,
      armyId,
      orderType,
      targetRegion,
      issuedBy: player.name,
      issuedAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      damageMultiplier,
      bountyPool,
      claimedBy: [],
    }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          activeOrders: [...army.activeOrders, order],
          vault: { ...army.vault, money: army.vault.money - bountyPool },
        },
      },
    }))

    return { success: true, message: `Order issued: ${orderType} at ${targetRegion} with $${bountyPool} bounty!` }
  },

  recordDamageContribution: (armyId, orderId, playerId, damage) => {
    const state = get()
    const army = state.armies[armyId]
    if (!army) return

    const orders = army.activeOrders.map(o => {
      if (o.id !== orderId) return o
      const existing = o.claimedBy.find(c => c.playerId === playerId)
      if (existing) {
        return {
          ...o,
          claimedBy: o.claimedBy.map(c =>
            c.playerId === playerId ? { ...c, damageContribution: c.damageContribution + damage } : c
          ),
        }
      } else {
        return {
          ...o,
          claimedBy: [...o.claimedBy, { playerId, damageContribution: damage }],
        }
      }
    })

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, activeOrders: orders },
      },
    }))
  },
}))
