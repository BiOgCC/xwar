import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, getItemImagePath, TIER_COLORS, TIER_LABELS } from '../../../stores/inventoryStore'
import { usePrestigeStore, getPrestigeItemImage } from '../../../stores/prestigeStore'
import { useUIStore } from '../../../stores/uiStore'
import type { EquipSlot } from '../../../stores/inventoryStore'

interface GearSectionProps {
  onPickSlot: (slot: EquipSlot) => void
  onPickAmmo: () => void
}

/** Equipped gear grid (armor + weapon + prestige + ammo) */
export default function ProfileGearSection({ onPickSlot, onPickAmmo }: GearSectionProps) {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const prestigeStore = usePrestigeStore()
  const ui = useUIStore()
  const equipped = inventory.getEquipped()
  const equippedPrestige = prestigeStore.items.find((i: any) => i.equipped && i.craftedBy === player.name)

  // Ammo info
  const ammoMultipliers: Record<string, { dmg: number; crit: number; label: string }> = {
    none:   { dmg: 1.0,  crit: 0, label: 'None' },
    green:  { dmg: 1.1,  crit: 0, label: '+10% DMG' },
    blue:   { dmg: 1.2,  crit: 0, label: '+20% DMG' },
    purple: { dmg: 1.4,  crit: 0, label: '+40% DMG' },
    red:    { dmg: 1.4, crit: 10, label: '+40% DMG +10% CRIT' },
  }
  const ammoBonus = ammoMultipliers[player.equippedAmmo] || ammoMultipliers.none

  return (
    <>
      {/* EQUIPPED GEAR */}
      <div className="ptab-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div className="ptab-section__title" style={{ margin: 0 }}>ARMOR & PRESTIGE</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={{
                padding: '3px 10px', fontSize: '8px', fontWeight: 800, letterSpacing: '0.08em',
                fontFamily: 'var(--font-display)',
                color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '4px', cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onClick={() => {
                const inv = useInventoryStore.getState()
                const allItems = inv.items.filter(i => i.location === 'inventory')
                const armorSlots = ['helmet', 'chest', 'legs', 'gloves', 'boots'] as const
                armorSlots.forEach(slot => {
                  const candidates = allItems.filter(i => i.slot === slot && i.durability > 0)
                  if (candidates.length === 0) return
                  const best = candidates.reduce((a, b) => {
                    const aT = (a.stats.damage || 0) + (a.stats.armor || 0) + (a.stats.critRate || 0) + (a.stats.critDamage || 0) + (a.stats.dodge || 0) + (a.stats.precision || 0)
                    const bT = (b.stats.damage || 0) + (b.stats.armor || 0) + (b.stats.critRate || 0) + (b.stats.critDamage || 0) + (b.stats.dodge || 0) + (b.stats.precision || 0)
                    return bT > aT ? b : a
                  })
                  inv.equipItem(best.id)
                })
                const weapons = allItems.filter(i => i.slot === 'weapon' && i.durability > 0)
                if (weapons.length > 0) {
                  const bestWep = weapons.reduce((a, b) => {
                    const aT = (a.stats.damage || 0) + (a.stats.critRate || 0) + (a.stats.critDamage || 0)
                    const bT = (b.stats.damage || 0) + (b.stats.critRate || 0) + (b.stats.critDamage || 0)
                    return bT > aT ? b : a
                  })
                  inv.equipItem(bestWep.id)
                }
                const p = usePlayerStore.getState()
                if (p.redBullets > 0) p.equipAmmo('red')
                else if (p.purpleBullets > 0) p.equipAmmo('purple')
                else if (p.blueBullets > 0) p.equipAmmo('blue')
                else if (p.greenBullets > 0) p.equipAmmo('green')
              }}
            >BEST</button>
            <button
              style={{
                padding: '3px 10px', fontSize: '8px', fontWeight: 800, letterSpacing: '0.08em',
                fontFamily: 'var(--font-display)',
                color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '4px', cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onClick={() => {
                const inv = useInventoryStore.getState()
                inv.items.filter(i => i.equipped).forEach(i => inv.unequipItem(i.id))
                usePlayerStore.getState().equipAmmo('none')
              }}
            >REMOVE</button>
          </div>
        </div>
        <div className="ptab-gear-grid">
          {['helmet', 'chest', 'legs', 'gloves', 'boots'].map(slotStr => {
            const item = equipped.find((i: any) => i.slot === slotStr);
            if (!item) {
              return (
                <div key={slotStr} className="ptab-gear-card" style={{ borderColor: 'rgba(255,255,255,0.05)', opacity: 0.5 }}>
                  <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">{slotStr.toUpperCase()}</span></div>
                  <div className="ptab-gear-card__img-wrap">
                    <img src={getItemImagePath('t1', slotStr as any, 'armor') || ''} alt={slotStr} style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.25, filter: 'grayscale(100%)' }} />
                  </div>
                </div>
              )
            }
            const tierColor = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
            const tierLabel = TIER_LABELS[item.tier as keyof typeof TIER_LABELS] || item.tier.toUpperCase()
            const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
            const dur = item.durability ?? 100
            const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
            const statEntries: { label: string; val: string; color: string }[] = []
            if (item.stats.damage)    statEntries.push({ label: 'DMG', val: `${item.stats.damage}`, color: '#f87171' })
            if (item.stats.critRate)  statEntries.push({ label: 'CRIT', val: `${item.stats.critRate}%`, color: '#fb923c' })
            if (item.stats.critDamage)statEntries.push({ label: 'C.DMG', val: `${item.stats.critDamage}%`, color: '#fb923c' })
            if (item.stats.armor)     statEntries.push({ label: 'ARM', val: `${item.stats.armor}%`, color: '#94a3b8' })
            if (item.stats.dodge)     statEntries.push({ label: 'EVA', val: `${item.stats.dodge}%`, color: '#34d399' })
            if (item.stats.precision) statEntries.push({ label: 'ACC', val: `${item.stats.precision}%`, color: '#38bdf8' })
            return (
              <div key={item.id} className="ptab-gear-card" style={{ borderColor: `${tierColor}30`, '--card-tier-color': tierColor } as React.CSSProperties} onClick={() => onPickSlot(item.slot)} title={`Click to change ${item.slot}`}>
                <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
                  <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
                </div>
                <div className="ptab-gear-card__img-wrap">
                  {imgUrl ? <img src={imgUrl} alt={item.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} /> : <div style={{ fontSize: '28px', opacity: 0.4, filter: `drop-shadow(0 0 4px ${tierColor})` }}>?</div>}
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
                  <div className="ptab-gear-card__dur-bar"><div className="ptab-gear-card__dur-fill" style={{ width: `${dur}%`, background: durColor }} /></div>
                  <div className="ptab-gear-card__dur-lbl" style={{ color: durColor }}>{dur.toFixed(0)}%</div>
                </div>
              </div>
            )
          })}

          {/* Prestige Slot */}
          {equippedPrestige ? (() => {
            const p = equippedPrestige
            const pColor = p.category === 'military' ? '#ef4444' : '#38bdf8'
            const pStats: { label: string; val: string; color: string }[] = []
            if (p.bonusStats.damage) pStats.push({ label: 'DMG', val: `${p.bonusStats.damage}%`, color: '#f87171' })
            if (p.bonusStats.crit_damage) pStats.push({ label: 'C.DMG', val: `${p.bonusStats.crit_damage}%`, color: '#fb923c' })
            if (p.bonusStats.prospection) pStats.push({ label: 'PROS', val: `+${p.bonusStats.prospection}`, color: '#38bdf8' })
            if (p.bonusStats.industrialist) pStats.push({ label: 'IND', val: `${p.bonusStats.industrialist}%`, color: '#fbbf24' })
            return (
              <div key="prestige" className="ptab-gear-card" style={{ borderColor: `${pColor}50`, '--card-tier-color': pColor, background: `linear-gradient(to bottom, ${pColor}10, transparent)` } as React.CSSProperties} onClick={() => ui.setActivePanel('prestige')}>
                <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">PRESTIGE</span>
                  <span className="ptab-gear-card__tier" style={{ color: pColor }}>{p.category.toUpperCase()}</span>
                </div>
                <div className="ptab-gear-card__img-wrap">
                  <img src={getPrestigeItemImage(p.category)} alt={p.category === 'military' ? 'Crown' : 'Ring'} style={{ width: '40px', height: '40px', objectFit: 'contain', filter: `drop-shadow(0 0 8px ${pColor}66)` }} />
                </div>
                {pStats.length > 0 && (
                  <div className="ptab-gear-card__stats">
                    {pStats.slice(0,3).map(s => (
                      <div key={s.label} className="ptab-gear-stat">
                        <span className="ptab-gear-stat__label">{s.label}</span>
                        <span className="ptab-gear-stat__val" style={{ color: s.color }}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="ptab-gear-card__footer" style={{ justifyContent: 'center' }}>
                  <div className="ptab-gear-card__dur-lbl" style={{ color: '#eab308' }}>INFINITE</div>
                </div>
              </div>
            )
          })() : (
            <div key="prestige_empty" className="ptab-gear-card" style={{ borderColor: 'rgba(234,179,8,0.2)', opacity: 0.6 }} onClick={() => ui.setActivePanel('prestige')}>
              <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot" style={{color:'#eab308'}}>PRESTIGE</span></div>
              <div className="ptab-gear-card__img-wrap">
                <img src="/assets/items/prestige_crown.png" alt="Prestige" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.3 }} />
              </div>
            </div>
          )}
        </div>

        <div className="ptab-section__title" style={{ marginTop: '16px' }}>WEAPONRY & AMMO</div>
        <div className="ptab-gear-grid">
          {/* Weapon Slot */}
          {(() => {
            const item = equipped.find((i: any) => i.slot === 'weapon');
            if (!item) {
              return (
                <div key="weapon" className="ptab-gear-card" style={{ borderColor: 'rgba(255,255,255,0.05)', opacity: 0.5 }}>
                  <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">WEAPON</span></div>
                  <div className="ptab-gear-card__img-wrap"><img src={getItemImagePath('t1', 'weapon', 'weapon') || ''} alt="Weapon" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.25, filter: 'grayscale(100%)' }} /></div>
                </div>
              )
            }
            const tierColor = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
            const tierLabel = TIER_LABELS[item.tier as keyof typeof TIER_LABELS] || item.tier.toUpperCase()
            const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
            const dur = item.durability ?? 100
            const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
            return (
              <div key={item.id} className="ptab-gear-card" style={{ borderColor: `${tierColor}30`, '--card-tier-color': tierColor } as React.CSSProperties} onClick={() => onPickSlot(item.slot)}>
                <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
                  <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
                </div>
                <div className="ptab-gear-card__img-wrap">
                  {imgUrl ? <img src={imgUrl} alt={item.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} /> : <div style={{ fontSize: '28px', opacity: 0.4, filter: `drop-shadow(0 0 4px ${tierColor})` }}>⚔️</div>}
                </div>
                <div className="ptab-gear-card__stats">
                  {item.stats.damage && <div className="ptab-gear-stat"><span className="ptab-gear-stat__label">DMG</span><span className="ptab-gear-stat__val" style={{ color: '#f87171' }}>{item.stats.damage}</span></div>}
                  {item.stats.critRate && <div className="ptab-gear-stat"><span className="ptab-gear-stat__label">CRIT</span><span className="ptab-gear-stat__val" style={{ color: '#fb923c' }}>{item.stats.critRate}%</span></div>}
                </div>
                <div className="ptab-gear-card__footer">
                  <div className="ptab-gear-card__dur-bar"><div className="ptab-gear-card__dur-fill" style={{ width: `${dur}%`, background: durColor }} /></div>
                  <div className="ptab-gear-card__dur-lbl" style={{ color: durColor }}>{dur.toFixed(0)}%</div>
                </div>
              </div>
            )
          })()}

          {/* Ammo Slot */}
          {(() => {
            const ammo = player.equippedAmmo
            if (ammo === 'none') {
              return (
                <div key="ammo_empty" className="ptab-gear-card" style={{ borderColor: 'rgba(255,255,255,0.1)', opacity: 0.6, cursor: 'pointer' }} onClick={onPickAmmo}>
                  <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">AMMO</span></div>
                  <div className="ptab-gear-card__img-wrap"><img src="/assets/items/ammo_green.png" alt="Ammo" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.3, filter: 'grayscale(100%)' }} /></div>
                  <div className="ptab-gear-card__footer" style={{ justifyContent: 'center' }}>
                    <div className="ptab-gear-card__dur-lbl" style={{ color: '#64748b', fontSize: '7px' }}>CLICK TO EQUIP</div>
                  </div>
                </div>
              )
            }
            const ammoColors: Record<string, string> = { green: '#10b981', blue: '#3b82f6', purple: '#a855f7', red: '#ef4444' }
            const aColor = ammoColors[ammo] || '#fff'
            const aCount = player[`${ammo}Bullets` as keyof typeof player] as number
            return (
              <div key="ammo" className="ptab-gear-card" style={{ borderColor: `${aColor}30`, '--card-tier-color': aColor, cursor: 'pointer' } as React.CSSProperties} onClick={onPickAmmo}>
                <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">AMMO</span>
                  <span className="ptab-gear-card__tier" style={{ color: aColor }}>{ammo.toUpperCase()}</span>
                </div>
                <div className="ptab-gear-card__img-wrap">
                  <img src={`/assets/items/ammo_${ammo}.png`} alt={ammo} className="ptab-gear-card__img" style={{ filter: `drop-shadow(0 0 8px ${aColor}66)` }} />
                </div>
                <div className="ptab-gear-card__stats">
                  <div className="ptab-gear-stat"><span className="ptab-gear-stat__label">AMNT</span><span className="ptab-gear-stat__val" style={{ color: aColor }}>{aCount?.toLocaleString()}</span></div>
                  <div className="ptab-gear-stat"><span className="ptab-gear-stat__label">MULT</span><span className="ptab-gear-stat__val" style={{ color: aColor }}>{'\u00d7'}{ammoBonus.dmg}</span></div>
                </div>
                <div className="ptab-gear-card__footer" style={{ justifyContent: 'center' }}>
                  <div className="ptab-gear-card__dur-lbl" style={{ color: aColor }}>EQUIPPED</div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </>
  )
}
