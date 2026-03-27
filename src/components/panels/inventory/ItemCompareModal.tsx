import { getStatIcon } from '../../shared/StatIcon'
import GameModal from '../../shared/GameModal'
import {
  useInventoryStore,
  getItemImagePath,
  TIER_COLORS,
  TIER_LABELS,
  type EquipItem,
} from '../../../stores/inventoryStore'

/** Estimate scrap return based on tier and durability */
function getScrapReturn(tier: string, durability: number): number {
  const BASE_SCRAP: Record<string, number> = { t1: 5, t2: 15, t3: 40, t4: 80, t5: 150, t6: 250 }
  const base = BASE_SCRAP[tier] || 10
  return Math.max(1, Math.floor(base * (durability / 100)))
}

interface Props {
  item: EquipItem
  onClose: () => void
  onEquip?: (itemId: string) => void
}

const STAT_KEYS = [
  { key: 'damage', label: 'DMG', color: '#f87171', suffix: '' },
  { key: 'critRate', label: 'CRIT', color: '#fb923c', suffix: '%' },
  { key: 'critDamage', label: 'C.DMG', color: '#fb923c', suffix: '%' },
  { key: 'armor', label: 'ARM', color: '#94a3b8', suffix: '%' },
  { key: 'dodge', label: 'EVA', color: '#34d399', suffix: '%' },
  { key: 'precision', label: 'ACC', color: '#38bdf8', suffix: '%' },
] as const

/** Side-by-side item comparison between selected item and currently equipped item in same slot */
export default function ItemCompareModal({ item, onClose, onEquip }: Props) {
  const inv = useInventoryStore()
  const equipped = inv.items.find(
    i => i.location === 'inventory' && i.equipped && i.slot === item.slot && i.id !== item.id
  )

  const tc = TIER_COLORS[item.tier] || '#94a3b8'
  const eqTc = equipped ? (TIER_COLORS[equipped.tier] || '#94a3b8') : '#333'

  const renderStatRow = (stat: typeof STAT_KEYS[number]) => {
    const newVal = (item.stats as any)[stat.key] || 0
    const oldVal = equipped ? ((equipped.stats as any)[stat.key] || 0) : 0
    if (newVal === 0 && oldVal === 0) return null

    const diff = newVal - oldVal
    const diffColor = diff > 0 ? '#22d38a' : diff < 0 ? '#ef4444' : '#475569'
    const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='
    const suffix = stat.suffix || ''

    return (
      <div key={stat.key} style={{
        display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center',
        padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ textAlign: 'right', color: eqTc, fontWeight: 600 }}>
          {oldVal > 0 ? `${oldVal}${suffix}` : '—'}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
            {getStatIcon(stat.label, stat.color, 10)}
            <span style={{ fontSize: '7px', color: '#64748b', letterSpacing: '0.04em' }}>{stat.label}</span>
          </span>
          <span style={{
            fontSize: '8px', fontWeight: 800, color: diffColor,
            fontFamily: 'var(--font-display)', letterSpacing: '0.04em',
          }}>
            {diffStr}{suffix}
          </span>
        </div>
        <div style={{ textAlign: 'left', color: tc, fontWeight: 600 }}>
          {newVal > 0 ? `${newVal}${suffix}` : '—'}
        </div>
      </div>
    )
  }

  const newScrap = getScrapReturn(item.tier, item.durability ?? 100)
  const newDur = Math.round(item.durability ?? 100)
  const oldDur = equipped ? Math.round(equipped.durability ?? 100) : 0
  const durColor = (d: number) => d < 30 ? '#ef4444' : d < 60 ? '#f59e0b' : '#22d38a'

  return (
    <GameModal isOpen={true} onClose={onClose} title="COMPARE GEAR" size="sm" glowColor={tc}>
      <div style={{ padding: '4px 0' }}>
        {/* Headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center',
          marginBottom: '10px', paddingBottom: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Equipped (left) */}
          <div style={{ textAlign: 'center' }}>
            {equipped ? (
              <>
                <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={getItemImagePath(equipped.tier, equipped.slot, equipped.category, equipped.weaponSubtype, equipped.superforged) || ''}
                    alt={equipped.name}
                    style={{ width: '40px', height: '40px', objectFit: 'contain', filter: `drop-shadow(0 2px 6px ${eqTc}40)` }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>
                <div style={{ fontSize: '8px', fontWeight: 800, color: eqTc, fontFamily: 'var(--font-display)', marginTop: '2px' }}>
                  {equipped.name}
                </div>
                <div style={{ fontSize: '7px', color: '#475569', fontFamily: 'var(--font-display)' }}>
                  {TIER_LABELS[equipped.tier]}
                </div>
              </>
            ) : (
              <>
                <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '24px', opacity: 0.15 }}>∅</span>
                </div>
                <div style={{ fontSize: '8px', color: '#333', fontWeight: 600 }}>EMPTY SLOT</div>
              </>
            )}
          </div>

          {/* VS */}
          <div style={{
            textAlign: 'center', fontSize: '10px', fontWeight: 900,
            fontFamily: 'var(--font-display)', color: '#475569',
          }}>VS</div>

          {/* New item (right) */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged) || ''}
                alt={item.name}
                style={{ width: '40px', height: '40px', objectFit: 'contain', filter: `drop-shadow(0 2px 6px ${tc}40)` }}
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <div style={{ fontSize: '8px', fontWeight: 800, color: tc, fontFamily: 'var(--font-display)', marginTop: '2px' }}>
              {item.superforged ? '⚡ ' : ''}{item.name}
            </div>
            <div style={{ fontSize: '7px', color: '#475569', fontFamily: 'var(--font-display)' }}>
              {TIER_LABELS[item.tier]}
            </div>
          </div>
        </div>

        {/* Stat rows */}
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
          padding: '8px 10px', marginBottom: '8px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {STAT_KEYS.map(s => renderStatRow(s))}

          {/* Durability row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 50px 1fr', alignItems: 'center',
            padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)',
            borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '4px', paddingTop: '6px',
          }}>
            <div style={{ textAlign: 'right', color: equipped ? durColor(oldDur) : '#333', fontWeight: 600 }}>
              {equipped ? `${oldDur}%` : '—'}
            </div>
            <div style={{ textAlign: 'center', fontSize: '7px', color: '#64748b', letterSpacing: '0.04em' }}>DUR</div>
            <div style={{ textAlign: 'left', color: durColor(newDur), fontWeight: 600 }}>
              {newDur}%
            </div>
          </div>
        </div>

        {/* Scrap value */}
        <div style={{
          textAlign: 'center', fontSize: '8px', color: '#475569',
          fontFamily: 'var(--font-mono)', marginBottom: '10px',
        }}>
          Dismantle value: ⚙️ {newScrap} scrap
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {onEquip && (
            <button
              onClick={() => { onEquip(item.id); onClose() }}
              style={{
                flex: 1, padding: '8px', fontSize: '10px', fontWeight: 800,
                fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
                background: `${tc}22`, border: `1px solid ${tc}`,
                borderRadius: '4px', color: tc, cursor: 'pointer',
              }}
            >EQUIP</button>
          )}
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '8px', fontSize: '10px', fontWeight: 600,
              fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '4px', color: '#475569', cursor: 'pointer',
            }}
          >CLOSE</button>
        </div>
      </div>
    </GameModal>
  )
}
