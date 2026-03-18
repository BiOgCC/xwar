import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useStockStore } from '../../stores/stockStore'
import type { CountryStock } from '../../stores/stockStore'
import '../../styles/stocks.css'

/* ── Mini sparkline chart (CSS-only) ── */
function Sparkline({ history }: { history: { price: number }[] }) {
  if (history.length < 2) return null
  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 120
  const h = 28

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const isUp = prices[prices.length - 1] >= prices[0]

  return (
    <svg width={w} height={h} className="stock-sparkline">
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function StockMarketPanel() {
  const player = usePlayerStore()
  const stockStore = useStockStore()
  const { stocks, portfolio } = stockStore

  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [qty, setQty] = useState(10)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  // Auto-tick market every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      useStockStore.getState().tickMarket()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const selected: CountryStock | undefined = selectedStock ? stockStore.getStock(selectedStock) : undefined
  const holding = selectedStock ? stockStore.getHolding(selectedStock) : undefined
  const portfolioValue = stockStore.getPortfolioValue()

  const handleBuy = () => {
    if (!selectedStock) return
    const result = stockStore.buyShares(selectedStock, qty)
    setMessage(result.message)
    setMessageType(result.success ? 'success' : 'error')
  }

  const handleSell = () => {
    if (!selectedStock) return
    const result = stockStore.sellShares(selectedStock, qty)
    setMessage(result.message)
    setMessageType(result.success ? 'success' : 'error')
  }

  const pctChange = (stock: CountryStock) => {
    if (!stock.prevPrice) return 0
    return ((stock.price - stock.prevPrice) / stock.prevPrice * 100)
  }

  return (
    <div className="stock-panel">

      {/* ═══ HEADER ═══ */}
      <div className="stock-header">
        <div className="stock-header__title">STOCK MARKET</div>
        <div className="stock-header__sub">
          PORTFOLIO: <span className="stock-header__value">${portfolioValue.toLocaleString()}</span>
          <span className="stock-header__sep">|</span>
          CASH: <span className="stock-header__cash">${player.money.toLocaleString()}</span>
        </div>
      </div>

      {/* ═══ STATUS MESSAGE ═══ */}
      {message && (
        <div className={`stock-message stock-message--${messageType}`}>
          {message}
        </div>
      )}

      {/* ═══ STOCK LIST ═══ */}
      <div className="stock-list">
        {stocks
          .sort((a, b) => b.price - a.price)
          .map(stock => {
            const change = pctChange(stock)
            const isUp = change >= 0
            const myShares = portfolio.find(h => h.code === stock.code)

            return (
              <div
                key={stock.code}
                className={`stock-row ${selectedStock === stock.code ? 'stock-row--selected' : ''}`}
                onClick={() => setSelectedStock(stock.code === selectedStock ? null : stock.code)}
              >
                <div className="stock-row__left">
                  <div className="stock-row__code">{stock.code}</div>
                  <div className="stock-row__name">{stock.name}</div>
                </div>
                <div className="stock-row__chart">
                  <Sparkline history={stock.history} />
                </div>
                <div className="stock-row__right">
                  <div className="stock-row__price">${stock.price}</div>
                  <div className={`stock-row__change ${isUp ? 'stock-row__change--up' : 'stock-row__change--down'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                  </div>
                  {myShares && (
                    <div className="stock-row__shares">{myShares.shares} shares</div>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {/* ═══ TRADE PANEL ═══ */}
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
                <button
                  key={q}
                  className={`stock-trade__qty-btn ${qty === q ? 'stock-trade__qty-btn--active' : ''}`}
                  onClick={() => setQty(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="stock-trade__summary">
            <div>Cost: <strong>${(selected.price * qty).toLocaleString()}</strong></div>
            <div>Tax (2%): <strong>${Math.floor(selected.price * qty * 0.02).toLocaleString()}</strong></div>
            {holding && <div>You own: <strong>{holding.shares} shares</strong> (avg ${holding.avgBuyPrice})</div>}
          </div>

          <div className="stock-trade__actions">
            <button
              className="stock-trade__btn stock-trade__btn--buy"
              disabled={player.money < selected.price * qty * 1.02}
              onClick={handleBuy}
            >
              BUY {qty}
            </button>
            <button
              className="stock-trade__btn stock-trade__btn--sell"
              disabled={!holding || holding.shares < qty}
              onClick={handleSell}
            >
              SELL {qty}
            </button>
          </div>
        </div>
      )}

      {/* ═══ PORTFOLIO ═══ */}
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
    </div>
  )
}
