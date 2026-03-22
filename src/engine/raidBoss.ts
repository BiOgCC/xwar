/* ══════════════════════════════════════════════
   XWAR — Raid Boss Tick Engine
   Self-balancing combat via momentum, not HP
   ══════════════════════════════════════════════ */

// ── Configuration ──

export const TICK_DURATION_MS = 10_000       // 10 seconds per tick

export const RANK_CONFIG = {
  grunt: { maxTicks: 120, bountyRange: [25_000, 50_000],   bossMultiplier: 0.9,  rageEnabled: false, attacksPerTick: 2 },
  elite: { maxTicks: 120, bountyRange: [75_000, 150_000],  bossMultiplier: 1.0,  rageEnabled: false, attacksPerTick: 3 },
  boss:  { maxTicks: 120, bountyRange: [200_000, 500_000], bossMultiplier: 1.1,  rageEnabled: true,  attacksPerTick: 5 },
} as const

const HISTORY_WINDOW = 3
const VARIANCE_RANGE = 0.155              // ±15.5%
const SNOWBALL_THRESHOLD = 0.556          // Boss can't exceed this
const SNOWBALL_RESUME = 0.52              // Resume when below this
const WIN_MOMENTUM = 0.65                 // Hunters win threshold
const LOSE_MOMENTUM = 0.35               // Boss dominates threshold
const MAX_INDIVIDUAL_SHARE = 0.40         // 40% cap per player
const RAGE_INTERVAL = 20                  // Every 20 ticks
const RAGE_MULTIPLIER = 1.4              // 40% spike
const MERC_DMG_PER_DOLLAR = 2            // $500 → 1000 damage

// ── Types ──

export interface PlayerAction {
  playerId: string
  playerName: string
  type: 'attack' | 'fund'
  damage?: number   // for attacks
  amount?: number   // for funding ($)
}

export interface TickLog {
  tick: number
  timestamp: number
  hunterDmg: number
  bossDmg: number
  fundedDmg: number
  momentum: number
  bossStaggered: boolean
  playerActions: {
    playerId: string
    playerName: string
    damage: number
    funded: number
  }[]
}

export type RaidBossStatus = 'active' | 'hunters_win' | 'boss_survives' | 'boss_dominates'

export interface RaidBossEvent {
  id: string
  name: string
  rank: 'grunt' | 'elite' | 'boss'
  countryCode: string
  status: RaidBossStatus

  // Tick state
  currentTick: number
  maxTicks: number
  tickHistory: TickLog[]

  // Aggregate
  totalHunterDmg: number
  totalBossDmg: number
  momentum: number             // 0..1

  // Economy
  baseBounty: number
  supportPool: number

  // Participants
  fighters: Record<string, {
    totalDmg: number
    ticksActive: number
  }>
  supporters: Record<string, {
    totalFunded: number
  }>

  // Timing
  startedAt: number
  expiresAt: number
  lastTickAt: number

  // Anti-snowball state
  bossStaggered: boolean
}

// ── Engine Functions ──

