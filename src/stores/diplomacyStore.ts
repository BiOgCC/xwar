import { create } from 'zustand'
import { getCountryName } from '../data/countries'

// ====== TYPES ======

export interface PeaceTreaty {
  id: string
  country1: string
  country2: string
  signedAt: number
  expiresAt: number        // 24h cooldown before re-attack
  status: 'active' | 'expired'
}

export interface NAP {
  id: string
  country1: string
  country2: string
  signedAt: number
  expiresAt: number        // 48h duration
  status: 'active' | 'expired'
}

export interface TradeDeal {
  id: string
  country1: string
  country2: string
  signedAt: number
  expiresAt: number        // 72h duration
  bonus: number            // +10% trade income
  status: 'active' | 'expired'
}

export interface DiplomacyProposal {
  id: string
  type: 'peace' | 'nap' | 'trade'
  fromCountry: string
  toCountry: string
  proposedAt: number
  status: 'pending' | 'accepted' | 'rejected'
}

// ====== STORE ======

export interface DiplomacyState {
  treaties: PeaceTreaty[]
  naps: NAP[]
  tradeDeals: TradeDeal[]
  proposals: DiplomacyProposal[]

  // Actions
  proposePeace: (fromIso: string, toIso: string) => { success: boolean; message: string }
  proposeNAP: (fromIso: string, toIso: string) => { success: boolean; message: string }
  proposeTrade: (fromIso: string, toIso: string) => { success: boolean; message: string }
  acceptProposal: (proposalId: string) => { success: boolean; message: string }
  rejectProposal: (proposalId: string) => void
  checkExpiry: () => void
  hasPeaceTreaty: (iso1: string, iso2: string) => boolean
  hasNAP: (iso1: string, iso2: string) => boolean
  hasTradeDeal: (iso1: string, iso2: string) => boolean
  getActiveAgreements: (iso: string) => { treaties: PeaceTreaty[]; naps: NAP[]; tradeDeals: TradeDeal[] }
}

const PEACE_DURATION = 24 * 60 * 60 * 1000   // 24h
const NAP_DURATION = 48 * 60 * 60 * 1000     // 48h
const TRADE_DURATION = 72 * 60 * 60 * 1000   // 72h

