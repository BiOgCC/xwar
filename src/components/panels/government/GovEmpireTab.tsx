import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'

/** EMPIRE tab — Empire name, ideology, skill tree */
export default function GovEmpireTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name
  const [empireName, setEmpireName] = useState(gov?.empireName || '')

  if (!gov) return null
  if (!isPresident) return <div className="hud-card"><div className="hud-card__title">👑 EMPIRE CONFIGURATION</div><p style={{ fontSize: '11px', color: '#f59e0b', margin: '8px 0 0' }}>⚠️ Only the President can configure the Empire.</p></div>

  return (
    <div className="hud-card">
      <div className="hud-card__title">👑 EMPIRE CONFIGURATION</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
        {/* Empire Name */}
        <div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>EMPIRE NAME</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input type="text" value={empireName} onChange={e => setEmpireName(e.target.value)} maxLength={30} placeholder="Enter empire name..."
              style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '10px' }} />
            <button className="hud-btn-primary" style={{ fontSize: '9px', padding: '4px 10px' }} onClick={() => {
              if (!empireName.trim()) { ui.addFloatingText('ENTER A NAME', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
              useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], empireName: empireName.trim() } } }))
              ui.addFloatingText(`EMPIRE: ${empireName.trim()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
            }}>SET NAME</button>
          </div>
          {gov.empireName && <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>Current: <strong>{gov.empireName}</strong></div>}
        </div>

        {/* Ideology Selection */}
        <div>
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>IDEOLOGY</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {([
              { id: 'militarist' as const, icon: '⚔️', label: 'MILITARIST', color: '#ef4444', desc: '+ATK & +Crit' },
              { id: 'capitalist' as const, icon: '💰', label: 'CAPITALIST', color: '#22d38a', desc: '+Production & +Tax' },
              { id: 'technocrat' as const, icon: '🔬', label: 'TECHNOCRAT', color: '#8b5cf6', desc: '+Cyber & +Tech' },
              { id: 'expansionist' as const, icon: '🌍', label: 'EXPANSIONIST', color: '#3b82f6', desc: '+Defense & +Diplomacy' },
            ]).map(ideo => (
              <button key={ideo.id} onClick={() => {
                useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], ideology: ideo.id } } }))
                ui.addFloatingText(`IDEOLOGY: ${ideo.label}`, window.innerWidth / 2, window.innerHeight / 2, ideo.color)
              }} style={{
                padding: '8px', borderRadius: '4px', cursor: 'pointer',
                border: `1px solid ${gov.ideology === ideo.id ? ideo.color : 'rgba(255,255,255,0.08)'}`,
                background: gov.ideology === ideo.id ? `${ideo.color}15` : 'rgba(0,0,0,0.3)', textAlign: 'left',
              }}>
                <div style={{ fontSize: '12px', marginBottom: '2px' }}>{ideo.icon} <span style={{ fontSize: '10px', fontWeight: 700, color: gov.ideology === ideo.id ? ideo.color : '#94a3b8' }}>{ideo.label}</span></div>
                <div style={{ fontSize: '8px', color: '#64748b' }}>{ideo.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Ideology Skill Tree */}
        {gov.ideology && (
          <div>
            <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>IDEOLOGY SKILL TREE — ALLOCATE POINTS</div>
            <div style={{ fontSize: '8px', color: '#475569', marginBottom: '6px' }}>Each upgrade costs $5,000 from the National Fund. Max 10 per branch.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {([
                { key: 'warBonus' as const, icon: '⚔️', label: 'WAR BONUS', desc: '+2% attack per point', color: '#ef4444' },
                { key: 'economyBonus' as const, icon: '💰', label: 'ECONOMY BONUS', desc: '+2% company production per point', color: '#22d38a' },
                { key: 'techBonus' as const, icon: '🔬', label: 'TECH BONUS', desc: '+2% cyber success per point', color: '#8b5cf6' },
                { key: 'defenseBonus' as const, icon: '🛡️', label: 'DEFENSE BONUS', desc: '+2% bunker/infra strength per point', color: '#f59e0b' },
                { key: 'diplomacyBonus' as const, icon: '🤝', label: 'DIPLOMACY BONUS', desc: '+1 alliance slot per point', color: '#3b82f6' },
              ]).map(skill => {
                const pts = gov.ideologyPoints[skill.key], maxPts = 10
                return (
                  <div key={skill.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '14px', width: '22px' }}>{skill.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: skill.color }}>{skill.label}</div>
                      <div style={{ fontSize: '7px', color: '#475569' }}>{skill.desc}</div>
                      <div style={{ display: 'flex', gap: '2px', marginTop: '3px' }}>
                        {Array.from({ length: maxPts }).map((_, i) => <div key={i} style={{ width: '14px', height: '6px', borderRadius: '1px', background: i < pts ? skill.color : 'rgba(255,255,255,0.08)' }} />)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{pts}/{maxPts}</div>
                      <button className="hud-btn-outline" disabled={pts >= maxPts}
                        style={{ fontSize: '8px', padding: '2px 6px', borderColor: skill.color, color: skill.color, marginTop: '2px' }}
                        onClick={() => {
                          const currentFund = useWorldStore.getState().getCountry(iso)?.fund
                          if (!currentFund || currentFund.money < 5000) { ui.addFloatingText('FUND: $5,000 REQUIRED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
                          useWorldStore.getState().spendFromFund(iso, { money: 5000 })
                          useGovernmentStore.setState(s => {
                            const g = s.governments[iso]
                            return { governments: { ...s.governments, [iso]: { ...g, ideologyPoints: { ...g.ideologyPoints, [skill.key]: g.ideologyPoints[skill.key] + 1 } } } }
                          })
                          ui.addFloatingText(`+1 ${skill.label}`, window.innerWidth / 2, window.innerHeight / 2, skill.color)
                        }}
                      >+1</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
