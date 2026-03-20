import { usePlayerStore } from '../playerStore'

// ====== DIVISION TYPES ======

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
    atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 1.50,
    healthMult: 24.0, dodgeMult: 1.30, armorMult: 1.00,
    manpowerCost: 200, trainingTime: 25,
    recruitCost: { money: 40000, oil: 400, materialX: 150, scrap: 200 },
    popCost: 1, seats: 0,
    attackSpeed: 1.5,
  },
  assault: {
    id: 'assault', name: 'Assault Infantry', icon: '/assets/divisions/assault.png', category: 'land', group: 'infantry',
    description: 'Frontline fighters. Harder hits with better survivability.',
    atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 1.60,
    healthMult: 28.8, dodgeMult: 0.90, armorMult: 1.10,
    manpowerCost: 350, trainingTime: 30,
    recruitCost: { money: 60000, oil: 600, materialX: 250, scrap: 350 },
    popCost: 1, seats: 0,
    attackSpeed: 1,
  },
  sniper: {
    id: 'sniper', name: 'Sniper Division', icon: '/assets/divisions/sniper.png', category: 'land', group: 'infantry',
    description: 'Precision unit. Devastating critical hits from range.',
    atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.56, critDmgMult: 2.50,
    healthMult: 24.0, dodgeMult: 0.90, armorMult: 0.80,
    manpowerCost: 150, trainingTime: 40,
    recruitCost: { money: 80000, oil: 500, materialX: 300, scrap: 400 },
    popCost: 1, seats: 0,
    attackSpeed: 0.6,
  },
  rpg: {
    id: 'rpg', name: 'RPG Squadron', icon: '/assets/divisions/rpg.png', category: 'land', group: 'infantry',
    description: 'Heavy infantry. Maximum firepower at high cost.',
    atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 2.00,
    healthMult: 30.0, dodgeMult: 0.70, armorMult: 1.30,
    manpowerCost: 250, trainingTime: 35,
    recruitCost: { money: 100000, oil: 800, materialX: 400, scrap: 500 },
    popCost: 1, seats: 0,
    attackSpeed: 0.8,
  },

  // ── MECHANIZED ────────────────────────────
  jeep: {
    id: 'jeep', name: 'Recon Jeeps', icon: '/assets/divisions/jeep.png', category: 'land', group: 'mechanized',
    description: 'Fast motorized scouts. High evasion, good firepower.',
    atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 1.70,
    healthMult: 30.0, dodgeMult: 1.50, armorMult: 1.50,
    manpowerCost: 150, trainingTime: 35,
    recruitCost: { money: 100000, oil: 1500, materialX: 600, scrap: 400 },
    popCost: 2, seats: 0,
    attackSpeed: 1.3,
  },
  tank: {
    id: 'tank', name: 'Tank Battalion', icon: '/assets/divisions/tank.png', category: 'land', group: 'mechanized',
    description: 'Armored assault. Devastating crits with heavy armor.',
    atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 1.80,
    healthMult: 36.0, dodgeMult: 0.80, armorMult: 2.00,
    manpowerCost: 200, trainingTime: 50,
    recruitCost: { money: 150000, oil: 2500, materialX: 1000, scrap: 600 },
    popCost: 2, seats: 1,
    attackSpeed: 0.5,
  },
  jet: {
    id: 'jet', name: 'Jet Fighters', icon: '/assets/divisions/jet.png', category: 'air', group: 'mechanized',
    description: 'Air superiority. Precise strikes with massive criticals.',
    atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.75, critDmgMult: 2.80,
    healthMult: 26.0, dodgeMult: 1.40, armorMult: 1.00,
    manpowerCost: 100, trainingTime: 60,
    recruitCost: { money: 200000, oil: 3000, materialX: 1200, scrap: 700 },
    popCost: 2, seats: 2,
    attackSpeed: 0.7,
  },
  warship: {
    id: 'warship', name: 'Warship Fleet', icon: '/assets/divisions/warship.png', category: 'naval', group: 'mechanized',
    description: 'Naval dominance. Maximum stats at maximum cost.',
    atkDmgMult: 0.30, hitRate: 0.60, critRateMult: 1.35, critDmgMult: 2.20,
    healthMult: 40.0, dodgeMult: 0.70, armorMult: 2.50,
    manpowerCost: 250, trainingTime: 60,
    recruitCost: { money: 250000, oil: 4000, materialX: 1500, scrap: 800 },
    popCost: 2, seats: 5,
    attackSpeed: 0.4,
  },
}

// ====== STAR QUALITY SYSTEM ======

export type StarQuality = 1 | 2 | 3 | 4 | 5

export interface StatModifiers {
  atkDmgMult: number    // decimal, e.g. 0.05 = +5%
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  attackSpeed: number
}

const STAR_RANGES: Record<StarQuality, [number, number]> = {
  1: [-0.07, -0.04],  // -7% to -4%
  2: [-0.03, 0.01],   // -3% to +1%
  3: [0.01, 0.05],    // +1% to +5%
  4: [0.04, 0.08],    // +4% to +8%
  5: [0.06, 0.08],    // +6% to +8%
}

