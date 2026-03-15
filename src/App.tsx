import { useState, useCallback, useRef, useEffect } from 'react'
import { useUIStore } from './stores/uiStore'
import { usePlayerStore } from './stores/playerStore'
import { useWorldStore } from './stores/worldStore'
import { useCompanyStore } from './stores/companyStore'
import { useBattleStore, getCountryFlag, getCountryName } from './stores/battleStore'
import { useInventoryStore } from './stores/inventoryStore'
import { useSkillsStore } from './stores/skillsStore'
import GameMap from './components/map/GameMap'
import type { GameMapHandle } from './components/map/GameMap'
import RegionPopup from './components/map/RegionPopup'
import ProfilePanel from './components/panels/ProfilePanel'
import GovernmentPanel from './components/panels/GovernmentPanel'
import MilitaryPanel from './components/panels/MilitaryPanel'
import CyberwarfarePanel from './components/panels/CyberwarfarePanel'
import MissionsPanel from './components/panels/MissionsPanel'
import PrestigePanel from './components/panels/PrestigePanel'

const SIDEBAR_CIVILIAN = [
  { id: 'profile' as const, icon: '👤', label: 'PROFILE' },
  { id: 'market' as const, icon: '📊', label: 'MARKET' },
  { id: 'companies' as const, icon: '🏭', label: 'COMPANIES' },
  { id: 'resources' as const, icon: '💰', label: 'RESOURCES' },
  { id: 'chat' as const, icon: '💬', label: 'CHAT' },
]

