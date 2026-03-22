import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import maplibregl from 'maplibre-gl'
import 'flag-icons/css/flag-icons.min.css'
import type { Country } from '../../stores/worldStore'
import { useWorldStore } from '../../stores/worldStore'
import type { Region } from '../../stores/regionStore'
import { useRegionStore } from '../../stores/regionStore'
import { LEY_LINE_DEFS, ARCHETYPE_META } from '../../data/leyLineRegistry'
import { useLeyLineStore } from '../../stores/leyLineStore'
import { useTradeRouteStore } from '../../stores/tradeRouteStore'

interface GameMapProps {
  countries: Country[]
  onRegionClick?: (region: Region) => void
  onRegionDoubleClick?: (region: Region) => void
  onMouseMove?: (lat: string, lng: string) => void
}

export interface GameMapHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  flyTo: (lng: number, lat: number, zoom?: number) => void
  getMap: () => maplibregl.Map | null
}

// Country centroids (lng, lat) — exported for battle overlay
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  'United States': [-98.5, 39.8],
  'Russia': [90, 62],
  'China': [104, 35],
  'Germany': [10.4, 51.2],
  'Brazil': [-51.9, -14.2],
  'India': [79, 22],
  'Nigeria': [8, 9.1],
  'Japan': [138, 36.2],
  'United Kingdom': [-3.4, 55.4],
  'Turkey': [35.2, 39],
  'Canada': [-106.3, 56.1],
  'Mexico': [-102.5, 23.6],
  'Cuba': [-79.0, 21.5],
  'Bahamas': [-77.3, 25.0],
}

// ISO A3 for GeoJSON matching
const COUNTRY_ISO: Record<string, string> = {
  'United States': 'USA', 'Russia': 'RUS', 'China': 'CHN', 'Germany': 'DEU',
  'Brazil': 'BRA', 'India': 'IND', 'Nigeria': 'NGA', 'Japan': 'JPN',
  'United Kingdom': 'GBR', 'Turkey': 'TUR', 'Canada': 'CAN', 'Mexico': 'MEX',
  'Cuba': 'CUB', 'Bahamas': 'BHS',
  'France': 'FRA', 'Spain': 'ESP', 'Italy': 'ITA', 'Poland': 'POL',
  'Ukraine': 'UKR', 'Romania': 'ROU', 'Netherlands': 'NLD', 'Belgium': 'BEL',
  'Sweden': 'SWE', 'Norway': 'NOR', 'Finland': 'FIN', 'Denmark': 'DNK',
  'Austria': 'AUT', 'Switzerland': 'CHE', 'Czech Republic': 'CZE', 'Portugal': 'PRT',
  'Greece': 'GRC', 'Hungary': 'HUN', 'Ireland': 'IRL', 'Iceland': 'ISL',
  'Serbia': 'SRB', 'Belarus': 'BLR', 'Bulgaria': 'BGR', 'Slovakia': 'SVK',
  'Croatia': 'HRV', 'Lithuania': 'LTU', 'Latvia': 'LVA', 'Estonia': 'EST',
  'Slovenia': 'SVN', 'Bosnia and Herzegovina': 'BIH', 'Albania': 'ALB',
  'North Macedonia': 'MKD', 'Montenegro': 'MNE', 'Moldova': 'MDA',
  'Argentina': 'ARG', 'Colombia': 'COL', 'Venezuela': 'VEN', 'Peru': 'PER',
  'Chile': 'CHL', 'Ecuador': 'ECU', 'Bolivia': 'BOL', 'Paraguay': 'PRY',
  'Uruguay': 'URY', 'Guyana': 'GUY', 'Suriname': 'SUR',
  'Guatemala': 'GTM', 'Honduras': 'HND', 'El Salvador': 'SLV', 'Nicaragua': 'NIC',
  'Costa Rica': 'CRI', 'Panama': 'PAN', 'Dominican Republic': 'DOM', 'Haiti': 'HTI',
  'Jamaica': 'JAM',
  'South Korea': 'KOR', 'North Korea': 'PRK', 'Taiwan': 'TWN', 'Thailand': 'THA',
  'Vietnam': 'VNM', 'Philippines': 'PHL', 'Malaysia': 'MYS', 'Indonesia': 'IDN',
  'Myanmar': 'MMR', 'Bangladesh': 'BGD', 'Pakistan': 'PAK', 'Afghanistan': 'AFG',
  'Iraq': 'IRQ', 'Iran': 'IRN', 'Saudi Arabia': 'SAU', 'United Arab Emirates': 'ARE',
  'Israel': 'ISR', 'Syria': 'SYR', 'Jordan': 'JOR', 'Lebanon': 'LBN',
  'Yemen': 'YEM', 'Oman': 'OMN', 'Kuwait': 'KWT', 'Qatar': 'QAT',
  'Georgia': 'GEO', 'Armenia': 'ARM', 'Azerbaijan': 'AZE', 'Kazakhstan': 'KAZ',
  'Uzbekistan': 'UZB', 'Turkmenistan': 'TKM', 'Kyrgyzstan': 'KGZ', 'Tajikistan': 'TJK',
  'Mongolia': 'MNG', 'Nepal': 'NPL', 'Sri Lanka': 'LKA', 'Cambodia': 'KHM', 'Laos': 'LAO',
  'South Africa': 'ZAF', 'Egypt': 'EGY', 'Kenya': 'KEN', 'Ethiopia': 'ETH',
  'Tanzania': 'TZA', 'Ghana': 'GHA', 'Ivory Coast': 'CIV', 'Cameroon': 'CMR',
  'Angola': 'AGO', 'Mozambique': 'MOZ', 'Madagascar': 'MDG', 'Morocco': 'MAR',
  'Algeria': 'DZA', 'Tunisia': 'TUN', 'Libya': 'LBY', 'Sudan': 'SDN',
  'South Sudan': 'SSD', 'Uganda': 'UGA', 'Senegal': 'SEN', 'Mali': 'MLI',
  'Burkina Faso': 'BFA', 'Niger': 'NER', 'Chad': 'TCD', 'DR Congo': 'COD',
  'Congo': 'COG', 'Central African Republic': 'CAF', 'Gabon': 'GAB',
  'Equatorial Guinea': 'GNQ', 'Malawi': 'MWI', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE',
  'Botswana': 'BWA', 'Namibia': 'NAM', 'Somalia': 'SOM', 'Eritrea': 'ERI',
  'Mauritania': 'MRT',
  'Australia': 'AUS', 'New Zealand': 'NZL', 'Papua New Guinea': 'PNG',
}

