import type { ArmyState } from './types'
import { DIVISION_TEMPLATES, rollStarQuality } from './types'
import { usePlayerStore } from '../playerStore'
import { useInventoryStore } from '../inventoryStore'
import { useResearchStore } from '../researchStore'
import type { StoreApi } from 'zustand'

export function createCombatSlice(
  set: StoreApi<ArmyState>['setState'],
  get: StoreApi<ArmyState>['getState']
) {
  return {
    applyBattleDamage: (divisionId: string, manpowerLoss: number, equipDamage: number) => {
      set(state => {
        const div = state.divisions[divisionId]
        if (!div) return state

        const newHealth = Math.max(0, div.health - manpowerLoss)
        // Degrade equipment
        if (equipDamage > 0 && div.equipment.length > 0) {
          const invStore = useInventoryStore.getState()
          invStore.degradeEquippedItems(equipDamage)
        }

        const isDestroyed = newHealth <= 0
        return {
          divisions: {
            ...state.divisions,
            [divisionId]: {
              ...div,
              health: newHealth,
              status: isDestroyed ? 'destroyed' : div.status,
            },
          },
        }
      })
    },

    recoverDivision: (divisionId: string) => {
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

    healDivisionsWithFood: (foodType: 'bread' | 'sushi' | 'wagyu') => {
      const player = usePlayerStore.getState()
      const healPct = foodType === 'wagyu' ? 0.03 : foodType === 'sushi' ? 0.02 : 0.01
      const state = get()
      const now = Date.now()
      const TWELVE_HOURS = 12 * 60 * 60 * 1000

      const myDivs = Object.values(state.divisions).filter(
        d => d.ownerId === player.name && d.status === 'in_combat' && d.health < d.maxHealth &&
             (!d.lastHealedAt || now - d.lastHealedAt >= TWELVE_HOURS)
      )

      if (myDivs.length === 0) return { success: false, message: 'No damaged deployed divisions eligible for healing (12h cooldown).' }

      let totalHealed = 0
      const newDivisions = { ...state.divisions }
      for (const div of myDivs) {
        const healAmount = Math.floor(div.maxHealth * healPct)
        const newHp = Math.min(div.maxHealth, div.health + healAmount)
        const actualHeal = newHp - div.health
        totalHealed += actualHeal
        newDivisions[div.id] = { ...div, health: newHp, lastHealedAt: now }
      }

      set({ divisions: newDivisions })

      const label = foodType === 'wagyu' ? '🥩 Wagyu' : foodType === 'sushi' ? '🍣 Sushi' : '🍞 Bread'
      return { success: true, message: `${label} healed ${myDivs.length} division${myDivs.length > 1 ? 's' : ''} (+${totalHealed} HP)` }
    },

    reviveDivision: (divisionId: string) => {
      const state = get()
      const div = state.divisions[divisionId]
      if (!div) return { success: false, message: 'Division not found.' }
      if (div.status !== 'destroyed') return { success: false, message: 'Division is not destroyed.' }

      const template = DIVISION_TEMPLATES[div.type]
      // Apply Economic Theory research bonus to revive cost
      const ecoBonuses = useResearchStore.getState().getEconomyBonuses(div.countryCode || 'US')
      const reviveCost = Math.floor(template.recruitCost.money * 0.5 * ecoBonuses.reviveCostMult) // 50% of recruit cost × research

      const player = usePlayerStore.getState()
      if (player.money < reviveCost) return { success: false, message: `Need $${reviveCost.toLocaleString()} to revive. You have $${player.money.toLocaleString()}.` }

      player.spendMoney(reviveCost)

      const newExp = Math.floor(div.experience / 2)
      const oldStar = div.starQuality
      const { star: newStar, modifiers: newMods } = rollStarQuality()
      const revivePct = 0.02 + Math.random() * 0.14
      const newHealth = Math.max(1, Math.floor(div.maxHealth * revivePct))

      set({
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            status: 'ready',
            health: newHealth,
            experience: newExp,
            starQuality: newStar,
            statModifiers: newMods,
          },
        },
      })

      const starChange = newStar > oldStar ? `⬆ ${oldStar}→${newStar}★` : newStar < oldStar ? `⬇ ${oldStar}→${newStar}★` : `${newStar}★`
      const mpPct = Math.floor(revivePct * 100)
      return { success: true, message: `Revived! ${starChange} | XP ${Math.floor(div.experience)}→${newExp} | ${mpPct}% HP | -$${reviveCost.toLocaleString()}` }
    },

    rebuildDivision: (divisionId: string) => {
      const div = get().divisions[divisionId]
      if (!div) return { success: false, message: 'Division not found.' }
      if (div.health >= div.maxHealth) return { success: false, message: 'Division is at full health.' }
      if (div.status === 'destroyed') return { success: false, message: 'Division is destroyed. Use REVIVE instead.' }
      if (div.status === 'training') return { success: false, message: 'Division is still training.' }
      if (div.status === 'recovering') return { success: false, message: 'Division is already recovering.' }

      const player = usePlayerStore.getState()
      if (player.bread <= 0) return { success: false, message: 'No bread available.' }

      player.consumeFood('bread')

      const missingPct = Math.ceil(((div.maxHealth - div.health) / div.maxHealth) * 100)
      const recoveryTicks = Math.max(1, missingPct * 2)

      set(state => ({
        divisions: {
          ...state.divisions,
          [divisionId]: {
            ...div,
            health: div.maxHealth,
            status: 'recovering',
            trainingProgress: 0,
            recoveryTicksNeeded: recoveryTicks,
          },
        },
      }))

      const recoverTimeSecs = recoveryTicks * 15
      const recoverMins = Math.floor(recoverTimeSecs / 60)
      return { success: true, message: `Rebuilding! 🍞 -1 bread | ${missingPct}% damage → ${recoveryTicks} ticks (~${recoverMins}m) recovery` }
    },

    setDivisionStance: (divisionId: string, stance: 'unassigned' | 'force_pool' | 'reserve' | 'first_line_defense') => {
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

    toggleAutoTraining: (divisionId: string) => {
      const div = get().divisions[divisionId]
      if (!div) return { success: false, message: 'Division not found.' }
      if (div.status !== 'ready') return { success: false, message: 'Division must be ready to auto-train.' }

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

    reinforceDivision: (divisionId: string) => {
      const div = get().divisions[divisionId]
      if (!div) return { success: false, message: 'Division not found.' }
      if (div.status === 'destroyed') return { success: false, message: 'Division is destroyed.' }
      if (div.status === 'training') return { success: false, message: 'Division is still training.' }
      if (div.reinforcing) return { success: false, message: 'Already being reinforced.' }
      if (div.manpower >= div.maxManpower) return { success: false, message: 'Division is at full strength.' }

      const template = DIVISION_TEMPLATES[div.type]
      const missingPct = (div.maxManpower - div.manpower) / div.maxManpower
      // Apply Economic Theory research bonus to reinforce money cost
      const rEcoBonuses = useResearchStore.getState().getEconomyBonuses(div.countryCode || 'US')
      const reinforceCostMoney = Math.ceil(template.recruitCost.money * missingPct * rEcoBonuses.recruitCostMult)
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
  }
}
