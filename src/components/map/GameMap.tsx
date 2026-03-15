import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import maplibregl from 'maplibre-gl'
import type { Country } from '../../stores/worldStore'

interface RegionInfo {
  name: string
  controller: string
  empire: string | null
  military: number
  treasury: number
  regions: number
  color: string
  lngLat: [number, number]
}

interface GameMapProps {
  countries: Country[]
  onRegionClick?: (info: RegionInfo) => void
  onMouseMove?: (lat: string, lng: string) => void
}

export interface GameMapHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
  flyTo: (lng: number, lat: number, zoom?: number) => void
}

// Country centroids (lng, lat)
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
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
  'United States': 'USA',
  'Russia': 'RUS',
  'China': 'CHN',
  'Germany': 'DEU',
  'Brazil': 'BRA',
  'India': 'IND',
  'Nigeria': 'NGA',
  'Japan': 'JPN',
  'United Kingdom': 'GBR',
  'Turkey': 'TUR',
  'Canada': 'CAN',
  'Mexico': 'MEX',
  'Cuba': 'CUB',
  'Bahamas': 'BHS',
}

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

  const handleRegionClick = useCallback((name: string, lngLat: [number, number]) => {
    const country = countriesRef.current.find(c => c.name === name)
    if (country && onRegionClickRef.current) {
      onRegionClickRef.current({
        name: country.name,
        controller: country.controller,
        empire: country.empire,
        military: country.military,
        treasury: country.treasury,
        regions: country.regions,
        color: country.color,
        lngLat,
      })
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
      m.addSource('xwar-countries', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
      })

      // Build color match expression for controlled countries
      const colorExpr: any[] = ['match', ['get', 'ISO_A3']]
      const controlledISOs: string[] = []

      countries.forEach(c => {
        const iso = COUNTRY_ISO[c.name]
        if (iso) {
          colorExpr.push(iso, c.color)
          controlledISOs.push(iso)
        }
      })
      colorExpr.push('transparent') // default: invisible for uncontrolled

      // Glow fill for controlled countries
      m.addLayer({
        id: 'xwar-country-fill',
        type: 'fill',
        source: 'xwar-countries',
        paint: {
          'fill-color': colorExpr as any,
          'fill-opacity': [
            'case',
            ['in', ['get', 'ISO_A3'], ['literal', controlledISOs]],
            0.2,
            0
          ],
        },
      })

      // Borders for controlled countries
      m.addLayer({
        id: 'xwar-country-border',
        type: 'line',
        source: 'xwar-countries',
        paint: {
          'line-color': [
            'case',
            ['in', ['get', 'ISO_A3'], ['literal', controlledISOs]],
            colorExpr as any,
            'rgba(34, 211, 138, 0.06)'
          ],
          'line-width': [
            'case',
            ['in', ['get', 'ISO_A3'], ['literal', controlledISOs]],
            1.5,
            0.3
          ],
        },
      })

      // Hover highlight layer
      m.addLayer({
        id: 'xwar-country-hover',
        type: 'fill',
        source: 'xwar-countries',
        paint: {
          'fill-color': '#22d38a',
          'fill-opacity': 0,
        },
        filter: ['==', ['get', 'ISO_A3'], ''],
      })

      // Add interactive markers for each controlled country
      countries.forEach(c => {
        const centroid = COUNTRY_CENTROIDS[c.name]
        if (!centroid) return

        const size = Math.max(30, Math.min(54, c.military / 1.8))
        const hitPad = 16 // extra invisible padding for easier clicking
        const totalSize = size + hitPad * 2

        // Outer wrapper: large invisible hit area that eats ALL mouse events
        const wrapper = document.createElement('div')
        wrapper.style.cssText = `
          width: ${totalSize}px;
          height: ${totalSize}px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          z-index: 10;
        `

        // Block drag-starting events from reaching the map canvas
        // (mousedown/pointerdown start map drags — block these in capture phase)
        const blockDragEvent = (e: Event) => {
          e.stopPropagation()
          e.preventDefault()
        }
        wrapper.addEventListener('mousedown', blockDragEvent, true)
        wrapper.addEventListener('pointerdown', blockDragEvent, true)
        wrapper.addEventListener('touchstart', blockDragEvent, { capture: true })
        wrapper.addEventListener('dblclick', blockDragEvent, true)

        // Inner visible circle
        const circle = document.createElement('div')
        circle.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${c.color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px ${c.color}55, inset 0 0 6px rgba(0,0,0,0.3);
          transition: box-shadow 200ms ease, border-color 200ms ease;
          border: 2px solid rgba(255,255,255,0.15);
          pointer-events: none;
        `

        const count = document.createElement('span')
        count.style.cssText = `
          font-family: 'Orbitron', monospace;
          font-size: ${c.regions > 9 ? '10px' : '12px'};
          font-weight: 700;
          color: #080c12;
          line-height: 1;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          pointer-events: none;
        `
        count.textContent = String(c.regions)
        circle.appendChild(count)

        // Pulse ring
        const pulse = document.createElement('div')
        pulse.style.cssText = `
          position: absolute;
          inset: ${hitPad - 5}px;
          border-radius: 50%;
          border: 1.5px solid ${c.color};
          opacity: 0;
          animation: marker-pulse 3s ease-out infinite;
          animation-delay: ${Math.random() * 2}s;
          pointer-events: none;
        `

        wrapper.appendChild(circle)
        wrapper.appendChild(pulse)

        // Hover: glow effect only (NO scale transform — avoids jitter)
        wrapper.addEventListener('mouseenter', () => {
          circle.style.boxShadow = `0 0 28px ${c.color}99, inset 0 0 8px rgba(0,0,0,0.2)`
          circle.style.borderColor = 'rgba(255,255,255,0.4)'
          wrapper.style.zIndex = '20'
        })
        wrapper.addEventListener('mouseleave', () => {
          circle.style.boxShadow = `0 0 12px ${c.color}55, inset 0 0 6px rgba(0,0,0,0.3)`
          circle.style.borderColor = 'rgba(255,255,255,0.15)'
          wrapper.style.zIndex = '10'
        })

        // Click handler — on the wrapper so the whole hit area works
        wrapper.addEventListener('click', (e) => {
          e.stopPropagation()
          handleRegionClick(c.name, centroid)
        })

        new maplibregl.Marker({ element: wrapper, anchor: 'center' })
          .setLngLat(centroid)
          .addTo(m)
      })

      // Hover interactions on the polygon fill
      let hoveredISO: string | null = null

      m.on('mousemove', 'xwar-country-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const iso = e.features[0].properties?.ISO_A3
          if (iso && iso !== hoveredISO) {
            hoveredISO = iso
            m.setFilter('xwar-country-hover', ['==', ['get', 'ISO_A3'], iso])
            m.setPaintProperty('xwar-country-hover', 'fill-opacity', 0.1)
            m.getCanvas().style.cursor = 'pointer'
          }
        }
      })

      m.on('mouseleave', 'xwar-country-fill', () => {
        hoveredISO = null
        m.setFilter('xwar-country-hover', ['==', ['get', 'ISO_A3'], ''])
        m.setPaintProperty('xwar-country-hover', 'fill-opacity', 0)
        m.getCanvas().style.cursor = 'crosshair'
      })

      // Click on country polygon
      m.on('click', 'xwar-country-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const props = e.features[0].properties
          const name = props?.ADMIN
          if (name) {
            handleRegionClick(name, [e.lngLat.lng, e.lngLat.lat])
          }
        }
      })

      setMapLoaded(true)
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
