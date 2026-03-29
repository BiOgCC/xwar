// ═══════════════════════════════════════════════════════════
// ARMY STORE STUB — provides no-op implementations for all
// symbols that were previously imported from src/stores/army/*.
// This prevents import errors during the transition period
// while the division system is being fully purged from all
// consuming files.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand'

// ── Type stubs ──

export type DivisionType =
  | 'recon' | 'assault' | 'sniper' | 'rpg'
  | 'jeep' | 'tank' | 'jet' | 'warship'
  | 'submarine' | 'artillery' | 'medic' | 'engineering'

export type DivisionCategory = 'infantry' | 'mechanized' | 'air' | 'naval'
export type DivisionStatus = 'ready' | 'training' | 'in_combat' | 'recovering' | 'destroyed' | 'scavenging' | 'patrolling' | 'listed'
export type StarQuality = 0 | 1 | 2 | 3 | 4 | 5

export interface StatModifiers {
  atkDmgMult: number
  defDmgMult: number
  manpowerMult: number
  healthMult: number
  critChance: number
  dodgeChance: number
}

export interface Division {
  id: string
  name: string
  type: DivisionType
  category: DivisionCategory
  countryCode: string
  armyId: string | null
  ownerId: string
  level: number
  xp: number
  manpower: number
  maxManpower: number
  health: number
  maxHealth: number
  status: DivisionStatus
  starQuality: StarQuality
  starModifiers: StatModifiers
  equipmentSlots: Record<string, string | null>
  awolTimestamp: number | null
  deployedAtTick?: number
  trainingProgress: number
  stance: string
  experience: number
  killCount: number
}

export interface Army {
  id: string
  name: string
  countryCode: string
  ownerId: string
  commanderId: string
  members: { playerId: string; role: string }[]
  divisionIds: string[]
  vault: { money: number; oil: number; scrap: number; materialX: number }
  autoDefenseLimit: number
}

// ── Template stub ──

export const DIVISION_TEMPLATES: Record<string, any> = {}

// ── Helper stubs ──

export function rollStarQuality(_level?: number): { star: StarQuality; modifiers: StatModifiers } {
  return { star: 0, modifiers: { atkDmgMult: 1, defDmgMult: 1, manpowerMult: 1, healthMult: 1, critChance: 0, dodgeChance: 0 } }
}
export function rollDebris(): { scrap: number; materialX: number; militaryBoxes: number } {
  return { scrap: 0, materialX: 0, militaryBoxes: 0 }
}
export function getDivisionEquipBonus(_div: any): any {
  return { atk: 0, def: 0, hp: 0, crit: 0, dodge: 0, manpower: 0, speed: 0, range: 0 }
}
export function getEffectiveManpower(_div: any): number { return 0 }
export function getEffectiveHealth(_div: any): number { return 0 }

// ── Store stub ──

export interface ArmyState {
  armies: Record<string, Army>
  divisions: Record<string, Division>
  getPlayerPopCap: () => { used: number; max: number }
  applyBattleDamage: (divId: string, damage: number, equipDmg: number) => void
  [key: string]: any
}

export const useArmyStore = create<ArmyState>(() => ({
  armies: {},
  divisions: {},
  getPlayerPopCap: () => ({ used: 0, max: 100 }),
  applyBattleDamage: () => {},
}))
