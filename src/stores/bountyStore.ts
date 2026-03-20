import { create } from 'zustand'
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
export interface NPCTarget {
  id: string
  name: string
  countryCode: string   // current country they're in
  health: number
  maxHealth: number
  rewardPerDamage: number  // $ earned per point of damage
  rank: 'grunt' | 'elite' | 'boss'
  active: boolean
}

const NPC_TEMPLATES = [
  { name: 'Rogue Operative', maxHealth: 500, rewardPerDamage: 100, rank: 'grunt' as const },
  { name: 'Shadow Agent', maxHealth: 800, rewardPerDamage: 150, rank: 'grunt' as const },
  { name: 'Desert Phantom', maxHealth: 1200, rewardPerDamage: 200, rank: 'elite' as const },
  { name: 'Iron Viper', maxHealth: 1500, rewardPerDamage: 250, rank: 'elite' as const },
  { name: 'The Butcher', maxHealth: 3000, rewardPerDamage: 400, rank: 'boss' as const },
  { name: 'Ghost of Kyiv', maxHealth: 2000, rewardPerDamage: 350, rank: 'boss' as const },
  { name: 'Crimson Jackal', maxHealth: 600, rewardPerDamage: 120, rank: 'grunt' as const },
  { name: 'Steel Cobra', maxHealth: 1000, rewardPerDamage: 180, rank: 'elite' as const },
]

const BOUNTY_MIN = 10_000
const BOUNTY_EXPIRE_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Returns known player names for bounty search.
 *  TODO: Backend will provide a real player list endpoint. */
export function getAllKnownPlayers(): { name: string; country: string }[] {
  const player = usePlayerStore.getState()
  // Only returns the current player until backend provides a player list
  if (player.name) {
    return [{ name: player.name, country: player.countryCode || 'US' }]
  }
  return []
}

export interface BountyState {
  bounties: Bounty[]
  claimedHistory: Bounty[]
  npcTargets: NPCTarget[]
  lastNPCRotationAt: number
  placeBounty: (targetPlayer: string, targetCountry: string, amount: number, reason: string) => { success: boolean; message: string }
  claimBounty: (bountyId: string, claimedBy: string) => { success: boolean; message: string }
  subscribeToBounty: (bountyId: string) => { success: boolean; message: string }
  unsubscribeFromBounty: (bountyId: string) => { success: boolean; message: string }
  expireBounties: () => void
  getActiveBounties: () => Bounty[]
  rotateNPCBounties: () => void
  attackNPC: (npcId: string, damage: number) => { success: boolean; message: string; moneyEarned: number }
}

export const useBountyStore = create<BountyState>((set, get) => ({
  bounties: [],
  claimedHistory: [],
  npcTargets: [],
  lastNPCRotationAt: 0,  // Will trigger on first check

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
      hunters: [],
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

    // ── Fix 2: Verification ──
    if (bounty.placedBy === claimedBy) {
      return { success: false, message: "Can't claim your own bounty" }
    }
    if (!bounty.hunters.includes(claimedBy)) {
      return { success: false, message: 'You must be hunting this target to claim the bounty' }
    }

    // Pay the bounty reward
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

  subscribeToBounty: (bountyId) => {
    const player = usePlayerStore.getState()
    const state = get()
    const bounty = state.bounties.find(b => b.id === bountyId && !b.claimed)
    if (!bounty) return { success: false, message: 'Bounty not found' }
    if (bounty.targetPlayer === player.name) return { success: false, message: "Can't hunt yourself" }
    if (bounty.hunters.includes(player.name)) return { success: false, message: 'Already hunting this target' }
    set(s => ({
      bounties: s.bounties.map(b =>
        b.id === bountyId ? { ...b, hunters: [...b.hunters, player.name] } : b
      ),
    }))
    return { success: true, message: `You are now hunting ${bounty.targetPlayer}!` }
  },

  unsubscribeFromBounty: (bountyId) => {
    const player = usePlayerStore.getState()
    set(s => ({
      bounties: s.bounties.map(b =>
        b.id === bountyId ? { ...b, hunters: b.hunters.filter(h => h !== player.name) } : b
      ),
    }))
    return { success: true, message: 'No longer hunting this target' }
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
      rewardPerDamage: tmpl.rewardPerDamage,
      rank: tmpl.rank,
      active: true,
    }))

    set({ npcTargets: newTargets, lastNPCRotationAt: now })

    const names = newTargets.map(t => `${t.name} (${t.countryCode})`).join(', ')
    useNewsStore.getState().pushEvent('bounty', `🎯 NPC Bounty Hunt: ${names} spotted!`)
  },

  attackNPC: (npcId, damage) => {
    // ── Fix 1: Rate limit, stamina cost, damage cap, country check ──
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
    const moneyEarned = effectiveDamage * npc.rewardPerDamage
    const newHealth = npc.health - effectiveDamage
    const eliminated = newHealth <= 0

    // Pay the player
    usePlayerStore.getState().earnMoney(moneyEarned)

    set(s => ({
      npcTargets: s.npcTargets.map(t =>
        t.id === npcId
          ? { ...t, health: Math.max(0, newHealth), active: !eliminated }
          : t
      ),
    }))

    if (eliminated) {
      useNewsStore.getState().pushEvent('bounty',
        `💀 ${player.name} eliminated ${npc.name}! Total bounty: $${moneyEarned.toLocaleString()}`
      )
    }

    return {
      success: true,
      message: eliminated
        ? `${npc.name} eliminated! Earned $${moneyEarned.toLocaleString()}`
        : `Hit ${npc.name} for ${effectiveDamage} damage! Earned $${moneyEarned.toLocaleString()}`,
      moneyEarned,
    }
  },
}))

