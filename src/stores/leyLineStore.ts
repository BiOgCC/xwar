import { create } from 'zustand'
import { useRegionStore } from './regionStore'
import { useAllianceStore } from './allianceStore'
import { useWorldStore } from './worldStore'
import {
  LEY_LINE_DEFS,
  CONTINENTAL_RESONANCE,
  DIMINISHING_RETURNS,
  CROSS_CONTINENTAL_TIERS,
  type LeyLineDef,
  type LeyLineBonus,
  type Continent,
  type ContinentalResonance,
} from '../data/leyLineRegistry'

/* ══════════════════════════════════════════════
   XWAR — Unified Ley Line Store
   Land lines: activation, diminishing returns,
   alliance resonance, cross-continental stacking.
   Sea lines: route control, income, disruptions.
   ══════════════════════════════════════════════ */

// ── Sea-line types (formerly tradeRouteStore) ──

/** Three-way control state for a sea route */
export type RouteControlState = 'active' | 'partial' | 'inactive'

export interface RouteDisruption {
  routeId: string
  activatesAt: number   // when the disruption actually kicks in (after countdown)
  expiryMs: number      // when the disruption ends
  reason: string
  orderedBy: string     // country code that ordered it
}

export interface TradeIncomeResult {
  routeId: string
  controlState: RouteControlState
  moneyGained: number
  oilGained: number
}

export interface StrategicObjective {
  routeId: string
  addedAt: number
}

/** Partial income multiplier for routes with only one endpoint controlled */
const SEA_PARTIAL_INCOME_MULT = 0.30

/** Disruption costs 60% of the route's per-tick income — makes it a strategic risk/reward call */
export const DISRUPTION_COST_RATIO = 0.60

/** Disruption timing constants */
export const DISRUPTION_COUNTDOWN_MS = 6 * 60 * 60 * 1000   // 6 hours before disruption activates
export const DISRUPTION_DURATION_MS  = 6 * 60 * 60 * 1000   // 6 hours active disruption
export const DISRUPTION_COOLDOWN_MS  = 48 * 60 * 60 * 1000  // 48 hours before country can disrupt again

/** Compute the disruption cost for a specific sea route */
export function getDisruptionCost(line: { seaData?: { tradedGoods: number; fish: number; oil: number } }): number {
  if (!line.seaData) return 0
  const routeIncome = line.seaData.tradedGoods + line.seaData.fish * 10 + line.seaData.oil * 10
  return Math.round(routeIncome * DISRUPTION_COST_RATIO)
}

// ── Computed state types ──

export interface ActiveLeyLine {
  def: LeyLineDef
  /** Which country/alliance holds it */
  heldBy: string
  /** 1.0 / 0.50 / 0.25 based on how many Lines the same country holds */
  effectiveness: number
  /** Completion ratio: how many blocks are held vs total */
  completion: number
  /** Whether the line is fully activated */
  active: boolean
  /** Countries that control at least one block */
  involvedCountries: string[]
}

export interface ActiveResonance {
  resonance: ContinentalResonance
  allianceId: string
}

export interface CrossContinentalBonus {
  name: string
  allStatBonus: number
  setsCompleted: number
  allianceId: string
}

export interface LeyLineState {
  /** Live definitions fetched from DB (falls back to static) */
  defs: LeyLineDef[]
  /** Whether defs have been fetched at least once from DB */
  defsLoaded: boolean
  /** Fetch and merge DB + static definitions */
  fetchDefs: () => Promise<void>
  getActiveLines: () => ActiveLeyLine[]
  getAllLineStatus: () => ActiveLeyLine[]
  getActiveResonances: () => ActiveResonance[]
  getCrossContinentalBonus: (allianceId: string) => CrossContinentalBonus | null
  getBonusesForCountry: (countryCode: string) => LeyLineBonus
  getLinesForRegion: (regionId: string) => ActiveLeyLine[]
  isDenialTarget: (regionId: string) => boolean

  // ── Sea line state & actions (from former tradeRouteStore) ──
  seaRouteGeoJSON: any | null
  seaRoutesLoaded: boolean
  selectedSeaRouteId: string | null
  disruptions: RouteDisruption[]
  disruptionCooldowns: Record<string, number>  // countryCode → cooldown expiry timestamp
  strategicObjectives: StrategicObjective[]

