import { usePlayerStore } from '../../stores/playerStore'

export default function InventorySummary() {
  const player = usePlayerStore()

  return (
    <div className="comp-inventory-summary" style={{ marginBottom: '16px' }}>
      <div className="comp-inv-row">
        {/* Currencies & Materials */}
        <div className="comp-inv-item"><span title="Money">💰</span>{player.money.toLocaleString()}</div>
        <div className="comp-inv-item"><span title="Bitcoin" style={{color: '#f59e0b'}}>₿</span>{player.bitcoin}</div>
        <div className="comp-inv-item"><span title="Scrap" style={{color: '#94a3b8'}}>🔩</span>{player.scrap?.toLocaleString() ?? 0}</div>
        <div className="comp-inv-item"><span title="Oil" style={{color: '#f59e0b'}}>🛢️</span>{player.oil?.toLocaleString() ?? 0}</div>
        <div className="comp-inv-item"><span title="Material X" style={{color: '#a855f7'}}>⚛️</span>{player.materialX?.toLocaleString() ?? 0}</div>
      </div>
      <div className="comp-inv-row">
        {/* Raw Food */}
        <div className="comp-inv-item"><span title="Wheat">🌾</span>{player.wheat ?? 0}</div>
        <div className="comp-inv-item"><span title="Fish">🐟</span>{player.fish ?? 0}</div>
        <div className="comp-inv-item"><span title="Steak">🥩</span>{player.steak ?? 0}</div>
        <div className="comp-inv-divider" />
        {/* Prepared Food */}
        <div className="comp-inv-item"><span title="Bread">🍞</span>{player.bread ?? 0}</div>
        <div className="comp-inv-item"><span title="Sushi">🍣</span>{player.sushi ?? 0}</div>
        <div className="comp-inv-item"><span title="Wagyu">🍱</span>{player.wagyu ?? 0}</div>
      </div>
      <div className="comp-inv-row">
        {/* Bullets */}
        <div className="comp-inv-item"><span title="Green Bullets" style={{color: '#22d38a'}}>🟢</span>{player.greenBullets ?? 0}</div>
        <div className="comp-inv-item"><span title="Blue Bullets" style={{color: '#3b82f6'}}>🔵</span>{player.blueBullets ?? 0}</div>
        <div className="comp-inv-item"><span title="Purple Bullets" style={{color: '#a855f7'}}>🟣</span>{player.purpleBullets ?? 0}</div>
        <div className="comp-inv-item"><span title="Red Bullets" style={{color: '#ef4444'}}>🔴</span>{player.redBullets ?? 0}</div>
      </div>
    </div>
  )
}
