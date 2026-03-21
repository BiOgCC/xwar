import { useUIStore } from '../../stores/uiStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import CountryFlag from '../shared/CountryFlag'
import ProfilePanel from '../panels/ProfilePanel'
import GovernmentPanel from '../panels/GovernmentPanel'
import MilitaryPanel from '../panels/MilitaryPanel'
import CyberwarfarePanel from '../panels/CyberwarfarePanel'
import MissionsPanel from '../panels/MissionsPanel'
import PrestigePanel from '../panels/PrestigePanel'
import WarPanel from '../panels/WarPanel'
import ForeignCountryPanel from '../panels/ForeignCountryPanel'
import MarketPanel from '../panels/MarketPanel'
import CompaniesPanel from '../panels/CompaniesPanel'
import CasinoPanel from '../panels/CasinoPanel'
import BountyPanel from '../panels/BountyPanel'
import StockMarketPanel from '../panels/StockMarketPanel'
import AlliancePanel from '../panels/AlliancePanel'
import SocialClubPanel from '../panels/SocialClubPanel'

export default function PanelRouter() {
  const { activePanel, togglePanel, panelFullscreen, setPanelFullscreen, selectedForeignCountry, resourceViewMode, cycleResourceView } = useUIStore()
  const player = usePlayerStore()
  const world = useWorldStore()

  if (!activePanel) return null

  return (
    <aside className={`hud-panel ${panelFullscreen ? 'hud-panel--fullscreen' : ''}`}>
      <div className="hud-panel__header">
        <h3 className="hud-panel__title">
          {activePanel === 'government'
            ? `COUNTRY — ${getCountryName(player.countryCode || 'US').toUpperCase()}`
            : activePanel === 'missions'
            ? 'DAILY OPS — COMPLETE MISSIONS FOR COSMETIC REWARDS'
            : activePanel === 'social_club'
            ? 'SOCIAL CLUB'
            : activePanel === 'foreign_country' && selectedForeignCountry
            ? <><CountryFlag iso={selectedForeignCountry} size={18} style={{ marginRight: '6px' }} />{getCountryName(selectedForeignCountry).toUpperCase()}</>
            : activePanel?.toUpperCase()}
        </h3>
        <div className="hud-panel__actions">
          <button
            className="hud-panel__fullscreen-btn"
            onClick={() => setPanelFullscreen(!panelFullscreen)}
            title={panelFullscreen ? 'Minimize (ESC)' : 'Fullscreen'}
          >
            {panelFullscreen ? '⊟' : '⛶'}
          </button>
          <button className="hud-panel__close" onClick={() => togglePanel(activePanel)}>✕</button>
        </div>
      </div>
      <div className="hud-panel__body">
        {activePanel === 'profile' && <ProfilePanel />}
        {activePanel === 'military' && <MilitaryPanel />}
        {activePanel === 'combat' && <WarPanel panelFullscreen={panelFullscreen} setPanelFullscreen={setPanelFullscreen} />}
        {activePanel === 'foreign_country' && <ForeignCountryPanel />}
        {activePanel === 'market' && <MarketPanel />}
        {activePanel === 'companies' && <CompaniesPanel />}
        {activePanel === 'casino' && <CasinoPanel />}
        {activePanel === 'bounty' && <BountyPanel />}
        {activePanel === 'stocks' && <StockMarketPanel />}
        {activePanel === 'alliance' && <AlliancePanel />}
        {activePanel === 'resources' && (
          <>
            <div className="hud-card">
              <div className="hud-card__title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {resourceViewMode === 'deposits' && '⛏️ REGIONAL DEPOSITS'}
                  {resourceViewMode === 'strategic' && '🌟 STRATEGIC RESOURCES'}
                  {resourceViewMode === 'political' && '🏳️ POLITICAL MAP'}
                </span>
                <button
                  onClick={() => cycleResourceView()}
                  style={{ fontSize: '9px', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ⟳ Cycle View
                </button>
              </div>
            </div>

            {resourceViewMode === 'deposits' && (
              <div className="hud-card">
                {world.countries.map(c => {
                  const deps = (world as any).deposits?.filter?.((d: any) => d.countryCode === c.code) || []
                  if (deps.length === 0) return null
                  return (
                    <div key={c.code} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '11px', color: c.color, marginBottom: '2px' }}>
                        {c.code} • {c.name}
                      </div>
                      {deps.map((d: any) => (
                        <div key={d.id} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', padding: '1px 0', color: d.active ? '#22d38a' : 'rgba(255,255,255,0.4)' }}>
                          <span>{d.type.toUpperCase()} +{d.bonus}%</span>
                          <span>{d.active ? `✓ ${d.discoveredBy}` : '🔒 Undiscovered'}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {resourceViewMode === 'strategic' && (
              <div className="hud-card">
                {world.countries.map(c => {
                  if (c.conqueredResources.length === 0) return null
                  return (
                    <div key={c.code} style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '11px', color: c.color, marginBottom: '2px' }}>
                        {c.code} • {c.name}
                      </div>
                      <div style={{ fontSize: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {c.conqueredResources.map((r, i) => (
                          <span key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '3px', color: '#f59e0b' }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {resourceViewMode === 'political' && (
              <div className="hud-card">
                {['NATO', 'Eastern Bloc', null].map(empire => {
                  const members = world.countries.filter(c => c.empire === empire)
                  if (members.length === 0) return null
                  return (
                    <div key={empire || 'neutral'} style={{ marginBottom: '10px' }}>
                      <div style={{ fontWeight: 700, fontSize: '11px', color: empire === 'NATO' ? '#3b82f6' : empire === 'Eastern Bloc' ? '#ef4444' : '#10b981', marginBottom: '3px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px' }}>
                        {empire || 'Non-Aligned'}
                      </div>
                      {members.map(c => (
                        <div key={c.code} style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                          <span style={{ color: c.color }}>{c.code} {c.name}</span>
                          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{c.controller}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
        {activePanel === 'government' && <GovernmentPanel />}
        {activePanel === 'cyberwarfare' && <CyberwarfarePanel />}
        {activePanel === 'missions' && <MissionsPanel />}
        {activePanel === 'prestige' && <PrestigePanel />}
        {activePanel === 'social_club' && <SocialClubPanel />}
      </div>
    </aside>
  )
}
