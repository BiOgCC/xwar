import { useState, useCallback } from 'react'
import type { GameMapHandle } from './GameMap'
import '../../styles/map-filter.css'

interface FilterState {
  playerTerritory: boolean
  allies: boolean
  enemies: boolean
  oceanBlocks: boolean
  stateNames: boolean
  stateBorders: boolean
  deposits: boolean
}

const DEFAULT_FILTERS: FilterState = {
  playerTerritory: true,
  allies: true,
  enemies: true,
  oceanBlocks: true,
  stateNames: true,
  stateBorders: true,
  deposits: true,
}

const FILTER_ITEMS: { key: keyof FilterState; icon: string; label: string; layers: string[] }[] = [
  { key: 'playerTerritory', icon: '🟢', label: 'My Territory', layers: ['xwar-player-glow', 'xwar-player-tint'] },
  { key: 'allies', icon: '🔵', label: 'Ally Glow', layers: ['xwar-ally-glow'] },
  { key: 'enemies', icon: '🔴', label: 'Enemy Zones', layers: ['xwar-enemy-tint', 'xwar-enemy-border'] },
  { key: 'deposits', icon: '⛏️', label: 'Deposits', layers: ['xwar-deposit-markers', 'xwar-deposit-glow', 'xwar-deposit-labels'] },
  { key: 'oceanBlocks', icon: '🌊', label: 'Ocean Blocks', layers: ['xwar-ocean-fill'] },
  { key: 'stateNames', icon: '🏷️', label: 'State Names', layers: ['xwar-state-names'] },
  { key: 'stateBorders', icon: '📐', label: 'State Borders', layers: ['xwar-state-border'] },
]

interface MapFilterOverlayProps {
  mapRef: React.RefObject<GameMapHandle | null>
}

export default function MapFilterOverlay({ mapRef }: MapFilterOverlayProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const toggleFilter = useCallback((key: keyof FilterState) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      // Apply to map layers
      const map = mapRef.current?.getMap()
      if (map) {
        const item = FILTER_ITEMS.find((f) => f.key === key)
        item?.layers.forEach((layerId) => {
          try {
            map.setLayoutProperty(layerId, 'visibility', next[key] ? 'visible' : 'none')
          } catch {} // Layer may not exist yet
        })
      }
      return next
    })
  }, [mapRef])

  return (
    <div className="map-filter">
      <div className="map-filter__title">MAP LAYERS</div>
      {FILTER_ITEMS.map((item, i) => (
        <div key={item.key}>
          <div className="map-filter__item" onClick={() => toggleFilter(item.key)}>
            <div className={`map-filter__checkbox ${filters[item.key] ? 'map-filter__checkbox--checked' : 'map-filter__checkbox--unchecked'}`}>
              {filters[item.key] ? '✓' : ''}
            </div>
            <span style={{ fontSize: '12px' }}>{item.icon}</span>
            <span className="map-filter__label">{item.label}</span>
          </div>
          {i === 2 && <div className="map-filter__sep" />}
        </div>
      ))}
    </div>
  )
}
