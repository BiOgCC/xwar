import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useInventoryStore, type EquipItem } from './inventoryStore'

// ====== DIVISION TYPES ======

export type DivisionType =
  | 'infantry'
  | 'mechanized'
  | 'tank'
  | 'artillery'
  | 'anti_air'
  | 'special_forces'
  | 'fighter'
  | 'bomber'

export type DivisionCategory = 'land' | 'air'

export type TerrainType = 'plains' | 'forest' | 'mountain' | 'urban' | 'desert' | 'jungle' | 'arctic' | 'coastal'

// ====== DIVISION TEMPLATE ======

export interface DivisionTemplate {
  id: DivisionType
  name: string
  icon: string
  category: DivisionCategory
  description: string
  baseStats: {
    attack: number
    defense: number
    breakthrough: number
    organization: number   // Like morale — unit retreats at 0
    speed: number
    supplyUsage: number
    combatWidth: number    // How much combat width this unit takes
    hardAttack: number     // Bonus vs armored units
    softAttack: number     // Bonus vs infantry
    airAttack: number      // Anti-air capability
  }
  manpowerCost: number
  recruitCost: {
    money: number
    oil: number
    materialX: number
    scrap: number
  }
  equipmentSlots: number    // How many player items can boost this division
  trainingTime: number      // Ticks to train (each tick = 1 second for demo)
}

export const DIVISION_TEMPLATES: Record<DivisionType, DivisionTemplate> = {
  infantry: {
    id: 'infantry', name: 'Infantry Division', icon: '🚶', category: 'land',
    description: 'Backbone of any army. High defense, low cost. Strong in defensive terrain.',
    baseStats: {
      attack: 30, defense: 50, breakthrough: 15,
      organization: 60, speed: 4, supplyUsage: 1,
      combatWidth: 2, hardAttack: 5, softAttack: 30, airAttack: 2,
    },
    manpowerCost: 10000, equipmentSlots: 2, trainingTime: 30,
    recruitCost: { money: 50000, oil: 500, materialX: 200, scrap: 300 },
  },
  mechanized: {
    id: 'mechanized', name: 'Mechanized Infantry', icon: '🚛', category: 'land',
    description: 'Motorized troops. Faster movement, better attack. Needs more fuel.',
    baseStats: {
      attack: 45, defense: 40, breakthrough: 25,
      organization: 55, speed: 8, supplyUsage: 3,
      combatWidth: 2, hardAttack: 15, softAttack: 40, airAttack: 3,
    },
    manpowerCost: 8000, equipmentSlots: 3, trainingTime: 45,
    recruitCost: { money: 120000, oil: 2000, materialX: 800, scrap: 500 },
  },
  tank: {
    id: 'tank', name: 'Tank Division', icon: '🪖', category: 'land',
    description: 'Heavy armor. Devastating breakthrough and hard attack. Very expensive.',
    baseStats: {
      attack: 70, defense: 30, breakthrough: 65,
      organization: 40, speed: 6, supplyUsage: 5,
      combatWidth: 4, hardAttack: 60, softAttack: 25, airAttack: 0,
    },
    manpowerCost: 5000, equipmentSlots: 4, trainingTime: 60,
    recruitCost: { money: 300000, oil: 5000, materialX: 3000, scrap: 2000 },
  },
  artillery: {
    id: 'artillery', name: 'Artillery Battery', icon: '💣', category: 'land',
    description: 'Long-range support. Boosts attack power of all units. Slow and vulnerable.',
    baseStats: {
      attack: 80, defense: 10, breakthrough: 5,
      organization: 30, speed: 2, supplyUsage: 4,
      combatWidth: 3, hardAttack: 40, softAttack: 80, airAttack: 0,
    },
    manpowerCost: 3000, equipmentSlots: 2, trainingTime: 40,
    recruitCost: { money: 200000, oil: 1500, materialX: 2000, scrap: 1500 },
  },
  anti_air: {
    id: 'anti_air', name: 'Anti-Air Battery', icon: '🔫', category: 'land',
    description: 'Counters enemy air superiority. Provides air defense coverage.',
    baseStats: {
      attack: 15, defense: 25, breakthrough: 5,
      organization: 35, speed: 4, supplyUsage: 2,
      combatWidth: 1, hardAttack: 5, softAttack: 10, airAttack: 80,
    },
    manpowerCost: 4000, equipmentSlots: 2, trainingTime: 35,
    recruitCost: { money: 150000, oil: 1000, materialX: 1500, scrap: 800 },
  },
  special_forces: {
    id: 'special_forces', name: 'Special Forces', icon: '🎯', category: 'land',
    description: 'Elite operatives. Excel in difficult terrain. High attack & breakthrough.',
    baseStats: {
      attack: 55, defense: 35, breakthrough: 50,
      organization: 70, speed: 6, supplyUsage: 2,
      combatWidth: 2, hardAttack: 30, softAttack: 55, airAttack: 5,
    },
    manpowerCost: 2000, equipmentSlots: 3, trainingTime: 90,
    recruitCost: { money: 250000, oil: 1000, materialX: 1500, scrap: 1000 },
  },
  fighter: {
    id: 'fighter', name: 'Fighter Squadron', icon: '✈️', category: 'air',
    description: 'Air superiority fighters. Controls the skies, giving ground troops bonuses.',
    baseStats: {
      attack: 40, defense: 20, breakthrough: 30,
      organization: 50, speed: 20, supplyUsage: 4,
      combatWidth: 1, hardAttack: 10, softAttack: 35, airAttack: 90,
    },
    manpowerCost: 1000, equipmentSlots: 2, trainingTime: 50,
    recruitCost: { money: 400000, oil: 4000, materialX: 2500, scrap: 1500 },
  },
  bomber: {
    id: 'bomber', name: 'Bomber Squadron', icon: '🛩️', category: 'air',
    description: 'Strategic bombers. Devastating ground attack. Vulnerable to fighters & AA.',
    baseStats: {
      attack: 90, defense: 10, breakthrough: 20,
      organization: 35, speed: 15, supplyUsage: 6,
      combatWidth: 2, hardAttack: 70, softAttack: 90, airAttack: 5,
    },
    manpowerCost: 500, equipmentSlots: 2, trainingTime: 60,
    recruitCost: { money: 500000, oil: 6000, materialX: 4000, scrap: 2000 },
  },
}

