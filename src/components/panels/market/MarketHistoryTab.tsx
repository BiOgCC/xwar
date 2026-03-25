import React from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMarketStore, RESOURCE_DEFS } from '../../../stores/market'
import ResourceIcon from '../../shared/ResourceIcon'

interface MarketHistoryTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

export default function MarketHistoryTab({ showFb }: MarketHistoryTabProps) {
  const market = useMarketStore()
  const player = usePlayerStore()

  const trades = market.getRecentTrades(30)

  return (
    <>
      <div className="market-section-title">TRANSACTION LOG</div>
      {trades.length === 0 ? (
        <div className="market-empty">No trades yet.</div>
      ) : (
        trades.map(t => {
          const def = RESOURCE_DEFS.find(r => r.id === t.resourceId)
          const isMyBuy = t.buyer === player.name
          const isMySell = t.seller === player.name
          const ago = Math.floor((Date.now() - t.timestamp) / 60000)
          return (
            <div key={t.id} className={`market-history-row ${isMyBuy ? 'market-history-row--my-buy' : isMySell ? 'market-history-row--my-sell' : ''}`}>
              <div className="market-history-row__left">
                <span>
                  {t.itemType === 'resource' && def ? <>{t.amount}× <ResourceIcon resourceKey={def.id} size={14} style={{ margin: '0 2px' }} /> {def.name}</> : t.itemType === 'equipment' ? `⚔️ Equipment` : `🪖 Division`}
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
      )}
    </>
  )
}
