import { useRef, useState, useEffect } from 'react'

/**
 * Smoothly animates a number from its previous value to the target value.
 * Uses requestAnimationFrame for smooth 60fps transitions.
 */
export function useAnimatedNumber(target: number, duration: number = 600): number {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = target
    prevRef.current = target

    if (from === to) return

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(from + (to - from) * eased)
      setDisplay(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [target, duration])

  return display
}
