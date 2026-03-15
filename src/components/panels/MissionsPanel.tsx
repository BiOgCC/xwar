import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore, NUKE_COST, type NuclearFund } from '../../stores/governmentStore'
import { useCyberStore, CYBER_OPERATIONS } from '../../stores/cyberStore'
import { useWorldStore } from '../../stores/worldStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'

export default function MissionsPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const cyber = useCyberStore()
  const world = useWorldStore()
  const ui = useUIStore()

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]

  const [donateResource, setDonateResource] = useState<keyof NuclearFund>('oil')
  const [donateAmount, setDonateAmount] = useState<number>(100)

  const isPresident = gov?.president === player.name

  const handleDonate = () => {
    const p = usePlayerStore.getState()
    const resourceMap: Record<keyof NuclearFund, number> = {
      oil: p.oil,
      scraps: p.scrap,
      materialX: p.materialX,
      bitcoin: p.bitcoin,
      jets: 0,
    }

    if (donateResource === 'jets') {
      const inv = useInventoryStore.getState()
      const jets = inv.items.filter((i: any) => i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      resourceMap.jets = jets.length
    }

    if (resourceMap[donateResource] < donateAmount) {
      ui.addFloatingText('NOT ENOUGH RESOURCES', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    if (donateResource === 'oil') p.spendOil(donateAmount)
    else if (donateResource === 'scraps') p.spendScraps(donateAmount)
    else if (donateResource === 'materialX') p.spendMaterialX(donateAmount)
    else if (donateResource === 'bitcoin') p.spendBitcoin(donateAmount)
    else if (donateResource === 'jets') {
      const inv = useInventoryStore.getState()
      const jets = inv.items.filter((i: any) => i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      for (let i = 0; i < Math.min(donateAmount, jets.length); i++) {
        inv.removeItem(jets[i].id)
      }
    }

    govStore.donateToFund(iso, donateResource, donateAmount)
    ui.addFloatingText(`DONATED ${donateAmount} ${donateResource.toUpperCase()}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  const fund = gov?.nuclearFund || { oil: 0, scraps: 0, materialX: 0, bitcoin: 0, jets: 0 }

  // Get active cyber campaigns that the player can see
  const myCampaigns = Object.values(cyber.campaigns).filter(
    c => c.initiatorPlayer === player.name || c.invitedPlayers.includes(player.name)
  ).sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ====== NUKE CONTRIBUTION MISSION ====== */}
      <div className="hud-card" style={{ borderColor: '#f59e0b33' }}>
        <div className="hud-card__title" style={{ color: '#f59e0b' }}>
          ☢️ NUCLEAR PROGRAM — CONTRIBUTION MISSION
        </div>
        <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px' }}>
          {isPresident
            ? 'As President, you can activate the nuke mission via Government > Authorize Nuclear Action.'
            : 'Donate resources to your country\'s nuclear fund. Only the President can authorize the launch.'}
        </p>

        {/* Fund Progress */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
          {([
            ['oil', '🛢️ Oil', fund.oil, NUKE_COST.oil],
            ['scraps', '🔩 Scraps', fund.scraps, NUKE_COST.scraps],
            ['materialX', '⚛️ MatX', fund.materialX, NUKE_COST.materialX],
            ['bitcoin', '₿ Bitcoin', fund.bitcoin, NUKE_COST.bitcoin],
            ['jets', '✈️ Jets', fund.jets, NUKE_COST.jets],
          ] as [string, string, number, number][]).map(([key, label, current, required]) => (
            <div key={key} style={{
              fontSize: '10px',
              padding: '4px 8px',
              background: current >= required ? 'rgba(34,211,138,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${current >= required ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '4px',
              color: current >= required ? '#22d38a' : '#94a3b8',
            }}>
              {label}: {current.toLocaleString()}/{required.toLocaleString()} {current >= required ? '✓' : ''}
            </div>
          ))}
        </div>

        {/* Donate Controls */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={donateResource}
            onChange={(e) => setDonateResource(e.target.value as keyof NuclearFund)}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          >
            <option value="oil">Oil</option>
            <option value="scraps">Scraps</option>
            <option value="materialX">Material X</option>
            <option value="bitcoin">Bitcoin</option>
            <option value="jets">Jets (T6 Weapon)</option>
          </select>
          <input
            type="number"
            value={donateAmount}
            onChange={(e) => setDonateAmount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '70px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          />
          <button className="hud-btn-primary" onClick={handleDonate} style={{ fontSize: '10px', padding: '6px 12px' }}>
            DONATE
          </button>
        </div>
      </div>

      {/* ====== ACTIVE CYBER CAMPAIGNS ====== */}
      <div className="hud-card">
        <div className="hud-card__title">🖥️ ACTIVE CYBERWARFARE CAMPAIGNS</div>
        {myCampaigns.length === 0 ? (
          <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
            No active campaigns. Launch operations from the Cyberwarfare panel.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {myCampaigns.slice(0, 10).map(c => {
              const opDef = CYBER_OPERATIONS.find(op => op.id === c.operationType)
              const statusColors: Record<string, string> = {
                active: '#3b82f6',
                completed: '#22d38a',
                detected: '#f59e0b',
                failed: '#ef4444',
              }
              const timeLeft = c.expiresAt > Date.now()
                ? `${Math.round((c.expiresAt - Date.now()) / 60000)}min left`
                : 'Ended'

              return (
                <div key={c.id} style={{
                  padding: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>
                      {opDef?.icon} {opDef?.name}
                    </span>
                    <span style={{ fontSize: '9px', color: statusColors[c.status] || '#666', fontWeight: 700, textTransform: 'uppercase' }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                    Target: {c.targetCountry || c.targetRegion || c.targetPlayer || 'N/A'}
                    {c.duration > 0 && ` · ${timeLeft}`}
                    {c.wasDetected && ' · ⚠️ DETECTED'}
                  </div>
                  {c.invitedPlayers.length > 0 && (
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                      Team: {c.invitedPlayers.join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