  loadSeaRoutes: () => Promise<void>
  selectSeaRoute: (id: string | null) => void
  getSeaLineDefs: () => LeyLineDef[]
  getRouteControlState: (line: LeyLineDef) => RouteControlState
  getActiveSeaRoutes: () => LeyLineDef[]
  computeTradeIncome: () => TradeIncomeResult[]
  processTradeIncome: () => void
  disruptRoute: (routeId: string, reason?: string) => 'ok' | 'already_disrupted' | 'cooldown' | 'insufficient_funds' | 'error'
  tickDisruptions: () => void
  isRouteDisrupted: (routeId: string) => boolean
  isRoutePendingDisruption: (routeId: string) => boolean
  getDisruptionStatus: (routeId: string) => { state: 'none' | 'pending' | 'active'; remainingMs: number } | null
  isCountryOnCooldown: () => boolean
  getCountryCooldownMs: () => number
  toggleStrategicObjective: (routeId: string) => void
  isStrategicObjective: (routeId: string) => boolean
}

// ═══════════════════════════════════════════════════════════════
// PURE HELPER FUNCTIONS (no store self-reference)
// ═══════════════════════════════════════════════════════════════

/** Check if a set of country codes all belong to the same alliance */
function areAllied(countryCodes: string[]): { allied: boolean; allianceId: string | null } {
  const allianceState = useAllianceStore.getState()
  for (const alliance of allianceState.alliances) {
    const memberCCs = new Set(alliance.members.map(m => m.countryCode))
    if (countryCodes.every(cc => memberCCs.has(cc))) {
      return { allied: true, allianceId: alliance.id }
    }
  }
  return { allied: false, allianceId: null }

}

/** Check if a country is controlled by the player or their alliance/empire */
function isCountryInPlayerAlliance(countryCode: string, playerCode: string): boolean {
  const world = useWorldStore.getState()
  if (countryCode === playerCode) return true
  const playerCountry = world.countries.find(c => c.code === playerCode)
  const targetCountry = world.countries.find(c => c.code === countryCode)
  if (!playerCountry || !targetCountry) return false
  if (playerCountry.empire && targetCountry.empire && playerCountry.empire === targetCountry.empire) return true
  if (playerCountry.controller && targetCountry.controller === playerCountry.controller) return true
  return false
}

/** Compute completion and activation for a single Line */
function computeLineStatus(line: LeyLineDef): ActiveLeyLine {
  const regions = useRegionStore.getState().regions
  const blockRegions = line.blocks.map(b => regions.find(r => r.id === b))

  const controllerCounts = new Map<string, number>()
  let validBlocks = 0

  for (const br of blockRegions) {
    if (!br) continue
    validBlocks++
    const cc = br.controlledBy
    controllerCounts.set(cc, (controllerCounts.get(cc) || 0) + 1)
  }

  const totalBlocks = line.blocks.length
  const involvedCountries = [...controllerCounts.keys()]

  // Single controller owns ALL blocks
  const singleHolder = involvedCountries.find(cc => controllerCounts.get(cc) === totalBlocks)
  if (singleHolder) {
    return { def: line, heldBy: singleHolder, effectiveness: 1.0, completion: 1.0, active: true, involvedCountries }
  }

  // Alliance check: all controllers in the same alliance
  if (involvedCountries.length > 0 && validBlocks === totalBlocks) {
    const { allied, allianceId } = areAllied(involvedCountries)
    if (allied && allianceId) {
      return { def: line, heldBy: allianceId, effectiveness: 1.0, completion: 1.0, active: true, involvedCountries }
    }
  }

  // Partial — largest controller
  const bestHolder = involvedCountries.reduce((best, cc) =>
    (controllerCounts.get(cc) || 0) > (controllerCounts.get(best) || 0) ? cc : best
  , involvedCountries[0] || '')

  const bestCount = controllerCounts.get(bestHolder) || 0

  return { def: line, heldBy: bestHolder, effectiveness: 0, completion: totalBlocks > 0 ? bestCount / totalBlocks : 0, active: false, involvedCountries }
}

