import { create } from 'zustand'
import { useWorldStore } from './worldStore'

// ====== TYPES ======

export interface TradeRoute {
  id: string
  name: string
  from: string
  fromCountry: string   // ISO-2 of origin country
  fromCoords: [number, number]
  to: string
  toCountry: string     // ISO-2 of destination country
  toCoords: [number, number]
  resourceTypes: string[]
  oil: number           // per-tick oil yield
  fish: number          // per-tick fish yield (converted → money)
  tradedGoods: number   // per-tick money yield
  lengthNm: number      // route length in nautical miles
}

/** Three-way control state for a route */
export type RouteControlState = 'active' | 'partial' | 'inactive'

export interface RouteDisruption {
  routeId: string
  expiryMs: number   // absolute ms timestamp when disruption expires
  reason: string     // 'naval' | 'piracy' | 'storm'
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

export interface TradeRouteState {
  routes: TradeRoute[]
  geojson: any | null
  loaded: boolean
  selectedRouteId: string | null

  /** routeId → disruption info (serializable as array then converted) */
  disruptions: RouteDisruption[]

  /** routes the player has flagged as strategic objectives */
  strategicObjectives: StrategicObjective[]

  // ── Actions ──
  loadRoutes: () => Promise<void>
  selectRoute: (id: string | null) => void

  /** Returns the 3-way control state for a route */
  getRouteControlState: (route: TradeRoute) => RouteControlState

  getActiveRoutes: () => TradeRoute[]

  /**
   * Returns income result for each route this tick.
   * Pure: caller is responsible for applying credits to the world store.
   */
  computeTradeIncome: () => TradeIncomeResult[]

  /**
   * Applies computed trade income to the world/player fund.
   * Call this from the game loop.
   */
  processTradeIncome: () => void

  /** Disrupt a route for `durationMs` milliseconds */
  disruptRoute: (routeId: string, durationMs: number, reason?: string) => void

  /** Remove expired disruptions — call each tick */
  tickDisruptions: () => void

  isRouteDisrupted: (routeId: string) => boolean

