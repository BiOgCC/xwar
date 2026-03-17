import { create } from 'zustand'
import { usePlayerStore, getMilitaryRank } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useInventoryStore, type EquipItem } from './inventoryStore'
import { useCompanyStore } from './companyStore'
import { useGovernmentStore } from './governmentStore'

export type DivisionType = 'recon' | 'assault' | 'sniper' | 'rpg' | 'jeep' | 'tank' | 'jet' | 'warship'

export type DivisionCategory = 'land' | 'air' | 'naval'

// ====== DIVISION TEMPLATE (multipliers applied to player stats) ======

export interface DivisionTemplate {
  id: DivisionType
  name: string
  icon: string
  category: DivisionCategory
  group: 'infantry' | 'mechanized'
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
  popCost: number          // Pop Cap cost: infantry=1, mechanized=2
  seats: number            // Transport capacity: how many infantry divs this unit can carry
  attackSpeed: number      // Hits per tick multiplier: 1.0 = standard, 1.5 = fast, 0.5 = slow
}

// Infantry base: atkDmg=0.10, hitRate=0.50, critRate=0.80, critDmg=0.80, health=1.20, dodge=0.90, armor=1.00
// Mechanized base: atkDmg=0.20, hitRate=0.60, critRate=0.90, critDmg=0.90, health=1.50, dodge=1.10, armor=1.50

