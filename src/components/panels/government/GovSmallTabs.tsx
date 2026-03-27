import { useState, useRef, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../../stores/governmentStore'
import type { NationalFundKey } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useCompanyStore } from '../../../stores/companyStore'
import { useBattleStore } from '../../../stores/battleStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useUIStore } from '../../../stores/uiStore'
import { useArmyStore } from '../../../stores/army'
import { useRegionStore } from '../../../stores/regionStore'
import ResourceIcon from '../../shared/ResourceIcon'
import { TrendingUp, Gift, Radio, Landmark, Users, Vote, Shield, Swords, Sword, Download, Factory, Scroll, Store, Pickaxe, Upload, ShieldHalf, LayoutGrid, Flame } from 'lucide-react'

/** Mini treasury balance chart */
function TreasuryChart({ iso }: { iso: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const world = useWorldStore()
  const [range, setRange] = useState<1 | 7>(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width = canvas.offsetWidth * 2
    const h = canvas.height = canvas.offsetHeight * 2
    ctx.clearRect(0, 0, w, h)

    const cutoff = Date.now() - range * 24 * 60 * 60 * 1000
    const data = world.fundHistory
      .filter(s => s.timestamp >= cutoff && s.funds[iso] !== undefined)
      .map(s => ({ t: s.timestamp, v: s.funds[iso] }))

    const current = world.getCountry(iso)?.fund.money ?? 0
    data.push({ t: Date.now(), v: current })

    if (data.length < 2) {
      ctx.font = `${16}px sans-serif`
      ctx.fillStyle = '#3e4a5c'
      ctx.textAlign = 'center'
      ctx.fillText('Not enough data yet', w / 2, h / 2)
      return
    }

    const values = data.map(d => d.v)
    const minV = Math.min(...values) * 0.9
    const maxV = Math.max(...values) * 1.1 || 1
    const timeMin = data[0].t, timeMax = data[data.length - 1].t, tr = timeMax - timeMin || 1
    const pad = { l: 10, r: 10, t: 10, b: 20 }
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) { const y = pad.t + (plotH * i) / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke() }

    ctx.strokeStyle = '#22d38a'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath()
    data.forEach((d, i) => {
      const x = pad.l + ((d.t - timeMin) / tr) * plotW, y = pad.t + plotH - ((d.v - minV) / (maxV - minV)) * plotH
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.lineTo(pad.l + ((data[data.length - 1].t - timeMin) / tr) * plotW, pad.t + plotH)
    ctx.lineTo(pad.l, pad.t + plotH); ctx.closePath()
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH)
    grad.addColorStop(0, 'rgba(34,211,138,0.12)'); grad.addColorStop(1, 'rgba(34,211,138,0)')
    ctx.fillStyle = grad; ctx.fill()

    ctx.font = `bold ${18}px sans-serif`; ctx.fillStyle = '#22d38a'; ctx.textAlign = 'right'
    ctx.fillText(`$${current.toLocaleString()}`, w - pad.r, pad.t + 18)
    ctx.font = `${12}px sans-serif`; ctx.fillStyle = '#3e4a5c'
    ctx.textAlign = 'left'; ctx.fillText(`$${Math.floor(minV / 0.9).toLocaleString()}`, pad.l, pad.t + plotH - 2)
    ctx.textAlign = 'right'; ctx.fillText(`$${Math.floor(maxV / 1.1).toLocaleString()}`, w - pad.r, pad.t + plotH - 2)
  }, [world.fundHistory, range, iso])

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span className="gov-section__title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={14} /> TREASURY BALANCE</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {([1, 7] as const).map(d => (
            <button key={d} onClick={() => setRange(d)} style={{
              padding: '2px 5px', fontSize: '7px', fontWeight: 700, border: 'none', borderRadius: '3px', cursor: 'pointer',
              background: range === d ? 'rgba(34,211,138,0.12)' : 'transparent', color: range === d ? '#22d38a' : '#3e4a5c',
            }}>{d}D</button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '75px', borderRadius: '3px', background: 'rgba(0,0,0,0.3)' }} />
    </div>
  )
}

