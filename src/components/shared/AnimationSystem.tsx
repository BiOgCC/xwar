import { useCallback } from 'react'
import type { Variants, Transition } from 'framer-motion'

/* ═══════════════════════════════════════════════════
   XWAR Animation System — Reusable Motion Primitives
   ═══════════════════════════════════════════════════ */

// ── Spring Configs ─────────────────────────────────
export const SPRINGS = {
  snappy: { type: 'spring', stiffness: 400, damping: 25 } as Transition,
  bouncy: { type: 'spring', stiffness: 300, damping: 15 } as Transition,
  gentle: { type: 'spring', stiffness: 200, damping: 20 } as Transition,
  heavy:  { type: 'spring', stiffness: 500, damping: 30 } as Transition,
}

// ── Modal Variants ─────────────────────────────────
export const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.85, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRINGS.bouncy },
  exit:    { opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.15 } },
}

export const overlayVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}

// ── Reward Item Variants ───────────────────────────
export const rewardItemVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.3, y: 40, rotate: -15 },
  visible: { opacity: 1, scale: 1, y: 0, rotate: 0, transition: SPRINGS.bouncy },
}

// ── Pop (scale from zero) ──────────────────────────
export const popVariants: Variants = {
  hidden:  { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: SPRINGS.snappy },
  exit:    { opacity: 0, scale: 0.8, transition: { duration: 0.1 } },
}

// ── Slide-Up ───────────────────────────────────────
export const slideUpVariants: Variants = {
  hidden:  { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: SPRINGS.gentle },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.15 } },
}

// ── Stagger Container ──────────────────────────────
export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

// ── Screen Shake Hook ──────────────────────────────
export function useScreenShake() {
  return useCallback((intensity: number = 5, duration: number = 300) => {
    const el = document.getElementById('app-root') || document.body
    const start = Date.now()
    const shake = () => {
      const elapsed = Date.now() - start
      if (elapsed > duration) {
        el.style.transform = ''
        return
      }
      const decay = 1 - elapsed / duration
      const x = (Math.random() - 0.5) * intensity * decay
      const y = (Math.random() - 0.5) * intensity * decay
      el.style.transform = `translate(${x}px, ${y}px)`
      requestAnimationFrame(shake)
    }
    requestAnimationFrame(shake)
  }, [])
}

// ── Tier-Specific FX Config ────────────────────────
export const TIER_FX: Record<string, {
  glow: boolean
  shake: number
  particles: number
  delay: number
  glowColor: string
  glowClass: string
}> = {
  t1: { glow: false, shake: 0,  particles: 0,  delay: 0,    glowColor: '#9ca3af', glowClass: '' },
  t2: { glow: false, shake: 0,  particles: 0,  delay: 100,  glowColor: '#22d38a', glowClass: 'glow-green' },
  t3: { glow: true,  shake: 2,  particles: 4,  delay: 200,  glowColor: '#3b82f6', glowClass: 'glow-blue' },
  t4: { glow: true,  shake: 4,  particles: 8,  delay: 400,  glowColor: '#a855f7', glowClass: 'glow-purple' },
  t5: { glow: true,  shake: 6,  particles: 12, delay: 600,  glowColor: '#f59e0b', glowClass: 'glow-gold' },
  t6: { glow: true,  shake: 10, particles: 20, delay: 1000, glowColor: '#ef4444', glowClass: 'glow-red' },
}