  toggleStrategicObjective: (routeId: string) => void
  isStrategicObjective: (routeId: string) => boolean
}

// ── Partial income multiplier ──
const PARTIAL_INCOME_MULT = 0.30

// ── ISO-2 code map (GeoJSON → region store) ──
const COUNTRY_CODE_MAP: Record<string, string> = {
  'SG': 'SG', 'CN': 'CN', 'EG': 'EG', 'AE': 'AE', 'PA': 'PA',
  'US': 'US', 'IN': 'IN', 'ZA': 'ZA', 'NL': 'NL', 'GB': 'GB',
  'IT': 'IT', 'TR': 'TR', 'DJ': 'DJ', 'RU': 'RU', 'DE': 'DE',
}
// Silence unused-variable lint
void COUNTRY_CODE_MAP

/**
 * Check if a country is controlled by the player or their alliance/empire.
 */
function isCountryInPlayerAlliance(countryCode: string, playerCode: string): boolean {
  const world = useWorldStore.getState()
  if (countryCode === playerCode) return true

  const playerCountry = world.countries.find(c => c.code === playerCode)
  const targetCountry = world.countries.find(c => c.code === countryCode)
  if (!playerCountry || !targetCountry) return false

  // Same empire
  if (
    playerCountry.empire &&
    targetCountry.empire &&
    playerCountry.empire === targetCountry.empire
  ) return true

  // Target is controlled by the same controller as the player
  if (
    playerCountry.controller &&
    targetCountry.controller === playerCountry.controller
  ) return true

  return false
}

export const useTradeRouteStore = create<TradeRouteState>((set, get) => ({
  routes: [],
  geojson: null,
  loaded: false,
  selectedRouteId: null,
  disruptions: [],
  strategicObjectives: [],

  // ── Load ──
  loadRoutes: async () => {
    try {
      const res = await fetch('/data/trade-routes.geojson')
      const geojson = await res.json()

      const routes: TradeRoute[] = geojson.features.map((f: any) => ({
        id: f.properties.id,
        name: f.properties.name,
        from: f.properties.from,
        fromCountry: f.properties.fromCountry,
        fromCoords: f.properties.fromCoords,
        to: f.properties.to,
        toCountry: f.properties.toCountry,
        toCoords: f.properties.toCoords,
        resourceTypes: f.properties.resourceTypes,
        oil: f.properties.oil,
        fish: f.properties.fish,
        tradedGoods: f.properties.tradedGoods,
        lengthNm: Math.round(f.properties.length),
      }))

      set({ routes, geojson, loaded: true })
      console.log(`✅ Trade routes loaded: ${routes.length} routes`)
    } catch (err) {
      console.warn('Could not load trade routes:', err)
    }
  },

  selectRoute: (id) => set({ selectedRouteId: id }),

  // ── Control state ──
  getRouteControlState: (route) => {
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return 'inactive'

    const fromOk = isCountryInPlayerAlliance(route.fromCountry, playerCountry.code)
    const toOk   = isCountryInPlayerAlliance(route.toCountry,   playerCountry.code)

    if (fromOk && toOk) return 'active'
    if (fromOk || toOk) return 'partial'
    return 'inactive'
  },

  getActiveRoutes: () => {
    const { routes, getRouteControlState } = get()
    return routes.filter(r => getRouteControlState(r) === 'active')
  },

  // ── Income computation (pure) ──
  computeTradeIncome: () => {
    const { routes, getRouteControlState, isRouteDisrupted } = get()
    const results: TradeIncomeResult[] = []

    for (const route of routes) {
      const controlState = getRouteControlState(route)
      if (controlState === 'inactive') continue
      if (isRouteDisrupted(route.id)) continue

      const mult = controlState === 'active' ? 1 : PARTIAL_INCOME_MULT

      const moneyGained = Math.round((route.tradedGoods + route.fish * 10) * mult)
      const oilGained   = Math.round(route.oil * mult)

      results.push({ routeId: route.id, controlState, moneyGained, oilGained })
    }

    return results
  },

  // ── Process income (applies to world fund) ──
  processTradeIncome: () => {
    const { computeTradeIncome } = get()
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return

    const results = computeTradeIncome()
    for (const r of results) {
      if (r.moneyGained > 0) world.addToFund(playerCountry.code, 'money', r.moneyGained)
      if (r.oilGained   > 0) world.addToFund(playerCountry.code, 'oil',   r.oilGained)
    }

    // Record in economy ledger
    const totalMoney = results.reduce((s, r) => s + r.moneyGained, 0)
    const totalOil   = results.reduce((s, r) => s + r.oilGained, 0)
    if (totalMoney > 0) world.recordEconFlow('trade_routes_money', totalMoney, 'created', 'money')
    if (totalOil   > 0) world.recordEconFlow('trade_routes_oil',   totalOil,   'created', 'oil')
  },

  // ── Disruption ──
  disruptRoute: (routeId, durationMs, reason = 'naval') => {
    const expiryMs = Date.now() + durationMs
    set(s => {
      const filtered = s.disruptions.filter(d => d.routeId !== routeId)
      return { disruptions: [...filtered, { routeId, expiryMs, reason }] }
    })
    console.log(`⚠️ Trade route disrupted: ${routeId} for ${Math.round(durationMs / 60000)} min`)
  },

  tickDisruptions: () => {
    const now = Date.now()
    set(s => ({ disruptions: s.disruptions.filter(d => d.expiryMs > now) }))
  },

  isRouteDisrupted: (routeId) => {
    const now = Date.now()
    return get().disruptions.some(d => d.routeId === routeId && d.expiryMs > now)
  },

  // ── Strategic objectives ──
  toggleStrategicObjective: (routeId) => {
    set(s => {
      const exists = s.strategicObjectives.some(o => o.routeId === routeId)
      if (exists) {
        return { strategicObjectives: s.strategicObjectives.filter(o => o.routeId !== routeId) }
      }
      return { strategicObjectives: [...s.strategicObjectives, { routeId, addedAt: Date.now() }] }
    })
  },

  isStrategicObjective: (routeId) => {
    return get().strategicObjectives.some(o => o.routeId === routeId)
  },
}))
