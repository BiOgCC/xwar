import { usePlayerStore } from '../../stores/playerStore'

/**
 * Compact food grid — lets players eat food to restore stamina
 * and drink Magic Tea for combat buffs.
 */
export default function FoodGrid() {
  const player = usePlayerStore()
  const now = Date.now()

  const foods: { key: 'bread' | 'sushi' | 'wagyu'; icon: React.ReactNode; label: string; pct: number; count: number }[] = [
    { key: 'bread', icon: <img src="/assets/food/bread.png" alt="Bread" style={{ width: '16px', height: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, label: 'Bread', pct: 15, count: player.bread },
    { key: 'sushi', icon: <img src="/assets/food/sushi.png" alt="Sushi" style={{ width: '16px', height: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, label: 'Sushi', pct: 30, count: player.sushi },
    { key: 'wagyu', icon: <img src="/assets/food/wagyu.png" alt="Wagyu" style={{ width: '16px', height: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, label: 'Wagyu', pct: 45, count: player.wagyu },
  ]

  // Magic Tea state
  const teaBuffActive = now < player.magicTeaBuffUntil
  const teaDebuffActive = !teaBuffActive && now < player.magicTeaDebuffUntil
  const teaOnCooldown = teaBuffActive || teaDebuffActive
  const teaCount = player.magicTea

  // Time remaining helper
  const formatTimeLeft = (until: number) => {
    const ms = until - now
    if (ms <= 0) return '0m'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  let teaStatusText = ''
  let teaStatusColor = '#64748b'
  if (teaBuffActive) {
    teaStatusText = `🍵 BUFF ${formatTimeLeft(player.magicTeaBuffUntil)}`
    teaStatusColor = '#f59e0b'
  } else if (teaDebuffActive) {
    teaStatusText = `💤 HANGOVER ${formatTimeLeft(player.magicTeaDebuffUntil)}`
    teaStatusColor = '#ef4444'
  }

  return (
    <div className="hud-card" style={{ borderColor: 'rgba(34,211,138,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div className="hud-card__title" style={{ margin: 0 }}>🍽️ EAT FOOD</div>
        <span style={{ fontSize: '9px', color: '#64748b' }}>
          Stamina: <strong style={{ color: '#22d38a' }}>{player.stamina}</strong>/{player.maxStamina}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {foods.map(f => (
          <button
            key={f.key}
            onClick={() => player.consumeFood(f.key)}
            disabled={f.count <= 0 || Math.floor(player.hunger) <= 0}
            style={{
              flex: 1, padding: '6px 4px', fontSize: '10px', fontWeight: 700,
              background: f.count > 0 ? 'rgba(34,211,138,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${f.count > 0 ? 'rgba(34,211,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
              color: f.count > 0 ? '#e2e8f0' : '#475569',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{f.icon} {f.label}</span>
            <span style={{ fontSize: '8px', color: f.count > 0 ? '#22d38a' : '#475569' }}>+{f.pct}% STA ({f.count})</span>
          </button>
        ))}
      </div>

      {/* Magic Tea section */}
      <div style={{ marginTop: '6px', padding: '4px', background: 'rgba(245,158,11,0.04)', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b' }}>🍵 MAGIC TEA</span>
          {teaStatusText && (
            <span style={{ fontSize: '8px', fontWeight: 700, color: teaStatusColor }}>{teaStatusText}</span>
          )}
        </div>
        <button
          onClick={() => player.consumeMagicTea()}
          disabled={teaCount <= 0 || teaOnCooldown}
          title={teaOnCooldown ? 'Wait for current effect to expire' : '+80% DMG, +10% Crit for 12h → then -90% DMG for 12h'}
          style={{
            width: '100%', padding: '5px 8px', fontSize: '9px', fontWeight: 700,
            background: teaCount > 0 && !teaOnCooldown ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${teaCount > 0 && !teaOnCooldown ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '4px',
            cursor: teaCount > 0 && !teaOnCooldown ? 'pointer' : 'not-allowed',
            color: teaCount > 0 && !teaOnCooldown ? '#fbbf24' : '#475569',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px',
          }}
        >
          <span>🍵 DRINK TEA</span>
          <span style={{ fontSize: '7px', opacity: 0.7 }}>+80% DMG +10% CRIT 12h → -90% DMG 12h ({teaCount})</span>
        </button>
      </div>
    </div>
  )
}