// ====== TERRAIN MODIFIERS ======

export interface TerrainModifier {
  defenseBonus: number      // % bonus to defender
  attackPenalty: number      // % penalty to attacker
  movementCost: number       // Speed reduction factor
  specialBonus: string       // Which unit type benefits
  specialBonusValue: number  // % bonus for that unit
}

export const TERRAIN_MODIFIERS: Record<TerrainType, TerrainModifier> = {
  plains:   { defenseBonus: 0,  attackPenalty: 0,  movementCost: 1.0, specialBonus: 'tank', specialBonusValue: 20 },
  forest:   { defenseBonus: 25, attackPenalty: 10, movementCost: 1.5, specialBonus: 'infantry', specialBonusValue: 15 },
  mountain: { defenseBonus: 40, attackPenalty: 20, movementCost: 2.0, specialBonus: 'special_forces', specialBonusValue: 30 },
  urban:    { defenseBonus: 30, attackPenalty: 15, movementCost: 1.2, specialBonus: 'infantry', specialBonusValue: 20 },
  desert:   { defenseBonus: 5,  attackPenalty: 5,  movementCost: 1.3, specialBonus: 'mechanized', specialBonusValue: 15 },
  jungle:   { defenseBonus: 35, attackPenalty: 25, movementCost: 2.5, specialBonus: 'special_forces', specialBonusValue: 25 },
  arctic:   { defenseBonus: 20, attackPenalty: 15, movementCost: 1.8, specialBonus: 'infantry', specialBonusValue: 10 },
  coastal:  { defenseBonus: 10, attackPenalty: 5,  movementCost: 1.0, specialBonus: 'mechanized', specialBonusValue: 10 },
}

// Assign terrain to each country
export const COUNTRY_TERRAIN: Record<string, TerrainType> = {
  'US': 'plains',
  'CA': 'forest',
  'MX': 'desert',
  'CU': 'coastal',
  'BS': 'coastal',
  'RU': 'arctic',
  'CN': 'mountain',
  'DE': 'urban',
  'BR': 'jungle',
  'IN': 'plains',
  'NG': 'jungle',
  'JP': 'mountain',
  'GB': 'urban',
  'TR': 'desert',
}

