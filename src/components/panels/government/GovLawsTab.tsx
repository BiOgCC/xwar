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

  if (!gov) return null
  const isPresident = gov.president === player.name
  const isCongress = gov.congress.includes(player.name)
  const isOfficial = isPresident || isCongress
  const needsTarget = lawType === 'declare_war' || lawType === 'propose_peace' || lawType === 'declare_sworn_enemy' || lawType === 'propose_alliance' || lawType === 'break_alliance'
  const activeLaws = Object.values(govStore.laws).filter(l => l.countryId === iso && l.status === 'active')

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
          useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], taxRate: updatedLaw.newValue! } } }))
          ui.addFloatingText(`TAX → ${updatedLaw.newValue}%`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
        } else if (updatedLaw.type === 'declare_sworn_enemy' && updatedLaw.targetCountryId) {
          useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], swornEnemy: updatedLaw.targetCountryId! } } }))
          ui.addFloatingText(`ENEMY: ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
        } else if (updatedLaw.type === 'authorize_nuclear_action') {
          useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], nuclearAuthorized: true } } }))
          ui.addFloatingText('☢️ AUTHORIZED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
        } else if (updatedLaw.type === 'propose_alliance' && updatedLaw.targetCountryId) {
          useGovernmentStore.setState(s => {
            const g1 = s.governments[iso], g2 = s.governments[updatedLaw.targetCountryId!]
            return { governments: { ...s.governments, [iso]: { ...g1, alliances: [...(g1?.alliances || []).filter(a => a !== updatedLaw.targetCountryId), updatedLaw.targetCountryId!] }, ...(g2 ? { [updatedLaw.targetCountryId!]: { ...g2, alliances: [...(g2.alliances || []).filter(a => a !== iso), iso] } } : {}) } }
          })
          ui.addFloatingText(`🤝 ALLIANCE WITH ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#3b82f6')
        } else if (updatedLaw.type === 'break_alliance' && updatedLaw.targetCountryId) {
          useGovernmentStore.setState(s => {
            const g1 = s.governments[iso], g2 = s.governments[updatedLaw.targetCountryId!]
            return { governments: { ...s.governments, [iso]: { ...g1, alliances: (g1?.alliances || []).filter(a => a !== updatedLaw.targetCountryId) }, ...(g2 ? { [updatedLaw.targetCountryId!]: { ...g2, alliances: (g2.alliances || []).filter(a => a !== iso) } } : {}) } }
          })
          ui.addFloatingText(`💔 BROKEN WITH ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
        }
      }
    }, 50)
  }

  return (
    <>
      {isOfficial && (
        <div className="gov-section">
          <div className="gov-section__title gov-section__title--blue">📜 PROPOSE LAW</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <select className="gov-select" value={lawType} onChange={e => setLawType(e.target.value as LawType)}>
              <option value="declare_war">⚔️ Declare War</option>
              <option value="propose_peace">🕊️ Propose Peace</option>
              <option value="tax_change">💰 Change Tax Rate</option>
              <option value="declare_sworn_enemy">🎯 Declare Sworn Enemy</option>
              <option value="propose_alliance">🤝 Propose Alliance</option>
              <option value="break_alliance">💔 Break Alliance</option>
              <option value="authorize_nuclear_action">☢️ Authorize Nuclear Action</option>
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
            {lawType === 'authorize_nuclear_action' && <p style={{ fontSize: '7px', color: '#f59e0b', margin: 0 }}>⚠️ Requires national fund to meet nuke resource requirements.</p>}
            <button className="gov-btn gov-btn--primary" onClick={handleProposeLaw} style={{ width: '100%' }}>SUBMIT TO CONGRESS</button>
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
                  <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>{law.type.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '9px', color: '#94a3b8', margin: '2px 0 4px' }}>
                    {law.targetCountryId && `Target: ${law.targetCountryId}`}
                    {law.type === 'tax_change' && law.newValue !== undefined && `New Rate: ${law.newValue}%`}
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
