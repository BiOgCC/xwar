import { useState, useEffect, useCallback, useRef } from 'react'
import { useCrashStore } from '../../stores/crashStore'
import { usePlayerStore } from '../../stores/playerStore'

/* ═══════════════════════════════════════════
   XWAR Crash — "Missile Launch" — INSTANT
   Metal Slug–style pixel art assets on canvas
   ═══════════════════════════════════════════ */

// ── Particle ──
interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; rotation: number; rotationSpeed: number
  life: number; maxLife: number; emoji?: string
  type: 'debris' | 'flame' | 'smoke' | 'spark'
}

function createExplosionParticles(cx: number, cy: number): Particle[] {
  const p: Particle[] = []
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 6
    p.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1,
      size: 3 + Math.random() * 6,
      color: ['#ef4444', '#f97316', '#fbbf24', '#dc2626', '#ff6b35'][Math.floor(Math.random() * 5)],
      rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 20,
      life: 40 + Math.random() * 30, maxLife: 70, type: 'debris' })
  }
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 2
    p.push({ x: cx + (Math.random() - 0.5) * 20, y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5,
      size: 8 + Math.random() * 12, color: '#475569',
      rotation: 0, rotationSpeed: 0, life: 50 + Math.random() * 30, maxLife: 80, type: 'smoke' })
  }
  for (let i = 0; i < 15; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8
    p.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
      size: 1 + Math.random() * 2, color: '#fbbf24',
      rotation: 0, rotationSpeed: 0, life: 15 + Math.random() * 20, maxLife: 35, type: 'spark' })
  }
  const emojis = ['💀', '🔥', '💥', '☠️', '🪦']
  for (let i = 0; i < 5; i++) {
    p.push({ x: cx - 40 + Math.random() * 80, y: cy - 20,
      vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 4,
      size: 12 + Math.random() * 8, color: '',
      rotation: 0, rotationSpeed: (Math.random() - 0.5) * 8,
      life: 50 + Math.random() * 30, maxLife: 80, emoji: emojis[Math.floor(Math.random() * emojis.length)], type: 'debris' })
  }
  return p
}

function createWinParticles(cx: number, cy: number): Particle[] {
  const p: Particle[] = []
  const e = ['💰', '💵', '💸', '🤑', '💎']
  for (let i = 0; i < 12; i++) {
    p.push({ x: cx - 60 + Math.random() * 120, y: cy - 10 - Math.random() * 30,
      vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 3,
      size: 12 + Math.random() * 8, color: '#22d38a',
      rotation: 0, rotationSpeed: (Math.random() - 0.5) * 3,
      life: 50 + Math.random() * 30, maxLife: 80, emoji: e[Math.floor(Math.random() * e.length)], type: 'debris' })
  }
  return p
}

function spawnExhaust(x: number, y: number, angle: number, out: Particle[]) {
  for (let i = 0; i < 3; i++) {
    const spread = (Math.random() - 0.5) * 8
    const bx = x - Math.cos(angle) * 18, by = y - Math.sin(angle) * 18
    const isSmoke = Math.random() < 0.3
    out.push({
      x: bx + spread * Math.sin(angle), y: by + spread * Math.cos(angle),
      vx: -Math.cos(angle) * (1 + Math.random() * 2) + (Math.random() - 0.5) * 0.5,
      vy: -Math.sin(angle) * (1 + Math.random() * 2) + (Math.random() - 0.5) * 0.5 + 0.3,
      size: isSmoke ? 4 + Math.random() * 6 : 2 + Math.random() * 3,
      color: isSmoke ? '#64748b' : ['#fbbf24', '#f97316', '#ff6b35'][Math.floor(Math.random() * 3)],
      rotation: 0, rotationSpeed: 0,
      life: isSmoke ? 25 + Math.random() * 20 : 8 + Math.random() * 10,
      maxLife: isSmoke ? 45 : 18, type: isSmoke ? 'smoke' : 'flame',
    })
  }
}

function spawnLaunchSmoke(tx: number, ty: number, out: Particle[]) {
  for (let i = 0; i < 20; i++) {
    out.push({
      x: tx + Math.random() * 40, y: ty - Math.random() * 10,
      vx: -0.5 + Math.random() * 2, vy: -0.5 - Math.random() * 1.5,
      size: 6 + Math.random() * 10, color: '#475569',
      rotation: 0, rotationSpeed: 0,
      life: 40 + Math.random() * 30, maxLife: 70, type: 'smoke',
    })
  }
}

// ── Image loader (singleton) ──
let truckImg: HTMLImageElement | null = null
let missileImg: HTMLImageElement | null = null
let imagesReady = false

