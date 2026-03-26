import { useMemo } from 'react'
import { useLeyLineStore, type ActiveLeyLine } from '../../../stores/leyLineStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useRegionStore } from '../../../stores/regionStore'
import { useUIStore } from '../../../stores/uiStore'
import { ARCHETYPE_META, type LeyLineArchetype } from '../../../data/leyLineRegistry'
import { ExternalLink } from 'lucide-react'

/* ── helpers ── */

const STATUS_DOT: Record<string, string> = {
  active:  '#a855f7',
  partial: '#ffb300',
  inactive: '#555577',
}

function getLineState(l: ActiveLeyLine): 'active' | 'partial' | 'inactive' {
  if (l.active) return 'active'
  if (l.completion > 0) return 'partial'
  return 'inactive'
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${Math.round(v * 100)}%`
}

const BONUS_LABELS: Record<string, string> = {
  taxIncome: 'Tax', populationGrowth: 'Pop', weaponProduction: 'Weapons',
  troopMovementSpeed: 'Speed', researchSpeed: 'Research', matxExtraction: 'MATX',
  defenderBonus: 'Defender', attackerAdvantage: 'Attacker', troopDamage: 'Troop DMG',
  foodYield: 'Food', armyUpkeep: 'Upkeep', buildSpeed: 'Build',
  oilExtraction: 'Oil', weaponDamage: 'Weapon DMG', deploymentSpeed: 'Deploy',
}

/* ═══════════════════════════════════════════════════
   GovLeyLinesTab — minimalist ley line overview
   ═══════════════════════════════════════════════════ */

export default function GovLeyLinesTab() {
  const store = useLeyLineStore()
  const iso = usePlayerStore(s => s.countryCode) || 'US'
  const regions = useRegionStore(s => s.regions)
  const setPanel = useUIStore(s => s.setActivePanel)

  // All land + sea line statuses
  const allLines = useMemo(() => store.getAllLineStatus(), [store])

  // Lines relevant to this country (holds ≥1 block)
  const myLines = useMemo(() => {
    return allLines.filter(l =>
      l.def.blocks.some(b => {
        const r = regions.find(rr => rr.id === b)
        return r && r.controlledBy === iso
      })
    )
  }, [allLines, regions, iso])

  // Categorize
  const active   = useMemo(() => myLines.filter(l => l.active && l.heldBy === iso), [myLines, iso])
  const allied   = useMemo(() => myLines.filter(l => l.active && l.heldBy !== iso), [myLines, iso])
  const partial  = useMemo(() => myLines.filter(l => !l.active && l.completion > 0), [myLines])
  const affected = useMemo(() => allLines.filter(l =>
    l.active && l.heldBy !== iso && !myLines.some(m => m.def.id === l.def.id) &&
    l.def.blocks.some(b => { const r = regions.find(rr => rr.id === b); return r && r.controlledBy === iso })
  ), [allLines, myLines, regions, iso])

  // Aggregate bonuses
  const bonuses = useMemo(() => store.getBonusesForCountry(iso), [store, iso])
  const bonusEntries = useMemo(() =>
    Object.entries(bonuses).filter(([, v]) => typeof v === 'number' && v !== 0)
  , [bonuses])

  const openFull = () => setPanel('ley_lines')

  return (
    <>
      {/* ── Summary Badges ── */}
      <div className="gov-section" style={{ padding: '6px 8px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px',
        }}>
          {[
            { n: active.length,   label: 'OWNED',   color: '#a855f7' },
            { n: allied.length,   label: 'ALLIED',  color: '#38bdf8' },
            { n: partial.length,  label: 'PARTIAL', color: '#ffb300' },
            { n: affected.length, label: 'AFFECTED',color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '6px 2px',
              background: `${s.color}08`, borderRadius: 4,
              border: `1px solid ${s.color}22`,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{s.n}</div>
              <div style={{ fontSize: 7, color: '#64748b', letterSpacing: '0.5px', fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Active Bonuses ── */}
      {bonusEntries.length > 0 && (
        <div className="gov-section" style={{ padding: '6px 8px' }}>
          <div className="gov-section__title gov-section__title--purple" style={{ marginBottom: 4, fontSize: 7 }}>
            ⚡ NET LEY LINE BONUSES
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {bonusEntries.map(([k, v]) => {
              const positive = (v as number) >= 0
              return (
                <span key={k} style={{
                  fontSize: 8, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                  background: positive ? 'rgba(34,211,138,0.08)' : 'rgba(239,68,68,0.08)',
                  color: positive ? '#22d38a' : '#ef4444',
                }}>
                  {BONUS_LABELS[k] ?? k} {fmtPct(v as number)}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lines List ── */}
      <div className="gov-section" style={{ padding: '6px 8px' }}>
        <div className="gov-section__title gov-section__title--purple" style={{ marginBottom: 4, fontSize: 7 }}>
          📡 LINE STATUS
        </div>

        {/* Active / Allied */}
        {[...active, ...allied].map(l => (
          <LineCompact key={l.def.id} line={l} state="active" iso={iso} onClick={openFull} />
        ))}

        {/* Partial */}
        {partial.map(l => (
          <LineCompact key={l.def.id} line={l} state="partial" iso={iso} onClick={openFull} />
        ))}

        {/* Affected (enemy lines touching your territory) */}
        {affected.map(l => (
          <LineCompact key={l.def.id} line={l} state="inactive" iso={iso} onClick={openFull} tag="AFFECTED" tagColor="#ef4444" />
        ))}

        {myLines.length === 0 && affected.length === 0 && (
          <div style={{ fontSize: 9, color: '#3e4a5c', textAlign: 'center', padding: '10px 0' }}>
            No ley lines touch your territory.
          </div>
        )}
      </div>

      {/* ── View All Link ── */}
      <button
        className="gov-btn"
        onClick={openFull}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          borderColor: 'rgba(168,85,247,0.3)', color: '#a855f7', fontSize: 9, padding: '6px 0',
        }}
      >
        <ExternalLink size={11} /> VIEW ALL LEY LINES
      </button>
    </>
  )
}

/* ── Compact line row ── */

function LineCompact({ line, state, iso, onClick, tag, tagColor }: {
  line: ActiveLeyLine; state: string; iso: string; onClick: () => void
  tag?: string; tagColor?: string
}) {
  const color = STATUS_DOT[state] ?? '#555'
  const meta = ARCHETYPE_META[line.def.archetype as LeyLineArchetype]
  const owned = line.heldBy === iso

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px', marginBottom: 2, borderRadius: 4, cursor: 'pointer',
        background: state === 'active' ? 'rgba(168,85,247,0.04)' : 'rgba(255,255,255,0.02)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = state === 'active' ? 'rgba(168,85,247,0.04)' : 'rgba(255,255,255,0.02)')}
    >
      {/* dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: tag ? (tagColor ?? '#ef4444') : color,
        boxShadow: `0 0 4px ${tag ? (tagColor ?? '#ef4444') : color}66`,
      }} />

      {/* name + archetype */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: tag ? (tagColor ?? '#ef4444') : color,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {line.def.name}
        </div>
        <div style={{ fontSize: 8, color: '#475569', display: 'flex', gap: 4 }}>
          <span style={{ color: meta?.color ?? '#888', fontWeight: 600 }}>{meta?.label ?? line.def.archetype}</span>
          <span>·</span>
          <span>{line.def.blocks.length} blk</span>
        </div>
      </div>

      {/* right label */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {tag ? (
          <span style={{ fontSize: 7, fontWeight: 700, color: tagColor ?? '#ef4444', letterSpacing: '0.3px' }}>{tag}</span>
        ) : line.active ? (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#a855f7' }}>
            {Math.round(line.effectiveness * 100)}%{owned ? '' : ' (ally)'}
          </span>
        ) : (
          <span style={{ fontSize: 9, color: '#ffb300', fontWeight: 600 }}>
            {Math.round(line.completion * 100)}%
          </span>
        )}
      </div>
    </div>
  )
}
