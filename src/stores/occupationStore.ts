import { create } from 'zustand'
import { useWorldStore } from './worldStore'
import { useCompanyStore } from './companyStore'
import { useGovernmentStore } from './governmentStore'

// ====== TYPES ======

export type OccupationActionType =
  | 'scouting'
  | 'destroy'
  | 'power_down'
  | 'hijack_production'
  | 'hijack_taxes'
  | 'passive'

export interface ScoutingResult {
  companies: {
    id: string
    type: string
    level: number
    productionPerDay: number
    scrapValue: number           // productionPerDay * 25
    taxIncomePerDay: number      // 10% of PP * avgSalary
  }[]
  totalProductionPerDay: number
  totalScrapValue: number
  totalTaxIncomePerDay: number
  infrastructure: { type: string; level: number }[]
}

export interface OccupationAction {
  type: OccupationActionType
  startedAt: number
  expiresAt: number | null       // null for scouting (instant), passive (indefinite)
  data: Record<string, any>      // Scouting results, destroyed targets, etc.
}

export interface Occupation {
  id: string
  occupierId: string             // Country ISO (who conquered)
  occupiedCountry: string        // Country ISO (who was conquered)
  occupiedRegion: string         // Region name
  establishedAt: number
  activeAction: OccupationAction | null
  scoutingReport: ScoutingResult | null
}

// ====== CONSTANTS ======

const HIJACK_DURATION = 72 * 60 * 60 * 1000  // 72 hours
const AVG_SALARY = 150  // Average salary for tax income calculation

// ====== STORE ======

export interface OccupationState {
  occupations: Record<string, Occupation>

  // Actions
  establishOccupation: (occupierId: string, occupiedCountry: string, region: string) => string
  endOccupation: (occupationId: string) => void

  // Occupation actions
  scoutRegion: (occupationId: string) => ScoutingResult | null
  destroyInfrastructure: (occupationId: string, targetIds: string[]) => { destroyed: number; scrapsGained: number }
  powerDown: (occupationId: string) => { companiesDisabled: number }
  liftPowerDown: (occupationId: string) => void
  hijackProduction: (occupationId: string) => { companiesHijacked: number }
  hijackTaxes: (occupationId: string) => { taxIncome: number }
  setPassive: (occupationId: string) => void

  // Tick processor
  processOccupationTick: () => void
  getOccupationsForCountry: (countryCode: string) => Occupation[]
}

