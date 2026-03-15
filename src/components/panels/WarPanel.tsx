import React, { useState, Suspense } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, TERRAIN_MODIFIERS, COUNTRY_TERRAIN, type DivisionType } from '../../stores/armyStore'
import { useBattleStore, getCountryFlag, getCountryName } from '../../stores/battleStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import '../../styles/war.css'

const BattleScene3D = React.lazy(() => import('./BattleScene3D'))

type WarTab = 'overview' | 'recruit' | 'armies' | 'battles'

export default function WarPanel() {
  const [tab, setTab] = useState<WarTab>('overview')
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const iso = player.countryCode || 'US'

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')

  const tabs: { id: WarTab; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'OVERVIEW', icon: '📊' },
    { id: 'recruit', label: 'RECRUIT', icon: '🏭' },
    { id: 'armies', label: 'ARMIES', icon: '⚔️', count: myDivisions.length },
    { id: 'battles', label: 'BATTLES', icon: '💥', count: activeBattles.length },
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
        {tab === 'recruit' && <RecruitTab />}
        {tab === 'armies' && <ArmiesTab iso={iso} />}
        {tab === 'battles' && <BattlesTab />}
      </div>
    </div>
  )
}

// ====== OVERVIEW TAB ======

function OverviewTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()

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
                <span className="war-comp-row__icon">{template?.icon}</span>
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

      {/* Active Battles Quick View */}
      {activeBattles.length > 0 && (
        <div className="war-card war-card--red">
          <div className="war-card__title">💥 ACTIVE BATTLES</div>
          {activeBattles.map(battle => (
            <div className="war-battle-mini" key={battle.id}>
              <div className="war-battle-mini__header">
                <span>{getCountryFlag(battle.attackerId)} {getCountryName(battle.attackerId)}</span>
                <span className="war-battle-mini__vs">VS</span>
                <span>{getCountryName(battle.defenderId)} {getCountryFlag(battle.defenderId)}</span>
              </div>
              <div className="war-battle-mini__info">
                {battle.regionName} • Terrain: {battle.terrain} • Tick {battle.ticksElapsed}
              </div>
              <div className="war-battle-mini__bar">
                <div
                  className="war-battle-mini__fill war-battle-mini__fill--atk"
                  style={{ width: `${Math.max(5, (battle.attacker.totalManpower / (battle.attacker.totalManpower + battle.defender.totalManpower + 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
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

  const divTypes: DivisionType[] = ['infantry', 'mechanized', 'tank', 'artillery', 'anti_air', 'special_forces', 'fighter', 'bomber']

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
                <span className="war-recruit-card__icon">{t.icon}</span>
                <span className="war-recruit-card__name">{t.name}</span>
                <span className={`war-recruit-card__category war-recruit-card__category--${t.category}`}>
                  {t.category.toUpperCase()}
                </span>
              </div>

              <div className="war-recruit-card__desc">{t.description}</div>

              <div className="war-recruit-card__stats">
                <div className="war-recruit-stat">
                  <span>⚔️ ATK</span><span className="war-recruit-stat__val">{t.baseStats.attack}</span>
                </div>
                <div className="war-recruit-stat">
                  <span>🛡️ DEF</span><span className="war-recruit-stat__val">{t.baseStats.defense}</span>
                </div>
                <div className="war-recruit-stat">
                  <span>⚡ BRK</span><span className="war-recruit-stat__val">{t.baseStats.breakthrough}</span>
                </div>
                <div className="war-recruit-stat">
                  <span>💪 ORG</span><span className="war-recruit-stat__val">{t.baseStats.organization}</span>
                </div>
                <div className="war-recruit-stat">
                  <span>🏃 SPD</span><span className="war-recruit-stat__val">{t.baseStats.speed}</span>
                </div>
                <div className="war-recruit-stat">
                  <span>📦 SUP</span><span className="war-recruit-stat__val">{t.baseStats.supplyUsage}</span>
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
                👥 {t.manpowerCost.toLocaleString()} troops • 🕐 {t.trainingTime}s training • 🔧 {t.equipmentSlots} slots
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
  const [newArmyName, setNewArmyName] = useState('')
  const [attackTarget, setAttackTarget] = useState<string | null>(null)
  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)

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

  return (
    <div className="war-armies">
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
                {/* Division List */}
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned. Assign from unassigned pool below.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.templateId]
                    const strengthPct = Math.floor((div.manpower / div.maxManpower) * 100)
                    const orgPct = Math.floor((div.stats.organization / div.stats.maxOrganization) * 100)

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id}>
                        <div className="war-div-row__icon">{template?.icon}</div>
                        <div className="war-div-row__info">
                          <div className="war-div-row__name">{div.name}</div>
                          <div className="war-div-row__stats">
                            ⚔️{div.stats.attack} 🛡️{div.stats.defense} ⚡{div.stats.breakthrough}
                            • EXP:{div.experience} • 🔧{div.equipment.length}/{template?.equipmentSlots || 0}
                          </div>
                        </div>
                        <div className="war-div-row__bars">
                          <div className="war-div-bar" title={`Strength: ${strengthPct}%`}>
                            <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%` }} />
                            <span className="war-div-bar__label">STR {strengthPct}%</span>
                          </div>
                          <div className="war-div-bar" title={`Organization: ${orgPct}%`}>
                            <div className="war-div-bar__fill war-div-bar__fill--org" style={{ width: `${orgPct}%` }} />
                            <span className="war-div-bar__label">ORG {orgPct}%</span>
                          </div>
                        </div>
                        <div className={`war-div-status war-div-status--${div.status}`}>
                          {div.status === 'training' ? `🔨 ${Math.floor((div.trainingProgress / DIVISION_TEMPLATES[div.templateId].trainingTime) * 100)}%` : div.status.toUpperCase()}
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
                        const terrain = COUNTRY_TERRAIN[code] || 'plains'
                        const terrainMod = TERRAIN_MODIFIERS[terrain]

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
                            <span className="war-target-terrain">🏔️{terrain} (+{terrainMod.defenseBonus}% def)</span>
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
            const template = DIVISION_TEMPLATES[div.templateId]
            return (
              <div className="war-unassigned-row" key={div.id}>
                <span>{template?.icon} {div.name}</span>
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
        type: d.templateId,
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
        const atkManpowerPct = battle.attacker.totalManpower > 0
          ? Math.floor((battle.attacker.totalManpower / (battle.attacker.totalManpower + battle.defender.totalManpower)) * 100)
          : 50
        const terrain = TERRAIN_MODIFIERS[battle.terrain]

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
                    <div className="war-battle-meta">{battle.attacker.engagedDivisionIds.length} engaged • {battle.attacker.totalManpower.toLocaleString()} troops</div>
                  </div>
                  <span className="war-battle-rounds">{battle.attackerRoundsWon}</span>
                </div>

                <div className="war-battle-center">
                  <div className="war-battle-vs">VS</div>
                  <div className="war-battle-terrain">🏔️ {battle.terrain}</div>
                  <div className="war-battle-tick">Tick {battle.ticksElapsed}</div>
                </div>

                <div className="war-battle-side war-battle-side--def">
                  <span className="war-battle-rounds">{battle.defenderRoundsWon}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div className="war-battle-country">{getCountryName(battle.defenderId)}</div>
                    <div className="war-battle-meta">{battle.defender.engagedDivisionIds.length} engaged • {battle.defender.totalManpower.toLocaleString()} troops</div>
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
                  atkDivs: get3DDivisions([...battle.attacker.engagedDivisionIds, ...battle.attacker.reserveDivisionIds]),
                  defDivs: get3DDivisions([...battle.defender.engagedDivisionIds, ...battle.defender.reserveDivisionIds]),
                })
              }}
            >
              <span className="war-launch-3d-btn__icon">🌐</span>
              VIEW 3D BATTLE — {battle.terrain.toUpperCase()} TERRAIN
            </button>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="war-battle-details">
                {/* Stats Comparison */}
                <div className="war-battle-compare">
                  <div className="war-compare-col war-compare-col--atk">
                    <div className="war-compare-title">ATTACKER</div>
                    <div className="war-compare-stat">⚔️ Attack: {battle.attacker.totalAttack}</div>
                    <div className="war-compare-stat">🛡️ Defense: {battle.attacker.totalDefense}</div>
                    <div className="war-compare-stat">⚡ Breakthrough: {battle.attacker.totalBreakthrough}</div>
                    <div className="war-compare-stat">✈️ Air: {battle.attacker.airSuperiority.toFixed(0)}%</div>
                    <div className="war-compare-stat">💀 Lost: {battle.attacker.manpowerLost.toLocaleString()}</div>
                    <div className="war-compare-stat">📊 Dmg Dealt: {battle.attacker.damageDealt.toLocaleString()}</div>
                  </div>
                  <div className="war-compare-divider">
                    <div className="war-terrain-info">
                      <div className="war-terrain-name">🏔️ {battle.terrain.toUpperCase()}</div>
                      <div className="war-terrain-bonus">+{terrain.defenseBonus}% DEF</div>
                      <div className="war-terrain-bonus">-{terrain.attackPenalty}% ATK</div>
                      <div className="war-terrain-special">★ {terrain.specialBonus}: +{terrain.specialBonusValue}%</div>
                    </div>
                  </div>
                  <div className="war-compare-col war-compare-col--def">
                    <div className="war-compare-title">DEFENDER</div>
                    <div className="war-compare-stat">⚔️ Attack: {battle.defender.totalAttack}</div>
                    <div className="war-compare-stat">🛡️ Defense: {battle.defender.totalDefense}</div>
                    <div className="war-compare-stat">⚡ Breakthrough: {battle.defender.totalBreakthrough}</div>
                    <div className="war-compare-stat">✈️ Air: {battle.defender.airSuperiority.toFixed(0)}%</div>
                    <div className="war-compare-stat">💀 Lost: {battle.defender.manpowerLost.toLocaleString()}</div>
                    <div className="war-compare-stat">📊 Dmg Dealt: {battle.defender.damageDealt.toLocaleString()}</div>
                  </div>
                </div>

                {/* Division Status */}
                <div className="war-battle-divs">
                  <div className="war-battle-divs__title">🔹 ATTACKER DIVISIONS</div>
                  {battle.attacker.engagedDivisionIds.map(id => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.templateId]
                    const strPct = Math.floor((d.manpower / d.maxManpower) * 100)
                    const orgPct = Math.floor((d.stats.organization / d.stats.maxOrganization) * 100)
                    return (
                      <div className={`war-battle-div war-battle-div--${d.status}`} key={id}>
                        <span className="war-battle-div__icon">{template?.icon}</span>
                        <span className="war-battle-div__name">{d.name}</span>
                        <div className="war-battle-div__bars">
                          <div className="war-mini-bar" title={`Strength ${strPct}%`}>
                            <div className="war-mini-bar__fill--green" style={{ width: `${strPct}%` }} />
                          </div>
                          <div className="war-mini-bar" title={`Org ${orgPct}%`}>
                            <div className="war-mini-bar__fill--blue" style={{ width: `${orgPct}%` }} />
                          </div>
                        </div>
                        <span className="war-battle-div__morale">😊{Math.floor(d.morale)}</span>
                      </div>
                    )
                  })}
                  {battle.attacker.reserveDivisionIds.length > 0 && (
                    <div className="war-battle-reserve">
                      📦 {battle.attacker.reserveDivisionIds.length} in reserve
                    </div>
                  )}
                </div>

                <div className="war-battle-divs">
                  <div className="war-battle-divs__title war-battle-divs__title--def">🔸 DEFENDER DIVISIONS</div>
                  {battle.defender.engagedDivisionIds.map(id => {
                    const d = armyStore.divisions[id]
                    if (!d) return null
                    const template = DIVISION_TEMPLATES[d.templateId]
                    const strPct = Math.floor((d.manpower / d.maxManpower) * 100)
                    const orgPct = Math.floor((d.stats.organization / d.stats.maxOrganization) * 100)
                    return (
                      <div className={`war-battle-div war-battle-div--${d.status}`} key={id}>
                        <span className="war-battle-div__icon">{template?.icon}</span>
                        <span className="war-battle-div__name">{d.name}</span>
                        <div className="war-battle-div__bars">
                          <div className="war-mini-bar" title={`Strength ${strPct}%`}>
                            <div className="war-mini-bar__fill--green" style={{ width: `${strPct}%` }} />
                          </div>
                          <div className="war-mini-bar" title={`Org ${orgPct}%`}>
                            <div className="war-mini-bar__fill--blue" style={{ width: `${orgPct}%` }} />
                          </div>
                        </div>
                        <span className="war-battle-div__morale">😊{Math.floor(d.morale)}</span>
                      </div>
                    )
                  })}
                  {battle.defender.reserveDivisionIds.length > 0 && (
                    <div className="war-battle-reserve">
                      📦 {battle.defender.reserveDivisionIds.length} in reserve
                    </div>
                  )}
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
