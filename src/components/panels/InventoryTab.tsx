import { useState, useEffect, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import InventorySummary from '../shared/InventorySummary'
import { useUIStore } from '../../stores/uiStore'
import { usePrestigeStore, getPrestigeItemImage } from '../../stores/prestigeStore'
import { useSkillsStore } from '../../stores/skillsStore'
import { useMarketStore } from '../../stores/marketStore'
import LootBoxOpener from '../shared/LootBoxOpener'
import GameModal from '../shared/GameModal'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRINGS } from '../shared/AnimationSystem'
import ResourceIcon from '../shared/ResourceIcon'
import {
 useInventoryStore,
 generateStats,
 TIER_COLORS,
 TIER_LABELS,
 TIER_ORDER,
 ARMOR_SLOTS,
 SLOT_ICONS,
 getItemImagePath,
 WEAPON_SUBTYPES,
 SCRAP_VALUES,
 type EquipItem,
 type EquipSlot,
 type EquipTier,
 type EquipCategory,
 type WeaponSubtype,
} from '../../stores/inventoryStore'

/* equipment tier ?--?T market sell price (mirrors MarketPanel) */
const TIER_SELL_PRICE: Record<EquipTier, number> = {
 t1: 120, t2: 360, t3: 1200, t4: 4500, t5: 18000, t6: 80000
}

