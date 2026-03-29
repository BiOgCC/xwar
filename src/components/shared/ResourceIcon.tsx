import { RESOURCE_BY_KEY } from '../../stores/marketStore'
import {
  DollarSign, Crosshair, Medal,
  Beef, Package, ShieldAlert, CupSoda, Plane, Wheat
} from 'lucide-react'

// ── AI-generated 3D image assets (black bg blends via mix-blend-mode: screen) ──
const IMAGE_ICONS: Record<string, string> = {
  oil:       '/assets/icons/oil.png',
  scrap:     '/assets/icons/scrap.png',
  bitcoin:   '/assets/icons/bitcoin.png',
  materialX: '/assets/icons/materialX.png',
  bread:     '/assets/icons/bread.png',
  steak:     '/assets/icons/steak.png',
  wagyu:     '/assets/icons/steak.png',   // reuse steak asset
  sushi:     '/assets/icons/sushi.png',
  fish:      '/assets/icons/fish.png',
}

// ── Fallback Lucide icons for assets not yet generated ──
const LUCIDE_MAP: Record<string, { Icon: any; color: string }> = {
  money:         { Icon: DollarSign,   color: '#22c55e' },
  wheat:         { Icon: Wheat,        color: '#eab308' },
  greenBullets:  { Icon: Crosshair,    color: '#22c55e' },
  blueBullets:   { Icon: Crosshair,    color: '#3b82f6' },
  purpleBullets: { Icon: Crosshair,    color: '#a855f7' },
  redBullets:    { Icon: Crosshair,    color: '#ef4444' },
  lootBoxes:     { Icon: Package,      color: '#f97316' },
  militaryBoxes: { Icon: ShieldAlert,  color: '#22d38a' },
  badgesOfHonor: { Icon: Medal,        color: '#22d38a' },
  jets:          { Icon: Plane,        color: '#38bdf8' },
  magicTea:      { Icon: CupSoda,      color: '#a78bfa' },
  energyLeaves:  { Icon: Beef,         color: '#4ade80' },
}

interface ResourceIconProps {
  /** playerKey or resourceId, e.g. 'scrap', 'oil', 'blueBullets' */
  resourceKey: string
  size?: number
  fallbackEmoji?: string
  style?: React.CSSProperties
}

export default function ResourceIcon({ resourceKey, size = 16, fallbackEmoji, style }: ResourceIconProps) {
  // 1. Use AI-generated 3D image if available
  const imgSrc = IMAGE_ICONS[resourceKey]
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={resourceKey}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          mixBlendMode: 'screen',   // black background dissolves on dark UI
          imageRendering: 'auto',
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }

  // 2. Lucide vector fallback
  const mapped = LUCIDE_MAP[resourceKey]
  if (mapped) {
    const { Icon, color } = mapped
    return <Icon size={size} color={color} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }} />
  }

  // 3. Emoji / text fallback
  const def = RESOURCE_BY_KEY[resourceKey]
  const emoji = fallbackEmoji || def?.icon || '❓'
  return <span style={{ fontSize: size, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}>{emoji}</span>
}
