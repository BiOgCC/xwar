import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import { useBattleStore } from '../../stores/battleStore'
import {
  useMilitaryStore,
  MILITARY_OPERATIONS,
  getOperationsByPillar,
  type MilitaryPillar,
  type MilitaryOperationDef,
} from '../../stores/militaryStore'
import { useArmyStore, type Army } from '../../stores/army'
import RegionPicker from '../shared/RegionPicker'

// ── Sub-component: Force Autodefense ───────────────────────────────
// Extracted to satisfy React rules-of-hooks (no hooks inside callbacks/IIFEs)
function ForceAutodefense({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const playerArmies = Object.values(armyStore.armies).filter((a): a is Army => !!a && (a as Army).countryCode === iso)
  if (playerArmies.length === 0) return null

  return (
    <div className="war-card" style={{ borderColor: 'rgba(34,211,138,0.15)' }}>
      <div className="war-card__title" style={{ marginBottom: '8px' }}>🛡️ FORCE AUTODEFENSE</div>
      <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '8px' }}>
        Set how many divisions each military force auto-deploys on defense.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {playerArmies.map((army: Army) => {
          const armyDivCount = army.divisionIds.filter((did: string) => {
            const d = armyStore.divisions[did]
            return d && d.status === 'ready'
          }).length
          const limit = army.autoDefenseLimit ?? 0
          const sv = limit === -1 ? armyDivCount + 1 : limit
          const label = limit === -1 ? 'ALL' : limit === 0 ? 'OFF' : `${limit}`
          const color = limit === 0 ? '#ef4444' : limit === -1 ? '#22d38a' : '#3b82f6'
          return (
            <div key={army.id} style={{
              padding: '8px', borderRadius: '5px',
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${color}25`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>⚔️ {army.name}</span>
                <span style={{ fontSize: '8px', color: '#64748b' }}>{armyDivCount} div{armyDivCount !== 1 ? 's' : ''} ready</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="range" min={0} max={armyDivCount + 1} value={sv}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    armyStore.setArmyAutoDefenseLimit(army.id, v > armyDivCount ? -1 : v)
                  }}
                  style={{ flex: 1, accentColor: color, cursor: 'pointer' }}
                />
                <div style={{
                  minWidth: '36px', textAlign: 'center', padding: '3px 6px', borderRadius: '3px',
                  fontSize: '10px', fontWeight: 900,
                  background: `${color}18`, border: `1px solid ${color}40`, color,
                }}>{label}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: '#475569', marginTop: '2px' }}>
                <span>OFF</span><span>ALL</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ViewMode = 'operations' | 'active' | 'reports'

const PILLAR_COLORS: Record<string, string> = {
  ground: '#ef4444',
  air: '#3b82f6',
  naval: '#06b6d4',
}

export default function MilitaryPanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const ui = useUIStore()
  const mil = useMilitaryStore()
  const battleStore = useBattleStore()

  const [activePillar, setActivePillar] = useState<MilitaryPillar>('ground')
  const [viewMode, setViewMode] = useState<ViewMode>('operations')
  const [expandedOp, setExpandedOp] = useState<string | null>(null)

  // ── Map targeting bridge ──
  // targetCountry/Region are driven by clicking on the map while this panel is open.
  // They live in uiStore so the map click handler can write them.
  const mapTargetCountry = useUIStore(s => s.mapTargetCountry)
  const mapTargetRegion  = useUIStore(s => s.mapTargetRegion)
  const mapTargetRegionName = useUIStore(s => s.mapTargetRegionName)
  const setMapTarget     = useUIStore(s => s.setMapTarget)

  // Local override for manual dropdown selection (keeps backward compat)
  const [manualCountry, setManualCountry] = useState('')
  const [manualRegion, setManualRegion]   = useState('')

  // Effective target: prefer map target, fall back to manual
  const targetCountry = mapTargetCountry ?? manualCountry
  const targetRegion  = mapTargetRegion  ?? manualRegion

  // When map target changes, clear any manual override
  useEffect(() => {
    if (mapTargetCountry) { setManualCountry(''); setManualRegion('') }
  }, [mapTargetCountry])

  const iso = player.countryCode || 'US'

  const pillars: { id: MilitaryPillar; label: string; icon: string }[] = [
    { id: 'ground', label: 'GROUND', icon: '⚔️' },
    { id: 'air', label: 'AIR', icon: '✈️' },
    { id: 'naval', label: 'NAVAL', icon: '⛴️' },
  ]

  const operations = getOperationsByPillar(activePillar)

  const handleLaunchDuel = (op: MilitaryOperationDef) => {
    if (!targetCountry) {
      ui.addFloatingText('SELECT A TARGET COUNTRY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    if (!targetRegion) {
      ui.addFloatingText('SELECT A REGION', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    const result = mil.launchDuel(op.id, targetCountry, targetRegion)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  // Active battles that are quick_battle type
  const quickBattles = Object.values(battleStore.battles).filter(b =>
    b.type === 'quick_battle' && b.status === 'active'
  )

  const allReports = Object.values(mil.reports).sort((a, b) => b.timestamp - a.timestamp)
  const canAffordBadge = player.badgesOfHonor >= 1
  const canAffordBitcoin = player.bitcoin >= 1
  const canAffordBoth = canAffordBadge && canAffordBitcoin

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {(['operations', 'active', 'reports'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            className={viewMode === mode ? 'war-btn war-btn--primary' : 'war-btn'}
            style={{ flex: 1, fontSize: '9px', padding: '6px', textTransform: 'uppercase' }}
            onClick={() => setViewMode(mode)}
          >
            {mode === 'operations' ? '⚔️ DUELS' : mode === 'active' ? `⚡ LIVE (${quickBattles.length})` : `📋 LOG (${allReports.length})`}
          </button>
        ))}
      </div>

      {/* ====== OPERATIONS VIEW ====== */}
      {viewMode === 'operations' && (
        <>
          {/* Pillar Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {pillars.map(p => (
              <button
                key={p.id}
                onClick={() => { setActivePillar(p.id); setExpandedOp(null) }}
                className={`war-btn ${activePillar === p.id ? 'war-btn--primary' : ''}`}
                style={{ flex: 1, fontSize: '9px', padding: '7px 4px' }}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Target Selection */}
          <div className="war-card" style={{
            borderColor: targetCountry ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)',
            transition: 'border-color 0.3s',
            position: 'relative',
          }}>

            {/* Map targeting mode banner */}
            {!targetCountry && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 12px', borderRadius: '6px',
                background: 'rgba(6,182,212,0.06)',
                border: '1px dashed rgba(6,182,212,0.3)',
                marginBottom: '8px',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }}>
                <span style={{ fontSize: '16px' }}>🗺️</span>
                <div>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: '#06b6d4', letterSpacing: '0.5px' }}>
                    CLICK ON THE MAP TO SET TARGET
                  </div>
                  <div style={{ fontSize: '8px', color: '#475569', marginTop: '1px' }}>
                    Or select manually below
                  </div>
                </div>
              </div>
            )}

            {/* Active map target display */}
            {targetCountry && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: '6px', marginBottom: '8px',
                background: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>🎯</span>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#06b6d4' }}>
                      {world.countries.find(c => c.code === targetCountry)?.name ?? targetCountry}
                    </div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '1px' }}>
                      {mapTargetRegionName ?? (targetRegion ? 'Region selected' : 'No region')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setMapTarget(null, null, null); setManualCountry(''); setManualRegion('') }}
                  style={{
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', borderRadius: '4px', cursor: 'pointer',
                    fontSize: '9px', fontWeight: 700, padding: '3px 8px',
                  }}
                >✕ CLEAR</button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>
                  🎯 TARGET COUNTRY
                </div>
                <select
                  className="war-input"
                  value={targetCountry}
                  onChange={e => {
                    const v = e.target.value
                    setMapTarget(null, null, null)  // clear map target
                    setManualCountry(v)
                    setManualRegion('')
                  }}
                  style={{ fontSize: '10px', borderColor: targetCountry ? 'rgba(6,182,212,0.4)' : undefined }}
                >
                  <option value="" disabled>Select Country...</option>
                  {world.countries.filter(c => c.code !== (player.countryCode || 'US')).map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {targetCountry && !mapTargetRegion && (
                <RegionPicker
                  countryCode={targetCountry}
                  value={manualRegion}
                  onChange={setManualRegion}
                  label="📍 TARGET REGION"
                  className="war-input"
                />
              )}
            </div>
          </div>

          {/* Operation Cards */}
          <div className="war-card">
            <div className="war-card__title" style={{ marginBottom: '8px' }}>
              {pillars.find(p => p.id === activePillar)?.icon} {activePillar.toUpperCase()} DUELS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {operations.map(op => {
                const color = PILLAR_COLORS[activePillar] || '#ef4444'
                const hasTarget = targetCountry !== '' && targetRegion !== ''
                const canLaunch = canAffordBoth && hasTarget
                const isExpanded = expandedOp === op.id

                return (
                  <div key={op.id} style={{
                    borderRadius: '5px', overflow: 'hidden',
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isExpanded ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.15s',
                  }}>
                    {/* Clickable Header */}
                    <button
                      onClick={() => setExpandedOp(isExpanded ? null : op.id)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px',
                        background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 700, fontSize: '11px' }}>
                          {op.icon} {op.name}
                        </span>
                        <span style={{
                          fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                          background: `${color}12`, color: color, border: `1px solid ${color}30`,
                        }}>
                          1₿ + 1🎖️ → 1📦
                        </span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8' }}>{op.description}</div>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 10px 10px 10px',
                        borderTop: `1px solid ${color}15`,
                      }}>
                        {/* Result Description */}
                        <div style={{
                          fontSize: '9px', color: '#cbd5e1', margin: '8px 0',
                          padding: '6px 8px', borderRadius: '4px',
                          background: `${color}08`, borderLeft: `3px solid ${color}`,
                          lineHeight: '1.5',
                        }}>
                          <strong style={{ color }}>RESULT:</strong> {op.resultDescription}
                        </div>

                        {/* Rewards */}
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                            🏆 REWARDS
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                            <div style={{
                              fontSize: '9px', fontWeight: 700, padding: '5px', borderRadius: '4px', textAlign: 'center',
                              background: canAffordBitcoin ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                              border: `1px solid ${canAffordBitcoin ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                              color: canAffordBitcoin ? '#f59e0b' : '#ef4444',
                            }}>
                              ₿1 Bitcoin
                            </div>
                            <div style={{
                              fontSize: '9px', fontWeight: 700, padding: '5px', borderRadius: '4px', textAlign: 'center',
                              background: canAffordBadge ? 'rgba(34,211,138,0.08)' : 'rgba(239,68,68,0.08)',
                              border: `1px solid ${canAffordBadge ? 'rgba(34,211,138,0.2)' : 'rgba(239,68,68,0.2)'}`,
                              color: canAffordBadge ? '#22d38a' : '#ef4444',
                            }}>
                              🎖️1 Badge
                            </div>
                          </div>
                          <div style={{ fontSize: '8px', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>
                            🏆 WIN REWARD: 📦 1 Military Case
                          </div>
                        </div>

                        {/* Sabotage special info */}
                        {op.id === 'sabotage' && (
                          <div style={{
                            fontSize: '8px', color: '#f59e0b', marginBottom: '8px',
                            padding: '5px 8px', borderRadius: '4px',
                            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                          }}>
                            ⚠️ <strong>SABOTAGE</strong>: Win the first duel → defender gets a chance to counter-attack → win the second duel → disable a target company for 48 hours.
                          </div>
                        )}

                        {/* Launch Button */}
                        <button
                          onClick={() => handleLaunchDuel(op)}
                          disabled={!canLaunch}
                          style={{
                            width: '100%', padding: '10px', fontSize: '11px', fontWeight: 900,
                            letterSpacing: '0.5px', borderRadius: '4px',
                            cursor: canLaunch ? 'pointer' : 'not-allowed',
                            background: canLaunch
                              ? `linear-gradient(135deg, ${color}25, ${color}10)`
                              : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${canLaunch ? `${color}60` : 'rgba(255,255,255,0.08)'}`,
                            color: canLaunch ? '#fff' : '#475569',
                            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: canLaunch ? `0 0 12px ${color}20` : 'none',
                          }}
                        >
                          {!hasTarget ? '🎯 SELECT TARGET FIRST' : !canAffordBoth ? '₿+🎖️ NEED BITCOIN & BADGE' : '⚔️ LAUNCH DUEL'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Player Stats Bar */}
            <div style={{
              marginTop: '10px', padding: '8px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-around', fontSize: '9px', fontWeight: 700,
            }}>
              <span style={{ color: canAffordBadge ? '#22d38a' : '#ef4444' }}>
                🎖️ {player.badgesOfHonor}
              </span>
              <span style={{ color: player.stamina > 0 ? '#3b82f6' : '#ef4444' }}>
                ⚡ {Math.floor(player.stamina)}/{player.maxStamina}
              </span>
              <span style={{ color: '#f59e0b' }}>
                ₿ {player.bitcoin.toLocaleString()}
              </span>
              <span style={{ color: '#a855f7' }}>
                📦 {player.militaryBoxes}
              </span>
            </div>
          </div>

          {/* Force Autodefense Section */}
          <ForceAutodefense iso={iso} />
        </>
      )}

      {/* ====== ACTIVE BATTLES VIEW ====== */}
      {viewMode === 'active' && (
        <>
          {quickBattles.length === 0 ? (
            <div className="war-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>No active duels. Launch one from the DUELS tab.</div>
            </div>
          ) : (
            quickBattles.map(battle => {
              const atkDmg = Object.values(battle.attackerDamageDealers).reduce((s, v) => s + v, 0)
              const defDmg = Object.values(battle.defenderDamageDealers).reduce((s, v) => s + v, 0)
              const round = battle.rounds[battle.rounds.length - 1]
              const totalPts = round ? round.attackerPoints + round.defenderPoints : 0

              return (
                <div key={battle.id} className="war-card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0' }}>
                      ⚔️ {battle.regionName}
                    </span>
                    <span style={{
                      fontSize: '8px', fontWeight: 900, padding: '3px 8px', borderRadius: '3px',
                      background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.3)',
                    }}>
                      🔴 LIVE
                    </span>
                  </div>

                  <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
                    {battle.attackerId} ⚔️ {battle.defenderId}
                  </div>

                  {/* Ground Points Bar */}
                  {round && (
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '2px' }}>
                        <span style={{ color: '#22d38a', fontWeight: 700 }}>⚔️ ATK: {round.attackerPoints}/200</span>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>🛡️ DEF: {round.defenderPoints}/200</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)' }}>
                        <div style={{
                          width: `${totalPts > 0 ? (round.attackerPoints / totalPts) * 100 : 50}%`,
                          background: 'linear-gradient(90deg, #22d38a, #00cc66)', transition: 'width 0.3s',
                        }} />
                        <div style={{
                          width: `${totalPts > 0 ? (round.defenderPoints / totalPts) * 100 : 50}%`,
                          background: 'linear-gradient(90deg, #ef4444, #cc0000)', transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Damage */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9px' }}>
                    <div style={{ padding: '4px 6px', borderRadius: '3px', background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.1)', color: '#22d38a' }}>
                      ⚔️ ATK: {atkDmg.toLocaleString()}
                    </div>
                    <div style={{ padding: '4px 6px', borderRadius: '3px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      🛡️ DEF: {defDmg.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ fontSize: '8px', color: '#475569', marginTop: '4px', textAlign: 'center' }}>
                    💡 Go to Combat panel to fight in this duel
                  </div>
                </div>
              )
            })
          )}
        </>
      )}

      {/* ====== REPORTS VIEW ====== */}
      {viewMode === 'reports' && (
        <>
          <div className="war-card">
            <div className="war-card__title">📋 DUEL LOG</div>
            {allReports.length === 0 ? (
              <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>No duels yet. Launch your first one!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {allReports.slice(0, 15).map(report => {
                  const isWin = report.result === 'victory'
                  const isPending = report.result === 'pending'
                  const rc = isPending ? '#f59e0b' : isWin ? '#22d38a' : '#ef4444'
                  const elapsed = Date.now() - report.timestamp
                  const mins = Math.floor(elapsed / 60000)
                  const timeStr = mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
                  return (
                    <div key={report.id} style={{
                      background: 'rgba(0,0,0,0.3)', border: `1px solid ${rc}25`, padding: '8px', borderRadius: '4px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: rc }}>
                          {report.operationName}
                        </span>
                        <span style={{ fontSize: '9px', color: '#64748b', marginLeft: '6px' }}>
                          → {report.targetRegion}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                          background: `${rc}15`, color: rc, border: `1px solid ${rc}30`,
                        }}>
                          {isPending ? '⏳ LIVE' : isWin ? '✅ WON' : '❌ LOST'}
                        </span>
                        <span style={{ fontSize: '8px', color: '#475569' }}>{timeStr}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
