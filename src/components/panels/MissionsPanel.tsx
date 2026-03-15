import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../stores/governmentStore'
import type { NationalFundKey } from '../../stores/governmentStore'
import { useCyberStore, CYBER_OPERATIONS, type CyberOperationType } from '../../stores/cyberStore'
import { useWorldStore } from '../../stores/worldStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'

export default function MissionsPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const cyber = useCyberStore()
  const ui = useUIStore()

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name

  const [donateResource, setDonateResource] = useState<NationalFundKey>('oil')
  const [donateAmount, setDonateAmount] = useState(100)

  const fund = gov?.nationalFund || { money: 0, oil: 0, scraps: 0, materialX: 0, bitcoin: 0, jets: 0 }

  const handleDonate = () => {
    const p = usePlayerStore.getState()
    const resourceMap: Record<NationalFundKey, number> = {
      money: p.money, oil: p.oil, scraps: p.scrap, materialX: p.materialX, bitcoin: p.bitcoin, jets: 0,
    }
    if (donateResource === 'jets') {
      const inv = useInventoryStore.getState()
      resourceMap.jets = inv.items.filter(i => i.tier === 't6' && i.slot === 'weapon' && !i.equipped).length
    }
    if (resourceMap[donateResource] < donateAmount) {
      ui.addFloatingText('NOT ENOUGH', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    if (donateResource === 'money') p.spendMoney(donateAmount)
    else if (donateResource === 'oil') p.spendOil(donateAmount)
    else if (donateResource === 'scraps') p.spendScraps(donateAmount)
    else if (donateResource === 'materialX') p.spendMaterialX(donateAmount)
    else if (donateResource === 'bitcoin') p.spendBitcoin(donateAmount)
    else if (donateResource === 'jets') {
      const inv = useInventoryStore.getState()
      const jets = inv.items.filter(i => i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      for (let i = 0; i < Math.min(donateAmount, jets.length); i++) inv.removeItem(jets[i].id)
    }
    govStore.donateToFund(iso, donateResource, donateAmount)
    ui.addFloatingText(`DONATED ${donateAmount} ${donateResource.toUpperCase()}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  // Get active cyber campaigns visible to player
  const myCampaigns = Object.values(cyber.campaigns).filter(
    c => c.initiatorPlayer === player.name || c.invitedPlayers.includes(player.name)
  ).sort((a, b) => b.createdAt - a.createdAt)

  const ss: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ====== NUKE CONTRIBUTION MISSION ====== */}
      <div className="hud-card" style={{ borderColor: '#f59e0b33' }}>
        <div className="hud-card__title" style={{ color: '#f59e0b' }}>☢️ NUCLEAR PROGRAM</div>
        <p style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
          {isPresident ? 'As President, authorize via Laws tab.' : 'Donate to the national fund to support the nuclear program.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginBottom: '8px' }}>
          {([
            ['oil', '🛢️ Oil', fund.oil, NUKE_COST.oil],
            ['scraps', '🔩 Scraps', fund.scraps, NUKE_COST.scraps],
            ['materialX', '⚛️ MatX', fund.materialX, NUKE_COST.materialX],
            ['bitcoin', '₿ BTC', fund.bitcoin, NUKE_COST.bitcoin],
            ['jets', '✈️ Jets', fund.jets, NUKE_COST.jets],
          ] as [string, string, number, number][]).map(([key, label, current, required]) => (
            <div key={key} style={{
              fontSize: '9px', padding: '3px 6px',
              background: current >= required ? 'rgba(34,211,138,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${current >= required ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '3px', color: current >= required ? '#22d38a' : '#94a3b8',
            }}>
              {label}: {current.toLocaleString()}/{required.toLocaleString()} {current >= required ? '✓' : ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select value={donateResource} onChange={(e) => setDonateResource(e.target.value as NationalFundKey)} style={{ ...ss, flex: 1 }}>
            <option value="money">Money</option><option value="oil">Oil</option><option value="scraps">Scraps</option>
            <option value="materialX">Material X</option><option value="bitcoin">Bitcoin</option><option value="jets">Jets (T6)</option>
          </select>
          <input type="number" value={donateAmount} onChange={(e) => setDonateAmount(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...ss, width: '60px' }} />
          <button className="hud-btn-primary" onClick={handleDonate} style={{ fontSize: '9px', padding: '5px 10px' }}>DONATE</button>
        </div>
      </div>

      {/* ====== CYBER CONTRIBUTION MISSIONS ====== */}
      <div className="hud-card">
        <div className="hud-card__title">🖥️ CYBERWARFARE MISSIONS</div>
        <p style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
          Each cyber operation requires a contribution mission. Pay 10% of the operation's cost to activate.
          {isPresident ? '' : ' Anyone can activate after paying.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {CYBER_OPERATIONS.map(op => {
            const activationCost = {
              oil: Math.ceil(op.cost.oil * 0.1),
              materialX: Math.ceil(op.cost.materialX * 0.1),
              bitcoin: Math.ceil(op.cost.bitcoin * 0.1),
            }
            const canAfford = player.oil >= activationCost.oil &&
              player.materialX >= activationCost.materialX &&
              player.bitcoin >= activationCost.bitcoin

            const handleActivate = () => {
              if (!canAfford) {
                ui.addFloatingText('NOT ENOUGH', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
                return
              }
              const p = usePlayerStore.getState()
              p.spendOil(activationCost.oil)
              p.spendMaterialX(activationCost.materialX)
              p.spendBitcoin(activationCost.bitcoin)
              // Donate to national fund
              govStore.donateToFund(iso, 'oil', activationCost.oil)
              govStore.donateToFund(iso, 'materialX', activationCost.materialX)
              govStore.donateToFund(iso, 'bitcoin', activationCost.bitcoin)
              ui.addFloatingText(`ACTIVATED ${op.name}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
            }

            return (
              <div key={op.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: '3px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: 600 }}>{op.icon} {op.name}</div>
                  <div style={{ fontSize: '8px', color: '#64748b' }}>
                    Cost: {activationCost.oil} Oil · {activationCost.materialX} MatX · {activationCost.bitcoin}₿
                  </div>
                </div>
                <button
                  className="hud-btn-outline"
                  onClick={handleActivate}
                  style={{
                    fontSize: '8px', padding: '3px 8px',
                    borderColor: canAfford ? '#22d38a' : '#333',
                    color: canAfford ? '#22d38a' : '#555',
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                  }}
                >
                  ACTIVATE
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ====== ACTIVE CAMPAIGNS ====== */}
      <div className="hud-card">
        <div className="hud-card__title">📂 MY CAMPAIGNS ({myCampaigns.length})</div>
        {myCampaigns.length === 0 ? (
          <p style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>No campaigns. Launch from Cyber panel.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            {myCampaigns.slice(0, 10).map(c => {
              const opDef = CYBER_OPERATIONS.find(op => op.id === c.operationType)
              const sc: Record<string, string> = { active: '#3b82f6', completed: '#22d38a', detected: '#f59e0b', failed: '#ef4444' }
              return (
                <div key={c.id} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600 }}>{opDef?.icon} {opDef?.name}</span>
                    <span style={{ fontSize: '8px', color: sc[c.status] || '#666', fontWeight: 700, textTransform: 'uppercase' }}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>
                    {c.targetCountry || c.targetRegion || c.targetPlayer || 'N/A'} {c.wasDetected ? '⚠️ DETECTED' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
