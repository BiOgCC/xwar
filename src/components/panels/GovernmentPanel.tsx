import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../stores/governmentStore'
import type { LawType, NuclearFund } from '../../stores/governmentStore'
import { useWorldStore } from '../../stores/worldStore'
import { useCompanyStore } from '../../stores/companyStore'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useUIStore } from '../../stores/uiStore'
import { useBattleStore } from '../../stores/battleStore'

export default function GovernmentPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const companyStore = useCompanyStore()
  const inventory = useInventoryStore()
  const ui = useUIStore()

  const [lawType, setLawType] = useState<LawType>('declare_war')
  const [targetIso, setTargetIso] = useState<string>('')
  const [taxValue, setTaxValue] = useState<number>(10)
  const [nukeTarget, setNukeTarget] = useState<string>('')
  const [donateResource, setDonateResource] = useState<keyof NuclearFund>('oil')
  const [donateAmount, setDonateAmount] = useState<number>(100)

  // Determine player's country government
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  
  if (!gov) {
    return <div style={{ color: '#fff', padding: '16px' }}>Government data unavailable for {iso}.</div>
  }

  const isPresident = gov.president === player.name
  const isCongress = gov.congress.includes(player.name)
  const isOfficial = isPresident || isCongress

  const needsTarget = lawType === 'declare_war' || lawType === 'propose_peace' || lawType === 'declare_sworn_enemy'

  const handleProposeLaw = () => {
    if (!isOfficial) {
      ui.addFloatingText('NOT IN OFFICE', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    if (needsTarget && !targetIso) {
      ui.addFloatingText('SELECT TARGET COUNTRY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    govStore.proposeLaw({
      countryId: iso,
      proposerId: player.name,
      type: lawType,
      targetCountryId: needsTarget ? targetIso : undefined,
      newValue: lawType === 'tax_change' ? taxValue : undefined,
    })

    ui.addFloatingText('LAW PROPOSED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    setTargetIso('')
  }

  // Find active laws for this country
  const activeLaws = Object.values(govStore.laws).filter(l => l.countryId === iso && l.status === 'active')

  const handleVote = (lawId: string, vote: 'for' | 'against') => {
    govStore.voteOnLaw(lawId, player.name, vote)
    
    setTimeout(() => {
       const updatedLaw = useGovernmentStore.getState().laws[lawId]
       if (updatedLaw?.status === 'passed') {
         const updatedGov = useGovernmentStore.getState().governments[iso]
         if (updatedLaw.type === 'declare_war' && updatedLaw.targetCountryId) {
            useWorldStore.getState().declareWar(iso, updatedLaw.targetCountryId!)
            ui.addFloatingText('WAR DECLARED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
         } else if (updatedLaw.type === 'tax_change' && updatedLaw.newValue !== undefined) {
            // Update tax rate in government
            useGovernmentStore.setState((s) => ({
              governments: {
                ...s.governments,
                [iso]: { ...s.governments[iso], taxRate: updatedLaw.newValue! }
              }
            }))
            ui.addFloatingText(`TAX SET TO ${updatedLaw.newValue}%`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
         } else if (updatedLaw.type === 'declare_sworn_enemy' && updatedLaw.targetCountryId) {
            useGovernmentStore.setState((s) => ({
              governments: {
                ...s.governments,
                [iso]: { ...s.governments[iso], swornEnemy: updatedLaw.targetCountryId! }
              }
            }))
            ui.addFloatingText(`SWORN ENEMY: ${updatedLaw.targetCountryId}`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
         } else if (updatedLaw.type === 'authorize_nuclear_action') {
            // Check if nuclear fund is sufficient
            const fund = updatedGov?.nuclearFund
            if (fund && fund.oil >= NUKE_COST.oil && fund.scraps >= NUKE_COST.scraps &&
                fund.materialX >= NUKE_COST.materialX && fund.bitcoin >= NUKE_COST.bitcoin &&
                fund.jets >= NUKE_COST.jets) {
              useGovernmentStore.setState((s) => ({
                governments: {
                  ...s.governments,
                  [iso]: { ...s.governments[iso], nuclearAuthorized: true }
                }
              }))
              ui.addFloatingText('☢️ NUCLEAR ACTION AUTHORIZED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
            } else {
              ui.addFloatingText('INSUFFICIENT FUND', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
            }
         }
       }
    }, 50)
  }

  const handleDonate = () => {
    // Check if player has enough resources
    const p = usePlayerStore.getState()
    const resourceMap: Record<keyof NuclearFund, number> = {
      oil: p.oil,
      scraps: p.scrap,
      materialX: p.materialX,
      bitcoin: p.bitcoin,
      jets: 0,
    }

    // For jets, count T6 weapons
    const inv = useInventoryStore.getState()
    if (donateResource === 'jets') {
      const jets = inv.items.filter(i => i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      resourceMap.jets = jets.length
    }

    if (resourceMap[donateResource] < donateAmount) {
      ui.addFloatingText('NOT ENOUGH RESOURCES', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    // Deduct from player
    if (donateResource === 'oil') p.spendOil(donateAmount)
    else if (donateResource === 'scraps') p.spendScraps(donateAmount)
    else if (donateResource === 'materialX') p.spendMaterialX(donateAmount)
    else if (donateResource === 'bitcoin') p.spendBitcoin(donateAmount)
    else if (donateResource === 'jets') {
      // Remove jets from inventory
      const jets = inv.items.filter(i => i.tier === 't6' && i.slot === 'weapon' && !i.equipped)
      for (let i = 0; i < Math.min(donateAmount, jets.length); i++) {
        inv.removeItem(jets[i].id)
      }
    }

    govStore.donateToFund(iso, donateResource, donateAmount)
    ui.addFloatingText(`DONATED ${donateAmount} ${donateResource.toUpperCase()}`, window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
  }

  const handleNuke = () => {
    if (!gov.nuclearAuthorized || !nukeTarget) {
      ui.addFloatingText('NOT AUTHORIZED OR NO TARGET', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    // Launch nuke via government store (deducts fund + revokes auth)
    govStore.launchNuke(iso, nukeTarget)

    // Deal 1 million damage to the region via battle store
    const battleStore = useBattleStore.getState()
    const targetCountry = world.getCountry(nukeTarget)
    if (targetCountry) {
      // Try to find an active battle, or launch one
      let battle = Object.values(battleStore.battles).find(
        b => b.regionName === targetCountry.name && b.status === 'active'
      )
      if (!battle) {
        battleStore.launchAttack(iso, nukeTarget, targetCountry.name)
        battle = Object.values(useBattleStore.getState().battles).find(
          b => b.regionName === targetCountry.name && b.status === 'active'
        )
      }
      if (battle) {
        battleStore.addDamage(battle.id, 'attacker', 1000000, false, false, `☢️ NUKE from ${iso}`)
      }
    }

    // Disable 50% of companies in target country
    const disabled = companyStore.nukeCountry(nukeTarget)

    ui.addFloatingText(`☢️ NUKED ${nukeTarget}! ${disabled} companies disabled!`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
  }

  const fund = gov.nuclearFund
  const fundMet = fund.oil >= NUKE_COST.oil && fund.scraps >= NUKE_COST.scraps &&
    fund.materialX >= NUKE_COST.materialX && fund.bitcoin >= NUKE_COST.bitcoin &&
    fund.jets >= NUKE_COST.jets

  const lawTypeLabel: Record<string, string> = {
    declare_war: '⚔️ Declare War',
    propose_peace: '🕊️ Propose Peace',
    tax_change: '💰 Change Tax Rate',
    declare_sworn_enemy: '🎯 Declare Sworn Enemy',
    authorize_nuclear_action: '☢️ Authorize Nuclear Action',
  }

  return (
    <div className="gov-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* ====== NUKE BUTTON ====== */}
      <div className="hud-card" style={{ borderColor: gov.nuclearAuthorized ? '#ef4444' : '#333' }}>
        <div className="hud-card__title" style={{ color: gov.nuclearAuthorized ? '#ef4444' : '#555' }}>
          ☢️ NUCLEAR STRIKE
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <select
            value={nukeTarget}
            onChange={(e) => setNukeTarget(e.target.value)}
            disabled={!gov.nuclearAuthorized}
            style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '8px', fontFamily: 'var(--font-mono)' }}
          >
            <option value="" disabled>Select Target...</option>
            {world.countries.filter(c => c.code !== iso).map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={handleNuke}
            disabled={!gov.nuclearAuthorized || !nukeTarget}
            style={{
              padding: '8px 20px',
              fontWeight: 900,
              fontSize: '14px',
              letterSpacing: '2px',
              border: '2px solid',
              borderRadius: '4px',
              cursor: gov.nuclearAuthorized ? 'pointer' : 'not-allowed',
              background: gov.nuclearAuthorized ? '#dc2626' : '#333',
              color: gov.nuclearAuthorized ? '#fff' : '#666',
              borderColor: gov.nuclearAuthorized ? '#ef4444' : '#444',
              textShadow: gov.nuclearAuthorized ? '0 0 8px rgba(239,68,68,0.5)' : 'none',
              boxShadow: gov.nuclearAuthorized ? '0 0 16px rgba(239,68,68,0.3)' : 'none',
            }}
          >
            ☢️ NUKE
          </button>
        </div>
        {!gov.nuclearAuthorized && (
          <p style={{ fontSize: '9px', color: '#666', marginTop: '6px' }}>
            Requires congress authorization via &quot;Authorize Nuclear Action&quot; law + funded nuclear program
          </p>
        )}
      </div>

      {/* ====== NUCLEAR FUND ====== */}
      <div className="hud-card">
        <div className="hud-card__title">🏗️ NUCLEAR FUND</div>
        <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px' }}>
          Citizens must donate resources to fund the nuclear program. Required: 10K Oil, 10K Scraps, 10K MatX, 100₿, 1 Jet (T6 Weapon).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
          {([
            ['oil', '🛢️ Oil', fund.oil, NUKE_COST.oil],
            ['scraps', '🔩 Scraps', fund.scraps, NUKE_COST.scraps],
            ['materialX', '⚛️ MatX', fund.materialX, NUKE_COST.materialX],
            ['bitcoin', '₿ Bitcoin', fund.bitcoin, NUKE_COST.bitcoin],
            ['jets', '✈️ Jets', fund.jets, NUKE_COST.jets],
          ] as [string, string, number, number][]).map(([key, label, current, required]) => (
            <div key={key} style={{
              fontSize: '10px',
              padding: '4px 8px',
              background: current >= required ? 'rgba(34,211,138,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${current >= required ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '4px',
              color: current >= required ? '#22d38a' : '#94a3b8',
            }}>
              {label}: {current.toLocaleString()}/{required.toLocaleString()} {current >= required ? '✓' : ''}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select
            value={donateResource}
            onChange={(e) => setDonateResource(e.target.value as keyof NuclearFund)}
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          >
            <option value="oil">Oil</option>
            <option value="scraps">Scraps</option>
            <option value="materialX">Material X</option>
            <option value="bitcoin">Bitcoin</option>
            <option value="jets">Jets (T6 Weapon)</option>
          </select>
          <input
            type="number"
            value={donateAmount}
            onChange={(e) => setDonateAmount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: '70px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          />
          <button className="hud-btn-primary" onClick={handleDonate} style={{ fontSize: '10px', padding: '6px 12px' }}>
            DONATE
          </button>
        </div>
      </div>

      {/* HEADER -> ELECTIONS */}
      <div className="hud-card">
        <div className="hud-card__title">🗳️ ELECTION CYCLE</div>
        <p className="hud-card__text" style={{ fontSize: '12px', color: '#94a3b8' }}>
          Next election is approaching. Top voted candidate becomes President, next 5 become Congress.
        </p>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
           <button 
             className="hud-btn-outline" 
             onClick={() => {
                govStore.registerCandidate(iso, player.name, player.name)
                ui.addFloatingText('REGISTERED FOR ELECTION', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
             }}
           >
             RUN FOR OFFICE
           </button>
        </div>
      </div>

      {/* OFFICE HOLDERS */}
      <div className="hud-card">
        <div className="hud-card__title">🏛️ CURRENT GOVERNMENT</div>
        <div style={{ background: 'rgba(34, 211, 138, 0.05)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(34, 211, 138, 0.2)', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: '#22d38a', fontWeight: 'bold', marginBottom: '4px' }}>PRESIDENT</div>
          <div style={{ fontSize: '14px', color: '#fff' }}>{gov.president || 'Vacant'}</div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          <div style={{ flex: 1, background: 'rgba(245,158,11,0.05)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 'bold' }}>TAX RATE</div>
            <div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{gov.taxRate}%</div>
          </div>
          <div style={{ flex: 1, background: gov.swornEnemy ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: `1px solid ${gov.swornEnemy ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'}` }}>
            <div style={{ fontSize: '9px', color: gov.swornEnemy ? '#ef4444' : '#666', fontWeight: 'bold' }}>SWORN ENEMY</div>
            <div style={{ fontSize: '14px', color: gov.swornEnemy ? '#ef4444' : '#555' }}>{gov.swornEnemy || 'None'}</div>
          </div>
        </div>
        
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', marginTop: '12px' }}>CONGRESS (5 SEATS)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {gov.congress.map((member, idx) => (
             <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px' }}>
               {member}
             </div>
          ))}
          {gov.congress.length === 0 && <span style={{ fontSize: '12px', color: '#64748b' }}>Congress is currently empty.</span>}
        </div>
      </div>

      {/* PROPOSE LAW */}
      {isOfficial && (
        <div className="hud-card">
          <div className="hud-card__title">📜 PROPOSE LAW</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
             <select 
                value={lawType} 
                onChange={(e) => setLawType(e.target.value as LawType)}
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '8px', fontFamily: 'var(--font-mono)' }}
             >
               <option value="declare_war">⚔️ Declare War</option>
               <option value="propose_peace">🕊️ Propose Peace</option>
               <option value="tax_change">💰 Change Tax Rate</option>
               <option value="declare_sworn_enemy">🎯 Declare Sworn Enemy</option>
               <option value="authorize_nuclear_action">☢️ Authorize Nuclear Action</option>
             </select>
             
             {needsTarget && (
               <select 
                  value={targetIso} 
                  onChange={(e) => setTargetIso(e.target.value)}
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '8px', fontFamily: 'var(--font-mono)' }}
               >
                 <option value="" disabled>Select Target Country...</option>
                 {world.countries.filter(c => c.code !== iso).map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                 ))}
               </select>
             )}

             {lawType === 'tax_change' && (
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <span style={{ fontSize: '11px', color: '#94a3b8' }}>New Tax Rate:</span>
                 <input
                   type="number"
                   min={0}
                   max={100}
                   value={taxValue}
                   onChange={(e) => setTaxValue(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                   style={{ width: '80px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)' }}
                 />
                 <span style={{ fontSize: '11px', color: '#94a3b8' }}>%</span>
               </div>
             )}

             {lawType === 'authorize_nuclear_action' && (
               <p style={{ fontSize: '10px', color: '#f59e0b', margin: '0' }}>
                 ⚠️ Requires nuclear fund to be fully funded before authorization takes effect.
               </p>
             )}

             <button className="hud-btn-primary" onClick={handleProposeLaw} style={{ marginTop: '4px' }}>
               SUBMIT TO CONGRESS
             </button>
          </div>
        </div>
      )}

      {/* ACTIVE LAWS & VOTING */}
      <div className="hud-card">
        <div className="hud-card__title">⚖️ ACTIVE LAWS (CONGRESS VOTING)</div>
        {activeLaws.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>No laws currently on the floor.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {activeLaws.map(law => (
              <div key={law.id} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', padding: '12px', borderRadius: '4px' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  {lawTypeLabel[law.type] || law.type.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: '13px', color: '#fff', marginBottom: '8px' }}>
                  {law.targetCountryId ? `Target: ${law.targetCountryId}` : ''}
                  {law.type === 'tax_change' && law.newValue !== undefined ? `New Rate: ${law.newValue}%` : ''}
                  {law.type === 'authorize_nuclear_action' ? (fundMet ? '✅ Fund Ready' : '❌ Fund Insufficient') : ''}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
                   <span>Proposed By: {law.proposerId}</span>
                   <span>YEA: {law.votesFor.length} | NAY: {law.votesAgainst.length}</span>
                </div>

                {isCongress && !law.votesFor.includes(player.name) && !law.votesAgainst.includes(player.name) && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="hud-btn-outline" style={{ borderColor: '#22d38a', color: '#22d38a', flex: 1 }} onClick={() => handleVote(law.id, 'for')}>
                      VOTE AYE (YEA)
                    </button>
                    <button className="hud-btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444', flex: 1 }} onClick={() => handleVote(law.id, 'against')}>
                      VOTE NAY
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
