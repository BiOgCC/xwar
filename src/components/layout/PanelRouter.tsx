import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import { useSidebarLayoutStore, type PanelId, type SidebarItem } from '../../stores/sidebarLayoutStore'
import CountryFlag from '../shared/CountryFlag'
import ProfilePanel from '../panels/ProfilePanel'
import GovernmentPanel from '../panels/GovernmentPanel'
import MilitaryPanel from '../panels/MilitaryPanel'
import MUPanel from '../panels/MUPanel'
import ArmedForcesPanel from '../panels/ArmedForcesPanel'
import CyberwarfarePanel from '../panels/CyberwarfarePanel'
import MissionsPanel from '../panels/MissionsPanel'
import PrestigePanel from '../panels/PrestigePanel'
import WarPanel from '../panels/WarPanel'
import ForeignCountryPanel from '../panels/ForeignCountryPanel'
import MarketPanel from '../panels/MarketPanel'
import CompaniesPanel from '../panels/CompaniesPanel'
import CasinoPanel from '../panels/CasinoPanel'
import BountyPanel from '../panels/BountyPanel'
import LeyLinePanel from '../panels/LeyLinePanel'
import StockMarketPanel from '../panels/StockMarketPanel'
import AlliancePanel from '../panels/AlliancePanel'
import SocialClubPanel from '../panels/SocialClubPanel'
import SettingsPanel from '../panels/SettingsPanel'
import HelpPanel from '../panels/HelpPanel'
import HistoryPanel from '../panels/HistoryPanel'
import DiplomacyPanel from '../panels/DiplomacyPanel'
import RegionPanel from '../panels/RegionPanel'
import TradeRoutePanel from '../panels/TradeRoutePanel'
import {
  User, Backpack, BarChart2, Factory, CircleDollarSign,
  Gamepad2, Target, TrendingUp, Handshake, Landmark,
  ClipboardList, Swords, Monitor, Shield, Medal, Star, ScrollText, Anchor,
  Beer, ChevronLeft, Flag, Zap
} from 'lucide-react'

const SIDEBAR_ICON_PROPS = { color: '#22d38a', size: 16, strokeWidth: 2 }

function getSidebarIcon(id: string) {
  switch (id) {
    case 'profile': return <User {...SIDEBAR_ICON_PROPS} />
    case 'inventory': return <Backpack {...SIDEBAR_ICON_PROPS} />
    case 'market': return <BarChart2 {...SIDEBAR_ICON_PROPS} />
    case 'companies': return <Factory {...SIDEBAR_ICON_PROPS} />
    case 'resources': return <CircleDollarSign {...SIDEBAR_ICON_PROPS} />
    case 'casino': return <Gamepad2 {...SIDEBAR_ICON_PROPS} />
    case 'bounty': return <Target {...SIDEBAR_ICON_PROPS} />
    case 'ley_lines': return <Zap {...SIDEBAR_ICON_PROPS} />
    case 'stocks': return <TrendingUp {...SIDEBAR_ICON_PROPS} />
    case 'alliance': return <Handshake {...SIDEBAR_ICON_PROPS} />
    case 'social_club': return <Beer {...SIDEBAR_ICON_PROPS} />
    case 'government': return <Landmark {...SIDEBAR_ICON_PROPS} />
    case 'missions': return <ClipboardList {...SIDEBAR_ICON_PROPS} />
    case 'combat': return <Swords {...SIDEBAR_ICON_PROPS} />
    case 'cyberwarfare': return <Monitor {...SIDEBAR_ICON_PROPS} />
    case 'armed_forces': return <Shield {...SIDEBAR_ICON_PROPS} />
    case 'military': return <Medal {...SIDEBAR_ICON_PROPS} />
    case 'mu': return <Flag {...SIDEBAR_ICON_PROPS} />
    case 'prestige': return <Star {...SIDEBAR_ICON_PROPS} />
    case 'diplomacy': return <Handshake {...SIDEBAR_ICON_PROPS} />
    case 'history': return <ScrollText {...SIDEBAR_ICON_PROPS} />
    case 'region': return <Target {...SIDEBAR_ICON_PROPS} />
    case 'trade_routes': return <Anchor {...SIDEBAR_ICON_PROPS} />
    default: return <User {...SIDEBAR_ICON_PROPS} />
  }
}


