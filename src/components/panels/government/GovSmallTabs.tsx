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

/** Mini treasury balance chart */
function TreasuryChart({ iso }: { iso: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const world = useWorldStore()
  const [range, setRange] = useState<30 | 60 | 180>(30)

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
        <span className="gov-section__title" style={{ marginBottom: 0 }}>📈 TREASURY BALANCE</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {([30, 60, 180] as const).map(d => (
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

/** ACCOUNT tab */
export function GovAccountTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const companyStore = useCompanyStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const country = world.getCountry(iso)
  const fund = country?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const vault = country?.forceVault ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const [donateResource, setDonateResource] = useState<NationalFundKey>('oil')
  const [donateAmount, setDonateAmount] = useState(100)
  const [nukeTarget, setNukeTarget] = useState('')

  const armyStore = useArmyStore()
  const countryDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const divsOnSale = gov?.divisionShop?.length || 0

  const handleDonate = () => {
    if (donateResource === 'jets') {
      const inv = useInventoryStore.getState()
      const jets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      if (jets.length < donateAmount) { ui.addFloatingText('NOT ENOUGH JETS', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
      for (let i = 0; i < Math.min(donateAmount, jets.length); i++) inv.removeItem(jets[i].id)
      useWorldStore.getState().addToFund(iso, 'jets', donateAmount)
      ui.addFloatingText(`DONATED ${donateAmount} JETS`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
      return
    }
    const ok = govStore.donateToFund(iso, donateResource, donateAmount)
    if (!ok) { ui.addFloatingText('NOT ENOUGH', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    ui.addFloatingText(`DONATED ${donateAmount} ${donateResource.toUpperCase()}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  const handleNuke = () => {
    if (!gov?.nuclearAuthorized || !nukeTarget) return
    govStore.launchNuke(iso, nukeTarget)
    const battleStore = useBattleStore.getState()
    const tc = world.getCountry(nukeTarget)
    if (tc) {
      let battle = Object.values(battleStore.battles).find(b => b.regionName === tc.name && b.status === 'active')
      if (!battle) { battleStore.launchAttack(iso, nukeTarget, tc.name); battle = Object.values(useBattleStore.getState().battles).find(b => b.regionName === tc.name && b.status === 'active') }
      if (battle) battleStore.addDamage(battle.id, 'attacker', 1000000, false, false, `☢️ NUKE from ${iso}`)
    }
    const disabled = companyStore.nukeCountry(nukeTarget)
    ui.addFloatingText(`☢️ NUKED ${nukeTarget}! ${disabled} disabled`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
  }

  if (!gov) return null
  return (
    <>
      {/* National Fund */}
      <div className="gov-section gov-section--highlight">
        <div className="gov-section__title gov-section__title--green">🏦 NATIONAL FUND</div>
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

      {/* Chart */}
      <div className="gov-section">
        <TreasuryChart iso={iso} />
      </div>

      {/* Force Vault */}
      <div className="gov-section gov-section--amber">
        <div className="gov-section__title gov-section__title--amber">💰 FORCE VAULT</div>
        <div className="gov-resource-grid">
          {([['🪙', 'Money', vault.money], ['🛢️', 'Oil', vault.oil], ['🔩', 'Scrap', vault.scrap],
            ['⚛️', 'MatX', vault.materialX], ['₿', 'BTC', vault.bitcoin], ['✈️', 'Jets', vault.jets],
          ] as [string, string, number][]).map(([icon, label, val]) => (
            <div key={label} className="gov-resource-cell">
              <span className="gov-resource-cell__icon">{icon}</span>
              <div className="gov-resource-cell__value" style={{ color: '#fbbf24' }}>{Number(val).toLocaleString()}</div>
              <div className="gov-resource-cell__label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Military Stats */}
      <div className="gov-section">
        <div className="gov-section__title">⚔️ MILITARY STATS</div>
        <div className="gov-stats-grid">
          {([
            ['🎖️ Budget', `${gov?.militaryBudgetPercent || 0}%`, '#3b82f6'],
            ['⚔️ Divisions', `${countryDivs.length}`, '#e2e8f0'],
            ['🏪 On Sale', `${divsOnSale}`, '#f59e0b'],
            ['💰 Vault $', `${vault.money.toLocaleString()}`, '#22d38a'],
          ] as [string, string, string][]).map(([label, val, color]) => (
            <div key={label} className="gov-stat-cell">
              <span className="gov-stat-cell__label">{label}</span>
              <span className="gov-stat-cell__value" style={{ color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Donate */}
      <div className="gov-section">
        <div className="gov-section__title">🎁 DONATE TO FUND</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select className="gov-select" style={{ flex: 1 }} value={donateResource} onChange={e => setDonateResource(e.target.value as NationalFundKey)}>
            <option value="money">Money</option><option value="oil">Oil</option><option value="scrap">Scraps</option>
            <option value="materialX">Material X</option><option value="bitcoin">Bitcoin</option><option value="jets">Jets (T6)</option>
          </select>
          <input className="gov-input" type="number" value={donateAmount} onChange={e => setDonateAmount(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '60px' }} />
          <button className="gov-btn gov-btn--fill-green" onClick={handleDonate}>DONATE</button>
        </div>
      </div>

      {/* Nuclear Strike */}
      <div className="gov-section gov-section--red" style={{ opacity: gov.nuclearAuthorized ? 1 : 0.5 }}>
        <div className="gov-section__title gov-section__title--red">☢️ NUCLEAR STRIKE</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <select className="gov-select" style={{ flex: 1 }} value={nukeTarget} onChange={e => setNukeTarget(e.target.value)} disabled={!gov.nuclearAuthorized}>
            <option value="" disabled>Target...</option>
            {world.countries.filter(c => c.code !== iso).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <button className="gov-btn gov-btn--red" onClick={handleNuke} disabled={!gov.nuclearAuthorized || !nukeTarget} style={{ fontWeight: 900 }}>☢️ NUKE</button>
        </div>
        {!gov.nuclearAuthorized && <p style={{ fontSize: '7px', color: '#3e4a5c', marginTop: '4px' }}>Requires law authorization + funded program</p>}
      </div>

      {/* Congress */}
      <div className="gov-section">
        <div className="gov-section__title">🏛️ CONGRESS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {gov.congress.map((m, i) => (
            <div key={i} className={`gov-citizen ${i === 0 ? 'gov-citizen--president' : 'gov-citizen--congress'}`}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#e2e8f0' }}>{m}</span>
              <span style={{ fontSize: '8px', color: '#475569' }}>{i === 0 ? 'LEADER' : `SEAT ${i}`}</span>
            </div>
          ))}
        </div>
      </div>
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
  if (!gov) return null

  const roleColors: Record<string, string> = { president: '#22d38a', congress: '#38bdf8', citizen: '#64748b' }

  return (
    <>
      <div className="gov-section">
        <div className="gov-section__title">👥 CITIZENS ({gov.citizens.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {[...gov.citizens].sort((a, b) => b.level - a.level).map(c => (
            <div key={c.id} className={`gov-citizen ${c.role === 'president' ? 'gov-citizen--president' : c.role === 'congress' ? 'gov-citizen--congress' : ''}`}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#e2e8f0' }}>{c.name}</span>
                <span style={{ fontSize: '7px', color: roleColors[c.role], marginLeft: '5px', textTransform: 'uppercase', fontWeight: 700 }}>{c.role}</span>
              </div>
              <span style={{ fontSize: '9px', color: '#475569', fontFamily: 'var(--font-display)' }}>Lv.{c.level}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="gov-btn gov-btn--green" style={{ width: '100%' }} onClick={() => {
        govStore.registerCandidate(iso, player.name, player.name)
        ui.addFloatingText('REGISTERED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
      }}>🗳️ RUN FOR OFFICE</button>
    </>
  )
}

/** WAR tab */
export function GovWarTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const iso = player.countryCode || 'US'
  const wars = world.wars?.filter(w => (w.attacker === iso || w.defender === iso) && w.status === 'active') || []
  const battles = Object.values(useBattleStore.getState().battles).filter(b => b.attackerId === iso || b.defenderId === iso)

  return (
    <>
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--red">⚔️ ACTIVE WARS</div>
        {wars.length === 0 && battles.length === 0
          ? <p style={{ fontSize: '9px', color: '#3e4a5c' }}>No active wars or battles.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {wars.map(w => (
                <div key={w.id} style={{ padding: '6px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: '3px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444' }}>
                    {w.attacker === iso ? `🗡️ ATTACKING ${w.defender}` : `🛡️ DEFENDING VS ${w.attacker}`}
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
