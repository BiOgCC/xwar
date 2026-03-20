import { create } from 'zustand'
import { useBattleStore } from './battleStore'

export type NavalOpStatus = 'recruiting' | 'launched' | 'completed'

export interface NavalOperation {
  id: string
  initiator: string
  originRegion: string
  targetRegion: string
  warshipId: string
  playersJoined: string[] // Includes initiator + up to 5 others
  launchTime: number | null
  status: NavalOpStatus
}

export interface NavalState {
  operations: Record<string, NavalOperation>
  invites: Record<string, string[]> // opId -> list of invited player names

  initiateOperation: (initiator: string, originRegion: string, targetRegion: string, warshipId: string) => string
  invitePlayer: (opId: string, playerName: string) => void
  joinOperation: (opId: string, playerName: string) => void
  launchOperation: (opId: string) => void
}

export const useNavalStore = create<NavalState>((set, get) => ({
  operations: {},
  invites: {},

  initiateOperation: (initiator, originRegion, targetRegion, warshipId) => {
    const id = `nav_${Date.now()}_${initiator}`
    set(state => ({
      operations: {
        ...state.operations,
        [id]: {
          id,
          initiator,
          originRegion,
          targetRegion,
          warshipId,
          playersJoined: [initiator],
          launchTime: null,
          status: 'recruiting'
        }
      }
    }))
    return id
  },

  invitePlayer: (opId, playerName) => set(state => {
    const invitesForOp = state.invites[opId] || []
    if (invitesForOp.includes(playerName)) return state
    return {
      invites: {
        ...state.invites,
        [opId]: [...invitesForOp, playerName]
      }
    }
  }),

  joinOperation: (opId, playerName) => set(state => {
    const op = state.operations[opId]
    if (!op || op.status !== 'recruiting' || op.playersJoined.length >= 6) return state
    if (op.playersJoined.includes(playerName)) return state
    
    return {
      operations: {
        ...state.operations,
        [opId]: {
          ...op,
          playersJoined: [...op.playersJoined, playerName]
        }
      }
    }
  }),

  launchOperation: (opId) => set(state => {
    const op = state.operations[opId]
    if (!op || op.status !== 'recruiting') return state

    // Trigger the actual battle using the BattleStore
    // The regionName is simply the targetRegion ISO acting as the name for now, compatible with our simplistic map.
    useBattleStore.getState().launchAttack(op.originRegion, op.targetRegion, op.targetRegion, 'naval_strike')

    return {
      operations: {
        ...state.operations,
        [opId]: { ...op, status: 'launched', launchTime: Date.now() }
      }
    }
  })
}))
