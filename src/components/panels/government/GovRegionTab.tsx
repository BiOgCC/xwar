import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'

/** REGION/DEFENSE tab — Infrastructure upgrades + strategic resources */
export default function GovRegionTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const fund = world.getCountry(iso)?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const myCountry = world.countries.find(c => c.code === iso)

  if (!myCountry) return <div className="hud-card"><p style={{ fontSize: '10px', color: '#555' }}>Country not found.</p></div>

  const infra = [
    { key: 'portLevel' as const, label: 'Port', icon: '⚓', desc: 'Required for Naval Strikes. +10% naval dmg, +5% crit.', color: '#0ea5e9' },
    { key: 'airportLevel' as const, label: 'Airport', icon: '✈️', desc: 'Required for Air Strikes. Enables non-adjacent aerial ops.', color: '#a855f7' },
    { key: 'bunkerLevel' as const, label: 'Bunker', icon: '🛡️', desc: 'Defensive fortification. Harder to conquer.', color: '#22d38a' },
    { key: 'militaryBaseLevel' as const, label: 'Military Base', icon: '🏛️', desc: '+5-20% base damage to ALL units from this country.', color: '#ef4444' },
  ]

  const upgradeCost = (level: number) => ({ money: level * 5000, oil: level * 500, materialX: level * 200 })

  const handleUpgrade = (key: typeof infra[number]['key']) => {
    const level = myCountry[key]
    const cost = upgradeCost(level)
    if (fund.money < cost.money || fund.oil < cost.oil || fund.materialX < cost.materialX) {
      ui.addFloatingText('FUND INSUFFICIENT', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return
    }
    govStore.spendFromFund(iso, { money: cost.money, oil: cost.oil, materialX: cost.materialX })
    useWorldStore.setState(s => ({ countries: s.countries.map(c => c.code === iso ? { ...c, [key]: c[key] + 1 } : c) }))
    ui.addFloatingText(`${key.replace('Level', '').toUpperCase()} UPGRADED!`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  return (
    <div className="hud-card">
      <div className="hud-card__title">🏗️ REGION INFRASTRUCTURE</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
        {infra.map(inf => {
          const level = myCountry[inf.key]
          const cost = upgradeCost(level)
          return (
            <div key={inf.key} style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', border: `1px solid ${inf.color}33`, borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: inf.color }}>{inf.icon} {inf.label}</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: inf.color }}>Lv.{level}</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>{inf.desc}</div>
              <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '6px' }}>
                Upgrade: ${cost.money.toLocaleString()} + {cost.oil} Oil + {cost.materialX} MatX (from National Fund)
              </div>
              <button className="hud-btn-outline" onClick={() => handleUpgrade(inf.key)}
                style={{ fontSize: '9px', padding: '3px 10px', borderColor: inf.color, color: inf.color }}
              >UPGRADE TO Lv.{level + 1}</button>
            </div>
          )
        })}

        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '8px' }}>STRATEGIC RESOURCES ({myCountry.conqueredResources?.length || 0})</div>
        {(myCountry.conqueredResources?.length || 0) > 0 ? (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {myCountry.conqueredResources.map((r, i) => (
              <span key={i} style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '3px', color: '#22d38a' }}>{r}</span>
            ))}
          </div>
        ) : <p style={{ fontSize: '10px', color: '#555' }}>No strategic resources conquered.</p>}
      </div>
    </div>
  )
}
