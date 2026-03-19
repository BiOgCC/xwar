import { usePlayerStore } from '../../../stores/playerStore'
import ResourceIcon from '../../shared/ResourceIcon'

/** Food consumption + Currencies + Lifetime stats */
export default function ProfileResources() {
  const player = usePlayerStore()

  return (
    <>
      {/* CONSUME FOOD */}
      <div className="ptab-section">
        <div className="ptab-section__title">🍽️ CONSUME FOOD</div>
        <div className="ptab-food-grid">
          {[
            { key: 'bread', emoji: <img src="/assets/food/bread.png" alt="Bread" style={{ width: '16px', height: '16px' }} />, label: 'Bread',  count: player.bread,  gain: '+10 STA', type: 'bread'  as const },
            { key: 'sushi', emoji: <img src="/assets/food/sushi.png" alt="Sushi" style={{ width: '16px', height: '16px' }} />, label: 'Sushi',  count: player.sushi,  gain: '+20 STA', type: 'sushi'  as const },
            { key: 'wagyu', emoji: <img src="/assets/food/wagyu.png" alt="Wagyu" style={{ width: '16px', height: '16px' }} />, label: 'Wagyu',  count: player.wagyu,  gain: '+30 STA', type: 'wagyu'  as const },
          ].map(f => (
            <button
              key={f.key}
              className="ptab-food-btn"
              disabled={f.count <= 0}
              onClick={() => player.consumeFood(f.type)}
            >
              <span className="ptab-food-btn__emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.emoji}</span>
              <span className="ptab-food-btn__label">{f.label}</span>
              <span className="ptab-food-btn__count">×{f.count}</span>
              <span className="ptab-food-btn__gain">{f.gain}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CURRENCIES */}
      <div className="ptab-section">
        <div className="ptab-section__title">💰 CURRENCIES & RESOURCES</div>
        <div className="ptab-currency-grid">
          {[
            { icon: '💰', label: 'Cash',      val: `$${player.money.toLocaleString()}`,          color: '#22d38a' },
            { icon: '₿',  label: 'Bitcoin',   val: `${player.bitcoin}`,                           color: '#f59e0b', img: true },
            { icon: '🔩', label: 'Scrap',      val: player.scrap.toLocaleString(),                color: '#94a3b8', img: true },
            { icon: '🛢️', label: 'Oil',        val: (player.oil ?? 0).toLocaleString(),           color: '#6366f1', img: true },
            { icon: '⚛️', label: 'Material X', val: (player.materialX ?? 0).toLocaleString(),    color: '#a855f7', img: true },
          ].map(c => (
            <div key={c.label} className="ptab-currency-card">
              <span className="ptab-currency-card__icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'img' in c && c.img ? <ResourceIcon resourceKey={c.label === 'Bitcoin' ? 'bitcoin' : c.label === 'Scrap' ? 'scrap' : c.label === 'Oil' ? 'oil' : 'materialX'} size={20} /> : c.icon}</span>
              <span className="ptab-currency-card__label">{c.label}</span>
              <span className="ptab-currency-card__val" style={{ color: c.color }}>{c.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* LIFETIME STATS */}
      <div className="ptab-section">
        <div className="ptab-section__title">📊 LIFETIME STATS</div>
        <div className="ptab-lifetime-grid">
          {[
            { icon: '💥', label: 'Damage Done',    val: player.damageDone.toLocaleString(),   color: '#f87171' },
            { icon: '🏭', label: 'Items Produced',  val: player.itemsProduced.toString(),      color: '#38bdf8' },
            { icon: '⭐', label: 'Rank',             val: Math.floor(player.rank).toString(),  color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} className="ptab-lifetime-card">
              <span className="ptab-lifetime-card__icon">{s.icon}</span>
              <span className="ptab-lifetime-card__val" style={{ color: s.color }}>{s.val}</span>
              <span className="ptab-lifetime-card__label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
