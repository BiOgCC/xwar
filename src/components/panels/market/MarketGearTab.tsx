import React, { useState } from 'react'
import { getStatIcon } from '../../shared/StatIcon'
import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, type EquipItem, TIER_COLORS, TIER_LABELS, TIER_ORDER, SLOT_ICONS, getItemImagePath } from '../../../stores/inventoryStore'
import { useMarketStore } from '../../../stores/market'
import type { EquipTier, EquipSlot } from '../../../stores/inventoryStore'

const RARITY_COLOR: Record<string, string> = {
  red: '#ef4444', yellow: '#eab308', blue: '#3b82f6',
  purple: '#a855f7', green: '#10b981', grey: '#64748b',
}
const TIER_RARITY: Record<string, string> = {
  t1: 'grey', t2: 'green', t3: 'blue', t4: 'purple', t5: 'yellow', t6: 'red', t7: 'red'
}
const TIER_SELL_PRICE: Record<string, number> = {
  t1: 1200, t2: 5000, t3: 25000, t4: 90000, t5: 280000, t6: 830000, t7: 2500000
}

interface MarketGearTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

export default function MarketGearTab({ showFb }: MarketGearTabProps) {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const market = useMarketStore()

  const [equipPrice, setEquipPrice] = useState<Record<string, number>>({})
  const [equipSlotFilter, setEquipSlotFilter] = useState<string>('all')
  const [equipTierFilter, setEquipTierFilter] = useState<string>('all')
  const [sellPopupItem, setSellPopupItem] = useState<EquipItem | null>(null)
  const [sellPopupPrice, setSellPopupPrice] = useState(0)

  return (
    <>
      {/* YOUR EQUIPMENT — click to list */}
      <div className="market-section-title">YOUR EQUIPMENT — CLICK TO LIST</div>
      {inventory.items.filter(i => i.location === 'inventory').length === 0
        ? <div className="market-empty">No equipment in inventory.</div>
        : Object.entries(
            inventory.items.filter(i => i.location === 'inventory').reduce<Record<string, EquipItem[]>>((acc, item) => {
              const key = item.slot; acc[key] = acc[key] || []; acc[key].push(item); return acc
            }, {})
          ).map(([slot, items]) => (
            <div key={slot} style={{ marginBottom: 12 }}>
              <div className="market-resource-category__title">
                {SLOT_ICONS[slot as EquipSlot]} {slot}
              </div>
              <div className="ptab-gear-grid">
                {items.sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier)).map(item => {
                  const tierColor = TIER_COLORS[item.tier] || '#94a3b8'
                  const tierLabel = TIER_LABELS[item.tier] || item.tier.toUpperCase()
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
                    <div
                      key={item.id}
                      className="ptab-gear-card"
                      style={{
                        borderColor: item.equipped ? 'rgba(132,204,22,0.4)' : `${tierColor}30`,
                        '--card-tier-color': tierColor,
                        boxShadow: item.equipped ? '0 0 8px rgba(132,204,22,0.15)' : undefined,
                        cursor: item.equipped ? 'not-allowed' : 'pointer',
                      } as React.CSSProperties}
                      onClick={() => {
                        if (!item.equipped) {
                          setSellPopupItem(item)
                          setSellPopupPrice(equipPrice[item.id] || TIER_SELL_PRICE[item.tier])
                        }
                      }}
                      title={item.equipped ? `${item.name} (EQUIPPED)` : `Click to list ${item.name}`}
                    >
                      {item.equipped && <div style={{ position: 'absolute', top: '4px', right: '4px', fontSize: '7px', fontWeight: 900, color: '#84cc16', letterSpacing: '0.08em' }}>EQ</div>}
                      <div className="ptab-gear-card__top">
                        <span className="ptab-gear-card__slot">{item.slot.toUpperCase()}</span>
                        <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
                      </div>
                      <div className="ptab-gear-card__img-wrap">
                        {imgUrl
                          ? <img src={imgUrl} alt={item.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} />
                          : <div style={{ fontSize: '28px', opacity: 0.4, filter: `drop-shadow(0 0 4px ${tierColor})` }}>{SLOT_ICONS[item.slot]}</div>}
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
          ))
      }

      {/* SELL POPUP MODAL */}
      {sellPopupItem && (() => {
        const item = sellPopupItem
        const tierColor = TIER_COLORS[item.tier] || '#94a3b8'
        const tierLabel = TIER_LABELS[item.tier] || item.tier.toUpperCase()
        const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
        const dur = Number(item.durability ?? 100)
        const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setSellPopupItem(null)}>
            <div className="inv-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px' }}>
              {/* Hero image */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 12px', marginBottom: '12px', background: `radial-gradient(ellipse at center, ${tierColor}10 0%, transparent 70%)` }}>
                {imgUrl ? (
                  <img src={imgUrl} alt={item.name} style={{ width: '72px', height: '72px', objectFit: 'contain', filter: `drop-shadow(0 4px 16px ${tierColor}40)`, marginBottom: '8px' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <div style={{ fontSize: '48px', marginBottom: '8px', opacity: 0.5 }}>{SLOT_ICONS[item.slot]}</div>
                )}
                <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', color: tierColor, letterSpacing: '0.08em', textShadow: `0 0 12px ${tierColor}50` }}>{item.name}</div>
                <div style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', color: '#64748b', letterSpacing: '0.1em', marginTop: '2px' }}>{tierLabel} • {item.slot.toUpperCase()}</div>
              </div>

              {/* Stats */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                {[
                  item.stats.damage && { label: 'DAMAGE', val: `${item.stats.damage}`, color: '#f87171' },
                  item.stats.critRate && { label: 'CRIT RATE', val: `${item.stats.critRate}%`, color: '#fb923c' },
                  item.stats.critDamage && { label: 'CRIT DMG', val: `+${item.stats.critDamage}%`, color: '#fb923c' },
                  item.stats.armor && { label: 'ARMOR', val: `+${item.stats.armor}%`, color: '#94a3b8' },
                  item.stats.dodge && { label: 'EVASION', val: `+${item.stats.dodge}%`, color: '#34d399' },
                  item.stats.precision && { label: 'ACCURACY', val: `+${item.stats.precision}%`, color: '#38bdf8' },
                ].filter(Boolean).map((s: any) => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px' }}>{getStatIcon(s.label, s.color, 12)}{s.label}</span>
                    <span style={{ color: s.color, fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{s.val}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: '10px', fontFamily: 'var(--font-mono)', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: '4px', paddingTop: '6px' }}>
                  <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>DURABILITY</span>
                  <span style={{ color: durColor, fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '11px' }}>{dur.toFixed(0)}%</span>
                </div>
              </div>

              {/* Price input */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>SET LISTING PRICE</div>
                <input type="number" min={100} step={100} value={sellPopupPrice}
                  onChange={e => setSellPopupPrice(+e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: 900,
                    background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(251,191,36,0.3)', borderRadius: '6px',
                    color: '#fbbf24', textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                  }} />
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                  {[TIER_SELL_PRICE[item.tier], TIER_SELL_PRICE[item.tier] * 2, TIER_SELL_PRICE[item.tier] * 5, TIER_SELL_PRICE[item.tier] * 10].map(p => (
                    <button key={p} onClick={() => setSellPopupPrice(p)}
                      style={{
                        flex: 1, padding: '4px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)',
                        background: sellPopupPrice === p ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${sellPopupPrice === p ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '3px', color: sellPopupPrice === p ? '#fbbf24' : '#94a3b8', cursor: 'pointer',
                      }}
                    >${p.toLocaleString()}</button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={async () => {
                  setEquipPrice(p => ({ ...p, [item.id]: sellPopupPrice }))
                  const r = await market.placeEquipmentSellOrder(item.id, sellPopupPrice)
                  showFb(r.message, r.success)
                  if (r.success) { setSellPopupItem(null); market.fetchListings() }
                }} style={{
                  width: '100%', padding: '12px', fontSize: '12px', fontWeight: 900,
                  fontFamily: 'var(--font-display)', letterSpacing: '1.5px',
                  background: 'linear-gradient(135deg, rgba(34,211,138,0.2), rgba(16,185,129,0.15))',
                  border: '2px solid rgba(34,211,138,0.5)', borderRadius: '6px',
                  color: '#22d38a', cursor: 'pointer',
                  boxShadow: '0 0 16px rgba(34,211,138,0.2)',
                }}>
                  📋 LIST FOR ${sellPopupPrice.toLocaleString()}
                </button>
                <button onClick={() => setSellPopupItem(null)} style={{
                  width: '100%', padding: '6px', fontSize: '9px', fontWeight: 600,
                  fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
                  background: 'transparent', color: '#475569',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', cursor: 'pointer',
                }}>CLOSE</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* EQUIPMENT MARKETPLACE */}
      <div className="market-section-title">⚔️ EQUIPMENT MARKETPLACE</div>

      {/* Slot filter */}
      <div className="market-filter-bar">
        {['all', 'weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots'].map(s => (
          <button key={s} onClick={() => setEquipSlotFilter(s)}
            className={`market-filter-btn ${equipSlotFilter === s ? 'market-filter-btn--active' : ''}`}
            style={equipSlotFilter === s ? { borderColor: '#3b82f6', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' } : undefined}
          >{s === 'all' ? '🔹 All' : `${SLOT_ICONS[s as EquipSlot] || ''} ${s}`}</button>
        ))}
      </div>

      {/* Tier filter */}
      <div className="market-filter-bar" style={{ marginBottom: 12 }}>
        {['all', ...TIER_ORDER].map(t => {
          const c = RARITY_COLOR[TIER_RARITY[t as EquipTier] || 'blue']
          const active = equipTierFilter === t
          return (
            <button key={t} onClick={() => setEquipTierFilter(t)}
              className={`market-filter-btn ${active ? 'market-filter-btn--active' : ''}`}
              style={active ? { borderColor: c, background: `${c}18`, color: c } : undefined}
            >{t === 'all' ? '🔹 All Tiers' : TIER_LABELS[t as EquipTier]}</button>
          )
        })}
      </div>

      {(() => {
        let listings = market.getEquipmentListings()
        if (equipSlotFilter !== 'all') listings = listings.filter(o => o.equipSnapshot?.slot === equipSlotFilter)
        if (equipTierFilter !== 'all') listings = listings.filter(o => o.equipSnapshot?.tier === equipTierFilter)
        const count = market.getEquipmentListings().length
        if (count === 0) return <div className="market-empty">No equipment listed. Be the first to sell gear!</div>
        if (listings.length === 0) return <div className="market-empty">No listings match filters ({count} total listings)</div>
        return (
          <>
          <div className="market-filter-count">Showing {listings.length} of {count} listings</div>
          <div className="ptab-gear-grid">
            {listings.map(order => {
              if (!order.equipSnapshot) return null
              const snap = order.equipSnapshot
              const tierColor = TIER_COLORS[snap.tier as EquipTier] || '#94a3b8'
              const tierLabel = TIER_LABELS[snap.tier as EquipTier] || snap.tier
              const imgUrl = getItemImagePath(snap.tier as any, snap.slot as any, snap.category as any, snap.weaponSubtype as any, snap.superforged)
              const isMine = order.playerId === player.name
              const canBuy = !isMine && player.money >= order.totalPrice
              const dur = Number(snap.durability ?? 100)
              const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
              const statEntries: { label: string; val: string; color: string }[] = []
              if (snap.stats.damage) statEntries.push({ label: 'DMG', val: `${snap.stats.damage}`, color: '#f87171' })
              if (snap.stats.critRate) statEntries.push({ label: 'CRIT', val: `${snap.stats.critRate}%`, color: '#fb923c' })
              if (snap.stats.critDamage) statEntries.push({ label: 'C.DMG', val: `${snap.stats.critDamage}%`, color: '#fb923c' })
              if (snap.stats.armor) statEntries.push({ label: 'ARM', val: `${snap.stats.armor}%`, color: '#94a3b8' })
              if (snap.stats.dodge) statEntries.push({ label: 'EVA', val: `${snap.stats.dodge}%`, color: '#34d399' })
              if (snap.stats.precision) statEntries.push({ label: 'ACC', val: `${snap.stats.precision}%`, color: '#38bdf8' })
              return (
                <div key={order.id} className="ptab-gear-card" style={{
                  borderColor: `${tierColor}30`, '--card-tier-color': tierColor,
                } as React.CSSProperties}>
                  <div className="ptab-gear-card__top">
                    <span className="ptab-gear-card__slot">{snap.slot.toUpperCase()}</span>
                    <span className="ptab-gear-card__tier" style={{ color: tierColor }}>{tierLabel.split(' ')[0]}</span>
                  </div>
                  <div className="ptab-gear-card__img-wrap">
                    {imgUrl
                      ? <img src={imgUrl} alt={snap.name} className="ptab-gear-card__img" onError={e => { e.currentTarget.style.display = 'none' }} />
                      : <div style={{ fontSize: '28px', opacity: 0.4 }}>{SLOT_ICONS[snap.slot as EquipSlot]}</div>}
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
                    <div className="ptab-gear-card__dur-bar">
                      <div className="ptab-gear-card__dur-fill" style={{ width: `${dur}%`, background: durColor }} />
                    </div>
                    <div className="ptab-gear-card__dur-lbl" style={{ color: durColor }}>{dur.toFixed(0)}%</div>
                  </div>
                  {/* Price + seller + action */}
                  <div style={{ padding: '4px 6px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#fbbf24', marginBottom: '2px' }}>${order.totalPrice.toLocaleString()}</div>
                    <div style={{ fontSize: '7px', color: '#475569', marginBottom: '4px' }}>by {order.playerId}</div>
                    <button onClick={async () => {
                      if (isMine) { const r = await market.cancelOrder(order.id); showFb(r.message, r.success) }
                      else { const r = await market.buyEquipment(order.id); showFb(r.message, r.success) }
                      market.fetchListings()
                    }} style={{
                      width: '100%', padding: '5px', fontSize: '9px', fontWeight: 800,
                      fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                      border: `1px solid ${isMine ? 'rgba(239,68,68,0.4)' : canBuy ? 'rgba(34,211,138,0.4)' : 'rgba(100,116,139,0.2)'}`,
                      borderRadius: '3px', cursor: isMine || canBuy ? 'pointer' : 'not-allowed',
                      background: isMine ? 'rgba(239,68,68,0.12)' : canBuy ? 'rgba(34,211,138,0.12)' : 'rgba(100,116,139,0.06)',
                      color: isMine ? '#ef4444' : canBuy ? '#22d38a' : '#475569',
                    }}>
                      {isMine ? '✕ DELIST' : canBuy ? '💰 BUY' : '⛔ NO $'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )
      })()}
    </>
  )
}
