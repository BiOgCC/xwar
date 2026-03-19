import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import GovHomeTab from './government/GovHomeTab'
import { GovAccountTab, GovCitizenshipTab, GovWarTab } from './government/GovSmallTabs'
import GovRegionTab from './government/GovRegionTab'
import GovEmpireTab from './government/GovEmpireTab'
import GovLawsTab from './government/GovLawsTab'

type GovTab = 'home' | 'account' | 'citizenship' | 'war' | 'defense' | 'empire' | 'laws'

export default function GovernmentPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const [tab, setTab] = useState<GovTab>('home')

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]

  if (!gov) return <div style={{ color: '#fff', padding: '16px' }}>Government data unavailable for {iso}.</div>

  const tabs: { id: GovTab; label: string; icon: string }[] = [
    { id: 'home', label: 'HOME', icon: '🏠' },
    { id: 'account', label: 'ACCOUNT', icon: '💰' },
    { id: 'citizenship', label: 'CITIZENS', icon: '👥' },
    { id: 'war', label: 'WAR', icon: '⚔️' },
    { id: 'defense', label: 'REGION', icon: '🏗️' },
    { id: 'empire', label: 'EMPIRE', icon: '👑' },
    { id: 'laws', label: 'GOV', icon: '📜' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '6px 2px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.3px',
            border: `1px solid ${tab === t.id ? '#22d38a' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '3px', background: tab === t.id ? 'rgba(34,211,138,0.1)' : 'transparent',
            color: tab === t.id ? '#22d38a' : '#94a3b8', cursor: 'pointer',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
        <div style={{ flex: 1, background: 'rgba(34,211,138,0.05)', padding: '6px 8px', borderRadius: '3px', border: '1px solid rgba(34,211,138,0.2)' }}>
          <div style={{ fontSize: '8px', color: '#22d38a', fontWeight: 'bold' }}>PRESIDENT</div>
          <div style={{ color: '#fff', fontSize: '11px' }}>{gov.president || 'Vacant'}</div>
        </div>
        <div style={{ padding: '6px 8px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 'bold' }}>TAX</div>
          <div style={{ color: '#fff', fontSize: '11px' }}>{gov.taxRate}%</div>
        </div>
        {gov.swornEnemy && (
          <div style={{ padding: '6px 8px', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ fontSize: '8px', color: '#ef4444', fontWeight: 'bold' }}>ENEMY</div>
            <div style={{ color: '#ef4444', fontSize: '11px' }}>{gov.swornEnemy}</div>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {tab === 'home' && <GovHomeTab />}
      {tab === 'account' && <GovAccountTab />}
      {tab === 'citizenship' && <GovCitizenshipTab />}
      {tab === 'war' && <GovWarTab />}
      {tab === 'defense' && <GovRegionTab />}
      {tab === 'empire' && <GovEmpireTab />}
      {tab === 'laws' && <GovLawsTab />}
    </div>
  )
}
