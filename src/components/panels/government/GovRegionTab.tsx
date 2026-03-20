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

  if (!myCountry) return <div className="gov-section"><p style={{ fontSize: '9px', color: '#3e4a5c' }}>Country not found.</p></div>

  const infra = [
    { key: 'portLevel' as const, label: 'Port', icon: '⚓', desc: 'Naval Strikes. +10% naval dmg, +5% crit.', color: '#0ea5e9' },
    { key: 'airportLevel' as const, label: 'Airport', icon: '✈️', desc: 'Air Strikes. Enables non-adjacent aerial ops.', color: '#a855f7' },
    { key: 'bunkerLevel' as const, label: 'Bunker', icon: '🛡️', desc: 'Defensive fortification. Harder to conquer.', color: '#22d38a' },
    { key: 'militaryBaseLevel' as const, label: 'Mil. Base', icon: '🏛️', desc: '+5-20% base damage to ALL units.', color: '#ef4444' },
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
    <>
      <div className="gov-section">
        <div className="gov-section__title">🏗️ INFRASTRUCTURE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {infra.map(inf => {
            const level = myCountry[inf.key], cost = upgradeCost(level)
            return (
              <div key={inf.key} className="gov-infra" style={{ borderColor: `${inf.color}20` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: inf.color }}>{inf.icon} {inf.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: inf.color, fontFamily: 'var(--font-display)' }}>Lv.{level}</span>
                </div>
                <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '4px' }}>{inf.desc}</div>
                <div style={{ fontSize: '8px', color: '#3e4a5c', marginBottom: '4px' }}>
                  ${cost.money.toLocaleString()} + {cost.oil} Oil + {cost.materialX} MatX
                </div>
                <button className="gov-btn" style={{ borderColor: `${inf.color}50`, color: inf.color, fontSize: '8px', padding: '3px 8px' }} onClick={() => handleUpgrade(inf.key)}>
                  UPGRADE → Lv.{level + 1}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="gov-section">
        <div className="gov-section__title gov-section__title--green">⛏️ STRATEGIC RESOURCES ({myCountry.conqueredResources?.length || 0})</div>
        {(myCountry.conqueredResources?.length || 0) > 0
          ? <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
              {myCountry.conqueredResources.map((r, i) => (
                <span key={i} style={{ fontSize: '8px', padding: '2px 6px', background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.15)', borderRadius: '3px', color: '#22d38a' }}>{r}</span>
              ))}
            </div>
          : <div style={{ fontSize: '9px', color: '#3e4a5c' }}>No strategic resources conquered.</div>
        }
      </div>
    </>
  )
}
