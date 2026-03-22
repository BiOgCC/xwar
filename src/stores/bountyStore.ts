import { create } from 'zustand'
import { api } from '../api/client'
import { getActiveRaid, raidAttack, raidFund } from '../api/client'
import { usePlayerStore } from './playerStore'
import { useNewsStore } from './newsStore'
import { rateLimiter } from '../engine/AntiExploit'
import { getPlayerCombatStats } from './battleStore'

/* ══════════════════════════════════════════════
   XWAR — Bounty Board Store
   Place bounties on players, claim on kill
   ══════════════════════════════════════════════ */

export interface Bounty {
  id: string
  targetPlayer: string   // target player name
  targetCountry: string  // target's country code
  placedBy: string       // who placed it
  amount: number         // bounty reward
  reason: string         // optional flavor text
  createdAt: number      // timestamp
  expiresAt: number      // auto-expire
  claimed: boolean
  claimedBy?: string
  claimedAt?: number
  hunters: string[]      // players publicly hunting this target
}

// ── NPC Raid Boss System ──
// Tick-based self-balancing combat: Fighters vs Eco
import {
  type RaidBossEvent,
  type PlayerAction,
  createRaidBossEvent,
  getMomentumStatus,
  TICK_DURATION_MS,
} from '../engine/raidBoss'
export type { RaidBossEvent, PlayerAction }
export { getMomentumStatus }

const NPC_TEMPLATES = [
  { name: 'Rogue Operative', rank: 'grunt' as const },
  { name: 'Shadow Agent', rank: 'grunt' as const },
  { name: 'Desert Phantom', rank: 'elite' as const },
  { name: 'Iron Viper', rank: 'elite' as const },
  { name: 'The Butcher', rank: 'boss' as const },
  { name: 'Ghost of Kyiv', rank: 'boss' as const },
  { name: 'Crimson Jackal', rank: 'grunt' as const },
  { name: 'Steel Cobra', rank: 'elite' as const },
]

const BOUNTY_MIN = 10_000
const BOUNTY_EXPIRE_MS = 24 * 60 * 60 * 1000

export interface BountyState {
  bounties: Bounty[]
  claimedHistory: Bounty[]

  // Raid Boss system
  raidEvents: RaidBossEvent[]
  actionBuffer: Record<string, PlayerAction[]>  // eventId → buffered actions
  lastNPCRotationAt: number

  fetchActiveBounties: () => Promise<void>
  fetchActiveRaid: () => Promise<void>
  placeBounty: (targetPlayer: string, targetCountry: string, amount: number, reason: string) => Promise<{ success: boolean; message: string }>
  claimBounty: (bountyId: string, claimedBy: string) => Promise<{ success: boolean; message: string }>
  subscribeToBounty: (bountyId: string) => Promise<{ success: boolean; message: string }>
  unsubscribeFromBounty: (bountyId: string) => Promise<{ success: boolean; message: string }>
  getActiveBounties: () => Bounty[]
  rotateNPCBounties: () => void
  processRaidTicks: () => void
  attackRaidBoss: (eventId: string) => Promise<{ success: boolean; message: string }>
  fundRaidBoss: (eventId: string, amount: number) => Promise<{ success: boolean; message: string }>

  // Legacy compat (used by BountyBattleCard/slider)
  npcTargets: never[]  // deprecated, use raidEvents
  attackNPC: (id: string, dmg: number) => { success: boolean; message: string; moneyEarned: number }
  supportNPC: (id: string, amt: number) => { success: boolean; message: string }
}

