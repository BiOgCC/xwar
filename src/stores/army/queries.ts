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

    getCountryPopCap: (countryCode: string) => {
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
        critDmgPct: Math.floor(av.air / 1000) * 2,
        dodgePct: Math.floor(av.ground / 1000) * 1,
        attackPct: Math.floor(av.tanks / 1000) * 2,
        precisionPct: Math.floor(av.navy / 1000) * 5,
      }
    },
  }
}
