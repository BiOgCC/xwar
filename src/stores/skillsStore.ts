import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { rateLimiter } from '../engine/AntiExploit'

export type MilitarySkill = 'attack' | 'critRate' | 'critDamage' | 'precision' | 'stamina' | 'hunger' | 'armor' | 'dodge'
export type EconomicSkill = 'work' | 'entrepreneurship' | 'production' | 'prospection' | 'industrialist'
export type SkillName = MilitarySkill | EconomicSkill

export const MILITARY_SKILLS: { key: MilitarySkill; label: string; icon: string; desc: string }[] = [
  { key: 'attack', label: 'Attack', icon: '⚔️', desc: 'Increases base attack damage (+20 per level)' },
  { key: 'critRate', label: 'Crit Rate', icon: '🎯', desc: 'Increases critical hit chance (+5% per level)' },
  { key: 'critDamage', label: 'Crit Damage', icon: '💥', desc: 'Increases critical hit multiplier (+0.10x per level)' },
  { key: 'precision', label: 'Hit Rate', icon: '💢', desc: 'Hit rate +5%/lvl (cap 90%). Excess → +0.5% crit per 1% overflow' },
  { key: 'stamina', label: 'Stamina', icon: '⚡', desc: 'Increases max stamina bar (+20 per level)' },
  { key: 'hunger', label: 'Hunger', icon: '🍖', desc: 'Increases max hunger bar (+1 per level)' },
  { key: 'armor', label: 'Armor', icon: '🛡️', desc: 'Reduces incoming damage (% mitigation, +5 armor per level)' },
  { key: 'dodge', label: 'Dodge', icon: '💨', desc: 'Chance to avoid damage (+3% per level)' },
]

export const ECONOMIC_SKILLS: { key: EconomicSkill; label: string; icon: string; desc: string }[] = [
  { key: 'work', label: 'Work', icon: '🔨', desc: 'Increases max work bar (+20 per level). 1% per level chance for double pay when working for others.' },
  { key: 'entrepreneurship', label: 'Enterprise', icon: '💼', desc: 'Increases max entrepreneurship bar (+15 per level). 1% per level chance for double Production Points on enterprise.' },
  { key: 'production', label: 'Production', icon: '⚙️', desc: 'Increases production bar fill per work/enterprise action (+2 per level)' },
  { key: 'prospection', label: 'Prospection', icon: '⛏️', desc: '2% chance per level to discover deposits on work/enterprise (requires Prospection Center). 3% per level bonus scrap on work.' },
  { key: 'industrialist', label: 'Industrialist', icon: '🏭', desc: '1% per level chance for scrap (100-600) and matX (20-80) on produce. 2% red bullet chance per level (max 20%). 20% superforge on craft (+9-16% stats).' },
]

export interface SkillsState {
  military: Record<MilitarySkill, number>
  economic: Record<EconomicSkill, number>
  getSkillCost: (currentLevel: number) => number
  assignSkillPoint: (tree: 'military' | 'economic', skill: SkillName) => boolean
  resetSkills: (tree: 'military' | 'economic') => boolean
  getLevel: (skill: SkillName) => number
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  military: {
    attack: 0,
    critRate: 0,
    critDamage: 0,
    precision: 0,
    stamina: 0,
    hunger: 0,
    armor: 0,
    dodge: 0,
  },

  economic: {
    work: 0,
    entrepreneurship: 0,
    production: 0,
    prospection: 0,
    industrialist: 0,
  },

  getSkillCost: (currentLevel: number) => {
    // Cost to go from currentLevel to currentLevel+1 = currentLevel + 1
    // So lvl 0→1 costs 1 SP, lvl 1→2 costs 2 SP, ..., lvl 9→10 costs 10 SP
    return currentLevel + 1
  },

  assignSkillPoint: (tree, skill) => {
    // Rate limit: 500ms between skill assignments
    if (!rateLimiter.check('assignSkill')) return false

    const state = get()
    const currentLevel = tree === 'military'
      ? state.military[skill as MilitarySkill]
      : state.economic[skill as EconomicSkill]

    if (currentLevel >= 10) return false

    const cost = state.getSkillCost(currentLevel)
    const player = usePlayerStore.getState()

    if (player.skillPoints < cost) return false

    // Spend skill points (use updater to avoid race condition)
    usePlayerStore.setState(s => ({ skillPoints: s.skillPoints - cost }))

    if (tree === 'military') {
      set((s) => ({
        military: { ...s.military, [skill]: currentLevel + 1 },
      }))
      // Update player bar maximums based on skills
      if (skill === 'stamina') {
        usePlayerStore.setState({ maxStamina: 120 + (currentLevel + 1) * 24 })
      } else if (skill === 'hunger') {
        usePlayerStore.setState({ maxHunger: 6 + (currentLevel + 1) })
      }
    } else {
      set((s) => ({
        economic: { ...s.economic, [skill]: currentLevel + 1 },
      }))
      if (skill === 'work') {
        usePlayerStore.setState({ maxWork: 120 + (currentLevel + 1) * 24 })
      } else if (skill === 'entrepreneurship') {
        usePlayerStore.setState({ maxEntrepreneurship: 120 + (currentLevel + 1) * 18 })
      }
    }
    return true
  },

  resetSkills: (tree) => {
    const RESPEC_COST = 50000
    const player = usePlayerStore.getState()
    if (player.money < RESPEC_COST) return false

    const state = get()
    // Calculate total SP to refund
    const skills = tree === 'military' ? state.military : state.economic
    let refund = 0
    for (const level of Object.values(skills)) {
      for (let i = 0; i < level; i++) refund += i + 1  // sum of costs: 1+2+...+level
    }

    // Spend gold
    usePlayerStore.getState().spendMoney(RESPEC_COST)
    usePlayerStore.setState(s => ({ skillPoints: s.skillPoints + refund }))

    if (tree === 'military') {
      // Reset military skills and revert bar maxes
      set({
        military: { attack: 0, critRate: 0, critDamage: 0, precision: 0, stamina: 0, hunger: 0, armor: 0, dodge: 0 },
      })
      usePlayerStore.setState({ maxStamina: 120, maxHunger: 6 })
    } else {
      // Reset economic skills and revert bar maxes
      set({
        economic: { work: 0, entrepreneurship: 0, production: 0, prospection: 0, industrialist: 0 },
      })
      usePlayerStore.setState({ maxWork: 120, maxEntrepreneurship: 120 })
    }
    return true
  },

  getLevel: (skill) => {
    const s = get()
    if (skill in s.military) return s.military[skill as MilitarySkill]
    if (skill in s.economic) return s.economic[skill as EconomicSkill]
    return 0
  },
}))
