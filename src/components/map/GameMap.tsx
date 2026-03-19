import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import maplibregl from 'maplibre-gl'
import type { Country } from '../../stores/worldStore'
import { useWorldStore } from '../../stores/worldStore'
import type { Region } from '../../stores/regionStore'
import { useRegionStore } from '../../stores/regionStore'

interface GameMapProps {
  countries: Country[]
  onRegionClick?: (region: Region) => void
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

const DEFAULT_CENTER: [number, number] = [20, 25]
const DEFAULT_ZOOM = 2.0

const GameMap = forwardRef<GameMapHandle, GameMapProps>(({ countries, onRegionClick, onMouseMove }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Store callbacks in refs so marker event listeners always have the latest version
  const onRegionClickRef = useRef(onRegionClick)
  onRegionClickRef.current = onRegionClick
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
      doubleClickZoom: false, // prevent double-click zoom to avoid conflicts with marker clicks
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
          m.addSource('xwar-states', { type: 'geojson', data: geojson })

          // Build game country color map
          const gameColors: Record<string, string> = {}
          const controlledISOs: string[] = []
          countries.forEach(c => {
            const iso = COUNTRY_ISO[c.name]
            if (iso) { gameColors[iso] = c.color; controlledISOs.push(iso) }
          })

          // HSL to hex converter
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

          // ── 4. TERRITORY FILL — ALL STATES COLORED ──
          m.addLayer({
            id: 'xwar-state-fill',
            type: 'fill',
            source: 'xwar-states',
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

          // ── 6. STATE/PROVINCE BORDERS & LABELS ──
          try {
            const vtSource = Object.keys(style?.sources || {}).find(s => {
              const src = style?.sources?.[s] as any
              return src?.type === 'vector'
            })
            if (vtSource) {
              // State/province border lines (admin_level 3-4)
              m.addLayer({
                id: 'xwar-admin1-borders',
                type: 'line',
                source: vtSource,
                'source-layer': 'boundary',
                filter: ['all', ['>=', 'admin_level', 3], ['<=', 'admin_level', 4]],
                paint: {
                  'line-color': 'rgba(0, 0, 0, 0.55)',
                  'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.3, 4, 0.8, 6, 1.2, 8, 1.8],
                },
              })

              // County/district borders (admin_level 5-6) — visible at higher zoom
              m.addLayer({
                id: 'xwar-admin2-borders',
                type: 'line',
                source: vtSource,
                'source-layer': 'boundary',
                filter: ['all', ['>=', 'admin_level', 5], ['<=', 'admin_level', 6]],
                paint: {
                  'line-color': 'rgba(0, 0, 0, 0.3)',
                  'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.1, 6, 0.3, 8, 0.6],
                },
                minzoom: 5,
              })

              // State/province name labels (English)
              m.addLayer({
                id: 'xwar-state-labels',
                type: 'symbol',
                source: vtSource,
                'source-layer': 'place',
                filter: ['in', 'class', 'state', 'province'],
                layout: {
                  'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 6, 12, 8, 15],
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-transform': 'uppercase',
                  'text-letter-spacing': 0.08,
                  'text-max-width': 8,
                  'text-allow-overlap': false,
                  'text-padding': 6,
                },
                paint: {
                  'text-color': 'rgba(230, 240, 250, 0.7)',
                  'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                  'text-halo-width': 1.5,
                },
                minzoom: 7,
              })

              // City labels at higher zoom (English)
              m.addLayer({
                id: 'xwar-city-labels',
                type: 'symbol',
                source: vtSource,
                'source-layer': 'place',
                filter: ['in', 'class', 'city', 'town'],
                layout: {
                  'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 6, 8, 8, 11, 10, 14],
                  'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                  'text-max-width': 8,
                  'text-allow-overlap': false,
                  'text-padding': 3,
                },
                paint: {
                  'text-color': 'rgba(200, 210, 225, 0.55)',
                  'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                  'text-halo-width': 1,
                },
                minzoom: 6,
              })

              // Country name labels (English, large)
              m.addLayer({
                id: 'xwar-country-labels',
                type: 'symbol',
                source: vtSource,
                'source-layer': 'place',
                filter: ['==', 'class', 'country'],
                layout: {
                  'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']],
                  'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 3, 14, 5, 18],
                  'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                  'text-transform': 'uppercase',
                  'text-letter-spacing': 0.2,
                  'text-max-width': 10,
                  'text-allow-overlap': false,
                  'text-padding': 10,
                },
                paint: {
                  'text-color': 'rgba(255, 255, 255, 0.7)',
                  'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                  'text-halo-width': 2.5,
                },
              })
            }
          } catch {}

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
          // Find player country ISO
          const playerCountry = countries.find(c => c.controller === 'Player Alliance')
          const playerISO = playerCountry ? COUNTRY_ISO[playerCountry.name] : null

          // Find ally ISOs (same empire as player)
          const playerEmpire = playerCountry?.empire
          const allyISOs = countries
            .filter(c => c.empire === playerEmpire && c.controller !== 'Player Alliance')
            .map(c => COUNTRY_ISO[c.name])
            .filter(Boolean) as string[]

          // Player territory — bright green glow
          if (playerISO) {
            m.addLayer({
              id: 'xwar-player-glow',
              type: 'line',
              source: 'xwar-states',
              filter: ['==', ['get', 'adm0_a3'], playerISO],
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
              filter: ['==', ['get', 'adm0_a3'], playerISO],
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
              filter: ['in', ['get', 'adm0_a3'], ['literal', allyISOs]],
              paint: {
                'line-color': '#60a5fa',
                'line-width': 2.5,
                'line-opacity': 0.35,
                'line-blur': 4,
              },
            })
          }

          // ── 9. ACTIVE WAR — ENEMY TERRITORY INDICATORS ──
          const wars = useWorldStore.getState().wars
          const enemyISOs = new Set<string>()
          wars.forEach(w => {
            if (w.status !== 'active') return
            if (w.attacker === (playerCountry?.code || 'US')) enemyISOs.add(w.defender)
            if (w.defender === (playerCountry?.code || 'US')) enemyISOs.add(w.attacker)
          })

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

          // ── Hover interactions ──
          let hoveredStateName: string | null = null
          m.on('mousemove', 'xwar-state-fill', (e) => {
            if (e.features && e.features.length > 0) {
              const stateName = e.features[0].properties?.['name']
              if (stateName && stateName !== hoveredStateName) {
                hoveredStateName = stateName
                m.setFilter('xwar-state-hover', ['==', ['get', 'name'], stateName])
                m.setPaintProperty('xwar-state-hover', 'fill-opacity', 0.15)
                m.setFilter('xwar-state-hover-border', ['==', ['get', 'name'], stateName])
                m.setPaintProperty('xwar-state-hover-border', 'line-opacity', 1)
                m.getCanvas().style.cursor = 'pointer'
              }
            }
          })
          m.on('mouseleave', 'xwar-state-fill', () => {
            hoveredStateName = null
            m.setFilter('xwar-state-hover', ['==', ['get', 'name'], ''])
            m.setPaintProperty('xwar-state-hover', 'fill-opacity', 0)
            m.setFilter('xwar-state-hover-border', ['==', ['get', 'name'], ''])
            m.setPaintProperty('xwar-state-hover-border', 'line-opacity', 0)
            m.getCanvas().style.cursor = 'crosshair'
          })


          // ── 10. GEOJSON CLICK → OPEN STATE PANEL ──
          m.on('click', 'xwar-state-fill', (e) => {
            if (e.features && e.features.length > 0) {
              const iso3 = e.features[0].properties?.['adm0_a3']
              const countryName = iso3 ? ISO3_TO_NAME[iso3] : null
              if (countryName) {
                const country = countriesRef.current.find(c => c.name === countryName)
                if (country) {
                   const lngLat = e.lngLat
                   handleRegionClick(country.code, [lngLat.lng, lngLat.lat])
                }
              }
            }
          })

          // Refine region positions
          useRegionStore.getState().updateBoundsFromGeoJSON(geojson, 'adm0_a3')

          setMapLoaded(true)
        })
        .catch(() => { setMapLoaded(true) })


      m.getCanvas().style.cursor = 'crosshair'
    })

    // Coordinate tracking
    m.on('mousemove', (e) => {
      if (onMouseMove) {
        const { lat, lng } = e.lngLat
        onMouseMove(
          `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`,
          `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`
        )
      }
    })

    map.current = m

    // Force resize to fix WebGL projection vs container height bugs
    const resizeObserver = new ResizeObserver(() => {
      map.current?.resize()
    })
    resizeObserver.observe(mapContainer.current)

    // Initial resize delay to ensure flex layout settled
    setTimeout(() => {
      map.current?.resize()
    }, 100)
    setTimeout(() => {
      map.current?.resize()
    }, 500)

    return () => {
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
