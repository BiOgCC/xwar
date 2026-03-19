import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import { useArmyStore } from '../../stores/armyStore'
import { usePlayerStore as usePlayerStoreBase } from '../../stores/playerStore'
import ProfileTab from './ProfileTab'
import InventoryTab from './InventoryTab'
import SkillsTab from './SkillsTab'
import CompaniesTab from './CompaniesTab'
import AccountTab from './AccountTab'
import SpriteAvatar from '../shared/SpriteAvatar'

type SubTab = 'profile' | 'inventory' | 'skills' | 'companies' | 'account'

/* ── Minimalist SVG tab icons ── */
const TabIcon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d={d} />
  </svg>
)

const ICON_PATHS: Record<SubTab, string> = {
  // Person silhouette (head + shoulders)
  profile: 'M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z',
  // Backpack / inventory bag
  inventory: 'M17 4h-2V2h-2v2H11V2H9v2H7C5.9 4 5 4.9 5 6v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 15H7V6h10v13zm-5-8c1.66 0 3-1.34 3-3H9c0 1.66 1.34 3 3 3z',
  // Star
  skills: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z',
  // Factory / building
  companies: 'M22 10v12H2V10l7-3v2l5-2v3h8zM4 12v8h4v-6h8v6h4v-8h-6v-2.5l-5 2V9.5L4 12zm6 8h4v-4h-4v4z',
  // Gear cog
  account: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.6 3.6 0 0112 15.6z',
}

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'skills', label: 'Skills' },
  { id: 'companies', label: 'Companies' },
  { id: 'account', label: 'Account' },
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
  const playerBase = usePlayerStoreBase()

  const barData = [
    { label: 'STAMINA',    value: player.stamina,          max: player.maxStamina,          color: '#ef4444', grad: 'linear-gradient(90deg, #dc2626, #ef4444, #f87171)', icon: '⚡' },
    { label: 'HUNGER',     value: player.hunger,           max: player.maxHunger,           color: '#f59e0b', grad: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)', icon: '🍖' },
    { label: 'ENTERPRISE', value: player.entrepreneurship, max: player.maxEntrepreneurship, color: '#a855f7', grad: 'linear-gradient(90deg, #9333ea, #a855f7, #c084fc)', icon: '💼' },
    { label: 'WORK',       value: player.work,             max: player.maxWork,             color: '#3b82f6', grad: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)', icon: '🔨' },
  ]
  return (
    <div className="profile-panel">
      {/* Sub-Tab Switcher — moved to top */}
      <div className="profile-tabs">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`profile-tabs__btn ${activeTab === tab.id ? 'profile-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span><TabIcon d={ICON_PATHS[tab.id]} /></span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Player Hero Card + Avatar — only on Profile tab */}
      {activeTab === 'profile' && (<>
      {/* ── HERO / XP CARD ─────────────────────────── */}
      {(() => {
        const xpPercent = Math.min(100, (player.experience / player.experienceToNext) * 100)
        const { used: popUsed, max: popMax } = useArmyStore.getState().getPlayerPopCap()
        const popPct = popMax > 0 ? Math.round((popUsed / popMax) * 100) : 0
        const popColor = popPct >= 90 ? '#ef4444' : popPct >= 70 ? '#f59e0b' : '#22d38a'
        return (
          <div className="ptab-hero">
            {/* Avatar */}
            <div
              className="ptab-hero__avatar"
              title="Avatar"
              style={{
                width: '47px', height: '47px', borderRadius: '50%', overflow: 'hidden',
                border: '2px solid rgba(99, 102, 241, 0.5)',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.25), 0 2px 8px rgba(0,0,0,0.5)',
                flexShrink: 0, position: 'relative',
                background: 'rgba(15, 23, 42, 0.8)',
              }}
            >
              <img
                src={`https://flagcdn.com/w160/${player.countryCode.toLowerCase()}.png`}
                alt=""
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'cover', opacity: 1, pointerEvents: 'none',
                }}
              />
              <img
                src={player.avatar}
                alt="Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%', zIndex: 2,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* Level badge */}
            <div className="ptab-hero__badge">
              <span className="ptab-hero__lvl-num">{player.level}</span>
              <span className="ptab-hero__lvl-lbl">LVL</span>
            </div>

            {/* Name + XP + Pop */}
            <div className="ptab-hero__info">
              <div className="ptab-hero__name">{player.name}</div>
              <div className="ptab-hero__pop" style={{ color: popColor }}>
                <span>👥</span>
                <span>Pop {popUsed}/{popMax}</span>
                <span className="ptab-hero__pop-pct">{popPct}%</span>
              </div>
              <div className="ptab-hero__xp-wrap">
                <div className="ptab-hero__xp-track">
                  <div className="ptab-hero__xp-fill" style={{ width: `${xpPercent}%` }} />
                </div>
                <span className="ptab-hero__xp-text">{player.experience.toLocaleString()} / {player.experienceToNext.toLocaleString()} XP</span>
              </div>
            </div>

            {/* SP badge */}
            <div className="ptab-hero__sp">
              <span className="ptab-hero__sp-num">{player.skillPoints}</span>
              <span className="ptab-hero__sp-lbl">SP</span>
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        {/* Animated Sprite Character */}
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.08)',
          padding: '4px 0 0 0', overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Country flag background */}
          <img
            src={`https://flagcdn.com/w320/${playerBase.countryCode.toLowerCase()}.png`}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', opacity: 1,
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 100%, rgba(99, 102, 241, 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <SpriteAvatar width={162} height={234} />
          </div>
        </div>

        {/* Status Bars */}
        <div className="profile-bars" style={{ flex: 1 }}>
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
      </div>
      </>)}
      {/* Production moved to per-company in Companies tab */}

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
