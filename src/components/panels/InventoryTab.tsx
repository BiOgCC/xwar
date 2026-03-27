import { useState, useEffect, useCallback } from 'react'
import { getStatIcon } from '../shared/StatIcon'
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
  WEAPON_SUBTYPES,
  generateStats,
  type EquipItem,
  type EquipSlot,
  type EquipTier,
} from '../../stores/inventoryStore'

const TIER_SELL_PRICE: Record<EquipTier, number> = {
  t1: 1200, t2: 5000, t3: 25000, t4: 90000, t5: 280000, t6: 830000, t7: 2500000
}

export default function InventoryTab() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()

  const [selectedItem, setSelectedItem] = useState<EquipItem | null>(null)
  const [mode, setMode] = useState<'normal' | 'craft' | 'dismantle'>('normal')
  const [pickerSlot, setPickerSlot] = useState<EquipSlot | null>(null)
  const [showAmmoPicker, setShowAmmoPicker] = useState(false)
  const [showLootBox, setShowLootBox] = useState(false)
  const [showMilitaryBox, setShowMilitaryBox] = useState(false)
  const [showSupplyBox, setShowSupplyBox] = useState(false)

  // Dismantle panel state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [collapsedTiers, setCollapsedTiers] = useState<Set<EquipTier>>(new Set())
  const [isDismantling, setIsDismantling] = useState(false)

  useEffect(() => {
    inventory.fetchInventory()
    const onClose = () => { setSelectedItem(null); setPickerSlot(null); setShowAmmoPicker(false) }
    window.addEventListener('xwar-close-modal', onClose)
    return () => window.removeEventListener('xwar-close-modal', onClose)
  }, [])

  // Reset selection when leaving dismantle mode
  useEffect(() => {
    if (mode !== 'dismantle') {
      setSelectedIds(new Set())
      setCollapsedTiers(new Set())
    }
  }, [mode])

  const handleLootBoxOpen = useCallback(() => inventory.openLootBox(), [inventory])
  const handleMilitaryBoxOpen = useCallback(() => inventory.openMilitaryBox(), [inventory])
  const handleSupplyBoxOpen = useCallback(async () => inventory.openSupplyBox(), [inventory])

  const handleEquipToggle = async () => {
    if (!selectedItem) return
    if (selectedItem.equipped) await inventory.unequipItem(selectedItem.id)
    else await inventory.equipItem(selectedItem.id)
    setSelectedItem(null); setPickerSlot(null)
  }

  const handleDisarm = async () => {
    if (!selectedItem || selectedItem.equipped) return
    const r = await inventory.dismantleItem(selectedItem.id)
    if (r.success) {
      ui.addFloatingText(`+${r.scrapGained} SCRAP`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
    }
    setSelectedItem(null)
  }

  // ---------- Dismantle panel helpers ----------
  const getDismantleItems = () =>
    inventory.items.filter(i => i.location === 'inventory' && !i.equipped)

  const getItemsByTier = (tier: EquipTier) =>
    getDismantleItems().filter(i => i.tier === tier).sort((a, b) => a.slot.localeCompare(b.slot))

  const toggleItemSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTierSelection = (tier: EquipTier) => {
    const tierItems = getItemsByTier(tier)
    const tierIds = tierItems.map(i => i.id)
    const allSelected = tierIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        tierIds.forEach(id => next.delete(id))
      } else {
        tierIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const toggleTierCollapse = (tier: EquipTier) => {
    setCollapsedTiers(prev => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  const handleDismantleAll = async () => {
    if (selectedIds.size === 0 || isDismantling) return
    setIsDismantling(true)
    let totalScrap = 0
    let count = 0
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      const r = await inventory.dismantleItem(id)
      if (r.success) {
        totalScrap += r.scrapGained
        count++
      }
    }
    setSelectedIds(new Set())
    setIsDismantling(false)
    if (count > 0) {
      ui.addFloatingText(`+${totalScrap.toLocaleString()} SCRAP (${count} items)`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
    }
  }

  const totalSelectedScrap = Array.from(selectedIds).reduce((sum, id) => {
    const item = inventory.items.find(i => i.id === id)
    return sum + (item ? (SCRAP_VALUES[item.tier] || 0) : 0)
  }, 0)

  // ---------- Dismantle panel render ----------
  const renderDismantlePanel = () => {
    const dismantleItems = getDismantleItems()
    if (dismantleItems.length === 0) {
      return (
        <div className="inv-dismantle-panel">
          <div className="inv-dismantle-empty">No unequipped items to dismantle.</div>
        </div>
      )
    }

    const tiersWithItems = TIER_ORDER.filter(t => getItemsByTier(t).length > 0)

    return (
      <div className="inv-dismantle-panel">
        <div className="inv-dismantle-header">
          <span className="inv-dismantle-header__title">⚙ SELECT ITEMS TO DISMANTLE</span>
          <span className="inv-dismantle-header__count">{selectedIds.size} selected</span>
        </div>

        {tiersWithItems.map(tier => {
          const tierItems = getItemsByTier(tier)
          const tierColor = TIER_COLORS[tier]
          const allSelected = tierItems.every(i => selectedIds.has(i.id))
          const someSelected = tierItems.some(i => selectedIds.has(i.id))
          const isCollapsed = collapsedTiers.has(tier)
          const tierScrap = SCRAP_VALUES[tier]
          const selectedInTier = tierItems.filter(i => selectedIds.has(i.id)).length

          return (
            <div key={tier} className="inv-dismantle-tier" style={{ '--tier-color': tierColor } as React.CSSProperties}>
              <div className="inv-dismantle-tier__header" onClick={() => toggleTierCollapse(tier)}>
                <div className="inv-dismantle-tier__left">
                  <span className="inv-dismantle-tier__arrow" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                  <span className="inv-dismantle-tier__dot" style={{ background: tierColor }} />
                  <span className="inv-dismantle-tier__label" style={{ color: tierColor }}>{TIER_LABELS[tier]}</span>
                  <span className="inv-dismantle-tier__count">({tierItems.length})</span>
                  {selectedInTier > 0 && <span className="inv-dismantle-tier__selected">✓{selectedInTier}</span>}
                </div>
                <button
                  className={`inv-dismantle-tier__select-all ${allSelected ? 'inv-dismantle-tier__select-all--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleTierSelection(tier) }}
                  style={{ borderColor: `${tierColor}60`, color: allSelected ? '#0a0e17' : tierColor, background: allSelected ? tierColor : `${tierColor}15` }}
                >
                  {allSelected ? '✓ ALL' : `SELECT ALL (${tierScrap * tierItems.length} scrap)`}
                </button>
              </div>
              {!isCollapsed && (
                <div className="inv-dismantle-grid">
                  {tierItems.map(item => {
                    const isSelected = selectedIds.has(item.id)
                    const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
                    return (
                      <div
                        key={item.id}
                        className={`inv-dismantle-item ${isSelected ? 'inv-dismantle-item--selected' : ''}`}
                        style={{
                          borderColor: isSelected ? tierColor : `${tierColor}25`,
                          boxShadow: isSelected ? `0 0 10px ${tierColor}30, inset 0 0 12px ${tierColor}08` : undefined,
                        }}
                        onClick={() => toggleItemSelection(item.id)}
                      >
                        {isSelected && <div className="inv-dismantle-item__check" style={{ background: tierColor }}>✓</div>}
                        <div className="inv-dismantle-item__img-wrap">
                          {imgUrl
                            ? <img src={imgUrl} alt={item.name} className="inv-dismantle-item__img" onError={e => { e.currentTarget.style.display = 'none' }} />
                            : <span style={{ fontSize: '20px', opacity: 0.4 }}>{SLOT_ICONS[item.slot]}</span>
                          }
                        </div>
                        <div className="inv-dismantle-item__name">{item.name}</div>
                        <div className="inv-dismantle-item__scrap" style={{ color: '#f59e0b' }}>+{tierScrap}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Footer — Dismantle All */}
        <div className="inv-dismantle-footer">
          <div className="inv-dismantle-footer__info">
            <span className="inv-dismantle-footer__label">Total scrap:</span>
            <span className="inv-dismantle-footer__value" style={{ color: '#f59e0b' }}>{totalSelectedScrap.toLocaleString()}</span>
          </div>
          <button
            className={`inv-dismantle-footer__btn ${selectedIds.size === 0 ? 'inv-dismantle-footer__btn--disabled' : ''}`}
            disabled={selectedIds.size === 0 || isDismantling}
            onClick={handleDismantleAll}
          >
            {isDismantling ? 'DISMANTLING...' : `DISMANTLE ALL (${selectedIds.size})`}
          </button>
        </div>
      </div>
    )
  }

  const getSortedItemsForSlot = (slot: EquipSlot) =>
    inventory.items.filter(i => i.location === 'inventory' && i.slot === slot).sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))

  const renderItemCard = (item: EquipItem) => {
    const tierColor = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
    const tierLabel = TIER_LABELS[item.tier as keyof typeof TIER_LABELS] || item.tier.toUpperCase()
    const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
    const dur = Number(item.durability ?? 100)
    const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
    const statEntries: { label: string; val: string; color: string }[] = []
    if (item.stats.damage) statEntries.push({ label: 'DMG', val: `${item.stats.damage}`, color: '#f87171' })
    if (item.stats.critRate) statEntries.push({ label: 'CRIT', val: `${item.stats.critRate}%`, color: '#fb923c' })
    if (item.stats.critDamage) statEntries.push({ label: 'C.DMG', val: `${item.stats.critDamage}%`, color: '#fb923c' })
    if (item.stats.armor) statEntries.push({ label: 'ARM', val: `${item.stats.armor}%`, color: '#94a3b8' })
    if (item.stats.dodge) statEntries.push({ label: 'EVA', val: `${item.stats.dodge}%`, color: '#34d399' })
    if (item.stats.precision) statEntries.push({ label: 'ACC', val: `${item.stats.precision}%`, color: '#38bdf8' })
    return (
      <div key={item.id} className="ptab-gear-card" style={{
        borderColor: item.equipped ? 'rgba(132,204,22,0.4)' : `${tierColor}30`,
        '--card-tier-color': tierColor,
        boxShadow: item.equipped ? '0 0 8px rgba(132,204,22,0.15)' : undefined,
      } as React.CSSProperties}
      onClick={() => setSelectedItem(item)}
      title={item.equipped ? `${item.name} (EQUIPPED)` : item.name}
      >
        {item.equipped && <div className="inv-equip-tag">Equip.</div>}
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
                <span className="ptab-gear-stat__label">{getStatIcon(s.label, s.color) || s.label}</span>
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
  }

  const renderWeaponsSection = () => {
    const weapons = getSortedItemsForSlot('weapon')
    if (weapons.length === 0) return null
    return (
      <div className="inv-category-section">
        <div className="inv-category-header">Weapons</div>
        <div className="ptab-gear-grid">
          {weapons.map(item => renderItemCard(item))}
        </div>
      </div>
    )
  }

  const renderArmorSection = () => {
    const slots: { slot: EquipSlot; label: string }[] = [
      { slot: 'helmet', label: 'Helmets' },
      { slot: 'chest', label: 'Chests' },
      { slot: 'gloves', label: 'Gloves' },
      { slot: 'legs', label: 'Pants' },
      { slot: 'boots', label: 'Boots' },
    ]

    const allArmorItems = slots.flatMap(s => getSortedItemsForSlot(s.slot))
    if (allArmorItems.length === 0) return null

    return (
      <div className="inv-category-section">
        <div className="inv-category-header">
          {slots.map(s => {
            const count = getSortedItemsForSlot(s.slot).length
            return count > 0 ? <span key={s.slot} className="inv-category-label">{s.label}</span> : null
          })}
        </div>
        {slots.map(s => {
          const items = getSortedItemsForSlot(s.slot)
          if (items.length === 0) return null
          return (
            <div key={s.slot} style={{ marginBottom: '8px' }}>
              <div className="ptab-gear-grid">
                {items.map(item => renderItemCard(item))}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="inv-tab">
      {/* INVENTARIO Header */}
      <div className="inv-main-header">INVENTARIO</div>

      {/* CRAFT & DISMANTLE ACTION BAR */}
      <div className="inv-action-bar">
        <button className={`inv-action-btn inv-action-btn--craft ${mode === 'craft' ? 'inv-action-btn--active' : ''}`}
          onClick={() => setMode(mode === 'craft' ? 'normal' : 'craft')}>
          <span className="inv-action-btn__icon">✦</span> CRAFT
        </button>
        <button className={`inv-action-btn inv-action-btn--disarm ${mode === 'dismantle' ? 'inv-action-btn--active' : ''}`}
          onClick={() => setMode(mode === 'dismantle' ? 'normal' : 'dismantle')}>
          <span className="inv-action-btn__icon">⚙</span> DISMANTLE
          <span className="inv-supporter-badge">🔒 Supporter</span>
        </button>
      </div>

      {/* Dismantle Panel */}
      {mode === 'dismantle' && renderDismantlePanel()}

      {/* Resource Summary – box buttons open loot box modals */}
      <InventorySummary
        onOpenLootBox={() => setShowLootBox(true)}
        onOpenMilitaryBox={() => setShowMilitaryBox(true)}
        onOpenSupplyBox={() => setShowSupplyBox(true)}
      />

      {/* Weapons Section */}
      {renderWeaponsSection()}

      {/* Armor Categories */}
      {renderArmorSection()}

      {inventory.items.filter(i => i.location === 'inventory').length === 0 && <div className="inv-empty">You have no equipment.</div>}

      {/* EQUIPO Section — Equipped Gear Display */}
      <InventoryGearDisplay onPickSlot={setPickerSlot} onPickAmmo={() => setShowAmmoPicker(true)} />

      {/* Craft Modal */}
      {mode === 'craft' && <InventoryCraftModal onClose={() => setMode('normal')} />}

      {/* Item Interaction Modal */}
      {selectedItem && (
        <GameModal isOpen={true} onClose={() => setSelectedItem(null)} size="sm" glowColor={TIER_COLORS[selectedItem.tier]}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 12px', marginBottom: '12px', background: `radial-gradient(ellipse at center, ${TIER_COLORS[selectedItem.tier]}10 0%, transparent 70%)` }}>
            {(() => {
              const imgUrl = getItemImagePath(selectedItem.tier, selectedItem.slot, selectedItem.category, selectedItem.weaponSubtype, selectedItem.superforged);
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
                <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px' }}>{getStatIcon(s.label, s.color, 12)}{s.label}</span>
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
                onClick={async () => { if (selectedItem.equipped) return; const r = await inventory.sellItem(selectedItem.id); if (r.success) { ui.addFloatingText(`SOLD +$${r.moneyGained.toLocaleString()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b'); setSelectedItem(null) } }}
              >SELL ${TIER_SELL_PRICE[selectedItem.tier].toLocaleString()}</button>
              <button style={{ flex: 1, padding: '8px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'rgba(245,158,11,0.1)', color: selectedItem.equipped ? '#334155' : '#f59e0b', border: `1px solid ${selectedItem.equipped ? '#1e293b' : 'rgba(245,158,11,0.3)'}`, borderRadius: '4px', cursor: selectedItem.equipped ? 'not-allowed' : 'pointer', opacity: selectedItem.equipped ? 0.4 : 1 }} disabled={selectedItem.equipped} onClick={handleDisarm}
              >DISMANTLE (+{SCRAP_VALUES[selectedItem.tier]} SCRAP)</button>
            </div>
            <button onClick={() => setSelectedItem(null)} style={{ width: '100%', padding: '6px', fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', cursor: 'pointer' }}>CLOSE</button>
          </div>
        </GameModal>
      )}

      {/* Loot Box Openers – triggered by box buttons in InventorySummary */}
      <LootBoxOpener isOpen={showLootBox} onClose={() => setShowLootBox(false)} onOpenBox={handleLootBoxOpen} boxType="civilian" />
      <LootBoxOpener isOpen={showMilitaryBox} onClose={() => setShowMilitaryBox(false)} onOpenBox={handleMilitaryBoxOpen} boxType="military" />
      <LootBoxOpener isOpen={showSupplyBox} onClose={() => setShowSupplyBox(false)} onOpenBox={handleSupplyBoxOpen} boxType="supply" />

      {/* Slot/Ammo Picker Modals — reused from ProfileModals */}
      {pickerSlot && <SlotPickerModal slot={pickerSlot} onClose={() => setPickerSlot(null)} />}
      {showAmmoPicker && <AmmoPickerModal onClose={() => setShowAmmoPicker(false)} />}
    </div>
  )
}
