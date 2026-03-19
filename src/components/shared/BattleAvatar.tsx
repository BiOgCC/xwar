import { useEffect, useRef } from 'react'
import '../../styles/battle-avatar.css'

type TracerStyle = 'infantry' | 'tank' | 'jet' | 'warship'

interface BattleAvatarProps {
  attackerFlag: string
  defenderFlag: string
  attackerName: string
  defenderName: string
  isActive: boolean
  /** Per-side fire intensity: 0 = idle, 1 = max fire rate */
  atkIntensity?: number
  defIntensity?: number
  defenderCountry?: string
  attackerColor?: string
  defenderColor?: string
  /** Trigger a one-shot golden crit burst on a side */
  critSide?: 'atk' | 'def' | null
  /** Dominant division type per side — changes tracer style */
  atkDominantType?: TracerStyle
  defDominantType?: TracerStyle
}

export default function BattleAvatar({
  attackerFlag,
  defenderFlag,
  attackerName,
  defenderName,
  isActive,
  atkIntensity = 0,
  defIntensity = 0,
  defenderCountry,
  attackerColor = '#3b82f6',
  defenderColor = '#ef4444',
  critSide = null,
  atkDominantType = 'infantry',
  defDominantType = 'infantry',
}: BattleAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const critQueueRef = useRef<('atk' | 'def')[]>([])

  // Queue crit events from prop changes
  useEffect(() => {
    if (critSide) critQueueRef.current.push(critSide)
  }, [critSide])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !isActive) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // Clamp intensities
    const atkI = Math.max(0, Math.min(1, atkIntensity))
    const defI = Math.max(0, Math.min(1, defIntensity))
    const maxI = Math.max(atkI, defI)

    // Per-side fire intervals: 10 frames (idle) → 2 frames (max)
    const atkFireInterval = Math.max(2, Math.round(10 - 8 * atkI))
    const defFireInterval = Math.max(2, Math.round(10 - 8 * defI))
    const atkImpactInterval = Math.max(3, Math.round(15 - 10 * atkI))
    const defImpactInterval = Math.max(3, Math.round(15 - 10 * defI))

    // Lighter tint helper
    const lighten = (hex: string, amount: number = 0.4) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `rgb(${Math.min(255, r + (255 - r) * amount)}, ${Math.min(255, g + (255 - g) * amount)}, ${Math.min(255, b + (255 - b) * amount)})`
    }

    interface Particle {
      x: number; y: number; vx: number; vy: number
      life: number; maxLife: number; size: number
      color: string; type: 'bullet' | 'spark' | 'shell' | 'smoke' | 'haze' | 'crit_bullet' | 'tank_shell' | 'jet_strafe' | 'warship_arc'
      gravity?: number
    }
    const particles: Particle[] = []

    // ── TRACER SPAWNERS BY TYPE ──────────────────────

    const spawnInfantryBullet = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.30 : W * 0.70
      const y = H * 0.38 + (Math.random() - 0.5) * 4
      const color = isAtk ? attackerColor : defenderColor
      particles.push({
        x, y,
        vx: isAtk ? 7 + Math.random() * 3 : -(7 + Math.random() * 3),
        vy: (Math.random() - 0.5) * 0.6,
        life: 0, maxLife: 16 + Math.random() * 4,
        size: 2.5, color, type: 'bullet',
      })
    }

    const spawnTankShell = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.30 : W * 0.70
      const y = H * 0.36 + (Math.random() - 0.5) * 6
      const color = isAtk ? attackerColor : defenderColor
      particles.push({
        x, y,
        vx: isAtk ? 4 + Math.random() * 2 : -(4 + Math.random() * 2),
        vy: (Math.random() - 0.5) * 0.3,
        life: 0, maxLife: 22 + Math.random() * 6,
        size: 5, color, type: 'tank_shell',
      })
      // Big muzzle flash sparks
      for (let i = 0; i < 6; i++) {
        particles.push({
          x, y,
          vx: isAtk ? 2 + Math.random() * 6 : -(2 + Math.random() * 6),
          vy: (Math.random() - 0.5) * 5,
          life: 0, maxLife: 4 + Math.random() * 3,
          size: 2 + Math.random() * 3,
          color: Math.random() > 0.4 ? '#ffcc00' : '#ff6600', type: 'spark',
        })
      }
    }

    const spawnJetStrafe = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.25 + Math.random() * W * 0.15 : W * 0.60 + Math.random() * W * 0.15
      const y = H * 0.08 + Math.random() * H * 0.08
      const color = isAtk ? attackerColor : defenderColor
      particles.push({
        x, y,
        vx: isAtk ? 5 + Math.random() * 3 : -(5 + Math.random() * 3),
        vy: 2.5 + Math.random() * 1.5,
        life: 0, maxLife: 18 + Math.random() * 6,
        size: 2, color, type: 'jet_strafe',
      })
    }

    const spawnWarshipArc = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.28 : W * 0.72
      const y = H * 0.42
      const color = isAtk ? attackerColor : defenderColor
      particles.push({
        x, y,
        vx: isAtk ? 3 + Math.random() * 2 : -(3 + Math.random() * 2),
        vy: -(3 + Math.random() * 2),
        life: 0, maxLife: 30 + Math.random() * 8,
        size: 4, color, type: 'warship_arc',
        gravity: 0.18,
      })
    }

    const spawnBulletByType = (side: 'atk' | 'def') => {
      const type = side === 'atk' ? atkDominantType : defDominantType
      switch (type) {
        case 'tank': spawnTankShell(side); break
        case 'jet': spawnJetStrafe(side); break
        case 'warship': spawnWarshipArc(side); break
        default: spawnInfantryBullet(side); break
      }
      // Muzzle sparks (all types)
      const isAtk = side === 'atk'
      const sideI = isAtk ? atkI : defI
      const sparkCount = 3 + Math.round(4 * sideI)
      const x = isAtk ? W * 0.30 : W * 0.70
      const y = H * 0.38
      for (let i = 0; i < sparkCount; i++) {
        particles.push({
          x, y,
          vx: isAtk ? 1 + Math.random() * 5 : -(1 + Math.random() * 5),
          vy: (Math.random() - 0.5) * 4,
          life: 0, maxLife: 5 + Math.random() * 4,
          size: 1 + Math.random() * 2,
          color: Math.random() > 0.3 ? '#ffdd00' : '#ff8800', type: 'spark',
        })
      }
      // Muzzle smoke
      particles.push({
        x: x + (isAtk ? 4 : -4), y: y - 2,
        vx: isAtk ? 0.5 : -0.5,
        vy: -0.3 - Math.random() * 0.5,
        life: 0, maxLife: 20 + Math.random() * 10,
        size: 4 + Math.random() * 3,
        color: 'rgba(150,150,150,0.3)', type: 'smoke',
      })
    }

    const spawnImpact = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.70 : W * 0.30
      const y = H * 0.38 + (Math.random() - 0.5) * 14
      const sideI = isAtk ? atkI : defI
      const impactCount = 5 + Math.round(5 * sideI)
      const color = isAtk ? lighten(attackerColor) : lighten(defenderColor)
      for (let i = 0; i < impactCount; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 4,
          life: 0, maxLife: 6 + Math.random() * 6,
          size: 1 + Math.random() * 2,
          color, type: 'spark',
        })
      }
    }

    const spawnShell = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.28 : W * 0.72
      const y = H * 0.34
      particles.push({
        x, y,
        vx: isAtk ? -(0.8 + Math.random() * 0.8) : (0.8 + Math.random() * 0.8),
        vy: -(1.5 + Math.random() * 2),
        life: 0, maxLife: 25 + Math.random() * 10,
        size: 1.5, color: '#c9a84c', type: 'shell',
      })
    }

    // ── CRIT BURST ────────────────────────────────────

    const spawnCritBurst = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const x = isAtk ? W * 0.30 : W * 0.70
      const y = H * 0.38
      // Big golden bullet
      particles.push({
        x, y,
        vx: isAtk ? 10 + Math.random() * 4 : -(10 + Math.random() * 4),
        vy: (Math.random() - 0.5) * 0.4,
        life: 0, maxLife: 20 + Math.random() * 4,
        size: 6, color: '#ffd700', type: 'crit_bullet',
      })
      // Golden spark burst
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2
        const speed = 2 + Math.random() * 4
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed + (isAtk ? 2 : -2),
          vy: Math.sin(angle) * speed,
          life: 0, maxLife: 8 + Math.random() * 6,
          size: 1.5 + Math.random() * 2.5,
          color: Math.random() > 0.3 ? '#ffd700' : '#ffaa00', type: 'spark',
        })
      }
    }

    let critFlashFrames = 0

    // ── ANIMATION LOOP ────────────────────────────────

    let frame = 0
    const loop = () => {
      ctx.clearRect(0, 0, W, H)
      frame++

      // ── Process crit queue ──
      while (critQueueRef.current.length > 0) {
        const cs = critQueueRef.current.shift()!
        spawnCritBurst(cs)
        critFlashFrames = 4
      }

      // ── Staggered fire — asymmetric per side ──
      if (frame % atkFireInterval === 0) { spawnBulletByType('atk'); spawnShell('atk') }
      if (frame % defFireInterval === 0) { spawnBulletByType('def'); spawnShell('def') }
      if (frame % atkImpactInterval === 0) spawnImpact('atk')
      if (frame % defImpactInterval === 0) spawnImpact('def')

      // ── Ambient haze (enhancement #10) ──
      const hazeCount = particles.filter(p => p.type === 'haze').length
      if (hazeCount < 80) {
        const hazeDensity = 1 + Math.floor(2 * maxI)
        if (frame % Math.max(2, 6 - Math.floor(4 * maxI)) === 0) {
          for (let i = 0; i < hazeDensity; i++) {
            particles.push({
              x: Math.random() * W,
              y: H * 0.78 + Math.random() * H * 0.18,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -0.05 - Math.random() * 0.1,
              life: 0, maxLife: 150 + Math.random() * 100,
              size: 10 + Math.random() * 14,
              color: '#555', type: 'haze',
            })
          }
        }
      }

      // ── Update & render particles ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.life++
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue }

        p.x += p.vx
        p.y += p.vy
        if (p.type === 'shell') p.vy += 0.2
        if (p.type === 'smoke') { p.size += 0.2; p.vx *= 0.97; p.vy *= 0.98 }
        if (p.type === 'haze') { p.size += 0.08; p.vx *= 0.99; p.vy *= 0.99 }
        if (p.gravity) p.vy += p.gravity

        const alpha = 1 - p.life / p.maxLife

        if (p.type === 'bullet') {
          ctx.save()
          ctx.globalAlpha = alpha * 0.5
          ctx.shadowColor = p.color
          ctx.shadowBlur = 8
          ctx.fillStyle = p.color
          ctx.fillRect(p.x - 6, p.y - 1.5, 12, 3)
          ctx.globalAlpha = alpha
          ctx.shadowBlur = 0
          ctx.fillStyle = '#fff'
          ctx.fillRect(p.x - 3, p.y - 0.5, 6, 1)
          ctx.globalAlpha = alpha * 0.25
          ctx.fillStyle = p.color
          ctx.fillRect(p.x - 18, p.y - 0.3, 18, 0.6)
          ctx.restore()
        } else if (p.type === 'crit_bullet') {
          // Big golden tracer
          ctx.save()
          ctx.globalAlpha = alpha * 0.7
          ctx.shadowColor = '#ffd700'
          ctx.shadowBlur = 16
          ctx.fillStyle = '#ffd700'
          ctx.fillRect(p.x - 10, p.y - 3, 20, 6)
          ctx.globalAlpha = alpha
          ctx.shadowBlur = 0
          ctx.fillStyle = '#fff'
          ctx.fillRect(p.x - 5, p.y - 1, 10, 2)
          ctx.globalAlpha = alpha * 0.4
          ctx.fillStyle = '#ffd700'
          ctx.fillRect(p.x - 30, p.y - 0.5, 30, 1)
          ctx.restore()
        } else if (p.type === 'tank_shell') {
          // Big slow projectile
          ctx.save()
          ctx.globalAlpha = alpha * 0.6
          ctx.shadowColor = p.color
          ctx.shadowBlur = 12
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.ellipse(p.x, p.y, 8, 4, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = alpha * 0.9
          ctx.shadowBlur = 0
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.ellipse(p.x, p.y, 4, 2, 0, 0, Math.PI * 2)
          ctx.fill()
          // Thick trail
          ctx.globalAlpha = alpha * 0.2
          ctx.fillStyle = p.color
          const trailDir = p.vx > 0 ? -1 : 1
          ctx.fillRect(p.x + trailDir * 8, p.y - 1.5, trailDir * -24, 3)
          ctx.restore()
        } else if (p.type === 'jet_strafe') {
          // Diagonal tracer line
          ctx.save()
          ctx.globalAlpha = alpha * 0.7
          ctx.shadowColor = p.color
          ctx.shadowBlur = 6
          ctx.strokeStyle = p.color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3)
          ctx.stroke()
          ctx.globalAlpha = alpha
          ctx.shadowBlur = 0
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else if (p.type === 'warship_arc') {
          // Arcing cannonball
          ctx.save()
          ctx.globalAlpha = alpha * 0.8
          ctx.shadowColor = p.color
          ctx.shadowBlur = 10
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = alpha * 0.3
          ctx.fillStyle = '#aaa'
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 0.3, 0, Math.PI * 2)
          ctx.fill()
          // Arc trail dots
          ctx.globalAlpha = alpha * 0.15
          ctx.fillStyle = p.color
          for (let t = 1; t <= 4; t++) {
            ctx.beginPath()
            ctx.arc(p.x - p.vx * t * 0.8, p.y - p.vy * t * 0.8 + (p.gravity || 0) * t * t * 0.3, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        } else if (p.type === 'spark') {
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.shadowColor = p.color
          ctx.shadowBlur = 6
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else if (p.type === 'shell') {
          ctx.save()
          ctx.globalAlpha = alpha * 0.7
          ctx.fillStyle = p.color
          ctx.translate(p.x, p.y)
          ctx.rotate(p.life * 0.35)
          ctx.fillRect(-1, -2.5, 2, 5)
          ctx.restore()
        } else if (p.type === 'smoke') {
          // Soft radial-gradient smoke puff
          ctx.save()
          const smokeAlpha = alpha * 0.2
          const r = p.size
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
          grad.addColorStop(0, `rgba(160,160,160,${smokeAlpha * 0.6})`)
          grad.addColorStop(0.3, `rgba(130,130,130,${smokeAlpha * 0.4})`)
          grad.addColorStop(0.7, `rgba(100,100,100,${smokeAlpha * 0.15})`)
          grad.addColorStop(1, 'rgba(80,80,80,0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else if (p.type === 'haze') {
          // Layered volumetric haze — soft radial gradient
          ctx.save()
          const hazeAlpha = alpha * (0.06 + 0.05 * maxI)
          const hr = p.size
          const hGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr)
          hGrad.addColorStop(0, `rgba(90,85,80,${hazeAlpha * 0.5})`)
          hGrad.addColorStop(0.4, `rgba(70,65,60,${hazeAlpha * 0.3})`)
          hGrad.addColorStop(0.75, `rgba(50,48,45,${hazeAlpha * 0.1})`)
          hGrad.addColorStop(1, 'rgba(40,38,35,0)')
          ctx.fillStyle = hGrad
          ctx.beginPath()
          ctx.arc(p.x, p.y, hr, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // ── Muzzle flash glow ──
      const atkFlashPhase = frame % atkFireInterval
      if (atkFlashPhase < 3) {
        const fa = (1 - atkFlashPhase / 3) * 0.7
        ctx.save()
        ctx.globalAlpha = fa
        const g = ctx.createRadialGradient(W * 0.30, H * 0.38, 0, W * 0.30, H * 0.38, 16)
        g.addColorStop(0, '#ffee88')
        g.addColorStop(0.3, '#ff8800')
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(W * 0.24, H * 0.28, W * 0.12, H * 0.2)
        ctx.restore()
      }
      const defFlashPhase = frame % defFireInterval
      if (defFlashPhase < 3) {
        const fa = (1 - defFlashPhase / 3) * 0.7
        ctx.save()
        ctx.globalAlpha = fa
        const g = ctx.createRadialGradient(W * 0.70, H * 0.38, 0, W * 0.70, H * 0.38, 16)
        g.addColorStop(0, '#ffee88')
        g.addColorStop(0.3, '#ff8800')
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(W * 0.64, H * 0.28, W * 0.12, H * 0.2)
        ctx.restore()
      }

      // Crit flash timer (particles only, no overlay)
      if (critFlashFrames > 0) critFlashFrames--

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [isActive, atkIntensity, defIntensity, attackerColor, defenderColor, atkDominantType, defDominantType])

  return (
    <div
      className={`ba-scene ${!isActive ? 'ba-scene--paused' : ''}`}
      style={{
        background: `
          radial-gradient(ellipse at 0% 100%, ${attackerColor}40 0%, transparent 50%),
          radial-gradient(ellipse at 100% 100%, ${defenderColor}40 0%, transparent 50%),
          radial-gradient(ellipse at 50% 110%, rgba(15, 23, 42, 0.95) 0%, transparent 60%),
          linear-gradient(180deg, rgba(8, 12, 24, 0.5) 0%, rgba(12, 18, 32, 0.98) 100%)
        `,
      }}
    >
      {/* Canvas particle layer */}
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        className="ba-canvas"
      />

      {/* ── ATTACKER ── */}
      <div className="ba-avatar ba-avatar--atk">
        <div className="ba-badge" style={{ borderColor: `${attackerColor}88`, background: `radial-gradient(circle at 40% 30%, ${attackerColor}33, ${attackerColor}66)`, boxShadow: `0 0 10px ${attackerColor}33` }}>{attackerFlag}</div>
        <div className={`ba-soldier ${isActive ? 'ba-soldier--shooting' : ''}`}>
          <img
            src="/assets/soldier_blue.png"
            alt="Attacker"
            className="ba-soldier-img"
            draggable={false}
          />
        </div>
        <div className="ba-name" style={{ color: attackerColor, background: `${attackerColor}18`, borderColor: `${attackerColor}30` }}>{attackerName}</div>
      </div>

      {/* ── VS ── */}
      <div className="ba-vs">⚔</div>

      {/* ── DEFENDER ── */}
      <div className="ba-avatar ba-avatar--def">
        <div className="ba-badge" style={{ borderColor: `${defenderColor}88`, background: `radial-gradient(circle at 40% 30%, ${defenderColor}33, ${defenderColor}66)`, boxShadow: `0 0 10px ${defenderColor}33` }}>{defenderFlag}</div>
        <div className={`ba-soldier ${isActive ? 'ba-soldier--shooting' : ''}`}>
          <img
            src="/assets/soldier_red.png"
            alt="Defender"
            className="ba-soldier-img"
            draggable={false}
          />
        </div>
        <div className="ba-name" style={{ color: defenderColor, background: `${defenderColor}18`, borderColor: `${defenderColor}30` }}>{defenderName}</div>
      </div>
    </div>
  )
}
