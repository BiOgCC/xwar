import { useMemo } from 'react'
import { useLeyLineStore, type ActiveLeyLine } from '../../stores/leyLineStore'
import { ARCHETYPE_META, type LeyLineArchetype } from '../../data/leyLineRegistry'
import type { GameMapHandle } from '../map/GameMap'

// ─────────────────────── helpers ───────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:  '#a855f7',
  partial: '#ffb300',
  inactive: '#555577',
}

const STATUS_LABELS: Record<string, string> = {
  active:   '✅ ACTIVE',
  partial:  '⚠️ PARTIAL',
  inactive: '— INACTIVE',
}

function getLineState(line: ActiveLeyLine): string {
  if (line.active) return 'active'
  if (line.completion > 0) return 'partial'
  return 'inactive'
}

function bonusLabel(key: string): string {
  const map: Record<string, string> = {
    taxIncome: 'Tax Income',
    populationGrowth: 'Pop Growth',
    weaponProduction: 'Weapon Prod',
    troopMovementSpeed: 'Troop Speed',
    researchSpeed: 'Research',
    matxExtraction: 'MATX',
    defenderBonus: 'Defender',
    attackerAdvantage: 'Attacker',
    troopDamage: 'Troop DMG',
    foodYield: 'Food Yield',
    armyUpkeep: 'Army Upkeep',
    buildSpeed: 'Build Speed',
    oilExtraction: 'Oil',
    navalSupport: 'Naval',
    deploymentSpeed: 'Deploy Speed',
    deploymentRange: 'Deploy Range',
    tradeIncome: 'Trade $',
    resourceExtraction: 'Resources',
    techBaseline: 'Tech',
    infraMaintenance: 'Infra Cost',
    weaponDamage: 'Weapon DMG',
    politicalPower: 'Political',
    navalAirEffectiveness: 'Naval/Air',
  }
  return map[key] ?? key
}

function formatPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${Math.round(v * 100)}%`
}

interface LineRowProps {
  line: ActiveLeyLine
  state: string
  onFly: () => void
}

function LineRow({ line, state, onFly }: LineRowProps) {
  const color = STATUS_COLORS[state] ?? '#fff'
  const meta = ARCHETYPE_META[line.def.archetype as LeyLineArchetype]
  const bonuses = Object.entries(line.def.bonuses).filter(([, v]) => typeof v === 'number' && v !== 0)
  const tradeoffs = Object.entries(line.def.tradeoffs).filter(([, v]) => typeof v === 'number' && v !== 0)

  return (
    <div
      onClick={onFly}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '8px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        background: state === 'active' ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${color}22`,
        marginBottom: '5px',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = state === 'active' ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.02)')}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0,
          boxShadow: `0 0 6px ${color}88`,
        }} />

        {/* Line info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {line.def.name}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: meta?.color ?? '#888', fontWeight: 600 }}>{meta?.label ?? line.def.archetype}</span>
            <span>·</span>
            <span>{line.def.blocks.length} blocks</span>
            <span>·</span>
            <span>{Math.round(line.completion * 100)}% held</span>
          </div>
        </div>

        {/* Effectiveness pill */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {line.active ? (
            <div style={{ fontSize: 10, color: '#a855f7', fontWeight: 700 }}>
              {Math.round(line.effectiveness * 100)}% eff.
            </div>
          ) : (
            <div style={{ fontSize: 9, color: '#555577' }}>{STATUS_LABELS[state]}</div>
          )}
        </div>
      </div>

      {/* Bonuses row */}
      {(bonuses.length > 0 || tradeoffs.length > 0) && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingLeft: 16 }}>
          {bonuses.map(([k, v]) => (
            <span key={k} style={{
              fontSize: 8, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(34,211,138,0.08)', color: '#22d38a', fontWeight: 600,
            }}>
              {bonusLabel(k)} {formatPct(v as number)}
            </span>
          ))}
          {tradeoffs.map(([k, v]) => (
            <span key={k} style={{
              fontSize: 8, padding: '1px 5px', borderRadius: 3,
              background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontWeight: 600,
            }}>
              {bonusLabel(k)} {formatPct(v as number)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────── Panel ───────────────────────

interface LeyLinePanelProps {
  mapRef?: React.RefObject<GameMapHandle>
}

export default function LeyLinePanel({ mapRef }: LeyLinePanelProps) {
  const store = useLeyLineStore()

  const allLines = useMemo(() => store.getAllLineStatus(), [store])

  const annotated = useMemo(() => {
    return allLines.map(line => ({
      line,
      state: getLineState(line),
    })).sort((a, b) => {
      const order: Record<string, number> = { active: 0, partial: 1, inactive: 2 }
      return (order[a.state] ?? 3) - (order[b.state] ?? 3)
    })
  }, [allLines])

  // Summary stats
  const stats = useMemo(() => {
    const activeCount = annotated.filter(a => a.state === 'active').length
    const partialCount = annotated.filter(a => a.state === 'partial').length
    const inactiveCount = annotated.filter(a => a.state === 'inactive').length
    return { activeCount, partialCount, inactiveCount }
  }, [annotated])

  // Resonances
  const resonances = useMemo(() => store.getActiveResonances(), [store])

  const flyTo = (_line: ActiveLeyLine) => {
    // Could fly to the midpoint of the ley line's block region
    // For now, no-op unless we wire up region coords
  }

  return (
    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, color: '#e2e8f0', padding: '4px 2px' }}>

      {/* ── Summary Bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '6px', marginBottom: '14px',
      }}>
        {[
          { label: 'ACTIVE',   value: stats.activeCount,   color: '#a855f7' },
          { label: 'PARTIAL',  value: stats.partialCount,  color: '#ffb300' },
          { label: 'INACTIVE', value: stats.inactiveCount, color: '#555577' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.color}33`,
            borderRadius: 6, padding: '8px 4px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 8, color: '#64748b', letterSpacing: '0.5px', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Active Resonances ── */}
      {resonances.length > 0 && (
        <div style={{
          background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.18)',
          borderRadius: 6, padding: '10px 14px', marginBottom: '14px',
        }}>
          <div style={{ fontSize: 9, color: '#a855f7', letterSpacing: '1px', marginBottom: 6, fontWeight: 700 }}>
            ⚡ CONTINENTAL RESONANCES
          </div>
          {resonances.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#e2e8f0', marginBottom: 3 }}>
              <strong style={{ color: '#a855f7' }}>{r.resonance.name}</strong>
              <span style={{ color: '#64748b' }}> — {r.resonance.continent.replace('_', ' ')} · {r.resonance.scope}</span>
              <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                {Object.entries(r.resonance.bonus).filter(([, v]) => typeof v === 'number' && v !== 0).map(([k, v]) => (
                  <span key={k} style={{
                    fontSize: 8, padding: '1px 5px', borderRadius: 3,
                    background: 'rgba(168,85,247,0.12)', color: '#c084fc', fontWeight: 600,
                  }}>
                    {bonusLabel(k)} {formatPct(v as number)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── At Risk (partial) ── */}
      {annotated.filter(a => a.state === 'partial').length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: 9, color: '#ffb300', letterSpacing: '1px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,179,0,0.2)' }}>
            ⚠️ LINES AT RISK
          </div>
          {annotated.filter(a => a.state === 'partial').map(({ line }) => (
            <div key={line.def.id}
              onClick={() => flyTo(line)}
              style={{
                fontSize: 10, color: '#ffb300', padding: '4px 8px', marginBottom: 4,
                background: 'rgba(255,179,0,0.06)', border: '1px solid rgba(255,179,0,0.15)',
                borderRadius: 4, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>{line.def.name}</span>
              <span style={{ fontSize: 8, color: '#64748b' }}>
                {Math.round(line.completion * 100)}% controlled — capture remaining blocks
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── All Lines ── */}
      <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        ALL LEY LINES — SORTED BY STATUS
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 2 }}>
        {annotated.map(({ line, state }) => (
          <LineRow
            key={line.def.id}
            line={line}
            state={state}
            onFly={() => flyTo(line)}
          />
        ))}
      </div>

      {allLines.length === 0 && (
        <div style={{ textAlign: 'center', color: '#475569', fontSize: 11, padding: '20px 0' }}>
          No ley lines defined yet.
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{
        marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 9, color: '#64748b',
      }}>
        <span style={{ color: '#a855f7' }}>● Active = Full bonuses</span>
        <span style={{ color: '#ffb300' }}>● Partial = No bonuses</span>
        <span>● Inactive = Uncontrolled</span>
      </div>
    </div>
  )
}