/* ── Hotkey mapping for sidebar shortcut badges ── */
const SIDEBAR_HOTKEYS: Record<string, string> = {
  combat: '5',
  cyberwarfare: '6',
  military: '7',
  market: '8',
}

/* ── 5 quick-access icons shown at the bottom of the panel ── */
const QUICK_NAV = [
  { id: 'inventory',    icon: '🎒', label: 'Inventory' },
  { id: 'mu',           icon: '🏴', label: 'MU' },
  { id: 'combat',       icon: '⚔️', label: 'Battles' },
  { id: 'market',       icon: '📊', label: 'Market' },
  { id: 'companies',    icon: '🏭', label: 'Companies' },
]

/* ── Sidebar panel sub-component (reused for top & bottom drag groups) ── */
interface DragState { panel: PanelId; index: number }
interface DropTarget { panel: PanelId; index: number }

function SidebarPanel({
  panelId, items, borderColor, dragState, dropTarget,
  onDragStart, onDragOver, onDrop, onDragEnd, onDragLeave, renderItem,
}: {
  panelId: PanelId
  items: SidebarItem[]
  borderColor: string
  dragState: DragState | null
  dropTarget: DropTarget | null
  onDragStart: (p: PanelId, i: number, e: React.DragEvent) => void
  onDragOver: (p: PanelId, i: number, e: React.DragEvent) => void
  onDrop: (p: PanelId, e: React.DragEvent) => void
  onDragEnd: () => void
  onDragLeave: (e: React.DragEvent) => void
  renderItem: (item: SidebarItem, i: number, p: PanelId) => React.ReactNode
}) {
  return (
    <div
      className="hud-sidebar__panel"
      style={{ borderColor }}
      onDragOver={(e) => { e.preventDefault(); if (items.length === 0) onDragOver(panelId, 0, e) }}
      onDrop={(e) => onDrop(panelId, e)}
      onDragLeave={onDragLeave}
    >
      {items.map((item, index) => {
        const isDragging = dragState?.panel === panelId && dragState.index === index
        const isDropBefore = dropTarget?.panel === panelId && dropTarget.index === index
        return (
          <div key={item.id} style={{ position: 'relative' }}>
            {isDropBefore && <div className="hud-sidebar__drop-indicator" />}
            <div
              className={`hud-sidebar__drag-wrapper ${isDragging ? 'hud-sidebar__drag-wrapper--dragging' : ''}`}
              draggable
              onDragStart={(e) => onDragStart(panelId, index, e)}
              onDragOver={(e) => {
                e.preventDefault(); e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                onDragOver(panelId, e.clientY < midY ? index : index + 1, e)
              }}
              onDragEnd={onDragEnd}
            >
              {renderItem(item, index, panelId)}
            </div>
          </div>
        )
      })}
      {dropTarget?.panel === panelId && dropTarget.index === items.length && (
        <div className="hud-sidebar__drop-indicator" />
      )}
      {items.length === 0 && (
        <div className="hud-sidebar__empty-drop">
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)' }}>
            DROP HERE
          </span>
        </div>
      )}
    </div>
  )
}

