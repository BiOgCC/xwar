import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useNewsStore } from './newsStore'
import { useWorldStore } from './worldStore'
import { api } from '../api/client'

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
  activeIdeology: string | null
  ideologyVotes: Record<string, string>
  ideologyXP: Record<string, number>     // { vanguard: 450, syndicate: 120, ... }
  lastIdeologyResetAt: number            // timestamp, 14-day cooldown
}

export interface AllianceIdeologyResetProposal {
  id: string
  proposerId: string
  newIdeology: string
  votesFor: string[]
  votesAgainst: string[]
  status: 'voting' | 'passed' | 'rejected' | 'expired'
  proposedAt: number
  expiresAt: number
}

// Ideology XP per level: Level N needs N * 200 cumulative XP. Max level 10.
const IDEOLOGY_XP_PER_LEVEL = 200
const IDEOLOGY_MAX_LEVEL = 10

export function getIdeologyLevel(xp: number): number {
  return Math.min(IDEOLOGY_MAX_LEVEL, Math.floor(xp / IDEOLOGY_XP_PER_LEVEL))
}

export function getIdeologyBonus(alliance: Alliance | null): number {
  if (!alliance || !alliance.activeIdeology) return 1
  const xp = alliance.ideologyXP?.[alliance.activeIdeology] || 0
  const level = getIdeologyLevel(xp)
  if (alliance.activeIdeology === 'nexus') return 1 + level * 0.02   // +2% per level (max +20%)
  return 1 + level * 0.01  // +1% per level (max +10%)
}

export function getIdeologyXPProgress(alliance: Alliance | null): { level: number; xp: number; nextXP: number; percent: number } {
  if (!alliance || !alliance.activeIdeology) return { level: 0, xp: 0, nextXP: IDEOLOGY_XP_PER_LEVEL, percent: 0 }
  const xp = alliance.ideologyXP?.[alliance.activeIdeology] || 0
  const level = getIdeologyLevel(xp)
  if (level >= IDEOLOGY_MAX_LEVEL) return { level, xp, nextXP: IDEOLOGY_MAX_LEVEL * IDEOLOGY_XP_PER_LEVEL, percent: 100 }
  const currentLevelXP = level * IDEOLOGY_XP_PER_LEVEL
  const nextXP = (level + 1) * IDEOLOGY_XP_PER_LEVEL
  const percent = ((xp - currentLevelXP) / (nextXP - currentLevelXP)) * 100
  return { level, xp, nextXP, percent }
}

const MAX_ALLIANCE_SIZE = 5
const MIN_CONTRIBUTION = 10_000
const WAR_VOTE_DURATION = 3600000 // 1 hour

// No NPC seed alliances — alliances are player-created only
const SEED_ALLIANCES: Alliance[] = []

export interface AllianceFundProposal {
  id: string
  proposerId: string
  targetCountryCode: string
  amount: number
  direction: 'to_country' | 'to_alliance'  // to_country = alliance→fund, to_alliance = fund→alliance
  votesFor: string[]
  votesAgainst: string[]
  status: 'voting' | 'passed' | 'rejected' | 'expired'
  proposedAt: number
  expiresAt: number
}

export interface AllianceState {
  alliances: Alliance[]
  playerAllianceId: string | null
  lastTreatySnapshotAt: number  // timestamp of last 12h snapshot
  fundProposals: AllianceFundProposal[]
  ideologyResetProposals: AllianceIdeologyResetProposal[]

  fetchAlliances: () => Promise<void>
  createAlliance: (name: string, tag: string) => Promise<{ success: boolean; message: string }>
  joinAlliance: (allianceId: string) => Promise<{ success: boolean; message: string }>
  leaveAlliance: () => { success: boolean; message: string }
  contribute: (amount: number) => Promise<{ success: boolean; message: string }>
  withdraw: (amount: number) => Promise<{ success: boolean; message: string }>
  declareWar: (targetAllianceId: string) => { success: boolean; message: string }
  voteWar: (warId: string, vote: 'for' | 'against') => { success: boolean; message: string }
  resolveWars: () => void
  processTreatySnapshot: () => void
  getPlayerAlliance: () => Alliance | null

