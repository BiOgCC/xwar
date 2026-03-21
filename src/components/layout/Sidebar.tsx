import { useUIStore } from '../../stores/uiStore'

const SIDEBAR_CIVILIAN = [
  { id: 'profile' as const, icon: '👤', label: 'PROFILE' },
  { id: 'inventory' as const, icon: '🎒', label: 'INVENTORY' },
  { id: 'market' as const, icon: '📊', label: 'MARKET' },
  { id: 'companies' as const, icon: '🏭', label: 'COMPANIES' },
  { id: 'resources' as const, icon: '💰', label: 'RESOURCES' },
  { id: 'casino' as const, icon: '🎰', label: 'CASINO' },
  { id: 'bounty' as const, icon: '🎯', label: 'BOUNTY' },
  { id: 'stocks' as const, icon: '📈', label: 'STOCKS' },
  { id: 'alliance' as const, icon: '🤝', label: 'ALLIANCE' },
  { id: 'social_club' as const, icon: '🏛️', label: 'SOCIAL CLUB' },
]

const SIDEBAR_WAR = [
  { id: 'government' as const, icon: '🏛️', label: 'COUNTRY' },
  { id: 'missions' as const, icon: '📋', label: 'MISSIONS' },
  { id: 'combat' as const, icon: '⚔️', label: 'COMBAT' },
  { id: 'cyberwarfare' as const, icon: '🖥️', label: 'CYBER' },
  { id: 'military' as const, icon: '🎖️', label: 'MILITARY' },
]

const SIDEBAR_EXTRA = [
  { id: 'prestige' as const, icon: '⭐', label: 'PRESTIGE' },
]

export default function Sidebar() {
  const { activePanel, togglePanel, cycleResourceView, resourceViewMode, setProfileDefaultTab, setActivePanel } = useUIStore()

  return (
    <nav className="hud-sidebar">
      {/* CIVILIAN GROUP (Blue) */}
      <div style={{ border: '1px solid rgba(59,130,246,0.35)', borderRadius: '8px', padding: '4px 0', marginBottom: '6px', position: 'relative' }}>
        {SIDEBAR_CIVILIAN.map((item) => (
          <button
            key={item.id}
            className={`hud-sidebar__item ${((item.id === 'companies' || item.id === 'inventory') ? activePanel === 'profile' : activePanel === item.id) ? 'hud-sidebar__item--active' : ''}`}
            onClick={() => {
              if (item.id === 'profile') {
                setProfileDefaultTab(null)
                setActivePanel('profile')
              } else if (item.id === 'inventory') {
                setProfileDefaultTab('inventory')
                setActivePanel('profile')
              } else if (item.id === 'companies') {
                setProfileDefaultTab('companies')
                setActivePanel('profile')
              } else if (item.id === 'resources') {
                if (activePanel === 'resources') {
                  cycleResourceView()
                } else {
                  togglePanel('resources')
                }
              } else {
                togglePanel(item.id)
              }
            }}
          >
            <span className="hud-sidebar__icon">{item.icon}</span>
            <span className="hud-sidebar__label">
              {item.id === 'resources' && activePanel === 'resources'
                ? resourceViewMode === 'deposits' ? 'DEPOSITS'
                : resourceViewMode === 'strategic' ? 'STRATEGIC'
                : 'POLITICAL'
              : item.label}
            </span>
          </button>
        ))}
      </div>

      {/* WAR GROUP (Red) */}
      <div style={{ border: '1px solid rgba(239,68,68,0.35)', borderRadius: '8px', padding: '4px 0', marginBottom: '6px', position: 'relative' }}>
        {SIDEBAR_WAR.map((item) => (
          <button
            key={item.id}
            className={`hud-sidebar__item ${activePanel === item.id ? 'hud-sidebar__item--active' : ''}`}
            onClick={() => togglePanel(item.id)}
          >
            <span className="hud-sidebar__icon">{item.icon}</span>
            <span className="hud-sidebar__label">{item.label}</span>
            {item.id === 'combat' && <span className="hud-sidebar__dot" />}
          </button>
        ))}
      </div>

      {/* EXTRA (Prestige) */}
      {SIDEBAR_EXTRA.map((item) => (
        <button
          key={item.id}
          className={`hud-sidebar__item ${activePanel === item.id ? 'hud-sidebar__item--active' : ''}`}
          onClick={() => togglePanel(item.id)}
        >
          <span className="hud-sidebar__icon">{item.icon}</span>
          <span className="hud-sidebar__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
