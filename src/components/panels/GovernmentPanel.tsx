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
import CountryFlag from '../shared/CountryFlag'
import '../../styles/gov.css'

import {
  Home, BarChart2, Wallet, Users, Swords, Building2, Microscope, Scroll, Landmark, Vote
} from 'lucide-react'

type GovTab = 'home' | 'finance' | 'account' | 'citizenship' | 'war' | 'defense' | 'research' | 'laws'

const TABS: { id: GovTab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home size={18} strokeWidth={2} /> },
  { id: 'laws', label: 'Laws', icon: <Scroll size={18} strokeWidth={2} /> },
  { id: 'account', label: 'Account', icon: <Wallet size={18} strokeWidth={2} /> },
  { id: 'finance', label: 'Government', icon: <Landmark size={18} strokeWidth={2} /> },
  { id: 'war', label: 'Wars', icon: <Swords size={18} strokeWidth={2} /> },
  { id: 'citizenship', label: 'Citizens', icon: <Users size={18} strokeWidth={2} /> },
  { id: 'defense', label: 'Region', icon: <Building2 size={18} strokeWidth={2} /> },
  { id: 'research', label: 'Research', icon: <Microscope size={18} strokeWidth={2} /> },
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
      {/* Hero Header */}
      <div className="gov-hero">
        <CountryFlag iso={iso} size={52} />
        <div className="gov-hero__info">
          <div className="gov-hero__label">
            <Landmark size={12} /> Country
          </div>
          <div className="gov-hero__name">{country?.name || iso}</div>
        </div>
      </div>

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
