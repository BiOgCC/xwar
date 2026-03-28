import type { ArmyState, DivisionType, Division } from './types'
import { DIVISION_TEMPLATES, rollStarQuality, getEffectiveManpower, getEffectiveHealth } from './types'
import { usePlayerStore, getMilitaryRank } from '../playerStore'
import { useInventoryStore } from '../inventoryStore'
import { useWorldStore } from '../worldStore'
import { useResearchStore } from '../researchStore'
import type { StoreApi } from 'zustand'

// Shared counter — must be module-level to persist across calls
let divCounter = 0

export function initDivCounter(count: number) {
  divCounter = count
}

export function createRecruitmentSlice(
  set: StoreApi<ArmyState>['setState'],
  get: StoreApi<ArmyState>['getState']
) {
  return {
    recruitDivision: (type: DivisionType, armyId?: string) => {
      const template = DIVISION_TEMPLATES[type]
      const player = usePlayerStore.getState()
      const baseCost = template.recruitCost

      const cost = {
        money: baseCost.money,
        oil: baseCost.oil,
        materialX: baseCost.materialX,
        scrap: baseCost.scrap,
      }

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
      player.spendScrap(cost.scrap)

      // Route recruit costs: 33% to army vault, 64% to country treasury
      const playerCountry = player.countryCode || 'US'
      const moneyToVault = Math.floor(cost.money * 0.33)
      const moneyToTreasury = Math.floor(cost.money * 0.64)

      // If player is in an army + armyId provided, route to that vault
      if (armyId) {
        set(s => {
          const army = s.armies[armyId]
          if (!army) return s
          return {
            armies: {
              ...s.armies,
              [armyId]: { ...army, vault: { ...army.vault, money: army.vault.money + moneyToVault } },
            },
          }
        })
      } else {
        // If no army, find the first army of the player's country
        const armies = get().getArmiesForCountry(playerCountry)
        if (armies.length > 0) {
          const firstArmy = armies[0]
          set(s => ({
            armies: {
              ...s.armies,
              [firstArmy.id]: { ...s.armies[firstArmy.id], vault: { ...s.armies[firstArmy.id].vault, money: s.armies[firstArmy.id].vault.money + moneyToVault } },
            },
          }))
        }
      }
      useWorldStore.getState().addTreasuryTax(playerCountry, moneyToTreasury)

      const id = `div_${++divCounter}_${Date.now()}`
      const { star, modifiers } = rollStarQuality()

      let trainingMs = template.trainingTime * 15_000

      const division: Division = {
        id,
        type,
        name: `${template.name} #${divCounter}`,
        category: template.category,
        ownerId: player.name,
        countryCode: player.countryCode || 'US',
        manpower: getEffectiveManpower(template),
        maxManpower: getEffectiveManpower(template),
        health: getEffectiveHealth(template),
        maxHealth: getEffectiveHealth(template),
        equipment: [],
        experience: 0,
        stance: 'unassigned',
        autoTrainingEnabled: false,
        status: 'training',
        trainingProgress: 0,
        recoveryTicksNeeded: 0,
        readyAt: Date.now() + trainingMs,
        reinforcing: false,
        reinforceProgress: 0,
        killCount: 0,
        battlesSurvived: 0,
        starQuality: star,
        statModifiers: modifiers,
        deployedToPMC: false,
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

    trainDivision: (divisionId: string) => {
      set(state => {
        const div = state.divisions[divisionId]
        if (!div || div.status !== 'training') return state

        const template = DIVISION_TEMPLATES[div.type]
        const newProgress = div.trainingProgress + 1
        const isComplete = newProgress >= template.trainingTime

        // Specialization hook: military XP on training complete
        if (isComplete) {
          try {
            import('../specializationStore').then(({ useSpecializationStore }) => {
              useSpecializationStore.getState().recordTrainDivision()
            }).catch(() => {})
          } catch (_) {}
        }

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

    processTrainingTick: () => {
      set(state => {
        const newDivisions = { ...state.divisions }
        let hasChanges = false

        Object.values(newDivisions).forEach(div => {
          let updated = { ...div }
          let changed = false

          // --- Recalculate maxManpower and maxHealth from current player maxStamina ---
          const template = DIVISION_TEMPLATES[div.type]
          if (template) {
            const newMaxMp = getEffectiveManpower(template)
            const newMaxHp = getEffectiveHealth(template)
            if (newMaxMp !== div.maxManpower) {
              updated = { ...updated, maxManpower: newMaxMp, manpower: newMaxMp }
              changed = true
            }
            if (newMaxHp !== div.maxHealth) {
              const hpRatio = div.maxHealth > 0 ? div.health / div.maxHealth : 1
              updated = { ...updated, maxHealth: newMaxHp, health: Math.max(1, Math.floor(newMaxHp * hpRatio)) }
              changed = true
            }
          }

          // --- Training: timestamp-based, check if readyAt has passed ---
          if (div.status === 'training') {
            if (div.readyAt > 0 && Date.now() >= div.readyAt) {
              updated = { ...updated, status: 'ready', readyAt: 0 }
              changed = true
            }
          }

          // --- Recovering: dynamic ticks based on recoveryTicksNeeded ---
          if (div.status === 'recovering') {
            const recoverTicks = (div.trainingProgress || 0) + 1
            const needed = div.recoveryTicksNeeded || 3
            if (recoverTicks >= needed) {
              updated = { ...updated, status: 'ready', trainingProgress: 0, recoveryTicksNeeded: 0 }
            } else {
              updated = { ...updated, trainingProgress: recoverTicks }
            }
            changed = true
          }

          // --- Auto-training: +0.1 exp per tick (max 2 divisions per player) ---
          if (div.status === 'ready' && div.autoTrainingEnabled && div.experience < 100) {
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

    // Sponsor a division for another player
    sponsorDivision: (armyId: string, divisionType: DivisionType, targetPlayer: string) => {
      const player = usePlayerStore.getState()
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }

      const template = DIVISION_TEMPLATES[divisionType]
      const cost = template.recruitCost

      if (player.money < cost.money) return { success: false, message: 'Not enough money.' }
      if (player.oil < cost.oil) return { success: false, message: 'Not enough oil.' }
      if (player.materialX < cost.materialX) return { success: false, message: 'Not enough Material X.' }
      if (player.scrap < cost.scrap) return { success: false, message: 'Not enough scrap.' }

      player.spendMoney(cost.money)
      player.spendOil(cost.oil)
      player.spendMaterialX(cost.materialX)
      player.spendScrap(cost.scrap)

      const id = `div_${++divCounter}_${Date.now()}`
      const { star: sStar, modifiers: sMods } = rollStarQuality()
      const division: Division = {
        id, type: divisionType, name: `${template.name} (Sponsored)`,
        category: template.category,
        ownerId: targetPlayer,
        countryCode: army.countryCode,
        manpower: getEffectiveManpower(template), maxManpower: getEffectiveManpower(template),
        health: getEffectiveHealth(template), maxHealth: getEffectiveHealth(template),
        equipment: [], experience: 0,
        status: 'training', trainingProgress: 0, recoveryTicksNeeded: 0,
        reinforcing: false, reinforceProgress: 0,
        readyAt: 0,
        stance: 'unassigned' as const,
        autoTrainingEnabled: false,
        killCount: 0, battlesSurvived: 0,
        starQuality: sStar, statModifiers: sMods,
        deployedToPMC: false,
      }

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
  }
}
