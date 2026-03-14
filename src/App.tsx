import { useState, useCallback, useRef } from 'react'
import { useUIStore } from './stores/uiStore'
import { usePlayerStore } from './stores/playerStore'
import { useWorldStore } from './stores/worldStore'
import GameMap from './components/map/GameMap'
import type { GameMapHandle } from './components/map/GameMap'
import RegionPopup from './components/map/RegionPopup'

const SIDEBAR_ITEMS = [
  { id: 'combat' as const, icon: '⚔️', label: 'COMBAT' },
  { id: 'chat' as const, icon: '💬', label: 'CHAT' },
  { id: 'market' as const, icon: '📊', label: 'MARKET' },
  { id: 'companies' as const, icon: '🏭', label: 'COMPANIES' },
  { id: 'government' as const, icon: '🏛️', label: 'GOV' },
]

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
  const { activePanel, togglePanel } = useUIStore()
  const [mousePos, setMousePos] = useState({ lat: '0.00° N', lng: '0.00° E' })
  const [selectedRegion, setSelectedRegion] = useState<RegionInfo | null>(null)
  const mapRef = useRef<GameMapHandle>(null)

  const handleMouseMove = useCallback((lat: string, lng: string) => {
    setMousePos({ lat, lng })
  }, [])

  const handleRegionClick = useCallback((info: RegionInfo) => {
    setSelectedRegion(info)
  }, [])

  return (
    <div className="xwar-root">
      {/* ====== TOP BAR ====== */}
      <header className="hud-topbar">
        <div className="hud-topbar__left">
          <span className="hud-topbar__logo">⬡ XWAR</span>
          <span className="hud-topbar__beta">BETA</span>
        </div>
        <div className="hud-topbar__center">
          <button className="hud-tab hud-tab--active">THE MAP</button>
          <button className="hud-tab">LEADERBOARD</button>
        </div>
        <div className="hud-topbar__right">
          <button className="hud-btn-outline">
            <span className="hud-btn-icon">⚡</span> SIGN IN
          </button>
          <span className="hud-topbar__time">TURN {world.turn} • {player.name}</span>
        </div>
      </header>

      {/* ====== MAP AREA ====== */}
      <div className="hud-map">
        {/* Real map (Mapbox or fallback) */}
        <GameMap
          ref={mapRef}
          countries={world.countries}
          onRegionClick={handleRegionClick}
          onMouseMove={handleMouseMove}
        />

        {/* ====== SEARCH BAR ====== */}
        <div className="hud-search">
          <span className="hud-search__icon">🔍</span>
          <span className="hud-search__text">LOCATE</span>
          <span className="hud-search__slash">/</span>
        </div>

        {/* ====== LEFT SIDEBAR ====== */}
        <nav className="hud-sidebar">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`hud-sidebar__item ${activePanel === item.id ? 'hud-sidebar__item--active' : ''}`}
              onClick={() => togglePanel(item.id)}
            >
              <span className="hud-sidebar__icon">{item.icon}</span>
              <span className="hud-sidebar__label">{item.label}</span>
              {item.id === 'combat' && <span className="hud-sidebar__dot" />}
            </button>
          ))}
        </nav>

        {/* ====== RIGHT CONTROLS ====== */}
        <div className="hud-controls">
          <button className="hud-control" title="Filter"><span>☰</span><span className="hud-control__label">FILTER</span></button>
          <button className="hud-control" title="Zoom In" onClick={() => mapRef.current?.zoomIn()}><span>+</span><span className="hud-control__label">ZOOM IN</span></button>
          <button className="hud-control" title="Zoom Out" onClick={() => mapRef.current?.zoomOut()}><span>−</span><span className="hud-control__label">ZOOM OUT</span></button>
          <button className="hud-control" title="Reset" onClick={() => mapRef.current?.resetView()}><span>⊞</span><span className="hud-control__label">RESET</span></button>
          <div className="hud-controls__divider" />
          <button className="hud-control" title="Resources"><span>💰</span><span className="hud-control__label">RESOURCES</span></button>
          <button className="hud-control" title="Settings"><span>⚙️</span><span className="hud-control__label">SETTINGS</span></button>
          <button className="hud-control" title="Help"><span>❓</span><span className="hud-control__label">HELP</span></button>
        </div>

        {/* ====== COORDINATES ====== */}
        <div className="hud-coords">
          <div className="hud-coords__row">{mousePos.lat}</div>
          <div className="hud-coords__row">{mousePos.lng}</div>
        </div>

        {/* ====== RIGHT PANEL (opened) ====== */}
        {activePanel && (
          <aside className="hud-panel">
            <div className="hud-panel__header">
              <h3 className="hud-panel__title">{activePanel.toUpperCase()}</h3>
              <button className="hud-panel__close" onClick={() => togglePanel(activePanel)}>✕</button>
            </div>
            <div className="hud-panel__body">
              {activePanel === 'combat' && (
                <>
                  <div className="hud-card">
                    <div className="hud-card__title">⚔️ QUICK ATTACK</div>
                    <p className="hud-card__text">Select a region on the map to attack. Each attack costs Food + Oil.</p>
                    <div className="hud-card__stats">
                      <div className="hud-stat"><span className="hud-stat__label">RANK</span><span className="hud-stat__value">{Math.floor(player.rank)}</span></div>
                      <div className="hud-stat"><span className="hud-stat__label">FOOD</span><span className="hud-stat__value">{player.food}</span></div>
                      <div className="hud-stat"><span className="hud-stat__label">OIL</span><span className="hud-stat__value">{player.oil}</span></div>
                    </div>
                    <button className="hud-btn-primary" onClick={() => player.attack()}>LAUNCH ATTACK</button>
                  </div>
                  <div className="hud-card">
                    <div className="hud-card__title">📋 RECENT BATTLES</div>
                    <div className="hud-feed">
                      <div className="hud-feed__item"><span className="hud-feed__dot hud-feed__dot--win" />Won vs Russia — Sector 7 <span className="hud-feed__time">2m ago</span></div>
                      <div className="hud-feed__item"><span className="hud-feed__dot hud-feed__dot--loss" />Lost vs China — Sector 12 <span className="hud-feed__time">8m ago</span></div>
                      <div className="hud-feed__item"><span className="hud-feed__dot hud-feed__dot--win" />Won vs Turkey — Sector 3 <span className="hud-feed__time">15m ago</span></div>
                    </div>
                  </div>
                </>
              )}
              {activePanel === 'market' && (
                <div className="hud-card">
                  <div className="hud-card__title">📊 MARKET PRICES</div>
                  <div className="hud-market-list">
                    <div className="hud-market-row"><span>🌾 Food</span><span className="hud-market-price">$12.50</span><span className="hud-market-change hud-market-change--up">+3.2%</span></div>
                    <div className="hud-market-row"><span>🛢️ Oil</span><span className="hud-market-price">$28.70</span><span className="hud-market-change hud-market-change--down">-1.8%</span></div>
                    <div className="hud-market-row"><span>⚛️ Material X</span><span className="hud-market-price">$450</span><span className="hud-market-change hud-market-change--up">+12.5%</span></div>
                    <div className="hud-market-row"><span>⚔️ Equipment</span><span className="hud-market-price">$85</span><span className="hud-market-change hud-market-change--up">+0.5%</span></div>
                  </div>
                </div>
              )}
              {activePanel === 'companies' && (
                <div className="hud-card">
                  <div className="hud-card__title">🏭 YOUR COMPANIES</div>
                  <p className="hud-card__text">You own {player.companiesOwned} companies producing resources each turn.</p>
                </div>
              )}
              {activePanel === 'government' && (
                <div className="hud-card">
                  <div className="hud-card__title">🏛️ GOVERNMENT</div>
                  <p className="hud-card__text">Active wars: {world.wars.filter(w => w.status === 'active').length}</p>
                </div>
              )}
              {activePanel === 'chat' && (
                <div className="hud-card">
                  <div className="hud-card__title">💬 AI ADVISOR</div>
                  <div className="hud-chat">
                    <div className="hud-chat__bubble hud-chat__bubble--ai">Welcome Commander. What's your role — Military, Business, or Politics?</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ====== REGION POPUP ====== */}
      {selectedRegion && (
        <RegionPopup
          region={selectedRegion}
          onClose={() => setSelectedRegion(null)}
          onAttack={() => {
            player.attack()
            setSelectedRegion(null)
          }}
        />
      )}

      {/* ====== SCANLINE OVERLAY ====== */}
      <div className="hud-scanlines" />
    </div>
  )
}

export default App