// ====== DIVISION INSTANCE ======

export interface Division {
  id: string
  templateId: DivisionType
  name: string
  type: DivisionType
  category: DivisionCategory
  ownerId: string        // Player name
  countryCode: string    // Which country's army

  // Current stats (base + equipment + experience bonuses)
  stats: {
    attack: number
    defense: number
    breakthrough: number
    organization: number
    maxOrganization: number
    speed: number
    supplyUsage: number
    combatWidth: number
    hardAttack: number
    softAttack: number
    airAttack: number
  }

  manpower: number
  maxManpower: number
  equipment: string[]      // Item IDs from player inventory
  experience: number       // 0-100, gained through combat
  morale: number           // 0-100, drops in combat, recovers over time

  status: 'training' | 'ready' | 'in_combat' | 'retreating' | 'recovering' | 'destroyed'
  trainingProgress: number // 0 to template.trainingTime
  deployedProvince: string // Country code where deployed
  
  // Combat tracking
  killCount: number
  battlesSurvived: number
}

// ====== ARMY GROUP ======

export interface Army {
  id: string
  name: string
  commanderId: string    // Player who controls it
  countryCode: string
  divisionIds: string[]
  deployedProvince: string
  status: 'idle' | 'attacking' | 'defending' | 'moving' | 'regrouping'

  // Calculated totals (cached for UI)
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
}

let divCounter = 0
let armyCounter = 0

function calculateDivisionStats(
  template: DivisionTemplate,
  equipment: EquipItem[],
  experience: number
): Division['stats'] {
  const base = { ...template.baseStats }

  // Equipment bonuses: each equipped item adds % of its stats
  equipment.forEach(item => {
    if (item.stats.damage) {
      base.attack += Math.floor(item.stats.damage * 0.5)
      base.softAttack += Math.floor(item.stats.damage * 0.3)
      base.hardAttack += Math.floor(item.stats.damage * 0.2)
    }
    if (item.stats.critRate) {
      base.breakthrough += Math.floor(item.stats.critRate * 0.5)
    }
    if (item.stats.critDamage) {
      base.attack += Math.floor(item.stats.critDamage * 0.2)
    }
    if (item.stats.armor) {
      base.defense += Math.floor(item.stats.armor * 1.5)
    }
    if (item.stats.dodge) {
      base.organization += Math.floor(item.stats.dodge * 0.5)
    }
    if (item.stats.precision) {
      base.hardAttack += Math.floor(item.stats.precision * 0.5)
    }
  })

  // Experience bonus: up to +25% at max experience
  const expMultiplier = 1 + (experience / 100) * 0.25
  base.attack = Math.floor(base.attack * expMultiplier)
  base.defense = Math.floor(base.defense * expMultiplier)
  base.breakthrough = Math.floor(base.breakthrough * expMultiplier)
  base.softAttack = Math.floor(base.softAttack * expMultiplier)
  base.hardAttack = Math.floor(base.hardAttack * expMultiplier)

  return {
    ...base,
    maxOrganization: base.organization,
  }
}

// ====== INITIAL MOCK DIVISIONS & ARMIES ======

