import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useInventoryStore, generateStats, WEAPON_SUBTYPES } from './inventoryStore'
import type { EquipItem } from './inventoryStore'

/* ══════════════════════════════════════════════
   XWAR — Daily Login Reward Store
   7-day escalating streak with 24h grace window
   ══════════════════════════════════════════════ */

export interface DailyReward {
  day: number
  label: string
  icon: string
  money: number
  items?: { type: string; amount: number }[]
  bitcoin?: number
  lootBoxes?: number
  militaryBoxes?: number
  t5Item?: boolean
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, label: 'Day 1', icon: '🎁', money: 50_000, items: [{ type: 'bread', amount: 5 }] },
  { day: 2, label: 'Day 2', icon: '🎁', money: 75_000, items: [{ type: 'sushi', amount: 5 }] },
  { day: 3, label: 'Day 3', icon: '🎁', money: 100_000, items: [{ type: 'wagyu', amount: 5 }], lootBoxes: 1 },
  { day: 4, label: 'Day 4', icon: '🎁', money: 150_000, items: [{ type: 'staminaPills', amount: 2 }] },
  { day: 5, label: 'Day 5', icon: '🎁', money: 200_000, militaryBoxes: 1 },
  { day: 6, label: 'Day 6', icon: '🎁', money: 300_000, bitcoin: 3 },
  { day: 7, label: 'Day 7', icon: '🏆', money: 500_000, t5Item: true },
]

const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface DailyRewardState {
  loginStreak: number        // 0-7 (0 = never claimed)
  lastClaimedAt: number      // timestamp of last claim
  showPopup: boolean         // whether to show the reward popup
  todayClaimed: boolean      // whether today's reward was already claimed

  // Actions
  checkLoginReward: () => void
  claimReward: () => { success: boolean; message: string; reward?: DailyReward }
  dismissPopup: () => void
  canClaim: () => boolean
  getCurrentReward: () => DailyReward
  getStreakStatus: () => { streak: number; nextReward: DailyReward; graceExpires: number | null }
}

export const useDailyRewardStore = create<DailyRewardState>((set, get) => ({
  loginStreak: 0,
  lastClaimedAt: 0,
  showPopup: false,
  todayClaimed: false,

  checkLoginReward: () => {
    const state = get()
    if (state.todayClaimed) return

    const now = Date.now()
    const timeSinceLast = now - state.lastClaimedAt

    // If never claimed or within grace window, show popup
    if (state.lastClaimedAt === 0 || timeSinceLast >= GRACE_WINDOW_MS) {
      // Check if streak should reset (missed the grace window — more than 48h)
      if (state.lastClaimedAt > 0 && timeSinceLast > GRACE_WINDOW_MS * 2) {
        // Streak broken — reset
        set({ loginStreak: 0, showPopup: true })
      } else {
        set({ showPopup: true })
      }
    }
  },

  claimReward: () => {
    const state = get()
    if (state.todayClaimed) return { success: false, message: 'Already claimed today!' }

    const now = Date.now()
    const timeSinceLast = now - state.lastClaimedAt

    // Check grace window (allow if never claimed, or enough time passed)
    if (state.lastClaimedAt > 0 && timeSinceLast < GRACE_WINDOW_MS) {
      return { success: false, message: 'Come back tomorrow!' }
    }

    // Determine if streak continues or resets
    let newStreak = state.loginStreak
    if (state.lastClaimedAt > 0 && timeSinceLast > GRACE_WINDOW_MS * 2) {
      newStreak = 0 // Streak broken
    }

    // Advance streak (wraps after day 7)
    newStreak = (newStreak % 7) + 1
    const reward = DAILY_REWARDS[newStreak - 1]

    // Grant rewards to player
    const player = usePlayerStore.getState()
    player.earnMoney(reward.money)

    if (reward.items) {
      for (const item of reward.items) {
        usePlayerStore.setState(s => ({
          [item.type]: ((s as any)[item.type] || 0) + item.amount,
        }))
      }
    }
    if (reward.bitcoin) {
      usePlayerStore.setState(s => ({ bitcoin: s.bitcoin + reward.bitcoin! }))
    }
    if (reward.lootBoxes) {
      usePlayerStore.setState(s => ({ lootBoxes: s.lootBoxes + reward.lootBoxes! }))
    }
    if (reward.militaryBoxes) {
      usePlayerStore.setState(s => ({ militaryBoxes: s.militaryBoxes + reward.militaryBoxes! }))
    }
    if (reward.t5Item) {
      // Generate a random T5 item
      const slots = ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots'] as const
      const slot = slots[Math.floor(Math.random() * slots.length)]
      const category = slot === 'weapon' ? 'weapon' as const : 'armor' as const
      const subtype = slot === 'weapon' ? WEAPON_SUBTYPES['t5'][Math.floor(Math.random() * WEAPON_SUBTYPES['t5'].length)] : undefined
      const result = generateStats(category, slot, 't5', subtype)
      const newItem: EquipItem = {
        id: `daily_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: `🎁 ${result.name}`,
        slot, category, tier: 't5',
        equipped: false,
        durability: 100,
        stats: result.stats,
        weaponSubtype: result.weaponSubtype,
        location: 'inventory',
      }
      useInventoryStore.getState().addItem(newItem)
    }

    set({
      loginStreak: newStreak,
      lastClaimedAt: now,
      todayClaimed: true,
      showPopup: false,
    })

    return { success: true, message: `Day ${newStreak} reward claimed!`, reward }
  },

  dismissPopup: () => set({ showPopup: false }),

  canClaim: () => {
    const state = get()
    if (state.todayClaimed) return false
    if (state.lastClaimedAt === 0) return true
    return Date.now() - state.lastClaimedAt >= GRACE_WINDOW_MS
  },

  getCurrentReward: () => {
    const state = get()
    let nextDay = state.loginStreak % 7
    // Check if streak would be broken
    if (state.lastClaimedAt > 0 && Date.now() - state.lastClaimedAt > GRACE_WINDOW_MS * 2) {
      nextDay = 0 // Would reset
    }
    return DAILY_REWARDS[nextDay]
  },

  getStreakStatus: () => {
    const state = get()
    let streak = state.loginStreak
    if (state.lastClaimedAt > 0 && Date.now() - state.lastClaimedAt > GRACE_WINDOW_MS * 2) {
      streak = 0
    }
    const nextDay = (streak % 7)
    return {
      streak,
      nextReward: DAILY_REWARDS[nextDay],
      graceExpires: state.lastClaimedAt > 0 ? state.lastClaimedAt + GRACE_WINDOW_MS * 2 : null,
    }
  },
}))
