// src/engine/elections.ts
// Pure election & Political Power functions — no store dependencies.
// Used by governmentStore and simulation tests.

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

/**
 * Rolling contribution record for a citizen over the active window.
 * All values represent totals within the rolling period (default 14 days).
 */
export interface PPContributions {
  damage: number        // Total combat damage dealt
  itemsProduced: number // Total items produced
  donations: number     // Total money/resources donated to national fund
}

/**
 * A weighted vote: who voted, how much PP they carry, and who they voted for.
 */
export interface WeightedVote {
  voterId: string
  candidateId: string
  weight: number // voter's PP at time of voting
}

/**
 * A candidate in the election with their coalition data.
 */
export interface ElectionCandidate {
  id: string
  name: string
  totalWeightedVotes: number
  voterIds: string[]   // unique voter IDs for coalition threshold
}

/**
 * Result of resolving an election.
 */
export interface ElectionResult {
  winnerId: string | null
  winnerName: string | null
  rankings: ElectionCandidate[]  // sorted by weighted votes descending
  disqualified: ElectionCandidate[]  // didn't meet coalition threshold
}

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════

/** Default rolling window in milliseconds (30 days) */
export const PP_ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** Default minimum unique voters for a candidate to qualify */
export const MIN_COALITION_SIZE = 3

// PP weight multipliers for each source (tuning knobs)
export const PP_WEIGHTS = {
  damage: 1 / 2000,      // sqrt(damage * weight) → sqrt(damage / 2000)
  itemsProduced: 1,      // sqrt(items * weight)  → sqrt(items)
  donations: 1 / 1000,   // sqrt(donations * weight) → sqrt(donations / 1000)
} as const

// ══════════════════════════════════════════════
// CORE FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Compute a citizen's Political Power from their rolling contributions.
 * Uses sqrt() on each source for diminishing returns:
 *   PP = sqrt(damage/1000) + sqrt(itemsProduced) + sqrt(donations/500) + sqrt(level)
 *
 * A player with 4× the activity gets ~2× the PP, not 4×.
 * Minimum PP is always >= 1 (everyone has a voice).
 */
export function computePoliticalPower(contributions: PPContributions): number {
  const dmgPP = Math.sqrt(Math.max(0, contributions.damage) * PP_WEIGHTS.damage)
  const prodPP = Math.sqrt(Math.max(0, contributions.itemsProduced) * PP_WEIGHTS.itemsProduced)
  const donPP = Math.sqrt(Math.max(0, contributions.donations) * PP_WEIGHTS.donations)

  return Math.max(1, dmgPP + prodPP + donPP)
}

/**
 * Compute the PP breakdown for display purposes.
 * Returns individual source contributions so UI can show a tooltip.
 */
export function computePPBreakdown(contributions: PPContributions): {
  damage: number
  production: number
  donations: number
  total: number
} {
  const damage = Math.sqrt(Math.max(0, contributions.damage) * PP_WEIGHTS.damage)
  const production = Math.sqrt(Math.max(0, contributions.itemsProduced) * PP_WEIGHTS.itemsProduced)
  const donations = Math.sqrt(Math.max(0, contributions.donations) * PP_WEIGHTS.donations)
  const total = Math.max(1, damage + production + donations)

  return { damage, production, donations, total }
}

/**
 * Resolve an election given a set of weighted votes.
 *
 * Rules:
 * 1. Each voter's vote weight = their PP
 * 2. A candidate must have >= minCoalition unique voters to qualify
 * 3. Among qualifying candidates, highest total weighted votes wins
 * 4. Ties broken by number of unique voters (broader support wins)
 *
 * @param votes - Array of weighted votes cast
 * @param candidateNames - Map of candidateId → display name
 * @param minCoalition - Minimum unique voters to qualify (default: MIN_COALITION_SIZE)
 * @returns ElectionResult with winner, rankings, and disqualified candidates
 */
