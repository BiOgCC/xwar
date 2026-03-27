import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useArmyStore } from '../../../stores/army'
import { useRegionStore } from '../../../stores/regionStore'
import ResourceIcon from '../../shared/ResourceIcon'
import { Download, Factory, Scroll, Store, Pickaxe, Upload, ShieldHalf, LayoutGrid, Flame } from 'lucide-react'

/** FINANCE tab — Income/spending breakdown, military stats */
export default function GovFinanceTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const armyStore = useArmyStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const country = world.getCountry(iso)

  const fund = country?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const vault = country?.forceVault ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }

  const countryDivs = (Object.values(armyStore.divisions) as any[]).filter(d => d.countryCode === iso)
  const readyDivs = countryDivs.filter(d => d.status === 'ready').length
  const inCombatDivs = countryDivs.filter(d => d.status === 'in_combat').length
  const trainingDivs = countryDivs.filter(d => d.status === 'training').length
  const divsOnSale = gov?.divisionShop?.length || 0

  const budgetPct = gov?.militaryBudgetPercent || 0
  const dailyBudget = Math.floor(fund.money * (budgetPct / 100))
  const perTickBudget = Math.floor(dailyBudget / 288)
  const countryArmies = (Object.values(armyStore.armies) as any[]).filter(a => a.countryCode === iso)

  const contracts = (govStore.militaryContracts as any[]).filter(c => c.countryCode === iso)
  const activeContracts = contracts.filter(c => c.status === 'locked')
  const claimableContracts = contracts.filter(c => c.status === 'claimable')
  const totalInvested = contracts.reduce((s: number, c: any) => s + (c.status === 'locked' ? c.investedAmount : 0), 0)
  const activeWars = world.wars.filter(w => w.status === 'active' && (w.attacker === iso || w.defender === iso))

  // Active deposits for this country
  const activeDeposits = world.deposits.filter(d => d.countryCode === iso && d.active)
  const DEPOSIT_COLORS: Record<string, string> = { wheat: '#facc15', fish: '#38bdf8', steak: '#f87171', oil: '#a855f7', materialx: '#ec4899' }

  const getTimeLeft = (expiresAt: number) => {
    const ms = expiresAt - Date.now()
    if (ms <= 0) return 'Expired'
    const hours = Math.floor(ms / 3600000)
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return days > 0 ? `${days}d ${remainingHours}h` : `${remainingHours}h`
  }

  const getRegionName = (regionId: string) => {
    const region = useRegionStore.getState().regions.find(r => r.id === regionId)
    return region?.name || regionId
  }

  return (
    <>
      {/* Income */}
      <div className="gov-section gov-section--highlight">
        <div className="gov-section__title gov-section__title--green" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={14} /> INCOME SOURCES</div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Factory size={12} color="#22d38a" /> Auto Income (8h)</span><span className="gov-stat-row__value" style={{ color: '#22d38a' }}>${Math.floor((country?.population ?? 0) * 0.1 * (1 + (country?.portLevel ?? 0) * 0.05 + (country?.airportLevel ?? 0) * 0.05 + (country?.militaryBaseLevel ?? 0) * 0.03 + (country?.bunkerLevel ?? 0) * 0.02)).toLocaleString()}</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ResourceIcon resourceKey="money" size={12} /> Work Tax (10%)</span><span className="gov-stat-row__value" style={{ color: '#22d38a' }}>Active</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Store size={12} color="#22d38a" /> Market Tax (5%)</span><span className="gov-stat-row__value" style={{ color: '#22d38a' }}>Active</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Download size={12} color="#60a5fa" /> Stock/Bond Revenue (30%)</span><span className="gov-stat-row__value" style={{ color: '#60a5fa' }}>Active</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Pickaxe size={12} color="#a855f7" /> Player Donations</span><span className="gov-stat-row__value" style={{ color: '#a855f7' }}>Open</span></div>
      </div>

      {/* Active Deposits */}
      <div className="gov-section" style={{ borderLeft: '3px solid #a855f7' }}>
        <div className="gov-section__title" style={{ color: '#a855f7', display: 'flex', alignItems: 'center', gap: '6px' }}><Pickaxe size={14} /> ACTIVE DEPOSITS ({activeDeposits.length}/3)</div>
        {activeDeposits.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '9px', padding: '4px 0' }}>No active deposits. Use a Prospection Center to discover deposits.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {activeDeposits.map(dep => (
              <div key={dep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', background: 'rgba(0,0,0,0.25)', borderRadius: '4px', borderLeft: `3px solid ${DEPOSIT_COLORS[dep.type] || '#a855f7'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'flex' }}><ResourceIcon resourceKey={dep.type} size={14} fallbackEmoji="⛏️" /></span>
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: DEPOSIT_COLORS[dep.type] || '#e2e8f0', textTransform: 'uppercase' }}>{dep.type}</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8' }}>📍 {getRegionName(dep.regionId)}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#22d38a' }}>+{dep.bonus}%</div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>⏳ {getTimeLeft(dep.expiresAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spending */}
      <div className="gov-section gov-section--red">
        <div className="gov-section__title gov-section__title--red" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={14} /> SPENDING</div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldHalf size={12} color="#ef4444" /> Infrastructure</span><span className="gov-stat-row__value" style={{ color: '#ef4444' }}>$500K–$1.5M/upgrade</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldHalf size={12} color="#f59e0b" /> Force Vault Transfers</span><span className="gov-stat-row__value" style={{ color: '#f59e0b' }}>${Number(vault.money).toLocaleString()} allocated</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><LayoutGrid size={12} color="#f59e0b" /> Army Salary Pools</span><span className="gov-stat-row__value" style={{ color: '#f59e0b' }}>{countryArmies.length} armies</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Flame size={12} color="#ef4444" /> Active Wars</span><span className="gov-stat-row__value" style={{ color: '#ef4444' }}>{activeWars.length} wars</span></div>
      </div>

      {/* Force Vault */}
      <div className="gov-section gov-section--amber">
        <div className="gov-section__title gov-section__title--amber" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ResourceIcon resourceKey="money" size={14} /> FORCE VAULT</div>
        <div className="gov-resource-grid" style={{ gap: '4px' }}>
          {([['money', 'Money', vault.money], ['oil', 'Oil', vault.oil], ['scrap', 'Scrap', vault.scrap],
            ['materialX', 'MatX', vault.materialX], ['bitcoin', 'BTC', vault.bitcoin], ['jets', 'Jets', vault.jets],
          ] as [string, string, number][]).map(([key, label, val]) => (
            <div key={label} className="gov-resource-cell">
              <span className="gov-resource-cell__icon" style={{ display: 'flex', marginBottom: '4px' }}><ResourceIcon resourceKey={key} size={20} /></span>
              <div className="gov-resource-cell__value" style={{ color: '#e2e8f0', fontSize: '10px' }}>{Number(val).toLocaleString()}</div>
              <div className="gov-resource-cell__label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Military Overview */}
      <div className="gov-section">
        <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldHalf size={14} color="#e2e8f0" /> MILITARY OVERVIEW</div>
        <div className="gov-stats-grid">
          {([
            ['Total Divisions', `${countryDivs.length}`, '#e2e8f0'],
            ['Ready', `${readyDivs}`, '#22d38a'],
            ['In Combat', `${inCombatDivs}`, '#ef4444'],
            ['Training', `${trainingDivs}`, '#f59e0b'],
            ['On Sale', `${divsOnSale}`, '#60a5fa'],
            ['Budget %', `${budgetPct}%`, '#3b82f6'],
            ['Armies', `${countryArmies.length}`, '#e2e8f0'],
            ['Contracts', `${contracts.length}`, '#f59e0b'],
          ] as [string, string, string][]).map(([label, val, color]) => (
            <div key={label} className="gov-stat-cell">
              <span className="gov-stat-cell__label">{label}</span>
              <span className="gov-stat-cell__value" style={{ color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contracts */}
      {contracts.length > 0 && (
        <div className="gov-section">
          <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Scroll size={14} color="#e2e8f0" /> CONTRACTS ({contracts.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {contracts.slice(0, 8).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: '3px', fontSize: '8px' }}>
                <span style={{ color: '#94a3b8' }}>{c.playerId}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>${c.investedAmount.toLocaleString()}</span>
                <span style={{ color: c.status === 'claimable' ? '#22d38a' : c.status === 'locked' ? '#f59e0b' : '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
