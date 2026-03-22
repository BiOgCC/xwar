import { create } from 'zustand'
import { getCountryName } from '../data/countries'

// ====== TYPES ======

export interface WarHistoryEntry {
  id: string
  warId: string
  attacker: string          // ISO code
  defender: string          // ISO code
  attackerName: string
  defenderName: string
  startedAt: number
  endedAt: number
  outcome: 'attacker_won' | 'defender_won' | 'ceasefire' | 'draw'
  attackerDamage: number
  defenderDamage: number
  regionsChanged: number
  mvpPlayer: string | null
}

// ====== STORE ======

export interface HistoryState {
  warHistory: WarHistoryEntry[]
  recordWarEnd: (war: { id: string; attacker: string; defender: string; startedAt: number }, outcome: WarHistoryEntry['outcome'], stats?: { attackerDamage?: number; defenderDamage?: number; regionsChanged?: number; mvpPlayer?: string }) => void
  getHistoryForCountry: (code: string) => WarHistoryEntry[]
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  warHistory: [
    // Seed some example historical entries for demo
    {
      id: 'hist-1',
      warId: 'w-old-1',
      attacker: 'US',
      defender: 'CN',
      attackerName: 'United States',
      defenderName: 'China',
      startedAt: Date.now() - 86400000 * 14,
      endedAt: Date.now() - 86400000 * 7,
      outcome: 'attacker_won',
      attackerDamage: 2_450_000,
      defenderDamage: 1_870_000,
      regionsChanged: 4,
      mvpPlayer: 'Commander',
    },
    {
      id: 'hist-2',
      warId: 'w-old-2',
      attacker: 'RU',
      defender: 'TR',
      attackerName: 'Russia',
      defenderName: 'Turkey',
      startedAt: Date.now() - 86400000 * 21,
      endedAt: Date.now() - 86400000 * 15,
      outcome: 'ceasefire',
      attackerDamage: 980_000,
      defenderDamage: 1_100_000,
      regionsChanged: 1,
      mvpPlayer: null,
    },
    {
      id: 'hist-3',
      warId: 'w-old-3',
      attacker: 'JP',
      defender: 'CN',
      attackerName: 'Japan',
      defenderName: 'China',
      startedAt: Date.now() - 86400000 * 30,
      endedAt: Date.now() - 86400000 * 22,
      outcome: 'defender_won',
      attackerDamage: 720_000,
      defenderDamage: 1_300_000,
      regionsChanged: 2,
      mvpPlayer: null,
    },
  ],

  recordWarEnd: (war, outcome, stats = {}) => set((state) => ({
    warHistory: [{
      id: `hist-${Date.now()}`,
      warId: war.id,
      attacker: war.attacker,
      defender: war.defender,
      attackerName: getCountryName(war.attacker),
      defenderName: getCountryName(war.defender),
      startedAt: war.startedAt,
      endedAt: Date.now(),
      outcome,
      attackerDamage: stats.attackerDamage || 0,
      defenderDamage: stats.defenderDamage || 0,
      regionsChanged: stats.regionsChanged || 0,
      mvpPlayer: stats.mvpPlayer || null,
    }, ...state.warHistory].slice(0, 100),
  })),

  getHistoryForCountry: (code) => {
    return get().warHistory.filter((h) => h.attacker === code || h.defender === code)
  },
}))
