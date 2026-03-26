/**
 * GovTacticalTab — Shows country tactical ops funding status and launch controls.
 * Only the President can launch fully-funded operations.
 */
import React, { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useUIStore } from '../../../stores/uiStore'
import {
  useTacticalOpsStore,
  COUNTRY_OPS, MISSIONS,
  type CountryOpId, type MissionType,
} from '../../../stores/tacticalOpsStore'

export default function GovTacticalTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const ops = useTacticalOpsStore()

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name

  const [expandedOp, setExpandedOp] = useState<CountryOpId | null>(null)
  const [targetCountry, setTargetCountry] = useState('')

  const foreignCountries = world.countries.filter(c => c.code !== iso)
  const activeEffects = ops.getActiveEffectsForCountry(iso)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Status Banner */}
      <div style={{
        padding: '8px 12px', borderRadius: '6px', fontSize: '9px',
        background: isPresident ? 'rgba(0,255,136,0.06)' : 'rgba(255,136,0,0.06)',
        border: `1px solid ${isPresident ? 'rgba(0,255,136,0.15)' : 'rgba(255,136,0,0.15)'}`,
        color: isPresident ? '#00ff88' : '#ffaa44',
      }}>
        {isPresident
          ? '👑 As President, you can launch fully-funded operations against enemy countries.'
          : '⚡ Complete missions below to help fund operations. The President launches when ready.'}
      </div>

      {/* Active Effects on OUR country (from enemy ops) */}
      {activeEffects.length > 0 && (
        <div className="hud-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
          <div className="hud-card__title" style={{ color: '#ef4444' }}>🚨 INCOMING EFFECTS</div>
          <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px' }}>Enemy operations affecting your country:</div>
          {activeEffects.map(e => {
            const remaining = e.expiresAt - Date.now()
            const hours = Math.floor(remaining / 3600000)
            const mins = Math.floor((remaining % 3600000) / 60000)
            return (
              <div key={e.id} style={{
                padding: '6px 8px', marginBottom: '3px', borderRadius: '4px',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                display: 'flex', justifyContent: 'space-between', fontSize: '9px',
              }}>
                <span style={{ color: '#fca5a5' }}>{e.opId.replace(/_/g, ' ')}</span>
                <span style={{ color: '#ef4444' }}>
                  {hours > 0 ? `${hours}h ` : ''}{mins}m left
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Country Ops List */}
      {COUNTRY_OPS.map(opDef => {
        const isExpanded = expandedOp === opDef.id
        const funding = ops.getFunding(iso, opDef.id as CountryOpId)
        const totalPts = funding?.totalPoints ?? 0
        const required = opDef.fundingRequired
        const pct = Math.min(100, (totalPts / required) * 100)
        const isFunded = funding?.status === 'ready'
        const isLaunched = funding?.status === 'launched'
        const successChance = ops.getSuccessChance(opDef.id)

        return (
          <div key={opDef.id} style={{
            borderRadius: '6px',
            border: `1px solid ${isFunded ? 'rgba(0,255,136,0.2)' : isLaunched ? 'rgba(34,211,138,0.15)' : 'rgba(255,136,0,0.15)'}`,
            background: 'rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <button
              onClick={() => setExpandedOp(isExpanded ? null : opDef.id as CountryOpId)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                border: 'none', cursor: 'pointer', color: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '11px' }}>{opDef.icon} {opDef.name}</span>
                <span style={{
                  fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                  background: isFunded ? 'rgba(0,255,136,0.1)' : isLaunched ? 'rgba(34,211,138,0.08)' : 'rgba(255,136,0,0.1)',
                  color: isFunded ? '#00ff88' : isLaunched ? '#22d38a' : '#ff8800',
                  border: `1px solid ${isFunded ? '#00ff8830' : isLaunched ? '#22d38a20' : '#ff880030'}`,
                }}>
                  {isLaunched ? '✅ LAUNCHED' : isFunded ? '🚀 READY' : `${totalPts}/${required} pts`}
                </span>
              </div>

              {/* Progress bar */}
              {!isLaunched && (
                <div style={{
                  marginTop: '6px', height: '4px', borderRadius: '2px',
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
              )}
            </button>

            {/* Expanded Content */}
            {isExpanded && !isLaunched && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Effect */}
                <div style={{
                  fontSize: '9px', color: '#e2e8f0', marginBottom: '8px',
                  padding: '5px 8px', background: 'rgba(255,136,0,0.04)', borderRadius: '3px',
                  borderLeft: '3px solid #ff8800',
                }}>
                  {opDef.effectDescription}
                </div>

                <div style={{ fontSize: '8px', color: '#f59e0b', marginBottom: '8px' }}>
                  ✅ {Math.round(successChance)}% success chance
                </div>

                {/* Micro-missions for funding */}
                {!isFunded && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                      📋 CONTRIBUTE TO FUND
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                      {MISSIONS.map(mission => (
                        <button
                          key={mission.id}
                          onClick={() => {
                            const result = ops.completeMission(opDef.id as CountryOpId, mission.id as MissionType)
                            ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#00ff88' : '#ef4444')
                          }}
                          style={{
                            padding: '6px', fontSize: '8px', fontWeight: 600,
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '3px', color: '#e2e8f0', cursor: 'pointer', textAlign: 'left',
                          }}
                        >
                          <div>{mission.icon} {mission.name}</div>
                          <div style={{ fontSize: '7px', color: '#94a3b8', marginTop: '1px' }}>
                            {mission.cost.work ? `${mission.cost.work} work` : ''}
                            {mission.cost.stamina ? `${mission.cost.stamina} stam` : ''}
                            {mission.cost.badges ? `${mission.cost.badges} 🎖️` : ''}
                            {mission.cost.bitcoin ? `${mission.cost.bitcoin} ₿` : ''}
                            {mission.id === 'battle_veteran' ? '500+ dmg' : ''}
                            → <span style={{ color: '#00ff88' }}>+{mission.fundingPoints}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent contributors */}
                {funding && funding.contributors.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '7px', color: '#64748b', marginBottom: '2px' }}>CONTRIBUTORS</div>
                    <div style={{ maxHeight: '36px', overflow: 'auto' }}>
                      {funding.contributors.slice(-4).reverse().map((c, i) => (
                        <div key={i} style={{ fontSize: '8px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{c.playerName}</span>
                          <span style={{ color: '#00cc66' }}>+{c.points}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Launch - President only */}
                {isFunded && (
                  <div>
                    <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                      style={{ width: '100%', background: 'var(--color-surface, #0d1117)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px', fontSize: '9px', marginBottom: '6px', borderRadius: '3px' }}>
                      <option value="" disabled>🎯 Select Target Country...</option>
                      {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                    <button
                      onClick={() => {
                        if (!targetCountry) return
                        const result = ops.launchCountryOp(opDef.id as CountryOpId, targetCountry)
                        ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.message.includes('✅') ? '#00ff88' : '#ef4444')
                      }}
                      disabled={!isPresident || !targetCountry}
                      style={{
                        width: '100%', padding: '8px', fontSize: '10px', fontWeight: 900,
                        letterSpacing: '0.5px',
                        cursor: isPresident && targetCountry ? 'pointer' : 'not-allowed',
                        background: isPresident && targetCountry
                          ? 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05))'
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isPresident && targetCountry ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '4px',
                        color: isPresident && targetCountry ? '#00ff88' : '#475569',
                      }}
                    >
                      {!isPresident ? '🔒 PRESIDENT ONLY' : !targetCountry ? 'SELECT TARGET' : '🚀 LAUNCH'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
