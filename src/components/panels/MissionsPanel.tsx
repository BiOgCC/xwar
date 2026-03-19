import React, { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../stores/governmentStore'
import type { NationalFundKey, ContributionMission } from '../../stores/governmentStore'
import { CYBER_OPERATIONS } from '../../stores/cyberStore'
import { MILITARY_OPERATIONS } from '../../stores/militaryStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'

// ── Resource cost definitions for each operation ──
function getCyberMissionCost(opId: string): Partial<Record<NationalFundKey, number>> {
  const op = CYBER_OPERATIONS.find(o => o.id === opId)
  if (!op) return {}
  return { oil: op.cost.oil, materialX: op.cost.materialX, bitcoin: op.cost.bitcoin }
}

function getMilitaryMissionCost(opId: string): Partial<Record<NationalFundKey, number>> {
  const op = MILITARY_OPERATIONS.find(o => o.id === opId)
  if (!op) return {}
  return { oil: op.cost.oil, materialX: op.cost.materialX, ...(op.cost.bitcoin > 0 ? { bitcoin: op.cost.bitcoin } : {}) }
}

function getMilitaryRequiredItems(opId: string): { jets?: number; tanks?: number } {
  const op = MILITARY_OPERATIONS.find(o => o.id === opId)
  if (!op) return {}
  if (op.requiresItem === 'jet') return { jets: 1 }
  if (op.requiresItem === 'warship') return { jets: 1 } // warships use jets slot conceptually
  return {}
}

const RESOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  money: { label: 'Money', icon: '💰' },
  oil: { label: 'Oil', icon: '🛢️' },
  scrap: { label: 'Scraps', icon: '🔩' },
  materialX: { label: 'MatX', icon: '⚛️' },
  bitcoin: { label: 'BTC', icon: '₿' },
  jets: { label: 'Jets', icon: '✈️' },
}

// ── Time formatting ──
function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'EXPIRED'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Progress bar component ──
function ProgressBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 100
  return (
    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.3s ease' }} />
    </div>
  )
}

