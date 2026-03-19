import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlayerStore } from '../../stores/playerStore'
import { useCasinoStore, getSegmentsForBet, BET_TIERS } from '../../stores/casinoStore'
import { useWorldStore } from '../../stores/worldStore'
import { getItemImagePath, TIER_COLORS, TIER_LABELS, SLOT_ICONS } from '../../stores/inventoryStore'
import { popVariants, SPRINGS, useScreenShake } from '../shared/AnimationSystem'
import BlackjackGame from './BlackjackGame'
import SlotsGame from './SlotsGame'
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
  const shake = useScreenShake()
  const [wonItemDismissed, setWonItemDismissed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeGame, setActiveGame] = useState<'roulette' | 'blackjack' | 'slots'>('roulette')

  // Confetti particles — generated once per burst
  const confettiParticles = useRef<Array<{ x: number; y: number; r: number; color: string; delay: number; size: number; spin: number }>>([]).current

  // Reset dismiss when a new spin starts
  useEffect(() => {
    if (casino.phase === 'spinning') {
      setWonItemDismissed(false)
      setShowConfetti(false)
    }
  }, [casino.phase])

  const fireConfetti = useCallback(() => {
    const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a', '#d97706', '#ffffff', '#a78bfa', '#22d38a']
    confettiParticles.length = 0
    for (let i = 0; i < 60; i++) {
      confettiParticles.push({
        x: 50 + (Math.random() - 0.5) * 20,
        y: 40 + (Math.random() - 0.5) * 10,
        r: 60 + Math.random() * 140,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.3,
        size: 4 + Math.random() * 6,
        spin: Math.random() * 720 - 360,
      })
    }
    setShowConfetti(true)
    if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current)
    confettiTimerRef.current = setTimeout(() => setShowConfetti(false), 2500)
  }, [confettiParticles])

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
      </div>

      {/* ═══ GAME TABS ═══ */}
      <div className="casino-tabs">
        <button
          className={`casino-tab ${activeGame === 'roulette' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('roulette')}
        >
          🎰 ROULETTE
        </button>
        <button
          className={`casino-tab ${activeGame === 'blackjack' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('blackjack')}
        >
          🃏 BLACKJACK
        </button>
        <button
          className={`casino-tab ${activeGame === 'slots' ? 'casino-tab--active' : ''}`}
          onClick={() => setActiveGame('slots')}
        >
          🎰 SLOTS
        </button>
      </div>

      {/* ═══ BLACKJACK ═══ */}
      {activeGame === 'blackjack' && <BlackjackGame />}

      {/* ═══ SLOTS ═══ */}
      {activeGame === 'slots' && <SlotsGame />}

      {/* ═══ ROULETTE ═══ */}
      {activeGame === 'roulette' && (<>

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



      {/* ═══ RESULT ═══ */}
      <AnimatePresence>
        {casino.phase === 'result' && casino.lastWinType && (
          <motion.div
            key="result"
            className={`casino-result casino-result--${casino.lastWinType === 'win' ? 'win' : 'lose'}`}
            variants={popVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onAnimationComplete={() => {
              if (casino.lastWinType === 'win') fireConfetti()
              else shake(6, 350)
            }}
          >
            <div className="casino-result__label">{casino.lastWinText}</div>
            <div className="casino-result__amount">{casino.lastWinAmount}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ITEM WIN POPUP ═══ */}
      <AnimatePresence>
        {casino.phase === 'result' && casino.lastWonItem && !wonItemDismissed && (() => {
          const item = casino.lastWonItem!
          const tierColor = TIER_COLORS[item.tier]
          const imgUrl = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype)
          const statEntries = Object.entries(item.stats).filter(([, v]) => v !== undefined && v !== 0)
          return (
            <motion.div
              key="item-popup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onClick={() => setWonItemDismissed(true)}
            >
              <motion.div
                initial={{ scale: 0.3, opacity: 0, rotateZ: -8 }}
                animate={{ scale: 1, opacity: 1, rotateZ: 0 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                onClick={e => e.stopPropagation()}
                style={{
                  width: '240px', background: 'rgba(10,14,23,0.97)',
                  border: `2px solid ${tierColor}66`, borderRadius: '12px',
                  overflow: 'hidden', textAlign: 'center',
                  boxShadow: `0 0 40px ${tierColor}33, 0 20px 60px rgba(0,0,0,0.6)`,
                }}
              >
                {/* Header */}
                <div style={{
                  padding: '10px 12px 6px', background: `${tierColor}15`,
                  borderBottom: `1px solid ${tierColor}30`,
                }}>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-display)', letterSpacing: '0.15em', marginBottom: '4px' }}>🎰 JACKPOT WIN!</div>
                  <div style={{ fontSize: '7px', fontWeight: 700, color: tierColor, fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
                    {TIER_LABELS[item.tier]}
                  </div>
                </div>

                {/* Item Image */}
                <div style={{ padding: '16px 12px 8px', display: 'flex', justifyContent: 'center' }}>
                  {imgUrl ? (
                    <motion.img
                      src={imgUrl} alt={item.name}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
                      style={{
                        width: '96px', height: '96px', objectFit: 'contain',
                        filter: `drop-shadow(0 4px 16px ${tierColor}50)`,
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '48px', opacity: 0.5 }}>{(SLOT_ICONS as any)[item.slot]}</div>
                  )}
                </div>

                {/* Name */}
                <div style={{
                  padding: '0 12px 8px', fontSize: '12px', fontWeight: 900,
                  color: tierColor, fontFamily: 'var(--font-display)',
                  textShadow: `0 0 12px ${tierColor}66`,
                }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '8px', color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  {item.slot.toUpperCase()} {item.weaponSubtype ? `— ${item.weaponSubtype.toUpperCase()}` : ''}
                </div>

                {/* Stats */}
                <div style={{ padding: '0 12px 12px' }}>
                  {statEntries.map(([key, val], i) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.08, type: 'spring', stiffness: 300, damping: 20 }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '4px 8px', marginBottom: '2px',
                        background: `${tierColor}08`, borderRadius: '4px',
                        borderLeft: `2px solid ${tierColor}44`,
                      }}
                    >
                      <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{key}</span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: tierColor, fontFamily: 'var(--font-display)' }}>
                        {typeof val === 'number' && key.includes('Rate') ? `${val}%` : val}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Durability */}
                <div style={{ padding: '0 12px 8px' }}>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: `linear-gradient(90deg, ${tierColor}, ${tierColor}88)`, borderRadius: '2px' }} />
                  </div>
                  <div style={{ fontSize: '7px', color: '#475569', textAlign: 'right', marginTop: '2px', fontFamily: 'var(--font-display)' }}>DURABILITY 100%</div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setWonItemDismissed(true)}
                  style={{
                    width: 'calc(100% - 24px)', margin: '0 12px 12px', padding: '8px',
                    fontSize: '9px', fontWeight: 800, fontFamily: 'var(--font-display)',
                    letterSpacing: '0.1em', color: tierColor,
                    background: `${tierColor}15`, border: `1px solid ${tierColor}40`,
                    borderRadius: '6px', cursor: 'pointer',
                  }}
                >CLAIM & CLOSE</button>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

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

      {/* ═══ CONFETTI CELEBRATION ═══ */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            key="confetti"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              pointerEvents: 'none', overflow: 'hidden',
            }}
          >
            {confettiParticles.map((p, i) => {
              const angle = (Math.random() * 360) * (Math.PI / 180)
              const tx = Math.cos(angle) * p.r
              const ty = Math.sin(angle) * p.r - 40
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.size}px`,
                    height: `${p.size * (0.6 + Math.random() * 0.8)}px`,
                    background: p.color,
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    boxShadow: `0 0 6px ${p.color}88`,
                    animation: `confetti-burst 1.8s ease-out ${p.delay}s forwards`,
                    ['--tx' as any]: `${tx}px`,
                    ['--ty' as any]: `${ty}px`,
                    ['--spin' as any]: `${p.spin}deg`,
                    opacity: 0,
                  }}
                />
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
      </>)}
    </div>
  )
}
