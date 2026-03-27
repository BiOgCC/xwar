import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { getDailyStatus, claimDailyReward } from '../api/client'
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
  badgesOfHonor?: number
  t5Item?: boolean
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, label: 'Day 1', icon: '🎁', money: 50_000, bitcoin: 1, items: [{ type: 'bread', amount: 5 }] },
  { day: 2, label: 'Day 2', icon: '🎁', money: 75_000, bitcoin: 1, items: [{ type: 'sushi', amount: 5 }] },
  { day: 3, label: 'Day 3', icon: '🎁', money: 100_000, bitcoin: 1, items: [{ type: 'wagyu', amount: 5 }], lootBoxes: 1 },
  { day: 4, label: 'Day 4', icon: '🎁', money: 150_000, bitcoin: 1, items: [{ type: 'magicTea', amount: 2 }] },
  { day: 5, label: 'Day 5', icon: '🎁', money: 200_000, bitcoin: 1, militaryBoxes: 1, badgesOfHonor: 1 },
  { day: 6, label: 'Day 6', icon: '🎁', money: 300_000, bitcoin: 1 },
  { day: 7, label: 'Day 7', icon: '🏆', money: 500_000, bitcoin: 1, t5Item: true, badgesOfHonor: 1 },
]

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function getDayStartUTC(timestamp = Date.now()): number {
  const d = new Date(timestamp)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export interface DailyRewardState {
  loginStreak: number        // 0-7 (0 = never claimed)
  lastClaimedAt: number      // timestamp of last claim
  showPopup: boolean         // whether to show the reward popup

  // Actions
  checkLoginReward: () => Promise<void>
  claimReward: () => Promise<{ success: boolean; message: string; reward?: DailyReward }>
  dismissPopup: () => void
  canClaim: () => boolean
  getCurrentReward: () => DailyReward
  getStreakStatus: () => { streak: number; nextReward: DailyReward; graceExpires: number | null }
}

export const useDailyRewardStore = create<DailyRewardState>((set, get) => ({
  loginStreak: 0,
  lastClaimedAt: 0,
  showPopup: false,

  checkLoginReward: async () => {
    try {
      const res = await getDailyStatus()
      if (res.success) {
        set({ 
          loginStreak: res.streak,
          lastClaimedAt: res.lastClaimedAt ? new Date(res.lastClaimedAt).getTime() : 0,
          showPopup: res.canClaim
        })
        return
      }
    } catch (err) {
      console.warn('[DailyReward] API unavailable, using local state')
    }
    // Fallback: use local state to determine if popup should show
    const state = get()
    if (state.canClaim()) {
      set({ showPopup: true })
    }
  },

  claimReward: async () => {
    const state = get()
    if (!state.canClaim()) {
      return { success: false, message: 'Already claimed today' }
    }

    // Determine the current reward
    const rewardIndex = state.loginStreak % 7
    const reward = DAILY_REWARDS[rewardIndex]
    const newStreak = state.loginStreak + 1

    // Apply rewards client-side immediately
    const player = usePlayerStore.getState()
    if (reward.money) player.earnMoney(reward.money)
    if (reward.bitcoin) {
      usePlayerStore.setState(s => ({ bitcoin: s.bitcoin + reward.bitcoin! }))
    }
    if (reward.lootBoxes) {
      usePlayerStore.setState(s => ({ lootBoxes: s.lootBoxes + reward.lootBoxes! }))
    }
    if (reward.militaryBoxes) {
      usePlayerStore.setState(s => ({ militaryBoxes: s.militaryBoxes + reward.militaryBoxes! }))
    }
    if (reward.badgesOfHonor) {
      usePlayerStore.setState(s => ({ badgesOfHonor: s.badgesOfHonor + reward.badgesOfHonor! }))
    }
    if (reward.items) {
      reward.items.forEach(item => {
        player.addResource(item.type, item.amount, 'daily_reward')
      })
    }

    // Update store state — close popup, advance streak
    set({
      loginStreak: newStreak,
      lastClaimedAt: Date.now(),
      showPopup: false,
    })

    // Try API as best-effort (fire-and-forget)
    try {
      await claimDailyReward()
    } catch {
      // API unavailable — rewards already applied client-side
    }

    return { success: true, message: `Claimed Day ${rewardIndex + 1} reward!`, reward }
  },

  dismissPopup: () => set({ showPopup: false }),

  canClaim: () => {
    const state = get()
    if (state.lastClaimedAt === 0) return true
    return getDayStartUTC() > getDayStartUTC(state.lastClaimedAt)
  },

  getCurrentReward: () => {
    const state = get()
    let nextDay = state.loginStreak % 7
    // Check if streak would be broken
    if (state.lastClaimedAt > 0 && getDayStartUTC() - getDayStartUTC(state.lastClaimedAt) > ONE_DAY_MS) {
      nextDay = 0 // Would reset
    }
    return DAILY_REWARDS[nextDay]
  },

  getStreakStatus: () => {
    const state = get()
    let streak = state.loginStreak
    const nowUTC = getDayStartUTC()
    const lastUTC = getDayStartUTC(state.lastClaimedAt)

    if (state.lastClaimedAt > 0 && (nowUTC - lastUTC) > ONE_DAY_MS) {
      streak = 0
    }
    const nextDay = (streak % 7)
    
    // Grace expires tonight at next 00:00 (i.e. if today is missed entirely, tomorrow is broken)
    const graceExpires = state.lastClaimedAt > 0 ? lastUTC + (ONE_DAY_MS * 2) : null
    
    return {
      streak,
      nextReward: DAILY_REWARDS[nextDay],
      graceExpires,
    }
  },
}))
