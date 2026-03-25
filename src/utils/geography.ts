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

/**
 * Returns true if the region is adjacent to any ocean region (isOcean === true).
 */
export function isCoastalRegion(regionId: string): boolean {
  const regions = useRegionStore.getState().regions
  const region = regions.find(r => r.id === regionId)
  if (!region) return false
  // A region is coastal if any of its adjacent regions is an ocean block
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
 * Radius = portLevel × 5000 pixels. Only works if port infra is enabled.
 * Both the source AND target must be coastal.
 */
export function getPortReachableRegions(fromRegionId: string): string[] {
  const regions = useRegionStore.getState().regions
  const from = regions.find(r => r.id === fromRegionId)
  if (!from || from.isOcean) return []
  
  const level = from.portLevel
  if (level <= 0) return []
  if (from.infraEnabled?.portLevel === false) return []
  
  // Source region must itself be coastal
  if (!isCoastalRegion(fromRegionId)) return []
  
  const radius = level * 5000
  const adjacentSet = new Set(from.adjacent)
  
  return regions
    .filter(r => {
      if (r.id === fromRegionId) return false
      if (r.isOcean) return false
      if (adjacentSet.has(r.id)) return false
      if (getRegionDistance(from.position, r.position) > radius) return false
      // Target must also be coastal
      return isCoastalRegion(r.id)
    })
    .map(r => r.id)
}
