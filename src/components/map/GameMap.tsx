import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import maplibregl from 'maplibre-gl'
import 'flag-icons/css/flag-icons.min.css'
import type { Country } from '../../stores/worldStore'
import { useWorldStore } from '../../stores/worldStore'
import type { Region } from '../../stores/regionStore'
import { useRegionStore } from '../../stores/regionStore'
import { useUIStore } from '../../stores/uiStore'
import { ARCHETYPE_META } from '../../data/leyLineRegistry'
import type { LeyLineDef } from '../../data/leyLineRegistry'
import { useLeyLineStore } from '../../stores/leyLineStore'
import { useTradeRouteStore } from '../../stores/tradeRouteStore'
import { useAllianceStore } from '../../stores/allianceStore'
import { usePlayerStore } from '../../stores/playerStore'
import { type NodeOwnershipState, OWNERSHIP_COLORS } from '../../types/leyLine'

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

  // ── Live ley line defs from DB ──
  const liveDefs = useLeyLineStore(s => s.defs)
  const fetchDefs = useLeyLineStore(s => s.fetchDefs)
  const leyLineSourcesBooted = useRef(false)
  // Fetch defs once on mount
  useEffect(() => { fetchDefs() }, [fetchDefs])

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

  // ── Reactive ley line rendering: boots on first defs + mapLoaded ──
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded || liveDefs.length === 0) return

    const bzArc = (p1: number[], p2: number[], steps = 24): number[][] => {
      const mLng = (p1[0]+p2[0])/2, mLat = (p1[1]+p2[1])/2
      const dist = Math.sqrt((p2[0]-p1[0])**2+(p2[1]-p1[1])**2)
      const ctrl = [mLng, mLat + dist*0.18]
      const pts: number[][] = []
      for (let i = 0; i <= steps; i++) {
        const t = i/steps
        pts.push([(1-t)**2*p1[0]+2*(1-t)*t*ctrl[0]+t**2*p2[0], (1-t)**2*p1[1]+2*(1-t)*t*ctrl[1]+t**2*p2[1]])
      }
      return pts
    }
    const buildPaths = (): GeoJSON.FeatureCollection => {
      const regs = useRegionStore.getState().regions
      const lsAll = useLeyLineStore.getState().getAllLineStatus()
      const features: GeoJSON.Feature[] = []
      liveDefs.forEach((line: LeyLineDef) => {
        const meta = ARCHETYPE_META[line.archetype]
        const coords: number[][] = []; let prev: number[] | null = null
        line.blocks.forEach((bid: string) => {
          const r = regs.find(x => x.id === bid)
          if (r?.position && r.position.length >= 2) {
            if (prev) { const c = bzArc(prev, r.position); c.shift(); coords.push(...c) } else coords.push([...r.position])
            prev = r.position
          }
        })
        if (coords.length < 2) return
        const st = lsAll.find((s: any) => s.def.id === line.id)
        features.push({ type: 'Feature', properties: { id: line.id, name: line.name, archetype: line.archetype, color: meta.color, active: st?.active ?? false, completion: st?.completion ?? 0 }, geometry: { type: 'LineString', coordinates: coords } })
      })
      return { type: 'FeatureCollection', features }
    }
    const buildNodes = (): GeoJSON.FeatureCollection => {
      const regs = useRegionStore.getState().regions
      const pISO = usePlayerStore.getState().countryCode ?? ''
      const pa = useAllianceStore.getState().getPlayerAlliance?.()
      const pAId: string | null = pa?.id ?? null
      const als: any[] = (useAllianceStore.getState() as any).alliances ?? []
      const lsAll = useLeyLineStore.getState().getAllLineStatus()
      const features: GeoJSON.Feature[] = []
      liveDefs.forEach((line: LeyLineDef) => {
        const meta = ARCHETYPE_META[line.archetype]
        const st = lsAll.find((s: any) => s.def.id === line.id)
        const active = st?.active ?? false
        const missingCount = line.blocks.filter((bid: string) => {
          const o = regs.find(x => x.id === bid)?.controlledBy ?? null
          if (!o) return true; if (o === pISO) return false
          if (pAId) { const a = als.find(x => x.id === pAId); if (a?.members?.some((mb: any) => mb.countryCode === o)) return false }
          return true
        }).length
        line.blocks.forEach((bid: string) => {
          const r = regs.find(x => x.id === bid)
          if (!r?.position || r.position.length < 2) return
          const own = r.controlledBy ?? null
          const ownerState: NodeOwnershipState = !own ? 'unowned' : own === pISO ? 'self' : 'neutral'
          const isMissing = ownerState !== 'self'
          const isCrit = !active && isMissing && missingCount === 1
          features.push({ type: 'Feature', properties: { regionId: bid, regionName: r.name, lineId: line.id, lineName: line.name, archetype: line.archetype, archetypeColor: meta.color, archetypeLabel: meta.label, ownershipState: ownerState, ownerCountry: own, isLineActive: active, isLineCritical: isCrit } satisfies Record<string, unknown>, geometry: { type: 'Point', coordinates: r.position } })
        })
      })
      return { type: 'FeatureCollection', features }
    }

    if (leyLineSourcesBooted.current) {
      ;(m.getSource('xwar-leyline-nodes') as maplibregl.GeoJSONSource | undefined)?.setData(buildNodes())
      ;(m.getSource('xwar-leylines') as maplibregl.GeoJSONSource | undefined)?.setData(buildPaths())
    } else {
      leyLineSourcesBooted.current = true
      try {
        m.addSource('xwar-leylines', { type: 'geojson', data: buildPaths() })
        m.addSource('xwar-leyline-nodes', { type: 'geojson', data: buildNodes() })
        m.addLayer({ id: 'xwar-leyline-glow',       type: 'line',   source: 'xwar-leylines',      paint: { 'line-color': ['get','color'], 'line-width': ['case',['==',['get','active'],true],10,6],  'line-opacity': ['case',['==',['get','active'],true],0.25,0.08], 'line-blur': 8 } as any })
        m.addLayer({ id: 'xwar-leyline-glow-inner', type: 'line',   source: 'xwar-leylines',      paint: { 'line-color': ['get','color'], 'line-width': ['case',['==',['get','active'],true],5,3],   'line-opacity': ['case',['==',['get','active'],true],0.45,0.20],'line-blur': 2 } as any })
        m.addLayer({ id: 'xwar-leyline-core',       type: 'line',   source: 'xwar-leylines',      paint: { 'line-color': ['get','color'], 'line-width': ['case',['==',['get','active'],true],2.2,1.5],'line-opacity': ['case',['==',['get','active'],true],0.90,0.40],'line-dasharray':[5,3] } as any })
        m.addLayer({ id: 'xwar-leyline-spine',      type: 'line',   source: 'xwar-leylines',      filter: ['==',['get','active'],true], paint: { 'line-color': '#ffffff', 'line-width': 0.8, 'line-opacity': 0.85 } as any })
        m.addLayer({ id: 'xwar-leyline-nodes',      type: 'circle', source: 'xwar-leyline-nodes', minzoom: 2.5, paint: {
          'circle-radius':       ['case',['boolean',['get','isLineCritical'],false],10,['boolean',['get','isLineActive'],false],8,6] as any,
          'circle-color':        ['match',['get','ownershipState'],'self',OWNERSHIP_COLORS.self,'ally',OWNERSHIP_COLORS.ally,'enemy',OWNERSHIP_COLORS.enemy,'neutral',OWNERSHIP_COLORS.neutral,OWNERSHIP_COLORS.unowned] as any,
          'circle-stroke-color': ['case',['boolean',['get','isLineActive'],false],'#ffffff',['boolean',['get','isLineCritical'],false],'#fbbf24','rgba(0,0,0,0)'] as any,
          'circle-stroke-width': ['case',['boolean',['get','isLineActive'],false],3,['boolean',['get','isLineCritical'],false],2,0] as any,
          'circle-opacity':      ['match',['get','ownershipState'],'unowned',0.5,1.0] as any,
        } })
        m.addLayer({ id: 'xwar-leyline-labels', type: 'symbol', source: 'xwar-leylines', minzoom: 3,
          layout: { 'text-field':['get','name'],'text-font':['Open Sans Bold','Arial Unicode MS Bold'],'text-size':11,'symbol-placement':'line-center','text-allow-overlap':false },
          paint: { 'text-color':['get','color'],'text-halo-color':'rgba(0,0,0,0.9)','text-halo-width':1.5 } as any })
        const llPop = new maplibregl.Popup({ closeButton:false, closeOnClick:false, className:'xwar-leynode-popup', offset:10 })
        m.on('mouseenter', 'xwar-leyline-nodes', (e: any) => {
          m.getCanvas().style.cursor = 'crosshair'
          if (!e.features?.length) return
          const p = e.features[0].properties as Record<string,unknown>
          const sc = OWNERSHIP_COLORS[(p.ownershipState as NodeOwnershipState) ?? 'unowned']
          llPop.setLngLat(e.features[0].geometry.coordinates as [number,number])
            .setHTML(`<div style="font-family:monospace;min-width:160px"><b style="color:#e2e8f0">${p.regionName??p.regionId}</b><br/><span style="font-size:9px;color:#94a3b8">Ley: <b style="color:${p.archetypeColor}">${p.lineName}</b></span><br/><span style="font-size:8px;padding:2px 6px;background:${sc}22;color:${sc};border-radius:3px">${String(p.ownershipState).toUpperCase()}</span>${p.isLineCritical?'<br/><span style="color:#fbbf24;font-size:9px">⚡ Capture to complete</span>':''}</div>`)
            .addTo(m)
        })
        m.on('mouseleave','xwar-leyline-nodes', () => { m.getCanvas().style.cursor=''; llPop.remove() })
        const unsubLL = useRegionStore.subscribe(() => {
          const ns = m.getSource('xwar-leyline-nodes') as maplibregl.GeoJSONSource|undefined
          const ps = m.getSource('xwar-leylines') as maplibregl.GeoJSONSource|undefined
          if (ns && ps) { ns.setData(buildNodes()); ps.setData(buildPaths()) }
        })
        m.once('remove', () => { unsubLL(); llPop.remove() })
      } catch(err) { console.warn('[GameMap] ley line init:', err) }
    }
  }, [liveDefs, mapLoaded])


  // Expose map controls to parent via ref
  // ── Reactive map layer visibility toggles (Ley Lines / Trade Lanes) ──
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    const LEY_LINE_LAYERS = [
      'xwar-leyline-glow', 'xwar-leyline-glow-inner', 'xwar-leyline-core',
      'xwar-leyline-spine', 'xwar-leyline-nodes', 'xwar-leyline-labels',
    ]
    const TRADE_LANE_LAYERS = [
      'xwar-tr-glow-outer', 'xwar-tr-glow-mid', 'xwar-tr-glow-inner',
      'xwar-tr-core', 'xwar-tr-spine', 'xwar-trade-routes-objective-glow',
      'xwar-tr-port-aura', 'xwar-tr-port-halo',
      'xwar-trade-route-dots', 'xwar-trade-route-labels',
    ]

    const setVis = (layers: string[], visible: boolean) => {
      const val = visible ? 'visible' : 'none'
      layers.forEach(id => {
        try { m.setLayoutProperty(id, 'visibility', val) } catch {}
      })
    }

    // Apply current state immediately
    const { leyLines, tradeLanes } = useUIStore.getState().mapLayerVisibility
    setVis(LEY_LINE_LAYERS, leyLines)
    setVis(TRADE_LANE_LAYERS, tradeLanes)

    // Subscribe to future changes
    const unsub = useUIStore.subscribe(
      (state) => {
        setVis(LEY_LINE_LAYERS, state.mapLayerVisibility.leyLines)
        setVis(TRADE_LANE_LAYERS, state.mapLayerVisibility.tradeLanes)
      }
    )

    return () => unsub()
  }, [mapLoaded])

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

          // ── Helper: derive NodeOwnershipState for a region ──
          function getOwnershipState(
            ownerCountry: string | null | undefined,
            playerISO2: string | null,
            playerAllianceId: string | null,
            alliances: ReturnType<typeof useAllianceStore.getState>['alliances'],
            enemyISOs: Set<string>,
          ): NodeOwnershipState {
            if (!ownerCountry) return 'unowned'
            if (ownerCountry === playerISO2) return 'self'
            if (enemyISOs.has(ownerCountry)) return 'enemy'
            if (playerAllianceId) {
              const playerAlliance = alliances.find(a => a.id === playerAllianceId)
              if (playerAlliance?.members.some(m => m.countryCode === ownerCountry)) return 'ally'
            }
            return 'neutral'
          }

          // ── Helper: build full node GeoJSON from current store state ──
          // ── Helper: Curved Arc Interpolation ──
          function createBezierArc(start: number[], end: number[], numPoints = 20): number[][] {
            const points: number[][] = []
            const [x1, y1] = start
            let [x2, y2] = end
            if (Math.abs(x2 - x1) > 180) {
              if (x2 < x1) x2 += 360
              else x2 -= 360
            }
            const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
            const bowFactor = Math.min(distance * 0.15, 10)
            const midX = (x1 + x2) / 2
            const midY = ((y1 + y2) / 2) + bowFactor

            for (let i = 0; i <= numPoints; i++) {
              const t = i / numPoints
              const u = 1 - t
              let px = u * u * x1 + 2 * u * t * midX + t * t * x2
              let py = u * u * y1 + 2 * u * t * midY + t * t * y2
              if (px > 180) px -= 360
              else if (px < -180) px += 360
              points.push([px, py])
            }
            return points
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

            // Annotate each GeoJSON feature with its control state + disruption
            const annotatedGeoJSON = {
              ...tradeStore.geojson,
              features: tradeStore.geojson.features.map((f: any) => {
                const route = tradeStore.routes.find(r => r.id === f.properties.id)
                if (!route) return f
                const controlState = tradeStore.getRouteControlState(route)
                const disrupted    = tradeStore.isRouteDisrupted(route.id)
                const isObjective  = tradeStore.isStrategicObjective(route.id)
                return {
                  ...f,
                  properties: {
                    ...f.properties,
                    controlState: disrupted ? 'disrupted' : controlState,
                    isObjective,
                  },
                }
              }),
            }

            m.addSource('xwar-trade-routes', { type: 'geojson', data: annotatedGeoJSON })

            // ════════════════════════════════════════════════
            //  LAYER 1 — Deep outer diffuse glow (widest, softest)
            // ════════════════════════════════════════════════
            m.addLayer({
              id: 'xwar-tr-glow-outer',
              type: 'line',
              source: 'xwar-trade-routes',
              paint: {
                'line-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#00c8ff',
                  'partial',  '#ffa000',
                  'disrupted','#cc2200',
                  '#223344',
                ],
                'line-width': [
                  'match', ['get', 'controlState'],
                  'active', 20,  'partial', 16,  'disrupted', 16,  4,
                ],
                'line-opacity': [
                  'match', ['get', 'controlState'],
                  'active', 0.10,  'partial', 0.08,  'disrupted', 0.08,  0.02,
                ],
                'line-blur': 12,
              },
            })

            // ════════════════════════════════════════════════
            //  LAYER 2 — Mid glow halo
            // ════════════════════════════════════════════════
            m.addLayer({
              id: 'xwar-tr-glow-mid',
              type: 'line',
              source: 'xwar-trade-routes',
              paint: {
                'line-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#00dfff',
                  'partial',  '#ffbb00',
                  'disrupted','#ff3300',
                  '#334455',
                ],
                'line-width': [
                  'match', ['get', 'controlState'],
                  'active', 10,  'partial', 8,  'disrupted', 8,  2,
                ],
                'line-opacity': [
                  'match', ['get', 'controlState'],
                  'active', 0.22,  'partial', 0.18,  'disrupted', 0.20,  0.03,
                ],
                'line-blur': 6,
              },
            })

            // ════════════════════════════════════════════════
            //  LAYER 3 — Inner glow ring (sharp bloom)
            // ════════════════════════════════════════════════
            m.addLayer({
              id: 'xwar-tr-glow-inner',
              type: 'line',
              source: 'xwar-trade-routes',
              paint: {
                'line-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#40f0ff',
                  'partial',  '#ffd040',
                  'disrupted','#ff6644',
                  '#445566',
                ],
                'line-width': [
                  'match', ['get', 'controlState'],
                  'active', 5,  'partial', 4,  'disrupted', 4,  1.5,
                ],
                'line-opacity': [
                  'match', ['get', 'controlState'],
                  'active', 0.45,  'partial', 0.35,  'disrupted', 0.38,  0.08,
                ],
                'line-blur': 2,
              },
            })

            // ════════════════════════════════════════════════
            //  LAYER 4 — Core dashed lane line
            // ════════════════════════════════════════════════
            m.addLayer({
              id: 'xwar-tr-core',
              type: 'line',
              source: 'xwar-trade-routes',
              paint: {
                'line-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#00f0ff',
                  'partial',  '#ffc800',
                  'disrupted','#ff5533',
                  '#556677',
                ],
                'line-width': [
                  'match', ['get', 'controlState'],
                  'active', 2.2,  'partial', 2.0,  'disrupted', 1.8,  1.0,
                ],
                'line-opacity': [
                  'match', ['get', 'controlState'],
                  'active', 0.90,  'partial', 0.80,  'disrupted', 0.82,  0.28,
                ],
                'line-dasharray': [
                  'match', ['get', 'controlState'],
                  'disrupted', ['literal', [1.5, 3.5]],
                  'inactive',  ['literal', [2, 4]],
                  ['literal', [5, 3]],
                ],
              },
            })

            // ════════════════════════════════════════════════
            //  LAYER 5 — Bright spine highlight (thin bright center)
            //            Active routes only — gives "lit fiber" feel
            // ════════════════════════════════════════════════
            m.addLayer({
              id: 'xwar-tr-spine',
              type: 'line',
              source: 'xwar-trade-routes',
              filter: ['==', ['get', 'controlState'], 'active'],
              paint: {
                'line-color': '#dfffff',
                'line-width': 0.8,
                'line-opacity': 0.70,
              },
            })

            // ════════════════════════════════════════════════
            //  LAYER 6 — Strategic objective white outer pulse
            // ════════════════════════════════════════════════
            m.addLayer({
              id: 'xwar-trade-routes-objective-glow',
              type: 'line',
              source: 'xwar-trade-routes',
              filter: ['==', ['get', 'isObjective'], true],
              paint: {
                'line-color': '#ffffff',
                'line-width': 14,
                'line-opacity': 0.14,
                'line-blur': 10,
              },
            })

            // Keep these IDs for click/hover event references
            const xwarTradeRouteLineLayerId = 'xwar-tr-core'

            // ════════════════════════════════════════════════
            //  PORT MARKERS — 3-layer composite per endpoint
            // ════════════════════════════════════════════════
            const endpointFeatures: any[] = []
            tradeStore.routes.forEach(r => {
              const controlState = tradeStore.getRouteControlState(r)
              const disrupted    = tradeStore.isRouteDisrupted(r.id)
              const state = disrupted ? 'disrupted' : controlState
              endpointFeatures.push(
                { type: 'Feature', properties: { label: r.from, routeId: r.id, controlState: state }, geometry: { type: 'Point', coordinates: r.fromCoords } },
                { type: 'Feature', properties: { label: r.to,   routeId: r.id, controlState: state }, geometry: { type: 'Point', coordinates: r.toCoords } },
              )
            })

            m.addSource('xwar-trade-route-endpoints', {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: endpointFeatures },
            })

            // Port layer 1 — large soft aura
            m.addLayer({
              id: 'xwar-tr-port-aura',
              type: 'circle',
              source: 'xwar-trade-route-endpoints',
              paint: {
                'circle-radius': [
                  'match', ['get', 'controlState'],
                  'active', 16,  'partial', 13,  'disrupted', 13,  6,
                ],
                'circle-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#00e8ff',
                  'partial',  '#ffba00',
                  'disrupted','#ff4422',
                  '#334455',
                ],
                'circle-opacity': [
                  'match', ['get', 'controlState'],
                  'active', 0.10,  'partial', 0.08,  'disrupted', 0.08,  0.02,
                ],
                'circle-blur': 1,
              },
            })

            // Port layer 2 — medium bright halo
            m.addLayer({
              id: 'xwar-tr-port-halo',
              type: 'circle',
              source: 'xwar-trade-route-endpoints',
              paint: {
                'circle-radius': [
                  'match', ['get', 'controlState'],
                  'active', 8,  'partial', 7,  'disrupted', 7,  4,
                ],
                'circle-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#00f0ff',
                  'partial',  '#ffc800',
                  'disrupted','#ff5533',
                  '#445566',
                ],
                'circle-opacity': [
                  'match', ['get', 'controlState'],
                  'active', 0.35,  'partial', 0.28,  'disrupted', 0.30,  0.06,
                ],
                'circle-blur': 0.5,
              },
            })

            // Port layer 3 — crisp dot
            m.addLayer({
              id: 'xwar-trade-route-dots',
              type: 'circle',
              source: 'xwar-trade-route-endpoints',
              paint: {
                'circle-radius': [
                  'match', ['get', 'controlState'],
                  'active', 5,  'partial', 4.5,  'disrupted', 4.5,  3,
                ],
                'circle-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#00f8ff',
                  'partial',  '#ffd840',
                  'disrupted','#ff6644',
                  '#445566',
                ],
                'circle-stroke-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#e0ffff',
                  'partial',  '#fff0c0',
                  'disrupted','#ffcccc',
                  '#667788',
                ],
                'circle-stroke-width': 1.5,
                'circle-opacity': [
                  'match', ['get', 'controlState'],
                  'inactive', 0.30,
                  1.0,
                ],
              },
            })

            // Port labels
            m.addLayer({
              id: 'xwar-trade-route-labels',
              type: 'symbol',
              source: 'xwar-trade-route-endpoints',
              minzoom: 3,
              layout: {
                'text-field': ['get', 'label'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 11,
                'text-offset': [0, 1.5],
                'text-anchor': 'top',
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': [
                  'match', ['get', 'controlState'],
                  'active',   '#80f8ff',
                  'partial',  '#ffe080',
                  'disrupted','#ff9988',
                  '#667788',
                ],
                'text-halo-color': 'rgba(0,0,0,0.95)',
                'text-halo-width': 1.8,
                'text-opacity': [
                  'match', ['get', 'controlState'],
                  'inactive', 0.35,  1.0,
                ],
              },
            })

            // ── Hover tooltip popup ──
            let hoverPopup: maplibregl.Popup | null = null

            m.on('mouseenter', xwarTradeRouteLineLayerId, (e: any) => {
              if (!e.features || e.features.length === 0) return
              m.getCanvas().style.cursor = 'pointer'

              const props = e.features[0].properties
              const routeId = props?.id
              if (!routeId) return

              const store = useTradeRouteStore.getState()
              const route = store.routes.find(r => r.id === routeId)
              if (!route) return

              const controlState = store.getRouteControlState(route)
              const disrupted    = store.isRouteDisrupted(route.id)
              const finalState   = disrupted ? 'disrupted' : controlState

              const statusColors: Record<string, string> = {
                active:   '#00e5ff',
                partial:  '#ffb300',
                disrupted:'#ff4444',
                inactive: '#888899',
              }
              const statusLabels: Record<string, string> = {
                active:   '✅ ACTIVE',
                partial:  '⚠️ PARTIAL',
                disrupted:'🚫 DISRUPTED',
                inactive: '❌ INACTIVE',
              }

              const mult = finalState === 'active' ? 1 : finalState === 'partial' ? 0.3 : 0
              const money = Math.round((route.tradedGoods + route.fish * 10) * mult)
              const oil   = Math.round(route.oil * mult)

              const incomeLines = []
              if (money > 0) incomeLines.push(`📦 $${money.toLocaleString()}/tick`)
              if (oil > 0)   incomeLines.push(`🛢️ ${oil.toLocaleString()} oil/tick`)
              if (finalState === 'inactive' || finalState === 'disrupted') incomeLines.push('—')

              const html = `
                <div style="font-family:'Orbitron',sans-serif;background:rgba(5,10,25,0.97);border:1px solid ${statusColors[finalState]}44;border-radius:6px;padding:10px 13px;min-width:190px;pointer-events:none;">
                  <div style="font-size:12px;font-weight:700;color:${statusColors[finalState]};letter-spacing:1px;margin-bottom:4px;">⚓ ${route.name}</div>
                  <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">${route.from} → ${route.to}</div>
                  <div style="font-size:11px;font-weight:700;color:${statusColors[finalState]};margin-bottom:5px;">${statusLabels[finalState]}</div>
                  <div style="font-size:11px;color:#e2e8f0;">${incomeLines.join('<br/>')}</div>
                </div>
              `

              if (hoverPopup) hoverPopup.remove()
              hoverPopup = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'trade-route-popup',
                offset: 12,
              })
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(m)
            })

            m.on('mousemove', xwarTradeRouteLineLayerId, (e: any) => {
              if (hoverPopup) hoverPopup.setLngLat(e.lngLat)
            })

            m.on('mouseleave', xwarTradeRouteLineLayerId, () => {
              m.getCanvas().style.cursor = 'crosshair'
              if (hoverPopup) { hoverPopup.remove(); hoverPopup = null }
            })

            // ── Click handler: full popup with action buttons ──
            m.on('click', xwarTradeRouteLineLayerId, (e: any) => {
              if (!e.features || e.features.length === 0) return
              if (hoverPopup) { hoverPopup.remove(); hoverPopup = null }
              const props = e.features[0].properties
              const routeId = props?.id
              if (!routeId) return

              const store = useTradeRouteStore.getState()
              const route = store.routes.find(r => r.id === routeId)
              if (!route) return

              store.selectRoute(routeId)

              const controlState = store.getRouteControlState(route)
              const disrupted    = store.isRouteDisrupted(route.id)
              const finalState   = disrupted ? 'disrupted' : controlState
              const isObjective  = store.isStrategicObjective(routeId)

              const world = useWorldStore.getState()
              const playerCountry = world.countries.find(c => c.controller === 'Player Alliance')

              const statusColors: Record<string, string> = {
                active:   '#00e5ff',
                partial:  '#ffb300',
                disrupted:'#ff4444',
                inactive: '#888899',
              }
              const statusLabels: Record<string, string> = {
                active:   '✅ ACTIVE',
                partial:  '⚠️ PARTIAL',
                disrupted:'🚫 DISRUPTED',
                inactive: '❌ INACTIVE',
              }

              const mult = finalState === 'active' ? 1 : finalState === 'partial' ? 0.3 : 0
              const money = Math.round((route.tradedGoods + route.fish * 10) * mult)
              const oil   = Math.round(route.oil * mult)

              const resources: string[] = []
              if (route.oil   > 0) resources.push(`🛢️ Oil base: <b>${route.oil}</b>/tick`)
              if (route.fish  > 0) resources.push(`🐟 Fish (→$): <b>${route.fish}</b>/tick`)
              if (route.tradedGoods > 0) resources.push(`📦 Goods: <b>$${route.tradedGoods.toLocaleString()}</b>/tick`)

              const partialNote = finalState === 'partial' ? (() => {
                const fromControlled = world.countries.find(c => c.code === route.fromCountry)
                const toControlled   = world.countries.find(c => c.code === route.toCountry)
                const pCC = playerCountry?.code || ''
                const fromOk = fromControlled?.code === pCC || fromControlled?.empire === playerCountry?.empire
                const missingPort = !fromOk ? route.from : route.to
                return `<div style="font-size:10px;color:#ffb300;margin-top:4px;">⚠️ Capture <b>${missingPort}</b> for full income</div>`
              })() : ''

              const incomeNote = finalState !== 'inactive'
                ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">This tick: ${money > 0 ? `$${money.toLocaleString()}` : ''}${oil > 0 ? ` + ${oil} oil` : ''}${mult === 0 ? '—' : ''}</div>`
                : ''

              const objBtnLabel = isObjective ? '★ UNMARK OBJECTIVE' : '☆ MARK AS OBJECTIVE'
              const html = `
                <div style="font-family:'Orbitron',sans-serif;background:rgba(8,12,28,0.97);border:1px solid ${statusColors[finalState]}44;border-radius:8px;padding:14px 16px;min-width:240px;">
                  <div style="font-size:13px;font-weight:700;color:${statusColors[finalState]};margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">⚓ ${route.name}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;">${route.from} → ${route.to}<br/><span style="color:#64748b;">${route.lengthNm.toLocaleString()} nm</span></div>
                  <div style="font-size:11px;color:#e2e8f0;margin-bottom:6px;line-height:1.6;">${resources.join('<br/>')}</div>
                  ${incomeNote}${partialNote}
                  <div style="font-size:12px;font-weight:700;color:${statusColors[finalState]};margin:8px 0 10px;">${statusLabels[finalState]}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="tr-obj-btn-${routeId}" style="flex:1;min-width:100px;font-size:9px;font-family:'Orbitron',sans-serif;padding:5px 8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:4px;cursor:pointer;letter-spacing:0.5px;">${objBtnLabel}</button>
                    <button id="tr-dis-btn-${routeId}" style="flex:1;min-width:100px;font-size:9px;font-family:'Orbitron',sans-serif;padding:5px 8px;background:rgba(255,68,68,0.12);border:1px solid rgba(255,68,68,0.35);color:#ff9999;border-radius:4px;cursor:pointer;letter-spacing:0.5px;">⚡ DISRUPT (30 MIN)</button>
                  </div>
                </div>
              `

              const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: 'trade-route-popup' })
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(m)

              popup.on('open', () => {
                const objBtn = document.getElementById(`tr-obj-btn-${routeId}`)
                const disBtn = document.getElementById(`tr-dis-btn-${routeId}`)
                objBtn?.addEventListener('click', () => {
                  useTradeRouteStore.getState().toggleStrategicObjective(routeId)
                  popup.remove()
                })
                disBtn?.addEventListener('click', () => {
                  useTradeRouteStore.getState().disruptRoute(routeId, 30 * 60 * 1000, 'manual')
                  popup.remove()
                })
              })
            })

            console.log(`✅ Trade routes rendered: ${tradeStore.routes.length} routes`)

            // ── Animated flowing dash (marching neon effect) ──
            // MapLibre doesn't animate dasharray natively, so we cycle
            // through offset variants via rAF. Each step = +1/8 of dash cycle.
            const DASH_STEPS = 8
            const STEP_CYCLE = [5, 3]           // [dash, gap] in pixels
            const CYCLE_MS = 1800               // ms for one full cycle
            let lastTime = 0
            let dashPhase = 0

            const animateDashes = (now: number) => {
              if (!m || !m.getLayer('xwar-tr-core')) return
              const elapsed = now - lastTime
              if (elapsed > CYCLE_MS / DASH_STEPS) {
                lastTime = now
                dashPhase = (dashPhase + 1) % DASH_STEPS

                // Build offset dash array by prepending a 0-length segment
                // then shifting the pattern — simulates movement
                const offset = (dashPhase / DASH_STEPS) * (STEP_CYCLE[0] + STEP_CYCLE[1])
                const shifted = [
                  STEP_CYCLE[0] + STEP_CYCLE[1] - offset,
                  0,
                  offset,
                  STEP_CYCLE[1] + STEP_CYCLE[0] - offset,
                ].map(v => Math.max(0, +v.toFixed(2)))

                try {
                  if (m.getLayer('xwar-tr-core')) {
                    m.setPaintProperty('xwar-tr-core', 'line-dasharray', shifted)
                  }
                  if (m.getLayer('xwar-leyline-core-active')) {
                    m.setPaintProperty('xwar-leyline-core-active', 'line-dasharray', shifted)
                  }
                } catch { /* layer may not exist yet */ }
              }


              // Only continue if map is still alive
              if (m && !m._removed) {
                requestAnimationFrame(animateDashes)
              }
            }
            requestAnimationFrame(animateDashes)
          })

          // ── REACH VISUALIZATION SOURCES + LAYERS ──
          // Created here inside the GeoJSON .then() to ensure map style is loaded
          const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
          try {
            m.addSource('xwar-reach-arcs', { type: 'geojson', data: emptyFC })
            m.addSource('xwar-reach-dots', { type: 'geojson', data: emptyFC })
            m.addSource('xwar-reach-source', { type: 'geojson', data: emptyFC })

            // Arc glow
            m.addLayer({
              id: 'xwar-reach-arc-glow',
              type: 'line',
              source: 'xwar-reach-arcs',
              paint: {
                'line-color': ['get', 'color'] as any,
                'line-width': 8,
                'line-opacity': 0.12,
                'line-blur': 6,
              },
            })
            // Arc core
            m.addLayer({
              id: 'xwar-reach-arc-core',
              type: 'line',
              source: 'xwar-reach-arcs',
              paint: {
                'line-color': ['get', 'color'] as any,
                'line-width': 2,
                'line-opacity': 0.6,
                'line-dasharray': [4, 3],
              },
            })
            // Arc spine (thin bright center)
            m.addLayer({
              id: 'xwar-reach-arc-spine',
              type: 'line',
              source: 'xwar-reach-arcs',
              paint: {
                'line-color': '#ffffff',
                'line-width': 0.6,
                'line-opacity': 0.35,
              },
            })

            // Target dots — outer glow
            m.addLayer({
              id: 'xwar-reach-dot-glow',
              type: 'circle',
              source: 'xwar-reach-dots',
              paint: {
                'circle-radius': 14,
                'circle-color': ['get', 'color'] as any,
                'circle-opacity': 0.15,
                'circle-blur': 1,
              },
            })
            // Target dots — core
            m.addLayer({
              id: 'xwar-reach-dot-core',
              type: 'circle',
              source: 'xwar-reach-dots',
              paint: {
                'circle-radius': 6,
                'circle-color': ['get', 'color'] as any,
                'circle-opacity': 0.85,
                'circle-stroke-color': '#000',
                'circle-stroke-width': 1.5,
              },
            })
            // Target label
            m.addLayer({
              id: 'xwar-reach-dot-label',
              type: 'symbol',
              source: 'xwar-reach-dots',
              minzoom: 3,
              layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': 9,
                'text-offset': [0, 1.6],
                'text-allow-overlap': false,
              },
              paint: {
                'text-color': ['get', 'color'] as any,
                'text-halo-color': 'rgba(0,0,0,0.9)',
                'text-halo-width': 1.5,
              },
            })

            // Source pulse — outer ring
            m.addLayer({
              id: 'xwar-reach-source-ring',
              type: 'circle',
              source: 'xwar-reach-source',
              paint: {
                'circle-radius': 18,
                'circle-color': '#22d38a',
                'circle-opacity': 0.18,
                'circle-blur': 0.8,
              },
            })
            // Source center dot
            m.addLayer({
              id: 'xwar-reach-source-dot',
              type: 'circle',
              source: 'xwar-reach-source',
              paint: {
                'circle-radius': 7,
                'circle-color': '#22d38a',
                'circle-opacity': 0.95,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
              },
            })
          } catch (err) {
            console.warn('[GameMap] reach layer init:', err)
          }

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

    // ── REACH VISUALIZATION: highlight reachable regions from selected region ──

    function buildReachArcGeoJSON(
      fromPos: [number, number],
      targets: { id: string; pos: [number, number]; type: 'adjacent' | 'airport' | 'port' }[]
    ): GeoJSON.FeatureCollection {
      const TYPE_COLORS: Record<string, string> = {
        adjacent: '#f59e0b',  // amber
        airport: '#a855f7',   // purple
        port: '#06b6d4',      // cyan
      }
      const features: GeoJSON.Feature[] = targets.map(t => {
        const [x1, y1] = fromPos
        let [x2, y2] = t.pos
        if (Math.abs(x2 - x1) > 180) { x2 = x2 < x1 ? x2 + 360 : x2 - 360 }
        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
        const bowFactor = Math.min(dist * 0.18, 12)
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2 + bowFactor
        const pts: number[][] = []
        const steps = 20
        for (let i = 0; i <= steps; i++) {
          const s = i / steps
          const u = 1 - s
          let px = u * u * x1 + 2 * u * s * midX + s * s * x2
          let py = u * u * y1 + 2 * u * s * midY + s * s * y2
          if (px > 180) px -= 360
          else if (px < -180) px += 360
          pts.push([px, py])
        }
        return {
          type: 'Feature',
          properties: { reachType: t.type, color: TYPE_COLORS[t.type] },
          geometry: { type: 'LineString', coordinates: pts },
        }
      })
      return { type: 'FeatureCollection', features }
    }

    function buildReachDotsGeoJSON(
      targets: { id: string; pos: [number, number]; type: 'adjacent' | 'airport' | 'port'; name: string }[]
    ): GeoJSON.FeatureCollection {
      const TYPE_COLORS: Record<string, string> = {
        adjacent: '#f59e0b',
        airport: '#a855f7',
        port: '#06b6d4',
      }
      return {
        type: 'FeatureCollection',
        features: targets.map(t => ({
          type: 'Feature',
          properties: { reachType: t.type, color: TYPE_COLORS[t.type], name: t.name },
          geometry: { type: 'Point', coordinates: t.pos },
        })),
      }
    }

    function buildSourceDotGeoJSON(pos: [number, number]): GeoJSON.FeatureCollection {
      return {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: pos },
        }],
      }
    }

    function updateReachLayers(selectedRegionId: string | null) {
      if (!m) return
      const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

      // Sources may not exist yet if GeoJSON hasn't loaded — check first
      const arcSrc = m.getSource('xwar-reach-arcs') as maplibregl.GeoJSONSource | undefined
      const dotSrc = m.getSource('xwar-reach-dots') as maplibregl.GeoJSONSource | undefined
      const srcSrc = m.getSource('xwar-reach-source') as maplibregl.GeoJSONSource | undefined
      if (!arcSrc || !dotSrc || !srcSrc) return  // Layers not booted yet

      // Clear if no selection
      if (!selectedRegionId) {
        arcSrc.setData(emptyFC)
        dotSrc.setData(emptyFC)
        srcSrc.setData(emptyFC)
        return
      }

      const { regions, getReachableFromRegion } = useRegionStore.getState()
      const from = regions.find(r => r.id === selectedRegionId)
      if (!from || from.isOcean) {
        arcSrc.setData(emptyFC)
        dotSrc.setData(emptyFC)
        srcSrc.setData(emptyFC)
        return
      }

      const reach = getReachableFromRegion(selectedRegionId)

      // Build target list
      const targets: { id: string; pos: [number, number]; type: 'adjacent' | 'airport' | 'port'; name: string }[] = []
      const seen = new Set<string>()

      reach.adjacent.forEach(id => {
        if (seen.has(id)) return; seen.add(id)
        const r = regions.find(rr => rr.id === id)
        if (r) targets.push({ id, pos: r.position, type: 'adjacent', name: r.name })
      })
      reach.airport.forEach(id => {
        if (seen.has(id)) return; seen.add(id)
        const r = regions.find(rr => rr.id === id)
        if (r) targets.push({ id, pos: r.position, type: 'airport', name: r.name })
      })
      reach.port.forEach(id => {
        if (seen.has(id)) return; seen.add(id)
        const r = regions.find(rr => rr.id === id)
        if (r) targets.push({ id, pos: r.position, type: 'port', name: r.name })
      })

      // Update sources with computed reach data
      arcSrc.setData(buildReachArcGeoJSON(from.position, targets))
      dotSrc.setData(buildReachDotsGeoJSON(targets))
      srcSrc.setData(buildSourceDotGeoJSON(from.position))
    }

    // Subscribe to selectedRegionId changes
    let prevSelectedRegionId = useUIStore.getState().selectedRegionId
    updateReachLayers(prevSelectedRegionId)
    const unsubReach = useUIStore.subscribe((state) => {
      if (state.selectedRegionId === prevSelectedRegionId) return
      prevSelectedRegionId = state.selectedRegionId
      updateReachLayers(state.selectedRegionId)
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
      unsubReach()
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
