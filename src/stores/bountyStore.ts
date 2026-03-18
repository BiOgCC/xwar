import { create } from 'zustand'
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
}

const BOUNTY_MIN = 10_000
const BOUNTY_EXPIRE_MS = 24 * 60 * 60 * 1000 // 24 hours

// Simulated NPC players for bounty targets
const NPC_TARGETS = [
  { name: 'Ocelot', country: 'RU' },
  { name: 'Vulture', country: 'CN' },
  { name: 'Phantom', country: 'DE' },
  { name: 'Cobra', country: 'BR' },
  { name: 'Viper', country: 'GB' },
  { name: 'Jackal', country: 'JP' },
  { name: 'Raven', country: 'FR' },
  { name: 'Scorpion', country: 'KR' },
  { name: 'Wolf', country: 'IN' },
  { name: 'Hawk', country: 'MX' },
]

export interface BountyState {
  bounties: Bounty[]
  claimedHistory: Bounty[]
  placeBounty: (targetPlayer: string, targetCountry: string, amount: number, reason: string) => { success: boolean; message: string }
  claimBounty: (bountyId: string, claimedBy: string) => { success: boolean; message: string }
  expireBounties: () => void
  getActiveBounties: () => Bounty[]
}

export const useBountyStore = create<BountyState>((set, get) => ({
  // Seed with some NPC bounties for flavor
  bounties: [
    {
      id: 'seed_b1',
      targetPlayer: 'Ocelot',
      targetCountry: 'RU',
      placedBy: 'COMMAND',
      amount: 100_000,
      reason: 'War crimes in Eastern Europe',
      createdAt: Date.now() - 3600000,
      expiresAt: Date.now() + BOUNTY_EXPIRE_MS,
      claimed: false,
    },
    {
      id: 'seed_b2',
      targetPlayer: 'Vulture',
      targetCountry: 'CN',
      placedBy: 'COMMAND',
      amount: 250_000,
      reason: 'Cyber espionage against NATO',
      createdAt: Date.now() - 1800000,
      expiresAt: Date.now() + BOUNTY_EXPIRE_MS,
      claimed: false,
    },
    {
      id: 'seed_b3',
      targetPlayer: 'Phantom',
      targetCountry: 'DE',
      placedBy: 'Intelligence',
      amount: 75_000,
      reason: 'Arms dealing to hostile states',
      createdAt: Date.now() - 900000,
      expiresAt: Date.now() + BOUNTY_EXPIRE_MS,
      claimed: false,
    },
  ],
  claimedHistory: [],

  placeBounty: (targetPlayer, targetCountry, amount, reason) => {
    const player = usePlayerStore.getState()

    if (amount < BOUNTY_MIN) {
      return { success: false, message: `Minimum bounty is $${BOUNTY_MIN.toLocaleString()}` }
    }
    if (player.money < amount) {
      return { success: false, message: 'Insufficient funds' }
    }
    if (targetPlayer === player.name) {
      return { success: false, message: "You can't bounty yourself" }
    }

    // Deduct money
    player.spendMoney(amount)

    const newBounty: Bounty = {
      id: `bounty_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      targetPlayer,
      targetCountry,
      placedBy: player.name,
      amount,
      reason: reason || 'Wanted dead or alive',
      createdAt: Date.now(),
      expiresAt: Date.now() + BOUNTY_EXPIRE_MS,
      claimed: false,
    }

    set(s => ({ bounties: [newBounty, ...s.bounties] }))

    // Push to news ticker
    useNewsStore.getState().pushEvent('bounty',
      `${player.name} placed a $${amount.toLocaleString()} bounty on ${targetPlayer}`
    )

    return { success: true, message: `Bounty placed on ${targetPlayer}!` }
  },

  claimBounty: (bountyId, claimedBy) => {
    const state = get()
    const bounty = state.bounties.find(b => b.id === bountyId && !b.claimed)

    if (!bounty) {
      return { success: false, message: 'Bounty not found or already claimed' }
    }

    // Pay the bounty reward (from thin air)
    const player = usePlayerStore.getState()
    player.earnMoney(bounty.amount)

    const claimedBounty: Bounty = {
      ...bounty,
      claimed: true,
      claimedBy,
      claimedAt: Date.now(),
    }

    set(s => ({
      bounties: s.bounties.filter(b => b.id !== bountyId),
      claimedHistory: [claimedBounty, ...s.claimedHistory].slice(0, 20),
    }))

    // Push to news ticker
    useNewsStore.getState().pushEvent('bounty',
      `${claimedBy} collected $${bounty.amount.toLocaleString()} bounty on ${bounty.targetPlayer}!`
    )

    return { success: true, message: `Bounty claimed! $${bounty.amount.toLocaleString()} collected.` }
  },

  expireBounties: () => {
    const now = Date.now()
    set(s => ({
      bounties: s.bounties.filter(b => b.expiresAt > now),
    }))
  },

  getActiveBounties: () => {
    const now = Date.now()
    return get().bounties.filter(b => !b.claimed && b.expiresAt > now)
  },
}))

export { NPC_TARGETS }
