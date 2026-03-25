import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import type { ResourceId } from './market/types'
import { getRegionById } from '../data/regionRegistry'

// ====== TYPES ======

export interface MUMember {
  playerId: string
  name: string
  level: number
  countryCode: string
  health: number       // 0-10, like the screenshot
  maxHealth: number
  role: 'commander' | 'member'
  joinedAt: number
  weeklyDamage: number
  totalDamage: number
  terrain: number      // terrain score
  wealth: number
  avatar?: string
  lastActive: number
}

export interface MUApplication {
  id: string
  playerId: string
  playerName: string
  playerLevel: number
  playerCountry: string
  message: string
  appliedAt: number
  status: 'pending' | 'accepted' | 'rejected'
}

export interface MUBadge {
  id: string
  name: string
  icon: string
  description: string
  earnedAt?: number
}

export interface MUTransaction {
  id: string
  type: 'deposit' | 'withdraw' | 'purchase' | 'salary'
  amount: number
  currency: string   // 'money' | 'gold' | 'boh'
  playerName: string
  description: string
  timestamp: number
}

export interface MUDonation {
  id: string
  donorName: string
  donorCountry: string
  amount: number
  currency: string
  message: string
  timestamp: number
}

export interface MUContract {
  id: string
  title: string
  description: string
  reward: number
  currency: string
  status: 'active' | 'completed' | 'expired'
  assignee?: string
  createdBy: string
  createdAt: number
  expiresAt: number
}

/** Vault stores resource quantities + a money treasury */
export interface MUVault {
  treasury: number  // cash balance
  resources: Partial<Record<ResourceId, number>>  // resourceId → quantity
}

export interface MilitaryUnit {
  id: string
  name: string
  bannerUrl: string
  avatarUrl: string
  ownerId: string
  ownerName: string
  ownerCountry: string
  countryCode: string
  regionId: string
  locationRegion: string
  members: MUMember[]
  applications: MUApplication[]
  badges: MUBadge[]
  transactions: MUTransaction[]
  donations: MUDonation[]
  contracts: MUContract[]
  vault: MUVault
  createdAt: number
  // Aggregate stats
  weeklyDamageTotal: number
  totalDamageTotal: number
  // Budget cycle tracking
  cycleDamage: Record<string, number>  // memberName → damage dealt this budget cycle
  lastBudgetPayout: number             // last payout amount (for UI display)
}

// ====== STORE ======

export interface MUState {
  units: Record<string, MilitaryUnit>
  playerUnitId: string | null

  // Getters
  getPlayerUnit: () => MilitaryUnit | null
  getMUDamageBonus: () => number
  getPlayerMember: () => MUMember | null

  // Actions
  createUnit: (name: string, regionId?: string) => { success: boolean; message: string }
  joinUnit: (unitId: string) => { success: boolean; message: string }
  leaveUnit: () => { success: boolean; message: string }
  applyToUnit: (unitId: string, message?: string) => { success: boolean; message: string }
  acceptApplication: (unitId: string, appId: string) => void
  rejectApplication: (unitId: string, appId: string) => void
  promoteMember: (unitId: string, playerId: string) => void
  demoteMember: (unitId: string, playerId: string) => void
  helpMember: (unitId: string, playerId: string) => void
  helpAll: (unitId: string) => void
  askForHelp: () => void
  recordDamage: (playerName: string, damage: number) => void

  // Budget cycle
  recordCycleDamage: (unitId: string, playerName: string, damage: number) => void
  resetAllCycleDamage: () => void
  creditBudgetPayout: (unitId: string, amount: number) => void

  // Vault
  donateMoney: (amount: number, message?: string) => { success: boolean; message: string }
  donateResource: (resourceId: ResourceId, amount: number, message?: string) => { success: boolean; message: string }
  buyResourceForVault: (resourceId: ResourceId, amount: number, unitPrice: number) => { success: boolean; message: string }
  distributeResource: (resourceId: ResourceId, amount: number) => { success: boolean; message: string }
}

