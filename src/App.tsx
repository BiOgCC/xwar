import { useState, useCallback, useRef, useEffect } from 'react'
import { useUIStore } from './stores/uiStore'
import { usePlayerStore } from './stores/playerStore'
import { useWorldStore } from './stores/worldStore'
import { useCompanyStore } from './stores/companyStore'
import { useBattleStore, getCountryFlag, getCountryName } from './stores/battleStore'
import { useInventoryStore } from './stores/inventoryStore'
import { useSkillsStore } from './stores/skillsStore'
import { useCyberStore } from './stores/cyberStore'
import { useArmyStore } from './stores/armyStore'
import { useRegionStore } from './stores/regionStore'
import type { Region } from './stores/regionStore'
import GameMap from './components/map/GameMap'
import { COUNTRY_CENTROIDS } from './components/map/GameMap'
import type { GameMapHandle } from './components/map/GameMap'
import RegionPopup from './components/map/RegionPopup'
import BattleMapOverlay from './components/map/BattleMapOverlay'
import ProfilePanel from './components/panels/ProfilePanel'
import GovernmentPanel from './components/panels/GovernmentPanel'
import MilitaryPanel from './components/panels/MilitaryPanel'
import CyberwarfarePanel from './components/panels/CyberwarfarePanel'
import MissionsPanel from './components/panels/MissionsPanel'
import PrestigePanel from './components/panels/PrestigePanel'
import WarPanel from './components/panels/WarPanel'

const SIDEBAR_CIVILIAN = [
  { id: 'profile' as const, icon: '👤', label: 'PROFILE' },
  { id: 'market' as const, icon: '📊', label: 'MARKET' },
  { id: 'companies' as const, icon: '🏭', label: 'COMPANIES' },
  { id: 'resources' as const, icon: '💰', label: 'RESOURCES' },
  { id: 'chat' as const, icon: '💬', label: 'CHAT' },
]

const SIDEBAR_WAR = [
  { id: 'government' as const, icon: '🏛️', label: 'COUNTRY' },
  { id: 'missions' as const, icon: '📋', label: 'MISSIONS' },
  { id: 'combat' as const, icon: '⚔️', label: 'COMBAT' },
  { id: 'cyberwarfare' as const, icon: '🖥️', label: 'CYBER' },
  { id: 'military' as const, icon: '🎖️', label: 'MILITARY' },
]

