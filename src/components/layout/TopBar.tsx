import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'

interface TopBarProps {
  timeLeft: number
  onManualTick: () => void
}

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function TopBar({ timeLeft, onManualTick }: TopBarProps) {
  const player = usePlayerStore()
  const world = useWorldStore()

  return (
    <header className="hud-topbar">
      <div className="hud-topbar__left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="hud-topbar__logo">⬡ XWAR</span>
        <span className="hud-topbar__beta">BETA</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px', background: 'rgba(34,211,138,0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(34,211,138,0.2)' }}>
          <span style={{ fontSize: '10px' }}>⏱️</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', fontWeight: 700, color: '#22d38a' }}>{formatTime(timeLeft)}</span>
          <button onClick={onManualTick} style={{ background: '#22d38a', color: '#000', border: 'none', borderRadius: '2px', fontSize: '8px', fontWeight: 'bold', padding: '2px 4px', cursor: 'pointer', marginLeft: '4px' }}>+30m</button>
        </div>
      </div>
      <div className="hud-topbar__center" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="hud-tab hud-tab--active">THE MAP</button>
          <button className="hud-tab">LEADERBOARD</button>
        </div>

        {/* Player Status Bars Phase */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', paddingLeft: '16px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Energy">
            <span style={{ fontSize: '12px' }}>🍖</span>
            <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${(player.hunger/player.maxHunger)*100}%`, height: '100%', background: '#f59e0b', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.hunger)}/{player.maxHunger}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Stamina">
            <span style={{ fontSize: '12px' }}>⚡</span>
            <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${(player.stamina/player.maxStamina)*100}%`, height: '100%', background: '#ef4444', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.stamina)}/{player.maxStamina}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Pleasure">
            <span style={{ fontSize: '12px' }}>💼</span>
            <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${(player.entrepreneurship/player.maxEntrepreneurship)*100}%`, height: '100%', background: '#a855f7', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.entrepreneurship)}/{player.maxEntrepreneurship}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Work">
            <span style={{ fontSize: '12px' }}>🔨</span>
            <div style={{ width: '48px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${(player.work/player.maxWork)*100}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: '#94a3b8', width: '38px' }}>{Math.floor(player.work)}/{player.maxWork}</span>
          </div>
        </div>
      </div>
      <div className="hud-topbar__right">
        <div className="hud-wealth-display" style={{ display: 'flex', gap: '16px', marginRight: '16px', alignItems: 'center' }}>
          <span style={{ color: '#22d38a', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
            ${player.money.toLocaleString()}
          </span>
          <span style={{ color: '#f59e0b', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px' }}>
            ₿ {player.bitcoin.toLocaleString()}
          </span>
        </div>
        <button className="hud-btn-outline">
          <span className="hud-btn-icon">⚡</span> SIGN IN
        </button>
        <span className="hud-topbar__time">TURN {world.turn} • {player.name}</span>
      </div>
    </header>
  )
}
