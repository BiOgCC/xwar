import { useState } from 'react'
import { useArmyStore, DIVISION_TEMPLATES } from '../../../stores/army'
import { useBattleStore, getCountryName } from '../../../stores/battleStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useUIStore } from '../../../stores/uiStore'
import { Users, Swords, Shield, Crown, CheckCircle, Skull, TreePine, Plane, Ship, Wrench, CircleDot, XCircle, Brain, Coins, Fuel, Cog, Atom, Bitcoin, Landmark, Zap, Building, Castle, Anchor } from 'lucide-react'
import CountryFlag from '../../shared/CountryFlag'
import { fmtElapsed } from '../warHelpers'
import type { NationalFundKey } from '../../../types/world.types'

export default function AFCountryTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()

  const [fundTransferRes, setFundTransferRes] = useState<NationalFundKey>('money')
  const [fundTransferAmt, setFundTransferAmt] = useState(10000)

  const country = world.getCountry(iso)
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name

  const myDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const activeBattles = Object.values(battleStore.battles).filter(b => b.status === 'active')
  const totalManpower = myDivisions.reduce((s, d) => s + d.manpower, 0)
  const readyDivs = myDivisions.filter(d => d.status === 'ready').length
  const trainingDivs = myDivisions.filter(d => d.status === 'training').length
  const inCombatDivs = myDivisions.filter(d => d.status === 'in_combat').length
  const destroyedDivs = myDivisions.filter(d => d.status === 'destroyed').length

  const popCap = armyStore.getPlayerPopCap()
  const popPct = popCap.max > 0 ? (popCap.used / popCap.max) * 100 : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 60 ? '#f59e0b' : '#3b82f6'

  // Star breakdown
  const starsCount = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  myDivisions.forEach(d => { starsCount[d.starQuality as keyof typeof starsCount]++ })

  // Combat Power
  let totalDpt = 0
  let totalHp = 0
  let totalArmor = 0
  let totalEvasion = 0
  let activeDivCount = 0
  myDivisions.forEach(d => {
    if (d.status === 'ready' || d.status === 'training' || d.status === 'in_combat') {
      const t = DIVISION_TEMPLATES?.[d.type]
      if (t) {
        const effAtk = t.atkDmgMult * (1 + parseFloat(String(d.statModifiers?.atkDmgMult || 0)))
        const effSpeed = (t.attackSpeed || 1.0) * (1 + parseFloat(String(d.statModifiers?.attackSpeed || 0)))
        const baseAtk = 100
        totalDpt += Math.floor((baseAtk + t.manpowerCost * 3) * effAtk * (1 / Math.max(0.2, effSpeed)))
        totalHp += d.maxHealth
        totalArmor += t.armorMult * (1 + parseFloat(String(d.statModifiers?.armorMult || 0)))
        totalEvasion += t.dodgeMult * (1 + parseFloat(String(d.statModifiers?.dodgeMult || 0)))
        activeDivCount++
      }
    }
  })
  const avgDpt = activeDivCount > 0 ? Math.floor(totalDpt / activeDivCount) : 0

  // Top division
  let topDiv = myDivisions[0]
  myDivisions.forEach(d => { if (d.killCount > (topDiv?.killCount || 0)) topDiv = d })

  // Composition
  const comp = { land: 0, air: 0, naval: 0 }
  myDivisions.forEach(d => { if (d.category in comp) comp[d.category as keyof typeof comp]++ })

  // Equipment Status
  const fullyGeared = myDivisions.filter(d => d.equipment?.length === 3).length
  const someGear = myDivisions.filter(d => (d.equipment?.length || 0) > 0 && (d.equipment?.length || 0) < 3).length
  const noGear = myDivisions.filter(d => !d.equipment || d.equipment.length === 0).length

  // Experience
  const avgExp = myDivisions.length > 0 ? Math.floor(myDivisions.reduce((s, d) => s + (d.experience || 0), 0) / myDivisions.length) : 0
  const avgLevel = Math.floor(avgExp / 10) + 1

  // Military Readiness Score
  const healthyPct = myDivisions.length > 0 ? myDivisions.filter(d => d.health >= d.maxHealth * 0.7).length / myDivisions.length : 0
  const gearPct = myDivisions.length > 0 ? fullyGeared / myDivisions.length : 0
  const vetPct = Math.min(1, avgLevel / 10)
  const readiness = Math.floor((healthyPct * 40 + gearPct * 30 + vetPct * 20 + (readyDivs > 0 ? 10 : 0)))
  const readinessColor = readiness >= 75 ? '#22d38a' : readiness >= 40 ? '#f59e0b' : '#ef4444'

  // Force Vault
  const vault = country?.forceVault || { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }

  // All armies in this country
  const countryArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)

  const s = (label: string, value: string | number, color = '#e2e8f0') => (
    <div style={{
      textAlign: 'center', padding: '5px 2px',
      background: 'rgba(255,255,255,0.02)', borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 900, color, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 10px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
        borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CountryFlag iso={iso} size={20} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
              ARMED FORCES — {getCountryName(iso)}
            </div>
            <div style={{ fontSize: '8px', color: '#64748b' }}>Commander: {player.name}</div>
          </div>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '3px 8px', borderRadius: '4px',
          background: `${readinessColor}10`, border: `1px solid ${readinessColor}30`,
        }}>
          <div style={{ fontSize: '14px', fontWeight: 900, color: readinessColor, fontFamily: 'var(--font-display)' }}>{readiness}%</div>
          <div style={{ fontSize: '6px', color: readinessColor, fontWeight: 700, letterSpacing: '0.5px' }}>READINESS</div>
        </div>
      </div>

      {/* ── FORCE OVERVIEW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
        {s('DIVS', myDivisions.length)}
        {s('TROOPS', totalManpower.toLocaleString())}
        {s('READY', readyDivs, '#22d38a')}
        {s('IN COMBAT', inCombatDivs, '#ef4444')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
        {s('AVG DPT', avgDpt.toLocaleString(), '#ef4444')}
        {s('TOTAL HP', totalHp.toLocaleString(), '#3b82f6')}
        {s('ARMOR', totalArmor.toFixed(1), '#f59e0b')}
        {s('EVASION', totalEvasion.toFixed(1), '#22d38a')}
      </div>

      {/* Pop Cap */}
      <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', fontWeight: 800, marginBottom: '2px' }}>
          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Users size={12} color="#94a3b8" /> POP CAP</span>
          <span style={{ color: popColor }}>{popCap.used}/{popCap.max}</span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, popPct)}%`, background: popColor, borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* ── COUNTRY ARMIES ── */}
      <div style={{
        padding: '8px', background: 'rgba(59,130,246,0.04)', borderRadius: '6px',
        border: '1px solid rgba(59,130,246,0.15)',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#3b82f6', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
          <Swords size={14} color="#3b82f6" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> ARMED FORCES ({countryArmies.length})
        </div>
        {countryArmies.length === 0 ? (
          <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '8px' }}>No military forces created yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {countryArmies.map(army => {
              const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
              const readyCount = divs.filter(d => d.status === 'ready').length
              const combatCount = divs.filter(d => d.status === 'in_combat').length
              return (
                <div key={army.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}><Swords size={12} color="#e2e8f0" /> {army.name}</div>
                    <div style={{ fontSize: '8px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Crown size={10} color="#64748b" /> {army.commanderId} • {army.members.length} members • {divs.length} divs
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {readyCount > 0 && <span style={{ fontSize: '8px', fontWeight: 700, color: '#22d38a', background: 'rgba(34,211,138,0.1)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><CheckCircle size={10} /> {readyCount}</span>}
                    {combatCount > 0 && <span style={{ fontSize: '8px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Swords size={10} /> {combatCount}</span>}
                    <span className={`war-army-status war-army-status--${army.status}`} style={{ fontSize: '7px' }}>{army.status.toUpperCase()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── FORCE VAULT ── */}
      <div style={{
        padding: '8px',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(0,0,0,0.2) 100%)',
        borderRadius: '6px', border: '1px solid rgba(245,158,11,0.15)',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
          <Coins size={14} color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> FORCE VAULT
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {([
            ['money', 'Money', vault.money, Coins],
            ['oil', 'Oil', vault.oil, Fuel],
            ['scrap', 'Scrap', vault.scrap, Cog],
            ['matx', 'MatX', vault.materialX, Atom],
            ['btc', 'BTC', vault.bitcoin, Bitcoin],
            ['jets', 'Jets', vault.jets, Plane],
          ] as const).map(([key, label, val, Icon]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px',
            }}>
              <Icon size={14} color="#fbbf24" />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-display)' }}>{Number(val).toLocaleString()}</div>
                <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* President: Transfer controls */}
        {isPresident && (
          <div style={{ marginTop: '6px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '8px', color: '#94a3b8', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}><Landmark size={12} color="#94a3b8" /> FUND FORCES (PRESIDENT)</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <select
                value={fundTransferRes}
                onChange={e => setFundTransferRes(e.target.value as NationalFundKey)}
                style={{
                  padding: '3px 4px', fontSize: '8px', background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#e2e8f0',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {(['money', 'oil', 'scrap', 'materialX', 'bitcoin'] as NationalFundKey[]).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <input
                type="number" value={fundTransferAmt}
                onChange={e => setFundTransferAmt(Number(e.target.value))}
                style={{
                  width: '70px', padding: '3px 4px', fontSize: '8px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '3px', color: '#e2e8f0', fontFamily: 'var(--font-display)',
                }}
              />
              <button
                onClick={() => {
                  const ok = world.transferToForceVault(iso, fundTransferRes, fundTransferAmt)
                  ui.addFloatingText(
                    ok ? `Transferred ${fundTransferAmt.toLocaleString()} ${fundTransferRes} to Force Vault` : 'Insufficient treasury funds!',
                    window.innerWidth / 2, window.innerHeight / 2, ok ? '#22d38a' : '#ef4444'
                  )
                }}
                style={{
                  padding: '3px 8px', fontSize: '8px', fontWeight: 900,
                  fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '3px', color: '#f59e0b', cursor: 'pointer',
                }}
              >
                TRANSFER →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ARMY INTELLIGENCE ── */}
      <div style={{
        padding: '8px',
        background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: '9px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
          <Brain size={14} color="#e2e8f0" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> ARMY INTELLIGENCE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>ELITE FORCES</div>
            <div style={{ display: 'flex', gap: '4px', fontSize: '9px', fontWeight: 700 }}>
              <span style={{ color: '#f59e0b' }}>5★:{starsCount[5]}</span>
              <span style={{ color: '#a855f7' }}>4★:{starsCount[4]}</span>
              <span style={{ color: '#3b82f6' }}>3★:{starsCount[3]}</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>POWER</div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '9px', fontWeight: 700 }}>
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Swords size={12} color="#ef4444" />{totalDpt.toLocaleString()}</span>
              <span style={{ color: '#3b82f6', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Shield size={12} color="#3b82f6" />{totalHp.toLocaleString()}</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>TOP DIVISION</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topDiv ? topDiv.name : 'None'}
            </div>
            <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 700 }}>
              {topDiv ? <><Skull size={12} color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle' }} /> {topDiv.killCount}</> : '-'}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>COMPOSITION</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#cbd5e1' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><TreePine size={10} color="#cbd5e1" />{comp.land}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Plane size={10} color="#cbd5e1" />{comp.air}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Ship size={10} color="#cbd5e1" />{comp.naval}</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>EQUIPMENT</div>
            <div style={{ display: 'flex', gap: '4px', fontSize: '9px', fontWeight: 700 }}>
              <span style={{ color: '#22d38a', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><CheckCircle size={10} />{fullyGeared}</span>
              <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><CircleDot size={10} />{someGear}</span>
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><XCircle size={10} />{noGear}</span>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 800, marginBottom: '2px' }}>VETERANCY</div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0' }}>Lv.{avgLevel}</div>
          </div>
        </div>
      </div>

      {/* ── INFRASTRUCTURE ── */}
      {country && (
        <div style={{
          padding: '8px',
          background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: '9px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
            <Building size={14} color="#e2e8f0" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> INFRASTRUCTURE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            {([
              ['port', 'Port', country.portLevel, Anchor],
              ['airport', 'Airport', country.airportLevel, Plane],
              ['bunker', 'Bunker', country.bunkerLevel, Shield],
              ['milbase', 'Mil. Base', country.militaryBaseLevel, Castle],
            ] as const).map(([key, label, level, Icon]) => (
              <div key={label} style={{
                textAlign: 'center', padding: '5px 2px',
                background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Icon size={16} color={level > 1 ? '#22d38a' : '#64748b'} /></div>
                <div style={{ fontSize: '11px', fontWeight: 900, color: level > 1 ? '#22d38a' : '#64748b', fontFamily: 'var(--font-display)' }}>Lv.{level}</div>
                <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIVE BATTLES ── */}
      {activeBattles.length > 0 && (
        <div style={{
          padding: '8px',
          background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
          border: '1px solid rgba(239,68,68,0.15)',
        }}>
          <div style={{ fontSize: '9px', fontWeight: 900, color: '#ef4444', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
              <Zap size={14} color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> ACTIVE BATTLES ({activeBattles.length})
          </div>
          {activeBattles.map(battle => {
            const atkDmg = battle.attacker?.damageDealt || 0
            const defDmg = battle.defender?.damageDealt || 0
            const totalDmg = atkDmg + defDmg
            const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50
            const activeRound = battle.rounds[battle.rounds.length - 1]
            return (
              <div key={battle.id} style={{
                padding: '5px 8px', marginBottom: '3px',
                background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
                border: '1px solid rgba(239,68,68,0.1)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginBottom: '3px' }}>
                  <span><CountryFlag iso={battle.attackerId} size={12} style={{ marginRight: '3px' }} /> {getCountryName(battle.attackerId)}</span>
                  <span style={{ color: '#64748b', fontSize: '7px' }}>{fmtElapsed(battle.startedAt)} • R{battle.rounds.length}/3</span>
                  <span>{getCountryName(battle.defenderId)} <CountryFlag iso={battle.defenderId} size={12} style={{ marginLeft: '3px' }} /></span>
                </div>
                <div style={{ position: 'relative', height: '10px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${atkPct}%`, background: '#3b82f6', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - atkPct}%`, background: '#ef4444', opacity: 0.8 }} />
                  <span style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '7px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{atkDmg.toLocaleString()}</span>
                  <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontSize: '7px', fontWeight: 700, color: '#fff', zIndex: 3 }}>{defDmg.toLocaleString()}</span>
                </div>
                {activeRound && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: '#94a3b8', marginTop: '2px' }}>
                    <span style={{ color: '#3b82f6' }}>{activeRound.attackerPoints} pts</span>
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
        <div style={{
          padding: '10px', textAlign: 'center',
          background: 'rgba(255,255,255,0.02)', borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: '9px', color: '#475569',
        }}>
          No active battles. Peace reigns... for now.
        </div>
      )}
    </div>
  )
}