/**
 * MU Damage bonus formula:
 * +5% base + 1% per member, capped at +20%
 * A 12-member MU = +17% damage
 */
function calcDamageBonus(memberCount: number): number {
  return 1 + Math.min(0.20, 0.05 + memberCount * 0.01)
}

export const useMUStore = create<MUState>((set, get) => ({
  units: {},
  playerUnitId: null,

  getPlayerUnit: () => {
    const { units, playerUnitId } = get()
    if (!playerUnitId) return null
    return units[playerUnitId] ?? null
  },

  getMUDamageBonus: () => {
    const unit = get().getPlayerUnit()
    if (!unit) return 1.0  // no bonus
    return calcDamageBonus(unit.members.length)
  },

  getPlayerMember: () => {
    const unit = get().getPlayerUnit()
    if (!unit) return null
    const playerName = usePlayerStore.getState().name
    return unit.members.find(m => m.name === playerName) ?? null
  },

  createUnit: (name, regionId) => {
    const player = usePlayerStore.getState()
    if (get().playerUnitId) return { success: false, message: 'You are already in a Military Unit.' }
    if (!name.trim()) return { success: false, message: 'Unit name cannot be empty.' }

    // Cost: 5 gold to create
    if (player.money < 50000) return { success: false, message: 'Need $50,000 to create a Military Unit.' }
    player.spendMoney(50000)

    const selectedRegion = regionId ? getRegionById(regionId) : null
    const unitId = `mu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newUnit: MilitaryUnit = {
      id: unitId,
      name: name.trim(),
      bannerUrl: '',
      avatarUrl: '',
      ownerId: player.name,
      ownerName: player.name,
      ownerCountry: player.countryCode || 'US',
      countryCode: player.countryCode || 'US',
      regionId: regionId || '',
      locationRegion: selectedRegion?.name || player.country || 'Unknown',
      members: [{
        playerId: player.name,
        name: player.name,
        level: player.level,
        countryCode: player.countryCode || 'US',
        health: 10,
        maxHealth: 10,
        role: 'commander',
        joinedAt: Date.now(),
        weeklyDamage: 0,
        totalDamage: player.damageDone,
        terrain: 0,
        wealth: Math.floor(player.money / 1000),
        lastActive: Date.now(),
      }],
      applications: [],
      badges: [],
      transactions: [{
        id: `txn_${Date.now()}_init`,
        type: 'deposit',
        amount: 50000,
        currency: 'money',
        playerName: player.name,
        description: 'Unit creation fee',
        timestamp: Date.now(),
      }],
      donations: [],
      contracts: [],
      vault: { treasury: 0, resources: {} },
      createdAt: Date.now(),
      weeklyDamageTotal: 0,
      totalDamageTotal: player.damageDone,
      cycleDamage: {},
      lastBudgetPayout: 0,
    }

    set(s => ({
      units: { ...s.units, [unitId]: newUnit },
      playerUnitId: unitId,
    }))

    return { success: true, message: `🏴 Military Unit "${name}" created!` }
  },

  joinUnit: (unitId) => {
    const player = usePlayerStore.getState()
    if (get().playerUnitId) return { success: false, message: 'You are already in a Military Unit.' }
    const unit = get().units[unitId]
    if (!unit) return { success: false, message: 'Unit not found.' }

    const member: MUMember = {
      playerId: player.name,
      name: player.name,
      level: player.level,
      countryCode: player.countryCode || 'US',
      health: 10,
      maxHealth: 10,
      role: 'member',
      joinedAt: Date.now(),
      weeklyDamage: 0,
      totalDamage: player.damageDone,
      terrain: 0,
      wealth: Math.floor(player.money / 1000),
      lastActive: Date.now(),
    }

    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          members: [...unit.members, member],
        },
      },
      playerUnitId: unitId,
    }))

    return { success: true, message: `Joined "${unit.name}"!` }
  },

  leaveUnit: () => {
    const { playerUnitId, units } = get()
    if (!playerUnitId) return { success: false, message: 'Not in a Military Unit.' }
    const unit = units[playerUnitId]
    if (!unit) return { success: false, message: 'Unit not found.' }
    const playerName = usePlayerStore.getState().name

    // Owner can't leave if others remain
    if (unit.ownerId === playerName && unit.members.length > 1) {
      return { success: false, message: 'Transfer ownership before leaving.' }
    }

    const newMembers = unit.members.filter(m => m.name !== playerName)

    if (newMembers.length === 0) {
      // Disband unit
      set(s => {
        const newUnits = { ...s.units }
        delete newUnits[playerUnitId]
        return { units: newUnits, playerUnitId: null }
      })
    } else {
      set(s => ({
        units: {
          ...s.units,
          [playerUnitId]: { ...unit, members: newMembers },
        },
        playerUnitId: null,
      }))
    }

    return { success: true, message: 'Left the Military Unit.' }
  },

  applyToUnit: (unitId, message = '') => {
    if (get().playerUnitId) return { success: false, message: 'Leave your current MU first.' }
    const unit = get().units[unitId]
    if (!unit) return { success: false, message: 'Unit not found.' }
    const player = usePlayerStore.getState()

    const alreadyApplied = unit.applications.some(a => a.playerName === player.name && a.status === 'pending')
    if (alreadyApplied) return { success: false, message: 'Application already pending.' }

    const app: MUApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.name,
      playerName: player.name,
      playerLevel: player.level,
      playerCountry: player.countryCode || 'US',
      message,
      appliedAt: Date.now(),
      status: 'pending',
    }

    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          applications: [...unit.applications, app],
        },
      },
    }))

    return { success: true, message: `Applied to "${unit.name}"!` }
  },

  acceptApplication: (unitId, appId) => {
    const unit = get().units[unitId]
    if (!unit) return
    const app = unit.applications.find(a => a.id === appId)
    if (!app || app.status !== 'pending') return

    const member: MUMember = {
      playerId: app.playerId,
      name: app.playerName,
      level: app.playerLevel,
      countryCode: app.playerCountry,
      health: 10,
      maxHealth: 10,
      role: 'member',
      joinedAt: Date.now(),
      weeklyDamage: 0,
      totalDamage: 0,
      terrain: 0,
      wealth: 0,
      lastActive: Date.now(),
    }

    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          members: [...unit.members, member],
          applications: unit.applications.map(a =>
            a.id === appId ? { ...a, status: 'accepted' as const } : a
          ),
        },
      },
    }))
  },

  rejectApplication: (unitId, appId) => {
    const unit = get().units[unitId]
    if (!unit) return
    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          applications: unit.applications.map(a =>
            a.id === appId ? { ...a, status: 'rejected' as const } : a
          ),
        },
      },
    }))
  },

  promoteMember: (unitId, playerId) => {
    const unit = get().units[unitId]
    if (!unit) return
    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          members: unit.members.map(m =>
            m.playerId === playerId ? { ...m, role: 'commander' as const } : m
          ),
        },
      },
    }))
  },

  demoteMember: (unitId, playerId) => {
    const unit = get().units[unitId]
    if (!unit) return
    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          members: unit.members.map(m =>
            m.playerId === playerId ? { ...m, role: 'member' as const } : m
          ),
        },
      },
    }))
  },

  helpMember: (unitId, playerId) => {
    const unit = get().units[unitId]
    if (!unit) return
    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          members: unit.members.map(m =>
            m.playerId === playerId
              ? { ...m, health: Math.min(m.maxHealth, m.health + 2) }
              : m
          ),
        },
      },
    }))
  },

  helpAll: (unitId) => {
    const unit = get().units[unitId]
    if (!unit) return
    set(s => ({
      units: {
        ...s.units,
        [unitId]: {
          ...unit,
          members: unit.members.map(m => ({
            ...m,
            health: Math.min(m.maxHealth, m.health + 2),
          })),
        },
      },
    }))
  },

  askForHelp: () => {
    const unit = get().getPlayerUnit()
    if (!unit) return
    const playerName = usePlayerStore.getState().name
    set(s => ({
      units: {
        ...s.units,
        [unit.id]: {
          ...unit,
          members: unit.members.map(m =>
            m.name === playerName ? { ...m, health: Math.max(0, m.health - 3) } : m
          ),
        },
      },
    }))
  },

  recordDamage: (playerName, damage) => {
    const { playerUnitId, units } = get()
    if (!playerUnitId) return
    const unit = units[playerUnitId]
    if (!unit) return

    const memberIdx = unit.members.findIndex(m => m.name === playerName)
    if (memberIdx < 0) return

    const newMembers = [...unit.members]
    newMembers[memberIdx] = {
      ...newMembers[memberIdx],
      weeklyDamage: newMembers[memberIdx].weeklyDamage + damage,
      totalDamage: newMembers[memberIdx].totalDamage + damage,
      lastActive: Date.now(),
    }

    // Also accumulate cycle damage for budget distribution
    const newCycleDamage = { ...unit.cycleDamage }
    newCycleDamage[playerName] = (newCycleDamage[playerName] || 0) + damage

    set(s => ({
      units: {
        ...s.units,
        [playerUnitId]: {
          ...unit,
          members: newMembers,
          weeklyDamageTotal: unit.weeklyDamageTotal + damage,
          totalDamageTotal: unit.totalDamageTotal + damage,
          cycleDamage: newCycleDamage,
        },
      },
    }))
  },

  recordCycleDamage: (unitId, playerName, damage) => {
    const unit = get().units[unitId]
    if (!unit) return
    const newCycleDamage = { ...unit.cycleDamage }
    newCycleDamage[playerName] = (newCycleDamage[playerName] || 0) + damage
    set(s => ({
      units: {
        ...s.units,
        [unitId]: { ...s.units[unitId], cycleDamage: newCycleDamage },
      },
    }))
  },

  resetAllCycleDamage: () => {
    set(s => {
      const updated: Record<string, MilitaryUnit> = {}
      for (const [id, unit] of Object.entries(s.units)) {
        updated[id] = { ...unit, cycleDamage: {} }
      }
      return { units: updated }
    })
  },

  creditBudgetPayout: (unitId, amount) => {
    set(s => {
      const unit = s.units[unitId]
      if (!unit) return s
      return {
        units: {
          ...s.units,
          [unitId]: {
            ...unit,
            vault: { ...unit.vault, treasury: unit.vault.treasury + amount },
            lastBudgetPayout: amount,
            transactions: [
              { id: `txn_budget_${Date.now()}`, type: 'deposit' as const, amount, currency: 'money', playerName: 'COUNTRY BUDGET', description: 'Military budget payout (performance-based)', timestamp: Date.now() },
              ...unit.transactions.slice(0, 49),
            ],
          },
        },
      }
    })
  },

  // ── Vault: Donate Money ──
  donateMoney: (amount, message = '') => {
    const player = usePlayerStore.getState()
    const unit = get().getPlayerUnit()
    if (!unit) return { success: false, message: 'Not in a Military Unit.' }
    if (amount <= 0) return { success: false, message: 'Amount must be positive.' }
    if (player.money < amount) return { success: false, message: 'Insufficient funds.' }

    player.spendMoney(amount)

    const txn: MUTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'deposit', amount, currency: 'money',
      playerName: player.name,
      description: `Donated $${amount.toLocaleString()}`,
      timestamp: Date.now(),
    }
    const donation: MUDonation = {
      id: `don_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      donorName: player.name,
      donorCountry: player.countryCode || 'US',
      amount, currency: 'money', message,
      timestamp: Date.now(),
    }

    set(s => ({
      units: {
        ...s.units,
        [unit.id]: {
          ...unit,
          vault: { ...unit.vault, treasury: unit.vault.treasury + amount },
          transactions: [...unit.transactions, txn],
          donations: [...unit.donations, donation],
        },
      },
    }))

    return { success: true, message: `Donated $${amount.toLocaleString()} to ${unit.name}!` }
  },

  // ── Vault: Donate Resource ──
  donateResource: (resourceId, amount, message = '') => {
    const player = usePlayerStore.getState() as any
    const unit = get().getPlayerUnit()
    if (!unit) return { success: false, message: 'Not in a Military Unit.' }
    if (amount <= 0) return { success: false, message: 'Amount must be positive.' }

    // Check player has the resource
    const playerAmount = player[resourceId] ?? 0
    if (playerAmount < amount) return { success: false, message: `Not enough ${resourceId}.` }

    // Deduct from player
    usePlayerStore.setState({ [resourceId]: playerAmount - amount })

    const currentQty = unit.vault.resources[resourceId] || 0
    const newResources = { ...unit.vault.resources, [resourceId]: currentQty + amount }

    const txn: MUTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'deposit', amount, currency: resourceId,
      playerName: player.name,
      description: `Donated ${amount} ${resourceId}`,
      timestamp: Date.now(),
    }
    const donation: MUDonation = {
      id: `don_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      donorName: player.name,
      donorCountry: player.countryCode || 'US',
      amount, currency: resourceId, message,
      timestamp: Date.now(),
    }

    set(s => ({
      units: {
        ...s.units,
        [unit.id]: {
          ...unit,
          vault: { ...unit.vault, resources: newResources },
          transactions: [...unit.transactions, txn],
          donations: [...unit.donations, donation],
        },
      },
    }))

    return { success: true, message: `Donated ${amount} ${resourceId} to ${unit.name}!` }
  },

  // ── Vault: Buy resource using treasury ──
  buyResourceForVault: (resourceId, amount, unitPrice) => {
    const unit = get().getPlayerUnit()
    if (!unit) return { success: false, message: 'Not in a Military Unit.' }
    const totalCost = amount * unitPrice
    if (unit.vault.treasury < totalCost) return { success: false, message: `Treasury lacks $${totalCost.toLocaleString()}.` }

    const playerName = usePlayerStore.getState().name
    const currentQty = unit.vault.resources[resourceId] || 0
    const newResources = { ...unit.vault.resources, [resourceId]: currentQty + amount }

    const txn: MUTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'purchase', amount: totalCost, currency: 'money',
      playerName,
      description: `Bought ${amount} ${resourceId} @ $${unitPrice}/ea`,
      timestamp: Date.now(),
    }

    set(s => ({
      units: {
        ...s.units,
        [unit.id]: {
          ...unit,
          vault: {
            treasury: unit.vault.treasury - totalCost,
            resources: newResources,
          },
          transactions: [...unit.transactions, txn],
        },
      },
    }))

    return { success: true, message: `Bought ${amount} ${resourceId} for $${totalCost.toLocaleString()}.` }
  },

  // ── Vault: Distribute resource to all members ──
  distributeResource: (resourceId, amount) => {
    const unit = get().getPlayerUnit()
    if (!unit) return { success: false, message: 'Not in a Military Unit.' }
    const currentQty = unit.vault.resources[resourceId] || 0
    if (currentQty < amount) return { success: false, message: `Vault only has ${currentQty} ${resourceId}.` }

    const perMember = Math.floor(amount / unit.members.length)
    if (perMember < 1) return { success: false, message: 'Not enough to distribute 1 per member.' }
    const totalUsed = perMember * unit.members.length
    const newResources = { ...unit.vault.resources, [resourceId]: currentQty - totalUsed }

    const playerName = usePlayerStore.getState().name
    const txn: MUTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'withdraw', amount: totalUsed, currency: resourceId,
      playerName,
      description: `Distributed ${perMember} ${resourceId} each to ${unit.members.length} members`,
      timestamp: Date.now(),
    }

    // Give to player (self)
    const ps = usePlayerStore.getState() as any
    usePlayerStore.setState({ [resourceId]: (ps[resourceId] ?? 0) + perMember })

    set(s => ({
      units: {
        ...s.units,
        [unit.id]: {
          ...unit,
          vault: { ...unit.vault, resources: newResources },
          transactions: [...unit.transactions, txn],
        },
      },
    }))

    return { success: true, message: `Distributed ${perMember} ${resourceId} to each member (${totalUsed} total).` }
  },
}))