function loadAssets() {
  if (truckImg) return
  truckImg = new Image()
  truckImg.src = '/assets/crash-truck.png'
  missileImg = new Image()
  missileImg.src = '/assets/crash-missile.png'

  let count = 0
  const onLoad = () => { if (++count >= 2) imagesReady = true }
  truckImg.onload = onLoad
  missileImg.onload = onLoad
}

// ── Component ──
export default function CrashGame() {
  // ── Selective store subscriptions (only re-render for UI-relevant changes) ──
  const phase = useCrashStore(s => s.phase)
  const currentMultiplier = useCrashStore(s => s.currentMultiplier)
  const crashPoint = useCrashStore(s => s.crashPoint)
  const playerBet = useCrashStore(s => s.playerBet)
  const playerCashedOut = useCrashStore(s => s.playerCashedOut)
  const playerPayout = useCrashStore(s => s.playerPayout)
  const history = useCrashStore(s => s.history)
  const totalRounds = useCrashStore(s => s.totalRounds)
  const wins = useCrashStore(s => s.wins)
  const losses = useCrashStore(s => s.losses)
  const money = usePlayerStore(s => s.money)

  const [selectedBet, setSelectedBet] = useState(10_000)
  const [autoCashout, setAutoCashout] = useState<number | null>(null)
  const [autoCashoutInput, setAutoCashoutInput] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const particlesRef = useRef<Particle[]>([])
  const effectsDoneRef = useRef(false)
  const frameRef = useRef(0)
  const animFrameRef = useRef(0)
  const smoothedAngleRef = useRef(-Math.PI / 4)  // start angle: 45° up-right
  const [shaking, setShaking] = useState(false)

  // Refs for canvas — updated via zustand subscribe, NOT React effects
  const phaseRef = useRef(phase)
  const multRef = useRef(currentMultiplier)
  const prevPhaseRef = useRef(phase)

  // Load assets once
  useEffect(() => { loadAssets() }, [])

  // Auto cash-out (only needs phase + multiplier changes)
  useEffect(() => {
    if (phase === 'flying' && autoCashout && currentMultiplier >= autoCashout && !playerCashedOut) {
      useCrashStore.getState().cashOut()
    }
  }, [currentMultiplier, phase, autoCashout, playerCashedOut])

  // Cleanup
  useEffect(() => () => { useCrashStore.getState()._cleanup() }, [])

  // ──────── CANVAS ANIMATION (runs once, never recreated) ────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctxRaw = canvas.getContext('2d')
    if (!ctxRaw) return
    const ctx = ctxRaw!

    // Subscribe to store INSIDE the effect — updates refs without React re-renders
    const unsub = useCrashStore.subscribe((state) => {
      // Phase change → reset one-shot effects
      if (state.phase !== prevPhaseRef.current) {
        prevPhaseRef.current = state.phase
        effectsDoneRef.current = false
        frameRef.current = 0
        if (state.phase === 'idle') {
          trailRef.current = []
          particlesRef.current = []
        }
      }
      phaseRef.current = state.phase
      multRef.current = state.currentMultiplier
    })

    const W = canvas.width   // 400
    const H = canvas.height  // 280

    // Layout constants
    const TRUCK_W = 100
    const TRUCK_H = 60
    const TRUCK_X = 10
    const TRUCK_Y = H - TRUCK_H - 6

    const GRAPH_LEFT = 55
    const GRAPH_BOTTOM = H - 40
    const GRAPH_RIGHT = W - 15
    const GRAPH_TOP = 20

    // ── Bold canvas-drawn missile (no image rotation jitter) ──
    function drawBoldMissile(cx: number, cy: number, angle: number, mult: number) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)

      // Exhaust flame (behind missile, flickering)
      const flameLen = 12 + Math.random() * 8 + Math.min(mult * 3, 30)
      const flameW = 5 + Math.min(mult, 4)
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.moveTo(-10, -flameW)
      ctx.lineTo(-10 - flameLen, 0)
      ctx.lineTo(-10, flameW)
      ctx.fill()
      // Inner flame core
      ctx.fillStyle = '#fff8e1'
      ctx.beginPath()
      ctx.moveTo(-10, -flameW * 0.4)
      ctx.lineTo(-10 - flameLen * 0.5, 0)
      ctx.lineTo(-10, flameW * 0.4)
      ctx.fill()
      // Outer glow
      ctx.shadowColor = '#f97316'
      ctx.shadowBlur = 10
      ctx.fillStyle = 'rgba(249,115,22,0.3)'
      ctx.beginPath()
      ctx.arc(-10 - flameLen * 0.3, 0, flameW * 1.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Missile body (bold, solid)
      ctx.fillStyle = '#94a3b8'
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-10, -4)
      ctx.lineTo(12, -3)
      ctx.lineTo(12, 3)
      ctx.lineTo(-10, 4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Nose cone (red warhead)
      ctx.fillStyle = '#dc2626'
      ctx.strokeStyle = '#1e293b'
      ctx.beginPath()
      ctx.moveTo(12, -3)
      ctx.lineTo(20, 0)
      ctx.lineTo(12, 3)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Fins
      ctx.fillStyle = '#475569'
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1
      // Top fin
      ctx.beginPath()
      ctx.moveTo(-8, -4)
      ctx.lineTo(-12, -9)
      ctx.lineTo(-4, -4)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // Bottom fin
      ctx.beginPath()
      ctx.moveTo(-8, 4)
      ctx.lineTo(-12, 9)
      ctx.lineTo(-4, 4)
      ctx.closePath()
      ctx.fill(); ctx.stroke()

      // Body stripe
      ctx.fillStyle = '#3d5a3a'
      ctx.fillRect(0, -3, 4, 6)

      // Glow around missile
      ctx.shadowColor = '#fbbf24'
      ctx.shadowBlur = 4 + Math.min(mult, 6)
      ctx.fillStyle = 'rgba(0,0,0,0)'
      ctx.fillRect(-10, -4, 30, 8)
      ctx.shadowBlur = 0

      ctx.restore()
    }

    function draw() {
      if (!ctx) return
      const phase = phaseRef.current
      const mult = multRef.current

      ctx.clearRect(0, 0, W, H)

      // ── Background gradient ──
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, 'rgba(8,12,22,0.95)')
      bg.addColorStop(1, 'rgba(15,23,42,0.95)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // ── Grid ──
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      for (let x = GRAPH_LEFT; x <= GRAPH_RIGHT; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, GRAPH_TOP); ctx.lineTo(x, GRAPH_BOTTOM); ctx.stroke()
      }
      for (let y = GRAPH_TOP; y <= GRAPH_BOTTOM; y += 35) {
        ctx.beginPath(); ctx.moveTo(GRAPH_LEFT, y); ctx.lineTo(GRAPH_RIGHT, y); ctx.stroke()
      }
      // Axes
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(GRAPH_LEFT, GRAPH_BOTTOM); ctx.lineTo(GRAPH_RIGHT, GRAPH_BOTTOM)
      ctx.moveTo(GRAPH_LEFT, GRAPH_BOTTOM); ctx.lineTo(GRAPH_LEFT, GRAPH_TOP)
      ctx.stroke()

      // Axis labels
      const maxMult = Math.max(5, (phase === 'flying' || phase === 'won') ? Math.ceil(mult + 1) : 5)
      ctx.fillStyle = 'rgba(100,116,139,0.35)'
      ctx.font = '8px sans-serif'
      ctx.textAlign = 'right'
      for (let m = 1; m <= maxMult; m += Math.max(1, Math.floor(maxMult / 5))) {
        const yp = GRAPH_BOTTOM - ((m - 1) / (maxMult - 1)) * (GRAPH_BOTTOM - GRAPH_TOP)
        ctx.fillText(`${m}×`, GRAPH_LEFT - 4, yp + 3)
      }
      ctx.textAlign = 'start'

      // ── Ground line ──
      ctx.strokeStyle = 'rgba(100,116,139,0.15)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, H - 8); ctx.lineTo(W, H - 8)
      ctx.stroke()

      // ── TRUCK (image) ──
      if (imagesReady && truckImg) {
        ctx.drawImage(truckImg, TRUCK_X, TRUCK_Y, TRUCK_W, TRUCK_H)
      }

      // ── FLIGHT / RESULT ──
      if (phase === 'flying' || phase === 'won' || phase === 'crashed') {
        const xRatio = Math.min((mult - 1) / (maxMult - 1), 1)
        const yRatio = Math.min((mult - 1) / (maxMult - 1), 1)
        const mx = GRAPH_LEFT + xRatio * (GRAPH_RIGHT - GRAPH_LEFT)
        const my = GRAPH_BOTTOM - yRatio * (GRAPH_BOTTOM - GRAPH_TOP)

        // Trail + smoothed angle
        if (phase === 'flying') {
          trailRef.current.push({ x: mx, y: my })
          if (trailRef.current.length > 500) trailRef.current.shift()

          // Compute angle from 30+ points back (avoids sub-pixel jitter)
          const trail = trailRef.current
          const lookback = Math.min(30, trail.length - 1)
          const refPt = trail[trail.length - 1 - lookback]
          const rawAngle = lookback > 0
            ? Math.atan2(my - refPt.y, mx - refPt.x)
            : -Math.PI / 4
          // Smooth with exponential moving average
          smoothedAngleRef.current += (rawAngle - smoothedAngleRef.current) * 0.08
          const angle = smoothedAngleRef.current

          // Exhaust particles every other frame
          if (frameRef.current % 2 === 0) spawnExhaust(mx, my, angle, particlesRef.current)

          // Launch smoke (once)
          if (!effectsDoneRef.current) {
            spawnLaunchSmoke(TRUCK_X + 40, TRUCK_Y, particlesRef.current)
            effectsDoneRef.current = true
          }
        }

        // Draw trail gradient
        if (trailRef.current.length > 1) {
          for (let i = 1; i < trailRef.current.length; i++) {
            const alpha = (i / trailRef.current.length) * 0.8
            ctx.strokeStyle = phase === 'crashed'
              ? `rgba(239,68,68,${alpha * 0.5})`
              : phase === 'won'
                ? `rgba(34,211,138,${alpha * 0.7})`
                : `rgba(251,191,36,${alpha})`
            ctx.lineWidth = 1.5 + (i / trailRef.current.length)
            ctx.beginPath()
            ctx.moveTo(trailRef.current[i - 1].x, trailRef.current[i - 1].y)
            ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y)
            ctx.stroke()
          }
          // Glow
          if (phase === 'flying') {
            ctx.save()
            ctx.shadowColor = '#fbbf24'
            ctx.shadowBlur = 4
            ctx.strokeStyle = 'rgba(251,191,36,0.12)'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(trailRef.current[0].x, trailRef.current[0].y)
            for (let i = 1; i < trailRef.current.length; i++) ctx.lineTo(trailRef.current[i].x, trailRef.current[i].y)
            ctx.stroke()
            ctx.restore()
          }
        }

        // Draw MISSILE (bold canvas shape) — only while flying
        if (phase === 'flying') {
          drawBoldMissile(mx, my, smoothedAngleRef.current, mult)
        }

        // Crash explosion (one-shot)
        if (phase === 'crashed' && !effectsDoneRef.current) {
          const lt = trailRef.current[trailRef.current.length - 1]
          particlesRef.current.push(...createExplosionParticles(lt ? lt.x : mx, lt ? lt.y : my))
          effectsDoneRef.current = true
          setShaking(true)
          setTimeout(() => setShaking(false), 600)
        }

        // Win particles (one-shot)
        if (phase === 'won' && !effectsDoneRef.current) {
          const lt = trailRef.current[trailRef.current.length - 1]
          particlesRef.current.push(...createWinParticles(lt ? lt.x : mx, lt ? lt.y : my))
          effectsDoneRef.current = true
        }
      }

      // ── IDLE ──
      if (phase === 'idle') {
        ctx.fillStyle = 'rgba(100,116,139,0.22)'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('PICK YOUR BET & LAUNCH', W / 2 + 20, H / 2 - 20)
        ctx.textAlign = 'start'
      }

      // ── PARTICLES ──
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy
        if (p.type === 'debris') p.vy += 0.06
        if (p.type === 'spark') p.vy += 0.12
        if (p.type === 'smoke') { p.size *= 1.01; p.vx *= 0.98; p.vy *= 0.98 }
        if (p.type === 'flame') p.size *= 0.95
        p.rotation += p.rotationSpeed
        p.life--
        const alpha = Math.max(0, p.life / p.maxLife)
        if (p.emoji) {
          ctx.save(); ctx.globalAlpha = alpha; ctx.font = `${p.size}px serif`
          ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillText(p.emoji, -p.size / 2, p.size / 2); ctx.restore()
        } else if (p.type === 'smoke') {
          ctx.save(); ctx.globalAlpha = alpha * 0.4; ctx.fillStyle = p.color
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore()
        } else if (p.type === 'spark') {
          ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p.color
          ctx.shadowColor = p.color; ctx.shadowBlur = 3
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0; ctx.restore()
        } else {
          ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p.color
          ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore()
        }
        return p.life > 0
      })

      frameRef.current++
      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      unsub()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBet = useCallback(() => { useCrashStore.getState().placeBet(selectedBet) }, [selectedBet])
  const handleCashOut = useCallback(() => { useCrashStore.getState().cashOut() }, [])

  const multColor =
    phase === 'crashed' ? '#ef4444' :
    phase === 'won' ? '#22d38a' :
    currentMultiplier >= 5 ? '#f59e0b' :
    currentMultiplier >= 2 ? '#fbbf24' : '#e2e8f0'

  return (
    <div className={`crash-game ${shaking ? 'crash-game--shake' : ''}`}>
      {/* History */}
      {history.length > 0 && (
        <div className="crash-history">
          {history.map((h, i) => (
            <span key={i} className="crash-history__dot"
              style={{ color: h < 2 ? '#ef4444' : h >= 5 ? '#22d38a' : '#fbbf24' }}
            >{h.toFixed(2)}×</span>
          ))}
        </div>
      )}

      {/* Multiplier */}
      {(phase === 'flying' || phase === 'crashed' || phase === 'won') && (
        <div className={`crash-multiplier ${phase === 'crashed' ? 'crash-multiplier--destroyed' : ''}`}
          style={{ color: multColor }}>
          {phase === 'crashed' ? `💥 ${crashPoint.toFixed(2)}×`
            : phase === 'won' ? `✅ ${currentMultiplier.toFixed(2)}×`
            : `${currentMultiplier.toFixed(2)}×`}
        </div>
      )}

      {/* Canvas */}
      <div className="crash-canvas-wrap">
        <canvas ref={canvasRef} width={400} height={280} className="crash-canvas" />
      </div>

      {/* Result */}
      {phase === 'won' && playerPayout > 0 && (
        <div className="crash-result crash-result--win" style={{ color: '#22d38a' }}>
          CASHED OUT AT ×{currentMultiplier.toFixed(2)}
          <div className="crash-result__payout">+${playerPayout.toLocaleString()}</div>
        </div>
      )}
      {phase === 'crashed' && (
        <div className="crash-result crash-result--lose" style={{ color: '#ef4444' }}>
          MISSILE DESTROYED — LOST ${playerBet.toLocaleString()}
        </div>
      )}

      {/* Controls */}
      <div className="crash-controls">
        {phase === 'idle' && (
          <>
            <div className="crash-slider-wrap">
              <div className="crash-slider-label">
                BET: <span className="crash-slider-amount">
                  ${selectedBet >= 1_000_000 ? (selectedBet / 1_000_000).toFixed(selectedBet % 1_000_000 === 0 ? 0 : 1) + 'M' : (selectedBet / 1000) + 'K'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={(() => {
                  const steps = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000]
                  const idx = steps.indexOf(selectedBet)
                  return idx >= 0 ? idx * (100 / (steps.length - 1)) : 0
                })()}
                onChange={e => {
                  const steps = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000]
                  const pct = Number(e.target.value)
                  const idx = Math.round(pct / (100 / (steps.length - 1)))
                  const bet = steps[Math.min(idx, steps.length - 1)]
                  setSelectedBet(Math.min(bet, money))
                }}
                className="crash-slider"
              />
              <div className="crash-slider-ticks">
                <span>$10K</span>
                <span>$250K</span>
                <span>$1M</span>
                <span>$2M</span>
              </div>
            </div>
            <div className="crash-auto">
              <label>AUTO CASH-OUT:</label>
              <input type="text" placeholder="e.g. 2.5" value={autoCashoutInput}
                onChange={e => { setAutoCashoutInput(e.target.value); const v = parseFloat(e.target.value); setAutoCashout(v >= 1.1 ? v : null) }}
                className="crash-auto__input"
              />
              {autoCashout && <span className="crash-auto__badge">@{autoCashout.toFixed(2)}×</span>}
            </div>
            <button className="crash-launch-btn" onClick={handleBet} disabled={money < selectedBet}>
              🚀 BET ${selectedBet >= 1_000_000 ? (selectedBet / 1_000_000).toFixed(selectedBet % 1_000_000 === 0 ? 0 : 1) + 'M' : (selectedBet / 1000) + 'K'} — LAUNCH MISSILE
            </button>
          </>
        )}
        {phase === 'flying' && !playerCashedOut && (
          <button className="crash-cashout-btn" onClick={handleCashOut}>
            💰 CASH OUT — ${Math.floor(playerBet * currentMultiplier).toLocaleString()}
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="crash-footer">
        <span>BALANCE: <span style={{ color: '#22d38a', fontWeight: 800 }}>${money.toLocaleString()}</span></span>
        {totalRounds > 0 && (
          <>
            <span className="crash-footer__sep">|</span>
            <span>W: <span style={{ color: '#22d38a' }}>{wins}</span></span>
            <span className="crash-footer__sep">|</span>
            <span>L: <span style={{ color: '#ef4444' }}>{losses}</span></span>
          </>
        )}
      </div>
    </div>
  )
}
