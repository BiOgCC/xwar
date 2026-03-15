import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'
import {
  useMilitaryStore,
  MILITARY_OPERATIONS,
  getOperationsByPillar,
  type MilitaryPillar,
  type MilitaryOperationDef,
} from '../../stores/militaryStore'

type ViewMode = 'operations' | 'reports'

export default function MilitaryPanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()
  const mil = useMilitaryStore()

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

  // Calculate valid targets based on operation type
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

  // Check if player has required item
  const hasRequiredItem = () => {
    if (!selectedOp?.requiresItem) return true
    if (selectedOp.requiresItem === 'warship') {
      return inventory.items.some(i => i.slot === 'vehicle' && i.tier === 't6')
    }
    if (selectedOp.requiresItem === 'jet') {
      return inventory.items.some(i => i.slot === 'weapon' && i.tier === 't6')
    }
    return true
  }

  const handleLaunch = () => {
    if (!selectedOp) return
    if (!targetCountry) {
      ui.addFloatingText('SELECT A TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    if (!hasRequiredItem()) {
      const needed = selectedOp.requiresItem === 'warship' ? 'T6 Warship' : 'T6 Jet'
      ui.addFloatingText(`REQUIRES ${needed}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    const result = mil.launchCampaign(selectedOp.id, targetCountry, invitedPlayers)
    if (result.success) {
      ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    } else {
      ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
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

  // Reports & Campaigns
  const allReports = Object.values(mil.reports).sort((a, b) => b.timestamp - a.timestamp)
  const allCampaigns = Object.values(mil.campaigns).sort((a, b) => b.createdAt - a.createdAt)
  const activeCampaigns = allCampaigns.filter(c => c.status === 'recruiting')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className={viewMode === 'operations' ? 'hud-btn-primary' : 'hud-btn-outline'}
          style={{ flex: 1, fontSize: '10px', padding: '6px' }}
          onClick={() => setViewMode('operations')}
        >
          🎖️ OPERATIONS
        </button>
        <button
          className={viewMode === 'reports' ? 'hud-btn-primary' : 'hud-btn-outline'}
          style={{ flex: 1, fontSize: '10px', padding: '6px' }}
          onClick={() => setViewMode('reports')}
        >
          📋 REPORTS ({allReports.length})
        </button>
      </div>

      {viewMode === 'operations' && (
        <>
          {/* Pillar Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {pillars.map(p => (
              <button
                key={p.id}
                onClick={() => { setActivePillar(p.id); setSelectedOp(null) }}
                style={{
                  flex: 1, padding: '8px 4px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
                  border: `1px solid ${activePillar === p.id ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4px', background: activePillar === p.id ? 'rgba(239,68,68,0.1)' : 'transparent',
                  color: activePillar === p.id ? '#ef4444' : '#94a3b8', cursor: 'pointer',
                }}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Operation List */}
          <div className="hud-card">
            <div className="hud-card__title">
              {pillars.find(p => p.id === activePillar)?.icon} {activePillar.toUpperCase()} OPERATIONS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {operations.map(op => (
                <button
                  key={op.id}
                  onClick={() => setSelectedOp(selectedOp?.id === op.id ? null : op)}
                  style={{
                    textAlign: 'left', padding: '10px',
                    background: selectedOp?.id === op.id ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedOp?.id === op.id ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '4px', cursor: 'pointer', color: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px' }}>{op.icon} {op.name}</span>
                    <span style={{ fontSize: '9px', color: '#f59e0b' }}>
                      {op.cost.bitcoin > 0 ? `₿${op.cost.bitcoin}` : `${op.cost.oil} Oil`}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{op.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Operation Details */}
          {selectedOp && (
            <div className="hud-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="hud-card__title">{selectedOp.icon} {selectedOp.name}</div>

              {/* Cost Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', margin: '8px 0' }}>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  ⚡ Energy: {selectedOp.cost.energy.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  🛢️ Oil: {selectedOp.cost.oil.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  ⚛️ MatX: {selectedOp.cost.materialX.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  ₿ BTC: {selectedOp.cost.bitcoin}
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px' }}>{selectedOp.effectDescription}</div>

              <div style={{ fontSize: '9px', color: '#f59e0b', marginBottom: '8px' }}>
                Success: {selectedOp.successChance}%
                {selectedOp.requiresItem && ` · Requires: ${selectedOp.requiresItem === 'warship' ? 'T6 Warship' : 'T6 Jet'}`}
                {selectedOp.requiresInfra && ` · Infra: ${selectedOp.requiresInfra.toUpperCase()}`}
              </div>

              {/* Target Selection */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>TARGET</div>
                <select
                  value={targetCountry}
                  onChange={e => setTargetCountry(e.target.value)}
                  style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                >
                  <option value="" disabled>Select Target...</option>
                  {getTargets().map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              {/* Invite Players (for warship/jet ops) */}
              {selectedOp.requiresItem && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
                    INVITE CREW ({invitedPlayers.length}/5)
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text" value={inviteInput}
                      onChange={e => setInviteInput(e.target.value)}
                      placeholder="Player name..."
                      style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                    />
                    <button className="hud-btn-outline" onClick={addInvite} style={{ fontSize: '9px', padding: '4px 8px' }}>+</button>
                  </div>
                  {invitedPlayers.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {invitedPlayers.map(p => (
                        <span key={p} style={{ fontSize: '9px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', color: '#ef4444' }}
                          onClick={() => setInvitedPlayers(invitedPlayers.filter(x => x !== p))}
                        >
                          {p} ✕
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Launch Button */}
              <button
                className="hud-btn-primary"
                onClick={handleLaunch}
                style={{ width: '100%', padding: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', background: '#dc2626' }}
              >
                🚀 LAUNCH OPERATION
              </button>
            </div>
          )}
        </>
      )}

      {/* REPORTS VIEW */}
      {viewMode === 'reports' && (
        <>
          {/* Active Lobbies */}
          {activeCampaigns.length > 0 && (
            <div className="hud-card" style={{ borderColor: '#f59e0b33' }}>
              <div className="hud-card__title" style={{ color: '#f59e0b' }}>🎯 ACTIVE LOBBIES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {activeCampaigns.map(c => {
                  const opDef = MILITARY_OPERATIONS.find(o => o.id === c.operationId)
                  return (
                    <div key={c.id} style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>{opDef?.icon} {opDef?.name}</span>
                        <span style={{ fontSize: '9px', color: '#f59e0b' }}>→ {c.targetCountry}</span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
                        Crew: {c.playersJoined.join(', ')} ({c.playersJoined.length}/6)
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {!c.playersJoined.includes(player.name) && (
                          <button className="hud-btn-outline" style={{ fontSize: '9px', padding: '3px 8px' }}
                            onClick={() => mil.joinCampaign(c.id, player.name)}
                          >
                            JOIN CREW
                          </button>
                        )}
                        {c.initiator === player.name && (
                          <button className="hud-btn-primary" style={{ fontSize: '9px', padding: '3px 8px', background: '#dc2626' }}
                            onClick={() => {
                              mil.deployCampaign(c.id)
                              ui.addFloatingText('DEPLOYED!', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
                            }}
                          >
                            DEPLOY NOW
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Reports */}
          <div className="hud-card">
            <div className="hud-card__title">📋 OPERATION REPORTS</div>
            {allReports.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>No reports yet. Launch military operations to generate intel.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                {allReports.map(report => {
                  const d = report.data
                  const isWin = report.result === 'victory'
                  const rc = isWin ? '#22d38a' : '#ef4444'
                  const row = (label: string, val: string | number, color?: string) => (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: '#94a3b8', fontSize: '9px' }}>{label}</span>
                      <span style={{ color: color || '#e2e8f0', fontSize: '9px', fontWeight: 600 }}>{val}</span>
                    </div>
                  )
                  return (
                    <div key={report.id} style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${rc}33`, padding: '12px', borderRadius: '6px' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 900, color: rc }}>
                          {report.operationName} — {report.result.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '9px', color: '#64748b' }}>
                          {new Date(report.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px' }}>
                        {report.originCountry} → {report.targetCountry} · {report.participants.join(', ')}
                      </div>

                      {/* Battle Stats */}
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px', marginTop: '6px' }}>⚔️ BATTLE STATS</div>
                      {row('Rounds Played', `${d.attackerRoundsWon} - ${d.defenderRoundsWon} (of ${d.roundsPlayed})`)}
                      {row('Duration', `${Math.round(d.battleDurationMs / 1000)}s`)}
                      {row('Total Attacker Dmg', d.totalAttackerDamage.toLocaleString(), '#22d38a')}
                      {row('Total Defender Dmg', d.totalDefenderDamage.toLocaleString(), '#ef4444')}
                      {row('Avg Damage / Hit', d.avgDamagePerHit.toLocaleString())}
                      {row('Attackers', d.attackerCount)}
                      {row('Defenders', d.defenderCount)}

                      {/* Top Damage Dealers */}
                      {d.topAttackers.length > 0 && (
                        <>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '8px', marginBottom: '2px' }}>🏆 TOP ATTACKERS</div>
                          {d.topAttackers.map((p, i) => row(`#${i + 1} ${p.name}`, p.damage.toLocaleString(), '#22d38a'))}
                        </>
                      )}
                      {d.topDefenders.length > 0 && (
                        <>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '6px', marginBottom: '2px' }}>🛡️ TOP DEFENDERS</div>
                          {d.topDefenders.map((p, i) => row(`#${i + 1} ${p.name}`, p.damage.toLocaleString(), '#ef4444'))}
                        </>
                      )}

                      {/* Rewards */}
                      {isWin && (d.moneyStolen > 0 || d.oilStolen > 0 || d.materialXStolen > 0 || d.bitcoinStolen > 0) && (
                        <>
                          <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 'bold', marginTop: '8px', marginBottom: '2px' }}>💰 RESOURCES STOLEN</div>
                          {d.moneyStolen > 0 && row('Money', `$${d.moneyStolen.toLocaleString()}`, '#f59e0b')}
                          {d.oilStolen > 0 && row('Oil', d.oilStolen.toLocaleString(), '#f59e0b')}
                          {d.materialXStolen > 0 && row('Material X', d.materialXStolen.toLocaleString(), '#f59e0b')}
                          {d.bitcoinStolen > 0 && row('Bitcoin', `₿${d.bitcoinStolen}`, '#f59e0b')}
                        </>
                      )}

                      {/* Territory */}
                      {d.regionConquered && (
                        <>
                          <div style={{ fontSize: '10px', color: '#22d38a', fontWeight: 'bold', marginTop: '8px', marginBottom: '2px' }}>🗺️ TERRITORY</div>
                          {row('Region Conquered', d.regionName, '#22d38a')}
                        </>
                      )}

                      {/* Infrastructure Damage */}
                      {d.infrastructureDamaged.length > 0 && (
                        <>
                          <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold', marginTop: '8px', marginBottom: '2px' }}>🏗️ INFRASTRUCTURE DAMAGED</div>
                          {d.infrastructureDamaged.map((inf, i) => row(inf.type.toUpperCase(), `Lv.${inf.previousLevel} → Lv.${inf.newLevel}`, '#ef4444'))}
                          {d.companiesDisabled > 0 && row('Companies Disabled', d.companiesDisabled, '#ef4444')}
                        </>
                      )}

                      {/* Bonuses */}
                      {(d.militaryBaseBonusApplied || d.bunkerBonusDamage > 0) && (
                        <>
                          <div style={{ fontSize: '10px', color: '#a855f7', fontWeight: 'bold', marginTop: '8px', marginBottom: '2px' }}>✨ BONUSES APPLIED</div>
                          {d.militaryBaseBonusApplied && row('Military Base Bonus', '+5-20% dmg', '#a855f7')}
                          {d.bunkerBonusDamage > 0 && row('Bunker Strike Bonus', `+${d.bunkerBonusDamage}%`, '#a855f7')}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Campaign History */}
          {allCampaigns.length > 0 && (
            <div className="hud-card">
              <div className="hud-card__title">📂 CAMPAIGN HISTORY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                {allCampaigns.slice(0, 10).map(c => {
                  const opDef = MILITARY_OPERATIONS.find(o => o.id === c.operationId)
                  const statusColor: Record<string, string> = { recruiting: '#f59e0b', launched: '#3b82f6', completed: '#22d38a', failed: '#ef4444' }
                  return (
                    <div key={c.id} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                      <span>{opDef?.icon} {opDef?.name} → {c.targetCountry}</span>
                      <span style={{ color: statusColor[c.status] || '#666', textTransform: 'uppercase', fontWeight: 700 }}>{c.status}</span>
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
