import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useStockStore, BOND_DURATIONS } from '../../stores/stockStore'
import type { CountryStock } from '../../stores/stockStore'
import '../../styles/stocks.css'

/* ── Mini sparkline chart ── */
function Sparkline({ history }: { history: { price: number }[] }) {
  if (history.length < 2) return null
  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 120; const h = 28

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const isUp = prices[prices.length - 1] >= prices[0]

  return (
    <svg width={w} height={h} className="stock-sparkline">
      <polyline points={points} fill="none" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

export default function StockMarketPanel() {
  const player = usePlayerStore()
  const stockStore = useStockStore()
  const { stocks, portfolio, marketPool, transactions, bonds } = stockStore

  const [tab, setTab] = useState<'shares' | 'bonds' | 'log'>('shares')
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [qty, setQty] = useState(10)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Bond form
  const [bondCode, setBondCode] = useState('')
  const [bondDir, setBondDir] = useState<'up' | 'down'>('up')
  const [bondAmount, setBondAmount] = useState(50000)
  const [bondDuration, setBondDuration] = useState(0)

  // Stock market tick and bond resolution are handled by the GameClock globally.
  // No component-scoped setInterval needed — prices update even when this panel is closed.

  // Per-second refresh for bond countdown display only (no logic, just re-render)
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (tab !== 'bonds') return
    const interval = setInterval(() => {
      forceUpdate(n => n + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [tab])

  useEffect(() => {
    stockStore.fetchStocks()
    stockStore.fetchHoldings()
  }, [])

  const selected: CountryStock | undefined = selectedStock ? stockStore.getStock(selectedStock) : undefined
  const holding = selectedStock ? stockStore.getHolding(selectedStock) : undefined
  const portfolioValue = stockStore.getPortfolioValue()

  const showMsg = (msg: string, type: 'success' | 'error') => { setMessage(msg); setMessageType(type) }

  const pctChange = (stock: CountryStock) => {
    if (!stock.prevPrice) return 0
    return ((stock.price - stock.prevPrice) / stock.prevPrice * 100)
  }

  const activeBonds = bonds.filter(b => b.status === 'open')

  return (
    <div className="stock-panel">

      {/* ═══ HEADER ═══ */}
      <div className="stock-header">
        <div className="stock-header__title">STOCK MARKET</div>
        <div className="stock-header__sub">
          PORTFOLIO: <span className="stock-header__value">${portfolioValue.toLocaleString()}</span>
          <span className="stock-header__sep">|</span>
          CASH: <span className="stock-header__cash">${player.money.toLocaleString()}</span>
          <span className="stock-header__sep">|</span>
          POOL: <span className="stock-header__pool">${marketPool.toLocaleString()}</span>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="stock-tabs">
        <button className={`stock-tab ${tab === 'shares' ? 'stock-tab--active' : ''}`} onClick={() => setTab('shares')}>
          SHARES
        </button>
        <button className={`stock-tab ${tab === 'bonds' ? 'stock-tab--active' : ''}`} onClick={() => setTab('bonds')}>
          BONDS ({activeBonds.length})
        </button>
        <button className={`stock-tab ${tab === 'log' ? 'stock-tab--active' : ''}`} onClick={() => setTab('log')}>
          LOG
        </button>
      </div>

      {message && <div className={`stock-message stock-message--${messageType}`}>{message}</div>}

      {/* ═══ SHARES TAB ═══ */}
      {tab === 'shares' && (
        <>
          <div className="stock-list">
            {stocks.sort((a, b) => b.price - a.price).map(stock => {
              const change = pctChange(stock)
              const isUp = change >= 0
              const myShares = portfolio.find(h => h.code === stock.code)

              return (
                <div key={stock.code}
                  className={`stock-row ${selectedStock === stock.code ? 'stock-row--selected' : ''}`}
                  onClick={() => setSelectedStock(stock.code === selectedStock ? null : stock.code)}
                >
                  <div className="stock-row__left">
                    <div className="stock-row__code">{stock.code}</div>
                    <div className="stock-row__name">{stock.name}</div>
                  </div>
                  <div className="stock-row__chart"><Sparkline history={stock.history} /></div>
                  <div className="stock-row__right">
                    <div className="stock-row__price">${stock.price}</div>
                    <div className={`stock-row__change ${isUp ? 'stock-row__change--up' : 'stock-row__change--down'}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                    </div>
                    {myShares && <div className="stock-row__shares">{myShares.shares} shares</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {selected && (
            <div className="stock-trade">
              <div className="stock-trade__header">
                <span className="stock-trade__code">{selected.code}</span>
                <span className="stock-trade__price">${selected.price}/share</span>
              </div>
              <div className="stock-trade__qty">
                <span className="stock-trade__label">QTY</span>
                <div className="stock-trade__qty-btns">
                  {[1, 5, 10, 25, 50, 100].map(q => (
                    <button key={q}
                      className={`stock-trade__qty-btn ${qty === q ? 'stock-trade__qty-btn--active' : ''}`}
                      onClick={() => setQty(q)}
                    >{q}</button>
                  ))}
                </div>
              </div>
              <div className="stock-trade__summary">
                <div>Cost: <strong>${(selected.price * qty).toLocaleString()}</strong> (1% to country, 99% to pool)</div>
                {holding && <div>You own: <strong>{holding.shares} shares</strong> (avg ${holding.avgBuyPrice})</div>}
              </div>
              <div className="stock-trade__actions">
                <button className="stock-trade__btn stock-trade__btn--buy"
                  disabled={player.money < selected.price * qty}
                  onClick={async () => { const r = await stockStore.buyShares(selected.code, qty); showMsg(r.message, r.success ? 'success' : 'error') }}>
                  BUY {qty}
                </button>
                <button className="stock-trade__btn stock-trade__btn--sell"
                  disabled={!holding}
                  onClick={async () => { const r = await stockStore.sellShares(holding!.id!); showMsg(r.message, r.success ? 'success' : 'error') }}>
                  SELL ALL ({holding?.shares || 0})
                </button>
              </div>
            </div>
          )}

          {portfolio.length > 0 && (
            <div className="stock-portfolio">
              <div className="stock-portfolio__title">YOUR PORTFOLIO</div>
              {portfolio.map(h => {
                const stock = stockStore.getStock(h.code)
                if (!stock) return null
                const currentValue = stock.price * h.shares
                const costBasis = h.avgBuyPrice * h.shares
                const pnl = currentValue - costBasis
                const pnlPct = ((currentValue / costBasis) - 1) * 100
                return (
                  <div key={h.code} className="stock-portfolio__row">
                    <span className="stock-portfolio__code">{h.code}</span>
                    <span className="stock-portfolio__shares">{h.shares} shares</span>
                    <span className="stock-portfolio__value">${currentValue.toLocaleString()}</span>
                    <span className={`stock-portfolio__pnl ${pnl >= 0 ? 'stock-portfolio__pnl--up' : 'stock-portfolio__pnl--down'}`}>
                      {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ BONDS TAB ═══ */}
      {tab === 'bonds' && (
        <>
          {/* Open new bond */}
          <div className="bond-form">
            <div className="bond-form__title">OPEN BINARY BOND</div>

            <div className="bond-form__label">SELECT STOCK</div>
            <div className="bond-form__stocks">
              {stocks.slice(0, 6).map(s => (
                <button key={s.code}
                  className={`bond-stock-btn ${bondCode === s.code ? 'bond-stock-btn--active' : ''}`}
                  onClick={() => setBondCode(s.code)}>
                  {s.code} ${s.price}
                </button>
              ))}
            </div>

            <div className="bond-form__label">DIRECTION</div>
            <div className="bond-form__dir">
              <button className={`bond-dir-btn bond-dir-btn--up ${bondDir === 'up' ? 'bond-dir-btn--active-up' : ''}`}
                onClick={() => setBondDir('up')}>
                ▲ UP
              </button>
              <button className={`bond-dir-btn bond-dir-btn--down ${bondDir === 'down' ? 'bond-dir-btn--active-down' : ''}`}
                onClick={() => setBondDir('down')}>
                ▼ DOWN
              </button>
            </div>

            <div className="bond-form__label">DURATION & PAYOUT</div>
            <div className="bond-form__durations">
              {BOND_DURATIONS.map((d, i) => (
                <button key={i}
                  className={`bond-dur-btn ${bondDuration === i ? 'bond-dur-btn--active' : ''}`}
                  onClick={() => setBondDuration(i)}>
                  {d.label} (×{d.multiplier})
                </button>
              ))}
            </div>

            <div className="bond-form__label">BET AMOUNT</div>
            <div className="bond-form__amounts">
              {[10_000, 50_000, 100_000, 250_000].map(a => (
                <button key={a}
                  className={`bond-amt-btn ${bondAmount === a ? 'bond-amt-btn--active' : ''}`}
                  onClick={() => setBondAmount(a)}>
                  ${a >= 1000 ? `${a/1000}K` : a}
                </button>
              ))}
            </div>

            <div className="bond-form__payout">
              Win payout: <strong className="bond-form__payout-val">${Math.floor(bondAmount * (BOND_DURATIONS[bondDuration]?.multiplier || 1) * 0.9).toLocaleString()}</strong>
              <span style={{ fontSize: '8px', color: '#64748b', marginLeft: '6px' }}>(×{BOND_DURATIONS[bondDuration]?.multiplier} - 10% tax)</span>
            </div>

            <button className="bond-form__submit"
              disabled={!bondCode || player.money < bondAmount}
              onClick={() => {
                const r = stockStore.openBond(bondCode, bondDir, bondAmount, bondDuration)
                showMsg(r.message, r.success ? 'success' : 'error')
              }}>
              OPEN {bondDir.toUpperCase()} BOND — ${bondAmount.toLocaleString()}
            </button>
          </div>

          {/* Active bonds */}
          {activeBonds.length > 0 && (
            <div className="bond-active">
              <div className="bond-active__title">ACTIVE BONDS</div>
              {activeBonds.map(b => {
                const stock = stockStore.getStock(b.countryCode)
                const currentPrice = stock?.price || 0
                const isWinning = (b.direction === 'up' && currentPrice > b.entryPrice) ||
                                  (b.direction === 'down' && currentPrice < b.entryPrice)
                const timeLeft = Math.max(0, b.expiresAt - Date.now())
                const mins = Math.floor(timeLeft / 60000)
                const secs = Math.floor((timeLeft % 60000) / 1000)

                return (
                  <div key={b.id} className={`bond-card ${isWinning ? 'bond-card--winning' : 'bond-card--losing'}`}>
                    <div className="bond-card__header">
                      <span className="bond-card__code">{b.countryCode}</span>
                      <span className={`bond-card__dir bond-card__dir--${b.direction}`}>
                        {b.direction === 'up' ? '▲' : '▼'} {b.direction.toUpperCase()}
                      </span>
                      <span className="bond-card__timer">{mins}:{secs.toString().padStart(2, '0')}</span>
                    </div>
                    <div className="bond-card__meta">
                      Entry: ${b.entryPrice} → Now: ${currentPrice}
                      <span className={isWinning ? 'bond-card__status--win' : 'bond-card__status--lose'}>
                        {isWinning ? ' WINNING' : ' LOSING'}
                      </span>
                    </div>
                    <div className="bond-card__footer">
                      <span>Bet: ${b.betAmount.toLocaleString()}</span>
                      <span className="bond-card__locked">
                        🔒 {mins}:{secs.toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Closed bonds history */}
          {bonds.filter(b => b.status !== 'open').length > 0 && (
            <div className="bond-history">
              <div className="bond-history__title">BOND HISTORY</div>
              {bonds.filter(b => b.status !== 'open').slice(0, 10).map(b => (
                <div key={b.id} className={`bond-history__row bond-history__row--${b.status}`}>
                  <span>{b.countryCode} {b.direction === 'up' ? '▲' : '▼'}</span>
                  <span>${b.betAmount.toLocaleString()}</span>
                  <span className={b.status === 'won' ? 'bond-history__won' : 'bond-history__lost'}>
                    {b.status === 'won' ? `+$${((b.payout || 0) - b.betAmount).toLocaleString()}` : `-$${b.betAmount.toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ TRANSACTION LOG TAB ═══ */}
      {tab === 'log' && (
        <div className="stock-log">
          <div className="stock-log__title">TRANSACTION LOG</div>
          {transactions.length === 0 ? (
            <div className="stock-log__empty">No transactions yet.</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className={`stock-log__row stock-log__row--${tx.type}`}>
                <span className="stock-log__type">{tx.type.replace('_', ' ').toUpperCase()}</span>
                <span className="stock-log__code">{tx.code}</span>
                <span className="stock-log__total">${tx.total.toLocaleString()}</span>
                {tx.pnl !== undefined && (
                  <span className={`stock-log__pnl ${tx.pnl >= 0 ? 'stock-log__pnl--up' : 'stock-log__pnl--down'}`}>
                    {tx.pnl >= 0 ? '+' : ''}${tx.pnl.toLocaleString()}
                  </span>
                )}
                <span className="stock-log__time">
                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
          <div className="stock-log__pool">
            MARKET POOL BALANCE: <span className="stock-log__pool-val">${marketPool.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
