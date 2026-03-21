/**
 * RegionPicker — Shared dropdown for selecting a region within a country.
 *
 * Usage:
 *   <RegionPicker countryCode="US" value={regionId} onChange={setRegionId} />
 */
import { getRegionsForCountry, COUNTRIES_WITH_REGIONS } from '../../data/regionRegistry'

interface RegionPickerProps {
  /** ISO-2 country code (e.g. "US") */
  countryCode: string
  /** Currently selected region ID */
  value: string
  /** Called when user picks a region */
  onChange: (regionId: string) => void
  /** Optional label override */
  label?: string
  /** Optional className */
  className?: string
  /** Disabled state */
  disabled?: boolean
}

export default function RegionPicker({ countryCode, value, onChange, label, className, disabled }: RegionPickerProps) {
  const regions = getRegionsForCountry(countryCode)

  // If this country has no hardcoded regions, show a disabled placeholder
  if (!COUNTRIES_WITH_REGIONS.includes(countryCode)) {
    return (
      <div style={{ marginBottom: '8px' }}>
        {label && (
          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
            {label}
          </div>
        )}
        <select
          disabled
          className={className}
          style={{
            width: '100%',
            background: 'var(--color-surface, #0d1117)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
            color: '#475569',
            padding: '6px',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            borderRadius: '4px',
            cursor: 'not-allowed',
          }}
        >
          <option>Entire Country (no sub-regions)</option>
        </select>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '8px' }}>
      {label && (
        <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
          {label}
        </div>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={className}
        style={{
          width: '100%',
          background: 'var(--color-surface, #0d1117)',
          border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
          color: '#fff',
          padding: '6px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px',
          borderRadius: '4px',
        }}
      >
        <option value="" disabled>Select Region ({regions.length} available)...</option>
        {regions.map(r => (
          <option key={r.id} value={r.id}>
            {r.name} ({r.id})
          </option>
        ))}
      </select>
    </div>
  )
}
