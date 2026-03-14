interface RegionInfo {
  name: string
  controller: string
  empire: string | null
  military: number
  treasury: number
  regions: number
  color: string
  lngLat: [number, number]
}

interface RegionPopupProps {
  region: RegionInfo
  onClose: () => void
  onAttack?: () => void
}

export default function RegionPopup({ region, onClose, onAttack }: RegionPopupProps) {
  return (
    <div className="region-popup-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className="region-popup" style={{ '--region-color': region.color } as React.CSSProperties}>
        <div className="region-popup__header">
          <div className="region-popup__title-row">
            <span className="region-popup__dot" />
            <h3 className="region-popup__name">{region.name}</h3>
          </div>
          <button className="region-popup__close" onClick={onClose}>✕</button>
        </div>

        <div className="region-popup__controller">
          <span className="region-popup__label">CONTROLLED BY</span>
          <span className="region-popup__value">{region.controller}</span>
        </div>

        {region.empire && (
          <div className="region-popup__empire">
            <span className="region-popup__label">EMPIRE</span>
            <span className="region-popup__empire-badge">{region.empire}</span>
          </div>
        )}

        <div className="region-popup__stats">
          <div className="region-popup__stat">
            <span className="region-popup__stat-icon">🛡️</span>
            <span className="region-popup__stat-label">MILITARY</span>
            <span className="region-popup__stat-value">{region.military}</span>
          </div>
          <div className="region-popup__stat">
            <span className="region-popup__stat-icon">💰</span>
            <span className="region-popup__stat-label">TREASURY</span>
            <span className="region-popup__stat-value">${(region.treasury / 1000).toFixed(0)}K</span>
          </div>
          <div className="region-popup__stat">
            <span className="region-popup__stat-icon">🗺️</span>
            <span className="region-popup__stat-label">REGIONS</span>
            <span className="region-popup__stat-value">{region.regions}</span>
          </div>
        </div>

        <div className="region-popup__coords">
          {region.lngLat[1].toFixed(2)}° {region.lngLat[1] >= 0 ? 'N' : 'S'}, {region.lngLat[0].toFixed(2)}° {region.lngLat[0] >= 0 ? 'E' : 'W'}
        </div>

        {onAttack && (
          <button className="region-popup__attack" onClick={onAttack}>
            ⚔️ ENGAGE TARGET
          </button>
        )}
      </div>
    </div>
  )
}