/** Create a new Raid Boss event */
export function createRaidBossEvent(
  name: string,
  rank: 'grunt' | 'elite' | 'boss',
  countryCode: string,
): RaidBossEvent {
  const cfg = RANK_CONFIG[rank]
  const bounty = cfg.bountyRange[0] + Math.floor(Math.random() * (cfg.bountyRange[1] - cfg.bountyRange[0]))
  const now = Date.now()

  return {
    id: `raid_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    rank,
    countryCode,
    status: 'active',
    currentTick: 0,
    maxTicks: cfg.maxTicks,
    tickHistory: [],
    totalHunterDmg: 0,
    totalBossDmg: 0,
    momentum: 0.5,  // starts even
    baseBounty: bounty,
    supportPool: 0,
    fighters: {},
    supporters: {},
    startedAt: now,
    expiresAt: now + 20 * 60 * 1000,  // 20 minutes
    lastTickAt: now,
    bossStaggered: false,
  }
}

/** Process one tick of combat */
export function processRaidTick(
  event: RaidBossEvent,
  actions: PlayerAction[],
): { event: RaidBossEvent; tickLog: TickLog } {
  const cfg = RANK_CONFIG[event.rank]
  const tick = event.currentTick + 1

  // ── 1. Sum player damage (with 40% individual cap) ──
  let rawPlayerDmg = 0
  let fundedDmg = 0
  const playerContribs: Record<string, { damage: number; funded: number; name: string }> = {}

  for (const action of actions) {
    if (!playerContribs[action.playerId]) {
      playerContribs[action.playerId] = { damage: 0, funded: 0, name: action.playerName }
    }

    if (action.type === 'attack' && action.damage) {
      playerContribs[action.playerId].damage += action.damage
      rawPlayerDmg += action.damage
    } else if (action.type === 'fund' && action.amount) {
      const mercDmg = action.amount * MERC_DMG_PER_DOLLAR
      playerContribs[action.playerId].funded += action.amount
      fundedDmg += mercDmg
    }
  }

  // Apply 40% individual cap
  let hunterDmg = 0
  const totalRaw = rawPlayerDmg + fundedDmg
  for (const [, contrib] of Object.entries(playerContribs)) {
    const playerTotal = contrib.damage + (contrib.funded * MERC_DMG_PER_DOLLAR)
    const capped = totalRaw > 0 ? Math.min(playerTotal, totalRaw * MAX_INDIVIDUAL_SHARE) : playerTotal
    hunterDmg += capped
  }
  // If no individual exceeds cap, just use total
  if (hunterDmg === 0 && totalRaw > 0) hunterDmg = totalRaw
  if (hunterDmg > totalRaw) hunterDmg = totalRaw
  if (totalRaw > 0 && hunterDmg === 0) hunterDmg = totalRaw

  // ── 2. Compute boss damage via moving average ──
  const recentTicks = event.tickHistory.slice(-HISTORY_WINDOW)
  const avgHunterDmg = recentTicks.length > 0
    ? recentTicks.reduce((s, t) => s + t.hunterDmg, 0) / recentTicks.length
    : hunterDmg > 0 ? hunterDmg : 100 // bootstrap first tick

  const variance = (Math.random() * VARIANCE_RANGE * 2) - VARIANCE_RANGE
  let bossDmg = Math.round(avgHunterDmg * cfg.bossMultiplier * (1 + variance))
  // Ensure at least 1 damage so boss tick never silently does nothing
  if (bossDmg < 1 && avgHunterDmg > 0) bossDmg = 1

  // Rage tick (boss rank only)
  if (cfg.rageEnabled && tick % RAGE_INTERVAL === 0) {
    bossDmg = Math.round(avgHunterDmg * RAGE_MULTIPLIER)
  }

  // ── 3. Anti-snowball check ──
  let bossStaggered = event.bossStaggered
  const projectedBossTotal = event.totalBossDmg + bossDmg
  const projectedTotal = event.totalHunterDmg + hunterDmg + projectedBossTotal

  if (projectedTotal > 0) {
    const bossAdvantage = projectedBossTotal / projectedTotal
    if (bossAdvantage > SNOWBALL_THRESHOLD) {
      bossDmg = 0
      bossStaggered = true
    } else if (bossStaggered && bossAdvantage < SNOWBALL_RESUME) {
      bossStaggered = false
    } else if (bossStaggered) {
      bossDmg = 0  // still staggered
    }
  }

  // Zero players? Boss waits
  if (actions.length === 0) {
    bossDmg = 0
  }

  // ── 4. Update totals and momentum ──
  const newHunterTotal = event.totalHunterDmg + hunterDmg
  const newBossTotal = event.totalBossDmg + bossDmg
  const grandTotal = newHunterTotal + newBossTotal
  const momentum = grandTotal > 0 ? newHunterTotal / grandTotal : 0.5

  // ── 5. Update fighters/supporters ──
  const updatedFighters = { ...event.fighters }
  const updatedSupporters = { ...event.supporters }
  let newSupportPool = event.supportPool

  for (const [pid, contrib] of Object.entries(playerContribs)) {
    if (contrib.damage > 0) {
      if (!updatedFighters[pid]) updatedFighters[pid] = { totalDmg: 0, ticksActive: 0 }
      updatedFighters[pid].totalDmg += contrib.damage
      updatedFighters[pid].ticksActive += 1
    }
    if (contrib.funded > 0) {
      if (!updatedSupporters[pid]) updatedSupporters[pid] = { totalFunded: 0 }
      updatedSupporters[pid].totalFunded += contrib.funded
      newSupportPool += contrib.funded
    }
  }

  // ── 6. Build tick log ──
  const tickLog: TickLog = {
    tick,
    timestamp: Date.now(),
    hunterDmg,
    bossDmg,
    fundedDmg,
    momentum,
    bossStaggered,
    playerActions: Object.entries(playerContribs).map(([pid, c]) => ({
      playerId: pid,
      playerName: c.name,
      damage: c.damage,
      funded: c.funded,
    })),
  }

  // ── 7. Check termination ──
  let status: RaidBossStatus = 'active'
  if (momentum >= WIN_MOMENTUM) status = 'hunters_win'
  else if (momentum <= LOSE_MOMENTUM) status = 'boss_dominates'
  else if (tick >= event.maxTicks) status = 'boss_survives'

  // ── 8. Return updated event ──
  const updatedEvent: RaidBossEvent = {
    ...event,
    currentTick: tick,
    tickHistory: [...event.tickHistory, tickLog].slice(-30), // keep last 30 for UI
    totalHunterDmg: newHunterTotal,
    totalBossDmg: newBossTotal,
    momentum,
    baseBounty: event.baseBounty,
    supportPool: newSupportPool,
    fighters: updatedFighters,
    supporters: updatedSupporters,
    lastTickAt: Date.now(),
    bossStaggered,
    status,
  }

  return { event: updatedEvent, tickLog }
}

/** Compute payouts when event ends */
export function computePayouts(event: RaidBossEvent): {
  fighterPayouts: Record<string, number>
  supporterPayouts: Record<string, number>
} {
  const totalPot = event.baseBounty + event.supportPool
  const fighterPayouts: Record<string, number> = {}
  const supporterPayouts: Record<string, number> = {}

  if (event.status === 'hunters_win') {
    // Fighters get x2 of total pot, split by damage %
    const x2Pot = totalPot * 2
    const totalDmg = Object.values(event.fighters).reduce((s, f) => s + f.totalDmg, 0)
    for (const [pid, fighter] of Object.entries(event.fighters)) {
      const share = totalDmg > 0 ? fighter.totalDmg / totalDmg : 0
      fighterPayouts[pid] = Math.floor(x2Pot * share)
    }
    // Supporters get nothing (lost their bet)
    for (const pid of Object.keys(event.supporters)) {
      supporterPayouts[pid] = 0
    }
  } else if (event.status === 'boss_survives' || event.status === 'boss_dominates') {
    // Supporters get x2 return
    for (const [pid, supporter] of Object.entries(event.supporters)) {
      supporterPayouts[pid] = supporter.totalFunded * 2
    }
    // Fighters get nothing extra
    for (const pid of Object.keys(event.fighters)) {
      fighterPayouts[pid] = 0
    }
  }

  return { fighterPayouts, supporterPayouts }
}

/** Get damage race status label */
export function getMomentumStatus(momentum: number, _bossStaggered: boolean): {
  label: string
  color: string
  urgency: 'calm' | 'alert' | 'critical'
} {
  if (momentum >= 0.60) return { label: 'HUNTERS LEADING', color: '#22c55e', urgency: 'calm' }
  if (momentum >= 0.52) return { label: 'HUNTERS AHEAD', color: '#4ade80', urgency: 'calm' }
  if (momentum >= 0.48) return { label: 'NECK AND NECK', color: '#eab308', urgency: 'alert' }
  if (momentum >= 0.40) return { label: 'ECO AHEAD', color: '#f97316', urgency: 'alert' }
  return { label: 'ECO DOMINATING', color: '#ef4444', urgency: 'critical' }
}
