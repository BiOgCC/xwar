import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import type { LawType } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'

/** LAWS tab — Propose law + active laws voting */
export default function GovLawsTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const [lawType, setLawType] = useState<LawType>('declare_war')
  const [targetIso, setTargetIso] = useState('')
  const [taxValue, setTaxValue] = useState(10)
  const [amountValue, setAmountValue] = useState(100000)
  const [percentValue, setPercentValue] = useState(5)

  if (!gov) return null
  const isPresident = gov.president === player.name
  const isCongress = gov.congress.includes(player.name)
  const isOfficial = isPresident || isCongress

  // Which law types need a target country?
  const needsTarget = lawType === 'declare_war' || lawType === 'propose_peace' ||
    lawType === 'declare_sworn_enemy' || lawType === 'propose_alliance' ||
    lawType === 'break_alliance' || lawType === 'trade_embargo' || lawType === 'lift_embargo'

  // Which law types need a numeric amount input?
  const needsAmount = lawType === 'print_money' || lawType === 'minimum_wage'

  // Which law types need a percent input?
  const needsPercent = lawType === 'import_tariff' || lawType === 'military_spending_change'

  const activeLaws = Object.values(govStore.laws).filter(l => l.countryId === iso && l.status === 'active')

  const handleProposeLaw = () => {
    if (!isOfficial) { ui.addFloatingText('NOT IN OFFICE', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    if (needsTarget && !targetIso) { ui.addFloatingText('SELECT TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    govStore.proposeLaw({
      countryId: iso,
      proposerId: player.name,
      type: lawType,
      targetCountryId: needsTarget ? targetIso : undefined,
      newValue: lawType === 'tax_change' ? taxValue
        : needsAmount ? amountValue
        : needsPercent ? percentValue
        : undefined,
    })
    ui.addFloatingText('LAW PROPOSED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    setTargetIso('')
  }

  const handleVote = (lawId: string, vote: 'for' | 'against') => {
    govStore.voteOnLaw(lawId, player.name, vote)
    setTimeout(() => {
      const updatedLaw = useGovernmentStore.getState().laws[lawId]
      if (updatedLaw?.status === 'passed') {
        applyLawEffect(updatedLaw, iso)
      }
    }, 50)
  }

  /** Apply the effect of a passed law */
  const applyLawEffect = (law: ReturnType<typeof useGovernmentStore.getState>['laws'][string], countryIso: string) => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2

    switch (law.type) {
      case 'declare_war':
        if (law.targetCountryId) {
          useWorldStore.getState().declareWar(countryIso, law.targetCountryId)
          ui.addFloatingText('WAR DECLARED', cx, cy, '#ef4444')
        }
        break

      case 'propose_peace':
        if (law.targetCountryId) {
          useWorldStore.getState().endWar(countryIso, law.targetCountryId)
          ui.addFloatingText(`🕊️ PEACE WITH ${law.targetCountryId}`, cx, cy, '#22d38a')
        }
        break

      case 'impeach_president':
        useGovernmentStore.setState(s => ({
          governments: {
            ...s.governments,
            [countryIso]: { ...s.governments[countryIso], president: null, candidates: [] }
          }
        }))
        ui.addFloatingText('🏛️ PRESIDENT IMPEACHED', cx, cy, '#f59e0b')
        break

      case 'tax_change':
        if (law.newValue !== undefined) {
          useGovernmentStore.setState(s => ({
            governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], taxRate: law.newValue! } }
          }))
          ui.addFloatingText(`TAX → ${law.newValue}%`, cx, cy, '#f59e0b')
        }
        break

      case 'declare_sworn_enemy':
        if (law.targetCountryId) {
          useGovernmentStore.setState(s => ({
            governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], swornEnemy: law.targetCountryId! } }
          }))
          ui.addFloatingText(`ENEMY: ${law.targetCountryId}`, cx, cy, '#ef4444')
        }
        break

      case 'authorize_nuclear_action':
        useGovernmentStore.setState(s => ({
          governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], nuclearAuthorized: true } }
        }))
        ui.addFloatingText('☢️ AUTHORIZED', cx, cy, '#ef4444')
        break

      case 'propose_alliance':
        if (law.targetCountryId) {
          useGovernmentStore.setState(s => {
            const g1 = s.governments[countryIso], g2 = s.governments[law.targetCountryId!]
            return {
              governments: {
                ...s.governments,
                [countryIso]: { ...g1, alliances: [...(g1?.alliances || []).filter(a => a !== law.targetCountryId), law.targetCountryId!] },
                ...(g2 ? { [law.targetCountryId!]: { ...g2, alliances: [...(g2.alliances || []).filter(a => a !== countryIso), countryIso] } } : {}),
              }
            }
          })
          ui.addFloatingText(`🤝 ALLIANCE WITH ${law.targetCountryId}`, cx, cy, '#3b82f6')
        }
        break

      case 'break_alliance':
        if (law.targetCountryId) {
          useGovernmentStore.setState(s => {
            const g1 = s.governments[countryIso], g2 = s.governments[law.targetCountryId!]
            return {
              governments: {
                ...s.governments,
                [countryIso]: { ...g1, alliances: (g1?.alliances || []).filter(a => a !== law.targetCountryId) },
                ...(g2 ? { [law.targetCountryId!]: { ...g2, alliances: (g2.alliances || []).filter(a => a !== countryIso) } } : {}),
              }
            }
          })
          ui.addFloatingText(`💔 BROKEN WITH ${law.targetCountryId}`, cx, cy, '#ef4444')
        }
        break

      // ── NEW ECONOMY / MILITARY POLICY LAWS ──

      case 'print_money':
        if (law.newValue && law.newValue > 0) {
          useWorldStore.getState().printMoney(countryIso, law.newValue)
          ui.addFloatingText(`🖨️ PRINTED $${law.newValue.toLocaleString()}`, cx, cy, '#22d38a')
        }
        break

      case 'trade_embargo':
        if (law.targetCountryId) {
          useGovernmentStore.setState(s => {
            const g = s.governments[countryIso]
            const embargoes = [...(g.embargoes || []).filter(e => e !== law.targetCountryId), law.targetCountryId!]
            return { governments: { ...s.governments, [countryIso]: { ...g, embargoes } } }
          })
          ui.addFloatingText(`🚫 EMBARGO ON ${law.targetCountryId}`, cx, cy, '#ef4444')
        }
        break

      case 'lift_embargo':
        if (law.targetCountryId) {
          useGovernmentStore.setState(s => {
            const g = s.governments[countryIso]
            return { governments: { ...s.governments, [countryIso]: { ...g, embargoes: (g.embargoes || []).filter(e => e !== law.targetCountryId) } } }
          })
          ui.addFloatingText(`✅ EMBARGO LIFTED ON ${law.targetCountryId}`, cx, cy, '#22d38a')
        }
        break

      case 'conscription':
        useGovernmentStore.setState(s => ({
          governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], conscriptionActive: true } }
        }))
        ui.addFloatingText('⚔️ CONSCRIPTION ACTIVATED', cx, cy, '#f59e0b')
        break

      case 'end_conscription':
        useGovernmentStore.setState(s => ({
          governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], conscriptionActive: false } }
        }))
        ui.addFloatingText('🕊️ CONSCRIPTION ENDED', cx, cy, '#22d38a')
        break

      case 'import_tariff':
        if (law.newValue !== undefined) {
          const clamped = Math.max(0, Math.min(50, law.newValue))
          useGovernmentStore.setState(s => ({
            governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], importTariff: clamped } }
          }))
          ui.addFloatingText(`📦 TARIFF → ${clamped}%`, cx, cy, '#f59e0b')
        }
        break

      case 'minimum_wage':
        if (law.newValue !== undefined) {
          useGovernmentStore.setState(s => ({
            governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], minimumWage: Math.max(0, law.newValue!) } }
          }))
          ui.addFloatingText(`💵 MIN WAGE → $${law.newValue.toLocaleString()}`, cx, cy, '#f59e0b')
        }
        break

      case 'military_spending_change':
        if (law.newValue !== undefined) {
          const clamped = Math.max(0, Math.min(50, law.newValue))
          useGovernmentStore.setState(s => ({
            governments: { ...s.governments, [countryIso]: { ...s.governments[countryIso], militaryBudgetPercent: clamped } }
          }))
          ui.addFloatingText(`🎖️ MIL BUDGET → ${clamped}%`, cx, cy, '#f59e0b')
        }
        break

      case 'nationalize_company_law':
        // The actual nationalization is done via the existing nationalizeCompany action
        ui.addFloatingText('🏭 NATIONALIZATION APPROVED', cx, cy, '#f59e0b')
        break
    }
  }

  /** Human-readable label for a law type */
  const lawLabel = (type: string): string => {
    const m: Record<string, string> = {
      declare_war: 'Declare War',
      propose_peace: 'Propose Peace',
      impeach_president: 'Impeach President',
      tax_change: 'Change Tax Rate',
      declare_sworn_enemy: 'Declare Sworn Enemy',
      propose_alliance: 'Propose Alliance',
      break_alliance: 'Break Alliance',
      authorize_nuclear_action: 'Authorize Nuclear Action',
      print_money: 'Print Money',
      trade_embargo: 'Trade Embargo',
      lift_embargo: 'Lift Embargo',
      conscription: 'Activate Conscription',
      end_conscription: 'End Conscription',
      import_tariff: 'Set Import Tariff',
      minimum_wage: 'Set Minimum Wage',
      military_spending_change: 'Change Military Budget',
      nationalize_company_law: 'Nationalize Company',
    }
    return m[type] || type.replace(/_/g, ' ')
  }

  /** Extra detail shown on active law cards */
  const lawDetail = (law: typeof activeLaws[number]): string => {
    if (law.targetCountryId) return `Target: ${law.targetCountryId}`
    if (law.type === 'tax_change' && law.newValue !== undefined) return `New Rate: ${law.newValue}%`
    if (law.type === 'print_money' && law.newValue !== undefined) return `Amount: $${law.newValue.toLocaleString()}`
    if (law.type === 'import_tariff' && law.newValue !== undefined) return `Tariff: ${law.newValue}%`
    if (law.type === 'minimum_wage' && law.newValue !== undefined) return `Wage: $${law.newValue.toLocaleString()}`
    if (law.type === 'military_spending_change' && law.newValue !== undefined) return `Budget: ${law.newValue}%`
    return ''
  }

  return (
    <>
      {isOfficial && (
        <div className="gov-section">
          <div className="gov-section__title gov-section__title--blue">📜 PROPOSE LAW</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <select className="gov-select" value={lawType} onChange={e => setLawType(e.target.value as LawType)}>
              <optgroup label="Diplomacy & War">
                <option value="declare_war">⚔️ Declare War</option>
                <option value="propose_peace">🕊️ Propose Peace</option>
                <option value="declare_sworn_enemy">🎯 Declare Sworn Enemy</option>
                <option value="propose_alliance">🤝 Propose Alliance</option>
                <option value="break_alliance">💔 Break Alliance</option>
                <option value="trade_embargo">🚫 Trade Embargo</option>
                <option value="lift_embargo">✅ Lift Embargo</option>
              </optgroup>
              <optgroup label="Government">
                <option value="tax_change">💰 Change Tax Rate</option>
                <option value="impeach_president">🏛️ Impeach President</option>
                <option value="authorize_nuclear_action">☢️ Authorize Nuclear Action</option>
              </optgroup>
              <optgroup label="Economy">
                <option value="print_money">🖨️ Print Money</option>
                <option value="import_tariff">📦 Set Import Tariff</option>
                <option value="minimum_wage">💵 Set Minimum Wage</option>
              </optgroup>
              <optgroup label="Military">
                <option value="conscription">⚔️ Activate Conscription</option>
                <option value="end_conscription">🕊️ End Conscription</option>
                <option value="military_spending_change">🎖️ Change Military Budget</option>
              </optgroup>
              <optgroup label="Industry">
                <option value="nationalize_company_law">🏭 Nationalize Company</option>
              </optgroup>
            </select>
            {needsTarget && (
              <select className="gov-select" value={targetIso} onChange={e => setTargetIso(e.target.value)}>
                <option value="" disabled>Select Target Country...</option>
                {world.countries.filter(c => c.code !== iso).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
            {lawType === 'tax_change' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', color: '#64748b' }}>Rate:</span>
                <input className="gov-input" type="number" min={0} max={100} value={taxValue} onChange={e => setTaxValue(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))} style={{ width: '55px' }} />
                <span style={{ fontSize: '9px', color: '#64748b' }}>%</span>
              </div>
            )}
            {needsAmount && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', color: '#64748b' }}>Amount:</span>
                <input className="gov-input" type="number" min={0} value={amountValue} onChange={e => setAmountValue(Math.max(0, parseInt(e.target.value) || 0))} style={{ width: '90px' }} />
                <span style={{ fontSize: '9px', color: '#64748b' }}>$</span>
              </div>
            )}
            {needsPercent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '9px', color: '#64748b' }}>{lawType === 'import_tariff' ? 'Tariff' : 'Budget'}:</span>
                <input className="gov-input" type="number" min={0} max={50} value={percentValue} onChange={e => setPercentValue(Math.min(50, Math.max(0, parseInt(e.target.value) || 0)))} style={{ width: '55px' }} />
                <span style={{ fontSize: '9px', color: '#64748b' }}>%</span>
              </div>
            )}
            {lawType === 'authorize_nuclear_action' && <p style={{ fontSize: '7px', color: '#f59e0b', margin: 0 }}>⚠️ Requires national fund to meet nuke resource requirements.</p>}
            {lawType === 'impeach_president' && <p style={{ fontSize: '7px', color: '#ef4444', margin: 0 }}>⚠️ Removes the current president from office.</p>}
            {lawType === 'print_money' && <p style={{ fontSize: '7px', color: '#f59e0b', margin: 0 }}>⚠️ Money is created from nothing — inflationary!</p>}
            {lawType === 'conscription' && <p style={{ fontSize: '7px', color: '#f59e0b', margin: 0 }}>⚠️ All citizens automatically receive 1 free division.</p>}
            {lawType === 'trade_embargo' && <p style={{ fontSize: '7px', color: '#ef4444', margin: 0 }}>🚫 Blocks all market trades with the target country.</p>}
            <button className="gov-btn gov-btn--primary" onClick={handleProposeLaw} style={{ width: '100%' }}>SUBMIT TO CONGRESS</button>
          </div>
        </div>
      )}

      {/* Active policies */}
      {gov && (gov.embargoes?.length > 0 || gov.conscriptionActive || gov.importTariff > 0 || gov.minimumWage > 0) && (
        <div className="gov-section">
          <div className="gov-section__title gov-section__title--blue">📋 ACTIVE POLICIES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '8px' }}>
            {gov.embargoes?.map(e => <span key={e} style={{ background: '#ef444422', color: '#ef4444', padding: '1px 6px', borderRadius: '3px' }}>🚫 Embargo: {e}</span>)}
            {gov.conscriptionActive && <span style={{ background: '#f59e0b22', color: '#f59e0b', padding: '1px 6px', borderRadius: '3px' }}>⚔️ Conscription</span>}
            {gov.importTariff > 0 && <span style={{ background: '#3b82f622', color: '#3b82f6', padding: '1px 6px', borderRadius: '3px' }}>📦 Tariff: {gov.importTariff}%</span>}
            {gov.minimumWage > 0 && <span style={{ background: '#22d38a22', color: '#22d38a', padding: '1px 6px', borderRadius: '3px' }}>💵 Min Wage: ${gov.minimumWage.toLocaleString()}</span>}
          </div>
        </div>
      )}

      <div className="gov-section">
        <div className="gov-section__title">⚖️ ACTIVE LAWS ({activeLaws.length})</div>
        {activeLaws.length === 0
          ? <p style={{ fontSize: '9px', color: '#3e4a5c' }}>No laws on the floor.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {activeLaws.map(law => (
                <div key={law.id} className="gov-law">
                  <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>{lawLabel(law.type)}</div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', margin: '2px 0 4px' }}>
                    {lawDetail(law)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#475569', marginBottom: '4px' }}>
                    <span>By: {law.proposerId}</span>
                    <span style={{ fontFamily: 'var(--font-display)' }}>YEA: {law.votesFor.length} | NAY: {law.votesAgainst.length}</span>
                  </div>
                  {isCongress && !law.votesFor.includes(player.name) && !law.votesAgainst.includes(player.name) && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="gov-btn gov-btn--green" style={{ flex: 1 }} onClick={() => handleVote(law.id, 'for')}>AYE</button>
                      <button className="gov-btn gov-btn--red" style={{ flex: 1 }} onClick={() => handleVote(law.id, 'against')}>NAY</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
        }
      </div>
    </>
  )
}
