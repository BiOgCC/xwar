import { create } from 'zustand'
import { api } from '../api/client'
import { usePlayerStore } from './playerStore'
import { useNewsStore } from './newsStore'
import { rateLimiter } from '../engine/AntiExploit'

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

// ── NPC Bounty Hunt System ──
// Fixed bounty pot divided among all damage contributors on elimination
export interface NPCTarget {
  id: string
  name: string
  countryCode: string   // current country they're in
  health: number
  maxHealth: number
  totalBounty: number     // Fixed total $ pot for this NPC
  rank: 'grunt' | 'elite' | 'boss'
  active: boolean
  damageDealers: Record<string, number>  // playerName → total damage dealt
}

const NPC_TEMPLATES = [
  { name: 'Rogue Operative', maxHealth: 500, totalBounty: 25_000, rank: 'grunt' as const },
  { name: 'Shadow Agent', maxHealth: 800, totalBounty: 40_000, rank: 'grunt' as const },
  { name: 'Desert Phantom', maxHealth: 1200, totalBounty: 75_000, rank: 'elite' as const },
  { name: 'Iron Viper', maxHealth: 1500, totalBounty: 100_000, rank: 'elite' as const },
  { name: 'The Butcher', maxHealth: 3000, totalBounty: 300_000, rank: 'boss' as const },
  { name: 'Ghost of Kyiv', maxHealth: 2000, totalBounty: 200_000, rank: 'boss' as const },
  { name: 'Crimson Jackal', maxHealth: 600, totalBounty: 30_000, rank: 'grunt' as const },
  { name: 'Steel Cobra', maxHealth: 1000, totalBounty: 80_000, rank: 'elite' as const },
]

const BOUNTY_MIN = 10_000
const BOUNTY_EXPIRE_MS = 24 * 60 * 60 * 1000 // 24 hours



export interface BountyState {
  bounties: Bounty[]
  claimedHistory: Bounty[]
  npcTargets: NPCTarget[]
  lastNPCRotationAt: number

  fetchActiveBounties: () => Promise<void>
  placeBounty: (targetPlayer: string, targetCountry: string, amount: number, reason: string) => Promise<{ success: boolean; message: string }>
  claimBounty: (bountyId: string, claimedBy: string) => Promise<{ success: boolean; message: string }>
  subscribeToBounty: (bountyId: string) => Promise<{ success: boolean; message: string }>
  unsubscribeFromBounty: (bountyId: string) => Promise<{ success: boolean; message: string }>
  getActiveBounties: () => Bounty[]
  rotateNPCBounties: () => void
  attackNPC: (npcId: string, damage: number) => { success: boolean; message: string; moneyEarned: number }
}

export const useBountyStore = create<BountyState>((set, get) => ({
  bounties: [],
  claimedHistory: [],
  npcTargets: [],
  lastNPCRotationAt: 0,  // Will trigger on first check

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
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000
    const now = Date.now()
    const state = get()
    if (now - state.lastNPCRotationAt < TWELVE_HOURS_MS) return

    // Get available country codes
    const countries = ['US', 'RU', 'CN', 'DE', 'BR', 'GB', 'FR', 'JP', 'IN', 'AU', 'KR', 'TR', 'MX', 'AR']

    // Pick 3 random NPCs and assign to random countries
    const shuffled = [...NPC_TEMPLATES].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 3)

    const newTargets: NPCTarget[] = selected.map((tmpl, i) => ({
      id: `npc_${now}_${i}`,
      name: tmpl.name,
      countryCode: countries[Math.floor(Math.random() * countries.length)],
      health: tmpl.maxHealth,
      maxHealth: tmpl.maxHealth,
      totalBounty: tmpl.totalBounty,
      rank: tmpl.rank,
      active: true,
      damageDealers: {},
    }))

    set({ npcTargets: newTargets, lastNPCRotationAt: now })

    const names = newTargets.map(t => `${t.name} (${t.countryCode})`).join(', ')
    useNewsStore.getState().pushEvent('bounty', `🎯 NPC Bounty Hunt: ${names} spotted!`)
  },

  attackNPC: (npcId, damage) => {
    // ── Rate limit, stamina cost, damage cap, country check ──
    if (!rateLimiter.check('attackNPC')) return { success: false, message: 'Too fast! Wait a moment.', moneyEarned: 0 }

    const player = usePlayerStore.getState()
    if (player.stamina < 5) return { success: false, message: 'Not enough stamina (need 5)', moneyEarned: 0 }

    const state = get()
    const npc = state.npcTargets.find(t => t.id === npcId && t.active)
    if (!npc) return { success: false, message: 'Target not found or already eliminated', moneyEarned: 0 }

    // Must be in the same country as the NPC
    if (player.countryCode !== npc.countryCode) {
      return { success: false, message: `Target is in ${npc.countryCode} — you must be there to attack`, moneyEarned: 0 }
    }

    // Consume stamina
    player.consumeBar('stamina', 5)

    // Cap damage to player's attack stat (fallback 10 if undefined)
    const maxDmg = Math.max(1, (player as any).attack || 10)
    const effectiveDamage = Math.min(damage, npc.health, maxDmg)
    const newHealth = npc.health - effectiveDamage
    const eliminated = newHealth <= 0

    // Track damage dealt — payout happens only on elimination
    const updatedDealers = { ...npc.damageDealers }
    updatedDealers[player.name] = (updatedDealers[player.name] || 0) + effectiveDamage

    let moneyEarned = 0

    if (eliminated) {
      // ── Pot-based payout: divide total bounty among all damage contributors ──
      const totalDamage = Object.values(updatedDealers).reduce((s, d) => s + d, 0)
      const playerDamage = updatedDealers[player.name] || 0
      const playerShare = Math.floor(npc.totalBounty * (playerDamage / Math.max(1, totalDamage)))
      moneyEarned = playerShare

      // Pay this player their share
      if (playerShare > 0) usePlayerStore.getState().earnMoney(playerShare)

      // In multiplayer, other contributors would get paid server-side.
      // For now, log the split for the news ticker.
      const dealerCount = Object.keys(updatedDealers).length
      useNewsStore.getState().pushEvent('bounty',
        `💀 ${npc.name} eliminated! $${npc.totalBounty.toLocaleString()} bounty split among ${dealerCount} hunter${dealerCount > 1 ? 's' : ''}. ${player.name} earned $${playerShare.toLocaleString()}`
      )
    }

    set(s => ({
      npcTargets: s.npcTargets.map(t =>
        t.id === npcId
          ? { ...t, health: Math.max(0, newHealth), active: !eliminated, damageDealers: updatedDealers }
          : t
      ),
    }))

    return {
      success: true,
      message: eliminated
        ? `${npc.name} eliminated! Your share: $${moneyEarned.toLocaleString()} of $${npc.totalBounty.toLocaleString()}`
        : `Hit ${npc.name} for ${effectiveDamage} damage! (${npc.health - effectiveDamage > 0 ? npc.health - effectiveDamage : 0} HP left)`,
      moneyEarned,
    }
  },
}))

