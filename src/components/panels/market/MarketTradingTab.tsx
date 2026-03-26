import React, { useState, useRef, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMarketStore, RESOURCE_DEFS, type ResourceId } from '../../../stores/market'
import { useArmyStore } from '../../../stores/army'
import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import ResourceIcon from '../../shared/ResourceIcon'

/* ── Price Chart (canvas) ── */
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

    const data = priceHistory.length >= 2 ? [...priceHistory] : Array(24).fill(currentPrice).map((p: number) => p + (Math.random() - 0.45) * p * 0.04)

    // 3-day moving average
    const ma: number[] = []
    for (let i = 0; i < data.length; i++) {
      if (i < 2) { ma.push(data[i]); continue }
      ma.push((data[i] + data[i - 1] + data[i - 2]) / 3)
    }

    // Synthetic volume
    const vol: number[] = data.map((p: number, i: number) => {
      if (i === 0) return 500 + Math.random() * 300
      const changePct = Math.abs((p - data[i - 1]) / data[i - 1])
      return 200 + changePct * 20000 + Math.random() * 400
    })

    const minP = Math.min(...ma) * 0.995
    const maxP = Math.max(...ma) * 1.005
    const priceRange = maxP - minP || 1
    const maxVol = Math.max(...vol) * 1.2

    const padT = 8, padB = 4, padL = 4, padR = 36
    const cw = w - padL - padR
    const ch = h - padT - padB
    const barW = Math.max(2, (cw / data.length) * 0.6)

    const toX = (i: number) => padL + (i / (data.length - 1)) * cw
    const toY = (v: number) => padT + (1 - (v - minP) / priceRange) * ch

    ctx.clearRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (ch / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke()
      const pVal = maxP - (priceRange / 4) * i
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(pVal.toFixed(2), w - padR + 3, y + 3)
    }

    // Volume bars
    ctx.globalAlpha = 0.33
    vol.forEach((v, i) => {
      const x = toX(i) - barW / 2
      const barH = (v / maxVol) * ch
      const y = h - padB - barH
      const up = i === 0 || data[i] >= data[i - 1]
      ctx.fillStyle = up ? '#22d38a' : '#ef4444'
      ctx.fillRect(x, y, barW, barH)
    })
    ctx.globalAlpha = 1.0

    // Volume labels
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '7px monospace'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 2; i++) {
      const volVal = (maxVol / 2) * i
      const y = h - padB - (volVal / maxVol) * ch
      const label = volVal >= 1000 ? (volVal / 1000).toFixed(1) + 'k' : Math.floor(volVal).toString()
      ctx.fillText(label, padL + 22, y + 3)
    }

    // 3-Day MA line
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ma.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)) })
    ctx.stroke()

    // Fill below MA
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

/* ══════ MarketTradingTab ══════ */
interface MarketTradingTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

export default function MarketTradingTab({ showFb }: MarketTradingTabProps) {
  const player = usePlayerStore()
  const market = useMarketStore()

  const [selResource, setSelResource] = useState<ResourceId>(RESOURCE_DEFS[0].id)
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState(1)
  const [limitPrice, setLimitPrice] = useState(0)
  const [countryMode, setCountryMode] = useState(false)
  const [vaultMode, setVaultMode] = useState(false)

  const iso = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[iso]
  const isPresident = gov?.president === player.name
  const countryFund = useWorldStore.getState().getCountry(iso)?.fund

  const armyStoreAll = useArmyStore.getState()
  const playersArmies = Object.values(armyStoreAll.armies)
  const myEnlistedArmy = playersArmies.find(a => a.members.some(m => m.playerId === player.name))
  const isVaultOfficer = myEnlistedArmy ? (
    myEnlistedArmy.commanderId === player.name ||
    (myEnlistedArmy.members.find(m => m.playerId === player.name)?.role === 'colonel') ||
    (myEnlistedArmy.members.find(m => m.playerId === player.name)?.role === 'general')
  ) : false

  return (
    <>
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
            🏦 TRADE FROM MILITARY VAULT
          </label>
          {vaultMode && <span className="market-president-toggle__fund" style={{ color: '#f59e0b' }}>Vault: ${myEnlistedArmy.vault.money.toLocaleString()} · 🛢️{myEnlistedArmy.vault.oil.toLocaleString()}</span>}
        </div>
      )}

      {/* Resource selector strip */}
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
                <ResourceIcon resourceKey={def.id} size={22} />
              </div>
              <div className="mkt-strip__price">{price < 1 ? price.toFixed(2) : price < 100 ? price.toFixed(1) : Math.floor(price)}</div>
              <div className={`mkt-strip__change ${change >= 0 ? 'mkt-strip__change--up' : 'mkt-strip__change--down'}`}>
                {change >= 0 ? '▲' : '▼'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected resource detail */}
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
                <ResourceIcon resourceKey={def.id} size={28} />
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

            <PriceChart priceHistory={ticker?.priceHistory || []} currentPrice={ticker?.price || def.basePrice} />

            {/* Buy/Sell form */}
            <div className="mkt-form">
              <div className="mkt-form__toggle">
                <button onClick={() => setOrderType('buy')} className={`mkt-form__toggle-btn ${orderType === 'buy' ? 'mkt-form__toggle-btn--buy' : ''}`}>BUY</button>
                <button onClick={() => setOrderType('sell')} className={`mkt-form__toggle-btn ${orderType === 'sell' ? 'mkt-form__toggle-btn--sell' : ''}`}>SELL</button>
              </div>
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
              <div className="mkt-form__quick">
                {[1, 10, 50, 100, 500].map(n => (
                  <button key={n} onClick={() => setQty(n)} className={`mkt-form__qbtn ${qty === n ? 'mkt-form__qbtn--active' : ''}`}>{n}</button>
                ))}
                <button onClick={() => {
                  if (orderType === 'sell') setQty(owned)
                  else if (limitPrice > 0) setQty(Math.max(1, Math.floor(player.money / limitPrice)))
                }} className="mkt-form__qbtn mkt-form__qbtn--max">MAX</button>
              </div>
              <div className="mkt-form__total">
                Total: <span className="mkt-form__total-val">${totalCost.toFixed(2)}</span>
                {orderType === 'buy' && <span className="mkt-form__tax">(1% tax)</span>}
              </div>
              <button onClick={async () => {
                let r
                if (vaultMode && isVaultOfficer && myEnlistedArmy) {
                  r = await market.placeForceVaultOrder(myEnlistedArmy.id, orderType, selResource, qty, limitPrice)
                } else if (countryMode && isPresident) {
                  r = await market.placeCountryOrder(orderType, selResource, qty, limitPrice)
                } else {
                  r = await market.placeResourceOrder(orderType, selResource, qty, limitPrice)
                }
                showFb(r.message, r.success)
                market.fetchListings()
              }} className={`mkt-form__submit ${orderType === 'buy' ? 'mkt-form__submit--buy' : 'mkt-form__submit--sell'}`}>
                {vaultMode ? '🏦 ' : countryMode ? '🏛️ ' : ''}{orderType === 'buy' ? 'BUY' : 'SELL'} — ${totalCost.toFixed(2)}
              </button>
            </div>

            {/* Order book */}
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
    </>
  )
}
