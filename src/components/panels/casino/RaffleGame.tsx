import { useEffect, useCallback, useMemo } from 'react'
import { useRaffleStore, TICKET_PRICE, MAX_TICKETS_PER_PLAYER } from '../../../stores/raffleStore'
import { usePlayerStore } from '../../../stores/playerStore'

/* ═══════════════════════════════════════════
   XWAR Casino — Daily Raffle (12-Hour Event)
   Single-player lottery — buy tickets, win big
   ═══════════════════════════════════════════ */

export default function RaffleGame() {
  const raffle = useRaffleStore()
  const player = usePlayerStore()

  // Initialize on mount, cleanup on unmount
  useEffect(() => {
    useRaffleStore.getState()._init()
    return () => {
      useRaffleStore.getState()._cleanup()
    }
  }, [])

  const canBuy = raffle.phase === 'buying'
    && raffle.playerTicketCount < MAX_TICKETS_PER_PLAYER
    && player.money >= TICKET_PRICE

  const handleBuy = useCallback(() => {
    useRaffleStore.getState().buyTicket()
  }, [])

  // Format countdown: HH:MM:SS
  const countdown = useMemo(() => {
    const s = raffle.secondsUntilDraw
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }, [raffle.secondsUntilDraw])

  // Urgency states
  const isUrgent = raffle.secondsUntilDraw <= 300
  const isCritical = raffle.secondsUntilDraw <= 60

  // Timer bar progress
  const timerProgress = raffle.phase === 'buying'
    ? 1 - (raffle.secondsUntilDraw / 43200)
    : 1

  // Draw highlight
  const highlightedTicket = raffle.drawRevealIndex >= 0 && raffle.drawRevealIndex < raffle.tickets.length
    ? raffle.tickets[raffle.drawRevealIndex]
    : null

  return (
    <div className="raffle-game">

      {/* ═══ EVENT BANNER ═══ */}
      <div className="raffle-event-banner">
        <div className="raffle-event-banner__icon">🎟️</div>
        <div className="raffle-event-banner__text">
          <div className="raffle-event-banner__title">DAILY RAFFLE</div>
          <div className="raffle-event-banner__sub">NEXT DRAW: {raffle.drawLabel}</div>
        </div>
      </div>

      {/* ═══ COUNTDOWN ═══ */}
      {raffle.phase === 'buying' && (
        <div className={`raffle-countdown ${isUrgent ? 'raffle-countdown--urgent' : ''} ${isCritical ? 'raffle-countdown--critical' : ''}`}>
          <div className="raffle-countdown__label">DRAW IN</div>
          <div className="raffle-countdown__time">{countdown}</div>
          <div className="raffle-timer-bar">
            <div
              className={`raffle-timer-bar__fill ${isUrgent ? 'raffle-timer-bar__fill--urgent' : ''}`}
              style={{ width: `${timerProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ═══ POT DISPLAY ═══ */}
      <div className="raffle-pot">
        <div className="raffle-pot__label">JACKPOT</div>
        <div className={`raffle-pot__amount ${raffle.phase === 'drawing' ? 'raffle-pot__amount--drawing' : ''}`}>
          ${raffle.pot.toLocaleString()}
        </div>
        <div className="raffle-pot__info">
          {raffle.tickets.length} ticket{raffle.tickets.length !== 1 ? 's' : ''} in pool
          <span className="raffle-pot__sep">•</span>
          $100K / TICKET
          <span className="raffle-pot__sep">•</span>
          85% TO WINNER
        </div>
      </div>

      {/* ═══ DRAW ANIMATION ═══ */}
      {raffle.phase === 'drawing' && (
        <div className="raffle-drum">
          <div className="raffle-drum__label">🎰 DRAWING WINNER 🎰</div>
          <div className="raffle-drum__name-flash">
            {highlightedTicket ? highlightedTicket.owner : '...'}
          </div>
        </div>
      )}

      {/* ═══ WINNER RESULT ═══ */}
      {raffle.phase === 'result' && raffle.winnerName && (
        <div className={`raffle-winner ${raffle.isPlayerWinner ? 'raffle-winner--you' : 'raffle-winner--other'}`}>
          <div className="raffle-winner__crown">🏆</div>
          <div className="raffle-winner__label">
            {raffle.isPlayerWinner ? 'YOU WON THE DAILY RAFFLE!' : 'DAILY RAFFLE WINNER'}
          </div>
          <div className="raffle-winner__name">{raffle.winnerName}</div>
          <div className="raffle-winner__payout">
            +${raffle.winnerPayout.toLocaleString()}
          </div>
        </div>
      )}

      {/* ═══ BUY TICKETS ═══ */}
      {raffle.phase === 'buying' && (
        <div className="raffle-buy">
          <button
            className="raffle-buy__btn"
            disabled={!canBuy}
            onClick={handleBuy}
          >
            {raffle.playerTicketCount >= MAX_TICKETS_PER_PLAYER
              ? '🎫 MAX TICKETS (10/10)'
              : `🎫 BUY TICKET — $${(TICKET_PRICE / 1000).toFixed(0)}K`
            }
          </button>
          <div className="raffle-buy__info">
            YOUR TICKETS: <span className="raffle-buy__count">{raffle.playerTicketCount}</span>
            <span className="raffle-buy__max">/ {MAX_TICKETS_PER_PLAYER}</span>
            {raffle.playerTicketCount > 0 && raffle.tickets.length > 0 && (
              <>
                <span className="raffle-buy__sep">•</span>
                WIN CHANCE: <span className="raffle-buy__chance">
                  {((raffle.playerTicketCount / raffle.tickets.length) * 100).toFixed(1)}%
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ LAST WINNER ═══ */}
      {raffle.lastWinner && raffle.phase === 'buying' && (
        <div className="raffle-last-winner">
          <span className="raffle-last-winner__label">LAST WINNER:</span>
          <span className="raffle-last-winner__name">{raffle.lastWinner.name}</span>
          <span className="raffle-last-winner__payout">+${raffle.lastWinner.payout.toLocaleString()}</span>
        </div>
      )}

      {/* ═══ BALANCE ═══ */}
      <div className="raffle-footer">
        <span>BALANCE: <span className="raffle-footer__balance">${player.money.toLocaleString()}</span></span>
        {raffle.totalSpent > 0 && (
          <>
            <span className="raffle-footer__sep">|</span>
            <span>SPENT TODAY: <span className="raffle-footer__spent">${raffle.totalSpent.toLocaleString()}</span></span>
          </>
        )}
      </div>
    </div>
  )
}
