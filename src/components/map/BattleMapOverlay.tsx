import { useEffect, useRef, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import { useRegionStore } from '../../stores/regionStore'
import type { Region } from '../../stores/regionStore'
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
  const initialized = useRegionStore(state => state.initialized)
  const wars = useWorldStore(state => state.wars)
  const player = usePlayerStore()
  const playerIso = player.countryCode || 'US'
  const onRegionClickRef = useRef(onRegionClick)
  onRegionClickRef.current = onRegionClick
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())

  // Find active enemy country codes
  const enemyCodes = useMemo(() => {
    const codes = new Set<string>()
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

  // Create/update dot markers on enemy territory
  useEffect(() => {
    const mapInstance = mapRef.current?.getMap()
    if (!mapInstance || !initialized) return

    // Build a lookup of CARTO state label positions from vector tiles
    const cartoPositions = new Map<string, [number, number]>()
    try {
      const features = mapInstance.querySourceFeatures(
        Object.keys(mapInstance.getStyle()?.sources || {}).find(s => {
          const src = (mapInstance.getStyle()?.sources?.[s] as any)
          return src?.type === 'vector'
        }) || '',
        { sourceLayer: 'place', filter: ['in', 'class', 'state', 'province'] }
      )
      features.forEach((f: any) => {
        const name = f.properties?.name
        const nameEn = f.properties?.['name:en'] || f.properties?.name_en
        const coords = f.geometry?.coordinates
        if (coords && name) {
          cartoPositions.set(name, coords)
          if (nameEn) cartoPositions.set(nameEn, coords)
        }
      })
    } catch {}

    // Get best position for a region: prefer CARTO label position, fallback to region offset
    const getPosition = (r: Region): [number, number] => {
      // Try CARTO mapping
      const cartoName = REGION_TO_CARTO[r.name]
      if (cartoName && cartoPositions.has(cartoName)) return cartoPositions.get(cartoName)!
      // Try direct name match
      if (cartoPositions.has(r.name)) return cartoPositions.get(r.name)!
      // Fallback to region's computed position
      return r.position
    }

    const currentMarkers = markersRef.current
    const allEnemyIds = new Set([...reachable.map(r => r.id), ...unreachable.map(r => r.id)])

    // Remove stale markers
    currentMarkers.forEach((marker, id) => {
      if (!allEnemyIds.has(id)) {
        marker.remove()
        currentMarkers.delete(id)
      }
    })

    // Add/update reachable dots (green — clickable)
    reachable.forEach(r => {
      const pos = getPosition(r)
      if (currentMarkers.has(r.id)) {
        const marker = currentMarkers.get(r.id)!
        marker.setLngLat(pos)
        return
      }

      const el = document.createElement('div')
      el.className = 'war-dot war-dot--green'
      el.title = `⚔️ ${r.name} — Click to attack!`
      el.innerHTML = `<div class="war-dot__inner"><span class="war-dot__pulse"></span><span class="war-dot__core"></span><span class="war-dot__name war-dot__name--green">${r.name}</span></div>`

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const freshRegion = useRegionStore.getState().getRegion(r.id)
        if (freshRegion && onRegionClickRef.current) {
          onRegionClickRef.current(freshRegion)
        }
      })

      const marker = new maplibregl.Marker({ element: el, anchor: 'left' })
        .setLngLat(pos)
        .addTo(mapInstance)

      currentMarkers.set(r.id, marker)
    })

    // Add/update unreachable dots (red — not clickable)
    unreachable.forEach(r => {
      const pos = getPosition(r)
      if (currentMarkers.has(r.id)) {
        const marker = currentMarkers.get(r.id)!
        marker.setLngLat(pos)
        return
      }

      const el = document.createElement('div')
      el.className = 'war-dot war-dot--red'
      el.title = `🔒 ${r.name} — Capture adjacent territory first`
      el.innerHTML = `<div class="war-dot__inner"><span class="war-dot__core"></span><span class="war-dot__name war-dot__name--red">${r.name}</span></div>`

      const marker = new maplibregl.Marker({ element: el, anchor: 'left' })
        .setLngLat(pos)
        .addTo(mapInstance)

      currentMarkers.set(r.id, marker)
    })

    // Zoom-based visibility & scaling
    const updateVisibility = () => {
      const zoom = mapInstance.getZoom()
      const show = zoom >= 3
      const scale = show ? Math.min(1 + (zoom - 3) * 0.35, 2.5) : 1
      currentMarkers.forEach(marker => {
        const el = marker.getElement()
        el.style.display = show ? '' : 'none'
        const inner = el.querySelector('.war-dot__inner') as HTMLElement
        if (inner) inner.style.transform = `scale(${scale})`
      })
    }
    mapInstance.on('zoom', updateVisibility)
    updateVisibility()

    return () => {
      mapInstance.off('zoom', updateVisibility)
    }
  }, [reachable, unreachable, initialized, mapRef])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()
    }
  }, [])

  return null
}
