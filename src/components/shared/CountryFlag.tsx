import { getCountryFlagUrl } from '../../stores/battleStore'

interface CountryFlagProps {
  iso: string
  size?: number
  style?: React.CSSProperties
  className?: string
}

/** Renders a country flag as an <img> tag using flagcdn.com — works on all platforms including Windows */
export default function CountryFlag({ iso, size = 20, style, className }: CountryFlagProps) {
  return (
    <img
      src={getCountryFlagUrl(iso, size <= 20 ? 40 : size <= 40 ? 80 : 160)}
      alt={iso}
      className={className}
      draggable={false}
      style={{
        width: `${size}px`,
        height: `${Math.round(size * 0.67)}px`,
        objectFit: 'cover',
        borderRadius: '2px',
        verticalAlign: 'middle',
        ...style,
      }}
    />
  )
}