export const useBountyStore = create<BountyState>((set, get) => ({
  bounties: [],
  claimedHistory: [],
  raidEvents: [],  // populated from server via fetchActiveRaid
  actionBuffer: {},
  lastNPCRotationAt: 0,
  npcTargets: [] as never[],  // deprecated

  fetchActiveBounties: async () => {
    try {
      const res: any = await api.get('/bounty/active')
      if (res.success && res.bounties) {
        set({ bounties: res.bounties })
      }
    } catch (err) {
      console.error('Failed to fetch bounties:', err)
    }
  },

  fetchActiveRaid: async () => {
    try {
      const res = await getActiveRaid()
      if (!res.success) return

      if (!res.event) {
        // No active raid — clear local state
        set(s => ({ raidEvents: s.raidEvents.filter(e => e.status !== 'active') }))
        return
      }

      const evt = res.event
      const participants = res.participants || []

      // Build fighters/supporters maps from participants
      const fighters: Record<string, { totalDmg: number; ticksActive: number }> = {}
      const supporters: Record<string, { totalFunded: number }> = {}
      for (const p of participants) {
        if (p.side === 'fighter') {
          fighters[p.playerName] = { totalDmg: p.totalDmg || 0, ticksActive: p.hits || 0 }
        } else {
          supporters[p.playerName] = { totalFunded: p.totalFunded || 0 }
        }
      }

      const grandTotal = (evt.totalHunterDmg || 0) + (evt.totalBossDmg || 0)
      const momentum = grandTotal > 0 ? (evt.totalHunterDmg || 0) / grandTotal : 0.5

      const raidEvent: RaidBossEvent = {
        id: evt.id,
        name: evt.name,
        rank: evt.rank,
        countryCode: evt.countryCode || 'US',
        status: evt.status as RaidBossEvent['status'],
        baseBounty: evt.baseBounty || 0,
        supportPool: evt.supportPool || 0,
        totalHunterDmg: evt.totalHunterDmg || 0,
        totalBossDmg: evt.totalBossDmg || 0,
        momentum,
        currentTick: evt.currentTick || 0,
        maxTicks: 120,
        bossStaggered: false,
        startedAt: evt.startedAt || Date.now(),
        expiresAt: evt.expiresAt,
        lastTickAt: Date.now(),
        fighters,
        supporters,
        tickHistory: [],
      }

      // Replace or add the active event
      set(s => {
        const otherEvents = s.raidEvents.filter(e => e.id !== evt.id && e.status !== 'active')
        return { raidEvents: [...otherEvents, raidEvent] }
      })
    } catch (err) {
      console.error('Failed to fetch active raid:', err)
    }
  },

  placeBounty: async (targetPlayer, targetCountry, amount, reason) => {
    const player = usePlayerStore.getState()

    if (amount < BOUNTY_MIN) return { success: false, message: `Minimum bounty is $${BOUNTY_MIN.toLocaleString()}` }
    if (player.money < amount) return { success: false, message: 'Insufficient funds' }
    if (targetPlayer === player.name) return { success: false, message: "You can't bounty yourself" }

    try {
      const res: any = await api.post('/bounty/place', { targetName: targetPlayer, reward: amount, reason })
      
      if (!res.success) return { success: false, message: res.error || 'Failed to place bounty' }

      // Deduct locally and refresh to see newly placed bounty
      player.spendMoney(amount)
      get().fetchActiveBounties()
      
      return { success: true, message: `Bounty placed on ${targetPlayer}!` }
    } catch (e: any) {
      return { success: false, message: e.message || 'Error placing bounty' }
    }
  },

  claimBounty: async (bountyId, claimedBy) => {
    try {
      const res: any = await api.post('/bounty/claim', { bountyId })
      if (!res.success) return { success: false, message: res.error || 'Failed to claim' }

      // Success
      const player = usePlayerStore.getState()
      player.earnMoney(res.reward)

      // Move into claimed history locally
      const state = get()
      const bounty = state.bounties.find(b => b.id === bountyId)
      if (bounty) {
        const claimedBounty: Bounty = { ...bounty, claimed: true, claimedBy, claimedAt: Date.now() }
        set(s => ({
          bounties: s.bounties.filter(b => b.id !== bountyId),
          claimedHistory: [claimedBounty, ...s.claimedHistory].slice(0, 20),
        }))
        // Push to news ticker
        useNewsStore.getState().pushEvent('bounty', `${claimedBy} collected $${res.reward.toLocaleString()} bounty on ${bounty.targetPlayer}!`)
      }

      return { success: true, message: res.message }
    } catch (e: any) { return { success: false, message: e.message || 'Error claiming bounty' } }
  },

  subscribeToBounty: async (bountyId) => {
    try {
      const res: any = await api.post(`/bounty/subscribe/${bountyId}`)
      if (res.success) {
        const player = usePlayerStore.getState()
        set(s => ({
          bounties: s.bounties.map(b => b.id === bountyId ? { ...b, hunters: [...b.hunters, player.name] } : b),
        }))
        return { success: true, message: res.message }
      }
      return { success: false, message: res.error || 'Failed to subscribe' }
    } catch (e: any) { return { success: false, message: e.message } }
  },

  unsubscribeFromBounty: async (bountyId) => {
    try {
      const res: any = await api.post(`/bounty/unsubscribe/${bountyId}`)
      if (res.success) {
        const player = usePlayerStore.getState()
        set(s => ({
          bounties: s.bounties.map(b => b.id === bountyId ? { ...b, hunters: b.hunters.filter(h => h !== player.name) } : b),
        }))
        return { success: true, message: res.message }
      }
      return { success: false, message: res.error || 'Failed to unsubscribe' }
    } catch (e: any) { return { success: false, message: e.message } }
  },

  getActiveBounties: () => {
    const now = Date.now()
    return get().bounties.filter(b => !b.claimed && b.expiresAt > now)
  },

  rotateNPCBounties: () => {
    const now = Date.now()
    const state = get()
    const player = usePlayerStore.getState()
    const countries = ['US', 'RU', 'CN', 'DE', 'BR', 'GB', 'FR', 'JP', 'IN', 'AU', 'KR', 'TR', 'MX', 'AR']

    // ── Pay out supporters of expired events that boss survived ──
    state.raidEvents.forEach(evt => {
      if (evt.status === 'boss_survives' || (evt.status === 'active' && now > evt.expiresAt)) {
        const myEntry = evt.supporters[player.name]
        if (myEntry && myEntry.totalFunded > 0) {
          const myPayout = myEntry.totalFunded * 2
          player.earnMoney(myPayout)
          useNewsStore.getState().pushEvent('bounty',
            `🛡️ ${evt.name} survived! ${player.name} earned $${myPayout.toLocaleString()} (x2 support return)`
          )
        }
      }
    })

    // Clean up ended/expired events
    const activeEvents = state.raidEvents.filter(e =>
      e.status === 'active' && now < e.expiresAt
    )

    // Only 1 raid boss at a time — skip if one is already active
    if (activeEvents.length > 0) {
      // Just clean stale events, keep the active one
      if (activeEvents.length !== state.raidEvents.length) {
        set({ raidEvents: activeEvents, lastNPCRotationAt: now })
      }
      return
    }

    // 15% chance to spawn a new boss
    if (Math.random() > 0.15) {
      set({ raidEvents: [], lastNPCRotationAt: now })
      return
    }

    // Spawn 1 random boss
    const tmpl = NPC_TEMPLATES[Math.floor(Math.random() * NPC_TEMPLATES.length)]
    const newEvent = createRaidBossEvent(
      tmpl.name,
      tmpl.rank,
      countries[Math.floor(Math.random() * countries.length)],
    )

    set({ raidEvents: [newEvent], actionBuffer: {}, lastNPCRotationAt: now })
    useNewsStore.getState().pushEvent('bounty', `🎯 Raid Boss Hunt: ${newEvent.name} (${newEvent.countryCode}) spotted!`)
  },

  processRaidTicks: () => {
    const state = get()
    const now = Date.now()
    let changed = false
    const updatedEvents: RaidBossEvent[] = []
    const player = usePlayerStore.getState()

    // Boss base damage per hit by rank (like a PvP division auto-attacking)
    const BOSS_BASE_DMG: Record<string, number> = { grunt: 200, elite: 500, boss: 1200 }
    const BOSS_ATTACKS_PER_TICK: Record<string, number> = { grunt: 2, elite: 3, boss: 5 }

    for (const evt of state.raidEvents) {
      if (evt.status !== 'active') {
        updatedEvents.push(evt)
        continue
      }

      // Check if it's time for a new tick
      if (now - evt.lastTickAt < TICK_DURATION_MS) {
        updatedEvents.push(evt)
        continue
      }

      changed = true
      const newTick = evt.currentTick + 1

      // ── Boss auto-attacks: multiple hits per tick, each with own variance ──
      const bossBase = BOSS_BASE_DMG[evt.rank] || 200
      const attacks = BOSS_ATTACKS_PER_TICK[evt.rank] || 2
      let bossDmg = 0
      for (let i = 0; i < attacks; i++) {
        const v = 0.85 + Math.random() * 0.30  // ±15% per hit
        bossDmg += Math.round(bossBase * v)
      }
      const newBossTotal = evt.totalBossDmg + bossDmg
      const grandTotal = evt.totalHunterDmg + newBossTotal
      const momentum = grandTotal > 0 ? evt.totalHunterDmg / grandTotal : 0.5

      // Check win/lose — ONLY when timer expires (damage race)
      let status: RaidBossEvent['status'] = evt.status
      if (now >= evt.expiresAt || newTick >= evt.maxTicks) {
        // Timer expired — whoever dealt more damage wins
        status = evt.totalHunterDmg > newBossTotal ? 'hunters_win' : 'boss_survives'
      }

      const tickEntry: RaidBossEvent['tickHistory'][number] = {
        tick: newTick,
        timestamp: now,
        hunterDmg: 0,
        bossDmg,
        fundedDmg: 0,
        momentum,
        bossStaggered: false,
        playerActions: [],
      }

      const updated: RaidBossEvent = {
        ...evt,
        currentTick: newTick,
        lastTickAt: now,
        totalBossDmg: newBossTotal,
        momentum,
        status,
        tickHistory: [...evt.tickHistory.slice(-29), tickEntry],
      }

      // ── Payouts on end ──
      if (status !== 'active') {
        const totalPot = updated.baseBounty + updated.supportPool

        if (status === 'hunters_win') {
          // Hunters get x2 pot split by damage contribution
          const totalFighterDmg = Object.values(updated.fighters).reduce((s, f) => s + f.totalDmg, 0)
          if (totalFighterDmg > 0 && updated.fighters[player.name]) {
            const myShare = Math.floor(totalPot * 2 * (updated.fighters[player.name].totalDmg / totalFighterDmg))
            if (myShare > 0) player.earnMoney(myShare)
            useNewsStore.getState().pushEvent('bounty',
              `💀 ${updated.name} eliminated! Hunters win x2! ${player.name} earned $${myShare.toLocaleString()}`
            )
          }
        } else if (status === 'boss_survives' || status === 'boss_dominates') {
          // Supporters get x2 return on their investment
          if (updated.supporters[player.name]) {
            const myPayout = updated.supporters[player.name].totalFunded * 2
            if (myPayout > 0) player.earnMoney(myPayout)
            useNewsStore.getState().pushEvent('bounty',
              `🛡️ ${updated.name} survived! ${player.name} earned $${myPayout.toLocaleString()} (x2 return)`
            )
          }
        }
      }

      updatedEvents.push(updated)
    }

    if (changed) {
      set({ raidEvents: updatedEvents })
    }
  },

  attackRaidBoss: async (eventId) => {
    if (!rateLimiter.check('attackNPC')) return { success: false, message: 'Too fast! Wait a moment.' }

    try {
      const res = await raidAttack(eventId)
      // Update local state immediately with response data
      if (res.success) {
        set(s => ({
          raidEvents: s.raidEvents.map(e =>
            e.id === eventId
              ? { ...e, totalHunterDmg: res.totalHunterDmg, totalBossDmg: res.totalBossDmg }
              : e
          ),
        }))
        // Also deduct stamina locally
        usePlayerStore.getState().consumeBar('stamina', 5)
      }
      return { success: res.success, message: res.message }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Attack failed' }
    }
  },

  fundRaidBoss: async (eventId, amount) => {
    try {
      const res = await raidFund(eventId, amount)
      if (res.success) {
        set(s => ({
          raidEvents: s.raidEvents.map(e =>
            e.id === eventId
              ? { ...e, totalBossDmg: res.totalBossDmg, supportPool: res.supportPool }
              : e
          ),
        }))
        // Money was deducted server-side; refresh player balance locally
        usePlayerStore.getState().spendMoney(amount)
      }
      return { success: res.success, message: res.message }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Fund failed' }
    }
  },

  // ── Legacy compatibility shims ──
  attackNPC: (id, _dmg) => {
    // Legacy shim: fire and forget, return sync result
    get().attackRaidBoss(id)
    return { success: true, message: 'Attacking...', moneyEarned: 0 }
  },
  supportNPC: (id, amt) => {
    get().fundRaidBoss(id, amt)
    return { success: true, message: 'Funding...' }
  },
}))

