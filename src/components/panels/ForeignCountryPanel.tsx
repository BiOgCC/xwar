import { useState } from 'react'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useUIStore } from '../../stores/uiStore'
import { useBattleStore, getCountryName } from '../../stores/battleStore'
import CountryFlag from '../shared/CountryFlag'


type Tab = 'overview' | 'intelligence' | 'diplomacy'

// ── Player classification helpers ─────────────────────────────────────────
// Based on skill points from governmentStore citizens mock data.
// Since we don't have per-citizen skill data in the store,
// we derive a plausible breakdown seeded from the country controller name.
function classifyCitizens(countryCode: string): { eco: number; fighter: number; hybrid: number; total: number } {
  // Seed a deterministic pseudo-random based on countryCode
  const seed = countryCode.charCodeAt(0) + (countryCode.charCodeAt(1) || 0)
  const total = 10 + (seed % 20) // 10–29 citizens
  const fightPct = ((seed * 7) % 60) / 100  // 0–60% fighters
  const ecoPct   = ((seed * 3) % 60) / 100  // 0–60% eco
  const remaining = Math.max(0, 1 - fightPct - ecoPct)

  const fighter = Math.round(total * fightPct)
  const eco     = Math.round(total * ecoPct)
  const hybrid  = Math.max(0, total - fighter - eco)

  return { eco, fighter, hybrid, total }
}

// Helper: player's own country
function getPlayerIso(): string {
  return usePlayerStore.getState().countryCode || 'US'
}

// ── Diplomacy colors ──────────────────────────────────────────────────────
const ALLIANCE_COLORS: Record<string, string> = {
  NATO: '#3b82f6',
  'Eastern Bloc': '#ef4444',
}

