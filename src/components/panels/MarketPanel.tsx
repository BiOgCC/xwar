import React, { useState } from 'react'
import { usePlayerStore, type PlayerState } from '../../stores/playerStore'
import { useInventoryStore, type EquipItem, TIER_COLORS, TIER_LABELS, TIER_ORDER, generateStats, ARMOR_SLOTS, SLOT_ICONS, getItemImagePath } from '../../stores/inventoryStore'
import { useMarketStore, type DivisionListing } from '../../stores/marketStore'
import { useUIStore } from '../../stores/uiStore'
import type { EquipTier, EquipSlot, EquipCategory } from '../../stores/inventoryStore'
import { useArmyStore, DIVISION_TEMPLATES } from '../../stores/armyStore'

/* ─── Resource item (links to a PlayerState numeric key) ─── */
interface MarketItem {
  id: string
  name: string
  icon: React.ReactNode
  basePrice: number
  stateKey: keyof PlayerState
  rarity: string
  marketId?: string  // links to marketStore resource for dynamic pricing
}

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

/* equipment tier → rarity label */
const TIER_RARITY: Record<EquipTier, string> = {
  t1: 'grey', t2: 'green', t3: 'blue', t4: 'purple', t5: 'yellow', t6: 'red'
}

/* equipment tier → market sell price */
const TIER_SELL_PRICE: Record<EquipTier, number> = {
  t1: 120, t2: 360, t3: 1200, t4: 4500, t5: 18000, t6: 80000
}
/* equipment tier → market buy price */
const TIER_BUY_PRICE: Record<EquipTier, number> = {
  t1: 200, t2: 600, t3: 2000, t4: 7500, t5: 30000, t6: 140000
}

