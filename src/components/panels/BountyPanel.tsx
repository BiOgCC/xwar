import { useState, useMemo, useEffect } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useBountyStore, type RaidBossEvent } from '../../stores/bountyStore'
import { useUIStore } from '../../stores/uiStore'
import { api } from '../../api/client'
import BountyBattleCard from '../shared/BountyBattleCard'
import '../../styles/bounty.css'

type BountyTab = 'board' | 'npc_hunts' | 'place' | 'history'

const INITIAL_VISIBLE = 2

function NpcHuntList({ raidEvents }: { raidEvents: RaidBossEvent[] }) {
  const [expanded, setExpanded] = useState(false)

  if (raidEvents.length === 0) {
    return (
      <div className="bounty-npc-list">
        <div className="bounty-empty">No raid bosses active. Check back soon — new targets spawn every 12 hours.</div>
      </div>
    )
  }

  const alwaysVisible = raidEvents.slice(0, INITIAL_VISIBLE)
  const hidden = raidEvents.slice(INITIAL_VISIBLE)
  const hiddenCount = hidden.length

  return (
    <div className="bounty-npc-list">
      {alwaysVisible.map(evt => (
        <BountyBattleCard key={evt.id} event={evt} />
      ))}

      {hiddenCount > 0 && (
        <button
          className="bounty-expand-btn"
          onClick={() => setExpanded(prev => !prev)}
        >
          {expanded
            ? '▼ SHOW LESS'
            : `▲ SHOW ${hiddenCount} MORE BATTLE${hiddenCount > 1 ? 'S' : ''}`}
        </button>
      )}

      {expanded && hidden.map(evt => (
        <BountyBattleCard key={evt.id} event={evt} />
      ))}
    </div>
  )
}

