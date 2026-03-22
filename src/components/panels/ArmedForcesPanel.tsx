import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useArmyStore } from '../../stores/army'
import { useUIStore } from '../../stores/uiStore'
import AFCountryTab from './armedforces/AFCountryTab'
import AFPmcTab from './armedforces/AFPmcTab'
import AFOwnForcesTab from './armedforces/AFOwnForcesTab'
import WarRecruitTab from './WarRecruitTab'
import MarketDivsTab from './market/MarketDivsTab'
import CombatTab from './WarCombatTab'
import '../../styles/war.css'

type AFTab = 'country' | 'pmc' | 'own' | 'recruit' | 'market' | 'fight'
type SourceFilter = 'own' | 'country' | 'pmc'

export default function ArmedForcesPanel() {
  const player = usePlayerStore()
  const armyStore = useArmyStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'

  const [tab, setTab] = useState<AFTab>('own')
  const [feedback, setFeedback] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('own')

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)

  const showFb = (msg: string, ok = true) => {
    setFeedback(msg)
    ui.addFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, ok ? '#22d38a' : '#ef4444')
    setTimeout(() => setFeedback(''), 3000)
  }

  const tabs: { id: AFTab; label: string; icon: string; isImg?: boolean; count?: number }[] = [
    { id: 'country', label: 'COUNTRY AF', icon: '🏛️' },
    { id: 'pmc', label: 'PMC', icon: '🏴' },
    { id: 'own', label: 'MY FORCES', icon: '/assets/icons/divs.png', isImg: true, count: myDivisions.length },
    { id: 'recruit', label: 'RECRUIT', icon: '/assets/icons/gear.png', isImg: true },
    { id: 'market', label: 'DIV MKT', icon: '📊' },
    { id: 'fight', label: 'FIGHT', icon: '⚔️' },
  ]

  // Show source selector for recruit and market tabs
  const showSourceSelector = tab === 'recruit' || tab === 'market'

  return (
    <div className="war-panel">
      {/* Tab Bar */}
      <div className="war-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`war-tab ${tab === t.id ? 'war-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.isImg
              ? <img src={t.icon} alt={t.label} className="war-tab__img" />
              : <span className="war-tab__icon">{t.icon}</span>
            }
            <span className="war-tab__label">{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className="war-tab__badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Source Selector for Recruit / DIV MKT */}
      {showSourceSelector && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 10px', marginBottom: '4px',
          background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', marginRight: '2px' }}>SOURCE:</span>
          {([
            { id: 'country' as SourceFilter, label: '🏛️ COUNTRY', color: '#22d38a' },
            { id: 'pmc' as SourceFilter, label: '🏴 PMC', color: '#a855f7' },
          ]).map(s => {
            const active = sourceFilter === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSourceFilter(active ? 'own' : s.id)}
                style={{
                  padding: '3px 8px', fontSize: '8px', fontWeight: 700,
                  border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '3px',
                  background: active ? `${s.color}18` : 'rgba(255,255,255,0.04)',
                  color: active ? s.color : '#94a3b8',
                  cursor: 'pointer', transition: 'all 0.15s',
                  letterSpacing: '0.08em', fontFamily: 'var(--font-display)',
                }}
              >
                {active && <span style={{ marginRight: '3px' }}>✓</span>}
                {s.label}
              </button>
            )
          })}
          {sourceFilter !== 'own' && (
            <span style={{ fontSize: '7px', color: '#64748b', marginLeft: 'auto', fontStyle: 'italic' }}>
              Viewing {sourceFilter === 'country' ? 'country' : 'PMC'} inventory
            </span>
          )}
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Need') || feedback.includes('Not') || feedback.includes('Cannot') || feedback.includes('Invalid') ? 'war-feedback--error' : 'war-feedback--success'}`} style={{ margin: '6px 0' }}>
          {feedback}
        </div>
      )}

      {/* Tab Content */}
      <div className="war-content">
        {tab === 'country' && <AFCountryTab iso={iso} />}
        {tab === 'pmc' && <AFPmcTab iso={iso} />}
        {tab === 'own' && <AFOwnForcesTab iso={iso} />}
        {tab === 'recruit' && <WarRecruitTab sourceFilter={sourceFilter} />}
        {tab === 'market' && <MarketDivsTab showFb={showFb} sourceFilter={sourceFilter} />}
        {tab === 'fight' && <CombatTab />}
      </div>
    </div>
  )
}
