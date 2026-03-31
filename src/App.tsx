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
import BattleMapOverlay from './components/map/BattleMapOverlay'
import TopBar from './components/layout/TopBar'
// Sidebar is now integrated into PanelRouter
import NewsTicker from './components/layout/NewsTicker'
import PanelRouter from './components/layout/PanelRouter'
import DailyRewardPopup from './components/shared/DailyRewardPopup'
import WelcomeKitModal from './components/shared/WelcomeKitModal'
import AntiBotChallenge from './components/shared/AntiBotChallenge'
import { COUNTRY_ISO } from './data/countries'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useGameLoop } from './hooks/useGameLoop'
import { useAttack } from './hooks/useAttack'
import { initMockData } from './dev/mockData'
import { initSocketHooks } from './api/socket-hooks'
import AuthScreen from './components/auth/AuthScreen'
import { useCompanyStore } from './stores/companyStore'
import { useAuthStore } from './stores/authStore'
import ActionBar from './components/layout/ActionBar'
import NewsSlideshow from './components/layout/NewsSlideshow'
import WorldNewsWidget from './components/layout/WorldNewsWidget'
import NotificationToast from './components/shared/NotificationToast'
import SearchOverlay from './components/map/SearchOverlay'
import MapFilterOverlay from './components/map/MapFilterOverlay'
import BattleSlider from './components/map/BattleSlider'
import './styles/ticker.css'


