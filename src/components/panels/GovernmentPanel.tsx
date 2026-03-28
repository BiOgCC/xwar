import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useWorldStore } from '../../stores/worldStore'
import GovHomeTab from './government/GovHomeTab'
import GovPeopleTab from './government/GovPeopleTab'

import { GovAccountTab, GovCitizenshipTab } from './government/GovSmallTabs'
import GovRegionTab from './government/GovRegionTab'
import GovLeyLinesTab from './government/GovLeyLinesTab'
import GovResearchTab from './government/GovResearchTab'
import GovLawsTab from './government/GovLawsTab'
import GovElectionTab from './government/GovElectionTab'
import GovMilitaryTab from './government/GovMilitaryTab'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/gov.css'

import {
  Home, BarChart2, Wallet, Users, MapPin, Zap, Microscope, Scroll, Landmark, Shield, Users2, Vote
} from 'lucide-react'

type GovTab = 'home' | 'people' | 'account' | 'citizenship' | 'regions' | 'leylines' | 'research' | 'laws' | 'military' | 'election'

const TABS: { id: GovTab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <Home size={18} strokeWidth={2} /> },
  { id: 'people', label: 'Govt', icon: <Users2 size={18} strokeWidth={2} /> },
  { id: 'laws', label: 'Laws', icon: <Scroll size={18} strokeWidth={2} /> },
  { id: 'account', label: 'Account', icon: <Wallet size={18} strokeWidth={2} /> },

  { id: 'military', label: 'Military', icon: <Shield size={18} strokeWidth={2} /> },
  { id: 'regions', label: 'Regions', icon: <MapPin size={18} strokeWidth={2} /> },
  { id: 'citizenship', label: 'Citizens', icon: <Users size={18} strokeWidth={2} /> },
  { id: 'election', label: 'Election', icon: <Vote size={18} strokeWidth={2} /> },
  { id: 'leylines', label: 'Ley Lines', icon: <Zap size={18} strokeWidth={2} /> },
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

  // Hydrate government + citizens from backend on mount / country change
  useEffect(() => {
    govStore.fetchGovernment(iso)
  }, [iso])

  if (!gov) return <div className="gov-panel"><div className="gov-empty">Loading government data for {iso}…</div></div>

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
          {gov?.president && (
            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              👑 {gov.president}
            </div>
          )}
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
        {tab === 'people' && <GovPeopleTab />}

        {tab === 'account' && <GovAccountTab />}
        {tab === 'citizenship' && <GovCitizenshipTab />}
        {tab === 'regions' && <GovRegionTab />}
        {tab === 'leylines' && <GovLeyLinesTab />}
        {tab === 'research' && <GovResearchTab />}
        {tab === 'laws' && <GovLawsTab />}
        {tab === 'military' && <GovMilitaryTab />}
        {tab === 'election' && <GovElectionTab />}
      </div>
    </div>
  )
}
