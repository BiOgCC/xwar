import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { getStatIcon } from '../../shared/StatIcon'
import { useInventoryStore, getItemImagePath, TIER_COLORS, TIER_LABELS } from '../../../stores/inventoryStore'
import { usePrestigeStore, getPrestigeItemImage } from '../../../stores/prestigeStore'
import { useUIStore } from '../../../stores/uiStore'
import type { EquipSlot } from '../../../stores/inventoryStore'

interface Props { onPickSlot: (s: EquipSlot) => void; onPickAmmo: () => void }

type EquipoTab = 'weapon' | 'ammo' | 'helmet' | 'chest' | 'legs' | 'boots' | 'gloves'

const EQUIPO_TABS: { id: EquipoTab; label: string }[] = [
  { id: 'weapon', label: 'Weapon' },
  { id: 'ammo', label: 'Ammo' },
  { id: 'helmet', label: 'Helmet' },
  { id: 'chest', label: 'Chest' },
  { id: 'legs', label: 'Pants' },
  { id: 'boots', label: 'Boots' },
  { id: 'gloves', label: 'Gloves' },
]

export default function InventoryGearDisplay({ onPickSlot, onPickAmmo }: Props) {
  const player = usePlayerStore()
  const inv = useInventoryStore()
  const pStore = usePrestigeStore()
  const ui = useUIStore()
  const eq = inv.items.filter(i => i.location === 'inventory' && i.equipped)
  const [activeSlot, setActiveSlot] = useState<EquipoTab>('weapon')

  // Aggregate stats from all equipped items
  const totals = eq.reduce((acc, item) => {
    acc.damage += item.stats.damage || 0
    acc.critRate += item.stats.critRate || 0
    acc.armor += item.stats.armor || 0
    acc.durability += Number(item.durability ?? 100)
    acc.count += 1
    return acc
  }, { damage: 0, critRate: 0, armor: 0, durability: 0, count: 0 })

  const avgDur = totals.count > 0 ? Math.round(totals.durability / totals.count) : 100

  const ammoMul: Record<string,{dmg:number}> = { none:{dmg:1},green:{dmg:1.1},blue:{dmg:1.2},purple:{dmg:1.4},red:{dmg:1.4} }
  const aBon = ammoMul[player.equippedAmmo] || ammoMul.none

  const best = () => {
    const allItems = useInventoryStore.getState().items.filter(i => i.location === 'inventory')
    ;(['helmet','chest','legs','gloves','boots'] as const).forEach(slot => {
      const c = allItems.filter(i=>i.slot===slot&&Number(i.durability)>0)
      if(!c.length) return
      const b = c.reduce((a,b)=>{const aT=(a.stats.damage||0)+(a.stats.armor||0)+(a.stats.critRate||0)+(a.stats.critDamage||0)+(a.stats.dodge||0)+(a.stats.precision||0);const bT=(b.stats.damage||0)+(b.stats.armor||0)+(b.stats.critRate||0)+(b.stats.critDamage||0)+(b.stats.dodge||0)+(b.stats.precision||0);return bT>aT?b:a})
      useInventoryStore.getState().equipItem(b.id)
    })
    const w = allItems.filter(i=>i.location === 'inventory' && i.slot==='weapon'&&Number(i.durability)>0)
    if(w.length) { const bw=w.reduce((a,b)=>{const aT=(a.stats.damage||0)+(a.stats.critRate||0)+(a.stats.critDamage||0);const bT=(b.stats.damage||0)+(b.stats.critRate||0)+(b.stats.critDamage||0);return bT>aT?b:a}); useInventoryStore.getState().equipItem(bw.id) }
    const p=usePlayerStore.getState(); if(p.redBullets>0) p.equipAmmo('red'); else if(p.purpleBullets>0) p.equipAmmo('purple'); else if(p.blueBullets>0) p.equipAmmo('blue'); else if(p.greenBullets>0) p.equipAmmo('green')
  }

  const remove = () => { const i=useInventoryStore.getState(); i.items.filter(x=>x.equipped).forEach(x=>i.unequipItem(x.id)); usePlayerStore.getState().equipAmmo('none') }

  const renderSlotContent = () => {
    if (activeSlot === 'ammo') {
      const ammo = player.equippedAmmo
      if (ammo === 'none') return (
        <div className="inv-equipo__empty" onClick={onPickAmmo} style={{ cursor: 'pointer' }}>
          <img src="/assets/items/ammo_green.png" alt="Ammo" style={{ width: '48px', height: '48px', objectFit: 'contain', opacity: 0.25, filter: 'grayscale(100%)' }} />
          <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Tap to equip ammo</div>
        </div>
      )
      const ac: Record<string,string> = { green:'#10b981', blue:'#3b82f6', purple:'#a855f7', red:'#ef4444' }
      const clr = ac[ammo] || '#fff'
      const cnt = player[`${ammo}Bullets` as keyof typeof player] as number
      return (
        <div className="inv-equipo__slot-detail" onClick={onPickAmmo} style={{ cursor: 'pointer' }}>
          <img src={`/assets/items/ammo_${ammo}.png`} alt={ammo} style={{ width: '48px', height: '48px', objectFit: 'contain', filter: `drop-shadow(0 0 8px ${clr}66)` }} />
          <div className="inv-equipo__slot-stats">
            <div className="inv-equipo__slot-stat"><span style={{ color: '#64748b' }}>Type</span><span style={{ color: clr, fontWeight: 700 }}>{ammo.toUpperCase()}</span></div>
            <div className="inv-equipo__slot-stat"><span style={{ color: '#64748b' }}>Amount</span><span style={{ color: clr, fontWeight: 700 }}>{cnt?.toLocaleString()}</span></div>
            <div className="inv-equipo__slot-stat"><span style={{ color: '#64748b' }}>Mult</span><span style={{ color: clr, fontWeight: 700 }}>×{aBon.dmg}</span></div>
          </div>
        </div>
      )
    }

    const slot = activeSlot as EquipSlot
    const item = eq.find(i => i.slot === slot)
    if (!item) return (
      <div className="inv-equipo__empty" onClick={() => onPickSlot(slot)} style={{ cursor: 'pointer' }}>
        <img src={getItemImagePath('t1', slot, slot === 'weapon' ? 'weapon' : 'armor') || ''} alt={slot} style={{ width: '48px', height: '48px', objectFit: 'contain', opacity: 0.2, filter: 'grayscale(100%)' }} />
        <div style={{ fontSize: '9px', color: '#475569', fontWeight: 600, marginTop: '4px', letterSpacing: '0.06em' }}>+</div>
      </div>
    )

    const tc = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
    const img = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
    const dur = Number(item.durability ?? 100)
    const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
    const se: { label: string; val: string; color: string }[] = []
    if (item.stats.damage) se.push({ label: 'DMG', val: String(item.stats.damage), color: '#f87171' })
    if (item.stats.critRate) se.push({ label: 'CRIT', val: `${item.stats.critRate}%`, color: '#fb923c' })
    if (item.stats.critDamage) se.push({ label: 'C.DMG', val: `${item.stats.critDamage}%`, color: '#fb923c' })
    if (item.stats.armor) se.push({ label: 'ARM', val: `${item.stats.armor}%`, color: '#94a3b8' })
    if (item.stats.dodge) se.push({ label: 'EVA', val: `${item.stats.dodge}%`, color: '#34d399' })
    if (item.stats.precision) se.push({ label: 'ACC', val: `${item.stats.precision}%`, color: '#38bdf8' })

    return (
      <div className="inv-equipo__slot-detail" onClick={() => onPickSlot(slot)} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'relative' }}>
          {img ? <img src={img} alt={item.name} style={{ width: '56px', height: '56px', objectFit: 'contain', filter: `drop-shadow(0 2px 8px ${tc}40)` }} onError={e => { e.currentTarget.style.display = 'none' }} /> : null}
        </div>
        <div className="inv-equipo__slot-stats">
          {se.map(s => (
            <div key={s.label} className="inv-equipo__slot-stat">
              <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>{getStatIcon(s.label, s.color, 10)}</span>
              <span style={{ color: s.color, fontWeight: 700 }}>{s.val}</span>
            </div>
          ))}
          <div className="inv-equipo__slot-stat">
            <span style={{ color: '#64748b' }}>DUR</span>
            <span style={{ color: durColor, fontWeight: 700 }}>{dur.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="inv-equipo">
      <div className="inv-equipo__header">
        <div className="inv-equipo__title">EQUIPMENT</div>
        <div className="inv-equipo__actions">
          <span className="inv-equipo__level-badge">{player.level}</span>
          <button className="inv-equipo__action-btn" onClick={best} title="Equip Best">⚡</button>
          <button className="inv-equipo__action-btn inv-equipo__action-btn--remove" onClick={remove} title="Remove All">✕</button>
        </div>
      </div>

      {/* Aggregate Stats Summary */}
      <div className="inv-equipo__summary">
        <div className="inv-equipo__summary-stat">
          <span className="inv-equipo__summary-icon">⚔</span>
          <span className="inv-equipo__summary-val">{totals.damage}</span>
        </div>
        <div className="inv-equipo__summary-stat">
          <span className="inv-equipo__summary-icon">💥</span>
          <span className="inv-equipo__summary-val">{totals.critRate}%</span>
        </div>
        <div className="inv-equipo__summary-stat">
          <span className="inv-equipo__summary-icon">🛡</span>
          <span className="inv-equipo__summary-val">{totals.armor}%</span>
        </div>
        <div className="inv-equipo__summary-stat">
          <span className="inv-equipo__summary-icon">🔧</span>
          <span className="inv-equipo__summary-val">{avgDur}%</span>
        </div>
      </div>

      {/* Slot Tabs */}
      <div className="inv-equipo__tabs">
        {EQUIPO_TABS.map(tab => (
          <button
            key={tab.id}
            className={`inv-equipo__tab ${activeSlot === tab.id ? 'inv-equipo__tab--active' : ''}`}
            onClick={() => setActiveSlot(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Slot Content */}
      <div className="inv-equipo__content">
        {renderSlotContent()}
      </div>
    </div>
  )
}
