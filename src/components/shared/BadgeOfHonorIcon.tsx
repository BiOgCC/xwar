import { Medal } from 'lucide-react'

interface BadgeOfHonorIconProps {
  size?: number
  color?: string
  style?: React.CSSProperties
  className?: string
}

/**
 * Reusable Badge of Honor icon — uses the Medal SVG from lucide-react.
 * Drop-in replacement for the 🎖️ emoji everywhere in the app.
 */
export default function BadgeOfHonorIcon({
  size = 14,
  color = '#22d38a',
  style,
  className,
}: BadgeOfHonorIconProps) {
  return (
    <Medal
      size={size}
      color={color}
      strokeWidth={2}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  )
}
