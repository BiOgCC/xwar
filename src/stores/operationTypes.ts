// ====== SHARED OPERATION TYPES ======
// Used by both militaryStore and cyberStore

export type OperationPhase =
  | 'deploying'          // Travel to target
  | 'detection_window'   // 15-min window — detection roll pending
  | 'undetected_win'     // Not caught → auto-success
  | 'contest'            // Detected → 30-min race (damage or stamina)
  | 'attacker_won'       // Contest resolved: attacker reached threshold
  | 'defender_won'       // Contest resolved: defender reached threshold
  | 'returning'          // Squad coming back

export type ContestType = 'damage' | 'stamina'

export interface ContestContributor {
  playerId: string
  contributed: number
}

export interface ContestState {
  attackerProgress: number       // 0 → threshold
  defenderProgress: number       // 0 → threshold
  threshold: number              // Target to reach (e.g. 1000)
  contestType: ContestType       // 'damage' for military, 'stamina' for cyber
  startedAt: number
  expiresAt: number              // startedAt + 30 minutes
  attackerContributors: ContestContributor[]
  defenderContributors: ContestContributor[]
}

// ====== CONSTANTS ======

export const DETECTION_WINDOW_MS = 15 * 60 * 1000   // 15 minutes
export const CONTEST_DURATION_MS = 30 * 60 * 1000   // 30 minutes
export const DEFAULT_CONTEST_THRESHOLD = 1000

// ====== HELPERS ======

/**
 * Roll detection chance.
 * Returns true if the operation was detected.
 */
export function rollDetection(detectionChance: number, stealthModifier: number = 0): boolean {
  const effectiveChance = Math.max(5, Math.min(95, detectionChance - stealthModifier))
  return Math.random() * 100 < effectiveChance
}

/**
 * Check if a contest is resolved.
 * Returns 'attacker_won' | 'defender_won' | 'ongoing'
 */
export function checkContestResult(contest: ContestState): 'attacker_won' | 'defender_won' | 'ongoing' {
  // Attacker reached threshold → attacker wins
  if (contest.attackerProgress >= contest.threshold) return 'attacker_won'
  // Defender reached threshold → defender wins
  if (contest.defenderProgress >= contest.threshold) return 'defender_won'
  // Time expired → attacker wins by default (defender failed to fill)
  if (Date.now() >= contest.expiresAt) return 'attacker_won'
  return 'ongoing'
}

/**
 * Create a fresh contest state.
 */
export function createContest(type: ContestType, threshold: number = DEFAULT_CONTEST_THRESHOLD): ContestState {
  return {
    attackerProgress: 0,
    defenderProgress: 0,
    threshold,
    contestType: type,
    startedAt: Date.now(),
    expiresAt: Date.now() + CONTEST_DURATION_MS,
    attackerContributors: [],
    defenderContributors: [],
  }
}
