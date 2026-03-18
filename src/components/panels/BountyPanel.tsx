import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useBountyStore, NPC_TARGETS } from '../../stores/bountyStore'
import '../../styles/bounty.css'

export default function BountyPanel() {
  const player = usePlayerStore()
  const bounty = useBountyStore()
  const activeBounties = bounty.getActiveBounties()

  const [tab, setTab] = useState<'board' | 'place' | 'history'>('board')
  const [targetName, setTargetName] = useState('')
  const [targetCountry, setTargetCountry] = useState('')
  const [amount, setAmount] = useState(50000)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const handlePlace = () => {
    if (!targetName.trim()) {
      setMessage('Select a target'); setMessageType('error'); return
    }
    const result = bounty.placeBounty(targetName, targetCountry, amount, reason)
    setMessage(result.message)
    setMessageType(result.success ? 'success' : 'error')
    if (result.success) {
      setTargetName(''); setReason(''); setAmount(50000)
      setTimeout(() => setTab('board'), 1000)
    }
  }

  const handleClaim = (bountyId: string) => {
    const result = bounty.claimBounty(bountyId, player.name)
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
          ACTIVE ({activeBounties.length})
        </button>
        <button
          className={`bounty-tab ${tab === 'place' ? 'bounty-tab--active' : ''}`}
          onClick={() => setTab('place')}
        >
          PLACE BOUNTY
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

      {/* ═══ ACTIVE BOUNTIES ═══ */}
      {tab === 'board' && (
        <div className="bounty-list">
          {activeBounties.length === 0 ? (
            <div className="bounty-empty">No active bounties. Be the first to place one.</div>
          ) : (
            activeBounties
              .sort((a, b) => b.amount - a.amount)
              .map(b => (
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
                    <button
                      className="bounty-card__claim"
                      onClick={() => handleClaim(b.id)}
                      title="Claim this bounty (must eliminate target)"
                    >
                      CLAIM
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* ═══ PLACE BOUNTY ═══ */}
      {tab === 'place' && (
        <div className="bounty-form">
          <div className="bounty-form__label">TARGET</div>
          <div className="bounty-form__targets">
            {NPC_TARGETS.map(npc => (
              <button
                key={npc.name}
                className={`bounty-form__target-btn ${targetName === npc.name ? 'bounty-form__target-btn--active' : ''}`}
                onClick={() => { setTargetName(npc.name); setTargetCountry(npc.country) }}
              >
                {npc.name} [{npc.country}]
              </button>
            ))}
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