export default function ForeignCountryPanel() {
  const [tab, setTab] = useState<Tab>('overview')

  const world      = useWorldStore()
  const govStore   = useGovernmentStore()
  const battles    = useBattleStore()
  const ui         = useUIStore()

  const iso = ui.selectedForeignCountry
  if (!iso) return null

  const country = world.countries.find(c => c.code === iso)
  if (!country) return null

  const playerIso  = getPlayerIso()
  // flag rendered as <CountryFlag iso={iso} /> instead of emoji
  const allianceColor = country.empire ? (ALLIANCE_COLORS[country.empire] || '#94a3b8') : '#475569'

  // ── Wars involving this country ───────────────────────────────────────
  const activeWars = world.wars.filter(
    w => w.status === 'active' && (w.attacker === iso || w.defender === iso)
  )
  const atWarWithPlayer = activeWars.some(
    w => (w.attacker === iso && w.defender === playerIso) ||
         (w.attacker === playerIso && w.defender === iso)
  )

  // ── Occupied countries (countries whose empire === this iso) ──────────
  const occupiedCountries = world.countries.filter(
    c => c.code !== iso && c.empire === iso
  )

  // ── Active battles ────────────────────────────────────────────────────
  const activeBattles = Object.values(battles.battles).filter(
    b => b.status === 'active' && (b.attackerId === iso || b.defenderId === iso)
  )

  // ── Citizens classification ───────────────────────────────────────────
  const { eco, fighter, hybrid, total } = classifyCitizens(iso)

  // ── Adjacency ─────────────────────────────────────────────────────────
  const neighbors = (ADJACENCY_MAP[iso] || []).map(code => ({
    code,
    flagIso: code,
    name: getCountryName(code),
  }))

  // ── Declare War ───────────────────────────────────────────────────────
  const canDeclare = world.canAttack(playerIso, iso) === false && !atWarWithPlayer
  const alreadyAtWar = atWarWithPlayer

  const handleDeclareWar = () => {
    world.declareWar(playerIso, iso)
    ui.addFloatingText(`WAR DECLARED vs ${country.name}!`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
  }

  // ── Status badge ──────────────────────────────────────────────────────
  const warStatusBadge = atWarWithPlayer
    ? { label: '⚔️ AT WAR', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' }
    : activeWars.length > 0
    ? { label: '🔥 IN CONFLICT', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }
    : { label: '🕊️ PEACE', color: '#22d38a', bg: 'rgba(34,211,138,0.1)' }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1,
    padding: '7px 4px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    border: `1px solid ${tab === t ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '4px',
    background: tab === t ? 'rgba(56,189,248,0.1)' : 'transparent',
    color: tab === t ? '#38bdf8' : '#64748b',
    cursor: 'pointer',
  })

  const stat = (label: string, value: React.ReactNode, color = '#e2e8f0') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: '10px', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '10px', fontWeight: 700, color }}>{value}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {/* Country Hero Header */}
      <div style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.6), ${country.color}22)`,
        border: `1px solid ${country.color}44`,
        borderRadius: '8px',
        padding: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <CountryFlag iso={iso} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
            {country.name.toUpperCase()}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
            {country.controller}
          </div>
          {country.empire && (
            <div style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', fontSize: '9px', fontWeight: 700, borderRadius: '3px', background: `${allianceColor}22`, border: `1px solid ${allianceColor}66`, color: allianceColor }}>
              {country.empire}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', background: warStatusBadge.bg, border: `1px solid ${warStatusBadge.color}66`, color: warStatusBadge.color }}>
            {warStatusBadge.label}
          </div>
          {country.taxExempt && (
            <div style={{ fontSize: '8px', color: '#f59e0b', marginTop: '4px' }}>🚩 OCCUPIED</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => { ui.setActivePanel('missions') }}
          style={{
            flex: 1,
            padding: '12px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            border: '1px solid rgba(59,130,246,0.5)',
            borderRadius: '6px',
            color: '#fff',
            fontWeight: 900,
            fontSize: '11px',
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            textTransform: 'uppercase' as const,
            boxShadow: '0 0 15px rgba(59,130,246,0.2)',
          }}
        >
          📋 ENGAGE OPERATIONS
        </button>
        <button
          onClick={() => {
            if (atWarWithPlayer) {
              ui.setActivePanel('combat')
              ui.addFloatingText(`⚔️ Targeting ${country.name}!`, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
            } else {
              ui.addFloatingText('⚠️ Not at war with this nation!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
            }
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: atWarWithPlayer
              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
              : 'linear-gradient(135deg, #374151, #1f2937)',
            border: `1px solid ${atWarWithPlayer ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
            color: atWarWithPlayer ? '#fff' : '#64748b',
            fontWeight: 900,
            fontSize: '11px',
            letterSpacing: '1px',
            cursor: atWarWithPlayer ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            textTransform: 'uppercase' as const,
            boxShadow: atWarWithPlayer ? '0 0 20px rgba(239,68,68,0.2)' : 'none',
          }}
        >
          ⚔️ ENGAGE TARGET
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button style={tabStyle('overview')}   onClick={() => setTab('overview')}>🌍 OVERVIEW</button>
        <button style={tabStyle('intelligence')} onClick={() => setTab('intelligence')}>🔍 INTEL</button>
        <button style={tabStyle('diplomacy')}  onClick={() => setTab('diplomacy')}>🤝 DIPLOMACY</button>
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="hud-card">
          <div className="hud-card__title">🌍 OVERVIEW</div>
          {stat('Population', country.population.toLocaleString())}
          {stat('Regions Controlled', country.regions)}
          {stat('Military Rating', country.military, '#ef4444')}
          {stat('Treasury', `$${country.fund.money.toLocaleString()}`, '#22d38a')}
          {stat('Alliance', country.empire || 'None', allianceColor)}
          {stat('Controller', country.controller)}
          {iso === playerIso && (() => {
            // Pop cap: division system removed — show 0/0
            return null
          })()}
          {occupiedCountries.length > 0 && stat(
            'Occupies',
            <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {occupiedCountries.map(oc => (
                <span key={oc.code} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '3px', padding: '1px 5px', fontSize: '9px' }}>
                  <CountryFlag iso={oc.code} size={14} style={{ marginRight: '3px' }} /> {oc.name}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {/* ── INTELLIGENCE TAB ──────────────────────────────────────────────── */}
      {tab === 'intelligence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Territory */}
          <div className="hud-card">
            <div className="hud-card__title">🗺️ TERRITORY</div>
            {stat('Regions Controlled', country.regions)}
            {occupiedCountries.length === 0
              ? stat('Occupied Countries', 'None')
              : (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>OCCUPIED COUNTRIES</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {occupiedCountries.map(oc => (
                      <div key={oc.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'rgba(239,68,68,0.07)', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <CountryFlag iso={oc.code} size={16} />
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#fca5a5' }}>{oc.name}</div>
                          <div style={{ fontSize: '8px', color: '#64748b' }}>{oc.taxExempt ? 'Tax Exempt' : 'Taxed'} • {oc.regions} regions</div>
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: '8px', color: '#ef4444', fontWeight: 700 }}>🚩 OCCUPIED</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          </div>

          {/* Citizens */}
          <div className="hud-card">
            <div className="hud-card__title">👥 CITIZENS — {total} Players</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' }}>
              <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(34,211,138,0.07)', border: '1px solid rgba(34,211,138,0.25)', borderRadius: '6px' }}>
                <div style={{ fontSize: '18px' }}>🟢</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#22d38a', marginTop: '2px' }}>{eco}</div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>ECO</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px' }}>
                <div style={{ fontSize: '18px' }}>🔴</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#ef4444', marginTop: '2px' }}>{fighter}</div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>FIGHTER</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px' }}>
                <div style={{ fontSize: '18px' }}>🟡</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#f59e0b', marginTop: '2px' }}>{hybrid}</div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>HYBRID</div>
              </div>
            </div>
            <div style={{ fontSize: '8px', color: '#475569', marginTop: '6px', textAlign: 'center' }}>
              ≥66.6% Eco pts = Eco • ≥66.6% Mil pts = Fighter • Otherwise Hybrid
            </div>
          </div>

          {/* Active Battles */}
          {activeBattles.length > 0 && (
            <div className="hud-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="hud-card__title" style={{ color: '#ef4444' }}>⚔️ ACTIVE CONFLICTS ({activeBattles.length})</div>
              {activeBattles.map(b => (
                <div key={b.id} style={{ fontSize: '10px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span><CountryFlag iso={b.attackerId} size={14} style={{ marginRight: '3px' }} /> vs <CountryFlag iso={b.defenderId} size={14} style={{ marginRight: '3px' }} /> {b.regionName}</span>
                  <span style={{ color: '#f59e0b', fontSize: '9px' }}>RND {b.rounds.length}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DIPLOMACY TAB ─────────────────────────────────────────────────── */}
      {tab === 'diplomacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

          {/* Relation status */}
          <div className="hud-card">
            <div className="hud-card__title">🤝 RELATION STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: `${warStatusBadge.bg}`, border: `1px solid ${warStatusBadge.color}44`, borderRadius: '6px', marginTop: '8px' }}>
              <CountryFlag iso={iso} size={24} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: warStatusBadge.color }}>{warStatusBadge.label}</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>
                  {atWarWithPlayer ? 'You are in active conflict with this nation.'
                   : activeWars.length > 0 ? 'This nation is in conflict with others.'
                   : 'No active hostilities.'}
                </div>
              </div>
            </div>
          </div>

          {/* Active wars list */}
          {activeWars.length > 0 && (
            <div className="hud-card">
              <div className="hud-card__title">⚔️ ONGOING WARS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {activeWars.map(w => {
                  const isAttacker = w.attacker === iso
                  const opponent = isAttacker ? w.defender : w.attacker
                  const daysAgo = Math.floor((Date.now() - w.startedAt) / 86400000)
                  return (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px' }}>
                      <span style={{ fontSize: '9px', color: isAttacker ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                        {isAttacker ? '⚔️ ATK' : '🛡️ DEF'}
                      </span>
                      <CountryFlag iso={opponent} size={14} />
                      <span style={{ fontSize: '10px', color: '#e2e8f0' }}>{getCountryName(opponent)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#64748b' }}>{daysAgo}d ago</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Borders */}
          <div className="hud-card">
            <div className="hud-card__title">🗺️ BORDERS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
              {neighbors.map(n => (
                <button
                  key={n.code}
                  onClick={() => { ui.setForeignCountry(n.code); ui.setActivePanel('foreign_country') }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#e2e8f0', cursor: 'pointer' }}
                  title={`View ${n.name}`}
                >
                  <CountryFlag iso={n.flagIso} size={14} style={{ marginRight: '3px' }} /> {n.name}
                </button>
              ))}
            </div>
          </div>

          {/* Declare War */}
          {!alreadyAtWar && iso !== playerIso && (
            <div className="hud-card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="hud-card__title" style={{ color: '#ef4444' }}>⚔️ WAR ACTIONS</div>
              <p style={{ fontSize: '9px', color: '#64748b', margin: '6px 0 10px' }}>
                Declaring war requires a congressional vote via the Laws tab. This is a direct executive action reserved for emergencies.
              </p>
              <button
                className="hud-btn-primary"
                style={{ width: '100%', background: '#ef4444', border: 'none', padding: '10px', fontWeight: 900, fontSize: '12px', letterSpacing: '1px' }}
                onClick={handleDeclareWar}
              >
                ⚔️ DECLARE WAR ON {country.name.toUpperCase()}
              </button>
            </div>
          )}
          {alreadyAtWar && (
            <div style={{ textAlign: 'center', padding: '12px', fontSize: '10px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px' }}>
              ⚔️ You are already at war with {country.name}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
