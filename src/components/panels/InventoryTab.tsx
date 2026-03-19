import { useState, useEffect, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import { usePrestigeStore, getPrestigeItemImage } from '../../stores/prestigeStore'
import InventorySummary from '../shared/InventorySummary'
import LootBoxOpener from '../shared/LootBoxOpener'
import InventoryCraftModal from './inventory/InventoryCraftModal'
import InventoryGearDisplay from './inventory/InventoryGearDisplay'
import { SlotPickerModal, AmmoPickerModal } from './profile/ProfileModals'
import GameModal from '../shared/GameModal'
import {
  useInventoryStore,
  TIER_COLORS,
  TIER_LABELS,
  TIER_ORDER,
  SLOT_ICONS,
  getItemImagePath,
  SCRAP_VALUES,
  type EquipItem,
  type EquipSlot,
  type EquipTier,
} from '../../stores/inventoryStore'

const TIER_SELL_PRICE: Record<EquipTier, number> = {
  t1: 1200, t2: 5000, t3: 25000, t4: 90000, t5: 280000, t6: 830000
}

export default function InventoryTab() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()

  const [selectedItem, setSelectedItem] = useState<EquipItem | null>(null)
  const [mode, setMode] = useState<'normal' | 'craft' | 'disarm'>('normal')
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null)
  const [showAmmoPicker, setShowAmmoPicker] = useState(false)
  const [showLootBox, setShowLootBox] = useState(false)
  const [showMilitaryBox, setShowMilitaryBox] = useState(false)

  useEffect(() => {
    const onClose = () => { setSelectedItem(null); setPickerSlot(null); setShowAmmoPicker(false) }
    window.addEventListener('xwar-close-modal', onClose)
    return () => window.removeEventListener('xwar-close-modal', onClose)
  }, [])

  const handleLootBoxOpen = useCallback(() => inventory.openLootBox(), [inventory])
  const handleMilitaryBoxOpen = useCallback(() => inventory.openMilitaryBox(), [inventory])

  const handleEquipToggle = () => {
    if (!selectedItem) return
    if (selectedItem.equipped) inventory.unequipItem(selectedItem.id)
    else inventory.equipItem(selectedItem.id)
    setSelectedItem(null); setPickerSlot(null)
  }

  const handleDisarm = () => {
    if (!selectedItem || selectedItem.equipped) return
    const scrapGain = inventory.dismantleItem(selectedItem.id)
    player.addScrap(scrapGain)
    setSelectedItem(null)
  }

  const getSortedItemsForSlot = (slot: EquipSlot) =>
    inventory.items.filter(i => i.location === 'inventory' && i.slot === slot).sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))

  const renderEquipmentCategoryRow = (slot: EquipSlot, title: string) => {
    const items = getSortedItemsForSlot(slot)
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</div>
        <div className="ptab-gear-grid">
          {items.map(item => {
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
              <div key={item.id} className="ptab-gear-card" style={{
                borderColor: item.equipped ? 'rgba(132,204,22,0.4)' : `${tierColor}30`,
                '--card-tier-color': tierColor,
                boxShadow: item.equipped ? '0 0 8px rgba(132,204,22,0.15)' : undefined,
              } as React.CSSProperties}
              onClick={() => {
                if (mode === 'disarm' && !item.equipped) {
                  const scrapGain = inventory.dismantleItem(item.id)
                  player.addScrap(scrapGain)
                  ui.addFloatingText(`+${scrapGain} SCRAP`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
                } else { setSelectedItem(item) }
              }}
              title={item.equipped ? `${item.name} (EQUIPPED)` : item.name}
              >
                {item.equipped && <div style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '7px', fontWeight: 900, color: '#84cc16', letterSpacing: '0.08em' }}>EQ</div>}
                <div className="ptab-gear-card__top">
                  <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
                  <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
                </div>
                <div className="ptab-gear-card__img-wrap">
                  {imgUrl ? <img src={imgUrl} alt={item.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} />
                    : <div style={{ fontSize: '28px', opacity: 0.4, filter: `drop-shadow(0 0 4px ${tierColor})` }}>
                        <img src={getItemImagePath('t1', item.slot, item.category) || ''} alt={item.slot} style={{ width: '28px', height: '28px', objectFit: 'contain', opacity: 0.5, filter: 'grayscale(100%)' }} />
                      </div>}
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
        </div>
      </div>
    )
  }

  return (
    <div className="inv-tab">
      <InventorySummary />

      {/* CRAFT & DISARM ACTION BAR */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <button onClick={() => setMode(mode === 'craft' ? 'normal' : 'craft')} style={{
          flex: 1, padding: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px',
          border: `2px solid ${mode === 'craft' ? '#fbbf24' : 'rgba(251,191,36,0.3)'}`,
          borderRadius: '4px', cursor: 'pointer',
          background: mode === 'craft' ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.03)',
          color: mode === 'craft' ? '#fbbf24' : '#b89a3a',
        }}>CRAFT</button>
        <button onClick={() => setMode(mode === 'disarm' ? 'normal' : 'disarm')} style={{
          flex: 1, padding: '10px', fontSize: '12px', fontWeight: 900, letterSpacing: '1px',
          border: `2px solid ${mode === 'disarm' ? '#ef4444' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: '4px', cursor: 'pointer',
          background: mode === 'disarm' ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.03)',
          color: mode === 'disarm' ? '#ef4444' : '#a33a3a',
        }}>DISARM</button>
      </div>

      {/* Loot Boxes */}
      <div className="inv-section">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,12,18,0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(34,211,138,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/assets/items/lootbox_civilian.png" alt="Civilian Loot Box" style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(34,211,138,0.3))' }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#22d38a', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>CIVILIAN</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{player.lootBoxes}</div>
              </div>
            </div>
            <button className="comp-action comp-action--produce" style={{ margin: 0, width: 'auto', padding: '6px 16px', fontWeight: 'bold', fontSize: '11px' }} disabled={player.lootBoxes <= 0} onClick={() => player.lootBoxes > 0 && setShowLootBox(true)}>Open</button>
          </div>
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,12,18,0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/assets/items/lootbox_military.png" alt="Military Loot Box" style={{ width: '36px', height: '36px', objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(239,68,68,0.3))' }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>MILITARY</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{player.militaryBoxes}</div>
              </div>
            </div>
            <button className="comp-action comp-action--produce" style={{ margin: 0, width: 'auto', padding: '6px 16px', fontWeight: 'bold', fontSize: '11px', borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }} disabled={player.militaryBoxes <= 0} onClick={() => player.militaryBoxes > 0 && setShowMilitaryBox(true)}>Open</button>
          </div>
        </div>
      </div>

      <LootBoxOpener isOpen={showLootBox} onClose={() => setShowLootBox(false)} onOpenBox={handleLootBoxOpen} boxType="civilian" />
      <LootBoxOpener isOpen={showMilitaryBox} onClose={() => setShowMilitaryBox(false)} onOpenBox={handleMilitaryBoxOpen} boxType="military" />

      {/* Equipped Gear Display */}
      <InventoryGearDisplay onPickSlot={setPickerSlot} onPickAmmo={() => setShowAmmoPicker(true)} />

      {/* Craft Modal */}
      {mode === 'craft' && <InventoryCraftModal onClose={() => setMode('normal')} />}

      {/* Disarm Mode Info */}
      {mode === 'disarm' && (
        <div style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center', padding: '6px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px', marginBottom: '6px' }}>
          DISARM MODE -- Click any unequipped item below to dismantle for scrap
        </div>
      )}

      {/* Equipment List */}
      <div className="inv-section">
        <div className="inv-section__title">🎽 EQUIPMENT</div>
        {renderEquipmentCategoryRow('weapon', 'Weapon')}
        {renderEquipmentCategoryRow('helmet', 'Helmet')}
        {renderEquipmentCategoryRow('chest', 'Chest')}
        {renderEquipmentCategoryRow('legs', 'Legs')}
        {renderEquipmentCategoryRow('gloves', 'Gloves')}
        {renderEquipmentCategoryRow('boots', 'Boots')}
        {inventory.items.filter(i => i.location === 'inventory').length === 0 && <div className="inv-empty">You have no equipment.</div>}
      </div>

      {/* Item Interaction Modal */}
      {selectedItem && (
        <GameModal isOpen={true} onClose={() => setSelectedItem(null)} size="sm" glowColor={TIER_COLORS[selectedItem.tier]}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 12px', marginBottom: '12px', background: `radial-gradient(ellipse at center, ${TIER_COLORS[selectedItem.tier]}10 0%, transparent 70%)` }}>
            {(() => {
              const imgUrl = getItemImagePath(selectedItem.tier, selectedItem.slot, selectedItem.category, selectedItem.weaponSubtype);
              return imgUrl ? <img src={imgUrl} alt={selectedItem.name} style={{ width: '72px', height: '72px', objectFit: 'contain', filter: `drop-shadow(0 4px 16px ${TIER_COLORS[selectedItem.tier]}40)`, marginBottom: '8px' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                : <div style={{ fontSize: '48px', marginBottom: '8px', opacity: 0.5 }}>{selectedItem.slot === 'helmet' ? '\u2302' : selectedItem.slot === 'chest' ? '\u2666' : '\u2694'}</div>;
            })()}
            <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', color: TIER_COLORS[selectedItem.tier], letterSpacing: '0.08em', textShadow: `0 0 12px ${TIER_COLORS[selectedItem.tier]}50` }}>{selectedItem.name}</div>
            <div style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', color: '#64748b', letterSpacing: '0.1em', marginTop: '2px' }}>{TIER_LABELS[selectedItem.tier]} {'\u2022'} {selectedItem.slot.toUpperCase()}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
            {[
              selectedItem.stats.damage && { label: 'DAMAGE', val: `${selectedItem.stats.damage}`, color: '#f87171' },
              selectedItem.stats.critRate && { label: 'CRIT RATE', val: `${selectedItem.stats.critRate}%`, color: '#fb923c' },
              selectedItem.stats.critDamage && { label: 'CRIT DMG', val: `+${selectedItem.stats.critDamage}%`, color: '#fb923c' },
              selectedItem.stats.armor && { label: 'ARMOR', val: `+${selectedItem.stats.armor}%`, color: '#94a3b8' },
              selectedItem.stats.dodge && { label: 'EVASION', val: `+${selectedItem.stats.dodge}%`, color: '#34d399' },
              selectedItem.stats.precision && { label: 'ACCURACY', val: `+${selectedItem.stats.precision}%`, color: '#38bdf8' },
            ].filter(Boolean).map((s: any) => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{s.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '4px', paddingTop: '6px' }}>
              <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>DURABILITY</span>
              <span style={{ color: (selectedItem.durability ?? 100) < 30 ? '#ef4444' : (selectedItem.durability ?? 100) < 60 ? '#f59e0b' : '#22d38a', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{(selectedItem.durability ?? 100).toFixed(0)}%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button onClick={handleEquipToggle} style={{
              width: '100%', padding: '10px', fontSize: '11px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.1em', border: 'none', borderRadius: '6px', cursor: 'pointer',
              background: selectedItem.equipped ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #84cc16, #65a30d)',
              color: '#0a0e17', boxShadow: selectedItem.equipped ? '0 0 16px rgba(245,158,11,0.3)' : '0 0 16px rgba(132,204,22,0.3)',
            }}>{selectedItem.equipped ? 'UNEQUIP' : 'EQUIP'}</button>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={{ flex: 1, padding: '8px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'rgba(59,130,246,0.12)', color: selectedItem.equipped ? '#334155' : '#3b82f6', border: `1px solid ${selectedItem.equipped ? '#1e293b' : 'rgba(59,130,246,0.3)'}`, borderRadius: '4px', cursor: selectedItem.equipped ? 'not-allowed' : 'pointer', opacity: selectedItem.equipped ? 0.4 : 1 }} disabled={selectedItem.equipped}
                onClick={() => { if (selectedItem.equipped) return; const gain = TIER_SELL_PRICE[selectedItem.tier]; inventory.removeItem(selectedItem.id); usePlayerStore.setState(s => ({ money: s.money + gain })); ui.addFloatingText(`SOLD +$${gain.toLocaleString()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b'); setSelectedItem(null) }}
              >SELL ${TIER_SELL_PRICE[selectedItem.tier].toLocaleString()}</button>
              <button style={{ flex: 1, padding: '8px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'rgba(245,158,11,0.1)', color: selectedItem.equipped ? '#334155' : '#f59e0b', border: `1px solid ${selectedItem.equipped ? '#1e293b' : 'rgba(245,158,11,0.3)'}`, borderRadius: '4px', cursor: selectedItem.equipped ? 'not-allowed' : 'pointer', opacity: selectedItem.equipped ? 0.4 : 1 }} disabled={selectedItem.equipped} onClick={handleDisarm}
              >DISARM (+{SCRAP_VALUES[selectedItem.tier]} SCRAP)</button>
            </div>
            <button onClick={() => setSelectedItem(null)} style={{ width: '100%', padding: '6px', fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', cursor: 'pointer' }}>CLOSE</button>
          </div>
        </GameModal>
      )}

      {/* Slot/Ammo Picker Modals — reused from ProfileModals */}
      {pickerSlot && <SlotPickerModal slot={pickerSlot} onClose={() => setPickerSlot(null)} />}
      {showAmmoPicker && <AmmoPickerModal onClose={() => setShowAmmoPicker(false)} />}
    </div>
  )
}
