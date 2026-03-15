import React, { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import type { LawType } from '../../stores/governmentStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'

export default function GovernmentPanel() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const ui = useUIStore()

  const [lawType, setLawType] = useState<LawType>('declare_war')
  const [targetIso, setTargetIso] = useState<string>('')

  // Determine player's country government
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  
  if (!gov) {
    return <div style={{ color: '#fff', padding: '16px' }}>Government data unavailable for {iso}.</div>
  }

  const isPresident = gov.president === player.name
  const isCongress = gov.congress.includes(player.name)
  const isOfficial = isPresident || isCongress

  const handleProposeLaw = () => {
    if (!isOfficial) {
      ui.addFloatingText('NOT IN OFFICE', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    if ((lawType === 'declare_war' || lawType === 'propose_peace') && !targetIso) {
      ui.addFloatingText('SELECT TARGET COUNTRY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }

    govStore.proposeLaw({
      countryId: iso,
      proposerId: player.name, // Using name as ID for now in this singleplayer mock
      type: lawType,
      targetCountryId: targetIso || undefined,
    })

    ui.addFloatingText('LAW PROPOSED', window.innerWidth / 2, window.innerHeight / 2, '#22d38a')
    setTargetIso('')
  }

  // Find active laws for this country
  const activeLaws = Object.values(govStore.laws).filter(l => l.countryId === iso && l.status === 'active')

  const handleVote = (lawId: string, vote: 'for' | 'against') => {
    govStore.voteOnLaw(lawId, player.name, vote)
    
    // In our mock, if they vote, let's also automatically resolve the law to check if it passed from their single vote 
    // Wait, the store handles majority checks inside voteOnLaw automatically!
    
    // BUT we must also execute the effect if it passed!
    // Since Zustand effects are tricky without middleware, we'll manually check it immediately after dispatch.
    
    // A slight hack to let Zustand update first, then evaluate side effects:
    setTimeout(() => {
       const updatedLaw = useGovernmentStore.getState().laws[lawId]
       if (updatedLaw?.status === 'passed') {
         if (updatedLaw.type === 'declare_war' && updatedLaw.targetCountryId) {
            useWorldStore.getState().declareWar(iso, updatedLaw.targetCountryId!)
            ui.addFloatingText('WAR DECLARED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
         }
         // More law effects could go here...
       }
    }, 50)
  }

  return (
    <div className="gov-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
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
               <option value="declare_war">Declare War</option>
               <option value="propose_peace">Propose Peace</option>
             </select>
             
             {(lawType === 'declare_war' || lawType === 'propose_peace') && (
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
                <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>{law.type.replace('_', ' ')}</div>
                <div style={{ fontSize: '13px', color: '#fff', marginBottom: '8px' }}>Target: {law.targetCountryId || 'None'}</div>
                
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
