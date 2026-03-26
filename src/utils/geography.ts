import { useRegionStore } from '../stores/regionStore'

/**
 * Calculates the Euclidean "pixel distance" between the geographic centroids of two countries.
 * The centroid is determined by averaging the offsetX and offsetY of all regions belonging to the country.
 */
export function getCountryDistance(countryA: string, countryB: string): number {
  if (countryA === countryB) return 0

  const regions = useRegionStore.getState().regions
  const regionsA = regions.filter(r => r.countryCode === countryA)
  const regionsB = regions.filter(r => r.countryCode === countryB)
  
  if (regionsA.length === 0 || regionsB.length === 0) return 100 // Fallback distance if regions are somehow missing
  
  const cxA = regionsA.reduce((sum, r) => sum + r.position[0], 0) / regionsA.length
  const cyA = regionsA.reduce((sum, r) => sum + r.position[1], 0) / regionsA.length
  
  const cxB = regionsB.reduce((sum, r) => sum + r.position[0], 0) / regionsB.length
  const cyB = regionsB.reduce((sum, r) => sum + r.position[1], 0) / regionsB.length
  
  // Use a map scale of roughly 1000x500 to get a meaningful "pixel" value
  const pixelDistance = Math.sqrt(
    Math.pow((cxA - cxB) * 1000, 2) + Math.pow((cyA - cyB) * 500, 2)
  )
  
  return pixelDistance
}

/**
 * Calculates the oil cost for attacking based on distance.
 */
export function getAttackOilCost(distance: number): number {
  // Base cost 100 oil, plus 2 oil per raw 'pixel' distance.
  // Adjacent countries usually fall in the 50-100 range, max distance is around ~1100.
  return Math.floor(100 + distance * 2)
}

// ====== REGION-LEVEL DISTANCE & INFRASTRUCTURE REACH ======

/**
 * Pixel distance between two regions by their [lng, lat] positions.
 * Uses the same scale as getCountryDistance (×1000 for lng, ×500 for lat).
 */
export function getRegionDistance(posA: [number, number], posB: [number, number]): number {
  return Math.sqrt(
    Math.pow((posA[0] - posB[0]) * 1000, 2) + Math.pow((posA[1] - posB[1]) * 500, 2)
  )
}

// ====== COASTAL DETECTION ======

/**
 * Explicit set of coastal region IDs — regions that border an ocean or sea in real geography.
 * Used to restrict port construction to coastal regions only.
 */
const COASTAL_REGIONS = new Set([
  // ── United States ──
  'US-WA', 'US-OR', 'US-CA', 'US-AK', 'US-HI',              // Pacific coast
  'US-TX', 'US-LA', 'US-MS', 'US-AL', 'US-FL',               // Gulf coast
  'US-GA', 'US-SC', 'US-NC', 'US-VA', 'US-MD', 'US-DE',      // Mid-Atlantic
  'US-NJ', 'US-NY', 'US-CT', 'US-RI', 'US-MA', 'US-NH', 'US-ME', // Northeast coast

  // ── Canada ──
  'CA-BC', 'CA-NS', 'CA-NB', 'CA-PE', 'CA-NL', 'CA-QC',     // Atlantic + Pacific coasts
  'CA-NU', 'CA-NT', 'CA-YT',                                   // Arctic coast

  // ── Russia ──
  'RU-SP', 'RU-KR', 'RU-AR',                                  // Baltic / White Sea / Arctic
  'RU-CC',                                                      // Black Sea
  'RU-FE', 'RU-MG', 'RU-KM', 'RU-SK',                        // Pacific coast

  // ── China ──
  'CN-LN', 'CN-SD', 'CN-JS', 'CN-GD',                        // East coast
  'CN-HL', 'CN-MC', 'CN-JL',                                   // Manchuria coast

  // ── Germany ──
  'DE-SH', 'DE-HH', 'DE-MV', 'DE-HB', 'DE-NI',              // North Sea / Baltic coast

  // ── Japan ── (island nation, all regions coastal)
  'JP-HK', 'JP-TH', 'JP-KT', 'JP-CB', 'JP-KS', 'JP-CG', 'JP-SK', 'JP-KY',

  // ── United Kingdom ── (island nation, all regions coastal)
  'GB-SC', 'GB-NE', 'GB-NW', 'GB-YH', 'GB-WM', 'GB-EM', 'GB-EN', 'GB-LN', 'GB-SW', 'GB-WA',

  // ── Brazil ──
  'BR-PA', 'BR-MA', 'BR-CE', 'BR-BA', 'BR-RJ', 'BR-SP', 'BR-RS', // Atlantic coast
  'BR-AM',                                                      // Amazon river (navigable)

  // ── India ──
  'IN-GJ', 'IN-MH', 'IN-KR', 'IN-TN',                        // West + South coast
  'IN-OR', 'IN-WB',                                             // East coast

  // ── Nigeria ──
  'NG-LG', 'NG-SS', 'NG-SE',                                  // Gulf of Guinea coast

  // ── Turkey ──
  'TR-IS', 'TR-MA', 'TR-BS', 'TR-AE', 'TR-MD',               // Black Sea / Mediterranean / Aegean

  // ── Mexico ──
  'MX-BC', 'MX-SO', 'MX-TM', 'MX-YU',                        // Pacific + Gulf coast

  // ── Cuba ── (island nation, all regions coastal)
  'CU-HA', 'CU-CT', 'CU-SG',

  // ── Bahamas ── (island nation, all regions coastal)
  'BS-NP', 'BS-GI',
])