export const useDiplomacyStore = create<DiplomacyState>((set, get) => ({
  treaties: [],
  naps: [
    // Seed demo NAP
    {
      id: 'nap-demo-1',
      country1: 'US',
      country2: 'GB',
      signedAt: Date.now() - 12 * 60 * 60 * 1000,
      expiresAt: Date.now() + 36 * 60 * 60 * 1000,
      status: 'active',
    },
  ],
  tradeDeals: [
    // Seed demo trade deal
    {
      id: 'trade-demo-1',
      country1: 'US',
      country2: 'JP',
      signedAt: Date.now() - 24 * 60 * 60 * 1000,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000,
      bonus: 10,
      status: 'active',
    },
  ],
  proposals: [],

  proposePeace: (fromIso, toIso) => {
    const state = get()
    if (state.hasPeaceTreaty(fromIso, toIso)) return { success: false, message: 'Peace treaty already active.' }
    const existing = state.proposals.find(p => p.status === 'pending' && p.type === 'peace' && ((p.fromCountry === fromIso && p.toCountry === toIso) || (p.fromCountry === toIso && p.toCountry === fromIso)))
    if (existing) return { success: false, message: 'Peace proposal already pending.' }

    const proposal: DiplomacyProposal = {
      id: `prop-${Date.now()}`, type: 'peace', fromCountry: fromIso, toCountry: toIso,
      proposedAt: Date.now(), status: 'pending',
    }
    set(s => ({ proposals: [proposal, ...s.proposals] }))
    return { success: true, message: `Peace proposal sent to ${getCountryName(toIso)}.` }
  },

  proposeNAP: (fromIso, toIso) => {
    const state = get()
    if (state.hasNAP(fromIso, toIso)) return { success: false, message: 'NAP already active.' }
    const existing = state.proposals.find(p => p.status === 'pending' && p.type === 'nap' && ((p.fromCountry === fromIso && p.toCountry === toIso) || (p.fromCountry === toIso && p.toCountry === fromIso)))
    if (existing) return { success: false, message: 'NAP proposal already pending.' }

    const proposal: DiplomacyProposal = {
      id: `prop-${Date.now()}`, type: 'nap', fromCountry: fromIso, toCountry: toIso,
      proposedAt: Date.now(), status: 'pending',
    }
    set(s => ({ proposals: [proposal, ...s.proposals] }))
    return { success: true, message: `NAP proposal sent to ${getCountryName(toIso)}.` }
  },

  proposeTrade: (fromIso, toIso) => {
    const state = get()
    if (state.hasTradeDeal(fromIso, toIso)) return { success: false, message: 'Trade deal already active.' }
    const proposal: DiplomacyProposal = {
      id: `prop-${Date.now()}`, type: 'trade', fromCountry: fromIso, toCountry: toIso,
      proposedAt: Date.now(), status: 'pending',
    }
    set(s => ({ proposals: [proposal, ...s.proposals] }))
    return { success: true, message: `Trade proposal sent to ${getCountryName(toIso)}.` }
  },

  acceptProposal: (proposalId) => {
    const state = get()
    const prop = state.proposals.find(p => p.id === proposalId && p.status === 'pending')
    if (!prop) return { success: false, message: 'Proposal not found.' }

    const now = Date.now()
    set(s => ({
      proposals: s.proposals.map(p => p.id === proposalId ? { ...p, status: 'accepted' as const } : p),
      ...(prop.type === 'peace' ? {
        treaties: [...s.treaties, { id: `treaty-${now}`, country1: prop.fromCountry, country2: prop.toCountry, signedAt: now, expiresAt: now + PEACE_DURATION, status: 'active' as const }],
      } : {}),
      ...(prop.type === 'nap' ? {
        naps: [...s.naps, { id: `nap-${now}`, country1: prop.fromCountry, country2: prop.toCountry, signedAt: now, expiresAt: now + NAP_DURATION, status: 'active' as const }],
      } : {}),
      ...(prop.type === 'trade' ? {
        tradeDeals: [...s.tradeDeals, { id: `trade-${now}`, country1: prop.fromCountry, country2: prop.toCountry, signedAt: now, expiresAt: now + TRADE_DURATION, bonus: 10, status: 'active' as const }],
      } : {}),
    }))
    return { success: true, message: `${prop.type.toUpperCase()} accepted with ${getCountryName(prop.fromCountry)}.` }
  },

  rejectProposal: (proposalId) => set(s => ({
    proposals: s.proposals.map(p => p.id === proposalId ? { ...p, status: 'rejected' as const } : p),
  })),

  checkExpiry: () => {
    const now = Date.now()
    set(s => ({
      treaties: s.treaties.map(t => t.status === 'active' && now > t.expiresAt ? { ...t, status: 'expired' as const } : t),
      naps: s.naps.map(n => n.status === 'active' && now > n.expiresAt ? { ...n, status: 'expired' as const } : n),
      tradeDeals: s.tradeDeals.map(d => d.status === 'active' && now > d.expiresAt ? { ...d, status: 'expired' as const } : d),
    }))
  },

  hasPeaceTreaty: (iso1, iso2) => get().treaties.some(t => t.status === 'active' && ((t.country1 === iso1 && t.country2 === iso2) || (t.country1 === iso2 && t.country2 === iso1))),
  hasNAP: (iso1, iso2) => get().naps.some(n => n.status === 'active' && ((n.country1 === iso1 && n.country2 === iso2) || (n.country1 === iso2 && n.country2 === iso1))),
  hasTradeDeal: (iso1, iso2) => get().tradeDeals.some(d => d.status === 'active' && ((d.country1 === iso1 && d.country2 === iso2) || (d.country1 === iso2 && d.country2 === iso1))),

  getActiveAgreements: (iso) => ({
    treaties: get().treaties.filter(t => t.status === 'active' && (t.country1 === iso || t.country2 === iso)),
    naps: get().naps.filter(n => n.status === 'active' && (n.country1 === iso || n.country2 === iso)),
    tradeDeals: get().tradeDeals.filter(d => d.status === 'active' && (d.country1 === iso || d.country2 === iso)),
  }),
}))
