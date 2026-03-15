import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import {
  useCyberStore,
  CYBER_OPERATIONS,
  getOperationsByPillar,
  type CyberPillar,
  type CyberOperationType,
  type CyberOperationDef,
} from '../../stores/cyberStore'

type ViewMode = 'operations' | 'reports'

export default function CyberwarfarePanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const ui = useUIStore()
  const cyber = useCyberStore()

  const [activePillar, setActivePillar] = useState<CyberPillar>('espionage')
  const [selectedOp, setSelectedOp] = useState<CyberOperationDef | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('operations')

  // Target state
  const [targetCountry, setTargetCountry] = useState('')
  const [targetRegion, setTargetRegion] = useState('')
  const [targetPlayer, setTargetPlayer] = useState('')
  const [targetCompanyType, setTargetCompanyType] = useState('farms')
  const [invitedPlayers, setInvitedPlayers] = useState<string[]>([])
  const [inviteInput, setInviteInput] = useState('')

  const iso = player.countryCode || 'US'
  const pillars: { id: CyberPillar; label: string; icon: string }[] = [
    { id: 'espionage', label: 'ESPIONAGE', icon: '🕵️' },
    { id: 'sabotage', label: 'SABOTAGE', icon: '💣' },
    { id: 'propaganda', label: 'PROPAGANDA', icon: '📰' },
  ]

  const operations = getOperationsByPillar(activePillar)

  const handleLaunch = () => {
    if (!selectedOp) return

    const target: any = {}
    if (selectedOp.targetType === 'country') target.country = targetCountry
    if (selectedOp.targetType === 'region') target.region = targetRegion
    if (selectedOp.targetType === 'player') target.player = targetPlayer
    if (selectedOp.targetType === 'company_type') {
      target.companyType = targetCompanyType
      target.country = targetCountry
    }
    if (selectedOp.targetType === 'battle') target.region = targetRegion

    if (!target.country && !target.region && !target.player) {
      ui.addFloatingText('SELECT A TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    const result = cyber.launchCampaign(selectedOp.id, target, invitedPlayers)

    if (result.success) {
      ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    } else {
      ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }

    setSelectedOp(null)
    setInvitedPlayers([])
  }

  const addInvite = () => {
    if (inviteInput && invitedPlayers.length < 5 && !invitedPlayers.includes(inviteInput)) {
      setInvitedPlayers([...invitedPlayers, inviteInput])
      setInviteInput('')
    }
  }

  // Reports
  const allReports = Object.values(cyber.reports).sort((a, b) => b.timestamp - a.timestamp)
  const allCampaigns = Object.values(cyber.campaigns).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          className={viewMode === 'operations' ? 'hud-btn-primary' : 'hud-btn-outline'}
          style={{ flex: 1, fontSize: '10px', padding: '6px' }}
          onClick={() => setViewMode('operations')}
        >
          ⚔️ OPERATIONS
        </button>
        <button
          className={viewMode === 'reports' ? 'hud-btn-primary' : 'hud-btn-outline'}
          style={{ flex: 1, fontSize: '10px', padding: '6px' }}
          onClick={() => setViewMode('reports')}
        >
          📋 REPORTS ({allReports.length})
        </button>
      </div>

      {/* Notifications */}
      {cyber.notifications.length > 0 && (
        <div className="hud-card" style={{ borderColor: '#ef4444' }}>
          <div className="hud-card__title" style={{ color: '#ef4444' }}>⚠️ CYBER ALERTS</div>
          {cyber.notifications.map(n => (
            <div key={n.id} style={{ fontSize: '10px', color: '#fca5a5', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>{n.message}</span>
              <button onClick={() => cyber.dismissNotification(n.id)} style={{ fontSize: '9px', color: '#666', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'operations' && (
        <>
          {/* Pillar Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {pillars.map(p => (
              <button
                key={p.id}
                onClick={() => { setActivePillar(p.id); setSelectedOp(null) }}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  border: `1px solid ${activePillar === p.id ? '#22d38a' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '4px',
                  background: activePillar === p.id ? 'rgba(34,211,138,0.1)' : 'transparent',
                  color: activePillar === p.id ? '#22d38a' : '#94a3b8',
                  cursor: 'pointer',
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
                    textAlign: 'left',
                    padding: '10px',
                    background: selectedOp?.id === op.id ? 'rgba(34,211,138,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedOp?.id === op.id ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '11px' }}>{op.icon} {op.name}</span>
                    <span style={{ fontSize: '9px', color: '#f59e0b' }}>₿{op.cost.bitcoin}</span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                    {op.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Operation Details */}
          {selectedOp && (
            <div className="hud-card" style={{ borderColor: 'rgba(34,211,138,0.3)' }}>
              <div className="hud-card__title">{selectedOp.icon} {selectedOp.name}</div>

              {/* Cost Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', margin: '8px 0' }}>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  ⚡ Energy: {selectedOp.cost.energy.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  ⚛️ MatX: {selectedOp.cost.materialX.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  🛢️ Oil: {selectedOp.cost.oil.toLocaleString()}
                </div>
                <div style={{ fontSize: '10px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                  ₿ Bitcoin: {selectedOp.cost.bitcoin}
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px' }}>
                {selectedOp.effectDescription}
              </div>

              <div style={{ fontSize: '9px', color: '#f59e0b', marginBottom: '8px' }}>
                Success: {selectedOp.successChance}% · Detection: {selectedOp.detectionChance}%
                {selectedOp.duration > 0 && ` · Duration: ${Math.round(selectedOp.duration / 60000)}min`}
              </div>

              {/* Target Selection */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>TARGET</div>

                {selectedOp.targetType === 'country' && (
                  <select
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                    style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    <option value="" disabled>Select Country...</option>
                    {world.countries.filter(c => c.code !== iso).map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                )}

                {(selectedOp.targetType === 'region' || selectedOp.targetType === 'battle') && (
                  <select
                    value={targetRegion}
                    onChange={(e) => setTargetRegion(e.target.value)}
                    style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    <option value="" disabled>Select Region...</option>
                    {world.countries.filter(c => c.code !== iso).map(c => (
                      <option key={c.code} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                )}

                {selectedOp.targetType === 'player' && (
                  <input
                    type="text"
                    value={targetPlayer}
                    onChange={(e) => setTargetPlayer(e.target.value)}
                    placeholder="Enter player name..."
                    style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', boxSizing: 'border-box' }}
                  />
                )}

                {selectedOp.targetType === 'company_type' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <select
                      value={targetCompanyType}
                      onChange={(e) => setTargetCompanyType(e.target.value)}
                      style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    >
                      <option value="farms">🌾 Farms</option>
                      <option value="oil_rigs">🛢️ Oil Rigs</option>
                      <option value="material_mines">⚛️ Material Mines</option>
                    </select>
                    <select
                      value={targetCountry}
                      onChange={(e) => setTargetCountry(e.target.value)}
                      style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    >
                      <option value="" disabled>Select Target Country...</option>
                      {world.countries.filter(c => c.code !== iso).map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Invite Players */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
                  INVITE PLAYERS ({invitedPlayers.length}/5)
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Player name..."
                    style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '4px 6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                  />
                  <button className="hud-btn-outline" onClick={addInvite} style={{ fontSize: '9px', padding: '4px 8px' }}>+</button>
                </div>
                {invitedPlayers.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {invitedPlayers.map(p => (
                      <span key={p} style={{ fontSize: '9px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '3px', padding: '2px 6px', cursor: 'pointer', color: '#22d38a' }}
                        onClick={() => setInvitedPlayers(invitedPlayers.filter(x => x !== p))}
                      >
                        {p} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Launch Button */}
              <button
                className="hud-btn-primary"
                onClick={handleLaunch}
                style={{ width: '100%', padding: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px' }}
              >
                🚀 LAUNCH CAMPAIGN
              </button>
            </div>
          )}
        </>
      )}

      {/* REPORTS VIEW */}
      {viewMode === 'reports' && (
        <div className="hud-card">
          <div className="hud-card__title">📋 INTELLIGENCE REPORTS</div>
          {allReports.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>No reports yet. Launch espionage operations to gather intelligence.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {allReports.map(report => {
                const opDef = CYBER_OPERATIONS.find(op => op.id === report.reportType)
                return (
                  <div key={report.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
                        {opDef?.icon} {opDef?.name || report.reportType}
                      </span>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>
                        {new Date(report.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#e2e8f0' }}>
                      {Object.entries(report.generatedData).map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color: '#94a3b8' }}>{key}:</span>
                          <span>{typeof val === 'object' ? JSON.stringify(val).slice(0, 60) + '...' : String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Campaign History */}
      {viewMode === 'reports' && allCampaigns.length > 0 && (
        <div className="hud-card">
          <div className="hud-card__title">📂 CAMPAIGN HISTORY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
            {allCampaigns.slice(0, 10).map(c => {
              const opDef = CYBER_OPERATIONS.find(op => op.id === c.operationType)
              const statusColor = c.status === 'completed' ? '#22d38a' : c.status === 'detected' ? '#f59e0b' : '#ef4444'
              return (
                <div key={c.id} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                  <span>{opDef?.icon} {opDef?.name}</span>
                  <span style={{ color: statusColor, textTransform: 'uppercase', fontWeight: 700 }}>{c.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
