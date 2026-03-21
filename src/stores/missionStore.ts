import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useUIStore } from './uiStore'

/* ══════════════════════════════════════════════
   XWAR — Mission Store
   7 fixed daily missions following the game flow
   Cosmetic-only rewards via OP Points
   Level-scaling targets + completion toasts
   ══════════════════════════════════════════════ */

// ── Mission Definitions ─────────────────────────────────────────────────────

export type MissionId = 'work' | 'produce' | 'fight' | 'eat' | 'cyber' | 'military' | 'market'

export interface MissionDef {
  id: MissionId
  name: string
  icon: string
  description: string
  baseTarget: number   // base target at level 1
  unit: string         // "times", "damage", "trades", etc.
  scaleFactor: number  // how much target grows per level (0 = no scaling)
}

export const MISSION_DEFS: MissionDef[] = [
  { id: 'work',     name: 'WORK',     icon: '🔨', description: 'Work at your job',                      baseTarget: 3,    unit: 'times',     scaleFactor: 0.2 },
  { id: 'produce',  name: 'PRODUCE',  icon: '⚙️', description: 'Produce at your companies',              baseTarget: 2,    unit: 'companies', scaleFactor: 0.1 },
  { id: 'fight',    name: 'FIGHT',    icon: '⚔️', description: 'Deal damage in battles',                 baseTarget: 5000, unit: 'damage',    scaleFactor: 500 },
  { id: 'eat',      name: 'EAT',      icon: '🍖', description: 'Eat food to restore stamina',            baseTarget: 5,    unit: 'times',     scaleFactor: 0.3 },
  { id: 'cyber',    name: 'CYBER',    icon: '🖥️', description: 'Launch a cyber operation',               baseTarget: 1,    unit: 'ops',       scaleFactor: 0 },
  { id: 'military', name: 'MILITARY', icon: '🎖️', description: 'Launch or join a military campaign',     baseTarget: 1,    unit: 'campaigns', scaleFactor: 0 },
  { id: 'market',   name: 'MARKET',   icon: '📊', description: 'Complete market trades (buy or sell)',    baseTarget: 2,    unit: 'trades',    scaleFactor: 0.15 },
]

/** Get mission target scaled by player level */
export function getScaledTarget(def: MissionDef): number {
  const level = usePlayerStore.getState().level || 1
  return Math.max(def.baseTarget, Math.floor(def.baseTarget + def.scaleFactor * (level - 1)))
}

// ── Cosmetic Definitions ────────────────────────────────────────────────────

export type CosmeticRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CosmeticType = 'title' | 'avatar_border' | 'chat_badge' | 'name_color' | 'profile_flair' | 'medal'

export interface CosmeticItem {
  id: string
  name: string
  type: CosmeticType
  rarity: CosmeticRarity
  cost: number           // OP cost
  icon: string
  preview: string        // visual description
}

