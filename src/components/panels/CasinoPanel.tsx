import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useCasinoStore, getSegmentsForBet, BET_TIERS } from '../../stores/casinoStore'
import { useWorldStore } from '../../stores/worldStore'
import '../../styles/casino.css'

/* ── SVG Wheel geometry helpers ── */
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

const SPIN_DURATION = 4000

export default function CasinoPanel() {
  const player = usePlayerStore()
  const casino = useCasinoStore()
  const [wheelAngle, setWheelAngle] = useState(0)
  const [selectedBet, setSelectedBet] = useState(BET_TIERS[0].amount)
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current) }
  }, [])

  const handleSpin = useCallback(() => {
    if (casino.phase === 'spinning') return
    if (player.money < selectedBet) return

    if (casino.phase === 'result') {
      useCasinoStore.getState().resetCasino()
    }

    useCasinoStore.getState().spinForBet(selectedBet)
    const state = useCasinoStore.getState()
    setWheelAngle(state.targetAngle)

    resolveTimerRef.current = setTimeout(() => {
      useCasinoStore.getState().resolveResult()
    }, SPIN_DURATION + 300)
  }, [casino.phase, player.money, selectedBet])

  const handleBetAgain = useCallback(() => {
    if (player.money < casino.currentBet) return
    const bet = casino.currentBet

    useCasinoStore.getState().resetCasino()
    setTimeout(() => {
      useCasinoStore.getState().spinForBet(bet)
      const s = useCasinoStore.getState()
      setWheelAngle(s.targetAngle)
      resolveTimerRef.current = setTimeout(() => {
        useCasinoStore.getState().resolveResult()
      }, SPIN_DURATION + 300)
    }, 50)
  }, [player.money, casino.currentBet])

  // Wheel constants
  const activeBet = casino.phase !== 'idle' ? casino.currentBet : selectedBet
  const activeBetLabel = BET_TIERS.find(t => t.amount === activeBet)?.label || `$${activeBet.toLocaleString()}`
  const activeSegments = casino.phase !== 'idle' ? casino.activeSegments : getSegmentsForBet(selectedBet)
  const segCount = activeSegments.length
  const segAngle = 360 / segCount
  const cx = 140, cy = 140, r = 130

  return (
    <div className="casino-panel">

      {/* ═══ HEADER ═══ */}
      <div className="casino-header">
        <div className="casino-header__title">WARZONE CASINO</div>
        <div className="casino-header__sub">
          PROCEEDS FUND US TREASURY // PRIZES PAID AT 98% MARKET VALUE
        </div>
      </div>

      {/* ═══ STREAK / STATS (at top for visibility) ═══ */}
      {casino.totalSpins > 0 && (
        <div className="casino-streak-bar">
          <div className="casino-history">
            {casino.history.map((h, i) => (
              <div
                key={i}
                className="casino-history__dot"
                style={{
                  background: `${h.segment.color}15`,
                  borderColor: `${h.segment.color}50`,
                  color: h.segment.color,
                }}
              >
                {h.segment.type === 'multiply' ? `${h.segment.multiplier}×` :
                 h.segment.type === 'bankrupt' ? '💀' :
                 h.segment.type === 'item' ? `🎁` :
                 h.segment.label.slice(0, 4)}
              </div>
            ))}
          </div>
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
        </div>
      )}

      {/* ═══ BET TIER SELECTOR ═══ */}
      <div className="casino-bets">
        {BET_TIERS.map(tier => (
          <button
            key={tier.amount}
            className={`casino-bet-btn ${activeBet === tier.amount ? 'casino-bet-btn--active' : ''}`}
            disabled={casino.phase === 'spinning'}
            onClick={() => {
              if (casino.phase === 'result') useCasinoStore.getState().resetCasino()
              setSelectedBet(tier.amount)
            }}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* ═══ WHEEL ═══ */}
      <div className="casino-wheel-wrap">
        <div className="casino-wheel-outer">
          <div className="casino-pointer" />

          <svg
            className="casino-wheel-svg"
            viewBox="0 0 280 280"
            style={{
              transform: `rotate(${wheelAngle}deg)`,
              transition: casino.phase === 'spinning'
                ? `transform ${SPIN_DURATION}ms cubic-bezier(0.15, 0.85, 0.25, 1)`
                : 'none',
            }}
          >
            {/* Outer glow ring */}
            <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="rgba(251,191,36,0.15)" strokeWidth="8" />

            {activeSegments.map((seg, i) => {
              const startA = i * segAngle
              const endA = startA + segAngle
              const path = describeArc(cx, cy, r, startA, endA)
              const midAngle = startA + segAngle / 2
              const labelR = r * 0.65
              const labelPos = polarToCartesian(cx, cy, labelR, midAngle)

              return (
                <g key={i}>
                  <path d={path} fill={seg.bgColor} stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={seg.color}
                    fontSize="8"
                    fontWeight="900"
                    fontFamily="'Orbitron', 'Rajdhani', sans-serif"
                    transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' } as any}
                  >
                    {seg.label}
                  </text>
                </g>
              )
            })}

            {/* Ring decorations */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(251,191,36,0.4)" strokeWidth="3" />
            <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
          </svg>

          <div className="casino-wheel-center" />
        </div>
      </div>

      {/* ═══ SPIN / BET AGAIN BUTTON ═══ */}
      {casino.phase !== 'spinning' && (
        casino.phase === 'result' ? (
          <button
            className="casino-spin-btn casino-spin-btn--again"
            disabled={player.money < casino.currentBet}
            onClick={handleBetAgain}
          >
            BET AGAIN — {BET_TIERS.find(t => t.amount === casino.currentBet)?.label || `$${casino.currentBet.toLocaleString()}`}
          </button>
        ) : (
          <button
            className="casino-spin-btn"
            disabled={player.money < selectedBet}
            onClick={handleSpin}
          >
            SPIN FOR {activeBetLabel}
          </button>
        )
      )}

      {/* ═══ SPINNING INDICATOR ═══ */}
      {casino.phase === 'spinning' && (
        <div className="casino-spinning-text">SPINNING...</div>
      )}

      {/* ═══ RESULT ═══ */}
      {casino.phase === 'result' && casino.lastWinType && (
        <div className={`casino-result casino-result--${casino.lastWinType === 'win' ? 'win' : 'lose'}`}>
          <div className="casino-result__label">{casino.lastWinText}</div>
          <div className="casino-result__amount">{casino.lastWinAmount}</div>
        </div>
      )}

      {/* ═══ BALANCE BAR ═══ */}
      <div className="casino-balance">
        {(() => {
          const countries = useWorldStore.getState().countries
          const myCountry = countries.find(c => c.code === player.countryCode)
          const treasury = myCountry?.fund.money ?? 0
          return (
            <>
              <span>{myCountry?.name ?? 'COUNTRY'} TREASURY: <span className="casino-balance__treasury">${treasury.toLocaleString()}</span></span>
              <span className="casino-balance__sep">|</span>
              <span>YOUR BALANCE: <span className="casino-balance__value">${player.money.toLocaleString()}</span></span>
            </>
          )
        })()}
      </div>

      {/* ═══ PRIZE TABLE ═══ */}
      <div className="casino-prizes">
        <div className="casino-prizes__title">PRIZE TABLE // ${activeBetLabel} BET</div>
        <div className="casino-prizes__grid">
          {activeSegments.map((seg, i) => (
            <div
              key={i}
              className="casino-prize-chip"
              style={{
                background: `${seg.color}12`,
                borderColor: `${seg.color}40`,
                color: seg.color,
              }}
            >
              <span className="casino-prize-chip__name">{seg.label}</span>
              <span className="casino-prize-chip__mult">
                {seg.type === 'multiply' ? `×${seg.multiplier} BET` :
                 seg.type === 'bankrupt' ? '💀 LOSE ALL' :
                 `🎁 ${seg.itemTier?.toUpperCase()} DROP`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
