import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR — Alliance Wars Store
   Create/join alliances, shared treasury, war system
   ══════════════════════════════════════════════ */

export interface AllianceMember {
  name: string
  countryCode: string
  role: 'leader' | 'officer' | 'member'
  joinedAt: number
  contributed: number  // total money contributed
}

export interface AllianceWar {
  id: string
  targetAllianceId: string
  targetAllianceName: string
  declaredAt: number
  votesFor: string[]   // member names who voted yes
  votesAgainst: string[]
  status: 'voting' | 'active' | 'victory' | 'defeat' | 'peace'
  kills: number
  deaths: number
}

export interface Alliance {
  id: string
  name: string
  tag: string          // 2-4 char tag
  leader: string       // player name
  members: AllianceMember[]
  treasury: number
  createdAt: number
  wars: AllianceWar[]
  maxMembers: number
  wins: number
  losses: number
}

const MAX_ALLIANCE_SIZE = 5
const MIN_CONTRIBUTION = 10_000
const WAR_VOTE_DURATION = 3600000 // 1 hour

// Seed alliances for NPC flavor
const SEED_ALLIANCES: Alliance[] = [
  {
    id: 'alliance_nato',
    name: 'NATO Coalition',
    tag: 'NATO',
    leader: 'Commander_X',
    members: [
      { name: 'Commander_X', countryCode: 'US', role: 'leader', joinedAt: Date.now() - 86400000 * 30, contributed: 5_000_000 },
      { name: 'AI_Commander_Sunak', countryCode: 'GB', role: 'officer', joinedAt: Date.now() - 86400000 * 25, contributed: 3_000_000 },
      { name: 'AI_Commander_Scholz', countryCode: 'DE', role: 'member', joinedAt: Date.now() - 86400000 * 20, contributed: 2_500_000 },
    ],
    treasury: 10_500_000,
    createdAt: Date.now() - 86400000 * 30,
    wars: [],
    maxMembers: MAX_ALLIANCE_SIZE,
    wins: 3,
    losses: 1,
  },
  {
    id: 'alliance_eastern',
    name: 'Eastern Bloc',
    tag: 'EAST',
    leader: 'AI_Commander_Putin',
    members: [
      { name: 'AI_Commander_Putin', countryCode: 'RU', role: 'leader', joinedAt: Date.now() - 86400000 * 28, contributed: 4_000_000 },
      { name: 'AI_Commander_Xi', countryCode: 'CN', role: 'officer', joinedAt: Date.now() - 86400000 * 26, contributed: 6_000_000 },
    ],
    treasury: 10_000_000,
    createdAt: Date.now() - 86400000 * 28,
    wars: [],
    maxMembers: MAX_ALLIANCE_SIZE,
    wins: 2,
    losses: 2,
  },
  {
    id: 'alliance_brics',
    name: 'BRICS Pact',
    tag: 'BRICS',
    leader: 'AI_Commander_Modi',
    members: [
      { name: 'AI_Commander_Modi', countryCode: 'IN', role: 'leader', joinedAt: Date.now() - 86400000 * 15, contributed: 2_000_000 },
      { name: 'AI_Commander_Lula', countryCode: 'BR', role: 'member', joinedAt: Date.now() - 86400000 * 12, contributed: 1_500_000 },
    ],
    treasury: 3_500_000,
    createdAt: Date.now() - 86400000 * 15,
    wars: [],
    maxMembers: MAX_ALLIANCE_SIZE,
    wins: 1,
    losses: 0,
  },
]

export interface AllianceState {
  alliances: Alliance[]
  playerAllianceId: string | null

  createAlliance: (name: string, tag: string) => { success: boolean; message: string }
  joinAlliance: (allianceId: string) => { success: boolean; message: string }
  leaveAlliance: () => { success: boolean; message: string }
  contribute: (amount: number) => { success: boolean; message: string }
  declareWar: (targetAllianceId: string) => { success: boolean; message: string }
  voteWar: (warId: string, vote: 'for' | 'against') => { success: boolean; message: string }
  resolveWars: () => void
  getPlayerAlliance: () => Alliance | null
}

