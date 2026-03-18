import React, { useState } from 'react'
import { usePlayerStore, type PlayerState } from '../../stores/playerStore'
import { useInventoryStore, type EquipItem, TIER_COLORS, TIER_LABELS, TIER_ORDER, generateStats, ARMOR_SLOTS, SLOT_ICONS, getItemImagePath } from '../../stores/inventoryStore'
import { useMarketStore, RESOURCE_DEFS, type ResourceId, type MarketOrder, type TradeRecord } from '../../stores/marketStore'
import { useUIStore } from '../../stores/uiStore'
import type { EquipTier, EquipSlot, EquipCategory } from '../../stores/inventoryStore'
import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/armyStore'
import { useWorldStore } from '../../stores/worldStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import '../../styles/market.css'
import ResourceIcon from '../shared/ResourceIcon'

/* ─── Colour helpers ─── */
const RARITY_COLOR: Record<string, string> = {
  red: '#ef4444', yellow: '#eab308', blue: '#3b82f6',
  purple: '#a855f7', green: '#10b981', grey: '#64748b',
}
const RARITY_BG: Record<string, string> = {
  red: 'rgba(239,68,68,0.2)', yellow: 'rgba(234,179,8,0.2)',
  blue: 'rgba(59,130,246,0.2)', purple: 'rgba(168,85,247,0.2)',
  green: 'rgba(16,185,129,0.2)', grey: 'rgba(100,116,139,0.2)',
}

const TIER_RARITY: Record<EquipTier, string> = {
  t1: 'grey', t2: 'green', t3: 'blue', t4: 'purple', t5: 'yellow', t6: 'red'
}
const TIER_SELL_PRICE: Record<EquipTier, number> = {
  t1: 120, t2: 360, t3: 1200, t4: 4500, t5: 18000, t6: 80000
}

const CATEGORY_RARITY: Record<string, string> = {
  Construction: 'green', Food: 'blue', Ammo: 'purple', Cases: 'red', Buffs: 'grey',
}

const TAB_DEFS = [
  { key: 'trading' as const, icon: '📈', label: 'Market' },
  { key: 'equipment' as const, icon: '⚔️', label: 'Gear' },
  { key: 'divisions' as const, icon: '🪖', label: 'Divs' },
  { key: 'orders' as const, icon: '📋', label: 'Orders' },
  { key: 'history' as const, icon: '📊', label: 'History' },
]

