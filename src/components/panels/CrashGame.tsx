import { useState, useEffect, useCallback, useRef } from 'react'
import { useCrashStore, CRASH_BETS } from '../../stores/crashStore'
import { usePlayerStore } from '../../stores/playerStore'

/* ═══════════════════════════════════════════
   XWAR Crash — "Missile Launch" — MULTIPLAYER
   Timed rounds, bot players, chat log
   ANIMATIONS: wobble, speed lines, GTA crash, debris, money shower
   ═══════════════════════════════════════════ */

// ── Debris / particle system ──
interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; rotation: number; rotationSpeed: number
  life: number; maxLife: number; emoji?: string
}

function createExplosionParticles(cx: number, cy: number): Particle[] {
  const particles: Particle[] = []
  const emojis = ['💀', '🪦', '😭', '🔥', '💥', '☠️']
  // Debris chunks
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 5
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 2 + Math.random() * 4,
      color: ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#7c2d12'][Math.floor(Math.random() * 5)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 15,
      life: 60 + Math.random() * 40,
      maxLife: 100,
    })
  }
  // Emoji rain
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: cx - 80 + Math.random() * 160,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.5 + Math.random() * 2,
      size: 14 + Math.random() * 8,
      color: '',
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 5,
      life: 80 + Math.random() * 40,
      maxLife: 120,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
    })
  }
  return particles
}

function createMoneyParticles(cx: number, cy: number): Particle[] {
  const particles: Particle[] = []
  const cashEmojis = ['💰', '💵', '💸', '🤑', '💎']
  for (let i = 0; i < 15; i++) {
    particles.push({
      x: cx - 60 + Math.random() * 120,
      y: cy - 20 - Math.random() * 30,
      vx: (Math.random() - 0.5) * 2,
      vy: -2 - Math.random() * 3,
      size: 14 + Math.random() * 6,
      color: '#22d38a',
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 3,
      life: 60 + Math.random() * 30,
      maxLife: 90,
      emoji: cashEmojis[Math.floor(Math.random() * cashEmojis.length)],
    })
  }
  return particles
}