export function rollStarQuality(investmentAmount?: number): { star: StarQuality; modifiers: StatModifiers } {
  // Base weights: 1★=30%, 2★=35%, 3★=20%, 4★=10%, 5★=5%
  // Boosted weights (at max contract $1M): 1★=5%, 2★=20%, 3★=35%, 4★=25%, 5★=15%
  const baseW = [30, 35, 20, 10, 5]
  const boostW = [5, 20, 35, 25, 15]

  let weights = baseW
  if (investmentAmount && investmentAmount > 0) {
    const t = Math.min(1, Math.max(0, (investmentAmount - 100_000) / (1_000_000 - 100_000)))
    weights = baseW.map((b, i) => b + (boostW[i] - b) * t)
  }

  const roll = Math.random() * 100
  let star: StarQuality
  if (roll < weights[0]) star = 1
  else if (roll < weights[0] + weights[1]) star = 2
  else if (roll < weights[0] + weights[1] + weights[2]) star = 3
  else if (roll < weights[0] + weights[1] + weights[2] + weights[3]) star = 4
  else star = 5

  const [min, max] = STAR_RANGES[star]
  const rollStat = () => min + Math.random() * (max - min)

  return {
    star,
    modifiers: {
      atkDmgMult: rollStat(),
      hitRate: rollStat(),
      critRateMult: rollStat(),
      critDmgMult: rollStat(),
      healthMult: rollStat(),
      dodgeMult: rollStat(),
      armorMult: rollStat(),
      attackSpeed: rollStat(),
    },
  }
}

// ====== EFFECTIVE MANPOWER (troops display) & HEALTH (combat HP) ======
export function getEffectiveManpower(template: DivisionTemplate): number {
  return template.manpowerCost
}

export function getEffectiveHealth(template: DivisionTemplate): number {
  const maxStamina = usePlayerStore.getState().maxStamina || 100
  return Math.floor(template.healthMult * maxStamina)
}

// ====== WEAPON -> DIVISION MAPPING & EQUIPMENT BONUSES ======
import type { WeaponSubtype } from '../inventoryStore'
import { useInventoryStore } from '../inventoryStore'

export const WEAPON_DIVISION_MAP: Record<WeaponSubtype, DivisionType> = {
  knife: 'recon',
  gun: 'jeep',
  rifle: 'assault',
  sniper: 'sniper',
  rpg: 'rpg',
  tank: 'tank',
  jet: 'jet',
  warship: 'warship',
}

export interface DivEquipBonus {
  bonusAtk: number
  bonusCritRate: number
  bonusCritDmg: number
  bonusArmor: number
  bonusDodge: number
  bonusHitRate: number
  bonusSpeed: number
  bonusHP: number
}

export function getDivisionEquipBonus(div: Division): DivEquipBonus {
  const empty: DivEquipBonus = { bonusAtk: 0, bonusCritRate: 0, bonusCritDmg: 0, bonusArmor: 0, bonusDodge: 0, bonusHitRate: 0, bonusSpeed: 0, bonusHP: 0 }
  if (!div.equipment || div.equipment.length === 0) return empty
  const inv = useInventoryStore.getState()
  const bonus = { ...empty }
  div.equipment.forEach((itemId: string) => {
    const item = inv.items.find((i: any) => i.id === itemId)
    if (!item || item.category !== 'weapon' || !item.weaponSubtype) return
    if (item.durability <= 0) return
    const matchesDivType = WEAPON_DIVISION_MAP[item.weaponSubtype as WeaponSubtype] === div.type
    if (!matchesDivType) return
    const dmg = item.stats.damage || 0
    const crit = item.stats.critRate || 0
    switch (item.weaponSubtype) {
      case 'knife': bonus.bonusArmor += Math.floor(dmg * 0.3); bonus.bonusDodge += Math.floor(dmg * 0.2); bonus.bonusSpeed += 0.1; break
      case 'gun': bonus.bonusHitRate += Math.min(0.15, dmg * 0.002); bonus.bonusSpeed += 0.15; break
      case 'rifle': bonus.bonusAtk += dmg; break
      case 'sniper': bonus.bonusCritRate += crit; bonus.bonusCritDmg += Math.floor(dmg * 0.5); bonus.bonusAtk += Math.floor(dmg * 0.5); break
      case 'rpg': bonus.bonusAtk += Math.floor(dmg * 1.2); break
      case 'tank': bonus.bonusArmor += Math.floor(dmg * 0.4); bonus.bonusHP += Math.floor(dmg * 2); break
      case 'jet': bonus.bonusDodge += Math.floor(dmg * 0.25); bonus.bonusSpeed += 0.2; break
      case 'warship': bonus.bonusArmor += Math.floor(dmg * 0.35); bonus.bonusAtk += Math.floor(dmg * 0.8); break
    }
  })
  return bonus
}

// ====== DIVISION INSTANCE ======

