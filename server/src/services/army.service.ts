/**
 * Army Service — Server-side logic for division recruitment, army management,
 * and related operations. Mirrors client-side army/ store logic.
 */

// ═══════════════════════════════════════════════
//  DIVISION TYPES & TEMPLATES (mirrors army/types.ts)
// ═══════════════════════════════════════════════

export type DivisionType = 'recon' | 'assault' | 'sniper' | 'rpg' | 'jeep' | 'tank' | 'jet' | 'warship'
export type DivisionCategory = 'land' | 'air' | 'naval'

export interface DivisionTemplate {
  id: DivisionType
  name: string
  category: DivisionCategory
  group: 'infantry' | 'mechanized'
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  manpowerCost: number
  recruitCost: { money: number; oil: number; materialX: number; scrap: number }
  trainingTime: number
  popCost: number
  attackSpeed: number
}

export const DIVISION_TEMPLATES: Record<DivisionType, DivisionTemplate> = {
  recon: {
    id: 'recon', name: 'Recon Squad', category: 'land', group: 'infantry',
    atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 1.50,
    healthMult: 24.0, dodgeMult: 1.30, armorMult: 1.00,
    manpowerCost: 200, trainingTime: 25,
    recruitCost: { money: 40000, oil: 400, materialX: 150, scrap: 200 },
    popCost: 1, attackSpeed: 1.5,
  },
  assault: {
    id: 'assault', name: 'Assault Infantry', category: 'land', group: 'infantry',
    atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 1.60,
    healthMult: 28.8, dodgeMult: 0.90, armorMult: 1.10,
    manpowerCost: 350, trainingTime: 30,
    recruitCost: { money: 60000, oil: 600, materialX: 250, scrap: 350 },
    popCost: 1, attackSpeed: 1,
  },
  sniper: {
    id: 'sniper', name: 'Sniper Division', category: 'land', group: 'infantry',
    atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.56, critDmgMult: 2.50,
    healthMult: 24.0, dodgeMult: 0.90, armorMult: 0.80,
    manpowerCost: 150, trainingTime: 40,
    recruitCost: { money: 80000, oil: 500, materialX: 300, scrap: 400 },
    popCost: 1, attackSpeed: 0.6,
  },
  rpg: {
    id: 'rpg', name: 'RPG Squadron', category: 'land', group: 'infantry',
    atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 2.00,
    healthMult: 30.0, dodgeMult: 0.70, armorMult: 1.30,
    manpowerCost: 250, trainingTime: 35,
    recruitCost: { money: 100000, oil: 800, materialX: 400, scrap: 500 },
    popCost: 1, attackSpeed: 0.8,
  },
  jeep: {
    id: 'jeep', name: 'Recon Jeeps', category: 'land', group: 'mechanized',
    atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 1.70,
    healthMult: 30.0, dodgeMult: 1.50, armorMult: 1.50,
    manpowerCost: 150, trainingTime: 35,
    recruitCost: { money: 100000, oil: 1500, materialX: 600, scrap: 400 },
    popCost: 2, attackSpeed: 1.3,
  },
  tank: {
    id: 'tank', name: 'Tank Battalion', category: 'land', group: 'mechanized',
    atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 1.80,
    healthMult: 36.0, dodgeMult: 0.80, armorMult: 2.00,
    manpowerCost: 200, trainingTime: 50,
    recruitCost: { money: 150000, oil: 2500, materialX: 1000, scrap: 600 },
    popCost: 2, attackSpeed: 0.5,
  },
  jet: {
    id: 'jet', name: 'Jet Fighters', category: 'air', group: 'mechanized',
    atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.75, critDmgMult: 2.80,
    healthMult: 26.0, dodgeMult: 1.40, armorMult: 1.00,
    manpowerCost: 100, trainingTime: 60,
    recruitCost: { money: 200000, oil: 3000, materialX: 1200, scrap: 700 },
    popCost: 2, attackSpeed: 0.7,
  },
  warship: {
    id: 'warship', name: 'Warship Fleet', category: 'naval', group: 'mechanized',
    atkDmgMult: 0.30, hitRate: 0.60, critRateMult: 1.35, critDmgMult: 2.20,
    healthMult: 40.0, dodgeMult: 0.70, armorMult: 2.50,
    manpowerCost: 250, trainingTime: 60,
    recruitCost: { money: 250000, oil: 4000, materialX: 1500, scrap: 800 },
    popCost: 2, attackSpeed: 0.4,
  },
}

export const VALID_DIVISION_TYPES = Object.keys(DIVISION_TEMPLATES) as DivisionType[]

// ═══════════════════════════════════════════════
//  STAR QUALITY SYSTEM
// ═══════════════════════════════════════════════

export type StarQuality = 1 | 2 | 3 | 4 | 5

export interface StatModifiers {
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  attackSpeed: number
}

const STAR_RANGES: Record<StarQuality, [number, number]> = {
  1: [-0.07, -0.04],
  2: [-0.03, 0.01],
  3: [0.01, 0.05],
  4: [0.04, 0.08],
  5: [0.06, 0.08],
}

export function rollStarQuality(investmentAmount?: number): { star: StarQuality; modifiers: StatModifiers } {
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

// ═══════════════════════════════════════════════
//  EFFECTIVE STATS
// ═══════════════════════════════════════════════

export function getEffectiveManpower(template: DivisionTemplate): number {
  return template.manpowerCost
}

export function getEffectiveHealth(template: DivisionTemplate, maxStamina: number = 100): number {
  return Math.floor(template.healthMult * maxStamina)
}

// ═══════════════════════════════════════════════
//  MILITARY RANKS
// ═══════════════════════════════════════════════

export type MilitaryRankType = 'private' | 'corporal' | 'sergeant' | 'lieutenant' | 'captain' | 'colonel' | 'general'

const RANK_ORDER: MilitaryRankType[] = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general']

export function getRankIndex(rank: string): number {
  return RANK_ORDER.indexOf(rank as MilitaryRankType)
}

export function getMilitaryRankForLevel(level: number): MilitaryRankType {
  if (level >= 50) return 'general'
  if (level >= 40) return 'colonel'
  if (level >= 30) return 'captain'
  if (level >= 20) return 'lieutenant'
  if (level >= 10) return 'sergeant'
  if (level >= 5) return 'corporal'
  return 'private'
}

// ═══════════════════════════════════════════════
//  POP CAP
// ═══════════════════════════════════════════════

export const BASE_POP_CAP = 10

export function getMaxPopCap(playerLevel: number): number {
  return BASE_POP_CAP + Math.floor(playerLevel / 5) * 2
}
