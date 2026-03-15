import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../stores/governmentStore'
import type { LawType, NationalFundKey } from '../../stores/governmentStore'
import { useWorldStore } from '../../stores/worldStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useBattleStore } from '../../stores/battleStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'
import { useMilitaryStore } from '../../stores/militaryStore'
import { useCyberStore } from '../../stores/cyberStore'

type GovTab = 'home' | 'account' | 'citizenship' | 'war' | 'defense' | 'empire' | 'laws'

export default function GovernmentPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const companyStore = useCompanyStore()
  const ui = useUIStore()

  const [tab, setTab] = useState<GovTab>('home')
  const [lawType, setLawType] = useState<LawType>('declare_war')
  const [targetIso, setTargetIso] = useState('')
  const [taxValue, setTaxValue] = useState(10)
  const [nukeTarget, setNukeTarget] = useState('')
  const [donateResource, setDonateResource] = useState<NationalFundKey>('oil')
  const [donateAmount, setDonateAmount] = useState(100)

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]

  const [empireName, setEmpireName] = useState(gov?.empireName || '')

  if (!gov) return <div style={{ color: '#fff', padding: '16px' }}>Government data unavailable for {iso}.</div>

  const isPresident = gov.president === player.name
  const isCongress = gov.congress.includes(player.name)
  const isOfficial = isPresident || isCongress
  const needsTarget = lawType === 'declare_war' || lawType === 'propose_peace' || lawType === 'declare_sworn_enemy' || lawType === 'propose_alliance' || lawType === 'break_alliance'

  const tabs: { id: GovTab; label: string; icon: string }[] = [
    { id: 'home', label: 'HOME', icon: '🏠' },
    { id: 'account', label: 'ACCOUNT', icon: '💰' },
    { id: 'citizenship', label: 'CITIZENS', icon: '👥' },
    { id: 'war', label: 'WAR', icon: '⚔️' },
    { id: 'defense', label: 'REGION', icon: '🏗️' },
    { id: 'empire', label: 'EMPIRE', icon: '👑' },
    { id: 'laws', label: 'LAWS', icon: '📜' },
  ]

  // ====== HANDLERS ======

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

  const handleProposeLaw = () => {
    if (!isOfficial) { ui.addFloatingText('NOT IN OFFICE', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    if (needsTarget && !targetIso) { ui.addFloatingText('SELECT TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    govStore.proposeLaw({ countryId: iso, proposerId: player.name, type: lawType, targetCountryId: needsTarget ? targetIso : undefined, newValue: lawType === 'tax_change' ? taxValue : undefined })
    ui.addFloatingText('LAW PROPOSED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    setTargetIso('')
  }

  const handleVote = (lawId: string, vote: 'for' | 'against') => {
    govStore.voteOnLaw(lawId, player.name, vote)
    setTimeout(() => {
      const updatedLaw = useGovernmentStore.getState().laws[lawId]
      if (updatedLaw?.status === 'passed') {
        if (updatedLaw.type === 'declare_war' && updatedLaw.targetCountryId) {
          useWorldStore.getState().declareWar(iso, updatedLaw.targetCountryId!)
          ui.addFloatingText('WAR DECLARED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
        } else if (updatedLaw.type === 'tax_change' && updatedLaw.newValue !== undefined) {
          useGovernmentStore.setState((s) => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], taxRate: updatedLaw.newValue! } } }))
          ui.addFloatingText(`TAX → ${updatedLaw.newValue}%`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
        } else if (updatedLaw.type === 'declare_sworn_enemy' && updatedLaw.targetCountryId) {
          useGovernmentStore.setState((s) => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], swornEnemy: updatedLaw.targetCountryId! } } }))
          ui.addFloatingText(`ENEMY: ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
        } else if (updatedLaw.type === 'authorize_nuclear_action') {
          const f = useGovernmentStore.getState().governments[iso]?.nationalFund
          if (f && f.oil >= NUKE_COST.oil && f.scraps >= NUKE_COST.scraps && f.materialX >= NUKE_COST.materialX && f.bitcoin >= NUKE_COST.bitcoin && f.jets >= NUKE_COST.jets) {
            useGovernmentStore.setState((s) => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], nuclearAuthorized: true } } }))
            ui.addFloatingText('☢️ AUTHORIZED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
          } else {
            ui.addFloatingText('FUND INSUFFICIENT', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
          }
        } else if (updatedLaw.type === 'propose_alliance' && updatedLaw.targetCountryId) {
          // Add alliance to both countries
          useGovernmentStore.setState((s) => {
            const g1 = s.governments[iso]
            const g2 = s.governments[updatedLaw.targetCountryId!]
            return {
              governments: {
                ...s.governments,
                [iso]: { ...g1, alliances: [...(g1?.alliances || []).filter(a => a !== updatedLaw.targetCountryId), updatedLaw.targetCountryId!] },
                ...(g2 ? { [updatedLaw.targetCountryId!]: { ...g2, alliances: [...(g2.alliances || []).filter(a => a !== iso), iso] } } : {}),
              }
            }
          })
          ui.addFloatingText(`🤝 ALLIANCE WITH ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#3b82f6')
        } else if (updatedLaw.type === 'break_alliance' && updatedLaw.targetCountryId) {
          // Remove alliance from both countries
          useGovernmentStore.setState((s) => {
            const g1 = s.governments[iso]
            const g2 = s.governments[updatedLaw.targetCountryId!]
            return {
              governments: {
                ...s.governments,
                [iso]: { ...g1, alliances: (g1?.alliances || []).filter(a => a !== updatedLaw.targetCountryId) },
                ...(g2 ? { [updatedLaw.targetCountryId!]: { ...g2, alliances: (g2.alliances || []).filter(a => a !== iso) } } : {}),
              }
            }
          })
          ui.addFloatingText(`💔 ALLIANCE BROKEN WITH ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
        }
      }
    }, 50)
  }

  const handleNuke = () => {
    if (!gov.nuclearAuthorized || !nukeTarget) return
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

  const fund = gov.nationalFund
  const activeLaws = Object.values(govStore.laws).filter(l => l.countryId === iso && l.status === 'active')

  const ss: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', width: '100%' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '6px 2px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.3px',
            border: `1px solid ${tab === t.id ? '#22d38a' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '3px', background: tab === t.id ? 'rgba(34,211,138,0.1)' : 'transparent',
            color: tab === t.id ? '#22d38a' : '#94a3b8', cursor: 'pointer',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
        <div style={{ flex: 1, background: 'rgba(34,211,138,0.05)', padding: '6px 8px', borderRadius: '3px', border: '1px solid rgba(34,211,138,0.2)' }}>
          <div style={{ fontSize: '8px', color: '#22d38a', fontWeight: 'bold' }}>PRESIDENT</div>
          <div style={{ color: '#fff', fontSize: '11px' }}>{gov.president || 'Vacant'}</div>
        </div>
        <div style={{ padding: '6px 8px', borderRadius: '3px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 'bold' }}>TAX</div>
          <div style={{ color: '#fff', fontSize: '11px' }}>{gov.taxRate}%</div>
        </div>
        {gov.swornEnemy && (
          <div style={{ padding: '6px 8px', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
            <div style={{ fontSize: '8px', color: '#ef4444', fontWeight: 'bold' }}>ENEMY</div>
            <div style={{ color: '#ef4444', fontSize: '11px' }}>{gov.swornEnemy}</div>
          </div>
        )}
      </div>

      {/* ====== HOME TAB ====== */}
      {tab === 'home' && (() => {
        const myCountry = world.countries.find(c => c.code === iso)
        const activeWars = world.wars.filter(w => w.status === 'active' && (w.attacker === (myCountry?.name || '') || w.defender === (myCountry?.name || '')))
        const alliances = gov.alliances || []
        const milState = useMilitaryStore.getState()
        const cyberState = useCyberStore.getState()
        const activeMilCampaigns = Object.values(milState.campaigns).filter((c: any) => c.status === 'launched' || c.status === 'recruiting')
        const activeCyberCampaigns = Object.values(cyberState.campaigns).filter((c: any) => c.status === 'active' || c.status === 'in_progress')
        const sectionStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '8px', marginBottom: '6px' }
        const labelStyle: React.CSSProperties = { fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '6px', textTransform: 'uppercase' as const }

        return (
          <>
            {/* National Fund Summary Grid */}
            <div style={sectionStyle}>
              <div style={labelStyle}>🏦 NATIONAL FUND</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
                {([
                  ['💵', 'Money', fund.money],
                  ['🛢️', 'Oil', fund.oil],
                  ['🔩', 'Scraps', fund.scraps],
                  ['⚛️', 'MatX', fund.materialX],
                  ['₿', 'BTC', fund.bitcoin],
                  ['✈️', 'Jets', fund.jets],
                ] as [string, string, number][]).map(([icon, label, val]) => (
                  <div key={label} style={{ textAlign: 'center', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '12px' }}>{icon}</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '11px' }}>{val.toLocaleString()}</div>
                    <div style={{ fontSize: '7px', color: '#475569' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Wars */}
            <div style={sectionStyle}>
              <div style={labelStyle}>⚔️ ACTIVE WARS ({activeWars.length})</div>
              {activeWars.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#475569' }}>No active wars.</div>
              ) : (
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
            <div style={sectionStyle}>
              <div style={labelStyle}>🎯 SWORN ENEMY</div>
              {gov.swornEnemy ? (
                <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: '3px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  💀 {gov.swornEnemy} — {world.countries.find(c => c.code === gov.swornEnemy)?.name || gov.swornEnemy}
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: '#475569' }}>None declared.</div>
              )}
            </div>

            {/* Alliances */}
            <div style={sectionStyle}>
              <div style={labelStyle}>🤝 ALLIANCES ({alliances.length})</div>
              {alliances.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#475569' }}>No active alliances.</div>
              ) : (
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
            <div style={sectionStyle}>
              <div style={labelStyle}>🔒 ACTIVE OPERATIONS ({activeMilCampaigns.length + activeCyberCampaigns.length})</div>
              {activeMilCampaigns.length + activeCyberCampaigns.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#475569' }}>No active operations.</div>
              ) : (
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
      })()}

      {/* ====== ACCOUNT TAB ====== */}
      {tab === 'account' && (
        <>
          <div className="hud-card">
            <div className="hud-card__title">🏦 NATIONAL FUND</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', margin: '8px 0' }}>
              {([
                ['money', '💵', fund.money],
                ['oil', '🛢️', fund.oil],
                ['scraps', '🔩', fund.scraps],
                ['materialX', '⚛️', fund.materialX],
                ['bitcoin', '₿', fund.bitcoin],
                ['jets', '✈️', fund.jets],
              ] as [string, string, number][]).map(([key, icon, val]) => (
                <div key={key} style={{ fontSize: '10px', padding: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px' }}>{icon}</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>{val.toLocaleString()}</div>
                  <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase' }}>{key}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select value={donateResource} onChange={(e) => setDonateResource(e.target.value as NationalFundKey)} style={{ ...ss, width: 'auto', flex: 1 }}>
                <option value="money">Money</option>
                <option value="oil">Oil</option>
                <option value="scraps">Scraps</option>
                <option value="materialX">Material X</option>
                <option value="bitcoin">Bitcoin</option>
                <option value="jets">Jets (T6)</option>
              </select>
              <input type="number" value={donateAmount} onChange={(e) => setDonateAmount(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...ss, width: '70px' }} />
              <button className="hud-btn-primary" onClick={handleDonate} style={{ fontSize: '9px', padding: '6px 10px' }}>DONATE</button>
            </div>
          </div>

          {/* NUKE */}
          <div className="hud-card" style={{ borderColor: gov.nuclearAuthorized ? '#ef4444' : '#333' }}>
            <div className="hud-card__title" style={{ color: gov.nuclearAuthorized ? '#ef4444' : '#555' }}>☢️ NUCLEAR STRIKE</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <select value={nukeTarget} onChange={(e) => setNukeTarget(e.target.value)} disabled={!gov.nuclearAuthorized} style={{ ...ss, flex: 1 }}>
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

          {/* Congress */}
          <div className="hud-card">
            <div className="hud-card__title">🏛️ CONGRESS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
              {gov.congress.map((m, i) => (
                <div key={i} style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>{m}</div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ====== CITIZENSHIP TAB ====== */}
      {tab === 'citizenship' && (
        <div className="hud-card">
          <div className="hud-card__title">👥 CITIZENS ({gov.citizens.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '8px' }}>
            {[...gov.citizens].sort((a, b) => b.level - a.level).map(c => {
              const roleColors: Record<string, string> = { president: '#22d38a', congress: '#38bdf8', citizen: '#94a3b8' }
              return (
                <div key={c.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                  borderLeft: `3px solid ${roleColors[c.role] || '#333'}`,
                }}>
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
            <button className="hud-btn-outline" onClick={() => {
              govStore.registerCandidate(iso, player.name, player.name)
              ui.addFloatingText('REGISTERED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
            }} style={{ fontSize: '10px' }}>
              🗳️ RUN FOR OFFICE
            </button>
          </div>
        </div>
      )}

      {/* ====== WAR TAB ====== */}
      {tab === 'war' && (
        <div className="hud-card">
          <div className="hud-card__title">⚔️ ACTIVE WARS</div>
          {(() => {
            const wars = world.wars?.filter(w => (w.attacker === iso || w.defender === iso) && w.status === 'active') || []
            const battles = Object.values(useBattleStore.getState().battles).filter(b => b.attackerId === iso || b.defenderId === iso)
            return wars.length === 0 && battles.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>No active wars or battles.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {wars.map(w => (
                  <div key={w.id} style={{ padding: '8px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>
                      {w.attacker === iso ? `🗡️ ATTACKING ${w.defender}` : `🛡️ DEFENDING VS ${w.attacker}`}
                    </div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                      Status: {w.status.toUpperCase()} · Since: {new Date(w.startedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {battles.map(b => {
                  const side = b.attackerId === iso ? 'ATTACKER' : 'DEFENDER'
                  return (
                    <div key={b.id} style={{ padding: '8px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
                          {b.regionName} — {side}
                        </span>
                        <span style={{ fontSize: '9px', color: b.status === 'active' ? '#22d38a' : '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>{b.status}</span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                        Rounds: {b.attackerRoundsWon}–{b.defenderRoundsWon}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ====== REGION / INFRA TAB ====== */}
      {tab === 'defense' && (
        <div className="hud-card">
          <div className="hud-card__title">🏗️ REGION INFRASTRUCTURE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {(() => {
              const myCountry = world.countries.find(c => c.code === iso)
              if (!myCountry) return <p style={{ fontSize: '10px', color: '#555' }}>Country not found.</p>

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
                  ui.addFloatingText('FUND INSUFFICIENT', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
                  return
                }
                govStore.spendFromFund(iso, { money: cost.money, oil: cost.oil, materialX: cost.materialX })
                useWorldStore.setState(s => ({
                  countries: s.countries.map(c => c.code === iso ? { ...c, [key]: c[key] + 1 } : c)
                }))
                ui.addFloatingText(`${key.replace('Level', '').toUpperCase()} UPGRADED!`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
              }

              return (
                <>
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
                        >
                          UPGRADE TO Lv.{level + 1}
                        </button>
                      </div>
                    )
                  })}

                  {/* Country overviews below infrastructure */}
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '8px' }}>STRATEGIC RESOURCES ({myCountry.conqueredResources?.length || 0})</div>
                  {(myCountry.conqueredResources?.length || 0) > 0 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {myCountry.conqueredResources.map((r, i) => (
                        <span key={i} style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '3px', color: '#22d38a' }}>{r}</span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '10px', color: '#555' }}>No strategic resources conquered.</p>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )}
      {/* ====== EMPIRE TAB ====== */}
      {tab === 'empire' && (
        <div className="hud-card">
          <div className="hud-card__title">👑 EMPIRE CONFIGURATION</div>

          {!isPresident ? (
            <p style={{ fontSize: '11px', color: '#f59e0b', margin: '8px 0 0' }}>⚠️ Only the President can configure the Empire.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>

              {/* Empire Name */}
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>EMPIRE NAME</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    value={empireName}
                    onChange={(e) => setEmpireName(e.target.value)}
                    maxLength={30}
                    placeholder="Enter empire name..."
                    style={{ ...ss, flex: 1 }}
                  />
                  <button
                    className="hud-btn-primary"
                    style={{ fontSize: '9px', padding: '4px 10px' }}
                    onClick={() => {
                      if (!empireName.trim()) { ui.addFloatingText('ENTER A NAME', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
                      useGovernmentStore.setState((s) => ({
                        governments: { ...s.governments, [iso]: { ...s.governments[iso], empireName: empireName.trim() } }
                      }))
                      ui.addFloatingText(`EMPIRE: ${empireName.trim()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
                    }}
                  >
                    SET NAME
                  </button>
                </div>
                {gov.empireName && (
                  <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>Current: <strong>{gov.empireName}</strong></div>
                )}
              </div>

              {/* Ideology Selection */}
              <div>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>IDEOLOGY</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  {([
                    { id: 'militarist' as const, icon: '⚔️', label: 'MILITARIST', color: '#ef4444', desc: '+ATK & +Crit' },
                    { id: 'capitalist' as const, icon: '💰', label: 'CAPITALIST', color: '#22d38a', desc: '+Production & +Tax' },
                    { id: 'technocrat' as const, icon: '🔬', label: 'TECHNOCRAT', color: '#8b5cf6', desc: '+Cyber & +Tech' },
                    { id: 'expansionist' as const, icon: '🌍', label: 'EXPANSIONIST', color: '#3b82f6', desc: '+Defense & +Diplomacy' },
                  ]).map(ideo => (
                    <button
                      key={ideo.id}
                      onClick={() => {
                        useGovernmentStore.setState((s) => ({
                          governments: { ...s.governments, [iso]: { ...s.governments[iso], ideology: ideo.id } }
                        }))
                        ui.addFloatingText(`IDEOLOGY: ${ideo.label}`, window.innerWidth / 2, window.innerHeight / 2, ideo.color)
                      }}
                      style={{
                        padding: '8px', borderRadius: '4px', cursor: 'pointer',
                        border: `1px solid ${gov.ideology === ideo.id ? ideo.color : 'rgba(255,255,255,0.08)'}`,
                        background: gov.ideology === ideo.id ? `${ideo.color}15` : 'rgba(0,0,0,0.3)',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: '12px', marginBottom: '2px' }}>{ideo.icon} <span style={{ fontSize: '10px', fontWeight: 700, color: gov.ideology === ideo.id ? ideo.color : '#94a3b8' }}>{ideo.label}</span></div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>{ideo.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ideology Skill Tree */}
              {gov.ideology && (
                <div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>IDEOLOGY SKILL TREE — ALLOCATE POINTS</div>
                  <div style={{ fontSize: '8px', color: '#475569', marginBottom: '6px' }}>Each upgrade costs $5,000 from the National Fund. Max 10 per branch.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {([
                      { key: 'warBonus' as const, icon: '⚔️', label: 'WAR BONUS', desc: '+2% attack per point', color: '#ef4444' },
                      { key: 'economyBonus' as const, icon: '💰', label: 'ECONOMY BONUS', desc: '+2% company production per point', color: '#22d38a' },
                      { key: 'techBonus' as const, icon: '🔬', label: 'TECH BONUS', desc: '+2% cyber success per point', color: '#8b5cf6' },
                      { key: 'defenseBonus' as const, icon: '🛡️', label: 'DEFENSE BONUS', desc: '+2% bunker/infra strength per point', color: '#f59e0b' },
                      { key: 'diplomacyBonus' as const, icon: '🤝', label: 'DIPLOMACY BONUS', desc: '+1 alliance slot per point', color: '#3b82f6' },
                    ]).map(skill => {
                      const pts = gov.ideologyPoints[skill.key]
                      const maxPts = 10
                      return (
                        <div key={skill.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: '14px', width: '22px' }}>{skill.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: skill.color }}>{skill.label}</div>
                            <div style={{ fontSize: '7px', color: '#475569' }}>{skill.desc}</div>
                            <div style={{ display: 'flex', gap: '2px', marginTop: '3px' }}>
                              {Array.from({ length: maxPts }).map((_, i) => (
                                <div key={i} style={{ width: '14px', height: '6px', borderRadius: '1px', background: i < pts ? skill.color : 'rgba(255,255,255,0.08)' }} />
                              ))}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{pts}/{maxPts}</div>
                            <button
                              className="hud-btn-outline"
                              disabled={pts >= maxPts}
                              style={{ fontSize: '8px', padding: '2px 6px', borderColor: skill.color, color: skill.color, marginTop: '2px' }}
                              onClick={() => {
                                const currentFund = useGovernmentStore.getState().governments[iso]?.nationalFund
                                if (!currentFund || currentFund.money < 5000) {
                                  ui.addFloatingText('FUND: $5,000 REQUIRED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
                                  return
                                }
                                useGovernmentStore.setState((s) => {
                                  const g = s.governments[iso]
                                  return {
                                    governments: {
                                      ...s.governments,
                                      [iso]: {
                                        ...g,
                                        nationalFund: { ...g.nationalFund, money: g.nationalFund.money - 5000 },
                                        ideologyPoints: { ...g.ideologyPoints, [skill.key]: g.ideologyPoints[skill.key] + 1 },
                                      }
                                    }
                                  }
                                })
                                ui.addFloatingText(`+1 ${skill.label}`, window.innerWidth / 2, window.innerHeight / 2, skill.color)
                              }}
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ====== LAWS TAB ====== */}
      {tab === 'laws' && (
        <>
          {/* Propose Law */}
          {isOfficial && (
            <div className="hud-card">
              <div className="hud-card__title">📜 PROPOSE LAW</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <select value={lawType} onChange={(e) => setLawType(e.target.value as LawType)} style={ss}>
                  <option value="declare_war">⚔️ Declare War</option>
                  <option value="propose_peace">🕊️ Propose Peace</option>
                  <option value="tax_change">💰 Change Tax Rate</option>
                  <option value="declare_sworn_enemy">🎯 Declare Sworn Enemy</option>
                  <option value="propose_alliance">🤝 Propose Alliance</option>
                  <option value="break_alliance">💔 Break Alliance</option>
                  <option value="authorize_nuclear_action">☢️ Authorize Nuclear Action</option>
                </select>
                {needsTarget && (
                  <select value={targetIso} onChange={(e) => setTargetIso(e.target.value)} style={ss}>
                    <option value="" disabled>Select Target Country...</option>
                    {world.countries.filter(c => c.code !== iso).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                )}
                {lawType === 'tax_change' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>Rate:</span>
                    <input type="number" min={0} max={100} value={taxValue} onChange={(e) => setTaxValue(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} style={{ ...ss, width: '60px' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>%</span>
                  </div>
                )}
                {lawType === 'authorize_nuclear_action' && (
                  <p style={{ fontSize: '9px', color: '#f59e0b', margin: 0 }}>⚠️ Requires national fund to meet nuke resource requirements.</p>
                )}
                <button className="hud-btn-primary" onClick={handleProposeLaw} style={{ fontSize: '10px' }}>SUBMIT TO CONGRESS</button>
              </div>
            </div>
          )}

          {/* Active Laws */}
          <div className="hud-card">
            <div className="hud-card__title">⚖️ ACTIVE LAWS ({activeLaws.length})</div>
            {activeLaws.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>No laws on the floor.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {activeLaws.map(law => (
                  <div key={law.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px', borderRadius: '3px' }}>
                    <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                      {law.type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '10px', color: '#fff', margin: '2px 0 6px' }}>
                      {law.targetCountryId && `Target: ${law.targetCountryId}`}
                      {law.type === 'tax_change' && law.newValue !== undefined && `New Rate: ${law.newValue}%`}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#94a3b8', marginBottom: '6px' }}>
                      <span>By: {law.proposerId}</span>
                      <span>YEA: {law.votesFor.length} | NAY: {law.votesAgainst.length}</span>
                    </div>
                    {isCongress && !law.votesFor.includes(player.name) && !law.votesAgainst.includes(player.name) && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="hud-btn-outline" style={{ borderColor: '#22d38a', color: '#22d38a', flex: 1, fontSize: '9px' }} onClick={() => handleVote(law.id, 'for')}>AYE</button>
                        <button className="hud-btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444', flex: 1, fontSize: '9px' }} onClick={() => handleVote(law.id, 'against')}>NAY</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
