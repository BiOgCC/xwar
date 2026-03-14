import { create } from 'zustand'

export interface Country {
  name: string
  code: string
  controller: string
  empire: string | null
  population: number
  regions: number
  military: number
  treasury: number
  color: string
}

export interface War {
  id: string
  attacker: string
  defender: string
  startedAt: number
  status: 'active' | 'ceasefire' | 'ended'
}

export interface WorldState {
  countries: Country[]
  wars: War[]
  turn: number
  nextTurnIn: number
}

export const useWorldStore = create<WorldState>(() => ({
  turn: 247,
  nextTurnIn: 342,

  countries: [
    { name: 'United States', code: 'US', controller: 'Player Alliance', empire: 'NATO', population: 32000, regions: 12, military: 95, treasury: 1200000, color: '#22d38a' },
    { name: 'Russia', code: 'RU', controller: 'Red Army', empire: 'Eastern Bloc', population: 28000, regions: 18, military: 88, treasury: 890000, color: '#ef4444' },
    { name: 'China', code: 'CN', controller: 'Dragon Force', empire: null, population: 45000, regions: 14, military: 82, treasury: 1500000, color: '#f59e0b' },
    { name: 'Germany', code: 'DE', controller: 'Euro Corps', empire: 'NATO', population: 18000, regions: 4, military: 65, treasury: 720000, color: '#22d38a' },
    { name: 'Brazil', code: 'BR', controller: 'Amazonia', empire: null, population: 22000, regions: 8, military: 55, treasury: 340000, color: '#a855f7' },
    { name: 'India', code: 'IN', controller: 'Bengal Tigers', empire: null, population: 38000, regions: 10, military: 70, treasury: 680000, color: '#06b6d4' },
    { name: 'Nigeria', code: 'NG', controller: 'West African Union', empire: null, population: 15000, regions: 5, military: 40, treasury: 180000, color: '#10b981' },
    { name: 'Japan', code: 'JP', controller: 'Rising Sun', empire: null, population: 20000, regions: 3, military: 72, treasury: 950000, color: '#f43f5e' },
    { name: 'United Kingdom', code: 'GB', controller: 'Crown Forces', empire: 'NATO', population: 16000, regions: 3, military: 68, treasury: 560000, color: '#22d38a' },
    { name: 'Turkey', code: 'TR', controller: 'Ottoman Revival', empire: 'Eastern Bloc', population: 14000, regions: 4, military: 58, treasury: 290000, color: '#ef4444' },
  ],

  wars: [
    { id: 'w1', attacker: 'United States', defender: 'Russia', startedAt: Date.now() - 86400000 * 3, status: 'active' },
    { id: 'w2', attacker: 'China', defender: 'Japan', startedAt: Date.now() - 86400000 * 1, status: 'active' },
  ],
}))
