import type { ArmyState, Division, Army } from './types'
import { DIVISION_TEMPLATES } from './types'
import { usePlayerStore } from '../playerStore'
import { useCompanyStore } from '../companyStore'
import { useGovernmentStore } from '../governmentStore'
import type { StoreApi } from 'zustand'

export function createQueriesSlice(
  _set: StoreApi<ArmyState>['setState'],
  get: StoreApi<ArmyState>['getState']
) {
  return {
    getDivisionsForCountry: (countryCode: string): Division[] => {
      return Object.values(get().divisions).filter(d => d.countryCode === countryCode)
    },

    getDivisionsForArmy: (armyId: string): Division[] => {
      const army = get().armies[armyId]
      if (!army) return []
      return army.divisionIds.map(id => get().divisions[id]).filter(Boolean)
    },

    getArmiesForCountry: (countryCode: string): Army[] => {
      return Object.values(get().armies).filter(a => a.countryCode === countryCode)
    },

    getReadyDivisions: (countryCode: string): Division[] => {
      return Object.values(get().divisions).filter(
        d => d.countryCode === countryCode && d.status === 'ready'
      )
    },

    getArmyMembers: (armyId: string) => {
      const army = get().armies[armyId]
      return army ? army.members : []
    },

    // ====== POP CAP ======

    getPlayerPopCap: () => {
      const player = usePlayerStore.getState()
      const companies = useCompanyStore.getState().companies
      const numberOfCompanies = companies.length
      const sumOfLevels = companies.reduce((sum, c) => sum + c.level, 0)
      // population × numberOfCompanies × sumOfCompanyLevels
      // For a single player, population = 1
      const maxPop = 1 * numberOfCompanies * sumOfLevels
      const used = get().getPlayerPopUsed()
      return { used, max: Math.max(1, maxPop) }
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

    getCountryPopCap: (countryCode: string) => {
      const divs = Object.values(get().divisions)
      const used = divs
        .filter(d => d.countryCode === countryCode && d.status !== 'destroyed')
        .reduce((sum, d) => {
          const template = DIVISION_TEMPLATES[d.type]
          return sum + (template?.popCost || 1)
        }, 0)
      const companies = useCompanyStore.getState().companies
      const numberOfCompanies = companies.length
      const sumOfLevels = companies.reduce((sum, c) => sum + c.level, 0)
      const govStore = useGovernmentStore.getState()
      const gov = govStore.governments[countryCode]
      const population = gov?.citizens?.length || 1
      // population × numberOfCompanies × sumOfCompanyLevels
      const maxPop = population * numberOfCompanies * sumOfLevels
      return { used, max: Math.max(1, maxPop) }
    },

    // ====== ARMY AV & AURA ======

    getArmyAV: (armyId: string) => {
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { air: 0, ground: 0, tanks: 0, navy: 0, total: 0 }

      let ground = 0
      for (const divId of army.divisionIds) {
        const div = state.divisions[divId]
        if (!div || div.status === 'destroyed') continue
        const template = DIVISION_TEMPLATES[div.type]
        ground += div.manpower * template.atkDmgMult * 10
      }

      return { air: 0, ground, tanks: 0, navy: 0, total: ground }
    },

    getCompositionAura: (armyId: string) => {
      const av = get().getArmyAV(armyId)
      return {
        critDmgPct: Math.floor(av.air / 300),
        dodgePct: Math.floor(av.ground / 300),
        attackPct: Math.floor(av.tanks / 300),
        precisionPct: Math.floor(av.navy / 300),
      }
    },

    /** Total composition aura from ALL shared (lent) divisions in the army */
    getPMCCompositionAura: (armyId: string) => {
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { air: 0, ground: 0, tanks: 0, navy: 0, total: 0, critDmgPct: 0, dodgePct: 0, attackPct: 0, precisionPct: 0 }

      let air = 0, ground = 0, tanks = 0, navy = 0
      for (const divId of army.divisionIds) {
        const div = state.divisions[divId]
        if (!div || div.status === 'destroyed' || !div.deployedToPMC) continue
        const template = DIVISION_TEMPLATES[div.type]
        const av = div.manpower * template.atkDmgMult * 10
        switch (div.category) {
          case 'air': air += av; break
          case 'naval': navy += av; break
          case 'land':
            if (div.type === 'tank' || div.type === 'jeep') tanks += av
            else ground += av
            break
        }
      }
      const total = air + ground + tanks + navy
      return {
        air, ground, tanks, navy, total,
        critDmgPct: Math.floor(air / 300),
        dodgePct: Math.floor(ground / 300),
        attackPct: Math.floor(tanks / 300),
        precisionPct: Math.floor(navy / 300),
      }
    },
  }
}
