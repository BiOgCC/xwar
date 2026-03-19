import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../../stores/playerStore'

/**
 * SpriteAvatar — Animated full-body character using programmatic canvas transforms.
 * Applies breathing, bobbing, and subtle weight-shift to a single static image.
 */

const FULLBODY_MAP: Record<string, string> = {
  '/assets/avatars/avatar_male.png': '/assets/avatars/fullbody_male.png',
  '/assets/avatars/avatar_female.png': '/assets/avatars/fullbody_female.png',
}

interface SpriteAvatarProps {
  width?: number
  height?: number
}

export default function SpriteAvatar({ width = 120, height = 160 }: SpriteAvatarProps) {
  const avatar = usePlayerStore((s) => s.avatar)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const fullbodySrc = FULLBODY_MAP[avatar] || '/assets/avatars/fullbody_male.png'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cW = canvas.width
    const cH = canvas.height

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = fullbodySrc

    img.onload = () => {
      // Scale image to fit canvas, bottom-aligned
      const scale = Math.min(cW / img.width, cH / img.height) * 1.6
      const drawW = img.width * scale
      const drawH = img.height * scale
      const baseX = (cW - drawW) / 2
      const baseY = cH - drawH

      let t = 0

      const loop = () => {
        t += 0.016 // ~60fps

        ctx.clearRect(0, 0, cW, cH)

        // ── Breathing: subtle vertical scale oscillation ──
        const breathe = Math.sin(t * 2.5) * 0.008  // gentle 0.8% scale
        const scaleY = 1 + breathe
        const scaleX = 1 - breathe * 0.4  // slight compensating horizontal squeeze

        // ── Bob: very subtle vertical shift ──
        const bob = Math.sin(t * 2.5) * 1.5  // 1.5px up/down

        // ── Weight shift: tiny horizontal sway ──
        const sway = Math.sin(t * 1.2) * 0.8  // 0.8px left/right

        // ── Draw with transforms ──
        ctx.save()
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        // Pivot at bottom-center of character
        const pivotX = baseX + drawW / 2 + sway
        const pivotY = cH

        ctx.translate(pivotX, pivotY)
        ctx.scale(scaleX, scaleY)
        ctx.translate(-pivotX, -pivotY)

        ctx.drawImage(img, baseX + sway, baseY + bob, drawW, drawH)
        ctx.restore()

        animRef.current = requestAnimationFrame(loop)
      }

      animRef.current = requestAnimationFrame(loop)
    }

    return () => cancelAnimationFrame(animRef.current)
  }, [fullbodySrc])

  return (
    <canvas
      ref={canvasRef}
      width={width * 2}
      height={height * 2}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  )
}
