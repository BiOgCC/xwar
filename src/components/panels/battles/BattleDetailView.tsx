import React, { useState, useEffect, Suspense } from 'react'
import { useBattleStore, getCountryName, getPlayerCombatStats, TACTICAL_ORDERS } from '../../../stores/battleStore'
import type { TacticalOrder } from '../../../stores/battleStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useInventoryStore, getItemImagePath, TIER_COLORS } from '../../../stores/inventoryStore'
import { useUIStore } from '../../../stores/uiStore'
import BattleAvatar from '../../shared/BattleAvatar'
import CountryFlag from '../../shared/CountryFlag'
import { getStatIcon } from '../../shared/StatIcon'
import { getCountryTerrain } from '../../../data/terrainMap'
import { getCountryDistance, getAttackOilCost } from '../../../utils/geography'
import { AnimatedNumber, fmtElapsed, fmtTicks } from '../warHelpers'
import type { EquipSlot } from '../../../stores/inventoryStore'
import '../../../styles/battles.css'

const BattleScene3D = React.lazy(() => import('../BattleScene3D'))

interface Props {
  battleId: string
  onBack: () => void
}

export default function BattleDetailView({ battleId, onBack }: Props) {
  const battleStore = useBattleStore()

  const player = usePlayerStore()
  const ui = useUIStore()
  const inv = useInventoryStore()

  const battle = battleStore.battles[battleId]
  const iso = player.countryCode || 'US'

  // Combat stats
  const cs = getPlayerCombatStats()
  const armorMit = cs.armorBlock / (cs.armorBlock + 100)
  const staCost = Math.max(1, Math.ceil(5 * (1 - armorMit)))

  // Local state
  const [showFood, setShowFood] = useState(false)
  const [viewingRound, setViewingRound] = useState<{ roundIdx: number } | null>(null)
  const [critSide, setCritSide] = useState<'atk' | 'def' | null>(null)
  const [hitSide, setHitSide] = useState<'atk' | 'def' | null>(null)
  const [combatTexts, setCombatTexts] = useState<{ atk: { id: string; text: string; color: string }[]; def: { id: string; text: string; color: string }[] }>({ atk: [], def: [] })
  const [mercForm, setMercForm] = useState<{ side: 'attacker' | 'defender' } | null>(null)
  const [mercRate, setMercRate] = useState(10)
  const [mercPool, setMercPool] = useState(100000)
  const [pickSlot, setPickSlot] = useState<EquipSlot | 'ammo' | null>(null)

  // Combat tick
  const [combatTickLeft, setCombatTickLocal] = useState(() => useBattleStore.getState().combatTickLeft)
  useEffect(() => {
    const unsub = useBattleStore.subscribe((state) => { setCombatTickLocal(state.combatTickLeft) })
    return unsub
  }, [])

  if (!battle) return (
    <div className="btl-detail">
      <button className="btl-detail__back" onClick={onBack}>← Back</button>
      <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: '10px' }}>Battle not found.</div>
    </div>
  )

  const countries = useWorldStore.getState().countries
  const atkClr = countries.find(c => c.code === battle.attackerId)?.color || '#3b82f6'
  const defClr = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'
  const mySide: 'attacker' | 'defender' = iso === battle.attackerId ? 'attacker' : 'defender'

  const atkDmg = battle.attacker?.damageDealt || 0
  const defDmg = battle.defender?.damageDealt || 0
  const totalDmg = atkDmg + defDmg
  const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
  const activeRound = battle.rounds[battle.rounds.length - 1]

  const fmtDmg = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
    : v >= 1000 ? `${(v / 1000).toFixed(1)}K`
    : v.toString()

  // Division system removed — always return infantry
  const getDominantType = (_divIds: string[]): 'infantry' | 'tank' | 'jet' | 'warship' | 'submarine' => 'infantry'

  // Oil cost for non-participant countries (everyone can fight, no alliance blocking)
  const evaluateSupportCost = (targetSide: 'attacker' | 'defender'): number => {
    if (iso === battle.attackerId || iso === battle.defenderId) return 0
    const opponent = targetSide === 'attacker' ? battle.defenderId : battle.attackerId
    const dist = getCountryDistance(iso, opponent)
    let oil = getAttackOilCost(dist) / 10000
    return Number(oil.toFixed(2))
  }

  const atkSupportCost = evaluateSupportCost('attacker')
  const defSupportCost = evaluateSupportCost('defender')

  const tickAtkDmg = battle.currentTick?.attackerDamage || 0
  const tickDefDmg = battle.currentTick?.defenderDamage || 0

  // Hit handler
  const handleHit = async (side: 'attacker' | 'defender', sideKey: 'atk' | 'def', sideClr: string) => {
    const r = await battleStore.playerAttack(battleId, side)
    if (r.message.includes('Too fast') || r.message.includes('Not enough stamina') || r.message.includes('Not enough oil') || r.message.includes('ammo') || r.message.includes('Out of') || r.message.includes('Server error')) {
      ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    if (r.damage <= 0) {
      ui.addFloatingText(r.message || 'Attack failed!', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    if (r.isCrit) { setCritSide(sideKey); setTimeout(() => setCritSide(null), 500) }
    setHitSide(sideKey === 'atk' ? 'def' : 'atk'); setTimeout(() => setHitSide(null), 300)
    const id = Date.now().toString() + Math.random().toString()
    let text = `${r.damage}`; let color = sideClr
    if (r.isMiss) { text = `${r.damage} 💨`; color = '#94a3b8' }
    else if (r.isDodged && r.isCrit) { text = `${Math.floor(r.damage)}⚡!`; color = '#22d38a' }
    else if (r.isDodged) { text = `${r.damage}⚡!`; color = '#22d38a' }
    else if (r.isCrit) { text = `${Math.floor(r.damage)}!`; color = '#f59e0b' }
    setCombatTexts(prev => ({ ...prev, [sideKey]: [...prev[sideKey].slice(-7), { id, text, color }] }))
    setTimeout(() => { setCombatTexts(prev => ({ ...prev, [sideKey]: prev[sideKey].filter(x => x.id !== id) })) }, 2500)
  }

  // Equipment
  const equipped = inv.items.filter(i => i.location === 'inventory' && i.equipped)
  const equipSlots: { slot: EquipSlot | 'ammo'; label: string }[] = [
    { slot: 'weapon', label: 'Wpn' },
    { slot: 'ammo', label: 'Ammo' },
    { slot: 'helmet', label: 'Helm' },
    { slot: 'chest', label: 'Chest' },
    { slot: 'legs', label: 'Pants' },
    { slot: 'boots', label: 'Boots' },
    { slot: 'gloves', label: 'Gloves' },
  ]

  const equipBest = () => {
    const allItems = inv.items.filter(i => i.location === 'inventory')
    ;(['helmet', 'chest', 'legs', 'gloves', 'boots'] as const).forEach(slot => {
      const c = allItems.filter(i => i.slot === slot && Number(i.durability) > 0)
      if (!c.length) return
      const b = c.reduce((a, b) => {
        const aT = (a.stats.damage || 0) + (a.stats.armor || 0) + (a.stats.critRate || 0) + (a.stats.critDamage || 0) + (a.stats.dodge || 0) + (a.stats.precision || 0)
        const bT = (b.stats.damage || 0) + (b.stats.armor || 0) + (b.stats.critRate || 0) + (b.stats.critDamage || 0) + (b.stats.dodge || 0) + (b.stats.precision || 0)
        return bT > aT ? b : a
      })
      inv.equipItem(b.id)
    })
    const w = allItems.filter(i => i.slot === 'weapon' && Number(i.durability) > 0)
    if (w.length) {
      const bw = w.reduce((a, b) => {
        const aT = (a.stats.damage || 0) + (a.stats.critRate || 0) + (a.stats.critDamage || 0)
        const bT = (b.stats.damage || 0) + (b.stats.critRate || 0) + (b.stats.critDamage || 0)
        return bT > aT ? b : a
      })
      inv.equipItem(bw.id)
    }
    if (player.redBullets > 0) player.equipAmmo('red')
    else if (player.purpleBullets > 0) player.equipAmmo('purple')
    else if (player.blueBullets > 0) player.equipAmmo('blue')
    else if (player.greenBullets > 0) player.equipAmmo('green')
  }

  const removeAllEquip = () => {
    inv.items.filter(x => x.equipped).forEach(x => inv.unequipItem(x.id))
    player.equipAmmo('none')
  }

  // Tactical orders
  const govStore = useGovernmentStore.getState()
  const myGov = govStore.governments[mySide === 'attacker' ? battle.attackerId : battle.defenderId]
  const isPresident = myGov?.president === player.name
  const activeOrder = (mySide === 'attacker' ? battle.attackerOrder : battle.defenderOrder) || 'none'

  // Adrenaline
  const pName = player.name
  const adr = battle.playerAdrenaline?.[pName] || 0
  const surgeState = battle.playerSurge?.[pName]
  const isSurging = surgeState && Date.now() < surgeState.until
  const crashState = battle.playerCrash?.[pName]
  const isCrashed = crashState && Date.now() < crashState.until
  const canSurge = adr >= 80 && !isSurging
  const isHot = adr >= 80
  const isPeak = adr >= 100
  const synergyLabel: Record<string, string> = {
    charge: '+60% ATK', precision: '+40% GUARANTEED CRIT', blitz: '+30% (5s)',
    fortify: '+40% DMG', none: '+40% DMG',
  }

  // -- Intensity for avatar animation --
  let atkIntensity = 0
  if (tickAtkDmg > 500) atkIntensity = 1.0
  else if (tickAtkDmg > 200) atkIntensity = 0.7
  else if (tickAtkDmg > 50) atkIntensity = 0.4
  else if (tickAtkDmg > 0) atkIntensity = 0.15

  let defIntensity = 0
  if (tickDefDmg > 500) defIntensity = 1.0
  else if (tickDefDmg > 200) defIntensity = 0.7
  else if (tickDefDmg > 50) defIntensity = 0.4
  else if (tickDefDmg > 0) defIntensity = 0.15

  const rdAtkPts = activeRound?.attackerPoints || 0
  const rdDefPts = activeRound?.defenderPoints || 0
  const maxPts = Math.max(rdAtkPts, rdDefPts)
  if (maxPts >= 450) { atkIntensity = Math.max(atkIntensity, 0.8); defIntensity = Math.max(defIntensity, 0.8) }

  return (
    <div className="btl-detail">
      <button className="btl-detail__back" onClick={onBack}>← Back to battles</button>

      <div className="btl-detail__scroll">

        {/* ══ BATTLE SUMMARY — shown when battle has ended ══ */}
        {battle.status !== 'active' && (() => {
          const summary = (battle as any).battleSummary
          const isAtkWin = battle.status === 'attacker_won'
          const winnerCode = isAtkWin ? battle.attackerId : battle.defenderId
          const loserCode = isAtkWin ? battle.defenderId : battle.attackerId
          const winnClr = isAtkWin ? atkClr : defClr
          const playerParticipated = !!(battle.attackerDamageDealers?.[player.name] || battle.defenderDamageDealers?.[player.name])
          const playerOnWinnerSide = (iso === battle.attackerId && isAtkWin) || (iso === battle.defenderId && !isAtkWin)
          const playerOnLoserSide = (iso === battle.attackerId && !isAtkWin) || (iso === battle.defenderId && isAtkWin)
          // Mercenary check: supported winner side without being a native
          const myAtkDmg = battle.attackerDamageDealers?.[player.name] || 0
          const myDefDmg = battle.defenderDamageDealers?.[player.name] || 0
          const supportedWinner = (!playerOnWinnerSide && !playerOnLoserSide)
            ? (isAtkWin ? myAtkDmg > 0 : myDefDmg > 0)
            : playerOnWinnerSide
          const rewards = summary?.rewards
          const r = supportedWinner ? rewards?.winnerPlayers : rewards?.loserPlayers

          return (
            <div className="btl-section" style={{
              background: `linear-gradient(180deg, ${winnClr}18 0%, rgba(0,0,0,0.6) 100%)`,
              border: `2px solid ${winnClr}44`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Glow effect */}
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, ${winnClr}15 0%, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Title */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '2px', color: winnClr, textShadow: `0 0 12px ${winnClr}66`, animation: 'pulse 2s infinite' }}>
                    {isAtkWin ? '⚔️ ATTACKER VICTORY' : '🛡️ DEFENSE HOLDS'}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>
                    Battle for {battle.regionName}
                  </div>
                </div>

                {/* Winner badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                  <CountryFlag iso={winnerCode} size={28} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: winnClr, fontFamily: 'var(--font-display)' }}>
                      {getCountryName(winnerCode)}
                    </div>
                    <div style={{ fontSize: '8px', color: '#94a3b8' }}>defeated {getCountryName(loserCode)}</div>
                  </div>
                  <CountryFlag iso={loserCode} size={20} />
                </div>

                {/* Score */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 900, color: atkClr }}>{battle.attackerRoundsWon}</span>
                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 800 }}>ROUNDS</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 900, color: defClr }}>{battle.defenderRoundsWon}</span>
                </div>

                {/* Damage totals */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '8px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', fontFamily: 'var(--font-display)' }}>ATK DAMAGE</div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: atkClr, fontFamily: 'var(--font-mono)' }}>{fmtDmg(atkDmg)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', fontFamily: 'var(--font-display)' }}>DEF DAMAGE</div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: defClr, fontFamily: 'var(--font-mono)' }}>{fmtDmg(defDmg)}</div>
                  </div>
                </div>

                {/* Territory capture */}
                {isAtkWin && (
                  <div style={{ textAlign: 'center', padding: '4px 8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                      🏴 {battle.regionName} CAPTURED BY {getCountryName(winnerCode).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Player rewards */}
                {playerParticipated && r && (
                  <div style={{
                    padding: '6px 8px', borderRadius: '4px', marginBottom: '4px',
                    background: supportedWinner ? 'rgba(34,211,138,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${supportedWinner ? 'rgba(34,211,138,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  }}>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: supportedWinner ? '#22d38a' : '#ef4444', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '4px' }}>
                      {supportedWinner ? '🏆 YOUR REWARDS' : '📜 CONSOLATION'}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24' }}>💰 +${r.money}</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6' }}>✨ +{r.xp} XP</span>
                      {r.badges > 0 && <span style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b' }}>🎖️ +{r.badges}</span>}
                    </div>
                    <div style={{ fontSize: '7px', color: '#64748b', textAlign: 'center', marginTop: '3px' }}>
                      Your damage: {fmtDmg(myAtkDmg + myDefDmg)}
                    </div>
                  </div>
                )}

                {!playerParticipated && (
                  <div style={{ textAlign: 'center', fontSize: '8px', color: '#475569', padding: '4px 0' }}>
                    You did not participate in this battle.
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ══ SECTION 1: Battle Scene — Damage carousel, score, animations, ticker ══ */}
        <div className="btl-section btl-section--transparent">
          {/* Round damage summary — only show completed rounds */}
          {(() => {
            const completedRounds = battle.rounds.filter(rd => rd.status !== 'active')
            if (completedRounds.length === 0) return null
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
                  {completedRounds.map((rd, ri) => (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                      <CountryFlag iso={battle.attackerId} size={12} />
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#94a3b8' }}>
                        ⚔️ {(rd.attackerDmgTotal || 0) > 999 ? `${((rd.attackerDmgTotal || 0) / 1000).toFixed(0)}K` : rd.attackerDmgTotal || 0}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  {completedRounds.map((rd, ri) => (
                    <button key={ri}
                      onClick={() => setViewingRound(viewingRound?.roundIdx === ri ? null : { roundIdx: ri })}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '1px 8px', fontSize: '8px', fontWeight: 800, border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', cursor: 'pointer', background: 'rgba(0,0,0,0.3)', color: '#94a3b8' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: rd.status === 'attacker_won' ? atkClr : defClr, display: 'inline-block' }} />
                      R{ri + 1} {rd.status === 'attacker_won' ? '⚔️' : '🛡️'}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px', alignItems: 'flex-end' }}>
                  {completedRounds.map((rd, ri) => (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#94a3b8' }}>
                        🛡️ {(rd.defenderDmgTotal || 0) > 999 ? `${((rd.defenderDmgTotal || 0) / 1000).toFixed(0)}K` : rd.defenderDmgTotal || 0}
                      </span>
                      <CountryFlag iso={battle.defenderId} size={12} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Flags + Score */}
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '9px', color: '#ef4444', fontWeight: 700, fontFamily: "var(--font-display)", letterSpacing: '1px', textShadow: '0 0 8px rgba(239,68,68,0.3)' }}>⚔️ {battle.regionName}</div>
            {(player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battleId) && (
              <div style={{ fontSize: '7px', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px', animation: 'pulse 2s infinite', marginTop: '2px', textShadow: '0 0 8px rgba(245,158,11,0.5)' }}>⭐ HERO MODE</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '2px' }}>
            <CountryFlag iso={battle.attackerId} size={24} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 900, color: atkClr, padding: '3px 10px', border: `2px solid ${atkClr}55`, borderRadius: '5px', background: `${atkClr}10`, minWidth: '28px', textAlign: 'center', textShadow: `0 0 10px ${atkClr}66`, boxShadow: `0 0 12px ${atkClr}15, inset 0 0 8px ${atkClr}08` }}>{battle.attackerRoundsWon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: '#ef4444', fontFamily: 'var(--font-display)', letterSpacing: '1px', textShadow: '0 0 6px rgba(239,68,68,0.3)' }}>
                {fmtElapsed(battle.rounds[battle.rounds.length - 1]?.startedAt || battle.startedAt)}
              </span>
              <span style={{ fontSize: '7px', fontWeight: 700, color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>R{battle.rounds.length}</span>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 900, color: defClr, padding: '3px 10px', border: `2px solid ${defClr}55`, borderRadius: '5px', background: `${defClr}10`, minWidth: '28px', textAlign: 'center', textShadow: `0 0 10px ${defClr}66`, boxShadow: `0 0 12px ${defClr}15, inset 0 0 8px ${defClr}08` }}>{battle.defenderRoundsWon}</span>
            <CountryFlag iso={battle.defenderId} size={24} />
          </div>

          {/* Ground Points — integrated under score */}
          {activeRound && (() => {
            const atkPts = activeRound.attackerPoints
            const defPts = activeRound.defenderPoints
            const maxP = battle.type === 'quick_battle' ? 200 : 300
            const atkFill = Math.min(100, (atkPts / maxP) * 100)
            const defFill = Math.min(100, (defPts / maxP) * 100)
            const ptsDelta = atkPts - defPts
            return (
              <div style={{ marginBottom: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 900, color: atkClr, textShadow: `0 0 6px ${atkClr}44` }}>⛰ {atkPts}/{maxP}</span>
                  <span style={{ fontSize: '7px', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                    GROUND{ptsDelta !== 0 && <span style={{ color: ptsDelta > 0 ? atkClr : defClr, marginLeft: '4px' }}>{ptsDelta > 0 ? '+' : ''}{ptsDelta}</span>}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 900, color: defClr, textShadow: `0 0 6px ${defClr}44` }}>{defPts}/{maxP} ⛰</span>
                </div>
                <div style={{ display: 'flex', gap: '3px', height: '8px' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkFill}%`, background: `linear-gradient(90deg, ${atkClr}66, ${atkClr})`, borderRadius: '4px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${atkClr}33` }} />
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${defFill}%`, background: `linear-gradient(270deg, ${defClr}66, ${defClr})`, borderRadius: '4px', transition: 'width 0.5s ease', boxShadow: `0 0 6px ${defClr}33` }} />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Battle Avatar Animation */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '15px', top: '25px', bottom: '15px', width: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 10, alignItems: 'flex-start', gap: '2px', clipPath: 'inset(0px -50px -50px -50px)' }}>
              {combatTexts.atk.map(dmg => (
                <div key={dmg.id} style={{ fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: 900, color: dmg.color, textShadow: '0 0 2px rgba(0,0,0,0.8)', animation: 'rolling-text-anim 2.5s ease-out forwards', willChange: 'transform, opacity' }}>{dmg.text}</div>
              ))}
            </div>
            <BattleAvatar
              battleId={battleId}
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
              atkDominantType={getDominantType([])}
              defDominantType={getDominantType([])}
              damageRatio={atkPct / 100}
              battleStartedAt={battle.startedAt}
              currentRound={battle.rounds.length}
              terrain={getCountryTerrain(battle.defenderId)}
            />
            <div style={{ position: 'absolute', right: '15px', top: '25px', bottom: '15px', width: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 10, alignItems: 'flex-end', gap: '2px', clipPath: 'inset(0px -50px -50px -50px)' }}>
              {combatTexts.def.map(dmg => (
                <div key={dmg.id} style={{ fontFamily: 'var(--font-display)', fontSize: '8px', fontWeight: 900, color: dmg.color, textShadow: '0 0 2px rgba(0,0,0,0.8)', animation: 'rolling-text-anim 2.5s ease-out forwards', willChange: 'transform, opacity' }}>{dmg.text}</div>
              ))}
            </div>
          </div>

          {/* Battle Ticker */}
          {battle.status === 'active' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', marginTop: '4px', background: 'rgba(239,68,68,0.06)', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.15)', boxShadow: '0 0 10px rgba(239,68,68,0.05)' }}>
              <span style={{ fontSize: '10px', animation: combatTickLeft <= 10 ? 'pulse 0.5s infinite' : 'none' }}>⛰</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: combatTickLeft <= 10 ? '#ef4444' : '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                  <span>GROUND POINTS</span>
                  <span style={{ fontSize: '10px', color: combatTickLeft <= 10 ? '#ef4444' : '#f87171', textShadow: combatTickLeft <= 10 ? '0 0 8px rgba(239,68,68,0.5)' : 'none' }}>{Math.floor(combatTickLeft / 60)}:{String(combatTickLeft % 60).padStart(2, '0')}</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                  <div style={{ width: `${((120 - combatTickLeft) / 120) * 100}%`, height: '100%', background: combatTickLeft <= 10 ? '#ef4444' : 'linear-gradient(90deg, #ef4444, #f87171)', transition: 'width 0.9s linear', borderRadius: '2px', boxShadow: combatTickLeft <= 10 ? '0 0 6px rgba(239,68,68,0.5)' : '0 0 4px rgba(239,68,68,0.3)' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ SECTION 2: Damage Score ══ */}
        <div className="btl-section">
          {/* Damage Percentage Bar */}
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: atkClr, fontFamily: 'var(--font-display)', textShadow: `0 0 8px ${atkClr}44` }}>{atkPct.toFixed(2)}%</span>
              <span style={{ fontSize: '12px', fontWeight: 900, color: defClr, fontFamily: 'var(--font-display)', textShadow: `0 0 8px ${defClr}44` }}>{(100 - atkPct).toFixed(2)}%</span>
            </div>
            <div style={{ position: 'relative', height: '14px', background: 'rgba(0,0,0,0.4)', borderRadius: '7px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: `linear-gradient(90deg, ${atkClr}88, ${atkClr})`, borderRadius: '7px 0 0 7px', transition: 'width 0.5s ease', boxShadow: `0 0 8px ${atkClr}44` }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: `linear-gradient(270deg, ${defClr}88, ${defClr})`, borderRadius: '0 7px 7px 0', transition: 'width 0.5s ease', boxShadow: `0 0 8px ${defClr}44` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: atkClr, fontFamily: 'var(--font-display)' }}>⚔️ {fmtDmg(atkDmg)}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: defClr, fontFamily: 'var(--font-display)' }}>⚔️ {fmtDmg(defDmg)}</span>
            </div>
          </div>

          {/* Weapon Counter-Buff Display */}
          {(() => {
            const COUNTER_TABLE: Record<string, { counter: string; perPlayer: number }> = {
              knife: { counter: 'gun', perPlayer: 0.03 }, gun: { counter: 'rifle', perPlayer: 0.03 },
              rifle: { counter: 'sniper', perPlayer: 0.03 }, sniper: { counter: 'tank', perPlayer: 0.03 },
              tank: { counter: 'rpg', perPlayer: 0.05 }, rpg: { counter: 'sniper', perPlayer: 0.03 },
              jet: { counter: 'warship', perPlayer: 0.05 }, warship: { counter: 'submarine', perPlayer: 0.03 },
              submarine: { counter: 'jet', perPlayer: 0.03 },
            }
            const WPN_EMOJI: Record<string, string> = {
              knife: '🔪', gun: '🔫', rifle: '🎯', sniper: '🔭', tank: '🪖',
              rpg: '💣', jet: '✈️', warship: '🚢', submarine: '🤿',
            }
            const MIN_HITS = 5, MIN_DMG = 3000
            const wp = battle.weaponPresence
            if (!wp) return null

            // Compute per-side buff: "what buffs does THIS side get from enemy weapon usage?"
            const computeSideBuff = (mySide: 'attacker' | 'defender') => {
              const enemySide = mySide === 'attacker' ? 'defender' : 'attacker'
              const enemyPresence = wp[enemySide] || {}
              const currentTick = battle.ticksElapsed || 0
              const buffs: { weapon: string; pct: number }[] = []
              for (const [enemyWeapon, entry] of Object.entries(enemyPresence)) {
                if (!entry || entry.expiryTick <= currentTick) continue
                const rule = COUNTER_TABLE[enemyWeapon]
                if (!rule) continue
                const qualified = Object.values(entry.players).filter(p => p.hitCount >= MIN_HITS && p.totalDamage >= MIN_DMG).length
                if (qualified <= 0) continue
                buffs.push({ weapon: rule.counter, pct: Math.round(rule.perPlayer * qualified * 100) })
              }
              return buffs
            }

            const atkBuffs = computeSideBuff('attacker')
            const defBuffs = computeSideBuff('defender')
            if (atkBuffs.length === 0 && defBuffs.length === 0) return null

            const atkTotal = atkBuffs.reduce((s, b) => s + b.pct, 0)
            const defTotal = defBuffs.reduce((s, b) => s + b.pct, 0)

            return (
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {atkBuffs.length > 0 && (
                  <div style={{ flex: 1, padding: '4px 6px', borderRadius: '4px', background: `${atkClr}0a`, border: `1px solid ${atkClr}30`, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ fontSize: '7px', fontWeight: 900, color: atkClr, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', marginBottom: '2px' }}>
                      🎯 COUNTER +{atkTotal}%
                    </div>
                    {atkBuffs.map(b => (
                      <div key={b.weapon} style={{ fontSize: '8px', color: '#94a3b8' }}>
                        {WPN_EMOJI[b.weapon] || '⚔'} {b.weapon.toUpperCase()} +{b.pct}%
                      </div>
                    ))}
                  </div>
                )}
                {defBuffs.length > 0 && (
                  <div style={{ flex: 1, padding: '4px 6px', borderRadius: '4px', background: `${defClr}0a`, border: `1px solid ${defClr}30`, position: 'relative', overflow: 'hidden', textAlign: 'right' }}>
                    <div style={{ fontSize: '7px', fontWeight: 900, color: defClr, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', marginBottom: '2px' }}>
                      🎯 COUNTER +{defTotal}%
                    </div>
                    {defBuffs.map(b => (
                      <div key={b.weapon} style={{ fontSize: '8px', color: '#94a3b8' }}>
                        {WPN_EMOJI[b.weapon] || '⚔'} {b.weapon.toUpperCase()} +{b.pct}%
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Mercenary Contract Banners */}
          {(() => {
            const contracts = (battle.mercenaryContracts || []).filter(c => c.remaining > 0)
            if (contracts.length === 0) return null
            return (
              <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                {contracts.map(c => {
                  const pct = Math.round((c.remaining / c.totalPool) * 100)
                  const sideColor = c.side === 'attacker' ? atkClr : defClr
                  return (
                    <div key={c.id} style={{ flex: 1, padding: '4px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(245,158,11,0.06)' }} />
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', fontWeight: 900, marginBottom: '1px' }}>
                          <span style={{ color: '#f59e0b' }}>💰 MERC</span>
                          <span style={{ color: sideColor }}>{c.side === 'attacker' ? '⚔️ ATK' : '🛡️ DEF'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                          <span style={{ fontWeight: 900, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>{c.ratePerDamage}/1K</span>
                          <span style={{ fontSize: '8px', color: pct > 30 ? '#94a3b8' : '#ef4444', fontFamily: 'var(--font-mono)' }}>{c.remaining.toLocaleString()} ({pct}%)</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* ══ SECTION 3: Hit Buttons, Tactical Order, Adrenaline/Surge ══ */}
        <div className="btl-section">
          {/* Hit Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {/* Support Attacker */}
            <button disabled={player.stamina < staCost || battle.status !== 'active'}
              onClick={(e) => { e.stopPropagation(); handleHit('attacker', 'atk', atkClr) }}
              style={{
                padding: '10px 4px 6px', borderRadius: '8px', cursor: battle.status !== 'active' ? 'not-allowed' : 'pointer',
                background: `linear-gradient(180deg, ${atkClr}30 0%, ${atkClr}10 100%)`,
                border: `2px solid ${atkClr}55`, color: atkClr,
                fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900,
                letterSpacing: '1px',
                position: 'relative',
                boxShadow: `0 0 16px ${atkClr}12, inset 0 0 12px ${atkClr}06`,
                transition: 'all 0.15s',
                opacity: battle.status !== 'active' ? 0.4 : 1,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '3px' }}>
                <CountryFlag iso={battle.attackerId} size={18} />
              </div>
              <div style={{ textShadow: `0 0 8px ${atkClr}66`, fontSize: '11px' }}>SUPPORT</div>
              <div style={{ fontSize: '8px', fontWeight: 700, color: `${atkClr}cc`, marginTop: '1px' }}>{getCountryName(battle.attackerId)}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '9px', fontWeight: 700, marginTop: '4px' }}>
                {atkSupportCost > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444' }}>
                  <img src="/assets/items/icon_oil.png" alt="oil" style={{ width: '12px', height: '12px' }} />
                  {atkSupportCost}
                </span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#22d38a' }}>
                  ❤️ {staCost}
                </span>
              </div>
            </button>
            {/* Support Defender */}
            <button disabled={player.stamina < staCost || battle.status !== 'active'}
              onClick={(e) => { e.stopPropagation(); handleHit('defender', 'def', defClr) }}
              style={{
                padding: '10px 4px 6px', borderRadius: '8px', cursor: battle.status !== 'active' ? 'not-allowed' : 'pointer',
                background: `linear-gradient(180deg, ${defClr}30 0%, ${defClr}10 100%)`,
                border: `2px solid ${defClr}55`, color: defClr,
                fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 900,
                letterSpacing: '1px',
                position: 'relative',
                boxShadow: `0 0 16px ${defClr}12, inset 0 0 12px ${defClr}06`,
                transition: 'all 0.15s',
                opacity: battle.status !== 'active' ? 0.4 : 1,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '3px' }}>
                <CountryFlag iso={battle.defenderId} size={18} />
              </div>
              <div style={{ textShadow: `0 0 8px ${defClr}66`, fontSize: '11px' }}>SUPPORT</div>
              <div style={{ fontSize: '8px', fontWeight: 700, color: `${defClr}cc`, marginTop: '1px' }}>{getCountryName(battle.defenderId)}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '9px', fontWeight: 700, marginTop: '4px' }}>
                {defSupportCost > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444' }}>
                  <img src="/assets/items/icon_oil.png" alt="oil" style={{ width: '12px', height: '12px' }} />
                  {defSupportCost}
                </span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#22d38a' }}>
                  ❤️ {staCost}
                </span>
              </div>
            </button>
          </div>

          {/* Mission / Order Message */}
          {battle.orderMessage && (
            <div style={{ marginTop: '4px', padding: '3px 6px', fontSize: '8px', color: '#60a5fa', background: 'rgba(96,165,250,0.06)', borderRadius: '3px', borderLeft: '2px solid #60a5fa', fontWeight: 600 }}>
              ⭐ Misión: {battle.orderMessage}
            </div>
          )}

          {/* Tactical Orders */}
          <div style={{ display: 'flex', gap: '3px', marginTop: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '7px', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '0.5px', flexShrink: 0 }}>ORDER:</span>
            {(Object.entries(TACTICAL_ORDERS) as [TacticalOrder, typeof TACTICAL_ORDERS[TacticalOrder]][]).filter(([k]) => k !== 'none').map(([key, ord]) => {
              const isActive = activeOrder === key
              return (
                <button key={key}
                  onClick={(e) => { e.stopPropagation(); battleStore.setBattleOrder(battleId, mySide, isActive ? 'none' as TacticalOrder : key) }}
                  title={ord.desc}
                  style={{
                    flex: 1, padding: '3px 2px', borderRadius: '3px', cursor: 'pointer',
                    background: isActive ? `${ord.color}25` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? `${ord.color}66` : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? ord.color : '#64748b',
                    fontSize: '7px', fontWeight: 900, fontFamily: 'var(--font-display)',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? `0 0 8px ${ord.color}22` : 'none',
                  }}>
                  {ord.label}
                </button>
              )
            })}
          </div>

          {/* Adrenaline Bar + Surge */}
          <div style={{ margin: '4px 0', position: 'relative' }}>
            <div style={{
              height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px',
              overflow: 'hidden', border: `1px solid ${isPeak ? 'rgba(251,191,36,0.5)' : isHot ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <div style={{
                width: `${adr}%`, height: '100%',
                background: isCrashed ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : isSurging ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                  : isPeak ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                  : isHot ? 'linear-gradient(90deg, #3b82f6, #f59e0b)'
                  : 'linear-gradient(90deg, #1e3a5f, #3b82f6)',
                borderRadius: '4px', transition: 'width 0.3s ease',
                animation: isPeak ? 'adrenaline-pulse 0.6s infinite' : isHot ? 'adrenaline-pulse 1.2s infinite' : 'none',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
              <span style={{ fontSize: '7px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', color: isCrashed ? '#ef4444' : isSurging ? '#fbbf24' : isHot ? '#f59e0b' : '#64748b', textShadow: isSurging ? '0 0 6px rgba(251,191,36,0.4)' : isCrashed ? '0 0 6px rgba(239,68,68,0.4)' : 'none' }}>
                {isCrashed ? '💥 CRASHED -20%' : isSurging ? `⚡ SURGE ACTIVE` : `ADRENALINE ${adr}`}
              </span>
              {canSurge && (
                <button onClick={(e) => { e.stopPropagation(); battleStore.activateSurge(battleId) }}
                  style={{
                    padding: '2px 10px', border: '1px solid rgba(245,158,11,0.6)', borderRadius: '3px',
                    cursor: 'pointer', fontSize: '8px', fontWeight: 900, fontFamily: 'var(--font-display)',
                    color: '#0a0a0a', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    animation: 'adrenaline-pulse 0.8s infinite', boxShadow: '0 0 12px rgba(245,158,11,0.4)',
                  }}>
                  ⚡ SURGE {synergyLabel[activeOrder] || '+40% DMG'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ══ SECTION 4: Stats, Food, Equip Best, Remove All ══ */}
        <div className="btl-section">
          {/* Stats row — all 7 combat stats (with tactical order adjustments) */}
          {(() => {
            const orderKey = activeOrder || 'none'
            const oFx = TACTICAL_ORDERS[orderKey].effects
            const oClr = TACTICAL_ORDERS[orderKey].color

            // Compute order-adjusted stats
            const adjDmg = Math.floor(cs.attackDamage * oFx.atkMult)
            const adjCrit = cs.critRate + oFx.critBonus
            const adjHit = Math.min(100, cs.hitRate + (oFx.hitBonus * 100))
            const adjArm = Math.floor(cs.armorBlock * oFx.armorMult)
            const adjEva = +(cs.dodgeChance * oFx.dodgeMult).toFixed(1)

            const hasOrder = orderKey !== 'none'
            const dmgBoosted = oFx.atkMult !== 1
            const critBoosted = oFx.critBonus !== 0
            const critDmgBoosted = (oFx.critDmgMult || 1) !== 1
            const hitBoosted = oFx.hitBonus !== 0
            const armBoosted = oFx.armorMult !== 1
            const evaBoosted = oFx.dodgeMult !== 1

            const adjCritDmg = cs.critMultiplier * (oFx.critDmgMult || 1)

            const stats = [
              { label: 'DMG', val: `${adjDmg}`, color: dmgBoosted ? oClr : '#f87171', boosted: dmgBoosted, bonus: dmgBoosted ? `+${Math.round((oFx.atkMult - 1) * 100)}%` : '' },
              { label: 'CRIT', val: `${adjCrit}%`, color: critBoosted ? oClr : '#fb923c', boosted: critBoosted, bonus: critBoosted ? `+${oFx.critBonus}` : '' },
              { label: 'CDMG', val: `${adjCritDmg.toFixed(1)}x`, color: critDmgBoosted ? oClr : '#fbbf24', boosted: critDmgBoosted, bonus: critDmgBoosted ? `+${Math.round(((oFx.critDmgMult || 1) - 1) * 100)}%` : '' },
              { label: 'ARM', val: `${adjArm}`, color: armBoosted ? oClr : '#94a3b8', boosted: armBoosted, bonus: armBoosted ? `+${Math.round((oFx.armorMult - 1) * 100)}%` : '' },
              { label: 'EVA', val: `${adjEva}%`, color: evaBoosted ? oClr : '#34d399', boosted: evaBoosted, bonus: evaBoosted ? `+${Math.round((oFx.dodgeMult - 1) * 100)}%` : '' },
              { label: 'ACC', val: `${adjHit}%`, color: hitBoosted ? oClr : '#38bdf8', boosted: hitBoosted, bonus: hitBoosted ? `+${Math.round(oFx.hitBonus * 100)}%` : '' },
              { label: 'OVER', val: `+${cs.overflowCrit.toFixed(0)}%`, color: '#c084fc', boosted: false, bonus: '' },
            ]

            return (
              <div className="btl-stats-row" style={{ marginBottom: '4px' }}>
                {stats.map(s => (
                  <div key={s.label} className="btl-stat" style={s.boosted ? { position: 'relative', background: `${oClr}12`, borderRadius: '3px', boxShadow: `0 0 6px ${oClr}15` } : undefined}>
                    <span className="btl-stat__icon">{getStatIcon(s.label, s.color, 11)}</span>
                    <span className="btl-stat__val" style={{ color: s.color, textShadow: s.boosted ? `0 0 6px ${oClr}44` : 'none' }}>{s.val}</span>
                    {s.boosted && <span style={{ position: 'absolute', top: '-1px', right: '-1px', fontSize: '5px', fontWeight: 900, color: oClr, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.bonus}</span>}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Action buttons */}
          <div className="btl-actions-row">
            <button className="btl-action-btn" onClick={(e) => { e.stopPropagation(); setShowFood(f => !f) }} title="Food">
              🍞 Food
            </button>
            <button className="btl-action-btn btl-action-btn--equip" onClick={(e) => { e.stopPropagation(); equipBest() }} title="Equip Best">
              ⚡ Best
            </button>
            <button className="btl-action-btn btl-action-btn--remove" onClick={(e) => { e.stopPropagation(); removeAllEquip() }} title="Remove All">
              ✕ Strip
            </button>
          </div>

          {/* Food dropdown */}
          {showFood && (
            <div className="btl-food-dropdown">
              {[
                { key: 'bread', icon: '🍞', count: player.bread, sta: '15%', heal: 1 },
                { key: 'sushi', icon: '🍣', count: player.sushi, sta: '30%', heal: 2 },
                { key: 'wagyu', icon: '🥩', count: player.wagyu, sta: '45%', heal: 3 },
              ].map(f => (
                <button key={f.key} className="btl-food-btn" disabled={f.count <= 0}
                  onClick={() => {
                    player.consumeFood(f.key as 'bread' | 'sushi' | 'wagyu')
                  }}>
                  <div style={{ fontSize: '14px' }}>{f.icon}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0' }}>{f.count}</div>
                  <div style={{ fontSize: '7px', color: '#ef4444' }}>+{f.sta} STA</div>
                  <div style={{ fontSize: '7px', color: '#3b82f6' }}>+{f.heal}% HP</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ══ SECTION 5: Equipment Grid ══ */}
        <div className="btl-section">
          <div className="btl-equip-grid">
            {equipSlots.map(({ slot, label }) => {
              if (slot === 'ammo') {
                const ammo = player.equippedAmmo
                const ac: Record<string, string> = { none: '#475569', green: '#10b981', blue: '#3b82f6', purple: '#a855f7', red: '#ef4444' }
                const clr = ac[ammo] || '#475569'
                return (
                  <div key="ammo" className="btl-equip-slot" style={{ cursor: 'pointer', outline: pickSlot === 'ammo' ? '1px solid #f59e0b' : 'none' }} onClick={(e) => { e.stopPropagation(); setPickSlot(pickSlot === 'ammo' ? null : 'ammo') }}>
                    <div className="btl-equip-slot__label">{label}</div>
                    {ammo !== 'none' ? (
                      <img className="btl-equip-slot__img" src={`/assets/items/ammo_${ammo}.png`} alt={ammo} style={{ filter: `drop-shadow(0 0 4px ${clr}44)` }} onError={e => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', opacity: 0.2 }}>🔫</div>
                    )}
                    <div className="btl-equip-slot__tier" style={{ color: clr }}>{ammo !== 'none' ? ammo.toUpperCase() : '—'}</div>
                  </div>
                )
              }

              const item = equipped.find(i => i.slot === slot)
              if (!item) {
                return (
                  <div key={slot} className="btl-equip-slot" style={{ opacity: 0.4, cursor: 'pointer', outline: pickSlot === slot ? '1px solid #f59e0b' : 'none' }} onClick={(e) => { e.stopPropagation(); setPickSlot(pickSlot === slot ? null : slot) }}>
                    <div className="btl-equip-slot__label">{label}</div>
                    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', opacity: 0.25 }}>+</div>
                    <div className="btl-equip-slot__tier">—</div>
                  </div>
                )
              }

              const tc = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
              const img = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
              const dur = Number(item.durability ?? 100)
              const durColor = dur < 30 ? '#ef4444' : dur < 60 ? '#f59e0b' : '#22d38a'

              return (
                <div key={slot} className="btl-equip-slot" style={{ cursor: 'pointer', outline: pickSlot === slot ? '1px solid #f59e0b' : 'none' }} onClick={(e) => { e.stopPropagation(); setPickSlot(pickSlot === slot ? null : slot) }}>
                  <div className="btl-equip-slot__label">{label}</div>
                  {img ? (
                    <img className="btl-equip-slot__img" src={img} alt={item.name}
                      style={{ filter: `drop-shadow(0 1px 3px ${tc}40)` }}
                      onError={e => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <div style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: tc }}>⚔</div>
                  )}
                  <div className="btl-equip-slot__dur">
                    <div className="btl-equip-slot__dur-fill" style={{ width: `${dur}%`, background: durColor }} />
                  </div>
                  <div className="btl-equip-slot__tier" style={{ color: tc }}>{item.tier?.toUpperCase()}</div>
                </div>
              )
            })}
          </div>

          {/* ── Item Picker Dropdown ── */}
          {pickSlot && (() => {
            if (pickSlot === 'ammo') {
              const ammoTypes: ('none' | 'green' | 'blue' | 'purple' | 'red')[] = ['none', 'green', 'blue', 'purple', 'red']
              const ac: Record<string, string> = { none: '#475569', green: '#10b981', blue: '#3b82f6', purple: '#a855f7', red: '#ef4444' }
              const countKey: Record<string, string> = { green: 'greenBullets', blue: 'blueBullets', purple: 'purpleBullets', red: 'redBullets' }
              return (
                <div style={{ marginTop: '4px', padding: '4px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '0.5px', marginBottom: '3px', paddingLeft: '4px' }}>SELECT AMMO</div>
                  {ammoTypes.map(t => {
                    const count = t === 'none' ? 0 : ((player as any)[countKey[t]] || 0)
                    const isActive = player.equippedAmmo === t
                    return (
                      <button key={t} onClick={(e) => { e.stopPropagation(); player.equipAmmo(t); setPickSlot(null) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '3px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent', color: ac[t], fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: ac[t], display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{t === 'none' ? 'NONE' : t.toUpperCase()}</span>
                        {t !== 'none' && <span style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>x{count}</span>}
                      </button>
                    )
                  })}
                </div>
              )
            }

            // Gear slot picker
            const candidates = inv.items.filter(i => i.location === 'inventory' && i.slot === pickSlot && Number(i.durability) > 0 && !i.equipped)
            const equippedItem = equipped.find(i => i.slot === pickSlot)
            return (
              <div style={{ marginTop: '4px', padding: '4px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                <div style={{ fontSize: '7px', fontWeight: 800, color: '#64748b', fontFamily: 'var(--font-display)', letterSpacing: '0.5px', marginBottom: '3px', paddingLeft: '4px' }}>SELECT {pickSlot.toUpperCase()}</div>
                {equippedItem && (
                  <button onClick={(e) => { e.stopPropagation(); inv.unequipItem(equippedItem.id); setPickSlot(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '3px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    ✕ UNEQUIP {equippedItem.name}
                  </button>
                )}
                {candidates.length === 0 && !equippedItem && (
                  <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '6px 0' }}>No items for this slot</div>
                )}
                {candidates.map(item => {
                  const tc = TIER_COLORS[item.tier as keyof typeof TIER_COLORS] || '#94a3b8'
                  const img = getItemImagePath(item.tier, item.slot, item.category, item.weaponSubtype, item.superforged)
                  const dur = Number(item.durability ?? 100)
                  const mainStat = item.stats.damage ? `DMG ${item.stats.damage}` : item.stats.armor ? `ARM ${item.stats.armor}` : item.stats.critDamage ? `CDMG ${item.stats.critDamage}` : item.stats.dodge ? `EVA ${item.stats.dodge}` : item.stats.precision ? `ACC ${item.stats.precision}` : ''
                  return (
                    <button key={item.id} onClick={(e) => { e.stopPropagation(); inv.equipItem(item.id); setPickSlot(null) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '3px 6px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'transparent', color: '#e2e8f0', fontSize: '9px', fontWeight: 600, fontFamily: 'var(--font-display)', transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      {img && <img src={img} alt={item.name} style={{ width: '18px', height: '18px', objectFit: 'contain', filter: `drop-shadow(0 0 2px ${tc}44)` }} onError={e => { e.currentTarget.style.display = 'none' }} />}
                      <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                      <span style={{ fontSize: '7px', color: tc, fontWeight: 800 }}>{item.tier?.toUpperCase()}</span>
                      <span style={{ fontSize: '7px', color: '#94a3b8' }}>{mainStat}</span>
                      <span style={{ fontSize: '7px', color: dur < 30 ? '#ef4444' : '#64748b' }}>{dur}%</span>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* ══ SECTION 6: Leaderboard ══ */}
        <div className="btl-section">
          <div className="btl-ladder">
            {/* Defenders / Attackers */}
            {[
              { side: 'attacker' as const, label: `⚔️ ${getCountryName(battle.attackerId).toUpperCase()}`, dealers: battle.attackerDamageDealers, clr: atkClr, totalDmg: battle.attacker.damageDealt },
              { side: 'defender' as const, label: `🛡️ ${getCountryName(battle.defenderId).toUpperCase()}`, dealers: battle.defenderDamageDealers, clr: defClr, totalDmg: battle.defender.damageDealt },
            ].map(({ side, label, dealers, clr, totalDmg: sideDmg }) => {
              const sorted = Object.entries(dealers || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)
              const maxDmg = sorted[0]?.[1] || 1
              return (
                <div key={side} className="btl-ladder__side" style={{ border: `1px solid ${clr}22` }}>
                  <div className="btl-ladder__header" style={{ borderBottom: `1px solid ${clr}22`, color: clr }}>
                    <span>{label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>{(sideDmg || 0).toLocaleString()}</span>
                  </div>
                  <div className="btl-ladder__body">
                    {sorted.length === 0 ? (
                      <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', padding: '8px 0' }}>No damage yet</div>
                    ) : (
                      sorted.map(([name, dmg], i) => {
                        const isMe = name === player.name
                        const pct = (dmg / maxDmg) * 100
                        const medalColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#475569'
                        return (
                          <div key={name} className={`btl-ladder__row ${isMe ? 'btl-ladder__row--me' : ''}`}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1px' }}>
                              <span className="btl-ladder__rank" style={{ color: medalColor }}>#{i + 1}</span>
                              <span className="btl-ladder__name" style={{ fontWeight: isMe ? 800 : 600, color: isMe ? '#fbbf24' : '#e2e8f0' }}>{name}</span>
                              <span className="btl-ladder__dmg" style={{ color: isMe ? '#fbbf24' : '#94a3b8' }}>{dmg.toLocaleString()}</span>
                            </div>
                            <div className="btl-ladder__bar">
                              <div className="btl-ladder__bar-fill" style={{ width: `${pct}%`, background: isMe ? '#f59e0b' : clr }} />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Fund Mercenary Contract — President Only */}
          {(() => {
            const atkGov = govStore.governments[battle.attackerId]
            const defGov = govStore.governments[battle.defenderId]
            const isAtkPresident = atkGov?.president === player.name
            const isDefPresident = defGov?.president === player.name
            if (!isAtkPresident && !isDefPresident) return null
            const activeMerc = mercForm !== null
            const mercSide = isAtkPresident ? 'attacker' as const : 'defender' as const
            return (
              <div style={{ marginTop: '6px', padding: '6px 8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px' }}>
                {!activeMerc ? (
                  <button onClick={() => setMercForm({ side: mercSide })}
                    style={{ width: '100%', padding: '5px', border: '1px dashed rgba(245,158,11,0.4)', borderRadius: '3px', cursor: 'pointer', background: 'transparent', fontSize: '9px', fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                    💰 FUND MERCENARY CONTRACT
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: '8px', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)', marginBottom: '6px' }}>
                      💰 FUND MERCS FOR {mercSide.toUpperCase()} SIDE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '4px' }}>
                      <div>
                        <label style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8' }}>$/1K DMG</label>
                        <input type="number" value={mercRate} onChange={e => setMercRate(Math.max(1, parseInt(e.target.value) || 0))}
                          style={{ width: '100%', padding: '4px 6px', fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', color: '#fbbf24', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '7px', fontWeight: 700, color: '#94a3b8' }}>TOTAL POOL</label>
                        <input type="number" value={mercPool} onChange={e => setMercPool(Math.max(1, parseInt(e.target.value) || 0))}
                          style={{ width: '100%', padding: '4px 6px', fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '3px', color: '#fbbf24', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={async () => {
                        const result = await battleStore.createMercenaryContract(battleId, mercSide, mercRate, mercPool)
                        if (result.message) ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
                        if (result.success) setMercForm(null)
                      }}
                        style={{ flex: 1, padding: '6px', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#0a0a0a', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}>
                        💰 FUND
                      </button>
                      <button onClick={() => setMercForm(null)}
                        style={{ padding: '5px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', cursor: 'pointer', fontSize: '9px', color: '#94a3b8', background: 'transparent' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

      </div>
    </div>
  )
}
