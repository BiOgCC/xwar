import { useState } from 'react'
import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import { useUIStore } from '../../stores/uiStore'
import { useRegionStore } from '../../stores/regionStore'
import { useArmyStore } from '../../stores/army'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useMarketStore, RESOURCE_BY_KEY } from '../../stores/marketStore'
import { useLeyLineStore } from '../../stores/leyLineStore'
import { ARCHETYPE_META } from '../../data/leyLineRegistry'
import { OWNERSHIP_COLORS, type NodeOwnershipState } from '../../types/leyLine'
import { useAllianceStore } from '../../stores/allianceStore'
import { useWorldStore as _useWorldStore } from '../../stores/worldStore'
import type { Division } from '../../stores/army/types'
import CountryFlag from '../shared/CountryFlag'

export default function RegionPanel() {
  const { selectedRegionId, setForeignCountry, setActivePanel } = useUIStore()
  const { regions, scavengeMissions, getPlayerPatrol, getHomelandBonus, startScavenge, triggerRevolt, startNavalPatrol, stopNavalPatrol } = useRegionStore()
  const region = regions.find(r => r.id === selectedRegionId)

  const world = useWorldStore()
  const player = usePlayerStore()
  const armyStore = useArmyStore()
  const govStore = useGovernmentStore()
  const market = useMarketStore()

  const [showScavenge, setShowScavenge] = useState(false)
  const [selectedDivs, setSelectedDivs] = useState<string[]>([])
  const [scavengeMsg, setScavengeMsg] = useState('')
  const [navalMsg, setNavalMsg] = useState<string | null>(null)
  const [revoltMsg, setRevoltMsg] = useState<string | null>(null)

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
  const canScavenge = hasDebris && region.scavengeCount < 4

  const scavengeableDivs = (Object.values(armyStore.divisions) as Division[]).filter(
    (d) => d.ownerId === player.name && (d.type === 'recon' || d.type === 'jeep') && d.status === 'ready'
  )

  const activeMissions = scavengeMissions.filter(m => m.regionId === region.id)
  const playerMission = activeMissions.find(m => m.playerId === player.name)
  const activePatrol = getPlayerPatrol(region.id)

  const isOccupied = !region.isOcean && region.controlledBy !== region.countryCode
  const homelandBonus = getHomelandBonus(region.id)
  const canTriggerRevolt = isOccupied && player.countryCode === region.countryCode &&
    govStore.canTriggerRevolt(region.countryCode, player.name) && !region.revoltBattleId
  const hasActiveRevolt = !!region.revoltBattleId

  const handleToggleDiv = (divId: string) => {
    setSelectedDivs(prev => prev.includes(divId) ? prev.filter(id => id !== divId) : [...prev, divId])
  }

  const handleStartScavenge = () => {
    const result = startScavenge(region.id, selectedDivs)
    setScavengeMsg(result.message)
    if (result.success) {
      setSelectedDivs([])
      setShowScavenge(false)
    }
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

  // Shared label style
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }
  const valueStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }
  const sectionTitleStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
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

        // derive player's context once for color coding
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

                // Derive ownershipState for THIS region's controlling country
                const thisRegionOwner = region.controlledBy ?? null
                const ownerState      = getOwnerState(thisRegionOwner)
                const dotColor        = OWNERSHIP_COLORS[ownerState]

                // Status string below the completion bar
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
                        {/* Dot now uses ownershipState color, not static archetype color */}
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
                    {/* Completion bar */}
                    <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                      <div style={{ width: `${completionPct}%`, height: '100%', borderRadius: 2, background: line.active ? '#22d38a' : meta.color, opacity: line.active ? 1 : 0.6, transition: 'width 0.5s ease' }} />
                    </div>
                    {/* Status string */}
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
          <div className="hud-card">
            <div className="hud-card__title">🛡️ MILITARY STATUS</div>
            <div className="hud-card__stats">
              <div className="hud-stat">
                <span className="hud-stat__label">DEFENSE</span>
                <span className="hud-stat__value">{region.defense.toLocaleString()}</span>
              </div>
              <div className="hud-stat">
                <span className="hud-stat__label">CAPTURE</span>
                <span className="hud-stat__value">{Math.round(region.captureProgress)}%</span>
              </div>
            </div>
            {region.attackedBy && (
              <div style={{ padding: '6px 10px', background: 'var(--accent-danger-dim)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600, color: 'var(--accent-danger)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚔️ UNDER ATTACK BY: {getCountryName(region.attackedBy)}
              </div>
            )}
          </div>

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
                  { label: 'DODGE', value: `+${((homelandBonus.dodgeMult - 1) * 100).toFixed(0)}%` },
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

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="hud-btn-outline" style={{ flex: 1, justifyContent: 'center', padding: '7px 0' }} onClick={handleGoToCountry}>
              🌐 COUNTRY
            </button>
            <button className="hud-btn-outline" style={{ flex: 1, justifyContent: 'center', padding: '7px 0', color: 'var(--accent-danger)', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => setActivePanel('military')}>
              ⚔️ MILITARY
            </button>
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

      {/* ─── Debris / Scavenge ─── */}
      {hasDebris && (
        <div className="hud-card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
          <div className="hud-card__title" style={{ color: 'var(--accent-warning)' }}>⚙️ BATTLEFIELD DEBRIS ({4 - region.scavengeCount} WAVES LEFT)</div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {region.debris.scrap > 0 && <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>⚙️ {region.debris.scrap.toLocaleString()}</span>}
            {region.debris.materialX > 0 && <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: '#ec4899' }}>⚛️ {region.debris.materialX.toLocaleString()}</span>}
            {region.debris.militaryBoxes > 0 && <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: 'var(--accent-warning)' }}>📦 x{region.debris.militaryBoxes}</span>}
          </div>

          {playerMission ? (
            <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(34,211,138,0.08)', border: '1px solid rgba(34,211,138,0.25)', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600, color: 'var(--accent-primary)', textAlign: 'center', letterSpacing: '0.05em' }}>
              🔧 SCAVENGING — RETURNS IN {Math.max(0, Math.ceil((playerMission.endsAt - Date.now()) / 60000))} MIN
            </div>
          ) : canScavenge && !showScavenge ? (
            <button className="hud-btn-outline" style={{ width: '100%', justifyContent: 'center', color: 'var(--accent-warning)', borderColor: 'rgba(245,158,11,0.3)' }} onClick={() => setShowScavenge(true)}>
              🔧 SEND SCAVENGERS
            </button>
          ) : showScavenge ? (
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ ...sectionTitleStyle, fontSize: 9, color: 'var(--accent-warning)', marginBottom: 8 }}>SELECT RECON / JEEP DIVISIONS</div>

              {scavengeableDivs.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 10 }}>No ready divisions available.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto', marginBottom: 10 }}>
                  {scavengeableDivs.map(d => (
                    <label key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                      background: selectedDivs.includes(d.id) ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedDivs.includes(d.id) ? 'rgba(245,158,11,0.4)' : 'transparent'}`,
                    }}>
                      <input type="checkbox" checked={selectedDivs.includes(d.id)} onChange={() => handleToggleDiv(d.id)} style={{ accentColor: '#f59e0b' }} />
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, color: d.type === 'recon' ? 'var(--accent-primary)' : 'var(--accent-secondary)', letterSpacing: '0.05em' }}>
                        {d.type === 'recon' ? '🔍' : '🚗'} {d.name}
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 8, color: 'var(--text-muted)', marginLeft: 'auto' }}>⭐{d.starQuality}</span>
                    </label>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="hud-btn-outline" style={{ flex: 1, justifyContent: 'center', color: selectedDivs.length > 0 ? 'var(--accent-warning)' : 'var(--text-muted)', borderColor: selectedDivs.length > 0 ? 'rgba(245,158,11,0.4)' : 'var(--border-secondary)' }} disabled={selectedDivs.length === 0} onClick={handleStartScavenge}>
                  SEND ({selectedDivs.length})
                </button>
                <button className="hud-btn-outline" style={{ justifyContent: 'center', padding: '4px 14px' }} onClick={() => { setShowScavenge(false); setSelectedDivs([]) }}>
                  CANCEL
                </button>
              </div>
            </div>
          ) : null}
          {scavengeMsg && <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'var(--accent-warning)', textAlign: 'center', marginTop: 6 }}>{scavengeMsg}</div>}
        </div>
      )}
    </div>
  )
}
