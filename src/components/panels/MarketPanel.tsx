import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'

import '../../styles/market.css'
import ResourceIcon from '../shared/ResourceIcon'
import MarketTradingTab from './market/MarketTradingTab'
import MarketGearTab from './market/MarketGearTab'

import MarketOrdersTab from './market/MarketOrdersTab'
import MarketHistoryTab from './market/MarketHistoryTab'
import MarketCryptoTab from './market/MarketCryptoTab'


const TAB_DEFS = [

  { key: 'crypto' as const, icon: '/assets/icons/badge.png', label: 'Badge Mkt' },
  { key: 'trading' as const, icon: '/assets/icons/market.png', label: 'Market' },
  { key: 'equipment' as const, icon: '/assets/icons/gear.png', label: 'Gear' },

  { key: 'orders' as const, icon: '/assets/icons/orders.png', label: 'Orders' },
  { key: 'history' as const, icon: '/assets/icons/history.png', label: 'History' },
]

type TabKey = typeof TAB_DEFS[number]['key']

export default function MarketPanel() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()

  const [tab, setTab] = useState<TabKey>('trading')
  const [feedback, setFeedback] = useState('')

  const showFb = (msg: string, ok = true) => {
    setFeedback(msg)
    ui.addFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, ok ? '#22d38a' : '#ef4444')
    setTimeout(() => setFeedback(''), 3000)
  }

  const isError = feedback.includes('Need') || feedback.includes('Not') || feedback.includes('Cannot') || feedback.includes('Invalid')

  const equippedCount = inventory.items.filter(i => i.location === 'inventory' && i.equipped).length
  const totalItems = inventory.items.filter(i => i.location === 'inventory').length

  return (
    <div className="market-panel">
      {/* Inventory header */}
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

      {/* Feedback */}
      {feedback && (
        <div className={`market-feedback ${isError ? 'market-feedback--error' : 'market-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* Tab bar */}
      <div className="market-tabs">
        {TAB_DEFS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`market-tab ${tab === t.key ? 'market-tab--active' : ''}`}
          >
            <span className="market-tab__icon">
              <img src={t.icon} alt={t.label} style={{ width: 18, height: 18, objectFit: 'contain' }} />
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="market-content">

        {tab === 'crypto' && <MarketCryptoTab showFb={showFb} />}
        {tab === 'trading' && <MarketTradingTab showFb={showFb} />}
        {tab === 'equipment' && <MarketGearTab showFb={showFb} />}

        {tab === 'orders' && <MarketOrdersTab showFb={showFb} />}
        {tab === 'history' && <MarketHistoryTab showFb={showFb} />}
      </div>
    </div>
  )
}
