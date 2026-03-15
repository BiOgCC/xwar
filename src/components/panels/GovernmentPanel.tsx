import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../stores/governmentStore'
import type { LawType, NationalFundKey } from '../../stores/governmentStore'
import { useWorldStore } from '../../stores/worldStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useBattleStore } from '../../stores/battleStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'

type GovTab = 'account' | 'citizenship' | 'war' | 'defense' | 'laws'

export default function GovernmentPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const companyStore = useCompanyStore()
  const ui = useUIStore()

  const [tab, setTab] = useState<GovTab>('account')
  const [lawType, setLawType] = useState<LawType>('declare_war')
  const [targetIso, setTargetIso] = useState('')
  const [taxValue, setTaxValue] = useState(10)
  const [nukeTarget, setNukeTarget] = useState('')
  const [donateResource, setDonateResource] = useState<NationalFundKey>('oil')
  const [donateAmount, setDonateAmount] = useState(100)

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]

  if (!gov) return <div style={{ color: '#fff', padding: '16px' }}>Government data unavailable for {iso}.</div>

  const isPresident = gov.president === player.name
  const isCongress = gov.congress.includes(player.name)
  const isOfficial = isPresident || isCongress
  const needsTarget = lawType === 'declare_war' || lawType === 'propose_peace' || lawType === 'declare_sworn_enemy'

  const tabs: { id: GovTab; label: string; icon: string }[] = [
    { id: 'account', label: 'ACCOUNT', icon: '💰' },
    { id: 'citizenship', label: 'CITIZENS', icon: '👥' },
    { id: 'war', label: 'WAR', icon: '⚔️' },
    { id: 'defense', label: 'DEFENSE', icon: '🛡️' },
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

      {/* ====== DEFENSE TAB ====== */}
      {tab === 'defense' && (
        <div className="hud-card">
          <div className="hud-card__title">🛡️ NATIONAL DEFENSE & INFRASTRUCTURE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {(() => {
              const myCountry = world.countries.find(c => c.code === iso)
              const allDeposits = (world as any).deposits || []
              const myCompanies = companyStore.companies.filter(c => c.location === iso)
              const myDeposits = allDeposits.filter((d: any) => d.countryCode === iso)
              return (
                <>
                  {/* Country Overview */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <div style={{ fontSize: '10px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', textAlign: 'center' }}>
                      <div style={{ color: '#22d38a', fontWeight: 700, fontSize: '14px' }}>{myCountry?.regions || 0}</div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>REGIONS</div>
                    </div>
                    <div style={{ fontSize: '10px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', textAlign: 'center' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '14px' }}>{myCountry?.military || 0}</div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>MILITARY</div>
                    </div>
                    <div style={{ fontSize: '10px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', textAlign: 'center' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '14px' }}>{myCompanies.length}</div>
                      <div style={{ fontSize: '8px', color: '#64748b' }}>COMPANIES</div>
                    </div>
                  </div>

                  {/* Resources */}
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>STRATEGIC RESOURCES ({myCountry?.conqueredResources?.length || 0})</div>
                  {(myCountry?.conqueredResources?.length || 0) > 0 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {myCountry!.conqueredResources.map((r, i) => (
                        <span key={i} style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(34,211,138,0.1)', border: '1px solid rgba(34,211,138,0.3)', borderRadius: '3px', color: '#22d38a' }}>{r}</span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '10px', color: '#555' }}>No strategic resources conquered.</p>
                  )}

                  {/* Deposits */}
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>DEPOSITS ({myDeposits.length})</div>
                  {myDeposits.length > 0 ? (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {myDeposits.map((d: any) => (
                        <span key={d.id} style={{ fontSize: '9px', padding: '2px 6px', background: d.active ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${d.active ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '3px', color: d.active ? '#f59e0b' : '#666' }}>
                          {d.type} {d.active ? '✓' : '(undiscovered)'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '10px', color: '#555' }}>No deposits found.</p>
                  )}

                  {/* Companies */}
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginTop: '4px' }}>INFRASTRUCTURE ({myCompanies.length} Companies)</div>
                  {myCompanies.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {myCompanies.slice(0, 15).map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '3px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px' }}>
                          <span style={{ color: c.disabledUntil && c.disabledUntil > Date.now() ? '#ef4444' : '#e2e8f0' }}>
                            {c.type.replace(/_/g, ' ')} {c.disabledUntil && c.disabledUntil > Date.now() ? '⛔' : ''}
                          </span>
                          <span style={{ color: '#64748b' }}>Lv.{c.level} | {Math.floor(c.productionProgress)}%</span>
                        </div>
                      ))}
                      {myCompanies.length > 15 && <p style={{ fontSize: '9px', color: '#555' }}>...and {myCompanies.length - 15} more</p>}
                    </div>
                  ) : (
                    <p style={{ fontSize: '10px', color: '#555' }}>No companies in this country.</p>
                  )}
                </>
              )
            })()}
          </div>
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
