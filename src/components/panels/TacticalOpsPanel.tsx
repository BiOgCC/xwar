/**
 * TacticalOpsPanel — Simplified replacement for CyberwarfarePanel.
 *
 * Tabs:
 *  1. 🏛️ COUNTRY OPS — funded by citizens via micro-missions, president launches
 *  2. 👤 PLAYER OPS  — solo ops (intel scanning, bunker override)
 *  3. 📋 REPORTS     — intel reports + op history
 */
import React, { useState, useEffect, useMemo } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useUIStore } from '../../stores/uiStore'
import {
  useTacticalOpsStore,
  COUNTRY_OPS, PLAYER_OPS, MISSIONS,
  type CountryOpId, type PlayerOpId, type MissionType, type TacticalOpDef,
} from '../../stores/tacticalOpsStore'

type TabId = 'country' | 'player' | 'reports'

const PILLAR_COLORS: Record<string, string> = {
  country: '#ff8800',
  player: '#00ccff',
}

export default function TacticalOpsPanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const ops = useTacticalOpsStore()

  const [tab, setTab] = useState<TabId>('country')
  const [selectedCountryOp, setSelectedCountryOp] = useState<CountryOpId | null>(null)
  const [selectedPlayerOp, setSelectedPlayerOp] = useState<PlayerOpId | null>(null)
  const [targetCountry, setTargetCountry] = useState('')

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name
  const foreignCountries = world.countries.filter(c => c.code !== iso)

  // Process detection ticks periodically
  useEffect(() => {
    const t = setInterval(() => {
      ops.processDetectionTicks()
      ops.cleanExpiredEffects()
    }, 30000) // every 30s
    return () => clearInterval(t)
  }, [])

  // Timer for countdown updates
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Active scans
  const activeScans = useMemo(() =>
    Object.values(ops.scans).filter(s => s.status === 'scanning' || s.status === 'detected'),
    [ops.scans]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: '3px' }}>
        {([
          { id: 'country' as TabId, label: '🏛️ COUNTRY', badge: '' },
          { id: 'player' as TabId, label: '👤 PLAYER', badge: activeScans.length > 0 ? `📡${activeScans.length}` : '' },
          { id: 'reports' as TabId, label: '📋 REPORTS', badge: ops.reports.length > 0 ? String(ops.reports.length) : '' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.5px', cursor: 'pointer',
              border: `1px solid ${tab === t.id ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '4px',
              background: tab === t.id ? 'rgba(0,255,136,0.1)' : 'transparent',
              color: tab === t.id ? '#00ff88' : '#94a3b8',
            }}
          >
            {t.label}
            {t.badge && <span style={{ marginLeft: '4px', fontSize: '8px', opacity: 0.7 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/*  TAB: COUNTRY OPS                      */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'country' && (
        <>
          <div style={{
            padding: '8px 12px', borderRadius: '6px', fontSize: '9px',
            background: 'rgba(255,136,0,0.06)', border: '1px solid rgba(255,136,0,0.15)',
            color: '#ffaa44',
          }}>
            ⚡ Citizens fund operations via missions. The <strong>President</strong> launches when fully funded.
          </div>

          {COUNTRY_OPS.map(opDef => {
            const isExpanded = selectedCountryOp === opDef.id
            const funding = ops.getFunding(iso, opDef.id as CountryOpId)
            const totalPts = funding?.totalPoints ?? 0
            const required = opDef.fundingRequired
            const pct = Math.min(100, (totalPts / required) * 100)
            const isFunded = funding?.status === 'ready'
            const successChance = ops.getSuccessChance(opDef.id)

            return (
              <div key={opDef.id} className="hud-card" style={{ borderColor: 'rgba(255,136,0,0.2)' }}>
                {/* Header */}
                <button
                  onClick={() => setSelectedCountryOp(isExpanded ? null : opDef.id as CountryOpId)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px',
                    background: isExpanded ? 'rgba(255,136,0,0.06)' : 'transparent',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px' }}>{opDef.icon} {opDef.name}</span>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                      background: isFunded ? 'rgba(0,255,136,0.1)' : 'rgba(255,136,0,0.1)',
                      color: isFunded ? '#00ff88' : '#ff8800',
                      border: `1px solid ${isFunded ? '#00ff8830' : '#ff880030'}`,
                    }}>
                      {isFunded ? '✅ READY' : `${totalPts}/${required} pts`}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px' }}>{opDef.description}</div>

                  {/* Funding bar */}
                  <div style={{
                    marginTop: '6px', height: '6px', borderRadius: '3px',
                    background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: isFunded
                        ? 'linear-gradient(90deg, #00ff88, #00cc66)'
                        : 'linear-gradient(90deg, #ff8800, #ff6600)',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </button>

                {/* Expanded: Missions + Launch */}
                {isExpanded && (
                  <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Effect */}
                    <div style={{
                      fontSize: '10px', color: '#e2e8f0', marginBottom: '8px',
                      padding: '6px 8px', background: 'rgba(255,136,0,0.06)', borderRadius: '4px',
                      borderLeft: '3px solid #ff8800',
                    }}>
                      {opDef.effectDescription}
                    </div>

                    {/* Success chance */}
                    <div style={{ fontSize: '9px', color: '#f59e0b', marginBottom: '8px' }}>
                      ✅ {Math.round(successChance)}% success chance
                    </div>

                    {/* Micro-missions */}
                    {!isFunded && (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                          📋 CONTRIBUTE — Complete missions to fund this op
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                          {MISSIONS.map(mission => (
                            <button
                              key={mission.id}
                              onClick={() => {
                                const result = ops.completeMission(opDef.id as CountryOpId, mission.id as MissionType)
                                ui.addFloatingText(
                                  result.message,
                                  window.innerWidth / 2, window.innerHeight / 2,
                                  result.success ? '#00ff88' : '#ef4444'
                                )
                              }}
                              style={{
                                padding: '8px', fontSize: '9px', fontWeight: 600,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <div>{mission.icon} {mission.name}</div>
                              <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                                {mission.cost.work ? `${mission.cost.work} work` : ''}
                                {mission.cost.stamina ? `${mission.cost.stamina} stam` : ''}
                                {mission.cost.badges ? `${mission.cost.badges} 🎖️` : ''}
                                {mission.cost.bitcoin ? `${mission.cost.bitcoin} ₿` : ''}
                                {mission.id === 'battle_veteran' ? '500+ dmg' : ''}
                                {' → '}
                                <span style={{ color: '#00ff88' }}>+{mission.fundingPoints} pts</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent contributors */}
                    {funding && funding.contributors.length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '3px' }}>
                          RECENT CONTRIBUTORS
                        </div>
                        <div style={{ maxHeight: '40px', overflow: 'auto' }}>
                          {funding.contributors.slice(-5).reverse().map((c, i) => (
                            <div key={i} style={{ fontSize: '8px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{c.playerName}</span>
                              <span style={{ color: '#00cc66' }}>+{c.points} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Target + Launch (President only — can bypass funding via treasury) */}
                    {(isFunded || isPresident) && (
                      <>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                            🎯 TARGET COUNTRY
                          </div>
                          <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                            style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                            <option value="" disabled>Select Country...</option>
                            {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            if (!targetCountry) return
                            const result = ops.launchCountryOp(opDef.id as CountryOpId, targetCountry)
                            ui.addFloatingText(
                              result.message,
                              window.innerWidth / 2, window.innerHeight / 2,
                              result.message.includes('✅') ? '#00ff88' : '#ef4444'
                            )
                          }}
                          disabled={!isPresident || !targetCountry}
                          style={{
                            width: '100%', padding: '10px', fontSize: '11px', fontWeight: 900,
                            letterSpacing: '1px', cursor: isPresident && targetCountry ? 'pointer' : 'not-allowed',
                            background: isPresident && targetCountry ? 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05))' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isPresident && targetCountry ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '4px',
                            color: isPresident && targetCountry ? '#00ff88' : '#475569',
                          }}
                        >
                          {!isPresident ? '🔒 PRESIDENT ONLY' : !targetCountry ? 'SELECT A TARGET' : isFunded ? '🚀 LAUNCH OPERATION' : '🚀 LAUNCH ($5,000 treasury)'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/*  TAB: PLAYER OPS                       */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'player' && (
        <>
          {/* Active Scans (Undercover) */}
          {activeScans.length > 0 && (
            <div className="hud-card" style={{ borderColor: 'rgba(0,204,255,0.3)' }}>
              <div className="hud-card__title" style={{ color: '#00ccff' }}>📡 ACTIVE SCANS</div>
              {activeScans.map(scan => {
                const elapsed = now - scan.startedAt
                const remaining = Math.max(0, scan.scanDurationMs - elapsed)
                const pct = Math.min(100, (elapsed / scan.scanDurationMs) * 100)
                const mins = Math.floor(remaining / 60000)
                const secs = Math.floor((remaining % 60000) / 1000)

                return (
                  <div key={scan.id} style={{
                    marginTop: '6px', padding: '10px', borderRadius: '6px',
                    background: scan.detected ? 'rgba(255,68,68,0.06)' : 'rgba(0,204,255,0.04)',
                    border: `1px solid ${scan.detected ? 'rgba(255,68,68,0.2)' : 'rgba(0,204,255,0.15)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: scan.detected ? '#ff6666' : '#00ccff' }}>
                        {scan.detected ? '🚨 DETECTED!' : '📡 SCANNING...'} — {scan.opId.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8' }}>→ {scan.targetCountry}</span>
                    </div>

                    {!scan.detected && (
                      <>
                        {/* Radar/scanning animation bar */}
                        <div style={{
                          marginTop: '6px', height: '8px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                          position: 'relative',
                        }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: 'linear-gradient(90deg, #00ccff, #0088cc)',
                            transition: 'width 1s linear',
                          }} />
                          {/* Scanning sweep effect */}
                          <div style={{
                            position: 'absolute', top: 0, left: `${pct - 3}%`,
                            width: '6%', height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(0,204,255,0.6), transparent)',
                            animation: 'none',
                          }} />
                        </div>
                        <div style={{ fontSize: '9px', color: '#00ccff', marginTop: '4px', textAlign: 'center' }}>
                          ⏱️ {mins}m {secs.toString().padStart(2, '0')}s remaining
                        </div>
                      </>
                    )}

                    {scan.detected && (
                      <div style={{ marginTop: '6px', fontSize: '9px', color: '#ff6666' }}>
                        ⚔️ Fast battle spawned! Win to complete the intel op.
                        {scan.battleId && (
                          <div style={{ marginTop: '4px', color: '#ffaa44', fontStyle: 'italic' }}>
                            Battle ID: {scan.battleId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Player Ops List */}
          {PLAYER_OPS.map(opDef => {
            const isExpanded = selectedPlayerOp === opDef.id
            const isIntelOp = opDef.id === 'resource_intel' || opDef.id === 'war_intel' || opDef.id === 'disinformation'
            const isBunker = opDef.id === 'bunker_override'
            const color = isBunker ? '#ff4444' : '#00ccff'
            const successChance = ops.getSuccessChance(opDef.id)

            return (
              <div key={opDef.id} className="hud-card" style={{ borderColor: `${color}25` }}>
                <button
                  onClick={() => setSelectedPlayerOp(isExpanded ? null : opDef.id as PlayerOpId)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px',
                    background: isExpanded ? `${color}08` : 'transparent',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px' }}>{opDef.icon} {opDef.name}</span>
                    <span style={{
                      fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                      background: `${color}10`, color, border: `1px solid ${color}30`,
                    }}>
                      {opDef.cost.bitcoin}₿ + {opDef.cost.badgesOfHonor}🎖️
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px' }}>{opDef.description}</div>
                </button>

                {isExpanded && (
                  <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Effect */}
                    <div style={{
                      fontSize: '10px', color: '#e2e8f0', marginBottom: '8px',
                      padding: '6px 8px', background: `${color}08`, borderRadius: '4px',
                      borderLeft: `3px solid ${color}`,
                    }}>
                      {opDef.effectDescription}
                    </div>

                    {/* Info row */}
                    <div style={{ display: 'flex', gap: '8px', fontSize: '9px', color: '#f59e0b', marginBottom: '8px' }}>
                      <span>✅ {Math.round(successChance)}% success</span>
                      {isIntelOp && <span>📡 30min undercover scan</span>}
                      {isBunker && <span>💰 High-end op</span>}
                    </div>

                    {/* Target */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                        🎯 TARGET COUNTRY
                      </div>
                      <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                        style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                        <option value="" disabled>Select Country...</option>
                        {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>

                    {/* Launch */}
                    <button
                      onClick={() => {
                        if (!targetCountry) return
                        const result = ops.launchPlayerOp(opDef.id as PlayerOpId, targetCountry)
                        ui.addFloatingText(
                          result.message,
                          window.innerWidth / 2, window.innerHeight / 2,
                          result.message.includes('📡') || result.message.includes('✅') ? '#00ff88' : '#ef4444'
                        )
                      }}
                      disabled={!targetCountry}
                      style={{
                        width: '100%', padding: '10px', fontSize: '11px', fontWeight: 900,
                        letterSpacing: '1px',
                        cursor: targetCountry ? 'pointer' : 'not-allowed',
                        background: targetCountry
                          ? `linear-gradient(135deg, ${color}15, ${color}05)`
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${targetCountry ? color : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '4px',
                        color: targetCountry ? color : '#475569',
                      }}
                    >
                      {!targetCountry ? 'SELECT A TARGET' : isIntelOp ? '📡 GO UNDERCOVER' : '🚀 LAUNCH'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Active effects on enemies */}
          {ops.activeEffects.length > 0 && (
            <div className="hud-card" style={{ borderColor: 'rgba(34,211,138,0.2)' }}>
              <div className="hud-card__title" style={{ color: '#22d38a' }}>⚡ ACTIVE EFFECTS</div>
              {ops.activeEffects.filter(e => e.expiresAt > now).map(effect => {
                const remaining = effect.expiresAt - now
                const hours = Math.floor(remaining / 3600000)
                const mins = Math.floor((remaining % 3600000) / 60000)
                return (
                  <div key={effect.id} style={{
                    padding: '6px 8px', margin: '4px 0', borderRadius: '4px',
                    background: 'rgba(34,211,138,0.05)', border: '1px solid rgba(34,211,138,0.15)',
                    fontSize: '9px', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#e2e8f0' }}>
                      {effect.opId.replace(/_/g, ' ')} → {effect.targetCountry}
                    </span>
                    <span style={{ color: '#22d38a' }}>
                      {hours > 0 ? `${hours}h ` : ''}{mins}m
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/*  TAB: REPORTS                          */}
      {/* ═══════════════════════════════════════ */}
      {tab === 'reports' && (
        <div className="hud-card">
          <div className="hud-card__title">📋 INTELLIGENCE REPORTS</div>
          {ops.reports.length === 0 ? (
            <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
              No reports yet. Launch intel operations to gather intelligence.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {ops.reports.map(report => (
                <div key={report.id} style={{
                  padding: '10px', borderRadius: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${report.succeeded ? 'rgba(0,204,255,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#00ccff' }}>
                      {report.data.type || report.opId.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                      color: report.succeeded ? '#22d38a' : '#ef4444',
                      background: report.succeeded ? 'rgba(34,211,138,0.1)' : 'rgba(239,68,68,0.1)',
                    }}>
                      {report.succeeded ? '✅ SUCCESS' : '❌ FAILED'}
                    </span>
                  </div>

                  {/* Meta */}
                  <div style={{ fontSize: '8px', color: '#64748b', display: 'flex', gap: '8px' }}>
                    <span>🎯 {report.targetCountry}</span>
                    <span>📅 {new Date(report.timestamp).toLocaleDateString()}</span>
                  </div>

                  {/* Report data */}
                  {report.succeeded && (
                    <details style={{ marginTop: '6px' }}>
                      <summary style={{ fontSize: '9px', color: '#00ccff', cursor: 'pointer', fontWeight: 700 }}>
                        📊 View Report Data
                      </summary>
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px',
                        marginTop: '6px', fontSize: '8px',
                      }}>
                        {Object.entries(report.data)
                          .filter(([k]) => !['type', 'country', 'countryName'].includes(k))
                          .map(([k, v]) => (
                            <div key={k} style={{
                              display: 'flex', justifyContent: 'space-between',
                              padding: '3px 6px', borderRadius: '3px',
                              background: 'rgba(255,255,255,0.02)',
                            }}>
                              <span style={{ color: '#64748b' }}>{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                                {typeof v === 'number' ? v.toLocaleString() : String(v)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
