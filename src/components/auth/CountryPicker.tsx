import { useState, useRef, useEffect } from 'react'

export interface CountryOption {
  code: string
  name: string
  flag: string
}

// All 150+ game countries — ISO code, name, flag emoji
export const GAME_COUNTRIES: CountryOption[] = [
  // North America
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'PA', name: 'Panama', flag: '🇵🇦' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
  { code: 'TT', name: 'Trinidad & Tobago', flag: '🇹🇹' },
  // South America
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷' },
  // Europe
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'BA', name: 'Bosnia', flag: '🇧🇦' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱' },
  { code: 'MK', name: 'North Macedonia', flag: '🇲🇰' },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
  { code: 'MD', name: 'Moldova', flag: '🇲🇩' },
  // Russia & Central Asia
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
  { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
  { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
  // East Asia
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'KP', name: 'North Korea', flag: '🇰🇵' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'MN', name: 'Mongolia', flag: '🇲🇳' },
  // Southeast Asia
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'MM', name: 'Myanmar', flag: '🇲🇲' },
  { code: 'LA', name: 'Laos', flag: '🇱🇦' },
  { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'BN', name: 'Brunei', flag: '🇧🇳' },
  // South Asia
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  // Middle East
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
  // Africa
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'CI', name: 'Ivory Coast', flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'AO', name: 'Angola', flag: '🇦🇴' },
  { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾' },
  { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
  { code: 'SS', name: 'South Sudan', flag: '🇸🇸' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'NE', name: 'Niger', flag: '🇳🇪' },
  { code: 'TD', name: 'Chad', flag: '🇹🇩' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
  // Oceania
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
]

interface CountryPickerProps {
  value: string
  onChange: (code: string) => void
  error?: string
}

export default function CountryPicker({ value, onChange, error }: CountryPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = GAME_COUNTRIES.find(c => c.code === value)

  const filtered = search.trim()
    ? GAME_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : GAME_COUNTRIES

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (code: string) => {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="country-picker" ref={ref}>
      <button
        type="button"
        className={`country-picker-trigger${error ? ' country-picker-error' : ''}${open ? ' country-picker-open' : ''}`}
        onClick={() => {
          setOpen(v => !v)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      >
        <span className="country-picker-flag">{selected?.flag ?? '🌍'}</span>
        <span className="country-picker-name">{selected?.name ?? 'Select your nation'}</span>
        <span className="country-picker-code">{selected?.code ?? ''}</span>
        <span className="country-picker-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="country-picker-dropdown">
          <div className="country-picker-search-wrap">
            <input
              ref={inputRef}
              type="text"
              className="country-picker-search"
              placeholder="Search country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <ul className="country-picker-list">
            {filtered.length === 0 && (
              <li className="country-picker-empty">No results</li>
            )}
            {filtered.map(c => (
              <li
                key={c.code}
                className={`country-picker-item${c.code === value ? ' selected' : ''}`}
                onClick={() => handleSelect(c.code)}
              >
                <span className="country-picker-flag">{c.flag}</span>
                <span className="country-picker-name">{c.name}</span>
                <span className="country-picker-code">{c.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
