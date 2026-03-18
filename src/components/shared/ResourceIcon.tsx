import { RESOURCE_BY_KEY } from '../../stores/marketStore'

/**
 * Renders the icon for a resource, using its graphic asset when available,
 * falling back to the emoji icon.
 *
 * Single source of truth: RESOURCE_DEFS in marketStore.ts.
 * Change the iconImage there and it updates everywhere.
 */
interface ResourceIconProps {
  /** playerKey or resourceId, e.g. 'scrap', 'oil', 'blueBullets' */
  resourceKey: string
  size?: number
  fallbackEmoji?: string
  style?: React.CSSProperties
}

export default function ResourceIcon({ resourceKey, size = 16, fallbackEmoji, style }: ResourceIconProps) {
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
