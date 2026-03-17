import React, { useState, Suspense } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, type DivisionType, type MilitaryRankType } from '../../stores/armyStore'
import { useBattleStore, getCountryFlag, getCountryName } from '../../stores/battleStore'
import { usePlayerStore, getMilitaryRank } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import OccupationPanel from './OccupationPanel'
import '../../styles/war.css'

const BattleScene3D = React.lazy(() => import('./BattleScene3D'))

type WarTab = 'overview' | 'recruit' | 'armies' | 'battles'

export default function WarPanel() {
  const [tab, setTab] = useState<WarTab>('overview')
  const [editingMotd, setEditingMotd] = useState(false)
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const iso = player.countryCode || 'US'

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const tabs: { id: WarTab; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'HQ', icon: '📊' },
    { id: 'recruit', label: 'RECRUIT', icon: '🏭' },
    { id: 'armies', label: 'FORCES', icon: '⚔️', count: myDivisions.length },
    { id: 'battles', label: 'COMBAT', icon: '💥', count: activeBattles.length },
  ]

  return (
    <div className="war-panel">
      {/* Message of the Day — global, above tabs */}
      <div style={{ padding: '4px 10px', marginBottom: '4px', background: 'rgba(139,92,246,0.06)', borderRadius: '5px', border: '1px solid rgba(139,92,246,0.12)' }}>
        {editingMotd ? (
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <input
              type="text" placeholder="COMMANDER MESSAGE OF THE DAY..." maxLength={200}
              value={battleStore.warMotd || ''} autoFocus
              onChange={(e) => battleStore.setWarMotd(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingMotd(false) }}
              style={{
                flex: 1, padding: '3px 6px', fontSize: '8px',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '3px', color: '#e2e8f0', outline: 'none',
              }}
            />
            <button
              onClick={() => setEditingMotd(false)}
              style={{
                padding: '2px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px', fontWeight: 700,
              }}
            >✅</button>
          </div>
        ) : battleStore.warMotd ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => setEditingMotd(true)}>
            <div style={{
              flex: 1, fontSize: '8px', letterSpacing: '0.8px', textTransform: 'uppercase',
              fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#a78bfa',
              padding: '2px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px',
              borderLeft: '2px solid #a78bfa',
            }}>
              📢 {battleStore.warMotd}
            </div>
            <span style={{ fontSize: '8px', color: '#475569' }}>✏️</span>
          </div>
        ) : (
          <button
            onClick={() => setEditingMotd(true)}
            style={{
              width: '100%', padding: '2px 6px', border: '1px dashed rgba(139,92,246,0.2)',
              borderRadius: '3px', cursor: 'pointer', background: 'transparent',
              fontSize: '7px', color: '#64748b', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >📢 SET MESSAGE OF THE DAY</button>
        )}
      </div>
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
      <div className="war-content">
        {tab === 'overview' && <OverviewTab iso={iso} />}
        {tab === 'recruit' && <RecruitTab />}
        {tab === 'armies' && <ForcesTab iso={iso} />}
        {tab === 'battles' && <CombatTab />}
      </div>
    </div>
  )
}

// ====== HQ TAB — Dashboard ======

function OverviewTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const ui = useUIStore()

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const totalManpower = myDivisions.reduce((s, d) => s + d.manpower, 0)
  const readyDivs = myDivisions.filter(d => d.status === 'ready').length
  const trainingDivs = myDivisions.filter(d => d.status === 'training').length
  const inCombatDivs = myDivisions.filter(d => d.status === 'in_combat').length

  const popCap = armyStore.getPlayerPopCap()
  const popPct = popCap.max > 0 ? (popCap.used / popCap.max) * 100 : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 60 ? '#f59e0b' : '#22d38a'

  return (
    <div className="war-overview">
      {/* Compact Stats Row */}
      <div className="war-card war-card--highlight">
        <div className="war-card__title">🎖️ MILITARY OVERVIEW — {getCountryName(iso)}</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
          {[
            { label: 'DIVS', value: myDivisions.length, color: '#e2e8f0' },
            { label: 'TROOPS', value: totalManpower.toLocaleString(), color: '#e2e8f0' },
            { label: 'READY', value: readyDivs, color: '#22d38a' },
            { label: 'TRAINING', value: trainingDivs, color: '#f59e0b' },
            { label: 'COMBAT', value: inCombatDivs, color: '#ef4444' },
            { label: 'BATTLES', value: activeBattles.length, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 60px', textAlign: 'center', padding: '4px 2px',
              background: 'rgba(255,255,255,0.03)', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Pop Cap Bar */}
        <div style={{ marginTop: '6px', padding: '5px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 800, marginBottom: '2px' }}>
            <span style={{ color: '#94a3b8' }}>🏠 POP CAP</span>
            <span style={{ color: popColor }}>{popCap.used} / {popCap.max}</span>
          </div>
          <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, popPct)}%`, background: popColor, borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>

      {/* Active Battles — Compact cards */}
      {activeBattles.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">💥 ACTIVE BATTLES ({activeBattles.length})</div>
          {activeBattles.map(battle => {
            const atkDmg = battle.attacker?.damageDealt || 0
            const defDmg = battle.defender?.damageDealt || 0
            const totalDmg = atkDmg + defDmg
            const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
            const activeRound = battle.rounds[battle.rounds.length - 1]

            return (
              <div key={battle.id} style={{
                padding: '6px 8px', marginBottom: '4px',
                background: 'rgba(239,68,68,0.05)', borderRadius: '5px',
                border: '1px solid rgba(239,68,68,0.15)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: '#e2e8f0', marginBottom: '3px' }}>
                  <span>{getCountryFlag(battle.attackerId)} {getCountryName(battle.attackerId)}</span>
                  <span style={{ color: '#64748b', fontSize: '8px' }}>T{battle.ticksElapsed} • R{battle.rounds.length}/3</span>
                  <span>{getCountryName(battle.defenderId)} {getCountryFlag(battle.defenderId)}</span>
                </div>
                {/* Compact damage bar */}
                <div style={{ position: 'relative', height: '14px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: '#22d38a', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: '#ef4444', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#fff', transform: 'translateX(-1px)', zIndex: 2, opacity: 0.5 }} />
                  <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{atkDmg.toLocaleString()}</span>
                  <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{defDmg.toLocaleString()}</span>
                </div>
                {activeRound && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                    <span style={{ color: '#22d38a' }}>{activeRound.attackerPoints} pts</span>
                    <span>600 to win</span>
                    <span style={{ color: '#ef4444' }}>{activeRound.defenderPoints} pts</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {activeBattles.length === 0 && (
        <div className="war-card">
          <div className="war-empty">No active battles. Peace reigns... for now.</div>
        </div>
      )}
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
        <div className={`war-feedback ${feedback.includes('Not enough') || feedback.includes('Pop Cap') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      <div className="war-card">
        <div className="war-card__title">🏭 RECRUIT DIVISIONS</div>
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
                <div className="war-recruit-stat"><span>⚔️ ATK</span><span className="war-recruit-stat__val">{t.atkDmgMult}x</span></div>
                <div className="war-recruit-stat"><span>🎯 Hit</span><span className="war-recruit-stat__val">{(t.hitRate * 100).toFixed(0)}%</span></div>
                <div className="war-recruit-stat"><span>💥 Crit</span><span className="war-recruit-stat__val">{t.critRateMult}x</span></div>
                <div className="war-recruit-stat"><span>🛡️ HP</span><span className="war-recruit-stat__val">{t.healthMult}x</span></div>
                <div className="war-recruit-stat"><span>🏃 Dodge</span><span className="war-recruit-stat__val">{t.dodgeMult}x</span></div>
                <div className="war-recruit-stat"><span>🪨 Armor</span><span className="war-recruit-stat__val">{t.armorMult}x</span></div>
              </div>

              <div className="war-recruit-card__cost">
                <span className={player.money >= t.recruitCost.money ? '' : 'war-cost--insufficient'}>${t.recruitCost.money.toLocaleString()}</span>
                <span className={player.oil >= t.recruitCost.oil ? '' : 'war-cost--insufficient'}>🛢️{t.recruitCost.oil}</span>
                <span className={player.materialX >= t.recruitCost.materialX ? '' : 'war-cost--insufficient'}>⚛️{t.recruitCost.materialX}</span>
                <span className={player.scrap >= t.recruitCost.scrap ? '' : 'war-cost--insufficient'}>🔩{t.recruitCost.scrap}</span>
              </div>

              <div className="war-recruit-card__meta">
                👥 {t.manpowerCost.toLocaleString()} troops • 🕐 {t.trainingTime}s • 🏠 {t.popCost} pop
              </div>

              {isSelected && (
                <button
                  className="war-recruit-btn"
                  disabled={!canAfford}
                  onClick={(e) => { e.stopPropagation(); handleRecruit(type) }}
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

// ====== FORCES TAB — Enlist + Division Management ======

const RANK_ICONS: Record<string, string> = {
  private: '🪖', corporal: '🎖️', sergeant: '⭐', lieutenant: '⭐⭐',
  captain: '⭐⭐⭐', colonel: '🏅', general: '👑',
}

function ForcesTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const world = useWorldStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [newArmyName, setNewArmyName] = useState('')
  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const myRank = getMilitaryRank(player.level)
  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = Object.values(armyStore.armies).find(a => a.members.some(m => m.playerId === player.name))
  const unassignedDivs = Object.values(armyStore.divisions).filter(
    d => d.countryCode === iso && !Object.values(armyStore.armies).some(a => a.divisionIds.includes(d.id))
  )
  const adjacentCountries = ADJACENCY_MAP[iso] || []

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    armyStore.createArmy(newArmyName.trim(), iso)
    setNewArmyName('')
  }

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

  const handleLaunchAttack = (armyId: string, targetCode: string) => {
    const result = battleStore.launchHOIBattle(armyId, targetCode, 'invasion')
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="war-armies">
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Already') || feedback.includes('cannot') || feedback.includes('Not') || feedback.includes('No') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* Compact Rank + Enlistment */}
      <div className="war-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{RANK_ICONS[myRank.rank] || '🪖'}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{myRank.label.toUpperCase()}</div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>Level {player.level}</div>
            </div>
          </div>
          {currentArmy ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '9px', color: '#22d38a', fontWeight: 700 }}>✅ {currentArmy.name}</div>
              <div style={{ fontSize: '7px', color: '#64748b' }}>{currentArmy.members.length} members</div>
              {currentArmy.commanderId !== player.name && (
                <button className="war-btn war-btn--danger" style={{ fontSize: '7px', padding: '2px 6px', marginTop: '2px' }} onClick={handleLeave}>LEAVE</button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '8px', color: '#f59e0b' }}>Not enlisted</div>
          )}
        </div>
      </div>

      {/* Create Force */}
      <div className="war-card">
        <div className="war-card__title">➕ CREATE MILITARY FORCE</div>
        <div className="war-create-army">
          <input className="war-input" placeholder="Force name..." value={newArmyName} onChange={e => setNewArmyName(e.target.value)} />
          <button className="war-btn war-btn--primary" onClick={handleCreateArmy}>CREATE</button>
        </div>
      </div>

      {/* Available Forces to Enlist */}
      {!currentArmy && myArmies.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📋 AVAILABLE FORCES</div>
          {myArmies.map(army => (
            <div key={army.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 8px', marginBottom: '3px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>⚔️ {army.name}</div>
                <div style={{ fontSize: '7px', color: '#64748b' }}>👑 {army.commanderId} • {army.members.length} members • {army.divisionIds.length} divs</div>
              </div>
              <button className="war-btn war-btn--primary" style={{ fontSize: '7px', padding: '3px 8px' }} onClick={() => handleEnlist(army.id)}>ENLIST</button>
            </div>
          ))}
        </div>
      )}

      {/* Force List with Divisions */}
      {myArmies.map(army => {
        const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
        const isExpanded = expandedArmy === army.id
        const readyDivs = divs.filter(d => d.status === 'ready')
        const canAttack = readyDivs.length > 0

        return (
          <div className="war-card war-card--army" key={army.id}>
            <div className="war-army-header" onClick={() => setExpandedArmy(isExpanded ? null : army.id)}>
              <div className="war-army-header__left">
                <span className="war-army-header__icon">⚔️</span>
                <div>
                  <div className="war-army-header__name">{army.name}</div>
                  <div className="war-army-header__info">{divs.length} divisions • {army.totalManpower.toLocaleString()} troops</div>
                </div>
              </div>
              <div className="war-army-header__right">
                <span className={`war-army-status war-army-status--${army.status}`}>{army.status.toUpperCase()}</span>
                <span className="war-army-expand">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="war-army-body">
                {/* Force Vault */}
                <div style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>🏦 FORCE VAULT</div>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                    {[
                      { icon: '💰', val: army.vault.money },
                      { icon: '🛢️', val: army.vault.oil },
                      { icon: '🔫', val: army.vault.ammo },
                      { icon: '✈️', val: army.vault.jets },
                      { icon: '🪖', val: army.vault.tanks },
                    ].map(r => (
                      <div key={r.icon} style={{
                        flex: '1 1 40px', textAlign: 'center', padding: '3px',
                        background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <span style={{ fontSize: '10px' }}>{r.icon}</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginLeft: '2px' }}>{r.val.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  {army.members.some(m => m.playerId === player.name) && (
                    <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                      {[
                        { resource: 'money' as const, amount: 10000, label: '💰 $10K' },
                        { resource: 'money' as const, amount: 50000, label: '💰 $50K' },
                        { resource: 'oil' as const, amount: 100, label: '🛢️ 100' },
                      ].map(d => (
                        <button key={d.label} className="war-btn war-btn--small"
                          style={{ fontSize: '7px', padding: '2px 5px' }}
                          onClick={() => armyStore.donateToVault(army.id, d.resource, d.amount)}
                        >{d.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Division List — Enhanced with stance, XP, rebuild/disband */}
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.type]
                    const strengthPct = Math.floor((div.manpower / div.maxManpower) * 100)
                    const divLevel = Math.floor((div.experience || 0) / 10)
                    const stanceColors: Record<string, string> = {
                      unassigned: '#64748b', force_pool: '#3b82f6', reserve: '#f59e0b', first_line_defense: '#ef4444'
                    }
                    const stanceLabels: Record<string, string> = {
                      unassigned: 'UNASSIGNED', force_pool: 'FORCE', reserve: 'RESERVE', first_line_defense: '1ST LINE'
                    }

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id}>
                        <img src={template?.icon} alt="div" style={{ width: '16px', height: '16px', objectFit: 'contain' }} className="war-div-row__icon" />
                        <div className="war-div-row__info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="war-div-row__name">{div.name}</span>
                            <span style={{ fontSize: '7px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '0 3px', borderRadius: '2px' }}>
                              LV{divLevel}
                            </span>
                            <span style={{ fontSize: '7px', fontWeight: 700, color: stanceColors[div.stance || 'unassigned'], background: `${stanceColors[div.stance || 'unassigned']}15`, padding: '0 3px', borderRadius: '2px' }}>
                              {stanceLabels[div.stance || 'unassigned']}
                            </span>
                          </div>
                          <div className="war-div-row__stats">
                            {div.manpower}/{div.maxManpower} • 🔧{div.equipment.length}/3 • XP:{Math.floor(div.experience)}
                          </div>
                        </div>
                        <div className="war-div-row__bars">
                          <div className="war-div-bar" title={`Strength: ${strengthPct}%`}>
                            <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%` }} />
                            <span className="war-div-bar__label">HP {strengthPct}%</span>
                          </div>
                        </div>
                        <div className={`war-div-status war-div-status--${div.status}`}>
                          {div.status === 'training' ? (() => { const left = Math.max(0, Math.ceil((div.readyAt - Date.now()) / 1000)); return `🔨 ${left}s` })() : div.status.toUpperCase()}
                        </div>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {div.manpower < div.maxManpower && !div.reinforcing && div.status !== 'training' && div.status !== 'destroyed' && (
                            <button className="war-btn war-btn--small"
                              style={{ background: 'rgba(34,211,138,0.15)', color: '#22d38a', border: '1px solid rgba(34,211,138,0.3)', fontSize: '8px', padding: '2px 4px' }}
                              onClick={() => {
                                const r = armyStore.reinforceDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                              }}
                              title="Reinforce"
                            >🔧</button>
                          )}
                          {div.manpower > 1 && div.status !== 'training' && (
                            <button className="war-btn war-btn--small"
                              style={{ fontSize: '8px', padding: '2px 4px' }}
                              onClick={() => {
                                const r = armyStore.rebuildDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
                              }}
                              title="Rebuild"
                            >🏗️</button>
                          )}
                          {div.manpower <= 0 && (
                            <button className="war-btn war-btn--small war-btn--danger"
                              style={{ fontSize: '8px', padding: '2px 4px' }}
                              onClick={() => armyStore.disbandDivision(div.id)}
                              title="Disband"
                            >💀</button>
                          )}
                          <button className="war-btn war-btn--small war-btn--danger"
                            style={{ fontSize: '8px', padding: '2px 4px' }}
                            onClick={() => armyStore.removeDivisionFromArmy(div.id)}
                            title="Remove from force"
                          >✕</button>
                        </div>
                        {div.reinforcing && <span style={{ fontSize: '7px', color: '#f59e0b', fontWeight: 700 }}>🔧 REINFORCING</span>}
                      </div>
                    )
                  })}
                </div>

                {/* AV Composition & Aura */}
                {divs.length > 0 && (() => {
                  const av = armyStore.getArmyAV(army.id)
                  const aura = armyStore.getCompositionAura(army.id)
                  return (
                    <div style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px', marginBottom: '4px' }}>📊 ARMY VALUE</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                        {[
                          { label: '✈️', val: av.air, buff: `+${aura.critDmgPct}% CDmg`, color: '#60a5fa' },
                          { label: '🚶', val: av.ground, buff: `+${aura.dodgePct}% Dodge`, color: '#22d38a' },
                          { label: '🪖', val: av.tanks, buff: `+${aura.attackPct}% Atk`, color: '#f59e0b' },
                          { label: '🚢', val: av.navy, buff: `+${aura.precisionPct}% Prec`, color: '#a78bfa' },
                        ].map(cat => (
                          <div key={cat.label} style={{ textAlign: 'center', padding: '3px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
                            <div style={{ fontSize: '8px', color: cat.color, fontWeight: 700 }}>{cat.label} {cat.val}</div>
                            <div style={{ fontSize: '7px', color: cat.color, opacity: 0.7 }}>{cat.buff}</div>
                          </div>
                        ))}
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
          <div className="war-card__title">📦 UNASSIGNED ({unassignedDivs.length})</div>
          {unassignedDivs.map(div => {
            const template = DIVISION_TEMPLATES[div.type]
            return (
              <div className="war-unassigned-row" key={div.id}>
                <span><img src={template?.icon} alt="div" style={{ width: '12px', height: '12px', objectFit: 'contain', verticalAlign: 'middle', marginRight: '4px' }} />{div.name}</span>
                <span className={`war-div-status--${div.status}`}>{div.status}</span>
                <div className="war-unassigned-actions">
                  {myArmies.map(army => (
                    <button key={army.id} className="war-btn war-btn--small"
                      onClick={() => armyStore.assignDivisionToArmy(div.id, army.id)}
                    >→ {army.name.substring(0, 15)}</button>
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

// ====== COMBAT TAB — Battle Engagement + Deploy + Fight ======

function CombatTab() {
  const battleStore = useBattleStore()
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const [expandedBattle, setExpandedBattle] = useState<string | null>(null)
  const [deployCount, setDeployCount] = useState<Record<string, number>>({})
  const [editingOrderMsg, setEditingOrderMsg] = useState<Record<string, boolean>>({})
  const [scene3DBattle, setScene3DBattle] = useState<{
    id: string
    atkDivs: { type: DivisionType; name: string; manpower: number; maxManpower: number }[]
    defDivs: { type: DivisionType; name: string; manpower: number; maxManpower: number }[]
  } | null>(null)

  // Combat tick timer
  const [combatTickLeft, setCombatTickLocal] = useState(() => useBattleStore.getState().combatTickLeft)
  React.useEffect(() => {
    const unsub = useBattleStore.subscribe((state) => { setCombatTickLocal(state.combatTickLeft) })
    return unsub
  }, [])

  const iso = player.countryCode || 'US'
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const pastBattles = Object.values(battleStore.battles).filter(b => b.status !== 'active').slice(-5)

  const get3DDivisions = (divIds: string[]) => {
    return divIds.map(id => {
      const d = armyStore.divisions[id]
      if (!d) return null
      return { type: d.type, name: d.name, manpower: d.manpower, maxManpower: d.maxManpower }
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

      {/* Tick Timer */}
      {activeBattles.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '5px 10px', marginBottom: '6px',
          background: 'rgba(239,68,68,0.08)', borderRadius: '6px',
          border: '1px solid rgba(239,68,68,0.15)',
        }}>
          <span style={{ fontSize: '12px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: combatTickLeft <= 3 ? '#ef4444' : '#94a3b8' }}>
              <span>NEXT TICK</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: combatTickLeft <= 3 ? '#ef4444' : '#22d38a' }}>{combatTickLeft}s</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
              <div style={{
                width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%',
                background: combatTickLeft <= 3 ? '#ef4444' : '#22d38a',
                transition: 'width 0.9s linear', borderRadius: '2px',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Food — recover stamina mid-battle */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
        {[
          { key: 'bread', icon: '🍞', label: 'Bread', count: player.bread, sta: 10 },
          { key: 'sushi', icon: '🍣', label: 'Sushi', count: player.sushi, sta: 20 },
          { key: 'wagyu', icon: '🥩', label: 'Wagyu', count: player.wagyu, sta: 30 },
        ].map(f => (
          <button key={f.key} disabled={f.count <= 0}
            onClick={() => player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')}
            style={{
              flex: 1, padding: '5px 2px', borderRadius: '4px', cursor: f.count > 0 ? 'pointer' : 'not-allowed',
              background: f.count > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${f.count > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
              opacity: f.count > 0 ? 1 : 0.4, transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '14px' }}>{f.icon}</div>
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0' }}>{f.count}</div>
            <div style={{ fontSize: '7px', color: '#22c55e' }}>+{f.sta} STA</div>
          </button>
        ))}
      </div>

      {activeBattles.length === 0 && pastBattles.length === 0 && (
        <div className="war-card"><div className="war-empty">No active battles. Launch an attack from the Forces tab.</div></div>
      )}

      {activeBattles.map(battle => {
        const isExpanded = expandedBattle === battle.id
        const activeRound = battle.rounds[battle.rounds.length - 1]
        const atkDmg = battle.attacker?.damageDealt || 0
        const defDmg = battle.defender?.damageDealt || 0
        const totalDmg = atkDmg + defDmg
        const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
        const mySide: 'attacker' | 'defender' = iso === battle.attackerId ? 'attacker' : 'defender'

        const countries = useWorldStore.getState().countries
        const atkClr = countries.find(c => c.code === battle.attackerId)?.color || '#22d38a'
        const defClr = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'

        return (
          <div className="war-card war-card--battle" key={battle.id}>
            {/* Battle Header */}
            <div className="war-battle-header" onClick={() => setExpandedBattle(isExpanded ? null : battle.id)}>
              <div className="war-battle-sides">
                <div className="war-battle-side war-battle-side--atk">
                  <span className="war-battle-flag">{getCountryFlag(battle.attackerId)}</span>
                  <div>
                    <div className="war-battle-country">{getCountryName(battle.attackerId)}</div>
                    <div className="war-battle-meta">{battle.attacker.engagedDivisionIds.length} divs</div>
                  </div>
                  <span className="war-battle-rounds">{battle.attackerRoundsWon}</span>
                </div>
                <div className="war-battle-center">
                  <div className="war-battle-vs">VS</div>
                  <div className="war-battle-terrain">⚔️ {battle.regionName}</div>
                  <div className="war-battle-tick">T{battle.ticksElapsed}</div>
                </div>
                <div className="war-battle-side war-battle-side--def">
                  <span className="war-battle-rounds">{battle.defenderRoundsWon}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div className="war-battle-country">{getCountryName(battle.defenderId)}</div>
                    <div className="war-battle-meta">{battle.defender.engagedDivisionIds.length} divs</div>
                  </div>
                  <span className="war-battle-flag">{getCountryFlag(battle.defenderId)}</span>
                </div>
              </div>
              <div className="war-battle-expand">{isExpanded ? '▲ COLLAPSE' : '▼ EXPAND'}</div>
            </div>

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

            {/* Damage Bar (smaller, secondary) */}
            <div style={{ position: 'relative', height: '12px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', margin: '2px 0' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: atkClr, opacity: 0.7 }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: defClr, opacity: 0.7 }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#fff', transform: 'translateX(-0.5px)', zIndex: 2, opacity: 0.4 }} />
              <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '7px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{atkDmg.toLocaleString()}</span>
              <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '7px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{defDmg.toLocaleString()}</span>
            </div>

            {/* Battle Orders (always visible) — yellow/orange/red */}
            <div style={{ marginTop: '4px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 700 }}>📋 ORDERS:</span>
                <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                  {([{ pct: 5, color: '#eab308', bg: 'linear-gradient(135deg, #eab308, #ca8a04)' },
                     { pct: 10, color: '#f97316', bg: 'linear-gradient(135deg, #f97316, #ea580c)' },
                     { pct: 15, color: '#ef4444', bg: 'linear-gradient(135deg, #ef4444, #dc2626)' }] as const).map(o => (
                    <button key={o.pct}
                      onClick={(e) => { e.stopPropagation(); battleStore.setBattleOrder(battle.id, battle.battleOrder === o.pct ? 0 : o.pct) }}
                      style={{
                        flex: 1, padding: '3px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                        fontSize: '9px', fontWeight: 700,
                        background: battle.battleOrder === o.pct ? o.bg : 'rgba(255,255,255,0.06)',
                        color: battle.battleOrder === o.pct ? '#000' : o.color,
                        boxShadow: battle.battleOrder === o.pct ? `0 0 8px ${o.color}44` : 'none',
                      }}
                    >+{o.pct}%</button>
                  ))}
                </div>
              </div>
              {/* Order Message */}
              {battle.battleOrder > 0 && (
                <div style={{ marginTop: '3px' }}>
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
                        style={{
                          padding: '2px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                          background: 'rgba(34,197,94,0.2)', color: '#22c55e', fontSize: '10px', fontWeight: 700,
                        }}
                      >✅</button>
                    </div>
                  ) : battle.orderMessage ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: true })) }}
                    >
                      <div style={{
                        flex: 1, fontSize: '8px', letterSpacing: '0.8px', textTransform: 'uppercase',
                        fontFamily: 'var(--font-mono)', fontWeight: 700,
                        color: battle.battleOrder === 5 ? '#eab308' : battle.battleOrder === 10 ? '#f97316' : '#ef4444',
                        padding: '2px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px',
                        borderLeft: `2px solid ${battle.battleOrder === 5 ? '#eab308' : battle.battleOrder === 10 ? '#f97316' : '#ef4444'}`,
                      }}>
                        📣 {battle.orderMessage}
                      </div>
                      <span style={{ fontSize: '8px', color: '#475569' }}>✏️</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingOrderMsg(prev => ({ ...prev, [battle.id]: true })) }}
                      style={{
                        width: '100%', padding: '2px 6px', border: '1px dashed rgba(255,255,255,0.1)',
                        borderRadius: '3px', cursor: 'pointer', background: 'transparent',
                        fontSize: '7px', color: '#475569', fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >+ ADD ORDER MESSAGE</button>
                  )}
                </div>
              )}
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
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#22d38a' : '#ef4444')
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
                            background: canDeploy ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.03)',
                            color: canDeploy ? '#22c55e' : '#334155', fontSize: '11px', fontWeight: 900,
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

            {/* Fight Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
              <button className="battle-action-btn" disabled={player.stamina < 5}
                style={{ background: `${atkClr}22`, borderColor: `${atkClr}44`, color: atkClr }}
                onClick={(e) => { e.stopPropagation(); const r = battleStore.playerAttack(battle.id, 'attacker'); ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : atkClr) }}
              >
                <span className="battle-action-btn__icon">⚔️</span>
                <span className="battle-action-btn__label">ATK</span>
                <span className="battle-action-btn__cost">5 STA</span>
              </button>
              <button className="battle-action-btn" disabled={player.stamina < 5}
                style={{ background: `${defClr}22`, borderColor: `${defClr}44`, color: defClr }}
                onClick={(e) => { e.stopPropagation(); const r = battleStore.playerAttack(battle.id, 'defender'); ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.isCrit ? '#f59e0b' : defClr) }}
              >
                <span className="battle-action-btn__icon">🛡️</span>
                <span className="battle-action-btn__label">DEF</span>
                <span className="battle-action-btn__cost">5 STA</span>
              </button>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="war-battle-details" style={{ marginTop: '6px' }}>

                {/* Deployed Divisions */}
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>🔹 ATTACKER DIVISIONS</div>
                  {battle.attacker.engagedDivisionIds.map(id => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
                    const strPct = Math.floor((d.manpower / d.maxManpower) * 100)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 0', fontSize: '8px' }}>
                        <img src={template?.icon} alt="" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
                        <span style={{ color: atkClr, fontWeight: 700, flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#94a3b8' }}>{d.manpower}/{d.maxManpower}</span>
                        <div style={{ width: '40px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${strPct}%`, height: '100%', background: strPct > 50 ? '#22c55e' : '#ef4444', borderRadius: '2px' }} />
                        </div>
                      </div>
                    )
                  })}
                  {battle.attacker.engagedDivisionIds.length === 0 && <div style={{ fontSize: '8px', color: '#475569' }}>None deployed</div>}
                </div>

                <div style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 700, marginBottom: '3px' }}>🔸 DEFENDER DIVISIONS</div>
                  {battle.defender.engagedDivisionIds.map(id => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
                    const strPct = Math.floor((d.manpower / d.maxManpower) * 100)
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 0', fontSize: '8px' }}>
                        <img src={template?.icon} alt="" style={{ width: '10px', height: '10px', objectFit: 'contain' }} />
                        <span style={{ color: defClr, fontWeight: 700, flex: 1 }}>{d.name}</span>
                        <span style={{ color: '#94a3b8' }}>{d.manpower}/{d.maxManpower}</span>
                        <div style={{ width: '40px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${strPct}%`, height: '100%', background: strPct > 50 ? '#22c55e' : '#ef4444', borderRadius: '2px' }} />
                        </div>
                      </div>
                    )
                  })}
                  {battle.defender.engagedDivisionIds.length === 0 && <div style={{ fontSize: '8px', color: '#475569' }}>None deployed</div>}
                </div>

                {/* Stats Comparison */}
                <div className="war-battle-compare">
                  <div className="war-compare-col war-compare-col--atk">
                    <div className="war-compare-title">ATTACKER</div>
                    <div className="war-compare-stat">📊 Dmg: {(battle.attacker.damageDealt || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💀 Lost: {(battle.attacker.manpowerLost || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💥 Destroyed: {battle.attacker.divisionsDestroyed}</div>
                  </div>
                  <div className="war-compare-divider">
                    <div className="war-terrain-info">
                      <div className="war-terrain-name">T{battle.ticksElapsed}</div>
                    </div>
                  </div>
                  <div className="war-compare-col war-compare-col--def">
                    <div className="war-compare-title">DEFENDER</div>
                    <div className="war-compare-stat">📊 Dmg: {(battle.defender.damageDealt || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💀 Lost: {(battle.defender.manpowerLost || 0).toLocaleString()}</div>
                    <div className="war-compare-stat">💥 Destroyed: {battle.defender.divisionsDestroyed}</div>
                  </div>
                </div>

                {/* Combat Log */}
                <div className="war-combat-log">
                  <div className="war-combat-log__title">📜 COMBAT LOG</div>
                  <div className="war-combat-log__entries">
                    {battle.combatLog.slice(-10).reverse().map((entry, i) => (
                      <div className={`war-log-entry war-log-entry--${entry.type}`} key={`${entry.timestamp}-${i}`}>
                        <span className="war-log-entry__tick">T{entry.tick}</span>
                        <span className="war-log-entry__msg">{entry.message}</span>
                      </div>
                    ))}
                    {battle.combatLog.length === 0 && <div className="war-log-entry">Waiting for first combat tick...</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Occupy Section */}
      <div style={{ marginTop: '8px' }}>
        <OccupationPanel />
      </div>

      {/* Past Battles */}
      {pastBattles.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">📜 BATTLE HISTORY</div>
          {pastBattles.map(battle => (
            <div className={`war-history-row war-history-row--${battle.status}`} key={battle.id}>
              <span>{getCountryFlag(battle.attackerId)} vs {getCountryFlag(battle.defenderId)}</span>
              <span>{battle.regionName}</span>
              <span className={`war-history-result war-history-result--${battle.status}`}>
                {battle.status === 'attacker_won' ? '🏆 ATK WON' : '🛡️ DEF WON'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