export default function InventoryTab() {
 const player = usePlayerStore()
 const inventory = useInventoryStore()
 const ui = useUIStore()
 const prestigeStore = usePrestigeStore()

 // Modal State
 const [selectedItem, setSelectedItem] = useState<EquipItem | null>(null)
 const [mode, setMode] = useState<'normal' | 'craft' | 'disarm'>('normal')
 const [craftSlot, setCraftSlot] = useState<EquipSlot>('weapon')

 // Slot Pick Modal State
 const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null)
 const [showAmmoPicker, setShowAmmoPicker] = useState(false)
 const [showLootBox, setShowLootBox] = useState(false)
 const [showMilitaryBox, setShowMilitaryBox] = useState(false)
 const [craftedItem, setCraftedItem] = useState<{ item: EquipItem; superforged: boolean } | null>(null)
 const [craftHistory, setCraftHistory] = useState<{ item: EquipItem; superforged: boolean }[]>([])

 // ESC closes any open modal
 useEffect(() => {
 const onClose = () => { setSelectedItem(null); setPickerSlot(null); setShowAmmoPicker(false) }
 window.addEventListener('xwar-close-modal', onClose)
 return () => window.removeEventListener('xwar-close-modal', onClose)
 }, [])

 const equipped = inventory.items.filter((i) => i.equipped)
 const unequipped = inventory.items.filter((i) => !i.equipped)

 const handleOpenLootBox = () => {
 if (player.lootBoxes <= 0) return
 setShowLootBox(true)
 }

 const handleOpenMilitaryBox = () => {
 if (player.militaryBoxes <= 0) return
 setShowMilitaryBox(true)
 }

 const handleLootBoxOpen = useCallback(() => {
 return inventory.openLootBox()
 }, [inventory])

 const handleMilitaryBoxOpen = useCallback(() => {
 return inventory.openMilitaryBox()
 }, [inventory])

 const handleDisarm = () => {
 if (!selectedItem) return
 if (selectedItem.equipped) return
 const scrapGain = inventory.dismantleItem(selectedItem.id)
 player.addScrap(scrapGain)
 setSelectedItem(null)
 }

 const handleEquipToggle = () => {
 if (!selectedItem) return
 if (selectedItem.equipped) {
 inventory.unequipItem(selectedItem.id)
 } else {
 inventory.equipItem(selectedItem.id)
 }
 setSelectedItem(null)
 setPickerSlot(null)
 }

 const renderStats = (stats: any, condensed = false) => {
 if (!stats) return null
 return (
 <div style={{ display: 'flex', gap: '4px', fontSize: condensed ? '9px' : '10px', marginTop: condensed ? '2px' : '6px', opacity: 0.8, flexWrap: 'wrap' }}>
 {Object.keys(stats).length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
        {stats.damage && <span>DMG {stats.damage}</span>}
 {stats.critRate && <span>ACC {stats.critRate}%</span>}
        {stats.critDamage && <span>CDMG +{stats.critDamage}%</span>}
        {stats.armor && <span>ARM +{stats.armor}%</span>}
        {stats.dodge && <span>EVA +{stats.dodge}%</span>}
        {stats.precision && <span>PREC +{stats.precision}%</span>}
 </div>}
 </div>
 )
 }


 const getSortedItemsForSlot = (slot: EquipSlot) => {
 // Sort descending by tier order index
 return inventory.items
 .filter((i) => i.slot === slot)
 .sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))
 }

 const renderEquipmentCategoryRow = (slot: EquipSlot, title: string) => {
 const items = getSortedItemsForSlot(slot)
 if (items.length === 0) return null

 return (
 <div style={{ marginBottom: '16px' }}>
 <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
 {title}
 </div>
 <div className="ptab-gear-grid">
 {items.map((item) => {
 const tierColor = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
 const tierLabel = TIER_LABELS[item.tier as keyof typeof TIER_LABELS] || item.tier.toUpperCase()
 const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
 const dur = item.durability ?? 100
 const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'

 const statEntries: { label: string; val: string; color: string }[] = []
 if (item.stats.damage) statEntries.push({ label: 'DMG', val: `${item.stats.damage}`, color: '#f87171' })
 if (item.stats.critRate) statEntries.push({ label: 'CRIT', val: `${item.stats.critRate}%`, color: '#fb923c' })
 if (item.stats.critDamage)statEntries.push({ label: 'C.DMG', val: `${item.stats.critDamage}%`, color: '#fb923c' })
 if (item.stats.armor) statEntries.push({ label: 'ARM', val: `${item.stats.armor}%`, color: '#94a3b8' })
 if (item.stats.dodge) statEntries.push({ label: 'EVA', val: `${item.stats.dodge}%`, color: '#34d399' })
 if (item.stats.precision) statEntries.push({ label: 'ACC', val: `${item.stats.precision}%`, color: '#38bdf8' })

 return (
 <div
 key={item.id}
 className="ptab-gear-card"
 style={{
 borderColor: item.equipped ? 'rgba(132,204,22,0.4)' : `${tierColor}30`,
 '--card-tier-color': tierColor,
 boxShadow: item.equipped ? '0 0 8px rgba(132,204,22,0.15)' : undefined,
 } as React.CSSProperties}
 onClick={() => {
 if (mode === 'disarm' && !item.equipped) {
 const scrapGain = inventory.dismantleItem(item.id)
 player.addScrap(scrapGain)
 ui.addFloatingText(`+${scrapGain} SCRAP`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
 } else {
 setSelectedItem(item)
 }
 }}
 title={item.equipped ? `${item.name} (EQUIPPED)` : item.name}
 >
 {/* Equipped badge */}
 {item.equipped && (
 <div style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '7px', fontWeight: 900, color: '#84cc16', letterSpacing: '0.08em' }}>EQ</div>
 )}
 <div className="ptab-gear-card__top">
 <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
 <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
 </div>
 <div className="ptab-gear-card__img-wrap">
 {imgUrl ? (
 <img src={imgUrl} alt={item.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} />
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
 )
 }

 return (
 <div className="inv-tab">
 <InventorySummary />

 {/* CRAFT & DISARM ACTION BAR */}
 <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
 <button
 onClick={() => setMode(mode === 'craft' ? 'normal' : 'craft')}
 style={{
 flex: 1, padding: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px',
 border: `2px solid ${mode === 'craft' ? '#fbbf24' : 'rgba(251,191,36,0.3)'}`,
 borderRadius: '4px', cursor: 'pointer',
 background: mode === 'craft' ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.03)',
 color: mode === 'craft' ? '#fbbf24' : '#b89a3a',
 }}
 >
          CRAFT
 </button>
 <button
 onClick={() => setMode(mode === 'disarm' ? 'normal' : 'disarm')}
 style={{
 flex: 1, padding: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px',
 border: `2px solid ${mode === 'disarm' ? '#ef4444' : 'rgba(239,68,68,0.3)'}`,
 borderRadius: '4px', cursor: 'pointer',
 background: mode === 'disarm' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.03)',
 color: mode === 'disarm' ? '#ef4444' : '#a33a3a',
 }}
 >
          DISARM
 </button>
 </div>

 {/* Loot Boxes — Civilian & Military */}
 <div className="inv-section">
 <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
 {/* Civilian Loot Box */}
 <div style={{
 flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 background: 'rgba(8,12,18,0.6)', padding: '12px', borderRadius: '6px',
 border: '1px solid rgba(34,211,138,0.2)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 <img src="/assets/items/lootbox_civilian.png" alt="Civilian Loot Box" style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(34,211,138,0.3))' }} />
 <div>
 <div style={{ fontSize: '10px', fontWeight: 700, color: '#22d38a', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>CIVILIAN</div>
 <div style={{ fontSize: '18px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{player.lootBoxes}</div>
 </div>
 </div>
 <button
 className="comp-action comp-action--produce"
 style={{ margin: 0, width: 'auto', padding: '6px 16px', fontWeight: 'bold', fontSize: '11px' }}
 disabled={player.lootBoxes <= 0}
 onClick={handleOpenLootBox}
 >
 Open
 </button>
 </div>

 {/* Military Loot Box */}
 <div style={{
 flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
 background: 'rgba(8,12,18,0.6)', padding: '12px', borderRadius: '6px',
 border: '1px solid rgba(239,68,68,0.2)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 <img src="/assets/items/lootbox_military.png" alt="Military Loot Box" style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(239,68,68,0.3))' }} />
 <div>
 <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>MILITARY</div>
 <div style={{ fontSize: '18px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{player.militaryBoxes}</div>
 </div>
 </div>
 <button
 className="comp-action comp-action--produce"
 style={{ margin: 0, width: 'auto', padding: '6px 16px', fontWeight: 'bold', fontSize: '11px', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
 disabled={player.militaryBoxes <= 0}
 onClick={handleOpenMilitaryBox}
 >
 Open
 </button>
 </div>
 </div>
 </div>

 {/* LootBox Animated Openers */}
 <LootBoxOpener
 isOpen={showLootBox}
 onClose={() => setShowLootBox(false)}
 onOpenBox={handleLootBoxOpen}
 boxType="civilian"
 />
 <LootBoxOpener
 isOpen={showMilitaryBox}
 onClose={() => setShowMilitaryBox(false)}
 onOpenBox={handleMilitaryBoxOpen}
 boxType="military"
 />

      {/* EQUIPPED GEAR — Armor/Prestige + Weapon/Ammo */}
 {(() => {
   const equippedPrestige = prestigeStore.items.find((i: any) => i.equipped && i.craftedBy === player.name)
   const ammoMultipliers: Record<string, { dmg: number; crit: number }> = {
     none: { dmg: 1.0, crit: 0 }, green: { dmg: 1.1, crit: 0 },
     blue: { dmg: 1.2, crit: 0 }, purple: { dmg: 1.4, crit: 0 },
     red: { dmg: 1.4, crit: 10 },
   }
   const ammoBonus = ammoMultipliers[player.equippedAmmo] || ammoMultipliers.none
   return (
     <div className="inv-section">
       <div className="inv-section__title" style={{ color: '#ffffff' }}>ARMOR & PRESTIGE</div>
       <div className="ptab-gear-grid">
         {['helmet', 'chest', 'legs', 'gloves', 'boots'].map(slotStr => {
           const item = equipped.find((i: any) => i.slot === slotStr);
           if (!item) {
             return (
               <div key={slotStr} className="ptab-gear-card" style={{ borderColor: 'rgba(255,255,255,0.05)', opacity: 0.5 }}>
                 <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">{slotStr.toUpperCase()}</span></div>
                 <div className="ptab-gear-card__img-wrap">
                   <div style={{ fontSize: '28px', opacity: 0.2 }}>
                     {slotStr === 'helmet' ? '\u2302' : slotStr === 'chest' ? '\u2666' : slotStr === 'legs' ? '\u2225' : slotStr === 'gloves' ? '\u270B' : '\u25B2'}
                   </div>
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
           if (item.stats.damage)    statEntries.push({ label: 'DMG', val: String(item.stats.damage), color: '#f87171' })
           if (item.stats.critRate)  statEntries.push({ label: 'CRIT', val: `${item.stats.critRate}%`, color: '#fb923c' })
           if (item.stats.critDamage)statEntries.push({ label: 'C.DMG', val: `${item.stats.critDamage}%`, color: '#fb923c' })
           if (item.stats.armor)     statEntries.push({ label: 'ARM', val: `${item.stats.armor}%`, color: '#94a3b8' })
           if (item.stats.dodge)     statEntries.push({ label: 'EVA', val: `${item.stats.dodge}%`, color: '#34d399' })
           if (item.stats.precision) statEntries.push({ label: 'ACC', val: `${item.stats.precision}%`, color: '#38bdf8' })
           return (
             <div key={item.id} className="ptab-gear-card" style={{ borderColor: `${tierColor}30`, '--card-tier-color': tierColor } as React.CSSProperties} onClick={() => setPickerSlot(item.slot)}>
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

       <div className="inv-section__title" style={{ marginTop: '16px', color: '#ffffff' }}>WEAPONRY & AMMO</div>
       <div className="ptab-gear-grid">
         {(() => {
           const item = equipped.find((i: any) => i.slot === 'weapon');
           if (!item) {
             return (
               <div key="weapon" className="ptab-gear-card" style={{ borderColor: 'rgba(255,255,255,0.05)', opacity: 0.5 }}>
                 <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">WEAPON</span></div>
                 <div className="ptab-gear-card__img-wrap"><div style={{ fontSize: '28px', opacity: 0.2 }}>\u2694</div></div>
               </div>
             )
           }
           const tierColor = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
           const tierLabel = TIER_LABELS[item.tier as keyof typeof TIER_LABELS] || item.tier.toUpperCase()
           const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
           const dur = item.durability ?? 100
           const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
           return (
             <div key={item.id} className="ptab-gear-card" style={{ borderColor: `${tierColor}30`, '--card-tier-color': tierColor } as React.CSSProperties} onClick={() => setPickerSlot(item.slot)}>
               <div className="ptab-gear-card__top">
                 <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
                 <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
               </div>
               <div className="ptab-gear-card__img-wrap">
                 {imgUrl ? <img src={imgUrl} alt={item.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} /> : <div style={{ fontSize: '28px', opacity: 0.4, filter: `drop-shadow(0 0 4px ${tierColor})` }}>\u2694</div>}
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
               <div key="ammo_empty" className="ptab-gear-card" style={{ borderColor: 'rgba(255,255,255,0.1)', opacity: 0.6, cursor: 'pointer' }} onClick={() => setShowAmmoPicker(true)}>
                 <div className="ptab-gear-card__top"><span className="ptab-gear-card__slot">AMMO</span></div>
                 <div className="ptab-gear-card__img-wrap"><div style={{ fontSize: '28px', opacity: 0.3 }}>\u25cf</div></div>
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
             <div key="ammo" className="ptab-gear-card" style={{ borderColor: `${aColor}30`, '--card-tier-color': aColor, cursor: 'pointer' } as React.CSSProperties} onClick={() => setShowAmmoPicker(true)}>
               <div className="ptab-gear-card__top">
                 <span className="ptab-gear-card__slot">AMMO</span>
                 <span className="ptab-gear-card__tier" style={{ color: aColor }}>{ammo.toUpperCase()}</span>
               </div>
               <div className="ptab-gear-card__img-wrap">
                 <img src={`/assets/items/ammo_${ammo}.png`} alt={ammo} className="ptab-gear-card__img" style={{ filter: `drop-shadow(0 0 8px ${aColor}66)` }} />
               </div>
               <div className="ptab-gear-card__stats">
                 <div className="ptab-gear-stat"><span className="ptab-gear-stat__label">AMNT</span><span className="ptab-gear-stat__val" style={{ color: aColor }}>{aCount?.toLocaleString()}</span></div>
                 <div className="ptab-gear-stat"><span className="ptab-gear-stat__label">MULT</span><span className="ptab-gear-stat__val" style={{ color: aColor }}>\u00d7{ammoBonus.dmg}</span></div>
               </div>
               <div className="ptab-gear-card__footer" style={{ justifyContent: 'center' }}>
                 <div className="ptab-gear-card__dur-lbl" style={{ color: aColor }}>EQUIPPED</div>
               </div>
             </div>
           )
         })()}
       </div>
     </div>
   )
 })()}


 {/* CRAFT MODAL */}
 {mode === 'craft' && (() => {
 const costTable: Record<string, { scrap: number; oil: number; money: number }> = {
 t1: { scrap: 20, oil: 5, money: 50 },
 t2: { scrap: 60, oil: 15, money: 150 },
 t3: { scrap: 180, oil: 45, money: 500 },
 t4: { scrap: 540, oil: 130, money: 1500 },
 t5: { scrap: 1600, oil: 400, money: 5000 },
 t6: { scrap: 4800, oil: 1200, money: 15000 },
 }

 const statPreview: Record<string, Record<string, string>> = {
 weapon: {
 t1: 'DMG 20-49 / CRIT 5%', t2: 'DMG 50-80 / CRIT 6-10%', t3: 'DMG 81-120 / CRIT 11-15%',
 t4: 'DMG 121-150 / CRIT 16-20%', t5: 'DMG 151-199 / CRIT 21-30%', t6: 'DMG 200-300 / CRIT 31-49%',
 },
 helmet: { t1: 'CDMG 12-20%', t2: 'CDMG 32-40%', t3: 'CDMG 52-60%', t4: 'CDMG 72-80%', t5: 'CDMG 92-100%', t6: 'CDMG 112-120%' },
 chest: { t1: 'ARM 2-5%', t2: 'ARM 7-10%', t3: 'ARM 12-15%', t4: 'ARM 17-20%', t5: 'ARM 22-25%', t6: 'ARM 27-30%' },
 legs: { t1: 'ARM 2-5%', t2: 'ARM 7-10%', t3: 'ARM 12-15%', t4: 'ARM 17-20%', t5: 'ARM 22-25%', t6: 'ARM 27-30%' },
 gloves: { t1: 'ACC 1-5%', t2: 'ACC 6-10%', t3: 'ACC 11-15%', t4: 'ACC 16-20%', t5: 'ACC 21-25%', t6: 'ACC 26-30%' },
 boots: { t1: 'EVA 2-5%', t2: 'EVA 7-10%', t3: 'EVA 12-15%', t4: 'EVA 17-20%', t5: 'EVA 22-25%', t6: 'EVA 27-30%' },
 }

 const slotTabs: { slot: EquipSlot; label: string }[] = [
 { slot: 'weapon', label: 'WEAPON' },
 { slot: 'helmet', label: 'HELMET' },
 { slot: 'chest', label: 'CHEST' },
 { slot: 'legs', label: 'LEGS' },
 { slot: 'gloves', label: 'GLOVES' },
 { slot: 'boots', label: 'BOOTS' },
 ]

 const doCraft = (tier: EquipTier, slot: EquipSlot) => {
 const cost = costTable[tier]
 if (player.scrap < cost.scrap || player.oil < cost.oil || player.money < cost.money) return
 player.spendMoney(cost.money)
 player.spendOil(cost.oil)
 player.spendScraps(cost.scrap)
 const category = slot === 'weapon' ? 'weapon' as const : 'armor' as const
 const subtype = slot === 'weapon' ? WEAPON_SUBTYPES[tier][Math.floor(Math.random() * WEAPON_SUBTYPES[tier].length)] : undefined
 const result = generateStats(category, slot, tier, subtype)

 const indLevel = useSkillsStore.getState().economic.industrialist || 0
 const superforgeChance = Math.min(0.50, indLevel * 0.05)
 const isSuperforged = superforgeChance > 0 && Math.random() < superforgeChance
 if (isSuperforged) {
 for (const key of Object.keys(result.stats) as Array<keyof typeof result.stats>) {
 if (typeof result.stats[key] === 'number') {
 (result.stats as any)[key] = Math.ceil(result.stats[key]! * 1.10)
 }
 }
 }

 const newItem: EquipItem = {
 id: `crafted_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
 name: isSuperforged ? `\u26a1 ${result.name}` : result.name,
 slot, category, tier, equipped: false, durability: 100,
 stats: result.stats, weaponSubtype: result.weaponSubtype,
 }
 inventory.addItem(newItem)
 const entry = { item: newItem, superforged: isSuperforged }
 setCraftedItem(entry)
 setCraftHistory(prev => [entry, ...prev])
 }

 const doRandomCraft = (tier: EquipTier) => {
 const allSlots: EquipSlot[] = ['weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots']
 doCraft(tier, allSlots[Math.floor(Math.random() * allSlots.length)])
 }

 return (
 <GameModal isOpen={true} onClose={() => setMode('normal')} title="CRAFT EQUIPMENT" size="lg" glowColor="#fbbf24">
 <div>

 {/* Resources bar */}
 <div style={{
 display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '9px', color: '#94a3b8',
 marginBottom: '12px', padding: '6px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
 fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase',
 }}>
 <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ResourceIcon resourceKey="scrap" size={14} />{player.scrap.toLocaleString()} SCRAP</span>
 <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><ResourceIcon resourceKey="oil" size={14} />{player.oil.toLocaleString()} OIL</span>
 <span>💰 ${player.money.toLocaleString()}</span>
 </div>

 {/* Slot Tabs */}
 <div style={{ display: 'flex', gap: '2px', marginBottom: '12px' }}>
 {slotTabs.map(st => (
 <button key={st.slot} onClick={() => setCraftSlot(st.slot)} style={{
 flex: 1, padding: '6px 2px', fontSize: '8px', fontWeight: 700,
 fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
 border: `1px solid ${craftSlot === st.slot ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`,
 borderRadius: '3px', background: craftSlot === st.slot ? 'rgba(251,191,36,0.12)' : 'transparent',
 color: craftSlot === st.slot ? '#fbbf24' : '#64748b', cursor: 'pointer',
 }}>
 {st.label}
 </button>
 ))}
 </div>

 {/* Tier Grid */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '12px' }}>
 {TIER_ORDER.map(tier => {
 const tc = costTable[tier]
 const canAfford = player.scrap >= tc.scrap && player.oil >= tc.oil && player.money >= tc.money
 const preview = statPreview[craftSlot]?.[tier] || ''
 const imgUrl = getItemImagePath(tier as EquipTier, craftSlot, craftSlot === 'weapon' ? 'weapon' : 'armor', undefined)

 return (
 <div key={tier} style={{
 padding: '8px 6px', borderRadius: '6px', textAlign: 'center',
 background: canAfford ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
 border: `1px solid ${canAfford ? TIER_COLORS[tier] + '44' : 'rgba(255,255,255,0.04)'}`,
 opacity: canAfford ? 1 : 0.4,
 }}>
 <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
 {imgUrl ? (
 <img src={imgUrl} alt={TIER_LABELS[tier]} style={{ width: '56px', height: '56px', objectFit: 'contain', filter: `drop-shadow(0 2px 4px ${TIER_COLORS[tier]}30)` }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
 ) : (
 <span style={{ fontSize: '20px', opacity: 0.4 }}>{(SLOT_ICONS as any)[craftSlot]}</span>
 )}
 </div>
 <div style={{ fontSize: '10px', fontWeight: 800, color: TIER_COLORS[tier], fontFamily: 'var(--font-display)', marginBottom: '2px' }}>
 {TIER_LABELS[tier].split(' ')[0]}
 </div>
 <div style={{ fontSize: '7px', color: TIER_COLORS[tier], opacity: 0.7, marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
 {preview}
 </div>
 <div style={{ fontSize: '7px', color: '#475569', marginBottom: '6px', fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
 {tc.scrap} / {tc.oil} / ${tc.money}
 </div>
 <button
 disabled={!canAfford}
 onClick={() => doCraft(tier, craftSlot)}
 style={{
 width: '100%', padding: '5px', fontSize: '8px', fontWeight: 800,
 fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
 border: `1px solid ${canAfford ? TIER_COLORS[tier] : '#222'}`,
 borderRadius: '3px', cursor: canAfford ? 'pointer' : 'not-allowed',
 background: canAfford ? `${TIER_COLORS[tier]}22` : 'transparent',
 color: canAfford ? TIER_COLORS[tier] : '#333',
 }}
 >ROLL</button>
 </div>
 )
 })}
 </div>

 {/* Random Craft Section */}
 <div style={{
 padding: '10px', borderRadius: '6px', marginBottom: '12px',
 background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)',
 }}>
 <div style={{ fontSize: '9px', fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginBottom: '6px', textAlign: 'center' }}>
 RANDOM CRAFT // ANY SLOT, ANY SUBTYPE
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
 {TIER_ORDER.map(tier => {
 const tc = costTable[tier]
 const canAfford = player.scrap >= tc.scrap && player.oil >= tc.oil && player.money >= tc.money
 return (
 <button
 key={`rand-${tier}`}
 disabled={!canAfford}
 onClick={() => doRandomCraft(tier)}
 style={{
 padding: '5px 4px', fontSize: '8px', fontWeight: 800,
 fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
 border: `1px solid ${canAfford ? TIER_COLORS[tier] + '55' : '#222'}`,
 borderRadius: '3px', cursor: canAfford ? 'pointer' : 'not-allowed',
 background: canAfford ? 'rgba(251,191,36,0.08)' : 'transparent',
 color: canAfford ? TIER_COLORS[tier] : '#333',
 opacity: canAfford ? 1 : 0.4,
 }}
 >{TIER_LABELS[tier].split(' ')[0]}</button>
 )
 })}
 </div>
 </div>

 {/* Session Craft History */}
 {craftHistory.length > 0 && (
 <div style={{ marginBottom: '8px' }}>
 <div style={{
 fontSize: '9px', fontWeight: 700, color: '#94a3b8',
 fontFamily: 'var(--font-display)', letterSpacing: '0.1em',
 marginBottom: '6px', textAlign: 'center',
 }}>CRAFTED THIS SESSION ({craftHistory.length})</div>
 <div style={{
 display: 'flex', gap: '6px', overflowX: 'auto',
 padding: '4px 2px 8px', scrollbarWidth: 'thin',
 }}>
 {craftHistory.map((entry, idx) => {
 const ci = entry.item
 const tc = TIER_COLORS[ci.tier]
 const img = getItemImagePath(ci.tier, ci.slot, ci.category, ci.weaponSubtype)
 const mainStat = ci.stats.damage
 ? `DMG ${ci.stats.damage}`
 : ci.stats.armor
 ? `ARM ${ci.stats.armor}%`
 : ci.stats.critDamage
 ? `CDMG ${ci.stats.critDamage}%`
 : ci.stats.dodge
 ? `EVA ${ci.stats.dodge}%`
 : ci.stats.precision
 ? `ACC ${ci.stats.precision}%`
 : ''
 return (
 <motion.div
 key={ci.id}
 initial={{ opacity: 0, scale: 0.7, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 transition={{ delay: idx < 3 ? idx * 0.06 : 0, ...SPRINGS.snappy }}
 style={{
 minWidth: '80px', maxWidth: '80px', flexShrink: 0,
 background: 'rgba(0,0,0,0.4)', borderRadius: '6px',
 border: `1px solid ${entry.superforged ? '#fbbf2480' : tc + '40'}`,
 padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
 boxShadow: entry.superforged ? '0 0 8px rgba(251,191,36,0.2)' : undefined,
 }}
 title={ci.name}
 onClick={() => setCraftedItem(entry)}
 >
 <div style={{ height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2px' }}>
 {img ? (
 <img src={img} alt={ci.name} style={{ width: '24px', height: '24px', objectFit: 'contain', filter: `drop-shadow(0 1px 3px ${tc}40)` }} />
 ) : (
 <span style={{ fontSize: '18px', opacity: 0.4 }}>{SLOT_ICONS[ci.slot]}</span>
 )}
 </div>
 <div style={{ fontSize: '7px', fontWeight: 800, color: tc, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
 {entry.superforged ? '⚡' : ''}{TIER_LABELS[ci.tier].split(' ')[0]}
 </div>
 <div style={{ fontSize: '6px', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
 {ci.slot.toUpperCase()}
 </div>
 {mainStat && (
 <div style={{ fontSize: '6px', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
 {mainStat}
 </div>
 )}
 </motion.div>
 )
 })}
 </div>
 </div>
 )}

 <button
 onClick={() => setMode('normal')}
 style={{
 width: '100%', padding: '8px', fontSize: '9px', fontWeight: 600,
 fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
 background: 'transparent', color: '#475569',
 border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
 cursor: 'pointer',
 }}
 >CLOSE</button>
 </div>
 </GameModal>
 )
 })()}

 {/* Crafted Item Result Overlay */}
 <AnimatePresence>
 {craftedItem && (
 <motion.div
 key="craft-result-overlay"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 onClick={() => setCraftedItem(null)}
 style={{
 position: 'fixed', inset: 0, zIndex: 10001,
 background: 'rgba(0,0,0,0.75)',
 display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
 cursor: 'pointer',
 }}
 >
 {/* Header text */}
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15, ...SPRINGS.snappy }}
 style={{
 fontSize: '12px', fontWeight: 900,
 fontFamily: 'var(--font-display)',
 letterSpacing: '0.2em',
 color: craftedItem.superforged ? '#fbbf24' : TIER_COLORS[craftedItem.item.tier],
 textShadow: `0 0 20px ${craftedItem.superforged ? '#fbbf24' : TIER_COLORS[craftedItem.item.tier]}60`,
 marginBottom: '12px',
 }}
 >
 {craftedItem.superforged ? '⚡ SUPERFORGED!' : 'ITEM CRAFTED!'}
 </motion.div>

 {/* Item Card */}
 <motion.div
 initial={{ opacity: 0, scale: 0.3, rotateX: 45 }}
 animate={{ opacity: 1, scale: 1, rotateX: 0 }}
 exit={{ opacity: 0, scale: 0.5 }}
 transition={SPRINGS.snappy}
 onClick={e => e.stopPropagation()}
 style={{
 width: '260px',
 background: 'rgba(12,16,24,0.95)',
 border: `2px solid ${TIER_COLORS[craftedItem.item.tier]}60`,
 borderRadius: '10px',
 padding: '20px 16px',
 boxShadow: `0 0 40px ${TIER_COLORS[craftedItem.item.tier]}30, 0 20px 60px rgba(0,0,0,0.5)`,
 }}
 >
 {/* Item image */}
 {(() => {
 const item = craftedItem.item
 const tierColor = TIER_COLORS[item.tier]
 const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
 return (
 <>
 <div style={{
 display: 'flex', flexDirection: 'column', alignItems: 'center',
 padding: '12px 0', marginBottom: '12px',
 background: `radial-gradient(ellipse at center, ${tierColor}15 0%, transparent 70%)`,
 borderRadius: '8px',
 }}>
 <motion.div
 animate={craftedItem.superforged ? {
 filter: ['drop-shadow(0 0 8px #fbbf2440)', 'drop-shadow(0 0 16px #fbbf2480)', 'drop-shadow(0 0 8px #fbbf2440)'],
 } : {}}
 transition={{ duration: 1.5, repeat: Infinity }}
 >
 {imgUrl ? (
 <img src={imgUrl} alt={item.name} style={{
 width: '64px', height: '64px', objectFit: 'contain',
 filter: `drop-shadow(0 4px 16px ${tierColor}50)`,
 }} />
 ) : (
 <div style={{ fontSize: '48px', opacity: 0.5 }}>{SLOT_ICONS[item.slot]}</div>
 )}
 </motion.div>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.3 }}
 style={{
 fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)',
 color: tierColor, letterSpacing: '0.08em', marginTop: '8px',
 textShadow: `0 0 12px ${tierColor}50`,
 }}
 >{item.name}</motion.div>
 <div style={{
 fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)',
 color: '#64748b', letterSpacing: '0.1em', marginTop: '2px',
 }}>{TIER_LABELS[item.tier]} • {item.slot.toUpperCase()}</div>
 </div>

 {/* Stats */}
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.4 }}
 style={{
 background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
 padding: '10px 12px', marginBottom: '12px',
 border: '1px solid rgba(255,255,255,0.04)',
 }}
 >
 {[
 item.stats.damage && { label: 'DAMAGE', val: `${item.stats.damage}`, color: '#f87171' },
 item.stats.critRate && { label: 'CRIT RATE', val: `${item.stats.critRate}%`, color: '#fb923c' },
 item.stats.critDamage && { label: 'CRIT DMG', val: `+${item.stats.critDamage}%`, color: '#fb923c' },
 item.stats.armor && { label: 'ARMOR', val: `+${item.stats.armor}%`, color: '#94a3b8' },
 item.stats.dodge && { label: 'EVASION', val: `+${item.stats.dodge}%`, color: '#34d399' },
 item.stats.precision && { label: 'ACCURACY', val: `+${item.stats.precision}%`, color: '#38bdf8' },
 ].filter(Boolean).map((s: any, i) => (
 <motion.div
 key={s.label}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 0.5 + i * 0.08 }}
 style={{
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)',
 }}
 >
 <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>{s.label}</span>
 <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{s.val}</span>
 </motion.div>
 ))}
 </motion.div>

 {/* Superforged badge */}
 {craftedItem.superforged && (
 <motion.div
 initial={{ opacity: 0, scale: 0 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.7, type: 'spring', stiffness: 400, damping: 15 }}
 style={{
 textAlign: 'center', padding: '6px 12px', marginBottom: '8px',
 background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
 borderRadius: '4px', fontSize: '9px', fontWeight: 900,
 fontFamily: 'var(--font-display)', color: '#fbbf24',
 letterSpacing: '0.12em',
 }}
 >⚡ SUPERFORGED +10% ALL STATS</motion.div>
 )}

 {/* Close hint */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 0.5 }}
 transition={{ delay: 0.8 }}
 style={{
 textAlign: 'center', fontSize: '8px', fontWeight: 600,
 fontFamily: 'var(--font-display)', color: '#475569',
 letterSpacing: '0.1em',
 }}
 >CLICK ANYWHERE TO CLOSE</motion.div>
 </>
 )
 })()}
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>


 {/* DISARM MODE info */}
 {mode === 'disarm' && (
 <div style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center', padding: '6px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px', marginBottom: '6px' }}>
          DISARM MODE -- Click any unequipped item below to dismantle for scrap
 </div>
 )}

 {/* EQUIPMENT LIST */}
 <div className="inv-section">
 <div className="inv-section__title">?T EQUIPMENT</div>
 
 {renderEquipmentCategoryRow('weapon', 'Weapon')}
 {/* We skip rendering AMMO here since it's not an item in inventoryStore but rather a boolean/count in playerStore. Ammo is managed just via the Loadout slot click logic. */}
 {renderEquipmentCategoryRow('helmet', 'Helmet')}
 {renderEquipmentCategoryRow('chest', 'Chest')}
 {renderEquipmentCategoryRow('legs', 'Legs')}
 {renderEquipmentCategoryRow('gloves', 'Gloves')}
 {renderEquipmentCategoryRow('boots', 'Boots')}
 
 {inventory.items.length === 0 && (
 <div className="inv-empty">You have no equipment.</div>
 )}
 </div>

      {/* ==== Item Interaction Modal -- Premium ==== */}
 {selectedItem && (
 <GameModal isOpen={true} onClose={() => setSelectedItem(null)} size="sm" glowColor={TIER_COLORS[selectedItem.tier]}>

 {/* Hero Image Area */}
 <div style={{
 display: 'flex', flexDirection: 'column', alignItems: 'center',
 padding: '16px 0 12px', marginBottom: '12px',
 background: `radial-gradient(ellipse at center, ${TIER_COLORS[selectedItem.tier]}10 0%, transparent 70%)`,
 }}>
 {(() => {
 const imgUrl = getItemImagePath(selectedItem.tier, selectedItem.slot, selectedItem.category, selectedItem.weaponSubtype);
 return imgUrl ? (
 <img src={imgUrl} alt={selectedItem.name} style={{
 width: '72px', height: '72px', objectFit: 'contain',
 filter: `drop-shadow(0 4px 16px ${TIER_COLORS[selectedItem.tier]}40)`,
 marginBottom: '8px',
 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
 ) : (
 <div style={{ fontSize: '48px', marginBottom: '8px', opacity: 0.5 }}>
 {selectedItem.slot === 'helmet' ? '\u2302' : selectedItem.slot === 'chest' ? '\u2666' : '\u2694'}
 </div>
 );
 })()}
 <div style={{
 fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)',
 color: TIER_COLORS[selectedItem.tier], letterSpacing: '0.08em',
 textShadow: `0 0 12px ${TIER_COLORS[selectedItem.tier]}50`,
 }}>{selectedItem.name}</div>
 <div style={{
 fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)',
 color: '#64748b', letterSpacing: '0.1em', marginTop: '2px',
 }}>{TIER_LABELS[selectedItem.tier]} \u2022 {selectedItem.slot.toUpperCase()}</div>
 </div>

 {/* Stat Grid */}
 <div style={{
 background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px 12px',
 marginBottom: '16px', border: '1px solid rgba(255,255,255,0.04)',
 }}>
 {[
 selectedItem.stats.damage && { label: 'DAMAGE', val: `${selectedItem.stats.damage}`, color: '#f87171' },
 selectedItem.stats.critRate && { label: 'CRIT RATE', val: `${selectedItem.stats.critRate}%`, color: '#fb923c' },
 selectedItem.stats.critDamage && { label: 'CRIT DMG', val: `+${selectedItem.stats.critDamage}%`, color: '#fb923c' },
 selectedItem.stats.armor && { label: 'ARMOR', val: `+${selectedItem.stats.armor}%`, color: '#94a3b8' },
 selectedItem.stats.dodge && { label: 'EVASION', val: `+${selectedItem.stats.dodge}%`, color: '#34d399' },
 selectedItem.stats.precision && { label: 'ACCURACY', val: `+${selectedItem.stats.precision}%`, color: '#38bdf8' },
 ].filter(Boolean).map((s: any) => (
 <div key={s.label} style={{
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)',
 }}>
 <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>{s.label}</span>
 <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{s.val}</span>
 </div>
 ))}
 {/* Durability */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '4px', paddingTop: '6px' }}>
 <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>DURABILITY</span>
 <span style={{ color: (selectedItem.durability ?? 100) < 30 ? '#ef4444' : (selectedItem.durability ?? 100) < 60 ? '#f59e0b' : '#22d38a', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{(selectedItem.durability ?? 100).toFixed(0)}%</span>
 </div>
 </div>

 {/* Action Buttons */}
 <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
 <button
 onClick={handleEquipToggle}
 style={{
 width: '100%', padding: '10px', fontSize: '11px', fontWeight: 800,
 fontFamily: 'var(--font-display)', letterSpacing: '0.1em',
 border: 'none', borderRadius: '6px', cursor: 'pointer',
 background: selectedItem.equipped
 ? 'linear-gradient(135deg, #f59e0b, #d97706)'
 : 'linear-gradient(135deg, #84cc16, #65a30d)',
 color: '#0a0e17',
 boxShadow: selectedItem.equipped
 ? '0 0 16px rgba(245,158,11,0.3)'
 : '0 0 16px rgba(132,204,22,0.3)',
 }}
 >
 {selectedItem.equipped ? 'UNEQUIP' : 'EQUIP'}
 </button>

 <div style={{ display: 'flex', gap: '6px' }}>
 <button
 style={{
 flex: 1, padding: '8px', fontSize: '9px', fontWeight: 700,
 fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
 background: 'rgba(59,130,246,0.12)', color: selectedItem.equipped ? '#334155' : '#3b82f6',
 border: `1px solid ${selectedItem.equipped ? '#1e293b' : 'rgba(59,130,246,0.3)'}`,
 borderRadius: '4px', cursor: selectedItem.equipped ? 'not-allowed' : 'pointer',
 opacity: selectedItem.equipped ? 0.4 : 1,
 }}
 disabled={selectedItem.equipped}
 onClick={() => {
 if (selectedItem.equipped) return
 const gain = TIER_SELL_PRICE[selectedItem.tier]
 inventory.removeItem(selectedItem.id)
 usePlayerStore.setState(s => ({ money: s.money + gain }))
 ui.addFloatingText(`SOLD +$${gain.toLocaleString()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
 setSelectedItem(null)
 }}
 >
 SELL ${TIER_SELL_PRICE[selectedItem.tier].toLocaleString()}
 </button>

 <button
 style={{
 flex: 1, padding: '8px', fontSize: '9px', fontWeight: 700,
 fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
 background: 'rgba(245,158,11,0.1)', color: selectedItem.equipped ? '#334155' : '#f59e0b',
 border: `1px solid ${selectedItem.equipped ? '#1e293b' : 'rgba(245,158,11,0.3)'}`,
 borderRadius: '4px', cursor: selectedItem.equipped ? 'not-allowed' : 'pointer',
 opacity: selectedItem.equipped ? 0.4 : 1,
 }}
 disabled={selectedItem.equipped}
 onClick={handleDisarm}
 >
 DISARM (+{SCRAP_VALUES[selectedItem.tier]} SCRAP)
 </button>
 </div>

 <button
 onClick={() => setSelectedItem(null)}
 style={{
 width: '100%', padding: '6px', fontSize: '9px', fontWeight: 600,
 fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
 background: 'transparent', color: '#475569',
 border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
 cursor: 'pointer',
 }}
 >
 CLOSE
 </button>
 </div>
 </GameModal>
 )}

      {/* ==== Slot Picker Modal (Inventory) ==== */}
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
 <img src={imgUrl} alt={currentlyEquipped.name} style={{ width: '56px', height: '56px', objectFit: 'contain', filter: `drop-shadow(0 2px 6px ${TIER_COLORS[currentlyEquipped.tier]}40)` }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
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
 cursor: 'pointer', transition: 'all 150ms ease',
 }}
 onClick={() => { inventory.equipItem(item.id); setPickerSlot(null) }}
 onMouseEnter={e => { e.currentTarget.style.background = 'rgba(132,204,22,0.06)'; e.currentTarget.style.borderColor = `${TIER_COLORS[item.tier]}66` }}
 onMouseLeave={e => { e.currentTarget.style.background = 'rgba(8,12,18,0.8)'; e.currentTarget.style.borderColor = `${TIER_COLORS[item.tier]}33` }}
 >
 <div style={{ width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 {imgUrl ? (
 <img src={imgUrl} alt={item.name} style={{ width: '48px', height: '48px', objectFit: 'contain', filter: `drop-shadow(0 2px 4px ${TIER_COLORS[item.tier]}30)` }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
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

      {/* ── AMMO PICKER MODAL ─────────────────────── */}
      {showAmmoPicker && (() => {
        const ammoTypes: Array<{ key: 'none' | 'green' | 'blue' | 'purple' | 'red'; label: string; color: string; bonus: string }> = [
          { key: 'green',  label: 'Green Ammo',  color: '#10b981', bonus: '\u00d71.1 DMG' },
          { key: 'blue',   label: 'Blue Ammo',   color: '#3b82f6', bonus: '\u00d71.2 DMG' },
          { key: 'purple', label: 'Purple Ammo', color: '#a855f7', bonus: '\u00d71.4 DMG' },
          { key: 'red',    label: 'Red Ammo',    color: '#ef4444', bonus: '\u00d71.4 DMG +10% CRIT' },
        ]
        return (
          <div className="inv-modal-overlay" onClick={() => setShowAmmoPicker(false)}>
            <div className="inv-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px', width: '90%' }}>
              <div className="inv-modal__title" style={{ color: '#fbbf24' }}>SELECT AMMO</div>
              <div style={{ padding: '10px 12px', marginBottom: '10px', background: player.equippedAmmo !== 'none' ? 'rgba(251,191,36,0.06)' : 'rgba(71,85,105,0.1)', border: `1px solid ${player.equippedAmmo !== 'none' ? 'rgba(251,191,36,0.2)' : 'rgba(71,85,105,0.2)'}`, borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginBottom: '4px' }}>CURRENTLY EQUIPPED</div>
                <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-display)', color: player.equippedAmmo === 'none' ? '#475569' : '#fbbf24' }}>
                  {player.equippedAmmo === 'none' ? 'No Ammo' : `${player.equippedAmmo.toUpperCase()} AMMO`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                {ammoTypes.map(at => {
                  const count = player[`${at.key}Bullets` as keyof typeof player] as number
                  const isEquipped = player.equippedAmmo === at.key
                  const hasAmmo = count > 0
                  return (
                    <div key={at.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '5px', background: isEquipped ? 'rgba(132,204,22,0.06)' : 'rgba(8,12,18,0.8)', border: `1px solid ${isEquipped ? 'rgba(132,204,22,0.3)' : hasAmmo ? `${at.color}33` : 'rgba(71,85,105,0.15)'}`, cursor: hasAmmo ? 'pointer' : 'not-allowed', opacity: hasAmmo ? 1 : 0.4, transition: 'all 150ms ease' }} onClick={() => { if (hasAmmo) { player.equipAmmo(at.key); setShowAmmoPicker(false) } }}>
                      <div style={{ width: '36px', height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={`/assets/items/ammo_${at.key}.png`} alt={at.label} style={{ width: '30px', height: '30px', objectFit: 'contain', filter: `drop-shadow(0 2px 6px ${at.color}40)` }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', fontWeight: 700, color: at.color }}>{at.label}</div>
                        <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>{at.bonus}</div>
                        <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>Stock: <span style={{ color: hasAmmo ? at.color : '#ef4444', fontWeight: 700 }}>{count.toLocaleString()}</span></div>
                      </div>
                      <div style={{ fontSize: '8px', fontWeight: 700, fontFamily: 'var(--font-display)', flexShrink: 0, color: isEquipped ? '#84cc16' : hasAmmo ? at.color : '#475569' }}>
                        {isEquipped ? 'EQUIPPED' : hasAmmo ? 'EQUIP' : 'EMPTY'}
                      </div>
                    </div>
                  )
                })}
              </div>
              {player.equippedAmmo !== 'none' && (
                <button onClick={() => { player.equipAmmo('none'); setShowAmmoPicker(false) }} style={{ width: '100%', padding: '8px', marginTop: '8px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', cursor: 'pointer' }}>UNEQUIP AMMO</button>
              )}
              <button onClick={() => setShowAmmoPicker(false)} style={{ width: '100%', padding: '8px', marginTop: '6px', fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', cursor: 'pointer' }}>CLOSE</button>
            </div>
          </div>
        )
      })()}
 </div>
 )
}
