import React, { useState, Suspense } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, type DivisionType, type MilitaryRankType } from '../../stores/armyStore'
import { useBattleStore, getCountryFlag, getCountryName } from '../../stores/battleStore'
import { usePlayerStore, getMilitaryRank } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import OccupationPanel from './OccupationPanel'
import '../../styles/war.css'

const BattleScene3D = React.lazy(() => import('./BattleScene3D'))

type WarTab = 'overview' | 'enlist' | 'recruit' | 'armies' | 'battles' | 'occupy'

// Reusable tick damage bar for battle views
function TickDamageBar({ battle, atkColor, defColor }: { battle: any; atkColor: string; defColor: string }) {
  const atkDmg = battle.attacker?.damageDealt || 0
  const defDmg = battle.defender?.damageDealt || 0
  const totalDmg = atkDmg + defDmg
  const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
  const defPct = totalDmg > 0 ? (defDmg / totalDmg) * 100 : 50
  const activeRound = battle.rounds[battle.rounds.length - 1]
  const totalPts = activeRound ? activeRound.attackerPoints + activeRound.defenderPoints : 0
  const ptIncr = totalPts < 100 ? 1 : totalPts < 200 ? 2 : totalPts < 300 ? 3 : totalPts < 400 ? 4 : 5

  return (
    <div className="tick-damage">
      <div className="tick-damage__header">
        <span className="tick-damage__title">⚔️ Battle Damage</span>
        <span className="tick-damage__countdown">{totalDmg > 0 ? totalDmg.toLocaleString() : '--'}</span>
      </div>
      <div className="tick-damage__track">
        <div className="tick-damage__fill--atk" style={{ width: `${atkPct}%`, background: atkColor }} />
        <div className="tick-damage__fill--def" style={{ width: `${defPct}%`, background: defColor }} />
        <div className="tick-damage__midline" />
        {totalDmg > 0 && <span className="tick-damage__label tick-damage__label--atk">{atkDmg.toLocaleString()}</span>}
        {totalDmg > 0 && <span className="tick-damage__label tick-damage__label--def">{defDmg.toLocaleString()}</span>}
      </div>
      <div className="tick-damage__footer">
        <span style={{ color: atkColor }}>⚔️ ATK {atkPct.toFixed(0)}%</span>
        <span style={{ color: defColor }}>🛡️ DEF {defPct.toFixed(0)}%</span>
      </div>
      {totalDmg > 0 && (
        <div className="tick-damage__winner">
          {atkPct > 50 ? `⚔️ Attacker leads → +${ptIncr} ground pts` :
           defPct > 50 ? `🛡️ Defender leads → +${ptIncr} ground pts` :
           '⚖️ Tied — no points awarded'}
        </div>
      )}
    </div>
  )
}

export default function WarPanel() {
  const [tab, setTab] = useState<WarTab>('overview')
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const ui = useUIStore()
  const iso = player.countryCode || 'US'

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const tabs: { id: WarTab; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'OVERVIEW', icon: '📊' },
    { id: 'enlist', label: 'ENLIST', icon: '📋' },
    { id: 'recruit', label: 'RECRUIT', icon: '🏭' },
    { id: 'armies', label: 'ARMIES', icon: '⚔️', count: myDivisions.length },
    { id: 'battles', label: 'BATTLES', icon: '💥', count: activeBattles.length },
    { id: 'occupy', label: 'OCCUPY', icon: '🏴' },
  ]

  return (
    <div className="war-panel">
      {/* Tab Navigation */}
      <div className="war-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`war-tab ${tab === t.id ? 'war-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="war-tab__icon">{t.icon}</span>
            <span className="war-tab__label">{t.label}</span>
            {t.count !== undefined && <span className="war-tab__badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="war-content">
        {tab === 'overview' && <OverviewTab iso={iso} />}
        {tab === 'enlist' && <EnlistTab iso={iso} />}
        {tab === 'recruit' && <RecruitTab />}
        {tab === 'armies' && <ArmiesTab iso={iso} />}
        {tab === 'battles' && <BattlesTab />}
        {tab === 'occupy' && <OccupationPanel />}
      </div>
    </div>
  )
}

// ====== OVERVIEW TAB ======

function OverviewTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [expandedBattle, setExpandedBattle] = useState<string | null>(null)

  // Local clock state — subscribes directly to store changes to guarantee UI updates
  const [combatTickLeft, setCombatTickLocal] = useState(() => useBattleStore.getState().combatTickLeft)
  React.useEffect(() => {
    const unsub = useBattleStore.subscribe((state) => {
      setCombatTickLocal(state.combatTickLeft)
    })
    return unsub
  }, [])

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const totalManpower = myDivisions.reduce((s, d) => s + d.manpower, 0)
  const readyDivs = myDivisions.filter(d => d.status === 'ready').length
  const trainingDivs = myDivisions.filter(d => d.status === 'training').length
  const inCombatDivs = myDivisions.filter(d => d.status === 'in_combat').length

  const divTypeCounts: Record<string, number> = {}
  myDivisions.forEach(d => { divTypeCounts[d.type] = (divTypeCounts[d.type] || 0) + 1 })

  return (
    <div className="war-overview">
      {/* Military Summary */}
      <div className="war-card war-card--highlight">
        <div className="war-card__title">🎖️ MILITARY OVERVIEW — {getCountryName(iso)}</div>
        <div className="war-stats-grid">
          <div className="war-stat">
            <span className="war-stat__value">{myDivisions.length}</span>
            <span className="war-stat__label">DIVISIONS</span>
          </div>
          <div className="war-stat">
            <span className="war-stat__value">{totalManpower.toLocaleString()}</span>
            <span className="war-stat__label">MANPOWER</span>
          </div>
          <div className="war-stat">
            <span className="war-stat__value war-stat__value--green">{readyDivs}</span>
            <span className="war-stat__label">READY</span>
          </div>
          <div className="war-stat">
            <span className="war-stat__value war-stat__value--yellow">{trainingDivs}</span>
            <span className="war-stat__label">TRAINING</span>
          </div>
          <div className="war-stat">
            <span className="war-stat__value war-stat__value--red">{inCombatDivs}</span>
            <span className="war-stat__label">IN COMBAT</span>
          </div>
          <div className="war-stat">
            <span className="war-stat__value war-stat__value--red">{activeBattles.length}</span>
            <span className="war-stat__label">BATTLES</span>
          </div>
        </div>
      </div>

      {/* Division Composition */}
      <div className="war-card">
        <div className="war-card__title">📊 FORCE COMPOSITION</div>
        <div className="war-composition">
          {Object.entries(divTypeCounts).map(([type, count]) => {
            const template = DIVISION_TEMPLATES[type as DivisionType]
            return (
              <div className="war-comp-row" key={type}>
                <img src={template?.icon} alt="div" style={{ width: '16px', height: '16px', objectFit: 'contain' }} className="war-comp-row__icon" />
                <span className="war-comp-row__name">{template?.name || type}</span>
                <span className="war-comp-row__count">×{count}</span>
                <div className="war-comp-row__bar">
                  <div className="war-comp-row__fill" style={{ width: `${(count / myDivisions.length) * 100}%` }} />
                </div>
              </div>
            )
          })}
          {Object.keys(divTypeCounts).length === 0 && (
            <div className="war-empty">No divisions yet. Recruit your first division!</div>
          )}
        </div>
      </div>

      {/* Active Battles — Clickable to Expand */}
      {activeBattles.length > 0 && (
        <div className="war-card war-card--red">
          {/* Combat Tick Countdown */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px', marginBottom: '6px',
            background: 'rgba(239,68,68,0.1)', borderRadius: '6px',
            border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <span style={{ fontSize: '14px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: combatTickLeft <= 3 ? '#ef4444' : '#94a3b8', marginBottom: '2px' }}>
                <span>NEXT COMBAT TICK</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: combatTickLeft <= 3 ? '#ef4444' : '#22d38a' }}>
                  {combatTickLeft}s
                </span>
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${((15 - combatTickLeft) / 15) * 100}%`,
                  height: '100%',
                  background: combatTickLeft <= 3 ? '#ef4444' : '#22d38a',
                  transition: 'width 0.9s linear',
                  borderRadius: '2px',
                }} />
              </div>
            </div>
          </div>
          <div className="war-card__title">💥 ACTIVE BATTLES — Click to expand</div>
          {activeBattles.map(battle => {
            const isExpanded = expandedBattle === battle.id
            const activeRound = battle.rounds[battle.rounds.length - 1]
            const totalPts = activeRound ? activeRound.attackerPoints + activeRound.defenderPoints : 0
            const tickSpeed = totalPts < 100 ? '3 min' : totalPts < 200 ? '2.5 min' : totalPts < 300 ? '2 min' : totalPts < 400 ? '1.5 min' : '1 min'
            const ptIncr = totalPts < 100 ? 1 : totalPts < 200 ? 2 : totalPts < 300 ? 3 : totalPts < 400 ? 4 : 5
            const dotClass = totalPts >= 400 ? 'tick-indicator__dot--fastest' : totalPts >= 200 ? 'tick-indicator__dot--fast' : ''
            const mySide: 'attacker' | 'defender' = iso === battle.attackerId ? 'attacker' : 'defender'

            return (
              <div className="war-battle-mini" key={battle.id} onClick={() => setExpandedBattle(isExpanded ? null : battle.id)} style={{ cursor: 'pointer' }}>
                <div className="war-battle-mini__header">
                  <span>{getCountryFlag(battle.attackerId)} {getCountryName(battle.attackerId)}</span>
                  <span className="war-battle-mini__vs">VS</span>
                  <span>{getCountryName(battle.defenderId)} {getCountryFlag(battle.defenderId)}</span>
                </div>
                <div className="war-battle-mini__info">
                  {battle.regionName} • Tick {battle.ticksElapsed}
                  {' • '}{isExpanded ? '▲ COLLAPSE' : '▼ EXPAND'}
                </div>
                {(() => {
                  const atkDmg = battle.attacker?.damageDealt || 0
                  const defDmg = battle.defender?.damageDealt || 0
                  const totalDmg = atkDmg + defDmg
                  const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
                  const countries = useWorldStore.getState().countries
                  const atkColor = countries.find(c => c.code === battle.attackerId)?.color || '#22d38a'
                  const defColor = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'
                  return (
                    <div style={{ position: 'relative', height: '16px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginTop: '4px' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: atkColor, opacity: 0.85, transition: 'width 0.5s ease' }} />
                      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: defColor, opacity: 0.85, transition: 'width 0.5s ease' }} />
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#fff', transform: 'translateX(-1px)', zIndex: 2, opacity: 0.6 }} />
                      <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)', zIndex: 3 }}>{atkDmg.toLocaleString()}</span>
                      <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', fontWeight: 700, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)', zIndex: 3 }}>{defDmg.toLocaleString()}</span>
                    </div>
                  )
                })()}

                {/* Expanded View */}
                {isExpanded && activeRound && (() => {
                  const countries = useWorldStore.getState().countries
                  const atkClr = countries.find(c => c.code === battle.attackerId)?.color || '#22d38a'
                  const defClr = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'
                  return (
                  <div style={{ marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                    {/* Ground Points */}
                    <div className="battle-points">
                      <div className="battle-points__side battle-points__side--atk">
                        <div className="battle-points__value" style={{ color: atkClr }}>{activeRound.attackerPoints}</div>
                        <div className="battle-points__label">ATTACKER</div>
                      </div>
                      <div className="battle-points__center">
                        <div className="battle-points__round">R{battle.rounds.length}/3</div>
                        <div className="battle-points__tick">600 PTS TO WIN</div>
                      </div>
                      <div className="battle-points__side battle-points__side--def">
                        <div className="battle-points__value" style={{ color: defClr }}>{activeRound.defenderPoints}</div>
                        <div className="battle-points__label">DEFENDER</div>
                      </div>
                    </div>

                    {/* Tick Damage Bar */}
                    <TickDamageBar battle={battle} atkColor={atkClr} defColor={defClr} />
                    {/* Deploy / Remove All */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                      <button
                        onClick={() => {
                          const myDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso && d.status === 'ready')
                          if (myDivs.length === 0) return ui.addFloatingText('No ready divisions!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
                          const r = battleStore.deployDivisionsToBattle(battle.id, myDivs.map(d => d.id), mySide)
                          ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                        }}
                        style={{
                          padding: '6px 0', border: 'none', borderRadius: '5px', cursor: 'pointer',
                          fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: '#000', boxShadow: '0 0 10px rgba(245,158,11,0.3)',
                          transition: 'all 0.2s',
                        }}
                      >⚔️ DEPLOY ALL</button>
                      <button
                        onClick={() => {
                          const r = battleStore.removeDivisionsFromBattle(battle.id, mySide)
                          ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                        }}
                        style={{
                          padding: '6px 0', border: 'none', borderRadius: '5px', cursor: 'pointer',
                          fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px',
                          background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                          color: '#fff', boxShadow: '0 0 10px rgba(220,38,38,0.3)',
                          transition: 'all 0.2s',
                        }}
                      >🏳️ REMOVE ALL</button>
                    </div>

                    {/* Deployed Divisions */}
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>🎖️ DEPLOYED DIVISIONS:</div>
                      {(() => {
                        const allEngaged = [
                          ...battle.attacker.engagedDivisionIds.map((id: string) => ({ id, side: 'atk' as const })),
                          ...battle.defender.engagedDivisionIds.map((id: string) => ({ id, side: 'def' as const })),
                        ]
                        if (allEngaged.length === 0) return <div style={{ fontSize: '9px', color: '#475569', padding: '4px 0' }}>No divisions deployed yet</div>
                        return allEngaged.map(({ id, side }) => {
                          const div = armyStore.divisions[id]
                          if (!div) return null
                          const template = DIVISION_TEMPLATES[div.type]
                          const hpPct = div.maxManpower > 0 ? (div.manpower / div.maxManpower) * 100 : 0
                          const moralePct = div.morale
                          const sideClr = side === 'atk' ? atkClr : defClr
                          return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <img src={template?.icon} alt="🛡️" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: sideClr, marginBottom: '1px' }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{div.name}</span>
                                  <span style={{ color: '#94a3b8', fontWeight: 400, flexShrink: 0, marginLeft: '4px' }}>{div.manpower}/{div.maxManpower}</span>
                                </div>
                                {/* HP bar */}
                                <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1px' }}>
                                  <div style={{ width: `${hpPct}%`, height: '100%', borderRadius: '2px', background: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                                </div>
                                {/* Morale bar */}
                                <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${moralePct}%`, height: '100%', borderRadius: '2px', background: '#eab308', transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>

                    {/* Battle Orders */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>📋 BATTLE ORDERS:</div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[5, 10, 15].map(pct => (
                          <button
                            key={pct}
                            onClick={() => battleStore.setBattleOrder(battle.id, battle.battleOrder === pct ? 0 : pct)}
                            style={{
                              flex: 1, padding: '4px 0', border: 'none', borderRadius: '4px', cursor: 'pointer',
                              fontSize: '10px', fontWeight: 700, transition: 'all 0.2s',
                              background: battle.battleOrder === pct ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.06)',
                              color: battle.battleOrder === pct ? '#000' : '#94a3b8',
                              boxShadow: battle.battleOrder === pct ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
                            }}
                          >
                            +{pct}% DMG
                          </button>
                        ))}
                      </div>
                      {battle.battleOrder > 0 && (
                        <div style={{ fontSize: '8px', color: '#f59e0b', marginTop: '3px', textAlign: 'center' }}>
                          🔥 +{battle.battleOrder}% damage active
                        </div>
                      )}
                    </div>

                    {/* Player ATTACK / DEFEND — choose side */}
                    <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginTop: '8px', marginBottom: '4px' }}>FIGHT FOR:</div>
                    <div className="battle-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                      <button
                        className="battle-action-btn"
                        disabled={player.stamina < 5}
                        style={{ background: `${atkClr}22`, borderColor: `${atkClr}44`, color: atkClr }}
                        onClick={() => {
                          const r = battleStore.playerAttack(battle.id, 'attacker')
                          ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : atkClr)
                        }}
                      >
                        <span className="battle-action-btn__icon">⚔️</span>
                        <span className="battle-action-btn__label">ATK SIDE</span>
                        <span className="battle-action-btn__cost">5 STA</span>
                      </button>
                      <button
                        className="battle-action-btn"
                        disabled={player.stamina < 5}
                        style={{ background: `${defClr}22`, borderColor: `${defClr}44`, color: defClr }}
                        onClick={() => {
                          const r = battleStore.playerAttack(battle.id, 'defender')
                          ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : defClr)
                        }}
                      >
                        <span className="battle-action-btn__icon">🛡️</span>
                        <span className="battle-action-btn__label">DEF SIDE</span>
                        <span className="battle-action-btn__cost">5 STA</span>
                      </button>
                    </div>
                  </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ====== ENLIST TAB ======

