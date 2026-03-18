import { usePlayerStore } from '../../stores/playerStore'

/**
 * Compact food grid — lets players eat food to restore stamina
 * without leaving the current panel.
 */
export default function FoodGrid() {
  const player = usePlayerStore()

  const foods: { key: 'bread' | 'sushi' | 'wagyu'; icon: React.ReactNode; label: string; stam: number; count: number }[] = [
    { key: 'bread', icon: <img src="/assets/food/bread.png" alt="Bread" style={{ width: '16px', height: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, label: 'Bread', stam: 10, count: player.bread },
    { key: 'sushi', icon: <img src="/assets/food/sushi.png" alt="Sushi" style={{ width: '16px', height: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, label: 'Sushi', stam: 20, count: player.sushi },
    { key: 'wagyu', icon: <img src="/assets/food/wagyu.png" alt="Wagyu" style={{ width: '16px', height: '16px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, label: 'Wagyu', stam: 30, count: player.wagyu },
  ]

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
            disabled={f.count <= 0}
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
            <span style={{ fontSize: '8px', color: f.count > 0 ? '#22d38a' : '#475569' }}>+{f.stam} STA ({f.count})</span>
          </button>
        ))}
      </div>
    </div>
  )
}
