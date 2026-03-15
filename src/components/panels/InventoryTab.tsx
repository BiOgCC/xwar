import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import InventorySummary from '../shared/InventorySummary'
import { useUIStore } from '../../stores/uiStore'
import {
  useInventoryStore,
  generateStats,
  TIER_COLORS,
  TIER_LABELS,
  TIER_ORDER,
  ARMOR_SLOTS,
  SLOT_ICONS,
  type EquipItem,
  type EquipSlot,
} from '../../stores/inventoryStore'

export default function InventoryTab() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()

  // Modal State
  const [selectedItem, setSelectedItem] = useState<EquipItem | null>(null)
  const [mode, setMode] = useState<'normal' | 'craft' | 'disarm'>('normal')
  const [craftSlot, setCraftSlot] = useState<EquipSlot>('weapon')

  // Slot Pick Modal State
  const [selectedSlotToFill, setSelectedSlotToFill] = useState<EquipSlot | 'ammo' | null>(null)

  const equipped = inventory.items.filter((i) => i.equipped)
  const unequipped = inventory.items.filter((i) => !i.equipped)

  const handleOpenLootBox = (e: React.MouseEvent) => {
    if (player.lootBoxes <= 0) return
    const result = inventory.openLootBox()
    if (result) {
      ui.addFloatingText(`+${result.item.name}, $${result.money}, ${result.scrap} Scrap`, e.clientX, e.clientY, '#f59e0b')
    }
  }

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
    setSelectedSlotToFill(null)
  }

  const handleEquipFromModal = (itemId: string) => {
    inventory.equipItem(itemId)
    setSelectedSlotToFill(null)
  }

  const handleEquipAmmoFromModal = (ammoType: 'none' | 'green' | 'blue' | 'purple' | 'red') => {
    player.equipAmmo(ammoType)
    setSelectedSlotToFill(null)
  }

  const handleSlotClick = (slot: EquipSlot | 'ammo') => {
    if (slot === 'ammo') {
      const hasAnyAmmo = player.greenBullets > 0 || player.blueBullets > 0 || player.purpleBullets > 0 || player.redBullets > 0
      if (hasAnyAmmo || player.equippedAmmo !== 'none') {
        setSelectedSlotToFill('ammo')
      }
    } else {
      setSelectedSlotToFill(slot)
    }
  }

  const renderStats = (stats: any, condensed = false) => {
    if (!stats) return null
    return (
      <div style={{ display: 'flex', gap: '4px', fontSize: condensed ? '9px' : '10px', marginTop: condensed ? '2px' : '6px', opacity: 0.8, flexWrap: 'wrap' }}>
        {stats.damage && <span>⚔️ {stats.damage}</span>}
        {stats.critRate && <span>🎯 {stats.critRate}%</span>}
        {stats.critDamage && <span>💥 +{stats.critDamage}%</span>}
        {stats.armor && <span>🛡️ +{stats.armor}%</span>}
        {stats.dodge && <span>💨 +{stats.dodge}%</span>}
        {stats.precision && <span>👁️ +{stats.precision}%</span>}
      </div>
    )
  }

  const renderLoadoutSlot = (slotType: string, label: string, item?: EquipItem, val?: string, iconStr?: string) => {
    return (
      <div
        className={`inv-equip-slot ${item || val ? 'inv-equip-slot--filled' : ''}`}
        style={{
          borderColor: item ? `${TIER_COLORS[item.tier]}66` : val ? '#22d38a66' : 'rgba(255,255,255,0.05)',
          cursor: 'pointer',
          background: item || val ? 'rgba(8,12,18,0.8)' : 'rgba(0,0,0,0.2)'
        }}
        onClick={() => handleSlotClick(slotType as any)}
        title={item ? `${item.name} (${TIER_LABELS[item.tier]})` : `${label} — Empty (Click to assign)`}
      >
        <span className="inv-equip-slot__icon" style={{ opacity: item || val ? 1 : 0.3 }}>{iconStr || (SLOT_ICONS as Record<string, string>)[slotType] || '❓'}</span>
        <span
          className="inv-equip-slot__label"
          style={item ? { color: TIER_COLORS[item.tier] } : { opacity: val ? 1 : 0.4 }}
        >
          {item ? TIER_LABELS[item.tier] : val ? val : `Empty ${label}`}
        </span>
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
        <div className="inv-items-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '4px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              className={`inv-item ${item.equipped ? 'inv-item--equipped' : ''}`}
              style={{
                borderColor: `${TIER_COLORS[item.tier]}44`,
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '4px 6px',
                background: item.equipped ? 'rgba(34, 211, 138, 0.05)' : 'rgba(8,12,18,0.4)',
                minHeight: '34px',
              }}
              onClick={() => {
                if (mode === 'disarm' && !item.equipped) {
                  const scrapGain = inventory.dismantleItem(item.id)
                  player.addScrap(scrapGain)
                  ui.addFloatingText(`+${scrapGain} SCRAP`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
                } else {
                  setSelectedItem(item)
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '2px' }}>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-display)', color: TIER_COLORS[item.tier], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </span>
                {item.equipped && <span style={{ fontSize: '7px', color: '#22d38a', border: '1px solid #22d38a', padding: '1px 2px', borderRadius: '2px', marginLeft: '2px' }}>EQ</span>}
              </div>
              {renderStats(item.stats, true)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="inv-tab">
      <InventorySummary />

      {/* Loot Boxes Simplified */}
      <div className="inv-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,12,18,0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>💼</span>
            <span style={{ fontSize: '16px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              <strong style={{ color: '#22d38a', fontSize: '20px' }}>{player.lootBoxes}</strong> cases
            </span>
          </div>
          <button
            className="comp-action comp-action--produce"
            style={{ margin: 0, width: 'auto', padding: '6px 20px', fontWeight: 'bold' }}
            disabled={player.lootBoxes <= 0}
            onClick={handleOpenLootBox}
          >
            Open Box
          </button>
        </div>
      </div>

      {/* LOADOUT EQUIPPED */}
      <div className="inv-section">
        <div className="inv-section__title" style={{ color: '#ffffff' }}>⚙️ LOADOUT EQUIPPED</div>
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Click an empty slot to equip an item.</div>
        <div className="inv-equip-grid">
          {renderLoadoutSlot('weapon', 'Weapon', equipped.find((i) => i.slot === 'weapon'))}
          {renderLoadoutSlot('ammo', 'Ammo', undefined, player.equippedAmmo !== 'none' ? `${player.equippedAmmo.toUpperCase()} AMMO` : undefined, player.equippedAmmo === 'green' ? '🟢' : player.equippedAmmo === 'blue' ? '🔵' : player.equippedAmmo === 'purple' ? '🟣' : player.equippedAmmo === 'red' ? '🔴' : undefined)}
          {renderLoadoutSlot('helmet', 'Helmet', equipped.find((i) => i.slot === 'helmet'))}
          {renderLoadoutSlot('chest', 'Chest', equipped.find((i) => i.slot === 'chest'))}
          {renderLoadoutSlot('legs', 'Legs', equipped.find((i) => i.slot === 'legs'))}
          {renderLoadoutSlot('gloves', 'Gloves', equipped.find((i) => i.slot === 'gloves'))}
          {renderLoadoutSlot('boots', 'Boots', equipped.find((i) => i.slot === 'boots'))}
        </div>
      </div>

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
          🔨 CRAFT
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
          🔧 DISARM
        </button>
      </div>

      {/* CRAFT MODE – All Items */}
      {mode === 'craft' && (() => {
        // Cost scaling: base × tier multiplier
        const costTable: Record<string, { scrap: number; oil: number; money: number }> = {
          t1: { scrap: 20, oil: 5, money: 50 },
          t2: { scrap: 60, oil: 15, money: 150 },
          t3: { scrap: 180, oil: 45, money: 500 },
          t4: { scrap: 540, oil: 130, money: 1500 },
          t5: { scrap: 1600, oil: 400, money: 5000 },
          t6: { scrap: 4800, oil: 1200, money: 15000 },
        }

        // Stat ranges for preview (matches generateStats in inventoryStore)
        const statPreview: Record<string, Record<string, string>> = {
          weapon: {
            t1: 'DMG 20-49 · CRIT 5%',
            t2: 'DMG 50-80 · CRIT 6-10%',
            t3: 'DMG 81-120 · CRIT 11-15%',
            t4: 'DMG 121-150 · CRIT 16-20%',
            t5: 'DMG 151-199 · CRIT 21-30%',
            t6: 'DMG 200-300 · CRIT 31-49%',
          },
          helmet: {
            t1: 'CDMG 12-20%', t2: 'CDMG 32-40%', t3: 'CDMG 52-60%',
            t4: 'CDMG 72-80%', t5: 'CDMG 92-100%', t6: 'CDMG 112-120%',
          },
          chest: {
            t1: 'ARMOR 2-5%', t2: 'ARMOR 7-10%', t3: 'ARMOR 12-15%',
            t4: 'ARMOR 17-20%', t5: 'ARMOR 22-25%', t6: 'ARMOR 27-30%',
          },
          legs: {
            t1: 'ARMOR 2-5%', t2: 'ARMOR 7-10%', t3: 'ARMOR 12-15%',
            t4: 'ARMOR 17-20%', t5: 'ARMOR 22-25%', t6: 'ARMOR 27-30%',
          },
          gloves: {
            t1: 'PREC 1-5%', t2: 'PREC 6-10%', t3: 'PREC 11-15%',
            t4: 'PREC 16-20%', t5: 'PREC 21-25%', t6: 'PREC 26-30%',
          },
          boots: {
            t1: 'DODGE 2-5%', t2: 'DODGE 7-10%', t3: 'DODGE 12-15%',
            t4: 'DODGE 17-20%', t5: 'DODGE 22-25%', t6: 'DODGE 27-30%',
          },
        }

        const slotTabs: { slot: EquipSlot; icon: string; label: string }[] = [
          { slot: 'weapon', icon: '⚔️', label: 'WPN' },
          { slot: 'helmet', icon: '⛑️', label: 'HELM' },
          { slot: 'chest', icon: '🦺', label: 'CHEST' },
          { slot: 'legs', icon: '🩳', label: 'LEGS' },
          { slot: 'gloves', icon: '🧤', label: 'GLVS' },
          { slot: 'boots', icon: '🥾', label: 'BOOT' },
        ]

        return (
          <div className="inv-section" style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.03)' }}>
            <div className="inv-section__title" style={{ color: '#fbbf24' }}>🔨 CRAFT EQUIPMENT</div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
              🔩 {player.scrap.toLocaleString()} Scrap · 🛢️ {player.oil.toLocaleString()} Oil · 💵 ${player.money.toLocaleString()}
            </div>

            {/* Slot Tabs */}
            <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
              {slotTabs.map(st => (
                <button key={st.slot} onClick={() => setCraftSlot(st.slot)} style={{
                  flex: 1, padding: '5px 2px', fontSize: '9px', fontWeight: 700,
                  border: `1px solid ${craftSlot === st.slot ? '#fbbf24' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: '3px', background: craftSlot === st.slot ? 'rgba(251,191,36,0.12)' : 'transparent',
                  color: craftSlot === st.slot ? '#fbbf24' : '#64748b', cursor: 'pointer',
                }}>
                  {st.icon} {st.label}
                </button>
              ))}
            </div>

            {/* Tier Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {TIER_ORDER.map(tier => {
                const cost = costTable[tier]
                const canAfford = player.scrap >= cost.scrap && player.oil >= cost.oil && player.money >= cost.money
                // Use generateStats for preview name
                const category = craftSlot === 'weapon' ? 'weapon' as const : 'armor' as const
                const previewGen = generateStats(category, craftSlot, tier)
                const itemName = previewGen.name
                const preview = statPreview[craftSlot]?.[tier] || ''
                const tierNum = parseInt(tier[1])

                return (
                  <div key={tier} style={{
                    padding: '8px', borderRadius: '6px',
                    background: canAfford ? `rgba(${tierNum > 3 ? '251,191,36' : '255,255,255'},0.03)` : 'rgba(0,0,0,0.2)',
                    border: `2px solid ${canAfford ? TIER_COLORS[tier] + '55' : 'rgba(255,255,255,0.05)'}`,
                    opacity: canAfford ? 1 : 0.5,
                    transition: 'all 0.2s',
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 900, color: TIER_COLORS[tier] }}>{TIER_LABELS[tier].split(' ')[0]}</span>
                      <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>T{tierNum}</span>
                    </div>

                    {/* Item Name */}
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                      {(SLOT_ICONS as any)[craftSlot]} {itemName}
                    </div>

                    {/* Stat Range Preview */}
                    <div style={{ fontSize: '8px', padding: '2px 4px', marginBottom: '6px', background: `${TIER_COLORS[tier]}10`, border: `1px solid ${TIER_COLORS[tier]}25`, borderRadius: '2px', color: TIER_COLORS[tier] }}>
                      {preview}
                    </div>

                    {/* Cost */}
                    <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '6px' }}>
                      🔩{cost.scrap} · 🛢️{cost.oil} · 💵{cost.money}
                    </div>

                    {/* Craft Button */}
                    <button
                      disabled={!canAfford}
                      style={{
                        width: '100%', padding: '5px', fontSize: '9px', fontWeight: 900,
                        border: `1px solid ${canAfford ? TIER_COLORS[tier] : '#333'}`,
                        borderRadius: '3px', cursor: canAfford ? 'pointer' : 'not-allowed',
                        background: canAfford ? `${TIER_COLORS[tier]}22` : 'transparent',
                        color: canAfford ? TIER_COLORS[tier] : '#444',
                      }}
                      onClick={() => {
                        if (!canAfford) return
                        player.spendMoney(cost.money)
                        player.spendOil(cost.oil)
                        player.spendScraps(cost.scrap)
                        // Use generateStats for randomized stats matching loot system
                        const { name, stats } = generateStats(category, craftSlot, tier)
                        const newItem: EquipItem = {
                          id: `crafted_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                          name,
                          slot: craftSlot,
                          category,
                          tier,
                          equipped: false,
                          durability: 100,
                          stats,
                        }
                        inventory.addItem(newItem)
                        ui.addFloatingText(`CRAFTED ${name}!`, window.innerWidth / 2, window.innerHeight / 2, TIER_COLORS[tier])
                      }}
                    >
                      🔨 CRAFT
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* DISARM MODE info */}
      {mode === 'disarm' && (
        <div style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center', padding: '6px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px', marginBottom: '6px' }}>
          🔧 DISARM MODE — Click any unequipped item below to dismantle for scrap
        </div>
      )}

      {/* EQUIPMENT LIST */}
      <div className="inv-section">
        <div className="inv-section__title">🎒 EQUIPMENT</div>
        
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

      {/* Item Interaction Modal */}
      {selectedItem && (
        <div className="inv-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '300px' }}>
            <div className="inv-modal__title" style={{ color: TIER_COLORS[selectedItem.tier] }}>
              {selectedItem.name}
            </div>
            <div style={{ textAlign: 'center', marginBottom: '16px', fontSize: '32px' }}>
              {(SLOT_ICONS as Record<string, string>)[selectedItem.slot]}
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>
              <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Tier: {TIER_LABELS[selectedItem.tier]}</div>
              {renderStats(selectedItem.stats)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                className="inv-btn inv-btn--confirm" 
                onClick={handleEquipToggle}
                style={{ background: selectedItem.equipped ? '#f59e0b' : '#22d38a', color: '#0a0e17' }}
              >
                {selectedItem.equipped ? 'Unequip' : 'Equip'}
              </button>
              
              <button 
                className="inv-btn" 
                style={{ background: '#3b82f6', color: '#ffffff', opacity: 0.5, cursor: 'not-allowed' }}
                title="Marketplace integration coming soon"
              >
                Sell to Market
              </button>
              
              <button 
                className="inv-btn inv-btn--dismantle" 
                onClick={handleDisarm}
                disabled={selectedItem.equipped}
                title={selectedItem.equipped ? "Unequip first to disarm" : "Dismantle for scrap"}
              >
                Disarm (Scrap)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Item to Fill Slot Modal */}
      {selectedSlotToFill && (
        <div className="inv-modal-overlay" onClick={() => setSelectedSlotToFill(null)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px', width: '90%' }}>
            <div className="inv-modal__title">
              Equip {(selectedSlotToFill as string).toUpperCase()}
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedSlotToFill === 'ammo' ? (
                // Render Ammo Options
                <>
                  <div 
                    className="inv-item" 
                    style={{ padding: '10px', cursor: 'pointer', background: player.equippedAmmo === 'none' ? 'rgba(34, 211, 138, 0.1)' : 'rgba(8,12,18,0.8)', border: player.equippedAmmo === 'none' ? '1px solid #22d38a' : '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => handleEquipAmmoFromModal('none')}
                  >
                    <span>⭕ No Ammo</span>
                    {player.equippedAmmo === 'none' && <span style={{ color: '#22d38a', fontSize: '12px' }}>EQUIPPED</span>}
                  </div>
                  {player.greenBullets > 0 && (
                    <div className="inv-item" style={{ padding: '10px', cursor: 'pointer', background: player.equippedAmmo === 'green' ? 'rgba(34, 211, 138, 0.1)' : 'rgba(8,12,18,0.8)', border: player.equippedAmmo === 'green' ? '1px solid #22d38a' : '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => handleEquipAmmoFromModal('green')}>
                      <span style={{ color: '#22c55e' }}>🟢 Green Ammo ({player.greenBullets})</span>
                      {player.equippedAmmo === 'green' && <span style={{ color: '#22d38a', fontSize: '12px' }}>EQUIPPED</span>}
                    </div>
                  )}
                  {player.blueBullets > 0 && (
                    <div className="inv-item" style={{ padding: '10px', cursor: 'pointer', background: player.equippedAmmo === 'blue' ? 'rgba(34, 211, 138, 0.1)' : 'rgba(8,12,18,0.8)', border: player.equippedAmmo === 'blue' ? '1px solid #22d38a' : '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => handleEquipAmmoFromModal('blue')}>
                      <span style={{ color: '#3b82f6' }}>🔵 Blue Ammo ({player.blueBullets})</span>
                      {player.equippedAmmo === 'blue' && <span style={{ color: '#22d38a', fontSize: '12px' }}>EQUIPPED</span>}
                    </div>
                  )}
                  {player.purpleBullets > 0 && (
                    <div className="inv-item" style={{ padding: '10px', cursor: 'pointer', background: player.equippedAmmo === 'purple' ? 'rgba(34, 211, 138, 0.1)' : 'rgba(8,12,18,0.8)', border: player.equippedAmmo === 'purple' ? '1px solid #22d38a' : '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => handleEquipAmmoFromModal('purple')}>
                      <span style={{ color: '#a855f7' }}>🟣 Purple Ammo ({player.purpleBullets})</span>
                      {player.equippedAmmo === 'purple' && <span style={{ color: '#22d38a', fontSize: '12px' }}>EQUIPPED</span>}
                    </div>
                  )}
                  {player.redBullets > 0 && (
                    <div className="inv-item" style={{ padding: '10px', cursor: 'pointer', background: player.equippedAmmo === 'red' ? 'rgba(34, 211, 138, 0.1)' : 'rgba(8,12,18,0.8)', border: player.equippedAmmo === 'red' ? '1px solid #22d38a' : '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => handleEquipAmmoFromModal('red')}>
                      <span style={{ color: '#ef4444' }}>🔴 Red Ammo ({player.redBullets})</span>
                      {player.equippedAmmo === 'red' && <span style={{ color: '#22d38a', fontSize: '12px' }}>EQUIPPED</span>}
                    </div>
                  )}
                </>
              ) : (
                // Render Default Items for Slot
                (() => {
                  const availableItems = inventory.items
                    .filter(i => i.slot === selectedSlotToFill && !i.equipped)
                    .sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))

                  if (availableItems.length === 0) {
                    return <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No items available to equip for this slot.</div>
                  }

                  return availableItems.map(item => (
                    <div
                      key={item.id}
                      className="inv-item"
                      style={{
                        borderColor: `${TIER_COLORS[item.tier]}44`,
                        background: 'rgba(8,12,18,0.8)',
                        padding: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start'
                      }}
                      onClick={() => handleEquipFromModal(item.id)}
                    >
                      <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', color: TIER_COLORS[item.tier] }}>{item.name}</span>
                      {renderStats(item.stats)}
                    </div>
                  ))
                })()
              )}
            </div>
            
            <button 
              className="inv-btn" 
              style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', marginTop: '16px' }}
              onClick={() => setSelectedSlotToFill(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