/** ACCOUNT tab — Treasury chart + full finance breakdown */
export function GovAccountTab() {
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

  if (!gov) return null
  return (
    <>
      {/* Country Funds & Inventory */}
      <div className="gov-section gov-section--amber">
        <div className="gov-section__title gov-section__title--amber" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ResourceIcon resourceKey="money" size={14} /> COUNTRY FUNDS & INVENTORY</div>
        <div className="gov-resource-grid" style={{ gap: '4px' }}>
          {([['money', 'Money', fund.money], ['oil', 'Oil', fund.oil], ['scrap', 'Scrap', fund.scrap],
            ['materialX', 'MatX', fund.materialX], ['bitcoin', 'BTC', fund.bitcoin], ['jets', 'Jets', fund.jets],
          ] as [string, string, number][]).map(([key, label, val]) => (
            <div key={label} className="gov-resource-cell">
              <span className="gov-resource-cell__icon" style={{ display: 'flex', marginBottom: '4px' }}><ResourceIcon resourceKey={key} size={20} /></span>
              <div className="gov-resource-cell__value" style={{ color: '#e2e8f0', fontSize: '10px' }}>{Number(val).toLocaleString()}</div>
              <div className="gov-resource-cell__label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="gov-section">
        <TreasuryChart iso={iso} />
      </div>

      {/* Income */}
      <div className="gov-section gov-section--highlight">
        <div className="gov-section__title gov-section__title--green" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={14} /> INCOME SOURCES</div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Factory size={12} color="#22d38a" /> Auto Income (8h)</span><span className="gov-stat-row__value" style={{ color: '#22d38a' }}>${Math.floor((country?.population ?? 0) * 0.1 * (1 + (country?.portLevel ?? 0) * 0.05 + (country?.airportLevel ?? 0) * 0.05 + (country?.militaryBaseLevel ?? 0) * 0.03 + (country?.bunkerLevel ?? 0) * 0.02)).toLocaleString()}</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ResourceIcon resourceKey="money" size={12} /> Work Tax (10%)</span><span className="gov-stat-row__value" style={{ color: '#22d38a' }}>Active</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Store size={12} color="#22d38a" /> Market Tax (5%)</span><span className="gov-stat-row__value" style={{ color: '#22d38a' }}>Active</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={12} color="#60a5fa" /> Stock/Bond Revenue (30%)</span><span className="gov-stat-row__value" style={{ color: '#60a5fa' }}>Active</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Gift size={12} color="#a855f7" /> Player Donations</span><span className="gov-stat-row__value" style={{ color: '#a855f7' }}>Open</span></div>
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
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Landmark size={12} color="#ef4444" /> Infrastructure</span><span className="gov-stat-row__value" style={{ color: '#ef4444' }}>$500K–$1.5M/upgrade</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShieldHalf size={12} color="#f59e0b" /> Force Vault Transfers</span><span className="gov-stat-row__value" style={{ color: '#f59e0b' }}>${Number(vault.money).toLocaleString()} allocated</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><LayoutGrid size={12} color="#f59e0b" /> Army Salary Pools</span><span className="gov-stat-row__value" style={{ color: '#f59e0b' }}>{countryArmies.length} armies</span></div>
        <div className="gov-stat-row"><span className="gov-stat-row__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Flame size={12} color="#ef4444" /> Active Wars</span><span className="gov-stat-row__value" style={{ color: '#ef4444' }}>{activeWars.length} wars</span></div>
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

/** CITIZENSHIP tab */
export function GovCitizenshipTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    govStore.fetchCitizens(iso).finally(() => setLoading(false))
  }, [iso])

  if (!gov) return null

  const roleColors: Record<string, string> = {
    president: '#22d38a',
    vicepresident: '#a78bfa',
    defense_minister: '#f59e0b',
    eco_minister: '#38bdf8',
    congress: '#38bdf8',
    citizen: '#64748b',
  }
  const roleLabel: Record<string, string> = {
    president: 'PRESIDENT',
    vicepresident: 'VICE PRES',
    defense_minister: 'DEF. MIN',
    eco_minister: 'ECO. MIN',
    congress: 'CONGRESS',
    citizen: 'CITIZEN',
  }

  return (
    <>
      <div className="gov-section">
        <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> CITIZENS ({gov.citizens.length})</div>
        {loading ? (
          <p style={{ fontSize: '9px', color: '#475569', textAlign: 'center', padding: '12px 0' }}>Loading citizens...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[...gov.citizens].sort((a, b) => b.level - a.level).map(c => (
              <div key={c.id} className={`gov-citizen ${c.role === 'president' ? 'gov-citizen--president' : c.role === 'congress' ? 'gov-citizen--congress' : ''}`}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#e2e8f0' }}>{c.name}</span>
                  <span style={{ fontSize: '7px', color: roleColors[c.role] || '#64748b', marginLeft: '5px', textTransform: 'uppercase', fontWeight: 700 }}>{roleLabel[c.role] || c.role}</span>
                </div>
                <span style={{ fontSize: '9px', color: '#475569', fontFamily: 'var(--font-display)' }}>Lv.{c.level}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="gov-btn gov-btn--green" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => {
        govStore.registerCandidate(iso, player.name, player.name)
        ui.addFloatingText('REGISTERED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
      }}><Vote size={14} /> RUN FOR OFFICE</button>
    </>
  )
}

/** WAR tab */
export function GovWarTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const armyStore = useArmyStore()
  const iso = player.countryCode || 'US'
  const wars = world.wars?.filter(w => (w.attacker === iso || w.defender === iso) && w.status === 'active') || []
  const battles = Object.values(useBattleStore.getState().battles).filter(b => b.attackerId === iso || b.defenderId === iso)

  // Autodefense slider state
  const countryDivs = Object.values(armyStore.divisions).filter((d: any) => d.countryCode === iso && d.status === 'ready')
  const maxDivs = countryDivs.length
  const currentLimit = govStore.autoDefenseLimit // -1 = all, 0 = off, N = cap
  // Slider value: 0 = off, 1..maxDivs = N, maxDivs+1 = ALL (-1)
  const sliderVal = currentLimit === -1 ? maxDivs + 1 : currentLimit
  const sliderLabel = currentLimit === -1 ? 'ALL' : currentLimit === 0 ? 'OFF' : `${currentLimit}`
  const sliderColor = currentLimit === 0 ? '#ef4444' : currentLimit === -1 ? '#22d38a' : '#3b82f6'

  const handleSlider = (val: number) => {
    if (val > maxDivs) govStore.setAutoDefenseLimit(-1)
    else govStore.setAutoDefenseLimit(val)
  }

  return (
    <>
      {/* Country Autodefense Card */}
      <div className="gov-section gov-section--highlight" style={{ borderLeft: `3px solid ${sliderColor}` }}>
        <div className="gov-section__title" style={{ color: sliderColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={14} color={sliderColor} /> COUNTRY AUTODEFENSE
        </div>
        <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '8px' }}>
          Set how many divisions auto-deploy when your country is attacked. Armed Forces always deploy regardless.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="range"
            min={0}
            max={maxDivs + 1}
            value={sliderVal}
            onChange={e => handleSlider(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: sliderColor, cursor: 'pointer' }}
          />
          <div style={{
            minWidth: '42px', textAlign: 'center', padding: '4px 8px', borderRadius: '4px',
            fontSize: '11px', fontWeight: 900, letterSpacing: '0.5px',
            background: `${sliderColor}18`, border: `1px solid ${sliderColor}40`, color: sliderColor,
          }}>
            {sliderLabel}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: '#475569', marginTop: '3px' }}>
          <span>OFF</span>
          <span>{maxDivs} div{maxDivs !== 1 ? 's' : ''} ready</span>
          <span>ALL</span>
        </div>
      </div>

      <div className="gov-section">
        <div className="gov-section__title gov-section__title--red" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Swords size={14} color="#ef4444" /> ACTIVE WARS</div>
        {wars.length === 0 && battles.length === 0
          ? <p style={{ fontSize: '9px', color: '#3e4a5c' }}>No active wars or battles.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {wars.map(w => (
                <div key={w.id} style={{ padding: '6px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {w.attacker === iso ? <><Sword size={12}/> ATTACKING {w.defender}</> : <><Shield size={12}/> DEFENDING VS {w.attacker}</>}
                  </div>
                  <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px' }}>
                    {w.status.toUpperCase()} · {Math.floor((Date.now() - w.startedAt) / 86400000)}d ago
                  </div>
                </div>
              ))}
              {battles.map(b => {
                const side = b.attackerId === iso ? 'ATK' : 'DEF'
                return (
                  <div key={b.id} style={{ padding: '6px', background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8' }}>{b.regionName} — {side}</span>
                      <span style={{ fontSize: '8px', color: b.status === 'active' ? '#22d38a' : '#475569', textTransform: 'uppercase', fontWeight: 700 }}>{b.status}</span>
                    </div>
                    <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px' }}>Rounds: {b.attackerRoundsWon}–{b.defenderRoundsWon}</div>
                  </div>
                )
              })}
            </div>
        }
      </div>
    </>
  )
}
