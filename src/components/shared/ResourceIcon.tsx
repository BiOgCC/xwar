import { RESOURCE_BY_KEY } from '../../stores/marketStore'
import {
  DollarSign, Droplet, Wrench, Atom, Bitcoin, Plane,
  Leaf, Fish, Crosshair, Medal,
  CakeSlice, Beef, UtensilsCrossed, Wheat,
  Package, ShieldAlert, CupSoda
} from 'lucide-react'

const LUCIDE_MAP: Record<string, { Icon: any; color: string }> = {
  // Currency
  money:         { Icon: DollarSign, color: '#22c55e' },
  bitcoin:       { Icon: Bitcoin,    color: '#f59e0b' },
  // Construction
  oil:           { Icon: Droplet,    color: '#3b82f6' },
  scrap:         { Icon: Wrench,     color: '#94a3b8' },
  materialX:     { Icon: Atom,       color: '#a855f7' },
  // Food
  bread:         { Icon: CakeSlice,       color: '#fcd34d' },
  steak:         { Icon: Beef,            color: '#f43f5e' },
  sushi:         { Icon: UtensilsCrossed, color: '#f472b6' },
  fish:          { Icon: Fish,            color: '#60a5fa' },
  wagyu:         { Icon: Beef,            color: '#ef4444' },
  wheat:         { Icon: Wheat,           color: '#eab308' },
  // Ammo
  greenBullets:  { Icon: Crosshair,  color: '#22c55e' },
  blueBullets:   { Icon: Crosshair,  color: '#3b82f6' },
  purpleBullets: { Icon: Crosshair,  color: '#a855f7' },
  redBullets:    { Icon: Crosshair,  color: '#ef4444' },
  // Cases
  lootBoxes:     { Icon: Package,      color: '#f97316' },
  militaryBoxes: { Icon: ShieldAlert,  color: '#22d38a' },
  // Military
  badgesOfHonor: { Icon: Medal,  color: '#22d38a' },
  jets:          { Icon: Plane,  color: '#38bdf8' },
  // Buffs
  magicTea:      { Icon: CupSoda, color: '#a78bfa' },
  energyLeaves:  { Icon: Leaf,    color: '#4ade80' },
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

  return <span style={{ fontSize: size, lineHeight: 1, display: 'inline-block', verticalAlign: 'middle', ...style }}>{emoji}</span>
}