function createInitialDivisions(): Record<string, Division> {
  const divs: Record<string, Division> = {}
  const template = DIVISION_TEMPLATES

  // US Army
  const usDivs: { type: DivisionType; name: string }[] = [
    { type: 'infantry', name: '1st Infantry "Big Red One"' },
    { type: 'infantry', name: '82nd Airborne' },
    { type: 'tank', name: '1st Armored Division' },
    { type: 'artillery', name: '75th Field Artillery' },
    { type: 'fighter', name: 'F-22 Raptor Wing' },
    { type: 'mechanized', name: '3rd Mechanized Brigade' },
  ]

  usDivs.forEach((d, i) => {
    const id = `div_us_${i}`
    const t = template[d.type]
    divs[id] = {
      id, templateId: d.type, name: d.name, type: d.type,
      category: t.category, ownerId: 'Commander_X', countryCode: 'US',
      stats: { ...t.baseStats, maxOrganization: t.baseStats.organization },
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      equipment: [], experience: 20 + i * 5, morale: 80 + i * 3,
      status: 'ready', trainingProgress: t.trainingTime,
      deployedProvince: 'US', killCount: 0, battlesSurvived: 0,
    }
  })

  // RU Army
  const ruDivs: { type: DivisionType; name: string }[] = [
    { type: 'infantry', name: '4th Guards Tank Division' },
    { type: 'tank', name: 'T-90 Heavy Armor' },
    { type: 'artillery', name: 'BM-30 Smerch Battery' },
    { type: 'fighter', name: 'Su-57 Felon Wing' },
  ]

  ruDivs.forEach((d, i) => {
    const id = `div_ru_${i}`
    const t = template[d.type]
    divs[id] = {
      id, templateId: d.type, name: d.name, type: d.type,
      category: t.category, ownerId: 'AI_Commander_Putin', countryCode: 'RU',
      stats: { ...t.baseStats, maxOrganization: t.baseStats.organization },
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      equipment: [], experience: 30, morale: 75,
      status: 'ready', trainingProgress: t.trainingTime,
      deployedProvince: 'RU', killCount: 0, battlesSurvived: 0,
    }
  })

  // CN Army
  const cnDivs: { type: DivisionType; name: string }[] = [
    { type: 'infantry', name: 'PLA 1st Group Army' },
    { type: 'infantry', name: 'PLA 2nd Group Army' },
    { type: 'tank', name: 'Type 99A Battalion' },
    { type: 'bomber', name: 'H-20 Bomber Wing' },
    { type: 'anti_air', name: 'HQ-9 Air Defense' },
  ]

  cnDivs.forEach((d, i) => {
    const id = `div_cn_${i}`
    const t = template[d.type]
    divs[id] = {
      id, templateId: d.type, name: d.name, type: d.type,
      category: t.category, ownerId: 'AI_Commander_Xi', countryCode: 'CN',
      stats: { ...t.baseStats, maxOrganization: t.baseStats.organization },
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      equipment: [], experience: 25, morale: 78,
      status: 'ready', trainingProgress: t.trainingTime,
      deployedProvince: 'CN', killCount: 0, battlesSurvived: 0,
    }
  })

  divCounter = Object.keys(divs).length
  return divs
}