const SIDEBAR_EXTRA = [
  { id: 'prestige' as const, icon: '⭐', label: 'PRESTIGE' },
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

const COUNTRY_ISO: Record<string, string> = {
  'United States': 'US',
  'Russia': 'RU',
  'China': 'CN',
  'Germany': 'DE',
  'Brazil': 'BR',
  'India': 'IN',
  'Nigeria': 'NG',
  'Japan': 'JP',
  'United Kingdom': 'GB',
  'Turkey': 'TR',
  'Canada': 'CA',
  'Mexico': 'MX',
  'Cuba': 'CU',
  'Bahamas': 'BS',
}

function App() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const battleStore = useBattleStore()
  const inventory = useInventoryStore()
  const equipped = inventory.getEquipped()
  const skillsStore = useSkillsStore()
  
  // Calculate Combat Stats for Panel Display
  let eqDmg = 0, eqCritRate = 0, eqCritDmg = 0, eqArmor = 0, eqDodge = 0, eqPrecision = 0
  equipped.forEach((item: any) => {
    if (item.stats.damage) eqDmg += item.stats.damage
    if (item.stats.critRate) eqCritRate += item.stats.critRate
    if (item.stats.critDamage) eqCritDmg += item.stats.critDamage
    if (item.stats.armor) eqArmor += item.stats.armor
    if (item.stats.dodge) eqDodge += item.stats.dodge
    if (item.stats.precision) eqPrecision += item.stats.precision
  })
  const mil = skillsStore.military
  const finalDmg = 100 + eqDmg + (mil.attack * 20)
  const finalCritRate = 10 + eqCritRate + (mil.critRate * 5)
  const finalCritDmg = 100 + eqCritDmg + (mil.critDamage * 20)
  const finalArmor = 0 + eqArmor + (mil.armor * 5)
  const finalDodge = 5 + eqDodge + (mil.dodge * 5)
  const finalHitRate = Math.min(100, 50 + eqPrecision + (mil.precision * 5))

  const { activePanel, togglePanel, floatingTexts, cycleResourceView, resourceViewMode, setProfileDefaultTab, setActivePanel } = useUIStore()
  const [mousePos, setMousePos] = useState({ lat: '0.00° N', lng: '0.00° E' })
  const [selectedRegion, setSelectedRegion] = useState<RegionInfo | null>(null)
  const mapRef = useRef<GameMapHandle>(null)
  const [expandedBattle, setExpandedBattle] = useState<string | null>(null)
  const [swapSlot, setSwapSlot] = useState<string | null>(null)
  const [selectedWarRegion, setSelectedWarRegion] = useState<Region | null>(null)

  // 30 min (1800s) Game Tick Timer
  const [timeLeft, setTimeLeft] = useState(1800)

  useEffect(() => {
    const interval = setInterval(() => {
      // Resolve any active battles whose ticks have expired
      useBattleStore.getState().resolveTicksAndRounds()
      
      setTimeLeft((prev) => {
        if (prev <= 1) {
          useCompanyStore.getState().processTick()
          return 1800
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Region capture tick — every 10 seconds, advance captures
  useEffect(() => {
    const ticker = setInterval(() => {
      useRegionStore.getState().tickCapture()
    }, 10000)
    return () => clearInterval(ticker)
  }, [])

  // ====== MOCK ACTIVE CAMPAIGNS FOR TESTING ======
  useEffect(() => {
    const cyberState = useCyberStore.getState()
    const militaryState = import('./stores/militaryStore').then(mod => {
      const ms = mod.useMilitaryStore.getState()
      
      // Only init if empty
      if (Object.keys(cyberState.campaigns).length === 0) {
        cyberState.launchCampaign('company_sabotage', { country: 'RU' }, ['Player2', 'Player3'])
        cyberState.launchCampaign('resource_intel', { country: 'CN' }, [])
      }

      if (Object.keys(ms.campaigns).length === 0) {
        ms.launchCampaign('assault', 'CA', ['General_Y'])
        ms.launchCampaign('naval_strike', 'CU', [])
      }
    })
  }, [])

  const handleManualTick = () => {
    useCompanyStore.getState().processTick()
    setTimeLeft(1800)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

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
        <div className="hud-topbar__left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="hud-topbar__logo">⬡ XWAR</span>
          <span className="hud-topbar__beta">BETA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px', background: 'rgba(34,211,138,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(34,211,138,0.2)' }}>
            <span style={{ fontSize: '10px' }}>⏱️</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700, color: '#22d38a' }}>{formatTime(timeLeft)}</span>
            <button onClick={handleManualTick} style={{ background: '#22d38a', color: '#000', border: 'none', borderRadius: '2px', fontSize: '8px', fontWeight: 'bold', padding: '2px 4px', cursor: 'pointer', marginLeft: '4px' }}>+30m</button>
          </div>
        </div>
        <div className="hud-topbar__center" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="hud-tab hud-tab--active">THE MAP</button>
            <button className="hud-tab">LEADERBOARD</button>
          </div>

          {/* Player Status Bars Phase */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Energy">
              <span style={{ fontSize: '12px' }}>🍖</span>
              <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(player.hunger/player.maxHunger)*100}%`, height: '100%', background: '#f59e0b', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.hunger)}/{player.maxHunger}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Stamina">
              <span style={{ fontSize: '12px' }}>⚡</span>
              <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(player.stamina/player.maxStamina)*100}%`, height: '100%', background: '#ef4444', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.stamina)}/{player.maxStamina}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Pleasure">
              <span style={{ fontSize: '12px' }}>💼</span>
              <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(player.entrepreneurship/player.maxEntrepreneurship)*100}%`, height: '100%', background: '#a855f7', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.entrepreneurship)}/{player.maxEntrepreneurship}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Work">
              <span style={{ fontSize: '12px' }}>🔨</span>
              <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${(player.work/player.maxWork)*100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.work)}/{player.maxWork}</span>
            </div>
          </div>
        </div>
        <div className="hud-topbar__right">
          <div className="hud-wealth-display" style={{ display: 'flex', gap: '16px', marginRight: '16px', alignItems: 'center' }}>
            <span style={{ color: '#22d38a', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
              ${player.money.toLocaleString()}
            </span>
            <span style={{ color: '#f59e0b', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
              ₿ {player.bitcoin.toLocaleString()}
            </span>
          </div>
          <button className="hud-btn-outline">
            <span className="hud-btn-icon">⚡</span> SIGN IN
          </button>
          <span className="hud-topbar__time">TURN {world.turn} • {player.name}</span>
        </div>
      </header>

      {/* ====== MAP AREA ====== */}
      <div className="hud-map">
        {/* Always show the map */}
        <GameMap
          ref={mapRef}
          countries={world.countries}
          onRegionClick={handleRegionClick}
          onMouseMove={handleMouseMove}
        />
        {/* Battle overlay — shows region markers, troops, capture progress */}
        <BattleMapOverlay
          mapRef={mapRef}
          onRegionClick={(region) => {
            const playerIso = player.countryCode || 'US'
            if (useRegionStore.getState().canAttackRegion(region.id, playerIso)) {
              setSelectedWarRegion(region)
              // Fly camera to region
              mapRef.current?.flyTo(region.position[0], region.position[1], 5)
            } else if (region.controlledBy === playerIso) {
              useUIStore.getState().addFloatingText('Your territory', 400, 300, '#22d38a')
            } else {
              useUIStore.getState().addFloatingText('Cannot reach — no adjacent territory', 400, 300, '#ef4444')
            }
          }}
        />

        {/* ====== SEARCH BAR ====== */}
        <div className="hud-search">
          <span className="hud-search__icon">🔍</span>
          <span className="hud-search__text">LOCATE</span>
          <span className="hud-search__slash">/</span>
        </div>

        {/* ====== LEFT SIDEBAR ====== */}
        <nav className="hud-sidebar">
          {/* CIVILIAN GROUP (Blue) */}
          <div style={{ border: '1px solid rgba(59,130,246,0.35)', borderRadius: '8px', padding: '4px 0', marginBottom: '6px', position: 'relative' }}>
            {SIDEBAR_CIVILIAN.map((item) => (
              <button
                key={item.id}
                className={`hud-sidebar__item ${(item.id === 'companies' ? activePanel === 'profile' : activePanel === item.id) ? 'hud-sidebar__item--active' : ''}`}
                onClick={() => {
                  if (item.id === 'companies') {
                    setProfileDefaultTab('companies')
                    setActivePanel('profile')
                  } else if (item.id === 'resources') {
                    if (activePanel === 'resources') {
                      cycleResourceView()
                    } else {
                      togglePanel('resources')
                    }
                  } else {
                    togglePanel(item.id)
                  }
                }}
              >
                <span className="hud-sidebar__icon">{item.icon}</span>
                <span className="hud-sidebar__label">
                  {item.id === 'resources' && activePanel === 'resources'
                    ? resourceViewMode === 'deposits' ? 'DEPOSITS'
                    : resourceViewMode === 'strategic' ? 'STRATEGIC'
                    : 'POLITICAL'
                  : item.label}
                </span>
              </button>
            ))}
          </div>

          {/* WAR GROUP (Red) */}
          <div style={{ border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', padding: '4px 0', marginBottom: '6px', position: 'relative' }}>
            {SIDEBAR_WAR.map((item) => (
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
          </div>

          {/* EXTRA (Prestige) */}
          {SIDEBAR_EXTRA.map((item) => (
            <button
              key={item.id}
              className={`hud-sidebar__item ${activePanel === item.id ? 'hud-sidebar__item--active' : ''}`}
              onClick={() => togglePanel(item.id)}
            >
              <span className="hud-sidebar__icon">{item.icon}</span>
              <span className="hud-sidebar__label">{item.label}</span>
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
              <h3 className="hud-panel__title">
                {activePanel === 'government' 
                  ? `COUNTRY — ${getCountryName(player.countryCode || 'US').toUpperCase()}` 
                  : activePanel === 'missions'
                  ? 'MISSIONS: ENABLE OPERATIONS BY COMPLETING THEM'
                  : activePanel.toUpperCase()}
              </h3>
              <button className="hud-panel__close" onClick={() => togglePanel(activePanel)}>✕</button>
            </div>
            <div className="hud-panel__body">
              {activePanel === 'profile' && <ProfilePanel />}
              {activePanel === 'military' && <MilitaryPanel />}
              {activePanel === 'combat' && <WarPanel />}
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
              {activePanel === 'resources' && (
                <>
                  <div className="hud-card">
                    <div className="hud-card__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        {resourceViewMode === 'deposits' && '⛏️ REGIONAL DEPOSITS'}
                        {resourceViewMode === 'strategic' && '🌟 STRATEGIC RESOURCES'}
                        {resourceViewMode === 'political' && '🏳️ POLITICAL MAP'}
                      </span>
                      <button
                        onClick={() => cycleResourceView()}
                        style={{ fontSize: '9px', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        ⟳ Cycle View
                      </button>
                    </div>
                  </div>

                  {resourceViewMode === 'deposits' && (
                    <div className="hud-card">
                      {world.countries.map(c => {
                        const deps = (world as any).deposits?.filter?.((d: any) => d.countryCode === c.code) || []
                        if (deps.length === 0) return null
                        return (
                          <div key={c.code} style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '11px', color: c.color, marginBottom: '2px' }}>
                              {c.code} • {c.name}
                            </div>
                            {deps.map((d: any) => (
                              <div key={d.id} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', padding: '1px 0', color: d.active ? '#22d38a' : 'rgba(255,255,255,0.4)' }}>
                                <span>{d.type.toUpperCase()} +{d.bonus}%</span>
                                <span>{d.active ? `✓ ${d.discoveredBy}` : '🔒 Undiscovered'}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {resourceViewMode === 'strategic' && (
                    <div className="hud-card">
                      {world.countries.map(c => {
                        if (c.conqueredResources.length === 0) return null
                        return (
                          <div key={c.code} style={{ marginBottom: '8px' }}>
                            <div style={{ fontWeight: 700, fontSize: '11px', color: c.color, marginBottom: '2px' }}>
                              {c.code} • {c.name}
                            </div>
                            <div style={{ fontSize: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {c.conqueredResources.map((r, i) => (
                                <span key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '3px', color: '#f59e0b' }}>
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {resourceViewMode === 'political' && (
                    <div className="hud-card">
                      {['NATO', 'Eastern Bloc', null].map(empire => {
                        const members = world.countries.filter(c => c.empire === empire)
                        if (members.length === 0) return null
                        return (
                          <div key={empire || 'neutral'} style={{ marginBottom: '10px' }}>
                            <div style={{ fontWeight: 700, fontSize: '11px', color: empire === 'NATO' ? '#3b82f6' : empire === 'Eastern Bloc' ? '#ef4444' : '#10b981', marginBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px' }}>
                              {empire || 'Non-Aligned'}
                            </div>
                            {members.map(c => (
                              <div key={c.code} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                                <span style={{ color: c.color }}>{c.code} {c.name}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{c.controller}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
              {activePanel === 'government' && (
                <GovernmentPanel />
              )}
              {activePanel === 'cyberwarfare' && (
                <CyberwarfarePanel />
              )}
              {activePanel === 'missions' && (
                <MissionsPanel />
              )}
              {activePanel === 'prestige' && (
                <PrestigePanel />
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
          onAttack={(e?: React.MouseEvent) => {
            const defenderIso = COUNTRY_ISO[selectedRegion.name]
            if (defenderIso) {
              const attackerIso = player.countryCode || 'US'
              const bs = useBattleStore.getState()
              const as2 = useArmyStore.getState()
              
              if (world.canAttack(attackerIso, defenderIso)) {
                // Find player's first army with ready divisions
                const myArmies = Object.values(as2.armies).filter(a => a.countryCode === attackerIso)
                const armyWithDivs = myArmies.find(a => 
                  a.divisionIds.some(id => as2.divisions[id]?.status === 'ready')
                )
                
                if (armyWithDivs) {
                  // Launch HOI4-style battle with divisions
                  const result = bs.launchHOIBattle(armyWithDivs.id, defenderIso, 'invasion')
                  
                  if (result.success) {
                    // Fly camera to the battle zone (halfway between attacker and defender)
                    const atkCoord = COUNTRY_CENTROIDS[selectedRegion.name] || COUNTRY_CENTROIDS['United States']
                    if (atkCoord && mapRef.current) {
                      mapRef.current.flyTo(atkCoord[0], atkCoord[1], 4)
                    }
                  }
                  
                  if (e) {
                    useUIStore.getState().addFloatingText('⚔️ BATTLE LAUNCHED!', e.clientX, e.clientY, '#ef4444')
                  }
                } else {
                  // Fallback to legacy attack if no army
                  bs.launchAttack(attackerIso, defenderIso, selectedRegion.name)
                  const { damage, isCrit, isDodged } = player.attack()
                  const activeBattle = Object.values(bs.battles).find(
                    b => b.regionName === selectedRegion.name && b.status === 'active'
                  )
                  if (activeBattle && (damage > 0 || isDodged)) {
                    bs.addDamage(activeBattle.id, 'attacker', damage, isCrit, isDodged, player.name)
                  }
                  if (e) {
                    useUIStore.getState().addFloatingText('ATTACK LAUNCHED', e.clientX, e.clientY, '#ef4444')
                  }
                }
              } else {
                // Declare war first if not at war, then allow attack
                world.declareWar(attackerIso, defenderIso)
                useUIStore.getState().addFloatingText('⚠️ WAR DECLARED! Click again to attack.', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
              }
            }
            setSelectedRegion(null)
          }}
        />
      )}

      {/* ====== REGION ATTACK POPUP ====== */}
      {selectedWarRegion && (
        <div className="region-attack-popup" style={{ zIndex: 9999 }}>
          <div className="region-attack-popup__card">
            <button className="region-attack-popup__close" onClick={() => setSelectedWarRegion(null)}>✕</button>
            <div className="region-attack-popup__header">
              <span className="region-attack-popup__flag">{getCountryFlag(selectedWarRegion.countryCode)}</span>
              <div>
                <div className="region-attack-popup__name">{selectedWarRegion.name}</div>
                <div className="region-attack-popup__country">
                  {getCountryName(selectedWarRegion.countryCode)} — Defense: {selectedWarRegion.defense}
                </div>
              </div>
            </div>
            {selectedWarRegion.attackedBy ? (() => {
              // Show assigned divisions with health
              const as2 = useArmyStore.getState()
              const army = selectedWarRegion.assignedArmyId ? as2.armies[selectedWarRegion.assignedArmyId] : null
              const divs = army ? army.divisionIds.map(id => as2.divisions[id]).filter(Boolean) : []

              return (
                <div className="region-attack-popup__status">
                  <div className="region-attack-popup__progress-label">
                    CAPTURING: {Math.round(selectedWarRegion.captureProgress)}%
                  </div>
                  <div className="region-attack-popup__bar">
                    <div className="region-attack-popup__fill" style={{ width: `${selectedWarRegion.captureProgress}%` }} />
                  </div>

                  {/* Show divisions fighting */}
                  {divs.length > 0 && (
                    <div className="region-attack-popup__divs">
                      <div className="region-attack-popup__divs-title">🪖 ENGAGED DIVISIONS</div>
                      {divs.map(d => {
                        const hpPct = Math.round((d.manpower / d.maxManpower) * 100)
                        const isLow = hpPct < 30
                        return (
                          <div key={d.id} className="region-attack-popup__div-row">
                            <span className="region-attack-popup__div-name">{d.name}</span>
                            <div className="region-attack-popup__div-hp-bar">
                              <div className={`region-attack-popup__div-hp-fill ${isLow ? 'region-attack-popup__div-hp-fill--low' : ''}`}
                                style={{ width: `${hpPct}%` }} />
                            </div>
                            <span className="region-attack-popup__div-hp-text">
                              {Math.round(d.manpower)}/{d.maxManpower}
                            </span>
                            <span className="region-attack-popup__div-morale" title="Morale">
                              💪{Math.round(d.morale)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <button
                    className="region-attack-popup__btn region-attack-popup__btn--cancel"
                    onClick={() => {
                      useRegionStore.getState().stopAttack(selectedWarRegion.id)
                      setSelectedWarRegion(null)
                    }}
                  >🛑 WITHDRAW</button>
                </div>
              )
            })() : (
              <button
                className="region-attack-popup__btn"
                onClick={() => {
                  const playerIso = player.countryCode || 'US'
                  // Find player's best army with ready divisions
                  const as2 = useArmyStore.getState()
                  const bs = useBattleStore.getState()
                  const myArmies = Object.values(as2.armies).filter(a => a.countryCode === playerIso)
                  const armyWithDivs = myArmies.find(a =>
                    a.divisionIds.some(id => as2.divisions[id]?.status === 'ready' || as2.divisions[id]?.status === 'in_combat')
                  )

                  if (armyWithDivs) {
                    // Start region capture with linked army
                    useRegionStore.getState().attackRegion(selectedWarRegion.id, playerIso, armyWithDivs.id)
                    bs.launchHOIBattle(armyWithDivs.id, selectedWarRegion.countryCode, 'invasion')
                    useUIStore.getState().addFloatingText(
                      `⚔️ PUSHING INTO ${selectedWarRegion.name.toUpperCase()}!`,
                      window.innerWidth / 2, window.innerHeight / 2, '#ef4444'
                    )
                  } else {
                    useUIStore.getState().addFloatingText(
                      '❌ No army available! Recruit divisions first.',
                      window.innerWidth / 2, window.innerHeight / 2, '#ef4444'
                    )
                  }
                  setSelectedWarRegion(null)
                }}
              >⚔️ PUSH INTO {selectedWarRegion.name.toUpperCase()}</button>
            )}
          </div>
        </div>
      )}

      {/* ====== SCANLINE OVERLAY ====== */}
      <div className="hud-scanlines" />

      {/* ====== FLOATING TEXTS ====== */}
      <div className="hud-floating-container">
        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            className="hud-floating-text"
            style={{
              left: `${ft.x}px`,
              top: `${ft.y}px`,
              color: ft.color,
            }}
          >
            {ft.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
