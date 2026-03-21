import { create } from 'zustand'
import { useBattleStore } from './battleStore'
import type { BattleType } from './battleStore'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { getCountryName } from '../data/countries'
import { getRegionsForCountry, type RegionMeta } from '../data/regionRegistry'

// ====== TYPES ======

export type MilitaryPillar = 'ground' | 'air' | 'naval' | 'special'

export type MilitaryOperationId =
  | 'assault' | 'invasion' | 'occupation'
  | 'air_strike' | 'naval_strike'
  | 'sabotage'

export interface MilitaryOperationDef {
  id: MilitaryOperationId
  pillar: MilitaryPillar
  name: string
  description: string
  resultDescription: string
  icon: string
  /** Cost to launch this duel (always 1 hunger) */
  hungerCost: number
  /** Bitcoin reward for winning */
  bitcoinReward: number
  /** Military cases reward for winning */
  caseReward: number
}

export interface MilitaryReport {
  id: string
  operationId: MilitaryOperationId
  operationName: string
  originCountry: string
  targetCountry: string
  targetRegion: string
  result: 'victory' | 'defeat' | 'pending'
  battleId: string
  participants: string[]
  timestamp: number
}

// ====== OPERATION DEFINITIONS ======
// 1v1 instant duels — each costs 1 hunger, rewards 1 bitcoin + 1 military case

export const MILITARY_OPERATIONS: MilitaryOperationDef[] = [
  // GROUND
  {
    id: 'assault', pillar: 'ground',
    name: 'Assault', icon: '⚔️',
    description: 'Fast 1v1 duel. Rush into enemy territory and deal damage.',
    resultDescription: 'Defeat your opponent to claim ground. Winner deals lasting damage to region stability.',
    hungerCost: 1, bitcoinReward: 1, caseReward: 1,
  },
  {
    id: 'invasion', pillar: 'ground',
    name: 'Invasion', icon: '🚩',
    description: 'All-in territorial duel. Fight for full regional control.',
    resultDescription: 'Winner captures influence over the region. Defender loses regional control points.',
    hungerCost: 1, bitcoinReward: 1, caseReward: 1,
  },
  {
    id: 'occupation', pillar: 'ground',
    name: 'Occupation', icon: '🛡️',
    description: 'Endurance duel. Hold the line and grind your opponent down.',
    resultDescription: 'Winner reinforces their hold on the region. Steady income from occupied territory.',
    hungerCost: 1, bitcoinReward: 1, caseReward: 1,
  },
  {
    id: 'sabotage', pillar: 'ground',
    name: 'Sabotage', icon: '💣',
    description: 'Covert strike. Disable an enemy company if you win both rounds.',
    resultDescription: '10-hour duel. If defended and attacker wins → second battle. Win both → disable target company for 48 hours (no division count contribution).',
    hungerCost: 1, bitcoinReward: 1, caseReward: 1,
  },

  // AIR
  {
    id: 'air_strike', pillar: 'air',
    name: 'Air Strike', icon: '✈️',
    description: 'Lightning strike from the skies. Hit any region with an airport.',
    resultDescription: 'Winner deals infrastructure damage. Airports and logistics disrupted in the target region.',
    hungerCost: 1, bitcoinReward: 1, caseReward: 1,
  },

  // NAVAL
  {
    id: 'naval_strike', pillar: 'naval',
    name: 'Naval Strike', icon: '⛴️',
    description: 'Naval assault on coastal targets. Blockade enemy shipping.',
    resultDescription: 'Winner disrupts trade routes. Coastal defenses weakened in the target region.',
    hungerCost: 1, bitcoinReward: 1, caseReward: 1,
  },
]

export function getOperationsByPillar(pillar: MilitaryPillar): MilitaryOperationDef[] {
  return MILITARY_OPERATIONS.filter(op => op.pillar === pillar)
}

