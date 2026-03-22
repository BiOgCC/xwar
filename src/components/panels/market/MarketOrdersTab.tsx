import React from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMarketStore, RESOURCE_DEFS } from '../../../stores/market'
import type { EquipSlot } from '../../../stores/inventoryStore'
import { SLOT_ICONS, getItemImagePath } from '../../../stores/inventoryStore'

interface MarketOrdersTabProps {
  showFb: (msg: string, ok?: boolean) => void
}

export default function MarketOrdersTab({ showFb }: MarketOrdersTabProps) {
  const market = useMarketStore()
  const player = usePlayerStore()

  const myOrders = market.getMyOrders()

  return (
    <>
      <div className="market-section-title">MY OPEN ORDERS</div>
      {myOrders.length === 0 ? (
        <div className="market-empty">No open orders.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {myOrders.map(o => {
            const def = RESOURCE_DEFS.find(r => r.id === o.resourceId)
            const isBuy = o.type === 'buy'
            const remaining = o.amount - o.filledAmount
            const accentColor = isBuy ? '#22d38a' : '#ef4444'

            let icon: React.ReactNode = null
            let itemName = ''
            if (o.itemType === 'resource' && def) {
              icon = def.iconImage
                ? <img src={def.iconImage} alt={def.name} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                : <span style={{ fontSize: 22 }}>{def.icon}</span>
              itemName = def.name
            } else if (o.itemType === 'equipment' && o.equipSnapshot) {
              const imgUrl = getItemImagePath(o.equipSnapshot.tier as any, o.equipSnapshot.slot as any, o.equipSnapshot.category as any, o.equipSnapshot.weaponSubtype as any, o.equipSnapshot.superforged)
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
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {icon}
                </div>
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
                <button onClick={async () => { const r = await market.cancelOrder(o.id); showFb(r.message, r.success); market.fetchListings() }}
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
      )}
    </>
  )
}
