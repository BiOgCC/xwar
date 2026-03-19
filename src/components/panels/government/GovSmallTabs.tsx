import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../../stores/governmentStore'
import type { NationalFundKey } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useCompanyStore } from '../../../stores/companyStore'
import { useBattleStore } from '../../../stores/battleStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useUIStore } from '../../../stores/uiStore'

const ss: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', width: '100%' }

/** ACCOUNT tab — National fund, donate, nuke, congress */
export function GovAccountTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const companyStore = useCompanyStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const fund = world.getCountry(iso)?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const [donateResource, setDonateResource] = useState<NationalFundKey>('oil')
  const [donateAmount, setDonateAmount] = useState(100)
  const [nukeTarget, setNukeTarget] = useState('')

  const handleDonate = () => {
    const p = usePlayerStore.getState()
    const resourceMap: Record<NationalFundKey, number> = { money: p.money, oil: p.oil, scrap: p.scrap, materialX: p.materialX, bitcoin: p.bitcoin, jets: 0 }
    if (donateResource === 'jets') { const inv = useInventoryStore.getState(); resourceMap.jets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped).length }
    if (resourceMap[donateResource] < donateAmount) { ui.addFloatingText('NOT ENOUGH', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    if (donateResource === 'money') p.spendMoney(donateAmount)
    else if (donateResource === 'oil') p.spendOil(donateAmount)
    else if (donateResource === 'scrap') p.spendScrap(donateAmount)
    else if (donateResource === 'materialX') p.spendMaterialX(donateAmount)
    else if (donateResource === 'bitcoin') p.spendBitcoin(donateAmount)
    else if (donateResource === 'jets') { const inv = useInventoryStore.getState(); const jets = inv.items.filter(i => i.location === 'inventory' && i.tier === 't6' && i.slot === 'weapon' && !i.equipped); for (let i = 0; i < Math.min(donateAmount, jets.length); i++) inv.removeItem(jets[i].id) }
    govStore.donateToFund(iso, donateResource, donateAmount)
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
      <div className="hud-card">
        <div className="hud-card__title">🏦 NATIONAL FUND</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', margin: '8px 0' }}>
          {([['money','💵',fund.money],['oil','🛢️',fund.oil],['scrap','🔩',fund.scrap],['materialX','⚛️',fund.materialX],['bitcoin','₿',fund.bitcoin],['jets','✈️',fund.jets]] as [string,string,number][]).map(([key,icon,val]) => (
            <div key={key} style={{ fontSize: '10px', padding: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px' }}>{icon}</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>{val.toLocaleString()}</div>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase' }}>{key}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <select value={donateResource} onChange={e => setDonateResource(e.target.value as NationalFundKey)} style={{ ...ss, width: 'auto', flex: 1 }}>
            <option value="money">Money</option><option value="oil">Oil</option><option value="scrap">Scraps</option>
            <option value="materialX">Material X</option><option value="bitcoin">Bitcoin</option><option value="jets">Jets (T6)</option>
          </select>
          <input type="number" value={donateAmount} onChange={e => setDonateAmount(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...ss, width: '70px' }} />
          <button className="hud-btn-primary" onClick={handleDonate} style={{ fontSize: '9px', padding: '6px 10px' }}>DONATE</button>
        </div>
      </div>

      <div className="hud-card" style={{ borderColor: gov.nuclearAuthorized ? '#ef4444' : '#333' }}>
        <div className="hud-card__title" style={{ color: gov.nuclearAuthorized ? '#ef4444' : '#555' }}>☢️ NUCLEAR STRIKE</div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <select value={nukeTarget} onChange={e => setNukeTarget(e.target.value)} disabled={!gov.nuclearAuthorized} style={{ ...ss, flex: 1 }}>
            <option value="" disabled>Target...</option>
            {world.countries.filter(c => c.code !== iso).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <button onClick={handleNuke} disabled={!gov.nuclearAuthorized || !nukeTarget} style={{
            padding: '6px 16px', fontWeight: 900, fontSize: '12px', border: '2px solid',
            borderRadius: '3px', cursor: gov.nuclearAuthorized ? 'pointer' : 'not-allowed',
            background: gov.nuclearAuthorized ? '#dc2626' : '#333', color: gov.nuclearAuthorized ? '#fff' : '#666',
            borderColor: gov.nuclearAuthorized ? '#ef4444' : '#444',
          }}>☢️ NUKE</button>
        </div>
        {!gov.nuclearAuthorized && <p style={{ fontSize: '8px', color: '#555', marginTop: '4px' }}>Requires law authorization + funded program</p>}
      </div>

      <div className="hud-card">
        <div className="hud-card__title">🏛️ CONGRESS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
          {gov.congress.map((m, i) => <div key={i} style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>{m}</div>)}
        </div>
      </div>
    </>
  )
}

/** CITIZENSHIP tab — Citizens list + run for office */
export function GovCitizenshipTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  if (!gov) return null
  return (
    <div className="hud-card">
      <div className="hud-card__title">👥 CITIZENS ({gov.citizens.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '8px' }}>
        {[...gov.citizens].sort((a, b) => b.level - a.level).map(c => {
          const roleColors: Record<string, string> = { president: '#22d38a', congress: '#38bdf8', citizen: '#94a3b8' }
          return (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px', borderLeft: `3px solid ${roleColors[c.role] || '#333'}` }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>{c.name}</span>
                <span style={{ fontSize: '9px', color: roleColors[c.role], marginLeft: '6px', textTransform: 'uppercase', fontWeight: 700 }}>{c.role}</span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Lv.{c.level}</span>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '8px' }}>
        <button className="hud-btn-outline" onClick={() => { govStore.registerCandidate(iso, player.name, player.name); ui.addFloatingText('REGISTERED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a') }} style={{ fontSize: '10px' }}>
          🗳️ RUN FOR OFFICE
        </button>
      </div>
    </div>
  )
}

/** WAR tab — Active wars and battles */
export function GovWarTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const iso = player.countryCode || 'US'
  const wars = world.wars?.filter(w => (w.attacker === iso || w.defender === iso) && w.status === 'active') || []
  const battles = Object.values(useBattleStore.getState().battles).filter(b => b.attackerId === iso || b.defenderId === iso)
  return (
    <div className="hud-card">
      <div className="hud-card__title">⚔️ ACTIVE WARS</div>
      {wars.length === 0 && battles.length === 0 ? <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>No active wars or battles.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {wars.map(w => (
            <div key={w.id} style={{ padding: '8px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>{w.attacker === iso ? `🗡️ ATTACKING ${w.defender}` : `🛡️ DEFENDING VS ${w.attacker}`}</div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Status: {w.status.toUpperCase()} · Since: {new Date(w.startedAt).toLocaleDateString()}</div>
            </div>
          ))}
          {battles.map(b => {
            const side = b.attackerId === iso ? 'ATTACKER' : 'DEFENDER'
            return (
              <div key={b.id} style={{ padding: '8px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>{b.regionName} — {side}</span>
                  <span style={{ fontSize: '9px', color: b.status === 'active' ? '#22d38a' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>{b.status}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Rounds: {b.attackerRoundsWon}–{b.defenderRoundsWon}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
