import { create } from 'zustand'
import { useUIStore } from './uiStore'

// ══════════════════════════════════════════════
// XWAR — Anti-Bot Verification System
// Periodically challenges players to prove they're
// not bots via quick mini-game puzzles.
// ══════════════════════════════════════════════

// ── Challenge Types ────────────────────────────

export type ChallengeType = 'emoji' | 'math' | 'unscramble'

export interface ChallengeData {
  type: ChallengeType
  question: string
  answer: string
  options: string[]  // For emoji/math (multiple choice)
}

// ── Military words for unscramble ──────────────
const MILITARY_WORDS = [
  'SNIPER', 'ARMOR', 'TANK', 'INTEL', 'FLANK',
  'SIEGE', 'RECON', 'SQUAD', 'STRIKE', 'RADAR',
  'DELTA', 'OMEGA', 'BRAVO', 'COBRA', 'EAGLE',
  'STORM', 'BLITZ', 'FORGE', 'DRAFT', 'GUARD',
]

// ── Emoji sets ─────────────────────────────────
const EMOJI_POOL = [
  '🎯', '⚔️', '🛡️', '🔫', '💣', '🚀', '🏴', '⚡',
  '🔥', '💀', '🎖️', '🏆', '🗡️', '🪖', '🎪', '🧨',
  '📡', '🛰️', '🔧', '🔩', '⛏️', '🧬', '💎', '🃏',
]

// ── Actions exempt from tracking ───────────────
const EXEMPT_ACTIONS = new Set([
  'playerAttack',
  'playerDefend',
])

// ── Config ─────────────────────────────────────
const ACTION_WINDOW_MS = 60_000       // 60-second rolling window
const TRIGGER_THRESHOLD = 30          // 30 non-combat actions per minute
const COOLDOWN_AFTER_PASS_MS = 300_000 // 5 minutes after successful pass
const CHALLENGE_TIMEOUT_MS = 15_000    // 15 seconds to answer

const PENALTY_DURATIONS = [
  15_000,     // 1st fail: 15s
  60_000,     // 2nd fail: 60s
  300_000,    // 3rd+ fail: 5min
]

// ── Store ──────────────────────────────────────

export interface AntiBotState {
  // Tracking
  actionTimestamps: number[]
  
  // Challenge state
  challengeActive: boolean
  challengeData: ChallengeData | null
  challengeStartedAt: number
  challengePending: boolean  // true if challenge was triggered during battle
  
  // Penalty / pass state
  failCount: number
  lockoutUntil: number
  lastPassedAt: number
  
  // Actions
  recordAction: (actionKey: string) => void
  submitAnswer: (answer: string) => boolean
  isLocked: () => boolean
  forceChallenge: () => void
  dismissChallenge: () => void
  checkPendingChallenge: () => void
}

function generateChallenge(): ChallengeData {
  const types: ChallengeType[] = ['emoji', 'math', 'unscramble']
  const type = types[Math.floor(Math.random() * types.length)]

  switch (type) {
    case 'emoji': {
      // Pick a target emoji and 3 distractors
      const shuffled = [...EMOJI_POOL].sort(() => Math.random() - 0.5)
      const target = shuffled[0]
      const distractors = shuffled.slice(1, 4)
      const options = [...distractors, target].sort(() => Math.random() - 0.5)
      return {
        type: 'emoji',
        question: target,
        answer: target,
        options,
      }
    }

    case 'math': {
      const a = Math.floor(Math.random() * 20) + 3
      const b = Math.floor(Math.random() * 15) + 2
      const ops = ['+', '-', '×'] as const
      const op = ops[Math.floor(Math.random() * ops.length)]
      let result: number
      switch (op) {
        case '+': result = a + b; break
        case '-': result = a - b; break
        case '×': result = a * b; break
      }
      // Generate 3 wrong answers (close to real answer)
      const wrongSet = new Set<number>()
      while (wrongSet.size < 3) {
        const offset = (Math.floor(Math.random() * 5) + 1) * (Math.random() < 0.5 ? 1 : -1)
        const wrong = result + offset
        if (wrong !== result) wrongSet.add(wrong)
      }
      const options = [...wrongSet, result].map(String).sort(() => Math.random() - 0.5)
      return {
        type: 'math',
        question: `${a} ${op} ${b}`,
        answer: String(result),
        options,
      }
    }

    case 'unscramble': {
      const word = MILITARY_WORDS[Math.floor(Math.random() * MILITARY_WORDS.length)]
      // Scramble the word
      let scrambled = word
      let attempts = 0
      while ((scrambled === word || scrambled.length < 2) && attempts < 20) {
        scrambled = word.split('').sort(() => Math.random() - 0.5).join('')
        attempts++
      }
      return {
        type: 'unscramble',
        question: scrambled,
        answer: word,
        options: [],  // Free-text input
      }
    }
  }
}

/** Check if any battle is currently active */
function hasActiveBattle(): boolean {
  // Lazy import to avoid circular dependency — battleStore is loaded by the time this runs
  try {
    // Access the battleStore directly from the module cache
    const battleModule = (window as any).__xwar_battleStore
    if (!battleModule) return false
    const battles = battleModule.getState().battles
    return Object.values(battles).some((b: any) => b.status === 'active')
  } catch {
    return false
  }
}

