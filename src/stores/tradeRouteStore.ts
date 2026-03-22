import { create } from 'zustand'
import { useWorldStore } from './worldStore'

// ====== TRADE ROUTE MODEL ======

export interface TradeRoute {
  id: string
  name: string
  from: string
  fromCountry: string   // ISO-2 of the origin country
  fromCoords: [number, number]
  to: string
  toCountry: string     // ISO-2 of the destination country
  toCoords: [number, number]
  resourceTypes: string[]
  oil: number           // per-tick yield
  fish: number
  tradedGoods: number   // money per tick
  lengthNm: number      // route length in nautical miles
}

export interface TradeRouteState {
  routes: TradeRoute[]
  geojson: any | null
  loaded: boolean
  selectedRouteId: string | null

  loadRoutes: () => Promise<void>
  selectRoute: (id: string | null) => void
  getActiveRoutes: () => TradeRoute[]
  isRouteActive: (route: TradeRoute) => boolean
  processTradeIncome: () => void
}

// ISO-2 code mapping from the GeoJSON country codes to region store codes
const COUNTRY_CODE_MAP: Record<string, string> = {
  'SG': 'SG', 'CN': 'CN', 'EG': 'EG', 'AE': 'AE', 'PA': 'PA',
  'US': 'US', 'IN': 'IN', 'ZA': 'ZA', 'NL': 'NL', 'GB': 'GB',
  'IT': 'IT', 'TR': 'TR', 'DJ': 'DJ', 'RU': 'RU', 'DE': 'DE',
}

/**
 * Check if a country is controlled by a player or their alliance.
 * A country is "connected" if the player or any alliance member
 * is the controller of that country in the world store.
 */
function isCountryControlledByAlliance(countryCode: string, playerCountryCode: string): boolean {
  const world = useWorldStore.getState()
  const playerCountry = world.countries.find(c => c.code === playerCountryCode)
  if (!playerCountry) return false

  const targetCountry = world.countries.find(c => c.code === countryCode)
  if (!targetCountry) return false

  // Same country
  if (countryCode === playerCountryCode) return true

  // Same empire/alliance
  if (playerCountry.empire && targetCountry.empire && playerCountry.empire === targetCountry.empire) return true

  // Player controls the target
  if (targetCountry.controller === 'Player Alliance' || targetCountry.controller === playerCountry.controller) return true

  return false
}

export const useTradeRouteStore = create<TradeRouteState>((set, get) => ({
  routes: [],
  geojson: null,
  loaded: false,
  selectedRouteId: null,

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

  isRouteActive: (route: TradeRoute): boolean => {
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return false

    const fromOk = isCountryControlledByAlliance(route.fromCountry, playerCountry.code)
    const toOk = isCountryControlledByAlliance(route.toCountry, playerCountry.code)
    return fromOk && toOk
  },

  getActiveRoutes: () => {
    const { routes, isRouteActive } = get()
    return routes.filter(r => isRouteActive(r))
  },

  processTradeIncome: () => {
    const { routes, isRouteActive } = get()
    const world = useWorldStore.getState()
    const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')
    if (!playerCountry) return

    routes.forEach(r => {
      if (!isRouteActive(r)) return

      // Add resources to the player's national fund
      if (r.tradedGoods > 0) world.addToFund(playerCountry.code, 'money', r.tradedGoods)
      if (r.oil > 0) world.addToFund(playerCountry.code, 'oil', r.oil)
      // Fish could be added as food or a separate resource — for now mapped to money
      if (r.fish > 0) world.addToFund(playerCountry.code, 'money', r.fish * 10)
    })
  },
}))