export const DIVISION_TEMPLATES: Record<DivisionType, DivisionTemplate> = {
  // ── INFANTRY ──────────────────────────────
  recon: {
    id: 'recon', name: 'Recon Squad', icon: '/assets/divisions/recon.png', category: 'land', group: 'infantry',
    description: 'Scout unit. Base infantry stats with enhanced evasion.',
    atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 0.80,
    healthMult: 1.20, dodgeMult: 1.30, armorMult: 1.00,
    manpowerCost: 200, trainingTime: 25,
    recruitCost: { money: 40000, oil: 400, materialX: 150, scrap: 200 },
    popCost: 1, seats: 0,
    attackSpeed: 1.5,
  },
  assault: {
    id: 'assault', name: 'Assault Infantry', icon: '/assets/divisions/assault.png', category: 'land', group: 'infantry',
    description: 'Frontline fighters. Harder hits with better survivability.',
    atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 0.88,
    healthMult: 1.44, dodgeMult: 0.90, armorMult: 1.10,
    manpowerCost: 350, trainingTime: 30,
    recruitCost: { money: 60000, oil: 600, materialX: 250, scrap: 350 },
    popCost: 1, seats: 0,
    attackSpeed: 1,
  },
  sniper: {
    id: 'sniper', name: 'Sniper Division', icon: '/assets/divisions/sniper.png', category: 'land', group: 'infantry',
    description: 'Precision unit. Devastating critical hits from range.',
    atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.56, critDmgMult: 1.56,
    healthMult: 1.20, dodgeMult: 0.90, armorMult: 0.80,
    manpowerCost: 150, trainingTime: 40,
    recruitCost: { money: 80000, oil: 500, materialX: 300, scrap: 400 },
    popCost: 1, seats: 0,
    attackSpeed: 0.6,
  },
  rpg: {
    id: 'rpg', name: 'RPG Squadron', icon: '/assets/divisions/rpg.png', category: 'land', group: 'infantry',
    description: 'Heavy infantry. Maximum firepower at high cost.',
    atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 1.20,
    healthMult: 1.50, dodgeMult: 0.70, armorMult: 1.30,
    manpowerCost: 250, trainingTime: 35,
    recruitCost: { money: 100000, oil: 800, materialX: 400, scrap: 500 },
    popCost: 1, seats: 0,
    attackSpeed: 0.8,
  },

  // ── MECHANIZED ────────────────────────────
  jeep: {
    id: 'jeep', name: 'Recon Jeeps', icon: '/assets/divisions/jeep.png', category: 'land', group: 'mechanized',
    description: 'Fast motorized scouts. High evasion, good firepower.',
    atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 0.90,
    healthMult: 1.50, dodgeMult: 1.50, armorMult: 1.50,
    manpowerCost: 150, trainingTime: 35,
    recruitCost: { money: 100000, oil: 1500, materialX: 600, scrap: 400 },
    popCost: 2, seats: 0,
    attackSpeed: 1.3,
  },
  tank: {
    id: 'tank', name: 'Tank Battalion', icon: '/assets/divisions/tank.png', category: 'land', group: 'mechanized',
    description: 'Armored assault. Devastating crits with heavy armor.',
    atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 0.99,
    healthMult: 1.80, dodgeMult: 0.80, armorMult: 2.00,
    manpowerCost: 200, trainingTime: 50,
    recruitCost: { money: 150000, oil: 2500, materialX: 1000, scrap: 600 },
    popCost: 2, seats: 1,
    attackSpeed: 0.5,
  },
  jet: {
    id: 'jet', name: 'Jet Fighters', icon: '/assets/divisions/jet.png', category: 'air', group: 'mechanized',
    description: 'Air superiority. Precise strikes with massive criticals.',
    atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.75, critDmgMult: 1.75,
    healthMult: 1.30, dodgeMult: 1.40, armorMult: 1.00,
    manpowerCost: 100, trainingTime: 60,
    recruitCost: { money: 200000, oil: 3000, materialX: 1200, scrap: 700 },
    popCost: 2, seats: 2,
    attackSpeed: 0.7,
  },
  warship: {
    id: 'warship', name: 'Warship Fleet', icon: '/assets/divisions/warship.png', category: 'naval', group: 'mechanized',
    description: 'Naval dominance. Maximum stats at maximum cost.',
    atkDmgMult: 0.30, hitRate: 0.60, critRateMult: 1.35, critDmgMult: 1.35,
    healthMult: 2.00, dodgeMult: 0.70, armorMult: 2.50,
    manpowerCost: 250, trainingTime: 60,
    recruitCost: { money: 250000, oil: 4000, materialX: 1500, scrap: 800 },
    popCost: 2, seats: 5,
    attackSpeed: 0.4,
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

  // Health pool: manpower (acts as HP)
  manpower: number       // Current manpower (acts as HP units)
  maxManpower: number    // Max manpower
  
  equipment: string[]    // Item IDs from player inventory
  experience: number     // 0-100, gained through combat
  stance: 'unassigned' | 'force_pool' | 'reserve' | 'first_line_defense'
  autoTrainingEnabled: boolean  // Passive experience gain when ready

  status: 'training' | 'ready' | 'in_combat' | 'recovering' | 'destroyed'
  trainingProgress: number  // Legacy: used for retreat/recover tick counter
  readyAt: number           // Timestamp: when training finishes (0 = not training)
  reinforcing: boolean
  reinforceProgress: number

  // Combat tracking
  killCount: number
  battlesSurvived: number
}

// ====== MILITARY FORCE ======

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
  applyBattleDamage: (divisionId: string, manpowerLoss: number, equipDamage: number) => void
  recoverDivision: (divisionId: string) => void

  // Queries
  getDivisionsForCountry: (countryCode: string) => Division[]
  getDivisionsForArmy: (armyId: string) => Division[]
  getArmiesForCountry: (countryCode: string) => Army[]
  getReadyDivisions: (countryCode: string) => Division[]

  // Pop Cap
  getPlayerPopCap: () => { used: number; max: number }
  getPlayerPopUsed: () => number
  getCountryPopCap: (countryCode: string) => { used: number; max: number }

  // Equipment from vault
  equipFromVault: (armyId: string, divisionId: string, equipmentId: string) => { success: boolean; message: string }
  unequipToVault: (armyId: string, divisionId: string, equipmentId: string) => { success: boolean; message: string }

  // Division lifecycle
  rebuildDivision: (divisionId: string) => { success: boolean; message: string }
  setDivisionStance: (divisionId: string, stance: 'unassigned' | 'force_pool' | 'reserve' | 'first_line_defense') => { success: boolean; message: string }
  toggleAutoTraining: (divisionId: string) => { success: boolean; message: string }

  // Reinforcement
  reinforceDivision: (divisionId: string) => { success: boolean; message: string }

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

  // US Army — varied composition
  const usDivs: { type: DivisionType; name: string }[] = [
    { type: 'recon', name: '1st Recon "Big Red Eye"' },
    { type: 'assault', name: '82nd Airborne' },
    { type: 'sniper', name: '101st Marksmen' },
    { type: 'rpg', name: '10th Mountain RPG' },
    { type: 'jeep', name: '1st Fast Attack Brigade' },
    { type: 'tank', name: '3rd Armored Brigade' },
  ]

  usDivs.forEach((d, i) => {
    const id = `div_us_${i}`
    const t = DIVISION_TEMPLATES[d.type]
    divs[id] = {
      id, type: d.type, name: d.name,
      category: t.category, ownerId: usePlayerStore.getState().name || 'Commander', countryCode: 'US',
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      equipment: [], experience: 20 + i * 5,
      status: 'ready', trainingProgress: t.trainingTime,
      reinforcing: false, reinforceProgress: 0,
      readyAt: 0,
      stance: 'unassigned' as const,
      autoTrainingEnabled: false,
      killCount: 0, battlesSurvived: 0,
    }
  })

  // RU Army
  const ruDivs: { type: DivisionType; name: string }[] = [
    { type: 'assault', name: '4th Guards Assault' },
    { type: 'rpg', name: '20th Guards RPG' },
    { type: 'sniper', name: '150th Sniper Division' },
    { type: 'tank', name: 'T-90 Heavy Armor' },
  ]

  ruDivs.forEach((d, i) => {
    const id = `div_ru_${i}`
    const t = DIVISION_TEMPLATES[d.type]
    divs[id] = {
      id, type: d.type, name: d.name,
      category: t.category, ownerId: 'AI_Commander_Putin', countryCode: 'RU',
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      equipment: [], experience: 30,
      status: 'ready', trainingProgress: t.trainingTime,
      reinforcing: false, reinforceProgress: 0,
      readyAt: 0,
      stance: 'unassigned' as const,
      autoTrainingEnabled: false,
      killCount: 0, battlesSurvived: 0,
    }
  })

  // CN Army
  const cnDivs: { type: DivisionType; name: string }[] = [
    { type: 'recon', name: 'PLA 1st Recon Group' },
    { type: 'assault', name: 'PLA 2nd Assault Group' },
    { type: 'sniper', name: 'PLA 3rd Sniper Group' },
    { type: 'tank', name: 'Type 99A Battalion' },
    { type: 'jet', name: 'J-20 Strike Wing' },
  ]

  cnDivs.forEach((d, i) => {
    const id = `div_cn_${i}`
    const t = DIVISION_TEMPLATES[d.type]
    divs[id] = {
      id, type: d.type, name: d.name,
      category: t.category, ownerId: 'AI_Commander_Xi', countryCode: 'CN',
      manpower: t.manpowerCost, maxManpower: t.manpowerCost,
      equipment: [], experience: 25,
      status: 'ready', trainingProgress: t.trainingTime,
      reinforcing: false, reinforceProgress: 0,
      readyAt: 0,
      stance: 'unassigned' as const,
      autoTrainingEnabled: false,
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

    // Check Pop Cap
    const popCap = get().getPlayerPopCap()
    if (popCap.used + template.popCost > popCap.max) {
      return { success: false, message: `Pop Cap full! (${popCap.used}/${popCap.max}). Build or upgrade farms.` }
    }

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
      equipment: [],
      experience: 0,
      stance: 'unassigned',
      autoTrainingEnabled: false,
      status: 'training',
      trainingProgress: 0,
      readyAt: Date.now() + (template.trainingTime * 15_000),
      reinforcing: false,
      reinforceProgress: 0,
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

  applyBattleDamage: (divisionId, manpowerLoss, equipDamage) => {
    set(state => {
      const div = state.divisions[divisionId]
      if (!div) return state

      const newManpower = Math.max(0, div.manpower - manpowerLoss)
            // Degrade equipment
      if (equipDamage > 0 && div.equipment.length > 0) {
        const invStore = useInventoryStore.getState()
        invStore.degradeEquippedItems(equipDamage)
      }

      const isDestroyed = newManpower <= 0
            return {
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            manpower: newManpower,
                        status: isDestroyed ? 'destroyed' : div.status,
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

        // --- Training: timestamp-based, check if readyAt has passed ---
        if (div.status === 'training') {
          if (div.readyAt > 0 && Date.now() >= div.readyAt) {
            updated = { ...updated, status: 'ready', readyAt: 0 }
            changed = true
          }
        }

        // --- Recovering: after 3 ticks become ready ---
        if (div.status === 'recovering') {
          const recoverTicks = (div.trainingProgress || 0) + 1
          if (recoverTicks >= 3) {
            updated = { ...updated, status: 'ready', trainingProgress: 0 }
          } else {
            updated = { ...updated, trainingProgress: recoverTicks }
          }
          changed = true
        }

        

        // --- Auto-training: +0.1 exp per tick (max 2 divisions per player) ---
        if (div.status === 'ready' && div.autoTrainingEnabled && div.experience < 100) {
          // Check if player has < 2 auto-training divisions
          const autoTrainingCount = Object.values(newDivisions).filter(
            d => d.ownerId === div.ownerId && d.autoTrainingEnabled && d.status === 'ready'
          ).length
          if (autoTrainingCount <= 2) {
            updated = { ...updated, experience: Math.min(100, div.experience + 0.1) }
            changed = true
          }
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
      equipment: [], experience: 0,
      status: 'training', trainingProgress: 0,
      reinforcing: false, reinforceProgress: 0,
      readyAt: 0,
      stance: 'unassigned' as const,
      autoTrainingEnabled: false,
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

  // ====== POP CAP ======

  getPlayerPopCap: () => {
    const player = usePlayerStore.getState()
    const companies = useCompanyStore.getState().companies
    const farmTypes = ['wheat_farm', 'fish_farm', 'steak_farm']
    const farmLevelSum = companies
      .filter(c => farmTypes.includes(c.type))
      .reduce((sum, c) => sum + c.level, 0)
    const foodShopTypes = ['bakery', 'sushi_bar', 'wagyu_grill']
    const foodShopPop = companies
      .filter(c => foodShopTypes.includes(c.type))
      .reduce((sum, c) => sum + c.level * 2, 0)
    const maxPop = 6 + farmLevelSum + foodShopPop
    const used = get().getPlayerPopUsed()
    return { used, max: maxPop }
  },

  getPlayerPopUsed: () => {
    const player = usePlayerStore.getState()
    const iso = player.countryCode || 'US'
    const divs = Object.values(get().divisions)
    return divs
      .filter(d => d.countryCode === iso && d.status !== 'destroyed')
      .reduce((sum, d) => {
        const template = DIVISION_TEMPLATES[d.type]
        return sum + (template?.popCost || 1)
      }, 0)
  },

  getCountryPopCap: (countryCode) => {
    const divs = Object.values(get().divisions)
    const used = divs
      .filter(d => d.countryCode === countryCode && d.status !== 'destroyed')
      .reduce((sum, d) => {
        const template = DIVISION_TEMPLATES[d.type]
        return sum + (template?.popCost || 1)
      }, 0)
    const companies = useCompanyStore.getState().companies
    const farmTypes = ['wheat_farm', 'fish_farm', 'steak_farm']
    const farmLevelSum = companies
      .filter(c => farmTypes.includes(c.type))
      .reduce((sum, c) => sum + c.level, 0)
    const foodShopTypes = ['bakery', 'sushi_bar', 'wagyu_grill']
    const foodShopPop = companies
      .filter(c => foodShopTypes.includes(c.type))
      .reduce((sum, c) => sum + c.level * 2, 0)
    const govStore = useGovernmentStore.getState()
    const gov = govStore.governments[countryCode]
    const citizenCount = gov?.citizens?.length || 1
    const maxPop = (citizenCount * 6) + farmLevelSum + foodShopPop
    return { used, max: maxPop }
  },

  // ====== EQUIPMENT FROM VAULT ======

  equipFromVault: (armyId, divisionId, equipmentId) => {
    const state = get()
    const army = state.armies[armyId]
    const div = state.divisions[divisionId]
    if (!army) return { success: false, message: 'Force not found.' }
    if (!div) return { success: false, message: 'Division not found.' }
    if (!army.vault.equipmentIds.includes(equipmentId)) return { success: false, message: 'Item not in vault.' }
    if (div.equipment.length >= 3) return { success: false, message: 'Division has max 3 equipment slots.' }
    if (div.equipment.includes(equipmentId)) return { success: false, message: 'Already equipped.' }

    // Remove from vault, add to division
    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          vault: { ...army.vault, equipmentIds: army.vault.equipmentIds.filter(id => id !== equipmentId) },
        },
      },
      divisions: {
        ...s.divisions,
        [divisionId]: { ...div, equipment: [...div.equipment, equipmentId] },
      },
    }))
    return { success: true, message: 'Equipment assigned to division.' }
  },

  unequipToVault: (armyId, divisionId, equipmentId) => {
    const state = get()
    const army = state.armies[armyId]
    const div = state.divisions[divisionId]
    if (!army) return { success: false, message: 'Force not found.' }
    if (!div) return { success: false, message: 'Division not found.' }
    if (!div.equipment.includes(equipmentId)) return { success: false, message: 'Not equipped.' }

    // Remove from division, add to vault
    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          vault: { ...army.vault, equipmentIds: [...army.vault.equipmentIds, equipmentId] },
        },
      },
      divisions: {
        ...s.divisions,
        [divisionId]: { ...div, equipment: div.equipment.filter(id => id !== equipmentId) },
      },
    }))
    return { success: true, message: 'Equipment returned to vault.' }
  },

  // ====== DIVISION LIFECYCLE ======

  rebuildDivision: (divisionId) => {
    const div = get().divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found.' }
    if (div.manpower >= div.maxManpower) return { success: false, message: 'Division is at full strength.' }
    if (div.manpower < 1) return { success: false, message: 'Division is destroyed. Disband it instead.' }
    if (div.status === 'training') return { success: false, message: 'Division is still training.' }

    const template = DIVISION_TEMPLATES[div.type]
    const missingPct = (div.maxManpower - div.manpower) / div.maxManpower
    const cost = {
      money: Math.ceil(template.recruitCost.money * missingPct),
      oil: Math.ceil(template.recruitCost.oil * missingPct),
    }

    const player = usePlayerStore.getState()
    if (player.money < cost.money) return { success: false, message: `Not enough money (${cost.money.toLocaleString()}).` }
    if (player.oil < cost.oil) return { success: false, message: `Not enough oil (${cost.oil}).` }

    player.spendMoney(cost.money)
    player.spendOil(cost.oil)

    set(state => ({
      divisions: {
        ...state.divisions,
        [divisionId]: {
          ...div,
          manpower: div.maxManpower,
          status: 'recovering',
          
        },
      },
    }))

    return { success: true, message: `Rebuilt! Cost: ${cost.money.toLocaleString()} + ${cost.oil} oil.` }
  },

  setDivisionStance: (divisionId, stance) => {
    const div = get().divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found.' }
    if (div.status === 'destroyed') return { success: false, message: 'Cannot set stance on destroyed division.' }
    if (div.status === 'in_combat') return { success: false, message: 'Cannot change stance during combat.' }

    set(state => ({
      divisions: {
        ...state.divisions,
        [divisionId]: { ...div, stance },
      },
    }))
    return { success: true, message: `Stance set to ${stance.replace(/_/g, ' ').toUpperCase()}.` }
  },

  toggleAutoTraining: (divisionId) => {
    const div = get().divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found.' }
    if (div.status !== 'ready') return { success: false, message: 'Division must be ready to auto-train.' }

    // Check max 2 auto-training per player
    if (!div.autoTrainingEnabled) {
      const count = Object.values(get().divisions).filter(
        d => d.ownerId === div.ownerId && d.autoTrainingEnabled && d.status === 'ready'
      ).length
      if (count >= 2) return { success: false, message: 'Max 2 divisions can auto-train at once.' }
    }

    set(state => ({
      divisions: {
        ...state.divisions,
        [divisionId]: { ...div, autoTrainingEnabled: !div.autoTrainingEnabled },
      },
    }))
    return { success: true, message: div.autoTrainingEnabled ? 'Auto-training disabled.' : 'Auto-training enabled.' }
  },

  // ====== REINFORCEMENT ======

  reinforceDivision: (divisionId) => {
    const div = get().divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found.' }
    if (div.status === 'destroyed') return { success: false, message: 'Division is destroyed.' }
    if (div.status === 'training') return { success: false, message: 'Division is still training.' }
    if (div.reinforcing) return { success: false, message: 'Already being reinforced.' }
    if (div.manpower >= div.maxManpower) return { success: false, message: 'Division is at full strength.' }

    const template = DIVISION_TEMPLATES[div.type]
    const missingPct = (div.maxManpower - div.manpower) / div.maxManpower
    const reinforceCostMoney = Math.ceil(template.recruitCost.money * missingPct)
    const reinforceCostOil = Math.ceil(template.recruitCost.oil * missingPct)

    const player = usePlayerStore.getState()
    if (player.money < reinforceCostMoney) return { success: false, message: `Not enough money (${reinforceCostMoney.toLocaleString()}).` }
    if (player.oil < reinforceCostOil) return { success: false, message: `Not enough oil (${reinforceCostOil}).` }

    player.spendMoney(reinforceCostMoney)
    player.spendOil(reinforceCostOil)

    set(state => ({
      divisions: {
        ...state.divisions,
        [divisionId]: {
          ...div,
          manpower: div.maxManpower,
          reinforcing: true,
          reinforceProgress: 5,
        },
      },
    }))

    return { success: true, message: `Reinforced to full! Cost: ${reinforceCostMoney.toLocaleString()} + ${reinforceCostOil} oil.` }
  },
}))
