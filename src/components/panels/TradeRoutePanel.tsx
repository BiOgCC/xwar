import { useMemo } from 'react'
import { useTradeRouteStore } from '../../stores/tradeRouteStore'
import type { TradeRoute, RouteControlState } from '../../stores/tradeRouteStore'
import type { GameMapHandle } from '../map/GameMap'

// ─────────────────────── helpers ───────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    '#00e5ff',
  partial:   '#ffb300',
  disrupted: '#ff4444',
  inactive:  '#555577',
}

const STATUS_LABELS: Record<string, string> = {
  active:    '✅ ACTIVE',
  partial:   '⚠️ PARTIAL',
  disrupted: '🚫 DISRUPTED',
  inactive:  '— INACTIVE',
}

const PARTIAL_MULT = 0.30

function routeIncome(route: TradeRoute, mult: number) {
  return {
    money: Math.round((route.tradedGoods + route.fish * 10) * mult),
    oil:   Math.round(route.oil * mult),
  }
}

interface RowProps {
  route: TradeRoute
  finalState: string
  money: number
  oil: number
  isObjective: boolean
  onFly: () => void
  onToggleObjective: () => void
  onDisrupt: () => void
}

function RouteRow({ route, finalState, money, oil, isObjective, onFly, onToggleObjective, onDisrupt }: RowProps) {
  const color = STATUS_COLORS[finalState] ?? '#fff'
  return (
    <div
      onClick={onFly}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        background: isObjective ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isObjective ? 'rgba(255,255,255,0.25)' : color + '22'}`,
        marginBottom: '5px',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = isObjective ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)')}
    >
      {/* Status dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
        boxShadow: `0 0 6px ${color}88`,
      }} />

      {/* Route info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isObjective && <span style={{ color: '#fff', marginRight: 4 }}>★</span>}
          {route.name}
        </div>
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
          {route.from} → {route.to} · {route.lengthNm.toLocaleString()} nm
        </div>
      </div>

      {/* Income */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {money > 0 && (
          <div style={{ fontSize: 10, color: '#22d38a', fontWeight: 700 }}>${money.toLocaleString()}</div>
        )}
        {oil > 0 && (
          <div style={{ fontSize: 9, color: '#a855f7' }}>{oil.toLocaleString()} oil</div>
        )}
        {money === 0 && oil === 0 && (
          <div style={{ fontSize: 9, color: '#555577' }}>—</div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <button
          title={isObjective ? 'Remove strategic objective' : 'Mark as objective'}
          onClick={onToggleObjective}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: isObjective ? '#fff' : '#55577', fontSize: 13, padding: '2px',
          }}
        >
          {isObjective ? '★' : '☆'}
        </button>
        <button
          title="Disrupt for 30 min"
          onClick={onDisrupt}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#ff7777', fontSize: 11, padding: '2px',
          }}
        >
          ⚡
        </button>
      </div>
    </div>
  )
}

// ─────────────────────── Panel ───────────────────────

interface TradeRoutePanelProps {
  mapRef?: React.RefObject<GameMapHandle>
}

export default function TradeRoutePanel({ mapRef }: TradeRoutePanelProps) {
  const store = useTradeRouteStore()
  const { routes, loaded, getRouteControlState, isRouteDisrupted, isStrategicObjective, toggleStrategicObjective, disruptRoute, computeTradeIncome } = store

  // Annotate routes with final state and income
  const annotated = useMemo(() => {
    return routes.map(route => {
      const controlState: RouteControlState = getRouteControlState(route)
      const disrupted = isRouteDisrupted(route.id)
      const finalState = disrupted ? 'disrupted' : controlState
      const mult = finalState === 'active' ? 1 : finalState === 'partial' ? PARTIAL_MULT : 0
      const { money, oil } = routeIncome(route, mult)
      return { route, finalState, money, oil }
    }).sort((a, b) => (b.money + b.oil * 10) - (a.money + a.oil * 10)) // sort by value desc
  }, [routes, getRouteControlState, isRouteDisrupted])

  // Summary stats
  const stats = useMemo(() => {
    const incomes = computeTradeIncome()
    const activeCount   = annotated.filter(a => a.finalState === 'active').length
    const partialCount  = annotated.filter(a => a.finalState === 'partial').length
    const disrupted     = annotated.filter(a => a.finalState === 'disrupted').length
    const totalMoney    = incomes.reduce((s, r) => s + r.moneyGained, 0)
    const totalOil      = incomes.reduce((s, r) => s + r.oilGained, 0)
    return { activeCount, partialCount, disrupted, totalMoney, totalOil }
  }, [annotated, computeTradeIncome])

  // At-risk routes (partial or disrupted)
  const atRisk = annotated.filter(a => a.finalState === 'partial' || a.finalState === 'disrupted')

  const flyTo = (route: TradeRoute) => {
    const midLng = (route.fromCoords[0] + route.toCoords[0]) / 2
    const midLat = (route.fromCoords[1] + route.toCoords[1]) / 2
    mapRef?.current?.flyTo(midLng, midLat, 3)
  }

  if (!loaded) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
        ⏳ Loading trade routes…
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, color: '#e2e8f0', padding: '4px 2px' }}>

      {/* ── Summary Bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: '6px', marginBottom: '14px',
      }}>
        {[
          { label: 'ACTIVE',    value: stats.activeCount,       color: '#00e5ff' },
          { label: 'PARTIAL',   value: stats.partialCount,      color: '#ffb300' },
          { label: 'DISRUPTED', value: stats.disrupted,         color: '#ff4444' },
          { label: 'INACTIVE',  value: routes.length - stats.activeCount - stats.partialCount - stats.disrupted, color: '#555577' },
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

      {/* ── Tick Income ── */}
      <div style={{
        background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.18)',
        borderRadius: 6, padding: '10px 14px', marginBottom: '14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1px', marginBottom: 2 }}>PER-TICK INCOME</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#22d38a' }}>
            ${stats.totalMoney.toLocaleString()}
          </div>
        </div>
        {stats.totalOil > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1px', marginBottom: 2 }}>OIL</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#a855f7' }}>
              {stats.totalOil.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* ── At Risk ── */}
      {atRisk.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: 9, color: '#ff7777', letterSpacing: '1px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,68,68,0.2)' }}>
            ⚠️ ROUTES AT RISK
          </div>
          {atRisk.map(({ route, finalState }) => {
            const color = STATUS_COLORS[finalState]
            return (
              <div key={route.id}
                onClick={() => flyTo(route)}
                style={{
                  fontSize: 10, color, padding: '4px 8px', marginBottom: 4,
                  background: `${color}11`, border: `1px solid ${color}22`,
                  borderRadius: 4, cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{route.name}</span>
                <span style={{ fontSize: 8, color: '#64748b' }}>
                  {finalState === 'partial'
                    ? `Capture ${route.to} for full income`
                    : 'Route is disrupted'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── All Routes ── */}
      <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '1px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        ALL ROUTES — SORTED BY VALUE
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 2 }}>
        {annotated.map(({ route, finalState, money, oil }) => (
          <RouteRow
            key={route.id}
            route={route}
            finalState={finalState}
            money={money}
            oil={oil}
            isObjective={isStrategicObjective(route.id)}
            onFly={() => flyTo(route)}
            onToggleObjective={() => toggleStrategicObjective(route.id)}
            onDisrupt={() => disruptRoute(route.id, 30 * 60 * 1000, 'manual')}
          />
        ))}
      </div>

      {/* ── Legend ── */}
      <div style={{
        marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 9, color: '#64748b',
      }}>
        <span style={{ color: '#00e5ff' }}>● Active = 100%</span>
        <span style={{ color: '#ffb300' }}>● Partial = 30%</span>
        <span style={{ color: '#ff4444' }}>● Disrupted = 0%</span>
        <span>★ = strategic objective</span>
      </div>
    </div>
  )
}