export const COSMETIC_SHOP: CosmeticItem[] = [
  // Common (5 OP)
  { id: 'title_operative',     name: 'Operative',           type: 'title',         rarity: 'common',    cost: 5,   icon: '🏷️', preview: 'Title: "Operative"' },
  { id: 'title_recruit',       name: 'Recruit',             type: 'title',         rarity: 'common',    cost: 5,   icon: '🏷️', preview: 'Title: "Recruit"' },
  { id: 'badge_star',          name: 'Star Badge',          type: 'chat_badge',    rarity: 'common',    cost: 5,   icon: '⭐', preview: '⭐ next to name in chat' },
  { id: 'border_silver',       name: 'Silver Ring',         type: 'avatar_border', rarity: 'common',    cost: 5,   icon: '🔲', preview: 'Silver border around avatar' },

  // Rare (15 OP)
  { id: 'title_warlord',       name: 'Warlord',             type: 'title',         rarity: 'rare',      cost: 15,  icon: '🏷️', preview: 'Title: "Warlord"' },
  { id: 'title_tycoon',        name: 'Tycoon',              type: 'title',         rarity: 'rare',      cost: 15,  icon: '🏷️', preview: 'Title: "Tycoon"' },
  { id: 'badge_fire',          name: 'Fire Badge',          type: 'chat_badge',    rarity: 'rare',      cost: 15,  icon: '🔥', preview: '🔥 next to name in chat' },
  { id: 'color_emerald',       name: 'Emerald Name',        type: 'name_color',    rarity: 'rare',      cost: 15,  icon: '🎨', preview: 'Green gradient name color' },
  { id: 'border_gold',         name: 'Gold Ring',           type: 'avatar_border', rarity: 'rare',      cost: 15,  icon: '🔲', preview: 'Gold animated border' },

  // Epic (40 OP)
  { id: 'title_shadow_agent',  name: 'Shadow Agent',        type: 'title',         rarity: 'epic',      cost: 40,  icon: '🏷️', preview: 'Title: "Shadow Agent"' },
  { id: 'badge_diamond',       name: 'Diamond Badge',       type: 'chat_badge',    rarity: 'epic',      cost: 40,  icon: '💎', preview: '💎 next to name in chat' },
  { id: 'color_plasma',        name: 'Plasma Name',         type: 'name_color',    rarity: 'epic',      cost: 40,  icon: '🎨', preview: 'Purple gradient name' },
  { id: 'flair_particles',     name: 'Particle Trail',      type: 'profile_flair', rarity: 'epic',      cost: 40,  icon: '✨', preview: 'Particle effect on profile' },
  { id: 'medal_veteran',       name: 'Veteran Medal',       type: 'medal',         rarity: 'epic',      cost: 40,  icon: '🏅', preview: 'Permanent medal on profile' },

  // Legendary (100 OP)
  { id: 'title_supreme',       name: 'Supreme Commander',   type: 'title',         rarity: 'legendary', cost: 100, icon: '🏷️', preview: 'Title: "Supreme Commander"' },
  { id: 'badge_skull',         name: 'Skull Badge',         type: 'chat_badge',    rarity: 'legendary', cost: 100, icon: '☠️', preview: '☠️ next to name in chat' },
  { id: 'color_inferno',       name: 'Inferno Name',        type: 'name_color',    rarity: 'legendary', cost: 100, icon: '🎨', preview: 'Red-orange fire gradient' },
  { id: 'flair_lightning',     name: 'Lightning Aura',      type: 'profile_flair', rarity: 'legendary', cost: 100, icon: '⚡', preview: 'Lightning border on profile' },
  { id: 'medal_legend',        name: 'Legend Medal',        type: 'medal',         rarity: 'legendary', cost: 100, icon: '🏅', preview: 'Legendary medal on profile' },
]

