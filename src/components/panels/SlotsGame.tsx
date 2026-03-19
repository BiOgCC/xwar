import { useState, useEffect, useCallback, useRef } from 'react'
import { useSlotsStore, SLOTS_BETS, SLOT_SYMBOLS, SYMBOL_INFO, PAYOUTS } from '../../stores/slotsStore'
import type { SlotSymbol } from '../../stores/slotsStore'
import { usePlayerStore } from '../../stores/playerStore'

// Pay table for display
const PAY_TABLE = SLOT_SYMBOLS
  .map(sym => ({ symbol: sym, payout: PAYOUTS[sym] }))
  .sort((a, b) => b.payout - a.payout)

/* ── Symbol Image ── */
function SymbolImg({ sym, size = 48 }: { sym: SlotSymbol; size?: number }) {
  const info = SYMBOL_INFO[sym]
  return (
    <img
      src={info.img}
      alt={info.label}
      draggable={false}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

/* ── Single Reel ── */
function Reel({ strip, spinning, delay }: {
  strip: SlotSymbol[]
  spinning: boolean
  delay: number
}) {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (spinning) {
      setSettled(false)
      const t = setTimeout(() => setSettled(true), delay)
      return () => clearTimeout(t)
    }
  }, [spinning, delay])

  const displaySymbol = strip.length > 0 ? strip[strip.length - 1] : SLOT_SYMBOLS[0]

  return (
    <div className="slots-reel-window">
      <div
        className={`slots-reel ${spinning && !settled ? 'slots-reel--spinning' : ''} ${settled ? 'slots-reel--settled' : ''}`}
      >
        {spinning && !settled ? (
          <div className="slots-reel-scroll">
            {strip.map((sym, i) => (
              <div key={i} className="slots-symbol">
                <SymbolImg sym={sym} size={48} />
              </div>
            ))}
          </div>
        ) : (
          <div className="slots-symbol slots-symbol--final">
            <SymbolImg sym={displaySymbol} size={48} />
          </div>
        )}
      </div>
    </div>
  )
}

const SPIN_DELAYS = [800, 1400, 2000]

export default function SlotsGame() {
  const slots = useSlotsStore()
  const player = usePlayerStore()
  const [selectedBet, setSelectedBet] = useState(SLOTS_BETS[0])
  const resolveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (resolveRef.current) clearTimeout(resolveRef.current) }
  }, [])

  const handleSpin = useCallback(() => {
    if (slots.phase === 'spinning') return
    if (player.money < selectedBet) return

    if (slots.phase === 'result') {
      useSlotsStore.getState().reset()
    }

    setTimeout(() => {
      useSlotsStore.getState().spin(selectedBet)
      resolveRef.current = setTimeout(() => {
        useSlotsStore.getState().resolveResult()
      }, SPIN_DELAYS[2] + 400)
    }, 10)
  }, [slots.phase, selectedBet, player.money])

  return (
    <div className="slots-table">

      {/* Stats */}
      {slots.totalSpins > 0 && (
        <div className="bj-stats">
          <span>SPINS: <b>{slots.totalSpins}</b></span>
          <span className="bj-stats--win">W: <b>{slots.wins}</b></span>
          <span className="bj-stats--lose">L: <b>{slots.losses}</b></span>
          {slots.jackpots > 0 && <span className="bj-stats--bj">JP: <b>{slots.jackpots}</b></span>}
        </div>
      )}

      {/* ═══ REELS ═══ */}
      <div className="slots-machine">
        <div className="slots-reels">
          {[0, 1, 2].map(i => (
            <Reel
              key={i}
              strip={slots.reelStrips[i]}
              spinning={slots.phase === 'spinning'}
              delay={SPIN_DELAYS[i]}
            />
          ))}
        </div>
      </div>

      {/* ═══ RESULT ═══ */}
      {slots.phase === 'result' && slots.resultType && (
        <div className={`bj-result bj-result--${slots.resultType === 'jackpot' ? 'blackjack' : slots.resultType}`}>
          <div className="bj-result__text">{slots.resultText}</div>
          {slots.payout > 0 && (
            <div className="bj-result__payout">+${slots.payout.toLocaleString()}</div>
          )}
        </div>
      )}

      {/* ═══ BET CHIPS ═══ */}
      <div className="bj-betting">
        <div className="bj-bet-chips">
          {SLOTS_BETS.map(amt => (
            <button
              key={amt}
              className={`bj-chip ${selectedBet === amt ? 'bj-chip--active' : ''}`}
              disabled={player.money < amt || slots.phase === 'spinning'}
              onClick={() => setSelectedBet(amt)}
            >
              ${amt >= 1000 ? `${amt / 1000}K` : amt}
            </button>
          ))}
        </div>

        <button
          className="bj-deal-btn"
          disabled={player.money < selectedBet || slots.phase === 'spinning'}
          onClick={handleSpin}
        >
          {slots.phase === 'spinning' ? '⏳ SPINNING...' : `🎰 PULL — $${selectedBet >= 1000 ? `${selectedBet / 1000}K` : selectedBet}`}
        </button>

        <div className="bj-balance">
          BALANCE: <span>${player.money.toLocaleString()}</span>
        </div>
      </div>

      {/* ═══ PAY TABLE ═══ */}
      <div className="slots-paytable">
        <div className="slots-paytable__title">PAY TABLE (3-OF-A-KIND)</div>
        <div className="slots-paytable__grid">
          {PAY_TABLE.map(({ symbol, payout }) => (
            <div key={symbol} className="slots-paytable__row">
              <span className="slots-paytable__sym" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <SymbolImg sym={symbol} size={18} />
                <SymbolImg sym={symbol} size={18} />
                <SymbolImg sym={symbol} size={18} />
              </span>
              <span className="slots-paytable__mult">{payout}×</span>
            </div>
          ))}
          <div className="slots-paytable__row slots-paytable__row--pair">
            <span className="slots-paytable__sym">ANY PAIR</span>
            <span className="slots-paytable__mult">1.6×</span>
          </div>
        </div>
      </div>
    </div>
  )
}