  // Alliance Congress — fund transfers require vote
  proposeFundTransfer: (targetCountryCode: string, amount: number, direction: 'to_country' | 'to_alliance') => { success: boolean; message: string }
  voteOnFundTransfer: (proposalId: string, vote: 'for' | 'against') => { success: boolean; message: string }
  resolveFundProposals: () => void

  // Alliance Empire — ideology system
  proposeIdeologyReset: (newIdeology: string) => { success: boolean; message: string }
  voteOnIdeologyReset: (proposalId: string, vote: 'for' | 'against') => { success: boolean; message: string }
  resolveIdeologyResetProposals: () => void
  contributeIdeologyXP: (amount: number) => void
}

export const useAllianceStore = create<AllianceState>((set, get) => ({
  alliances: SEED_ALLIANCES,
  // Player starts with no alliance — must create or join one
  playerAllianceId: null,
  lastTreatySnapshotAt: Date.now(),
  fundProposals: [],
  ideologyResetProposals: [],

  fetchAlliances: async () => {
    try {
      const res: any = await api.get('/alliance')
      set({ alliances: res.alliances || [] })
      
      // Attempt to determine playerAllianceId locally if we need to sync 
      // This might be better handled by the player fetching their own alliance ID.
      // For now, assume player data keeps track or we do it from the alliances list:
      const player = usePlayerStore.getState()
      const myAlliance = res.alliances?.find((a: Alliance) => 
        a.members.some(m => m.name === player.name)
      )
      if (myAlliance) set({ playerAllianceId: myAlliance.id })
    } catch (err: any) {
      console.error('[Alliance] fetch error', err)
    }
  },

  createAlliance: async (name, tag) => {
    try {
      const res: any = await api.post('/alliance/create', { name, tag })
      usePlayerStore.getState().spendMoney(500_000)
      
      const newAlliance = {
        ...res.alliance,
        activeIdeology: null,
        ideologyVotes: {},
        ideologyXP: {},
        lastIdeologyResetAt: 0,
      }
      
      set(s => ({
        alliances: [...s.alliances, newAlliance],
        playerAllianceId: newAlliance.id,
      }))
      
      const p = usePlayerStore.getState()
      useNewsStore.getState().pushEvent('alliance', `${p.name} founded the alliance [${tag}] ${name}`)
      
      return { success: true, message: `Alliance [${tag}] ${name} created!` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to create alliance' }
    }
  },

  joinAlliance: async (allianceId) => {
    try {
      const res: any = await api.post('/alliance/join', { allianceId })
      const state = get()
      const alliance = state.alliances.find(a => a.id === allianceId)
      
      if (alliance) {
        const player = usePlayerStore.getState()
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
        useNewsStore.getState().pushEvent('alliance', `${player.name} joined [${alliance.tag}] ${alliance.name}`)
      }
      
      return { success: true, message: res.message || 'Joined alliance!' }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to join alliance' }
    }
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

  contribute: async (amount) => {
    try {
      const res: any = await api.post('/alliance/donate', { amount })
      const state = get()
      const player = usePlayerStore.getState()
      
      player.spendMoney(amount)
      
      set(s => ({
        alliances: s.alliances.map(a => {
          if (a.id !== state.playerAllianceId) return a
          return {
            ...a,
            treasury: Number(a.treasury) + amount,
          }
        }),
      }))
      
      return { success: true, message: res.message || `Contributed $${amount.toLocaleString()}` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Contribution failed' }
    }
  },

  withdraw: async (amount) => {
    try {
      const res: any = await api.post('/alliance/withdraw', { amount })
      const state = get()
      const player = usePlayerStore.getState()
      
      const tax = Math.floor(amount * 0.02)
      const afterTax = amount - tax
      player.earnMoney(afterTax)
      
      set(s => ({
        alliances: s.alliances.map(a => {
          if (a.id !== state.playerAllianceId) return a
          return {
            ...a,
            treasury: Math.max(0, Number(a.treasury) - amount),
          }
        }),
      }))
      
      return { success: true, message: res.message || `Withdrew $${amount.toLocaleString()}` }
    } catch (err: any) {
      return { success: false, message: err.message || 'Withdrawal failed' }
    }
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

  processTreatySnapshot: () => {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
    const now = Date.now()
    const state = get()
    if (now - state.lastTreatySnapshotAt < TWELVE_HOURS_MS) return

    set(s => ({
      lastTreatySnapshotAt: now,
      alliances: s.alliances.map(alliance => {
        // 1. Treasury interest: +1% per 12h cycle
        const interest = Math.floor(alliance.treasury * 0.01)
        const newTreasury = alliance.treasury + interest

        // 2. Auto-resolve stale war votes (open > 12h)
        const updatedWars = alliance.wars.map(war => {
          if (war.status !== 'voting') return war
          if (now - war.declaredAt < TWELVE_HOURS_MS) return war

          // Majority wins, ties = peace
          const forCount = war.votesFor.length
          const againstCount = war.votesAgainst.length
          const newStatus = forCount > againstCount ? 'active' as const : 'peace' as const

          if (newStatus === 'active') {
            useNewsStore.getState().pushEvent('war',
              `[${alliance.tag}] WAR vote auto-resolved → ACTIVE against ${war.targetAllianceName}!`
            )
          }

          return { ...war, status: newStatus }
        })

        return {
          ...alliance,
          treasury: newTreasury,
          wars: updatedWars,
        }
      }),
    }))

    useNewsStore.getState().pushEvent('economy', '🤝 Alliance treaty snapshot: treasury interest applied, stale votes resolved')
  },

  // ══════════════════════════════════════════════════════════════
  // ALLIANCE CONGRESS — Fund Transfer Proposals (require vote)
  // ══════════════════════════════════════════════════════════════

  proposeFundTransfer: (targetCountryCode, amount, direction) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }

    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance) return { success: false, message: 'Alliance not found' }

    // Only leader/officer can propose
    const member = alliance.members.find(m => m.name === player.name)
    if (!member || member.role === 'member')
      return { success: false, message: 'Only leaders and officers can propose fund transfers' }

    // Target country must belong to an alliance member
    if (!alliance.members.some(m => m.countryCode === targetCountryCode))
      return { success: false, message: 'Target country must belong to an alliance member' }

    if (amount < 10_000) return { success: false, message: 'Minimum transfer: $10,000' }

    // Check source balance
    if (direction === 'to_country') {
      if (alliance.treasury < amount)
        return { success: false, message: `Alliance treasury has $${alliance.treasury.toLocaleString()}, need $${amount.toLocaleString()}` }
    }
    // For to_alliance, we check the national fund balance at execution time (after vote passes)

    const proposal: AllianceFundProposal = {
      id: `fp_${Date.now()}`,
      proposerId: player.name,
      targetCountryCode,
      amount,
      direction,
      votesFor: [player.name],  // proposer auto-votes yes
      votesAgainst: [],
      status: alliance.members.length === 1 ? 'passed' : 'voting',
      proposedAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12h expiry
    }

    // If solo alliance, execute immediately
    if (alliance.members.length === 1) {
      const result = executeFundTransfer(alliance, proposal)
      if (!result.success) return result
      set(s => ({ fundProposals: [...s.fundProposals, { ...proposal, status: 'passed' }] }))
      return { success: true, message: `Transfer executed: $${amount.toLocaleString()} ${direction === 'to_country' ? 'to national fund' : 'to alliance treasury'}` }
    }

    set(s => ({ fundProposals: [...s.fundProposals, proposal] }))
    useNewsStore.getState().pushEvent('alliance',
      `📋 [${alliance.tag}] Fund transfer proposal: $${amount.toLocaleString()} ${direction === 'to_country' ? '→ national fund' : '→ alliance treasury'}. Vote now!`
    )

    return { success: true, message: `Proposal created. Members must vote (majority required).` }
  },

  voteOnFundTransfer: (proposalId, vote) => {
    const player = usePlayerStore.getState()
    const state = get()

    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }

    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance) return { success: false, message: 'Alliance not found' }

    // Must be a member
    if (!alliance.members.some(m => m.name === player.name))
      return { success: false, message: 'Not in this alliance' }

    const proposal = state.fundProposals.find(p => p.id === proposalId && p.status === 'voting')
    if (!proposal) return { success: false, message: 'Proposal not found or already resolved' }

    // Remove any existing vote
    const votesFor = proposal.votesFor.filter(n => n !== player.name)
    const votesAgainst = proposal.votesAgainst.filter(n => n !== player.name)

    if (vote === 'for') votesFor.push(player.name)
    else votesAgainst.push(player.name)

    // Check majority
    const majority = Math.ceil(alliance.members.length / 2)
    let newStatus: AllianceFundProposal['status'] = 'voting'

    if (votesFor.length >= majority) {
      newStatus = 'passed'
      // Execute the transfer
      const execResult = executeFundTransfer(alliance, { ...proposal, votesFor, votesAgainst })
      if (!execResult.success) {
        newStatus = 'rejected' // Transfer failed (insufficient balance etc.)
      }
    } else if (votesAgainst.length >= majority) {
      newStatus = 'rejected'
    }

    set(s => ({
      fundProposals: s.fundProposals.map(p =>
        p.id === proposalId ? { ...p, votesFor, votesAgainst, status: newStatus } : p
      ),
    }))

    if (newStatus === 'passed') {
      useNewsStore.getState().pushEvent('alliance',
        `✅ [${alliance.tag}] Fund transfer PASSED: $${proposal.amount.toLocaleString()}`
      )
    } else if (newStatus === 'rejected') {
      useNewsStore.getState().pushEvent('alliance',
        `❌ [${alliance.tag}] Fund transfer REJECTED`
      )
    }

    return { success: true, message: `Vote recorded: ${vote}` }
  },

  resolveFundProposals: () => {
    const now = Date.now()
    set(s => ({
      fundProposals: s.fundProposals.map(p => {
        if (p.status !== 'voting') return p
        if (now < p.expiresAt) return p

        // Auto-resolve expired proposals — majority wins, ties = rejected
        const forCount = p.votesFor.length
        const againstCount = p.votesAgainst.length
        let newStatus: AllianceFundProposal['status'] = forCount > againstCount ? 'passed' : 'rejected'

        if (newStatus === 'passed') {
          const state = get()
          const alliance = state.alliances.find(a =>
            a.members.some(m => m.name === p.proposerId)
          )
          if (alliance) {
            const result = executeFundTransfer(alliance, p)
            if (!result.success) newStatus = 'rejected'
          } else {
            newStatus = 'rejected'
          }
        }

        return { ...p, status: newStatus }
      }),
    }))
  },

  proposeIdeologyReset: (newIdeology) => {
    const player = usePlayerStore.getState()
    const state = get()
    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }
    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance) return { success: false, message: 'Alliance not found' }
    const member = alliance.members.find(m => m.name === player.name)
    if (!member) return { success: false, message: 'Not in this alliance' }
    if (member.role !== 'leader' && member.role !== 'officer') return { success: false, message: 'Only leaders/officers can propose' }
    if (alliance.activeIdeology === newIdeology) return { success: false, message: 'Already active ideology' }

    // 14-day cooldown
    const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000
    if (alliance.lastIdeologyResetAt && Date.now() - alliance.lastIdeologyResetAt < FOURTEEN_DAYS) {
      const remaining = Math.ceil((FOURTEEN_DAYS - (Date.now() - alliance.lastIdeologyResetAt)) / 86400000)
      return { success: false, message: `Cooldown: ${remaining}d remaining` }
    }

    // Check no other active proposal
    if (state.ideologyResetProposals.some(p => p.status === 'voting')) {
      return { success: false, message: 'Another ideology vote is already active' }
    }

    const proposal: AllianceIdeologyResetProposal = {
      id: `ideo_${Date.now()}`,
      proposerId: player.name,
      newIdeology,
      votesFor: [player.name],
      votesAgainst: [],
      status: 'voting',
      proposedAt: Date.now(),
      expiresAt: Date.now() + 24 * 3600000, // 24h
    }
    set(s => ({ ideologyResetProposals: [...s.ideologyResetProposals, proposal] }))

    // Auto-resolve if single member
    if (alliance.members.length === 1) {
      get().resolveIdeologyResetProposals()
    }

    return { success: true, message: `Proposed switch to ${newIdeology.toUpperCase()}` }
  },

  voteOnIdeologyReset: (proposalId, vote) => {
    const player = usePlayerStore.getState()
    const state = get()
    if (!state.playerAllianceId) return { success: false, message: 'Not in an alliance' }

    const proposal = state.ideologyResetProposals.find(p => p.id === proposalId)
    if (!proposal || proposal.status !== 'voting') return { success: false, message: 'Proposal not found or closed' }

    if (proposal.votesFor.includes(player.name) || proposal.votesAgainst.includes(player.name)) {
      return { success: false, message: 'Already voted' }
    }

    set(s => ({
      ideologyResetProposals: s.ideologyResetProposals.map(p => {
        if (p.id !== proposalId) return p
        return vote === 'for'
          ? { ...p, votesFor: [...p.votesFor, player.name] }
          : { ...p, votesAgainst: [...p.votesAgainst, player.name] }
      }),
    }))

    // Auto-resolve after vote
    get().resolveIdeologyResetProposals()
    return { success: true, message: `Voted ${vote.toUpperCase()}` }
  },

  resolveIdeologyResetProposals: () => {
    const state = get()
    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance) return

    const majority = Math.ceil(alliance.members.length / 2)
    const now = Date.now()

    set(s => ({
      ideologyResetProposals: s.ideologyResetProposals.map(p => {
        if (p.status !== 'voting') return p

        let newStatus: 'voting' | 'passed' | 'rejected' | 'expired' = 'voting'
        if (p.votesFor.length >= majority) newStatus = 'passed'
        else if (p.votesAgainst.length >= majority) newStatus = 'rejected'
        else if (now > p.expiresAt) newStatus = 'expired'

        if (newStatus === 'passed') {
          // Switch ideology — XP persists, just change active
          useAllianceStore.setState(ss => ({
            alliances: ss.alliances.map(a =>
              a.id === state.playerAllianceId
                ? { ...a, activeIdeology: p.newIdeology, lastIdeologyResetAt: now }
                : a
            ),
          }))
          useNewsStore.getState().pushEvent('alliance',
            `[${alliance.tag}] switched ideology to ${p.newIdeology.toUpperCase()}`
          )
        }

        return { ...p, status: newStatus }
      }),
    }))
  },

  contributeIdeologyXP: (amount) => {
    const state = get()
    if (!state.playerAllianceId) return
    const alliance = state.alliances.find(a => a.id === state.playerAllianceId)
    if (!alliance || !alliance.activeIdeology) return

    const ideo = alliance.activeIdeology
    const currentXP = alliance.ideologyXP?.[ideo] || 0
    const maxXP = IDEOLOGY_MAX_LEVEL * IDEOLOGY_XP_PER_LEVEL
    if (currentXP >= maxXP) return  // Already max level

    set(s => ({
      alliances: s.alliances.map(a => {
        if (a.id !== state.playerAllianceId) return a
        return { ...a, ideologyXP: { ...a.ideologyXP, [ideo]: Math.min(maxXP, currentXP + amount) } }
      }),
    }))
  },
}))

