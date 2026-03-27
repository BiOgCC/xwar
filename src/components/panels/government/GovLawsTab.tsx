import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import type { LawType } from '../../../types/government.types'
import { useWorldStore } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'
import { Scroll, Scale, ClipboardList, Ban, Shield, Package, DollarSign } from 'lucide-react'

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

  const activeLaws = ((gov.laws as any)?.proposals || [] as any[]).filter((l: any) => l.status === 'pending')

  const handleProposeLaw = async () => {
    if (!isOfficial) { ui.addFloatingText('NOT IN OFFICE', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    if (needsTarget && !targetIso) { ui.addFloatingText('SELECT TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
    const numericValue = lawType === 'tax_change' ? taxValue
      : needsAmount ? amountValue
      : needsPercent ? percentValue
      : undefined
    const result = await govStore.proposeLaw(
      iso,
      lawType,
      needsTarget ? targetIso : undefined,
      numericValue,
    )
    ui.addFloatingText(
      result.success ? 'LAW PROPOSED' : result.message,
      window.innerWidth / 2, window.innerHeight / 2,
      result.success ? '#22d38a' : '#ef4444'
    )
    setTargetIso('')
  }

  const handleVote = async (proposalId: string, vote: 'for' | 'against') => {
    const result = await govStore.voteOnLaw(iso, proposalId, vote)
    ui.addFloatingText(
      result.success ? result.message : 'VOTE FAILED',
      window.innerWidth / 2, window.innerHeight / 2,
      result.success ? '#22d38a' : '#ef4444'
    )
  }

  // Effects are now applied server-side when a law is voted 'passed'

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
  const lawDetail = (law: any): string => {
    if (law.targetCountryId) return `Target: ${law.targetCountryId}`
    if (law.lawType === 'tax_change' && law.newValue !== undefined) return `New Rate: ${law.newValue}%`
    if (law.lawType === 'print_money' && law.newValue !== undefined) return `Amount: $${law.newValue.toLocaleString()}`
    if (law.lawType === 'import_tariff' && law.newValue !== undefined) return `Tariff: ${law.newValue}%`
    if (law.lawType === 'minimum_wage' && law.newValue !== undefined) return `Wage: $${law.newValue.toLocaleString()}`
    if (law.lawType === 'military_spending_change' && law.newValue !== undefined) return `Budget: ${law.newValue}%`
    return ''
  }

  return (
    <>
      {isOfficial && (
        <div className="gov-section">
          <div className="gov-section__title gov-section__title--blue" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Scroll size={14} /> PROPOSE LAW</div>
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
                {world.countries.filter((c: any) => c.code !== iso).map((c: any) => <option key={c.code} value={c.code}>{c.name}</option>)}
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
          <div className="gov-section__title gov-section__title--blue" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={14} /> ACTIVE POLICIES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '8px' }}>
            {gov.embargoes?.map((e: any) => <span key={e} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ef444422', color: '#ef4444', padding: '2px 6px', borderRadius: '3px' }}><Ban size={10} /> Embargo: {e}</span>)}
            {gov.conscriptionActive && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f59e0b22', color: '#f59e0b', padding: '2px 6px', borderRadius: '3px' }}><Shield size={10} /> Conscription</span>}
            {gov.importTariff > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#3b82f622', color: '#3b82f6', padding: '2px 6px', borderRadius: '3px' }}><Package size={10} /> Tariff: {gov.importTariff}%</span>}
            {gov.minimumWage > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#22d38a22', color: '#22d38a', padding: '2px 6px', borderRadius: '3px' }}><DollarSign size={10} /> Min Wage: ${gov.minimumWage.toLocaleString()}</span>}
          </div>
        </div>
      )}

      <div className="gov-section">
        <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Scale size={14} color="#e2e8f0" /> ACTIVE LAWS ({activeLaws.length})</div>
        {activeLaws.length === 0
          ? <p style={{ fontSize: '9px', color: '#3e4a5c' }}>No laws on the floor.</p>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {activeLaws.map((law: any) => (
                <div key={law.id} className="gov-law">
                  <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>{lawLabel(law.lawType)}</div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', margin: '2px 0 4px' }}>
                    {lawDetail(law)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#475569', marginBottom: '4px' }}>
                    <span>By: {law.proposedBy}</span>
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
