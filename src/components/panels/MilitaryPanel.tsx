import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import FoodGrid from '../shared/FoodGrid'
import {
  useMilitaryStore,
  MILITARY_OPERATIONS,
  getOperationsByPillar,
  type MilitaryPillar,
  type MilitaryOperationDef,
  type MilitaryCampaign,
} from '../../stores/militaryStore'
import { DETECTION_WINDOW_MS, CONTEST_DURATION_MS } from '../../stores/operationTypes'
import { getPlayerCombatStats } from '../../stores/battleStore'

type ViewMode = 'operations' | 'active' | 'reports'

// Format ms to MM:SS
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function CampaignLifecycleCard({ campaign }: { campaign: MilitaryCampaign }) {
  const mil = useMilitaryStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const opDef = MILITARY_OPERATIONS.find(o => o.id === campaign.operationId)
  if (!opDef) return null

  const phaseColor: Record<string, string> = {
    deploying: '#94a3b8',
    detection_window: '#f59e0b',
    contest: '#ef4444',
    undetected_win: '#22d38a',
    attacker_won: '#22d38a',
    defender_won: '#ef4444',
    returning: '#3b82f6',
  }

  const phaseLabel: Record<string, string> = {
    deploying: '📦 RECRUITING',
    detection_window: '📡 DETECTION WINDOW',
    contest: '⚔️ DAMAGE RACE',
    undetected_win: '✅ UNDETECTED — SUCCESS',
    attacker_won: '🏆 OPERATION SUCCESSFUL',
    defender_won: '🛡️ OPERATION BLOCKED',
    returning: '🔄 RETURNING',
  }

  // Timer calculation
  let timerMs = 0
  if (campaign.phase === 'detection_window' && campaign.detectionWindowStart) {
    timerMs = DETECTION_WINDOW_MS - (now - campaign.detectionWindowStart)
  } else if (campaign.phase === 'contest' && campaign.contestState) {
    timerMs = campaign.contestState.expiresAt - now
  }

  const threshold = campaign.contestState?.threshold || 1000
  const atkPct = campaign.contestState ? Math.min(100, (campaign.contestState.attackerProgress / threshold) * 100) : 0
  const defPct = campaign.contestState ? Math.min(100, (campaign.contestState.defenderProgress / threshold) * 100) : 0

  return (
    <div className="op-lifecycle combat-scanlines">
      {/* Phase Badge + Timer */}
      <div className="op-lifecycle__phase">
        <span
          className={`op-lifecycle__badge op-lifecycle__badge--${
            campaign.phase === 'detection_window' ? 'detection' :
            campaign.phase === 'undetected_win' || campaign.phase === 'attacker_won' ? 'won' :
            campaign.phase === 'defender_won' ? 'lost' :
            campaign.phase
          }`}
        >
          {phaseLabel[campaign.phase] || campaign.phase}
        </span>

        {timerMs > 0 && (
          <span className="op-lifecycle__timer">{fmt(timerMs)}</span>
        )}
      </div>

      {/* Operation Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
          {opDef.icon} {opDef.name}
        </span>
        <span style={{ fontSize: '9px', color: '#f59e0b' }}>→ {campaign.targetCountry}</span>
      </div>

      {/* Crew */}
      <div style={{ fontSize: '9px', color: '#64748b' }}>
        Crew: {campaign.playersJoined.join(', ')} ({campaign.playersJoined.length}/6)
      </div>

      {/* Detection Window — Radar Animation */}
      {campaign.phase === 'detection_window' && (
        <div className="op-radar">
          <span className="op-radar__icon">📡</span>
          <div>
            <div className="op-radar__text">Scanning for hostiles...</div>
            <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px' }}>
              Detection chance: {opDef.successChance ? (100 - opDef.successChance) : 30}%
            </div>
          </div>
        </div>
      )}

      {/* Contest — Damage Race Bar */}
      {campaign.phase === 'contest' && campaign.contestState && (
        <div className="contest-bar">
          <div className="contest-bar__header">
            <span className="contest-bar__title">⚔️ DAMAGE RACE</span>
            <span className="contest-bar__timer">{fmt(timerMs)}</span>
          </div>

          {/* Racing bar */}
          <div className="contest-bar__track">
            <div className="contest-bar__fill--atk" style={{ width: `${atkPct}%` }} />
            <div className="contest-bar__fill--def" style={{ width: `${defPct}%` }} />
            <div className="contest-bar__threshold" style={{ left: '50%' }} />
          </div>

          <div className="contest-bar__labels">
            <span>⚔️ ATK: {campaign.contestState.attackerProgress} / {threshold}</span>
            <span>🛡️ DEF: {campaign.contestState.defenderProgress} / {threshold}</span>
          </div>

          {/* Attack/Defend Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
            <button
              className="contest-action-btn contest-action-btn--attack"
              onClick={() => {
                const cs = getPlayerCombatStats()
                const r = mil.contributeDamage(campaign.id, player.name, cs.attackDamage)
                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
              }}
              disabled={player.stamina < 5}
            >
              ⚔️ DEAL DAMAGE
              <div className="contest-action-btn__cost">-5 Stamina · +{getPlayerCombatStats().attackDamage} dmg</div>
            </button>
            <button
              className="contest-action-btn contest-action-btn--defend"
              onClick={() => {
                const cs = getPlayerCombatStats()
                const block = cs.armorBlock + Math.floor(cs.dodgeChance * 0.5)
                const r = mil.defendOperation(campaign.id, player.name, block)
                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#60a5fa' : '#ef4444')
              }}
              disabled={player.stamina < 3}
            >
              🛡️ BLOCK ATTACK
              <div className="contest-action-btn__cost">-3 Stamina · +{getPlayerCombatStats().armorBlock} block</div>
            </button>
          </div>

          {/* Contributors */}
          {campaign.contestState.attackerContributors.length > 0 && (
            <div className="contest-contributors">
              <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>TOP CONTRIBUTORS</div>
              {campaign.contestState.attackerContributors.sort((a, b) => b.contributed - a.contributed).slice(0, 5).map(c => (
                <div key={c.playerId} className="contest-contrib">
                  <span className="contest-contrib__name">{c.playerId}</span>
                  <span className="contest-contrib__val contest-contrib__val--atk">+{c.contributed}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Deploying — Join/Deploy Controls */}
      {campaign.phase === 'deploying' && (
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          {!campaign.playersJoined.includes(player.name) && (
            <button className="war-btn war-btn--primary" onClick={() => mil.joinCampaign(campaign.id, player.name)}>
              JOIN CREW
            </button>
          )}
          {campaign.initiator === player.name && (
            <button
              className="war-btn war-btn--primary"
              style={{ background: 'rgba(239,68,68,0.2)' }}
              onClick={() => {
                mil.deployCampaign(campaign.id)
                ui.addFloatingText('DEPLOYED! Detection window started.', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
              }}
            >
              🚀 DEPLOY NOW
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function MilitaryPanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()
  const mil = useMilitaryStore()
  const govStore = useGovernmentStore()

  const [activePillar, setActivePillar] = useState<MilitaryPillar>('ground')
  const [selectedOp, setSelectedOp] = useState<MilitaryOperationDef | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('operations')

  const [targetCountry, setTargetCountry] = useState('')
  const [invitedPlayers, setInvitedPlayers] = useState<string[]>([])
  const [inviteInput, setInviteInput] = useState('')

  const iso = player.countryCode || 'US'

  const pillars: { id: MilitaryPillar; label: string; icon: string }[] = [
    { id: 'ground', label: 'GROUND', icon: '⚔️' },
    { id: 'air', label: 'AIR', icon: '✈️' },
    { id: 'naval', label: 'NAVAL', icon: '⛴️' },
    { id: 'special', label: 'SPECIAL', icon: '🔥' },
  ]

  const operations = getOperationsByPillar(activePillar)

  const getTargets = () => {
    if (!selectedOp) return world.countries.filter(c => c.code !== iso)
    if (selectedOp.targetType === 'adjacent_country') {
      const adj = ADJACENCY_MAP[iso] || []
      return world.countries.filter(c => adj.includes(c.code))
    }
    if (selectedOp.targetType === 'any_coastal') {
      return world.countries.filter(c => c.code !== iso && c.portLevel > 0)
    }
    if (selectedOp.targetType === 'any_airport') {
      return world.countries.filter(c => c.code !== iso && c.airportLevel > 0)
    }
    return world.countries.filter(c => c.code !== iso)
  }

  const hasRequiredItem = () => {
    if (!selectedOp?.requiresItem) return true
    if (selectedOp.requiresItem === 'warship') return inventory.items.some(i => i.slot === 'vehicle' && i.tier === 't6')
    if (selectedOp.requiresItem === 'jet') return inventory.items.some(i => i.slot === 'weapon' && i.tier === 't6')
    return true
  }

  const handleLaunch = () => {
    if (!selectedOp || !targetCountry) {
      ui.addFloatingText('SELECT A TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    if (!hasRequiredItem()) {
      ui.addFloatingText(`REQUIRES ${selectedOp.requiresItem === 'warship' ? 'T6 Warship' : 'T6 Jet'}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    const result = mil.launchCampaign(selectedOp.id, targetCountry, invitedPlayers)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
    setSelectedOp(null)
    setInvitedPlayers([])
    setTargetCountry('')
  }

  const addInvite = () => {
    if (inviteInput && invitedPlayers.length < 5 && !invitedPlayers.includes(inviteInput)) {
      setInvitedPlayers([...invitedPlayers, inviteInput])
      setInviteInput('')
    }
  }

  const allReports = Object.values(mil.reports).sort((a, b) => b.timestamp - a.timestamp)
  const allCampaigns = Object.values(mil.campaigns).sort((a, b) => b.createdAt - a.createdAt)
  const activeCampaigns = allCampaigns.filter(c =>
    c.phase === 'deploying' || c.phase === 'detection_window' || c.phase === 'contest'
  )

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
            {mode === 'operations' ? '🎖️ OPS' : mode === 'active' ? `⚡ ACTIVE (${activeCampaigns.length})` : `📋 REPORTS (${allReports.length})`}
          </button>
        ))}
      </div>

      {/* ====== OPERATIONS VIEW ====== */}
      {viewMode === 'operations' && (
        <>
          <div style={{ display: 'flex', gap: '4px' }}>
            {pillars.map(p => (
              <button
                key={p.id}
                onClick={() => { setActivePillar(p.id); setSelectedOp(null) }}
                className={`war-btn ${activePillar === p.id ? 'war-btn--primary' : ''}`}
                style={{ flex: 1, fontSize: '9px', padding: '7px 4px' }}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          <FoodGrid />

          <div className="war-card">
            <div className="war-card__title">
              {pillars.find(p => p.id === activePillar)?.icon} {activePillar.toUpperCase()} OPERATIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {operations.map(op => (
                <button
                  key={op.id}
                  onClick={() => setSelectedOp(selectedOp?.id === op.id ? null : op)}
                  className={`war-card ${selectedOp?.id === op.id ? 'war-card--red' : ''}`}
                  style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px', color: '#e2e8f0' }}>{op.icon} {op.name}</span>
                    <span style={{ fontSize: '9px', color: '#f59e0b' }}>
                      {op.cost.bitcoin > 0 ? `₿${op.cost.bitcoin}` : `${op.cost.oil} Oil`}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{op.description}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedOp && (
            <div className="war-card war-card--highlight">
              <div className="war-card__title" style={{ color: '#ef4444' }}>{selectedOp.icon} {selectedOp.name}</div>

              {govStore.isMissionCompleted(selectedOp.id, iso) && (
                <div style={{ padding: '6px', margin: '6px 0', textAlign: 'center', fontSize: '9px', fontWeight: 900, background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '4px', color: '#22d38a', letterSpacing: '0.5px' }}>
                  ✅ REQUIREMENTS MET — READY TO EXECUTE
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', margin: '8px 0' }}>
                {[
                  ['🔩', 'Scrap', selectedOp.cost.scrap],
                  ['🛢️', 'Oil', selectedOp.cost.oil],
                  ['⚛️', 'MatX', selectedOp.cost.materialX],
                  ['₿', 'BTC', selectedOp.cost.bitcoin],
                ].map(([icon, label, val]) => (
                  <div key={String(label)} className="war-stat" style={{ flexDirection: 'row', gap: '4px', padding: '4px 6px' }}>
                    <span style={{ fontSize: '10px' }}>{icon}</span>
                    <span style={{ fontSize: '8px', color: '#64748b' }}>{label}:</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0', marginLeft: 'auto' }}>{Number(val).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>{selectedOp.effectDescription}</div>
              <div style={{ fontSize: '9px', color: '#f59e0b', marginBottom: '8px' }}>
                Success: {selectedOp.successChance}%
                {selectedOp.requiresItem && ` · Requires: ${selectedOp.requiresItem === 'warship' ? 'T6 Warship' : 'T6 Jet'}`}
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>TARGET</div>
                <select className="war-input" value={targetCountry} onChange={e => setTargetCountry(e.target.value)}>
                  <option value="" disabled>Select Target...</option>
                  {getTargets().map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {selectedOp.requiresItem && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>INVITE CREW ({invitedPlayers.length}/5)</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input className="war-input" type="text" value={inviteInput} onChange={e => setInviteInput(e.target.value)} placeholder="Player name..." />
                    <button className="war-btn" onClick={addInvite}>+</button>
                  </div>
                  {invitedPlayers.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {invitedPlayers.map(p => (
                        <span key={p} style={{ fontSize: '9px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', color: '#ef4444' }}
                          onClick={() => setInvitedPlayers(invitedPlayers.filter(x => x !== p))}
                        >{p} ✕</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                className="war-recruit-btn"
                onClick={govStore.isMissionCompleted(selectedOp.id, iso) ? handleLaunch : undefined}
                disabled={!govStore.isMissionCompleted(selectedOp.id, iso)}
              >
                {govStore.isMissionCompleted(selectedOp.id, iso) ? '🚀 LAUNCH OPERATION' : '🔒 COMPLETE MISSION FIRST'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ====== ACTIVE CAMPAIGNS VIEW ====== */}
      {viewMode === 'active' && (
        <>
          {activeCampaigns.length === 0 ? (
            <div className="war-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>No active operations. Launch one from the OPS tab.</div>
            </div>
          ) : (
            activeCampaigns.map(c => (
              <CampaignLifecycleCard key={c.id} campaign={c} />
            ))
          )}
        </>
      )}

      {/* ====== REPORTS VIEW ====== */}
      {viewMode === 'reports' && (
        <>
          <div className="war-card">
            <div className="war-card__title">📋 OPERATION REPORTS</div>
            {allReports.length === 0 ? (
              <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>No reports yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {allReports.slice(0, 10).map(report => {
                  const d = report.data
                  const isWin = report.result === 'victory'
                  const rc = isWin ? '#22d38a' : '#ef4444'
                  return (
                    <div key={report.id} style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${rc}33`, padding: '10px', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: rc }}>{report.operationName} — {report.result.toUpperCase()}</span>
                        <span style={{ fontSize: '8px', color: '#64748b' }}>{new Date(report.timestamp).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>
                        {report.originCountry} → {report.targetCountry} · Rounds: {d.attackerRoundsWon}-{d.defenderRoundsWon}
                        · Dmg: {d.totalAttackerDamage.toLocaleString()} vs {d.totalDefenderDamage.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {allCampaigns.length > 0 && (
            <div className="war-card">
              <div className="war-card__title">📂 CAMPAIGN HISTORY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '8px' }}>
                {allCampaigns.slice(0, 10).map(c => {
                  const opDef = MILITARY_OPERATIONS.find(o => o.id === c.operationId)
                  const pc: Record<string, string> = { deploying: '#94a3b8', detection_window: '#f59e0b', contest: '#ef4444', attacker_won: '#22d38a', defender_won: '#ef4444', undetected_win: '#22d38a' }
                  return (
                    <div key={c.id} style={{ fontSize: '9px', display: 'flex', justifyContent: 'space-between', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                      <span>{opDef?.icon} {opDef?.name} → {c.targetCountry}</span>
                      <span style={{ color: pc[c.phase] || '#666', textTransform: 'uppercase', fontWeight: 700, fontSize: '8px' }}>{c.phase.replace(/_/g, ' ')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