// ── Helper: execute a fund transfer (called after vote passes) ──
function executeFundTransfer(
  alliance: Alliance,
  proposal: AllianceFundProposal
): { success: boolean; message: string } {
  try {
    const worldState = useWorldStore.getState()

    if (proposal.direction === 'to_country') {
      // Alliance treasury → national fund
      if (alliance.treasury < proposal.amount) {
        return { success: false, message: 'Insufficient alliance treasury' }
      }
      // Deduct from alliance treasury
      useAllianceStore.setState(s => ({
        alliances: s.alliances.map(a =>
          a.id === alliance.id ? { ...a, treasury: a.treasury - proposal.amount } : a
        ),
      }))
      // Add to national fund
      worldState.addTreasuryTax(proposal.targetCountryCode, proposal.amount)
    } else {
      // National fund → alliance treasury
      const country = worldState.getCountry(proposal.targetCountryCode)
      if (!country || country.fund.money < proposal.amount) {
        return { success: false, message: 'Insufficient national fund balance' }
      }
      worldState.spendFromFund(proposal.targetCountryCode, { money: proposal.amount })
      useAllianceStore.setState(s => ({
        alliances: s.alliances.map(a =>
          a.id === alliance.id ? { ...a, treasury: a.treasury + proposal.amount } : a
        ),
      }))
    }

    return { success: true, message: 'Transfer executed' }
  } catch (e) {
    console.warn('[Alliance] Fund transfer failed:', e)
    return { success: false, message: 'Transfer failed' }
  }
}
