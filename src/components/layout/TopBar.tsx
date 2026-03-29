import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import ResourceIcon from '../shared/ResourceIcon'

interface TopBarProps {
  timeLeft: number
  onManualTick: () => void
}

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const formatDailyTime = (secs: number) => {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

export default function TopBar({ timeLeft, onManualTick }: TopBarProps) {
  const player = usePlayerStore()
  const world = useWorldStore()
  const [dailyLeft, setDailyLeft] = useState(() => world.getTimeUntilDailyReset())

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = useWorldStore.getState().getTimeUntilDailyReset()
      setDailyLeft(remaining)
      if (remaining <= 0) useWorldStore.getState().processDailyReset()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const navigateTo = (panel: string, tab?: string) => {
    if (tab) useUIStore.getState().setProfileDefaultTab(tab)
    useUIStore.getState().setActivePanel(panel as any)
  }

  const cc = player.countryCode?.toLowerCase() ?? ''
  const flagUrl = cc ? `https://flagcdn.com/w80/${cc}.png` : null
  const xpPct = Math.min(100, ((player.experience ?? 0) / Math.max(1, (player as any).expToNext ?? 100)) * 100)

  return (
    <header className="hud-topbar">

      {/* ── LEFT ── */}
      <div className="hud-topbar__left">
        <span className="hud-topbar__logo">⬡ XWAR</span>
        <span className="hud-topbar__beta">BETA</span>
        <div style={{ display:'flex', alignItems:'center', gap:'4px', marginLeft:'12px', background:'rgba(34,211,138,0.1)', padding:'2px 6px', borderRadius:'4px', border:'1px solid rgba(34,211,138,0.2)' }}>
          <span style={{ fontSize:'10px' }}>⏱️</span>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'10px', fontWeight:700, color:'#22d38a' }}>{formatTime(timeLeft)}</span>
          <button onClick={onManualTick} style={{ background:'#22d38a', color:'#000', border:'none', borderRadius:'2px', fontSize:'8px', fontWeight:'bold', padding:'2px 4px', cursor:'pointer', marginLeft:'4px' }}>+30m</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'4px', background:'rgba(168,85,247,0.1)', padding:'2px 6px', borderRadius:'4px', border:'1px solid rgba(168,85,247,0.2)' }}>
          <span style={{ fontSize:'10px' }}>📅</span>
          <span style={{ fontFamily:'var(--font-display)', fontSize:'10px', fontWeight:700, color:'#a855f7' }}>{formatDailyTime(dailyLeft)}</span>
        </div>
      </div>

      {/* ── CENTER ── */}
      <div className="hud-topbar__center" style={{ display:'flex', alignItems:'center', gap:'24px' }}>
        <div style={{ display:'flex', gap:'8px' }}>
          <button className="hud-tab hud-tab--active">THE MAP</button>
          <button className="hud-tab">LEADERBOARD</button>
        </div>
        <div style={{ display:'flex', gap:'16px', alignItems:'center', paddingLeft:'16px', borderLeft:'1px solid rgba(255,255,255,0.1)' }}>
          {[
            { icon:'🍖', val:player.hunger,           max:player.maxHunger,           color:'#f59e0b', panel:'profile', title:'Hunger' },
            { icon:'⚡', val:player.stamina,           max:player.maxStamina,           color:'#ef4444', panel:'combat',  title:'Stamina' },
            { icon:'💼', val:player.entrepreneurship,  max:player.maxEntrepreneurship,  color:'#a855f7', panel:'profile', tab:'companies', title:'Enterprise' },
            { icon:'🔨', val:player.work,              max:player.maxWork,              color:'#3b82f6', panel:'profile', title:'Work' },
          ].map(({ icon, val, max, color, panel, tab, title }) => (
            <div key={title} className="hud-topbar__stat" onClick={() => navigateTo(panel, tab)} title={`${title} — Click to open`}>
              <span style={{ fontSize:'12px' }}>{icon}</span>
              <div style={{ width:'48px', height:'4px', background:'rgba(255,255,255,0.1)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ width:`${(val/max)*100}%`, height:'100%', background:color, transition:'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize:'9px', fontFamily:'var(--font-display)', color:'#94a3b8', width:'38px' }}>{Math.floor(val)}/{max}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="hud-topbar__right">

        {/* Wealth strip */}
        <div style={{ display:'flex', gap:'12px', alignItems:'center', marginRight:'12px' }}>
          {([
            { key:'scrap'     as const, val:player.scrap,     color:'#94a3b8' },
            { key:'materialX' as const, val:player.materialX, color:'#a855f7' },
            { key:'oil'       as const, val:player.oil,       color:'#3b82f6' },
          ] as const).map(({ key, val, color }) => (
            <span key={key} style={{ color, fontFamily:'var(--font-display)', fontWeight:600, fontSize:'12px', display:'flex', alignItems:'center', gap:'3px', whiteSpace:'nowrap' }}>
              <ResourceIcon resourceKey={key} size={13} /> {Math.floor(val).toLocaleString()}
            </span>
          ))}
          <div style={{ width:'1px', height:'14px', background:'rgba(255,255,255,0.1)' }} />
          <span style={{ color:'#22d38a', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'12px', whiteSpace:'nowrap' }}>${player.money.toLocaleString()}</span>
          <span style={{ color:'#f59e0b', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'12px', whiteSpace:'nowrap' }}>₿ {player.bitcoin.toLocaleString()}</span>
        </div>

        {/* Logout */}
        <button className="hud-btn-outline" onClick={() => useAuthStore.getState().logout()}>
          <span className="hud-btn-icon">⚡</span> LOGOUT
        </button>

        {/* ══════════════════════════════════════
            IDENTITY CARD (premium redesign)
            ══════════════════════════════════════ */}
        <div className="hud-id-card" onClick={() => navigateTo('profile')} title="View Profile">

          {/* FLAG STRIPE — left column, fully visible flag */}
          <div className="hud-id-card__flag">
            {flagUrl
              ? <img src={flagUrl} alt={player.countryCode ?? ''} className="hud-id-card__flag-img" />
              : <div className="hud-id-card__flag-placeholder" />
            }
            <span className="hud-id-card__cc">{player.countryCode ?? '??'}</span>
          </div>

          {/* INFO — center column */}
          <div className="hud-id-card__info">
            <div className="hud-id-card__name">{player.name}</div>
            <div className="hud-id-card__meta">
              <span className="hud-id-card__badge">LVL {player.level ?? 1}</span>
              <span className="hud-id-card__sep">·</span>
              <span className="hud-id-card__turn">T-{world.turn}</span>
            </div>
            <div className="hud-id-card__xpbar">
              <div className="hud-id-card__xpbar-fill" style={{ width:`${xpPct}%` }} />
            </div>
          </div>

          {/* AVATAR — right column with flag-tinted ring */}
          <div className="hud-id-card__avatar">
            {flagUrl && <img src={flagUrl} alt="" aria-hidden="true" className="hud-id-card__avatar-flag" />}
            <img
              src={player.avatar || '/assets/ui/avatar-default.png'}
              alt="Commander"
              className="hud-id-card__avatar-img"
            />
          </div>

        </div>
      </div>
    </header>
  )
}
