import { useState, useCallback, useRef, useEffect } from 'react'
import { useUIStore } from './stores/uiStore'
import { usePlayerStore } from './stores/playerStore'
import { useWorldStore } from './stores/worldStore'
import { useBattleStore, getCountryName } from './stores/battleStore'
import CountryFlag from './components/shared/CountryFlag'
import { useRegionStore } from './stores/regionStore'
import type { Region } from './stores/regionStore'
import GameMap from './components/map/GameMap'
import { COUNTRY_CENTROIDS } from './components/map/GameMap'
import type { GameMapHandle } from './components/map/GameMap'
import RegionPopup from './components/map/RegionPopup'
import BattleMapOverlay from './components/map/BattleMapOverlay'
import TopBar from './components/layout/TopBar'
import Sidebar from './components/layout/Sidebar'
import NewsTicker from './components/layout/NewsTicker'
import PanelRouter from './components/layout/PanelRouter'
import { COUNTRY_ISO } from './data/countries'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useGameLoop } from './hooks/useGameLoop'
import { useAttack } from './hooks/useAttack'
import { initMockData } from './dev/mockData'
import './styles/ticker.css'

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

function App() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const { floatingTexts, setActivePanel, setForeignCountry } = useUIStore()
  const [mousePos, setMousePos] = useState({ lat: '0.00° N', lng: '0.00° E' })
  const [selectedRegion, setSelectedRegion] = useState<RegionInfo | null>(null)
  const mapRef = useRef<GameMapHandle>(null)
  const [selectedWarRegion, setSelectedWarRegion] = useState<Region | null>(null)

  // Hooks
  useKeyboardShortcuts()
  const { timeLeft, handleManualTick } = useGameLoop()
  const attack = useAttack(mapRef)
  useEffect(() => { initMockData() }, [])

  const handleMouseMove = useCallback((lat: string, lng: string) => {
    setMousePos({ lat, lng })
  }, [])

  const handleRegionClick = useCallback((info: RegionInfo) => {
    const playerIso = player.countryCode || 'US'
    const clickedIso = COUNTRY_ISO[info.name] || null
    if (!clickedIso) return
    if (clickedIso === playerIso) {
      setActivePanel('government')
    } else {
      setForeignCountry(clickedIso)
      setActivePanel('foreign_country')
    }
  }, [player.countryCode])

  return (
    <div className="xwar-root">
      <TopBar timeLeft={timeLeft} onManualTick={handleManualTick} />
      <NewsTicker />

      {/* ====== MAP AREA ====== */}
      <div className="hud-map">
        <GameMap
          ref={mapRef}
          countries={world.countries}
          onRegionClick={handleRegionClick}
          onMouseMove={handleMouseMove}
        />
        <BattleMapOverlay
          mapRef={mapRef}
          onRegionClick={(region) => {
            const playerIso = player.countryCode || 'US'
            if (useRegionStore.getState().canAttackRegion(region.id, playerIso)) {
              setSelectedWarRegion(region)
              mapRef.current?.flyTo(region.position[0], region.position[1], 5)
            } else if (region.controlledBy === playerIso) {
              useUIStore.getState().addFloatingText('Your territory', 400, 300, '#22d38a')
            } else {
              useUIStore.getState().addFloatingText('Cannot reach — no adjacent territory', 400, 300, '#ef4444')
            }
          }}
        />

        {/* Search Bar */}
        <div className="hud-search">
          <span className="hud-search__icon">🔍</span>
          <span className="hud-search__text">LOCATE</span>
          <span className="hud-search__slash">/</span>
        </div>

        <Sidebar />

        {/* Right Controls */}
        <div className="hud-controls">
          <button className="hud-control" title="Filter"><span>☰</span><span className="hud-control__label">FILTER</span></button>
          <button className="hud-control" title="Zoom In" onClick={() => mapRef.current?.zoomIn()}><span>+</span><span className="hud-control__label">ZOOM IN</span></button>
          <button className="hud-control" title="Zoom Out" onClick={() => mapRef.current?.zoomOut()}><span>−</span><span className="hud-control__label">ZOOM OUT</span></button>
          <button className="hud-control" title="Reset" onClick={() => mapRef.current?.resetView()}><span>⊞</span><span className="hud-control__label">RESET</span></button>
          <div className="hud-controls__divider" />
          <button className="hud-control" title="Settings"><span>⚙️</span><span className="hud-control__label">SETTINGS</span></button>
          <button className="hud-control" title="Help"><span>❓</span><span className="hud-control__label">HELP</span></button>
        </div>

        {/* Coordinates */}
        <div className="hud-coords">
          <div className="hud-coords__row">{mousePos.lat}</div>
          <div className="hud-coords__row">{mousePos.lng}</div>
        </div>

        <PanelRouter />
      </div>

      {/* ====== REGION POPUP ====== */}
      {selectedRegion && (
        <RegionPopup
          region={selectedRegion}
          onClose={() => setSelectedRegion(null)}
          onAttack={(e?: React.MouseEvent) => {
            attack(selectedRegion.name, e)
            setSelectedRegion(null)
          }}
        />
      )}

      {/* War Region Popup */}
      {selectedWarRegion && (
        <div className="region-attack-popup" style={{ zIndex: 9999 }}>
          <div className="region-attack-popup__card">
            <button className="region-attack-popup__close" onClick={() => setSelectedWarRegion(null)}>✕</button>
            <div className="region-attack-popup__header">
              <span className="region-attack-popup__flag"><CountryFlag iso={selectedWarRegion.countryCode} size={24} /></span>
              <div>
                <div className="region-attack-popup__name">{selectedWarRegion.name}</div>
                <div className="region-attack-popup__country">
                  {getCountryName(selectedWarRegion.countryCode)} — Defense: {selectedWarRegion.defense}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button
                className="region-attack-popup__btn"
                style={{ flex: 1, background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}
                onClick={() => { setActivePanel('missions'); setSelectedWarRegion(null) }}
              >🎖️ TO OPERATIONS</button>
              <button
                className="region-attack-popup__btn"
                style={{ flex: 1, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
                onClick={() => { setActivePanel('combat'); setSelectedWarRegion(null) }}
              >⚔️ TO ATTACK</button>
            </div>
          </div>
        </div>
      )}

      {/* Scanline Overlay */}
      <div className="hud-scanlines" />

      {/* Floating Texts */}
      <div className="hud-floating-container">
        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            className="hud-floating-text"
            style={{ left: `${ft.x}px`, top: `${ft.y}px`, color: ft.color }}
          >
            {ft.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