export const useOccupationStore = create<OccupationState>((set, get) => ({
  occupations: {},

  establishOccupation: (occupierId, occupiedCountry, region) => {
    const id = `occ_${Date.now()}_${region.replace(/\s+/g, '_')}`
    const occupation: Occupation = {
      id,
      occupierId,
      occupiedCountry,
      occupiedRegion: region,
      establishedAt: Date.now(),
      activeAction: null,
      scoutingReport: null,
    }

    set(s => ({ occupations: { ...s.occupations, [id]: occupation } }))
    return id
  },

  endOccupation: (occupationId) => set(s => {
    const occ = s.occupations[occupationId]
    if (!occ) return s

    // Lift any active power down
    if (occ.activeAction?.type === 'power_down') {
      const companyStore = useCompanyStore.getState()
      useCompanyStore.setState({
        companies: companyStore.companies.map(c =>
          c.location === occ.occupiedCountry ? { ...c, disabledUntil: undefined } : c
        )
      })
    }

    const { [occupationId]: _, ...rest } = s.occupations
    return { occupations: rest }
  }),

  // ====== OCCUPATION ACTIONS ======

  scoutRegion: (occupationId) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ) return null

    const companyStore = useCompanyStore.getState()
    const regionCompanies = companyStore.companies.filter(c => c.location === occ.occupiedCountry)

    const companies = regionCompanies.map(c => {
      const productionPerDay = c.level * 10 * 24  // Rough estimate: level * 10 per hour * 24 hours
      return {
        id: c.id,
        type: c.type.replace(/_/g, ' '),
        level: c.level,
        productionPerDay,
        scrapValue: productionPerDay * 25,
        taxIncomePerDay: Math.floor(productionPerDay * 0.10 * AVG_SALARY),
      }
    })

    const world = useWorldStore.getState()
    const country = world.countries.find(c => c.code === occ.occupiedCountry)
    const infrastructure = country ? [
      { type: 'Port', level: country.portLevel },
      { type: 'Airport', level: country.airportLevel },
      { type: 'Bunker', level: country.bunkerLevel },
      { type: 'Military Base', level: country.militaryBaseLevel },
    ] : []

    const report: ScoutingResult = {
      companies,
      totalProductionPerDay: companies.reduce((s, c) => s + c.productionPerDay, 0),
      totalScrapValue: companies.reduce((s, c) => s + c.scrapValue, 0),
      totalTaxIncomePerDay: companies.reduce((s, c) => s + c.taxIncomePerDay, 0),
      infrastructure,
    }

    // Save report and set action
    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: {
          ...occ,
          scoutingReport: report,
          activeAction: { type: 'scouting', startedAt: Date.now(), expiresAt: null, data: report },
        },
      },
    }))

    return report
  },

  destroyInfrastructure: (occupationId, targetIds) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ) return { destroyed: 0, scrapsGained: 0 }

    const companyStore = useCompanyStore.getState()
    const regionCompanies = companyStore.companies.filter(c => c.location === occ.occupiedCountry)
    const maxDestroy = Math.ceil(regionCompanies.length * 0.20)  // Max 20% of total

    const toDestroy = targetIds.slice(0, maxDestroy)
    const destroySet = new Set(toDestroy)
    
    let scrapsGained = 0
    const destroyedCompanies = companyStore.companies.filter(c => destroySet.has(c.id))
    destroyedCompanies.forEach(c => {
      const productionPerDay = c.level * 10 * 24
      scrapsGained += productionPerDay * 25  // scrapValue formula
    })

    // Remove the companies
    useCompanyStore.setState({
      companies: companyStore.companies.filter(c => !destroySet.has(c.id)),
    })

    // Give scraps to occupier
    const govStore = useGovernmentStore.getState()
    govStore.donateToFund(occ.occupierId, 'scraps' as any, scrapsGained)

    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: {
          ...occ,
          activeAction: {
            type: 'destroy',
            startedAt: Date.now(),
            expiresAt: null,
            data: { destroyed: destroyedCompanies.length, scrapsGained },
          },
        },
      },
    }))

    return { destroyed: destroyedCompanies.length, scrapsGained }
  },

  powerDown: (occupationId) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ) return { companiesDisabled: 0 }

    const companyStore = useCompanyStore.getState()
    const regionCompanies = companyStore.companies.filter(c => c.location === occ.occupiedCountry)

    // Disable all companies indefinitely (until power is restored)
    const farFuture = Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year (effectively permanent until lifted)
    useCompanyStore.setState({
      companies: companyStore.companies.map(c =>
        c.location === occ.occupiedCountry ? { ...c, disabledUntil: farFuture } : c
      )
    })

    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: {
          ...occ,
          activeAction: {
            type: 'power_down',
            startedAt: Date.now(),
            expiresAt: null,
            data: { companiesDisabled: regionCompanies.length },
          },
        },
      },
    }))

    return { companiesDisabled: regionCompanies.length }
  },

  liftPowerDown: (occupationId) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ || occ.activeAction?.type !== 'power_down') return

    // Re-enable all companies
    const companyStore = useCompanyStore.getState()
    useCompanyStore.setState({
      companies: companyStore.companies.map(c =>
        c.location === occ.occupiedCountry ? { ...c, disabledUntil: undefined } : c
      )
    })

    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: { ...occ, activeAction: null },
      },
    }))
  },

  hijackProduction: (occupationId) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ) return { companiesHijacked: 0 }

    const companyStore = useCompanyStore.getState()
    const regionCompanies = companyStore.companies.filter(c => c.location === occ.occupiedCountry)

    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: {
          ...occ,
          activeAction: {
            type: 'hijack_production',
            startedAt: Date.now(),
            expiresAt: Date.now() + HIJACK_DURATION,
            data: { companiesHijacked: regionCompanies.length, occupierId: occ.occupierId },
          },
        },
      },
    }))

    return { companiesHijacked: regionCompanies.length }
  },

  hijackTaxes: (occupationId) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ) return { taxIncome: 0 }

    // Calculate tax income: 10% of PP * avgSalary
    const companyStore = useCompanyStore.getState()
    const regionCompanies = companyStore.companies.filter(c => c.location === occ.occupiedCountry)
    const totalPP = regionCompanies.reduce((sum, c) => sum + c.level * 10, 0) // PP per hour
    const taxPerHour = Math.floor(totalPP * 0.10 * AVG_SALARY)
    const totalTaxFor72h = taxPerHour * 72

    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: {
          ...occ,
          activeAction: {
            type: 'hijack_taxes',
            startedAt: Date.now(),
            expiresAt: Date.now() + HIJACK_DURATION,
            data: { taxIncome: totalTaxFor72h, taxPerHour, occupierId: occ.occupierId },
          },
        },
      },
    }))

    // Immediately add projected taxes to occupier country fund
    useGovernmentStore.getState().donateToFund(occ.occupierId, 'money' as any, totalTaxFor72h)

    return { taxIncome: totalTaxFor72h }
  },

  setPassive: (occupationId) => {
    const state = get()
    const occ = state.occupations[occupationId]
    if (!occ) return

    // If there was a power down, lift it first
    if (occ.activeAction?.type === 'power_down') {
      get().liftPowerDown(occupationId)
    }

    set(s => ({
      occupations: {
        ...s.occupations,
        [occupationId]: {
          ...occ,
          activeAction: {
            type: 'passive',
            startedAt: Date.now(),
            expiresAt: null,
            data: {},
          },
        },
      },
    }))
  },

  // ====== TICK PROCESSING ======
  processOccupationTick: () => {
    const state = get()
    const now = Date.now()
    const updates: Record<string, Occupation> = {}

    Object.values(state.occupations).forEach(occ => {
      if (!occ.activeAction) return
      if (occ.activeAction.expiresAt && now >= occ.activeAction.expiresAt) {
        // Hijack expired → clear action
        updates[occ.id] = { ...occ, activeAction: null }
      }
    })

    if (Object.keys(updates).length > 0) {
      set(s => ({ occupations: { ...s.occupations, ...updates } }))
    }
  },

  getOccupationsForCountry: (countryCode) => {
    return Object.values(get().occupations).filter(
      occ => occ.occupierId === countryCode || occ.occupiedCountry === countryCode
    )
  },
}))
