import { create } from 'zustand'
import { usePlayerStore } from './playerStore'

export type MilitarySkill = 'attack' | 'critRate' | 'critDamage' | 'health' | 'hunger' | 'armor' | 'dodge'
export type EconomicSkill = 'work' | 'entrepreneurship' | 'production' | 'prospection' | 'industrialist'
export type SkillName = MilitarySkill | EconomicSkill

export const MILITARY_SKILLS: { key: MilitarySkill; label: string; icon: string; desc: string }[] = [
  { key: 'attack', label: 'Attack', icon: '⚔️', desc: 'Increases base attack damage' },
  { key: 'critRate', label: 'Crit Rate', icon: '🎯', desc: 'Increases critical hit chance' },
  { key: 'critDamage', label: 'Crit Damage', icon: '💥', desc: 'Increases critical hit multiplier' },
  { key: 'health', label: 'Health', icon: '❤️', desc: 'Increases max health bar' },
  { key: 'hunger', label: 'Hunger', icon: '🍖', desc: 'Increases max hunger bar' },
  { key: 'armor', label: 'Armor', icon: '🛡️', desc: 'Reduces incoming damage' },
  { key: 'dodge', label: 'Dodge', icon: '💨', desc: 'Chance to avoid damage' },
]

export const ECONOMIC_SKILLS: { key: EconomicSkill; label: string; icon: string; desc: string }[] = [
  { key: 'work', label: 'Work', icon: '🔨', desc: 'Increases max work bar' },
  { key: 'entrepreneurship', label: 'Enterprise', icon: '💼', desc: 'Increases max entrepreneurship bar' },
  { key: 'production', label: 'Production', icon: '⚙️', desc: 'Increases production output' },
  { key: 'prospection', label: 'Prospection', icon: '⛏️', desc: 'Chance to find country resource deposit when working' },
  { key: 'industrialist', label: 'Industrialist', icon: '₿', desc: 'Chance to find bitcoin when producing' },
]

export interface SkillsState {
  military: Record<MilitarySkill, number>
  economic: Record<EconomicSkill, number>
  getSkillCost: (currentLevel: number) => number
  assignSkillPoint: (tree: 'military' | 'economic', skill: SkillName) => boolean
  getLevel: (skill: SkillName) => number
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  military: {
    attack: 0,
    critRate: 0,
    critDamage: 0,
    health: 0,
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
    const state = get()
    const currentLevel = tree === 'military'
      ? state.military[skill as MilitarySkill]
      : state.economic[skill as EconomicSkill]

    if (currentLevel >= 10) return false

    const cost = state.getSkillCost(currentLevel)
    const player = usePlayerStore.getState()

    if (player.skillPoints < cost) return false

    // Spend skill points
    usePlayerStore.setState({ skillPoints: player.skillPoints - cost })

    if (tree === 'military') {
      set((s) => ({
        military: { ...s.military, [skill]: currentLevel + 1 },
      }))
      // Update player bar maximums based on skills
      if (skill === 'health') {
        usePlayerStore.setState({ maxHealth: 100 + (currentLevel + 1) * 20 })
      } else if (skill === 'hunger') {
        usePlayerStore.setState({ maxHunger: 100 + (currentLevel + 1) * 15 })
      }
    } else {
      set((s) => ({
        economic: { ...s.economic, [skill]: currentLevel + 1 },
      }))
      if (skill === 'work') {
        usePlayerStore.setState({ maxWork: 100 + (currentLevel + 1) * 15 })
      } else if (skill === 'entrepreneurship') {
        usePlayerStore.setState({ maxEntrepreneurship: 100 + (currentLevel + 1) * 15 })
      }
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