export default function BountyPanel() {
  const player = usePlayerStore()
  const bounty = useBountyStore()
  const activeBounties = bounty.getActiveBounties()
  const bountyDefaultTab = useUIStore(s => s.bountyDefaultTab)
  const setBountyDefaultTab = useUIStore(s => s.setBountyDefaultTab)

  const [tab, setTab] = useState<BountyTab>(bountyDefaultTab as BountyTab || 'board')
  const [targetName, setTargetName] = useState('')
  const [targetCountry, setTargetCountry] = useState('')
  const [amount, setAmount] = useState(50000)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [hunterViewId, setHunterViewId] = useState<string | null>(null)

  const [allPlayers, setAllPlayers] = useState<{name: string, country: string}[]>([])

  // Auto-switch to tab from external trigger (slider/news click)
  useEffect(() => {
    if (bountyDefaultTab) {
      setTab(bountyDefaultTab as BountyTab)
      setBountyDefaultTab(null)
    }
  }, [bountyDefaultTab, setBountyDefaultTab])

  useEffect(() => {
    bounty.fetchActiveBounties()
    bounty.fetchActiveRaid()
    bounty.rotateNPCBounties()
    api.get('/player/all')
      .then((res: any) => {
        if (res.success && res.players) {
          setAllPlayers(res.players)
        }
      })
      .catch(err => console.error('Failed to load player directory:', err))

    // Poll raid boss state every 10s
    const raidPoll = setInterval(() => {
      bounty.fetchActiveRaid()
    }, 10_000)
    return () => clearInterval(raidPoll)
  }, [])

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) return allPlayers
    const q = searchQuery.toLowerCase()
    return allPlayers.filter(p => p.name.toLowerCase().includes(q))
  }, [searchQuery, allPlayers])

  const handleSelectTarget = (name: string, country: string) => {
    setTargetName(name)
    setTargetCountry(country)
    setSearchQuery(name)
    setShowDropdown(false)
  }

  const handlePlace = async () => {
    if (!targetName.trim()) {
      setMessage('Select a target'); setMessageType('error'); return
    }
    const result = await bounty.placeBounty(targetName, targetCountry, amount, reason)
    setMessage(result.message)
    setMessageType(result.success ? 'success' : 'error')
    if (result.success) {
      setTargetName(''); setReason(''); setAmount(50000); setSearchQuery('')
      setTimeout(() => setTab('board'), 1000)
    }
  }

  const handleClaim = async (bountyId: string) => {
    const result = await bounty.claimBounty(bountyId, player.name)
    setMessage(result.message)
    setMessageType(result.success ? 'success' : 'error')
  }

  const handleSubscribe = async (bountyId: string) => {
    const b = bounty.bounties.find(x => x.id === bountyId)
    if (!b) return
    const isHunting = b.hunters.includes(player.name)
    const result = isHunting
      ? await bounty.unsubscribeFromBounty(bountyId)
      : await bounty.subscribeToBounty(bountyId)
    setMessage(result.message)
    setMessageType(result.success ? 'success' : 'error')
  }

  const formatTimeLeft = (expiresAt: number) => {
    const diff = expiresAt - Date.now()
    if (diff <= 0) return 'EXPIRED'
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return `${hours}h ${mins}m`
  }

  return (
    <div className="bounty-panel">

      {/* ═══ HEADER ═══ */}
      <div className="bounty-header">
        <div className="bounty-header__title">BOUNTY BOARD</div>
        <div className="bounty-header__sub">ELIMINATE TARGETS FOR CASH REWARDS</div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="bounty-tabs">
        <button
          className={`bounty-tab ${tab === 'board' ? 'bounty-tab--active' : ''}`}
          onClick={() => setTab('board')}
        >
          PvP Active ({activeBounties.length})
        </button>
        <button
          className={`bounty-tab bounty-tab--npc ${tab === 'npc_hunts' ? 'bounty-tab--active' : ''}`}
          onClick={() => setTab('npc_hunts')}
        >
          🎯 RAID BOSS ({bounty.raidEvents.filter(e => e.status === 'active').length})
        </button>
        <button
          className={`bounty-tab ${tab === 'place' ? 'bounty-tab--active' : ''}`}
          onClick={() => setTab('place')}
        >
          PvP Bounty sign
        </button>
        <button
          className={`bounty-tab ${tab === 'history' ? 'bounty-tab--active' : ''}`}
          onClick={() => setTab('history')}
        >
          HISTORY
        </button>
      </div>

      {/* ═══ STATUS MESSAGE ═══ */}
      {message && (
        <div className={`bounty-message bounty-message--${messageType}`}>
          {message}
        </div>
      )}

      {/* ═══ NPC BOUNTY HUNTS ═══ */}
      {tab === 'npc_hunts' && (
        <NpcHuntList raidEvents={bounty.raidEvents} />
      )}

      {/* ═══ ACTIVE BOUNTIES ═══ */}
      {tab === 'board' && (
        <div className="bounty-list">
          {activeBounties.length === 0 ? (
            <div className="bounty-empty">No active bounties. Be the first to place one.</div>
          ) : (
            activeBounties
              .sort((a, b) => b.amount - a.amount)
              .map(b => {
                const isHunting = b.hunters.includes(player.name)
                const showHunters = hunterViewId === b.id
                return (
                  <div key={b.id} className="bounty-card">
                    <div className="bounty-card__header">
                      <div className="bounty-card__target">
                        <span className="bounty-card__skull">💀</span>
                        <span className="bounty-card__name">{b.targetPlayer}</span>
                        <span className="bounty-card__country">[{b.targetCountry}]</span>
                      </div>
                      <div className="bounty-card__reward">
                        ${b.amount.toLocaleString()}
                      </div>
                    </div>
                    <div className="bounty-card__reason">{b.reason}</div>
                    <div className="bounty-card__footer">
                      <span className="bounty-card__time">⏱ {formatTimeLeft(b.expiresAt)}</span>
                      <span className="bounty-card__by">by {b.placedBy}</span>

                      {/* 📖 Hunter book button */}
                      <button
                        onClick={() => setHunterViewId(showHunters ? null : b.id)}
                        title="View bounty hunters"
                        style={{
                          background: showHunters ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${showHunters ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '4px', padding: '3px 8px', cursor: 'pointer',
                          fontSize: '12px', color: showHunters ? '#f59e0b' : '#94a3b8',
                          display: 'flex', alignItems: 'center', gap: '4px',
                          transition: 'all 0.15s',
                        }}
                      >
                        📖 <span style={{ fontSize: '9px', fontWeight: 700 }}>{b.hunters.length}</span>
                      </button>

                      {/* Subscribe / Hunt button */}
                      <button
                        onClick={() => handleSubscribe(b.id)}
                        style={{
                          background: isHunting ? 'rgba(239,68,68,0.15)' : 'rgba(34,211,138,0.15)',
                          border: `1px solid ${isHunting ? 'rgba(239,68,68,0.3)' : 'rgba(34,211,138,0.3)'}`,
                          borderRadius: '4px', padding: '3px 10px', cursor: 'pointer',
                          fontSize: '9px', fontWeight: 800, letterSpacing: '0.5px',
                          color: isHunting ? '#ef4444' : '#22d38a',
                          fontFamily: 'var(--font-display)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {isHunting ? '✕ WITHDRAW' : '🎯 HUNT'}
                      </button>

                      <button
                        className="bounty-card__claim"
                        onClick={() => handleClaim(b.id)}
                        title="Claim this bounty (must eliminate target)"
                      >
                        CLAIM
                      </button>
                    </div>

                    {/* ═══ HUNTER LIST (expanded) ═══ */}
                    {showHunters && (
                      <div style={{
                        marginTop: '8px', padding: '8px 10px', borderRadius: '5px',
                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                      }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b', letterSpacing: '1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📖 BOUNTY HUNTERS ({b.hunters.length})
                        </div>
                        {b.hunters.length === 0 ? (
                          <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>
                            No hunters yet. Be the first to take the contract!
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {b.hunters.map(h => (
                              <span key={h} style={{
                                padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 700,
                                background: h === player.name ? 'rgba(34,211,138,0.15)' : 'rgba(255,255,255,0.06)',
                                border: `1px solid ${h === player.name ? 'rgba(34,211,138,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                color: h === player.name ? '#22d38a' : '#e2e8f0',
                              }}>
                                🎯 {h} {h === player.name && <span style={{ fontSize: '7px', color: '#22d38a' }}>(YOU)</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      )}

      {/* ═══ PLACE BOUNTY ═══ */}
      {tab === 'place' && (
        <div className="bounty-form">
          <div className="bounty-form__label">TARGET</div>

          {/* Search input with autocomplete dropdown */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              className="bounty-form__input"
              type="text"
              placeholder="🔍 Search player name..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setShowDropdown(true)
                // Clear selection if user edits
                if (targetName && e.target.value !== targetName) {
                  setTargetName('')
                  setTargetCountry('')
                }
              }}
              onFocus={() => setShowDropdown(true)}
              style={{ marginBottom: 0 }}
            />

            {/* Selected indicator */}
            {targetName && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px',
                padding: '6px 10px', borderRadius: '4px',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              }}>
                <span style={{ fontSize: '14px' }}>💀</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-display)' }}>
                  {targetName}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>[{targetCountry}]</span>
                <button
                  onClick={() => { setTargetName(''); setTargetCountry(''); setSearchQuery('') }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 700 }}
                >✕</button>
              </div>
            )}

            {/* Dropdown */}
            {showDropdown && !targetName && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                maxHeight: '180px', overflowY: 'auto',
                background: '#1a1f2e', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '0 0 6px 6px', borderTop: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}>
                {filteredPlayers.length === 0 ? (
                  <div style={{ padding: '10px', fontSize: '10px', color: '#475569', textAlign: 'center' }}>
                    No players found matching "{searchQuery}"
                  </div>
                ) : (
                  filteredPlayers.map(p => (
                    <button
                      key={p.name}
                      onClick={() => handleSelectTarget(p.name, p.country)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: 'transparent', cursor: 'pointer',
                        color: '#e2e8f0', fontSize: '11px', fontWeight: 600,
                        transition: 'background 0.1s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ fontSize: '14px' }}>💀</span>
                      <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700 }}>{p.name}</span>
                      <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 400 }}>[{p.country}]</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bounty-form__label">REWARD AMOUNT</div>
          <div className="bounty-form__amounts">
            {[10_000, 50_000, 100_000, 250_000, 500_000].map(a => (
              <button
                key={a}
                className={`bounty-form__amt-btn ${amount === a ? 'bounty-form__amt-btn--active' : ''}`}
                onClick={() => setAmount(a)}
              >
                ${a >= 1000 ? `${a/1000}K` : a}
              </button>
            ))}
          </div>

          <div className="bounty-form__label">REASON (optional)</div>
          <input
            className="bounty-form__input"
            type="text"
            placeholder="Wanted for..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={60}
          />

          <div className="bounty-form__summary">
            <span>Your balance: <strong>${player.money.toLocaleString()}</strong></span>
            <span>Bounty cost: <strong className="bounty-form__cost">${amount.toLocaleString()}</strong></span>
          </div>

          <button
            className="bounty-form__submit"
            disabled={!targetName || player.money < amount}
            onClick={handlePlace}
          >
            PLACE ${amount.toLocaleString()} BOUNTY ON {targetName || '???'}
          </button>
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      {tab === 'history' && (
        <div className="bounty-history">
          {bounty.claimedHistory.length === 0 ? (
            <div className="bounty-empty">No bounties claimed yet.</div>
          ) : (
            bounty.claimedHistory.map(b => (
              <div key={b.id} className="bounty-history__item">
                <span className="bounty-history__target">💀 {b.targetPlayer}</span>
                <span className="bounty-history__reward">${b.amount.toLocaleString()}</span>
                <span className="bounty-history__by">claimed by {b.claimedBy}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ BALANCE ═══ */}
      <div className="bounty-balance">
        BALANCE: <span className="bounty-balance__val">${player.money.toLocaleString()}</span>
      </div>
    </div>
  )
}
