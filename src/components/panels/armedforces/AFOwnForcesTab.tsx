import { useState } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, getDivisionEquipBonus, WEAPON_DIVISION_MAP, type DivisionType } from '../../../stores/army'
import { useBattleStore, getBaseSkillStats } from '../../../stores/battleStore'
import { usePlayerStore, getMilitaryRank } from '../../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'
import { useInventoryStore, TIER_COLORS, type WeaponSubtype, type EquipItem } from '../../../stores/inventoryStore'
import { getCountryDistance, getAttackOilCost } from '../../../utils/geography'
import { Swords, Shield, Skull, TreePine, Plane, Ship, CheckCircle, CircleDot, XCircle, Brain, Coins, Fuel, FlaskConical, Crosshair as GunIcon, Flag, Target, Users, Plus, Package, Wrench, Wheat, Gift, ArrowUpRight, Trash2, ChevronUp, ChevronDown, Wind, Zap } from 'lucide-react'
import CountryFlag from '../../shared/CountryFlag'
import { RANK_ICONS } from '../warHelpers'

export default function AFOwnForcesTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const ui = useUIStore()
  const inventory = useInventoryStore()

  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [weaponPickerDivId, setWeaponPickerDivId] = useState<string | null>(null)
  const [showDonateForArmy, setShowDonateForArmy] = useState<string | null>(null)
  const [showDistribute, setShowDistribute] = useState<string | null>(null)
  const [distResource, setDistResource] = useState<'money' | 'oil' | 'materialX'>('money')
  const [distAmount, setDistAmount] = useState(10000)
  const [newArmyName, setNewArmyName] = useState('')

  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = myArmies.find(a => a.members.some(m => m.playerId === player.name))
  const myDivisionIds = currentArmy ? new Set(currentArmy.divisionIds) : new Set<string>()
  const allDivisions = Object.values(armyStore.divisions).filter(d => d.ownerId === player.name || myDivisionIds.has(d.id))
  const unassignedDivs = allDivisions.filter(d => !myArmies.some(a => a.divisionIds.includes(d.id)))
  const adjacentCountries = ADJACENCY_MAP[iso] || []
  const myRank = getMilitaryRank(player.level)

  const handleLaunchAttack = (armyId: string, targetCode: string) => {
    const result = battleStore.launchHOIBattle(armyId, targetCode)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    const armyId = armyStore.createArmy(newArmyName.trim(), iso)
    setFeedback(armyId ? `Force created (${armyId.slice(0, 8)}…)` : 'Failed to create force')
    setNewArmyName('')
    setTimeout(() => setFeedback(''), 3000)
  }

  // Compute current army's AV for the top section
  const currentArmyAV = currentArmy ? armyStore.getArmyAV(currentArmy.id) : null

  // ── Player-scoped stats (matching Country AF) ──
  const totalManpower = allDivisions.reduce((s, d) => s + d.manpower, 0)
  const readyDivs = allDivisions.filter(d => d.status === 'ready').length
  const inCombatDivs = allDivisions.filter(d => d.status === 'in_combat').length

  const popCap = armyStore.getPlayerPopCap()
  const popPct = popCap.max > 0 ? (popCap.used / popCap.max) * 100 : 0
  const popColor = popPct >= 90 ? '#ef4444' : popPct >= 60 ? '#f59e0b' : '#3b82f6'

  // Combat Power
  let totalDpt = 0, totalHp = 0, totalArmor = 0, totalEvasion = 0, activeDivCount = 0
  allDivisions.forEach(d => {
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

  // Star breakdown
  const starsCount = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  allDivisions.forEach(d => { starsCount[d.starQuality as keyof typeof starsCount]++ })

  // Composition
  const comp = { land: 0, air: 0, naval: 0 }
  allDivisions.forEach(d => { if (d.category in comp) comp[d.category as keyof typeof comp]++ })

  // Equipment Status
  const fullyGeared = allDivisions.filter(d => d.equipment?.length === 3).length
  const someGear = allDivisions.filter(d => (d.equipment?.length || 0) > 0 && (d.equipment?.length || 0) < 3).length
  const noGear = allDivisions.filter(d => !d.equipment || d.equipment.length === 0).length

  // Experience
  const avgExp = allDivisions.length > 0 ? Math.floor(allDivisions.reduce((s, d) => s + (d.experience || 0), 0) / allDivisions.length) : 0
  const avgLevel = Math.floor(avgExp / 10) + 1

  // Top division
  let topDiv = allDivisions[0]
  allDivisions.forEach(d => { if (d.killCount > (topDiv?.killCount || 0)) topDiv = d })

  // Military Readiness
  const healthyPct = allDivisions.length > 0 ? allDivisions.filter(d => d.health >= d.maxHealth * 0.7).length / allDivisions.length : 0
  const gearPct = allDivisions.length > 0 ? fullyGeared / allDivisions.length : 0
  const vetPct = Math.min(1, avgLevel / 10)
  const readiness = Math.floor((healthyPct * 40 + gearPct * 30 + vetPct * 20 + (readyDivs > 0 ? 10 : 0)))
  const readinessColor = readiness >= 75 ? '#22d38a' : readiness >= 40 ? '#f59e0b' : '#ef4444'

  const s = (label: string, value: string | number, color = '#e2e8f0') => (
    <div style={{ textAlign: 'center', padding: '5px 2px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: '14px', fontWeight: 900, color, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )

  return (
    <div className="war-forces" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Cannot') || feedback.includes('No ready') || feedback.includes('Already') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* ── PLAYER HEADER ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 10px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
        borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', display: 'flex' }}><Shield size={22} color="#22d38a" /></span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
              {myRank.label.toUpperCase()}
            </div>
            <div style={{ fontSize: '8px', color: '#64748b' }}>Level {player.level}</div>
          </div>
        </div>
        {currentArmy ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}><CheckCircle size={12} color="#3b82f6" /> {currentArmy.name}</div>
            <div style={{ fontSize: '7px', color: '#64748b' }}>{currentArmy.members.length} members</div>
          </div>
        ) : (
          <div style={{ fontSize: '8px', color: '#f59e0b' }}>Not enlisted</div>
        )}
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
        {s('DIVS', allDivisions.length)}
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
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}><Users size={12} color="#94a3b8" /> POP CAP</span>
          <span style={{ color: popColor }}>{popCap.used}/{popCap.max}</span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, popPct)}%`, background: popColor, borderRadius: '3px', transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* ── CREATE MILITARY FORCE ── */}
      <div className="war-card">
        <div className="war-card__title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Plus size={14} color="#22d38a" /> CREATE MILITARY FORCE</div>
        <div className="war-create-army">
          <input className="war-input" placeholder="Force name..." value={newArmyName} onChange={e => setNewArmyName(e.target.value)} />
          <button className="war-btn war-btn--primary" onClick={handleCreateArmy}>CREATE</button>
        </div>
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




      {/* ═══════ SECTION 2: INVENTORY / VAULT ═══════ */}
      {currentArmy && (() => {
        const vaultItems = inventory.items.filter(i => i.location === 'vault' && i.vaultArmyId === currentArmy.id)
        return (
          <div style={{
            padding: '8px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(0,0,0,0.2) 100%)',
            borderRadius: '6px', border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
              <Coins size={14} color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> FORCE VAULT — {currentArmy.name}
            </div>
            {/* Vault Resources */}
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '6px' }}>
              {[
                { icon: <Coins size={12} color="#22d38a" />, val: currentArmy.vault.money, label: 'Money' },
                { icon: <Fuel size={12} color="#22d38a" />, val: currentArmy.vault.oil, label: 'Oil' },
                { icon: <FlaskConical size={12} color="#22d38a" />, val: currentArmy.vault.materialX || 0, label: 'MatX' },
                { icon: <GunIcon size={12} color="#22d38a" />, val: currentArmy.vault.ammo, label: 'Ammo' },
                { icon: <Plane size={12} color="#22d38a" />, val: currentArmy.vault.jets, label: 'Jets' },
                { icon: <Shield size={12} color="#22d38a" />, val: currentArmy.vault.tanks, label: 'Tanks' },
              ].map(r => (
                <div key={r.label} style={{
                  flex: '1 1 50px', textAlign: 'center', padding: '4px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: '3px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ display: 'flex' }}>{r.icon}</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0', marginLeft: '2px' }}>{r.val.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Quick Donate */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '6px' }}>
              {[
                { resource: 'money' as const, amount: 10000, label: '$10K', icon: <Coins size={10} /> },
                { resource: 'money' as const, amount: 50000, label: '$50K', icon: <Coins size={10} /> },
                { resource: 'oil' as const, amount: 100, label: '100', icon: <Fuel size={10} /> },
                { resource: 'materialX' as const, amount: 50, label: '50', icon: <FlaskConical size={10} /> },
              ].map(d => (
                <button key={d.label + d.amount} className="war-btn war-btn--small"
                  style={{ fontSize: '8px', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '2px' }}
                  onClick={() => armyStore.donateToVault(currentArmy.id, d.resource, d.amount)}
                >{d.icon} {d.label}</button>
              ))}
              <button className="war-btn war-btn--small"
                style={{ fontSize: '7px', padding: '2px 5px', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}
                onClick={() => setShowDonateForArmy(currentArmy.id)}
              ><Gift size={10} /> EQUIP</button>
            </div>

            {/* Officer Controls */}
            {(() => {
              const me = currentArmy.members.find(m => m.playerId === player.name)
              const isOfficer = currentArmy.commanderId === player.name || me?.role === 'colonel' || me?.role === 'general'
              if (!isOfficer) return null
              return (
                <div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button className="war-btn war-btn--small"
                      style={{ fontSize: '7px', padding: '2px 5px', color: '#22d38a', borderColor: 'rgba(34,211,138,0.3)', flex: 1 }}
                      onClick={() => setShowDistribute(showDistribute === currentArmy.id ? null : currentArmy.id)}
                    ><ArrowUpRight size={10} /> DISTRIBUTE</button>
                    <button className="war-btn war-btn--small"
                      style={{ fontSize: '7px', padding: '2px 5px', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', flex: 1 }}
                      onClick={() => { setFeedback('Open Market panel → enable "🏦 Army Vault" toggle to trade vault resources'); setTimeout(() => setFeedback(''), 4000) }}
                    >📊 TRADE ON MARKET</button>
                  </div>
                  {showDistribute === currentArmy.id && (
                    <div style={{ marginTop: '4px', padding: '6px', background: 'rgba(34,211,138,0.05)', border: '1px solid rgba(34,211,138,0.15)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '8px', fontWeight: 800, color: '#22d38a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}><ArrowUpRight size={12} color="#22d38a" /> DISTRIBUTE TO {currentArmy.members.length} MEMBERS</div>
                      <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                        <button className={`war-btn war-btn--small ${distResource === 'money' ? 'war-btn--primary' : ''}`}
                          style={{ fontSize: '7px', padding: '2px 5px' }}
                          onClick={() => setDistResource('money')}
                        >Money</button>
                        <button className={`war-btn war-btn--small ${distResource === 'oil' ? 'war-btn--primary' : ''}`}
                          style={{ fontSize: '7px', padding: '2px 5px' }}
                          onClick={() => setDistResource('oil')}
                        >Oil</button>
                        <button className={`war-btn war-btn--small ${distResource === 'materialX' ? 'war-btn--primary' : ''}`}
                          style={{ fontSize: '7px', padding: '2px 5px' }}
                          onClick={() => setDistResource('materialX')}
                        >MatX</button>
                      </div>
                      <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                        {(distResource === 'money' ? [10000, 50000, 100000] : [50, 100, 500]).map(a => (
                          <button key={a}
                            className={`war-btn war-btn--small ${distAmount === a ? 'war-btn--primary' : ''}`}
                            style={{ fontSize: '7px', padding: '2px 5px', flex: 1 }}
                            onClick={() => setDistAmount(a)}
                          >{distResource === 'money' ? `$${a >= 1000 ? `${a / 1000}K` : a}` : `${a}`}</button>
                        ))}
                      </div>
                      <button className="war-btn war-btn--primary" style={{ width: '100%', fontSize: '8px', padding: '4px 0' }}
                        onClick={() => {
                          const r = armyStore.distributeVaultToMembers(currentArmy.id, distResource, distAmount)
                          setFeedback(r.message)
                          setTimeout(() => setFeedback(''), 3000)
                        }}
                      >DISTRIBUTE {distResource === 'money' ? `$${distAmount.toLocaleString()}` : `${distAmount} oil`} TO ALL</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Vault Equipment */}
            {vaultItems.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <div style={{ fontSize: '8px', fontWeight: 800, color: '#a855f7', letterSpacing: '1px', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}><Package size={12} color="#a855f7" /> VAULT EQUIPMENT ({vaultItems.length})</div>
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                  {vaultItems.map(item => {
                    const divs = currentArmy.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
                    return (
                      <div key={item.id} style={{
                        padding: '4px 6px', borderRadius: '4px',
                        background: `${TIER_COLORS[item.tier]}10`,
                        border: `1px solid ${TIER_COLORS[item.tier]}40`,
                        fontSize: '8px', minWidth: '80px',
                      }}>
                        <div style={{ fontWeight: 700, color: TIER_COLORS[item.tier], fontSize: '9px' }}>{item.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '7px' }}>
                          {item.tier.toUpperCase()} • {item.slot} • {Math.floor(item.durability)}%
                        </div>
                        <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                          {divs.filter(d => d.equipment.length < 3 && d.status !== 'destroyed').slice(0, 3).map(d => (
                            <button key={d.id} className="war-btn war-btn--small"
                              style={{ fontSize: '6px', padding: '1px 4px', color: '#3b82f6' }}
                              onClick={() => {
                                const r = armyStore.equipFromVault(currentArmy.id, d.id, item.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#3b82f6' : '#ef4444')
                              }}
                            >→ {d.name.substring(0, 10)}</button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ═══════ SECTION 3: DIVISION CARDS ═══════ */}
      {myArmies.map(army => {
        const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
        const isExpanded = expandedArmy === army.id || (currentArmy?.id === army.id && myArmies.length === 1)
        const readyDivs = divs.filter(d => d.status === 'ready')
        const canAttack = readyDivs.length > 0

        return (
          <div className="war-card war-card--army" key={army.id}>
            <div className="war-army-header" onClick={() => setExpandedArmy(expandedArmy === army.id ? null : army.id)}>
              <div className="war-army-header__left">
                <span className="war-army-header__icon" style={{ display: 'flex' }}><Swords size={16} color="#22d38a" /></span>
                <div>
                  <div className="war-army-header__name">{army.name}</div>
                  <div className="war-army-header__info">{divs.length} divisions • {army.totalManpower.toLocaleString()} troops</div>
                </div>
              </div>
              <div className="war-army-header__right">
                <span className={`war-army-status war-army-status--${army.status}`}>{army.status.toUpperCase()}</span>
                <span className="war-army-expand">{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
              </div>
            </div>

            {isExpanded && (
              <div className="war-army-body">
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.type]
                    const strengthPct = Math.floor((div.health / div.maxHealth) * 100)
                    const divLevel = Math.floor((div.experience || 0) / 10)
                    const ps = getBaseSkillStats()
                    const eq = getDivisionEquipBonus(div)
                    const finalAtk = Math.floor((ps.attackDamage + div.manpower * 3 + eq.bonusAtk) * (template.atkDmgMult + divLevel * 0.01) * (1 + divLevel * 0.10))
                    const finalHit = Math.min(95, Math.floor((template.hitRate + divLevel * 0.01 + eq.bonusHitRate) * 100))
                    const finalCrit = Math.floor((ps.critRate + eq.bonusCritRate) * (template.critRateMult + divLevel * 0.01))
                    const finalDodge = Math.floor((ps.dodgeChance || 5) * template.dodgeMult + eq.bonusDodge)
                    const finalArmor = Math.floor((ps.armorBlock || 0) * template.armorMult + eq.bonusArmor)
                    const finalSpeed = Math.max(0.2, (template.attackSpeed || 1.0) - eq.bonusSpeed)
                    const finalCritDmg = (ps.critMultiplier * (template.critDmgMult + divLevel * 0.01) * 100).toFixed(0)
                    const statusColors: Record<string, string> = {
                      training: '#f59e0b', ready: '#3b82f6', in_combat: '#ef4444', recovering: '#3b82f6', destroyed: '#64748b'
                    }
                    const statusLabels: Record<string, string> = {
                      training: 'TRAINING', ready: 'READY', in_combat: 'COMBAT', recovering: 'RECOVERING', destroyed: 'DESTROYED'
                    }

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '6px 8px', border: div.deployedToPMC ? '1px solid rgba(168,85,247,0.25)' : undefined, background: div.deployedToPMC ? 'rgba(168,85,247,0.04)' : undefined }}>
                        {/* Header: icon, name, level, status, PMC badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={template?.icon} alt="div" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                          <span className="war-div-row__name" style={{ flex: 1 }}>{div.name}</span>
                          {div.deployedToPMC && (
                            <span style={{ fontSize: '7px', fontWeight: 800, color: '#a855f7', background: 'rgba(168,85,247,0.2)', padding: '1px 4px', borderRadius: '2px', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Flag size={8} color="#a855f7" /> LENT</span>
                          )}
                          <span style={{ fontSize: '8px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                            LV{divLevel}
                          </span>
                          <span style={{ fontSize: '7px', fontWeight: 700, color: statusColors[div.status] || '#64748b', background: `${statusColors[div.status] || '#64748b'}15`, padding: '1px 5px', borderRadius: '3px' }}>
                            {div.status === 'training' ? (() => { const left = Math.max(0, Math.ceil((div.readyAt - Date.now()) / 1000)); return `${left}s` })() : (statusLabels[div.status] || div.status.toUpperCase())}
                          </span>
                          <button
                            style={{ marginLeft: '2px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', fontSize: '10px', fontWeight: 900, padding: '1px 5px', cursor: 'pointer', lineHeight: 1 }}
                            title="Recall from battle"
                            onClick={() => {
                              const r = armyStore.recallArmy(army.id)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#3b82f6' : '#ef4444')
                            }}
                          >✕</button>
                        </div>
                        {/* HP bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="war-div-bar" title={`HP: ${strengthPct}%`} style={{ flex: 1, height: '16px' }}>
                            <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%`, transition: 'width 0.8s ease' }} />
                            <span className="war-div-bar__label" style={{ fontSize: '10px', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.8)', letterSpacing: '0.5px' }}>{div.health}/{div.maxHealth} ({strengthPct}%)</span>
                          </div>
                        </div>
                        {/* Stat grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 8px', fontSize: '8px', fontFamily: 'var(--font-mono, monospace)' }}>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Swords size={10} color="#94a3b8" /> ATK <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalAtk}</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Target size={10} color="#94a3b8" /> HIT <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalHit}%</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Zap size={10} color="#94a3b8" /> CRT% <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalCrit}%</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Skull size={10} color="#94a3b8" /> CRTD <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalCritDmg}%</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Wind size={10} color="#94a3b8" /> DGE <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalDodge}%</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Shield size={10} color="#94a3b8" /> ARM <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalArmor}</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Zap size={10} color="#94a3b8" /> SPD <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalSpeed}x</span></span>
                          <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Users size={10} color="#94a3b8" /> Troops <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{div.manpower}</span></span>
                        </div>
                        {/* Equipped Items & Buffs */}
                        {(() => {
                          const equippedItems = div.equipment.map(eqId => useInventoryStore.getState().items.find(i => i.id === eqId)).filter(Boolean) as EquipItem[]
                          const bonus = getDivisionEquipBonus(div)
                          const hasBonus = bonus.bonusAtk > 0 || bonus.bonusCritRate > 0 || bonus.bonusCritDmg > 0 || bonus.bonusArmor > 0 || bonus.bonusDodge > 0 || bonus.bonusHitRate > 0 || bonus.bonusSpeed > 0 || bonus.bonusHP > 0
                          return equippedItems.length > 0 ? (
                            <div style={{ marginTop: '2px', marginBottom: '2px', padding: '4px 6px', background: 'rgba(59,130,246,0.06)', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.12)' }}>
                              <div style={{ fontSize: '7px', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--font-display)', letterSpacing: '0.1em', marginBottom: '3px' }}>EQUIPPED ({equippedItems.length}/3)</div>
                              {equippedItems.map(item => {
                                const tierColor = TIER_COLORS[item.tier] || '#94a3b8'
                                const durPct = Math.floor(item.durability)
                                const durColor = durPct > 60 ? '#22d38a' : durPct > 30 ? '#f59e0b' : '#ef4444'
                                return (
                                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: tierColor, minWidth: '60px' }}>{item.name}</span>
                                    <span style={{ fontSize: '7px', color: '#64748b', background: `${tierColor}15`, padding: '0 3px', borderRadius: '2px', fontWeight: 700 }}>{item.tier.toUpperCase()}</span>
                                    <span style={{ fontSize: '7px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                                      {item.stats.damage ? `⚔️${item.stats.damage}` : ''}
                                      {item.stats.critRate ? ` 💥${item.stats.critRate}%` : ''}
                                      {item.stats.armor ? ` 🛡️${item.stats.armor}` : ''}
                                    </span>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                                      <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.4)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ width: `${durPct}%`, height: '100%', background: durColor, borderRadius: '2px', transition: 'width 0.3s' }} />
                                      </div>
                                      <span style={{ fontSize: '7px', color: durColor, fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: '22px', textAlign: 'right' }}>{durPct}%</span>
                                    </div>
                                  </div>
                                )
                              })}
                              {hasBonus && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '3px', paddingTop: '3px', borderTop: '1px solid rgba(59,130,246,0.1)' }}>
                                  {bonus.bonusAtk > 0 && <span style={{ fontSize: '7px', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusAtk} ATK</span>}
                                  {bonus.bonusCritRate > 0 && <span style={{ fontSize: '7px', color: '#fb923c', background: 'rgba(251,146,60,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusCritRate}% CRIT</span>}
                                  {bonus.bonusCritDmg > 0 && <span style={{ fontSize: '7px', color: '#fb923c', background: 'rgba(251,146,60,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusCritDmg}% CDMG</span>}
                                  {bonus.bonusArmor > 0 && <span style={{ fontSize: '7px', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusArmor} ARM</span>}
                                  {bonus.bonusDodge > 0 && <span style={{ fontSize: '7px', color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusDodge}% DGE</span>}
                                  {bonus.bonusHitRate > 0 && <span style={{ fontSize: '7px', color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{(bonus.bonusHitRate * 100).toFixed(0)}% HIT</span>}
                                  {bonus.bonusSpeed > 0 && <span style={{ fontSize: '7px', color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusSpeed.toFixed(1)} SPD</span>}
                                  {bonus.bonusHP > 0 && <span style={{ fontSize: '7px', color: '#22d38a', background: 'rgba(34,211,138,0.1)', padding: '1px 4px', borderRadius: '2px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+{bonus.bonusHP} HP</span>}
                                </div>
                              )}
                            </div>
                          ) : null
                        })()}
                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                          <button
                            style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: `1px solid ${div.equipment.length > 0 ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)'}`, background: div.equipment.length > 0 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', color: div.equipment.length > 0 ? '#3b82f6' : '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                            onClick={() => setWeaponPickerDivId(div.id)}
                          >
                            EQUIP ({div.equipment.length}/3)
                          </button>
                          {div.status === 'destroyed' ? (
                            <button
                              style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                              title={`Revive: 50% cost, halve XP, reroll stars, 2-16% HP`}
                              onClick={() => {
                                const r = armyStore.reviveDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                              }}
                            >
                              REVIVE (${Math.floor(DIVISION_TEMPLATES[div.type].recruitCost.money * 0.6).toLocaleString()})
                            </button>
                          ) : (
                            <button
                              style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', cursor: 'pointer', transition: 'all 0.15s' }}
                              onClick={() => {
                                const r = armyStore.rebuildDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#3b82f6' : '#ef4444')
                              }}
                            >
                              FEED
                            </button>
                          )}
                        </div>
                        {/* Division Equipment */}
                        {(() => {
                          const divItems = div.equipment.map(eid => inventory.items.find(i => i.id === eid)).filter(Boolean) as EquipItem[]
                          if (divItems.length === 0) return <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>No equipment assigned</div>
                          return (
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '3px' }}>
                              {divItems.map(item => (
                                <div key={item.id} style={{
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 6px', borderRadius: '3px',
                                  background: `${TIER_COLORS[item.tier]}10`,
                                  border: `1px solid ${TIER_COLORS[item.tier]}30`,
                                  fontSize: '8px',
                                }}>
                                  <span style={{ color: TIER_COLORS[item.tier], fontWeight: 700 }}>{item.name}</span>
                                  <span style={{ color: '#64748b', fontSize: '7px' }}>{Math.floor(item.durability)}%</span>
                                  {currentArmy && (
                                    <button
                                      style={{ fontSize: '7px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                      title="Unequip to vault"
                                      onClick={() => {
                                        const r = armyStore.unequipToVault(currentArmy.id, div.id, item.id)
                                        ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                                      }}
                                    >✕</button>
                                  )}
                                </div>
                              ))}
                              <span style={{ fontSize: '7px', color: '#64748b' }}>({divItems.length}/3)</span>
                            </div>
                          )
                        })()}
                        {/* Lend / Recall + Disband */}
                        <div style={{ display: 'flex', gap: '3px', marginTop: '3px' }}>
                          {div.ownerId === player.name && div.status !== 'in_combat' && div.status !== 'destroyed' && (
                            div.deployedToPMC ? (
                              <button
                                style={{ fontSize: '8px', padding: '3px 8px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)', borderRadius: '3px', cursor: 'pointer', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}
                                onClick={() => {
                                  const r = armyStore.recallDivisionFromPMC(div.id)
                                  ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#a855f7' : '#ef4444')
                                }}
                              >RECALL FROM PMC</button>
                            ) : (
                              <button
                                style={{ fontSize: '8px', padding: '3px 8px', background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '3px', cursor: 'pointer', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}
                                onClick={() => {
                                  const r = armyStore.lendDivisionToPMC(div.id)
                                  ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#a855f7' : '#ef4444')
                                }}
                              ><Flag size={10} color="#a855f7" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />LEND TO PMC</button>
                            )
                          )}
                          {div.ownerId === player.name && div.status !== 'in_combat' && (
                            <button
                              style={{ fontSize: '7px', padding: '2px 6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px', cursor: 'pointer' }}
                              onClick={() => {
                                const r = armyStore.disbandDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                              }}
                            ><Trash2 size={10} color="#ef4444" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />DISBAND</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Attack Controls */}
                {canAttack && (
                  <div className="war-attack-controls">
                    <div className="war-attack-header" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Target size={14} color="#22d38a" /> LAUNCH ATTACK</div>
                    <div className="war-attack-targets">
                      {adjacentCountries.map(code => {
                        const country = world.countries.find(c => c.code === code)
                        if (!country) return null
                        const atWar = world.wars.some(w =>
                          w.status === 'active' &&
                          ((w.attacker === iso && w.defender === code) || (w.defender === iso && w.attacker === code))
                        )
                        const dist = getCountryDistance(army.countryCode, code)
                        const cost = getAttackOilCost(dist)
                        const canAfford = army.vault.oil >= cost
                        return (
                          <button
                            key={code}
                            className={`war-target-btn ${!atWar || !canAfford ? 'war-target-btn--disabled' : ''}`}
                            disabled={!atWar || !canAfford}
                            onClick={() => handleLaunchAttack(army.id, code)}
                            title={!atWar ? `Not at war with ${country.name}` : !canAfford ? `Not enough oil (${cost}🛢️ needed)` : `Attack ${country.name}`}
                          >
                            <span className="war-target-flag"><CountryFlag iso={code} size={16} /></span>
                            <span className="war-target-name">{country.name} (🛢️{cost})</span>
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
          <div className="war-card__title" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Package size={14} color="#22d38a" /> UNASSIGNED ({unassignedDivs.length})</div>
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

      {/* === Weapon Picker Modal === */}
      {weaponPickerDivId && (() => {
        const div = armyStore.divisions[weaponPickerDivId]
        if (!div) { setWeaponPickerDivId(null); return null }
        const matchingSub = Object.entries(WEAPON_DIVISION_MAP).find(([, dt]) => dt === div.type)?.[0] as WeaponSubtype | undefined
        const matchingWeapons = matchingSub ? inventory.items.filter(i => i.location === 'inventory' && i.category === 'weapon' && i.weaponSubtype === matchingSub && i.durability > 0) : []
        const equippedIds = new Set(div.equipment)
        const currentlyEquipped = matchingWeapons.filter(w => equippedIds.has(w.id))
        const available = matchingWeapons.filter(w => !w.equipped).sort((a, b) => (b.stats.damage || 0) - (a.stats.damage || 0))
        const template = DIVISION_TEMPLATES[div.type]

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setWeaponPickerDivId(null)}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', minWidth: '320px', maxWidth: '400px', maxHeight: '70vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}><Wrench size={14} color="#22d38a" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />EQUIP DIVISION</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{div.name} — needs: {matchingSub?.toUpperCase()}</div>
                </div>
                <button onClick={() => setWeaponPickerDivId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
              </div>

              {currentlyEquipped.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700, marginBottom: '4px' }}>EQUIPPED</div>
                  {currentlyEquipped.map(w => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '4px', marginBottom: '4px' }}>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6' }}>{w.name}</div>
                        <div style={{ fontSize: '8px', color: '#94a3b8' }}>⚔️ {w.stats.damage || 0} dmg • 💥 {w.stats.critRate || 0}% crit • {Math.floor(w.durability)}% dur</div>
                      </div>
                      <button style={{ fontSize: '8px', padding: '2px 6px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px', cursor: 'pointer' }}
                        onClick={() => { armyStore.unequipItemFromDivision(div.id, w.id); ui.addFloatingText('Unequipped!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b') }}>
                        UNEQUIP
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' }}>AVAILABLE ({available.length})</div>
              {available.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '16px' }}>No matching {matchingSub} weapons in inventory</div>
              ) : (
                available.map(w => (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '3px', cursor: 'pointer', transition: 'all 0.1s' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>{w.name} <span style={{ fontSize: '8px', color: '#64748b' }}>({w.tier.toUpperCase()})</span></div>
                      <div style={{ fontSize: '8px', color: '#94a3b8' }}>⚔️ {w.stats.damage || 0} dmg • 💥 {w.stats.critRate || 0}% crit • {Math.floor(w.durability)}% dur</div>
                    </div>
                    <button style={{ fontSize: '9px', padding: '3px 8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '3px', cursor: 'pointer', fontWeight: 700 }}
                      onClick={() => {
                        const r = armyStore.equipItemToDivision(div.id, w.id)
                        ui.addFloatingText(r ? `Equipped ${w.name}!` : 'Failed to equip', window.innerWidth / 2, window.innerHeight / 2, r ? '#3b82f6' : '#ef4444')
                        setWeaponPickerDivId(null)
                      }}>
                      EQUIP
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })()}

      {/* === Donate Equipment Picker Modal === */}
      {showDonateForArmy && (() => {
        const army = armyStore.armies[showDonateForArmy]
        if (!army) { setShowDonateForArmy(null); return null }
        const donatable = inventory.items.filter(i => i.location === 'inventory' && !i.equipped)

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowDonateForArmy(null)}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '16px', minWidth: '320px', maxWidth: '400px', maxHeight: '70vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#a855f7', fontFamily: 'var(--font-display)' }}><Gift size={14} color="#a855f7" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />DONATE TO VAULT</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{army.name} — {donatable.length} items available</div>
                </div>
                <button onClick={() => setShowDonateForArmy(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
              </div>
              {donatable.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '16px' }}>No unequipped items to donate</div>
              ) : (
                donatable.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', marginBottom: '3px', borderRadius: '4px',
                    background: `${TIER_COLORS[item.tier]}08`,
                    border: `1px solid ${TIER_COLORS[item.tier]}25`,
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: TIER_COLORS[item.tier] }}>{item.name}</div>
                      <div style={{ fontSize: '8px', color: '#94a3b8' }}>
                        {item.tier.toUpperCase()} • {item.slot} • ⚔️{item.stats.damage || 0} 🛡️{item.stats.armor || 0} • {Math.floor(item.durability)}%
                      </div>
                    </div>
                    <button style={{
                      fontSize: '9px', padding: '3px 8px', fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(168,85,247,0.15)', color: '#a855f7',
                      border: '1px solid rgba(168,85,247,0.3)', borderRadius: '3px',
                    }}
                      onClick={() => {
                        const r = armyStore.donateEquipmentToVault(showDonateForArmy, item.id)
                        ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#a855f7' : '#ef4444')
                      }}
                    >DONATE</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
