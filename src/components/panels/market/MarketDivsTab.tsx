import React, { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMarketStore } from '../../../stores/market'
import { useArmyStore, DIVISION_TEMPLATES } from '../../../stores/army'
import { useGovernmentStore } from '../../../stores/governmentStore'

interface MarketDivsTabProps {
  showFb: (msg: string, ok?: boolean) => void
  sourceFilter?: 'own' | 'country' | 'pmc'
}

const starColor = (s: number) => s >= 5 ? '#f59e0b' : s >= 4 ? '#a855f7' : s >= 3 ? '#3b82f6' : '#94a3b8'

export default function MarketDivsTab({ showFb, sourceFilter = 'own' }: MarketDivsTabProps) {
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
  const countryDivisions = isPresident
    ? Object.values(armyStoreState.divisions).filter(d =>
        d.countryCode === iso && d.ownerId === iso && d.status !== 'destroyed' && d.status !== 'listed'
      )
    : []

  // Vault officer check
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

  const divisionTypes = Object.keys(DIVISION_TEMPLATES)

  let filteredListings = [...otherListings, ...myListings]
  if (typeFilter !== 'all') filteredListings = filteredListings.filter(o => o.divSnapshot?.type === typeFilter)
  if (starsFilter > 0) filteredListings = filteredListings.filter(o => (o.divSnapshot?.stars || 0) >= starsFilter)

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

                <div className="war-recruit-card__stats">
                  <div className="war-recruit-stat"><span>HP</span><span className="war-recruit-stat__val">{div.health}/{div.maxHealth}</span></div>
                  <div className="war-recruit-stat"><span>Troops</span><span className="war-recruit-stat__val">{div.manpower}/{div.maxManpower}</span></div>
                  <div className="war-recruit-stat"><span>Level</span><span className="war-recruit-stat__val" style={{ color: '#f59e0b' }}>{divLevel}</span></div>
                  <div className="war-recruit-stat"><span>Stars</span><span className="war-recruit-stat__val" style={{ color: starColor(div.starQuality) }}>{div.starQuality}★</span></div>
                  <div className="war-recruit-stat"><span>Kills</span><span className="war-recruit-stat__val" style={{ color: div.killCount > 0 ? '#ef4444' : undefined }}>{div.killCount}</span></div>
                  <div className="war-recruit-stat"><span>Status</span><span className="war-recruit-stat__val" style={{ color: div.status === 'ready' ? '#22d38a' : div.status === 'in_combat' ? '#ef4444' : '#f59e0b' }}>{div.status}</span></div>
                </div>

                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '4px 0' }}>
                  <div style={{ width: `${hpPct}%`, height: '100%', background: hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>PRICE:</span>
                  <input type="number" min={1000} max={10000000} step={1000} value={price}
                    onChange={e => setListPrice(p => ({ ...p, [div.id]: +e.target.value }))}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, padding: '4px 6px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 900, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '3px', color: '#fbbf24', textAlign: 'right', outline: 'none' }} />
                </div>

                <div className="war-recruit-card__cost" style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span style={{ color: '#fbbf24' }}>🪙 ${price.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>{div.manpower} troops</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)' }}>Lv.{divLevel}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>{tmpl?.popCost || '?'} pop</span>
                </div>

                <div style={{ marginTop: '6px' }}>
                  <button className="war-recruit-btn" style={{ width: '100%', height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: canList ? 'rgba(34,211,138,0.15)' : 'rgba(100,116,139,0.1)', borderColor: canList ? 'rgba(34,211,138,0.4)' : 'rgba(100,116,139,0.2)', color: canList ? '#22d38a' : '#475569' }}
                    disabled={!canList}
                    onClick={async () => { const r = await market.placeDivisionSellOrder(div.id, price); showFb(r.message, r.success); if (r.success) market.fetchListings() }}
                  >{canList ? '📋 LIST FOR SALE' : `⛔ ${div.status.toUpperCase()}`}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VAULT DIVISIONS */}
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
                      onClick={async () => { const r = await market.placeVaultDivisionSellOrder(myEnlistedArmy.id, div.id, price); showFb(r.message, r.success); if (r.success) market.fetchListings() }}
                    >{canList ? '🏦 LIST FROM VAULT' : `⛔ ${div.status.toUpperCase()}`}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* COUNTRY DIVISIONS */}
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
                      onClick={async () => { const r = await market.placeCountryDivisionSellOrder(iso, div.id, price); showFb(r.message, r.success); if (r.success) market.fetchListings() }}
                    >🏛️ LIST FROM COUNTRY</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* MARKETPLACE — with filters */}
      <div className="market-section-title">🪖 DIVISION MARKETPLACE</div>

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

                <div className="war-recruit-card__stats">
                  <div className="war-recruit-stat"><span>HP</span><span className="war-recruit-stat__val">{snap.health}/{snap.maxHealth}</span></div>
                  <div className="war-recruit-stat"><span>Troops</span><span className="war-recruit-stat__val">{snap.manpower}/{snap.maxManpower}</span></div>
                  <div className="war-recruit-stat"><span>Level</span><span className="war-recruit-stat__val" style={{ color: '#f59e0b' }}>{snap.level}</span></div>
                  <div className="war-recruit-stat"><span>Stars</span><span className="war-recruit-stat__val" style={{ color: starColor(snap.stars) }}>{snap.stars}★</span></div>
                </div>

                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '4px 0' }}>
                  <div style={{ width: `${hpPct}%`, height: '100%', background: hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                </div>

                <div className="war-recruit-card__cost" style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span style={{ color: '#fbbf24' }}>🪙 ${order.totalPrice.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#cbd5e1', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}>{snap.manpower} troops</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)' }}>Lv.{snap.level}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>{order.countryCode}</span>
                  </div>
                  {isMine && <span style={{ fontSize: '8px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)' }}>YOUR LISTING</span>}
                </div>

                <div style={{ marginTop: '6px' }}>
                  <button className="war-recruit-btn"
                    style={{ width: '100%', height: '36px', fontSize: '11px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isMine ? 'rgba(239,68,68,0.15)' : canBuy ? undefined : 'rgba(100,116,139,0.1)',
                      borderColor: isMine ? 'rgba(239,68,68,0.4)' : canBuy ? undefined : 'rgba(100,116,139,0.2)',
                      color: isMine ? '#ef4444' : canBuy ? undefined : '#475569',
                    }}
                    disabled={!isMine && !canBuy}
                    onClick={async () => {
                      if (isMine) { const r = await market.cancelOrder(order.id); showFb(r.message, r.success) }
                      else { const r = await market.buyDivision(order.id); showFb(r.message, r.success) }
                      market.fetchListings()
                    }}
                  >{isMine ? '✕ DELIST' : canBuy ? '💰 BUY' : '⛔ INSUFFICIENT FUNDS'}</button>
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