export default function PanelRouter() {
  const { activePanel, togglePanel, panelFullscreen, setPanelFullscreen, selectedForeignCountry, resourceViewMode, cycleResourceView, panelHistory, goBack, setProfileDefaultTab, setActivePanel } = useUIStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const { topItems, bottomItems, moveItem, resetLayout } = useSidebarLayoutStore()

  const [navOpen, setNavOpen] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goBack])

  /* ── drag handlers ── */
  const handleDragStart = useCallback((panel: PanelId, index: number, e: React.DragEvent) => {
    setDragState({ panel, index }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${panel}:${index}`)
  }, [])
  const handleDragOver = useCallback((panel: PanelId, index: number, _e: React.DragEvent) => { setDropTarget({ panel, index }) }, [])
  const handleDrop = useCallback((_panel: PanelId, _e: React.DragEvent) => {
    if (!dragState || !dropTarget) return
    if (dragState.panel !== dropTarget.panel || dragState.index !== dropTarget.index) moveItem(dragState.panel, dropTarget.panel, dragState.index, dropTarget.index)
    setDragState(null); setDropTarget(null)
  }, [dragState, dropTarget, moveItem])
  const handleDragEnd = useCallback(() => { setDragState(null); setDropTarget(null) }, [])
  const handleDragLeave = useCallback((_e: React.DragEvent) => {}, [])

  /* ── navigate via sidebar ── */
  const handleItemClick = useCallback((item: SidebarItem) => {
    if (item.id === 'profile') { setProfileDefaultTab(null); setActivePanel('profile') }
    else if (item.id === 'inventory') { setProfileDefaultTab('inventory'); setActivePanel('profile') }
    else if (item.id === 'companies') { setProfileDefaultTab('companies'); setActivePanel('profile') }
    else if (item.id === 'resources') { activePanel === 'resources' ? cycleResourceView() : togglePanel('resources') }
    else { togglePanel(item.id as any) }
    setNavOpen(false)
  }, [activePanel, togglePanel, cycleResourceView, setProfileDefaultTab, setActivePanel])

  /* ── quick-nav click ── */
  const handleQuickNav = useCallback((id: string) => {
    if (id === 'profile') { setProfileDefaultTab('profile'); setActivePanel('profile') }
    else if (id === 'inventory') { setProfileDefaultTab('inventory'); setActivePanel('profile') }
    else if (id === 'companies') { setProfileDefaultTab('companies'); setActivePanel('profile') }
    else { setActivePanel(id as any) }
  }, [setProfileDefaultTab, setActivePanel])

  const renderItem = useCallback((item: SidebarItem, _index: number, _panelId: PanelId) => {
    const isActive = (item.id === 'companies' || item.id === 'inventory') ? activePanel === 'profile' : activePanel === item.id
    const hotkey = SIDEBAR_HOTKEYS[item.id]
    return (
      <button
        className={`hud-sidebar__item ${isActive ? 'hud-sidebar__item--active' : ''}`}
        onClick={() => handleItemClick(item)}
      >
        <span className="hud-sidebar__icon">{getSidebarIcon(item.id)}</span>
        <span className="hud-sidebar__label">
          {item.id === 'resources' && activePanel === 'resources'
            ? resourceViewMode === 'deposits' ? 'DEPOSITS'
            : resourceViewMode === 'strategic' ? 'STRATEGIC'
            : 'POLITICAL'
          : item.label}
        </span>
        {hotkey && <span className="hud-sidebar__hotkey">{hotkey}</span>}
        {item.id === 'combat' && <span className="hud-sidebar__dot" />}
      </button>
    )
  }, [activePanel, resourceViewMode, handleItemClick])

  if (!activePanel) return null

  return (
    <div className="hud-panel-wrap">
      {/* ── Toggle tab (left edge of nav drawer) ── */}
      <button
        className="hud-panel-nav__toggle"
        onClick={() => setNavOpen(o => !o)}
        title={navOpen ? 'Close navigator' : 'Open navigator'}
      >
        <span className="hud-panel-nav__toggle-icon">{navOpen ? '◀' : '▶'}</span>
        <span className="hud-panel-nav__toggle-label">NAV</span>
      </button>

      {/* ── Collapsible sidebar drawer ── */}
      <nav className={`hud-panel-nav ${navOpen ? 'hud-panel-nav--open' : ''} ${dragState ? 'hud-sidebar--dragging' : ''}`}>
        <div className="hud-panel-nav__header">
          <span className="hud-panel-nav__header-icon">☰</span>
          <span className="hud-panel-nav__header-text">NAVIGATOR</span>
        </div>
        <div className="hud-sidebar__content">
          <div className="hud-sidebar__group-label">GENERAL</div>
          <SidebarPanel
            panelId="top" items={topItems} borderColor="rgba(59,130,246,0.25)"
            dragState={dragState} dropTarget={dropTarget}
            onDragStart={handleDragStart} onDragOver={handleDragOver}
            onDrop={handleDrop} onDragEnd={handleDragEnd} onDragLeave={handleDragLeave}
            renderItem={renderItem}
          />
          <div className="hud-sidebar__group-label">OPERATIONS</div>
          <SidebarPanel
            panelId="bottom" items={bottomItems} borderColor="rgba(239,68,68,0.25)"
            dragState={dragState} dropTarget={dropTarget}
            onDragStart={handleDragStart} onDragOver={handleDragOver}
            onDrop={handleDrop} onDragEnd={handleDragEnd} onDragLeave={handleDragLeave}
            renderItem={renderItem}
          />
          <button className="hud-sidebar__reset" onClick={resetLayout} title="Reset sidebar layout">↺</button>
        </div>
      </nav>

      {/* ── Main panel ── */}
      <aside className={`hud-panel ${panelFullscreen ? 'hud-panel--fullscreen' : ''}`}>
        <div className="hud-panel__header">
          <h3 className="hud-panel__title">
            {activePanel === 'government'
              ? `COUNTRY — ${getCountryName(player.countryCode || 'US').toUpperCase()}`
              : activePanel === 'missions'
              ? 'DAILY OPS — COMPLETE MISSIONS FOR COSMETIC REWARDS'
              : activePanel === 'social_club'
              ? 'SOCIAL CLUB'
              : activePanel === 'settings'
              ? '⚙️ SETTINGS'
              : activePanel === 'help'
              ? '❓ HELP & GUIDE'
              : activePanel === 'history'
              ? '📜 WAR HISTORY'
              : activePanel === 'diplomacy'
              ? '🤝 DIPLOMACY'
              : activePanel === 'trade_routes'
              ? '⚓ MARITIME TRADE ROUTES'
              : activePanel === 'ley_lines'
              ? '⚡ LEY LINE CORRIDORS'
              : activePanel === 'armed_forces'
              ? '🪖 ARMED FORCES'
              : activePanel === 'mu'
              ? '🏴 MILITARY UNIT'

              : activePanel === 'foreign_country' && selectedForeignCountry
              ? <><CountryFlag iso={selectedForeignCountry} size={18} style={{ marginRight: '6px' }} />{getCountryName(selectedForeignCountry).toUpperCase()}</>
              : activePanel === 'region'
              ? '🌍 REGION DETAILS'
              : activePanel?.toUpperCase()}
          </h3>
          <div className="hud-panel__actions">
            {panelHistory.length > 0 && (
              <button
                className="hud-panel__back-btn"
                onClick={goBack}
                title="Go back (Backspace)"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
            )}
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
          {activePanel === 'mu' && <MUPanel />}
          {activePanel === 'armed_forces' && <ArmedForcesPanel />}
          {activePanel === 'combat' && <WarPanel panelFullscreen={panelFullscreen} setPanelFullscreen={setPanelFullscreen} />}
          {activePanel === 'foreign_country' && <ForeignCountryPanel />}
          {activePanel === 'market' && <MarketPanel />}
          {activePanel === 'companies' && <CompaniesPanel />}
          {activePanel === 'casino' && <CasinoPanel />}
          {activePanel === 'bounty' && <BountyPanel />}
          {activePanel === 'ley_lines' && <LeyLinePanel />}
          {activePanel === 'stocks' && <StockMarketPanel />}
          {activePanel === 'alliance' && <AlliancePanel />}
          {activePanel === 'region' && <RegionPanel />}
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
          {activePanel === 'trade_routes' && <TradeRoutePanel />}
          {activePanel === 'government' && <GovernmentPanel />}
          {activePanel === 'cyberwarfare' && <CyberwarfarePanel />}
          {activePanel === 'missions' && <MissionsPanel />}
          {activePanel === 'prestige' && <PrestigePanel />}
          {activePanel === 'social_club' && <SocialClubPanel />}
          {activePanel === 'settings' && <SettingsPanel />}
          {activePanel === 'help' && <HelpPanel />}
          {activePanel === 'history' && <HistoryPanel />}
          {activePanel === 'diplomacy' && <DiplomacyPanel />}

        </div>

        {/* ── Quick-access icons at the bottom ── */}
        <div className="hud-panel__quicknav">
          {QUICK_NAV.map(q => (
            <button
              key={q.id}
              className={`hud-panel__quicknav-btn ${(q.id === 'profile' || q.id === 'companies' || q.id === 'inventory') ? (activePanel === 'profile' ? 'hud-panel__quicknav-btn--active' : '') : (activePanel === q.id ? 'hud-panel__quicknav-btn--active' : '')}`}
              onClick={() => handleQuickNav(q.id)}
              title={q.label}
            >
              <span className="hud-panel__quicknav-icon">{getSidebarIcon(q.id)}</span>
              <span className="hud-panel__quicknav-label">{q.label}</span>
            </button>
          ))}
        </div>


      </aside>
    </div>
  )
}