/** Get real region metadata for a country from the shared registry */
export function getTargetRegions(countryCode: string): RegionMeta[] {
  return getRegionsForCountry(countryCode)
}

/** @deprecated Use getTargetRegions() instead — returns region IDs */
export function getRegionNames(countryCode: string): string[] {
  const regions = getRegionsForCountry(countryCode)
  if (regions.length > 0) return regions.map(r => r.name)
  const world = useWorldStore.getState()
  const country = world.countries.find(c => c.code === countryCode)
  if (!country) return []
  return [`${country.name} — All Regions`]
}

// ====== STORE ======

export interface MilitaryState {
  reports: Record<string, MilitaryReport>
  /** Tracks active duel battleIds */
  activeDuels: Record<string, string>
  /** Sabotage tracking: opId → { phase, firstBattleId, secondBattleId, targetCompany } */
  sabotageOps: Record<string, SabotageState>

  launchDuel: (opId: MilitaryOperationId, targetCountry: string, targetRegion: string) => { success: boolean; message: string; battleId?: string }
  addReport: (report: Omit<MilitaryReport, 'id' | 'timestamp'>) => void
}

export interface SabotageState {
  phase: 'first_battle' | 'second_battle' | 'completed' | 'failed'
  firstBattleId: string
  secondBattleId: string
  targetCountry: string
  targetRegion: string
  startedAt: number
  /** Company to be disabled if both battles won */
  disabledCompanyId?: string
  disableExpiresAt?: number
}

export const useMilitaryStore = create<MilitaryState>((set, get) => ({
  reports: {},
  activeDuels: {},
  sabotageOps: {},

  launchDuel: (opId, targetCountry, targetRegion) => {
    const opDef = MILITARY_OPERATIONS.find(o => o.id === opId)
    if (!opDef) return { success: false, message: 'Unknown operation.' }

    const player = usePlayerStore.getState()

    // Check hunger — use floor to handle fractional regen values
    if (Math.floor(player.hunger) < opDef.hungerCost) {
      return { success: false, message: `Not enough hunger (${opDef.hungerCost} required). Eat food first!` }
    }

    // Check target
    if (!targetCountry || !targetRegion) {
      return { success: false, message: 'Select a target country and region.' }
    }

    const iso = player.countryCode || 'US'
    if (targetCountry === iso) {
      return { success: false, message: "Can't attack your own country." }
    }

    // Spend hunger
    player.consumeBar('hunger', opDef.hungerCost)

    // Create a quick battle via battleStore
    const battleStore = useBattleStore.getState()
    battleStore.launchAttack(iso, targetCountry, targetRegion, 'quick_battle')

    // Find the created battle ID
    const battles = useBattleStore.getState().battles
    const battleId = Object.keys(battles).find(id =>
      battles[id].regionName === targetRegion &&
      battles[id].status === 'active' &&
      battles[id].type === 'quick_battle'
    ) || ''

    // Track active duel
    set(state => ({
      activeDuels: { ...state.activeDuels, [opId]: battleId },
    }))

    // Sabotage special handling: track the multi-phase state
    if (opId === 'sabotage' && battleId) {
      set(state => ({
        sabotageOps: {
          ...state.sabotageOps,
          [battleId]: {
            phase: 'first_battle',
            firstBattleId: battleId,
            secondBattleId: '',
            targetCountry,
            targetRegion,
            startedAt: Date.now(),
          },
        },
      }))
    }

    // Add report
    get().addReport({
      operationId: opId,
      operationName: opDef.name,
      originCountry: iso,
      targetCountry,
      targetRegion,
      result: 'pending',
      battleId,
      participants: [player.name],
    })

    return { success: true, message: `⚔️ ${opDef.name} duel launched!`, battleId }
  },

  addReport: (report) => set(state => {
    const id = `milrep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    return { reports: { ...state.reports, [id]: { ...report, id, timestamp: Date.now() } } }
  }),
}))
