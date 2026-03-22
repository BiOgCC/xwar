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
