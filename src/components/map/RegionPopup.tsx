import { useState } from 'react'
import { useWorldStore } from '../../stores/worldStore'
import { getCountryName } from '../../stores/battleStore'
import { useUIStore } from '../../stores/uiStore'
import { useRegionStore } from '../../stores/regionStore'
import { useArmyStore } from '../../stores/army'
import { usePlayerStore } from '../../stores/playerStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import type { Region } from '../../stores/regionStore'
import type { Division } from '../../stores/army/types'

interface RegionPopupProps {
  region: Region
  onClose: () => void
}

export default function RegionPopup({ region, onClose }: RegionPopupProps) {
  const world = useWorldStore()
  const ui = useUIStore()
  const regionStore = useRegionStore()
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const country = world.countries.find(c => c.code === region.countryCode)
  const controllerName = getCountryName(region.controlledBy)

  const [showScavenge, setShowScavenge] = useState(false)
  const [selectedDivs, setSelectedDivs] = useState<string[]>([])
  const [scavengeMsg, setScavengeMsg] = useState('')
  const [navalMsg, setNavalMsg] = useState<string | null>(null)
  const [revoltMsg, setRevoltMsg] = useState<string | null>(null)

  const govStore = useGovernmentStore()

  const hasDebris = region.debris.scrap > 0 || region.debris.materialX > 0 || region.debris.militaryBoxes > 0
  const canScavenge = hasDebris && region.scavengeCount < 4

  // Get player's available Recon/Jeep divisions
  const scavengeableDivs = (Object.values(armyStore.divisions) as Division[]).filter(
    (d) => d.ownerId === player.name && (d.type === 'recon' || d.type === 'jeep') && d.status === 'ready'
  )

  // Active missions for this region
  const activeMissions = regionStore.scavengeMissions.filter(m => m.regionId === region.id)
  const playerMission = activeMissions.find(m => m.playerId === player.name)

  // Naval patrol state
  const activePatrol = regionStore.getPlayerPatrol(region.id)

  // Revolt system state
  const isOccupied = !region.isOcean && region.controlledBy !== region.countryCode
  const homelandBonus = regionStore.getHomelandBonus(region.id)
  const canTriggerRevolt = isOccupied && player.countryCode === region.countryCode &&
    govStore.canTriggerRevolt(region.countryCode, player.name) && !region.revoltBattleId
  const hasActiveRevolt = !!region.revoltBattleId

  const handleToggleDiv = (divId: string) => {
    setSelectedDivs(prev =>
      prev.includes(divId) ? prev.filter(id => id !== divId) : [...prev, divId]
    )
  }

  const handleStartScavenge = () => {
    const result = regionStore.startScavenge(region.id, selectedDivs)
    setScavengeMsg(result.message)
    if (result.success) {
      setSelectedDivs([])
      setShowScavenge(false)
    }
  }

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

  const handleToTheSea = () => {
    if (activePatrol) {
      const result = regionStore.stopNavalPatrol(region.id)
      setNavalMsg(result.message)
    } else {
      const result = regionStore.startNavalPatrol(region.id)
      setNavalMsg(result.message)
    }
    setTimeout(() => setNavalMsg(null), 4000)
  }

  const handleTriggerRevolt = () => {
    const result = regionStore.triggerRevolt(region.id, 'manual')
    setRevoltMsg(result.message)
    setTimeout(() => setRevoltMsg(null), 5000)
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

        {/* 🔥 Revolt / Homeland Bonus section */}
        {isOccupied && (
          <div style={{
            margin: '8px 0', padding: '10px 12px', borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.15))',
            border: `1px solid rgba(239,68,68,${region.revoltPressure > 70 ? '0.6' : '0.3'})`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: 1 }}>
                🔥 HOMELAND BONUS
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: region.revoltPressure >= 100 ? '#f59e0b' : '#ef4444' }}>
                {Math.round(region.revoltPressure)}%
              </span>
            </div>
            {/* Pressure bar */}
            <div style={{
              width: '100%', height: 6, borderRadius: 3,
              background: 'rgba(0,0,0,0.4)', overflow: 'hidden', marginBottom: 6,
            }}>
              <div style={{
                width: `${Math.min(100, region.revoltPressure)}%`, height: '100%', borderRadius: 3,
                background: region.revoltPressure >= 100
                  ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : region.revoltPressure > 70
                    ? 'linear-gradient(90deg, #ef4444, #f97316)'
                    : 'linear-gradient(90deg, #dc2626, #ef4444)',
                transition: 'width 0.5s ease',
                ...(region.revoltPressure >= 100 ? { animation: 'revolt-pulse 1s ease-in-out infinite' } : {}),
              }} />
            </div>
            {/* Bonus breakdown */}
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#d1d5db' }}>
              <span>⚔️ ATK +{((homelandBonus.atkMult - 1) * 100).toFixed(0)}%</span>
              <span>💨 Dodge +{((homelandBonus.dodgeMult - 1) * 100).toFixed(0)}%</span>
              <span>👤 Player +{((homelandBonus.playerDmgMult - 1) * 100).toFixed(0)}%</span>
            </div>
            {/* Status labels */}
            {hasActiveRevolt && (
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#f59e0b', textAlign: 'center' }}>
                ⚔️ REVOLT BATTLE IN PROGRESS
              </div>
            )}
            {region.revoltPressure >= 100 && !hasActiveRevolt && (
              <div style={{ marginTop: 6, fontSize: 10, color: '#f97316', textAlign: 'center' }}>
                ⚡ Max pressure — auto-revolt may trigger any tick (2.5% chance)
              </div>
            )}
          </div>
        )}

        {revoltMsg && (
          <div style={{ fontSize: 11, color: '#ef4444', margin: '4px 0', textAlign: 'center', fontWeight: 700 }}>{revoltMsg}</div>
        )}

        {/* Debris section */}
        {hasDebris && (
          <div style={{
            margin: '8px 0', padding: '8px 12px', borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(168,85,247,0.15))',
            border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4, letterSpacing: 1 }}>
              ⚙️ BATTLEFIELD DEBRIS ({4 - region.scavengeCount} waves left)
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ color: '#9ca3af' }}>⚙️ {region.debris.scrap.toLocaleString()} Scrap</span>
              <span style={{ color: '#ec4899' }}>⚛️ {region.debris.materialX.toLocaleString()} MatX</span>
              {region.debris.militaryBoxes > 0 && (
                <span style={{ color: '#f59e0b' }}>📦 {region.debris.militaryBoxes} Box{region.debris.militaryBoxes > 1 ? 'es' : ''}</span>
              )}
            </div>
          </div>
        )}

        {/* Active scavenge mission */}
        {playerMission && (
          <div style={{
            margin: '4px 0 8px', padding: '6px 12px', borderRadius: 6,
            background: 'rgba(34,211,138,0.12)', border: '1px solid rgba(34,211,138,0.3)',
            fontSize: 11, color: '#22d38a',
          }}>
            🔧 Your troops are scavenging... Returns in {Math.max(0, Math.ceil((playerMission.endsAt - Date.now()) / 60000))} min
          </div>
        )}

        {/* Active naval patrol indicator */}
        {activePatrol && (
          <div style={{
            margin: '4px 0 8px', padding: '6px 12px', borderRadius: 6,
            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)',
            fontSize: 11, color: '#06b6d4',
          }}>
            🚢 Naval patrol active — farming OIL + FISH per tick. {activePatrol.divisionIds.length} division(s) deployed.
          </div>
        )}

        <div className="region-popup__coords">
          {region.position[1].toFixed(2)}° {region.position[1] >= 0 ? 'N' : 'S'}, {region.position[0].toFixed(2)}° {region.position[0] >= 0 ? 'E' : 'W'}
        </div>

        {/* Scavenge division picker */}
        {showScavenge && (
          <div style={{
            margin: '8px 0', padding: '10px', borderRadius: 8,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>
              SELECT RECON / JEEP DIVISIONS
            </div>
            {scavengeableDivs.length === 0 ? (
              <div style={{ fontSize: 11, color: '#6b7280' }}>No ready Recon or Jeep divisions available.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                {scavengeableDivs.map(d => (
                  <label key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '4px 8px', borderRadius: 4, fontSize: 11,
                    background: selectedDivs.includes(d.id) ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                    border: selectedDivs.includes(d.id) ? '1px solid rgba(245,158,11,0.5)' : '1px solid transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedDivs.includes(d.id)}
                      onChange={() => handleToggleDiv(d.id)}
                      style={{ accentColor: '#f59e0b' }}
                    />
                    <span style={{ color: d.type === 'recon' ? '#22d38a' : '#3b82f6' }}>
                      {d.type === 'recon' ? '🔍' : '🚗'} {d.name}
                    </span>
                    <span style={{ color: '#6b7280', marginLeft: 'auto' }}>⭐{d.starQuality}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                onClick={handleStartScavenge}
                disabled={selectedDivs.length === 0}
                style={{
                  flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 11, letterSpacing: 1,
                  background: selectedDivs.length > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#374151',
                  color: selectedDivs.length > 0 ? '#000' : '#6b7280',
                }}
              >
                🔧 SEND ({selectedDivs.length})
              </button>
              <button
                onClick={() => { setShowScavenge(false); setSelectedDivs([]) }}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 11,
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {scavengeMsg && (
          <div style={{ fontSize: 11, color: '#f59e0b', margin: '4px 0', textAlign: 'center' }}>{scavengeMsg}</div>
        )}

        {navalMsg && (
          <div className="region-popup__toast">{navalMsg}</div>
        )}

        {/* Action Buttons */}
        <div className="region-popup__actions">
          <button className="region-popup__action-btn region-popup__action-btn--country" onClick={handleGoToCountry}>
            🌐 GO TO COUNTRY
          </button>
          {canScavenge && !showScavenge && !playerMission && (
            <button
              className="region-popup__action-btn"
              onClick={() => setShowScavenge(true)}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#000', fontWeight: 700, border: 'none',
              }}
            >
              🔧 SCAVENGE
            </button>
          )}
          <button className="region-popup__action-btn region-popup__action-btn--cyber" onClick={handleLaunchCyber}>
            💻 LAUNCH CYBER OPS
          </button>
          <button className="region-popup__action-btn region-popup__action-btn--military" onClick={handleLaunchMilitary}>
            ⚔️ LAUNCH MILITARY OPS
          </button>
          {region.isOcean && (
            <button
              className={`region-popup__action-btn region-popup__action-btn--naval ${activePatrol ? 'region-popup__action-btn--naval-active' : ''}`}
              onClick={handleToTheSea}
            >
              {activePatrol ? '🚢 RECALL PATROL' : '⚓ TO THE SEA'}
            </button>
          )}
          {canTriggerRevolt && (
            <button
              className="region-popup__action-btn"
              onClick={handleTriggerRevolt}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff', fontWeight: 700, border: 'none',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                animation: region.revoltPressure >= 70 ? 'revolt-pulse 2s ease-in-out infinite' : undefined,
              }}
            >
              🔥 TRIGGER REVOLT ({Math.round(region.revoltPressure)}%)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
