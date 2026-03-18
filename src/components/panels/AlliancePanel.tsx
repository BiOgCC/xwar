import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useAllianceStore } from '../../stores/allianceStore'
import type { Alliance } from '../../stores/allianceStore'
import '../../styles/alliance.css'

export default function AlliancePanel() {
  const player = usePlayerStore()
  const allianceStore = useAllianceStore()
  const myAlliance = allianceStore.getPlayerAlliance()

  const [tab, setTab] = useState<'overview' | 'wars' | 'browse'>('overview')
  const [createName, setCreateName] = useState('')
  const [createTag, setCreateTag] = useState('')
  const [contributeAmt, setContributeAmt] = useState(100000)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [warTarget, setWarTarget] = useState('')

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
            onClick={() => {
              const r = allianceStore.createAlliance(createName, createTag)
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
            <AllianceCard key={a.id} alliance={a} onJoin={() => {
              const r = allianceStore.joinAlliance(a.id)
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
                onClick={() => {
                  const r = allianceStore.contribute(contributeAmt)
                  showMsg(r.message, r.success ? 'success' : 'error')
                }}
              >
                CONTRIBUTE ${contributeAmt.toLocaleString()}
              </button>
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
