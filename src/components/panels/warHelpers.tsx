import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'

// Animated number display component (usable in loops unlike hooks)
export function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const display = useAnimatedNumber(value, duration)
  return <>{display.toLocaleString()}</>
}

// Shared time helpers
export const fmtElapsed = (startedAt: number) => {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}
export const fmtTicks = (ticks: number) => {
  const s = Math.max(0, ticks * 15)
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`
}

export const RANK_ICONS: Record<string, string> = {
  private: '🪖', corporal: '🎖️', sergeant: '⭐', lieutenant: '⭐⭐',
  captain: '⭐⭐⭐', colonel: '🏅', general: '👑',
}
