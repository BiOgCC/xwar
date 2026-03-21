import { useEffect, useRef, useCallback } from 'react'
import { checkAnnouncerThresholds, type AnnouncerPlayed } from '../../hooks/useAnnouncerSounds'
import { type TerrainType } from '../../data/terrainMap'
import { getCountryFlagUrl } from '../../stores/battleStore'
import '../../styles/battle-avatar.css'

type TracerStyle = 'infantry' | 'tank' | 'jet' | 'warship' | 'submarine'

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
  /** Trigger a recoil animation on the hit side */
  hitSide?: 'atk' | 'def' | null
  /** Dominant division type per side — changes tracer style */
  atkDominantType?: TracerStyle
  defDominantType?: TracerStyle
  /** Attacker share of total damage: 0 = defender dominating, 0.5 = even, 1 = attacker dominating */
  damageRatio?: number
  /** Timestamp (ms) when the battle started */
  battleStartedAt?: number
  /** Current round number (1-based) */
  currentRound?: number
  /** Terrain type for stage background */
  terrain?: TerrainType
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
  hitSide = null,
  atkDominantType = 'infantry',
  defDominantType = 'infantry',
  damageRatio = 0.5,
  battleStartedAt,
  currentRound = 1,
  terrain = 'urban',
}: BattleAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const critQueueRef = useRef<('atk' | 'def')[]>([])

  // ── GRENADE INTERACTION STATE ──
  interface Grenade {
    x: number; y: number; vx: number; vy: number
    fuseTimer: number; maxFuse: number; landed: boolean
    exploded: boolean
    bounces: number; maxBounces: number
    rotation: number; rotationSpeed: number
    fromLeft: boolean
  }
  const grenadesRef = useRef<Grenade[]>([])
  const throwCountRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const MAX_THROWS = 3
  const COOLDOWN_MS = 5000
  const FUSE_FRAMES = 180 // ~3 seconds at 60fps
  const GROUND_Y_RATIO = 0.78
  const announcerPlayedRef = useRef<AnnouncerPlayed>(new Set())

  // Queue crit events from prop changes
  useEffect(() => {
    if (critSide) critQueueRef.current.push(critSide)
  }, [critSide])

  // Click handler for throwing grenades
  const handleSceneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !isActive) return

    const now = Date.now()
    // Check cooldown
    if (cooldownUntilRef.current > now) return
    // Check throw count
    if (throwCountRef.current >= MAX_THROWS) {
      cooldownUntilRef.current = now + COOLDOWN_MS
      throwCountRef.current = 0
      return
    }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clickX = (e.clientX - rect.left) * scaleX
    const clickY = (e.clientY - rect.top) * scaleY
    const W = canvas.width
    const H = canvas.height
    const groundY = H * GROUND_Y_RATIO

    // Throw from the OPPOSITE side — lob it toward the enemy!
    const fromLeft = clickX >= W * 0.5
    const startX = fromLeft ? -8 : W + 8
    const startY = H * 0.3 + Math.random() * H * 0.15

    // Calculate velocity to arc toward the click point
    const dx = clickX - startX
    const travelFrames = 60 + Math.random() * 30 // ~1-1.5s flight time (slower arc)
    const vx = dx / travelFrames
    // Launch upward so it arcs down with gravity
    const gravity = 0.18
    const vy = (groundY - startY) / travelFrames - 0.5 * gravity * travelFrames

    grenadesRef.current.push({
      x: startX,
      y: startY,
      vx,
      vy,
      fuseTimer: 0,
      maxFuse: FUSE_FRAMES,
      landed: false,
      exploded: false,
      bounces: 0,
      maxBounces: 3,
      rotation: 0,
      rotationSpeed: (fromLeft ? 1 : -1) * (0.15 + Math.random() * 0.15),
      fromLeft,
    })

    throwCountRef.current++
    if (throwCountRef.current >= MAX_THROWS) {
      cooldownUntilRef.current = now + COOLDOWN_MS
      throwCountRef.current = 0
    }
  }, [isActive])

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

    // Dynamic clash point based on damage ratio
    // clashX slides from W*0.20 (def dominating) to W*0.80 (atk dominating)
    const ratio = Math.max(0, Math.min(1, damageRatio))
    const clashX = W * (0.20 + 0.60 * ratio)

    // Check announcer thresholds on each damageRatio change
    const battleAgeMs = battleStartedAt ? Date.now() - battleStartedAt : 0
    checkAnnouncerThresholds(ratio, announcerPlayedRef.current, battleAgeMs, currentRound)

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
      color: string; type: 'bullet' | 'spark' | 'shell' | 'smoke' | 'haze' | 'crit_bullet' | 'tank_shell' | 'jet_strafe' | 'warship_arc' | 'blood' | 'grenade_spark' | 'grenade_shrapnel' | 'grenade_smoke'
      gravity?: number
    }
    const particles: Particle[] = []

    // ── TRACER SPAWNERS BY TYPE ──────────────────────

    const spawnInfantryBullet = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const originX = isAtk ? W * 0.30 : W * 0.70
      const y = H * 0.38 + (Math.random() - 0.5) * 4
      const color = isAtk ? attackerColor : defenderColor
      const speed = 7 + Math.random() * 3
      const dist = Math.abs(clashX - originX)
      const ml = Math.max(4, Math.round(dist / speed) + Math.round(Math.random() * 4))
      particles.push({
        x: originX, y,
        vx: isAtk ? speed : -speed,
        vy: (Math.random() - 0.5) * 0.6,
        life: 0, maxLife: ml,
        size: 2.5, color, type: 'bullet',
      })
    }

    const spawnTankShell = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const originX = isAtk ? W * 0.30 : W * 0.70
      const y = H * 0.36 + (Math.random() - 0.5) * 6
      const color = isAtk ? attackerColor : defenderColor
      const speed = 4 + Math.random() * 2
      const dist = Math.abs(clashX - originX)
      const ml = Math.max(6, Math.round(dist / speed) + Math.round(Math.random() * 6))
      particles.push({
        x: originX, y,
        vx: isAtk ? speed : -speed,
        vy: (Math.random() - 0.5) * 0.3,
        life: 0, maxLife: ml,
        size: 5, color, type: 'tank_shell',
      })
      // Big muzzle flash sparks
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: originX, y,
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
      const originX = isAtk ? W * 0.25 + Math.random() * W * 0.15 : W * 0.60 + Math.random() * W * 0.15
      const y = H * 0.08 + Math.random() * H * 0.08
      const color = isAtk ? attackerColor : defenderColor
      const speed = 5 + Math.random() * 3
      const dist = Math.abs(clashX - originX)
      const ml = Math.max(6, Math.round(dist / speed) + Math.round(Math.random() * 6))
      particles.push({
        x: originX, y,
        vx: isAtk ? speed : -speed,
        vy: 2.5 + Math.random() * 1.5,
        life: 0, maxLife: ml,
        size: 2, color, type: 'jet_strafe',
      })
    }

    const spawnWarshipArc = (side: 'atk' | 'def') => {
      const isAtk = side === 'atk'
      const originX = isAtk ? W * 0.28 : W * 0.72
      const y = H * 0.42
      const color = isAtk ? attackerColor : defenderColor
      const speed = 3 + Math.random() * 2
      const dist = Math.abs(clashX - originX)
      const ml = Math.max(10, Math.round(dist / speed) + Math.round(Math.random() * 8))
      particles.push({
        x: originX, y,
        vx: isAtk ? speed : -speed,
        vy: -(3 + Math.random() * 2),
        life: 0, maxLife: ml,
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
        case 'submarine': spawnWarshipArc(side); break
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
      const x = clashX + (Math.random() - 0.5) * 10
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

    // ── GRENADE EXPLOSION ─────────────────────────────
    const spawnGrenadeExplosion = (gx: number, gy: number) => {
      // Big flash sparks
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
        const speed = 3 + Math.random() * 6
        particles.push({
          x: gx, y: gy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0, maxLife: 10 + Math.random() * 10,
          size: 2 + Math.random() * 3,
          color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00', type: 'grenade_spark',
        })
      }
      // Shrapnel pieces
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 5
        particles.push({
          x: gx, y: gy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 0, maxLife: 20 + Math.random() * 15,
          size: 1 + Math.random() * 2,
          color: Math.random() > 0.3 ? '#888' : '#555', type: 'grenade_shrapnel',
          gravity: 0.15,
        })
      }
      // Explosion smoke cloud
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: gx + (Math.random() - 0.5) * 10,
          y: gy + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -(0.5 + Math.random() * 1.5),
          life: 0, maxLife: 40 + Math.random() * 30,
          size: 8 + Math.random() * 8,
          color: '#444', type: 'grenade_smoke',
        })
      }
    }

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

      // ── Update grenades ──
      const grenades = grenadesRef.current
      const groundY = H * GROUND_Y_RATIO
      for (let gi = grenades.length - 1; gi >= 0; gi--) {
        const g = grenades[gi]
        if (g.exploded) { grenades.splice(gi, 1); continue }

        // Fuse always ticks (starts on throw)
        g.fuseTimer++

        // Physics
        if (!g.landed) {
          g.vy += 0.18 // gravity
          g.x += g.vx
          g.y += g.vy
          g.rotation += g.rotationSpeed

          // Bounce off ground
          if (g.y >= groundY) {
            g.y = groundY
            g.bounces++
            if (g.bounces >= g.maxBounces) {
              // Final landing
              g.landed = true
              g.vy = 0
              g.vx = 0
              g.rotationSpeed = 0
            } else {
              // Bounce: reverse Y with energy loss, reduce X speed
              const bounceDamping = 0.45 - g.bounces * 0.08
              g.vy = -Math.abs(g.vy) * bounceDamping
              g.vx *= 0.55
              g.rotationSpeed *= 0.6
              // Little bounce dust
              for (let bi = 0; bi < 3; bi++) {
                particles.push({
                  x: g.x + (Math.random() - 0.5) * 6,
                  y: groundY,
                  vx: (Math.random() - 0.5) * 2,
                  vy: -(0.5 + Math.random() * 1.5),
                  life: 0, maxLife: 10 + Math.random() * 8,
                  size: 2 + Math.random() * 2,
                  color: '#665', type: 'grenade_smoke',
                })
              }
            }
          }
        }

        // Fuse spark while ticking (in flight and on ground)
        if (frame % 3 === 0) {
          const sparkX = g.x + Math.sin(g.rotation) * 5
          const sparkY = g.y - 3 + Math.cos(g.rotation) * -5
          particles.push({
            x: sparkX + (Math.random() - 0.5) * 2,
            y: sparkY,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(1 + Math.random() * 2),
            life: 0, maxLife: 5 + Math.random() * 4,
            size: 1 + Math.random(),
            color: Math.random() > 0.5 ? '#ffaa00' : '#ff6600', type: 'grenade_spark',
          })
        }

        // Explode!
        if (g.fuseTimer >= g.maxFuse) {
          spawnGrenadeExplosion(g.x, g.y)
          g.exploded = true
        }

        // ── Render the grenade ──
        if (!g.exploded) {
          ctx.save()
          ctx.translate(g.x, g.y - 3)
          ctx.rotate(g.rotation)
          // Grenade body (dark olive oval)
          ctx.globalAlpha = 1
          ctx.fillStyle = '#3a4a2a'
          ctx.beginPath()
          ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2)
          ctx.fill()
          // Body ridges
          ctx.strokeStyle = '#2a3a1a'
          ctx.lineWidth = 0.5
          ctx.globalAlpha = 0.4
          for (let ri = -2; ri <= 2; ri++) {
            ctx.beginPath()
            ctx.moveTo(ri * 1.8, -3.5)
            ctx.lineTo(ri * 1.8, 3.5)
            ctx.stroke()
          }
          // Pin/top cap
          ctx.globalAlpha = 1
          ctx.fillStyle = '#6b7a3a'
          ctx.beginPath()
          ctx.ellipse(0, -3.5, 2.5, 1.5, 0, 0, Math.PI * 2)
          ctx.fill()
          // Lever detail
          ctx.strokeStyle = '#8a8a6a'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, -4)
          ctx.lineTo(2, -6)
          ctx.stroke()
          // Fuse spark glow
          const blinkRate = g.fuseTimer / g.maxFuse
          const blinkPeriod = Math.max(2, Math.round(12 - 10 * blinkRate))
          const isOn = frame % blinkPeriod < blinkPeriod / 2
          if (isOn) {
            ctx.shadowColor = '#ff4400'
            ctx.shadowBlur = 8 + 12 * blinkRate
            ctx.fillStyle = blinkRate > 0.7 ? '#ff2200' : '#ff6600'
            ctx.beginPath()
            ctx.arc(0, -5.5, 2, 0, Math.PI * 2)
            ctx.fill()
          }
          ctx.restore()
        }
      }

      // ── Blood splatter when hits reach the soldier ──
      // Attacker's fire hits defender soldier when clashX > W*0.70
      if (clashX > W * 0.70 && frame % 6 === 0) {
        const bx = W * 0.70 + (Math.random() - 0.3) * 10
        const by = H * 0.35 + (Math.random() - 0.5) * 16
        for (let i = 0; i < 4 + Math.round(3 * atkI); i++) {
          particles.push({
            x: bx, y: by,
            vx: 1 + Math.random() * 3,
            vy: -(1 + Math.random() * 3),
            life: 0, maxLife: 15 + Math.random() * 10,
            size: 1.5 + Math.random() * 2,
            color: Math.random() > 0.3 ? '#cc0000' : '#880000', type: 'blood',
            gravity: 0.25,
          })
        }
      }
      // Defender's fire hits attacker soldier when clashX < W*0.30
      if (clashX < W * 0.30 && frame % 6 === 0) {
        const bx = W * 0.30 + (Math.random() - 0.7) * 10
        const by = H * 0.35 + (Math.random() - 0.5) * 16
        for (let i = 0; i < 4 + Math.round(3 * defI); i++) {
          particles.push({
            x: bx, y: by,
            vx: -(1 + Math.random() * 3),
            vy: -(1 + Math.random() * 3),
            life: 0, maxLife: 15 + Math.random() * 10,
            size: 1.5 + Math.random() * 2,
            color: Math.random() > 0.3 ? '#cc0000' : '#880000', type: 'blood',
            gravity: 0.25,
          })
        }
      }

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
        if (p.type === 'smoke' || p.type === 'grenade_smoke') { p.size += 0.2; p.vx *= 0.97; p.vy *= 0.98 }
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
        } else if (p.type === 'grenade_spark') {
          ctx.save()
          ctx.globalAlpha = alpha
          ctx.shadowColor = p.color
          ctx.shadowBlur = 8
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        } else if (p.type === 'grenade_shrapnel') {
          ctx.save()
          ctx.globalAlpha = alpha * 0.8
          ctx.fillStyle = p.color
          ctx.translate(p.x, p.y)
          ctx.rotate(p.life * 0.5)
          ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8)
          ctx.restore()
        } else if (p.type === 'grenade_smoke') {
          ctx.save()
          const gsAlpha = alpha * 0.35
          const gr = p.size
          const gGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr)
          gGrad.addColorStop(0, `rgba(80,70,60,${gsAlpha * 0.7})`)
          gGrad.addColorStop(0.4, `rgba(60,55,50,${gsAlpha * 0.4})`)
          gGrad.addColorStop(1, 'rgba(40,38,35,0)')
          ctx.fillStyle = gGrad
          ctx.beginPath()
          ctx.arc(p.x, p.y, gr, 0, Math.PI * 2)
          ctx.fill()
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
        } else if (p.type === 'blood') {
          ctx.save()
          ctx.globalAlpha = alpha * 0.9
          ctx.shadowColor = '#cc0000'
          ctx.shadowBlur = 4
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (0.4 + alpha * 0.6), 0, Math.PI * 2)
          ctx.fill()
          // Blood trail
          ctx.globalAlpha = alpha * 0.3
          ctx.fillStyle = '#880000'
          ctx.beginPath()
          ctx.arc(p.x - p.vx * 0.5, p.y - p.vy * 0.5, p.size * 0.4, 0, Math.PI * 2)
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

      // ── Grenade ammo indicator ──
      const now = Date.now()
      const inCooldown = cooldownUntilRef.current > now
      const currentThrows = throwCountRef.current
      const available = inCooldown ? 0 : MAX_THROWS - currentThrows
      // Draw indicator dots bottom-left
      for (let i = 0; i < MAX_THROWS; i++) {
        ctx.save()
        ctx.globalAlpha = i < available ? 0.9 : 0.2
        ctx.fillStyle = i < available ? '#66cc44' : '#555'
        ctx.shadowColor = i < available ? '#66cc44' : 'transparent'
        ctx.shadowBlur = i < available ? 4 : 0
        ctx.beginPath()
        ctx.arc(12 + i * 10, H - 10, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      // Cooldown bar
      if (inCooldown) {
        const remaining = cooldownUntilRef.current - now
        const pct = 1 - remaining / COOLDOWN_MS
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.fillStyle = '#333'
        ctx.fillRect(6, H - 18, 30, 3)
        ctx.fillStyle = '#66cc44'
        ctx.fillRect(6, H - 18, 30 * pct, 3)
        ctx.restore()
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
  }, [isActive, atkIntensity, defIntensity, attackerColor, defenderColor, atkDominantType, defDominantType, damageRatio])

  // Reset grenade state on deactivation
  useEffect(() => {
    if (!isActive) {
      grenadesRef.current = []
      throwCountRef.current = 0
      cooldownUntilRef.current = 0
      announcerPlayedRef.current.clear()
    }
  }, [isActive])

  return (
    <div
      className={`ba-scene ${!isActive ? 'ba-scene--paused' : ''}`}
      onClick={handleSceneClick}
      style={{
        cursor: isActive ? 'crosshair' : 'default',
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
        <div className="ba-badge" style={{ borderColor: `${attackerColor}88`, background: `radial-gradient(circle at 40% 30%, ${attackerColor}33, ${attackerColor}66)`, boxShadow: `0 0 10px ${attackerColor}33`, overflow: 'hidden', padding: 0 }}><img src={getCountryFlagUrl(attackerFlag, 80)} alt={attackerFlag} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
        <div className={`ba-soldier ${isActive ? 'ba-soldier--shooting' : ''} ${hitSide === 'atk' ? 'ba-soldier--recoil-atk' : ''}`}>
          <img
            src="/assets/soldier_blue.png"
            alt="Attacker"
            className="ba-soldier-img"
            draggable={false}
          />
        </div>
        <div className="ba-name" style={{ color: attackerColor, background: `${attackerColor}18`, borderColor: `${attackerColor}30` }}>{attackerName}</div>
      </div>


      {/* ── DEFENDER ── */}
      <div className="ba-avatar ba-avatar--def">
        <div className="ba-badge" style={{ borderColor: `${defenderColor}88`, background: `radial-gradient(circle at 40% 30%, ${defenderColor}33, ${defenderColor}66)`, boxShadow: `0 0 10px ${defenderColor}33`, overflow: 'hidden', padding: 0 }}><img src={getCountryFlagUrl(defenderFlag, 80)} alt={defenderFlag} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
        <div className={`ba-soldier ${isActive ? 'ba-soldier--shooting' : ''} ${hitSide === 'def' ? 'ba-soldier--recoil-def' : ''}`}>
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
