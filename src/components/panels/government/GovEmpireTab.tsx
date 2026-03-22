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
            useGovernmentStore.setState((s: any) => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], empireName: empireName.trim() } } }))
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
              useGovernmentStore.setState((s: any) => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], ideology: ideo.id } } }))
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


    </>
  )
}