export function resolveElectionResults(
  votes: WeightedVote[],
  candidateNames: Record<string, string>,
  minCoalition: number = MIN_COALITION_SIZE,
): ElectionResult {
  // Aggregate votes per candidate
  const candidateMap = new Map<string, ElectionCandidate>()

  for (const vote of votes) {
    let candidate = candidateMap.get(vote.candidateId)
    if (!candidate) {
      candidate = {
        id: vote.candidateId,
        name: candidateNames[vote.candidateId] || vote.candidateId,
        totalWeightedVotes: 0,
        voterIds: [],
      }
      candidateMap.set(vote.candidateId, candidate)
    }

    candidate.totalWeightedVotes += vote.weight
    if (!candidate.voterIds.includes(vote.voterId)) {
      candidate.voterIds.push(vote.voterId)
    }
  }

  const allCandidates = Array.from(candidateMap.values())

  // Split into qualified and disqualified
  const qualified = allCandidates.filter(c => c.voterIds.length >= minCoalition)
  const disqualified = allCandidates.filter(c => c.voterIds.length < minCoalition)

  // Sort qualified by weighted votes desc, tie-break by coalition size desc
  qualified.sort((a, b) => {
    if (b.totalWeightedVotes !== a.totalWeightedVotes) {
      return b.totalWeightedVotes - a.totalWeightedVotes
    }
    return b.voterIds.length - a.voterIds.length
  })

  // Sort disqualified the same way for display
  disqualified.sort((a, b) => b.totalWeightedVotes - a.totalWeightedVotes)

  const winner = qualified.length > 0 ? qualified[0] : null

  return {
    winnerId: winner?.id ?? null,
    winnerName: winner?.name ?? null,
    rankings: qualified,
    disqualified,
  }
}

/**
 * Filter contribution records to only include entries within the rolling window.
 * Utility for store-level rolling window management.
 *
 * @param entries - Array of timestamped contribution entries
 * @param now - Current timestamp
 * @param windowMs - Rolling window in ms (default: PP_ROLLING_WINDOW_MS)
 * @returns Filtered entries within the window
 */
export function filterContributionsInWindow<T extends { timestamp: number }>(
  entries: T[],
  now: number,
  windowMs: number = PP_ROLLING_WINDOW_MS,
): T[] {
  const cutoff = now - windowMs
  return entries.filter(e => e.timestamp >= cutoff)
}

/**
 * Aggregate raw contribution entries into a PPContributions summary.
 * Used to convert a citizen's rolling log into the input for computePoliticalPower().
 */
export function aggregateContributions(
  entries: { type: 'damage' | 'production' | 'donation'; amount: number; timestamp: number }[],
  now: number,
  windowMs: number = PP_ROLLING_WINDOW_MS,
): PPContributions {
  const filtered = filterContributionsInWindow(entries, now, windowMs)
  const result: PPContributions = { damage: 0, itemsProduced: 0, donations: 0 }

  for (const entry of filtered) {
    switch (entry.type) {
      case 'damage':
        result.damage += entry.amount
        break
      case 'production':
        result.itemsProduced += entry.amount
        break
      case 'donation':
        result.donations += entry.amount
        break
    }
  }

  return result
}

/**
 * Aggregate contributions gated by the citizen's join date.
 * Only counts entries from max(joinedAt - windowMs, 0) onwards.
 * This prevents country-switchers from importing old-country activity.
 *
 * @param entries - Raw contribution log
 * @param joinedAt - Timestamp when the citizen joined the current country
 * @param now - Current timestamp
 * @param windowMs - Rolling window in ms (default: PP_ROLLING_WINDOW_MS)
 */
export function aggregateContributionsSinceJoin(
  entries: { type: 'damage' | 'production' | 'donation'; amount: number; timestamp: number }[],
  joinedAt: number,
  now: number,
  windowMs: number = PP_ROLLING_WINDOW_MS,
): PPContributions {
  // Cutoff: only count activity from (joinedAt - window) onwards
  // This means a new joiner gets credit for at most `windowMs` of prior activity
  const earliestAllowed = Math.max(0, joinedAt - windowMs)
  const windowCutoff = now - windowMs
  const cutoff = Math.max(earliestAllowed, windowCutoff)

  const filtered = entries.filter(e => e.timestamp >= cutoff)
  const result: PPContributions = { damage: 0, itemsProduced: 0, donations: 0 }

  for (const entry of filtered) {
    switch (entry.type) {
      case 'damage':
        result.damage += entry.amount
        break
      case 'production':
        result.itemsProduced += entry.amount
        break
      case 'donation':
        result.donations += entry.amount
        break
    }
  }

  return result
}
