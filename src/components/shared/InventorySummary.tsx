import { usePlayerStore } from '../../stores/playerStore'

/** Compact format: 5000000 → 5M, 500000 → 500K, 1234 → 1.2K */
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
  if (n >= 10_000)    return Math.round(n / 1_000) + 'K'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

export default function InventorySummary() {
  const player = usePlayerStore()

  return (
    <div className="comp-inventory-summary" style={{ marginBottom: '16px' }}>
      <div className="comp-inv-row">
        <div className="comp-inv-item"><span title="Money">💰</span>{fmt(player.money)}</div>
        <div className="comp-inv-item"><span title="Bitcoin" style={{color: '#f59e0b'}}>₿</span>{fmt(player.bitcoin)}</div>
        <div className="comp-inv-item"><span title="Scrap" style={{color: '#94a3b8'}}>🔩</span>{fmt(player.scrap ?? 0)}</div>
        <div className="comp-inv-item"><span title="Oil" style={{color: '#6366f1'}}>🛢️</span>{fmt(player.oil ?? 0)}</div>
        <div className="comp-inv-item"><span title="Material X" style={{color: '#a855f7'}}>⚛️</span>{fmt(player.materialX ?? 0)}</div>
      </div>
      <div className="comp-inv-row">
        <div className="comp-inv-item"><span title="Wheat">🌾</span>{fmt(player.wheat ?? 0)}</div>
        <div className="comp-inv-item"><span title="Fish">🐟</span>{fmt(player.fish ?? 0)}</div>
        <div className="comp-inv-item"><span title="Steak">🥩</span>{fmt(player.steak ?? 0)}</div>
        <div className="comp-inv-item"><span title="Bread">🍞</span>{fmt(player.bread ?? 0)}</div>
        <div className="comp-inv-item"><span title="Sushi">🍣</span>{fmt(player.sushi ?? 0)}</div>
        <div className="comp-inv-item"><span title="Wagyu">🍱</span>{fmt(player.wagyu ?? 0)}</div>
      </div>
      <div className="comp-inv-row">
        <div className="comp-inv-item"><span title="Green Bullets" style={{color: '#22d38a'}}>🟢</span>{fmt(player.greenBullets ?? 0)}</div>
        <div className="comp-inv-item"><span title="Blue Bullets" style={{color: '#3b82f6'}}>🔵</span>{fmt(player.blueBullets ?? 0)}</div>
        <div className="comp-inv-item"><span title="Purple Bullets" style={{color: '#a855f7'}}>🟣</span>{fmt(player.purpleBullets ?? 0)}</div>
        <div className="comp-inv-item"><span title="Red Bullets" style={{color: '#ef4444'}}>🔴</span>{fmt(player.redBullets ?? 0)}</div>
      </div>
    </div>
  )
}