const RANK_ICONS: Record<string, string> = {
  private: '🪖', corporal: '🎖️', sergeant: '⭐', lieutenant: '⭐⭐',
  captain: '⭐⭐⭐', colonel: '🏅', general: '👑',
}

function EnlistTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const [feedback, setFeedback] = useState('')

  const myRank = getMilitaryRank(player.level)
  const countryArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = Object.values(armyStore.armies).find(a => a.members.some(m => m.playerId === player.name))
  const myMembership = currentArmy?.members.find(m => m.playerId === player.name)

  const handleEnlist = (armyId: string) => {
    const result = armyStore.enlistInArmy(armyId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleLeave = () => {
    const result = armyStore.leaveArmy()
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="war-overview">
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Already') || feedback.includes('cannot') || feedback.includes('Not') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* Your Rank */}
      <div className="war-card war-card--highlight">
        <div className="war-card__title">🪖 YOUR MILITARY RANK</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
          <span style={{ fontSize: '28px' }}>{RANK_ICONS[myRank.rank] || '🪖'}</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
              {myRank.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8' }}>
              Level {player.level} • Squad Size: 12 divisions
            </div>
          </div>
        </div>
      </div>

      {/* Current Enlistment */}
      {currentArmy && (
        <div className="war-card" style={{ borderColor: 'rgba(34,211,138,0.3)' }}>
          <div className="war-card__title" style={{ color: '#22d38a' }}>✅ CURRENTLY ENLISTED</div>
          <div style={{ padding: '6px 0' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
              ⚔️ {currentArmy.name}
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
              Role: {RANK_ICONS[myMembership?.role || 'private']} {(myMembership?.role || 'private').toUpperCase()}
              &nbsp;• Commander: {currentArmy.commanderId}
              &nbsp;• {currentArmy.members.length} members
              &nbsp;• {currentArmy.divisionIds.length} divisions
            </div>
          </div>
          {currentArmy.commanderId !== player.name && (
            <button className="war-btn war-btn--danger" style={{ marginTop: '6px', fontSize: '9px', padding: '5px 12px' }} onClick={handleLeave}>
              🚪 LEAVE ARMY
            </button>
          )}
        </div>
      )}

      {/* Available Armies */}
      <div className="war-card">
        <div className="war-card__title">📋 ARMIES IN {getCountryName(iso).toUpperCase()}</div>
        <div className="war-card__subtitle">Join an army to receive battle orders, access the vault, and earn bounties.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {countryArmies.length === 0 && (
            <div className="war-empty">No armies exist yet. Create one from the ARMIES tab.</div>
          )}
          {countryArmies.map(army => {
            const isMine = currentArmy?.id === army.id
            const totalPower = army.totalAttack + army.totalDefense

            return (
              <div key={army.id} style={{
                padding: '8px 10px', borderRadius: '4px',
                background: isMine ? 'rgba(34,211,138,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isMine ? 'rgba(34,211,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
                    ⚔️ {army.name}
                  </div>
                  <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>
                    👑 {army.commanderId} • 👥 {army.members.length} members • 🪖 {army.divisionIds.length} divs • ⚡ {totalPower} power
                  </div>
                </div>
                {!currentArmy && (
                  <button className="war-btn war-btn--primary" style={{ fontSize: '8px', padding: '4px 10px' }} onClick={() => handleEnlist(army.id)}>
                    ENLIST
                  </button>
                )}
                {isMine && (
                  <span style={{ fontSize: '8px', fontWeight: 700, color: '#22d38a', border: '1px solid rgba(34,211,138,0.3)', padding: '2px 6px', borderRadius: '3px' }}>
                    ENLISTED
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ====== RECRUIT TAB ======

function RecruitTab() {
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const [selectedType, setSelectedType] = useState<DivisionType | null>(null)
  const [feedback, setFeedback] = useState('')

  const handleRecruit = (type: DivisionType) => {
    const result = armyStore.recruitDivision(type)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const divTypes = Object.keys(DIVISION_TEMPLATES) as DivisionType[]

  return (
    <div className="war-recruit">
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Not enough') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      <div className="war-card">
        <div className="war-card__title">🏭 RECRUIT DIVISIONS</div>
        <div className="war-card__subtitle">Build your army. Each division requires resources and training time.</div>
      </div>

      <div className="war-recruit-grid">
        {divTypes.map(type => {
          const t = DIVISION_TEMPLATES[type]
          const canAfford = player.money >= t.recruitCost.money &&
            player.oil >= t.recruitCost.oil &&
            player.materialX >= t.recruitCost.materialX &&
            player.scrap >= t.recruitCost.scrap
          const isSelected = selectedType === type

          return (
            <div
              key={type}
              className={`war-recruit-card ${isSelected ? 'war-recruit-card--selected' : ''} ${!canAfford ? 'war-recruit-card--disabled' : ''}`}
              onClick={() => setSelectedType(isSelected ? null : type)}
            >
              <div className="war-recruit-card__header">
                <img src={t.icon} alt={t.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} className="war-recruit-card__icon" />
                <span className="war-recruit-card__name">{t.name}</span>
                <span className={`war-recruit-card__category war-recruit-card__category--${t.category}`}>
                  {t.category.toUpperCase()}
                </span>
              </div>

              <div className="war-recruit-card__desc">{t.description}</div>

              <div className="war-recruit-card__stats">
                <div className="war-recruit-stat">
                  <span>⚔️ ATK Mult</span><span className="war-recruit-stat__val">{t.atkDmgMult}x</span>
                </div>
                <div className="war-recruit-stat">
                  <span>🎯 Hit Rate</span><span className="war-recruit-stat__val">{(t.hitRate * 100).toFixed(0)}%</span>
                </div>
                <div className="war-recruit-stat">
                  <span>💥 Crit Rate</span><span className="war-recruit-stat__val">{t.critRateMult}x</span>
                </div>
                <div className="war-recruit-stat">
                  <span>🛡️ HP Mult</span><span className="war-recruit-stat__val">{t.healthMult}x</span>
                </div>
                <div className="war-recruit-stat">
                  <span>🏃 Dodge</span><span className="war-recruit-stat__val">{t.dodgeMult}x</span>
                </div>
                <div className="war-recruit-stat">
                  <span>🪨 Armor</span><span className="war-recruit-stat__val">{t.armorMult}x</span>
                </div>
              </div>

              <div className="war-recruit-card__cost">
                <span className={player.money >= t.recruitCost.money ? '' : 'war-cost--insufficient'}>
                  ${t.recruitCost.money.toLocaleString()}
                </span>
                <span className={player.oil >= t.recruitCost.oil ? '' : 'war-cost--insufficient'}>
                  🛢️{t.recruitCost.oil}
                </span>
                <span className={player.materialX >= t.recruitCost.materialX ? '' : 'war-cost--insufficient'}>
                  ⚛️{t.recruitCost.materialX}
                </span>
                <span className={player.scrap >= t.recruitCost.scrap ? '' : 'war-cost--insufficient'}>
                  🔩{t.recruitCost.scrap}
                </span>
              </div>

              <div className="war-recruit-card__meta">
                👥 {t.manpowerCost.toLocaleString()} troops • 🕐 {t.trainingTime}s training
              </div>

              {isSelected && (
                <button
                  className="war-recruit-btn"
                  disabled={!canAfford}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRecruit(type)
                  }}
                >
                  {canAfford ? '🚀 RECRUIT NOW' : '❌ INSUFFICIENT RESOURCES'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ====== ARMIES TAB ======

function ArmiesTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const world = useWorldStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [newArmyName, setNewArmyName] = useState('')
  const [attackTarget, setAttackTarget] = useState<string | null>(null)
  const [selectedHQBattle, setSelectedHQBattle] = useState<string | null>(null)
  const [selectedDeployDivs, setSelectedDeployDivs] = useState<Set<string>>(new Set())
  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const unassignedDivs = Object.values(armyStore.divisions).filter(
    d => d.countryCode === iso && !Object.values(armyStore.armies).some(a => a.divisionIds.includes(d.id))
  )
  const adjacentCountries = ADJACENCY_MAP[iso] || []

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    armyStore.createArmy(newArmyName.trim(), iso)
    setNewArmyName('')
  }

  const handleLaunchAttack = (armyId: string, targetCode: string) => {
    const result = battleStore.launchHOIBattle(armyId, targetCode, 'invasion')
    setAttackTarget(null)
  }

  // Available divisions (ready, not already in combat)
  const availableDivs = Object.values(armyStore.divisions).filter(
    d => d.countryCode === iso && (d.status === 'ready' || d.status === 'training') && d.manpower > 0
  )

  const toggleDeployDiv = (id: string) => {
    setSelectedDeployDivs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeploy = () => {
    if (!selectedHQBattle || selectedDeployDivs.size === 0) return
    const battle = battleStore.battles[selectedHQBattle]
    if (!battle) return
    const side: 'attacker' | 'defender' = iso === battle.attackerId ? 'attacker' : 'defender'
    const r = battleStore.deployDivisionsToBattle(selectedHQBattle, [...selectedDeployDivs], side)
    ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
    if (r.success) setSelectedDeployDivs(new Set())
  }

  return (
    <div className="war-armies">
      {/* ══════ HEADQUARTERS ══════ */}
      <div className="war-card war-card--highlight" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
        <div className="war-card__title" style={{ color: '#f59e0b' }}>🏛️ HEADQUARTERS — DEPLOYMENT CENTER</div>

        {activeBattles.length === 0 ? (
          <div style={{ fontSize: '9px', color: '#475569', padding: '8px 0' }}>
            No active battles. Armies are on standby.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeBattles.map(b => {
              const side: 'attacker' | 'defender' = iso === b.attackerId ? 'attacker' : 'defender'
              const sideLabel = side === 'attacker' ? '⚔️ ATK' : '🛡️ DEF'

              // All engaged divisions for both sides
              const allEngaged = [
                ...b.attacker.engagedDivisionIds.map(id => ({ id, ownedSide: 'attacker' as const })),
                ...b.defender.engagedDivisionIds.map(id => ({ id, ownedSide: 'defender' as const })),
              ]

              // Group by ownerId
              const grouped: Record<string, typeof allEngaged> = {}
              allEngaged.forEach(e => {
                const div = armyStore.divisions[e.id]
                if (!div) return
                const owner = div.ownerId || 'Unknown'
                if (!grouped[owner]) grouped[owner] = []
                grouped[owner].push(e)
              })

              return (
                <div key={b.id} style={{
                  padding: '8px', borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>
                      {sideLabel} {getCountryFlag(b.attackerId)} vs {getCountryFlag(b.defenderId)} — {b.regionName}
                    </div>
                    <div style={{ fontSize: '7px', color: '#64748b' }}>
                      ATK: {b.attacker.engagedDivisionIds.length} · DEF: {b.defender.engagedDivisionIds.length}
                    </div>
                  </div>

                  {/* Deploy All / Remove All */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
                    <button
                      onClick={() => {
                        const myDivs = Object.values(armyStore.divisions).filter(d => d.countryCode === iso && d.status === 'ready')
                        if (myDivs.length === 0) return ui.addFloatingText('No ready divisions!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
                        const r = battleStore.deployDivisionsToBattle(b.id, myDivs.map(d => d.id), side)
                        ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                      }}
                      style={{
                        padding: '6px 0', border: 'none', borderRadius: '5px', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#000', boxShadow: '0 0 10px rgba(245,158,11,0.3)',
                        transition: 'all 0.2s',
                      }}
                    >⚔️ DEPLOY ALL</button>
                    <button
                      onClick={() => {
                        const r = battleStore.removeDivisionsFromBattle(b.id, side)
                        ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                      }}
                      style={{
                        padding: '6px 0', border: 'none', borderRadius: '5px', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px',
                        background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                        color: '#fff', boxShadow: '0 0 10px rgba(220,38,38,0.3)',
                        transition: 'all 0.2s',
                      }}
                    >🏳️ REMOVE ALL</button>
                  </div>

                  {/* Grouped Divisions */}
                  {allEngaged.length === 0 ? (
                    <div style={{ fontSize: '8px', color: '#475569', padding: '2px 0' }}>No divisions deployed.</div>
                  ) : (
                    Object.entries(grouped).map(([ownerName, entries]) => (
                      <div key={ownerName} style={{ marginBottom: '4px' }}>
                        <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '2px', textTransform: 'uppercase' }}>
                          👤 {ownerName}
                        </div>
                        {entries.map(({ id, ownedSide }) => {
                          const div = armyStore.divisions[id]
                          if (!div) return null
                          const template = DIVISION_TEMPLATES[div.type]
                          const hpPct = div.maxManpower > 0 ? (div.manpower / div.maxManpower) * 100 : 0
                          const moralePct = div.morale
                          const sideClr = ownedSide === 'attacker' ? '#22d38a' : '#ef4444'
                          return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <img src={template?.icon} alt="div" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: sideClr, marginBottom: '1px' }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{div.name}</span>
                                  <span style={{ color: '#94a3b8', fontWeight: 400, flexShrink: 0, marginLeft: '4px' }}>{div.manpower}/{div.maxManpower}</span>
                                </div>
                                <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginBottom: '1px' }}>
                                  <div style={{ width: `${hpPct}%`, height: '100%', borderRadius: '2px', background: hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
                                </div>
                                <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${moralePct}%`, height: '100%', borderRadius: '2px', background: '#eab308', transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Army */}
      <div className="war-card">
        <div className="war-card__title">➕ CREATE ARMY GROUP</div>
        <div className="war-create-army">
          <input
            className="war-input"
            placeholder="Army name..."
            value={newArmyName}
            onChange={e => setNewArmyName(e.target.value)}
          />
          <button className="war-btn war-btn--primary" onClick={handleCreateArmy}>CREATE</button>
        </div>
      </div>

      {/* Army List */}
      {myArmies.map(army => {
        const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
        const isExpanded = expandedArmy === army.id
        const readyDivs = divs.filter(d => d.status === 'ready')
        const canAttack = readyDivs.length > 0

        return (
          <div className="war-card war-card--army" key={army.id}>
            <div
              className="war-army-header"
              onClick={() => setExpandedArmy(isExpanded ? null : army.id)}
            >
              <div className="war-army-header__left">
                <span className="war-army-header__icon">⚔️</span>
                <div>
                  <div className="war-army-header__name">{army.name}</div>
                  <div className="war-army-header__info">
                    {divs.length} divisions • {army.totalManpower.toLocaleString()} troops
                  </div>
                </div>
              </div>
              <div className="war-army-header__right">
                <span className={`war-army-status war-army-status--${army.status}`}>
                  {army.status.toUpperCase()}
                </span>
                <span className="war-army-expand">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="war-army-body">
                {/* ── ARMY VAULT ── (moved to top) */}
                <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', marginBottom: '6px' }}>
                    🏦 ARMY VAULT
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '6px' }}>
                    {[
                      { icon: '💰', label: 'Money', val: army.vault.money },
                      { icon: '🛢️', label: 'Oil', val: army.vault.oil },
                      { icon: '🔫', label: 'Ammo', val: army.vault.ammo },
                      { icon: '✈️', label: 'Jets', val: army.vault.jets },
                      { icon: '🪖', label: 'Tanks', val: army.vault.tanks },
                    ].map(r => (
                      <div key={r.label} style={{
                        textAlign: 'center', padding: '4px 2px', borderRadius: '3px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ fontSize: '14px' }}>{r.icon}</div>
                        <div style={{ fontSize: '10px', fontWeight: 900, color: '#e2e8f0' }}>{r.val.toLocaleString()}</div>
                        <div style={{ fontSize: '7px', color: '#64748b' }}>{r.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Donate buttons */}
                  {army.members.some(m => m.playerId === player.name) && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {[
                        { resource: 'money' as const, amount: 10000, label: '💰 Donate $10K' },
                        { resource: 'money' as const, amount: 50000, label: '💰 Donate $50K' },
                        { resource: 'oil' as const, amount: 100, label: '🛢️ Donate 100 Oil' },
                      ].map(d => (
                        <button key={d.label} className="war-btn war-btn--small"
                          style={{ fontSize: '7px', padding: '3px 6px' }}
                          onClick={() => armyStore.donateToVault(army.id, d.resource, d.amount)}
                        >{d.label}</button>
                      ))}
                    </div>
                  )}
                  {/* Active Buffs */}
                  {army.activeBuffs.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700, marginBottom: '3px' }}>⚡ ACTIVE BUFFS</div>
                      {army.activeBuffs.filter(b => b.expiresAt > Date.now()).map(b => (
                        <div key={b.id} style={{
                          fontSize: '8px', color: '#22d38a', padding: '2px 4px',
                          background: 'rgba(34,211,138,0.06)', borderRadius: '2px', marginBottom: '2px',
                        }}>
                          {b.name} • by {b.purchasedBy} • {Math.ceil((b.expiresAt - Date.now()) / 60000)}min left
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Top Contributors */}
                  {army.contributions.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700, marginBottom: '3px' }}>🏆 TOP CONTRIBUTORS</div>
                      {army.contributions
                        .sort((a, b) => (b.totalMoneyDonated + b.sponsoredSquadrons.length * 10000) - (a.totalMoneyDonated + a.sponsoredSquadrons.length * 10000))
                        .slice(0, 5)
                        .map((c, i) => (
                          <div key={c.playerId} style={{ fontSize: '8px', color: '#e2e8f0', display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                            <span>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]} {c.playerId}</span>
                            <span style={{ color: '#64748b' }}>
                              ${c.totalMoneyDonated.toLocaleString()} • {c.sponsoredSquadrons.length} sponsored
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>

                {/* Division List */}
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned. Assign from unassigned pool below.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.type]
                    const strengthPct = Math.floor((div.manpower / div.maxManpower) * 100)
                    const moralePct = Math.floor(div.morale)

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id}>
                        <img src={template?.icon} alt="div" style={{ width: '16px', height: '16px', objectFit: 'contain' }} className="war-div-row__icon" />
                        <div className="war-div-row__info">
                          <div className="war-div-row__name">{div.name}</div>
                          <div className="war-div-row__stats">
                            ⚔️ {div.type} • EXP:{div.experience} • 🔧{div.equipment.length}
                          </div>
                        </div>
                        <div className="war-div-row__bars">
                          <div className="war-div-bar" title={`Strength: ${strengthPct}%`}>
                            <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%` }} />
                            <span className="war-div-bar__label">STR {strengthPct}%</span>
                          </div>
                          <div className="war-div-bar" title={`Morale: ${moralePct}%`}>
                            <div className="war-div-bar__fill war-div-bar__fill--org" style={{ width: `${moralePct}%` }} />
                            <span className="war-div-bar__label">MRL {moralePct}%</span>
                          </div>
                        </div>
                        <div className={`war-div-status war-div-status--${div.status}`}>
                          {div.status === 'training' ? `🔨 ${Math.floor((div.trainingProgress / DIVISION_TEMPLATES[div.type].trainingTime) * 100)}%` : div.status.toUpperCase()}
                        </div>
                        <button
                          className="war-btn war-btn--small war-btn--danger"
                          onClick={() => armyStore.removeDivisionFromArmy(div.id)}
                          title="Remove from army"
                        >✕</button>
                      </div>
                    )
                  })}
                </div>

                {/* ── AV COMPOSITION & AURA ── */}
                {divs.length > 0 && (() => {
                  const av = armyStore.getArmyAV(army.id)
                  const aura = armyStore.getCompositionAura(army.id)
                  return (
                    <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1.5px', marginBottom: '6px' }}>
                        📊 ARMY VALUE & COMPOSITION AURA
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                        {[
                          { label: '✈️ AIR', val: av.air, buff: `+${aura.critDmgPct}% Crit DMG`, color: '#60a5fa' },
                          { label: '🚶 GROUND', val: av.ground, buff: `+${aura.dodgePct}% Dodge`, color: '#22d38a' },
                          { label: '🪖 TANKS', val: av.tanks, buff: `+${aura.attackPct}% Attack`, color: '#f59e0b' },
                          { label: '🚢 NAVY', val: av.navy, buff: `+${aura.precisionPct}% Precision`, color: '#a78bfa' },
                        ].map(cat => (
                          <div key={cat.label} style={{
                            padding: '4px 6px', borderRadius: '3px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 700 }}>{cat.label}</div>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: cat.color }}>{cat.val.toLocaleString()} AV</div>
                            <div style={{ fontSize: '8px', color: cat.color, opacity: 0.8 }}>{cat.buff}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                        Total AV: {av.total.toLocaleString()} • Aura applied to all countrymen in deployed battle
                      </div>
                    </div>
                  )
                })()}

                {/* Attack Controls */}
                {canAttack && (
                  <div className="war-attack-controls">
                    <div className="war-attack-header">🎯 LAUNCH ATTACK</div>
                    <div className="war-attack-targets">
                      {adjacentCountries.map(code => {
                        const country = world.countries.find(c => c.code === code)
                        if (!country) return null
                        const atWar = world.wars.some(w =>
                          w.status === 'active' &&
                          ((w.attacker === iso && w.defender === code) || (w.defender === iso && w.attacker === code))
                        )

                        return (
                          <button
                            key={code}
                            className={`war-target-btn ${!atWar ? 'war-target-btn--disabled' : ''}`}
                            disabled={!atWar}
                            onClick={() => handleLaunchAttack(army.id, code)}
                            title={atWar ? `Attack ${country.name}` : `Not at war with ${country.name}`}
                          >
                            <span className="war-target-flag">{getCountryFlag(code)}</span>
                            <span className="war-target-name">{country.name}</span>
                            {!atWar && <span className="war-target-peace">☮️</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned Divisions */}
      {unassignedDivs.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📦 UNASSIGNED DIVISIONS ({unassignedDivs.length})</div>
          {unassignedDivs.map(div => {
            const template = DIVISION_TEMPLATES[div.type]
            return (
              <div className="war-unassigned-row" key={div.id}>
                <span><img src={template?.icon} alt="div" style={{ width: '12px', height: '12px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '4px' }} />{div.name}</span>
                <span className={`war-div-status--${div.status}`}>{div.status}</span>
                <div className="war-unassigned-actions">
                  {myArmies.map(army => (
                    <button
                      key={army.id}
                      className="war-btn war-btn--small"
                      onClick={() => armyStore.assignDivisionToArmy(div.id, army.id)}
                    >
                      → {army.name.substring(0, 15)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ====== BATTLES TAB ======

function BattlesTab() {
  const battleStore = useBattleStore()
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [expandedBattle, setExpandedBattle] = useState<string | null>(null)
  const [scene3DBattle, setScene3DBattle] = useState<{
    id: string
    atkDivs: { type: DivisionType; name: string; manpower: number; maxManpower: number }[]
    defDivs: { type: DivisionType; name: string; manpower: number; maxManpower: number }[]
  } | null>(null)

  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const pastBattles = Object.values(battleStore.battles).filter(b => b.status !== 'active').slice(-5)

  // Prepare division data for 3D scene
  const get3DDivisions = (divIds: string[]) => {
    return divIds.map(id => {
      const d = armyStore.divisions[id]
      if (!d) return null
      return {
        type: d.type,
        name: d.name,
        manpower: d.manpower,
        maxManpower: d.maxManpower,
      }
    }).filter(Boolean) as { type: DivisionType; name: string; manpower: number; maxManpower: number }[]
  }

  return (
    <div className="war-battles">
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

      {activeBattles.length === 0 && pastBattles.length === 0 && (
        <div className="war-card">
          <div className="war-empty">No active battles. Launch an attack from the Armies tab.</div>
        </div>
      )}

      {activeBattles.map(battle => {
        const isExpanded = expandedBattle === battle.id
        const atkManpowerPct = battle.attacker.divisionIds.length > 0
          ? Math.floor((battle.attacker.divisionIds.length / (battle.attacker.divisionIds.length + battle.defender.divisionIds.length)) * 100)
          : 50

        return (
          <div className="war-card war-card--battle" key={battle.id}>
            {/* Battle Header */}
            <div
              className="war-battle-header"
              onClick={() => setExpandedBattle(isExpanded ? null : battle.id)}
            >
              <div className="war-battle-sides">
                <div className="war-battle-side war-battle-side--atk">
                  <span className="war-battle-flag">{getCountryFlag(battle.attackerId)}</span>
                  <div>
                    <div className="war-battle-country">{getCountryName(battle.attackerId)}</div>
                    <div className="war-battle-meta">{battle.attacker.engagedDivisionIds.length} engaged • {battle.attacker.divisionIds.length} total</div>
                  </div>
                  <span className="war-battle-rounds">{battle.attackerRoundsWon}</span>
                </div>

                <div className="war-battle-center">
                  <div className="war-battle-vs">VS</div>
                  <div className="war-battle-terrain">⚔️ {battle.regionName}</div>
                  <div className="war-battle-tick">Tick {battle.ticksElapsed}</div>
                </div>

                <div className="war-battle-side war-battle-side--def">
                  <span className="war-battle-rounds">{battle.defenderRoundsWon}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div className="war-battle-country">{getCountryName(battle.defenderId)}</div>
                    <div className="war-battle-meta">{battle.defender.engagedDivisionIds.length} engaged • {battle.defender.divisionIds.length} total</div>
                  </div>
                  <span className="war-battle-flag">{getCountryFlag(battle.defenderId)}</span>
                </div>
              </div>

              {/* Strength Bar */}
              <div className="war-battle-strength-bar">
                <div className="war-battle-strength-bar__fill--atk" style={{ width: `${atkManpowerPct}%` }} />
                <div className="war-battle-strength-bar__fill--def" style={{ width: `${100 - atkManpowerPct}%` }} />
              </div>

              <div className="war-battle-expand">{isExpanded ? '▲ COLLAPSE' : '▼ EXPAND DETAILS'}</div>
            </div>

            {/* 3D View Button */}
            <button
              className="war-launch-3d-btn"
              onClick={(e) => {
                e.stopPropagation()
                setScene3DBattle({
                  id: battle.id,
                  atkDivs: get3DDivisions([...battle.attacker.engagedDivisionIds]),
                  defDivs: get3DDivisions([...battle.defender.engagedDivisionIds]),
                })
              }}
            >
              <span className="war-launch-3d-btn__icon">🌐</span>
              VIEW 3D BATTLE
            </button>

            {/* Tick Damage Bar + Ground Points & Tick Speed */}
            {(() => {
              const countries = useWorldStore.getState().countries
              const ac = countries.find(c => c.code === battle.attackerId)?.color || '#22d38a'
              const dc = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'
              return <TickDamageBar battle={battle} atkColor={ac} defColor={dc} />
            })()}

            {/* Ground Points & Tick Speed */}
            {(() => {
              const activeRound = battle.rounds[battle.rounds.length - 1]
              if (!activeRound) return null
              const totalPts = activeRound.attackerPoints + activeRound.defenderPoints
              const tickSpeed = totalPts < 100 ? '3 min' : totalPts < 200 ? '2.5 min' : totalPts < 300 ? '2 min' : totalPts < 400 ? '1.5 min' : '1 min'
              const ptIncr = totalPts < 100 ? 1 : totalPts < 200 ? 2 : totalPts < 300 ? 3 : totalPts < 400 ? 4 : 5
              const dotClass = totalPts >= 400 ? 'tick-indicator__dot--fastest' : totalPts >= 200 ? 'tick-indicator__dot--fast' : ''
              return (
                <>
                  <div className="battle-points">
                    <div className="battle-points__side battle-points__side--atk">
                      <div className="battle-points__value battle-points__value--atk">{activeRound.attackerPoints}</div>
                      <div className="battle-points__label">ATTACKER</div>
                    </div>
                    <div className="battle-points__center">
                      <div className="battle-points__round">R{battle.rounds.length}/3</div>
                      <div className="battle-points__tick">600 PTS TO WIN</div>
                    </div>
                    <div className="battle-points__side battle-points__side--def">
                      <div className="battle-points__value battle-points__value--def">{activeRound.defenderPoints}</div>
                      <div className="battle-points__label">DEFENDER</div>
                    </div>
                  </div>
                  <div className="tick-indicator">
                    <div className={`tick-indicator__dot ${dotClass}`} />
                    <span className="tick-indicator__text">TICK SPEED</span>
                    <span className="tick-indicator__speed">{tickSpeed} · +{ptIncr}pts</span>
                  </div>
                  {/* Player Combat Actions — choose side */}
                  <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginTop: '4px' }}>FIGHT FOR:</div>
                  <div className="battle-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <button
                      className="battle-action-btn battle-action-btn--attack"
                      disabled={player.stamina < 5}
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = battleStore.playerAttack(battle.id, 'attacker')
                        ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : '#ef4444')
                      }}
                    >
                      <span className="battle-action-btn__icon">⚔️</span>
                      <span className="battle-action-btn__label">ATK SIDE</span>
                      <span className="battle-action-btn__cost">5 STA</span>
                    </button>
                    <button
                      className="battle-action-btn battle-action-btn--attack"
                      disabled={player.stamina < 5}
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = battleStore.playerAttack(battle.id, 'defender')
                        ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : '#22d38a')
                      }}
                    >
                      <span className="battle-action-btn__icon">🛡️</span>
                      <span className="battle-action-btn__label">DEF SIDE</span>
                      <span className="battle-action-btn__cost">5 STA</span>
                    </button>
                  </div>
                </>
              )
            })()}

            {/* Expanded Details */}
            {isExpanded && (
              <div className="war-battle-details">
                {/* Stats Comparison */}
                <div className="war-battle-compare">
                  <div className="war-compare-col war-compare-col--atk">
                    <div className="war-compare-title">ATTACKER</div>
                    <div className="war-compare-stat">📊 Dmg Dealt: {(battle.attacker.damageDealt || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💀 Lost: {(battle.attacker.manpowerLost || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💥 Divs Destroyed: {battle.attacker.divisionsDestroyed}</div>
                    <div className="war-compare-stat">🏳️ Divs Retreated: {battle.attacker.divisionsRetreated}</div>
                  </div>
                  <div className="war-compare-divider">
                    <div className="war-terrain-info">
                      <div className="war-terrain-name">⚔️ {battle.regionName}</div>
                      <div className="war-terrain-bonus">Tick {battle.ticksElapsed}</div>
                    </div>
                  </div>
                  <div className="war-compare-col war-compare-col--def">
                    <div className="war-compare-title">DEFENDER</div>
                    <div className="war-compare-stat">📊 Dmg Dealt: {(battle.defender.damageDealt || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💀 Lost: {(battle.defender.manpowerLost || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💥 Divs Destroyed: {battle.defender.divisionsDestroyed}</div>
                    <div className="war-compare-stat">🏳️ Divs Retreated: {battle.defender.divisionsRetreated}</div>
                  </div>
                </div>

                {/* Division Status */}
                <div className="war-battle-divs">
                  <div className="war-battle-divs__title">🔹 ATTACKER DIVISIONS</div>
                  {battle.attacker.engagedDivisionIds.map(id => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES] || null
                    const strPct = Math.floor((d.manpower / d.maxManpower) * 100)
                    const moralePct = Math.floor(d.morale)
                    return (
                      <div className={`war-battle-div war-battle-div--${d.status}`} key={id}>
                        <img src={template?.icon} alt="div" className="war-battle-div__icon" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                        <span className="war-battle-div__name">{d.name}</span>
                        <div className="war-battle-div__bars">
                          <div className="war-mini-bar" title={`Strength ${strPct}%`}>
                            <div className="war-mini-bar__fill--green" style={{ width: `${strPct}%` }} />
                          </div>
                          <div className="war-mini-bar" title={`Morale ${moralePct}%`}>
                            <div className="war-mini-bar__fill--blue" style={{ width: `${moralePct}%` }} />
                          </div>
                        </div>
                        <span className="war-battle-div__morale">😊{Math.floor(d.morale)}</span>
                      </div>
                    )
                  })}

                </div>

                <div className="war-battle-divs">
                  <div className="war-battle-divs__title war-battle-divs__title--def">🔸 DEFENDER DIVISIONS</div>
                  {battle.defender.engagedDivisionIds.map(id => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES] || null
                    const strPct = Math.floor((d.manpower / d.maxManpower) * 100)
                    const moralePct = Math.floor(d.morale)
                    return (
                      <div className={`war-battle-div war-battle-div--${d.status}`} key={id}>
                        <img src={template?.icon} alt="div" className="war-battle-div__icon" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                        <span className="war-battle-div__name">{d.name}</span>
                        <div className="war-battle-div__bars">
                          <div className="war-mini-bar" title={`Strength ${strPct}%`}>
                            <div className="war-mini-bar__fill--green" style={{ width: `${strPct}%` }} />
                          </div>
                          <div className="war-mini-bar" title={`Morale ${moralePct}%`}>
                            <div className="war-mini-bar__fill--blue" style={{ width: `${moralePct}%` }} />
                          </div>
                        </div>
                        <span className="war-battle-div__morale">😊{Math.floor(d.morale)}</span>
                      </div>
                    )
                  })}

                </div>

                {/* Combat Log */}
                <div className="war-combat-log">
                  <div className="war-combat-log__title">📜 COMBAT LOG</div>
                  <div className="war-combat-log__entries">
                    {battle.combatLog.slice(-15).reverse().map((entry, i) => (
                      <div className={`war-log-entry war-log-entry--${entry.type}`} key={`${entry.timestamp}-${i}`}>
                        <span className="war-log-entry__tick">T{entry.tick}</span>
                        <span className="war-log-entry__msg">{entry.message}</span>
                      </div>
                    ))}
                    {battle.combatLog.length === 0 && (
                      <div className="war-log-entry">Waiting for first combat tick...</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Past Battles */}
      {pastBattles.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📜 BATTLE HISTORY</div>
          {pastBattles.map(battle => (
            <div className={`war-history-row war-history-row--${battle.status}`} key={battle.id}>
              <span>{getCountryFlag(battle.attackerId)} vs {getCountryFlag(battle.defenderId)}</span>
              <span>{battle.regionName}</span>
              <span className={`war-history-result war-history-result--${battle.status}`}>
                {battle.status === 'attacker_won' ? '🏆 ATTACKER WON' : '🛡️ DEFENDER WON'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