export const RARITY_META: Record<CosmeticRarity, { label: string; color: string }> = {
  common:    { label: 'Common',    color: '#9ca3af' },
  rare:      { label: 'Rare',      color: '#3b82f6' },
  epic:      { label: 'Epic',      color: '#a855f7' },
  legendary: { label: 'Legendary', color: '#f59e0b' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// ── Store ────────────────────────────────────────────────────────────────────

export interface MissionProgress {
  current: number
  claimed: boolean
}

export interface MissionState {
  // Daily tracking
  dailyDate: string
  progress: Record<MissionId, MissionProgress>
  allClaimedBonus: boolean   // +3 OP bonus for completing all 7

  // OP economy
  opPoints: number
  totalOPEarned: number

  // Streak
  streakDays: number
  lastStreakDate: string     // last date streak was incremented

  // Owned cosmetics
  ownedCosmetics: string[]  // cosmetic IDs
  equippedTitle: string | null
  equippedBorder: string | null
  equippedBadge: string | null
  equippedNameColor: string | null
  equippedFlair: string | null

  // Actions
  trackWork: () => void
  trackProduce: () => void
  trackDamage: (amount: number) => void
  trackEat: () => void
  trackCyber: () => void
  trackMilitary: () => void
  trackMarket: () => void

  claimMission: (id: MissionId) => { success: boolean; message: string }
  claimAllBonus: () => { success: boolean; message: string }

  purchaseCosmetic: (cosmeticId: string) => { success: boolean; message: string }
  equipCosmetic: (cosmeticId: string) => void
  unequipCosmetic: (type: CosmeticType) => void

  // Getters
  getMissionDef: (id: MissionId) => MissionDef | undefined
  isCompleted: (id: MissionId) => boolean
  allCompleted: () => boolean
  getDailyOPEarned: () => number
}

function freshProgress(): Record<MissionId, MissionProgress> {
  return {
    work:     { current: 0, claimed: false },
    produce:  { current: 0, claimed: false },
    fight:    { current: 0, claimed: false },
    eat:      { current: 0, claimed: false },
    cyber:    { current: 0, claimed: false },
    military: { current: 0, claimed: false },
    market:   { current: 0, claimed: false },
  }
}

function ensureToday(state: MissionState): Partial<MissionState> {
  const today = todayKey()
  if (state.dailyDate !== today) {
    // Check streak
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const yesterdayKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`

    const streakContinues = state.lastStreakDate === yesterdayKey && state.allClaimedBonus
    return {
      dailyDate: today,
      progress: freshProgress(),
      allClaimedBonus: false,
      streakDays: streakContinues ? state.streakDays + 1 : (state.allClaimedBonus ? 1 : 0),
      lastStreakDate: streakContinues ? today : state.lastStreakDate,
    }
  }
  return {}
}

function trackMission(state: MissionState, id: MissionId, amount: number): Partial<MissionState> {
  const reset = ensureToday(state)
  const merged = { ...state, ...reset }
  const p = { ...merged.progress }
  const mission = p[id]
  if (mission.claimed) return reset // already claimed, don't track
  const def = MISSION_DEFS.find(d => d.id === id)
  if (!def) return reset
  const target = getScaledTarget(def)
  const wasBelowTarget = mission.current < target
  const newCurrent = Math.min(mission.current + amount, target)
  p[id] = { ...mission, current: newCurrent }

  // Fire completion toast if just crossed the threshold
  if (wasBelowTarget && newCurrent >= target) {
    try {
      useUIStore.getState().addFloatingText(
        `${def.icon} ${def.name} MISSION COMPLETE — Claim your OP!`,
        window.innerWidth / 2,
        window.innerHeight / 2 - 60,
        '#22d38a'
      )
    } catch (_) { /* silent if UI store unavailable */ }
  }

  return { ...reset, progress: p }
}

export const useMissionStore = create<MissionState>((set, get) => ({
  dailyDate: todayKey(),
  progress: freshProgress(),
  allClaimedBonus: false,

  opPoints: 0,
  totalOPEarned: 0,

  streakDays: 0,
  lastStreakDate: '',

  ownedCosmetics: [],
  equippedTitle: null,
  equippedBorder: null,
  equippedBadge: null,
  equippedNameColor: null,
  equippedFlair: null,

  // ═══ TRACKING ═══

  trackWork:     () => set(s => trackMission(s, 'work', 1)),
  trackProduce:  () => set(s => trackMission(s, 'produce', 1)),
  trackDamage:   (amount) => set(s => trackMission(s, 'fight', amount)),
  trackEat:      () => set(s => trackMission(s, 'eat', 1)),
  trackCyber:    () => set(s => trackMission(s, 'cyber', 1)),
  trackMilitary: () => set(s => trackMission(s, 'military', 1)),
  trackMarket:   () => set(s => trackMission(s, 'market', 1)),

  // ═══ CLAIMING ═══

  claimMission: (id) => {
    const state = get()
    const reset = ensureToday(state)
    const merged = { ...state, ...reset }
    const p = merged.progress[id]
    const def = MISSION_DEFS.find(d => d.id === id)
    if (!def) return { success: false, message: 'Unknown mission' }
    if (p.claimed) return { success: false, message: 'Already claimed' }
    const target = getScaledTarget(def)
    if (p.current < target) return { success: false, message: `Not complete (${p.current}/${target})` }

    set(s => ({
      ...reset,
      progress: { ...merged.progress, [id]: { ...p, claimed: true } },
      opPoints: s.opPoints + 1,
      totalOPEarned: s.totalOPEarned + 1,
    }))
    return { success: true, message: '+1 OP' }
  },

  claimAllBonus: () => {
    const state = get()
    const reset = ensureToday(state)
    const merged = { ...state, ...reset }

    if (merged.allClaimedBonus) return { success: false, message: 'Bonus already claimed' }

    const allClaimed = MISSION_DEFS.every(d => merged.progress[d.id].claimed)
    if (!allClaimed) return { success: false, message: 'Complete and claim all 7 missions first' }

    const today = todayKey()
    set(s => ({
      ...reset,
      allClaimedBonus: true,
      opPoints: s.opPoints + 3,
      totalOPEarned: s.totalOPEarned + 3,
      streakDays: s.lastStreakDate === today ? s.streakDays : s.streakDays + 1,
      lastStreakDate: today,
    }))
    return { success: true, message: '+3 bonus OP! All missions complete!' }
  },

  // ═══ COSMETIC SHOP ═══

  purchaseCosmetic: (cosmeticId) => {
    const state = get()
    const item = COSMETIC_SHOP.find(c => c.id === cosmeticId)
    if (!item) return { success: false, message: 'Item not found' }
    if (state.ownedCosmetics.includes(cosmeticId)) return { success: false, message: 'Already owned' }
    if (state.opPoints < item.cost) return { success: false, message: `Need ${item.cost} OP (have ${state.opPoints})` }

    set(s => ({
      opPoints: s.opPoints - item.cost,
      ownedCosmetics: [...s.ownedCosmetics, cosmeticId],
    }))
    return { success: true, message: `Purchased "${item.name}"!` }
  },

  equipCosmetic: (cosmeticId) => {
    const item = COSMETIC_SHOP.find(c => c.id === cosmeticId)
    if (!item) return
    const state = get()
    if (!state.ownedCosmetics.includes(cosmeticId)) return

    const slotMap: Record<CosmeticType, keyof MissionState> = {
      title: 'equippedTitle',
      avatar_border: 'equippedBorder',
      chat_badge: 'equippedBadge',
      name_color: 'equippedNameColor',
      profile_flair: 'equippedFlair',
      medal: 'equippedFlair', // medals share flair slot
    }
    const slot = slotMap[item.type]
    if (slot) set({ [slot]: cosmeticId } as any)
  },

  unequipCosmetic: (type) => {
    const slotMap: Record<CosmeticType, keyof MissionState> = {
      title: 'equippedTitle',
      avatar_border: 'equippedBorder',
      chat_badge: 'equippedBadge',
      name_color: 'equippedNameColor',
      profile_flair: 'equippedFlair',
      medal: 'equippedFlair',
    }
    const slot = slotMap[type]
    if (slot) set({ [slot]: null } as any)
  },

  // ═══ GETTERS ═══

  getMissionDef: (id) => MISSION_DEFS.find(d => d.id === id),

  isCompleted: (id) => {
    const state = get()
    const reset = ensureToday(state)
    const merged = { ...state, ...reset }
    const def = MISSION_DEFS.find(d => d.id === id)
    if (!def) return false
    return merged.progress[id].current >= getScaledTarget(def)
  },

  allCompleted: () => {
    const state = get()
    const reset = ensureToday(state)
    const merged = { ...state, ...reset }
    return MISSION_DEFS.every(d => merged.progress[d.id].current >= getScaledTarget(d))
  },

  getDailyOPEarned: () => {
    const state = get()
    const reset = ensureToday(state)
    const merged = { ...state, ...reset }
    let earned = 0
    MISSION_DEFS.forEach(d => { if (merged.progress[d.id].claimed) earned++ })
    if (merged.allClaimedBonus) earned += 3
    return earned
  },
}))
