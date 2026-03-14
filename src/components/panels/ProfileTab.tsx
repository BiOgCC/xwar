import { usePlayerStore } from '../../stores/playerStore'

export default function ProfileTab() {
  const player = usePlayerStore()
  const xpPercent = (player.experience / player.experienceToNext) * 100
  const totalSpec = player.specialization.military + player.specialization.economic
  const milPercent = totalSpec > 0 ? (player.specialization.military / totalSpec) * 100 : 50

  return (
    <div className="ptab">
      {/* Level & XP */}
      <div className="ptab-section">
        <div className="ptab-level">
          <div className="ptab-level__badge">
            <span className="ptab-level__number">{player.level}</span>
            <span className="ptab-level__label">LVL</span>
          </div>
          <div className="ptab-level__info">
            <div className="ptab-level__name">{player.name}</div>
            <div className="ptab-xp">
              <div className="ptab-xp__track">
                <div className="ptab-xp__fill" style={{ width: `${xpPercent}%` }} />
              </div>
              <span className="ptab-xp__text">{player.experience} / {player.experienceToNext} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Skill Points */}
      <div className="ptab-section">
        <div className="ptab-row">
          <span className="ptab-row__label">⭐ Skill Points</span>
          <span className="ptab-row__value ptab-row__value--accent">{player.skillPoints}</span>
        </div>
      </div>

      {/* Specialization */}
      <div className="ptab-section">
        <div className="ptab-section__title">SPECIALIZATION</div>
        <div className="ptab-spec">
          <div className="ptab-spec__labels">
            <span className="ptab-spec__mil">⚔️ Military</span>
            <span className="ptab-spec__eco">💼 Economic</span>
          </div>
          <div className="ptab-spec__track">
            <div className="ptab-spec__fill-mil" style={{ width: `${milPercent}%` }} />
            <div className="ptab-spec__fill-eco" style={{ width: `${100 - milPercent}%` }} />
          </div>
          <div className="ptab-spec__labels">
            <span className="ptab-spec__pct">{Math.round(milPercent)}%</span>
            <span className="ptab-spec__pct">{Math.round(100 - milPercent)}%</span>
          </div>
        </div>
      </div>

      {/* Currencies */}
      <div className="ptab-section">
        <div className="ptab-section__title">CURRENCIES</div>
        <div className="ptab-stats-grid">
          <div className="ptab-stat">
            <span className="ptab-stat__icon">💰</span>
            <span className="ptab-stat__label">Money</span>
            <span className="ptab-stat__value">${player.money.toLocaleString()}</span>
          </div>
          <div className="ptab-stat">
            <span className="ptab-stat__icon">🔩</span>
            <span className="ptab-stat__label">Scrap</span>
            <span className="ptab-stat__value">{player.scrap.toLocaleString()}</span>
          </div>
          <div className="ptab-stat">
            <span className="ptab-stat__icon">₿</span>
            <span className="ptab-stat__label">Bitcoin</span>
            <span className="ptab-stat__value">{player.bitcoin}</span>
          </div>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="ptab-section">
        <div className="ptab-section__title">LIFETIME STATS</div>
        <div className="ptab-stats-grid">
          <div className="ptab-stat">
            <span className="ptab-stat__icon">💥</span>
            <span className="ptab-stat__label">Damage Done</span>
            <span className="ptab-stat__value">{player.damageDone.toLocaleString()}</span>
          </div>
          <div className="ptab-stat">
            <span className="ptab-stat__icon">🏭</span>
            <span className="ptab-stat__label">Items Produced</span>
            <span className="ptab-stat__value">{player.itemsProduced}</span>
          </div>
          <div className="ptab-stat">
            <span className="ptab-stat__icon">⭐</span>
            <span className="ptab-stat__label">Rank</span>
            <span className="ptab-stat__value">{Math.floor(player.rank)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
