import { useState } from 'react'
import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import { useUIStore } from '../../stores/uiStore'
import { useRegionStore } from '../../stores/regionStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useMarketStore, RESOURCE_BY_KEY } from '../../stores/marketStore'
import { useBattleStore } from '../../stores/battleStore'
import { useLeyLineStore } from '../../stores/leyLineStore'
import { ARCHETYPE_META } from '../../data/leyLineRegistry'
import { OWNERSHIP_COLORS, type NodeOwnershipState } from '../../types/leyLine'
import { useAllianceStore } from '../../stores/allianceStore'
import { useWorldStore as _useWorldStore } from '../../stores/worldStore'
import CountryFlag from '../shared/CountryFlag'
import { Anchor, Plane, Shield, Landmark, Home, Briefcase, Swords, Star, Power, Rocket } from 'lucide-react'
import { isCoastalRegion } from '../../utils/geography'


// Oil cost per infrastructure level [0, 1, 2, 3, 4, 5]
const INFRA_OIL_COSTS = [0, 20, 40, 60, 90, 130]

type RegionTab = 'home' | 'jobs' | 'battles'

export default function RegionPanel() {
  const { selectedRegionId, setForeignCountry, setActivePanel } = useUIStore()
  const { regions, scavengeMissions, getPlayerPatrol, getHomelandBonus, startScavenge, triggerRevolt, startNavalPatrol, stopNavalPatrol, isCapitalRegion, isCoreRegion, toggleInfra } = useRegionStore()
  const region = regions.find(r => r.id === selectedRegionId)

  const world = useWorldStore()
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const market = useMarketStore()
  const battleStore = useBattleStore()

  const [activeTab, setActiveTab] = useState<RegionTab>('home')
  const [scavengeMsg, setScavengeMsg] = useState('')
  const [navalMsg, setNavalMsg] = useState<string | null>(null)
  const [revoltMsg, setRevoltMsg] = useState<string | null>(null)
  const [battlePage, setBattlePage] = useState(1)

  if (!region) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.1em' }}>
        NO REGION SELECTED
      </div>
    )
  }

  const country = world.countries.find(c => c.code === region.countryCode)
  const controllerName = getCountryName(region.controlledBy)

  const hasDebris = region.debris.scrap > 0 || region.debris.materialX > 0 || region.debris.militaryBoxes > 0

  const playerMission = scavengeMissions.find(m => m.playerId === player.name)
  const activePatrol = getPlayerPatrol(region.id)

  const isOccupied = !region.isOcean && region.controlledBy !== region.countryCode
  const homelandBonus = getHomelandBonus(region.id)
  const canTriggerRevolt = isOccupied && player.countryCode === region.countryCode &&
    govStore.canTriggerRevolt(region.countryCode, player.name) && !region.revoltBattleId
  const hasActiveRevolt = !!region.revoltBattleId

  const handleStartScavenge = () => {
    const result = startScavenge(region.id)
    setScavengeMsg(result.message)
  }

  const handleGoToCountry = () => {
    const playerIso = player.countryCode || 'US'
    if (region.countryCode === playerIso) {
      setActivePanel('government')
    } else {
      setForeignCountry(region.countryCode)
      setActivePanel('foreign_country')
    }
  }

  const handleToTheSea = () => {
    if (activePatrol) {
      const result = stopNavalPatrol(region.id)
      setNavalMsg(result.message)
    } else {
      const result = startNavalPatrol(region.id)
      setNavalMsg(result.message)
    }
    setTimeout(() => setNavalMsg(null), 4000)
  }

  const handleTriggerRevolt = () => {
    const result = triggerRevolt(region.id, 'manual')
    setRevoltMsg(result.message)
    setTimeout(() => setRevoltMsg(null), 5000)
  }

  // --- Ocean Economic Worth Calculation ---
  let estHourlyWorth = 0
  if (region.isOcean) {
    const fishPrice = market.tickers['fish']?.price || RESOURCE_BY_KEY['fish']?.basePrice || 3.44
    const oilPrice = market.tickers['oil']?.price || RESOURCE_BY_KEY['oil']?.basePrice || 0.16
    estHourlyWorth = (region.fishingBonus * fishPrice) + (region.oilYield * oilPrice) + region.tradeRouteValue
  }

  // Capital / Core checks
  const isCapital = isCapitalRegion(region.id)
  const isCore = isCoreRegion(region.id)
  const isController = (player.countryCode || 'US') === region.controlledBy

  // Battles for this region
  const allBattles = Object.values(battleStore.battles)
  const regionBattles = allBattles.filter(b =>
    b.regionId === region.id || b.regionName === region.name
  ).sort((a, b) => b.startedAt - a.startedAt)
  const BATTLES_PER_PAGE = 6
  const visibleBattles = regionBattles.slice(0, battlePage * BATTLES_PER_PAGE)
  const hasMoreBattles = regionBattles.length > visibleBattles.length

  // Shared label style
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }
  const valueStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }
  const sectionTitleStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const }

  // Tab config
  const TABS: { key: RegionTab; label: string; Icon: typeof Home }[] = [
    { key: 'home', label: 'Home', Icon: Home },
    { key: 'jobs', label: 'Jobs', Icon: Briefcase },
    { key: 'battles', label: 'Battles', Icon: Swords },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ─── Banner Placeholder ─── */}
      <div style={{
        width: '100%', height: 100, borderRadius: 'var(--radius-sm)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.7) 60%, rgba(15,23,42,1) 100%)',
        marginBottom: 10, position: 'relative', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        {/* Decorative grid lines */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 19px, white 19px, white 20px), repeating-linear-gradient(0deg, transparent, transparent 19px, white 19px, white 20px)' }} />
      </div>

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, padding: '0 2px' }}>
        {region.isOcean ? (
          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌊</div>
        ) : (
          <CountryFlag iso={region.countryCode} size={28} />
        )}
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{region.name}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
            {region.isOcean ? 'INTERNATIONAL WATERS' : getCountryName(region.countryCode)}
          </div>
        </div>
      </div>

      {/* ─── Capital / Core Indicators ─── */}
      {!region.isOcean && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 2px', marginBottom: 8 }}>
          {isCapital && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)', fontSize: 9, color: '#facc15', letterSpacing: '0.05em' }}>
              <Star size={10} color="#facc15" fill="#facc15" />
              Capital of <CountryFlag iso={region.countryCode} size={12} /> {getCountryName(region.countryCode)}.
            </div>
          )}
          {isCore && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Core region of <CountryFlag iso={region.countryCode} size={12} /> {getCountryName(region.countryCode)}.
            </div>
          )}
        </div>
      )}

      {/* ─── Tab Navigation ─── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px 10px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}
            >
              <tab.Icon size={16} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* ─── Scavenge Action (always visible below tabs on land) ─── */}
      {!region.isOcean && (
        <div style={{ marginBottom: 10 }}>
          {playerMission ? (
            <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,211,138,0.08)', border: '1px solid rgba(34,211,138,0.25)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600, color: 'var(--accent-primary)', textAlign: 'center', letterSpacing: '0.05em' }}>
              🔧 SCAVENGING — RETURNS IN {Math.max(0, Math.ceil((playerMission.endsAt - Date.now()) / 60000))} MIN
            </div>
          ) : (
            <button
              className="hud-btn-outline"
              style={{ width: '100%', justifyContent: 'center', color: player.stamina >= 10 ? 'var(--accent-warning)' : 'var(--text-muted)', borderColor: player.stamina >= 10 ? 'rgba(245,158,11,0.3)' : 'var(--border-secondary)', cursor: player.stamina >= 10 ? 'pointer' : 'not-allowed' }}
              disabled={player.stamina < 10}
              onClick={handleStartScavenge}
            >
              🔧 SEND SCAVENGERS &nbsp;
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, opacity: 0.7 }}>⚡ 10 STA</span>
            </button>
          )}
          {scavengeMsg && <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--accent-warning)', textAlign: 'center', marginTop: 6 }}>{scavengeMsg}</div>}
        </div>
      )}

      {/* ═══════════════ HOME TAB ═══════════════ */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Attack Region / Country buttons (top of home tab) */}
          {(() => {
            const playerIso = player.countryCode || 'US'
            const controllerIso = region.controlledBy
            if (!controllerIso || controllerIso === playerIso || region.isOcean) return null

            const hasWar = world.wars.some(w =>
              w.status === 'active' &&
              ((w.attacker === playerIso && w.defender === controllerIso) ||
               (w.attacker === controllerIso && w.defender === playerIso))
            )

            if (hasWar) {
              return (
                <button
                  className="hud-btn-outline"
                  style={{
                    width: '100%', justifyContent: 'center', padding: '7px 0',
                    color: '#f97316', borderColor: 'rgba(249,115,22,0.4)',
                    fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                  }}
                  onClick={() => setActivePanel('combat')}
                >
                  ⚔️ ATTACK REGION
                </button>
              )
            }

            return (
              <button
                className="hud-btn-outline"
                style={{
                  width: '100%', justifyContent: 'center', padding: '7px 0',
                  color: 'var(--text-muted)', borderColor: 'rgba(255,255,255,0.08)',
                  fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                }}
                onClick={() => setActivePanel('government')}
                title="No active war — propose a war declaration in Congress"
              >
                📜 DECLARE WAR IN CONGRESS
              </button>
            )
          })()}

          <button className="hud-btn-outline" style={{ width: '100%', justifyContent: 'center', padding: '7px 0' }} onClick={handleGoToCountry}>
            🌐 COUNTRY
          </button>


          {/* ─── Territory Control ─── */}
          <div className="hud-card">
            <div className="hud-card__title">{region.isOcean ? '⚓ NAVAL ZONE' : '🏴 TERRITORY CONTROL'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={labelStyle}>CONTROLLED BY</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {region.isOcean && !region.controlledBy ? 'UNCLAIMED' : controllerName}
                </span>
              </div>
              {country?.empire && !region.isOcean && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={labelStyle}>EMPIRE</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--accent-warning)', padding: '2px 8px', background: 'var(--accent-warning-dim)', borderRadius: 4 }}>
                    {country.empire}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={labelStyle}>COORDINATES</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>
                  {region.position[1].toFixed(2)}°, {region.position[0].toFixed(2)}°
                </span>
              </div>
            </div>
          </div>

          {/* ─── LEY LINE CORRIDORS ─── */}
          {(() => {
            const leyLines = useLeyLineStore.getState().getLinesForRegion(region.id)
            const isDenial = useLeyLineStore.getState().isDenialTarget(region.id)
            if (leyLines.length === 0) return null

            const playerISO    = player.countryCode || null
            const allianceState = useAllianceStore.getState()
            const playerAllianceId = allianceState.playerAllianceId
            const playerAlliance   = playerAllianceId
              ? allianceState.alliances.find(a => a.id === playerAllianceId)
              : null

            function getOwnerState(ownerCC: string | null): NodeOwnershipState {
              if (!ownerCC) return 'unowned'
              if (ownerCC === playerISO) return 'self'
              if (playerAlliance?.members.some(m => m.countryCode === ownerCC)) return 'ally'
              return 'neutral'
            }

            return (
              <div className="hud-card" style={{ borderColor: 'rgba(168,85,247,0.25)' }}>
                <div className="hud-card__title" style={{ color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⚡ LEY LINE CORRIDORS
                  {isDenial && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.1em', marginLeft: 'auto' }}>
                      ⚠ DENIAL TARGET
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leyLines.map(line => {
                    const meta = ARCHETYPE_META[line.def.archetype]
                    const completionPct = Math.round(line.completion * 100)

                    const thisRegionOwner = region.controlledBy ?? null
                    const ownerState      = getOwnerState(thisRegionOwner)
                    const dotColor        = OWNERSHIP_COLORS[ownerState]

                    const totalBlocks = line.def.blocks.length
                    const securedCount = line.def.blocks.filter(b => {
                      const r = regions.find(rr => rr.id === b)
                      if (!r) return false
                      const s = getOwnerState(r.controlledBy)
                      return s === 'self' || s === 'ally'
                    }).length
                    const isCritical = !line.active &&
                      ownerState !== 'self' && ownerState !== 'ally' &&
                      securedCount === totalBlocks - 1

                    let statusLine: React.ReactNode
                    if (line.active) {
                      statusLine = <span style={{ color: '#22d38a' }}>Active — bonuses applied to {line.heldBy}</span>
                    } else if (isCritical) {
                      statusLine = <span style={{ color: '#fbbf24' }}>⚡ You are the missing link</span>
                    } else {
                      statusLine = <span style={{ color: '#64748b' }}>{securedCount} of {totalBlocks} regions secured</span>
                    }

                    return (
                      <div key={line.def.id} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: `1px solid ${meta.color}33` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: line.active ? `0 0 8px ${dotColor}` : 'none' }} />
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.05em' }}>
                              {line.def.name}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600, color: line.active ? '#22d38a' : 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            {line.active ? '● ACTIVE' : `${completionPct}%`}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>
                          {meta.label.toUpperCase()} — {line.def.blocks.length} REGIONS
                        </div>
                        <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                          <div style={{ width: `${completionPct}%`, height: '100%', borderRadius: 2, background: line.active ? '#22d38a' : meta.color, opacity: line.active ? 1 : 0.6, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, marginTop: 5, letterSpacing: '0.04em' }}>
                          {statusLine}
                        </div>
                        {line.active && line.effectiveness < 1.0 && (
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 7, color: 'var(--accent-warning)', marginTop: 4, letterSpacing: '0.05em' }}>
                            ⚠ DIMINISHED: {Math.round(line.effectiveness * 100)}% effectiveness
                          </div>
                        )}
                        {line.active && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {Object.entries(line.def.bonuses).map(([key, val]) => (
                              <span key={key} style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 600, color: '#22d38a', background: 'rgba(34,211,138,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                                +{Math.round((val as number) * 100 * line.effectiveness)}% {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                            ))}
                            {Object.entries(line.def.tradeoffs).map(([key, val]) => (
                              <span key={key} style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                                {Math.round((val as number) * 100 * line.effectiveness)}% {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* ─── OCEAN SPECIFIC ─── */}
          {region.isOcean && (
            <div className="hud-card" style={{ borderColor: 'rgba(56,189,248,0.2)' }}>
              <div className="hud-card__title" style={{ color: 'var(--accent-secondary)' }}>🌊 ECONOMIC VALUE</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div className="hud-card" style={{ padding: 10, margin: 0 }}>
                  <div style={labelStyle}>🐟 FISHING</div>
                  <div style={{ ...valueStyle, color: 'var(--accent-secondary)', marginTop: 4 }}>+{region.fishingBonus}<span style={{ fontSize: 9, color: 'var(--text-muted)' }}>/hr</span></div>
                </div>
                <div className="hud-card" style={{ padding: 10, margin: 0 }}>
                  <div style={labelStyle}>🛢️ OIL YIELD</div>
                  <div style={{ ...valueStyle, color: 'var(--accent-purple)', marginTop: 4 }}>+{region.oilYield}<span style={{ fontSize: 9, color: 'var(--text-muted)' }}>/hr</span></div>
                </div>
              </div>

              <div className="hud-card" style={{ padding: 10, margin: 0, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={labelStyle}>🛳️ TRADE ROUTE</span>
                  <span style={{ ...valueStyle, fontSize: 14, color: 'var(--accent-primary)' }}>+${region.tradeRouteValue}/hr</span>
                </div>
              </div>

              <div style={{ padding: 10, background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.2)', borderRadius: 'var(--radius-sm)', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ ...labelStyle, color: 'var(--accent-primary)', marginBottom: 4 }}>ESTIMATED MARKET WORTH</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>
                  ${estHourlyWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>/hr</span>
                </div>
              </div>

              {activePatrol && (
                <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-secondary-dim)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--accent-secondary)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textAlign: 'center', marginBottom: 10 }}>
                  🚢 {activePatrol.divisionIds.length} DIVISION(S) ON PATROL
                </div>
              )}

              <button className="hud-btn-outline" style={{ width: '100%', justifyContent: 'center', padding: '8px 0', ...(activePatrol ? { color: 'var(--accent-danger)', borderColor: 'rgba(239,68,68,0.3)' } : {}) }} onClick={handleToTheSea}>
                {activePatrol ? '🚢 RECALL PATROL' : '⚓ DEPLOY NAVAL PATROL'}
              </button>
              {navalMsg && <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--accent-secondary)', textAlign: 'center', marginTop: 6, letterSpacing: '0.05em' }}>{navalMsg}</div>}
            </div>
          )}

          {/* ─── LAND SPECIFIC ─── */}
          {!region.isOcean && (
            <>
              {/* 🔥 Revolt / Homeland Bonus */}
              {isOccupied && (
                <div className="hud-card" style={{ borderColor: region.revoltPressure > 70 ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.2)' }}>
                  <div className="hud-card__title" style={{ color: 'var(--accent-danger)' }}>🔥 HOMELAND RESISTANCE</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={labelStyle}>REVOLT PRESSURE</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: region.revoltPressure >= 100 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}>
                      {Math.round(region.revoltPressure)}%
                    </span>
                  </div>

                  {/* Pressure bar */}
                  <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.4)', overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{
                      width: `${Math.min(100, region.revoltPressure)}%`, height: '100%', borderRadius: 3,
                      background: region.revoltPressure >= 100 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : region.revoltPressure > 70 ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #dc2626, #ef4444)',
                      transition: 'width 0.5s ease',
                      ...(region.revoltPressure >= 100 ? { animation: 'revolt-pulse 1s ease-in-out infinite' } : {}),
                    }} />
                  </div>

                  {/* Bonus grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
                    {[
                      { label: 'ATK BONUS', value: `+${((homelandBonus.atkMult - 1) * 100).toFixed(0)}%` },
                      { label: 'AGILITY', value: `+${((homelandBonus.dodgeMult - 1) * 100).toFixed(0)}%` },
                      { label: 'DMG MULT', value: `+${((homelandBonus.playerDmgMult - 1) * 100).toFixed(0)}%` },
                    ].map(b => (
                      <div key={b.label} className="hud-card" style={{ padding: '6px', margin: 0, textAlign: 'center' }}>
                        <div style={{ ...labelStyle, marginBottom: 2 }}>{b.label}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{b.value}</div>
                      </div>
                    ))}
                  </div>

                  {hasActiveRevolt && (
                    <div style={{ padding: '6px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-warning-dim)', border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--accent-warning)', textAlign: 'center', letterSpacing: '0.1em' }}>
                      ⚔️ REVOLT BATTLE IN PROGRESS
                    </div>
                  )}

                  {region.revoltPressure >= 100 && !hasActiveRevolt && !canTriggerRevolt && (
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--accent-warning)', textAlign: 'center', letterSpacing: '0.05em' }}>
                      ⚡ MAX PRESSURE — AUTO-REVOLT MAY TRIGGER (2.5%)
                    </div>
                  )}

                  {canTriggerRevolt && (
                    <button className="hud-btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: 'var(--accent-danger)', borderColor: 'rgba(239,68,68,0.4)' }} onClick={handleTriggerRevolt}>
                      🔥 TRIGGER REVOLT NOW
                    </button>
                  )}
                  {revoltMsg && <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--accent-danger)', textAlign: 'center', marginTop: 6 }}>{revoltMsg}</div>}
                </div>
              )}



              {/* ─── UPGRADES (Infrastructure) ─── */}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, marginTop: 6 }}>
                UPGRADES
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { key: 'bunkerLevel' as const, label: 'Bunker', Icon: Shield, bonusText: 'Defense bonus', bonusPct: [0, 10, 15, 20, 25, 30], color: '#22d38a' },
                  { key: 'militaryBaseLevel' as const, label: 'Military base', Icon: Landmark, bonusText: 'Attack bonus', bonusPct: [0, 5, 10, 15, 20, 25], color: '#ef4444' },
                  ...(isCoastalRegion(region.id) ? [{ key: 'portLevel' as const, label: 'Port', Icon: Anchor, bonusText: 'Naval damage', bonusPct: [0, 5, 8, 10, 14, 18], color: '#0ea5e9' }] : []),
                  { key: 'airportLevel' as const, label: 'Airport', Icon: Plane, bonusText: 'Air strike range', bonusPct: [0, 10, 15, 20, 25, 30], color: '#a855f7' },
                  { key: 'missileLauncherLevel' as const, label: 'Missile Launcher', Icon: Rocket, bonusText: 'Burst damage', bonusPct: [0, 10, 20, 30, 40, 50], color: '#f97316' },
                ] as const).map(inf => {
                  const level = region[inf.key]
                  const isEnabled = region.infraEnabled?.[inf.key] !== false
                  const disabledAt = region.infraDisabledAt?.[inf.key] || 0
                  const oilCost = INFRA_OIL_COSTS[Math.min(level, 5)] || 0
                  const bonus = inf.bonusPct[Math.min(level, 5)] || 0

                  // Time since disabled
                  let disabledAgo = ''
                  if (!isEnabled && disabledAt > 0) {
                    const ms = Date.now() - disabledAt
                    const d = Math.floor(ms / 86400000)
                    const h = Math.floor((ms % 86400000) / 3600000)
                    disabledAgo = d > 0 ? `${d}d ago` : `${h}h ago`
                  }

                  const cost = { money: (level + 1) * 5000, oil: (level + 1) * 500, materialX: (level + 1) * 200 }
                  const fund = world.getCountry(region.controlledBy)?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
                  const canAfford = fund.money >= cost.money && fund.oil >= cost.oil && fund.materialX >= cost.materialX

                  const handleUpgrade = () => {
                    if (!canAfford || !isController) return
                    const govStore = useGovernmentStore.getState()
                    govStore.spendFromFund(region.controlledBy, { money: cost.money, oil: cost.oil, materialX: cost.materialX })
                    useRegionStore.setState(s => ({
                      regions: s.regions.map(r =>
                        r.id === region.id ? { ...r, [inf.key]: r[inf.key] + 1 } : r
                      )
                    }))
                  }

                  return (
                    <div key={inf.key} style={{
                      padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0,0,0,0.3)', border: `1px solid ${inf.color}18`,
                    }}>
                      {/* Header row: icon + label + disabled badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${inf.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <inf.Icon size={16} color={inf.color} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{inf.label}</div>
                          {!isEnabled && (
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 600, color: '#ef4444', letterSpacing: '0.05em' }}>
                              Disabled {disabledAgo}
                            </div>
                          )}
                        </div>
                        {/* Enable/Disable toggle for controller */}
                        {isController && level > 0 && (
                          <button
                            onClick={() => toggleInfra(region.id, inf.key)}
                            style={{
                              background: 'none', border: `1px solid ${isEnabled ? 'rgba(34,211,138,0.3)' : 'rgba(239,68,68,0.3)'}`,
                              borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                              color: isEnabled ? '#22d38a' : '#ef4444',
                              fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, letterSpacing: '0.05em',
                            }}
                          >
                            <Power size={10} />
                          </button>
                        )}
                      </div>

                      {/* Level pills */}
                      <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
                        {[1, 2, 3, 4, 5].map(lvl => (
                          <div key={lvl} style={{
                            width: 22, height: 20, borderRadius: 3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                            background: lvl <= level ? inf.color : 'rgba(255,255,255,0.04)',
                            color: lvl <= level ? '#0f172a' : 'var(--text-muted)',
                            border: lvl <= level ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            opacity: isEnabled || lvl > level ? 1 : 0.4,
                          }}>
                            {lvl}
                          </div>
                        ))}
                      </div>

                      {/* Bonus + Oil cost */}
                      {level > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: isController && level < 5 ? 8 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600, color: inf.color }}>
                              +{bonus}% {inf.bonusText}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)' }}>
                              🛢️ {oilCost} Hourly maintenance
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Upgrade button */}
                      {isController && level < 5 && (
                        <>
                          <div style={{ fontSize: 8, color: '#3e4a5c', marginBottom: 4 }}>
                            ${cost.money.toLocaleString()} + {cost.oil} Oil + {cost.materialX} MatX
                          </div>
                          <button
                            className="hud-btn-outline"
                            disabled={!canAfford}
                            onClick={handleUpgrade}
                            style={{
                              width: '100%', justifyContent: 'center', padding: '4px 0',
                              fontSize: 8, fontWeight: 700,
                              color: canAfford ? inf.color : 'var(--text-muted)',
                              borderColor: canAfford ? `${inf.color}50` : 'var(--border-secondary)',
                              cursor: canAfford ? 'pointer' : 'not-allowed',
                              opacity: canAfford ? 1 : 0.5,
                            }}
                          >
                            UPGRADE → Lv.{level + 1}
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ─── Deposits ─── */}
          {(() => {
            const DEPOSIT_ICONS: Record<string, string> = { wheat: '🌾', fish: '🐟', steak: '🥩', oil: '🛢️', materialx: '⚛️' }
            const DEPOSIT_COLORS: Record<string, string> = { wheat: '#facc15', fish: '#38bdf8', steak: '#f87171', oil: '#a855f7', materialx: '#ec4899' }
            const regionDeposits = world.deposits.filter(d => d.regionId === region.id && d.active)
            if (regionDeposits.length === 0) return null
            return (
              <div className="hud-card" style={{ borderColor: 'rgba(168,85,247,0.2)' }}>
                <div className="hud-card__title" style={{ color: 'var(--accent-purple)' }}>⛏️ RESOURCE DEPOSITS</div>
                {regionDeposits.map(dep => {
                  const ms = dep.expiresAt - Date.now()
                  const hours = Math.max(0, Math.floor(ms / 3600000))
                  const days = Math.floor(hours / 24)
                  const timeLeft = days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`
                  return (
                    <div key={dep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{DEPOSIT_ICONS[dep.type] || '⛏️'}</span>
                        <span style={{ ...sectionTitleStyle, fontSize: 9, color: DEPOSIT_COLORS[dep.type] || 'var(--text-secondary)' }}>{dep.type}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)' }}>+{dep.bonus}%</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)' }}>⏳ {timeLeft}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}


        </div>
      )}

      {/* ═══════════════ BATTLES TAB ═══════════════ */}
      {activeTab === 'battles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...sectionTitleStyle, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            BATTLES <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--accent-primary)' }}>→</span>
          </div>

          {regionBattles.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              No battles recorded in this region.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {visibleBattles.map(battle => {
                  const isActive = battle.status === 'active'
                  const atkDmg = battle.attacker.damageDealt || 0
                  const defDmg = battle.defender.damageDealt || 0
                  const atkDivs = battle.attacker.divisionIds.length
                  const defDivs = battle.defender.divisionIds.length

                  return (
                    <div key={battle.id} style={{
                      padding: '10px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(0,0,0,0.3)', border: `1px solid rgba(255,255,255,0.06)`,
                      cursor: 'pointer',
                    }} onClick={() => {
                      useUIStore.getState().setActivePanel('combat')
                    }}>
                      {/* Region name */}
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        ⚔ {region.name}
                      </div>

                      {/* Flags row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                        <CountryFlag iso={battle.attackerId} size={14} />
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {atkDivs}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)' }}>🏔️</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {defDivs}
                        </span>
                        <CountryFlag iso={battle.defenderId} size={14} />
                      </div>

                      {/* Status */}
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700, color: isActive ? '#22d38a' : 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 6 }}>
                        {isActive ? 'Active' : 'Ended'}
                      </div>

                      {/* Score bar */}
                      <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.5)', overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{
                          width: `${atkDmg + defDmg > 0 ? (atkDmg / (atkDmg + defDmg)) * 100 : 50}%`,
                          height: '100%', borderRadius: 2,
                          background: 'var(--accent-primary)',
                        }} />
                      </div>

                      {/* Damage numbers */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--accent-primary)' }}>
                          🏔️ {(atkDmg / 1000000).toFixed(1)}M
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)' }}>|</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--accent-danger)' }}>
                          🏔️ {(defDmg / 1000000).toFixed(1)}M
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMoreBattles && (
                <button
                  className="hud-btn-outline"
                  style={{ width: '100%', justifyContent: 'center', padding: '6px 0', fontSize: 9, marginTop: 4 }}
                  onClick={() => setBattlePage(p => p + 1)}
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ JOBS TAB ═══════════════ */}
      {activeTab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...sectionTitleStyle, color: 'var(--text-muted)' }}>JOBS</div>
          <div style={{ padding: 30, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            No job listings available in this region.
          </div>
        </div>
      )}
    </div>
  )
}