/* ══════════════════════════════════════════════════════════════ */
export default function MarketPanel() {
  const player    = usePlayerStore()
  const inventory = useInventoryStore()
  const market    = useMarketStore()
  const ui        = useUIStore()

  const [tab, setTab] = useState<'trading' | 'equipment' | 'divisions' | 'orders' | 'history'>('trading')
  const [selResource, setSelResource] = useState<ResourceId | null>(null)
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState(1)
  const [limitPrice, setLimitPrice] = useState(0)
  const [equipPrice, setEquipPrice] = useState<Record<string, number>>({})
  const [divPrice, setDivPrice] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')
  const [countryMode, setCountryMode] = useState(false)
  const [equipSlotFilter, setEquipSlotFilter] = useState<string>('all')
  const [equipTierFilter, setEquipTierFilter] = useState<string>('all')
  const [sellPopupItem, setSellPopupItem] = useState<EquipItem | null>(null)
  const [sellPopupPrice, setSellPopupPrice] = useState(0)

  const showFb = (msg: string, ok = true) => {
    setFeedback(msg)
    ui.addFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, ok ? '#22d38a' : '#ef4444')
    setTimeout(() => setFeedback(''), 3000)
  }

  const isError = feedback.includes('Need') || feedback.includes('Not') || feedback.includes('Cannot') || feedback.includes('Invalid')

  const equippedCount = inventory.items.filter(i => i.equipped).length
  const totalItems    = inventory.items.length

  // President check for country trading
  const iso = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[iso]
  const isPresident = gov?.president === player.name
  const countryFund = useWorldStore.getState().getCountry(iso)?.fund

  /* ══════════════════ MAIN RENDER ══════════════════ */
  return (
    <div className="market-panel">
      {/* ── INVENTORY HEADER ── */}
      <div className="market-inventory-bar">
        <span className="market-stat" style={{ color: '#fbbf24' }}>🪙 {player.money.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#94a3b8' }} title="Equipped / Total gear">⚔️ {equippedCount}/{totalItems}</span>
        <span className="market-stat" style={{ color: '#3b82f6' }}><ResourceIcon resourceKey="scrap" size={14} /> {player.scrap.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#10b981' }}><ResourceIcon resourceKey="oil" size={14} /> {player.oil.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#eab308' }}><ResourceIcon resourceKey="bitcoin" size={14} /> {player.bitcoin.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#3b82f6' }}><ResourceIcon resourceKey="blueBullets" size={14} /> {player.blueBullets}</span>
        <span className="market-stat" style={{ color: '#10b981' }}><ResourceIcon resourceKey="greenBullets" size={14} /> {player.greenBullets}</span>
        <span className="market-stat" style={{ color: '#a855f7' }}><ResourceIcon resourceKey="purpleBullets" size={14} /> {player.purpleBullets}</span>
      </div>

      {/* feedback */}
      {feedback && (
        <div className={`market-feedback ${isError ? 'market-feedback--error' : 'market-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div className="market-tabs">
        {TAB_DEFS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`market-tab ${tab === t.key ? 'market-tab--active' : ''}`}
          >
            <span className="market-tab__icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="market-content">

        {/* ═══════ TRADING TAB ═══════ */}
        {tab === 'trading' && <>
          {/* Country toggle for president */}
          {isPresident && (
            <div className={`market-president-toggle ${countryMode ? 'market-president-toggle--active' : ''}`}>
              <label className="market-president-toggle__label">
                <input type="checkbox" checked={countryMode} onChange={e => setCountryMode(e.target.checked)} style={{ accentColor: '#22d38a' }} />
                🏛️ TRADE FROM NATIONAL FUND
              </label>
              {countryMode && countryFund && <span className="market-president-toggle__fund">Fund: ${countryFund.money.toLocaleString()}</span>}
            </div>
          )}

          {/* Resource categories */}
          {Object.entries(
            RESOURCE_DEFS.reduce<Record<string, typeof RESOURCE_DEFS>>((acc, r) => {
              acc[r.category] = acc[r.category] || []; acc[r.category].push(r); return acc
            }, {})
          ).map(([cat, items]) => (
            <div key={cat} className="market-resource-category">
              <div className="market-resource-category__title">{cat}</div>
              <div className="market-resource-grid">
                {items.map(def => {
                  const ticker = market.tickers[def.id]
                  const owned = (player as any)[def.playerKey] as number || 0
                  const rarity = CATEGORY_RARITY[def.category] || 'grey'
                  const selected = selResource === def.id
                  return (
                    <div
                      key={def.id}
                      onClick={() => { setSelResource(def.id); setLimitPrice(ticker?.price || def.basePrice); setQty(1); setOrderType('buy') }}
                      className={`market-resource-card ${selected ? 'market-resource-card--selected' : ''}`}
                      style={{ borderColor: selected ? '#3b82f6' : RARITY_BG[rarity] }}
                    >
                      <div className="market-resource-card__icon">
                        {def.iconImage
                          ? <img src={def.iconImage} alt={def.name} style={{ width: '40px', height: '40px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = def.icon }} />
                          : def.icon
                        }
                      </div>
                      <div className="market-resource-card__price">
                        <span className="market-resource-card__price-icon">🪙</span>
                        <span className="market-resource-card__price-val">{(ticker?.price || def.basePrice).toFixed(2)}</span>
                      </div>
                      <div
                        className={`market-resource-card__owned ${owned === 0 ? 'market-resource-card__owned--empty' : ''}`}
                        style={owned > 0 ? { color: '#fff', background: RARITY_COLOR[rarity] } : undefined}
                      >
                        {owned}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* ── ORDER FORM ── */}
          {selResource && (() => {
            const def = RESOURCE_DEFS.find(r => r.id === selResource)!
            const ticker = market.tickers[selResource]
            const owned = (player as any)[def.playerKey] as number || 0
            const book = market.getOrderBook(selResource)
            const totalCost = Math.round(qty * limitPrice * 100) / 100

            return (
              <div className="market-order-form">
                <div className="market-order-form__header">
                  <div className="market-order-form__title">{def.icon} {def.name}</div>
                  <button onClick={() => setSelResource(null)} className="market-order-form__close">✕</button>
                </div>

                {/* Ticker info */}
                <div className="market-ticker-info">
                  <span>Price: <span className="market-ticker-info__price">${ticker?.price.toFixed(2)}</span></span>
                  <span className={`${(ticker?.change24h || 0) >= 0 ? 'market-ticker-info__change--up' : 'market-ticker-info__change--down'}`}>
                    {(ticker?.change24h || 0) >= 0 ? '+' : ''}{ticker?.change24h.toFixed(1)}%
                  </span>
                  <span>Vol: {((ticker?.volume || 0) / 1000).toFixed(0)}k</span>
                  <span>Owned: <span className="market-ticker-info__owned">{owned}</span></span>
                </div>

                {/* Buy/Sell toggle */}
                <div className="market-order-toggle">
                  <button
                    onClick={() => setOrderType('buy')}
                    className={`market-order-btn ${orderType === 'buy' ? 'market-order-btn--buy-active' : ''}`}
                  >BUY</button>
                  <button
                    onClick={() => setOrderType('sell')}
                    className={`market-order-btn ${orderType === 'sell' ? 'market-order-btn--sell-active' : ''}`}
                  >SELL</button>
                </div>

                {/* Price + Qty */}
                <div className="market-input-row">
                  <div className="market-input-group">
                    <span className="market-input-group__label">Limit Price</span>
                    <input type="number" min={0.01} step={0.01} value={limitPrice} onChange={e => setLimitPrice(+e.target.value)}
                      className="market-input" />
                  </div>
                  <div className="market-input-group">
                    <span className="market-input-group__label">Quantity</span>
                    <input type="number" min={1} step={1} value={qty} onChange={e => setQty(Math.max(1, +e.target.value))}
                      className="market-input market-input--qty" />
                  </div>
                </div>

                {/* Quick qty */}
                <div className="market-qty-bar">
                  {[1, 10, 50, 100, 500].map(n => (
                    <button key={n} onClick={() => setQty(n)}
                      className={`market-qty-btn ${qty === n ? 'market-qty-btn--active' : ''}`}>{n}</button>
                  ))}
                  <button onClick={() => {
                    if (orderType === 'sell') setQty(owned)
                    else if (limitPrice > 0) setQty(Math.max(1, Math.floor(player.money / limitPrice)))
                  }} className="market-qty-btn market-qty-btn--max">MAX</button>
                </div>

                {/* Total */}
                <div className="market-total">
                  Total: <span className="market-total__val">${totalCost.toFixed(2)}</span>
                  {orderType === 'buy' && <span className="market-total__tax"> (1% tax on fill)</span>}
                </div>

                {/* Submit */}
                <button onClick={() => {
                  let r
                  if (countryMode && isPresident) {
                    r = market.placeCountryOrder(orderType, selResource, qty, limitPrice)
                  } else {
                    r = market.placeResourceOrder(orderType, selResource, qty, limitPrice)
                  }
                  showFb(r.message, r.success)
                }} className={`market-submit ${orderType === 'buy' ? 'market-submit--buy' : 'market-submit--sell'}`}>
                  {countryMode ? '🏛️ ' : ''}{orderType === 'buy' ? 'PLACE BUY ORDER' : 'PLACE SELL ORDER'} — ${totalCost.toFixed(2)}
                </button>

                {/* Mini order book */}
                <div className="market-book">
                  <div className="market-book__side">
                    <div className="market-book__title market-book__title--bids">BIDS ({book.buys.length})</div>
                    {book.buys.slice(0, 5).map(o => (
                      <div key={o.id} className="market-book__row">
                        <span className="market-book__price--bid">${o.pricePerUnit.toFixed(2)}</span>
                        <span>{o.amount - o.filledAmount}</span>
                      </div>
                    ))}
                    {book.buys.length === 0 && <div className="market-book__empty">No bids</div>}
                  </div>
                  <div className="market-book__divider" />
                  <div className="market-book__side">
                    <div className="market-book__title market-book__title--asks">ASKS ({book.sells.length})</div>
                    {book.sells.slice(0, 5).map(o => (
                      <div key={o.id} className="market-book__row">
                        <span className="market-book__price--ask">${o.pricePerUnit.toFixed(2)}</span>
                        <span>{o.amount - o.filledAmount}</span>
                      </div>
                    ))}
                    {book.sells.length === 0 && <div className="market-book__empty">No asks</div>}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── MARKET PRICES ── */}
          <div className="market-live-prices">
            <div className="market-section-title">📊 LIVE PRICES</div>
            {RESOURCE_DEFS.filter(r => ['Construction', 'Food'].includes(r.category)).map(def => {
              const t = market.tickers[def.id]
              if (!t) return null
              return (
                <div key={def.id} className="market-live-row">
                  <span className="market-live-row__name">{def.icon} {def.name}</span>
                  <div className="market-live-row__data">
                    <span className="market-live-row__price">${t.price.toFixed(2)}</span>
                    <span className={`market-live-row__change ${t.change24h >= 0 ? 'market-live-row__change--up' : 'market-live-row__change--down'}`}>
                      {t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(1)}%
                    </span>
                    <span className="market-live-row__vol">VOL {(t.volume / 1000).toFixed(0)}k</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>}

        {/* ═══════ EQUIPMENT TAB ═══════ */}
        {tab === 'equipment' && <>
          {/* YOUR EQUIPMENT — click to list */}
          <div className="market-section-title">YOUR EQUIPMENT — CLICK TO LIST</div>
          {inventory.items.length === 0
            ? <div className="market-empty">No equipment in inventory.</div>
            : Object.entries(
                inventory.items.reduce<Record<string, EquipItem[]>>((acc, item) => {
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
                      const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
                      const dur = item.durability ?? 100
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
              ))
          }

          {/* ── SELL POPUP MODAL ── */}
          {sellPopupItem && (() => {
            const item = sellPopupItem
            const tierColor = TIER_COLORS[item.tier] || '#94a3b8'
            const tierLabel = TIER_LABELS[item.tier] || item.tier.toUpperCase()
            const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
            const dur = item.durability ?? 100
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
                        <span style={{ color: '#475569', fontWeight: 500, letterSpacing: '0.06em' }}>{s.label}</span>
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
                    <button onClick={() => {
                      setEquipPrice(p => ({ ...p, [item.id]: sellPopupPrice }))
                      const r = market.placeEquipmentSellOrder(item.id, sellPopupPrice)
                      showFb(r.message, r.success)
                      if (r.success) setSellPopupItem(null)
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
                  const imgUrl = getItemImagePath(snap.tier as any, snap.slot as any, snap.category as any, snap.weaponSubtype as any)
                  const isMine = order.playerId === player.name
                  const canBuy = !isMine && player.money >= order.totalPrice
                  const dur = snap.durability ?? 100
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
                      {/* Price + seller + action */}
                      <div style={{ padding: '4px 6px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#fbbf24', marginBottom: '2px' }}>${order.totalPrice.toLocaleString()}</div>
                        <div style={{ fontSize: '7px', color: '#475569', marginBottom: '4px' }}>by {order.playerId}</div>
                        <button onClick={() => {
                          if (isMine) { const r = market.cancelOrder(order.id); showFb(r.message, r.success) }
                          else { const r = market.buyEquipment(order.id); showFb(r.message, r.success) }
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
        </>}

        {/* ═══════ DIVISIONS TAB ═══════ */}
        {tab === 'divisions' && <DivisionsTab showFb={showFb} />}

        {/* ═══════ ORDERS TAB ═══════ */}
        {tab === 'orders' && <>
          <div className="market-section-title">MY OPEN ORDERS</div>
          {(() => {
            const myOrders = market.getMyOrders()
            if (myOrders.length === 0) return <div className="market-empty">No open orders.</div>
            return myOrders.map(o => {
              const def = RESOURCE_DEFS.find(r => r.id === o.resourceId)
              return (
                <div key={o.id} className={`market-order-row ${o.type === 'buy' ? 'market-order-row--buy' : 'market-order-row--sell'}`}>
                  <div className="market-order-row__info">
                    <span className={`market-order-row__type ${o.type === 'buy' ? 'market-order-row__type--buy' : 'market-order-row__type--sell'}`}>{o.type}</span>
                    <span className="market-order-row__detail">
                      {o.itemType === 'resource' ? `${o.amount - o.filledAmount}/${o.amount} ${def?.name || o.resourceId}` : o.itemType === 'equipment' ? o.equipSnapshot?.name : o.divSnapshot?.name}
                    </span>
                    <span className="market-order-row__price">@ ${o.pricePerUnit.toFixed(2)}</span>
                    {o.source === 'country' && <span className="market-order-row__country-badge">🏛️</span>}
                  </div>
                  <button onClick={() => { const r = market.cancelOrder(o.id); showFb(r.message, r.success) }}
                    className="market-order-row__cancel">
                    CANCEL
                  </button>
                </div>
              )
            })
          })()}
        </>}

        {/* ═══════ HISTORY TAB ═══════ */}
        {tab === 'history' && <>
          <div className="market-section-title">TRANSACTION LOG</div>
          {(() => {
            const trades = market.getRecentTrades(30)
            if (trades.length === 0) return <div className="market-empty">No trades yet.</div>
            return trades.map(t => {
              const def = RESOURCE_DEFS.find(r => r.id === t.resourceId)
              const isMyBuy = t.buyer === player.name
              const isMySell = t.seller === player.name
              const ago = Math.floor((Date.now() - t.timestamp) / 60000)
              return (
                <div key={t.id} className={`market-history-row ${isMyBuy ? 'market-history-row--my-buy' : isMySell ? 'market-history-row--my-sell' : ''}`}>
                  <div className="market-history-row__left">
                    <span>
                      {t.itemType === 'resource' ? `${t.amount}× ${def?.icon || ''} ${def?.name || t.resourceId}` : t.itemType === 'equipment' ? `⚔️ Equipment` : `🪖 Division`}
                    </span>
                    {isMyBuy && <span className="market-history-row__tag market-history-row__tag--bought">← YOU BOUGHT</span>}
                    {isMySell && <span className="market-history-row__tag market-history-row__tag--sold">→ YOU SOLD</span>}
                  </div>
                  <div className="market-history-row__right">
                    <span className="market-history-row__price">${t.totalPrice.toFixed(2)}</span>
                    <span className="market-history-row__tax">tax ${t.tax.toFixed(2)}</span>
                    <span className="market-history-row__time">{ago < 1 ? 'now' : `${ago}m`}</span>
                  </div>
                </div>
              )
            })
          })()}
        </>}

      </div>
    </div>
  )
}

/* ══════ DIVISIONS TAB ══════ */
function DivisionsTab({ showFb }: { showFb: (msg: string, ok?: boolean) => void }) {
  const market = useMarketStore()
  const player = usePlayerStore()
  const armyStoreState = useArmyStore()
  const [listPrice, setListPrice] = useState<Record<string, number>>({})
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [starsFilter, setStarsFilter] = useState<number>(0)

  const myDivisions = Object.values(armyStoreState.divisions).filter((d: any) => d.ownerId === player.name && d.status !== 'destroyed' && d.status !== 'listed')
  const allListings = market.getDivisionListings()
  const myListings = allListings.filter(l => l.playerId === player.name)
  const otherListings = allListings.filter(l => l.playerId !== player.name)

  // Get unique division types from templates
  const divisionTypes = Object.keys(DIVISION_TEMPLATES)

  // Apply filters
  let filteredListings = [...otherListings, ...myListings]
  if (typeFilter !== 'all') filteredListings = filteredListings.filter(o => o.divSnapshot?.type === typeFilter)
  if (starsFilter > 0) filteredListings = filteredListings.filter(o => (o.divSnapshot?.stars || 0) >= starsFilter)

  const starColor = (s: number) => s >= 5 ? '#f59e0b' : s >= 4 ? '#a855f7' : s >= 3 ? '#3b82f6' : '#94a3b8'

  return (
    <>
      {/* YOUR DIVISIONS — SELL */}
      <div className="market-section-title">YOUR DIVISIONS — LIST TO SELL</div>
      {myDivisions.length === 0 ? (
        <div className="market-empty">No divisions available.</div>
      ) : (
        <div className="war-recruit-grid">
          {myDivisions.map(div => {
            const tmpl = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
            const divLevel = Math.floor((div.experience || 0) / 10)
            const price = listPrice[div.id] || 50000
            const canList = div.status === 'ready' || div.status === 'training'
            const hpPct = div.maxHealth > 0 ? Math.round((div.health / div.maxHealth) * 100) : 100
            const mpPct = div.maxManpower > 0 ? Math.round((div.manpower / div.maxManpower) * 100) : 100

            let glowStyle = {}
            if (div.starQuality >= 5) glowStyle = { boxShadow: '0 0 15px rgba(245, 158, 11, 0.4), inset 0 0 10px rgba(245, 158, 11, 0.1)' }
            if (div.starQuality === 4) glowStyle = { boxShadow: '0 0 12px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.1)' }

            return (
              <div key={div.id} className="war-recruit-card" style={glowStyle}>
                {/* Header — icon, name, stars, category */}
                <div className="war-recruit-card__header">
                  {tmpl?.icon && <img src={tmpl.icon} alt={div.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0', letterSpacing: '0.5px', lineHeight: 1.1 }}>{div.name}</div>
                    <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#f59e0b', fontWeight: 600, opacity: 0.85 }}>{div.type} • {div.status}</div>
                  </div>
                  <span style={{ color: starColor(div.starQuality), fontWeight: 700, fontSize: '11px', letterSpacing: '-1px', marginRight: '4px' }}>
                    {'★'.repeat(div.starQuality)}{'☆'.repeat(Math.max(0, 5 - div.starQuality))}
                  </span>
                  <span className={`war-recruit-card__category war-recruit-card__category--${tmpl?.category || 'land'}`}>
                    {(tmpl?.category || 'land').toUpperCase()}
                  </span>
                </div>

                {/* Stats grid — matches recruit card */}
                <div className="war-recruit-card__stats">
                  <div className="war-recruit-stat"><span>HP</span><span className="war-recruit-stat__val">{div.health}/{div.maxHealth}</span></div>
                  <div className="war-recruit-stat"><span>Troops</span><span className="war-recruit-stat__val">{div.manpower}/{div.maxManpower}</span></div>
                  <div className="war-recruit-stat"><span>Level</span><span className="war-recruit-stat__val" style={{ color: '#f59e0b' }}>{divLevel}</span></div>
                  <div className="war-recruit-stat"><span>Stars</span><span className="war-recruit-stat__val" style={{ color: starColor(div.starQuality) }}>{div.starQuality}★</span></div>
                  <div className="war-recruit-stat"><span>Kills</span><span className="war-recruit-stat__val" style={{ color: div.killCount > 0 ? '#ef4444' : undefined }}>{div.killCount}</span></div>
                  <div className="war-recruit-stat"><span>Status</span><span className="war-recruit-stat__val" style={{ color: div.status === 'ready' ? '#22d38a' : div.status === 'in_combat' ? '#ef4444' : '#f59e0b' }}>{div.status}</span></div>
                </div>

                {/* HP bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '4px 0' }}>
                  <div style={{ width: `${hpPct}%`, height: '100%', background: hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                </div>

                {/* Price input + metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>PRICE:</span>
                  <input type="number" min={1000} max={10000000} step={1000} value={price}
                    onChange={e => setListPrice(p => ({ ...p, [div.id]: +e.target.value }))}
                    onClick={e => e.stopPropagation()}
                    style={{
                      flex: 1, padding: '4px 6px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 900,
                      background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '3px',
                      color: '#fbbf24', textAlign: 'right', outline: 'none',
                    }} />
                </div>

                <div className="war-recruit-card__cost" style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span style={{ color: '#fbbf24' }}>🪙 ${price.toLocaleString()}</span>
                </div>

                {/* Metadata badges */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {div.manpower} troops
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)' }}>
                    Lv.{divLevel}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {tmpl?.popCost || '?'} pop
                  </span>
                </div>

                {/* LIST button */}
                <div style={{ marginTop: '6px' }}>
                  <button
                    className="war-recruit-btn"
                    style={{
                      width: '100%', height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: canList ? 'rgba(34,211,138,0.15)' : 'rgba(100,116,139,0.1)',
                      borderColor: canList ? 'rgba(34,211,138,0.4)' : 'rgba(100,116,139,0.2)',
                      color: canList ? '#22d38a' : '#475569',
                    }}
                    disabled={!canList}
                    onClick={() => {
                      const r = market.placeDivisionSellOrder(div.id, price)
                      showFb(r.message, r.success)
                    }}
                  >
                    {canList ? '📋 LIST FOR SALE' : `⛔ ${div.status.toUpperCase()}`}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MARKETPLACE — with filters */}
      <div className="market-section-title">🪖 DIVISION MARKETPLACE</div>

      {/* Type filter */}
      <div className="market-filter-bar">
        <button onClick={() => setTypeFilter('all')}
          className={`market-filter-btn ${typeFilter === 'all' ? 'market-filter-btn--active' : ''}`}
          style={typeFilter === 'all' ? { borderColor: '#3b82f6', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' } : undefined}
        >🔹 All</button>
        {divisionTypes.map(t => {
          const tmpl = DIVISION_TEMPLATES[t as keyof typeof DIVISION_TEMPLATES]
          const active = typeFilter === t
          return (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`market-filter-btn ${active ? 'market-filter-btn--active' : ''}`}
              style={active ? { borderColor: '#f59e0b', background: 'rgba(245,158,11,0.12)', color: '#f59e0b' } : undefined}
            >
              {tmpl?.icon && <img src={tmpl.icon} alt="" />}
              {t}
            </button>
          )
        })}
      </div>

      {/* Stars filter */}
      <div className="market-filter-bar" style={{ marginBottom: 12 }}>
        {[0, 1, 2, 3, 4, 5].map(s => {
          const c = starColor(s || 3)
          const active = starsFilter === s
          return (
            <button key={s} onClick={() => setStarsFilter(s)}
              className={`market-filter-btn ${active ? 'market-filter-btn--active' : ''}`}
              style={active ? { borderColor: c, background: `${c}18`, color: c } : undefined}
            >{s === 0 ? '🔹 Any ★' : `${s}★+`}</button>
          )
        })}
      </div>

      {allListings.length === 0 ? (
        <div className="market-empty">No divisions for sale. List yours above!</div>
      ) : filteredListings.length === 0 ? (
        <div className="market-empty">No listings match filters ({allListings.length} total)</div>
      ) : (
        <>
        <div className="market-filter-count">Showing {filteredListings.length} of {allListings.length} listings</div>
        <div className="war-recruit-grid">
          {filteredListings.map(order => {
            if (!order.divSnapshot) return null
            const snap = order.divSnapshot
            const tmpl = DIVISION_TEMPLATES[snap.type as keyof typeof DIVISION_TEMPLATES]
            const isMine = order.playerId === player.name
            const canBuy = !isMine && player.money >= order.totalPrice
            const hpPct = snap.maxHealth > 0 ? Math.round((snap.health / snap.maxHealth) * 100) : 100

            let glowStyle = {}
            if (snap.stars >= 5) glowStyle = { boxShadow: '0 0 15px rgba(245, 158, 11, 0.4), inset 0 0 10px rgba(245, 158, 11, 0.1)' }
            if (snap.stars === 4) glowStyle = { boxShadow: '0 0 12px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.1)' }

            return (
              <div key={order.id} className={`war-recruit-card ${isMine ? '' : !canBuy ? 'war-recruit-card--disabled' : ''}`} style={glowStyle}>
                {/* Header — icon, name, seller, stars, category */}
                <div className="war-recruit-card__header">
                  {tmpl?.icon && <img src={tmpl.icon} alt={snap.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0', letterSpacing: '0.5px', lineHeight: 1.1 }}>{snap.name}</div>
                    <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#94a3b8', fontWeight: 600, opacity: 0.85 }}>Seller: {order.playerId}</div>
                  </div>
                  <span style={{ color: starColor(snap.stars), fontWeight: 700, fontSize: '11px', letterSpacing: '-1px', marginRight: '4px' }}>
                    {'★'.repeat(snap.stars)}{'☆'.repeat(Math.max(0, 5 - snap.stars))}
                  </span>
                  <span className={`war-recruit-card__category war-recruit-card__category--${tmpl?.category || 'land'}`}>
                    {(tmpl?.category || snap.type).toUpperCase()}
                  </span>
                </div>

                {/* Stats grid — consistent with recruit tab */}
                <div className="war-recruit-card__stats">
                  <div className="war-recruit-stat"><span>HP</span><span className="war-recruit-stat__val">{snap.health}/{snap.maxHealth}</span></div>
                  <div className="war-recruit-stat"><span>Troops</span><span className="war-recruit-stat__val">{snap.manpower}/{snap.maxManpower}</span></div>
                  <div className="war-recruit-stat"><span>Level</span><span className="war-recruit-stat__val" style={{ color: '#f59e0b' }}>{snap.level}</span></div>
                  <div className="war-recruit-stat"><span>Stars</span><span className="war-recruit-stat__val" style={{ color: starColor(snap.stars) }}>{snap.stars}★</span></div>
                </div>

                {/* HP bar */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '4px 0' }}>
                  <div style={{ width: `${hpPct}%`, height: '100%', background: hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                </div>

                {/* Price */}
                <div className="war-recruit-card__cost" style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span style={{ color: '#fbbf24' }}>🪙 ${order.totalPrice.toLocaleString()}</span>
                </div>

                {/* Metadata badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {snap.manpower} troops
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)' }}>
                      Lv.{snap.level}
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {order.countryCode}
                    </span>
                  </div>
                  {isMine && <span style={{ fontSize: '8px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)' }}>YOUR LISTING</span>}
                </div>

                {/* Action button */}
                <div style={{ marginTop: '6px' }}>
                  <button
                    className="war-recruit-btn"
                    style={{ width: '100%', height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isMine ? 'rgba(239,68,68,0.15)' : canBuy ? undefined : 'rgba(100,116,139,0.1)',
                      borderColor: isMine ? 'rgba(239,68,68,0.4)' : canBuy ? undefined : 'rgba(100,116,139,0.2)',
                      color: isMine ? '#ef4444' : canBuy ? undefined : '#475569',
                    }}
                    disabled={!isMine && !canBuy}
                    onClick={() => {
                      if (isMine) { const r = market.cancelOrder(order.id); showFb(r.message, r.success) }
                      else { const r = market.buyDivision(order.id); showFb(r.message, r.success) }
                    }}
                  >
                    {isMine ? '✕ DELIST' : canBuy ? '💰 BUY' : '⛔ INSUFFICIENT FUNDS'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}
    </>
  )
}
