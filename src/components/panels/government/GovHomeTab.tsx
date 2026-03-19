import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useArmyStore } from '../../../stores/army'
import { useMilitaryStore } from '../../../stores/militaryStore'
import { useCyberStore } from '../../../stores/cyberStore'

/** HOME tab — National fund summary, pop cap, wars, enemy, alliances, operations */
export default function GovHomeTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const gov = useGovernmentStore().governments[player.countryCode || 'US']
  const iso = player.countryCode || 'US'
  const fund = world.getCountry(iso)?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }

  const myCountry = world.countries.find(c => c.code === iso)
  const activeWars = world.wars.filter(w => w.status === 'active' && (w.attacker === (myCountry?.name || '') || w.defender === (myCountry?.name || '')))
  const alliances = gov?.alliances || []
  const milState = useMilitaryStore.getState()
  const cyberState = useCyberStore.getState()
  const activeMilCampaigns = Object.values(milState.campaigns).filter((c: any) => c.status === 'launched' || c.status === 'recruiting')
  const activeCyberCampaigns = Object.values(cyberState.campaigns).filter((c: any) => c.status === 'active' || c.status === 'in_progress')

  const ss: React.CSSProperties = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '8px', marginBottom: '6px' }
  const ls: React.CSSProperties = { fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' as const }

  const armyStore = useArmyStore.getState()
  const { used: popUsed, max: popMax } = armyStore.getCountryPopCap(iso)
  const popPct = popMax > 0 ? Math.min(100, Math.round((popUsed / popMax) * 100)) : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 70 ? '#f59e0b' : '#22d38a'

  return (
    <>
      {/* National Fund Summary Grid */}
      <div style={ss}>
        <div style={ls}>🏦 NATIONAL FUND</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          {([['💵','Money',fund.money],['🛢️','Oil',fund.oil],['🔩','Scraps',fund.scrap],['⚛️','MatX',fund.materialX],['₿','BTC',fund.bitcoin],['✈️','Jets',fund.jets]] as [string,string,number][]).map(([icon,label,val]) => (
            <div key={label} style={{ textAlign: 'center', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '12px' }}>{icon}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>{val.toLocaleString()}</div>
              <div style={{ fontSize: '7px', color: '#475569' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pop Cap */}
      <div style={ss}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ ...ls, marginBottom: 0 }}>🏠 POP CAP</span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: popColor }}>{popUsed}/{popMax} ({popPct}%)</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${popPct}%`, background: popColor, borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Active Wars */}
      <div style={ss}>
        <div style={ls}>⚔️ ACTIVE WARS ({activeWars.length})</div>
        {activeWars.length === 0 ? <div style={{ fontSize: '10px', color: '#475569' }}>No active wars.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {activeWars.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '4px 6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px' }}>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{w.attacker} ⚔️ {w.defender}</span>
                <span style={{ color: '#64748b' }}>{Math.floor((Date.now() - w.startedAt) / 86400000)}d ago</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sworn Enemy */}
      <div style={ss}>
        <div style={ls}>🎯 SWORN ENEMY</div>
        {gov?.swornEnemy ? (
          <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)' }}>
            💀 {gov.swornEnemy} — {world.countries.find(c => c.code === gov.swornEnemy)?.name || gov.swornEnemy}
          </div>
        ) : <div style={{ fontSize: '10px', color: '#475569' }}>None declared.</div>}
      </div>

      {/* Alliances */}
      <div style={ss}>
        <div style={ls}>🤝 ALLIANCES ({alliances.length})</div>
        {alliances.length === 0 ? <div style={{ fontSize: '10px', color: '#475569' }}>No active alliances.</div> : (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {alliances.map(a => (
              <span key={a} style={{ fontSize: '10px', padding: '3px 8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '3px', color: '#3b82f6', fontWeight: 600 }}>
                🏳️ {a} — {world.countries.find(c => c.code === a)?.name || a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Active Operations */}
      <div style={ss}>
        <div style={ls}>🔒 ACTIVE OPERATIONS ({activeMilCampaigns.length + activeCyberCampaigns.length})</div>
        {activeMilCampaigns.length + activeCyberCampaigns.length === 0 ? <div style={{ fontSize: '10px', color: '#475569' }}>No active operations.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {activeMilCampaigns.map((c: any) => (
              <div key={c.id} style={{ fontSize: '10px', padding: '3px 6px', background: 'rgba(239,68,68,0.06)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                🎖️ {(c.operationId || '').replace(/_/g, ' ').toUpperCase()}
              </div>
            ))}
            {activeCyberCampaigns.map((c: any) => (
              <div key={c.id} style={{ fontSize: '10px', padding: '3px 6px', background: 'rgba(139,92,246,0.06)', borderRadius: '3px', border: '1px solid rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                🖥️ {(c.operationType || '').replace(/_/g, ' ').toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
