import React, { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useCasinoStore, WHEEL_SEGMENTS, BET_TIERS } from '../../stores/casinoStore'

// ── SVG Wheel Helpers ──
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

const SPIN_DURATION = 4000 // ms

export default function CasinoPanel() {
  const player = usePlayerStore()
  const casino = useCasinoStore()
  const [wheelAngle, setWheelAngle] = useState(0)
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current)
    }
  }, [])

  // Handle direct spin from bet button
  const handleBetSpin = useCallback((amount: number) => {
    if (casino.phase === 'spinning') return
    if (player.money < amount) return

    // If we're in result phase, reset first
    if (casino.phase === 'result') {
      useCasinoStore.getState().resetCasino()
    }

    // Trigger spin in store
    useCasinoStore.getState().spinForBet(amount)

    // Get the new target angle from store after spin
    const state = useCasinoStore.getState()
    setWheelAngle(state.targetAngle)

    // Resolve after animation
    resolveTimerRef.current = setTimeout(() => {
      useCasinoStore.getState().resolveResult()
    }, SPIN_DURATION + 300)
  }, [casino.phase, player.money])

  // Handle "bet again" — re-spin at same tier
  const handleBetAgain = useCallback(() => {
    const state = useCasinoStore.getState()
    const bet = state.currentBet
    if (player.money < bet) return

    useCasinoStore.getState().resetCasino()

    // Small delay then spin
    setTimeout(() => {
      useCasinoStore.getState().spinForBet(bet)
      const newState = useCasinoStore.getState()
      setWheelAngle(newState.targetAngle)

      resolveTimerRef.current = setTimeout(() => {
        useCasinoStore.getState().resolveResult()
      }, SPIN_DURATION + 300)
    }, 50)
  }, [player.money])

  // Wheel rendering
  const segCount = WHEEL_SEGMENTS.length
  const segAngle = 360 / segCount
  const cx = 130, cy = 130, r = 125

  return (
    <div className="casino-panel">

      {/* ── Header ── */}
      <div className="casino-header">
        <div className="casino-header__title">WARZONE CASINO</div>
        <div className="casino-header__sub">
          PROCEEDS FUND US TREASURY // PRIZES PAID AT 98% MARKET VALUE
        </div>
      </div>

      {/* ── Bet Buttons (Direct Spin) ── */}
      <div className="casino-bets">
        {BET_TIERS.map(tier => (
          <button
            key={tier.amount}
            className={`casino-bet-btn ${casino.currentBet === tier.amount && casino.phase !== 'idle' ? 'casino-bet-btn--active' : ''}`}
            disabled={casino.phase === 'spinning' || player.money < tier.amount}
            onClick={() => handleBetSpin(tier.amount)}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* ── Wheel ── */}
      <div className="casino-wheel-wrap">
        <div className="casino-wheel-outer">
          {/* Pointer */}
          <div className="casino-pointer" />

          {/* SVG Wheel */}
          <svg
            className={`casino-wheel-svg ${casino.phase === 'spinning' ? 'spinning' : ''}`}
            viewBox="0 0 260 260"
            style={{
              transform: `rotate(${wheelAngle}deg)`,
              transition: casino.phase === 'spinning'
                ? `transform ${SPIN_DURATION}ms cubic-bezier(0.15, 0.85, 0.25, 1)`
                : 'none',
            }}
          >
            {WHEEL_SEGMENTS.map((seg, i) => {
              const startA = i * segAngle
              const endA = startA + segAngle
              const path = describeArc(cx, cy, r, startA, endA)

              // Label position
              const midAngle = startA + segAngle / 2
              const labelR = r * 0.68
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle)

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill={seg.bgColor}
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={seg.color}
                    fontSize="10"
                    fontWeight="800"
                    fontFamily="'Orbitron', sans-serif"
                    transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
                  >
                    {seg.label}
                  </text>
                </g>
              )
            })}

            {/* Outer ring decoration */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(251,191,36,0.3)" strokeWidth="3" />
            <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
          </svg>

          {/* Center circle */}
          <div className="casino-wheel-center">🎰</div>
        </div>
      </div>

      {/* ── Result Display ── */}
      {casino.phase === 'result' && casino.lastWinType && (
        <div className={`casino-result casino-result--${casino.lastWinType === 'win' ? 'win' : 'lose'}`}>
          <div className="casino-result__label">{casino.lastWinText}</div>
          <div className="casino-result__amount">{casino.lastWinAmount}</div>
        </div>
      )}

      {/* ── Bet Again Button ── */}
      {casino.phase === 'result' && (
        <button
          className="casino-spin-btn casino-spin-btn--again"
          disabled={player.money < casino.currentBet}
          onClick={handleBetAgain}
        >
          BET AGAIN — {BET_TIERS.find(t => t.amount === casino.currentBet)?.label || `$${casino.currentBet.toLocaleString()}`}
        </button>
      )}

      {/* ── Spinning indicator ── */}
      {casino.phase === 'spinning' && (
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: '11px',
          color: '#fbbf24',
          letterSpacing: '0.15em',
          padding: '8px 0',
          animation: 'pulse-glow 1s infinite',
        }}>
          SPINNING...
        </div>
      )}

      {/* ── Balance ── */}
      <div className="casino-balance">
        <span>YOUR BALANCE: <span className="casino-balance__value">${player.money.toLocaleString()}</span></span>
      </div>

      {/* ── Prize Table ── */}
      <div className="casino-prizes">
        <div className="casino-prizes__title">PRIZE TABLE // SCALED BY BET</div>
        <div className="casino-prizes__grid">
          {WHEEL_SEGMENTS.map((seg, i) => (
            <div
              key={i}
              className="casino-prize-chip"
              style={{
                background: `${seg.bgColor}15`,
                borderColor: `${seg.bgColor}40`,
                color: seg.bgColor,
              }}
            >
              <span>{seg.label}</span>
              <span className="casino-prize-chip__label">
                {seg.type === 'multiply' ? `×${seg.multiplier}` :
                 seg.type === 'bankrupt' ? 'LOSE' :
                 `${seg.multiplier}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── History ── */}
      {casino.history.length > 0 && (
        <>
          <div className="casino-history">
            {casino.history.map((h, i) => (
              <div
                key={i}
                className="casino-history__dot"
                style={{
                  background: `${h.segment.bgColor}25`,
                  borderColor: `${h.segment.bgColor}60`,
                  color: h.segment.bgColor,
                }}
              >
                {h.segment.type === 'multiply' ? `${h.segment.multiplier}x` :
                 h.segment.type === 'bankrupt' ? '💀' :
                 h.segment.label.slice(0, 3)}
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="casino-stats">
            <div className="casino-stats__item">
              SPINS: <span className="casino-stats__num">{casino.totalSpins}</span>
            </div>
            <div className="casino-stats__item">
              W: <span className="casino-stats__num casino-stats__num--wins">{casino.totalWon}</span>
            </div>
            <div className="casino-stats__item">
              L: <span className="casino-stats__num casino-stats__num--losses">{casino.totalLost}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
