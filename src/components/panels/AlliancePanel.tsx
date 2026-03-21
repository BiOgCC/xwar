import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useAllianceStore } from '../../stores/allianceStore'
import type { Alliance, AllianceFundProposal } from '../../stores/allianceStore'
import '../../styles/alliance.css'

export default function AlliancePanel() {
  const player = usePlayerStore()
  const allianceStore = useAllianceStore()
  const myAlliance = allianceStore.getPlayerAlliance()

  useEffect(() => {
    allianceStore.fetchAlliances()
  }, [])

  const [tab, setTab] = useState<'overview' | 'wars' | 'congress' | 'browse'>('overview')
  const [createName, setCreateName] = useState('')
  const [createTag, setCreateTag] = useState('')
  const [contributeAmt, setContributeAmt] = useState(100000)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [warTarget, setWarTarget] = useState('')
  // Congress state
  const [transferDirection, setTransferDirection] = useState<'to_country' | 'to_alliance'>('to_country')
  const [transferCountry, setTransferCountry] = useState('')
  const [transferAmount, setTransferAmount] = useState(100000)

  const showMsg = (msg: string, type: 'success' | 'error') => {
    setMessage(msg); setMessageType(type)
  }

  // ═══ NOT IN AN ALLIANCE ═══
  if (!myAlliance) {
    return (
      <div className="alliance-panel">
        <div className="alliance-header">
          <div className="alliance-header__title">ALLIANCES</div>
          <div className="alliance-header__sub">JOIN OR CREATE A MILITARY COALITION</div>
        </div>

        {message && <div className={`alliance-msg alliance-msg--${messageType}`}>{message}</div>}

        {/* Create form */}
        <div className="alliance-create">
          <div className="alliance-create__title">CREATE ALLIANCE — $500K</div>
          <input className="alliance-input" placeholder="Alliance Name" value={createName} onChange={e => setCreateName(e.target.value)} maxLength={24} />
          <input className="alliance-input" placeholder="TAG (2-4 chars)" value={createTag} onChange={e => setCreateTag(e.target.value.toUpperCase())} maxLength={4} />
          <button
            className="alliance-btn alliance-btn--create"
            disabled={player.money < 500_000 || createName.length < 3 || createTag.length < 2}
            onClick={async () => {
              const r = await allianceStore.createAlliance(createName, createTag)
              showMsg(r.message, r.success ? 'success' : 'error')
            }}
          >
            CREATE [{createTag || '??'}] {createName || '???'}
          </button>
        </div>

        {/* Browse existing */}
        <div className="alliance-browse">
          <div className="alliance-browse__title">EXISTING ALLIANCES</div>
          {allianceStore.alliances.map(a => (
            <AllianceCard key={a.id} alliance={a} onJoin={async () => {
              const r = await allianceStore.joinAlliance(a.id)
              showMsg(r.message, r.success ? 'success' : 'error')
            }} />
          ))}
        </div>
      </div>
    )
  }

  // ═══ IN AN ALLIANCE ═══
  return (
    <div className="alliance-panel">
      {/* Header */}
      <div className="alliance-header">
        <div className="alliance-header__tag">[{myAlliance.tag}]</div>
        <div className="alliance-header__title">{myAlliance.name}</div>
        <div className="alliance-header__sub">
          {myAlliance.wins}W / {myAlliance.losses}L • {myAlliance.members.length}/{myAlliance.maxMembers} members
        </div>
      </div>

      {/* Tabs */}
      <div className="alliance-tabs">
        <button className={`alliance-tab ${tab === 'overview' ? 'alliance-tab--active' : ''}`} onClick={() => setTab('overview')}>
          OVERVIEW
        </button>
        <button className={`alliance-tab ${tab === 'wars' ? 'alliance-tab--active' : ''}`} onClick={() => setTab('wars')}>
          WARS ({myAlliance.wars.filter(w => w.status === 'active' || w.status === 'voting').length})
        </button>
        <button className={`alliance-tab ${tab === 'congress' ? 'alliance-tab--active' : ''}`} onClick={() => setTab('congress')}>
          CONGRESS ({allianceStore.fundProposals.filter(p => p.status === 'voting').length})
        </button>
        <button className={`alliance-tab ${tab === 'browse' ? 'alliance-tab--active' : ''}`} onClick={() => setTab('browse')}>
          ALL ALLIANCES
        </button>
      </div>

      {message && <div className={`alliance-msg alliance-msg--${messageType}`}>{message}</div>}

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === 'overview' && (
        <>
          {/* Treasury */}
          <div className="alliance-treasury">
            <div className="alliance-treasury__label">SHARED TREASURY</div>
            <div className="alliance-treasury__value">${myAlliance.treasury.toLocaleString()}</div>
            <div className="alliance-treasury__contribute">
              <div className="alliance-treasury__amounts">
                {[50_000, 100_000, 250_000, 500_000].map(a => (
                  <button
                    key={a}
                    className={`alliance-amt-btn ${contributeAmt === a ? 'alliance-amt-btn--active' : ''}`}
                    onClick={() => setContributeAmt(a)}
                  >
                    ${a >= 1000 ? `${a/1000}K` : a}
                  </button>
                ))}
              </div>
              <button
                className="alliance-btn alliance-btn--contribute"
                disabled={player.money < contributeAmt}
                onClick={async () => {
                  const r = await allianceStore.contribute(contributeAmt)
                  showMsg(r.message, r.success ? 'success' : 'error')
                }}
              >
                CONTRIBUTE ${contributeAmt.toLocaleString()}
              </button>
              {myAlliance.leader === player.name && (
                <button
                  className="alliance-btn alliance-btn--leave" style={{marginTop: '8px'}}
                  onClick={async () => {
                    const r = await allianceStore.withdraw(contributeAmt)
                    showMsg(r.message, r.success ? 'success' : 'error')
                  }}
                >
                  WITHDRAW ${contributeAmt.toLocaleString()}
                </button>
              )}
            </div>
          </div>

          {/* Member list */}
          <div className="alliance-members">
            <div className="alliance-members__title">MEMBERS</div>
            {myAlliance.members
              .sort((a, b) => b.contributed - a.contributed)
              .map(m => (
              <div key={m.name} className="alliance-member">
                <span className="alliance-member__role">
                  {m.role === 'leader' ? '👑' : m.role === 'officer' ? '⭐' : '•'}
                </span>
                <span className="alliance-member__name">{m.name}</span>
                <span className="alliance-member__country">[{m.countryCode}]</span>
                <span className="alliance-member__contribution">${m.contributed.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Leave button */}
          <button
            className="alliance-btn alliance-btn--leave"
            onClick={() => {
              const r = allianceStore.leaveAlliance()
              showMsg(r.message, r.success ? 'success' : 'error')
            }}
          >
            {myAlliance.members.length === 1 ? 'DISBAND ALLIANCE' : 'LEAVE ALLIANCE'}
          </button>
        </>
      )}

      {/* ═══ WARS TAB ═══ */}
      {tab === 'wars' && (
        <>
          {/* Declare war */}
          {myAlliance.leader === player.name && (
            <div className="alliance-war-declare">
              <div className="alliance-war-declare__title">DECLARE WAR</div>
              <div className="alliance-war-declare__targets">
                {allianceStore.alliances
                  .filter(a => a.id !== myAlliance.id)
                  .map(a => (
                    <button
                      key={a.id}
                      className={`alliance-target-btn ${warTarget === a.id ? 'alliance-target-btn--active' : ''}`}
                      onClick={() => setWarTarget(a.id)}
                    >
                      [{a.tag}] {a.name}
                    </button>
                  ))
                }
              </div>
              <button
                className="alliance-btn alliance-btn--war"
                disabled={!warTarget}
                onClick={() => {
                  const r = allianceStore.declareWar(warTarget)
                  showMsg(r.message, r.success ? 'success' : 'error')
                  if (r.success) setWarTarget('')
                }}
              >
                ⚔️ DECLARE WAR
              </button>
            </div>
          )}

          {/* Active wars */}
          <div className="alliance-wars">
            {myAlliance.wars.length === 0 ? (
              <div className="alliance-empty">No wars. Peace reigns... for now.</div>
            ) : (
              myAlliance.wars.map(w => (
                <div key={w.id} className={`alliance-war-card alliance-war-card--${w.status}`}>
                  <div className="alliance-war-card__header">
                    <span className="alliance-war-card__vs">VS [{w.targetAllianceName}]</span>
                    <span className={`alliance-war-card__status alliance-war-card__status--${w.status}`}>
                      {w.status.toUpperCase()}
                    </span>
                  </div>
                  {w.status === 'voting' && (
                    <div className="alliance-war-card__vote">
                      <span>{w.votesFor.length} FOR / {w.votesAgainst.length} AGAINST</span>
                      <div className="alliance-war-card__vote-btns">
                        <button className="alliance-vote-btn alliance-vote-btn--for"
                          onClick={() => { const r = allianceStore.voteWar(w.id, 'for'); showMsg(r.message, r.success ? 'success' : 'error') }}>
                          ✓ FOR
                        </button>
                        <button className="alliance-vote-btn alliance-vote-btn--against"
                          onClick={() => { const r = allianceStore.voteWar(w.id, 'against'); showMsg(r.message, r.success ? 'success' : 'error') }}>
                          ✗ AGAINST
                        </button>
                      </div>
                    </div>
                  )}
                  {(w.status === 'victory' || w.status === 'defeat') && (
                    <div className="alliance-war-card__result">
                      K: {w.kills} / D: {w.deaths}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ═══ CONGRESS TAB ═══ */}
      {tab === 'congress' && (
        <>
          {/* Propose Fund Transfer — leader/officer only */}
          {(() => {
            const myMember = myAlliance.members.find(m => m.name === player.name)
            const canPropose = myMember && (myMember.role === 'leader' || myMember.role === 'officer')
            const memberCountries = [...new Set(myAlliance.members.map(m => m.countryCode))]

            return canPropose ? (
              <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#3b82f6', letterSpacing: '1px', marginBottom: '8px' }}>📝 PROPOSE FUND TRANSFER</div>

                {/* Direction toggle */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  <button
                    className={`alliance-amt-btn ${transferDirection === 'to_country' ? 'alliance-amt-btn--active' : ''}`}
                    onClick={() => setTransferDirection('to_country')}
                    style={{ flex: 1, fontSize: '8px' }}
                  >🏛️ Alliance → National Fund</button>
                  <button
                    className={`alliance-amt-btn ${transferDirection === 'to_alliance' ? 'alliance-amt-btn--active' : ''}`}
                    onClick={() => setTransferDirection('to_alliance')}
                    style={{ flex: 1, fontSize: '8px' }}
                  >🏦 National Fund → Alliance</button>
                </div>

                {/* Country selector */}
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>TARGET COUNTRY</div>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {memberCountries.map(code => (
                      <button key={code}
                        className={`alliance-amt-btn ${transferCountry === code ? 'alliance-amt-btn--active' : ''}`}
                        onClick={() => setTransferCountry(code)}
                        style={{ fontSize: '8px', padding: '2px 8px' }}
                      >🏳️ {code}</button>
                    ))}
                  </div>
                </div>

                {/* Amount */}
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>AMOUNT</div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[50_000, 100_000, 250_000, 500_000, 1_000_000].map(a => (
                      <button key={a}
                        className={`alliance-amt-btn ${transferAmount === a ? 'alliance-amt-btn--active' : ''}`}
                        onClick={() => setTransferAmount(a)}
                        style={{ fontSize: '7px' }}
                      >${a >= 1_000_000 ? `${a/1_000_000}M` : `${a/1000}K`}</button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <button
                  className="alliance-btn alliance-btn--contribute"
                  style={{ fontSize: '9px' }}
                  disabled={!transferCountry}
                  onClick={() => {
                    const r = allianceStore.proposeFundTransfer(transferCountry, transferAmount, transferDirection)
                    showMsg(r.message, r.success ? 'success' : 'error')
                  }}
                >
                  📝 SUBMIT PROPOSAL — ${transferAmount.toLocaleString()} {transferDirection === 'to_country' ? '→ ' + transferCountry : '→ Alliance'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px', marginBottom: '8px' }}>
                Only leaders and officers can propose fund transfers.
              </div>
            )
          })()}

          {/* Active Proposals */}
          <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>🗳️ FUND PROPOSALS ({allianceStore.fundProposals.length})</div>
          {allianceStore.fundProposals.length === 0 ? (
            <div className="alliance-empty">No fund transfer proposals.</div>
          ) : (
            allianceStore.fundProposals.map((p: AllianceFundProposal) => {
              const majority = Math.ceil(myAlliance.members.length / 2)
              const hasVoted = p.votesFor.includes(player.name) || p.votesAgainst.includes(player.name)
              const statusColors: Record<string, string> = { voting: '#3b82f6', passed: '#22d38a', rejected: '#ef4444', expired: '#64748b' }
              const dirLabel = p.direction === 'to_country' ? `Alliance → ${p.targetCountryCode}` : `${p.targetCountryCode} → Alliance`

              return (
                <div key={p.id} style={{
                  background: 'rgba(0,0,0,0.2)', border: `1px solid ${statusColors[p.status]}25`,
                  borderLeft: `3px solid ${statusColors[p.status]}`, borderRadius: '4px',
                  padding: '8px', marginBottom: '4px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>
                        ${p.amount.toLocaleString()} {dirLabel}
                      </div>
                      <div style={{ fontSize: '7px', color: '#64748b' }}>by {p.proposerId} · {new Date(p.proposedAt).toLocaleTimeString()}</div>
                    </div>
                    <span style={{ fontSize: '8px', fontWeight: 900, color: statusColors[p.status], background: `${statusColors[p.status]}18`, padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.5px' }}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Vote progress */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '8px', color: '#22d38a', fontWeight: 700 }}>✓ {p.votesFor.length}</span>
                    <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', height: '100%' }}>
                        <div style={{ width: `${(p.votesFor.length / myAlliance.members.length) * 100}%`, background: '#22d38a', transition: 'width 0.3s' }} />
                        <div style={{ width: `${(p.votesAgainst.length / myAlliance.members.length) * 100}%`, background: '#ef4444', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: 700 }}>✗ {p.votesAgainst.length}</span>
                    <span style={{ fontSize: '7px', color: '#64748b' }}>need {majority}</span>
                  </div>

                  {/* Vote buttons */}
                  {p.status === 'voting' && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="alliance-vote-btn alliance-vote-btn--for"
                        style={{ flex: 1, opacity: hasVoted && !p.votesFor.includes(player.name) ? 0.5 : 1 }}
                        onClick={() => { const r = allianceStore.voteOnFundTransfer(p.id, 'for'); showMsg(r.message, r.success ? 'success' : 'error') }}
                      >✓ FOR</button>
                      <button
                        className="alliance-vote-btn alliance-vote-btn--against"
                        style={{ flex: 1, opacity: hasVoted && !p.votesAgainst.includes(player.name) ? 0.5 : 1 }}
                        onClick={() => { const r = allianceStore.voteOnFundTransfer(p.id, 'against'); showMsg(r.message, r.success ? 'success' : 'error') }}
                      >✗ AGAINST</button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}

      {/* ═══ BROWSE TAB ═══ */}
      {tab === 'browse' && (
        <div className="alliance-browse">
          {allianceStore.alliances.map(a => (
            <AllianceCard key={a.id} alliance={a} isMine={a.id === myAlliance.id} />
          ))}
        </div>
      )}
    </div>
  )
}

function AllianceCard({ alliance, onJoin, isMine }: { alliance: Alliance; onJoin?: () => void; isMine?: boolean }) {
  return (
    <div className={`alliance-card ${isMine ? 'alliance-card--mine' : ''}`}>
      <div className="alliance-card__header">
        <span className="alliance-card__tag">[{alliance.tag}]</span>
        <span className="alliance-card__name">{alliance.name}</span>
      </div>
      <div className="alliance-card__meta">
        <span>{alliance.members.length}/{alliance.maxMembers} members</span>
        <span>{alliance.wins}W/{alliance.losses}L</span>
        <span className="alliance-card__treasury">${alliance.treasury.toLocaleString()}</span>
      </div>
      {onJoin && alliance.members.length < alliance.maxMembers && (
        <button className="alliance-btn alliance-btn--join" onClick={onJoin}>
          JOIN
        </button>
      )}
      {isMine && <div className="alliance-card__badge">YOUR ALLIANCE</div>}
    </div>
  )
}