function createInitialArmies(divisions: Record<string, Division>): Record<string, Army> {
  const armies: Record<string, Army> = {}

  // US Army Group
  const usDivIds = Object.keys(divisions).filter(k => k.startsWith('div_us_'))
  armies['army_us_1'] = {
    id: 'army_us_1', name: 'US Army Group Alpha',
    commanderId: 'Commander_X', countryCode: 'US',
    divisionIds: usDivIds, deployedProvince: 'US',
    status: 'idle',
    totalManpower: usDivIds.reduce((s, id) => s + divisions[id].manpower, 0),
    totalAttack: usDivIds.reduce((s, id) => s + divisions[id].stats.attack, 0),
    totalDefense: usDivIds.reduce((s, id) => s + divisions[id].stats.defense, 0),
  }

  // RU Army Group
  const ruDivIds = Object.keys(divisions).filter(k => k.startsWith('div_ru_'))
  armies['army_ru_1'] = {
    id: 'army_ru_1', name: 'Russian Western Front',
    commanderId: 'AI_Commander_Putin', countryCode: 'RU',
    divisionIds: ruDivIds, deployedProvince: 'RU',
    status: 'idle',
    totalManpower: ruDivIds.reduce((s, id) => s + divisions[id].manpower, 0),
    totalAttack: ruDivIds.reduce((s, id) => s + divisions[id].stats.attack, 0),
    totalDefense: ruDivIds.reduce((s, id) => s + divisions[id].stats.defense, 0),
  }

  // CN Army Group
  const cnDivIds = Object.keys(divisions).filter(k => k.startsWith('div_cn_'))
  armies['army_cn_1'] = {
    id: 'army_cn_1', name: 'PLA Northern Command',
    commanderId: 'AI_Commander_Xi', countryCode: 'CN',
    divisionIds: cnDivIds, deployedProvince: 'CN',
    status: 'idle',
    totalManpower: cnDivIds.reduce((s, id) => s + divisions[id].manpower, 0),
    totalAttack: cnDivIds.reduce((s, id) => s + divisions[id].stats.attack, 0),
    totalDefense: cnDivIds.reduce((s, id) => s + divisions[id].stats.defense, 0),
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
      templateId: type,
      name: `${template.name} #${divCounter}`,
      type,
      category: template.category,
      ownerId: player.name,
      countryCode: player.countryCode || 'US',
      stats: {
        ...template.baseStats,
        maxOrganization: template.baseStats.organization,
      },
      manpower: template.manpowerCost,
      maxManpower: template.manpowerCost,
      equipment: [],
      experience: 0,
      morale: 50,
      status: 'training',
      trainingProgress: 0,
      deployedProvince: player.countryCode || 'US',
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

      const template = DIVISION_TEMPLATES[div.templateId]
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

  processTrainingTick: () => {
    set(state => {
      let changed = false
      const newDivisions = { ...state.divisions }

      Object.values(newDivisions).forEach(div => {
        if (div.status === 'training') {
          const template = DIVISION_TEMPLATES[div.templateId]
          const newProgress = div.trainingProgress + 1
          const isComplete = newProgress >= template.trainingTime

          newDivisions[div.id] = {
            ...div,
            trainingProgress: newProgress,
            status: isComplete ? 'ready' : 'training',
            morale: isComplete ? 70 : Math.min(100, div.morale + 0.1),
          }
          changed = true
        }
        // Recovering divisions slowly regain organization and morale
        if (div.status === 'recovering') {
          const newOrg = Math.min(div.stats.maxOrganization, div.stats.organization + 1)
          const newMorale = Math.min(100, div.morale + 0.5)
          newDivisions[div.id] = {
            ...div,
            stats: { ...div.stats, organization: newOrg },
            morale: newMorale,
            status: newOrg >= div.stats.maxOrganization * 0.8 ? 'ready' : 'recovering',
          }
          changed = true
        }
        // Retreating divisions become recovering after some time
        if (div.status === 'retreating') {
          newDivisions[div.id] = { ...div, status: 'recovering' }
          changed = true
        }
      })

      return changed ? { divisions: newDivisions } : state
    })
  },

  equipItemToDivision: (divisionId, itemId) => {
    const state = get()
    const div = state.divisions[divisionId]
    if (!div) return false

    const template = DIVISION_TEMPLATES[div.templateId]
    if (div.equipment.length >= template.equipmentSlots) return false
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

    // Recalculate stats
    get().recalculateDivisionStats(divisionId)
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

    get().recalculateDivisionStats(divisionId)
    return true
  },

  recalculateDivisionStats: (divisionId) => {
    set(state => {
      const div = state.divisions[divisionId]
      if (!div) return state

      const template = DIVISION_TEMPLATES[div.templateId]
      const invStore = useInventoryStore.getState()
      const equipItems = div.equipment
        .map(id => invStore.items.find(i => i.id === id))
        .filter(Boolean) as EquipItem[]

      const newStats = calculateDivisionStats(template, equipItems, div.experience)

      return {
        divisions: {
          ...state.divisions,
          [divisionId]: { ...div, stats: newStats },
        },
      }
    })
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
          totalAttack += div.stats.attack
          totalDefense += div.stats.defense
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

  applyBattleDamage: (divisionId, manpowerLoss, orgLoss, moraleLoss, equipDamage) => {
    set(state => {
      const div = state.divisions[divisionId]
      if (!div) return state

      const newManpower = Math.max(0, div.manpower - manpowerLoss)
      const newOrg = Math.max(0, div.stats.organization - orgLoss)
      const newMorale = Math.max(0, div.morale - moraleLoss)

      // Degrade equipment
      if (equipDamage > 0 && div.equipment.length > 0) {
        const invStore = useInventoryStore.getState()
        invStore.degradeEquippedItems(equipDamage)
      }

      const isDestroyed = newManpower <= 0
      const isRetreating = newOrg <= 0 && !isDestroyed

      return {
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            manpower: newManpower,
            stats: { ...div.stats, organization: newOrg },
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
            stats: { ...div.stats, organization: div.stats.maxOrganization },
            morale: Math.min(100, div.morale + 20),
            status: 'ready',
          },
        },
      }
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
}))
