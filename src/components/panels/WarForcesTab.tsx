import { useState } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, getDivisionEquipBonus, WEAPON_DIVISION_MAP, type DivisionType } from '../../stores/army'
import { useBattleStore, getBaseSkillStats } from '../../stores/battleStore'
import { usePlayerStore, getMilitaryRank } from '../../stores/playerStore'
import { useWorldStore, ADJACENCY_MAP } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import { useInventoryStore, TIER_COLORS, type WeaponSubtype, type EquipItem } from '../../stores/inventoryStore'
import { getCountryDistance, getAttackOilCost } from '../../utils/geography'
import CountryFlag from '../shared/CountryFlag'
import { RANK_ICONS } from './warHelpers'

export default function ForcesTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const battleStore = useBattleStore()
  const player = usePlayerStore()
  const world = useWorldStore()
  const ui = useUIStore()
  const inventory = useInventoryStore()
  const [newArmyName, setNewArmyName] = useState('')
  const [expandedArmy, setExpandedArmy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [weaponPickerDivId, setWeaponPickerDivId] = useState<string | null>(null)
  const [showDonateForArmy, setShowDonateForArmy] = useState<string | null>(null)
  const [equipPickerItem, setEquipPickerItem] = useState<{ armyId: string; itemId: string } | null>(null)
  const [showDistribute, setShowDistribute] = useState<string | null>(null)  // army ID
  const [distResource, setDistResource] = useState<'money' | 'oil'>('money')
  const [distAmount, setDistAmount] = useState(10000)

  const allDivisions = Object.values(armyStore.divisions).filter(d => d.countryCode === iso)
  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = myArmies.find(a => a.members.some(m => m.playerId === player.name))
  const unassignedDivs = allDivisions.filter(d => !myArmies.some(a => a.divisionIds.includes(d.id)))
  const myRank = getMilitaryRank(player.level)
  const adjacentCountries = ADJACENCY_MAP[iso] || []

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    const armyId = armyStore.createArmy(newArmyName.trim(), iso)
    setFeedback(armyId ? `Army created (${armyId.slice(0, 8)}…)` : 'Failed to create army')
    setNewArmyName('')
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleEnlist = (armyId: string) => {
    const result = armyStore.enlistInArmy(armyId)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleLeave = () => {
    if (!currentArmy) return
    const result = armyStore.leaveArmy()
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleLaunchAttack = (armyId: string, targetCode: string) => {
    const result = battleStore.launchHOIBattle(armyId, targetCode)
    setFeedback(result.message)
    setTimeout(() => setFeedback(''), 3000)
  }

  return (
    <div className="war-forces">
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Cannot') || feedback.includes('No ready') || feedback.includes('Already') ? 'war-feedback--error' : 'war-feedback--success'}`}>
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
              <div style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700 }}>✅ {currentArmy.name}</div>
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
                      <button className="war-btn war-btn--small"
                        style={{ fontSize: '7px', padding: '2px 5px', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)' }}
                        onClick={() => setShowDonateForArmy(army.id)}
                      >🎁 EQUIP</button>
                    </div>
                  )}
                  {/* Commander/Colonel vault actions */}
                  {(() => {
                    const me = army.members.find(m => m.playerId === player.name)
                    const isOfficer = army.commanderId === player.name || me?.role === 'colonel' || me?.role === 'general'
                    if (!isOfficer) return null
                    return (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button className="war-btn war-btn--small"
                            style={{ fontSize: '7px', padding: '2px 5px', color: '#22d38a', borderColor: 'rgba(34,211,138,0.3)', flex: 1 }}
                            onClick={() => setShowDistribute(showDistribute === army.id ? null : army.id)}
                          >📤 DISTRIBUTE</button>
                          <button className="war-btn war-btn--small"
                            style={{ fontSize: '7px', padding: '2px 5px', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', flex: 1 }}
                            onClick={() => { setFeedback('Open Market panel → enable "🏦 Army Vault" toggle to trade vault resources'); setTimeout(() => setFeedback(''), 4000) }}
                          >📊 TRADE ON MARKET</button>
                        </div>
                        {/* Distribute inline form */}
                        {showDistribute === army.id && (
                          <div style={{ marginTop: '4px', padding: '6px', background: 'rgba(34,211,138,0.05)', border: '1px solid rgba(34,211,138,0.15)', borderRadius: '4px' }}>
                            <div style={{ fontSize: '8px', fontWeight: 800, color: '#22d38a', marginBottom: '4px' }}>📤 DISTRIBUTE TO {army.members.length} MEMBERS</div>
                            <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                              <button className={`war-btn war-btn--small ${distResource === 'money' ? 'war-btn--primary' : ''}`}
                                style={{ fontSize: '7px', padding: '2px 5px' }}
                                onClick={() => setDistResource('money')}
                              >💰 Money</button>
                              <button className={`war-btn war-btn--small ${distResource === 'oil' ? 'war-btn--primary' : ''}`}
                                style={{ fontSize: '7px', padding: '2px 5px' }}
                                onClick={() => setDistResource('oil')}
                              >🛢️ Oil</button>
                            </div>
                            <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
                              {(distResource === 'money' ? [10000, 50000, 100000] : [50, 100, 500]).map(a => (
                                <button key={a}
                                  className={`war-btn war-btn--small ${distAmount === a ? 'war-btn--primary' : ''}`}
                                  style={{ fontSize: '7px', padding: '2px 5px', flex: 1 }}
                                  onClick={() => setDistAmount(a)}
                                >{distResource === 'money' ? `$${a >= 1000 ? `${a/1000}K` : a}` : `${a}`}</button>
                              ))}
                            </div>
                            <button className="war-btn war-btn--primary" style={{ width: '100%', fontSize: '8px', padding: '4px 0' }}
                              onClick={() => {
                                const r = armyStore.distributeVaultToMembers(army.id, distResource, distAmount)
                                setFeedback(r.message)
                                setTimeout(() => setFeedback(''), 3000)
                              }}
                            >📤 DISTRIBUTE {distResource === 'money' ? `$${distAmount.toLocaleString()}` : `${distAmount} oil`} TO ALL</button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {/* Vault Equipment */}
                  {(() => {
                    const vaultItems = inventory.items.filter(i => i.location === 'vault' && i.vaultArmyId === army.id)
                    if (vaultItems.length === 0) return null
                    return (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ fontSize: '8px', fontWeight: 800, color: '#a855f7', letterSpacing: '1px', marginBottom: '3px' }}>🗃️ VAULT EQUIPMENT ({vaultItems.length})</div>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                          {vaultItems.map(item => (
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
                                      const r = armyStore.equipFromVault(army.id, d.id, item.id)
                                      ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#3b82f6' : '#ef4444')
                                    }}
                                  >→ {d.name.substring(0, 10)}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Division List — Enhanced with stance, XP, rebuild/disband */}
                <div className="war-army-divs">
                  {divs.length === 0 ? (
                    <div className="war-empty">No divisions assigned.</div>
                  ) : divs.map(div => {
                    const template = DIVISION_TEMPLATES[div.type]
                    const strengthPct = Math.floor((div.health / div.maxHealth) * 100)
                    const divLevel = Math.floor((div.experience || 0) / 10)
                    const ps = getBaseSkillStats()
                    const eq = getDivisionEquipBonus(div)
                    // Compute final stats (including equipment bonuses)
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
                      training: '🔨 TRAINING', ready: '✅ READY', in_combat: '⚔️ COMBAT', recovering: '💤 RECOVERING', destroyed: '💀 DESTROYED'
                    }

                    return (
                      <div className={`war-div-row war-div-row--${div.status}`} key={div.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', padding: '6px 8px' }}>
                        {/* Header: icon, name, level, status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <img src={template?.icon} alt="div" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                          <span className="war-div-row__name" style={{ flex: 1 }}>{div.name}</span>
                          <span style={{ fontSize: '8px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                            LV{divLevel}
                          </span>
                          <span style={{ fontSize: '7px', fontWeight: 700, color: statusColors[div.status] || '#64748b', background: `${statusColors[div.status] || '#64748b'}15`, padding: '1px 5px', borderRadius: '3px' }}>
                            {div.status === 'training' ? (() => { const left = Math.max(0, Math.ceil((div.readyAt - Date.now()) / 1000)); return `🔨 ${left}s` })() : (statusLabels[div.status] || div.status.toUpperCase())}
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
                          <span style={{ color: '#94a3b8' }}>⚔️ ATK <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalAtk}</span></span>
                          <span style={{ color: '#94a3b8' }}>🎯 HIT <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalHit}%</span></span>
                          <span style={{ color: '#94a3b8' }}>💥 CRTH <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalCrit}%</span></span>
                          <span style={{ color: '#94a3b8' }}>💀 CRTD <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalCritDmg}%</span></span>
                          <span style={{ color: '#94a3b8' }}>💨 DGE <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalDodge}%</span></span>
                          <span style={{ color: '#94a3b8' }}>🛡️ ARM <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalArmor}</span></span>
                          <span style={{ color: '#94a3b8' }}>⚡ SPD <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{finalSpeed}x</span></span>
                          <span style={{ color: '#94a3b8' }}>👥 Troops <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{div.manpower}</span></span>
                        </div>
                        {/* === Equipped Items & Buffs === */}
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
                              {/* Buff summary */}
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
                        {/* === Big Action Buttons === */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                          {/* EQUIP = equip weapon */}
                          <button
                            style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: `1px solid ${div.equipment.length > 0 ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)'}`, background: div.equipment.length > 0 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', color: div.equipment.length > 0 ? '#3b82f6' : '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                            onClick={() => setWeaponPickerDivId(div.id)}
                          >
                            🔧 EQUIP ({div.equipment.length}/3)
                          </button>
                          {/* REBUILD or REVIVE based on status */}
                          {div.status === 'destroyed' ? (
                            <button
                              style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s' }}
                              title={`Revive: 50% cost, halve XP, reroll stars, 2-16% HP`}
                              onClick={() => {
                                const r = armyStore.reviveDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                              }}
                            >
                              💀 REVIVE (${Math.floor(DIVISION_TEMPLATES[div.type].recruitCost.money * 0.6).toLocaleString()})
                            </button>
                          ) : (
                            <button
                              style={{ flex: 1, padding: '6px 0', fontSize: '10px', fontWeight: 900, fontFamily: 'var(--font-display)', letterSpacing: '1px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', cursor: 'pointer', transition: 'all 0.15s' }}
                              onClick={() => {
                                const r = armyStore.rebuildDivision(div.id)
                                ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#3b82f6' : '#ef4444')
                              }}
                            >
                              🍞 FEED
                            </button>
                          )}
                        </div>
                        {/* Division Equipment (all items, not just weapons) */}
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
                        {/* Disband Button */}
                        {div.ownerId === player.name && div.status !== 'in_combat' && (
                          <button
                            style={{ fontSize: '7px', padding: '2px 6px', marginTop: '3px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '3px', cursor: 'pointer' }}
                            onClick={() => {
                              const r = armyStore.disbandDivision(div.id)
                              ui.addFloatingText(r.message, window.innerWidth / 2, window.innerHeight / 2, r.success ? '#f59e0b' : '#ef4444')
                            }}
                          >🗑️ DISBAND</button>
                        )}
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
                          { label: '🚶', val: av.ground, buff: `+${aura.dodgePct}% Dodge`, color: '#3b82f6' },
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
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>🔧 EQUIP DIVISION</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>{div.name} — needs: {matchingSub?.toUpperCase()}</div>
                </div>
                <button onClick={() => setWeaponPickerDivId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}>✕</button>
              </div>

              {/* Currently equipped */}
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

              {/* Available weapons */}
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
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#a855f7', fontFamily: 'var(--font-display)' }}>🎁 DONATE TO VAULT</div>
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
