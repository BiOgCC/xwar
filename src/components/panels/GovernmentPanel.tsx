import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useWorldStore } from '../../stores/worldStore'
import GovHomeTab from './government/GovHomeTab'
import GovFinanceTab from './government/GovFinanceTab'
import { GovAccountTab, GovCitizenshipTab, GovWarTab } from './government/GovSmallTabs'
import GovRegionTab from './government/GovRegionTab'
import GovResearchTab from './government/GovResearchTab'
import GovLawsTab from './government/GovLawsTab'
import '../../styles/gov.css'

type GovTab = 'home' | 'finance' | 'account' | 'citizenship' | 'war' | 'defense' | 'research' | 'laws'

const TABS: { id: GovTab; label: string; icon: string }[] = [
  { id: 'home', label: 'HQ', icon: '🏠' },
  { id: 'finance', label: 'FINANCE', icon: '📊' },
  { id: 'account', label: 'ACCOUNT', icon: '💰' },
  { id: 'citizenship', label: 'CITIZENS', icon: '👥' },
  { id: 'war', label: 'WAR', icon: '⚔️' },
  { id: 'defense', label: 'REGION', icon: '🏗️' },
  { id: 'research', label: 'RESEARCH', icon: '🔬' },
  { id: 'laws', label: 'GOV', icon: '📜' },
]

export default function GovernmentPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const [tab, setTab] = useState<GovTab>('home')

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const country = world.getCountry(iso)

  if (!gov) return <div className="gov-panel"><div className="gov-empty">Government data unavailable for {iso}.</div></div>

  return (
    <div className="gov-panel">
      {/* Tab Bar */}
      <div className="gov-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`gov-tab ${tab === t.id ? 'gov-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="gov-tab__icon">{t.icon}</span>
            <span className="gov-tab__label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Header Strip */}
      <div className="gov-header">
        <div className="gov-header__country">
          <span className="gov-header__flag">🏛️</span>
          <span className="gov-header__name">{country?.name || iso}</span>
        </div>
        <div className="gov-header__stats">
          <div className="gov-header__stat">
            <span className="gov-header__stat-label">PRESIDENT</span>
            <span className="gov-header__stat-value gov-header__stat-value--green">{gov.president || 'Vacant'}</span>
          </div>
          <div className="gov-header__stat">
            <span className="gov-header__stat-label">TAX</span>
            <span className="gov-header__stat-value gov-header__stat-value--amber">{gov.taxRate}%</span>
          </div>
          {gov.swornEnemy && (
            <div className="gov-header__stat">
              <span className="gov-header__stat-label">ENEMY</span>
              <span className="gov-header__stat-value gov-header__stat-value--red">{gov.swornEnemy}</span>
            </div>
          )}
          {gov.ideology && (
            <div className="gov-header__stat">
              <span className="gov-header__stat-label">IDEOLOGY</span>
              <span className="gov-header__stat-value gov-header__stat-value--purple">{gov.ideology.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="gov-content">
        {tab === 'home' && <GovHomeTab />}
        {tab === 'finance' && <GovFinanceTab />}
        {tab === 'account' && <GovAccountTab />}
        {tab === 'citizenship' && <GovCitizenshipTab />}
        {tab === 'war' && <GovWarTab />}
        {tab === 'defense' && <GovRegionTab />}
        {tab === 'research' && <GovResearchTab />}
        {tab === 'laws' && <GovLawsTab />}
      </div>
    </div>
  )
}
