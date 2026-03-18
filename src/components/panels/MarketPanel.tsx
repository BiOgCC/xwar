import React, { useState } from 'react'
import { usePlayerStore, type PlayerState } from '../../stores/playerStore'
import { useInventoryStore, type EquipItem, TIER_COLORS, TIER_LABELS, TIER_ORDER, generateStats, ARMOR_SLOTS, SLOT_ICONS, getItemImagePath } from '../../stores/inventoryStore'
import { useMarketStore, RESOURCE_DEFS, type ResourceId, type MarketOrder, type TradeRecord } from '../../stores/marketStore'
import { useUIStore } from '../../stores/uiStore'
import type { EquipTier, EquipSlot, EquipCategory } from '../../stores/inventoryStore'
import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/armyStore'
import { useWorldStore } from '../../stores/worldStore'
import { useGovernmentStore } from '../../stores/governmentStore'

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

/* ─── section header ─── */
function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
      {label} <span style={{ color: '#334155' }}>→</span>
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

  const showFb = (msg: string, ok = true) => {
    setFeedback(msg)
    ui.addFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, ok ? '#22d38a' : '#ef4444')
    setTimeout(() => setFeedback(''), 3000)
  }

  const equippedCount = inventory.items.filter(i => i.equipped).length
  const totalItems    = inventory.items.length

  // President check for country trading
  const iso = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[iso]
  const isPresident = gov?.president === player.name
  const countryFund = useWorldStore.getState().getCountry(iso)?.fund

  /* ══════════════════ MAIN RENDER ══════════════════ */
  return (
    <div style={{ padding: 4, overflowY: 'auto', maxHeight: '100%' }}>
      {/* ── INVENTORY HEADER ── */}
      <SectionHeader label="INVENTORY" />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <Stat icon="🪙" val={player.money.toLocaleString()} color="#fbbf24" />
        <Stat icon="⚔️" val={`${equippedCount}/${totalItems}`} color="#94a3b8" title="Equipped / Total gear" />
        <Stat icon="🔩" val={player.scrap.toLocaleString()} color="#3b82f6" />
        <Stat icon="🛢️" val={player.oil.toLocaleString()} color="#10b981" />
        <Stat icon="₿" val={player.bitcoin.toLocaleString()} color="#eab308" />
        <Stat icon="🔵" val={player.blueBullets} color="#3b82f6" />
        <Stat icon="🟢" val={player.greenBullets} color="#10b981" />
        <Stat icon="🟣" val={player.purpleBullets} color="#a855f7" />
      </div>

      {/* feedback */}
      {feedback && <div style={{ padding: '6px 10px', marginBottom: 8, fontSize: 11, fontWeight: 700, borderRadius: 4, background: feedback.includes('Need') || feedback.includes('Not') || feedback.includes('Cannot') || feedback.includes('Invalid') ? 'rgba(239,68,68,0.15)' : 'rgba(34,211,138,0.15)', color: feedback.includes('Need') || feedback.includes('Not') || feedback.includes('Cannot') ? '#ef4444' : '#22d38a', border: `1px solid ${feedback.includes('Need') || feedback.includes('Not') ? 'rgba(239,68,68,0.3)' : 'rgba(34,211,138,0.3)'}` }}>{feedback}</div>}

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {(['trading', 'equipment', 'divisions', 'orders', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, border: 'none',
            borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'transparent', color: tab === t ? '#fff' : '#64748b',
            textTransform: 'uppercase', cursor: 'pointer', transition: 'color .15s',
          }}>{t === 'trading' ? '📈 Market' : t === 'equipment' ? '⚔️ Gear' : t === 'divisions' ? '🪖 Divs' : t === 'orders' ? '📋 Orders' : '📊 History'}</button>
        ))}
      </div>

      {/* ═══════ TRADING TAB ═══════ */}
      {tab === 'trading' && <>
        {/* Country toggle for president */}
        {isPresident && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '6px 10px', borderRadius: 4, background: countryMode ? 'rgba(34,211,138,0.1)' : 'rgba(0,0,0,0.3)', border: `1px solid ${countryMode ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
            <label style={{ fontSize: 10, color: countryMode ? '#22d38a' : '#64748b', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={countryMode} onChange={e => setCountryMode(e.target.checked)} style={{ accentColor: '#22d38a' }} />
              🏛️ TRADE FROM NATIONAL FUND
            </label>
            {countryMode && countryFund && <span style={{ fontSize: 9, color: '#64748b' }}>Fund: ${countryFund.money.toLocaleString()}</span>}
          </div>
        )}

        {/* Resource categories */}
        {Object.entries(
          RESOURCE_DEFS.reduce<Record<string, typeof RESOURCE_DEFS>>((acc, r) => {
            acc[r.category] = acc[r.category] || []; acc[r.category].push(r); return acc
          }, {})
        ).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>{cat}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {items.map(def => {
                const ticker = market.tickers[def.id]
                const owned = (player as any)[def.playerKey] as number || 0
                const rarity = CATEGORY_RARITY[def.category] || 'grey'
                return (
                  <div key={def.id} onClick={() => { setSelResource(def.id); setLimitPrice(ticker?.price || def.basePrice); setQty(1); setOrderType('buy') }}
                    style={{ width: 62, background: selResource === def.id ? 'rgba(59,130,246,0.15)' : 'rgba(8,12,18,0.6)', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${selResource === def.id ? '#3b82f6' : RARITY_BG[rarity]}`, transition: 'transform .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.5))' }}>
                      {def.icon}
                    </div>
                    <div style={{ padding: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'rgba(0,0,0,0.6)' }}>
                      <span style={{ fontSize: 9 }}>🪙</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: '#fff' }}>{(ticker?.price || def.basePrice).toFixed(2)}</span>
                    </div>
                    <div style={{ padding: '2px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, color: owned > 0 ? '#fff' : '#475569', background: owned > 0 ? RARITY_COLOR[rarity] : 'rgba(255,255,255,0.04)' }}>
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
            <div style={{ background: 'rgba(8,12,18,0.8)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'var(--font-display)' }}>{def.icon} {def.name}</div>
                <button onClick={() => setSelResource(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>

              {/* Ticker info */}
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
                <span>Price: <b style={{ color: '#fff' }}>${ticker?.price.toFixed(2)}</b></span>
                <span style={{ color: (ticker?.change24h || 0) >= 0 ? '#22d38a' : '#ef4444' }}>{(ticker?.change24h || 0) >= 0 ? '+' : ''}{ticker?.change24h.toFixed(1)}%</span>
                <span>Vol: {((ticker?.volume || 0) / 1000).toFixed(0)}k</span>
                <span>Owned: <b style={{ color: '#fbbf24' }}>{owned}</b></span>
              </div>

              {/* Buy/Sell toggle */}
              <div style={{ display: 'flex', marginBottom: 10,  gap: 4 }}>
                <button onClick={() => setOrderType('buy')} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 800, border: `1px solid ${orderType === 'buy' ? '#22d38a' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, background: orderType === 'buy' ? 'rgba(34,211,138,0.15)' : 'transparent', color: orderType === 'buy' ? '#22d38a' : '#64748b', cursor: 'pointer' }}>BUY</button>
                <button onClick={() => setOrderType('sell')} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 800, border: `1px solid ${orderType === 'sell' ? '#ef4444' : 'rgba(255,255,255,0.08)'}`, borderRadius: 4, background: orderType === 'sell' ? 'rgba(239,68,68,0.15)' : 'transparent', color: orderType === 'sell' ? '#ef4444' : '#64748b', cursor: 'pointer' }}>SELL</button>
              </div>

              {/* Price + Qty */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>LIMIT PRICE</div>
                  <input type="number" min={0.01} step={0.01} value={limitPrice} onChange={e => setLimitPrice(+e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fbbf24', textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2 }}>QUANTITY</div>
                  <input type="number" min={1} step={1} value={qty} onChange={e => setQty(Math.max(1, +e.target.value))}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fff', textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>

              {/* Quick qty */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                {[1, 10, 50, 100, 500].map(n => (
                  <button key={n} onClick={() => setQty(n)} style={{ padding: '2px 6px', fontSize: 9, fontWeight: 700, background: qty === n ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fff', cursor: 'pointer' }}>{n}</button>
                ))}
                <button onClick={() => {
                  if (orderType === 'sell') setQty(owned)
                  else if (limitPrice > 0) setQty(Math.max(1, Math.floor(player.money / limitPrice)))
                }} style={{ padding: '2px 6px', fontSize: 9, fontWeight: 700, background: 'rgba(34,211,138,0.12)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: 3, color: '#22d38a', cursor: 'pointer' }}>MAX</button>
              </div>

              {/* Total */}
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10, textAlign: 'center' }}>
                Total: <b style={{ color: '#fbbf24' }}>${totalCost.toFixed(2)}</b>
                {orderType === 'buy' && <span style={{ fontSize: 9, color: '#475569' }}> (1% tax on fill)</span>}
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
              }} style={{
                width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 900,
                border: `1px solid ${orderType === 'buy' ? '#22d38a' : '#ef4444'}`,
                borderRadius: 4, background: `${orderType === 'buy' ? '#22d38a' : '#ef4444'}18`,
                color: orderType === 'buy' ? '#22d38a' : '#ef4444', cursor: 'pointer',
              }}>
                {countryMode ? '🏛️ ' : ''}{orderType === 'buy' ? 'PLACE BUY ORDER' : 'PLACE SELL ORDER'} — ${totalCost.toFixed(2)}
              </button>

              {/* Mini order book */}
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#22d38a', fontWeight: 700, marginBottom: 4 }}>BIDS ({book.buys.length})</div>
                  {book.buys.slice(0, 5).map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', padding: '1px 0' }}>
                      <span style={{ color: '#22d38a' }}>${o.pricePerUnit.toFixed(2)}</span>
                      <span>{o.amount - o.filledAmount}</span>
                    </div>
                  ))}
                  {book.buys.length === 0 && <div style={{ fontSize: 8, color: '#334155', fontStyle: 'italic' }}>No bids</div>}
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, marginBottom: 4 }}>ASKS ({book.sells.length})</div>
                  {book.sells.slice(0, 5).map(o => (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', padding: '1px 0' }}>
                      <span style={{ color: '#ef4444' }}>${o.pricePerUnit.toFixed(2)}</span>
                      <span>{o.amount - o.filledAmount}</span>
                    </div>
                  ))}
                  {book.sells.length === 0 && <div style={{ fontSize: 8, color: '#334155', fontStyle: 'italic' }}>No asks</div>}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── MARKET PRICES ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, marginBottom: 10 }}>📊 LIVE PRICES</div>
          {RESOURCE_DEFS.filter(r => ['Construction', 'Food'].includes(r.category)).map(def => {
            const t = market.tickers[def.id]
            if (!t) return null
            return (
              <div key={def.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>{def.icon} {def.name}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700 }}>${t.price.toFixed(2)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.change24h >= 0 ? '#22d38a' : '#ef4444' }}>{t.change24h >= 0 ? '+' : ''}{t.change24h.toFixed(1)}%</span>
                  <span style={{ fontSize: 8, color: '#475569' }}>VOL {(t.volume / 1000).toFixed(0)}k</span>
                </div>
              </div>
            )
          })}
        </div>
      </>}

      {/* ═══════ EQUIPMENT TAB ═══════ */}
      {tab === 'equipment' && <>
        {/* YOUR EQUIPMENT — SELL */}
        <SectionHeader label="YOUR EQUIPMENT — LIST TO SELL" />
        {inventory.items.length === 0
          ? <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginBottom: 14 }}>No equipment in inventory.</div>
          : Object.entries(
              inventory.items.reduce<Record<string, EquipItem[]>>((acc, item) => {
                const key = item.slot; acc[key] = acc[key] || []; acc[key].push(item); return acc
              }, {})
            ).map(([slot, items]) => (
              <div key={slot} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'capitalize' }}>
                  {SLOT_ICONS[slot as EquipSlot]} {slot}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {items.sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier)).map(item => {
                    const rarity = TIER_RARITY[item.tier]
                    const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
                    const price = equipPrice[item.id] || TIER_SELL_PRICE[item.tier]
                    return (
                      <div key={item.id} style={{ width: 72, background: 'rgba(8,12,18,0.6)', borderRadius: 4, overflow: 'hidden', border: `1px solid ${RARITY_BG[rarity]}`, position: 'relative' }}>
                        {item.equipped && <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 7, fontWeight: 900, color: '#22d38a', border: '1px solid #22d38a', padding: '1px 3px', borderRadius: 2, background: 'rgba(34,211,138,0.1)' }}>EQ</div>}
                        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.5))' }}>
                          {imgUrl
                            ? <img src={imgUrl} alt={item.name} style={{ width: 32, height: 32, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                            : <span style={{ fontSize: 22 }}>{SLOT_ICONS[item.slot]}</span>}
                        </div>
                        <div style={{ padding: '2px 3px', fontSize: 8, color: '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        <input type="number" min={100} step={100} value={price}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEquipPrice(p => ({ ...p, [item.id]: +e.target.value }))}
                          style={{ width: '100%', padding: '2px 4px', fontSize: 9, background: 'rgba(255,255,255,0.06)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#fbbf24', textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                        <button disabled={item.equipped} onClick={() => {
                          const r = market.placeEquipmentSellOrder(item.id, price)
                          showFb(r.message, r.success)
                        }} style={{ width: '100%', padding: '3px 0', fontSize: 8, fontWeight: 800, border: 'none', background: item.equipped ? '#1e293b' : 'rgba(239,68,68,0.15)', color: item.equipped ? '#475569' : '#ef4444', cursor: item.equipped ? 'not-allowed' : 'pointer' }}>
                          {item.equipped ? 'EQUIPPED' : 'SELL'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
        }

        {/* EQUIPMENT MARKETPLACE — player-to-player listings */}
        <SectionHeader label="⚔️ EQUIPMENT MARKETPLACE" />

        {/* Slot filter */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
          {['all', 'weapon', 'helmet', 'chest', 'legs', 'gloves', 'boots'].map(s => (
            <button key={s} onClick={() => setEquipSlotFilter(s)} style={{
              padding: '3px 8px', fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
              border: `1px solid ${equipSlotFilter === s ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
              background: equipSlotFilter === s ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: equipSlotFilter === s ? '#3b82f6' : '#64748b', textTransform: 'capitalize',
            }}>{s === 'all' ? '🔹 All' : `${SLOT_ICONS[s as EquipSlot] || ''} ${s}`}</button>
          ))}
        </div>

        {/* Tier filter */}
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 12 }}>
          {['all', ...TIER_ORDER].map(t => (
            <button key={t} onClick={() => setEquipTierFilter(t)} style={{
              padding: '3px 8px', fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
              border: `1px solid ${equipTierFilter === t ? RARITY_COLOR[TIER_RARITY[t as EquipTier] || 'blue'] : 'rgba(255,255,255,0.08)'}`,
              background: equipTierFilter === t ? `${RARITY_COLOR[TIER_RARITY[t as EquipTier] || 'blue']}18` : 'transparent',
              color: equipTierFilter === t ? RARITY_COLOR[TIER_RARITY[t as EquipTier] || 'blue'] : '#64748b',
            }}>{t === 'all' ? '🔹 All Tiers' : TIER_LABELS[t as EquipTier]}</button>
          ))}
        </div>

        {(() => {
          let listings = market.getEquipmentListings()
          if (equipSlotFilter !== 'all') listings = listings.filter(o => o.equipSnapshot?.slot === equipSlotFilter)
          if (equipTierFilter !== 'all') listings = listings.filter(o => o.equipSnapshot?.tier === equipTierFilter)
          const count = market.getEquipmentListings().length
          if (count === 0) return <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No equipment listed. Be the first to sell gear!</div>
          if (listings.length === 0) return <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No listings match filters ({count} total listings)</div>
          return (
            <>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>Showing {listings.length} of {count} listings</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {listings.map(order => {
                if (!order.equipSnapshot) return null
                const snap = order.equipSnapshot
                const rarity = TIER_RARITY[snap.tier as EquipTier] || 'grey'
                const imgUrl = getItemImagePath(snap.tier as any, snap.slot as any, snap.category as any, snap.weaponSubtype as any)
                const isMine = order.playerId === player.name
                const canBuy = !isMine && player.money >= order.totalPrice
                const statLines = Object.entries(snap.stats).filter(([, v]) => v).map(([k, v]) => `${k}:+${v}`)
                return (
                  <div key={order.id} style={{ width: 86, background: 'rgba(8,12,18,0.6)', borderRadius: 4, overflow: 'hidden', border: `1px solid ${RARITY_BG[rarity]}` }}>
                    <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.5))' }}>
                      {imgUrl
                        ? <img src={imgUrl} alt={snap.name} style={{ width: 36, height: 36, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                        : <span style={{ fontSize: 24 }}>{SLOT_ICONS[snap.slot as EquipSlot]}</span>}
                    </div>
                    <div style={{ padding: '2px 3px', fontSize: 8, color: '#e2e8f0', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 700 }}>{snap.name}</div>
                    <div style={{ padding: '1px 3px', fontSize: 7, color: RARITY_COLOR[rarity], textAlign: 'center', fontWeight: 700 }}>{TIER_LABELS[snap.tier as EquipTier]} • {snap.slot}</div>
                    {statLines.length > 0 && <div style={{ padding: '1px 3px', fontSize: 6, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{statLines.slice(0, 2).join(' ')}</div>}
                    <div style={{ padding: '3px 0', textAlign: 'center', fontSize: 10, background: 'rgba(0,0,0,0.6)', fontWeight: 800 }}>
                      <span style={{ color: '#fbbf24' }}>${order.totalPrice.toLocaleString()}</span>
                    </div>
                    <div style={{ padding: '1px 3px', fontSize: 7, color: '#475569', textAlign: 'center' }}>by {order.playerId}</div>
                    <button onClick={() => {
                      if (isMine) { const r = market.cancelOrder(order.id); showFb(r.message, r.success) }
                      else { const r = market.buyEquipment(order.id); showFb(r.message, r.success) }
                    }} style={{ width: '100%', padding: '4px 0', fontSize: 9, fontWeight: 800, border: 'none', background: isMine ? 'rgba(239,68,68,0.15)' : canBuy ? 'rgba(34,211,138,0.15)' : '#1e293b', color: isMine ? '#ef4444' : canBuy ? '#22d38a' : '#475569', cursor: isMine || canBuy ? 'pointer' : 'not-allowed' }}>
                      {isMine ? '✕ DELIST' : canBuy ? '💰 BUY' : '⛔ NO $'}
                    </button>
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
        <SectionHeader label="MY OPEN ORDERS" />
        {(() => {
          const myOrders = market.getMyOrders()
          if (myOrders.length === 0) return <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No open orders.</div>
          return myOrders.map(o => {
            const def = RESOURCE_DEFS.find(r => r.id === o.resourceId)
            return (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', marginBottom: 4, borderRadius: 4, background: 'rgba(8,12,18,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: o.type === 'buy' ? '#22d38a' : '#ef4444', textTransform: 'uppercase' }}>{o.type}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>
                    {o.itemType === 'resource' ? `${o.amount - o.filledAmount}/${o.amount} ${def?.name || o.resourceId}` : o.itemType === 'equipment' ? o.equipSnapshot?.name : o.divSnapshot?.name}
                  </span>
                  <span style={{ fontSize: 9, color: '#fbbf24', marginLeft: 6 }}>@ ${o.pricePerUnit.toFixed(2)}</span>
                  {o.source === 'country' && <span style={{ fontSize: 8, color: '#22d38a', marginLeft: 4 }}>🏛️</span>}
                </div>
                <button onClick={() => { const r = market.cancelOrder(o.id); showFb(r.message, r.success) }}
                  style={{ padding: '3px 8px', fontSize: 9, fontWeight: 800, border: '1px solid rgba(239,68,68,0.3)', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>
                  CANCEL
                </button>
              </div>
            )
          })
        })()}
      </>}

      {/* ═══════ HISTORY TAB ═══════ */}
      {tab === 'history' && <>
        <SectionHeader label="TRANSACTION LOG" />
        {(() => {
          const trades = market.getRecentTrades(30)
          if (trades.length === 0) return <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No trades yet.</div>
          return trades.map(t => {
            const def = RESOURCE_DEFS.find(r => r.id === t.resourceId)
            const isMyBuy = t.buyer === player.name
            const isMySell = t.seller === player.name
            const ago = Math.floor((Date.now() - t.timestamp) / 60000)
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#94a3b8' }}>
                <span>
                  {t.itemType === 'resource' ? `${t.amount}× ${def?.icon || ''} ${def?.name || t.resourceId}` : t.itemType === 'equipment' ? `⚔️ Equipment` : `🪖 Division`}
                  {isMyBuy && <span style={{ color: '#22d38a', marginLeft: 4 }}>← YOU BOUGHT</span>}
                  {isMySell && <span style={{ color: '#ef4444', marginLeft: 4 }}>→ YOU SOLD</span>}
                </span>
                <span>
                  <span style={{ color: '#fbbf24' }}>${t.totalPrice.toFixed(2)}</span>
                  <span style={{ color: '#475569', marginLeft: 6 }}>tax ${t.tax.toFixed(2)}</span>
                  <span style={{ color: '#334155', marginLeft: 6 }}>{ago < 1 ? 'now' : `${ago}m`}</span>
                </span>
              </div>
            )
          })
        })()}
      </>}
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
      <SectionHeader label="YOUR DIVISIONS — LIST TO SELL" />
      {myDivisions.length === 0 ? (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginBottom: 14 }}>No divisions available.</div>
      ) : myDivisions.map(div => {
        const tmpl = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
        const divLevel = Math.floor((div.experience || 0) / 10)
        const price = listPrice[div.id] || 50000
        const canList = div.status === 'ready' || div.status === 'training'
        return (
          <div key={div.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 4, borderRadius: 5, background: 'rgba(8,12,18,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {tmpl?.icon && <img src={tmpl.icon} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{div.name}</div>
              <div style={{ fontSize: 8, color: '#64748b' }}>{div.type} • Lv.{divLevel} • {div.status}</div>
            </div>
            <input type="number" min={1000} max={10000000} step={1000} value={price}
              onChange={e => setListPrice(p => ({ ...p, [div.id]: +e.target.value }))}
              onClick={e => e.stopPropagation()}
              style={{ width: 80, padding: '3px 6px', fontSize: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fbbf24', textAlign: 'right', fontFamily: 'var(--font-mono)' }} />
            <button disabled={!canList} onClick={() => {
              const r = market.placeDivisionSellOrder(div.id, price)
              showFb(r.message, r.success)
            }} style={{ padding: '4px 10px', fontSize: 9, fontWeight: 800, border: `1px solid ${canList ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 3, background: canList ? 'rgba(34,211,138,0.1)' : 'rgba(0,0,0,0.3)', color: canList ? '#22d38a' : '#475569', cursor: canList ? 'pointer' : 'not-allowed' }}>
              LIST
            </button>
          </div>
        )
      })}

      {/* MARKETPLACE — with filters */}
      <SectionHeader label="🪖 DIVISION MARKETPLACE" />

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
        <button onClick={() => setTypeFilter('all')} style={{
          padding: '3px 8px', fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
          border: `1px solid ${typeFilter === 'all' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
          background: typeFilter === 'all' ? 'rgba(59,130,246,0.15)' : 'transparent',
          color: typeFilter === 'all' ? '#3b82f6' : '#64748b',
        }}>🔹 All</button>
        {divisionTypes.map(t => {
          const tmpl = DIVISION_TEMPLATES[t as keyof typeof DIVISION_TEMPLATES]
          return (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '3px 8px', fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
              border: `1px solid ${typeFilter === t ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
              background: typeFilter === t ? 'rgba(245,158,11,0.15)' : 'transparent',
              color: typeFilter === t ? '#f59e0b' : '#64748b', textTransform: 'capitalize',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              {tmpl?.icon && <img src={tmpl.icon} alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} />}
              {t}
            </button>
          )
        })}
      </div>

      {/* Stars filter */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
        {[0, 1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => setStarsFilter(s)} style={{
            padding: '3px 8px', fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
            border: `1px solid ${starsFilter === s ? starColor(s || 3) : 'rgba(255,255,255,0.08)'}`,
            background: starsFilter === s ? `${starColor(s || 3)}18` : 'transparent',
            color: starsFilter === s ? starColor(s || 3) : '#64748b',
          }}>{s === 0 ? '🔹 Any ★' : `${s}★+`}</button>
        ))}
      </div>

      {allListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#64748b', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '8px', border: '1px dashed rgba(255,255,255,0.08)' }}>
          No divisions for sale. List yours above!
        </div>
      ) : filteredListings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#64748b', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '8px', border: '1px dashed rgba(255,255,255,0.08)' }}>
          No listings match filters ({allListings.length} total)
        </div>
      ) : (
        <>
        <div style={{ fontSize: 9, color: '#475569', marginBottom: 6 }}>Showing {filteredListings.length} of {allListings.length} listings</div>
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
                <div className="war-recruit-card__header">
                  {tmpl?.icon && <img src={tmpl.icon} alt={snap.name} style={{ width: '28px', height: '28px', objectFit: 'contain' }} className="war-recruit-card__icon" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#e2e8f0', letterSpacing: '0.5px', lineHeight: 1.1 }}>{snap.name}</div>
                    <div style={{ fontSize: '8px', fontStyle: 'italic', color: '#94a3b8', fontWeight: 600, opacity: 0.85 }}>Seller: {order.playerId}</div>
                  </div>
                  <span style={{ color: starColor(snap.stars), fontWeight: 700, fontSize: '11px', letterSpacing: '-1px', marginRight: '4px' }}>
                    {'★'.repeat(snap.stars)}{'☆'.repeat(Math.max(0, 5 - snap.stars))}
                  </span>
                  <span style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)', textTransform: 'uppercase' }}>
                    {snap.type}
                  </span>
                </div>

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

                <div className="war-recruit-card__cost" style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span style={{ color: '#fbbf24' }}>🪙 ${order.totalPrice.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {snap.manpower} troops
                    </span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      {order.countryCode}
                    </span>
                  </div>
                  {isMine && <span style={{ fontSize: '8px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)' }}>YOUR LISTING</span>}
                </div>

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

/* ══════ tiny shared sub-components ══════ */
function Stat({ icon, val, color, title }: { icon: string; val: string | number; color?: string; title?: string }) {
  return (
    <div title={title} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: color || '#fff' }}>
      <span>{icon}</span>{val}
    </div>
  )
}
