import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import { useArmyStore } from '../../stores/army'
import { useWorldStore } from '../../stores/worldStore'
import { getCatchUpXPMultiplier } from '../../engine/catchup'
import { usePlayerStore as usePlayerStoreBase } from '../../stores/playerStore'
import ProfileTab from './ProfileTab'
import InventoryTab from './InventoryTab'
import SkillsTab from './SkillsTab'
import CompaniesTab from './CompaniesTab'
import AccountTab from './AccountTab'
import SpriteAvatar from '../shared/SpriteAvatar'
import {
  User, Backpack, Star, Factory, Settings, Zap, Drumstick, BriefcaseBusiness, Hammer, Users
} from 'lucide-react'

const TAB_ICON_PROPS = { color: '#22d38a', size: 18, strokeWidth: 2 }

function getTabIcon(id: string) {
  switch (id) {
    case 'profile': return <User {...TAB_ICON_PROPS} />
    case 'inventory': return <Backpack {...TAB_ICON_PROPS} />
    case 'skills': return <Star {...TAB_ICON_PROPS} />
    case 'companies': return <Factory {...TAB_ICON_PROPS} />
    case 'account': return <Settings {...TAB_ICON_PROPS} />
    default: return <User {...TAB_ICON_PROPS} />
  }
}

type SubTab = 'profile' | 'inventory' | 'skills' | 'companies' | 'account'


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

  const STAT_ICON_PROPS = { color: '#22d38a', size: 14, strokeWidth: 2 }

  const barData = [
    { label: 'STAMINA',    value: player.stamina,          max: player.maxStamina,          color: '#ef4444', grad: 'linear-gradient(90deg, #dc2626, #ef4444, #f87171)', icon: <Zap {...STAT_ICON_PROPS} /> },
    { label: 'HUNGER',     value: player.hunger,           max: player.maxHunger,           color: '#f59e0b', grad: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)', icon: <Drumstick {...STAT_ICON_PROPS} /> },
    { label: 'ENTERPRISE', value: player.entrepreneurship, max: player.maxEntrepreneurship, color: '#a855f7', grad: 'linear-gradient(90deg, #9333ea, #a855f7, #c084fc)', icon: <BriefcaseBusiness {...STAT_ICON_PROPS} /> },
    { label: 'WORK',       value: player.work,             max: player.maxWork,             color: '#3b82f6', grad: 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)', icon: <Hammer {...STAT_ICON_PROPS} /> },
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
            <span style={{ display: 'flex' }}>{getTabIcon(tab.id)}</span>
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
        const catchUpMult = getCatchUpXPMultiplier(player.level, useWorldStore.getState().serverMedianLevel)
        const catchUpActive = catchUpMult > 1.0
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
                <span style={{ display: 'flex' }}><Users {...STAT_ICON_PROPS} color={popColor} /></span>
                <span>Pop {popUsed}/{popMax}</span>
                <span className="ptab-hero__pop-pct">{popPct}%</span>
              </div>
              <div className="ptab-hero__xp-wrap">
                <div className="ptab-hero__xp-track">
                  <div className="ptab-hero__xp-fill" style={{ width: `${xpPercent}%` }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="ptab-hero__xp-text">{player.experience.toLocaleString()} / {player.experienceToNext.toLocaleString()} XP</span>
                  {catchUpActive && (
                    <span style={{
                      fontSize: '7px', fontWeight: 700, color: '#22d38a',
                      background: 'rgba(34, 211, 138, 0.12)', border: '1px solid rgba(34, 211, 138, 0.3)',
                      borderRadius: '4px', padding: '1px 4px', whiteSpace: 'nowrap',
                      textShadow: '0 0 6px rgba(34, 211, 138, 0.4)',
                    }}>
                      🚀 +{Math.round((catchUpMult - 1) * 100)}% XP
                    </span>
                  )}
                </div>
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
                <span style={{ display: 'flex', lineHeight: 1 }}><Users {...STAT_ICON_PROPS} /></span>
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
