import { useState, useEffect } from 'react'
import { useArmyStore } from '../../stores/army'
import { useBattleStore } from '../../stores/battleStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useUIStore } from '../../stores/uiStore'
import WarOverviewTab from './WarOverviewTab'
import WarRecruitTab from './WarRecruitTab'
import WarForcesTab from './WarForcesTab'
import WarCombatTab from './WarCombatTab'
import '../../styles/war.css'

type WarTab = 'overview' | 'recruit' | 'armies' | 'battles'

export default function WarPanel({ panelFullscreen, setPanelFullscreen }: { panelFullscreen?: boolean; setPanelFullscreen?: (v: boolean) => void }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const iso = player.countryCode || 'US'
  const warDefaultTab = useUIStore(s => s.warDefaultTab)

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const [tab, setTab] = useState<WarTab>(() => {
    if (warDefaultTab && ['overview', 'recruit', 'armies', 'battles'].includes(warDefaultTab)) return warDefaultTab as WarTab
    return activeBattles.length > 0 ? 'battles' : 'overview'
  })
  const [editingMotd, setEditingMotd] = useState(false)

  // When warDefaultTab changes externally (e.g. clicking Recruit in ActionBar), switch tab
  useEffect(() => {
    if (warDefaultTab && ['overview', 'recruit', 'armies', 'battles'].includes(warDefaultTab)) {
      setTab(warDefaultTab as WarTab)
      useUIStore.getState().setWarDefaultTab(null)
    }
  }, [warDefaultTab])

  const govStore = useGovernmentStore()
  const gov = govStore.governments[iso]
  const shopCount = gov?.divisionShop?.length || 0
  const claimableContracts = govStore.militaryContracts.filter(c => c.playerId === player.name && c.status === 'claimable').length
  const recruitBadge = shopCount + claimableContracts || undefined

  const tabs: { id: WarTab; label: string; icon: string; isImg?: boolean; count?: number }[] = [
    { id: 'overview', label: 'HQ', icon: '🎯' },
    { id: 'recruit', label: 'RECRUIT', icon: '/assets/icons/gear.png', isImg: true, count: recruitBadge },
    { id: 'armies', label: 'FORCES', icon: '/assets/icons/divs.png', isImg: true, count: myDivisions.length },
    { id: 'battles', label: 'COMBAT', icon: '⚔️', count: activeBattles.length },
  ]

  return (
    <div className="war-panel">
      {/* Message of the Day — global, above tabs */}
      <div className="war-motd" style={{ padding: '6px 10px', marginBottom: '6px', background: 'rgba(96, 165, 250, 0.08)', borderRadius: '4px', border: '1px solid rgba(96, 165, 250, 0.2)', boxShadow: 'inset 0 0 10px rgba(96, 165, 250, 0.05)' }}>
        {editingMotd ? (
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <input
              type="text" placeholder="COMMANDER MESSAGE OF THE DAY..." maxLength={200}
              value={battleStore.warMotd || ''} autoFocus
              onChange={(e) => battleStore.setWarMotd(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingMotd(false) }}
              style={{
                flex: 1, padding: '3px 6px', fontSize: '8px',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '3px', color: '#e2e8f0', outline: 'none',
              }}
            />
            <button
              onClick={() => setEditingMotd(false)}
              style={{
                padding: '2px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                background: 'rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: '10px', fontWeight: 700,
              }}
            >✅</button>
          </div>
        ) : battleStore.warMotd ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => setEditingMotd(true)}>
            <div style={{
              flex: 1, fontSize: '8px', letterSpacing: '0.8px', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#60a5fa',
              padding: '4px 8px', background: 'rgba(96, 165, 250, 0.05)', borderRadius: '2px',
              borderLeft: '2px solid #60a5fa',
            }}>
              {battleStore.warMotd}
            </div>
            <span style={{ fontSize: '8px', color: '#475569' }}>✏️</span>
          </div>
        ) : (
          <button
            onClick={() => setEditingMotd(true)}
            style={{
              width: '100%', padding: '4px 6px', border: '1px dashed rgba(96, 165, 250, 0.3)',
              borderRadius: '2px', cursor: 'pointer', background: 'transparent',
              fontSize: '8px', color: '#60a5fa', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: 600
            }}
          >SET MESSAGE OF THE DAY</button>
        )}
      </div>
      <div className="war-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`war-tab ${tab === t.id ? 'war-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.isImg
              ? <img src={t.icon} alt={t.label} className="war-tab__img" />
              : <span className="war-tab__icon">{t.icon}</span>
            }
            <span className="war-tab__label">{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className="war-tab__badge">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="war-content">
        {tab === 'overview' && <WarOverviewTab iso={iso} />}
        {tab === 'recruit' && <WarRecruitTab />}
        {tab === 'armies' && <WarForcesTab iso={iso} />}
        {tab === 'battles' && <WarCombatTab panelFullscreen={panelFullscreen} setPanelFullscreen={setPanelFullscreen} />}
      </div>
    </div>
  )
}