/** Apply diminishing returns */
function applyDiminishingReturns(lines: ActiveLeyLine[]): ActiveLeyLine[] {
  const byHolder = new Map<string, ActiveLeyLine[]>()
  for (const line of lines) {
    if (!line.active) continue
    const list = byHolder.get(line.heldBy) || []
    list.push(line)
    byHolder.set(line.heldBy, list)
  }

  const result: ActiveLeyLine[] = []

  for (const [, holderLines] of byHolder) {
    const isAlliance = holderLines[0]?.heldBy.startsWith('alliance_')
    if (isAlliance) {
      // Alliance lines — no diminishing (different members hold different lines)
      for (const line of holderLines) {
        result.push({ ...line, effectiveness: 1.0 })
      }
    } else {
      // Single country — diminishing returns
      holderLines.forEach((line, idx) => {
        const dim = idx < DIMINISHING_RETURNS.length
          ? DIMINISHING_RETURNS[idx]
          : DIMINISHING_RETURNS[DIMINISHING_RETURNS.length - 1]
        result.push({ ...line, effectiveness: dim })
      })
    }
  }

  // Add inactive lines
  for (const line of lines) {
    if (!line.active) result.push(line)
  }

  return result
}

/** Merge multiple LeyLineBonus objects, scaling by effectiveness */
function mergeBonuses(bonuses: { bonus: LeyLineBonus; effectiveness: number }[]): LeyLineBonus {
  const merged: LeyLineBonus = {}
  for (const { bonus, effectiveness } of bonuses) {
    for (const [key, value] of Object.entries(bonus)) {
      if (typeof value !== 'number') continue
      const k = key as keyof LeyLineBonus
      merged[k] = (merged[k] || 0) + value * effectiveness
    }
  }
  return merged
}

/** Compute all line statuses (land lines only — sea lines have separate logic) */
function computeAllStatuses(defs: LeyLineDef[]): ActiveLeyLine[] {
  return applyDiminishingReturns(defs.filter(d => (d.lineType ?? 'land') === 'land').map(computeLineStatus))
}

/** Compute active lines only (land lines) */
function computeActiveLines(defs: LeyLineDef[]): ActiveLeyLine[] {
  const all = defs.filter(d => (d.lineType ?? 'land') === 'land').map(computeLineStatus)
  return applyDiminishingReturns(all.filter(l => l.active))
}

/** Compute active resonances (land lines only) */
function computeActiveResonances(defs: LeyLineDef[]): ActiveResonance[] {
  const active = defs.filter(d => (d.lineType ?? 'land') === 'land').map(computeLineStatus).filter(l => l.active)
  const resonances: ActiveResonance[] = []

  const byCont = new Map<Continent, ActiveLeyLine[]>()
  for (const line of active) {
    const list = byCont.get(line.def.continent) || []
    list.push(line)
    byCont.set(line.def.continent, list)
  }

  for (const [continent, lines] of byCont) {
    if (lines.length < 3) continue
    const archetypes = new Set(lines.map(l => l.def.archetype))
    if (archetypes.size < 3) continue

    const allHolders = [...new Set(lines.flatMap(l => l.involvedCountries))]
    const { allied, allianceId } = areAllied(allHolders)

    if (allied && allianceId) {
      const resDef = CONTINENTAL_RESONANCE.find(r => r.continent === continent)
      if (resDef) resonances.push({ resonance: resDef, allianceId })
    } else if (allHolders.length === 1) {
      const resDef = CONTINENTAL_RESONANCE.find(r => r.continent === continent)
      if (resDef) resonances.push({ resonance: resDef, allianceId: `country_${allHolders[0]}` })
    }
  }

  return resonances
}

/** Compute Cross-Continental bonus */
function computeCrossContinentalBonus(allianceId: string): CrossContinentalBonus | null {
  const defs = useLeyLineStore.getState().defs
  const resonances = computeActiveResonances(defs)
  const setsCompleted = resonances.filter(r => r.allianceId === allianceId).length

  const tier = [...CROSS_CONTINENTAL_TIERS]
    .reverse()
    .find(t => setsCompleted >= t.setsRequired)

  if (!tier) return null

  return { name: tier.name, allStatBonus: tier.allStatBonus, setsCompleted, allianceId }
}

// ═══════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════