export const useAllianceStore = create<AllianceState>((set, get) => ({
  alliances: SEED_ALLIANCES,
  // Player starts in NATO (same as Commander_X)
  playerAllianceId: 'alliance_nato',

  createAlliance: (name, tag) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (state.playerAllianceId) {
      return { success: false, message: 'You must leave your current alliance first' }
    }
    if (name.length < 3 || name.length > 24) {
      return { success: false, message: 'Name must be 3-24 characters' }
    }
    if (tag.length < 2 || tag.length > 4) {
      return { success: false, message: 'Tag must be 2-4 characters' }
    }
    if (state.alliances.find(a => a.tag.toUpperCase() === tag.toUpperCase())) {
      return { success: false, message: 'Tag already taken' }
    }

    // Creation costs $500K
    if (player.money < 500_000) {
      return { success: false, message: 'Need $500,000 to create an alliance' }
    }
    player.spendMoney(500_000)

    const newAlliance: Alliance = {
      id: `alliance_${Date.now()}`,
      name,
      tag: tag.toUpperCase(),
      leader: player.name,
      members: [{
        name: player.name,
        countryCode: player.countryCode,
        role: 'leader',
        joinedAt: Date.now(),
        contributed: 0,
      }],
      treasury: 0,
      createdAt: Date.now(),
      wars: [],
      maxMembers: MAX_ALLIANCE_SIZE,
      wins: 0,
      losses: 0,
    }

    set(s => ({
      alliances: [...s.alliances, newAlliance],
      playerAllianceId: newAlliance.id,
    }))

    useNewsStore.getState().pushEvent('alliance',
      `${player.name} founded the alliance [${tag.toUpperCase()}] ${name}`
    )

    return { success: true, message: `Alliance [${tag.toUpperCase()}] ${name} created!` }
  },

  joinAlliance: (allianceId) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (state.playerAllianceId) {
      return { success: false, message: 'Leave your current alliance first' }
    }

    const alliance = state.alliances.find(a => a.id === allianceId)
    if (!alliance) return { success: false, message: 'Alliance not found' }
    if (alliance.members.length >= alliance.maxMembers) {
      return { success: false, message: 'Alliance is full' }
    }

    const newMember: AllianceMember = {
      name: player.name,
      countryCode: player.countryCode,
      role: 'member',
      joinedAt: Date.now(),
      contributed: 0,
    }

    set(s => ({
      alliances: s.alliances.map(a =>
        a.id === allianceId ? { ...a, members: [...a.members, newMember] } : a
      ),
      playerAllianceId: allianceId,
    }))

    useNewsStore.getState().pushEvent('alliance',
      `${player.name} joined [${alliance.tag}] ${alliance.name}`
    )

    return { success: true, message: `Joined [${alliance.tag}] ${alliance.name}!` }
  },

  leaveAlliance: () => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }

    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance) return { success: false, message: 'Alliance not found' }

    // If leader and only member, disband
    if (alliance.members.length === 1) {
      set(s => ({
        alliances: s.alliances.filter(a => a.id !== state.playerAllianceId),
        playerAllianceId: null,
      }))
      useNewsStore.getState().pushEvent('alliance', `[${alliance.tag}] ${alliance.name} has been disbanded`)
      return { success: true, message: 'Alliance disbanded' }
    }

    // Remove player, promote next member if leader
    let updatedAlliance = {
      ...alliance,
      members: alliance.members.filter(m => m.name !== player.name),
    }

    if (alliance.leader === player.name) {
      const newLeader = updatedAlliance.members[0]
      updatedAlliance = {
        ...updatedAlliance,
        leader: newLeader.name,
        members: updatedAlliance.members.map((m, i) =>
          i === 0 ? { ...m, role: 'leader' as const } : m
        ),
      }
    }

    set(s => ({
      alliances: s.alliances.map(a => a.id === state.playerAllianceId ? updatedAlliance : a),
      playerAllianceId: null,
    }))

    useNewsStore.getState().pushEvent('alliance',
      `${player.name} left [${alliance.tag}] ${alliance.name}`
    )

    return { success: true, message: `Left [${alliance.tag}]` }
  },

  contribute: (amount) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }
    if (amount < MIN_CONTRIBUTION) return { success: false, message: `Minimum contribution: $${MIN_CONTRIBUTION.toLocaleString()}` }
    if (player.money < amount) return { success: false, message: 'Insufficient funds' }

    player.spendMoney(amount)

    set(s => ({
      alliances: s.alliances.map(a => {
        if (a.id !== state.playerAllianceId) return a
        return {
          ...a,
          treasury: a.treasury + amount,
          members: a.members.map(m =>
            m.name === player.name ? { ...m, contributed: m.contributed + amount } : m
          ),
        }
      }),
    }))

    return { success: true, message: `Contributed $${amount.toLocaleString()} to alliance treasury` }
  },

  declareWar: (targetAllianceId) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }

    const myAlliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!myAlliance) return { success: false, message: 'Alliance not found' }
    if (myAlliance.leader !== player.name) return { success: false, message: 'Only the leader can declare war' }

    const target = state.alliances.find(a => a.id === targetAllianceId)
    if (!target) return { success: false, message: 'Target alliance not found' }

    // Check not already at war
    if (myAlliance.wars.find(w => w.targetAllianceId === targetAllianceId && (w.status === 'voting' || w.status === 'active'))) {
      return { success: false, message: 'Already at war or voting' }
    }

    const war: AllianceWar = {
      id: `war_${Date.now()}`,
      targetAllianceId,
      targetAllianceName: target.name,
      declaredAt: Date.now(),
      votesFor: [player.name], // leader auto-votes yes
      votesAgainst: [],
      status: myAlliance.members.length === 1 ? 'active' : 'voting',
      kills: 0,
      deaths: 0,
    }

    set(s => ({
      alliances: s.alliances.map(a =>
        a.id === state.playerAllianceId ? { ...a, wars: [...a.wars, war] } : a
      ),
    }))

    useNewsStore.getState().pushEvent('alliance',
      `[${myAlliance.tag}] declared war on [${target.tag}] ${target.name}!`
    )

    return { success: true, message: `War declared on [${target.tag}]! ${myAlliance.members.length === 1 ? 'War is active!' : 'Members must vote.'}` }
  },

  voteWar: (warId, vote) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }

    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance) return { success: false, message: 'Alliance not found' }

    const war = alliance.wars.find(w => w.id === warId && w.status === 'voting')
    if (!war) return { success: false, message: 'War vote not found' }

    const votesFor = war.votesFor.filter(n => n !== player.name)
    const votesAgainst = war.votesAgainst.filter(n => n !== player.name)

    if (vote === 'for') votesFor.push(player.name)
    else votesAgainst.push(player.name)

    // Majority rule
    const majority = Math.ceil(alliance.members.length / 2)
    let newStatus: AllianceWar['status'] = 'voting'
    if (votesFor.length >= majority) newStatus = 'active'
    else if (votesAgainst.length >= majority) newStatus = 'peace'

    set(s => ({
      alliances: s.alliances.map(a => {
        if (a.id !== state.playerAllianceId) return a
        return {
          ...a,
          wars: a.wars.map(w =>
            w.id === warId ? { ...w, votesFor, votesAgainst, status: newStatus } : w
          ),
        }
      }),
    }))

    if (newStatus === 'active') {
      useNewsStore.getState().pushEvent('war',
        `[${alliance.tag}] WAR against [${war.targetAllianceName}] is now ACTIVE!`
      )
    }

    return { success: true, message: `Vote recorded: ${vote}` }
  },

  resolveWars: () => {
    // Auto-resolve wars that have been active for 24h (simplified)
    set(s => ({
      alliances: s.alliances.map(a => ({
        ...a,
        wars: a.wars.map(w => {
          if (w.status !== 'active') return w
          if (Date.now() - w.declaredAt < 86400000) return w // 24h minimum

          // Simple resolution: random outcome
          const won = Math.random() > 0.5
          return {
            ...w,
            status: won ? 'victory' as const : 'defeat' as const,
            kills: Math.floor(Math.random() * 50) + 10,
            deaths: Math.floor(Math.random() * 30) + 5,
          }
        }),
      })),
    }))
  },

  getPlayerAlliance: () => {
    const state = get()
    return state.alliances.find(a => a.id === state.playerAllianceId) || null
  },
}))
