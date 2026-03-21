import { useMemo } from 'react'
import { useRegionStore, type Region } from '../../stores/regionStore'
import { useWorldStore } from '../../stores/worldStore'
import { usePlayerStore } from '../../stores/playerStore'
import type { GameMapHandle } from './GameMap'

interface BattleMapOverlayProps {
  mapRef: React.RefObject<GameMapHandle | null>
  onRegionClick?: (region: Region) => void
}

// Map region names to CARTO vector tile state/province names for position syncing
const REGION_TO_CARTO: Record<string, string> = {
  // Canada
  'British Columbia': 'British Columbia', 'Alberta': 'Alberta',
  'Saskatchewan': 'Saskatchewan', 'Manitoba': 'Manitoba',
  'Ontario': 'Ontario', 'Quebec': 'Québec',
  'New Brunswick': 'New Brunswick', 'Nova Scotia': 'Nova Scotia',
  'Prince Edward Is': 'Prince Edward Island', 'Newfoundland': 'Newfoundland and Labrador',
  'Yukon': 'Yukon', 'NW Territories': 'Northwest Territories', 'Nunavut': 'Nunavut',
  // Russia
  'Moscow': 'Moskva', 'St Petersburg': 'Sankt-Peterburg',
  'Karelia': 'Karelia', 'Arkhangelsk': 'Arkhangel\'sk',
  'Western Russia': 'Smolensk', 'Volga': 'Tatarstan',
  'Caucasus': 'Krasnodar', 'Komi': 'Komi',
  'Ural': 'Sverdlovsk', 'Tyumen': 'Tyumen\'',
  'Omsk': 'Omsk', 'Novosibirsk': 'Novosibirsk',
  'Krasnoyarsk': 'Krasnoyarsk', 'Altai': 'Altay',
  'Irkutsk': 'Irkutsk', 'Buryatia': 'Buryatiya',
  'Sakha': 'Sakha', 'Magadan': 'Magadan',
  'Kamchatka': 'Kamchatka', 'Far East': 'Khabarovsk',
  // Cuba
  'Central Cuba': 'Villa Clara', 'Havana': 'La Habana',
  'Santiago': 'Santiago de Cuba',
}

export default function BattleMapOverlay({ mapRef, onRegionClick }: BattleMapOverlayProps) {
  const regions = useRegionStore(state => state.regions)
  const wars = useWorldStore(state => state.wars)
  const player = usePlayerStore()
  const playerIso = player.countryCode || 'US'

  // Find active enemy country codes
  const enemyCodes = useMemo(() => {
    const codes = new Set<string>()
    codes.add('OC') // Oceans are always claimable
    wars.forEach(w => {
      if (w.status !== 'active') return
      if (w.attacker === playerIso) codes.add(w.defender)
      if (w.defender === playerIso) codes.add(w.attacker)
    })
    return codes
  }, [wars, playerIso])

  const hasActiveWar = enemyCodes.size > 0

  // Determine reachable vs unreachable enemy regions
  const { reachable, unreachable } = useMemo(() => {
    if (!hasActiveWar) return { reachable: [] as Region[], unreachable: [] as Region[] }

    const currentRegions = useRegionStore.getState().regions
    const playerRegionIds = new Set(
      currentRegions.filter(r => r.controlledBy === playerIso).map(r => r.id)
    )
    const enemyRegions = currentRegions.filter(r => enemyCodes.has(r.countryCode))

    const reach: Region[] = []
    const unreach: Region[] = []
    
    // Group by country to check for beachheads
    const ownsByCountry = new Set<string>()
    currentRegions.forEach(r => {
      if (r.controlledBy === playerIso) ownsByCountry.add(r.countryCode)
    })

    enemyRegions.forEach(r => {
      // Beachhead logic: If we own 0 regions in target country, ANY region is reachable
      if (!ownsByCountry.has(r.countryCode)) {
        reach.push(r)
        return
      }
      const canReach = r.adjacent.some(adjId => playerRegionIds.has(adjId))
      if (canReach) reach.push(r)
      else unreach.push(r)
    })

    return { reachable: reach, unreachable: unreach }
  }, [regions, hasActiveWar, playerIso, enemyCodes])

  return null
}
