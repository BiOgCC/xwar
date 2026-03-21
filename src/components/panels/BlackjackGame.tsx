import { useState, useCallback } from 'react'
import { useBlackjackStore, calculateHand, BJ_BETS, type Card } from '../../stores/blackjackStore'
import { usePlayerStore } from '../../stores/playerStore'

/* ── Single playing card ── */
function PlayingCard({ card, delay = 0 }: { card: Card; delay?: number }) {
  const isRed = card.suit === '♥' || card.suit === '♦'
  const suitColor = card.faceUp
    ? isRed ? '#ef4444' : '#e2e8f0'
    : '#3b82f6'

  return (
    <div
      className={`bj-card ${card.faceUp ? '' : 'bj-card--facedown'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {card.faceUp ? (
        <>
          <span className="bj-card__rank" style={{ color: suitColor }}>{card.rank}</span>
          <span className="bj-card__suit" style={{ color: suitColor }}>{card.suit}</span>
        </>
      ) : (
        <span className="bj-card__back">?</span>
      )}
    </div>
  )
}

/* ── Hand display ── */
function Hand({ cards, label, total, showTotal = true }: {
  cards: Card[]
  label: string
  total: number
  showTotal?: boolean
}) {
  return (
    <div className="bj-hand-area">
      <div className="bj-hand-label">
        {label}
        {showTotal && cards.length > 0 && (
          <span className="bj-hand-total">{total}</span>
        )}
      </div>
      <div className="bj-hand">
        {cards.map((card, i) => (
          <PlayingCard key={`${card.rank}${card.suit}${i}`} card={card} delay={i * 150} />
        ))}
      </div>
    </div>
  )
}

export default function BlackjackGame() {
  const bj = useBlackjackStore()
  const player = usePlayerStore()
  const [selectedBet, setSelectedBet] = useState(BJ_BETS[0])
  const [showHelp, setShowHelp] = useState(false)

  const playerTotal = calculateHand(bj.playerHand)
  const dealerTotal = calculateHand(bj.dealerHand)

  const handleBet = useCallback(() => {
    if (player.money < selectedBet) return
    useBlackjackStore.getState().placeBet(selectedBet)
  }, [selectedBet, player.money])

  const handleNewRound = useCallback(() => {
    useBlackjackStore.getState().newRound()
  }, [])

  return (
    <div className="bj-table">

      {/* ═══ STATS BAR ═══ */}
      {bj.handsPlayed > 0 && (
        <div className="bj-stats">
          <span>HANDS: <b>{bj.handsPlayed}</b></span>
          <span className="bj-stats--win">W: <b>{bj.wins}</b></span>
          <span className="bj-stats--lose">L: <b>{bj.losses}</b></span>
          <span className="bj-stats--push">P: <b>{bj.pushes}</b></span>
          {bj.blackjacks > 0 && <span className="bj-stats--bj">BJ: <b>{bj.blackjacks}</b></span>}
        </div>
      )}

      {/* ═══ DEALER HAND ═══ */}
      <Hand
        cards={bj.dealerHand}
        label="DEALER"
        total={dealerTotal}
        showTotal={bj.phase === 'result'}
      />

      {/* ═══ RESULT OVERLAY ═══ */}
      {bj.phase === 'result' && (
        <div className={`bj-result bj-result--${bj.result}`}>
          <div className="bj-result__text">{bj.resultText}</div>
          {bj.payout > 0 && (
            <div className="bj-result__payout">+${bj.payout.toLocaleString()}</div>
          )}
        </div>
      )}

      {/* ═══ PLAYER HAND ═══ */}
      <Hand
        cards={bj.playerHand}
        label="YOU"
        total={playerTotal}
      />

      {/* ═══ BETTING PHASE ═══ */}
      {bj.phase === 'betting' && (
        <div className="bj-betting">
          {/* Money Bet */}
          <div className="bj-bet-chips">
            {BJ_BETS.map(amt => (
              <button
                key={amt}
                className={`bj-chip ${selectedBet === amt ? 'bj-chip--active' : ''}`}
                disabled={player.money < amt}
                onClick={() => setSelectedBet(amt)}
              >
                ${amt >= 1000 ? `${amt / 1000}K` : amt}
              </button>
            ))}
          </div>
          <button
            className="bj-deal-btn"
            disabled={player.money < selectedBet || bj.isRequesting}
            onClick={handleBet}
          >
            {bj.isRequesting ? 'DEALING...' : `DEAL — $${selectedBet >= 1000 ? `${selectedBet / 1000}K` : selectedBet}`}
          </button>
          <div className="bj-balance">
            BALANCE: <span>${player.money.toLocaleString()}</span>
          </div>

          {/* How to Play */}
          <button
            className="bj-how-toggle"
            onClick={() => setShowHelp(h => !h)}
            style={{
              marginTop: '10px', background: 'none', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', color: '#64748b', fontSize: '9px', fontWeight: 700,
              letterSpacing: '1px', padding: '6px 14px', cursor: 'pointer', width: '100%',
              transition: 'all 0.2s',
            }}
          >
            {showHelp ? '▲ HIDE RULES' : '▼ HOW TO PLAY'}
          </button>
          {showHelp && (
            <div style={{
              marginTop: '8px', padding: '12px 14px', background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
              fontSize: '10px', lineHeight: 1.7, color: '#94a3b8',
            }}>
              <div style={{ fontWeight: 900, color: '#e2e8f0', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>🃏 BLACKJACK RULES</div>
              <div style={{ marginBottom: '6px' }}>
                <b style={{ color: '#38bdf8' }}>Goal:</b> Get your cards as close to <b style={{ color: '#f59e0b' }}>21</b> as possible without going over. Beat the dealer's hand to win.
              </div>
              <div style={{ marginBottom: '6px' }}>
                <b style={{ color: '#38bdf8' }}>Card Values:</b><br/>
                • Number cards (2–10) = face value<br/>
                • Face cards (J, Q, K) = <b>10</b><br/>
                • Ace = <b>11</b> or <b>1</b> (automatically adjusted)
              </div>
              <div style={{ marginBottom: '6px' }}>
                <b style={{ color: '#38bdf8' }}>Actions:</b><br/>
                • <b style={{ color: '#22d38a' }}>HIT</b> — Draw another card<br/>
                • <b style={{ color: '#f59e0b' }}>STAND</b> — Keep your hand, dealer plays<br/>
              </div>
              <div style={{ color: '#64748b', fontSize: '9px' }}>
                Blackjack (Ace + 10-value card) pays <b style={{ color: '#22d38a' }}>2.5x</b> your bet. Regular win pays <b style={{ color: '#22d38a' }}>2x</b>. Tie = push (bet returned).
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ PLAYING PHASE ═══ */}
      {bj.phase === 'playing' && (
        <div className="bj-actions">
          <button className="bj-action bj-action--hit" disabled={bj.isRequesting} onClick={() => useBlackjackStore.getState().hit()}>
            {bj.isRequesting ? '...' : 'HIT'}
          </button>
          <button className="bj-action bj-action--stand" disabled={bj.isRequesting} onClick={() => useBlackjackStore.getState().stand()}>
            {bj.isRequesting ? '...' : 'STAND'}
          </button>
        </div>
      )}

      {/* ═══ RESULT PHASE ═══ */}
      {bj.phase === 'result' && (
        <div className="bj-actions">
          <button className="bj-action bj-action--deal" onClick={handleNewRound}>
            NEW HAND
          </button>
        </div>
      )}
    </div>
  )
}
