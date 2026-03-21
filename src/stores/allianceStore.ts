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
}

export const useAllianceStore = create<AllianceState>((set, get) => ({
  alliances: SEED_ALLIANCES,
  // Player starts in NATO (same as Commander_X)
  playerAllianceId: 'alliance_nato',
  lastTreatySnapshotAt: Date.now(),
  fundProposals: [],

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
      
      set(s => ({
        alliances: [...s.alliances, res.alliance],
        playerAllianceId: res.alliance.id,
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
