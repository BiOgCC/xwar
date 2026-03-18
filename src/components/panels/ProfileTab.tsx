import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useInventoryStore, getItemImagePath, TIER_COLORS, TIER_LABELS, TIER_ORDER, SLOT_ICONS, type EquipSlot } from '../../stores/inventoryStore'
import { useSkillsStore } from '../../stores/skillsStore'
import { useArmyStore } from '../../stores/armyStore'
import { useUIStore } from '../../stores/uiStore'

export default function ProfileTab() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const skillsStore = useSkillsStore()
  const ui = useUIStore()
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null)

  // ESC closes any open modal
  useEffect(() => {
    const onClose = () => { setPickerSlot(null) }
    window.addEventListener('xwar-close-modal', onClose)
    return () => window.removeEventListener('xwar-close-modal', onClose)
  }, [])

  const xpPercent = Math.min(100, (player.experience / player.experienceToNext) * 100)
  const totalSpec = player.specialization.military + player.specialization.economic
  const milPercent = totalSpec > 0 ? (player.specialization.military / totalSpec) * 100 : 50

  // Equipment Stats
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
  const finalDmg      = 100 + eqDmg      + mil.attack * 20
  const finalCritRate = 10  + eqCritRate  + mil.critRate * 5
  const finalCritDmg  = 100 + eqCritDmg  + mil.critDamage * 20
  const finalArmor    = 0   + eqArmor    + mil.armor * 5
  const finalDodge    = 5   + eqDodge    + mil.dodge * 5
  const finalHitRate  = Math.min(100, 50 + eqPrecision + mil.precision * 5)

  // Economic Skills
  const eco = skillsStore.economic
  const finalProd     = 10  + eco.production * 5
  const finalWork     = 100 + eco.work * 20
  const finalEnt      = 100 + eco.entrepreneurship * 15
  const finalProspect = eco.prospection * 5
  const finalInd      = eco.industrialist * 5

  const { used: popUsed, max: popMax } = useArmyStore.getState().getPlayerPopCap()
  const popPct = popMax > 0 ? Math.round((popUsed / popMax) * 100) : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 70 ? '#f59e0b' : '#22d38a'

  return (
    <div className="ptab">

      {/* ── HERO CARD ─────────────────────────────── */}
      <div className="ptab-hero">
        {/* Level badge */}
        <div className="ptab-hero__badge">
          <span className="ptab-hero__lvl-num">{player.level}</span>
          <span className="ptab-hero__lvl-lbl">LVL</span>
        </div>

        {/* Name + XP + Pop */}
        <div className="ptab-hero__info">
          <div className="ptab-hero__name">{player.name}</div>

          <div className="ptab-hero__pop" style={{ color: popColor }}>
            <span>👥</span>
            <span>Pop {popUsed}/{popMax}</span>
            <span className="ptab-hero__pop-pct">{popPct}%</span>
          </div>

          <div className="ptab-hero__xp-wrap">
            <div className="ptab-hero__xp-track">
              <div className="ptab-hero__xp-fill" style={{ width: `${xpPercent}%` }} />
            </div>
            <span className="ptab-hero__xp-text">{player.experience.toLocaleString()} / {player.experienceToNext.toLocaleString()} XP</span>
          </div>
        </div>

        {/* SP badge */}
        <div className="ptab-hero__sp">
          <span className="ptab-hero__sp-num">{player.skillPoints}</span>
          <span className="ptab-hero__sp-lbl">SP</span>
        </div>
      </div>

      {/* ── SPECIALIZATION BAR ────────────────────── */}
      <div className="ptab-spec-card">
        <div className="ptab-spec-card__labels">
          <span style={{ color: '#f87171' }}>⚔️ Military {Math.round(milPercent)}%</span>
          <span style={{ color: '#94a3b8', fontSize: '8px' }}>SPECIALIZATION</span>
          <span style={{ color: '#38bdf8' }}>💼 Economic {Math.round(100 - milPercent)}%</span>
        </div>
        <div className="ptab-spec-card__track">
          <div className="ptab-spec-card__mil" style={{ width: `${milPercent}%` }} />
          <div className="ptab-spec-card__eco" style={{ width: `${100 - milPercent}%` }} />
        </div>
      </div>

      {/* ── STATS GRID ────────────────────────────── */}
      <div className="ptab-stats-duo">

        {/* MILITARY */}
        <div className="ptab-stat-panel ptab-stat-panel--mil">
          <div className="ptab-stat-panel__hdr">
            <span className="ptab-stat-panel__icon">⚔️</span>
            <span>MILITARY</span>
          </div>
          {[
            { label: 'Attack Damage',      val: `${finalDmg}`,      color: '#f87171' },
            { label: 'Crit Rate',          val: `${finalCritRate}%`, color: '#fb923c' },
            { label: 'Crit Amplifier',     val: `${finalCritDmg}%`, color: '#fb923c' },
            { label: 'Armor Mitigation',   val: `${finalArmor}%`,   color: '#94a3b8' },
            { label: 'Evasion Dodge',      val: `${finalDodge}%`,   color: '#34d399' },
            { label: 'Hit Rate',           val: `${finalHitRate}%`, color: '#fbbf24' },
            { label: 'Stamina Cap',        val: `${player.maxStamina}`, color: '#f87171' },
            { label: 'Hunger Cap',         val: `${player.maxHunger}`,  color: '#f59e0b' },
            { label: 'Loot / Hit',         val: '7% (Acc)',         color: '#22d38a' },
          ].map(r => (
            <div key={r.label} className="ptab-stat-row">
              <span className="ptab-stat-row__label">{r.label}</span>
              <span className="ptab-stat-row__val" style={{ color: r.color }}>{r.val}</span>
            </div>
          ))}
        </div>

        {/* ECONOMIC */}
        <div className="ptab-stat-panel ptab-stat-panel--eco">
          <div className="ptab-stat-panel__hdr">
            <span className="ptab-stat-panel__icon">💼</span>
            <span>ECONOMIC</span>
          </div>
          {[
            { label: 'Production PP',   val: `${finalProd} pts`, color: '#38bdf8' },
            { label: 'Work Capacity',   val: `${finalWork} pts`, color: '#38bdf8' },
            { label: 'Enterprise Cap',  val: `${finalEnt} pts`,  color: '#c084fc' },
            { label: 'Prospect Chance', val: `${finalProspect}%`,color: '#38bdf8' },
            { label: 'Industrialist',   val: `${finalInd}%`,     color: '#fbbf24' },
          ].map(r => (
            <div key={r.label} className="ptab-stat-row">
              <span className="ptab-stat-row__label">{r.label}</span>
              <span className="ptab-stat-row__val" style={{ color: r.color }}>{r.val}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── EQUIPPED GEAR ─────────────────────────── */}
      {equipped.length > 0 && (
        <div className="ptab-section">
          <div className="ptab-section__title">EQUIPPED GEAR</div>
          <div className="ptab-gear-grid">
            {equipped.map((item: any) => {
              const tierColor = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
              const tierLabel = TIER_LABELS[item.tier as keyof typeof TIER_LABELS] || item.tier.toUpperCase()
              const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
              const dur = item.durability ?? 100
              const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'

              // Build stat entries from item.stats
              const statEntries: { label: string; val: string; color: string }[] = []
              if (item.stats.damage)    statEntries.push({ label: 'DMG', val: `${item.stats.damage}`, color: '#f87171' })
              if (item.stats.critRate)  statEntries.push({ label: 'CRIT', val: `${item.stats.critRate}%`, color: '#fb923c' })
              if (item.stats.critDamage)statEntries.push({ label: 'C.DMG', val: `${item.stats.critDamage}%`, color: '#fb923c' })
              if (item.stats.armor)     statEntries.push({ label: 'ARM', val: `${item.stats.armor}%`, color: '#94a3b8' })
              if (item.stats.dodge)     statEntries.push({ label: 'EVA', val: `${item.stats.dodge}%`, color: '#34d399' })
              if (item.stats.precision) statEntries.push({ label: 'ACC', val: `${item.stats.precision}%`, color: '#38bdf8' })

              return (
                <div
                  key={item.id}
                  className="ptab-gear-card"
                  style={{ borderColor: `${tierColor}30`, '--card-tier-color': tierColor } as React.CSSProperties}
                  onClick={() => setPickerSlot(item.slot)}
                  title={`Click to change ${item.slot}`}
                >
                  <div className="ptab-gear-card__top">
                    <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
                    <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
                  </div>
                  <div className="ptab-gear-card__img-wrap">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.name}
                        className="ptab-gear-card__img"
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div style={{ fontSize: '28px', opacity: 0.4, filter: `drop-shadow(0 0 4px ${tierColor})` }}>
                        {item.slot === 'helmet' ? '\u2302' : item.slot === 'chest' ? '\u2666' : item.slot === 'legs' ? '\u2225' : item.slot === 'gloves' ? '\u270B' : item.slot === 'boots' ? '\u25B2' : '\u2694'}
                      </div>
                    )}
                  </div>
                  {statEntries.length > 0 && (
                    <div className="ptab-gear-card__stats">
                      {statEntries.map(s => (
                        <div key={s.label} className="ptab-gear-stat">
                          <span className="ptab-gear-stat__label">{s.label}</span>
                          <span className="ptab-gear-stat__val" style={{ color: s.color }}>{s.val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="ptab-gear-card__footer">
                    <div className="ptab-gear-card__dur-bar">
                      <div className="ptab-gear-card__dur-fill" style={{ width: `${dur}%`, background: durColor }} />
                    </div>
                    <div className="ptab-gear-card__dur-lbl" style={{ color: durColor }}>{dur.toFixed(0)}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CONSUME FOOD ──────────────────────────── */}
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

      {/* ── CURRENCIES ────────────────────────────── */}
      <div className="ptab-section">
        <div className="ptab-section__title">💰 CURRENCIES & RESOURCES</div>
        <div className="ptab-currency-grid">
          {[
            { icon: '💰', label: 'Cash',      val: `$${player.money.toLocaleString()}`,          color: '#22d38a' },
            { icon: '₿',  label: 'Bitcoin',   val: `${player.bitcoin}`,                           color: '#f59e0b' },
            { icon: '🔩', label: 'Scrap',      val: player.scrap.toLocaleString(),                color: '#94a3b8' },
            { icon: '🛢️', label: 'Oil',        val: (player.oil ?? 0).toLocaleString(),           color: '#6366f1' },
            { icon: '⚛️', label: 'Material X', val: (player.materialX ?? 0).toLocaleString(),    color: '#a855f7' },
          ].map(c => (
            <div key={c.label} className="ptab-currency-card">
              <span className="ptab-currency-card__icon">{c.icon}</span>
              <span className="ptab-currency-card__label">{c.label}</span>
              <span className="ptab-currency-card__val" style={{ color: c.color }}>{c.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── LIFETIME STATS ────────────────────────── */}
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

      {/* ── SLOT PICKER MODAL ────────────────────── */}
      {pickerSlot && (() => {
        const currentlyEquipped = equipped.find((i: any) => i.slot === pickerSlot)
        const availableItems = inventory.items
          .filter(i => i.slot === pickerSlot)
          .sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))

        return (
          <div className="inv-modal-overlay" onClick={() => setPickerSlot(null)}>
            <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%' }}>
              <div className="inv-modal__title" style={{ color: '#84cc16' }}>
                {pickerSlot.toUpperCase()} GEAR
              </div>

              {/* Currently Equipped */}
              {currentlyEquipped && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', marginBottom: '10px',
                  background: 'rgba(132, 204, 22, 0.06)',
                  border: '1px solid rgba(132, 204, 22, 0.2)',
                  borderRadius: '6px',
                }}>
                  <div style={{ width: '40px', height: '40px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(() => {
                      const imgUrl = getItemImagePath(currentlyEquipped.tier, currentlyEquipped.slot, currentlyEquipped.category, currentlyEquipped.weaponSubtype)
                      return imgUrl ? (
                        <img src={imgUrl} alt={currentlyEquipped.name} style={{ width: '36px', height: '36px', objectFit: 'contain', filter: `drop-shadow(0 2px 6px ${TIER_COLORS[currentlyEquipped.tier]}40)` }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <span style={{ fontSize: '24px', opacity: 0.4 }}>{(SLOT_ICONS as any)[currentlyEquipped.slot]}</span>
                      )
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 700, color: TIER_COLORS[currentlyEquipped.tier] }}>{currentlyEquipped.name}</div>
                    <div style={{ fontSize: '8px', color: '#84cc16', fontWeight: 700, letterSpacing: '0.1em', marginTop: '1px' }}>EQUIPPED</div>
                  </div>
                  <button
                    onClick={() => { inventory.unequipItem(currentlyEquipped.id); setPickerSlot(null) }}
                    style={{
                      padding: '6px 12px', fontSize: '9px', fontWeight: 700,
                      fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
                      background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >UNEQUIP</button>
                </div>
              )}

              {/* Available Items */}
              <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {availableItems.filter(i => !i.equipped).length === 0 && (
                  <div style={{ color: '#475569', textAlign: 'center', padding: '20px', fontSize: '10px' }}>No other items for this slot.</div>
                )}
                {availableItems.filter(i => !i.equipped).map(item => {
                  const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '5px',
                        background: 'rgba(8,12,18,0.8)',
                        border: `1px solid ${TIER_COLORS[item.tier]}33`,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onClick={() => { inventory.equipItem(item.id); setPickerSlot(null) }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(132,204,22,0.06)'; e.currentTarget.style.borderColor = `${TIER_COLORS[item.tier]}66` }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,12,18,0.8)'; e.currentTarget.style.borderColor = `${TIER_COLORS[item.tier]}33` }}
                    >
                      <div style={{ width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {imgUrl ? (
                          <img src={imgUrl} alt={item.name} style={{ width: '32px', height: '32px', objectFit: 'contain', filter: `drop-shadow(0 2px 4px ${TIER_COLORS[item.tier]}30)` }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                        ) : (
                          <span style={{ fontSize: '20px', opacity: 0.4 }}>{(SLOT_ICONS as any)[item.slot]}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 700, color: TIER_COLORS[item.tier], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        <div style={{ fontSize: '8px', color: '#475569', fontFamily: 'var(--font-display)' }}>{TIER_LABELS[item.tier]}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px', fontSize: '8px', fontFamily: 'var(--font-mono)' }}>
                          {item.stats.damage && <span style={{ color: '#f87171' }}>DMG {item.stats.damage}</span>}
                          {item.stats.critRate && <span style={{ color: '#fb923c' }}>CRIT {item.stats.critRate}%</span>}
                          {item.stats.critDamage && <span style={{ color: '#fb923c' }}>CDMG +{item.stats.critDamage}%</span>}
                          {item.stats.armor && <span style={{ color: '#94a3b8' }}>ARM +{item.stats.armor}%</span>}
                          {item.stats.dodge && <span style={{ color: '#34d399' }}>EVA +{item.stats.dodge}%</span>}
                          {item.stats.precision && <span style={{ color: '#38bdf8' }}>ACC +{item.stats.precision}%</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: '8px', color: '#84cc16', fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0 }}>EQUIP</div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => setPickerSlot(null)}
                style={{
                  width: '100%', padding: '8px', marginTop: '12px',
                  fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)',
                  letterSpacing: '0.08em', background: 'transparent', color: '#475569',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >CLOSE</button>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
