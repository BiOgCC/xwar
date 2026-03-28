import { create } from 'zustand'
import { api } from '../api/client'
import { usePlayerStore } from './playerStore'
import { useNewsStore } from './newsStore'

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

const BOUNTY_MIN = 10_000

export interface BountyState {
  bounties: Bounty[]
  claimedHistory: Bounty[]

  fetchActiveBounties: () => Promise<void>
  placeBounty: (targetPlayer: string, targetCountry: string, amount: number, reason: string) => Promise<{ success: boolean; message: string }>
  claimBounty: (bountyId: string, claimedBy: string) => Promise<{ success: boolean; message: string }>
  subscribeToBounty: (bountyId: string) => Promise<{ success: boolean; message: string }>
  unsubscribeFromBounty: (bountyId: string) => Promise<{ success: boolean; message: string }>
  getActiveBounties: () => Bounty[]
}

export const useBountyStore = create<BountyState>((set, get) => ({
  bounties: [],
  claimedHistory: [],

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

      // Specialization hook: mercenary XP from bounty claim
      try {
        const { useSpecializationStore } = await import('./specializationStore')
        useSpecializationStore.getState().recordBountyClaim()
        // RP contribution from bounty claims
        const { useResearchStore } = await import('./researchStore')
        useResearchStore.getState().contributeRP(3, 'bounty')
      } catch (_) {}

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
}))
