import React, { useState, useEffect, Suspense } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, type DivisionType } from '../../../stores/army'
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
  const armyStore = useArmyStore()
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
  const [scene3DBattle, setScene3DBattle] = useState<{
    atkDivs: { type: DivisionType; name: string; health: number; maxHealth: number }[]
    defDivs: { type: DivisionType; name: string; health: number; maxHealth: number }[]
  } | null>(null)

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

  // Division dominant type
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
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'infantry') as any
  }

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
  const handleHit = (side: 'attacker' | 'defender', sideKey: 'atk' | 'def', sideClr: string) => {
    const r = battleStore.playerAttack(battleId, side)
    if (r.message.includes('Too fast') || r.message.includes('Not enough stamina') || r.message.includes('Not enough oil')) {
      ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
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

        {/* ══ SECTION 1: Battle Scene — Damage carousel, score, animations, ticker ══ */}
        <div className="btl-section btl-section--transparent">
          {/* Round damage summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px' }}>
              {battle.rounds.map((rd, ri) => (
                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                  <CountryFlag iso={battle.attackerId} size={12} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: rd.status === 'active' ? '#e2e8f0' : '#94a3b8' }}>
                    ⚔️ {(rd.attackerDmgTotal || 0) > 999 ? `${((rd.attackerDmgTotal || 0) / 1000).toFixed(0)}K` : rd.attackerDmgTotal || 0}!
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              {battle.rounds.map((rd, ri) => {
                const isActive = rd.status === 'active'
                const won = rd.status === 'attacker_won'
                const dotClr = isActive ? '#ef4444' : won ? atkClr : defClr
                return (
                  <button key={ri}
                    onClick={() => { if (!isActive) setViewingRound(viewingRound?.roundIdx === ri ? null : { roundIdx: ri }) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '1px 8px', fontSize: '8px', fontWeight: 800,
                      border: `1px solid ${isActive ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: '3px', cursor: isActive ? 'default' : 'pointer',
                      background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.3)',
                      color: isActive ? '#e2e8f0' : '#94a3b8',
                    }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotClr, display: 'inline-block', boxShadow: isActive ? `0 0 6px ${dotClr}` : 'none' }} />
                    Round #{ri + 1}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '80px', alignItems: 'flex-end' }}>
              {battle.rounds.map((rd, ri) => (
                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: rd.status === 'active' ? '#e2e8f0' : '#94a3b8' }}>
                    🛡️ {(rd.defenderDmgTotal || 0) > 999 ? `${((rd.defenderDmgTotal || 0) / 1000).toFixed(0)}K` : rd.defenderDmgTotal || 0}!
                  </span>
                  <CountryFlag iso={battle.defenderId} size={12} />
                </div>
              ))}
            </div>
          </div>

          {/* Flags + Score */}
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>⚔️ {battle.regionName}</div>
            {(player.heroBuffTicksLeft > 0 && player.heroBuffBattleId === battleId) && (
              <div style={{ fontSize: '7px', fontWeight: 900, color: '#f59e0b', letterSpacing: '1px', animation: 'pulse 2s infinite', marginTop: '2px' }}>⭐ HERO MODE</div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '4px' }}>
            <CountryFlag iso={battle.attackerId} size={24} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 900, color: atkClr, padding: '2px 8px', border: `2px solid ${atkClr}55`, borderRadius: '4px', background: `${atkClr}10`, minWidth: '28px', textAlign: 'center' }}>{battle.attackerRoundsWon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                {fmtElapsed(battle.rounds[battle.rounds.length - 1]?.startedAt || battle.startedAt)}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 900, color: defClr, padding: '2px 8px', border: `2px solid ${defClr}55`, borderRadius: '4px', background: `${defClr}10`, minWidth: '28px', textAlign: 'center' }}>{battle.defenderRoundsWon}</span>
            <CountryFlag iso={battle.defenderId} size={24} />
          </div>

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
              atkDominantType={getDominantType(battle.attacker.engagedDivisionIds)}
              defDominantType={getDominantType(battle.defender.engagedDivisionIds)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', marginTop: '4px', background: 'rgba(96,165,250,0.06)', borderRadius: '4px', border: '1px solid rgba(96,165,250,0.12)' }}>
              <span style={{ fontSize: '10px', animation: combatTickLeft <= 3 ? 'pulse 0.5s infinite' : 'none' }}>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 700, color: combatTickLeft <= 3 ? '#60a5fa' : '#94a3b8' }}>
                  <span>NEXT TICK</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: combatTickLeft <= 3 ? '#60a5fa' : '#3b82f6' }}>{combatTickLeft}s</span>
                </div>
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                  <div style={{ width: `${((15 - combatTickLeft) / 15) * 100}%`, height: '100%', background: combatTickLeft <= 3 ? '#60a5fa' : '#3b82f6', transition: 'width 0.9s linear', borderRadius: '2px' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ SECTION 2: Damage Score & Battle Points ══ */}
        <div className="btl-section">
          {/* Ground Points */}
          {activeRound && (() => {
            const atkPts = activeRound.attackerPoints
            const defPts = activeRound.defenderPoints
            const maxP = 600
            const atkFill = Math.min(100, (atkPts / maxP) * 100)
            const defFill = Math.min(100, (defPts / maxP) * 100)
            const ptsDelta = atkPts - defPts
            return (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px' }}>⛰</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 900, color: atkClr }}>{atkPts}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
                      {fmtElapsed(activeRound.startedAt || battle.startedAt)}
                    </span>
                    {ptsDelta !== 0 && (
                      <span style={{ fontSize: '8px', fontWeight: 700, color: ptsDelta > 0 ? atkClr : defClr, fontFamily: 'var(--font-mono)' }}>
                        ⛰ {ptsDelta > 0 ? '+' : ''}{ptsDelta}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 900, color: defClr }}>{defPts}</span>
                    <span style={{ fontSize: '11px' }}>⛰</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '3px', height: '10px' }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkFill}%`, background: `linear-gradient(90deg, ${atkClr}66, ${atkClr})`, borderRadius: '5px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${defFill}%`, background: `linear-gradient(270deg, ${defClr}66, ${defClr})`, borderRadius: '5px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Damage Percentage Bar */}
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: atkClr, fontFamily: 'var(--font-mono)' }}>{atkPct.toFixed(2)}%</span>
              <span style={{ fontSize: '12px', fontWeight: 900, color: defClr, fontFamily: 'var(--font-mono)' }}>{(100 - atkPct).toFixed(2)}%</span>
            </div>
            <div style={{ position: 'relative', height: '14px', background: 'rgba(0,0,0,0.4)', borderRadius: '7px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: `linear-gradient(90deg, ${atkClr}88, ${atkClr})`, borderRadius: '7px 0 0 7px', transition: 'width 0.5s ease' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: `linear-gradient(270deg, ${defClr}88, ${defClr})`, borderRadius: '0 7px 7px 0', transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: atkClr, fontFamily: 'var(--font-mono)' }}>⚔️ {fmtDmg(atkDmg)}</span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: defClr, fontFamily: 'var(--font-mono)' }}>⚔️ {fmtDmg(defDmg)}</span>
            </div>
          </div>

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
            {/* Attacker Hit */}
            <button disabled={player.stamina < staCost}
              onClick={(e) => { e.stopPropagation(); handleHit('attacker', 'atk', atkClr) }}
              style={{
                padding: '10px 4px 6px', borderRadius: '8px', cursor: 'pointer',
                background: `linear-gradient(180deg, ${atkClr}30 0%, ${atkClr}10 100%)`,
                border: `2px solid ${atkClr}55`, color: atkClr,
                fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 900,
                letterSpacing: '1px',
                position: 'relative',
              }}>
              <div style={{ fontSize: '16px', marginBottom: '2px' }}>🛡️</div>
              <div>DEFEND</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '9px', fontWeight: 700, marginTop: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444' }}>
                  <img src="/assets/items/icon_oil.png" alt="oil" style={{ width: '12px', height: '12px' }} />
                  {atkSupportCost}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#22d38a' }}>
                  ❤️ {staCost}
                </span>
              </div>
            </button>
            {/* Defender Hit */}
            <button disabled={player.stamina < staCost}
              onClick={(e) => { e.stopPropagation(); handleHit('defender', 'def', defClr) }}
              style={{
                padding: '10px 4px 6px', borderRadius: '8px', cursor: 'pointer',
                background: `linear-gradient(180deg, ${defClr}30 0%, ${defClr}10 100%)`,
                border: `2px solid ${defClr}55`, color: defClr,
                fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 900,
                letterSpacing: '1px',
                position: 'relative',
              }}>
              <div style={{ fontSize: '16px', marginBottom: '2px' }}>⚔️</div>
              <div>RESIST</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '9px', fontWeight: 700, marginTop: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#ef4444' }}>
                  <img src="/assets/items/icon_oil.png" alt="oil" style={{ width: '12px', height: '12px' }} />
                  {defSupportCost}
                </span>
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
                <button key={key} disabled={!isPresident}
                  onClick={(e) => { e.stopPropagation(); battleStore.setBattleOrder(battleId, mySide, isActive ? 'none' as TacticalOrder : key) }}
                  title={ord.desc}
                  style={{
                    flex: 1, padding: '3px 2px', borderRadius: '3px', cursor: isPresident ? 'pointer' : 'default',
                    background: isActive ? `${ord.color}25` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? `${ord.color}66` : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? ord.color : '#64748b',
                    fontSize: '7px', fontWeight: 900, fontFamily: 'var(--font-display)',
                    transition: 'all 0.15s', opacity: isPresident ? 1 : 0.5,
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
              <span style={{ fontSize: '7px', fontWeight: 800, fontFamily: 'var(--font-display)', color: isCrashed ? '#ef4444' : isSurging ? '#fbbf24' : isHot ? '#f59e0b' : '#64748b' }}>
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
          {/* Stats row */}
          <div className="btl-stats-row" style={{ marginBottom: '4px' }}>
            {[
              { icon: '⚔', label: 'DMG', val: `${cs.attackDamage}`, color: '#f87171' },
              { icon: '💥', label: 'CRIT', val: `${cs.critRate}%`, color: '#fb923c' },
              { icon: '🛡', label: 'ARM', val: `${cs.armorBlock}%`, color: '#94a3b8' },
              { icon: '⚡', label: 'EVA', val: `${cs.dodgeChance}%`, color: '#34d399' },
              { icon: '💫', label: 'ACC', val: `${cs.hitRate}%`, color: '#38bdf8' },
            ].map(s => (
              <div key={s.label} className="btl-stat">
                <span className="btl-stat__icon">{s.icon}</span>
                <span className="btl-stat__val" style={{ color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="btl-actions-row">
            <button className="btl-action-btn" onClick={() => setShowFood(f => !f)} title="Food">
              🍞 Food
            </button>
            <button className="btl-action-btn btl-action-btn--equip" onClick={equipBest} title="Equip Best">
              ⚡ Best
            </button>
            <button className="btl-action-btn btl-action-btn--remove" onClick={removeAllEquip} title="Remove All">
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
                    const result = armyStore.healDivisionsWithFood(f.key as 'bread' | 'sushi' | 'wagyu')
                    if (result.success) console.log(result.message)
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
                  <div key="ammo" className="btl-equip-slot">
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
                  <div key={slot} className="btl-equip-slot" style={{ opacity: 0.4 }}>
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
                <div key={slot} className="btl-equip-slot">
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
                      <button onClick={() => {
                        const result = battleStore.createMercenaryContract(battleId, mercSide, mercRate, mercPool)
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
