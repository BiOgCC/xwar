import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import type { Region } from '../../stores/regionStore'

interface RegionPopupProps {
  region: Region
  onClose: () => void
  onAttack?: () => void
}

export default function RegionPopup({ region, onClose, onAttack }: RegionPopupProps) {
  const world = useWorldStore()
  const country = world.countries.find(c => c.code === region.countryCode)
  const controllerName = getCountryName(region.controlledBy)
  
  return (
    <div className="region-popup-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose()
    }}>
      <div className="region-popup" style={{ '--region-color': country?.color || '#384860' } as React.CSSProperties}>
        <div className="region-popup__header">
          <div className="region-popup__title-row">
            <span className="region-popup__dot" />
            <h3 className="region-popup__name">{region.name}</h3>
          </div>
          <button className="region-popup__close" onClick={onClose}>✕</button>
        </div>

        <div className="region-popup__controller">
          <span className="region-popup__label">CONTROLLED BY</span>
          <span className="region-popup__value">{controllerName}</span>
        </div>

        {country?.empire && (
          <div className="region-popup__empire">
            <span className="region-popup__label">EMPIRE</span>
            <span className="region-popup__empire-badge">{country.empire}</span>
          </div>
        )}

        <div className="region-popup__stats">
          <div className="region-popup__stat">
            <span className="region-popup__stat-icon">🛡️</span>
            <span className="region-popup__stat-label">DEFENSE</span>
            <span className="region-popup__stat-value">{region.defense}</span>
          </div>
          <div className="region-popup__stat">
            <span className="region-popup__stat-icon">📈</span>
            <span className="region-popup__stat-label">CAPTURE</span>
            <span className="region-popup__stat-value">{Math.round(region.captureProgress)}%</span>
          </div>
          {region.attackedBy && (
            <div className="region-popup__stat">
              <span className="region-popup__stat-icon">⚔️</span>
              <span className="region-popup__stat-label">ATTACKED BY</span>
              <span className="region-popup__stat-value" style={{color:'#ef4444'}}>{getCountryName(region.attackedBy)}</span>
            </div>
          )}
        </div>

        <div className="region-popup__coords">
          {region.position[1].toFixed(2)}° {region.position[1] >= 0 ? 'N' : 'S'}, {region.position[0].toFixed(2)}° {region.position[0] >= 0 ? 'E' : 'W'}
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