/**
 * Returns true if the region is "coastal" — eligible for port construction.
 * Uses an explicit set for hardcoded regions, falls back to ocean adjacency for procedural ones.
 */
export function isCoastalRegion(regionId: string): boolean {
  // Fast path: check explicit coastal set
  if (COASTAL_REGIONS.has(regionId)) return true

  // Fallback for procedurally-generated regions: check ocean adjacency
  const regions = useRegionStore.getState().regions
  const region = regions.find(r => r.id === regionId)
  if (!region || region.isOcean) return false
  return region.adjacent.some(adjId => {
    const adj = regions.find(r => r.id === adjId)
    return adj?.isOcean === true
  })
}

/**
 * Returns all non-adjacent regions reachable by airport (any region within radius).
 * Radius = airportLevel × 5000 pixels. Only works if airport infra is enabled.
 */
export function getAirportReachableRegions(fromRegionId: string): string[] {
  const regions = useRegionStore.getState().regions
  const from = regions.find(r => r.id === fromRegionId)
  if (!from || from.isOcean) return []
  
  const level = from.airportLevel
  if (level <= 0) return []
  if (from.infraEnabled?.airportLevel === false) return []
  
  const radius = level * 5000
  const adjacentSet = new Set(from.adjacent)
  
  return regions
    .filter(r => {
      if (r.id === fromRegionId) return false
      if (r.isOcean) return false
      if (adjacentSet.has(r.id)) return false // already adjacent, not "long-range"
      return getRegionDistance(from.position, r.position) <= radius
    })
    .map(r => r.id)
}

/**
 * Returns all non-adjacent COASTAL regions reachable by port (within radius).
 * Radius per level: Lv1=3000, Lv2=5000, Lv3=8000, Lv4=12000, Lv5=18000 pixels.
 * Only works if port infra is enabled.
 * Target regions must be coastal (near ocean). Source does NOT need to be coastal —
 * building a port creates the maritime connection.
 */
const PORT_RADIUS_PER_LEVEL = [0, 3000, 5000, 8000, 12000, 18000]

export function getPortReachableRegions(fromRegionId: string): string[] {
  const regions = useRegionStore.getState().regions
  const from = regions.find(r => r.id === fromRegionId)
  if (!from || from.isOcean) return []
  
  const level = from.portLevel
  if (level <= 0) return []
  if (from.infraEnabled?.portLevel === false) return []
  
  // Source region must be coastal to use a port
  if (!isCoastalRegion(fromRegionId)) return []
  
  const radius = PORT_RADIUS_PER_LEVEL[Math.min(level, 5)] || level * 3000
  const adjacentSet = new Set(from.adjacent)
  
  return regions
    .filter(r => {
      if (r.id === fromRegionId) return false
      if (r.isOcean) return false
      if (adjacentSet.has(r.id)) return false
      if (getRegionDistance(from.position, r.position) > radius) return false
      // Target must be coastal (near ocean)
      return isCoastalRegion(r.id)
    })
    .map(r => r.id)
}