/* ─── All Resource categories ─── */
const RESOURCE_CATEGORIES: { name: string; items: MarketItem[] }[] = [
  {
    name: 'Cases',
    items: [
      { id: 'case_basic', name: 'Basic Case',   icon: '📦', basePrice: 34.79, stateKey: 'lootBoxes',    rarity: 'red'    },
      { id: 'case_mil',   name: 'Military Box', icon: '🧰', basePrice: 3.46,  stateKey: 'militaryBoxes', rarity: 'yellow' },
    ],
  },
  {
    name: 'Craft',
    items: [
      { id: 'craft_scrap', name: 'Scrap Metal', icon: '🔩', basePrice: 0.22, stateKey: 'scrap', rarity: 'blue', marketId: 'scrap' },
    ],
  },
  {
    name: 'Buffs',
    items: [
      { id: 'buff_pill', name: 'Stamina Pill', icon: '💊', basePrice: 31.7, stateKey: 'staminaPills', rarity: 'purple' },
      { id: 'buff_leaf', name: 'Energy Leaf',  icon: '🍃', basePrice: 0.07, stateKey: 'energyLeaves', rarity: 'grey'   },
    ],
  },
  {
    name: 'Ammo',
    items: [
      { id: 'ammo_purple', name: 'Purple Ammo', icon: '🟣', basePrice: 2.51, stateKey: 'purpleBullets', rarity: 'purple', marketId: 'ammo' },
      { id: 'ammo_blue',   name: 'Blue Ammo',   icon: '🔵', basePrice: 0.62, stateKey: 'blueBullets',   rarity: 'blue',   marketId: 'ammo' },
      { id: 'ammo_green',  name: 'Green Ammo',  icon: '🟢', basePrice: 0.17, stateKey: 'greenBullets',  rarity: 'green',  marketId: 'ammo' },
      { id: 'ammo_red',    name: 'Red Ammo',    icon: '🔴', basePrice: 0.08, stateKey: 'redBullets',    rarity: 'grey'   },
    ],
  },
  {
    name: 'Food',
    items: [
      { id: 'food_sushi',  name: 'Sushi',  icon: <img src="/assets/food/sushi.png" alt="Sushi" style={{ width: '24px', height: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, basePrice: 7.19, stateKey: 'sushi',  rarity: 'purple', marketId: 'food' },
      { id: 'food_steak',  name: 'Steak',  icon: '🥩', basePrice: 3.50, stateKey: 'steak',  rarity: 'blue',   marketId: 'food' },
      { id: 'food_bread',  name: 'Bread',  icon: <img src="/assets/food/bread.png" alt="Bread" style={{ width: '24px', height: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, basePrice: 1.81, stateKey: 'bread',  rarity: 'green',  marketId: 'food' },
      { id: 'food_fish',   name: 'Fish',   icon: '🐟', basePrice: 3.44, stateKey: 'fish',   rarity: 'grey',   marketId: 'food' },
      { id: 'food_wagyu',  name: 'Wagyu',  icon: <img src="/assets/food/wagyu.png" alt="Wagyu" style={{ width: '24px', height: '24px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />, basePrice: 9.50, stateKey: 'wagyu',  rarity: 'red',    marketId: 'food' },
      { id: 'food_wheat',  name: 'Wheat',  icon: '🌾', basePrice: 0.08, stateKey: 'wheat',  rarity: 'grey',   marketId: 'food' },
    ],
  },
  {
    name: 'Construction',
    items: [
      { id: 'cons_oil',     name: 'Oil',       icon: '🛢️', basePrice: 0.16,  stateKey: 'oil',       rarity: 'green',  marketId: 'oil'       },
      { id: 'cons_matx',    name: 'Material X', icon: '⚛️', basePrice: 1.62,  stateKey: 'materialX', rarity: 'purple', marketId: 'materialX' },
      { id: 'cons_bitcoin', name: 'Bitcoin',    icon: '₿',  basePrice: 85.00, stateKey: 'bitcoin',   rarity: 'yellow', marketId: 'bitcoin'   },
    ],
  },
]

/* ─── Get live price from marketStore or fall back to base ─── */
function getLivePrice(item: MarketItem, mktResources: ReturnType<typeof useMarketStore.getState>['resources']): number {
  if (item.marketId) {
    const mr = mktResources.find(r => r.id === item.marketId)
    if (mr) {
      const ratio = item.basePrice / (mr.priceHistory[0] || mr.price)
      return Math.round(mr.price * ratio * 100) / 100
    }
  }
  return item.basePrice
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

  /* modal state */
  const [mode, setMode]   = useState<'resource' | 'equip_sell' | 'equip_buy'>('resource')
  const [selRes, setSelRes]   = useState<MarketItem | null>(null)        // resource trade
  const [selEquip, setSelEquip] = useState<EquipItem | null>(null)       // sell your gear
  const [selBuySlot, setSelBuySlot] = useState<{ tier: EquipTier; slot: EquipSlot; category: EquipCategory } | null>(null) // buy new gear
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<'trading' | 'equipment' | 'divisions'>('trading')
  const armyStoreState = useArmyStore()

  /* ── live resources ── */
  const getOwned = (key: keyof PlayerState) => (player[key] as number) || 0

  /* ── Resource buy ── */
  const doBuyResource = () => {
    if (!selRes) return
    const price = getLivePrice(selRes, market.resources)
    const total = price * qty
    if (player.money < total) {
      ui.addFloatingText('NOT ENOUGH MONEY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return
    }
    usePlayerStore.setState(s => ({ money: s.money - total, [selRes.stateKey]: ((s[selRes.stateKey] as number) || 0) + qty } as any))
    if (selRes.marketId) market.executeTrade(selRes.marketId, 'buy', qty)
    ui.addFloatingText(`BOUGHT ${qty}× ${selRes.name} — 🪙${total.toFixed(2)}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  /* ── Resource sell ── */
  const doSellResource = () => {
    if (!selRes) return
    const owned = getOwned(selRes.stateKey)
    if (owned < qty) return
    const price = getLivePrice(selRes, market.resources)
    const gain  = Math.round(price * 0.8 * qty * 100) / 100
    usePlayerStore.setState(s => ({ money: s.money + gain, [selRes.stateKey]: ((s[selRes.stateKey] as number) || 0) - qty } as any))
    if (selRes.marketId) market.executeTrade(selRes.marketId, 'sell', qty)
    ui.addFloatingText(`SOLD ${qty}× ${selRes.name} +🪙${gain.toFixed(2)}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
  }

  /* ── Sell gear from inventory ── */
  const doSellEquip = () => {
    if (!selEquip || selEquip.equipped) return
    const gain = TIER_SELL_PRICE[selEquip.tier]
    inventory.removeItem(selEquip.id)
    usePlayerStore.setState(s => ({ money: s.money + gain }))
    market.executeTrade('equipment', 'sell', 1)
    ui.addFloatingText(`SOLD ${selEquip.name} +🪙${gain.toLocaleString()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
    setSelEquip(null)
  }

  /* ── Buy new equipment ── */
  const doBuyEquip = () => {
    if (!selBuySlot) return
    const cost = TIER_BUY_PRICE[selBuySlot.tier]
    if (player.money < cost) {
      ui.addFloatingText('NOT ENOUGH MONEY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return
    }
    usePlayerStore.setState(s => ({ money: s.money - cost }))
    const result = generateStats(selBuySlot.category, selBuySlot.slot, selBuySlot.tier)
    const newItem: EquipItem = {
      id: `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: result.name, slot: selBuySlot.slot, category: selBuySlot.category,
      tier: selBuySlot.tier, equipped: false, durability: 100,
      stats: result.stats, weaponSubtype: result.weaponSubtype,
    }
    inventory.addItem(newItem)
    market.executeTrade('equipment', 'buy', 1)
    ui.addFloatingText(`BOUGHT ${result.name} — 🪙${cost.toLocaleString()}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    setSelBuySlot(null)
  }

  /* ── Render resource card ── */
  const renderResCard = (item: MarketItem) => {
    const owned = getOwned(item.stateKey)
    const price = getLivePrice(item, market.resources)
    return (
      <div key={item.id} onClick={() => { setMode('resource'); setSelRes(item); setQty(1) }}
        style={{ width: 62, background: 'rgba(8,12,18,0.6)', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${RARITY_BG[item.rarity]}`, transition: 'transform .15s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.5))' }}>
          {item.icon}
        </div>
        <div style={{ padding: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'rgba(0,0,0,0.6)' }}>
          <span style={{ fontSize: 9 }}>🪙</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: '#fff' }}>{price}</span>
        </div>
        <div style={{ padding: '2px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, color: owned > 0 ? '#fff' : '#475569', background: owned > 0 ? RARITY_COLOR[item.rarity] : 'rgba(255,255,255,0.04)' }}>
          {owned}
        </div>
      </div>
    )
  }

  /* ── Render equipment card (from inventory) ── */
  const renderEquipCard = (item: EquipItem) => {
    const rarity = TIER_RARITY[item.tier]
    const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
    return (
      <div key={item.id}
        onClick={() => { setMode('equip_sell'); setSelEquip(item) }}
        style={{ width: 62, background: 'rgba(8,12,18,0.6)', borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${RARITY_BG[rarity]}`, transition: 'transform .15s', position: 'relative' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        {item.equipped && (
          <div style={{ position: 'absolute', top: 2, right: 2, fontSize: 7, fontWeight: 900, color: '#22d38a', border: '1px solid #22d38a', padding: '1px 3px', borderRadius: 2, background: 'rgba(34,211,138,0.1)', lineHeight: 1.2 }}>EQ</div>
        )}
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.5))' }}>
          {imgUrl
            ? <img src={imgUrl} alt={item.name} style={{ width: 36, height: 36, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} onError={e => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 24 }}>{SLOT_ICONS[item.slot]}</span>}
        </div>
        <div style={{ padding: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'rgba(0,0,0,0.6)' }}>
          <span style={{ fontSize: 9 }}>🪙</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: '#fff' }}>{TIER_SELL_PRICE[item.tier].toLocaleString()}</span>
        </div>
        <div style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#fff', background: RARITY_COLOR[rarity], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: 2, paddingRight: 2 }}>
          {TIER_LABELS[item.tier].split(' ')[0]}
        </div>
      </div>
    )
  }

  /* ── Render buy-gear card (slots × tiers grid) ── */
  const renderBuyGearCard = (tier: EquipTier, slot: EquipSlot, category: EquipCategory) => {
    const rarity  = TIER_RARITY[tier]
    const imgUrl  = getItemImagePath(tier, slot, category)
    const cost    = TIER_BUY_PRICE[tier]
    const canAfford = player.money >= cost
    return (
      <div key={`${tier}-${slot}`}
        onClick={() => { if (!canAfford) return; setMode('equip_buy'); setSelBuySlot({ tier, slot, category }) }}
        style={{ width: 62, background: canAfford ? 'rgba(8,12,18,0.6)' : 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden', cursor: canAfford ? 'pointer' : 'not-allowed', border: `1px solid ${canAfford ? RARITY_BG[rarity] : 'rgba(255,255,255,0.04)'}`, opacity: canAfford ? 1 : 0.5, transition: 'transform .15s' }}
        onMouseEnter={e => { if (canAfford) e.currentTarget.style.transform = 'scale(1.06)' }}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.5))' }}>
          {imgUrl
            ? <img src={imgUrl} alt={slot} style={{ width: 36, height: 36, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
            : <span style={{ fontSize: 24 }}>{SLOT_ICONS[slot]}</span>}
        </div>
        <div style={{ padding: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'rgba(0,0,0,0.6)' }}>
          <span style={{ fontSize: 9 }}>🪙</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: canAfford ? '#fff' : '#475569' }}>{cost >= 1000 ? (cost / 1000).toFixed(0) + 'k' : cost}</span>
        </div>
        <div style={{ padding: '2px 0', textAlign: 'center', fontSize: 9, fontWeight: 800, color: '#fff', background: canAfford ? RARITY_COLOR[rarity] : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: 2, paddingRight: 2 }}>
          {TIER_LABELS[tier].split(' ')[0]}
        </div>
      </div>
    )
  }

  /* ═══════ Inventory summary ═══════ */
  const equippedCount = inventory.items.filter(i => i.equipped).length
  const totalItems    = inventory.items.length

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

      {/* ── TAB BAR ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 0 }}>
        {(['trading', 'equipment', 'divisions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, border: 'none',
            borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'transparent', color: tab === t ? '#fff' : '#64748b',
            textTransform: 'uppercase', cursor: 'pointer', transition: 'color .15s',
          }}>{t === 'trading' ? '📈 Trading' : t === 'equipment' ? '⚔️ Equipment' : '🪖 Divisions'}</button>
        ))}
      </div>

      {tab === 'trading' && (
        <>
      {/* ── TRADING (resources) ── */}
      <SectionHeader label="TRADING" />
      {RESOURCE_CATEGORIES.map(cat => (
        <div key={cat.name} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>{cat.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {cat.items.map(renderResCard)}
          </div>
        </div>
      ))}

      {/* ── MARKET PRICES ── */}
      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, marginBottom: 10 }}>📊 MARKET PRICES</div>
        {market.resources.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>{r.icon} {r.name}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700 }}>${r.price.toFixed(2)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: r.change24h >= 0 ? '#22d38a' : '#ef4444' }}>{r.change24h >= 0 ? '+' : ''}{r.change24h.toFixed(1)}%</span>
              <span style={{ fontSize: 9, color: '#475569' }}>VOL {(r.volume / 1000).toFixed(0)}k</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── RECENT ORDERS ── */}
      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, marginBottom: 10 }}>📋 RECENT ORDERS</div>
        {market.recentOrders.length === 0
          ? <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No trading orders.</div>
          : market.recentOrders.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span>
                <span style={{ color: o.type === 'buy' ? '#22d38a' : '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>{o.type}</span>
                {' '}{o.amount}× {o.resource}
              </span>
              <span style={{ color: '#475569' }}>${o.price.toFixed(2)} — {o.player}</span>
            </div>
          ))
        }
      </div>
        </>
      )}

      {tab === 'equipment' && (
        <>
      {/* ── YOUR EQUIPMENT (sell) ── */}
      <SectionHeader label="YOUR EQUIPMENT — SELL" />
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {items.sort((a,b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier)).map(renderEquipCard)}
              </div>
            </div>
          ))
      }

      {/* ── BUY EQUIPMENT (all tiers × all slots) ── */}
      <SectionHeader label="BUY EQUIPMENT" />
      {(['weapon', ...ARMOR_SLOTS] as EquipSlot[]).map(slot => (
        <div key={slot} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'capitalize' }}>
            {SLOT_ICONS[slot]} {slot}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TIER_ORDER.map(tier => renderBuyGearCard(tier, slot, slot === 'weapon' ? 'weapon' : 'armor'))}
          </div>
        </div>
      ))}
        </>
      )}

      {tab === 'divisions' && <DivisionsTab />}

      {/* ═══════ MODALS ═══════ */}


      {/* Resource trade modal */}
      {mode === 'resource' && selRes && (() => {
        const price    = getLivePrice(selRes, market.resources)
        const sellPrc  = Math.round(price * 0.8 * 100) / 100
        const owned    = getOwned(selRes.stateKey)
        const buyCost  = price * qty
        const sellGain = sellPrc * qty
        const canBuy   = player.money >= buyCost
        const canSell  = owned >= qty
        return (
          <Modal onClose={() => setSelRes(null)} borderColor={RARITY_COLOR[selRes.rarity]}>
            <ModalTitle color={RARITY_COLOR[selRes.rarity]}>{selRes.name}</ModalTitle>
            <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 10 }}>{selRes.icon}</div>
            <InfoGrid rows={[
              ['Market price', `🪙 ${price.toFixed(2)}`],
              ['Sell price (80%)', `🪙 ${sellPrc.toFixed(2)}`],
              ['Owned', `${owned}`],
              ['Your money', `🪙 ${player.money.toLocaleString()}`],
            ]} />
            <QtyRow qty={qty} setQty={setQty} maxQty={Math.max(1, Math.floor(player.money / price))} />
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <TradeBtn label={`BUY 🪙${buyCost.toFixed(2)}`} color="#22d38a" enabled={canBuy} onClick={doBuyResource} />
              <TradeBtn label={`SELL 🪙${sellGain.toFixed(2)}`} color="#ef4444" enabled={canSell} onClick={doSellResource} />
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, color: '#475569', marginTop: 8 }}>
              After buy: 🪙 {Math.max(0, player.money - buyCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </Modal>
        )
      })()}

      {/* Equip sell modal */}
      {mode === 'equip_sell' && selEquip && (() => {
        const rarity  = TIER_RARITY[selEquip.tier]
        const gain    = TIER_SELL_PRICE[selEquip.tier]
        const imgUrl  = getItemImagePath(selEquip.tier, selEquip.slot, selEquip.category, selEquip.weaponSubtype)
        const statLines = Object.entries(selEquip.stats).filter(([, v]) => v).map(([k, v]) => `${k}: +${v}`)
        return (
          <Modal onClose={() => setSelEquip(null)} borderColor={RARITY_COLOR[rarity]}>
            <ModalTitle color={RARITY_COLOR[rarity]}>{selEquip.name}</ModalTitle>
            <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 8 }}>
              {imgUrl
                ? <img src={imgUrl} alt={selEquip.name} style={{ width: 64, height: 64, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                : SLOT_ICONS[selEquip.slot]}
            </div>
            <InfoGrid rows={[
              ['Tier', TIER_LABELS[selEquip.tier]],
              ['Slot', selEquip.slot],
              ['Durability', `${selEquip.durability}%`],
              ...statLines.map(s => [s, ''] as [string, string]),
              ['Sell price', `🪙 ${gain.toLocaleString()}`],
              ['Status', selEquip.equipped ? 'EQUIPPED — unequip first to sell' : 'In inventory'],
            ]} />
            <TradeBtn
              label={selEquip.equipped ? '⛔ Unequip first' : `SELL for 🪙${gain.toLocaleString()}`}
              color="#ef4444" enabled={!selEquip.equipped} onClick={doSellEquip}
            />
          </Modal>
        )
      })()}

      {/* Equip buy confirm modal */}
      {mode === 'equip_buy' && selBuySlot && (() => {
        const rarity  = TIER_RARITY[selBuySlot.tier]
        const cost    = TIER_BUY_PRICE[selBuySlot.tier]
        const imgUrl  = getItemImagePath(selBuySlot.tier, selBuySlot.slot, selBuySlot.category)
        return (
          <Modal onClose={() => setSelBuySlot(null)} borderColor={RARITY_COLOR[rarity]}>
            <ModalTitle color={RARITY_COLOR[rarity]}>Buy {TIER_LABELS[selBuySlot.tier].split(' ')[0]} {selBuySlot.slot}</ModalTitle>
            <div style={{ textAlign: 'center', fontSize: 52, marginBottom: 8 }}>
              {imgUrl
                ? <img src={imgUrl} alt={selBuySlot.slot} style={{ width: 64, height: 64, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                : SLOT_ICONS[selBuySlot.slot]}
            </div>
            <InfoGrid rows={[
              ['Tier',  TIER_LABELS[selBuySlot.tier]],
              ['Slot',  selBuySlot.slot],
              ['Cost',  `🪙 ${cost.toLocaleString()}`],
              ['Your money', `🪙 ${player.money.toLocaleString()}`],
              ['Stats', 'Random roll on purchase'],
            ]} />
            <TradeBtn label={`BUY for 🪙${cost.toLocaleString()}`} color="#22d38a" enabled={player.money >= cost} onClick={doBuyEquip} />
          </Modal>
        )
      })()}
    </div>
  )
}

/* ══════ DIVISIONS TAB ══════ */

function DivisionsTab() {
  const market = useMarketStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const armyStoreState = useArmyStore()
  const [listPrice, setListPrice] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')
  const [buyConfirm, setBuyConfirm] = useState<DivisionListing | null>(null)

  const myDivisions = Object.values(armyStoreState.divisions).filter((d: any) => d.ownerId === player.name && d.status !== 'destroyed' && d.status !== 'listed')
  const myListings = market.divisionListings.filter((l: DivisionListing) => l.sellerId === player.name)
  const otherListings = market.divisionListings.filter((l: DivisionListing) => l.sellerId !== player.name)

  const showFeedback = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(''), 3000) }

  const starColor = (s: number) => s >= 5 ? '#f59e0b' : s >= 4 ? '#a855f7' : s >= 3 ? '#3b82f6' : '#94a3b8'

  const renderDivCard = (listing: DivisionListing, isMine: boolean) => {
    const tmpl = DIVISION_TEMPLATES[listing.divType as keyof typeof DIVISION_TEMPLATES]
    const hpPct = listing.divMaxHealth > 0 ? Math.round((listing.divHealth / listing.divMaxHealth) * 100) : 100
    return (
      <div key={listing.id} style={{
        padding: '10px 12px', marginBottom: 6, borderRadius: 6,
        background: 'rgba(8,12,18,0.7)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {tmpl?.icon && <img src={tmpl.icon} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0' }}>{listing.divName}</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>
              {listing.divType} • Lv.{listing.divLevel} • <span style={{ color: starColor(listing.divStars) }}>{'★'.repeat(listing.divStars)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-display)' }}>
              🪙 {listing.price.toLocaleString()}
            </div>
            <div style={{ fontSize: 8, color: '#475569' }}>{listing.sellerId} • {listing.sellerCountry}</div>
          </div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: '#94a3b8', marginBottom: 6 }}>
          <span>🛡️ HP: {listing.divHealth}/{listing.divMaxHealth}</span>
          <span>👥 Troops: {listing.divManpower}/{listing.divMaxManpower}</span>
        </div>
        {/* HP bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${hpPct}%`, height: '100%', background: hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
        </div>
        {/* Actions */}
        {isMine ? (
          <button onClick={() => {
            const r = market.delistDivision(listing.id)
            showFeedback(r.message)
            ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
          }} style={{ width: '100%', padding: '6px 0', fontSize: 10, fontWeight: 800, border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>
            ✕ DELIST
          </button>
        ) : (
          <button onClick={() => setBuyConfirm(listing)}
            disabled={player.money < listing.price}
            style={{ width: '100%', padding: '6px 0', fontSize: 10, fontWeight: 800, border: `1px solid ${player.money >= listing.price ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 4, background: player.money >= listing.price ? 'rgba(34,211,138,0.1)' : 'rgba(0,0,0,0.3)', color: player.money >= listing.price ? '#22d38a' : '#475569', cursor: player.money >= listing.price ? 'pointer' : 'not-allowed' }}>
            {player.money >= listing.price ? '💰 BUY' : '⛔ NOT ENOUGH'}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {feedback && <div style={{ padding: '6px 10px', marginBottom: 8, fontSize: 11, fontWeight: 700, borderRadius: 4, background: feedback.includes('Not') || feedback.includes('Cannot') || feedback.includes('Minimum') ? 'rgba(239,68,68,0.15)' : 'rgba(34,211,138,0.15)', color: feedback.includes('Not') || feedback.includes('Cannot') || feedback.includes('Minimum') ? '#ef4444' : '#22d38a', border: `1px solid ${feedback.includes('Not') || feedback.includes('Cannot') ? 'rgba(239,68,68,0.3)' : 'rgba(34,211,138,0.3)'}` }}>{feedback}</div>}

      {/* YOUR DIVISIONS — SELL */}
      <SectionHeader label="YOUR DIVISIONS — SELL" />
      {myDivisions.length === 0 ? (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginBottom: 14 }}>No divisions available to sell.</div>
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
              onChange={e => setListPrice(p => ({ ...p, [div.id]: Number(e.target.value) }))}
              onClick={e => e.stopPropagation()}
              style={{ width: 80, padding: '3px 6px', fontSize: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fbbf24', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
            />
            <button disabled={!canList} onClick={() => {
              const r = market.listDivision(div.id, price)
              showFeedback(r.message)
              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
            }} style={{ padding: '4px 10px', fontSize: 9, fontWeight: 800, border: `1px solid ${canList ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 3, background: canList ? 'rgba(34,211,138,0.1)' : 'rgba(0,0,0,0.3)', color: canList ? '#22d38a' : '#475569', cursor: canList ? 'pointer' : 'not-allowed' }}>
              LIST
            </button>
          </div>
        )
      })}

      {/* MARKETPLACE LISTINGS */}
      <SectionHeader label="DIVISION MARKETPLACE" />
      {otherListings.length === 0 && myListings.length === 0 ? (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', marginBottom: 14 }}>No divisions listed for sale. Be the first!</div>
      ) : (
        otherListings.map(l => renderDivCard(l, false))
      )}

      {/* YOUR ACTIVE LISTINGS */}
      {myListings.length > 0 && (
        <>
          <SectionHeader label="YOUR LISTINGS" />
          {myListings.map(l => renderDivCard(l, true))}
        </>
      )}

      {/* Buy Confirm Modal */}
      {buyConfirm && (
        <Modal onClose={() => setBuyConfirm(null)} borderColor="#22d38a">
          <ModalTitle color="#22d38a">Buy Division</ModalTitle>
          <InfoGrid rows={[
            ['Division', buyConfirm.divName],
            ['Type', buyConfirm.divType],
            ['Level', `${buyConfirm.divLevel}`],
            ['Stars', '★'.repeat(buyConfirm.divStars)],
            ['HP', `${buyConfirm.divHealth} / ${buyConfirm.divMaxHealth}`],
            ['Troops', `${buyConfirm.divManpower} / ${buyConfirm.divMaxManpower}`],
            ['Seller', `${buyConfirm.sellerId} (${buyConfirm.sellerCountry})`],
            ['Price', `🪙 ${buyConfirm.price.toLocaleString()}`],
            ['Your money', `🪙 ${player.money.toLocaleString()}`],
          ]} />
          <TradeBtn label={`BUY for 🪙${buyConfirm.price.toLocaleString()}`} color="#22d38a" enabled={player.money >= buyConfirm.price}
            onClick={() => {
              const r = market.buyDivision(buyConfirm.id)
              showFeedback(r.message)
              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
              setBuyConfirm(null)
            }}
          />
        </Modal>
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

function Modal({ children, onClose, borderColor }: { children: React.ReactNode; onClose: () => void; borderColor: string }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 300, background: 'rgba(8,12,18,0.97)', border: `1px solid ${borderColor}`, borderRadius: 8, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function ModalTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font-display)', color, textAlign: 'center', marginBottom: 10 }}>{children}</div>
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', padding: '2px 0' }}>
          <span>{label}</span>
          <span style={{ color: '#fff', fontWeight: 700 }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

function QtyRow({ qty, setQty, maxQty }: { qty: number; setQty: (n: number) => void; maxQty: number }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
        <QBtn label="−" onClick={() => setQty(Math.max(1, qty - 10))} />
        <QBtn label="−" onClick={() => setQty(Math.max(1, qty - 1))} />
        <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, minWidth: 46, textAlign: 'center' }}>{qty}</div>
        <QBtn label="+" onClick={() => setQty(qty + 1)} />
        <QBtn label="+" onClick={() => setQty(qty + 10)} />
      </div>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
        {[1, 10, 50, 100].map(n => (
          <button key={n} onClick={() => setQty(n)} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, background: qty === n ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>{n}</button>
        ))}
        <button onClick={() => setQty(Math.max(1, maxQty))} style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, background: 'rgba(34,211,138,0.12)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: 4, color: '#22d38a', cursor: 'pointer' }}>MAX</button>
      </div>
    </>
  )
}

function TradeBtn({ label, color, enabled, onClick }: { label: string; color: string; enabled: boolean; onClick: () => void }) {
  return (
    <button disabled={!enabled} onClick={onClick} style={{ width: '100%', padding: '10px 0', fontWeight: 900, fontSize: 12, border: `1px solid ${enabled ? color : '#334155'}`, borderRadius: 4, background: enabled ? `${color}18` : 'rgba(0,0,0,0.3)', color: enabled ? color : '#475569', cursor: enabled ? 'pointer' : 'not-allowed', marginBottom: 4 }}>
      {label}
    </button>
  )
}

function QBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 28, height: 28, fontSize: 15, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>{label}</button>
  )
}