// ── Mission Card ──
function MissionCard({
  opId, opName, opIcon, opDesc, opType, costs, requiredItems, isNuclear,
}: {
  opId: string; opName: string; opIcon: string; opDesc: string
  opType: 'cyber' | 'military' | 'nuclear'
  costs: Partial<Record<NationalFundKey, number>>
  requiredItems: { jets?: number; tanks?: number }
  isNuclear?: boolean
}) {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'

  const activeMission = govStore.getActiveMission(opId, iso)
  const completed = govStore.isMissionCompleted(opId, iso)

  const [donateRes, setDonateRes] = useState<NationalFundKey>('oil')
  const [donateAmt, setDonateAmt] = useState(100)

  // Check expiry
  useEffect(() => {
    govStore.checkExpiredMissions()
  }, [])

  // Prerequisites: jets/tanks check (not consumed, just required to exist)
  const inv = useInventoryStore.getState()
  const playerJets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped).length
  const hasJets = !requiredItems.jets || playerJets >= (requiredItems.jets || 0)

  const handleStartMission = () => {
    const id = govStore.startContributionMission(opId, opType, iso, player.name, costs, requiredItems)
    if (id) {
      ui.addFloatingText(`MISSION STARTED: ${opName}`, window.innerWidth / 2, window.innerHeight / 2, '#3b82f6')
    } else {
      ui.addFloatingText('MISSION ALREADY ACTIVE', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
    }
  }

  const handleContribute = (overrideAmount?: number) => {
    if (!activeMission) return
    const p = usePlayerStore.getState()
    const resourceMap: Record<NationalFundKey, number> = {
      money: p.money, oil: p.oil, scrap: p.scrap, materialX: p.materialX, bitcoin: p.bitcoin, jets: 0,
    }
    if (donateRes === 'jets' && isNuclear) {
      resourceMap.jets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped).length
    }
    // Cap at what's still needed so nobody overpays
    const needed = (activeMission.requiredResources[donateRes] ?? 0) - (activeMission.contributedResources[donateRes] ?? 0)
    const wantToDonate = overrideAmount ?? donateAmt
    const actual = Math.min(wantToDonate, Math.max(0, needed), resourceMap[donateRes])
    if (actual <= 0) {
      ui.addFloatingText(needed <= 0 ? 'ALREADY FULL' : 'NOT ENOUGH', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    // Deduct ONLY the capped amount from player
    if (donateRes === 'money') p.spendMoney(actual)
    else if (donateRes === 'oil') p.spendOil(actual)
    else if (donateRes === 'scrap') p.spendScrap(actual)
    else if (donateRes === 'materialX') p.spendMaterialX(actual)
    else if (donateRes === 'bitcoin') p.spendBitcoin(actual)
    else if (donateRes === 'jets' && isNuclear) {
      const jets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      for (let i = 0; i < Math.min(actual, jets.length); i++) inv.removeItem(jets[i].id)
    }
    // Contribute to mission (which donates to national fund)
    const success = govStore.contributeToMission(activeMission.id, donateRes, actual, player.name)
    if (success) {
      ui.addFloatingText(`+${actual} ${donateRes.toUpperCase()}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    }
  }

  const handleContributeAll = () => {
    if (!activeMission) return
    const p = usePlayerStore.getState()
    const resourceMap: Record<NationalFundKey, number> = {
      money: p.money, oil: p.oil, scrap: p.scrap, materialX: p.materialX, bitcoin: p.bitcoin, jets: 0,
    }
    if (donateRes === 'jets' && isNuclear) {
      resourceMap.jets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped).length
    }
    const needed = (activeMission.requiredResources[donateRes] ?? 0) - (activeMission.contributedResources[donateRes] ?? 0)
    const maxDonate = Math.min(resourceMap[donateRes], Math.max(0, needed))
    if (maxDonate > 0) handleContribute(maxDonate)
    else ui.addFloatingText(needed <= 0 ? 'ALREADY FULL' : 'NOT ENOUGH', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
  }

  // Available resources to donate (jets only for nuclear)
  const donateOptions = Object.keys(costs).filter(k => k !== 'jets' || isNuclear) as NationalFundKey[]

  // Status styling
  const statusColors = {
    active: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
    completed: { color: '#22d38a', bg: 'rgba(34,211,138,0.08)', border: 'rgba(34,211,138,0.25)' },
    none: { color: '#64748b', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.08)' },
  }
  const status = completed ? 'completed' : activeMission ? 'active' : 'none'
  const sc = statusColors[status]

  const ss: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px' }

  return (
    <div style={{
      background: sc.bg,
      border: `1px solid ${sc.border}`,
      borderRadius: '6px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{opIcon} {opName}</div>
          <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{opDesc}</div>
        </div>
        <div style={{
          fontSize: '8px', fontWeight: 900, padding: '2px 8px', borderRadius: '3px',
          background: completed ? 'rgba(34,211,138,0.15)' : activeMission ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
          color: completed ? '#22d38a' : activeMission ? '#60a5fa' : '#475569',
          border: `1px solid ${completed ? 'rgba(34,211,138,0.3)' : activeMission ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}>
          {completed ? '✅ COMPLETED' : activeMission ? '🟡 ACTIVE' : '⬜ NOT STARTED'}
        </div>
      </div>

      {/* Prerequisite badge for jets/tanks */}
      {(requiredItems.jets || requiredItems.tanks) && (
        <div style={{
          display: 'flex', gap: '6px', fontSize: '8px', alignItems: 'center',
        }}>
          {requiredItems.jets && (
            <span style={{
              padding: '2px 6px', borderRadius: '3px',
              background: hasJets ? 'rgba(34,211,138,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${hasJets ? 'rgba(34,211,138,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: hasJets ? '#22d38a' : '#ef4444',
            }}>
              ✈️ {requiredItems.jets} Jet{requiredItems.jets > 1 ? 's' : ''} {hasJets ? '✓ owned' : '✗ needed'} {isNuclear ? '(contributed)' : '(not consumed)'}
            </span>
          )}
        </div>
      )}

      {/* Resource progress bars for active/completed missions */}
      {(activeMission || completed) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {Object.entries(costs).map(([key, required]) => {
            if (!required) return null
            const mission = activeMission || Object.values(govStore.contributionMissions).find(
              m => m.operationId === opId && m.countryCode === iso && m.status === 'completed'
            )
            const contributed = mission?.contributedResources[key as NationalFundKey] ?? 0
            const rl = RESOURCE_LABELS[key] || { label: key, icon: '📦' }
            const isFull = contributed >= required
            return (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '2px' }}>
                  <span style={{ color: '#94a3b8' }}>{rl.icon} {rl.label}</span>
                  <span style={{ color: isFull ? '#22d38a' : '#e2e8f0', fontWeight: 700 }}>
                    {contributed.toLocaleString()}/{required.toLocaleString()} {isFull ? '✓' : ''}
                  </span>
                </div>
                <ProgressBar current={contributed} max={required} color={isFull ? '#22d38a' : '#3b82f6'} />
              </div>
            )
          })}
        </div>
      )}

      {/* Cost preview for not-started missions */}
      {!activeMission && !completed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {Object.entries(costs).map(([key, required]) => {
            if (!required) return null
            const rl = RESOURCE_LABELS[key] || { label: key, icon: '📦' }
            return (
              <div key={key} style={{
                fontSize: '8px', padding: '3px 6px', borderRadius: '3px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8',
              }}>
                {rl.icon} {rl.label}: {required.toLocaleString()}
              </div>
            )
          })}
        </div>
      )}

      {/* Active mission: time + contribute */}
      {activeMission && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: '9px', padding: '4px 8px',
            background: 'rgba(59,130,246,0.05)', borderRadius: '4px',
          }}>
            <span style={{ color: '#64748b' }}>⏱️ Time remaining</span>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{formatTimeLeft(activeMission.expiresAt - Date.now())}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: '9px', padding: '4px 8px',
            background: 'rgba(255,255,255,0.02)', borderRadius: '4px',
          }}>
            <span style={{ color: '#64748b' }}>👥 Contributors</span>
            <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{Object.keys(activeMission.contributors).length}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <select value={donateRes} onChange={e => setDonateRes(e.target.value as NationalFundKey)} style={{ ...ss, flex: 1 }}>
              {donateOptions.map(k => (
                <option key={k} value={k}>{RESOURCE_LABELS[k]?.label || k}</option>
              ))}
            </select>
            <input type="number" value={donateAmt} onChange={e => setDonateAmt(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...ss, width: '55px' }} />
            <button className="hud-btn-primary" onClick={() => handleContribute()} style={{ fontSize: '9px', padding: '5px 10px' }}>
              CONTRIBUTE
            </button>
          </div>
          <button
            className="hud-btn-outline"
            onClick={handleContributeAll}
            style={{ width: '100%', padding: '6px', fontSize: '9px', fontWeight: 700, borderColor: '#3b82f6', color: '#3b82f6', cursor: 'pointer', marginTop: '2px' }}
          >
            💰 CONTRIBUTE ALL ({RESOURCE_LABELS[donateRes]?.label || donateRes})
          </button>
        </>
      )}

      {/* Start button */}
      {!activeMission && !completed && (
        <button
          className="hud-btn-outline"
          onClick={handleStartMission}
          style={{
            width: '100%', padding: '8px', fontSize: '10px', fontWeight: 700,
            borderColor: opType === 'cyber' ? '#22d38a' : opType === 'military' ? '#ef4444' : opType === 'nuclear' ? '#f59e0b' : '#3b82f6',
            color: opType === 'cyber' ? '#22d38a' : opType === 'military' ? '#ef4444' : opType === 'nuclear' ? '#f59e0b' : '#3b82f6',
            cursor: 'pointer',
          }}
        >
          {opType === 'nuclear' ? '☢️START NUKLEAR MISSION' : '📢 START CONTRIBUTION MISSION'}
        </button>
      )}

      {/* Completed — Go to Operation button */}
      {completed && (
        <button
          onClick={() => {
            if (opType === 'cyber') ui.setActivePanel('cyberwarfare')
            else if (opType === 'military') ui.setActivePanel('military')
            else if (opType === 'nuclear') ui.setActivePanel('government')
          }}
          style={{
            width: '100%', padding: '10px', fontSize: '11px', fontWeight: 900,
            color: '#fff', cursor: 'pointer', letterSpacing: '0.5px',
            background: 'linear-gradient(135deg, rgba(34,211,138,0.15), rgba(34,211,138,0.05))',
            border: '1px solid rgba(34,211,138,0.3)', borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          ✅ Go to Operation →
        </button>
      )}
    </div>
  )
}

