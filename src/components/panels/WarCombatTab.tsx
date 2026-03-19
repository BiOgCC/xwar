import React, { useState, Suspense } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, type DivisionType } from '../../stores/armyStore'
import { useBattleStore, getCountryName, TACTICAL_ORDERS } from '../../stores/battleStore'
import type { TacticalOrder } from '../../stores/battleStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import BattleAvatar from '../shared/BattleAvatar'
import CountryFlag from '../shared/CountryFlag'
import { getCountryTerrain } from '../../data/terrainMap'
import { AnimatedNumber, fmtElapsed, fmtTicks } from './warHelpers'

const BattleScene3D = React.lazy(() => import('./BattleScene3D'))

export default
function CombatTab({ panelFullscreen, setPanelFullscreen }: { panelFullscreen?: boolean; setPanelFullscreen?: (v: boolean) => void }) {
  const battleStore = useBattleStore()
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [expandedBattles, setExpandedBattles] = useState<Set<string>>(new Set())
  const [deployCount, setDeployCount] = useState<Record<string, number>>({})
  const [editingOrderMsg, setEditingOrderMsg] = useState<Record<string, boolean>>({})
  const [scene3DBattle, setScene3DBattle] = useState<{
    id: string
    atkDivs: { type: DivisionType; name: string; health: number; maxHealth: number }[]
    defDivs: { type: DivisionType; name: string; health: number; maxHealth: number }[]
  } | null>(null)

  // Combat tick timer
  const [combatTickLeft, setCombatTickLocal] = useState(() => useBattleStore.getState().combatTickLeft)
  const [viewingRound, setViewingRound] = useState<{ battleId: string; roundIdx: number } | null>(null)
  React.useEffect(() => {
    const unsub = useBattleStore.subscribe((state) => { setCombatTickLocal(state.combatTickLeft) })
    return unsub
  }, [])

  // Crit visual effect tracking
  const [critSide, setCritSide] = useState<'atk' | 'def' | null>(null)
  const [hitSide, setHitSide] = useState<'atk' | 'def' | null>(null)

  // Determine dominant division type for tracer variation
  const getDominantType = (divIds: string[]): 'infantry' | 'tank' | 'jet' | 'warship' => {
    const counts = { infantry: 0, tank: 0, jet: 0, warship: 0 }
    divIds.forEach(id => {
      const d = armyStore.divisions[id]
      if (!d) return
      if (['recon', 'assault', 'sniper', 'rpg'].includes(d.type)) counts.infantry++
      else if (['jeep', 'tank'].includes(d.type)) counts.tank++
      else if (d.type === 'jet') counts.jet++
      else if (d.type === 'warship') counts.warship++
    })
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'infantry') as 'infantry' | 'tank' | 'jet' | 'warship'
  }

  const iso = player.countryCode || 'US'
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const pastBattles = Object.values(battleStore.battles).filter(b => b.status !== 'active').slice(-5)

  const get3DDivisions = (divIds: string[]) => {
    return divIds.map(id => {
      const d = armyStore.divisions[id]
      if (!d) return null
      return { type: d.type, name: d.name, health: d.health, maxHealth: d.maxHealth }
    }).filter(Boolean) as { type: DivisionType; name: string; health: number; maxHealth: number }[]
  }

  return (
    <div className="war-battles" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* === Fixed Header: Tick Timer + Food (sidebar mode only) === */}
      <div style={{ flexShrink: 0 }}>
      {/* 3D Battle Scene Overlay */}
      {scene3DBattle && (
        <Suspense fallback={
          <div className="battle-scene-3d" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚔️</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700, letterSpacing: '2px' }}>LOADING 3D BATTLE...</div>
            </div>
          </div>
        }>
          <BattleScene3D
            battle={{ id: scene3DBattle.id }}
            attackerDivisions={scene3DBattle.atkDivs}
            defenderDivisions={scene3DBattle.defDivs}
            onClose={() => setScene3DBattle(null)}
          />
        </Suspense>
      )}

      {/* Tick Timer — only in sidebar mode */}
      {!panelFullscreen && activeBattles.length > 0 && (
        <div className="war-combat-header" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 10px', marginBottom: '6px',
          background: 'rgba(96, 165, 250, 0.08)', borderRadius: '6px',
          border: '1px solid rgba(96, 165, 250, 0.15)',
        }}>
          <span style={{ fontSize: '12px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: combatTickLeft <= 3 ? '#60a5fa' : '#94a3b8' }}>
              <span>NEXT TICK</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: combatTickLeft <= 3 ? '#60a5fa' : '#3b82f6' }}>{combatTickLeft}s</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
              <div style={{
                width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                background: combatTickLeft <= 3 ? '#60a5fa' : '#3b82f6',
                transition: 'width 0.9s linear', borderRadius: '2px',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Food — sidebar mode only */}
      {!panelFullscreen && (
        <div className="war-combat-food" style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
          {[
            { key: 'bread', icon: '🍞', label: 'Bread', count: player.bread, sta: 10, heal: 1 },
            { key: 'sushi', icon: '🍣', label: 'Sushi', count: player.sushi, sta: 20, heal: 2 },
            { key: 'wagyu', icon: '🥩', label: 'Wagyu', count: player.wagyu, sta: 30, heal: 3 },
          ].map(f => (
            <button key={f.key} disabled={f.count <= 0}
              onClick={() => {
                player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                if (result.success) console.log(result.message)
              }}
              style={{
                flex: 1, padding: '5px 2px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
                background: f.count > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${f.count > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '14px' }}>{f.icon}</div>
              <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0' }}>{f.count}</div>
              <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
              <div style={{ fontSize: '7px', color: '#3b82f6' }}>+{f.heal}% HP</div>
            </button>
          ))}
        </div>
      )}
      </div>


      {/* === Scrollable Battles List === */}
      <div className="war-battles-grid" style={panelFullscreen ? {
        flex: 1, overflowX: 'auto', overflowY: 'auto',
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '8px', padding: '4px', alignContent: 'start', alignItems: 'start',
      } : { flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {activeBattles.length === 0 && pastBattles.length === 0 && (
        <div className="war-card" style={{ gridColumn: '1 / -1' }}><div className="war-empty">No active battles. Launch an attack from the Forces tab.</div></div>
      )}

      {/* In fullscreen: insert center panel (tick+food) at slot 3 */}
      {activeBattles.map((battle, idx) => {
        // Render center panel BEFORE the 3rd battle card (index 2) in fullscreen
        const centerPanel = (panelFullscreen && idx === 2) ? (
          <div key="center-panel" className="war-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', justifyContent: 'flex-start' }}>
            {/* Tick Timer */}
            {activeBattles.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px',
                background: 'rgba(96, 165, 250, 0.08)', borderRadius: '6px',
                border: '1px solid rgba(96, 165, 250, 0.15)',
              }}>
                <span style={{ fontSize: '14px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: combatTickLeft <= 3 ? '#60a5fa' : '#94a3b8' }}>
                    <span>NEXT TICK</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: combatTickLeft <= 3 ? '#60a5fa' : '#3b82f6' }}>{combatTickLeft}s</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                    <div style={{
                      width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                      background: combatTickLeft <= 3 ? '#60a5fa' : '#3b82f6',
                      transition: 'width 0.9s linear', borderRadius: '2px',
                    }} />
                  </div>
                </div>
              </div>
            )}
            {/* Food Grid */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { key: 'bread', count: player.bread, sta: 10, heal: 1 },
                { key: 'sushi', count: player.sushi, sta: 20, heal: 2 },
                { key: 'wagyu', count: player.wagyu, sta: 30, heal: 3 },
              ].map(f => (
                <button key={f.key} disabled={f.count <= 0}
                  onClick={() => {
                    player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                    const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                    if (result.success) console.log(result.message)
                  }}
                  style={{
                    flex: 1, padding: '6px 3px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
                    background: f.count > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${f.count > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
                  }}
                >
                  <img src={`/assets/food/${f.key}.png`} alt={f.key} style={{ width: '24px', height: '24px', objectFit: 'contain', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>{f.count}</div>
                  <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
                  <div style={{ fontSize: '7px', color: '#3b82f6' }}>+{f.heal}% HP</div>
                </button>
              ))}
            </div>
            {/* Mini Leaderboard */}
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '3px' }}>🏆 TOP DAMAGE TODAY</div>
              {(() => {
                const dealers: Record<string, number> = {}
                activeBattles.forEach(b => {
                  Object.entries(b.attackerDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
                  Object.entries(b.defenderDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
                })
                const sorted = Object.entries(dealers).sort((a, b) => b[1] - a[1]).slice(0, 5)
                const maxDmg = sorted[0]?.[1] || 1
                if (sorted.length === 0) return <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '6px' }}>No damage dealt yet</div>
                return sorted.map(([name, dmg], i) => {
                  const isMe = name === player.name
                  const pct = (dmg / maxDmg) * 100
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', borderLeft: isMe ? '2px solid #f59e0b' : '2px solid transparent', paddingLeft: '4px' }}>
                      <span style={{ fontSize: '8px', fontWeight: 900, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b', width: '12px', fontFamily: 'var(--font-display)' }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{dmg.toLocaleString()}</span>
                        </div>
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '1px' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isMe ? '#f59e0b' : i === 0 ? '#3b82f6' : '#3b82f6', borderRadius: '1px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        ) : null
        const isExpanded = expandedBattles.has(battle.id)
        const activeRound = battle.rounds[battle.rounds.length - 1]
        const atkDmg = battle.attacker?.damageDealt || 0
        const defDmg = battle.defender?.damageDealt || 0
        const totalDmg = atkDmg + defDmg
        const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
        const mySide: 'attacker' | 'defender' = iso === battle.attackerId ? 'attacker' : 'defender'

        const countries = useWorldStore.getState().countries
        const atkClr = countries.find(c => c.code === battle.attackerId)?.color || '#3b82f6'
        const defClr = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'

        const activeRd = battle.rounds[battle.rounds.length - 1]
        const tickAtkDmg = battle.currentTick?.attackerDamage || 0
        const tickDefDmg = battle.currentTick?.defenderDamage || 0
        const tickWinnerClr = tickAtkDmg >= tickDefDmg ? atkClr : defClr
        const rdAtkPts = activeRd?.attackerPoints || 0
        const rdDefPts = activeRd?.defenderPoints || 0
        const rdLeaderClr = rdAtkPts >= rdDefPts ? atkClr : defClr

        let glowClass = ''
        let glowColor = 'transparent'
        const maxPts = Math.max(rdAtkPts, rdDefPts)
        const tickDmg = tickAtkDmg + tickDefDmg

        if (maxPts >= 450) {
          glowClass = ' war-card--critical'
          glowColor = rdLeaderClr
        } else if (tickDmg > 500) {
          glowClass = ' war-card--hot'
          glowColor = tickWinnerClr
        }

        // Per-side bullet animation intensity: 0 (idle) → 1.0 (max fire rate)
        let atkIntensity = 0
        if (tickAtkDmg > 500) atkIntensity = 1.0
        else if (tickAtkDmg > 200) atkIntensity = 0.7
        else if (tickAtkDmg > 50)  atkIntensity = 0.4
        else if (tickAtkDmg > 0)   atkIntensity = 0.15
        // Also boost for critical round state
        if (maxPts >= 450) atkIntensity = Math.max(atkIntensity, 0.8)

        let defIntensity = 0
        if (tickDefDmg > 500) defIntensity = 1.0
        else if (tickDefDmg > 200) defIntensity = 0.7
        else if (tickDefDmg > 50)  defIntensity = 0.4
        else if (tickDefDmg > 0)   defIntensity = 0.15
        if (maxPts >= 450) defIntensity = Math.max(defIntensity, 0.8)

        return (
          <React.Fragment key={battle.id}>
            {centerPanel}
            <div className={`war-card war-card--battle${glowClass}`} style={{ '--glow-color': glowColor } as React.CSSProperties}>
            {/* Battle Header */}
            <div className="war-battle-header" onClick={() => setExpandedBattles(prev => { const next = new Set(prev); if (next.has(battle.id)) next.delete(battle.id); else next.add(battle.id); return next })}>
              <div className="war-battle-sides">
                <div className="war-battle-side war-battle-side--atk">
                  <span className="war-battle-flag"><CountryFlag iso={battle.attackerId} size={20} /></span>
                  <div>
                    {player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battle.id && iso === battle.attackerId && (
                      <div style={{ fontSize: '7px', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px', fontFamily: 'var(--font-display)', animation: 'pulse 2s infinite' }}>HERO</div>
                    )}
                    <div className="war-battle-country">{getCountryName(battle.attackerId)}</div>
                    <div className="war-battle-meta">{battle.attacker.engagedDivisionIds.length} divs</div>
                  </div>
                  <span className="war-battle-rounds">{battle.attackerRoundsWon}</span>
                </div>
                <div className="war-battle-center">
                  <div className="war-battle-vs">VS</div>
                  <div className="war-battle-terrain">⚔️ {battle.regionName}</div>
                  <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>{fmtElapsed(battle.rounds[battle.rounds.length - 1]?.startedAt || battle.startedAt)}</div>
                  {/* Clickable round labels */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                    {battle.rounds.map((rd, ri) => {
                      if (rd.status === 'active') return null
                      const won = rd.status === 'attacker_won'
                      return (
                        <button key={ri} onClick={(e) => { e.stopPropagation(); setViewingRound(viewingRound?.battleId === battle.id && viewingRound?.roundIdx === ri ? null : { battleId: battle.id, roundIdx: ri }) }}
                          style={{ padding: '1px 5px', fontSize: 7, fontWeight: 800, border: `1px solid ${won ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.4)'}`, borderRadius: 2, background: viewingRound?.battleId === battle.id && viewingRound?.roundIdx === ri ? (won ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.25)') : 'rgba(0,0,0,0.3)', color: won ? '#3b82f6' : '#60a5fa', cursor: 'pointer', letterSpacing: '0.5px' }}>
                          R{ri + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="war-battle-side war-battle-side--def">
                  <span className="war-battle-rounds">{battle.defenderRoundsWon}</span>
                  <div style={{ textAlign: 'right' }}>
                    {player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battle.id && iso === battle.defenderId && (
                      <div style={{ fontSize: '7px', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px', fontFamily: 'var(--font-display)', animation: 'pulse 2s infinite' }}>HERO</div>
                    )}
                    <div className="war-battle-country">{getCountryName(battle.defenderId)}</div>
                    <div className="war-battle-meta">{battle.defender.engagedDivisionIds.length} divs</div>
                  </div>
                  <span className="war-battle-flag"><CountryFlag iso={battle.defenderId} size={20} /></span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedBattles(prev => { const next = new Set(prev); if (next.has(battle.id)) next.delete(battle.id); else next.add(battle.id); return next }) }}
                  style={{
                    padding: '1px 16px', border: 'none', borderRadius: '2px', cursor: 'pointer',
                    fontSize: '8px', fontWeight: 600, background: 'rgba(255,255,255,0.04)',
                    color: '#64748b', transition: 'all 0.15s', lineHeight: 1,
                  }}
                >{isExpanded ? '▲' : '▼'}</button>
              </div>
            </div>

            {/* Round Snapshot Popover */}
            {viewingRound && viewingRound.battleId === battle.id && (() => {
              const rd = battle.rounds[viewingRound.roundIdx]
              if (!rd || rd.status === 'active') return null
              const won = rd.status === 'attacker_won'
              return (
                <div style={{ margin: '4px 0', padding: '8px 10px', background: 'rgba(0,0,0,0.5)', border: `1px solid ${won ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.3)'}`, borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: won ? '#3b82f6' : '#60a5fa', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                      ROUND {viewingRound.roundIdx + 1} — {won ? getCountryName(battle.attackerId) + ' WON' : getCountryName(battle.defenderId) + ' WON'}
                    </span>
                    <button onClick={() => setViewingRound(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
                    <div style={{ padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: 3, border: '1px solid rgba(239,68,68,0.15)' }}>
                      <div style={{ color: '#94a3b8', fontSize: 7, fontWeight: 700, marginBottom: 2 }}>ATTACKER</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>⚔️ {(rd.attackerDmgTotal || 0).toLocaleString()} dmg</div>
                      <div style={{ color: '#f87171', fontWeight: 600 }}>{rd.attackerPoints} pts</div>
                    </div>
                    <div style={{ padding: '4px 6px', background: 'rgba(59,130,246,0.08)', borderRadius: 3, border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div style={{ color: '#94a3b8', fontSize: 7, fontWeight: 700, marginBottom: 2 }}>DEFENDER</div>
                      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>🛡️ {(rd.defenderDmgTotal || 0).toLocaleString()} dmg</div>
                      <div style={{ color: '#60a5fa', fontWeight: 600 }}>{rd.defenderPoints} pts</div>
                    </div>
                  </div>
                  {rd.ticksElapsed && <div style={{ marginTop: 4, fontSize: 8, color: '#64748b', textAlign: 'center' }}>
                    {fmtTicks(rd.ticksElapsed)} • ended {rd.endedAt ? new Date(rd.endedAt).toLocaleTimeString() : '—'}
                  </div>}
                </div>
              )
            })()}

            {/* Ground Points Bar — THE MOST IMPORTANT BAR */}
            {activeRound && (() => {
              const atkPts = activeRound.attackerPoints
              const defPts = activeRound.defenderPoints
              const maxPts = 600
              const atkFill = Math.min(100, (atkPts / maxPts) * 100)
              const defFill = Math.min(100, (defPts / maxPts) * 100)
              return (
                <div style={{ margin: '4px 0', padding: '4px 6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 800, marginBottom: '4px' }}>
                    <span style={{ color: atkClr, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{atkPts}</span>
                    <span style={{ color: '#64748b', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>R{battle.rounds.length}/3 • {maxPts} to win</span>
                    <span style={{ color: defClr, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{defPts}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '3px', height: '14px' }}>
                    {/* Attacker bar — fills left to right */}
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${atkFill}%`, background: `linear-gradient(90deg, ${atkClr}66, ${atkClr})`,
                        borderRadius: '7px', transition: 'width 0.5s ease',
                        boxShadow: atkFill > 0 ? `0 0 10px ${atkClr}55, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                      }} />
                      {atkFill > 8 && <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 800, color: '#fff', zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{Math.round(atkFill)}%</span>}
                    </div>
                    {/* Defender bar — fills right to left */}
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: `${defFill}%`, background: `linear-gradient(270deg, ${defClr}66, ${defClr})`,
                        borderRadius: '7px', transition: 'width 0.5s ease',
                        boxShadow: defFill > 0 ? `0 0 10px ${defClr}55, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
                      }} />
                      {defFill > 8 && <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 800, color: '#fff', zIndex: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{Math.round(defFill)}%</span>}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Improved Damage Bar */}
            <div className="war-damage-bar">
              <div className="war-damage-bar__fill war-damage-bar__fill--atk" style={{ width: `${atkPct}%`, background: `linear-gradient(90deg, ${atkClr}44, ${atkClr})`, boxShadow: `2px 0 8px ${atkClr}55` }} />
              <div className="war-damage-bar__fill war-damage-bar__fill--def" style={{ width: `${100 - atkPct}%`, background: `linear-gradient(270deg, ${defClr}44, ${defClr})`, boxShadow: `-2px 0 8px ${defClr}55` }} />
              <div className="war-damage-bar__center" />
              <span className="war-damage-bar__label war-damage-bar__label--atk"><AnimatedNumber value={atkDmg} /></span>
              <span className="war-damage-bar__label war-damage-bar__label--def"><AnimatedNumber value={defDmg} /></span>
            </div>

            {/* Battle Avatar Animation */}
            <BattleAvatar
              attackerFlag={battle.attackerId}
              defenderFlag={battle.defenderId}
              attackerName={getCountryName(battle.attackerId)}
              defenderName={getCountryName(battle.defenderId)}
              isActive={battle.status === 'active'}
              atkIntensity={atkIntensity}
              defIntensity={defIntensity}
              defenderCountry={battle.defenderId}
              attackerColor={atkClr}
              defenderColor={defClr}
              critSide={critSide}
              hitSide={hitSide}
              atkDominantType={getDominantType(battle.attacker.engagedDivisionIds)}
              defDominantType={getDominantType(battle.defender.engagedDivisionIds)}
              damageRatio={atkPct / 100}
              battleStartedAt={battle.startedAt}
              currentRound={battle.rounds.length}
              terrain={getCountryTerrain(battle.defenderId)}
            />

            {/* Fight Buttons — always visible */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
              <button disabled={player.stamina < 5}
                style={{ padding: '8px 0', background: `${atkClr}15`, border: `2px solid ${atkClr}66`, borderRadius: '2px', color: atkClr, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' as const, transition: 'all 0.15s' }}
                onClick={(e) => { e.stopPropagation(); const r = battleStore.playerAttack(battle.id, 'attacker'); if (r.isCrit) { setCritSide('atk'); setTimeout(() => setCritSide(null), 500) }; setHitSide('def'); setTimeout(() => setHitSide(null), 300); ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : atkClr) }}
              >
                ATTACK
                <div style={{ fontSize: '7px', fontWeight: 600, opacity: 0.6, letterSpacing: '0.5px', marginTop: '1px' }}>5 STAMINA</div>
              </button>
              <button disabled={player.stamina < 5}
                style={{ padding: '8px 0', background: `${defClr}15`, border: `2px solid ${defClr}66`, borderRadius: '2px', color: defClr, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' as const, transition: 'all 0.15s' }}
                onClick={(e) => { e.stopPropagation(); const r = battleStore.playerAttack(battle.id, 'defender'); if (r.isCrit) { setCritSide('def'); setTimeout(() => setCritSide(null), 500) }; setHitSide('atk'); setTimeout(() => setHitSide(null), 300); ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : defClr) }}
              >
                DEFEND
                <div style={{ fontSize: '7px', fontWeight: 600, opacity: 0.6, letterSpacing: '0.5px', marginTop: '1px' }}>5 STAMINA</div>
              </button>
            </div>

            {/* === Collapsible Section === */}
            {isExpanded && (<>

            {/* Tactical Battle Orders */}
            <div style={{ marginTop: '4px', marginBottom: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '6px 8px' }}>
              <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>TACTICAL ORDERS</div>
              {/* Per-side order rows */}
              {(['attacker', 'defender'] as const).map(side => {
                const currentOrder = side === 'attacker' ? (battle.attackerOrder || 'none') : (battle.defenderOrder || 'none')
                const otherSideOrder = side === 'attacker' ? (battle.defenderOrder || 'none') : (battle.attackerOrder || 'none')
                const sideColor = side === 'attacker' ? atkClr : defClr
                // Disable this side if the OTHER side has an active order
                const sideDisabled = otherSideOrder !== 'none'
                return (
                  <div key={side} style={{ marginBottom: '4px', opacity: sideDisabled ? 0.35 : 1 }}>
                    <div style={{ fontSize: '7px', fontWeight: 900, color: sideColor, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '3px', borderLeft: `2px solid ${sideColor}`, paddingLeft: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{side.toUpperCase()}: {TACTICAL_ORDERS[currentOrder].label}</span>
                      {currentOrder !== 'none' && <span style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 600 }}>{TACTICAL_ORDERS[currentOrder].desc}</span>}
                      {player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battle.id && ((side === 'attacker' && iso === battle.attackerId) || (side === 'defender' && iso === battle.defenderId)) && (
                        <span style={{ fontSize: '7px', fontWeight: 900, color: '#0a0a0a', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.5px', animation: 'pulse 2s infinite', marginLeft: 'auto' }}>HERO +10%</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                      {(['charge', 'fortify', 'precision', 'blitz'] as TacticalOrder[]).map(ord => {
                        const o = TACTICAL_ORDERS[ord]
                        const isActive = currentOrder === ord
                        return (
                          <button key={ord}
                            disabled={sideDisabled}
                            onClick={(e) => { e.stopPropagation(); if (!sideDisabled) battleStore.setBattleOrder(battle.id, side, isActive ? 'none' : ord) }}
                            style={{
                              padding: '3px 2px', border: `1px solid ${isActive ? o.color : 'rgba(255,255,255,0.08)'}`,
                              borderRadius: '2px', cursor: sideDisabled ? 'not-allowed' : 'pointer', fontSize: '7px', fontWeight: 800,
                              fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                              background: isActive ? `${o.color}20` : 'rgba(255,255,255,0.03)',
                              color: isActive ? o.color : '#64748b',
                              boxShadow: isActive ? `0 0 6px ${o.color}33` : 'none',
                              transition: 'all 0.15s',
                            }}
                          >{o.label}</button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {/* Order Message */}
              <div style={{ marginTop: '4px' }}>
                {editingOrderMsg[battle.id] ? (
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <input
                      type="text" placeholder="COMMANDER ORDER..." maxLength={100}
                      value={battle.orderMessage || ''}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => battleStore.setBattleOrderMessage(battle.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingOrderMsg(prev => ({ ...prev, [battle.id]: false })) }}
                      style={{
                        flex: 1, padding: '3px 6px', fontSize: '8px',
                        fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '3px', color: '#e2e8f0', outline: 'none',
                      }}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: false })) }}
                      style={{ padding: '2px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'rgba(59,130,246,0.2)', color: '#3b82f6', fontSize: '10px', fontWeight: 700 }}
                    >OK</button>
                  </div>
                ) : battle.orderMessage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: true })) }}
                  >
                    <div style={{ flex: 1, fontSize: '8px', letterSpacing: '0.8px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa', padding: '2px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', borderLeft: '2px solid #a78bfa' }}>
                      {battle.orderMessage}
                    </div>
                    <span style={{ fontSize: '8px', color: '#475569' }}>EDIT</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: true })) }}
                    style={{ width: '100%', padding: '2px 6px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', background: 'transparent', fontSize: '7px', color: '#475569', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >+ ADD ORDER MESSAGE</button>
                )}
              </div>
            </div>

            {/* Division Deploy List — grouped by type */}
            {(() => {
              const readyDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso && d.status === 'ready')
              const engagedIds = (mySide === 'attacker' ? battle.attacker : battle.defender).engagedDivisionIds
              const engagedDivs = engagedIds.map(id => armyStore.divisions[id]).filter(Boolean)

              // Group all my country's divs by type
              const allMyDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso && d.status !== 'destroyed')
              const typeMap = new Map<string, { ready: typeof readyDivs; engaged: typeof engagedDivs; total: typeof allMyDivs }>()
              
              for (const d of allMyDivs) {
                if (!typeMap.has(d.type)) typeMap.set(d.type, { ready: [], engaged: [], total: [] })
                const g = typeMap.get(d.type)!
                g.total.push(d)
                if (d.status === 'ready') g.ready.push(d)
                if (engagedIds.includes(d.id)) g.engaged.push(d)
              }

              const types = Array.from(typeMap.entries())
              if (types.length === 0) return <div style={{ fontSize: '8px', color: '#475569', padding: '4px', textAlign: 'center' }}>No divisions available</div>

              return (
                <div style={{ marginBottom: '4px' }}>
                  {types.map(([type, group]) => {
                    const template = DIVISION_TEMPLATES[type as keyof typeof DIVISION_TEMPLATES]
                    const deployedCount = group.engaged.length
                    const totalCount = group.total.length
                    const canDeploy = group.ready.length > 0
                    const canRecall = group.engaged.length > 0

                    return (
                      <div key={type} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '3px 6px', marginBottom: '2px',
                        background: deployedCount > 0 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)',
                        borderRadius: '3px', border: `1px solid ${deployedCount > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                        {/* Count badge */}
                        <div style={{
                          minWidth: '28px', textAlign: 'center', fontSize: '9px', fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: deployedCount > 0 ? '#f59e0b' : '#64748b',
                        }}>
                          {deployedCount}/{totalCount}
                        </div>

                        {/* - button (recall) */}
                        <button
                          disabled={!canRecall}
                          onClick={(e) => {
                            e.stopPropagation()
                            const divToRecall = group.engaged[group.engaged.length - 1]
                            if (divToRecall) {
                              const r = battleStore.recallDivisionFromBattle(battle.id, divToRecall.id, mySide)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#3b82f6' : '#ef4444')
                            }
                          }}
                          style={{
                            width: '18px', height: '18px', border: 'none', borderRadius: '3px', cursor: canRecall ? 'pointer' : 'not-allowed',
                            background: canRecall ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
                            color: canRecall ? '#ef4444' : '#334155', fontSize: '11px', fontWeight: 900,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                        >−</button>

                        {/* + button (deploy) */}
                        <button
                          disabled={!canDeploy}
                          onClick={(e) => {
                            e.stopPropagation()
                            const divToDeploy = group.ready[0]
                            if (divToDeploy) {
                              const r = battleStore.deployDivisionsToBattle(battle.id, [divToDeploy.id], mySide)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                            }
                          }}
                          style={{
                            width: '18px', height: '18px', border: 'none', borderRadius: '3px', cursor: canDeploy ? 'pointer' : 'not-allowed',
                            background: canDeploy ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                            color: canDeploy ? '#3b82f6' : '#334155', fontSize: '11px', fontWeight: 900,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                          }}
                        >+</button>

                        {/* Division type info */}
                        <img src={template?.icon} alt="" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                            {template?.name || type}
                          </div>
                        </div>
                        {deployedCount > 0 && (
                          <span style={{ fontSize: '7px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 4px', borderRadius: '2px' }}>
                            IN BATTLE
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Expanded Details */}
            
              <div className="war-battle-details" style={{ marginTop: '6px' }}>

                {/* Deployed Divisions — Military Style */}
                <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', fontWeight: 900, color: atkClr, padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: `2px solid ${atkClr}`, fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>ATTACKER DIVISIONS</div>
                  <div style={{ padding: '2px 8px' }}>
                  {battle.attacker.engagedDivisionIds.map((id, idx) => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
                    const strPct = Math.floor((d.health / d.maxHealth) * 100)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '8px', fontFamily: 'var(--font-mono, monospace)', borderBottom: idx < battle.attacker.engagedDivisionIds.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <img src={template?.icon} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                        <span style={{ color: '#e2e8f0', fontWeight: 700, flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{d.health}/{d.maxHealth}</span>
                        <div style={{ width: '50px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ width: `${strPct}%`, height: '100%', background: strPct > 50 ? '#3b82f6' : strPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.8s ease, background 0.5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {battle.attacker.engagedDivisionIds.length === 0 && <div style={{ fontSize: '8px', color: '#475569', padding: '4px 0' }}>No divisions deployed</div>}
                  </div>
                </div>

                <div style={{ marginBottom: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', fontWeight: 900, color: defClr, padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', borderLeft: `2px solid ${defClr}`, fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>DEFENDER DIVISIONS</div>
                  <div style={{ padding: '2px 8px' }}>
                  {battle.defender.engagedDivisionIds.map((id, idx) => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
                    const strPct = Math.floor((d.health / d.maxHealth) * 100)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', fontSize: '8px', fontFamily: 'var(--font-mono, monospace)', borderBottom: idx < battle.defender.engagedDivisionIds.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                        <img src={template?.icon} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                        <span style={{ color: '#e2e8f0', fontWeight: 700, flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{d.health}/{d.maxHealth}</span>
                        <div style={{ width: '50px', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ width: `${strPct}%`, height: '100%', background: strPct > 50 ? '#3b82f6' : strPct > 20 ? '#f59e0b' : '#ef4444', transition: 'width 0.8s ease, background 0.5s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                  {battle.defender.engagedDivisionIds.length === 0 && <div style={{ fontSize: '8px', color: '#475569', padding: '4px 0' }}>No divisions deployed</div>}
                  </div>
                </div>

                {/* Stats Comparison — Military */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 8px', borderLeft: `2px solid ${atkClr}` }}>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: atkClr, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px' }}>ATTACKER</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>DMG <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.attacker.damageDealt || 0).toLocaleString()}</span></div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>KIA <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.attacker.manpowerLost || 0).toLocaleString()}</span></div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>DST <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{battle.attacker.divisionsDestroyed}</span></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '0 10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#64748b', fontFamily: 'var(--font-display)' }}>{fmtElapsed(battle.startedAt)}</span>
                  </div>
                  <div style={{ padding: '6px 8px', borderRight: `2px solid ${defClr}`, textAlign: 'right' }}>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: defClr, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px' }}>DEFENDER</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.defender.damageDealt || 0).toLocaleString()}</span> DMG</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{(battle.defender.manpowerLost || 0).toLocaleString()}</span> KIA</div>
                    <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}><span style={{ color: '#e2e8f0', fontWeight: 700 }}>{battle.defender.divisionsDestroyed}</span> DST</div>
                  </div>
                </div>

                {/* Combat Log — Military Terminal */}
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>▌ COMBAT LOG</span>
                    <span style={{ fontSize: '8px', color: '#64748b' }}>{battle.combatLog.length} entries</span>
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '2px 0', fontFamily: 'var(--font-mono, "JetBrains Mono", "Fira Code", monospace)', fontSize: '9px', lineHeight: '1.5' }}>
                    {battle.combatLog.length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '10px' }}>⏳ Waiting for first combat tick...</div>
                    )}
                    {battle.combatLog.slice(-20).reverse().map((entry, i) => {
                      // Color & prefix by type+side
                      const isAtk = entry.side === 'attacker'
                      let color = '#94a3b8'
                      let prefix = '[---]'
                      let bgTint = 'transparent'
                      if (entry.type === 'damage' && isAtk) { color = '#f87171'; prefix = '[ATK]'; bgTint = 'rgba(239,68,68,0.04)' }
                      else if (entry.type === 'damage' && !isAtk) { color = '#60a5fa'; prefix = '[DEF]'; bgTint = 'rgba(59,130,246,0.04)' }
                      else if ((entry.type as string) === 'dodge') { color = '#fbbf24'; prefix = '[DGE]'; bgTint = 'rgba(251,191,36,0.04)' }
                      else if ((entry.type as string) === 'crit') { color = '#fb923c'; prefix = '[CRT]'; bgTint = 'rgba(251,146,60,0.06)' }
                      else if (entry.type === 'destroyed') { color = '#64748b'; prefix = '[KIA]'; bgTint = 'rgba(100,116,139,0.06)' }
                      else if ((entry.type as string) === 'reinforcement') { color = '#3b82f6'; prefix = '[RNF]'; bgTint = 'rgba(59,130,246,0.04)' }
                      else if (entry.type === 'phase_change') { color = '#a78bfa'; prefix = '[SYS]'; bgTint = 'rgba(167,139,250,0.04)' }
                      // Alternating row
                      const rowBg = i % 2 === 0 ? bgTint : `rgba(255,255,255,0.015)`
                      // Highlight numbers in message
                      const msgParts = entry.message.replace(/^[⚔️🛡️💨💀🚀⏸️\s]+/, '').replace(/T\d+:\s*/, '').split(/(\d+)/g)
                      return (
                        <div key={`${entry.timestamp}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: rowBg, borderLeft: `2px solid ${color}` }}>
                          <span style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8', background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: '3px', flexShrink: 0, fontFamily: 'var(--font-mono, monospace)' }}>{fmtTicks(entry.tick)}</span>
                          <span style={{ fontWeight: 800, color, flexShrink: 0, letterSpacing: '0.5px' }}>{prefix}</span>
                          <span style={{ color: '#94a3b8' }}>
                            {msgParts.map((p, j) => /^\d+$/.test(p) ? <span key={j} style={{ color: '#e2e8f0', fontWeight: 700 }}>{p}</span> : <span key={j}>{p}</span>)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>)}
          </div>
          </React.Fragment>
        )
      })}      {/* Fallback: if fewer than 3 battles, render center panel after all battle cards */}
      {panelFullscreen && activeBattles.length > 0 && activeBattles.length < 3 && (
        <div className="war-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', justifyContent: 'flex-start' }}>
          {/* Tick Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.08)', borderRadius: '6px',
            border: '1px solid rgba(239,68,68,0.15)',
          }}>
            <span style={{ fontSize: '14px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: combatTickLeft <= 3 ? '#ef4444' : '#94a3b8' }}>
                <span>NEXT TICK</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: combatTickLeft <= 3 ? '#ef4444' : '#3b82f6' }}>{combatTickLeft}s</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                <div style={{
                  width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                  background: combatTickLeft <= 3 ? '#ef4444' : '#3b82f6',
                  transition: 'width 0.9s linear', borderRadius: '2px',
                }} />
              </div>
            </div>
          </div>
          {/* Food Grid */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { key: 'bread', count: player.bread, sta: 10, heal: 1 },
              { key: 'sushi', count: player.sushi, sta: 20, heal: 2 },
              { key: 'wagyu', count: player.wagyu, sta: 30, heal: 3 },
            ].map(f => (
              <button key={f.key} disabled={f.count <= 0}
                onClick={() => {
                  player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                  const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                  if (result.success) console.log(result.message)
                }}
                style={{
                  flex: 1, padding: '6px 3px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
                  background: f.count > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${f.count > 0 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
                }}
              >
                <img src={`/assets/food/${f.key}.png`} alt={f.key} style={{ width: '24px', height: '24px', objectFit: 'contain', margin: '0 auto', display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>{f.count}</div>
                <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
                <div style={{ fontSize: '7px', color: '#3b82f6' }}>+{f.heal}% HP</div>
              </button>
            ))}
          </div>
          {/* Mini Leaderboard */}
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '3px' }}>🏆 TOP DAMAGE TODAY</div>
            {(() => {
              const dealers: Record<string, number> = {}
              activeBattles.forEach(b => {
                Object.entries(b.attackerDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
                Object.entries(b.defenderDamageDealers || {}).forEach(([name, dmg]) => { dealers[name] = (dealers[name] || 0) + dmg })
              })
              const sorted = Object.entries(dealers).sort((a, b) => b[1] - a[1]).slice(0, 5)
              const maxDmg = sorted[0]?.[1] || 1
              if (sorted.length === 0) return <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '6px' }}>No damage dealt yet</div>
              return sorted.map(([name, dmg], i) => {
                const isMe = name === player.name
                const pct = (dmg / maxDmg) * 100
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', borderLeft: isMe ? '2px solid #f59e0b' : '2px solid transparent', paddingLeft: '4px' }}>
                    <span style={{ fontSize: '8px', fontWeight: 900, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b', width: '12px', fontFamily: 'var(--font-display)' }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{dmg.toLocaleString()}</span>
                      </div>
                      <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '1px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isMe ? '#f59e0b' : i === 0 ? '#3b82f6' : '#3b82f6', borderRadius: '1px', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Past Battles */}
      {pastBattles.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📜 BATTLE HISTORY</div>
          {pastBattles.map(battle => (
            <div className={`war-history-row war-history-row--${battle.status}`} key={battle.id}>
              <span><CountryFlag iso={battle.attackerId} size={14} style={{ marginRight: '3px' }} /> vs <CountryFlag iso={battle.defenderId} size={14} style={{ marginLeft: '3px' }} /></span>
              <span>{battle.regionName}</span>
              <span className={`war-history-result war-history-result--${battle.status}`}>
                {battle.status === 'attacker_won' ? '🏆 ATK WON' : '🛡️ DEF WON'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
