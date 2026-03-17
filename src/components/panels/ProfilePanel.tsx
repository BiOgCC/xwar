import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import { useArmyStore } from '../../stores/armyStore'
import ProfileTab from './ProfileTab'
import InventoryTab from './InventoryTab'
import SkillsTab from './SkillsTab'
import CompaniesTab from './CompaniesTab'
import AccountTab from './AccountTab'

type SubTab = 'profile' | 'inventory' | 'skills' | 'companies' | 'account'

const SUB_TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'inventory', label: 'Inventory', icon: '🎒' },
  { id: 'skills', label: 'Skills', icon: '⭐' },
  { id: 'companies', label: 'Companies', icon: '🏢' },
  { id: 'account', label: 'Account', icon: '⚙️' },
]

export default function ProfilePanel() {
  const uiStore = useUIStore()
  const defaultTab = uiStore.profileDefaultTab as SubTab | null
  const [activeTab, setActiveTab] = useState<SubTab>(defaultTab || 'profile')

  useEffect(() => {
    if (defaultTab && defaultTab !== activeTab) {
      setActiveTab(defaultTab)
      uiStore.setProfileDefaultTab(null)
    }
  }, [defaultTab])
  const player = usePlayerStore()

  const barData = [
    { label: 'STAMINA',    value: player.stamina,          max: player.maxStamina,          color: '#ef4444', grad: 'linear-gradient(90deg, #dc2626, #ef4444, #f87171)', icon: '⚡' },
    { label: 'HUNGER',     value: player.hunger,           max: player.maxHunger,           color: '#f59e0b', grad: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)', icon: '🍖' },
    { label: 'ENTERPRISE', value: player.entrepreneurship, max: player.maxEntrepreneurship, color: '#a855f7', grad: 'linear-gradient(90deg, #9333ea, #a855f7, #c084fc)', icon: '💼' },
    { label: 'WORK',       value: player.work,             max: player.maxWork,             color: '#3b82f6', grad: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)', icon: '🔨' },
  ]
  return (
    <div className="profile-panel">
      {/* Player Bars */}
      <div className="profile-bars">
        {barData.map((bar) => (
          <div key={bar.label} className="profile-bar">
            <div className="profile-bar__header">
              <span className="profile-bar__icon" style={{ color: bar.color }}>{bar.icon}</span>
              <span className="profile-bar__label">{bar.label}</span>
              <span className="profile-bar__value">{Math.round(bar.value)}/{bar.max}</span>
            </div>
            <div className="profile-bar__track">
              <div
                className="profile-bar__fill"
                style={{
                  width: `${Math.min(100, (bar.value / bar.max) * 100)}%`,
                  background: bar.grad,
                  boxShadow: `0 0 10px ${bar.color}55, 0 0 4px ${bar.color}33`,
                }}
              />
            </div>
          </div>
        ))}
        {/* Pop Cap — numbers only, after WORK */}
        {(() => {
          const popCap = useArmyStore.getState().getPlayerPopCap()
          return (
            <div className="profile-bar" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
              <span style={{ fontSize: '11px', lineHeight: 1 }}>👥</span>
              <span style={{ fontSize: '8px', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em' }}>POP</span>
              <span style={{ marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 600, color: popCap.used >= popCap.max ? '#ef4444' : '#38bdf8' }}>{popCap.used}/{popCap.max}</span>
            </div>
          )
        })()}
      </div>
      {/* Production moved to per-company in Companies tab */}

      {/* Sub-Tab Switcher */}
      <div className="profile-tabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`profile-tabs__btn ${activeTab === tab.id ? 'profile-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="profile-content">
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'companies' && <CompaniesTab />}
        {activeTab === 'account' && <AccountTab />}
      </div>
    </div>
  )
}
