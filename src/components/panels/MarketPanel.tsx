import React, { useState, useRef, useEffect, useCallback } from 'react'
import { usePlayerStore, type PlayerState } from '../../stores/playerStore'
import { useInventoryStore, type EquipItem, TIER_COLORS, TIER_LABELS, TIER_ORDER, generateStats, ARMOR_SLOTS, SLOT_ICONS, getItemImagePath } from '../../stores/inventoryStore'
import { useMarketStore, RESOURCE_DEFS, type ResourceId, type MarketOrder, type TradeRecord } from '../../stores/market'
import { useUIStore } from '../../stores/uiStore'
import type { EquipTier, EquipSlot, EquipCategory } from '../../stores/inventoryStore'
import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/army'
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
  t1: 1200, t2: 5000, t3: 25000, t4: 90000, t5: 280000, t6: 830000
}

const CATEGORY_RARITY: Record<string, string> = {
  Construction: 'green', Food: 'blue', Ammo: 'purple', Cases: 'red', Buffs: 'grey',
}

const TAB_DEFS = [
  { key: 'trading' as const, icon: '/assets/icons/market.png', label: 'Market' },
  { key: 'equipment' as const, icon: '/assets/icons/gear.png', label: 'Gear' },
  { key: 'divisions' as const, icon: '/assets/icons/divs.png', label: 'Divs' },
  { key: 'orders' as const, icon: '/assets/icons/orders.png', label: 'Orders' },
  { key: 'history' as const, icon: '/assets/icons/history.png', label: 'History' },
]

