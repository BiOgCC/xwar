import { useState } from 'react'
import { useArmyStore, DIVISION_TEMPLATES } from '../../../stores/army'
import { usePlayerStore, getMilitaryRank } from '../../../stores/playerStore'
import { useUIStore } from '../../../stores/uiStore'
import { RANK_ICONS } from '../warHelpers'

export default function AFPmcTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()

  const [newArmyName, setNewArmyName] = useState('')
  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = myArmies.find(a => a.members.some(m => m.playerId === player.name))
  const myRank = getMilitaryRank(player.level)

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    const armyId = armyStore.createArmy(newArmyName.trim(), iso)
    setFeedback(armyId ? `Force created (${armyId.slice(0, 8)}…)` : 'Failed to create force')
    setNewArmyName('')
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleEnlist = (armyId: string) => {
    const result = armyStore.enlistInArmy(armyId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleLeave = () => {
    if (!currentArmy) return
    const result = armyStore.leaveArmy()
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Cannot') || feedback.includes('Failed') || feedback.includes('Already') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* Rank + Enlistment */}
      <div className="war-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{RANK_ICONS[myRank.rank] || '🪖'}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{myRank.label.toUpperCase()}</div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>Level {player.level}</div>
            </div>
          </div>
          {currentArmy ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700 }}>✅ {currentArmy.name}</div>
              <div style={{ fontSize: '7px', color: '#64748b' }}>{currentArmy.members.length} members</div>
              {currentArmy.commanderId !== player.name && (
                <button className="war-btn war-btn--danger" style={{ fontSize: '7px', padding: '2px 6px', marginTop: '2px' }} onClick={handleLeave}>LEAVE</button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '8px', color: '#f59e0b' }}>Not enlisted</div>
          )}
        </div>
      </div>

      {/* Create Force */}
      <div className="war-card">
        <div className="war-card__title">➕ CREATE MILITARY FORCE</div>
        <div className="war-create-army">
          <input className="war-input" placeholder="Force name..." value={newArmyName} onChange={e => setNewArmyName(e.target.value)} />
          <button className="war-btn war-btn--primary" onClick={handleCreateArmy}>CREATE</button>
        </div>
      </div>

      {/* Available Forces to Enlist */}
      {!currentArmy && myArmies.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📋 AVAILABLE FORCES</div>
          {myArmies.map(army => (
            <div key={army.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 8px', marginBottom: '3px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>⚔️ {army.name}</div>
                <div style={{ fontSize: '7px', color: '#64748b' }}>👑 {army.commanderId} • {army.members.length} members • {army.divisionIds.length} divs</div>
              </div>
              <button className="war-btn war-btn--primary" style={{ fontSize: '7px', padding: '3px 8px' }} onClick={() => handleEnlist(army.id)}>ENLIST</button>
            </div>
          ))}
        </div>
      )}

      {/* Force List with Divisions */}
      {myArmies.map(army => {
        const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
        const isExpanded = expandedArmy === army.id
        const readyDivs = divs.filter(d => d.status === 'ready').length
        const combatDivs = divs.filter(d => d.status === 'in_combat').length

        return (
          <div className="war-card war-card--army" key={army.id}>
            <div className="war-army-header" onClick={() => setExpandedArmy(isExpanded ? null : army.id)}>
              <div className="war-army-header__left">
                <span className="war-army-header__icon">⚔️</span>
                <div>
                  <div className="war-army-header__name">{army.name}</div>
                  <div className="war-army-header__info">{divs.length} divisions • {army.totalManpower.toLocaleString()} troops</div>
                </div>
              </div>
              <div className="war-army-header__right">
                <span className={`war-army-status war-army-status--${army.status}`}>{army.status.toUpperCase()}</span>
                <span className="war-army-expand">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="war-army-body">
                {/* Summary Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0' }}>{divs.length}</div>
                    <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>DIVS</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#22d38a' }}>{readyDivs}</div>
                    <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>READY</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#ef4444' }}>{combatDivs}</div>
                    <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>COMBAT</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#f59e0b' }}>{army.members.length}</div>
                    <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>MEMBERS</div>
                  </div>
                </div>

                {/* Division List */}
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.type]
                    const strengthPct = Math.floor((div.health / div.maxHealth) * 100)
                    const divLevel = Math.floor((div.experience || 0) / 10)
                    const statusColors: Record<string, string> = {
                      training: '#f59e0b', ready: '#3b82f6', in_combat: '#ef4444', recovering: '#3b82f6', destroyed: '#64748b'
                    }
                    const statusLabels: Record<string, string> = {
                      training: '🔨 TRAINING', ready: '✅ READY', in_combat: '⚔️ COMBAT', recovering: '💤 RECOVERING', destroyed: '💀 DESTROYED'
                    }

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '3px', padding: '5px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={template?.icon} alt="div" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                          <span className="war-div-row__name" style={{ flex: 1, fontSize: '10px' }}>{div.name}</span>
                          <span style={{ fontSize: '7px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 4px', borderRadius: '3px' }}>
                            LV{divLevel}
                          </span>
                          <span style={{ fontSize: '7px', fontWeight: 700, color: statusColors[div.status] || '#64748b', background: `${statusColors[div.status] || '#64748b'}15`, padding: '1px 4px', borderRadius: '3px' }}>
                            {statusLabels[div.status] || div.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="war-div-bar" title={`HP: ${strengthPct}%`} style={{ flex: 1, height: '12px' }}>
                            <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%`, transition: 'width 0.8s ease' }} />
                            <span className="war-div-bar__label" style={{ fontSize: '8px', fontWeight: 800 }}>{div.health}/{div.maxHealth} ({strengthPct}%)</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', fontSize: '7px', color: '#94a3b8' }}>
                          <span>👥 {div.manpower}</span>
                          <span>⭐ {div.starQuality}★</span>
                          <span>💀 {div.killCount}</span>
                          {div.equipment.length > 0 && <span>🔧 {div.equipment.length}/3</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Composition Aura */}
                {divs.length > 0 && (() => {
                  const av = armyStore.getArmyAV(army.id)
                  const aura = armyStore.getCompositionAura(army.id)
                  return (
                    <div style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>📊 ARMY VALUE</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                        {[
                          { label: '✈️', val: av.air, buff: `+${aura.critDmgPct}% CDmg`, color: '#60a5fa' },
                          { label: '🚶', val: av.ground, buff: `+${aura.dodgePct}% Dodge`, color: '#3b82f6' },
                          { label: '🪖', val: av.tanks, buff: `+${aura.attackPct}% Atk`, color: '#f59e0b' },
                          { label: '🚢', val: av.navy, buff: `+${aura.precisionPct}% Prec`, color: '#a78bfa' },
                        ].map(cat => (
                          <div key={cat.label} style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                            <div style={{ fontSize: '8px', color: cat.color, fontWeight: 700 }}>{cat.label} {cat.val}</div>
                            <div style={{ fontSize: '7px', color: cat.color, opacity: 0.7 }}>{cat.buff}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}

      {myArmies.length === 0 && (
        <div className="war-card" style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '20px', marginBottom: '8px' }}>🏴</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>No Private Military Corporations exist yet. Create one above!</div>
        </div>
      )}
    </div>
  )
}
