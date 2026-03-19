import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, getItemImagePath, TIER_COLORS, TIER_LABELS, TIER_ORDER, SLOT_ICONS } from '../../../stores/inventoryStore'
import type { EquipSlot } from '../../../stores/inventoryStore'

interface SlotPickerProps {
  slot: EquipSlot
  onClose: () => void
}

/** Slot picker modal for swapping gear */
export function SlotPickerModal({ slot, onClose }: SlotPickerProps) {
  const inventory = useInventoryStore()
  const equipped = inventory.getEquipped()
  const currentlyEquipped = equipped.find((i: any) => i.slot === slot)
  const availableItems = inventory.items
    .filter(i => i.slot === slot)
    .sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier))

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%' }}>
        <div className="inv-modal__title" style={{ color: '#84cc16' }}>
          {slot.toUpperCase()} GEAR
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
              onClick={() => { inventory.unequipItem(currentlyEquipped.id); onClose() }}
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
                onClick={() => { inventory.equipItem(item.id); onClose() }}
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
          onClick={onClose}
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
}

interface AmmoPickerProps {
  onClose: () => void
}

/** Ammo picker modal */
export function AmmoPickerModal({ onClose }: AmmoPickerProps) {
  const player = usePlayerStore()
  const ammoTypes: Array<{ key: 'none' | 'green' | 'blue' | 'purple' | 'red'; label: string; color: string; bonus: string }> = [
    { key: 'green',  label: 'Green Ammo',  color: '#10b981', bonus: '\u00d71.1 DMG' },
    { key: 'blue',   label: 'Blue Ammo',   color: '#3b82f6', bonus: '\u00d71.2 DMG' },
    { key: 'purple', label: 'Purple Ammo', color: '#a855f7', bonus: '\u00d71.4 DMG' },
    { key: 'red',    label: 'Red Ammo',    color: '#ef4444', bonus: '\u00d71.4 DMG +10% CRIT' },
  ]

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
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
              <div key={at.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '5px', background: isEquipped ? 'rgba(132,204,22,0.06)' : 'rgba(8,12,18,0.8)', border: `1px solid ${isEquipped ? 'rgba(132,204,22,0.3)' : hasAmmo ? `${at.color}33` : 'rgba(71,85,105,0.15)'}`, cursor: hasAmmo ? 'pointer' : 'not-allowed', opacity: hasAmmo ? 1 : 0.4, transition: 'all 150ms ease' }} onClick={() => { if (hasAmmo) { player.equipAmmo(at.key); onClose() } }}>
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
          <button onClick={() => { player.equipAmmo('none'); onClose() }} style={{ width: '100%', padding: '8px', marginTop: '8px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', cursor: 'pointer' }}>UNEQUIP AMMO</button>
        )}
        <button onClick={onClose} style={{ width: '100%', padding: '8px', marginTop: '6px', fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.08em', background: 'transparent', color: '#475569', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', cursor: 'pointer' }}>CLOSE</button>
      </div>
    </div>
  )
}

interface AvatarPickerProps {
  onClose: () => void
}

const AVATARS = [
  { id: 'avatar_male', path: '/assets/avatars/avatar_male.png', label: 'Commander' },
  { id: 'avatar_female', path: '/assets/avatars/avatar_female.png', label: 'Operative' },
]

/** Avatar picker modal */
export function AvatarPickerModal({ onClose }: AvatarPickerProps) {
  const player = usePlayerStore()

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px', width: '90%' }}>
        <div className="inv-modal__title" style={{ color: '#8b5cf6' }}>
          SELECT AVATAR
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px', padding: '8px 4px',
        }}>
          {AVATARS.map(av => {
            const isSelected = player.avatar === av.path
            return (
              <div
                key={av.id}
                onClick={() => { player.setAvatar(av.path); onClose() }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                  padding: '12px', borderRadius: '8px',
                  background: isSelected ? 'rgba(132, 204, 22, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                  border: `2px solid ${isSelected ? 'rgba(132, 204, 22, 0.5)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'; e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)' } }}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)' } }}
              >
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden',
                  border: `3px solid ${isSelected ? '#84cc16' : 'rgba(99, 102, 241, 0.3)'}`,
                  boxShadow: isSelected ? '0 0 16px rgba(132, 204, 22, 0.3)' : '0 0 8px rgba(99, 102, 241, 0.15)',
                }}>
                  <img
                    src={av.path}
                    alt={av.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <div style={{
                  fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                  color: isSelected ? '#84cc16' : '#94a3b8',
                }}>
                  {av.label}
                </div>
                {isSelected && (
                  <div style={{
                    fontSize: '7px', fontFamily: 'var(--font-display)', fontWeight: 700,
                    letterSpacing: '0.1em', color: '#84cc16', marginTop: '-4px',
                  }}>
                    SELECTED
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button
          onClick={onClose}
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
}
