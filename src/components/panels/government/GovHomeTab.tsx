import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useArmyStore } from '../../../stores/army'
import { useMilitaryStore } from '../../../stores/militaryStore'
import { useCyberStore } from '../../../stores/cyberStore'

/** HOME tab — Country overview dashboard */
export default function GovHomeTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const gov = useGovernmentStore().governments[player.countryCode || 'US']
  const iso = player.countryCode || 'US'
  const fund = world.getCountry(iso)?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const myCountry = world.countries.find(c => c.code === iso)

  const activeWars = world.wars.filter(w => w.status === 'active' && (w.attacker === (myCountry?.name || '') || w.defender === (myCountry?.name || '')))
  const alliances = gov?.alliances || []
  const activeMilCampaigns = Object.values(useMilitaryStore.getState().campaigns).filter((c: any) => c.status === 'launched' || c.status === 'recruiting')
  const activeCyberCampaigns = Object.values(useCyberStore.getState().campaigns).filter((c: any) => c.status === 'active' || c.status === 'in_progress')

  const armyStore = useArmyStore.getState()
  const { used: popUsed, max: popMax } = armyStore.getCountryPopCap(iso)
  const popPct = popMax > 0 ? Math.min(100, Math.round((popUsed / popMax) * 100)) : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 70 ? '#f59e0b' : '#22d38a'

  return (
    <>
      {/* National Fund */}
      <div className="gov-section gov-section--highlight">
        <div className="gov-section__title gov-section__title--green">🏦 NATIONAL TREASURY</div>
        <div className="gov-resource-grid">
          {([['💵', 'Money', fund.money], ['🛢️', 'Oil', fund.oil], ['🔩', 'Scrap', fund.scrap],
            ['⚛️', 'MatX', fund.materialX], ['₿', 'BTC', fund.bitcoin], ['✈️', 'Jets', fund.jets],
          ] as [string, string, number][]).map(([icon, label, val]) => (
            <div key={label} className="gov-resource-cell">
              <span className="gov-resource-cell__icon">{icon}</span>
              <div className="gov-resource-cell__value">{val.toLocaleString()}</div>
              <div className="gov-resource-cell__label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pop Cap */}
      <div className="gov-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="gov-section__title" style={{ marginBottom: 0 }}>🏠 POP CAP</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: popColor, fontFamily: 'var(--font-display)' }}>{popUsed}/{popMax} ({popPct}%)</span>
        </div>
        <div className="gov-progress">
          <div className="gov-progress__fill" style={{ width: `${popPct}%`, background: popColor }} />
        </div>
      </div>

      {/* Active Wars */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--red">⚔️ ACTIVE WARS ({activeWars.length})</div>
        {activeWars.length === 0
          ? <div style={{ fontSize: '9px', color: '#3e4a5c' }}>No active wars.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {activeWars.map(w => (
                <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '4px 6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '3px' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{w.attacker} ⚔️ {w.defender}</span>
                  <span style={{ color: '#475569' }}>{Math.floor((Date.now() - w.startedAt) / 86400000)}d</span>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Sworn Enemy */}
      <div className="gov-section">
        <div className="gov-section__title">🎯 SWORN ENEMY</div>
        {gov?.swornEnemy
          ? <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.12)' }}>
              💀 {gov.swornEnemy} — {world.countries.find(c => c.code === gov.swornEnemy)?.name || gov.swornEnemy}
            </div>
          : <div style={{ fontSize: '9px', color: '#3e4a5c' }}>None declared.</div>
        }
      </div>

      {/* Alliances */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--blue">🤝 ALLIANCES ({alliances.length})</div>
        {alliances.length === 0
          ? <div style={{ fontSize: '9px', color: '#3e4a5c' }}>No active alliances.</div>
          : <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
              {alliances.map(a => (
                <span key={a} style={{ fontSize: '8px', padding: '3px 6px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '3px', color: '#3b82f6', fontWeight: 600 }}>
                  🏳️ {a}
                </span>
              ))}
            </div>
        }
      </div>

      {/* Operations */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--purple">🔒 ACTIVE OPS ({activeMilCampaigns.length + activeCyberCampaigns.length})</div>
        {activeMilCampaigns.length + activeCyberCampaigns.length === 0
          ? <div style={{ fontSize: '9px', color: '#3e4a5c' }}>No active operations.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {activeMilCampaigns.map((c: any) => (
                <div key={c.id} style={{ fontSize: '9px', padding: '3px 6px', background: 'rgba(239,68,68,0.04)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.1)', color: '#fca5a5' }}>
                  🎖️ {(c.operationId || '').replace(/_/g, ' ').toUpperCase()}
                </div>
              ))}
              {activeCyberCampaigns.map((c: any) => (
                <div key={c.id} style={{ fontSize: '9px', padding: '3px 6px', background: 'rgba(139,92,246,0.04)', borderRadius: '3px', border: '1px solid rgba(139,92,246,0.1)', color: '#c4b5fd' }}>
                  🖥️ {(c.operationType || '').replace(/_/g, ' ').toUpperCase()}
                </div>
              ))}
            </div>
        }
      </div>
    </>
  )
}
