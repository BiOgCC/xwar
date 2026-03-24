import React, { useState, useEffect, Suspense } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, type DivisionType } from '../../stores/army'
import { useBattleStore, getCountryName, getPlayerCombatStats, TACTICAL_ORDERS } from '../../stores/battleStore'
import type { TacticalOrder } from '../../stores/battleStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import BattleAvatar from '../shared/BattleAvatar'
import CountryFlag from '../shared/CountryFlag'
import { getCountryTerrain } from '../../data/terrainMap'
import { getCountryDistance, getAttackOilCost } from '../../utils/geography'
import { AnimatedNumber, fmtElapsed, fmtTicks } from './warHelpers'

const BattleScene3D = React.lazy(() => import('./BattleScene3D'))

export default
function CombatTab({ panelFullscreen, setPanelFullscreen }: { panelFullscreen?: boolean; setPanelFullscreen?: (v: boolean) => void }) {
  const battleStore = useBattleStore()
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  // Armor-based stamina cost for SUPPORT buttons
  const cs = getPlayerCombatStats()
  const armorMit = cs.armorBlock / (cs.armorBlock + 100)
  const staCost = Math.max(1, Math.ceil(5 * (1 - armorMit)))
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
  const [combatTexts, setCombatTexts] = useState<Record<string, { atk: { id: string, text: string, color: string }[], def: { id: string, text: string, color: string }[] }>>({})
  React.useEffect(() => {
    const unsub = useBattleStore.subscribe((state) => { setCombatTickLocal(state.combatTickLeft) })
    return unsub
  }, [])

  // Crit visual effect tracking
  const [critSide, setCritSide] = useState<'atk' | 'def' | null>(null)
  const [hitSide, setHitSide] = useState<'atk' | 'def' | null>(null)

  // Adrenaline decay interval — runs per active battle
  const activeBattleIds = Object.values(battleStore.battles).filter(b => b.status === 'active').map(b => b.id)
  useEffect(() => {
    if (activeBattleIds.length === 0) return
    const iv = setInterval(() => {
      const pName = usePlayerStore.getState().name
      activeBattleIds.forEach(bid => {
        useBattleStore.getState().tickAdrenalineDecay(bid, pName)
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [activeBattleIds.join(',')])

  // Determine dominant division type for tracer variation
  const getDominantType = (divIds: string[]): 'infantry' | 'tank' | 'jet' | 'warship' | 'submarine' => {
    const counts = { infantry: 0, tank: 0, jet: 0, warship: 0, submarine: 0 }
    divIds.forEach(id => {
      const d = armyStore.divisions[id]
      if (!d) return
      if (['recon', 'assault', 'sniper', 'rpg'].includes(d.type)) counts.infantry++
      else if (['jeep', 'tank'].includes(d.type)) counts.tank++
      else if (d.type === 'jet') counts.jet++
      else if (d.type === 'warship') counts.warship++
      else if (d.type === 'submarine') counts.submarine++
    })
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'infantry') as 'infantry' | 'tank' | 'jet' | 'warship' | 'submarine'
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
            { key: 'bread', icon: '🍞', label: 'Bread', count: player.bread, sta: '15%', heal: 1 },
            { key: 'sushi', icon: '🍣', label: 'Sushi', count: player.sushi, sta: '30%', heal: 2 },
            { key: 'wagyu', icon: '🥩', label: 'Wagyu', count: player.wagyu, sta: '45%', heal: 3 },
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
                { key: 'bread', count: player.bread, sta: '15%', heal: 1 },
                { key: 'sushi', count: player.sushi, sta: '30%', heal: 2 },
                { key: 'wagyu', count: player.wagyu, sta: '45%', heal: 3 },
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

        const evaluateSupportCost = (targetSide: 'attacker' | 'defender') => {
          if (iso === battle.attackerId || iso === battle.defenderId) return null
          
          const opponent = targetSide === 'attacker' ? battle.defenderId : battle.attackerId
          const myCountryObj = countries.find(c => c.code === iso)
          const targetObj = countries.find(c => c.code === (targetSide === 'attacker' ? battle.attackerId : battle.defenderId))
          const opponentObj = countries.find(c => c.code === opponent)
          
          const isAlliedOpponent = myCountryObj?.empire && opponentObj?.empire && myCountryObj.empire === opponentObj.empire
          if (isAlliedOpponent) return 'BLOCKED'
          
          const isSupportingAlly = myCountryObj?.empire && targetObj?.empire && myCountryObj.empire === targetObj.empire
          const isAtWar = useWorldStore.getState().wars.some(w => w.status === 'active' && ((w.attacker === iso && w.defender === opponent) || (w.attacker === opponent && w.defender === iso)))
          
          const dist = getCountryDistance(iso, opponent)
          let oil = getAttackOilCost(dist) / 10000
          
          if (!isSupportingAlly && !isAtWar) {
            oil *= 2
          }
          return Number(oil.toFixed(2))
        }
        
        const atkSupportCost = evaluateSupportCost('attacker')
        const defSupportCost = evaluateSupportCost('defender')

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
            <div style={{ position: 'relative' }}>
              {/* Attacker Damage Carousel */}
              <div style={{ position: 'absolute', left: '15px', top: '25px', bottom: '15px', width: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 10, alignItems: 'flex-start', gap: '2px', clipPath: 'inset(0px -50px -50px -50px)' }}>
                {combatTexts[battle.id]?.atk.map(dmg => (
                  <div key={dmg.id} style={{ fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: 900, color: dmg.color, textShadow: '0 0 2px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.8)', animation: 'rolling-text-anim 2.5s ease-out forwards', willChange: 'transform, opacity' }}>
                    {dmg.text}
                  </div>
                ))}
              </div>
              <BattleAvatar
                battleId={battle.id}
                isOwnBattle={iso === battle.attackerId || iso === battle.defenderId}
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
              {/* Defender Damage Carousel */}
              <div style={{ position: 'absolute', right: '15px', top: '25px', bottom: '15px', width: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 10, alignItems: 'flex-end', gap: '2px', clipPath: 'inset(0px -50px -50px -50px)' }}>
                {combatTexts[battle.id]?.def.map(dmg => (
                  <div key={dmg.id} style={{ fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: 900, color: dmg.color, textShadow: '0 0 2px rgba(0,0,0,0.8), 0 1px 1px rgba(0,0,0,0.8)', animation: 'rolling-text-anim 2.5s ease-out forwards', willChange: 'transform, opacity' }}>
                    {dmg.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Fight Buttons — always visible */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
              <button disabled={player.stamina < staCost || atkSupportCost === 'BLOCKED'}
                style={{ padding: '8px 0', background: `${atkClr}15`, border: `2px solid ${atkClr}66`, borderRadius: '2px', color: atkClr, cursor: atkSupportCost === 'BLOCKED' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' as const, transition: 'all 0.15s', opacity: atkSupportCost === 'BLOCKED' ? 0.5 : 1 }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const r = battleStore.playerAttack(battle.id, 'attacker'); 
                  if (r.message.includes('Too fast') || r.message.includes('Not enough stamina') || r.message.includes('country is not') || r.message.includes('only support') || r.message.includes('Not enough oil') || r.message.includes('at war')) {
                    ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, '#ef4444');
                    return;
                  }
                  if (r.isCrit) { setCritSide('atk'); setTimeout(() => setCritSide(null), 500) } 
                  setHitSide('def'); setTimeout(() => setHitSide(null), 300); 
                  const id = Date.now().toString() + Math.random().toString();
                  
                  let text = `${r.damage}`;
                  let color = atkClr;
                  if (r.isMiss) { text = `${r.damage} 💨`; color = '#94a3b8'; }
                  else if (r.isDodged && r.isCrit) { text = `${Math.floor(r.damage)}⚡!`; color = '#22d38a'; }
                  else if (r.isDodged) { text = `${r.damage}⚡!`; color = '#22d38a'; }
                  else if (r.isCrit) { text = `${Math.floor(r.damage)}!`; color = '#f59e0b'; }
                  
                  setCombatTexts(prev => {
                    const b = prev[battle.id] || { atk: [], def: [] };
                    return { ...prev, [battle.id]: { ...b, atk: [...b.atk.slice(-7), { id, text, color }] } };
                  });
                  setTimeout(() => {
                    setCombatTexts(prev => {
                      const b = prev[battle.id];
                      if (!b) return prev;
                      return { ...prev, [battle.id]: { ...b, atk: b.atk.filter(x => x.id !== id) } };
                    });
                  }, 2500);
                }}
              >
                SUPPORT
                <div style={{ fontSize: '7px', fontWeight: 600, opacity: 0.6, letterSpacing: '0.5px', marginTop: '1px' }}>
                  {staCost} STAMINA {atkSupportCost === 'BLOCKED' ? '• ALLY TARGET' : atkSupportCost !== null ? `• ${atkSupportCost} 🛢️` : ''}
                </div>
              </button>
              <button disabled={player.stamina < staCost || defSupportCost === 'BLOCKED'}
                style={{ padding: '8px 0', background: `${defClr}15`, border: `2px solid ${defClr}66`, borderRadius: '2px', color: defClr, cursor: defSupportCost === 'BLOCKED' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' as const, transition: 'all 0.15s', opacity: defSupportCost === 'BLOCKED' ? 0.5 : 1 }}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const r = battleStore.playerAttack(battle.id, 'defender'); 
                  if (r.message.includes('Too fast') || r.message.includes('Not enough stamina') || r.message.includes('country is not') || r.message.includes('only support') || r.message.includes('Not enough oil') || r.message.includes('at war')) {
                    ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, '#ef4444');
                    return;
                  }
                  if (r.isCrit) { setCritSide('def'); setTimeout(() => setCritSide(null), 500) } 
                  setHitSide('atk'); setTimeout(() => setHitSide(null), 300); 
                  const id = Date.now().toString() + Math.random().toString();
                  
                  let text = `${r.damage}`;
                  let color = defClr;
                  if (r.isMiss) { text = `${r.damage} 💨`; color = '#94a3b8'; }
                  else if (r.isDodged && r.isCrit) { text = `${Math.floor(r.damage)}⚡!`; color = '#22d38a'; }
                  else if (r.isDodged) { text = `${r.damage}⚡!`; color = '#22d38a'; }
                  else if (r.isCrit) { text = `${Math.floor(r.damage)}!`; color = '#f59e0b'; }
                  
                  setCombatTexts(prev => {
                    const b = prev[battle.id] || { atk: [], def: [] };
                    return { ...prev, [battle.id]: { ...b, def: [...b.def.slice(-7), { id, text, color }] } };
                  });
                  setTimeout(() => {
                    setCombatTexts(prev => {
                      const b = prev[battle.id];
                      if (!b) return prev;
                      return { ...prev, [battle.id]: { ...b, def: b.def.filter(x => x.id !== id) } };
                    });
                  }, 2500);
                }}
              >
                SUPPORT
                <div style={{ fontSize: '7px', fontWeight: 600, opacity: 0.6, letterSpacing: '0.5px', marginTop: '1px' }}>
                  {staCost} STAMINA {defSupportCost === 'BLOCKED' ? '• ALLY TARGET' : defSupportCost !== null ? `• ${defSupportCost} 🛢️` : ''}
                </div>
              </button>
            </div>

            {/* ══ Adrenaline Bar ══ */}
            {(() => {
              const pName = player.name
              const adr = battle.playerAdrenaline?.[pName] || 0
              const surgeState = battle.playerSurge?.[pName]
              const isSurging = surgeState && Date.now() < surgeState.until
              const crashState = battle.playerCrash?.[pName]
              const isCrashed = crashState && Date.now() < crashState.until
              const canSurge = adr >= 80 && !isSurging
              const isHot = adr >= 80
              const isPeak = adr >= 100

              // Surge synergy label based on active order
              const mySide2: 'attacker' | 'defender' = (player.countryCode || 'US') === battle.attackerId ? 'attacker' : 'defender'
              const activeOrder = (mySide2 === 'attacker' ? battle.attackerOrder : battle.defenderOrder) || 'none'
              const synergyLabel: Record<string, string> = {
                charge: '+60% ATK', precision: '+40% GUARANTEED CRIT', blitz: '+30% (5s)',
                fortify: '+40% DMG', none: '+40% DMG',
              }

              return (
                <div style={{ margin: '4px 0', position: 'relative' }}>
                  {/* Bar background */}
                  <div style={{
                    height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px',
                    overflow: 'hidden', border: `1px solid ${isPeak ? 'rgba(251,191,36,0.5)' : isHot ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    transition: 'border-color 0.3s',
                  }}>
                    <div style={{
                      width: `${adr}%`, height: '100%',
                      background: isCrashed ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : isSurging ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                        : isPeak ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                        : isHot ? 'linear-gradient(90deg, #3b82f6, #f59e0b)'
                        : 'linear-gradient(90deg, #1e3a5f, #3b82f6)',
                      borderRadius: '4px', transition: 'width 0.3s ease, background 0.3s',
                      boxShadow: isHot ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
                      animation: isPeak ? 'adrenaline-pulse 0.6s infinite' : isHot ? 'adrenaline-pulse 1.2s infinite' : 'none',
                    }} />
                  </div>
                  {/* Labels row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', minHeight: '14px' }}>
                    <span style={{
                      fontSize: '7px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '1px',
                      color: isCrashed ? '#ef4444' : isSurging ? '#fbbf24' : isHot ? '#f59e0b' : '#64748b',
                    }}>
                      {isCrashed ? '💥 CRASHED -20%' : isSurging ? `⚡ SURGE ACTIVE (${activeOrder !== 'none' ? activeOrder.toUpperCase() : 'BASE'})` : `ADRENALINE ${adr}`}
                    </span>
                    {/* SURGE button */}
                    {canSurge && (
                      <button
                        onClick={(e) => { e.stopPropagation(); battleStore.activateSurge(battle.id) }}
                        style={{
                          padding: '2px 10px', border: '1px solid rgba(245,158,11,0.6)', borderRadius: '3px',
                          cursor: 'pointer', fontSize: '8px', fontWeight: 900, fontFamily: 'var(--font-display)',
                          letterSpacing: '1px', color: '#0a0a0a',
                          background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                          animation: 'adrenaline-pulse 0.8s infinite',
                          boxShadow: '0 0 12px rgba(245,158,11,0.4)',
                          transition: 'all 0.15s',
                        }}
                      >
                        ⚡ SURGE {synergyLabel[activeOrder] || '+40% DMG'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* === Collapsible Section — Top Damage Ladder === */}
            {isExpanded && (<>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                {/* Attacker Side Ladder */}
                <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${atkClr}22`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', fontWeight: 900, color: atkClr, padding: '5px 8px', borderBottom: `1px solid ${atkClr}22`, borderLeft: `2px solid ${atkClr}`, fontFamily: 'var(--font-display)', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚔️ {getCountryName(battle.attackerId).toUpperCase()}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>{(battle.attacker.damageDealt || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ padding: '4px 6px' }}>
                    {(() => {
                      const dealers = Object.entries(battle.attackerDamageDealers || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
                      const maxDmg = dealers[0]?.[1] || 1
                      if (dealers.length === 0) return <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '8px 0' }}>No damage yet</div>
                      return dealers.map(([name, dmg], i) => {
                        const isMe = name === player.name
                        const pct = (dmg / maxDmg) * 100
                        const medalColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#475569'
                        return (
                          <div key={name} style={{ padding: '3px 0', borderLeft: isMe ? '2px solid #f59e0b' : '2px solid transparent', paddingLeft: '4px', marginBottom: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                              <span style={{ fontSize: '9px', fontWeight: 900, color: medalColor, width: '14px', fontFamily: 'var(--font-display)' }}>#{i + 1}</span>
                              <span style={{ fontSize: '8px', fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                              <span style={{ fontSize: '8px', fontWeight: 700, color: isMe ? '#fbbf24' : '#94a3b8', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{dmg.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: isMe ? '#f59e0b' : atkClr, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                </div>
                {/* Defender Side Ladder */}
                <div style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${defClr}22`, borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ fontSize: '8px', fontWeight: 900, color: defClr, padding: '5px 8px', borderBottom: `1px solid ${defClr}22`, borderRight: `2px solid ${defClr}`, fontFamily: 'var(--font-display)', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🛡️ {getCountryName(battle.defenderId).toUpperCase()}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>{(battle.defender.damageDealt || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ padding: '4px 6px' }}>
                    {(() => {
                      const dealers = Object.entries(battle.defenderDamageDealers || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
                      const maxDmg = dealers[0]?.[1] || 1
                      if (dealers.length === 0) return <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '8px 0' }}>No damage yet</div>
                      return dealers.map(([name, dmg], i) => {
                        const isMe = name === player.name
                        const pct = (dmg / maxDmg) * 100
                        const medalColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#475569'
                        return (
                          <div key={name} style={{ padding: '3px 0', borderLeft: isMe ? '2px solid #f59e0b' : '2px solid transparent', paddingLeft: '4px', marginBottom: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                              <span style={{ fontSize: '9px', fontWeight: 900, color: medalColor, width: '14px', fontFamily: 'var(--font-display)' }}>#{i + 1}</span>
                              <span style={{ fontSize: '8px', fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                              <span style={{ fontSize: '8px', fontWeight: 700, color: isMe ? '#fbbf24' : '#94a3b8', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{dmg.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: isMe ? '#f59e0b' : defClr, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        )
                      })
                    })()}
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
              { key: 'bread', count: player.bread, sta: '15%', heal: 1 },
              { key: 'sushi', count: player.sushi, sta: '30%', heal: 2 },
              { key: 'wagyu', count: player.wagyu, sta: '45%', heal: 3 },
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