const SIDEBAR_WAR = [
  { id: 'government' as const, icon: '🏛️', label: 'GOV' },
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
              <h3 className="hud-panel__title">{activePanel.toUpperCase()}</h3>
              <button className="hud-panel__close" onClick={() => togglePanel(activePanel)}>✕</button>
            </div>
            <div className="hud-panel__body">
              {activePanel === 'profile' && <ProfilePanel />}
              {activePanel === 'military' && <MilitaryPanel />}
              {activePanel === 'combat' && (
                <>
                  {Object.values(battleStore.battles).filter(b => b.status === 'active').map(battle => {
                    const activeRound = battle.rounds[battle.rounds.length - 1]
                    const topAttackerArr = Object.entries(battle.attackerDamageDealers || {}).sort((a, b) => b[1] - a[1])[0]
                    const topDefenderArr = Object.entries(battle.defenderDamageDealers || {}).sort((a, b) => b[1] - a[1])[0]
                    const feed = battle.damageFeed || []
                    const timeRemaining = Math.max(0, Math.floor((battle.currentTick.endTime - Date.now()) / 1000))
                    const atkFlag = getCountryFlag(battle.attackerId)
                    const defFlag = getCountryFlag(battle.defenderId)
                    const atkName = getCountryName(battle.attackerId)
                    const defName = getCountryName(battle.defenderId)
                    const atkPts = activeRound?.attackerPoints || 0
                    const defPts = activeRound?.defenderPoints || 0
                    const totalPts = Math.max(1, atkPts + defPts)
                    const isExpanded = expandedBattle === battle.id
                    
                    return (
                      <div key={battle.id} className="hud-card" style={{ borderColor: isExpanded ? '#f59e0b' : '#ef4444', padding: 0, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                        {/* Clickable Header */}
                        <div
                          onClick={() => setExpandedBattle(isExpanded ? null : battle.id)}
                          style={{ background: 'linear-gradient(135deg, rgba(34,211,138,0.08), rgba(239,68,68,0.08))', padding: '8px 12px', borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none', cursor: 'pointer', userSelect: 'none' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '20px' }}>{atkFlag}</span>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#22d38a' }}>{battle.attackerId}</div>
                                <div style={{ fontSize: '7px', color: '#64748b' }}>{atkName}</div>
                              </div>
                              <span style={{ fontSize: '14px', fontWeight: 900, color: '#22d38a', margin: '0 2px' }}>{battle.attackerRoundsWon}</span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', letterSpacing: '2px' }}>VS</div>
                              <div style={{ fontSize: '7px', color: '#fca5a5' }}>
                                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', textAlign: 'right' }}>
                              <span style={{ fontSize: '14px', fontWeight: 900, color: '#ef4444', margin: '0 2px' }}>{battle.defenderRoundsWon}</span>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>{battle.defenderId}</div>
                                <div style={{ fontSize: '7px', color: '#64748b' }}>{defName}</div>
                              </div>
                              <span style={{ fontSize: '20px' }}>{defFlag}</span>
                            </div>
                          </div>
                          {/* Points bar */}
                          <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', marginTop: '6px', background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{ width: `${(atkPts / totalPts) * 100}%`, background: 'linear-gradient(90deg, #22d38a, #10b981)', transition: 'width 0.5s ease' }} />
                            <div style={{ width: `${(defPts / totalPts) * 100}%`, background: 'linear-gradient(90deg, #dc2626, #ef4444)', transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                            <span style={{ fontSize: '7px', color: '#64748b' }}>{isExpanded ? '▲ COLLAPSE' : '▼ EXPAND'}</span>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div style={{ padding: '10px 12px' }}>
                            {/* Score cards */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                              <div style={{ flex: 1, background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.15)', borderRadius: '4px', padding: '5px', textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#22d38a', fontWeight: 700 }}>ATTACKER</div>
                                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>DMG: {battle.currentTick.attackerDamage} • PTS: {atkPts}/300</div>
                                {topAttackerArr && <div style={{ fontSize: '8px', color: '#22d38a', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👑 {topAttackerArr[0]} ({topAttackerArr[1]})</div>}
                              </div>
                              <div style={{ flex: 1, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '4px', padding: '5px', textAlign: 'center' }}>
                                <div style={{ fontSize: '8px', color: '#ef4444', fontWeight: 700 }}>DEFENDER</div>
                                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>DMG: {battle.currentTick.defenderDamage} • PTS: {defPts}/300</div>
                                {topDefenderArr && <div style={{ fontSize: '8px', color: '#ef4444', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👑 {topDefenderArr[0]} ({topDefenderArr[1]})</div>}
                              </div>
                            </div>

                            {/* Fight Buttons */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                              <button className="hud-btn-primary" style={{ flex: 1, padding: '8px', fontSize: '10px', fontWeight: 700 }} onClick={() => { const { damage, isCrit, isDodged } = player.attack(); if (damage > 0 || isDodged) battleStore.addDamage(battle.id, 'attacker', damage, isCrit, isDodged, player.name) }}>
                                {atkFlag} ⚔️ ATTACK
                              </button>
                              <button className="hud-btn-primary" style={{ flex: 1, padding: '8px', fontSize: '10px', fontWeight: 700, background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 12px rgba(239, 68, 68, 0.3)' }} onClick={() => { const { damage, isCrit, isDodged } = player.attack(); if (damage > 0 || isDodged) battleStore.addDamage(battle.id, 'defender', damage, isCrit, isDodged, player.name) }}>
                                {defFlag} 🛡️ DEFEND
                              </button>
                            </div>

                            {/* Recover Stamina */}
                            <div style={{ padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ fontSize: '8px', color: '#94a3b8', marginBottom: '3px', fontWeight: 700 }}>RECOVER STAMINA</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => player.consumeFood('bread')} disabled={player.bread <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '3px', fontSize: '8px' }}>🍞 ({player.bread}) <span style={{color: '#22c55e'}}>+10</span></button>
                                <button onClick={() => player.consumeFood('sushi')} disabled={player.sushi <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '3px', fontSize: '8px' }}>🍣 ({player.sushi}) <span style={{color: '#22c55e'}}>+20</span></button>
                                <button onClick={() => player.consumeFood('wagyu')} disabled={player.wagyu <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '3px', fontSize: '8px' }}>🥩 ({player.wagyu}) <span style={{color: '#22c55e'}}>+30</span></button>
                              </div>
                            </div>

                            {/* Live Combat Feed */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '5px' }}>
                              <div style={{ fontSize: '8px', color: '#94a3b8', marginBottom: '3px', fontWeight: 700 }}>LIVE FEED</div>
                              <div style={{ maxHeight: '60px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {feed.length === 0 ? (
                                  <div style={{ fontSize: '9px', color: '#475569' }}>No hits recorded yet...</div>
                                ) : feed.slice(0, 4).map((event, i) => (
                                  <div key={`${event.time}-${i}`} style={{ fontSize: '9px', color: event.side === 'attacker' ? '#22d38a' : '#ef4444', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{event.side === 'attacker' ? atkFlag : defFlag} {event.playerName}</span>
                                    <span style={{ fontWeight: 'bold' }}>
                                      {event.amount} DMG
                                      {event.isCrit && !event.isDodged && <span style={{ color: '#f59e0b', marginLeft: '3px' }}>💥</span>}
                                      {event.isDodged && <span style={{ color: '#94a3b8', marginLeft: '3px' }}>💨</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Combat Stats */}
                  <div className="hud-card">
                    <div className="hud-card__title">📊 YOUR COMBAT STATS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', fontSize: '9px', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '2px' }}><span>⚔️ ATK</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalDmg}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '2px' }}><span>🎯 CR</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalCritRate}%</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '2px' }}><span>💥 CD</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalCritDmg}%</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '2px' }}><span>🛡️ ARM</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalArmor}%</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '2px' }}><span>💨 DOD</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalDodge}%</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '2px' }}><span>💢 HIT</span><span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{finalHitRate}%</span></div>
                    </div>
                  </div>

                  {/* Food Quick Use */}
                  <div className="hud-card">
                    <div className="hud-card__title">🍽️ FOOD</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => player.consumeFood('bread')} disabled={player.bread <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: '9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '16px' }}>🍞</span>
                        <span>{player.bread}</span>
                        <span style={{ color: '#22c55e', fontSize: '8px' }}>+10 HP</span>
                      </button>
                      <button onClick={() => player.consumeFood('sushi')} disabled={player.sushi <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: '9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '16px' }}>🍣</span>
                        <span>{player.sushi}</span>
                        <span style={{ color: '#22c55e', fontSize: '8px' }}>+20 HP</span>
                      </button>
                      <button onClick={() => player.consumeFood('wagyu')} disabled={player.wagyu <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '6px 4px', fontSize: '9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '16px' }}>🥩</span>
                        <span>{player.wagyu}</span>
                        <span style={{ color: '#22c55e', fontSize: '8px' }}>+30 HP</span>
                      </button>
                    </div>
                  </div>

                  {/* Loadout with fast-swap */}
                  <div className="hud-card">
                    <div className="hud-card__title">🎒 LOADOUT <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 400 }}>click to swap</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                       {equipped.map((item: any) => {
                         const isSwapping = swapSlot === item.slot
                         const sameSlotItems = inventory.items.filter((i: any) => i.slot === item.slot && !i.equipped)
                         const tierColor = item.tier === 't6' ? '#ef4444' : item.tier === 't5' ? '#f59e0b' : item.tier === 't4' ? '#a855f7' : item.tier === 't3' ? '#3b82f6' : item.tier === 't2' ? '#22c55e' : '#cbd5e1'
                         const s = item.stats || {}
                         const statLine = s.damage ? `⚔${s.damage}` : s.critDamage ? `💥${s.critDamage}%` : s.armor ? `🛡${s.armor}%` : s.dodge ? `💨${s.dodge}%` : s.precision ? `🎯${s.precision}%` : ''
                         return (
                           <div key={item.id} style={{ position: 'relative' }}>
                             <button
                               onClick={() => setSwapSlot(isSwapping ? null : item.slot)}
                               style={{ width: '100%', background: isSwapping ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '2px', border: `1px solid ${isSwapping ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.05)'}`, cursor: 'pointer', textAlign: 'left' }}
                             >
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px' }}>
                                 <span style={{ fontSize: '7px', color: '#94a3b8', letterSpacing: '1px' }}>{item.slot.toUpperCase()}</span>
                                 <span style={{ fontSize: '7px', color: (item.durability || 100) < 50 ? '#ef4444' : '#22d38a' }}>{(item.durability || 100).toFixed(0)}%</span>
                               </div>
                               <div style={{ fontSize: '8px', fontWeight: 'bold', color: tierColor }}>{item.name}</div>
                               {statLine && <div style={{ fontSize: '7px', color: '#94a3b8', marginTop: '1px' }}>{statLine}{s.critRate ? ` 🎯${s.critRate}%` : ''}</div>}
                             </button>
                             {/* Swap dropdown */}
                             {isSwapping && (
                               <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', maxHeight: '120px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                 {sameSlotItems.length === 0 ? (
                                   <div style={{ padding: '6px', fontSize: '8px', color: '#64748b', textAlign: 'center' }}>No alternatives</div>
                                 ) : sameSlotItems.map((alt: any) => {
                                   const ac = alt.tier === 't6' ? '#ef4444' : alt.tier === 't5' ? '#f59e0b' : alt.tier === 't4' ? '#a855f7' : alt.tier === 't3' ? '#3b82f6' : alt.tier === 't2' ? '#22c55e' : '#cbd5e1'
                                   const as2 = alt.stats || {}
                                   const altStat = as2.damage ? `⚔${as2.damage}` : as2.critDamage ? `💥${as2.critDamage}%` : as2.armor ? `🛡${as2.armor}%` : as2.dodge ? `💨${as2.dodge}%` : as2.precision ? `🎯${as2.precision}%` : ''
                                   return (
                                   <button
                                     key={alt.id}
                                     onClick={(e) => { e.stopPropagation(); inventory.equipItem(alt.id); setSwapSlot(null) }}
                                     style={{ display: 'block', width: '100%', padding: '4px 6px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                                     onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,158,11,0.1)')}
                                     onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                   >
                                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <span style={{ fontSize: '8px', fontWeight: 700, color: ac }}>{alt.name}</span>
                                       <span style={{ fontSize: '7px', color: '#94a3b8' }}>{(alt.durability || 100).toFixed(0)}%</span>
                                     </div>
                                     {altStat && <div style={{ fontSize: '7px', color: '#64748b' }}>{altStat}{as2.critRate ? ` 🎯${as2.critRate}%` : ''}</div>}
                                   </button>
                                   )
                                 })}
                               </div>
                             )}
                           </div>
                         )
                       })}
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
              const battleStore = useBattleStore.getState()
              
              if (world.canAttack(attackerIso, defenderIso)) {
                battleStore.launchAttack(attackerIso, defenderIso, selectedRegion.name)
                
                const activeBattle = Object.values(battleStore.battles).find(
                  b => b.regionName === selectedRegion.name && b.status === 'active'
                )
                
                if (activeBattle) {
                  const { damage, isCrit, isDodged } = player.attack()
                  if (damage > 0 || isDodged) battleStore.addDamage(activeBattle.id, 'attacker', damage, isCrit, isDodged, player.name)
                } else {
                  player.attack()
                }
                
                // Add floating text at mouse location if event provided
                if (e) {
                  useUIStore.getState().addFloatingText('ATTACK LAUNCHED', e.clientX, e.clientY, '#ef4444')
                } else {
                   useUIStore.getState().addFloatingText('ATTACK LAUNCHED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
                }
              } else {
                useUIStore.getState().addFloatingText('CANNOT ATTACK: NO ADJACENCY OR NOT AT WAR', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
              }
            }
            setSelectedRegion(null)
          }}
        />
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
