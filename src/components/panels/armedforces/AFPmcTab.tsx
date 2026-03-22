import { useState } from 'react'
import { useArmyStore, DIVISION_TEMPLATES, getDivisionEquipBonus } from '../../../stores/army'
import { usePlayerStore, getMilitaryRank } from '../../../stores/playerStore'
import { useUIStore } from '../../../stores/uiStore'
import { useInventoryStore, TIER_COLORS } from '../../../stores/inventoryStore'
import { Swords, Shield, Skull, TreePine, Plane, Ship, CheckCircle, CircleDot, XCircle, Brain, Coins, Fuel, FlaskConical, Crosshair as GunIcon, Flag, Target, Users, Plus, Package, Crown, Trophy, BarChart3, Landmark as VaultIcon, Sparkles, ArrowUpRight, Gift, Banknote, ClipboardList, ArrowLeft, Scale, Award } from 'lucide-react'
import { RANK_ICONS } from '../warHelpers'

type PMCSection = 'divisions' | 'leaderboard' | 'stats' | 'vault' | 'defense'

export default function AFPmcTab({ iso }: { iso: string }) {
  const armyStore = useArmyStore()
  const player = usePlayerStore()
  const ui = useUIStore()
  const inventory = useInventoryStore()

  const [newArmyName, setNewArmyName] = useState('')
  const [expandedSection, setExpandedSection] = useState<PMCSection | null>('divisions')
  const [feedback, setFeedback] = useState('')
  const [showDonate, setShowDonate] = useState(false)
  const [showDistribute, setShowDistribute] = useState(false)
  const [distResource, setDistResource] = useState<'money' | 'oil' | 'materialX'>('money')
  const [distAmount, setDistAmount] = useState(10000)
  const [leaderboardSort, setLeaderboardSort] = useState<'damage' | 'power'>('damage')

  const myArmies = Object.values(armyStore.armies).filter(a => a.countryCode === iso)
  const currentArmy = myArmies.find(a => a.members.some(m => m.playerId === player.name))
  const myRank = getMilitaryRank(player.level)

  const showFb = (msg: string, ok = true) => {
    setFeedback(msg)
    ui.addFloatingText(msg, window.innerWidth / 2, window.innerHeight / 2, ok ? '#22d38a' : '#ef4444')
    setTimeout(() => setFeedback(''), 3000)
  }

  const handleCreateArmy = () => {
    if (!newArmyName.trim()) return
    const armyId = armyStore.createArmy(newArmyName.trim(), iso)
    showFb(armyId ? `PMC created! (${armyId.slice(0, 8)}…)` : 'Failed to create PMC', !!armyId)
    setNewArmyName('')
  }

  const handleEnlist = (armyId: string) => {
    const result = armyStore.enlistInArmy(armyId)
    showFb(result.message, result.success)
  }

  const handleLeave = () => {
    if (!currentArmy) return
    const result = armyStore.leaveArmy()
    showFb(result.message, result.success)
  }

  const toggleSection = (s: PMCSection) => setExpandedSection(expandedSection === s ? null : s)

  // ── Computed PMC stats ──
  const pmcDivs = currentArmy
    ? currentArmy.divisionIds.map(id => armyStore.divisions[id]).filter(d => d && d.deployedToPMC)
    : []
  const readyDivs = pmcDivs.filter(d => d.status === 'ready').length
  const combatDivs = pmcDivs.filter(d => d.status === 'in_combat').length
  const totalManpower = pmcDivs.reduce((s, d) => s + d.manpower, 0)

  let totalDpt = 0, totalHp = 0, totalArmor = 0, totalEvasion = 0, activeDivCount = 0
  pmcDivs.forEach(d => {
    if (d.status === 'ready' || d.status === 'training' || d.status === 'in_combat') {
      const t = DIVISION_TEMPLATES?.[d.type]
      if (t) {
        const effAtk = t.atkDmgMult * (1 + parseFloat(String(d.statModifiers?.atkDmgMult || 0)))
        const effSpeed = (t.attackSpeed || 1.0) * (1 + parseFloat(String(d.statModifiers?.attackSpeed || 0)))
        totalDpt += Math.floor((100 + t.manpowerCost * 3) * effAtk * (1 / Math.max(0.2, effSpeed)))
        totalHp += d.maxHealth
        totalArmor += t.armorMult * (1 + parseFloat(String(d.statModifiers?.armorMult || 0)))
        totalEvasion += t.dodgeMult * (1 + parseFloat(String(d.statModifiers?.dodgeMult || 0)))
        activeDivCount++
      }
    }
  })
  const avgDpt = activeDivCount > 0 ? Math.floor(totalDpt / activeDivCount) : 0

  // Readiness
  const fullyGeared = pmcDivs.filter(d => d.equipment?.length === 3).length
  const avgExp = pmcDivs.length > 0 ? Math.floor(pmcDivs.reduce((s, d) => s + (d.experience || 0), 0) / pmcDivs.length) : 0
  const avgLevel = Math.floor(avgExp / 10) + 1
  const healthyPct = pmcDivs.length > 0 ? pmcDivs.filter(d => d.health >= d.maxHealth * 0.7).length / pmcDivs.length : 0
  const gearPct = pmcDivs.length > 0 ? fullyGeared / pmcDivs.length : 0
  const vetPct = Math.min(1, avgLevel / 10)
  const readiness = Math.floor((healthyPct * 40 + gearPct * 30 + vetPct * 20 + (readyDivs > 0 ? 10 : 0)))
  const readinessColor = readiness >= 75 ? '#22d38a' : readiness >= 40 ? '#f59e0b' : '#ef4444'

  // Composition
  const comp = { land: 0, air: 0, naval: 0 }
  pmcDivs.forEach(d => { if (d.category in comp) comp[d.category as keyof typeof comp]++ })

  // Star breakdown
  const starsCount = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  pmcDivs.forEach(d => { starsCount[d.starQuality as keyof typeof starsCount]++ })

  const someGear = pmcDivs.filter(d => (d.equipment?.length || 0) > 0 && (d.equipment?.length || 0) < 3).length
  const noGear = pmcDivs.filter(d => !d.equipment || d.equipment.length === 0).length

  // Top division
  let topDiv = pmcDivs[0]
  pmcDivs.forEach(d => { if (d.killCount > (topDiv?.killCount || 0)) topDiv = d })

  // PMC Auras — total from ALL shared (lent) divisions
  const pmcAura = currentArmy ? armyStore.getPMCCompositionAura(currentArmy.id) : null

  // Sorted members for leaderboard
  const sortedMembers = currentArmy
    ? [...currentArmy.members].sort((a, b) =>
        leaderboardSort === 'damage'
          ? b.totalDamageThisPeriod - a.totalDamageThisPeriod
          : b.contributedPower - a.contributedPower
      )
    : []

  const s = (label: string, value: string | number, color = '#e2e8f0') => (
    <div style={{
      textAlign: 'center', padding: '5px 2px',
      background: 'rgba(255,255,255,0.02)', borderRadius: '4px',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 900, color, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )

  const SECTION_ICONS: Record<string, React.ReactElement> = {
    swords: <Swords size={14} />,
    trophy: <Trophy size={14} />,
    stats: <BarChart3 size={14} />,
    vault: <VaultIcon size={14} />,
    defense: <Shield size={14} />,
  }

  const sectionHeader = (icon: string, title: string, section: PMCSection, color: string, badge?: string | number) => (
    <div
      onClick={() => toggleSection(section)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', cursor: 'pointer',
        background: expandedSection === section ? `${color}10` : 'rgba(255,255,255,0.02)',
        borderRadius: '6px', border: `1px solid ${expandedSection === section ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ display: 'flex', color }}>{SECTION_ICONS[icon] || icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 900, color: expandedSection === section ? color : '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
          {title}
        </span>
        {badge !== undefined && (
          <span style={{ fontSize: '8px', fontWeight: 800, color, background: `${color}20`, padding: '1px 5px', borderRadius: '8px' }}>{badge}</span>
        )}
      </div>
      <span style={{ fontSize: '10px', color: '#64748b', transition: 'transform 0.2s', transform: expandedSection === section ? 'rotate(180deg)' : 'none' }}>▼</span>
    </div>
  )

  // My member info
  const myMemberInfo = currentArmy?.members.find(m => m.playerId === player.name)
  const isOfficer = currentArmy && (currentArmy.commanderId === player.name || myMemberInfo?.role === 'colonel' || myMemberInfo?.role === 'general')

  const roleColors: Record<string, string> = {
    general: '#f59e0b', colonel: '#a855f7', captain: '#3b82f6', lieutenant: '#22d38a',
    sergeant: '#94a3b8', corporal: '#64748b', private: '#475569',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {feedback && (
        <div className={`war-feedback ${feedback.includes('Cannot') || feedback.includes('Failed') || feedback.includes('Already') || feedback.includes('Not') ? 'war-feedback--error' : 'war-feedback--success'}`}>
          {feedback}
        </div>
      )}

      {/* ═══════ MY PMC HEADER ═══════ */}
      {currentArmy ? (
        <>
          <div style={{
            padding: '10px 12px',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(0,0,0,0.3) 100%)',
            borderRadius: '8px', border: '1px solid rgba(168,85,247,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', boxShadow: '0 2px 8px rgba(168,85,247,0.3)',
                }}><Flag size={20} color="#fff" /></div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                    {currentArmy.name.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Crown size={10} color="#94a3b8" /> {currentArmy.commanderId}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Users size={10} color="#94a3b8" /> {currentArmy.members.length} members</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Swords size={10} color="#94a3b8" /> {pmcDivs.length} divisions</span>
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4px 10px', borderRadius: '6px',
                background: `${readinessColor}10`, border: `1px solid ${readinessColor}30`,
              }}>
                <div style={{ fontSize: '16px', fontWeight: 900, color: readinessColor, fontFamily: 'var(--font-display)' }}>{readiness}%</div>
                <div style={{ fontSize: '6px', color: readinessColor, fontWeight: 700, letterSpacing: '0.5px' }}>READINESS</div>
              </div>
            </div>

            {/* My Role */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: '8px', padding: '5px 8px',
              background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', display: 'flex' }}><Shield size={16} color="#22d38a" /></span>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{myRank.label.toUpperCase()}</div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>
                    Role: <span style={{ color: roleColors[myMemberInfo?.role || 'private'] || '#64748b', fontWeight: 700 }}>{(myMemberInfo?.role || 'private').toUpperCase()}</span>
                  </div>
                </div>
              </div>
              {currentArmy.commanderId !== player.name && (
                <button className="war-btn war-btn--danger" style={{ fontSize: '7px', padding: '3px 8px' }} onClick={handleLeave}>LEAVE PMC</button>
              )}
            </div>
          </div>

          {/* ═══════ COMPOSITION AURAS (TOTAL FROM ALL SHARED DIVS) ═══════ */}
          {pmcAura && (
            <div style={{
              padding: '10px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(0,0,0,0.25) 100%)',
              borderRadius: '8px', border: '1px solid rgba(167,139,250,0.25)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#a78bfa', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                  <Sparkles size={14} color="#a78bfa" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> COMPOSITION AURAS
                </div>
                <span style={{ fontSize: '7px', color: '#64748b', fontStyle: 'italic' }}>Total from {pmcDivs.length} shared division{pmcDivs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                {[
                  { Icon: Plane, label: 'AIR', val: pmcAura.air, buff: `+${pmcAura.critDmgPct}%`, stat: 'CRIT DMG', color: '#60a5fa' },
                  { Icon: Users, label: 'GROUND', val: pmcAura.ground, buff: `+${pmcAura.dodgePct}%`, stat: 'DODGE', color: '#3b82f6' },
                  { Icon: Shield, label: 'ARMOR', val: pmcAura.tanks, buff: `+${pmcAura.attackPct}%`, stat: 'ATK', color: '#f59e0b' },
                  { Icon: Ship, label: 'NAVY', val: pmcAura.navy, buff: `+${pmcAura.precisionPct}%`, stat: 'PREC', color: '#a78bfa' },
                ].map(cat => (
                  <div key={cat.label} style={{
                    textAlign: 'center', padding: '6px 4px',
                    background: `${cat.color}08`, borderRadius: '5px',
                    border: `1px solid ${cat.color}25`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><cat.Icon size={20} color={cat.color} /></div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{cat.val}</div>
                    <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, marginBottom: '2px' }}>{cat.label}</div>
                    <div style={{
                      fontSize: '9px', fontWeight: 900, color: cat.color,
                      padding: '1px 4px', borderRadius: '3px',
                      background: `${cat.color}15`,
                    }}>
                      {cat.buff} {cat.stat}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════ SECTION: SHARED DIVISIONS ═══════ */}
          {sectionHeader('swords', 'SHARED DIVISIONS', 'divisions', '#3b82f6', pmcDivs.length)}
          {expandedSection === 'divisions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {pmcDivs.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '10px', color: '#64748b', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  No divisions assigned to this PMC yet. Recruit divisions and assign them!
                </div>
              ) : pmcDivs.map(div => {
                const template = DIVISION_TEMPLATES[div.type]
                const strengthPct = Math.floor((div.health / div.maxHealth) * 100)
                const divLevel = Math.floor((div.experience || 0) / 10)
                const statusColors: Record<string, string> = {
                  training: '#f59e0b', ready: '#22d38a', in_combat: '#ef4444', recovering: '#3b82f6', destroyed: '#64748b'
                }
                const statusLabels: Record<string, string> = {
                  training: 'TRAIN', ready: 'READY', in_combat: 'COMBAT', recovering: 'RECV', destroyed: 'DEAD'
                }
                const isOwner = div.ownerId === player.name

                return (
                  <div key={div.id} style={{
                    padding: '6px 8px', borderRadius: '5px',
                    background: isOwner ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isOwner ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <img src={template?.icon} alt="div" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{div.name}</span>
                          <span style={{ fontSize: '7px', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0 3px', borderRadius: '2px' }}>LV{divLevel}</span>
                          <span style={{ fontSize: '7px', color: '#f59e0b' }}>{'★'.repeat(div.starQuality)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '7px', color: '#64748b', marginTop: '1px' }}>
                          <span>👤 {div.ownerId}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Users size={8} color="#64748b" /> {div.manpower}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Skull size={8} color="#64748b" /> {div.killCount}</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '7px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px',
                        color: statusColors[div.status] || '#64748b',
                        background: `${statusColors[div.status] || '#64748b'}15`,
                      }}>
                        {statusLabels[div.status] || div.status.toUpperCase()}
                      </span>
                    </div>
                    {/* HP bar */}
                    <div className="war-div-bar" style={{ height: '8px', marginTop: '4px' }}>
                      <div className="war-div-bar__fill war-div-bar__fill--str" style={{ width: `${strengthPct}%`, transition: 'width 0.5s' }} />
                      <span className="war-div-bar__label" style={{ fontSize: '7px', fontWeight: 800 }}>{strengthPct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══════ SECTION: LEADERBOARD ═══════ */}
          {sectionHeader('trophy', 'LEADERBOARD', 'leaderboard', '#f59e0b', currentArmy.members.length)}
          {expandedSection === 'leaderboard' && (
            <div style={{
              padding: '6px', borderRadius: '6px',
              background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.1)',
            }}>
              {/* Sort toggles */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {(['damage', 'power'] as const).map(sortKey => (
                  <button key={sortKey}
                    onClick={() => setLeaderboardSort(sortKey)}
                    style={{
                      flex: 1, padding: '3px 0', fontSize: '8px', fontWeight: 800,
                      fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                      background: leaderboardSort === sortKey ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${leaderboardSort === sortKey ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '3px', cursor: 'pointer',
                      color: leaderboardSort === sortKey ? '#f59e0b' : '#64748b',
                    }}
                  >
                    {sortKey === 'damage' ? 'DAMAGE' : 'POWER'}
                  </button>
                ))}
              </div>

              {/* Member rows */}
              {sortedMembers.map((member, idx) => {
                const isMe = member.playerId === player.name
                const isCommander = member.playerId === currentArmy.commanderId
                const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`
                const claimable = currentArmy.soldierBalances?.[member.playerId] || 0

                return (
                  <div key={member.playerId} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 8px', marginBottom: '2px', borderRadius: '4px',
                    background: isMe ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isMe ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)'}`,
                  }}>
                    {/* Rank */}
                    <span style={{ fontSize: idx < 3 ? '14px' : '10px', fontWeight: 900, color: '#f59e0b', minWidth: '22px', textAlign: 'center', fontFamily: 'var(--font-display)' }}>
                      {rankIcon}
                    </span>
                    {/* Player info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: isMe ? '#3b82f6' : '#e2e8f0' }}>
                          {member.playerId}
                        </span>
                        {isCommander && <Crown size={10} color="#f59e0b" />}
                        <span style={{
                          fontSize: '6px', fontWeight: 800, padding: '1px 4px', borderRadius: '2px',
                          color: roleColors[member.role] || '#64748b',
                          background: `${roleColors[member.role] || '#64748b'}20`,
                          letterSpacing: '0.5px',
                        }}>
                          {member.role.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '7px', color: '#64748b', marginTop: '1px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Swords size={8} /> {member.totalDamageThisPeriod.toLocaleString()} dmg</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Shield size={8} /> {member.contributedPower.toLocaleString()} pwr</span>
                        {claimable > 0 && <span style={{ color: '#22d38a', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Coins size={8} /> ${claimable.toLocaleString()}</span>}
                      </div>
                    </div>
                    {/* Promote (officer only) */}
                    {isOfficer && !isCommander && member.playerId !== player.name && (
                      <button
                        style={{ fontSize: '7px', padding: '2px 5px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '3px', cursor: 'pointer' }}
                        onClick={() => {
                          const roles: Array<'private' | 'corporal' | 'sergeant' | 'lieutenant' | 'captain' | 'colonel'> = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel']
                          const curIdx = roles.indexOf(member.role as any)
                          const nextRole = roles[Math.min(curIdx + 1, roles.length - 1)]
                          const r = armyStore.promoteMember(currentArmy.id, member.playerId, nextRole)
                          showFb(r.message, r.success)
                        }}
                      >⬆ PROMOTE</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ═══════ SECTION: PMC STATS ═══════ */}
          {sectionHeader('stats', 'PMC STATS', 'stats', '#22d38a')}
          {expandedSection === 'stats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Overview grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {s('DIVS', pmcDivs.length)}
                {s('TROOPS', totalManpower.toLocaleString())}
                {s('READY', readyDivs, '#22d38a')}
                {s('IN COMBAT', combatDivs, '#ef4444')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                {s('AVG DPT', avgDpt.toLocaleString(), '#ef4444')}
                {s('TOTAL HP', totalHp.toLocaleString(), '#3b82f6')}
                {s('ARMOR', totalArmor.toFixed(1), '#f59e0b')}
                {s('EVASION', totalEvasion.toFixed(1), '#22d38a')}
              </div>

              {/* Army Intelligence */}
              <div style={{
                padding: '6px', borderRadius: '5px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: '8px', fontWeight: 900, color: '#94a3b8', fontFamily: 'var(--font-display)', letterSpacing: '0.8px', marginBottom: '4px' }}>INTELLIGENCE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px' }}>
                    <div style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 800, marginBottom: '1px' }}>ELITE</div>
                    <div style={{ display: 'flex', gap: '3px', fontSize: '8px', fontWeight: 700 }}>
                      <span style={{ color: '#f59e0b' }}>5★:{starsCount[5]}</span>
                      <span style={{ color: '#a855f7' }}>4★:{starsCount[4]}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px' }}>
                    <div style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 800, marginBottom: '1px' }}>TOP DIV</div>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {topDiv ? topDiv.name : '—'}
                    </div>
                    <div style={{ fontSize: '7px', color: '#f59e0b', fontWeight: 700 }}>{topDiv ? <><Skull size={10} color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle' }} /> {topDiv.killCount}</> : ''}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px' }}>
                    <div style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 800, marginBottom: '1px' }}>COMP</div>
                    <div style={{ display: 'flex', gap: '3px', fontSize: '8px', color: '#cbd5e1' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><TreePine size={10} color="#cbd5e1" />{comp.land}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Plane size={10} color="#cbd5e1" />{comp.air}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Ship size={10} color="#cbd5e1" />{comp.naval}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px' }}>
                    <div style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 800, marginBottom: '1px' }}>GEAR</div>
                    <div style={{ display: 'flex', gap: '3px', fontSize: '8px', fontWeight: 700 }}>
                      <span style={{ color: '#22d38a', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><CheckCircle size={10} />{fullyGeared}</span>
                      <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><CircleDot size={10} />{someGear}</span>
                      <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><XCircle size={10} />{noGear}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px' }}>
                    <div style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 800, marginBottom: '1px' }}>VET</div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0' }}>Lv.{avgLevel}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '3px', padding: '4px' }}>
                    <div style={{ fontSize: '6px', color: '#94a3b8', fontWeight: 800, marginBottom: '1px' }}>POWER</div>
                    <div style={{ display: 'flex', gap: '4px', fontSize: '8px', fontWeight: 700 }}>
                      <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Swords size={10} color="#ef4444" />{totalDpt.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* ═══════ SECTION: MILITARY VAULT ═══════ */}
          {sectionHeader('vault', 'MILITARY VAULT', 'vault', '#f59e0b')}
          {expandedSection === 'vault' && (
            <div style={{
              padding: '8px', borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(0,0,0,0.2) 100%)',
              border: '1px solid rgba(245,158,11,0.12)',
            }}>
              {/* Resource display */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', marginBottom: '6px' }}>
                {[
                  { Icon: Coins, label: 'Money', val: currentArmy.vault.money },
                  { Icon: Fuel, label: 'Oil', val: currentArmy.vault.oil },
                  { Icon: FlaskConical, label: 'MaterialX', val: currentArmy.vault.materialX || 0 },
                  { Icon: GunIcon, label: 'Ammo', val: currentArmy.vault.ammo },
                  { Icon: Plane, label: 'Jets', val: currentArmy.vault.jets },
                  { Icon: Shield, label: 'Tanks', val: currentArmy.vault.tanks },
                ].map(r => (
                  <div key={r.label} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px',
                  }}>
                    <span style={{ display: 'flex' }}><r.Icon size={14} color="#fbbf24" /></span>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-display)' }}>{r.val.toLocaleString()}</div>
                      <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>{r.label}</div>
                    </div>
                  </div>
                ))}
                {/* Salary Pool */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 6px', background: 'rgba(34,211,138,0.08)', borderRadius: '3px',
                  border: '1px solid rgba(34,211,138,0.15)',
                }}>
                  <span style={{ display: 'flex' }}><Banknote size={14} color="#22d38a" /></span>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#22d38a', fontFamily: 'var(--font-display)' }}>{(currentArmy.salaryPool || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>Salary Pool</div>
                  </div>
                </div>
              </div>

              {/* Quick Donate */}
              <div style={{ display: 'flex', gap: '3px', marginBottom: '4px', flexWrap: 'wrap' }}>
                {[
                  { resource: 'money' as const, amount: 10000, label: '$10K', Icon: Coins },
                  { resource: 'money' as const, amount: 50000, label: '$50K', Icon: Coins },
                  { resource: 'oil' as const, amount: 100, label: '100', Icon: Fuel },
                  { resource: 'materialX' as const, amount: 50, label: '50', Icon: FlaskConical },
                ].map(d => (
                  <button key={d.label + d.amount} className="war-btn war-btn--small"
                    style={{ fontSize: '8px', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: '2px' }}
                    onClick={() => {
                      const r = armyStore.donateToVault(currentArmy.id, d.resource, d.amount)
                      showFb(r.message, r.success)
                    }}
                  ><d.Icon size={10} /> {d.label}</button>
                ))}
                <button className="war-btn war-btn--small"
                  style={{ fontSize: '8px', padding: '3px 6px', color: '#a855f7', borderColor: 'rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', gap: '2px' }}
                  onClick={() => setShowDonate(!showDonate)}
                ><Gift size={10} /> EQUIP</button>
              </div>

              {/* Salary Claim */}
              {(currentArmy.soldierBalances?.[player.name] || 0) > 0 && (
                <button className="war-btn war-btn--primary" style={{ width: '100%', fontSize: '9px', padding: '5px 0', marginBottom: '4px' }}
                  onClick={() => {
                    const r = armyStore.claimSalary(currentArmy.id)
                    showFb(r.message, r.success)
                  }}
                >
                  CLAIM SALARY — ${(currentArmy.soldierBalances?.[player.name] || 0).toLocaleString()}
                </button>
              )}

              {/* Officer Controls */}
              {isOfficer && (
                <>
                  <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                    <button className="war-btn war-btn--small"
                      style={{ fontSize: '7px', padding: '3px 6px', color: '#22d38a', borderColor: 'rgba(34,211,138,0.3)', flex: 1 }}
                      onClick={() => setShowDistribute(!showDistribute)}
                    ><ArrowUpRight size={10} /> DISTRIBUTE</button>
                    <button className="war-btn war-btn--small"
                      style={{ fontSize: '7px', padding: '3px 6px', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.3)', flex: 1 }}
                      onClick={() => showFb('Open Market panel → "Army Vault" toggle to trade vault resources')}
                    >TRADE</button>
                  </div>

                  {showDistribute && (
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
                          showFb(r.message, r.success)
                        }}
                      >DISTRIBUTE {distResource === 'money' ? `$${distAmount.toLocaleString()}` : `${distAmount} oil`} TO ALL</button>
                    </div>
                  )}
                </>
              )}

              {/* Vault Equipment */}
              {(() => {
                const vaultItems = inventory.items.filter(i => i.location === 'vault' && i.vaultArmyId === currentArmy.id)
                if (vaultItems.length === 0) return null
                return (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: '#a855f7', letterSpacing: '0.8px', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}><Package size={12} color="#a855f7" /> VAULT EQUIPMENT ({vaultItems.length})</div>
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                      {vaultItems.map(item => (
                        <div key={item.id} style={{
                          padding: '3px 5px', borderRadius: '3px',
                          background: `${TIER_COLORS[item.tier]}10`,
                          border: `1px solid ${TIER_COLORS[item.tier]}40`,
                          fontSize: '8px',
                        }}>
                          <div style={{ fontWeight: 700, color: TIER_COLORS[item.tier] }}>{item.name}</div>
                          <div style={{ color: '#94a3b8', fontSize: '6px' }}>{item.tier.toUpperCase()} • {Math.floor(item.durability)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ═══════ SECTION: DEFENSE COORDINATION ═══════ */}
          {sectionHeader('defense', 'DEFENSE COORD', 'defense', '#ef4444')}
          {expandedSection === 'defense' && (
            <div style={{
              padding: '8px', borderRadius: '6px',
              background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.1)',
            }}>
              {/* Status */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', marginBottom: '6px' }}>
                <div style={{ textAlign: 'center', padding: '6px 4px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: currentArmy.status === 'idle' ? '#22d38a' : '#ef4444', fontFamily: 'var(--font-display)' }}>
                    {currentArmy.status.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>STATUS</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 4px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#3b82f6', fontFamily: 'var(--font-display)' }}>
                    {currentArmy.deployedProvince || '—'}
                  </div>
                  <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>DEPLOYED</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 4px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#a855f7', fontFamily: 'var(--font-display)' }}>
                    {currentArmy.autoDefenseLimit === -1 ? 'ALL' : currentArmy.autoDefenseLimit === 0 ? 'OFF' : currentArmy.autoDefenseLimit}
                  </div>
                  <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>AUTO-DEF</div>
                </div>
              </div>

              {/* Auto-defense controls (officer) */}
              {isOfficer && (
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ fontSize: '7px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '3px' }}>🛡️ AUTO-DEFENSE LIMIT</div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[
                      { val: 0, label: 'OFF' },
                      { val: 3, label: '3 DIV' },
                      { val: 5, label: '5 DIV' },
                      { val: -1, label: 'ALL' },
                    ].map(opt => (
                      <button key={opt.val}
                        className={`war-btn war-btn--small ${currentArmy.autoDefenseLimit === opt.val ? 'war-btn--primary' : ''}`}
                        style={{ fontSize: '7px', padding: '3px 6px', flex: 1 }}
                        onClick={() => {
                          const r = armyStore.setArmyAutoDefenseLimit(currentArmy.id, opt.val)
                          showFb(r.message, r.success)
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Orders */}
              <div style={{ fontSize: '7px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '3px' }}>📋 ACTIVE ORDERS ({currentArmy.activeOrders?.length || 0})</div>
              {(!currentArmy.activeOrders || currentArmy.activeOrders.length === 0) ? (
                <div style={{ padding: '8px', textAlign: 'center', fontSize: '9px', color: '#475569', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                  No active orders. Stand by.
                </div>
              ) : currentArmy.activeOrders.map(order => {
                const timeLeft = Math.max(0, Math.floor((order.expiresAt - Date.now()) / 60000))
                return (
                  <div key={order.id} style={{
                    padding: '5px 8px', marginBottom: '2px', borderRadius: '4px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: order.orderType.includes('attack') ? '#ef4444' : '#22d38a' }}>
                          {order.orderType === 'attack_region' ? '⚔️ ATTACK' : order.orderType === 'defend_region' ? '🛡️ DEFEND' : '📦 ' + order.orderType.toUpperCase()} {order.targetRegion}
                        </span>
                        <div style={{ fontSize: '7px', color: '#64748b' }}>
                          By {order.issuedBy} • {timeLeft}m left • +{Math.floor((order.damageMultiplier - 1) * 100)}% dmg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#f59e0b' }}>💰 {order.bountyPool.toLocaleString()}</div>
                        <div style={{ fontSize: '7px', color: '#64748b' }}>{order.claimedBy?.length || 0} engaged</div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Quick Actions (officer) */}
              {isOfficer && (
                <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
                  {currentArmy.deployedToBattleId && (
                    <button className="war-btn war-btn--danger" style={{ fontSize: '8px', padding: '4px 8px', flex: 1 }}
                      onClick={() => {
                        const r = armyStore.recallArmy(currentArmy.id)
                        showFb(r.message, r.success)
                      }}
                    >🔙 RECALL</button>
                  )}
                </div>
              )}

              {/* Salary Distribution Config (commander) */}
              {currentArmy.commanderId === player.name && (
                <div style={{ marginTop: '6px', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '7px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '3px' }}>💵 SALARY SPLIT MODE</div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {(['equal', 'by-rank', 'by-damage'] as const).map(mode => (
                      <button key={mode}
                        className={`war-btn war-btn--small ${currentArmy.splitMode === mode ? 'war-btn--primary' : ''}`}
                        style={{ fontSize: '7px', padding: '3px 6px', flex: 1 }}
                        onClick={() => {
                          const r = armyStore.setSplitMode(currentArmy.id, mode)
                          showFb(r.message, r.success)
                        }}
                      >{mode === 'equal' ? '⚖️ EQUAL' : mode === 'by-rank' ? '🎖️ RANK' : '⚔️ DAMAGE'}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ═══════ NO PMC — HEADER ═══════ */
        <div style={{
          padding: '10px 12px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)',
          borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{RANK_ICONS[myRank.rank] || '🪖'}</span>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{myRank.label.toUpperCase()}</div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>Level {player.level}</div>
            </div>
          </div>
          <div style={{ fontSize: '8px', color: '#f59e0b', marginTop: '6px' }}>⚠️ Not enlisted in any PMC. Create or join one below!</div>
        </div>
      )}

      {/* ═══════ CREATE PMC ═══════ */}
      <div className="war-card">
        <div className="war-card__title">➕ CREATE PMC</div>
        <div className="war-create-army">
          <input className="war-input" placeholder="PMC name..." value={newArmyName} onChange={e => setNewArmyName(e.target.value)} />
          <button className="war-btn war-btn--primary" onClick={handleCreateArmy}>CREATE</button>
        </div>
      </div>

      {/* ═══════ AVAILABLE PMCs (if not enlisted) ═══════ */}
      {!currentArmy && myArmies.length > 0 && (
        <div style={{
          padding: '8px', borderRadius: '6px',
          background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.1)',
        }}>
          <div style={{ fontSize: '9px', fontWeight: 900, color: '#3b82f6', fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
            🏴 AVAILABLE PMCs ({myArmies.length})
          </div>
          {myArmies.map(army => {
            const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
            const readyCount = divs.filter(d => d.status === 'ready').length
            return (
              <div key={army.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', marginBottom: '3px', borderRadius: '4px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>🏴 {army.name}</div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>
                    👑 {army.commanderId} • 👥 {army.members.length} • ⚔️ {divs.length} divs • ✅ {readyCount} ready
                  </div>
                </div>
                <button className="war-btn war-btn--primary" style={{ fontSize: '8px', padding: '4px 10px' }}
                  onClick={() => handleEnlist(army.id)}>
                  ENLIST
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════ ALL PMCs LIST (when enlisted, show other PMCs too) ═══════ */}
      {currentArmy && myArmies.length > 1 && (
        <div style={{
          padding: '6px', borderRadius: '6px',
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', letterSpacing: '0.8px', marginBottom: '4px' }}>OTHER PMCs IN COUNTRY ({myArmies.length - 1})</div>
          {myArmies.filter(a => a.id !== currentArmy.id).map(army => {
            const divs = army.divisionIds.map(id => armyStore.divisions[id]).filter(Boolean)
            return (
              <div key={army.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 6px', marginBottom: '2px', borderRadius: '3px',
                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)',
                fontSize: '8px',
              }}>
                <span style={{ color: '#94a3b8', fontWeight: 700 }}>🏴 {army.name}</span>
                <span style={{ color: '#64748b' }}>👥 {army.members.length} • ⚔️ {divs.length}</span>
              </div>
            )
          })}
        </div>
      )}

      {myArmies.length === 0 && !currentArmy && (
        <div style={{ padding: '16px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏴</div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>No PMCs exist in this country yet.</div>
          <div style={{ fontSize: '9px', color: '#475569', marginTop: '4px' }}>Create one above to start coordinating with your allies!</div>
        </div>
      )}
    </div>
  )
}
