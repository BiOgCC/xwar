import { Flag, Landmark, Star, Snowflake, Crown, Flame, Ship, Trees, Zap, Compass, Building } from 'lucide-react'

// Centralized minimalist UI icon mappings for Xwar regions
// Expand or tune colors heavily inspired by the neon UI palette
const COUNTRY_ICONS: Record<string, { Icon: any, color: string }> = {
  US: { Icon: Landmark, color: '#22d38a' },     // Green Landmark
  RU: { Icon: Snowflake, color: '#ef4444' },    // Red Snowflake (Cold/Aggressive)
  CN: { Icon: Star, color: '#facc15' },         // Golden Star
  UK: { Icon: Crown, color: '#fca5a5' },        // Pastel Red Crown
  FR: { Icon: Flame, color: '#3b82f6' },        // Blue Flame
  BR: { Icon: Trees, color: '#4ade80' },        // Green Trees
  IN: { Icon: Zap, color: '#f97316' },          // Orange Zap (Tech/Power)
  JP: { Icon: Ship, color: '#ec4899' },         // Pink Ship
  EU: { Icon: Compass, color: '#60a5fa' },      // Blue Compass
  CNY: { Icon: Building, color: '#facc15'}      // Corporate
}

interface CountryIconProps {
  countryCode: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Returns a standardized, neon-themed minimalist UI icon for a given country code.
 * Intended to be placed next to Country Names in Government, Leaderboards, etc.
 */
export default function CountryIcon({ countryCode, size = 16, className, style }: CountryIconProps) {
  const code = countryCode.toUpperCase()
  const mapping = COUNTRY_ICONS[code]

  if (mapping) {
    const { Icon, color } = mapping
    return <Icon size={size} color={color} className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} />
  }

  // Generic fallback UI Flag marker
  return <Flag size={size} color="#94a3b8" className={className} style={{ display: 'inline-block', verticalAlign: 'middle', ...style }} />
}