export default function MissionsPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'

  // Check expired missions on mount
  useEffect(() => {
    govStore.checkExpiredMissions()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Gating status — full operation list */}
      <div className="hud-card" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="hud-card__title">📋 OPERATIONS STATUS</div>
        <p style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '8px' }}>
          Complete contribution missions to unlock operations. Citizens have <strong style={{ color: '#60a5fa' }}>1 week</strong> to fund each mission.
        </p>

        {/* Cyber Ops Grid */}
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>🖥️ CYBERWARFARE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginBottom: '8px' }}>
          {CYBER_OPERATIONS.map(op => {
            const done = govStore.isMissionCompleted(op.id, iso)
            const active = !!govStore.getActiveMission(op.id, iso)
            return (
              <div key={op.id} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 6px', borderRadius: '3px', fontSize: '8px',
                background: done ? 'rgba(34,211,138,0.06)' : active ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${done ? 'rgba(34,211,138,0.2)' : active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color: done ? '#22d38a' : active ? '#f59e0b' : '#475569',
              }}>
                <span>{done ? '✅' : active ? '🟡' : '🔒'}</span>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.name}</span>
              </div>
            )
          })}
        </div>

        {/* Military Ops Grid */}
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>🎖️ MILITARY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {MILITARY_OPERATIONS.map(op => {
            const done = govStore.isMissionCompleted(op.id, iso)
            const active = !!govStore.getActiveMission(op.id, iso)
            return (
              <div key={op.id} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 6px', borderRadius: '3px', fontSize: '8px',
                background: done ? 'rgba(34,211,138,0.06)' : active ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${done ? 'rgba(34,211,138,0.2)' : active ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
                color: done ? '#22d38a' : active ? '#f59e0b' : '#475569',
              }}>
                <span>{done ? '✅' : active ? '🟡' : '🔒'}</span>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ====== CYBER MISSIONS ====== */}
      <div className="hud-card">
        <div className="hud-card__title">🖥️ CYBERWARFARE MISSIONS</div>
        <p style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '8px' }}>
          Each cyber operation requires a fully funded mission. Jets/tanks are required but <strong>not consumed</strong>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {CYBER_OPERATIONS.map(op => (
            <MissionCard
              key={op.id}
              opId={op.id}
              opName={op.name}
              opIcon={op.icon}
              opDesc={op.effectDescription}
              opType="cyber"
              costs={getCyberMissionCost(op.id)}
              requiredItems={{}}
            />
          ))}
        </div>
      </div>

      {/* ====== MILITARY MISSIONS ====== */}
      <div className="hud-card">
        <div className="hud-card__title" style={{ color: '#ef4444' }}>🎖️ MILITARY MISSIONS</div>
        <p style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '8px' }}>
          Each military operation requires a fully funded mission. Jets/tanks are required but <strong>not consumed</strong>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {MILITARY_OPERATIONS.map(op => (
            <MissionCard
              key={op.id}
              opId={op.id}
              opName={op.name}
              opIcon={op.icon}
              opDesc={op.effectDescription}
              opType="military"
              costs={getMilitaryMissionCost(op.id)}
              requiredItems={getMilitaryRequiredItems(op.id)}
            />
          ))}
        </div>
      </div>

      {/* ====== NUCLEAR PROGRAM (bottom) ====== */}
      <div className="hud-card" style={{ borderColor: '#f59e0b33' }}>
        <div className="hud-card__title" style={{ color: '#f59e0b' }}>☢️ NUCLEAR PROGRAM</div>
        <MissionCard
          opId="nuclear"
          opName="Nuclear Program"
          opIcon="☢️"
          opDesc="Collect resources to build a nuclear weapon. Jets CAN be contributed."
          opType="nuclear"
          costs={{ oil: NUKE_COST.oil, scrap: NUKE_COST.scrap, materialX: NUKE_COST.materialX, bitcoin: NUKE_COST.bitcoin, jets: NUKE_COST.jets }}
          requiredItems={{ jets: 1 }}
          isNuclear
        />
      </div>
    </div>
  )
}
