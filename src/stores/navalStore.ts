import { create } from 'zustand'
import { useBattleStore } from './battleStore'
import { getActiveNavalOps, initiateNavalOp, joinNavalOp, launchNavalOp } from '../api/client'

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

  fetchActiveOps: () => Promise<void>
  initiateOperation: (initiator: string, originRegion: string, targetRegion: string, warshipId: string) => Promise<string | null>
  invitePlayer: (opId: string, playerName: string) => void
  joinOperation: (opId: string, playerName: string) => Promise<boolean>
  launchOperation: (opId: string) => Promise<boolean>
}

export const useNavalStore = create<NavalState>((set, get) => ({
  operations: {},
  invites: {},

  fetchActiveOps: async () => {
    try {
      const res = await getActiveNavalOps()
      if (res.success) {
        const opsRecord: Record<string, NavalOperation> = {}
        for (const op of res.operations) {
          opsRecord[op.id] = {
            id: op.id,
            initiator: op.initiatorName || op.initiatorId, // from decorated backend result
            originRegion: op.originRegion,
            targetRegion: op.targetRegion,
            warshipId: op.warshipId,
            playersJoined: op.playersJoined,
            launchTime: op.launchedAt ? new Date(op.launchedAt).getTime() : null,
            status: op.status
          }
        }
        set({ operations: opsRecord })
      }
    } catch (err) {
      console.error('[NAVAL STORE] Fetch failed', err)
    }
  },

  initiateOperation: async (initiator, originRegion, targetRegion, warshipId) => {
    try {
      const res = await initiateNavalOp(originRegion, targetRegion, warshipId)
      if (res.success) {
        // Refresh ops to show our new one
        await get().fetchActiveOps()
        return res.operationId
      }
      return null
    } catch (err) {
      console.error('[NAVAL STORE] Initiate failed', err)
      return null
    }
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

  joinOperation: async (opId, playerName) => {
    try {
      const res = await joinNavalOp(opId)
      if (res.success) {
        // Optimistic UI update
        set(state => {
          const op = state.operations[opId]
          if (!op) return state
          return {
            operations: {
              ...state.operations,
              [opId]: { ...op, playersJoined: res.playersJoined }
            }
          }
        })
        return true
      }
      return false
    } catch (err) {
      console.error('[NAVAL STORE] Join failed', err)
      return false
    }
  },

  launchOperation: async (opId) => {
    try {
      const res = await launchNavalOp(opId)
      if (res.success) {
        const state = get()
        const op = state.operations[opId]
        if (op) {
          // Trigger the actual battle using the BattleStore
          useBattleStore.getState().launchAttack(op.originRegion, op.targetRegion, op.targetRegion, 'naval_strike')
          
          set(s => ({
            operations: {
              ...s.operations,
              [opId]: { ...op, status: 'launched', launchTime: Date.now() }
            }
          }))
        }
        return true
      }
      return false
    } catch (err) {
      console.error('[NAVAL STORE] Launch failed', err)
      return false
    }
  }
}))
