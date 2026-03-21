import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import { useUIStore } from '../../stores/uiStore'
import type { Region } from '../../stores/regionStore'

interface RegionPopupProps {
  region: Region
  onClose: () => void
}

export default function RegionPopup({ region, onClose }: RegionPopupProps) {
  const world = useWorldStore()
  const ui = useUIStore()
  const country = world.countries.find(c => c.code === region.countryCode)
  const controllerName = getCountryName(region.controlledBy)

  const handleGoToCountry = () => {
    ui.setForeignCountry(region.countryCode)
    ui.setActivePanel('foreign_country')
    onClose()
  }

  const handleLaunchCyber = () => {
    ui.setActivePanel('cyberwarfare')
    onClose()
  }

  const handleLaunchMilitary = () => {
    ui.setActivePanel('military')
    onClose()
  }

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
          {region.isOcean ? (
            <>
              <div className="region-popup__stat">
                <span className="region-popup__stat-icon">🐟</span>
                <span className="region-popup__stat-label">FISHING</span>
                <span className="region-popup__stat-value">+{region.fishingBonus}</span>
              </div>
              <div className="region-popup__stat">
                <span className="region-popup__stat-icon">🛢️</span>
                <span className="region-popup__stat-label">OCEAN OIL</span>
                <span className="region-popup__stat-value">+{region.oilYield}</span>
              </div>
              <div className="region-popup__stat">
                <span className="region-popup__stat-icon">🛳️</span>
                <span className="region-popup__stat-label">TRADE ROUTE</span>
                <span className="region-popup__stat-value">${region.tradeRouteValue}</span>
              </div>
              <div className="region-popup__stat">
                <span className="region-popup__stat-icon">⚓</span>
                <span className="region-popup__stat-label">STATUS</span>
                <span className="region-popup__stat-value" style={{color: region.isBlockaded ? '#ef4444' : '#2ecc71'}}>
                  {region.isBlockaded ? 'BLOCKADED' : 'SECURE'}
                </span>
              </div>
            </>
          ) : (
            <div className="region-popup__stat">
              <span className="region-popup__stat-icon">🛡️</span>
              <span className="region-popup__stat-label">DEFENSE</span>
              <span className="region-popup__stat-value">{region.defense}</span>
            </div>
          )}
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

        {/* Action Buttons */}
        <div className="region-popup__actions">
          <button className="region-popup__action-btn region-popup__action-btn--country" onClick={handleGoToCountry}>
            🌐 GO TO COUNTRY
          </button>
          <button className="region-popup__action-btn region-popup__action-btn--cyber" onClick={handleLaunchCyber}>
            💻 LAUNCH CYBER OPS
          </button>
          <button className="region-popup__action-btn region-popup__action-btn--military" onClick={handleLaunchMilitary}>
            ⚔️ LAUNCH MILITARY OPS
          </button>
        </div>
      </div>
    </div>
  )
}
