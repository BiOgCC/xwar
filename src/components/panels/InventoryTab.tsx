import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import InventorySummary from '../shared/InventorySummary'
import { useUIStore } from '../../stores/uiStore'
import {
  useInventoryStore,
  TIER_COLORS,
  TIER_LABELS,
  ARMOR_SLOTS,
  SLOT_ICONS,
  type EquipItem,
} from '../../stores/inventoryStore'

export default function InventoryTab() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()
  const [selectedItem, setSelectedItem] = useState<string | null>(null)

  const equipped = inventory.items.filter((i) => i.equipped)
  const unequipped = inventory.items.filter((i) => !i.equipped)

  const handleOpenLootBox = (e: React.MouseEvent) => {
    if (player.lootBoxes <= 0) return
    const result = inventory.openLootBox()
    if (result) {
      ui.addFloatingText(`+${result.item.name}, $${result.money}, ${result.scrap} Scrap`, e.clientX, e.clientY, '#f59e0b')
    }
  }

  const handleDismantle = () => {
    if (!selectedItem) return
    const item = inventory.items.find((i) => i.id === selectedItem)
    if (!item || item.equipped) return
    const scrapGain = inventory.dismantleItem(selectedItem)
    player.addScrap(scrapGain)
    setSelectedItem(null)
  }

  const handleEquip = (item: EquipItem) => {
    if (item.equipped) {
      inventory.unequipItem(item.id)
    } else {
      inventory.equipItem(item.id)
    }
  }

  const cycleAmmo = () => {
    const types = ['none', 'green', 'blue', 'purple', 'red'] as const
    const currentIndex = types.indexOf(player.equippedAmmo)
    const nextIndex = (currentIndex + 1) % types.length
    player.equipAmmo(types[nextIndex])
  }

  const renderSlot = (slotType: string, label: string, item?: EquipItem, val?: string, iconStr?: string, onClick?: () => void) => {
    return (
      <div
        className={`inv-equip-slot ${item || val ? 'inv-equip-slot--filled' : ''}`}
        style={item ? { borderColor: `${TIER_COLORS[item.tier]}66`, cursor: 'pointer' } : val ? { borderColor: '#22d38a66', cursor: 'pointer' } : {}}
        onClick={onClick || (() => item && handleEquip(item))}
        title={item ? `${item.name} (${TIER_LABELS[item.tier]}) — Click to unequip` : `${label} — Empty (Click to cycle if Ammo)`}
      >
        <span className="inv-equip-slot__icon">{iconStr || SLOT_ICONS[slotType as any] || '❓'}</span>
        <span
          className="inv-equip-slot__label"
          style={item ? { color: TIER_COLORS[item.tier] } : {}}
        >
          {item ? TIER_LABELS[item.tier] : val ? val : label}
        </span>
      </div>
    )
  }

  const renderStats = (stats: any) => {
    if (!stats) return null
    return (
      <div style={{ display: 'flex', gap: '4px', fontSize: '10px', marginTop: '6px', opacity: 0.8, flexWrap: 'wrap' }}>
        {stats.damage && <span>⚔️ {stats.damage} Dmg</span>}
        {stats.critRate && <span>🎯 {stats.critRate}% Crit</span>}
        {stats.critDamage && <span>💥 +{stats.critDamage}% C.Dmg</span>}
        {stats.armor && <span>🛡️ +{stats.armor}% Arm</span>}
        {stats.dodge && <span>💨 +{stats.dodge}% Ddg</span>}
        {stats.precision && <span>👁️ +{stats.precision}% Prec</span>}
      </div>
    )
  }

  return (
    <div className="inv-tab">
      <InventorySummary />

      {/* Loot Boxes */}
      <div className="inv-section">
        <div className="inv-section__title">🎁 LOOT BOXES</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,12,18,0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontSize: '14px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            Unopened Boxes: <strong style={{ color: '#22d38a', fontSize: '16px', marginLeft: '6px' }}>{player.lootBoxes}</strong>
          </span>
          <button
            className="comp-action comp-action--produce"
            style={{ margin: 0, width: 'auto', padding: '6px 16px' }}
            disabled={player.lootBoxes <= 0}
            onClick={handleOpenLootBox}
          >
            Open Box
          </button>
        </div>
      </div>

      {/* Equipment Slots */}
      <div className="inv-section">
        <div className="inv-section__title">🛡️ ARMOR</div>
        <div className="inv-equip-grid">
          {ARMOR_SLOTS.map((slot) => {
            const item = equipped.find((i) => i.slot === slot)
            return <div key={slot}>{renderSlot(slot, slot, item)}</div>
          })}
        </div>
      </div>

      <div className="inv-section">
        <div className="inv-section__title">⚔️ WEAPON & AMMO</div>
        <div className="inv-equip-grid">
          {renderSlot('weapon', 'weapon', equipped.find(i => i.slot === 'weapon'))}
          {renderSlot('ammo', 'ammo', undefined, player.equippedAmmo !== 'none' ? `${player.equippedAmmo.toUpperCase()} BULLETS` : undefined, player.equippedAmmo === 'green' ? '🟢' : player.equippedAmmo === 'blue' ? '🔵' : player.equippedAmmo === 'purple' ? '🟣' : player.equippedAmmo === 'red' ? '🔴' : '⭕', cycleAmmo)}
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="inv-section">
        <div className="inv-section__title">
          🎒 ITEMS ({unequipped.length})
          <div className="inv-section__actions">
            <button
              className="inv-btn inv-btn--dismantle"
              onClick={handleDismantle}
              disabled={!selectedItem}
            >
              🔨 Dismantle
            </button>
          </div>
        </div>
        <div className="inv-items-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {unequipped.length === 0 && (
            <div className="inv-empty">No unequipped items</div>
          )}
          {unequipped.map((item) => (
            <div
              key={item.id}
              className={`inv-item ${selectedItem === item.id ? 'inv-item--selected' : ''}`}
              style={{ borderColor: `${TIER_COLORS[item.tier]}66`, flexDirection: 'column', alignItems: 'flex-start', padding: '10px' }}
              onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
              onDoubleClick={() => handleEquip(item)}
              title={`${item.name} — Double-click to equip`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <span className="inv-item__icon" style={{ color: TIER_COLORS[item.tier], fontSize: '20px' }}>
                  {SLOT_ICONS[item.slot as any] || '❓'}
                </span>
                <span style={{ fontSize: '13px', fontFamily: 'var(--font-display)', color: TIER_COLORS[item.tier], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
              </div>
              {renderStats(item.stats)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