// Reverse: ISO3 (from GeoJSON) → game country name
const ISO3_TO_NAME: Record<string, string> = {}
Object.entries(COUNTRY_ISO).forEach(([name, iso3]) => { ISO3_TO_NAME[iso3] = name })

// ── Hoisted utility (no re-creation on every map load) ──
const hslToHex = (h: number, s: number, l: number): string => {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const DEFAULT_CENTER: [number, number] = [20, 25]
const DEFAULT_ZOOM = 2.0

const GameMap = forwardRef<GameMapHandle, GameMapProps>(({ countries, onRegionClick, onRegionDoubleClick, onMouseMove }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Store callbacks in refs so marker event listeners always have the latest version
  const onRegionClickRef = useRef(onRegionClick)
  onRegionClickRef.current = onRegionClick
  const onRegionDoubleClickRef = useRef(onRegionDoubleClick)
  onRegionDoubleClickRef.current = onRegionDoubleClick
  const countriesRef = useRef(countries)
  countriesRef.current = countries

  const handleRegionClick = useCallback((countryIso2: string, lngLat: [number, number]) => {
    const { regions } = useRegionStore.getState()
    const countryRegions = regions.filter(r => r.countryCode === countryIso2)
    
    if (countryRegions.length > 0) {
      let closestRegion = countryRegions[0]
      let minDst = Infinity
      countryRegions.forEach(r => {
        const dx = r.position[0] - lngLat[0]
        const dy = r.position[1] - lngLat[1]
        const dst = dx*dx + dy*dy
        if (dst < minDst) { minDst = dst; closestRegion = r; }
      })
      if (onRegionClickRef.current) {
        onRegionClickRef.current(closestRegion)
      }
    }
  }, [])

  // Expose map controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      map.current?.zoomIn({ duration: 300 })
    },
    zoomOut: () => {
      map.current?.zoomOut({ duration: 300 })
    },
    resetView: () => {
      map.current?.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        duration: 800,
      })
    },
    flyTo: (lng: number, lat: number, zoom = 5) => {
      map.current?.flyTo({
        center: [lng, lat],
        zoom,
        duration: 800,
      })
    },
    getMap: () => map.current,
  }), [])

  // Approximate rectangular bounds for Ocean Blocks
  // The land layer will perfectly mask these rectangles at the coastlines!
  const OCEAN_POLYGONS: Record<string, number[][][]> = {
    'West Atlantic':   [[[-85, 10], [-45, 10], [-45, 60], [-85, 60], [-85, 10]]],
    'Central Atlantic':[[[-45, 10], [-25, 10], [-25, 60], [-45, 60], [-45, 10]]],
    'East Atlantic':   [[[-25, 10], [  5, 10], [  5, 60], [-25, 60], [-25, 10]]],
    'Pacific Ocean':   [[[-180,-40],[-120,-40],[-120, 60],[-180, 60],[-180,-40]]],
    'Indian Ocean':    [[[ 40,-30], [ 100,-30], [ 100, 20], [ 40, 20], [ 40,-30]]],
    'Mediterranean Sea':[[[-5, 30], [  35, 30], [  35, 45], [ -5, 45], [ -5, 30]]],
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 1.5,
      maxZoom: 8,
      attributionControl: false,
      pitchWithRotate: false,
      dragRotate: false,
      doubleClickZoom: false,
      // ── Performance flags ──
      fadeDuration: 0,           // skip tile-fade animation (saves GPU compositing)
      refreshExpiredTiles: false, // don't re-fetch stale tiles during play session
      maxTileCacheSize: 50,      // limit VRAM tile cache (was unlimited)
      trackResize: false,        // we handle resize manually via ResizeObserver
    })

    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    m.on('load', () => {
      // ── 1. STRIP BASEMAP — hide EVERYTHING except background + water ──
      const style = m.getStyle()
      ;(style?.layers || []).forEach((l: any) => {
        const id = l.id.toLowerCase()
        const type = l.type
        // Keep background layer (we'll restyle it)
        if (type === 'background') return
        // Keep water layers (we'll restyle them)
        if (id.includes('water') || id.includes('ocean')) return
        // Hide everything else — land, roads, labels, buildings, ALL of it
        try { m.setLayoutProperty(l.id, 'visibility', 'none') } catch {}
      })

      // ── 2. STYLE WATER — dark blue ocean ──
      try {
        const bgLayer = (style?.layers || []).find((l: any) => l.type === 'background')
        if (bgLayer) m.setPaintProperty(bgLayer.id, 'background-color', '#101828')
      } catch {}
      ;(style?.layers || []).forEach((l: any) => {
        if (l.type === 'fill' && l.id.toLowerCase().includes('water')) {
          try { m.setPaintProperty(l.id, 'fill-color', '#0c1322') } catch {}
        }
      })

      // ── 3. ADD STATES GEOJSON & COLOR ALL STATES ──
      const GEOJSON_URL = '/data/world_states.geojson'

      // Fetch GeoJSON to build complete color map for ALL states
      fetch(GEOJSON_URL)
        .then(r => r.json())
        .then((geojson: any) => {
          m.addSource('xwar-states', { 
            type: 'geojson', 
            data: geojson,
            tolerance: 1.2, // Aggressive simplification (removes millions of tiny vertices)
            buffer: 0,      // Removes off-tile overlapping rendering overhead
            generateId: true // Helps maplibre track features faster
          })

          // Inject Ocean Blocks as GeoJSON Features
          const oceanFeatures = Object.entries(OCEAN_POLYGONS).map(([name, coords]) => ({
            type: 'Feature',
            properties: { name, adm0_a3: 'OCE', isOcean: true },
            geometry: { type: 'Polygon', coordinates: coords }
          }))
          geojson.features.push(...oceanFeatures)

          // ── Compute true country centroids dynamically from state polygons ──
          const countryData = new Map<string, { sumLng: number, sumLat: number, count: number, minL: number, maxL: number, minT: number, maxT: number }>()
          ;(geojson.features || []).forEach((feat: any) => {
            const iso3 = feat.properties?.['adm0_a3']
            if (!iso3 || iso3 === 'OCE' || iso3 === '-99') return
            if (!countryData.has(iso3)) countryData.set(iso3, { sumLng: 0, sumLat: 0, count: 0, minL: 180, maxL: -180, minT: 90, maxT: -90 })
            const s = countryData.get(iso3)!
            
            let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90
            let hasCoords = false
            const walk = (coords: any) => {
              if (typeof coords[0] === 'number') {
                 if (coords[0] < minLng) minLng = coords[0]; if (coords[0] > maxLng) maxLng = coords[0]
                 if (coords[1] < minLat) minLat = coords[1]; if (coords[1] > maxLat) maxLat = coords[1]
                 hasCoords = true
              } else coords.forEach(walk)
            }
            if (feat.geometry?.coordinates) walk(feat.geometry.coordinates)
            // Fix wrap-arounds and bounds filtering for scattered islands/colonies
            if (hasCoords && minLng < maxLng && minLat < maxLat) {
               if (iso3 === 'RUS' && minLng < 0) return // Ignore Russian far east crossing dateline for centroid
               if (iso3 === 'USA' && (minLng < -130 || minLat > 50)) return // Ignore Alaska/Hawaii for center
               if (iso3 === 'FRA' && (minLng < -10 || minLng > 20)) return // Ignore French Guiana/islands
               s.sumLng += (minLng + maxLng) / 2
               s.sumLat += (minLat + maxLat) / 2
               s.count++
               if (minLng < s.minL) s.minL = minLng
               if (maxLng > s.maxL) s.maxL = maxLng
               if (minLat < s.minT) s.minT = minLat
               if (maxLat > s.maxT) s.maxT = maxLat
            }
          })

          // ── PRE-CALCULATE WAR AND PLAYER STATES FOR MARKERS ──
          const playerCountry = countries.find(c => c.controller === 'Player Alliance')
          const playerISO = playerCountry ? COUNTRY_ISO[playerCountry.name] : null
          const playerEmpire = playerCountry?.empire

          const wars = useWorldStore.getState().wars
          const enemyISOs = new Set<string>()
          wars.forEach(w => {
            if (w.status !== 'active') return
            if (w.attacker === (playerCountry?.code || 'US')) enemyISOs.add(w.defender)
            if (w.defender === (playerCountry?.code || 'US')) enemyISOs.add(w.attacker)
          })

          // ── HTML MARKERS FOR COUNTRIES (flag-icons + Text + Assets) ──
          const currentMarkers: maplibregl.Marker[] = []
          countries.forEach(c => {
            const iso3 = COUNTRY_ISO[c.name]
            if (!iso3) return
            
            let center = COUNTRY_CENTROIDS[c.name]
            let area = 0
            
            if (countryData.has(iso3)) {
               const s = countryData.get(iso3)!
               if (s.count > 0 && !center) center = [s.sumLng / s.count, s.sumLat / s.count]
               area = (s.maxL - s.minL) * (s.maxT - s.minT)
            }
            if (!center) return

            let sizeClass = 'tiny'
            if (area > 300) sizeClass = 'giant'
            else if (area > 50) sizeClass = 'large'
            else if (area > 15) sizeClass = 'medium'
            else if (area > 3) sizeClass = 'small'

            const isEnemy = enemyISOs.has(c.code)
            const isPlayer = playerCountry?.code === c.code

            const el = document.createElement('div')
            el.className = `country-marker marker-${sizeClass}`
            if (isEnemy) el.classList.add('country-marker--enemy')
            


            const flag = document.createElement('span')
            flag.className = `fi fi-${c.code.toLowerCase()} country-marker__flag`
            
            const txt = document.createElement('span')
            txt.className = 'country-marker__text'
            txt.innerText = c.name

            el.appendChild(flag)
            el.appendChild(txt)

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat(center)
              .addTo(m)
            currentMarkers.push(marker)
          })

          // Build game country color map
          const gameColors: Record<string, string> = {}
          const controlledISOs: string[] = []
          countries.forEach(c => {
            const iso = COUNTRY_ISO[c.name]
            if (iso) { gameColors[iso] = c.color; controlledISOs.push(iso) }
          })
          gameColors['OCE'] = '#0077be' // Base oceanic color

          // Generate unique hex color for every country/state
          const colorExpr: any[] = ['match', ['get', 'adm0_a3']]
          const seenISOs = new Set<string>()
          let hueIndex = 0
          const goldenAngle = 137.508

          ;(geojson.features || []).forEach((feat: any) => {
            const iso3 = feat.properties?.['adm0_a3']
            if (!iso3 || iso3 === '-99' || seenISOs.has(iso3)) return
            seenISOs.add(iso3)

            if (gameColors[iso3]) {
              colorExpr.push(iso3, gameColors[iso3])
            } else {
              const hue = (hueIndex * goldenAngle) % 360
              const sat = 45 + (hueIndex % 4) * 10  // 45-75%
              const lit = 40 + (hueIndex % 5) * 5   // 40-60%
              colorExpr.push(iso3, hslToHex(hue, sat, lit))
              hueIndex++
            }
          })
          colorExpr.push('#384860') // fallback

          // ── 3.5 ADD OCEAN FILL LAYER FIRST (UNDERNEATH LAND) ──
          m.addLayer({
            id: 'xwar-ocean-fill',
            type: 'fill',
            source: 'xwar-states',
            filter: ['==', ['get', 'isOcean'], true],
            paint: {
              'fill-color': 'rgba(10, 40, 80, 0.4)', // dark water tint
              'fill-opacity': 0.8,
            },
          })

          // ── 4. TERRITORY FILL — LAND STATES ONLY ──
          m.addLayer({
            id: 'xwar-state-fill',
            type: 'fill',
            source: 'xwar-states',
            filter: ['!=', ['get', 'isOcean'], true], // exclude oceans
            paint: {
              'fill-color': seenISOs.size > 0 ? (colorExpr as any) : '#384860',
              'fill-opacity': [
                'case',
                ['in', ['get', 'adm0_a3'], ['literal', controlledISOs]],
                0.9,
                0.7
              ],
            },
          })

          // ── 5. STATE BORDERS — ALL states get black borders ──
          m.addLayer({
            id: 'xwar-state-border',
            type: 'line',
            source: 'xwar-states',
            paint: {
              'line-color': '#000000',
              'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 3, 1, 6, 2],
            },
          })

          // (Carto Vector tile boundaries were extremely slow. We now strictly use the GeoJSON boundaries.)

          // ── STATE NAMES FROM GEOJSON (Real Game States) ──
          m.addLayer({
            id: 'xwar-state-names',
            type: 'symbol',
            source: 'xwar-states',
            filter: ['!=', ['get', 'isOcean'], true],
            minzoom: 3.5, // appear as user zooms in
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 3.5, 9, 6, 14, 8, 18],
              'text-transform': 'uppercase',
              'text-letter-spacing': 0.1,
              'text-max-width': 8,
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': 'rgba(240, 245, 255, 0.9)',
              'text-halo-color': 'rgba(0, 0, 0, 0.85)',
              'text-halo-width': 1.5,
            },
          })

          // ── 7. HOVER HIGHLIGHT ──
          m.addLayer({
            id: 'xwar-state-hover',
            type: 'fill',
            source: 'xwar-states',
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0 },
            filter: ['==', ['get', 'name'], ''],
          })
          
          m.addLayer({
            id: 'xwar-state-hover-border',
            type: 'line',
            source: 'xwar-states',
            paint: { 'line-color': '#eab308', 'line-width': 2, 'line-opacity': 0 },
            filter: ['==', ['get', 'name'], ''],
          })

          // ── 8. PLAYER & ALLY TERRITORY GLOW ──
          // Find ally ISOs (same empire as player)
          const allyISOs = countries
            .filter(c => c.empire === playerEmpire && c.controller !== 'Player Alliance')
            .map(c => COUNTRY_ISO[c.name])
            .filter(Boolean) as string[]

          // Controlled Ocean Regions (Player/Ally)
          const allRegions = useRegionStore.getState().regions
          const playerOceans = allRegions.filter(r => r.isOcean && r.controlledBy === playerISO).map(r => r.name)
          const allyOceans = allRegions.filter(r => r.isOcean && allyISOs.includes(r.controlledBy)).map(r => r.name)

          // Player territory — bright green glow
          if (playerISO) {
            m.addLayer({
              id: 'xwar-player-glow',
              type: 'line',
              source: 'xwar-states',
              filter: [
                'any',
                ['==', ['get', 'adm0_a3'], playerISO],
                ['in', ['get', 'name'], ['literal', playerOceans]]
              ],
              paint: {
                'line-color': '#22d38a',
                'line-width': 3,
                'line-opacity': 0.6,
                'line-blur': 4,
              },
            })
            // Player territory bright tint overlay
            m.addLayer({
              id: 'xwar-player-tint',
              type: 'fill',
              source: 'xwar-states',
              filter: [
                'any',
                ['==', ['get', 'adm0_a3'], playerISO],
                ['in', ['get', 'name'], ['literal', playerOceans]]
              ],
              paint: {
                'fill-color': '#22d38a',
                'fill-opacity': 0.08,
              },
            })
          }

          // Ally territories — subtle blue glow
          if (allyISOs.length > 0) {
            m.addLayer({
              id: 'xwar-ally-glow',
              type: 'line',
              source: 'xwar-states',
              filter: [
                'any',
                ['in', ['get', 'adm0_a3'], ['literal', allyISOs]],
                ['in', ['get', 'name'], ['literal', allyOceans]]
              ],
              paint: {
                'line-color': '#60a5fa',
                'line-width': 2.5,
                'line-opacity': 0.35,
                'line-blur': 4,
              },
            })
          }

          // ── 9. ACTIVE WAR — ENEMY TERRITORY INDICATORS ──
          // Convert 2-letter codes to 3-letter ISOs for GeoJSON matching
          const ISO2_TO_ISO3: Record<string, string> = {}
          countries.forEach(c => {
            const iso3 = COUNTRY_ISO[c.name]
            if (iso3) ISO2_TO_ISO3[c.code] = iso3
          })
          const enemyISO3s = [...enemyISOs].map(iso2 => ISO2_TO_ISO3[iso2]).filter(Boolean)

          if (enemyISO3s.length > 0) {
            // Red danger tint on enemy territory
            m.addLayer({
              id: 'xwar-enemy-tint',
              type: 'fill',
              source: 'xwar-states',
              filter: ['in', ['get', 'adm0_a3'], ['literal', enemyISO3s]],
              paint: {
                'fill-color': '#ef4444',
                'fill-opacity': 0.12,
              },
            })
            // Pulsing red war border on enemy countries
            m.addLayer({
              id: 'xwar-enemy-border',
              type: 'line',
              source: 'xwar-states',
              filter: ['in', ['get', 'adm0_a3'], ['literal', enemyISO3s]],
              paint: {
                'line-color': '#ef4444',
                'line-width': 2,
                'line-opacity': 0.7,
                'line-dasharray': [3, 2],
              },
            })
          }

          // ── 9.5 DEPOSIT MARKERS — colored dots on regions with active deposits ──
          const activeDeposits = useWorldStore.getState().deposits.filter(d => d.active)
          if (activeDeposits.length > 0) {
            const DEPOSIT_COLORS: Record<string, string> = {
              wheat: '#facc15', fish: '#38bdf8', steak: '#f87171', oil: '#a855f7', materialx: '#ec4899'
            }
            const DEPOSIT_ICONS: Record<string, string> = {
              wheat: '🌾', fish: '🐟', steak: '🥩', oil: '🛢️', materialx: '⚛️'
            }
            const depositFeatures = activeDeposits.map(dep => {
              const region = allRegions.find(r => r.id === dep.regionId)
              if (!region) return null
              return {
                type: 'Feature' as const,
                properties: {
                  depositType: dep.type,
                  bonus: dep.bonus,
                  color: DEPOSIT_COLORS[dep.type] || '#facc15',
                  icon: DEPOSIT_ICONS[dep.type] || '⛏️',
                  label: `${DEPOSIT_ICONS[dep.type] || '⛏️'} ${dep.type.toUpperCase()} +${dep.bonus}%`,
                },
                geometry: {
                  type: 'Point' as const,
                  coordinates: region.position,
                }
              }
            }).filter(Boolean)

            if (depositFeatures.length > 0) {
              m.addSource('xwar-deposits', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: depositFeatures as any[] }
              })

              // Glow ring
              m.addLayer({
                id: 'xwar-deposit-glow',
                type: 'circle',
                source: 'xwar-deposits',
                paint: {
                  'circle-radius': 18,
                  'circle-color': ['get', 'color'],
                  'circle-opacity': 0.15,
                  'circle-blur': 1,
                },
              })

              // Main dot
              m.addLayer({
                id: 'xwar-deposit-markers',
                type: 'circle',
                source: 'xwar-deposits',
                paint: {
                  'circle-radius': 8,
                  'circle-color': ['get', 'color'],
                  'circle-opacity': 0.9,
                  'circle-stroke-color': '#000000',
                  'circle-stroke-width': 1.5,
                },
              })

              // Label
              m.addLayer({
                id: 'xwar-deposit-labels',
                type: 'symbol',
                source: 'xwar-deposits',
                minzoom: 3,
                layout: {
                  'text-field': ['get', 'label'],
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-size': 11,
                  'text-offset': [0, 1.8],
                  'text-allow-overlap': true,
                },
                paint: {
                  'text-color': ['get', 'color'],
                  'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                  'text-halo-width': 1.5,
                },
              })
            }
          }

          // ── 9.6 DEBRIS MARKERS ──
          const debrisFeatures = allRegions.filter(r => r.debris.scrap > 0 || r.debris.materialX > 0 || r.debris.militaryBoxes > 0).map(r => ({
            type: 'Feature' as const,
            properties: { color: '#9ca3af', label: '⚙️ DEBRIS' },
            geometry: { type: 'Point' as const, coordinates: r.position }
          }))
          
          m.addSource('xwar-debris', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: debrisFeatures as any[] }
          })

          m.addLayer({
            id: 'xwar-debris-glow',
            type: 'circle',
            source: 'xwar-debris',
            paint: {
              'circle-radius': 15,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.2,
              'circle-blur': 1,
            },
          })

          m.addLayer({
            id: 'xwar-debris-markers',
            type: 'circle',
            source: 'xwar-debris',
            paint: {
              'circle-radius': 6,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.9,
              'circle-stroke-color': '#000000',
              'circle-stroke-width': 1.5,
            },
          })

          m.addLayer({
            id: 'xwar-debris-labels',
            type: 'symbol',
            source: 'xwar-debris',
            minzoom: 3,
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 10,
              'text-offset': [0, 1.8],
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': ['get', 'color'],
              'text-halo-color': 'rgba(0, 0, 0, 0.9)',
              'text-halo-width': 1.5,
            },
          })

          // ── 9.7 LEY LINE CORRIDORS ──
          const leyLineFeatures: any[] = []
          const leyLineNodeFeatures: any[] = []

          LEY_LINE_DEFS.forEach(line => {
            const meta = ARCHETYPE_META[line.archetype]
            // Collect region positions for the corridor LineString
            const coords: number[][] = []
            line.blocks.forEach(blockId => {
              const region = allRegions.find(r => r.id === blockId)
              if (region) coords.push(region.position)
            })
            if (coords.length < 2) return

            // Check activation status
            const lineStatus = useLeyLineStore.getState().getAllLineStatus()
            const status = lineStatus.find(s => s.def.id === line.id)
            const isActive = status?.active ?? false
            const completion = status?.completion ?? 0

            leyLineFeatures.push({
              type: 'Feature',
              properties: {
                id: line.id,
                name: line.name,
                archetype: line.archetype,
                color: meta.color,
                active: isActive,
                completion: completion,
              },
              geometry: { type: 'LineString', coordinates: coords },
            })

            // Node dots at each block region
            coords.forEach((coord, i) => {
              leyLineNodeFeatures.push({
                type: 'Feature',
                properties: {
                  lineId: line.id,
                  color: meta.color,
                  active: isActive,
                  blockId: line.blocks[i],
                },
                geometry: { type: 'Point', coordinates: coord },
              })
            })
          })

          if (leyLineFeatures.length > 0) {
            m.addSource('xwar-leylines', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: leyLineFeatures },
            })
            m.addSource('xwar-leyline-nodes', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: leyLineNodeFeatures },
            })

            // Glow layer (wide, blurred)
            m.addLayer({
              id: 'xwar-leyline-glow',
              type: 'line',
              source: 'xwar-leylines',
              paint: {
                'line-color': ['get', 'color'],
                'line-width': [
                  'case',
                  ['==', ['get', 'active'], true], 8,
                  4,
                ],
                'line-opacity': [
                  'case',
                  ['==', ['get', 'active'], true], 0.35,
                  0.10,
                ],
                'line-blur': 6,
              },
            })

            // Core line — ACTIVE (solid)
            m.addLayer({
              id: 'xwar-leyline-core-active',
              type: 'line',
              source: 'xwar-leylines',
              filter: ['==', ['get', 'active'], true],
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 2.5,
                'line-opacity': 0.85,
              },
            })

            // Core line — INACTIVE (dashed)
            m.addLayer({
              id: 'xwar-leyline-core-inactive',
              type: 'line',
              source: 'xwar-leylines',
              filter: ['!=', ['get', 'active'], true],
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 1.5,
                'line-opacity': 0.30,
                'line-dasharray': [4, 4],
              },
            })

            // Node dots
            m.addLayer({
              id: 'xwar-leyline-nodes',
              type: 'circle',
              source: 'xwar-leyline-nodes',
              minzoom: 2.5,
              paint: {
                'circle-radius': [
                  'case',
                  ['==', ['get', 'active'], true], 5,
                  3.5,
                ],
                'circle-color': ['get', 'color'],
                'circle-opacity': [
                  'case',
                  ['==', ['get', 'active'], true], 0.9,
                  0.4,
                ],
                'circle-stroke-color': '#000000',
                'circle-stroke-width': 1,
              },
            })

            // Ley Line name labels (visible at zoom 3+)
            m.addLayer({
              id: 'xwar-leyline-labels',
              type: 'symbol',
              source: 'xwar-leylines',
              minzoom: 3,
              layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'symbol-placement': 'line-center',
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': ['get', 'color'],
                'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                'text-halo-width': 1.5,
              },
            })
          }
          let hoveredStateName: string | null = null
          let hoverRaf: number | null = null

          const handleHoverMove = (e: any) => {
            if (!e.features || e.features.length === 0) return
            const stateName = e.features[0].properties?.['name']
            if (!stateName || stateName === hoveredStateName) return
            hoveredStateName = stateName
            if (hoverRaf) cancelAnimationFrame(hoverRaf)
            hoverRaf = requestAnimationFrame(() => {
              m.setFilter('xwar-state-hover', ['==', ['get', 'name'], stateName])
              m.setPaintProperty('xwar-state-hover', 'fill-opacity', 0.15)
              m.setFilter('xwar-state-hover-border', ['==', ['get', 'name'], stateName])
              m.setPaintProperty('xwar-state-hover-border', 'line-opacity', 1)
              m.getCanvas().style.cursor = 'pointer'
            })
          }

          const handleHoverLeave = () => {
            hoveredStateName = null
            if (hoverRaf) cancelAnimationFrame(hoverRaf)
            m.setFilter('xwar-state-hover', ['==', ['get', 'name'], ''])
            m.setPaintProperty('xwar-state-hover', 'fill-opacity', 0)
            m.setFilter('xwar-state-hover-border', ['==', ['get', 'name'], ''])
            m.setPaintProperty('xwar-state-hover-border', 'line-opacity', 0)
            m.getCanvas().style.cursor = 'crosshair'
          }

          m.on('mousemove', 'xwar-state-fill', handleHoverMove)
          m.on('mouseleave', 'xwar-state-fill', handleHoverLeave)
          m.on('mousemove', 'xwar-ocean-fill', handleHoverMove)
          m.on('mouseleave', 'xwar-ocean-fill', handleHoverLeave)

          const handleClick = (e: any) => {
            if (e.features && e.features.length > 0) {
              const props = e.features[0].properties
              const iso3 = props?.['adm0_a3']
              const isOcean = props?.['isOcean']
              
              if (isOcean) {
                // For oceans, directly use the region name to find the exact ocean block
                const oceanRegion = useRegionStore.getState().regions.find(r => r.name === props.name)
                if (oceanRegion && onRegionClickRef.current) {
                  onRegionClickRef.current(oceanRegion)
                }
              } else {
                const countryName = iso3 ? ISO3_TO_NAME[iso3] : null
                if (countryName) {
                  const country = countriesRef.current.find(c => c.name === countryName)
                  if (country) {
                     const lngLat = e.lngLat
                     handleRegionClick(country.code, [lngLat.lng, lngLat.lat])
                  }
                }
              }
            }
          }
          m.on('click', 'xwar-state-fill', handleClick)
          m.on('click', 'xwar-ocean-fill', handleClick)

          // Double click maps to double click ref
          const handleDoubleClick = (e: any) => {
            if (e.features && e.features.length > 0) {
              const props = e.features[0].properties
              const iso3 = props?.['adm0_a3']
              const isOcean = props?.['isOcean']
              
              if (isOcean) {
                const oceanRegion = useRegionStore.getState().regions.find(r => r.name === props.name)
                if (oceanRegion && onRegionDoubleClickRef.current) {
                  onRegionDoubleClickRef.current(oceanRegion)
                }
              } else {
                const countryName = iso3 ? ISO3_TO_NAME[iso3] : null
                if (countryName) {
                  const country = countriesRef.current.find(c => c.name === countryName)
                  if (country) {
                     const lngLat = e.lngLat
                     const { regions } = useRegionStore.getState()
                     const countryRegions = regions.filter(r => r.countryCode === country.code)
                     if (countryRegions.length > 0) {
                       let closestRegion = countryRegions[0]
                       let minDst = Infinity
                       countryRegions.forEach(r => {
                         const dx = r.position[0] - lngLat.lng
                         const dy = r.position[1] - lngLat.lat
                         const dst = dx*dx + dy*dy
                         if (dst < minDst) { minDst = dst; closestRegion = r; }
                       })
                       if (onRegionDoubleClickRef.current) {
                         onRegionDoubleClickRef.current(closestRegion)
                       }
                     }
                  }
                }
              }
            }
          }
          m.on('dblclick', 'xwar-state-fill', handleDoubleClick)
          m.on('dblclick', 'xwar-ocean-fill', handleDoubleClick)

          // Refine region positions
          useRegionStore.getState().updateBoundsFromGeoJSON(geojson, 'adm0_a3')

          // ── OCEAN BASE LAYER (real ocean shapes from oceans.geojson) ──
          fetch('/data/oceans.geojson')
            .then(r => r.json())
            .then((oceansGeoJson: any) => {
              m.addSource('xwar-ocean-base', {
                type: 'geojson',
                data: oceansGeoJson,
                tolerance: 1.5,
              })

              // Insert this layer BELOW the state fill so the ocean shapes
              // provide a rich water background under the land polygons
              m.addLayer({
                id: 'xwar-ocean-base-fill',
                type: 'fill',
                source: 'xwar-ocean-base',
                paint: {
                  'fill-color': '#0a1e3d',
                  'fill-opacity': 0.55,
                },
              }, 'xwar-ocean-fill')  // insert before the strategic ocean blocks

              // Subtle ocean outline for definition
              m.addLayer({
                id: 'xwar-ocean-base-border',
                type: 'line',
                source: 'xwar-ocean-base',
                paint: {
                  'line-color': '#1a3a5c',
                  'line-width': 0.5,
                  'line-opacity': 0.4,
                },
              }, 'xwar-ocean-fill')
            })
            .catch((err: any) => console.warn('Could not load oceans.geojson:', err))

          // ── TRADE ROUTES: 13 major maritime lanes ──
          useTradeRouteStore.getState().loadRoutes().then(() => {
            const tradeStore = useTradeRouteStore.getState()
            if (!tradeStore.geojson || !m) return

            m.addSource('xwar-trade-routes', {
              type: 'geojson',
              data: tradeStore.geojson,
            })

            // Glow layer (wider, blurred)
            m.addLayer({
              id: 'xwar-trade-routes-glow',
              type: 'line',
              source: 'xwar-trade-routes',
              paint: {
                'line-color': '#00e5ff',
                'line-width': 5,
                'line-opacity': 0.20,
                'line-blur': 4,
              },
            })

            // Core dashed line
            m.addLayer({
              id: 'xwar-trade-routes-line',
              type: 'line',
              source: 'xwar-trade-routes',
              paint: {
                'line-color': '#00e5ff',
                'line-width': 2,
                'line-opacity': 0.75,
                'line-dasharray': [4, 3],
              },
            })

            // Endpoint markers (from + to for all routes)
            const endpointFeatures: any[] = []
            tradeStore.routes.forEach(r => {
              endpointFeatures.push(
                { type: 'Feature', properties: { label: r.from, routeId: r.id }, geometry: { type: 'Point', coordinates: r.fromCoords } },
                { type: 'Feature', properties: { label: r.to, routeId: r.id }, geometry: { type: 'Point', coordinates: r.toCoords } },
              )
            })

            m.addSource('xwar-trade-route-endpoints', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: endpointFeatures },
            })
            m.addLayer({
              id: 'xwar-trade-route-dots',
              type: 'circle',
              source: 'xwar-trade-route-endpoints',
              paint: {
                'circle-radius': 4,
                'circle-color': '#00e5ff',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
              },
            })
            m.addLayer({
              id: 'xwar-trade-route-labels',
              type: 'symbol',
              source: 'xwar-trade-route-endpoints',
              minzoom: 3,
              layout: {
                'text-field': ['get', 'label'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-offset': [0, 1.4],
                'text-anchor': 'top',
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': '#00e5ff',
                'text-halo-color': 'rgba(0,0,0,0.85)',
                'text-halo-width': 1.5,
              },
            })

            // ── Click handler: show route popup ──
            m.on('click', 'xwar-trade-routes-line', (e: any) => {
              if (!e.features || e.features.length === 0) return
              const props = e.features[0].properties
              const routeId = props?.id
              if (!routeId) return

              const store = useTradeRouteStore.getState()
              const route = store.routes.find(r => r.id === routeId)
              if (!route) return

              store.selectRoute(routeId)

              const active = store.isRouteActive(route)
              const statusIcon = active ? '✅' : '❌'
              const statusText = active ? 'ACTIVE' : 'INACTIVE'
              const statusColor = active ? '#22d38a' : '#ef4444'

              // Build resource list HTML
              const resources: string[] = []
              if (route.oil > 0) resources.push(`🛢️ Oil: <b>${route.oil}</b>/hr`)
              if (route.fish > 0) resources.push(`🐟 Fish: <b>${route.fish}</b>/hr`)
              if (route.tradedGoods > 0) resources.push(`📦 Goods: <b>$${route.tradedGoods.toLocaleString()}</b>/hr`)

              const html = `
                <div style="font-family:'Orbitron',sans-serif;background:rgba(10,15,30,0.95);border:1px solid #00e5ff33;border-radius:8px;padding:12px 16px;min-width:220px;">
                  <div style="font-size:13px;font-weight:700;color:#00e5ff;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">
                    ⚓ ${route.name}
                  </div>
                  <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">
                    ${route.from} → ${route.to}<br/>
                    <span style="color:#64748b;">${route.lengthNm.toLocaleString()} nm</span>
                  </div>
                  <div style="font-size:11px;color:#e2e8f0;margin-bottom:8px;line-height:1.6;">
                    ${resources.join('<br/>')}
                  </div>
                  <div style="font-size:12px;font-weight:700;color:${statusColor};">
                    ${statusIcon} ${statusText}
                  </div>
                </div>
              `

              new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: 'trade-route-popup' })
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(m)
            })

            // Cursor change on hover
            m.on('mouseenter', 'xwar-trade-routes-line', () => { m.getCanvas().style.cursor = 'pointer' })
            m.on('mouseleave', 'xwar-trade-routes-line', () => { m.getCanvas().style.cursor = 'crosshair' })

            console.log(`✅ Trade routes rendered: ${tradeStore.routes.length} routes`)
          })

          setMapLoaded(true)
        })
        .catch(() => { setMapLoaded(true) })


      m.getCanvas().style.cursor = 'crosshair'
      if (mapContainer.current) {
        mapContainer.current.setAttribute('data-zoom', Math.floor(DEFAULT_ZOOM).toString())
      }
    })

    // Watch zoom changes to fade out country markers manually via CSS class
    m.on('zoom', () => {
      if (!mapContainer.current) return
      const z = m.getZoom()
      mapContainer.current.setAttribute('data-zoom', Math.floor(z).toString())
      if (z > 4.5) {
        mapContainer.current.classList.add('zoomed-in')
      } else {
        mapContainer.current.classList.remove('zoomed-in')
      }
    })

    // Coordinate tracking — throttled to ~100 ms to cut CPU overhead
    let coordThrottle: ReturnType<typeof setTimeout> | null = null
    m.on('mousemove', (e) => {
      if (!onMouseMove || coordThrottle) return
      coordThrottle = setTimeout(() => { coordThrottle = null }, 100)
      const { lat, lng } = e.lngLat
      onMouseMove(
        `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`,
        `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`
      )
    })

    map.current = m

    // ── Reactive deposit layer: update GeoJSON when deposits change ──
    const DEPOSIT_COLORS_RX: Record<string, string> = {
      wheat: '#facc15', fish: '#38bdf8', steak: '#f87171', oil: '#a855f7', materialx: '#ec4899'
    }
    const DEPOSIT_ICONS_RX: Record<string, string> = {
      wheat: '🌾', fish: '🐟', steak: '🥩', oil: '🛢️', materialx: '⚛️'
    }
    let prevDeposits = useWorldStore.getState().deposits
    const unsubDeposits = useWorldStore.subscribe((state) => {
      if (state.deposits === prevDeposits) return
      prevDeposits = state.deposits
      if (!map.current) return
      const src = map.current.getSource('xwar-deposits') as any
      if (!src) return
      const allRegions = useRegionStore.getState().regions
      const features = state.deposits
        .filter(d => d.active)
        .map(dep => {
          const region = allRegions.find(r => r.id === dep.regionId)
          if (!region) return null
          return {
            type: 'Feature' as const,
            properties: {
              depositType: dep.type,
              bonus: dep.bonus,
              color: DEPOSIT_COLORS_RX[dep.type] || '#facc15',
              icon: DEPOSIT_ICONS_RX[dep.type] || '⛏️',
              label: `${DEPOSIT_ICONS_RX[dep.type] || '⛏️'} ${dep.type.toUpperCase()} +${dep.bonus}%`,
            },
            geometry: { type: 'Point' as const, coordinates: region.position },
          }
        })
        .filter(Boolean)
      src.setData({ type: 'FeatureCollection', features })
    })

    // ── Reactive debris layer ──
    let prevRegionsForDebris = useRegionStore.getState().regions
    const unsubDebris = useRegionStore.subscribe((state) => {
      if (state.regions === prevRegionsForDebris) return
      prevRegionsForDebris = state.regions
      if (!map.current) return
      const srcDebris = map.current.getSource('xwar-debris') as any
      if (!srcDebris) return
      const featuresDebris = state.regions
        .filter(r => r.debris.scrap > 0 || r.debris.materialX > 0 || r.debris.militaryBoxes > 0)
        .map(r => ({
          type: 'Feature' as const,
          properties: { color: '#9ca3af', label: '⚙️ DEBRIS' },
          geometry: { type: 'Point' as const, coordinates: r.position },
        }))
      srcDebris.setData({ type: 'FeatureCollection', features: featuresDebris })
    })

    // Force resize once after layout settles (single timeout is enough)
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize()
    })
    resizeObserver.observe(mapContainer.current)

    setTimeout(() => { map.current?.resize() }, 150)

    return () => {
      unsubDeposits()
      unsubDebris()
      resizeObserver.disconnect()
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={mapContainer} className="game-map-instance">
      {!mapLoaded && (
        <div className="map-loading">
          <div className="map-loading__spinner" />
          <span className="map-loading__text">INITIALIZING MAP...</span>
        </div>
      )}
    </div>
  )
})

GameMap.displayName = 'GameMap'
export default GameMap
