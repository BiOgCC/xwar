import { usePlayerStore } from '../../../stores/playerStore'
import { useRegionStore } from '../../../stores/regionStore'
import { useWorldStore } from '../../../stores/worldStore'
import { Anchor, Plane, Shield, Landmark, Rocket, MapPin, Fuel } from 'lucide-react'

/** Oil consumption per level per infrastructure type (per tick) */
const OIL_PER_LEVEL: Record<string, number> = {
  bunkerLevel: 4,
  militaryBaseLevel: 6,
  portLevel: 5,
  airportLevel: 7,
  missileLauncherLevel: 8,
}

const INFRA_DEFS = [
  { key: 'portLevel', Icon: Anchor, label: 'Port', color: '#0ea5e9' },
  { key: 'airportLevel', Icon: Plane, label: 'Air', color: '#a855f7' },
  { key: 'bunkerLevel', Icon: Shield, label: 'Bkr', color: '#22d38a' },
  { key: 'militaryBaseLevel', Icon: Landmark, label: 'Base', color: '#ef4444' },
  { key: 'missileLauncherLevel', Icon: Rocket, label: 'Msl', color: '#f59e0b' },
] as const

/** REGIONS tab — list of owned regions with infrastructure + consumption */
export default function GovRegionTab() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const regionStore = useRegionStore()
  const iso = player.countryCode || 'US'
  const myCountry = world.countries.find(c => c.code === iso)

  if (!myCountry) return <div className="gov-section"><p style={{ fontSize: '9px', color: '#3e4a5c' }}>Country not found.</p></div>

  // Get regions that belong to this country (homeland)
  const homeRegions = regionStore.regions.filter(r => r.countryCode === iso)
  // Split into controlled and lost
  const controlled = homeRegions.filter(r => r.controlledBy === iso)
  const occupied = homeRegions.filter(r => r.controlledBy !== iso)
  // Also get foreign regions we control
  const conquered = regionStore.regions.filter(r => r.countryCode !== iso && r.controlledBy === iso)

  // Calculate total oil consumption for a region
  const getRegionConsumption = (r: typeof homeRegions[0]) => {
    let oil = 0
    for (const inf of INFRA_DEFS) {
      const level = (r as any)[inf.key] as number
      const enabled = r.infraEnabled?.[inf.key] !== false
      if (level > 0 && enabled) {
        oil += level * (OIL_PER_LEVEL[inf.key] || 0)
      }
    }
    return oil
  }

  const totalConsumption = [...controlled, ...conquered].reduce((sum, r) => sum + getRegionConsumption(r), 0)

  const renderRegionRow = (r: typeof homeRegions[0], isForeign = false) => {
    const consumption = getRegionConsumption(r)
    const hasInfra = INFRA_DEFS.some(inf => (r as any)[inf.key] > 0)
    const isOccupied = r.controlledBy !== iso && r.countryCode === iso

    return (
      <div key={r.id} style={{
        padding: '8px 10px', borderRadius: '4px',
        background: isOccupied ? 'rgba(239,68,68,0.04)' : isForeign ? 'rgba(168,85,247,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isOccupied ? 'rgba(239,68,68,0.12)' : isForeign ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.06)'}`,
      }}>
        {/* Top: Name + Defense */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={12} color={isOccupied ? '#ef4444' : isForeign ? '#a855f7' : '#22d38a'} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{r.name}</span>
            {isForeign && (
              <span style={{ fontSize: '7px', padding: '1px 4px', background: 'rgba(168,85,247,0.15)', borderRadius: '2px', color: '#a855f7', fontWeight: 700 }}>
                {r.countryCode}
              </span>
            )}
            {isOccupied && (
              <span style={{ fontSize: '7px', padding: '1px 4px', background: 'rgba(239,68,68,0.15)', borderRadius: '2px', color: '#ef4444', fontWeight: 700 }}>
                OCCUPIED BY {r.controlledBy}
              </span>
            )}
          </div>
          <span style={{ fontSize: '9px', color: '#475569', fontFamily: 'var(--font-display)' }}>DEF {r.defense}</span>
        </div>

        {/* Infrastructure icons row */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {INFRA_DEFS.map(inf => {
            const level = (r as any)[inf.key] as number
            const enabled = r.infraEnabled?.[inf.key] !== false
            if (level === 0) return null
            return (
              <span key={inf.key} style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                fontSize: '8px', fontWeight: 700, padding: '2px 5px',
                borderRadius: '3px',
                background: enabled ? `${inf.color}12` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${enabled ? `${inf.color}30` : 'rgba(255,255,255,0.06)'}`,
                color: enabled ? inf.color : '#475569',
                opacity: enabled ? 1 : 0.5,
              }}>
                <inf.Icon size={10} />
                <span>{inf.label}</span>
                <span style={{ fontFamily: 'var(--font-display)' }}>{level}</span>
              </span>
            )
          })}
          {!hasInfra && (
            <span style={{ fontSize: '8px', color: '#3e4a5c', fontStyle: 'italic' }}>No infrastructure</span>
          )}
        </div>

        {/* Consumption */}
        {consumption > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <Fuel size={10} color="#f59e0b" />
            <span style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 600 }}>
              {consumption} oil/tick
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Summary Header */}
      <div className="gov-section" style={{ borderLeft: '3px solid #22d38a' }}>
        <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} color="#22d38a" /> TERRITORY OVERVIEW
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#22d38a', fontFamily: 'var(--font-display)' }}>{controlled.length}</div>
            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>HOMELAND</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#a855f7', fontFamily: 'var(--font-display)' }}>{conquered.length}</div>
            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>CONQUERED</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#ef4444', fontFamily: 'var(--font-display)' }}>{occupied.length}</div>
            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>OCCUPIED</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)' }}>{totalConsumption}</div>
            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>OIL/TICK</div>
          </div>
        </div>
      </div>

      {/* Controlled Regions */}
      <div className="gov-section">
        <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22d38a' }}>
          <MapPin size={14} color="#22d38a" /> HOMELAND REGIONS ({controlled.length}/{homeRegions.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {controlled.length === 0
            ? <p style={{ fontSize: '9px', color: '#3e4a5c' }}>All homeland regions are under occupation.</p>
            : controlled.map(r => renderRegionRow(r))
          }
        </div>
      </div>

      {/* Occupied Regions */}
      {occupied.length > 0 && (
        <div className="gov-section gov-section--red">
          <div className="gov-section__title gov-section__title--red" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="#ef4444" /> UNDER OCCUPATION ({occupied.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {occupied.map(r => renderRegionRow(r))}
          </div>
        </div>
      )}

      {/* Conquered Foreign Regions */}
      {conquered.length > 0 && (
        <div className="gov-section">
          <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a855f7' }}>
            <Landmark size={14} color="#a855f7" /> CONQUERED TERRITORIES ({conquered.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {conquered.map(r => renderRegionRow(r, true))}
          </div>
        </div>
      )}
    </>
  )
}
