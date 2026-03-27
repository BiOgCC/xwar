import React, { useState } from 'react'
import { getStatIcon } from '../../shared/StatIcon'
import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore, type EquipItem, TIER_COLORS, TIER_LABELS, TIER_ORDER, SLOT_ICONS, getItemImagePath, ARMOR_SLOTS, WEAPON_SUBTYPES } from '../../../stores/inventoryStore'
import { useMarketStore } from '../../../stores/market'
import type { EquipTier, EquipSlot } from '../../../stores/inventoryStore'

/* ── Tier pricing defaults ── */
const TIER_SELL_PRICE: Record<string, number> = {
  t1: 1200, t2: 5000, t3: 25000, t4: 90000, t5: 280000, t6: 830000, t7: 2500000
}

/* ── Slot display config (order matches reference) ── */
const SLOT_CATEGORIES: { slot: EquipSlot; label: string }[] = [
  { slot: 'weapon', label: 'Weapons' },
  { slot: 'helmet', label: 'Helmets' },
  { slot: 'chest', label: 'Chests' },
  { slot: 'gloves', label: 'Gloves' },
  { slot: 'legs', label: 'Pants' },
  { slot: 'boots', label: 'Boots' },
]

interface MarketGearTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

export default function MarketGearTab({ showFb }: MarketGearTabProps) {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const market = useMarketStore()

  const [sellPopupItem, setSellPopupItem] = useState<EquipItem | null>(null)
  const [sellPopupPrice, setSellPopupPrice] = useState(0)
  const [showSellPicker, setShowSellPicker] = useState(false)
  const [detailOrder, setDetailOrder] = useState<any | null>(null)

  /* ── Equipment listings ── */
  const listings = market.getEquipmentListings()

  /** Filter listings matching slot+tier and optional subtype */
  const getFiltered = (slot: string, tier: string, subtype?: string) => {
    return listings.filter(o => {
      if (!o.equipSnapshot) return false
      if (o.equipSnapshot.slot !== slot || o.equipSnapshot.tier !== tier) return false
      if (subtype) return o.equipSnapshot.weaponSubtype === subtype
      return true
    })
  }

  /* Helper: cheapest price for slot+tier+subtype */
  const cheapest = (slot: string, tier: string, subtype?: string) => {
    const list = getFiltered(slot, tier, subtype)
    if (list.length === 0) return null
    return list.reduce((min, o) => o.totalPrice < min.totalPrice ? o : min, list[0])
  }

  const count = (slot: string, tier: string, subtype?: string) => {
    return getFiltered(slot, tier, subtype).length
  }

  /* Format price compactly */
  const fmtPrice = (p: number) => {
    if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(1)}M`
    if (p >= 1000) return `${(p / 1000).toFixed(1)}k`
    return p.toString()
  }

  return (
    <>
      {/* Tax notice */}
      <div className="gear-mkt-notice">
        <span className="gear-mkt-notice__icon">ℹ️</span>
        <div>
          <strong>Taxed price</strong><br />
          All prices displayed include a 1% market tax from your country{' '}
          <img
            src={`https://flagcdn.com/16x12/${player.countryCode?.toLowerCase() || 'us'}.png`}
            alt=""
            style={{ width: 14, height: 10, verticalAlign: 'middle', margin: '0 2px', borderRadius: 1 }}
          />{' '}
          {player.country || 'United States'}.
        </div>
      </div>

      {/* Category sections */}
      {SLOT_CATEGORIES.map(({ slot, label }) => (
        <div key={slot} className="gear-mkt-category">
          <div className="gear-mkt-category__title">{label}</div>
          <div className="gear-mkt-row">
            {slot === 'weapon' ? (
              /* Weapons: one tile per subtype per tier (T5 shows Tank+RPG, T6 shows Jet+Warship) */
              TIER_ORDER.flatMap(tier =>
                WEAPON_SUBTYPES[tier].map(sub => {
                  const tierColor = TIER_COLORS[tier]
                  const imgUrl = getItemImagePath(tier, slot, 'weapon', sub as any, false)
                  const cheapestOrder = cheapest(slot, tier, sub)
                  const qty = count(slot, tier, sub)
                  const subLabel = sub.charAt(0).toUpperCase() + sub.slice(1)
                  return (
                    <div
                      key={`${tier}-${sub}`}
                      className="gear-mkt-tile"
                      style={{ '--tile-color': tierColor } as React.CSSProperties}
                      onClick={() => { if (cheapestOrder) setDetailOrder(cheapestOrder) }}
                      title={`${TIER_LABELS[tier]} ${subLabel} — ${qty} listed`}
                    >
                      <div className="gear-mkt-tile__img">
                        {imgUrl ? (
                          <img src={imgUrl} alt={`${tier} ${sub}`} onError={e => { e.currentTarget.style.display = 'none' }} />
                        ) : (
                          <span className="gear-mkt-tile__img-emoji">{SLOT_ICONS[slot]}</span>
                        )}
                      </div>
                      <div className="gear-mkt-tile__price">
                        <span style={{ fontSize: '8px', color: '#fbbf24' }}>💰</span>
                        <span className="gear-mkt-tile__price-val">
                          {cheapestOrder ? fmtPrice(cheapestOrder.totalPrice) : '—'}
                        </span>
                      </div>
                      <div className={`gear-mkt-tile__qty ${qty > 0 ? 'gear-mkt-tile__qty--available' : 'gear-mkt-tile__qty--zero'}`}>
                        {qty}
                      </div>
                    </div>
                  )
                })
              )
            ) : (
              /* Armor: one tile per tier */
              TIER_ORDER.map(tier => {
                const tierColor = TIER_COLORS[tier]
                const imgUrl = getItemImagePath(tier, slot, 'armor', undefined, false)
                const cheapestOrder = cheapest(slot, tier)
                const qty = count(slot, tier)
                return (
                  <div
                    key={tier}
                    className="gear-mkt-tile"
                    style={{ '--tile-color': tierColor } as React.CSSProperties}
                    onClick={() => { if (cheapestOrder) setDetailOrder(cheapestOrder) }}
                    title={`${TIER_LABELS[tier]} ${label} — ${qty} listed`}
                  >
                    <div className="gear-mkt-tile__img">
                      {imgUrl ? (
                        <img src={imgUrl} alt={`${tier} ${slot}`} onError={e => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <span className="gear-mkt-tile__img-emoji">{SLOT_ICONS[slot]}</span>
                      )}
                    </div>
                    <div className="gear-mkt-tile__price">
                      <span style={{ fontSize: '8px', color: '#fbbf24' }}>💰</span>
                      <span className="gear-mkt-tile__price-val">
                        {cheapestOrder ? fmtPrice(cheapestOrder.totalPrice) : '—'}
                      </span>
                    </div>
                    <div className={`gear-mkt-tile__qty ${qty > 0 ? 'gear-mkt-tile__qty--available' : 'gear-mkt-tile__qty--zero'}`}>
                      {qty}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ))}

      {/* + New item offer button */}
      <button className="gear-mkt-offer-btn" onClick={() => setShowSellPicker(true)}>
        + New item offer
      </button>

      {/* Bottom nav (pagination hint) */}
      <div className="gear-mkt-nav">
        <button className="gear-mkt-nav__btn" title="Previous">‹</button>
        <button className="gear-mkt-nav__btn" title="Close">✕</button>
      </div>

      {/* ══════ DETAIL / BUY POPUP ══════ */}
      {detailOrder && (() => {
        const order = detailOrder
        const snap = order.equipSnapshot
        if (!snap) return null
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

        // All listings for same slot+tier+subtype
        const slotTierListings = getFiltered(snap.slot, snap.tier, snap.weaponSubtype || undefined)
        const currentIdx = slotTierListings.findIndex((o: any) => o.id === order.id)

        return (
          <div className="gear-mkt-detail-overlay" onClick={() => setDetailOrder(null)}>
            <div className="inv-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '340px' }}>
              {/* Hero image */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 12px', marginBottom: '12px', background: `radial-gradient(ellipse at center, ${tierColor}10 0%, transparent 70%)` }}>
                {imgUrl ? (
                  <img src={imgUrl} alt={snap.name} style={{ width: '72px', height: '72px', objectFit: 'contain', filter: `drop-shadow(0 4px 16px ${tierColor}40)`, marginBottom: '8px' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <div style={{ fontSize: '48px', marginBottom: '8px', opacity: 0.5 }}>{SLOT_ICONS[snap.slot as EquipSlot]}</div>
                )}
                <div style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'var(--font-display)', color: tierColor, letterSpacing: '0.08em', textShadow: `0 0 12px ${tierColor}50` }}>{snap.name}</div>
                <div style={{ fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', color: '#64748b', letterSpacing: '0.1em', marginTop: '2px' }}>{tierLabel} • {snap.slot.toUpperCase()}</div>
              </div>

              {/* Stats */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                {statEntries.map(s => (
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

              {/* Price + seller + action */}
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#fbbf24', marginBottom: '2px' }}>${order.totalPrice.toLocaleString()}</div>
                <div style={{ fontSize: '9px', color: '#475569' }}>by {order.playerId}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={async () => {
                  if (isMine) { const r = await market.cancelOrder(order.id); showFb(r.message, r.success) }
                  else { const r = await market.buyEquipment(order.id); showFb(r.message, r.success) }
                  market.fetchListings()
                  setDetailOrder(null)
                }} style={{
                  width: '100%', padding: '12px', fontSize: '12px', fontWeight: 900,
                  fontFamily: 'var(--font-display)', letterSpacing: '1.5px',
                  background: isMine ? 'rgba(239,68,68,0.12)' : canBuy ? 'linear-gradient(135deg, rgba(34,211,138,0.2), rgba(16,185,129,0.15))' : 'rgba(100,116,139,0.06)',
                  border: `2px solid ${isMine ? 'rgba(239,68,68,0.5)' : canBuy ? 'rgba(34,211,138,0.5)' : 'rgba(100,116,139,0.2)'}`,
                  borderRadius: '6px',
                  color: isMine ? '#ef4444' : canBuy ? '#22d38a' : '#475569',
                  cursor: isMine || canBuy ? 'pointer' : 'not-allowed',
                  boxShadow: canBuy ? '0 0 16px rgba(34,211,138,0.2)' : undefined,
                }}>
                  {isMine ? '✕ DELIST' : canBuy ? '💰 BUY' : '⛔ INSUFFICIENT FUNDS'}
                </button>

                {/* Navigate between listings of same slot+tier */}
                {slotTierListings.length > 1 && (
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        const prev = currentIdx > 0 ? currentIdx - 1 : slotTierListings.length - 1
                        setDetailOrder(slotTierListings[prev])
                      }}
                      style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-display)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', color: '#94a3b8', cursor: 'pointer' }}
                    >‹ Prev</button>
                    <span style={{ fontSize: '9px', color: '#475569', padding: '4px 8px', fontFamily: 'var(--font-display)' }}>{currentIdx + 1} / {slotTierListings.length}</span>
                    <button
                      onClick={() => {
                        const next = currentIdx < slotTierListings.length - 1 ? currentIdx + 1 : 0
                        setDetailOrder(slotTierListings[next])
                      }}
                      style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-display)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', color: '#94a3b8', cursor: 'pointer' }}
                    >Next ›</button>
                  </div>
                )}

                <button onClick={() => setDetailOrder(null)} style={{
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

      {/* ══════ SELL PICKER POPUP ══════ */}
      {showSellPicker && (
        <div className="gear-mkt-detail-overlay" onClick={() => setShowSellPicker(false)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0', letterSpacing: '0.08em' }}>SELECT ITEM TO SELL</div>
              <button onClick={() => setShowSellPicker(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            {inventory.items.filter(i => i.location === 'inventory').length === 0 ? (
              <div className="market-empty">No equipment in inventory.</div>
            ) : (
              <div className="gear-mkt-inv-picker">
                {Object.entries(
                  inventory.items.filter(i => i.location === 'inventory').reduce<Record<string, EquipItem[]>>((acc, item) => {
                    const key = item.slot; acc[key] = acc[key] || []; acc[key].push(item); return acc
                  }, {})
                ).map(([slot, items]) => (
                  <div key={slot}>
                    <div className="gear-mkt-inv-slot-title">{SLOT_ICONS[slot as EquipSlot]} {slot}</div>
                    <div className="gear-mkt-inv-row">
                      {items.sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier)).map(item => {
                        const tierColor = TIER_COLORS[item.tier] || '#94a3b8'
                        const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
                        return (
                          <div
                            key={item.id}
                            className="gear-mkt-tile"
                            style={{
                              '--tile-color': tierColor,
                              cursor: item.equipped ? 'not-allowed' : 'pointer',
                              opacity: item.equipped ? 0.4 : 1,
                            } as React.CSSProperties}
                            onClick={() => {
                              if (!item.equipped) {
                                setShowSellPicker(false)
                                setSellPopupItem(item)
                                setSellPopupPrice(TIER_SELL_PRICE[item.tier])
                              }
                            }}
                            title={item.equipped ? `${item.name} (EQUIPPED)` : `Sell ${item.name}`}
                          >
                            {item.equipped && <div style={{ position: 'absolute', top: '3px', right: '3px', fontSize: '6px', fontWeight: 900, color: '#84cc16', zIndex: 2, letterSpacing: '0.08em' }}>EQ</div>}
                            <div className="gear-mkt-tile__img">
                              {imgUrl ? (
                                <img src={imgUrl} alt={item.name} onError={e => { e.currentTarget.style.display = 'none' }} />
                              ) : (
                                <span className="gear-mkt-tile__img-emoji">{SLOT_ICONS[item.slot]}</span>
                              )}
                            </div>
                            <div className="gear-mkt-tile__price">
                              <span className="gear-mkt-tile__price-val" style={{ color: tierColor, fontSize: '7px' }}>{TIER_LABELS[item.tier]?.split(' ')[0]}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ SELL POPUP MODAL (set price) ══════ */}
      {sellPopupItem && (() => {
        const item = sellPopupItem
        const tierColor = TIER_COLORS[item.tier] || '#94a3b8'
        const tierLabel = TIER_LABELS[item.tier] || item.tier.toUpperCase()
        const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
        const dur = Number(item.durability ?? 100)
        const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'
        return (
          <div className="gear-mkt-detail-overlay" onClick={() => setSellPopupItem(null)}>
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
    </>
  )
}