function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const player = usePlayerStore()
  const world = useWorldStore()
  const { floatingTexts, setActivePanel, setForeignCountry, setSelectedRegionId, setMapTarget } = useUIStore()
  const [mousePos, setMousePos] = useState({ lat: '0.00° N', lng: '0.00° E' })
  const mapRef = useRef<GameMapHandle>(null)
  const [selectedWarRegion, setSelectedWarRegion] = useState<Region | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  // Global "/" key opens search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === '/' && !searchOpen) { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [searchOpen])

  // Hooks
  useKeyboardShortcuts()
  const { timeLeft, handleManualTick } = useGameLoop()
  const attack = useAttack(mapRef)
  
  useEffect(() => { 
    initMockData() 
  }, [])

  // Sync player data from backend on mount if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      usePlayerStore.getState().fetchPlayer().catch(() => {})
      useCompanyStore.getState().fetchAll()

      // ── Init socket hooks (battle:started, battle:state, occupation updates, etc.) ──
      import('./api/socket').then(({ socketManager }) => {
        socketManager.connect()
        initSocketHooks()
      })

      // ── Hydrate active battles from API on every (re)load ──
      Promise.all([
        import('./api/client'),
        import('./api/socket'),
      ]).then(([{ getActiveBattles }, { socketManager }]) => {
        getActiveBattles().then((res: any) => {
          if (!res?.battles?.length) return
          const toAdd: Record<string, any> = {}
          for (const b of res.battles) {
            // Join battle socket room so we receive battle:state ticks
            socketManager.joinBattle(b.id)

            toAdd[b.id] = {
              id: b.id, type: b.type ?? 'invasion',
              attackerId: b.attackerId, defenderId: b.defenderId,
              regionName: b.regionName, startedAt: b.startedAt,
              ticksElapsed: b.ticksElapsed ?? 0, status: b.status,
              // Preserve full attacker/defender objects from server
              attacker: b.attacker ?? { countryCode: b.attackerId, damageDealt: b.attackerDamage ?? 0 },
              defender: b.defender ?? { countryCode: b.defenderId, damageDealt: b.defenderDamage ?? 0 },
              attackerRoundsWon: b.attackerRoundsWon ?? 0, defenderRoundsWon: b.defenderRoundsWon ?? 0,
              // Preserve full round objects (including attackerDmgTotal, defenderDmgTotal for ground-point calculation)
              rounds: Array.isArray(b.rounds) && b.rounds.length > 0
                ? b.rounds
                : [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: b.startedAt }],
              currentTick: b.currentTick ?? { attackerDamage: 0, defenderDamage: 0 },
              combatLog: Array.isArray(b.combatLog) && b.combatLog.length > 0 ? b.combatLog : [],
              attackerDamageDealers: b.attackerDamageDealers ?? {},
              defenderDamageDealers: b.defenderDamageDealers ?? {},
              damageFeed: b.damageFeed ?? [],
              attackerOrder: b.attackerOrder ?? 'none' as const,
              defenderOrder: b.defenderOrder ?? 'none' as const,
              orderMessage: b.orderMessage ?? '', motd: b.motd ?? '', playerBattleStats: b.playerBattleStats ?? {},
              playerAdrenaline: {}, playerSurge: {}, playerCrash: {}, playerAdrenalinePeakAt: {},
              vengeanceBuff: { attacker: -1, defender: -1 },
              mercenaryContracts: [], weaponPresence: { attacker: {}, defender: {} },
            }
          }
          useBattleStore.setState((s: any) => ({ battles: { ...toAdd, ...s.battles } }))
          console.log(`[App] Hydrated ${Object.keys(toAdd).length} active battle(s) on load`)
        }).catch(() => {})
      })
    }
  }, [isAuthenticated])

  const handleMouseMove = useCallback((lat: string, lng: string) => {
    setMousePos({ lat, lng })
  }, [])

  const handleRegionClick = useCallback((region: Region) => {
    const { selectedRegionId, activePanel } = useUIStore.getState()

    // ── Military targeting mode: any click → set map target ──
    if (activePanel === 'military' && !region.isOcean) {
      const playerIso = usePlayerStore.getState().countryCode || 'US'
      // Can only target foreign countries
      if (region.countryCode !== playerIso) {
        setMapTarget(region.countryCode, region.id, region.name)
        useUIStore.getState().addFloatingText(
          `🎯 Target: ${region.name}`,
          window.innerWidth / 2,
          window.innerHeight / 2,
          '#06b6d4'
        )
        return
      }
    }

    if (selectedRegionId === region.id) {
      // Already selected → open country tab
      if (region.isOcean) return
      const playerIso = usePlayerStore.getState().countryCode || 'US'
      if (region.countryCode === playerIso) {
        setActivePanel('government')
      } else {
        setForeignCountry(region.countryCode)
        setActivePanel('foreign_country')
      }
      return
    }
    setSelectedRegionId(region.id)
    setActivePanel('region')
  }, [setSelectedRegionId, setActivePanel, setForeignCountry, setMapTarget])

  const handleRegionDoubleClick = useCallback((region: Region) => {
    if (region.isOcean) return // Usually nothing special on double click for ocean
    
    // Default to country panel behavior
    const playerIso = usePlayerStore.getState().countryCode || 'US'
    if (region.countryCode === playerIso) {
      setActivePanel('government')
    } else {
      setForeignCountry(region.countryCode)
      setActivePanel('foreign_country')
    }
  }, [setActivePanel, setForeignCountry])

  return (
    <div className="xwar-root">
      {!isAuthenticated && <AuthScreen />}
      
      {isAuthenticated && (
        <>
          <TopBar timeLeft={timeLeft} onManualTick={handleManualTick} />
          <NewsTicker />

      {/* ====== MAP AREA ====== */}
      <div className="hud-map">
        <GameMap
          ref={mapRef}
          countries={world.countries}
          onRegionClick={handleRegionClick}
          onRegionDoubleClick={handleRegionDoubleClick}
          onMouseMove={handleMouseMove}
        />
        <BattleMapOverlay
          mapRef={mapRef}
          onRegionClick={(region) => {
            // Battle overlay intercepts clicks during war selection
            if (region.isOcean) {
              handleRegionClick(region)
              return
            }
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
        <div className="hud-search" onClick={() => setSearchOpen(true)} style={{ cursor: 'pointer' }}>
          <span className="hud-search__icon">🔍</span>
          <span className="hud-search__text">LOCATE</span>
          <span className="hud-search__slash">/</span>
        </div>

        {/* Search Overlay */}
        {searchOpen && <SearchOverlay mapRef={mapRef} onClose={() => setSearchOpen(false)} />}

        {/* Map Filter Overlay */}
        {filterOpen && <MapFilterOverlay mapRef={mapRef} />}

        <ActionBar />

        <BattleSlider />

        <NewsSlideshow />
        <WorldNewsWidget />

        {/* Left Controls */}
        <div className="hud-controls">
          <button className="hud-control" title="Filter" onClick={() => setFilterOpen(f => !f)}><span>☰</span><span className="hud-control__label">FILTER</span></button>
          <button className="hud-control" title="Zoom In" onClick={() => mapRef.current?.zoomIn()}><span>+</span><span className="hud-control__label">ZOOM IN</span></button>
          <button className="hud-control" title="Zoom Out" onClick={() => mapRef.current?.zoomOut()}><span>−</span><span className="hud-control__label">ZOOM OUT</span></button>
          <button className="hud-control" title="Reset" onClick={() => mapRef.current?.resetView()}><span>⊞</span><span className="hud-control__label">RESET</span></button>
          <div className="hud-controls__divider" />
          <button className="hud-control" title="Settings" onClick={() => setActivePanel('settings')}><span>⚙️</span><span className="hud-control__label">SETTINGS</span></button>
          <button className="hud-control" title="Help" onClick={() => setActivePanel('help')}><span>❓</span><span className="hud-control__label">HELP</span></button>
        </div>

        {/* Coordinates */}
        <div className="hud-coords">
          <div className="hud-coords__row">{mousePos.lat}</div>
          <div className="hud-coords__row">{mousePos.lng}</div>
        </div>

        <PanelRouter />
      </div>

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

      {/* Daily Login Reward Popup */}
      <DailyRewardPopup />

      {/* Welcome Kit (one-time) */}
      <WelcomeKitModal />

      {/* Anti-Bot Verification Popup */}
      <AntiBotChallenge />

      {/* Scanline Overlay */}
      <div className="hud-scanlines" />

      {/* Toast Notifications */}
      <NotificationToast />

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
        </>
      )}
    </div>
  )
}

export default App