export default function CrashGame() {
  const crash = useCrashStore()
  const player = usePlayerStore()
  const [selectedBet, setSelectedBet] = useState(CRASH_BETS[0])
  const [autoCashout, setAutoCashout] = useState<number | null>(null)
  const [autoCashoutInput, setAutoCashoutInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const particlesRef = useRef<Particle[]>([])
  const crashTimeRef = useRef(0)
  const cashoutTimeRef = useRef(0)
  const animFrameRef = useRef(0)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [shaking, setShaking] = useState(false)

  // Auto cash-out
  useEffect(() => {
    if (crash.phase === 'flying' && autoCashout && crash.currentMultiplier >= autoCashout && crash.playerBet > 0 && !crash.playerCashedOut) {
      crash.cashOut()
    }
  }, [crash.currentMultiplier, crash.phase, autoCashout, crash.playerBet, crash.playerCashedOut])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [crash.chatLog.length])

  // Reset trail on new round
  useEffect(() => {
    if (crash.phase === 'betting') {
      trailRef.current = []
      particlesRef.current = []
      crashTimeRef.current = 0
      cashoutTimeRef.current = 0
    }
  }, [crash.phase])

  // Trigger explosion on crash
  useEffect(() => {
    if (crash.phase === 'crashed') {
      const lastPt = trailRef.current[trailRef.current.length - 1]
      if (lastPt) {
        particlesRef.current = createExplosionParticles(lastPt.x, lastPt.y)
      }
      crashTimeRef.current = performance.now()
      // Screen shake if player lost
      if (crash.playerBet > 0 && !crash.playerCashedOut) {
        setShaking(true)
        setTimeout(() => setShaking(false), 800)
      }
    }
  }, [crash.phase])

  // Trigger money shower on cash-out
  useEffect(() => {
    if (crash.playerCashedOut && crash.playerPayout > 0) {
      const canvas = canvasRef.current
      if (canvas) {
        particlesRef.current = [
          ...particlesRef.current,
          ...createMoneyParticles(canvas.width / 2, canvas.height / 2),
        ]
      }
      cashoutTimeRef.current = performance.now()
    }
  }, [crash.playerCashedOut])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      crash._cleanup()
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // ── Main render loop ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true
    const W = canvas.width
    const H = canvas.height

    function render() {
      if (!running || !ctx) return
      ctx.clearRect(0, 0, W, H)

      const mult = crash.currentMultiplier
      const phase = crash.phase

      // ── Background tint shift based on multiplier ──
      if (phase === 'flying' || phase === 'crashed') {
        const danger = Math.min(1, (mult - 1) / 9) // 0 at 1×, 1 at 10×
        const r = Math.floor(8 + danger * 40)
        const g = Math.floor(12 + danger * 5)
        const b = Math.floor(18 - danger * 10)
        ctx.fillStyle = `rgba(${r},${g},${b},0.3)`
        ctx.fillRect(0, 0, W, H)
      }

      drawGrid(ctx, W, H)

      // ── Idle states ──
      if (phase === 'betting' || phase === 'cooldown') {
        ctx.font = '900 16px monospace'
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.textAlign = 'center'
        ctx.fillText(phase === 'betting' ? 'WAITING FOR LAUNCH...' : 'NEXT ROUND SOON...', W / 2, H / 2)
        animFrameRef.current = requestAnimationFrame(render)
        return
      }

      // ── Calculate missile position ──
      const maxMult = Math.max(mult, 2)
      const ratio = Math.min(1, (mult - 1) / (maxMult - 1))
      const mx = 40 + ratio * (W - 80)
      const my = H - 40 - ratio * (H - 80)

      if (phase === 'flying') {
        trailRef.current.push({ x: mx, y: my })
        if (trailRef.current.length > 200) trailRef.current.shift()
      }

      // ── Speed lines (anime-style) ──
      if (phase === 'flying' && mult > 1.5) {
        const intensity = Math.min(1, (mult - 1.5) / 5)
        const lineCount = Math.floor(3 + intensity * 12)
        for (let i = 0; i < lineCount; i++) {
          const lx = Math.random() * W
          const ly = Math.random() * H
          const len = 15 + intensity * 35
          ctx.strokeStyle = `rgba(255,255,255,${0.03 + intensity * 0.08})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(lx, ly)
          ctx.lineTo(lx - len * 0.7, ly + len * 0.7) // diagonal, matching missile angle
          ctx.stroke()
        }
      }

      // ── Trail with danger color ──
      if (trailRef.current.length > 1) {
        ctx.beginPath()
        ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y)
        for (let i = 1; i < trailRef.current.length; i++) {
          ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y)
        }
        const danger = Math.min(1, (mult - 1) / 8)
        const trailColor = phase === 'crashed' ? '#ef4444'
          : `hsl(${45 - danger * 45}, 90%, ${55 - danger * 10}%)`
        ctx.strokeStyle = trailColor
        ctx.lineWidth = 2 + danger * 3
        ctx.shadowColor = trailColor
        ctx.shadowBlur = 8 + danger * 12
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // ── Missile with wobble ──
      const lastPt = trailRef.current[trailRef.current.length - 1] || { x: mx, y: my }
      if (phase === 'flying') {
        const wobbleIntensity = Math.min(1, (mult - 1) / 6)
        const wobble = wobbleIntensity * 0.15 * Math.sin(performance.now() * 0.015)
        const shakeX = wobbleIntensity * (Math.random() - 0.5) * 4
        const shakeY = wobbleIntensity * (Math.random() - 0.5) * 4

        ctx.font = '24px serif'
        ctx.textAlign = 'center'
        ctx.save()
        ctx.translate(lastPt.x + shakeX, lastPt.y + shakeY)
        ctx.rotate(-Math.PI / 4 + wobble)
        ctx.fillText('🚀', 0, 0)
        ctx.restore()

        // Enhanced exhaust with danger
        const exhaustCount = 3 + Math.floor(wobbleIntensity * 6)
        for (let i = 0; i < exhaustCount; i++) {
          const spread = 6 + wobbleIntensity * 12
          const ex = lastPt.x - spread / 2 + Math.random() * spread
          const ey = lastPt.y + 5 + Math.random() * (8 + wobbleIntensity * 10)
          const eSize = 1.5 + Math.random() * (2 + wobbleIntensity * 3)
          const hue = 45 - wobbleIntensity * 30 // yellow → orange
          ctx.fillStyle = `hsla(${hue}, 90%, 55%, ${0.3 + Math.random() * 0.4})`
          ctx.beginPath()
          ctx.arc(ex, ey, eSize, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── GTA-style "DESTROYED" crash overlay ──
      if (phase === 'crashed') {
        const elapsed = (performance.now() - crashTimeRef.current) / 1000

        // Flash red overlay
        if (elapsed < 0.3) {
          ctx.fillStyle = `rgba(239,68,68,${0.3 * (1 - elapsed / 0.3)})`
          ctx.fillRect(0, 0, W, H)
        }

        // "DESTROYED" text slam
        if (elapsed < 3) {
          const scale = elapsed < 0.15 ? 1 + (0.15 - elapsed) * 8 : 1 // zoom in then settle
          const alpha = elapsed < 2.5 ? 1 : 1 - (elapsed - 2.5) / 0.5

          ctx.save()
          ctx.translate(W / 2, H / 2 - 10)
          ctx.scale(scale, scale)
          ctx.font = '900 28px monospace'
          ctx.textAlign = 'center'
          ctx.fillStyle = `rgba(239,68,68,${alpha})`
          ctx.shadowColor = '#ef4444'
          ctx.shadowBlur = 20
          ctx.fillText('D E S T R O Y E D', 0, 0)
          ctx.shadowBlur = 0

          // Crash point subtitle
          ctx.font = '700 14px monospace'
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`
          ctx.fillText(`×${crash.crashPoint.toFixed(2)}`, 0, 24)
          ctx.restore()
        }
      }

      // ── Particles (debris / money) ──
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.08 // gravity
        p.rotation += p.rotationSpeed
        p.life--

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1)
          continue
        }

        const alpha = Math.min(1, p.life / (p.maxLife * 0.3))
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = alpha

        if (p.emoji) {
          ctx.font = `${p.size}px serif`
          ctx.textAlign = 'center'
          ctx.fillText(p.emoji, 0, 0)
        } else {
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        }

        ctx.globalAlpha = 1
        ctx.restore()
      }

      animFrameRef.current = requestAnimationFrame(render)
    }

    render()
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [crash.phase, crash.currentMultiplier, crash.crashPoint])

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return
    crash.sendChat(chatInput)
    setChatInput('')
  }, [chatInput])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const multColor =
    crash.phase === 'crashed' ? '#ef4444' :
    crash.playerCashedOut ? '#22d38a' :
    crash.currentMultiplier >= 5 ? '#f59e0b' :
    crash.currentMultiplier >= 2 ? '#fbbf24' : '#e2e8f0'

  const phaseLabel =
    crash.phase === 'betting' ? '🟢 BETTING OPEN' :
    crash.phase === 'flying' ? '🚀 MISSILE LIVE' :
    crash.phase === 'crashed' ? '💥 CRASHED' :
    '⏳ NEXT ROUND'

  return (
    <div className={`crash-game ${shaking ? 'crash-game--shake' : ''}`}>

      {/* Phase + Timer bar */}
      <div className="crash-phase-bar">
        <span className="crash-phase-label" style={{
          color: crash.phase === 'betting' ? '#22d38a' : crash.phase === 'flying' ? '#fbbf24' : crash.phase === 'crashed' ? '#ef4444' : '#64748b'
        }}>{phaseLabel}</span>
        <span className="crash-timer">
          {crash.phase === 'betting' && `Closes in ${formatTime(crash.timeRemaining)}`}
          {crash.phase === 'cooldown' && `Next round in ${formatTime(crash.timeRemaining)}`}
          {crash.phase === 'flying' && `${crash.players.filter(p => !p.cashedOutAt).length} players flying`}
        </span>
      </div>

      {/* History strip */}
      {crash.history.length > 0 && (
        <div className="crash-history">
          {crash.history.map((h, i) => (
            <span key={i} className="crash-history__dot"
              style={{ color: h < 2 ? '#ef4444' : h >= 5 ? '#22d38a' : '#fbbf24' }}
            >{h.toFixed(2)}×</span>
          ))}
        </div>
      )}

      {/* Multiplier display */}
      {(crash.phase === 'flying' || crash.phase === 'crashed') && (
        <div className={`crash-multiplier ${crash.phase === 'crashed' ? 'crash-multiplier--destroyed' : ''}`}
          style={{ color: multColor }}>
          {crash.phase === 'crashed'
            ? `💥 ${crash.crashPoint.toFixed(2)}×`
            : `${crash.currentMultiplier.toFixed(2)}×`
          }
        </div>
      )}

      {/* Canvas */}
      <div className="crash-canvas-wrap">
        <canvas ref={canvasRef} width={400} height={200} className="crash-canvas" />
      </div>

      {/* Player result */}
      {crash.playerCashedOut && crash.playerPayout > 0 && (
        <div className="crash-result crash-result--win" style={{ color: '#22d38a' }}>
          CASHED OUT AT ×{crash.players.find(p => p.isPlayer)?.cashedOutAt?.toFixed(2)}
          <div className="crash-result__payout">+${crash.playerPayout.toLocaleString()}</div>
        </div>
      )}
      {crash.phase === 'crashed' && crash.playerBet > 0 && !crash.playerCashedOut && (
        <div className="crash-result crash-result--lose" style={{ color: '#ef4444' }}>
          MISSILE DESTROYED — LOST ${crash.playerBet.toLocaleString()}
        </div>
      )}

      {/* Players List */}
      <div className="crash-players">
        <div className="crash-players__header">
          PLAYERS ({crash.players.length})
        </div>
        <div className="crash-players__list">
          {crash.players.map((p, i) => (
            <div key={i} className="crash-player-row" style={{
              borderColor: p.isPlayer ? 'rgba(251,191,36,0.3)' : 'transparent',
              background: p.isPlayer ? 'rgba(251,191,36,0.05)' : undefined,
            }}>
              <span className="crash-player-name" style={{
                color: p.isPlayer ? '#fbbf24' : '#94a3b8',
              }}>{p.name}</span>
              <span className="crash-player-bet">${(p.bet / 1000).toFixed(0)}K</span>
              <span className="crash-player-status" style={{
                color: p.cashedOutAt ? '#22d38a' : crash.phase === 'crashed' ? '#ef4444' : '#64748b',
              }}>
                {p.cashedOutAt
                  ? `×${p.cashedOutAt.toFixed(2)} ✓`
                  : crash.phase === 'crashed' ? '💥' : '...'
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="crash-controls">
        {crash.phase === 'betting' && crash.playerBet === 0 && (
          <>
            <div className="crash-bets">
              {CRASH_BETS.map(bet => (
                <button key={bet}
                  className={`crash-bet-chip ${selectedBet === bet ? 'crash-bet-chip--active' : ''}`}
                  onClick={() => setSelectedBet(bet)}
                  disabled={player.money < bet}
                  style={{ opacity: player.money < bet ? 0.4 : 1 }}
                >${(bet / 1000).toFixed(0)}K</button>
              ))}
            </div>
            <div className="crash-auto">
              <label>AUTO CASH-OUT:</label>
              <input type="text" placeholder="e.g. 2.5" value={autoCashoutInput}
                onChange={e => {
                  setAutoCashoutInput(e.target.value)
                  const val = parseFloat(e.target.value)
                  setAutoCashout(val >= 1.1 ? val : null)
                }}
                className="crash-auto__input"
              />
              {autoCashout && <span className="crash-auto__badge">@{autoCashout.toFixed(2)}×</span>}
            </div>
            <button className="crash-launch-btn" onClick={() => crash.placeBet(selectedBet)}
              disabled={player.money < selectedBet}
            >🚀 BET ${(selectedBet / 1000).toFixed(0)}K ON MISSILE</button>
          </>
        )}

        {crash.phase === 'betting' && crash.playerBet > 0 && (
          <div className="crash-result" style={{ color: '#fbbf24' }}>
            ✅ BET PLACED: ${crash.playerBet.toLocaleString()} — waiting for launch...
          </div>
        )}

        {crash.phase === 'flying' && crash.playerBet > 0 && !crash.playerCashedOut && (
          <button className="crash-cashout-btn" onClick={() => crash.cashOut()}>
            💰 CASH OUT — ${Math.floor(crash.playerBet * crash.currentMultiplier).toLocaleString()}
          </button>
        )}

        {crash.phase === 'cooldown' && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: '11px', fontWeight: 700 }}>
            ⏳ Next missile in {formatTime(crash.timeRemaining)}
          </div>
        )}
      </div>

      {/* Chat / Mock Log */}
      <div className="crash-chat">
        <div className="crash-chat__header">💬 CRASH LOG</div>
        <div className="crash-chat__messages">
          {crash.chatLog.slice(-30).map((msg, i) => (
            <div key={i} className={`crash-chat__msg crash-chat__msg--${msg.type}`}>
              <span className="crash-chat__name" style={{
                color: msg.type === 'system' ? '#fbbf24' : msg.type === 'cashout' ? '#22d38a' : msg.type === 'crash' ? '#ef4444' : '#94a3b8',
              }}>{msg.name}</span>
              <span className="crash-chat__text">{msg.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="crash-chat__input-row">
          <input type="text" placeholder="Type to chat..." value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
            className="crash-chat__input" maxLength={100}
          />
          <button onClick={handleSendChat} className="crash-chat__send">SEND</button>
        </div>
      </div>
    </div>
  )
}

/* ── Grid helper ── */
function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  for (let x = 40; x <= W - 40; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, H - 30); ctx.stroke()
  }
  for (let y = 30; y <= H - 30; y += 40) {
    ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(W - 30, y); ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(40, H - 40); ctx.lineTo(W - 40, H - 40)
  ctx.moveTo(40, H - 40); ctx.lineTo(40, 30)
  ctx.stroke()
}
