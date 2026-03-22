import { RESOURCE_BY_KEY } from '../../stores/marketStore'
import {
  DollarSign, Droplet, Wrench, Atom, Bitcoin, Plane,
  Leaf, Fish, Drumstick, Utensils, Crosshair, Medal
} from 'lucide-react'

const LUCIDE_MAP: Record<string, { Icon: any; color: string }> = {
  money: { Icon: DollarSign, color: '#22c55e' },
  oil: { Icon: Droplet, color: '#3b82f6' },
  scrap: { Icon: Wrench, color: '#94a3b8' },
  materialX: { Icon: Atom, color: '#a855f7' },
  bitcoin: { Icon: Bitcoin, color: '#f59e0b' },
  jets: { Icon: Plane, color: '#38bdf8' },
  badgesOfHonor: { Icon: Medal, color: '#22d38a' },
  wheat: { Icon: Leaf, color: '#eab308' },
  fish: { Icon: Fish, color: '#60a5fa' },
  steak: { Icon: Drumstick, color: '#f43f5e' },
  bread: { Icon: Utensils, color: '#fcd34d' },
  sushi: { Icon: Utensils, color: '#f472b6' },
  wagyu: { Icon: Drumstick, color: '#b91c1c' },
  greenBullets: { Icon: Crosshair, color: '#22c55e' },
  blueBullets: { Icon: Crosshair, color: '#3b82f6' },
  purpleBullets: { Icon: Crosshair, color: '#a855f7' },
  redBullets: { Icon: Crosshair, color: '#ef4444' },
}

interface ResourceIconProps {
  /** playerKey or resourceId, e.g. 'scrap', 'oil', 'blueBullets' */
  resourceKey: string
  size?: number
  fallbackEmoji?: string
  style?: React.CSSProperties
}

export default function ResourceIcon({ resourceKey, size = 16, fallbackEmoji, style }: ResourceIconProps) {
  const mapped = LUCIDE_MAP[resourceKey]
  if (mapped) {
    const { Icon, color } = mapped
    return <Icon size={size} color={color} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} />
  }

  const def = RESOURCE_BY_KEY[resourceKey]
  const emoji = fallbackEmoji || def?.icon || '❓'
  const imgSrc = def?.iconImage

  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={def?.name || resourceKey}
        style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', ...style }}
      />
    )
  }

  return <span style={style}>{emoji}</span>
}
