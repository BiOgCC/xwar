import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useWorldStore } from '../../stores/worldStore'
import { useRegionStore } from '../../stores/regionStore'
import { COUNTRY_CENTROIDS } from './GameMap'
import type { GameMapHandle } from './GameMap'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/search.css'

interface SearchResult {
  id: string
  name: string
  type: 'country' | 'region'
  code: string        // ISO code for flag
  meta: string        // subtitle (e.g. controller, country name)
  position: [number, number]
}

interface SearchOverlayProps {
  mapRef: React.RefObject<GameMapHandle | null>
  onClose: () => void
  onRegionSelect?: (regionId: string) => void
}

export default function SearchOverlay({ mapRef, onClose, onRegionSelect }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const countries = useWorldStore((s) => s.countries)
  const regions = useRegionStore((s) => s.regions)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Build searchable results
  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = []

    countries.forEach((c) => {
      const centroid = COUNTRY_CENTROIDS[c.name]
      if (!centroid) return
      results.push({
        id: `country-${c.code}`,
        name: c.name,
        type: 'country',
        code: c.code,
        meta: `${c.controller} · ${c.empire || 'Non-Aligned'}`,
        position: centroid,
      })
    })

    regions.forEach((r) => {
      if (r.isOcean) return // skip ocean blocks
      results.push({
        id: `region-${r.id}`,
        name: r.name,
        type: 'region',
        code: r.countryCode,
        meta: `${countries.find((c) => c.code === r.countryCode)?.name || r.countryCode} · Defense ${r.defense}`,
        position: r.position,
      })
    })

    return results
  }, [countries, regions])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allResults.slice(0, 20) // show first 20 by default
    const q = query.toLowerCase().trim()
    return allResults
      .filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
      .slice(0, 30)
  }, [allResults, query])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      mapRef.current?.flyTo(result.position[0], result.position[1], result.type === 'country' ? 4 : 6)
      if (result.type === 'region' && onRegionSelect) {
        onRegionSelect(result.id.replace('region-', ''))
      }
      onClose()
    },
    [mapRef, onClose, onRegionSelect]
  )

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex])
      }
    },
    [onClose, filtered, selectedIndex, handleSelect]
  )

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-overlay__card" onClick={(e) => e.stopPropagation()}>
        <div className="search-overlay__input-wrap">
          <span className="search-overlay__icon">🔍</span>
          <input
            ref={inputRef}
            className="search-overlay__input"
            type="text"
            placeholder="Search countries, regions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="search-overlay__hint">ESC</span>
        </div>

        <div className="search-overlay__results">
          {filtered.length === 0 ? (
            <div className="search-overlay__empty">No results found</div>
          ) : (
            filtered.map((r, i) => (
              <div
                key={r.id}
                className={`search-result ${i === selectedIndex ? 'search-result--selected' : ''}`}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="search-result__flag">
                  <CountryFlag iso={r.code} size={20} />
                </span>
                <div className="search-result__info">
                  <div className="search-result__name">{r.name}</div>
                  <div className="search-result__meta">{r.meta}</div>
                </div>
                <span className={`search-result__type search-result__type--${r.type}`}>
                  {r.type}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
