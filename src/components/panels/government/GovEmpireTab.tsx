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
  if (!isPresident) return (
    <div className="gov-section">
      <div className="gov-section__title gov-section__title--amber">👑 EMPIRE CONFIGURATION</div>
      <div style={{ fontSize: '9px', color: '#f59e0b', marginTop: '4px' }}>⚠️ Only the President can configure the Empire.</div>
    </div>
  )

  return (
    <>
      {/* Empire Name */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--amber">👑 EMPIRE NAME</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input className="gov-input" type="text" value={empireName} onChange={e => setEmpireName(e.target.value)} maxLength={30} placeholder="Enter empire name..." style={{ flex: 1 }} />
          <button className="gov-btn gov-btn--amber" onClick={() => {
            if (!empireName.trim()) { ui.addFloatingText('ENTER A NAME', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
            useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], empireName: empireName.trim() } } }))
            ui.addFloatingText(`EMPIRE: ${empireName.trim()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
          }}>SET</button>
        </div>
        {gov.empireName && <div style={{ fontSize: '9px', color: '#f59e0b', marginTop: '4px' }}>Current: <strong>{gov.empireName}</strong></div>}
      </div>

      {/* Ideology */}
      <div className="gov-section">
        <div className="gov-section__title">🏛️ IDEOLOGY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {([
            { id: 'militarist' as const, icon: '⚔️', label: 'MILITARIST', color: '#ef4444', desc: '+ATK & +Crit' },
            { id: 'capitalist' as const, icon: '💰', label: 'CAPITALIST', color: '#22d38a', desc: '+Production & +Tax' },
            { id: 'technocrat' as const, icon: '🔬', label: 'TECHNOCRAT', color: '#8b5cf6', desc: '+Cyber & +Tech' },
            { id: 'expansionist' as const, icon: '🌍', label: 'EXPANSIONIST', color: '#3b82f6', desc: '+Defense & +Diplo' },
          ]).map(ideo => (
            <button key={ideo.id} onClick={() => {
              useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], ideology: ideo.id } } }))
              ui.addFloatingText(`IDEOLOGY: ${ideo.label}`, window.innerWidth / 2, window.innerHeight / 2, ideo.color)
            }} style={{
              padding: '6px', borderRadius: '3px', cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${gov.ideology === ideo.id ? ideo.color + '50' : 'rgba(255,255,255,0.05)'}`,
              background: gov.ideology === ideo.id ? `${ideo.color}10` : 'rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: '11px', marginBottom: '1px' }}>
                {ideo.icon} <span style={{ fontSize: '9px', fontWeight: 700, color: gov.ideology === ideo.id ? ideo.color : '#64748b' }}>{ideo.label}</span>
              </div>
              <div style={{ fontSize: '7px', color: '#3e4a5c' }}>{ideo.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Skill Tree */}
      {gov.ideology && (
        <div className="gov-section">
          <div className="gov-section__title gov-section__title--purple">🧬 SKILL TREE</div>
          <div style={{ fontSize: '7px', color: '#3e4a5c', marginBottom: '4px' }}>Each upgrade costs $5,000 from National Fund. Max 10 per branch.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {([
              { key: 'warBonus' as const, icon: '⚔️', label: 'WAR', desc: '+2% attack/pt', color: '#ef4444' },
              { key: 'economyBonus' as const, icon: '💰', label: 'ECONOMY', desc: '+2% production/pt', color: '#22d38a' },
              { key: 'techBonus' as const, icon: '🔬', label: 'TECH', desc: '+2% cyber/pt', color: '#8b5cf6' },
              { key: 'defenseBonus' as const, icon: '🛡️', label: 'DEFENSE', desc: '+2% bunker/pt', color: '#f59e0b' },
              { key: 'diplomacyBonus' as const, icon: '🤝', label: 'DIPLOMACY', desc: '+1 alliance/pt', color: '#3b82f6' },
            ]).map(skill => {
              const pts = gov.ideologyPoints[skill.key], maxPts = 10
              return (
                <div key={skill.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '12px', width: '18px', flexShrink: 0 }}>{skill.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: skill.color }}>{skill.label}</div>
                    <div style={{ fontSize: '6px', color: '#3e4a5c' }}>{skill.desc}</div>
                    <div style={{ display: 'flex', gap: '1px', marginTop: '2px' }}>
                      {Array.from({ length: maxPts }).map((_, i) => (
                        <div key={i} style={{ width: '12px', height: '4px', borderRadius: '1px', background: i < pts ? skill.color : 'rgba(255,255,255,0.06)' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{pts}/{maxPts}</div>
                    <button className="gov-btn" disabled={pts >= maxPts} style={{
                      borderColor: `${skill.color}50`, color: skill.color, fontSize: '7px', padding: '1px 5px', marginTop: '2px',
                      opacity: pts >= maxPts ? 0.3 : 1,
                    }} onClick={() => {
                      const currentFund = useWorldStore.getState().getCountry(iso)?.fund
                      if (!currentFund || currentFund.money < 5000) { ui.addFloatingText('FUND: $5,000 REQUIRED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
                      useWorldStore.getState().spendFromFund(iso, { money: 5000 })
                      useGovernmentStore.setState(s => {
                        const g = s.governments[iso]
                        return { governments: { ...s.governments, [iso]: { ...g, ideologyPoints: { ...g.ideologyPoints, [skill.key]: g.ideologyPoints[skill.key] + 1 } } } }
                      })
                      ui.addFloatingText(`+1 ${skill.label}`, window.innerWidth / 2, window.innerHeight / 2, skill.color)
                    }}>+1</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
