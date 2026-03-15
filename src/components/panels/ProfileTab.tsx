import { usePlayerStore } from '../../stores/playerStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useSkillsStore } from '../../stores/skillsStore'

export default function ProfileTab() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const skillsStore = useSkillsStore()
  
  const xpPercent = (player.experience / player.experienceToNext) * 100
  const totalSpec = player.specialization.military + player.specialization.economic
  const milPercent = totalSpec > 0 ? (player.specialization.military / totalSpec) * 100 : 50

  // Calculate Equipment Stats
  const equipped = inventory.getEquipped()
  let eqDmg = 0, eqCritRate = 0, eqCritDmg = 0, eqArmor = 0, eqDodge = 0, eqPrecision = 0
  equipped.forEach((item: any) => {
    if (item.stats.damage) eqDmg += item.stats.damage
    if (item.stats.critRate) eqCritRate += item.stats.critRate
    if (item.stats.critDamage) eqCritDmg += item.stats.critDamage
    if (item.stats.armor) eqArmor += item.stats.armor
    if (item.stats.dodge) eqDodge += item.stats.dodge
    if (item.stats.precision) eqPrecision += item.stats.precision
  })

  // Military Skills
  const mil = skillsStore.military
  const skDmg = mil.attack * 20
  const skCritRate = mil.critRate * 5
  const skCritDmg = mil.critDamage * 20
  const skArmor = mil.armor * 5
  const skDodge = mil.dodge * 5
  const skPrecision = mil.precision * 5

  // Final Military Stats
  const finalDmg = 100 + eqDmg + skDmg
  const finalCritRate = 10 + eqCritRate + skCritRate
  const finalCritDmg = 100 + eqCritDmg + skCritDmg
  const finalArmor = 0 + eqArmor + skArmor
  const finalDodge = 5 + eqDodge + skDodge
  const finalHitRate = Math.min(100, 50 + eqPrecision + skPrecision)
  const hungerCost = 4
  const lootChance = 7

  // Economic Skills
  const eco = skillsStore.economic
  const finalProd = 10 + (eco.production * 5)
  const finalWork = 100 + (eco.work * 20)
  const finalEnt = 100 + (eco.entrepreneurship * 15)
  const finalProspect = 10 + (eco.prospection * 5)
  const finalInd = 10 + (eco.industrialist * 5)

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

      {/* Detailed Stats Breakdown */}
      <div className="ptab-section" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          {/* Military Stats */}
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>MILITARY PARAMETERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>⚔️ Attack Damage</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalDmg}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🎯 Critical Rate</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalCritRate}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💥 Critical Amplifier</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalCritDmg}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🛡️ Armor Mitigation</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalArmor}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💨 Evasion Dodge</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{finalDodge}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💢 Hit Rate</span><span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{finalHitRate}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🍖 Attack Hunger Cost</span><span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{hungerCost}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', paddingTop: '2px', borderTop: '1px dotted rgba(255,255,255,0.1)' }}><span>📦 Loot Chance / Hit</span><span style={{ color: '#22d38a', fontWeight: 'bold' }}>{lootChance}% (Accum)</span></div>
            </div>
          </div>

          {/* Economic Stats */}
          <div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>ECONOMIC PARAMETERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>⚙️ Production Power</span><span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{finalProd} pts</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🔨 Work Capacity</span><span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{finalWork} pts</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>💼 Enterprise Capacity</span><span style={{ color: '#a855f7', fontWeight: 'bold' }}>{finalEnt} pts</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>⛏️ Prospect Chance</span><span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{finalProspect}%</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>₿ Industrialist Chance</span><span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{finalInd}%</span></div>
            </div>
          </div>

        </div>
      </div>

      {/* Equipped Gear */}
      <div className="ptab-section">
        <div className="ptab-section__title">EQUIPPED GEAR</div>
        <div className="ptab-stats-grid">
           {equipped.map((item: any) => (
             <div key={item.id} className="ptab-stat" style={{ alignItems: 'flex-start', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '2px' }}>
                  <span style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '1px' }}>{item.slot.toUpperCase()}</span>
                  <span style={{ fontSize: '9px', color: (item.durability || 100) < 50 ? '#ef4444' : '#22d38a' }}>{(item.durability || 100).toFixed(0)}%</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: item.tier === 't6' ? '#ef4444' : item.tier === 't5' ? '#f59e0b' : item.tier === 't4' ? '#a855f7' : item.tier === 't3' ? '#3b82f6' : item.tier === 't2' ? '#22c55e' : '#cbd5e1' }}>{item.name}</span>
             </div>
           ))}
        </div>
      </div>

      {/* Consume Food */}
      <div className="ptab-section">
        <div className="ptab-section__title">CONSUME FOOD (RECOVER STAMINA / -1 HUNGER)</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => player.consumeFood('bread')} disabled={player.bread <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '11px' }}>
            🍞 Bread ({player.bread})<br/><span style={{ fontSize: '9px', color: '#22c55e' }}>+10 STAMINA</span>
          </button>
          <button onClick={() => player.consumeFood('sushi')} disabled={player.sushi <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '11px' }}>
            🍣 Sushi ({player.sushi})<br/><span style={{ fontSize: '9px', color: '#22c55e' }}>+20 STAMINA</span>
          </button>
          <button onClick={() => player.consumeFood('wagyu')} disabled={player.wagyu <= 0} className="hud-btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '11px' }}>
            🥩 Wagyu ({player.wagyu})<br/><span style={{ fontSize: '9px', color: '#22c55e' }}>+30 STAMINA</span>
          </button>
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
