import { Swords, Target, Flame, Shield, Wind, Crosshair, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Tiny inline stat icons for gear cards.
 * Maps stat label keys to their matching lucide-react icon.
 */
const STAT_ICON_MAP: Record<string, (color: string, size?: number) => ReactNode> = {
  DMG:       (c, s = 10) => <Swords    size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  DAMAGE:    (c, s = 10) => <Swords    size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  CRIT:      (c, s = 10) => <Target    size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  'CRIT RATE':(c, s = 10) => <Target   size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  'C.DMG':   (c, s = 10) => <Flame     size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  'CRIT DMG':(c, s = 10) => <Flame     size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  CDMG:      (c, s = 10) => <Flame     size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  ARM:       (c, s = 10) => <Shield    size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  ARMOR:     (c, s = 10) => <Shield    size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  EVA:       (c, s = 10) => <Wind      size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  EVASION:   (c, s = 10) => <Wind      size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  DODGE:     (c, s = 10) => <Wind      size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  ACC:       (c, s = 10) => <Crosshair size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  ACCURACY:  (c, s = 10) => <Crosshair size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  PRECISION: (c, s = 10) => <Crosshair size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
  OVER:      (c, s = 10) => <Sparkles  size={s} color={c} strokeWidth={2.5} style={{ flexShrink: 0 }} />,
}

export function getStatIcon(label: string, color: string, size?: number): ReactNode {
  const factory = STAT_ICON_MAP[label]
  return factory ? factory(color, size) : null
}

export default STAT_ICON_MAP