/* ──────── PRICE CHART (canvas) — 3-Day MA + Volume overlay ──────── */
function PriceChart({ priceHistory, currentPrice }: { priceHistory: number[]; currentPrice: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    // Data — use history or fill with currentPrice
    const data = priceHistory.length >= 2 ? [...priceHistory] : Array(24).fill(currentPrice).map((p: number) => p + (Math.random() - 0.45) * p * 0.04)

    // 3-day moving average
    const ma: number[] = []
    for (let i = 0; i < data.length; i++) {
      if (i < 2) { ma.push(data[i]); continue }
      ma.push((data[i] + data[i - 1] + data[i - 2]) / 3)
    }

    // Synthetic volume from price changes (larger moves = more volume)
    const vol: number[] = data.map((p: number, i: number) => {
      if (i === 0) return 500 + Math.random() * 300
      const changePct = Math.abs((p - data[i - 1]) / data[i - 1])
      return 200 + changePct * 20000 + Math.random() * 400
    })

    // Price axis (MA only)
    const minP = Math.min(...ma) * 0.995
    const maxP = Math.max(...ma) * 1.005
    const priceRange = maxP - minP || 1

    // Volume axis
    const maxVol = Math.max(...vol) * 1.2

    const padT = 8, padB = 4, padL = 4, padR = 36
    const cw = w - padL - padR
    const ch = h - padT - padB
    const barW = Math.max(2, (cw / data.length) * 0.6)

    const toX = (i: number) => padL + (i / (data.length - 1)) * cw
    const toY = (v: number) => padT + (1 - (v - minP) / priceRange) * ch
    const volToY = (v: number) => h - padB - (v / maxVol) * ch

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Grid lines (4 horizontal) — price axis
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (ch / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
      // Price label (right)
      const pVal = maxP - (priceRange / 4) * i
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(pVal.toFixed(2), w - padR + 3, y + 3)
    }

    // ── Volume bars (background, 0.33 opacity) ──
    ctx.globalAlpha = 0.33
    vol.forEach((v, i) => {
      const x = toX(i) - barW / 2
      const barH = (v / maxVol) * ch
      const y = h - padB - barH
      // Color: green if price went up, red if down
      const up = i === 0 || data[i] >= data[i - 1]
      ctx.fillStyle = up ? '#22d38a' : '#ef4444'
      ctx.fillRect(x, y, barW, barH)
    })
    ctx.globalAlpha = 1.0

    // Volume axis labels (left side, subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '7px monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 2; i++) {
      const volVal = (maxVol / 2) * i
      const y = h - padB - (volVal / maxVol) * ch
      const label = volVal >= 1000 ? (volVal / 1000).toFixed(1) + 'k' : Math.floor(volVal).toString()
      ctx.fillText(label, padL + 22, y + 3)
    }

    // ── 3-Day MA line (solid yellow) ──
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ma.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)) })
    ctx.stroke()

    // Fill below MA line
    ctx.lineTo(toX(data.length - 1), h - padB)
    ctx.lineTo(toX(0), h - padB)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB)
    grad.addColorStop(0, 'rgba(234,179,8,0.12)')
    grad.addColorStop(1, 'rgba(234,179,8,0)')
    ctx.fillStyle = grad
    ctx.fill()

    // Current price dot
    const lastX = toX(ma.length - 1)
    const lastY = toY(ma[ma.length - 1])
    ctx.beginPath()
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#eab308'
    ctx.fill()

  }, [priceHistory, currentPrice])

  return (
    <div className="mkt-chart">
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div className="mkt-chart__legend">
        <span style={{ color: '#eab308' }}>● 3-Day MA</span>
        <span style={{ color: '#22d38a', opacity: 0.5 }}>█ Volume</span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function MarketPanel() {
  const player    = usePlayerStore()
  const inventory = useInventoryStore()
  const market    = useMarketStore()
  const ui        = useUIStore()

  const [tab, setTab] = useState<'trading' | 'equipment' | 'divisions' | 'orders' | 'history'>('trading')
  const [selResource, setSelResource] = useState<ResourceId>(RESOURCE_DEFS[0].id)
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState(1)
  const [limitPrice, setLimitPrice] = useState(0)
  const [equipPrice, setEquipPrice] = useState<Record<string, number>>({})
  const [divPrice, setDivPrice] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')
  const [countryMode, setCountryMode] = useState(false)
  const [vaultMode, setVaultMode] = useState(false)
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

  const equippedCount = inventory.items.filter(i => i.location === 'inventory' && i.equipped).length
  const totalItems    = inventory.items.filter(i => i.location === 'inventory').length

  // President check for country trading
  const iso = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[iso]
  const isPresident = gov?.president === player.name
  const countryFund = useWorldStore.getState().getCountry(iso)?.fund

  // Vault access check: must be enlisted + Commander or Colonel
  const armyStoreAll = useArmyStore.getState()
  const playersArmies = Object.values(armyStoreAll.armies)
  const myEnlistedArmy = playersArmies.find(a => a.members.some(m => m.playerId === player.name))
  const isVaultOfficer = myEnlistedArmy ? (
    myEnlistedArmy.commanderId === player.name ||
    (myEnlistedArmy.members.find(m => m.playerId === player.name)?.role === 'colonel') ||
    (myEnlistedArmy.members.find(m => m.playerId === player.name)?.role === 'general')
  ) : false

  /* ══════════════════ MAIN RENDER ══════════════════ */
  return (
    <div className="market-panel">
      {/* ── INVENTORY HEADER ── */}
      <div className="market-inventory-bar">
        <span className="market-stat" style={{ color: '#fbbf24' }}>🪙 {player.money.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#3b82f6' }}><ResourceIcon resourceKey="scrap" size={14} /> {player.scrap.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#10b981' }}><ResourceIcon resourceKey="oil" size={14} /> {player.oil.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#eab308' }}><ResourceIcon resourceKey="bitcoin" size={14} /> {player.bitcoin.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#a855f7' }}><ResourceIcon resourceKey="materialX" size={14} /> {player.materialX.toLocaleString()}</span>
        <span className="market-stat" style={{ color: '#3b82f6' }}><ResourceIcon resourceKey="blueBullets" size={14} /> {player.blueBullets}</span>
        <span className="market-stat" style={{ color: '#10b981' }}><ResourceIcon resourceKey="greenBullets" size={14} /> {player.greenBullets}</span>
        <span className="market-stat" style={{ color: '#a855f7' }}><ResourceIcon resourceKey="purpleBullets" size={14} /> {player.purpleBullets}</span>
        <span className="market-stat" style={{ color: '#ef4444' }}><ResourceIcon resourceKey="redBullets" size={14} /> {player.redBullets}</span>
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
            <span className="market-tab__icon"><img src={t.icon} alt={t.label} style={{ width: 18, height: 18, objectFit: 'contain' }} /></span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="market-content">

        {/* ═══════ TRADING TAB — REDESIGNED ═══════ */}
        {tab === 'trading' && <>
          {/* Country toggle for president */}
          {isPresident && (
            <div className={`market-president-toggle ${countryMode ? 'market-president-toggle--active' : ''}`}>
              <label className="market-president-toggle__label">
                <input type="checkbox" checked={countryMode} onChange={e => { setCountryMode(e.target.checked); if (e.target.checked) setVaultMode(false) }} style={{ accentColor: '#22d38a' }} />
                🏛️ TRADE FROM NATIONAL FUND
              </label>
              {countryMode && countryFund && <span className="market-president-toggle__fund">Fund: ${countryFund.money.toLocaleString()}</span>}
            </div>
          )}
          {isVaultOfficer && myEnlistedArmy && (
            <div className={`market-president-toggle ${vaultMode ? 'market-president-toggle--active' : ''}`} style={vaultMode ? { borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)' } : undefined}>
              <label className="market-president-toggle__label">
                <input type="checkbox" checked={vaultMode} onChange={e => { setVaultMode(e.target.checked); if (e.target.checked) setCountryMode(false) }} style={{ accentColor: '#f59e0b' }} />
                🏦 TRADE FROM ARMY VAULT
              </label>
              {vaultMode && <span className="market-president-toggle__fund" style={{ color: '#f59e0b' }}>Vault: ${myEnlistedArmy.vault.money.toLocaleString()} · 🛢️{myEnlistedArmy.vault.oil.toLocaleString()}</span>}
            </div>
          )}

          {/* ── COMPACT RESOURCE SELECTOR STRIP ── */}
          <div className="mkt-strip">
            {RESOURCE_DEFS.map(def => {
              const ticker = market.tickers[def.id]
              const price = ticker?.price || def.basePrice
              const selected = selResource === def.id
              const change = ticker?.change24h || 0
              return (
                <div
                  key={def.id}
                  onClick={() => { setSelResource(def.id); setLimitPrice(price); setQty(1); setOrderType('buy') }}
                  className={`mkt-strip__item ${selected ? 'mkt-strip__item--active' : ''}`}
                >
                  <div className="mkt-strip__icon">
                    {def.iconImage
                      ? <img src={def.iconImage} alt={def.name} style={{ width: 22, height: 22, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.textContent = def.icon }} />
                      : <span style={{ fontSize: 16 }}>{def.icon}</span>
                    }
                  </div>
                  <div className="mkt-strip__price">{price < 1 ? price.toFixed(2) : price < 100 ? price.toFixed(1) : Math.floor(price)}</div>
                  <div className={`mkt-strip__change ${change >= 0 ? 'mkt-strip__change--up' : 'mkt-strip__change--down'}`}>
                    {change >= 0 ? '▲' : '▼'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── SELECTED RESOURCE DETAIL ── */}
          {selResource && (() => {
            const def = RESOURCE_DEFS.find(r => r.id === selResource)!
            const ticker = market.tickers[selResource]
            const owned = (player as any)[def.playerKey] as number || 0
            const book = market.getOrderBook(selResource)
            const totalCost = Math.round(qty * limitPrice * 100) / 100

            return (
              <>
                {/* Resource header */}
                <div className="mkt-detail-header">
                  <div className="mkt-detail-header__left">
                    {def.iconImage
                      ? <img src={def.iconImage} alt={def.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 22 }}>{def.icon}</span>
                    }
                    <div>
                      <div className="mkt-detail-header__name">{def.name}</div>
                      <div className="mkt-detail-header__sub">🪙 {(ticker?.price || def.basePrice).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mkt-detail-header__right">
                    <span className={`mkt-detail-header__change ${(ticker?.change24h || 0) >= 0 ? 'mkt-detail-header__change--up' : 'mkt-detail-header__change--down'}`}>
                      {(ticker?.change24h || 0) >= 0 ? '+' : ''}{(ticker?.change24h || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* ── PRICE CHART ── */}
                <PriceChart priceHistory={ticker?.priceHistory || []} currentPrice={ticker?.price || def.basePrice} />

                {/* ── BUY / SELL FORM ── */}
                <div className="mkt-form">
                  {/* Toggle */}
                  <div className="mkt-form__toggle">
                    <button onClick={() => setOrderType('buy')} className={`mkt-form__toggle-btn ${orderType === 'buy' ? 'mkt-form__toggle-btn--buy' : ''}`}>BUY</button>
                    <button onClick={() => setOrderType('sell')} className={`mkt-form__toggle-btn ${orderType === 'sell' ? 'mkt-form__toggle-btn--sell' : ''}`}>SELL</button>
                  </div>
                  {/* Inputs */}
                  <div className="mkt-form__inputs">
                    <div className="mkt-form__field">
                      <span className="mkt-form__label">Price</span>
                      <input type="number" min={0.01} step={0.01} value={limitPrice} onChange={e => setLimitPrice(+e.target.value)} className="mkt-form__input" />
                    </div>
                    <div className="mkt-form__field">
                      <span className="mkt-form__label">Qty</span>
                      <input type="number" min={1} step={1} value={qty} onChange={e => setQty(Math.max(1, +e.target.value))} className="mkt-form__input mkt-form__input--qty" />
                    </div>
                  </div>
                  {/* Quick qty */}
                  <div className="mkt-form__quick">
                    {[1, 10, 50, 100, 500].map(n => (
                      <button key={n} onClick={() => setQty(n)} className={`mkt-form__qbtn ${qty === n ? 'mkt-form__qbtn--active' : ''}`}>{n}</button>
                    ))}
                    <button onClick={() => {
                      if (orderType === 'sell') setQty(owned)
                      else if (limitPrice > 0) setQty(Math.max(1, Math.floor(player.money / limitPrice)))
                    }} className="mkt-form__qbtn mkt-form__qbtn--max">MAX</button>
                  </div>
                  {/* Total + submit */}
                  <div className="mkt-form__total">
                    Total: <span className="mkt-form__total-val">${totalCost.toFixed(2)}</span>
                    {orderType === 'buy' && <span className="mkt-form__tax">(1% tax)</span>}
                  </div>
                  <button onClick={() => {
                    let r
                    if (vaultMode && isVaultOfficer && myEnlistedArmy) {
                      r = market.placeForceVaultOrder(myEnlistedArmy.id, orderType, selResource, qty, limitPrice)
                    } else if (countryMode && isPresident) {
                      r = market.placeCountryOrder(orderType, selResource, qty, limitPrice)
                    } else {
                      r = market.placeResourceOrder(orderType, selResource, qty, limitPrice)
                    }
                    showFb(r.message, r.success)
                  }} className={`mkt-form__submit ${orderType === 'buy' ? 'mkt-form__submit--buy' : 'mkt-form__submit--sell'}`}>
                    {vaultMode ? '🏦 ' : countryMode ? '🏛️ ' : ''}{orderType === 'buy' ? 'BUY' : 'SELL'} — ${totalCost.toFixed(2)}
                  </button>
                </div>

                {/* ── ORDERBOOK WITH NAMES ── */}
                <div className="mkt-book">
                  <div className="mkt-book__side">
                    <div className="mkt-book__title mkt-book__title--bids">BIDS ({book.buys.length})</div>
                    {book.buys.slice(0, 10).map((o, i) => (
                      <div key={o.id} className="mkt-book__row">
                        <span className="mkt-book__rank">#{i + 1}</span>
                        <span className="mkt-book__avatar" style={{ background: 'rgba(34,211,138,0.2)' }}>👤</span>
                        <div className="mkt-book__info">
                          <span className="mkt-book__name">{o.source === 'country' ? '🏛️' : o.source === 'force_vault' ? '🏦' : ''}{o.playerId.length > 10 ? o.playerId.slice(0, 10) + '…' : o.playerId}</span>
                          <span className="mkt-book__details">
                            <span className="mkt-book__price mkt-book__price--bid">🪙{o.pricePerUnit.toFixed(2)}/u</span>
                            <span className="mkt-book__qty">📦 {(o.amount - o.filledAmount).toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                    {book.buys.length === 0 && <div className="mkt-book__empty">No bids</div>}
                  </div>
                  <div className="mkt-book__side">
                    <div className="mkt-book__title mkt-book__title--asks">ASKS ({book.sells.length})</div>
                    {book.sells.slice(0, 10).map((o, i) => (
                      <div key={o.id} className="mkt-book__row">
                        <span className="mkt-book__rank">#{i + 1}</span>
                        <span className="mkt-book__avatar" style={{ background: 'rgba(239,68,68,0.2)' }}>👤</span>
                        <div className="mkt-book__info">
                          <span className="mkt-book__name">{o.source === 'country' ? '🏛️' : o.source === 'force_vault' ? '🏦' : ''}{o.playerId.length > 10 ? o.playerId.slice(0, 10) + '…' : o.playerId}</span>
                          <span className="mkt-book__details">
                            <span className="mkt-book__price mkt-book__price--ask">🪙{o.pricePerUnit.toFixed(2)}/u</span>
                            <span className="mkt-book__qty">📦 {(o.amount - o.filledAmount).toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                    {book.sells.length === 0 && <div className="mkt-book__empty">No asks</div>}
                  </div>
                </div>
              </>
            )
          })()}
        </>}

        {/* ═══════ EQUIPMENT TAB ═══════ */}
        {tab === 'equipment' && <>
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

        {/* ═══════ ORDERS TAB — REDESIGNED ═══════ */}
        {tab === 'orders' && <>
          <div className="market-section-title">MY OPEN ORDERS</div>
          {(() => {
            const myOrders = market.getMyOrders()
            if (myOrders.length === 0) return <div className="market-empty">No open orders.</div>
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {myOrders.map(o => {
                  const def = RESOURCE_DEFS.find(r => r.id === o.resourceId)
                  const isBuy = o.type === 'buy'
                  const remaining = o.amount - o.filledAmount
                  const accentColor = isBuy ? '#22d38a' : '#ef4444'

                  // Determine icon + name
                  let icon: React.ReactNode = null
                  let itemName = ''
                  if (o.itemType === 'resource' && def) {
                    icon = def.iconImage
                      ? <img src={def.iconImage} alt={def.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 22 }}>{def.icon}</span>
                    itemName = def.name
                  } else if (o.itemType === 'equipment' && o.equipSnapshot) {
                    const imgUrl = getItemImagePath(o.equipSnapshot.tier as any, o.equipSnapshot.slot as any, o.equipSnapshot.category as any, o.equipSnapshot.weaponSubtype as any)
                    icon = imgUrl
                      ? <img src={imgUrl} alt={o.equipSnapshot.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      : <span style={{ fontSize: 22 }}>{SLOT_ICONS[o.equipSnapshot.slot as EquipSlot]}</span>
                    itemName = o.equipSnapshot.name
                  } else if (o.itemType === 'division' && o.divSnapshot) {
                    icon = <span style={{ fontSize: 22 }}>🪖</span>
                    itemName = o.divSnapshot.name
                  }

                  return (
                    <div key={o.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px',
                      background: 'rgba(8,12,18,0.7)',
                      border: `1px solid ${accentColor}20`,
                      borderLeft: `3px solid ${accentColor}`,
                      borderRadius: 6,
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 6,
                        background: 'rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {icon}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{
                            fontSize: 8, fontWeight: 900, fontFamily: 'var(--font-display)',
                            letterSpacing: '0.5px', textTransform: 'uppercase',
                            padding: '1px 5px', borderRadius: 2,
                            background: `${accentColor}18`, color: accentColor,
                            border: `1px solid ${accentColor}40`,
                          }}>{o.type}</span>
                          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#e2e8f0' }}>
                            {itemName}
                          </span>
                          {o.source === 'country' && <span style={{ fontSize: 10 }}>🏛️</span>}
                          {o.source === 'force_vault' && <span style={{ fontSize: 10 }}>🏦</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: 'var(--font-display)' }}>
                          <span style={{ color: '#94a3b8' }}>
                            📦 <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{remaining.toLocaleString()}</span>
                            {o.itemType === 'resource' && <span style={{ color: '#475569' }}>/{o.amount}</span>}
                          </span>
                          <span style={{ color: '#94a3b8' }}>
                            🪙 <span style={{ color: '#fbbf24', fontWeight: 700 }}>${o.pricePerUnit.toFixed(2)}</span>/u
                          </span>
                          <span style={{ color: '#64748b' }}>
                            = <span style={{ color: '#fbbf24' }}>${(remaining * o.pricePerUnit).toFixed(2)}</span>
                          </span>
                        </div>
                      </div>

                      {/* Cancel */}
                      <button onClick={() => { const r = market.cancelOrder(o.id); showFb(r.message, r.success) }}
                        style={{
                          padding: '5px 10px', fontSize: 9, fontWeight: 900,
                          fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                          borderRadius: 4, color: '#ef4444', cursor: 'pointer',
                          transition: 'all 0.15s', flexShrink: 0,
                        }}>
                        ✕ CANCEL
                      </button>
                    </div>
                  )
                })}
              </div>
            )
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

  // President check for country division selling
  const iso = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[iso]
  const isPresident = gov?.president === player.name
  // Country-owned divisions: those belonging to the country that aren't in any army and aren't destroyed/listed
  const countryDivisions = isPresident
    ? Object.values(armyStoreState.divisions).filter(d =>
        d.countryCode === iso && d.ownerId === iso && d.status !== 'destroyed' && d.status !== 'listed'
      )
    : []

  // Vault officer check for vault division selling
  const myEnlistedArmy = Object.values(armyStoreState.armies).find(a => a.members.some(m => m.playerId === player.name))
  const isVaultOfficer = myEnlistedArmy ? (
    myEnlistedArmy.commanderId === player.name ||
    ['colonel', 'general'].includes(myEnlistedArmy.members.find(m => m.playerId === player.name)?.role || '')
  ) : false
  const vaultDivisions = myEnlistedArmy
    ? myEnlistedArmy.divisionIds.map(id => armyStoreState.divisions[id]).filter(d => d && d.status !== 'destroyed' && d.status !== 'listed')
    : []

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

      {/* VAULT DIVISIONS — SELL (Commander/Colonel only) */}
      {isVaultOfficer && myEnlistedArmy && vaultDivisions.length > 0 && (
        <>
          <div className="market-section-title" style={{ color: '#f59e0b' }}>🏦 ARMY VAULT DIVISIONS — LIST TO SELL</div>
          <div className="war-recruit-grid">
            {vaultDivisions.map(div => {
              const tmpl = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
              const price = listPrice[div.id] || 50000
              const canList = div.status === 'ready' || div.status === 'training'
              return (
                <div key={div.id} className="war-recruit-card" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                  <div className="war-recruit-card__header">
                    {tmpl?.icon && <img src={tmpl.icon} alt={div.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0' }}>{div.name}</div>
                      <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#f59e0b', fontWeight: 600 }}>🏦 {myEnlistedArmy.name} vault</div>
                    </div>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px' }}>VAULT</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>PRICE:</span>
                    <input type="number" min={1000} max={10000000} step={1000} value={price}
                      onChange={e => setListPrice(p => ({ ...p, [div.id]: +e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, padding: '4px 6px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 900, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', color: '#fbbf24', textAlign: 'right', outline: 'none' }} />
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <button className="war-recruit-btn" style={{ width: '100%', height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canList ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.1)', borderColor: canList ? 'rgba(245,158,11,0.4)' : 'rgba(100,116,139,0.2)', color: canList ? '#f59e0b' : '#475569' }}
                      disabled={!canList}
                      onClick={() => {
                        const r = market.placeVaultDivisionSellOrder(myEnlistedArmy.id, div.id, price)
                        showFb(r.message, r.success)
                      }}
                    >
                      {canList ? '🏦 LIST FROM VAULT' : `⛔ ${div.status.toUpperCase()}`}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* COUNTRY DIVISIONS — SELL (President only) */}
      {isPresident && countryDivisions.length > 0 && (
        <>
          <div className="market-section-title" style={{ color: '#22d38a' }}>🏛️ COUNTRY DIVISIONS — LIST TO SELL</div>
          <div className="war-recruit-grid">
            {countryDivisions.map(div => {
              const tmpl = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
              const price = listPrice[div.id] || 80000
              return (
                <div key={div.id} className="war-recruit-card" style={{ borderColor: 'rgba(34,211,138,0.2)' }}>
                  <div className="war-recruit-card__header">
                    {tmpl?.icon && <img src={tmpl.icon} alt={div.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0' }}>{div.name}</div>
                      <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#22d38a', fontWeight: 600 }}>🏛️ National Division</div>
                    </div>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#22d38a', background: 'rgba(34,211,138,0.1)', padding: '2px 6px', borderRadius: '3px' }}>COUNTRY</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>PRICE:</span>
                    <input type="number" min={1000} max={10000000} step={1000} value={price}
                      onChange={e => setListPrice(p => ({ ...p, [div.id]: +e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, padding: '4px 6px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 900, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '3px', color: '#22d38a', textAlign: 'right', outline: 'none' }} />
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <button className="war-recruit-btn" style={{ width: '100%', height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,211,138,0.15)', borderColor: 'rgba(34,211,138,0.4)', color: '#22d38a' }}
                      onClick={() => {
                        const r = market.placeCountryDivisionSellOrder(iso, div.id, price)
                        showFb(r.message, r.success)
                      }}
                    >
                      🏛️ LIST FROM COUNTRY
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
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
                  <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#94a3b8', fontWeight: 600, opacity: 0.85 }}>
                    {order.divisionSource === 'force_vault' ? '🏦 Vault' : order.divisionSource === 'country' ? '🏛️ Country' : '👤 Player'}: {order.playerId}
                  </div>
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
