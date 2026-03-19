import type { ArmyState, RANK_SALARY_WEIGHT as _RANK_SALARY_WEIGHT, MilitaryRankType, SalaryDistributionMode } from './types'
import { RANK_SALARY_WEIGHT, SALARY_CLAIM_COOLDOWN } from './types'
import { usePlayerStore } from '../playerStore'
import type { StoreApi } from 'zustand'

export function createSalarySlice(
  set: StoreApi<ArmyState>['setState'],
  get: StoreApi<ArmyState>['getState']
) {
  return {
    setSplitMode: (armyId: string, mode: SalaryDistributionMode) => {
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }
      const player = usePlayerStore.getState()
      if (army.commanderId !== player.name) return { success: false, message: 'Only the commander can change split mode.' }
      set(s => ({ armies: { ...s.armies, [armyId]: { ...s.armies[armyId], splitMode: mode } } }))
      return { success: true, message: `Salary split mode set to: ${mode}` }
    },

    setDistributionInterval: (armyId: string, intervalMs: number) => {
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }
      const player = usePlayerStore.getState()
      if (army.commanderId !== player.name) return { success: false, message: 'Only the commander can change distribution interval.' }
      const clamped = Math.max(4 * 3600000, Math.min(24 * 3600000, intervalMs)) // 4h–24h
      set(s => ({ armies: { ...s.armies, [armyId]: { ...s.armies[armyId], distributionInterval: clamped } } }))
      return { success: true, message: `Distribution interval set to ${Math.round(clamped / 3600000)}h` }
    },

    distributeSalary: (armyId: string) => {
      const state = get()
      const army = state.armies[armyId]
      if (!army || army.salaryPool <= 0 || army.members.length === 0) return

      const pool = army.salaryPool
      const newBalances = { ...army.soldierBalances }

      switch (army.splitMode) {
        case 'equal': {
          const share = Math.floor(pool / army.members.length)
          army.members.forEach(m => {
            newBalances[m.playerId] = (newBalances[m.playerId] || 0) + share
          })
          break
        }
        case 'by-rank': {
          const totalWeight = army.members.reduce((s, m) => s + (RANK_SALARY_WEIGHT[m.role] || 1), 0)
          army.members.forEach(m => {
            const weight = RANK_SALARY_WEIGHT[m.role] || 1
            const share = Math.floor(pool * (weight / totalWeight))
            newBalances[m.playerId] = (newBalances[m.playerId] || 0) + share
          })
          break
        }
        case 'by-damage': {
          const totalDmg = army.members.reduce((s, m) => s + (m.totalDamageThisPeriod || 0), 0)
          if (totalDmg <= 0) {
            const share = Math.floor(pool / army.members.length)
            army.members.forEach(m => {
              newBalances[m.playerId] = (newBalances[m.playerId] || 0) + share
            })
          } else {
            army.members.forEach(m => {
              const share = Math.floor(pool * ((m.totalDamageThisPeriod || 0) / totalDmg))
              newBalances[m.playerId] = (newBalances[m.playerId] || 0) + share
            })
          }
          break
        }
      }

      const updatedMembers = army.members.map(m => ({ ...m, totalDamageThisPeriod: 0 }))
      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: {
            ...s.armies[armyId],
            salaryPool: 0,
            soldierBalances: newBalances,
            lastDistribution: Date.now(),
            members: updatedMembers,
          },
        },
      }))
    },

    claimSalary: (armyId: string) => {
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }
      const player = usePlayerStore.getState()
      const balance = army.soldierBalances[player.name] || 0
      if (balance <= 0) return { success: false, message: 'No salary to claim.' }
      const lastClaim = army.lastClaimed[player.name] || 0
      if (Date.now() - lastClaim < SALARY_CLAIM_COOLDOWN) {
        const remaining = Math.ceil((SALARY_CLAIM_COOLDOWN - (Date.now() - lastClaim)) / 3600000)
        return { success: false, message: `Claim cooldown: ${remaining}h remaining.` }
      }
      player.earnMoney(balance)
      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: {
            ...s.armies[armyId],
            soldierBalances: { ...s.armies[armyId].soldierBalances, [player.name]: 0 },
            lastClaimed: { ...s.armies[armyId].lastClaimed, [player.name]: Date.now() },
          },
        },
      }))
      return { success: true, message: `Claimed $${balance.toLocaleString()} salary!` }
    },

    processSalaryTick: () => {
      const state = get()
      const now = Date.now()
      Object.values(state.armies).forEach(army => {
        if (army.salaryPool > 0 && now >= army.lastDistribution + army.distributionInterval) {
          get().distributeSalary(army.id)
        }
      })
    },

    depositBattleReward: (armyId: string, _playerId: string, amount: number) => {
      if (amount <= 0) return
      set(s => {
        const army = s.armies[armyId]
        if (!army) return s
        return {
          armies: {
            ...s.armies,
            [armyId]: {
              ...army,
              soldierBalances: {
                ...army.soldierBalances,
                [_playerId]: (army.soldierBalances[_playerId] || 0) + amount,
              },
            },
          },
        }
      })
    },

    recordMemberDamage: (armyId: string, playerId: string, damage: number) => {
      if (damage <= 0) return
      set(s => {
        const army = s.armies[armyId]
        if (!army) return s
        return {
          armies: {
            ...s.armies,
            [armyId]: {
              ...army,
              members: army.members.map(m =>
                m.playerId === playerId
                  ? { ...m, totalDamageThisPeriod: (m.totalDamageThisPeriod || 0) + damage }
                  : m
              ),
            },
          },
        }
      })
    },
  }
}