export const useAntiBotStore = create<AntiBotState>((set, get) => ({
  actionTimestamps: [],
  challengeActive: false,
  challengeData: null,
  challengeStartedAt: 0,
  challengePending: false,
  failCount: 0,
  lockoutUntil: 0,
  lastPassedAt: 0,

  recordAction: (actionKey: string) => {
    // Skip exempt actions (combat actions)
    if (EXEMPT_ACTIONS.has(actionKey)) return

    const now = Date.now()
    const state = get()

    // Don't track during cooldown period after passing
    if (now - state.lastPassedAt < COOLDOWN_AFTER_PASS_MS) return

    // Don't track if challenge is already active
    if (state.challengeActive || state.challengePending) return

    // Add timestamp and prune old ones outside the window
    const timestamps = [...state.actionTimestamps, now].filter(
      t => now - t < ACTION_WINDOW_MS
    )

    set({ actionTimestamps: timestamps })

    // Check if threshold exceeded
    if (timestamps.length >= TRIGGER_THRESHOLD) {
      if (hasActiveBattle()) {
        // Queue the challenge for after the battle
        set({ challengePending: true, actionTimestamps: [] })
      } else {
        // Trigger challenge immediately
        const challenge = generateChallenge()
        set({
          challengeActive: true,
          challengeData: challenge,
          challengeStartedAt: now,
          actionTimestamps: [],
        })

        // Auto-fail after timeout
        setTimeout(() => {
          const s = get()
          if (s.challengeActive && s.challengeStartedAt === now) {
            // Time's up — count as failure
            const newFailCount = s.failCount + 1
            const penaltyIdx = Math.min(newFailCount - 1, PENALTY_DURATIONS.length - 1)
            const penalty = PENALTY_DURATIONS[penaltyIdx]
            set({
              challengeActive: false,
              challengeData: null,
              failCount: newFailCount,
              lockoutUntil: Date.now() + penalty,
            })
            useUIStore.getState().addNotification({
              type: 'danger',
              message: `⏰ Verification timed out. Actions locked for ${penalty / 1000}s.`,
            })
          }
        }, CHALLENGE_TIMEOUT_MS)
      }
    }
  },

  submitAnswer: (answer: string) => {
    const state = get()
    if (!state.challengeActive || !state.challengeData) return false

    const correct = answer.toUpperCase().trim() === state.challengeData.answer.toUpperCase().trim()

    if (correct) {
      set({
        challengeActive: false,
        challengeData: null,
        failCount: 0,
        lastPassedAt: Date.now(),
        lockoutUntil: 0,
      })
      useUIStore.getState().addNotification({
        type: 'success',
        message: '✅ Identity verified. Carry on, Commander.',
      })
      return true
    } else {
      const newFailCount = state.failCount + 1
      const penaltyIdx = Math.min(newFailCount - 1, PENALTY_DURATIONS.length - 1)
      const penalty = PENALTY_DURATIONS[penaltyIdx]
      set({
        challengeActive: false,
        challengeData: null,
        failCount: newFailCount,
        lockoutUntil: Date.now() + penalty,
      })
      useUIStore.getState().addNotification({
        type: 'danger',
        message: `❌ Wrong answer. Actions locked for ${penalty / 1000}s.`,
      })
      // Log suspicion after 3+ failures
      if (newFailCount >= 3) {
        console.warn(`[AntiBot] Player has failed ${newFailCount} challenges — potential bot`)
      }
      return false
    }
  },

  isLocked: () => {
    const state = get()
    if (state.challengeActive) return true
    if (Date.now() < state.lockoutUntil) return true
    return false
  },

  forceChallenge: () => {
    if (hasActiveBattle()) {
      set({ challengePending: true })
      return
    }
    const challenge = generateChallenge()
    const now = Date.now()
    set({
      challengeActive: true,
      challengeData: challenge,
      challengeStartedAt: now,
      actionTimestamps: [],
    })
    // Auto-fail timeout
    setTimeout(() => {
      const s = get()
      if (s.challengeActive && s.challengeStartedAt === now) {
        const newFailCount = s.failCount + 1
        const penaltyIdx = Math.min(newFailCount - 1, PENALTY_DURATIONS.length - 1)
        const penalty = PENALTY_DURATIONS[penaltyIdx]
        set({
          challengeActive: false,
          challengeData: null,
          failCount: newFailCount,
          lockoutUntil: Date.now() + penalty,
        })
        useUIStore.getState().addNotification({
          type: 'danger',
          message: `⏰ Verification timed out. Actions locked for ${penalty / 1000}s.`,
        })
      }
    }, CHALLENGE_TIMEOUT_MS)
  },

  dismissChallenge: () => {
    // Dismissing = treated as a failure
    const state = get()
    if (!state.challengeActive) return
    const newFailCount = state.failCount + 1
    const penaltyIdx = Math.min(newFailCount - 1, PENALTY_DURATIONS.length - 1)
    const penalty = PENALTY_DURATIONS[penaltyIdx]
    set({
      challengeActive: false,
      challengeData: null,
      failCount: newFailCount,
      lockoutUntil: Date.now() + penalty,
    })
    useUIStore.getState().addNotification({
      type: 'warning',
      message: `🚫 Verification dismissed. Actions locked for ${penalty / 1000}s.`,
    })
  },

  /** Call this when a battle ends — triggers queued challenge */
  checkPendingChallenge: () => {
    const state = get()
    if (!state.challengePending) return
    if (hasActiveBattle()) return  // Another battle still active

    set({ challengePending: false })
    // Small delay so player sees the battle result first
    setTimeout(() => {
      get().forceChallenge()
    }, 2000)
  },
}))

// ── Dev helper: expose forceChallenge on window in dev mode ──
if (import.meta.env.DEV) {
  (window as any).__forceAntiBotChallenge = () => {
    useAntiBotStore.getState().forceChallenge()
  }
}