export const useLeyLineStore = create<LeyLineState>()((set, get) => ({
  defs: LEY_LINE_DEFS,
  defsLoaded: false,

  fetchDefs: async () => {
    try {
      const res = await fetch('/api/ley-lines/defs', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json() as { defs: LeyLineDef[] }
      if (Array.isArray(data.defs) && data.defs.length > 0) {
        // Normalize: DB rows may not have lineType — default to 'land'
        const dbDefs = data.defs.map(d => ({ ...d, lineType: d.lineType ?? 'land' as const }))
        // Merge with static registry: DB defs override matching IDs,
        // but static sea line defs (and any other static defs not in DB) are preserved
        const dbIds = new Set(dbDefs.map(d => d.id))
        const staticExtras = LEY_LINE_DEFS.filter(d => !dbIds.has(d.id))
        set({ defs: [...dbDefs, ...staticExtras], defsLoaded: true })
      }
    } catch { /* non-fatal, keep static fallback */ }
  },

  getAllLineStatus: () => computeAllStatuses(get().defs),
  getActiveLines:  () => computeActiveLines(get().defs),
  getActiveResonances: () => computeActiveResonances(get().defs),
  getCrossContinentalBonus: computeCrossContinentalBonus,

  getBonusesForCountry: (countryCode: string): LeyLineBonus => {
    const defs = get().defs
    const allLines = computeActiveLines(defs)

    const relevantLines = allLines.filter(line => {
      if (!line.active) return false
      const regions = useRegionStore.getState().regions
      return line.def.blocks.some(b => {
        const r = regions.find(reg => reg.id === b)
        return r && r.controlledBy === countryCode
      })
    })

    const parts: { bonus: LeyLineBonus; effectiveness: number }[] = []

    for (const line of relevantLines) {
      parts.push({ bonus: line.def.bonuses, effectiveness: line.effectiveness })
      parts.push({ bonus: line.def.tradeoffs, effectiveness: line.effectiveness })
    }

    // Resonance bonuses
    const allianceState = useAllianceStore.getState()
    const playerAlliance = allianceState.alliances.find(a =>
      a.members.some(m => m.countryCode === countryCode)
    )

    if (playerAlliance) {
      const resonances = computeActiveResonances(defs)
      for (const { resonance, allianceId } of resonances) {
        if (allianceId === playerAlliance.id || allianceId === `country_${countryCode}`) {
          parts.push({ bonus: resonance.bonus, effectiveness: 1.0 })
        }
      }

      const crossBonus = computeCrossContinentalBonus(playerAlliance.id)
      if (crossBonus) {
        parts.push({
          bonus: {
            taxIncome: crossBonus.allStatBonus,
            populationGrowth: crossBonus.allStatBonus,
            weaponProduction: crossBonus.allStatBonus,
            troopMovementSpeed: crossBonus.allStatBonus,
            researchSpeed: crossBonus.allStatBonus,
            matxExtraction: crossBonus.allStatBonus,
            defenderBonus: crossBonus.allStatBonus,
            foodYield: crossBonus.allStatBonus,
          },
          effectiveness: 1.0,
        })
      }
    }

    return mergeBonuses(parts)
  },

  getLinesForRegion: (regionId: string): ActiveLeyLine[] => {
    return computeAllStatuses(get().defs).filter(l => l.def.blocks.includes(regionId))
  },

  isDenialTarget: (regionId: string): boolean => {
    const allLines = get().defs.map(computeLineStatus)
    for (const line of allLines) {
      if (line.active) continue
      if (!line.def.blocks.includes(regionId)) continue

      const totalBlocks = line.def.blocks.length
      const regions = useRegionStore.getState().regions
      const blockRegions = line.def.blocks.map(b => regions.find(r => r.id === b))

      const others = blockRegions.filter(r => r && r.id !== regionId)
      if (others.length !== totalBlocks - 1) continue

      const controllers = new Set(others.map(r => r!.controlledBy))
      if (controllers.size === 1) return true
      const { allied } = areAllied([...controllers])
      if (allied) return true
    }
    return false
  },

  // ═══════════════════════════════════════════════════════════════
  // SEA LINE STATE & ACTIONS (absorbed from tradeRouteStore)
  // ═══════════════════════════════════════════════════════════════
  seaRouteGeoJSON: null,
  seaRoutesLoaded: false,
  selectedSeaRouteId: null,
  disruptions: [],
  disruptionCooldowns: {},
  strategicObjectives: [],

  loadSeaRoutes: async () => {
    try {
      const res = await fetch('/data/trade-routes.geojson')
      const geojson = await res.json()
      set({ seaRouteGeoJSON: geojson, seaRoutesLoaded: true })
      console.log(`✅ Sea routes loaded: ${geojson?.features?.length ?? 0} routes`)
    } catch (err) {
      console.warn('Could not load sea routes GeoJSON:', err)
    }
  },

  selectSeaRoute: (id) => set({ selectedSeaRouteId: id }),

  getSeaLineDefs: () => get().defs.filter(d => d.lineType === 'sea'),

  getRouteControlState: (line) => {
    if (line.lineType !== 'sea' || !line.seaData) return 'inactive'
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return 'inactive'
    const fromOk = isCountryInPlayerAlliance(line.seaData.fromCountry, playerCountry.code)
    const toOk = isCountryInPlayerAlliance(line.seaData.toCountry, playerCountry.code)
    if (fromOk && toOk) return 'active'
    if (fromOk || toOk) return 'partial'
    return 'inactive'
  },

  getActiveSeaRoutes: () => {
    const { defs, getRouteControlState } = get()
    return defs.filter(d => d.lineType === 'sea' && getRouteControlState(d) === 'active')
  },

  computeTradeIncome: () => {
    const { defs, getRouteControlState, isRouteDisrupted } = get()
    const results: TradeIncomeResult[] = []
    for (const line of defs) {
      if (line.lineType !== 'sea' || !line.seaData) continue
      const controlState = getRouteControlState(line)
      if (controlState === 'inactive') continue
      if (isRouteDisrupted(line.id)) continue
      const mult = controlState === 'active' ? 1 : SEA_PARTIAL_INCOME_MULT
      const moneyGained = Math.round((line.seaData.tradedGoods + line.seaData.fish * 10) * mult)
      const oilGained = Math.round(line.seaData.oil * mult)
      results.push({ routeId: line.id, controlState, moneyGained, oilGained })
    }
    return results
  },

  processTradeIncome: () => {
    const { computeTradeIncome } = get()
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return
    const results = computeTradeIncome()
    for (const r of results) {
      if (r.moneyGained > 0) world.addToFund(playerCountry.code, 'money', r.moneyGained)
      if (r.oilGained > 0) world.addToFund(playerCountry.code, 'oil', r.oilGained)
    }
    const totalMoney = results.reduce((s, r) => s + r.moneyGained, 0)
    const totalOil = results.reduce((s, r) => s + r.oilGained, 0)
    if (totalMoney > 0) world.recordEconFlow('sea_routes_money', totalMoney, 'created', 'money')
    if (totalOil > 0) world.recordEconFlow('sea_routes_oil', totalOil, 'created', 'oil')
  },

  disruptRoute: (routeId, reason = 'naval') => {
    // Prevent if this route already has a pending or active disruption
    const existing = get().disruptions.find(d => d.routeId === routeId && d.expiryMs > Date.now())
    if (existing) return 'already_disrupted'

    // Look up route to compute dynamic cost
    const lineDef = get().defs.find(d => d.id === routeId)
    if (!lineDef || !lineDef.seaData) return 'error'
    const cost = getDisruptionCost(lineDef)
    if (cost <= 0) return 'error'

    // Check 48h country cooldown
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return 'error'
    const cooldownExpiry = get().disruptionCooldowns[playerCountry.code] || 0
    if (Date.now() < cooldownExpiry) return 'cooldown'

    // Deduct cost from player's country treasury
    const spent = world.spendFromFund(playerCountry.code, { money: cost })
    if (!spent) return 'insufficient_funds'

    // Record in economy ledger
    world.recordEconFlow('sea_disruption', cost, 'destroyed')

    const now = Date.now()
    const activatesAt = now + DISRUPTION_COUNTDOWN_MS
    const expiryMs = activatesAt + DISRUPTION_DURATION_MS

    set(s => {
      const filtered = s.disruptions.filter(d => d.routeId !== routeId)
      return {
        disruptions: [...filtered, { routeId, activatesAt, expiryMs, reason, orderedBy: playerCountry.code }],
        disruptionCooldowns: { ...s.disruptionCooldowns, [playerCountry.code]: now + DISRUPTION_COOLDOWN_MS },
      }
    })
    console.log(`⚠️ Disruption ordered: ${routeId} — activates in 6h, lasts 6h — cost $${cost.toLocaleString()}`)
    return 'ok'
  },

  tickDisruptions: () => {
    const now = Date.now()
    set(s => ({ disruptions: s.disruptions.filter(d => d.expiryMs > now) }))
  },

  isRouteDisrupted: (routeId) => {
    const now = Date.now()
    return get().disruptions.some(d => d.routeId === routeId && d.activatesAt <= now && d.expiryMs > now)
  },

  isRoutePendingDisruption: (routeId) => {
    const now = Date.now()
    return get().disruptions.some(d => d.routeId === routeId && d.activatesAt > now && d.expiryMs > now)
  },

  getDisruptionStatus: (routeId) => {
    const now = Date.now()
    const d = get().disruptions.find(dd => dd.routeId === routeId && dd.expiryMs > now)
    if (!d) return null
    if (d.activatesAt > now) return { state: 'pending', remainingMs: d.activatesAt - now }
    return { state: 'active', remainingMs: d.expiryMs - now }
  },

  isCountryOnCooldown: () => {
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return false
    const cooldownExpiry = get().disruptionCooldowns[playerCountry.code] || 0
    return Date.now() < cooldownExpiry
  },

  getCountryCooldownMs: () => {
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return 0
    const cooldownExpiry = get().disruptionCooldowns[playerCountry.code] || 0
    return Math.max(0, cooldownExpiry - Date.now())
  },

  toggleStrategicObjective: (routeId) => {
    set(s => {
      const exists = s.strategicObjectives.some(o => o.routeId === routeId)
      if (exists) return { strategicObjectives: s.strategicObjectives.filter(o => o.routeId !== routeId) }
      return { strategicObjectives: [...s.strategicObjectives, { routeId, addedAt: Date.now() }] }
    })
  },

  isStrategicObjective: (routeId) => {
    return get().strategicObjectives.some(o => o.routeId === routeId)
  },
}))

// ═══════════════════════════════════════════════════════════════
// SERVER SYNC — Fetch authoritative state from backend
// ═══════════════════════════════════════════════════════════════

/**
 * Payload shape returned by GET /api/ley-lines.
 * Kept local to this module — not exported.
 */
interface ServerLeyLineSnapshot {
  lines: Array<{
    id:               string
    name:             string
    archetype:        string
    isActive:         boolean
    completionPct:    number
    effectiveness:    number
    controllerIds:    string[]
    appliedBonuses:   Record<string, number>
    appliedTradeoffs: Record<string, number>
    nodes: Array<{ regionId: string; ownerCode: string | null; isCritical: boolean }>
  }>
  computedAt: string | null
}

// Quick in-memory cache of last server snapshot (does not need Zustand)
let _serverSnapshot: ServerLeyLineSnapshot | null = null
let _lastFetchAt = 0

/**
 * Fetch ley line state from the backend API and cache it.
 * Safe to call frequently — debounced to 15s.
 * Non-throwing: failures are silent.
 */
export async function fetchLeyLineStateFromServer(): Promise<void> {
  if (Date.now() - _lastFetchAt < 15_000) return
  _lastFetchAt = Date.now()
  try {
    const res = await fetch('/api/ley-lines', { credentials: 'include' })
    if (!res.ok) return
    _serverSnapshot = await res.json() as ServerLeyLineSnapshot
  } catch { /* non-fatal */ }
}

/**
 * Handle a real-time `leyline:state` Socket.IO event.
 * Call this from your socket listener in App.tsx / socketStore.
 */
export function syncLeyLineStateFromServer(payload: ServerLeyLineSnapshot): void {
  _serverSnapshot = payload
}

/**
 * Returns the server snapshot if available, or null.
 * Use this in GameMap.tsx / RegionPanel.tsx to get the authoritative node states
 * (ownerCode, isCritical) without recomputing locally.
 */
export function getServerLeyLineSnapshot(): ServerLeyLineSnapshot | null {
  return _serverSnapshot
}

// ═══════════════════════════════════════════════════════════════
// EXPORTED COMBAT HELPERS (used by battleStore)
// ═══════════════════════════════════════════════════════════════

/**
 * Compute combat-relevant multipliers from Ley Line bonuses for a country.
 * Returns { damageMult, armorMult } ready to multiply into the damage formula.
 */
export function computeLeyLineCombatMods(countryCode: string): { damageMult: number; armorMult: number } {
  const bonuses = useLeyLineStore.getState().getBonusesForCountry(countryCode)

  // Sum up all damage-related bonuses into a single multiplier
  const troopDmg  = bonuses.troopDamage       ?? 0  // e.g. +0.10 = +10%
  const weaponDmg = bonuses.weaponDamage       ?? 0
  const atkAdv    = bonuses.attackerAdvantage   ?? 0
  const damageMult = 1 + troopDmg + weaponDmg + atkAdv

  // DefenderBonus translates to armor multiplier
  const defBonus = bonuses.defenderBonus ?? 0
  const armorMult = 1 + defBonus

  return {
    damageMult: Math.max(0.1, damageMult),  // floor at 10% (can't reduce below)
    armorMult:  Math.max(0.1, armorMult),
  }
}