export interface Division {
  id: string
  type: DivisionType
  name: string
  category: DivisionCategory
  ownerId: string        // Player name
  countryCode: string    // Which country's army

  // Troops (display & damage scaling)
  manpower: number       // Current troops
  maxManpower: number    // Max troops

  // Health (combat HP — separate from manpower)
  health: number         // Current HP
  maxHealth: number      // Max HP
  
  equipment: string[]    // Item IDs from player inventory
  experience: number     // 0-100, gained through combat
  stance: 'unassigned' | 'force_pool' | 'reserve' | 'first_line_defense'
  autoTrainingEnabled: boolean  // Passive experience gain when ready

  status: 'training' | 'ready' | 'in_combat' | 'recovering' | 'destroyed' | 'listed'
  trainingProgress: number  // Legacy: used for retreat/recover tick counter
  recoveryTicksNeeded: number  // How many ticks needed to finish recovering
  readyAt: number           // Timestamp: when training finishes (0 = not training)
  reinforcing: boolean
  reinforceProgress: number

  // Combat tracking
  killCount: number
  battlesSurvived: number
  deployedAtTick?: number  // Tick when division was deployed to battle (for recall cooldown)

  // Star quality
  starQuality: StarQuality
  statModifiers: StatModifiers
}

// ====== MILITARY FORCE ======

export type MilitaryRankType = 'private' | 'corporal' | 'sergeant' | 'lieutenant' | 'captain' | 'colonel' | 'general'

export interface ArmyMember {
  playerId: string
  role: MilitaryRankType
  joinedAt: number
  contributedPower: number
  totalDamageThisPeriod: number  // Damage dealt since last salary distribution
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

export type SalaryDistributionMode = 'equal' | 'by-rank' | 'by-damage'

export const RANK_SALARY_WEIGHT: Record<MilitaryRankType, number> = {
  private: 1, corporal: 2, sergeant: 3, lieutenant: 4, captain: 5, colonel: 6, general: 7,
}

export const SALARY_CLAIM_COOLDOWN = 8 * 60 * 60 * 1000 // 8 hours
export const DEFAULT_DISTRIBUTION_INTERVAL = 8 * 60 * 60 * 1000 // 8 hours

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

  // Salary distribution system
  salaryPool: number                             // Money waiting to be distributed
  splitMode: SalaryDistributionMode              // How salary is split among soldiers
  soldierBalances: Record<string, number>         // playerId → claimable balance
  distributionInterval: number                    // ms between distributions
  lastDistribution: number                        // timestamp of last distribution
  lastClaimed: Record<string, number>             // playerId → last claim timestamp
}

// ====== STORE STATE INTERFACE ======

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
  disbandDivision: (divisionId: string) => { success: boolean; message: string }
  recalculateArmyTotals: (armyId: string) => void

  // Combat effects
  applyBattleDamage: (divisionId: string, manpowerLoss: number, equipDamage: number) => void
  recoverDivision: (divisionId: string) => void
  healDivisionsWithFood: (foodType: 'bread' | 'sushi' | 'wagyu') => { success: boolean; message: string }
  reviveDivision: (divisionId: string) => { success: boolean; message: string }

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
  donateEquipmentToVault: (armyId: string, itemId: string) => { success: boolean; message: string }
  sponsorDivision: (armyId: string, divisionType: DivisionType, targetPlayer: string) => { success: boolean; message: string }
  buyArmyBuff: (armyId: string, stat: ArmyBuff['stat'], percentage: number, durationMs: number, cost: number) => { success: boolean; message: string }
  distributeVaultToMembers: (armyId: string, resource: 'money' | 'oil', amount: number) => { success: boolean; message: string }

  // Deployment & Aura
  deployArmyToBattle: (armyId: string, battleId: string) => { success: boolean; message: string }
  deployToRegion: (armyId: string, regionCode: string) => { success: boolean; message: string }
  recallArmy: (armyId: string) => { success: boolean; message: string }
  getArmyAV: (armyId: string) => { air: number; ground: number; tanks: number; navy: number; total: number }
  getCompositionAura: (armyId: string) => { critDmgPct: number; dodgePct: number; attackPct: number; precisionPct: number }

  // Battle Orders
  issueOrder: (armyId: string, orderType: BattleOrder['orderType'], targetRegion: string, bountyPool: number, durationMs: number, damageMultiplier: number) => { success: boolean; message: string }
  recordDamageContribution: (armyId: string, orderId: string, playerId: string, damage: number) => void

  // Salary Distribution
  setSplitMode: (armyId: string, mode: SalaryDistributionMode) => { success: boolean; message: string }
  setDistributionInterval: (armyId: string, intervalMs: number) => { success: boolean; message: string }
  distributeSalary: (armyId: string) => void
  claimSalary: (armyId: string) => { success: boolean; message: string }
  processSalaryTick: () => void
  depositBattleReward: (armyId: string, playerId: string, amount: number) => void
  recordMemberDamage: (armyId: string, playerId: string, damage: number) => void
}
