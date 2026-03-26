import { useState } from 'react'
import { useMUStore, UPGRADE_TRACKS, type MilitaryUnit, type MUMember, type MUTransaction, type MUDonation, type MUContract, type UpgradeTrack } from '../../stores/muStore'
import { usePlayerStore } from '../../stores/playerStore'
import CountryFlag from '../shared/CountryFlag'
import RegionPicker from '../shared/RegionPicker'
import { getRegionById } from '../../data/regionRegistry'
import { Heart, Users, Crown, Shield, Swords, TrendingUp, Mountain, Wallet, Plus, ArrowDownLeft, ArrowUpRight, FileText, Gift, ScrollText, Star, Award, Zap } from 'lucide-react'

type MUTab = 'home' | 'members' | 'upgrades' | 'vault' | 'applications' | 'contracts' | 'rankings' | 'badges'

// ── Helper: relative time ──
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── No-MU View: Create or Browse ──
function NoUnitView() {
  const [createName, setCreateName] = useState('')
  const [createRegion, setCreateRegion] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const mu = useMUStore()
  const player = usePlayerStore()
  const allUnits = Object.values(mu.units)

  const handleCreate = () => {
    const result = mu.createUnit(createName, createRegion || undefined)
    if (!result.success) {
      alert(result.message)
    }
  }

  const playerCountry = player.countryCode || 'US'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Hero */}
      <div className="war-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏴</div>
        <div style={{ fontSize: '14px', fontWeight: 900, color: '#e2e8f0', letterSpacing: '1px' }}>
          MILITARY UNIT
        </div>
        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
          Join or create a Military Unit to receive bonus damage in combat
        </div>
        <div style={{
          marginTop: '12px', padding: '6px 12px', borderRadius: '6px',
          background: 'rgba(34,211,138,0.08)', border: '1px solid rgba(34,211,138,0.2)',
          fontSize: '10px', fontWeight: 700, color: '#22d38a', display: 'inline-block',
        }}>
          +5% BASE + 1% PER MEMBER (MAX +20%)
        </div>
      </div>

      {/* Create */}
      {!showCreate ? (
        <button
          className="war-btn war-btn--primary"
          style={{ padding: '12px', fontSize: '11px', fontWeight: 900 }}
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} style={{ marginRight: '4px' }} /> CREATE MILITARY UNIT — $50,000
        </button>
      ) : (
        <div className="war-card">
          <div className="war-card__title">🏴 CREATE UNIT</div>
          <input
            className="war-input"
            placeholder="Unit name..."
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            style={{ marginTop: '8px', fontSize: '11px' }}
            maxLength={30}
          />
          <div style={{ marginTop: '8px' }}>
            <RegionPicker
              countryCode={playerCountry}
              value={createRegion}
              onChange={setCreateRegion}
              label="📍 HEADQUARTER REGION"
              className="war-input"
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              className="war-btn war-btn--primary"
              style={{ flex: 1, fontSize: '10px', padding: '8px' }}
              onClick={handleCreate}
              disabled={!createName.trim() || !createRegion || player.money < 50000}
            >
              CONFIRM — $50,000
            </button>
            <button
              className="war-btn"
              style={{ fontSize: '10px', padding: '8px' }}
              onClick={() => setShowCreate(false)}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Browse Units */}
      {allUnits.length > 0 && (
        <div className="war-card">
          <div className="war-card__title">🔍 AVAILABLE UNITS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {allUnits.map(unit => (
              <div key={unit.id} style={{
                padding: '8px', borderRadius: '5px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
                    🏴 {unit.name}
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                    <CountryFlag iso={unit.countryCode} size={12} /> {unit.members.length} Members • Owner: {unit.ownerName}
                  </div>
                </div>
                <button
                  className="war-btn war-btn--primary"
                  style={{ fontSize: '9px', padding: '4px 10px' }}
                  onClick={() => {
                    const r = mu.applyToUnit(unit.id)
                    if (!r.success) alert(r.message)
                  }}
                >
                  APPLY
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Member Health Bar ──
function MemberHealthBar({ member, unitId }: { member: MUMember; unitId: string }) {
  const mu = useMUStore()
  const pct = (member.health / member.maxHealth) * 100
  const color = pct > 60 ? '#22d38a' : pct > 30 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      padding: '8px 10px', borderRadius: '6px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', gap: '4px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {member.role === 'commander' && (
            <Crown size={12} color="#f59e0b" strokeWidth={2.5} />
          )}
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '18px', height: '18px', borderRadius: '50%',
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              fontSize: '8px', fontWeight: 900, color: '#3b82f6', marginRight: '4px',
            }}>
              {member.level}
            </span>
            {member.name}
          </span>
          <CountryFlag iso={member.countryCode} size={14} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '8px', color: '#64748b' }}>{timeAgo(member.lastActive)}</span>
          <button
            onClick={() => mu.helpMember(unitId, member.playerId)}
            style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '4px', padding: '2px 8px', cursor: 'pointer',
              fontSize: '8px', fontWeight: 700, color: '#ef4444',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}
          >
            <Heart size={10} /> HELP
          </button>
        </div>
      </div>

      {/* Health Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Heart size={12} color={color} fill={color} />
        <span style={{ fontSize: '9px', fontWeight: 700, color }}>{member.health}/{member.maxHealth}</span>
        <div style={{
          flex: 1, height: '8px', borderRadius: '4px',
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: '4px',
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            transition: 'width 0.3s',
          }} />
        </div>
      </div>
    </div>
  )
}

// ── Main MUPanel ──
export default function MUPanel() {
  const mu = useMUStore()
  const player = usePlayerStore()
  const unit = mu.getPlayerUnit()
  const [activeTab, setActiveTab] = useState<MUTab>('home')

  // No unit? Show create/join view
  if (!unit) return <NoUnitView />

  const memberCount = unit.members.length
  const commanderCount = unit.members.filter(m => m.role === 'commander').length
  const damageBonus = Math.min(20, 5 + memberCount)
  const pendingApps = unit.applications.filter(a => a.status === 'pending')
  const isCommander = unit.members.some(m => m.name === player.name && m.role === 'commander')
  const isOwner = unit.ownerId === player.name

  const maxMembers = mu.getMaxMembers()

  const tabs: { id: MUTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'home', icon: <Swords size={16} />, label: 'Home' },
    { id: 'members', icon: <Users size={16} />, label: 'Members' },
    { id: 'upgrades', icon: <Zap size={16} />, label: 'Upgrades' },
    { id: 'vault', icon: <Wallet size={16} />, label: 'Vault' },
    { id: 'applications', icon: <ScrollText size={16} />, label: 'Apply', badge: pendingApps.length },
    { id: 'contracts', icon: <FileText size={16} />, label: 'Contracts' },
    { id: 'rankings', icon: <TrendingUp size={16} />, label: 'Rankings' },
    { id: 'badges', icon: <Award size={16} />, label: 'Badges' },
  ]

  // Sort members for rankings
  const sortedByWeekly = [...unit.members].sort((a, b) => b.weeklyDamage - a.weeklyDamage)
  const sortedByTotal = [...unit.members].sort((a, b) => b.totalDamage - a.totalDamage)
  const sortedByTerrain = [...unit.members].sort((a, b) => b.terrain - a.terrain)
  const sortedByWealth = [...unit.members].sort((a, b) => b.wealth - a.wealth)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Hero Banner ── */}
      <div style={{
        position: 'relative', borderRadius: '8px', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9))',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Banner background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '70px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(59,130,246,0.06))',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{
            position: 'absolute', right: '12px', top: '8px', fontSize: '40px', opacity: 0.15,
          }}>🏴‍☠️</div>
        </div>

        <div style={{ position: 'relative', padding: '12px 14px', paddingTop: '18px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '6px',
              background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', flexShrink: 0,
            }}>
              🏴
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600, letterSpacing: '0.5px' }}>
                🏴 Military Unit
              </div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#e2e8f0', marginTop: '1px' }}>
                {unit.name}
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px' }}>
                Owned by <CountryFlag iso={unit.ownerCountry} size={12} /> <strong style={{ color: '#e2e8f0' }}>{unit.ownerName}</strong>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '1px' }}>
                Located in <CountryFlag iso={unit.countryCode} size={12} /> {unit.regionId ? (getRegionById(unit.regionId)?.name ?? unit.locationRegion) : unit.locationRegion}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: '12px', marginTop: '10px',
            fontSize: '9px', color: '#94a3b8',
          }}>
            <span><Users size={11} style={{ verticalAlign: '-2px', marginRight: '3px' }} />{memberCount}/{maxMembers}</span>
            <span><Crown size={11} style={{ verticalAlign: '-2px', marginRight: '3px' }} color="#f59e0b" />{commanderCount} Cmd</span>
            <span style={{ marginLeft: 'auto', color: '#22d38a', fontWeight: 700 }}>
              +{damageBonus}% DMG
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation: 4×2 Icon Grid ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px',
        borderRadius: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px',
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 4px', fontSize: '9px', fontWeight: 700,
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: isActive ? 'rgba(34,211,138,0.12)' : 'transparent',
                color: isActive ? '#22d38a' : '#64748b',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                transition: 'all 0.15s',
                position: 'relative',
                ...(isActive ? { boxShadow: 'inset 0 -2px 0 #22d38a' } : {}),
              }}
            >
              {tab.icon}
              <span style={{ fontSize: '8px', letterSpacing: '0.3px' }}>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '4px',
                  background: '#ef4444', color: '#fff',
                  borderRadius: '50%', width: '14px', height: '14px',
                  fontSize: '7px', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{tab.badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ══ HOME TAB ══ */}
      {activeTab === 'home' && (
        <>
          {/* HELP Section */}
          <div className="war-card">
            <div className="war-card__title" style={{ marginBottom: '8px' }}>HELP</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {unit.members.map(m => (
                <MemberHealthBar key={m.playerId} member={m} unitId={unit.id} />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', justifyContent: 'center' }}>
              <button
                className="war-btn war-btn--primary"
                style={{
                  fontSize: '10px', padding: '8px 16px', fontWeight: 900,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
                onClick={() => mu.helpAll(unit.id)}
              >
                <Heart size={12} /> HELP ALL
              </button>
              <button
                className="war-btn"
                style={{
                  fontSize: '10px', padding: '8px 16px', fontWeight: 900,
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
                onClick={() => mu.askForHelp()}
              >
                <Heart size={12} color="#ef4444" /> ASK FOR HELP
              </button>
            </div>
          </div>

          {/* BUDGET INCOME Section */}
          <div className="war-card" style={{ borderColor: 'rgba(250,204,21,0.15)' }}>
            <div className="war-card__title" style={{ color: '#facc15', marginBottom: '8px' }}>
              <Wallet size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
              BUDGET INCOME
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{
                padding: '8px', borderRadius: '6px',
                background: 'rgba(34,211,138,0.06)', border: '1px solid rgba(34,211,138,0.15)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>VAULT TREASURY</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#22d38a', marginTop: '2px' }}>
                  ${unit.vault.treasury.toLocaleString()}
                </div>
              </div>
              <div style={{
                padding: '8px', borderRadius: '6px',
                background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.15)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>LAST PAYOUT</div>
                <div style={{ fontSize: '14px', fontWeight: 900, color: '#facc15', marginTop: '2px' }}>
                  {(unit.lastBudgetPayout || 0) > 0 ? `+$${unit.lastBudgetPayout.toLocaleString()}` : '—'}
                </div>
              </div>
            </div>
            <div style={{
              marginTop: '8px', padding: '6px 10px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
              fontSize: '8px', color: '#94a3b8', lineHeight: 1.5,
            }}>
              <TrendingUp size={10} style={{ verticalAlign: '-2px', marginRight: '4px', color: '#22d38a' }} />
              <strong style={{ color: '#e2e8f0' }}>{Object.keys(unit.cycleDamage || {}).length}</strong> active fighters this cycle.
              Budget is split proportionally by war damage.
              <span style={{ color: '#64748b' }}> Min 3 fighters to qualify.</span>
            </div>
          </div>
          <div className="war-card">
            <div className="war-card__title" style={{ marginBottom: '8px' }}>RANKINGS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <RankingStat
                label="Weekly damages"
                icon={<Swords size={14} color="#3b82f6" />}
                value={unit.weeklyDamageTotal}
                rank={sortedByWeekly[0]?.name}
              />
              <RankingStat
                label="Total damages"
                icon={<Swords size={14} color="#ef4444" />}
                value={unit.totalDamageTotal}
                rank={sortedByTotal[0]?.name}
              />
              <RankingStat
                label="Terrain"
                icon={<Mountain size={14} color="#22d38a" />}
                value={unit.members.reduce((s, m) => s + m.terrain, 0)}
                rank={sortedByTerrain[0]?.name}
              />
              <RankingStat
                label="Wealth"
                icon={<Wallet size={14} color="#f59e0b" />}
                value={unit.members.reduce((s, m) => s + m.wealth, 0)}
                rank={sortedByWealth[0]?.name}
              />
            </div>
          </div>

          {/* Leave button */}
          <button
            className="war-btn"
            style={{
              fontSize: '9px', padding: '6px', color: '#ef4444',
              borderColor: 'rgba(239,68,68,0.2)',
            }}
            onClick={() => {
              const r = mu.leaveUnit()
              if (!r.success) alert(r.message)
            }}
          >
            LEAVE UNIT
          </button>
        </>
      )}

      {/* ══ MEMBERS TAB (merged from old Account) ══ */}
      {activeTab === 'members' && (
        <div className="war-card">
          <div className="war-card__title" style={{ marginBottom: '8px' }}>
            <Users size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />
            MEMBERS ({memberCount}/{maxMembers})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {unit.members.map(m => (
              <div key={m.playerId} style={{
                padding: '8px 10px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {m.role === 'commander' && <Crown size={12} color="#f59e0b" />}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                    fontSize: '8px', fontWeight: 900, color: '#3b82f6',
                  }}>{m.level}</span>
                  <CountryFlag iso={m.countryCode} size={14} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>{m.name}</span>
                  <span style={{ fontSize: '8px', color: '#64748b' }}>{timeAgo(m.lastActive)}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#22d38a', fontWeight: 700 }}>
                    {m.totalDamage >= 1000 ? `${(m.totalDamage / 1000).toFixed(1)}K` : m.totalDamage} dmg
                  </span>
                  {isOwner && m.playerId !== player.name && (
                    <>
                      {m.role === 'member' ? (
                        <button className="war-btn" style={{ fontSize: '8px', padding: '2px 6px', color: '#f59e0b' }} onClick={() => mu.promoteMember(unit.id, m.playerId)}>↑</button>
                      ) : (
                        <button className="war-btn" style={{ fontSize: '8px', padding: '2px 6px', color: '#64748b' }} onClick={() => mu.demoteMember(unit.id, m.playerId)}>↓</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ UPGRADES TAB ══ */}
      {activeTab === 'upgrades' && (
        <UpgradesTab unit={unit} isCommander={isCommander} isOwner={isOwner} />
      )}

      {/* ══ APPLICATIONS TAB ══ */}
      {activeTab === 'applications' && (
        <div className="war-card">
          <div className="war-card__title" style={{ marginBottom: '8px' }}>
            📋 PENDING APPLICATIONS ({pendingApps.length})
          </div>
          {pendingApps.length === 0 ? (
            <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '16px' }}>
              No pending applications
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pendingApps.map(app => (
                <div key={app.id} style={{
                  padding: '8px', borderRadius: '5px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#e2e8f0' }}>
                        <CountryFlag iso={app.playerCountry} size={14} /> {app.playerName}
                      </span>
                      <span style={{ fontSize: '8px', color: '#64748b', marginLeft: '6px' }}>
                        Lv.{app.playerLevel} • {timeAgo(app.appliedAt)}
                      </span>
                    </div>
                    {(isCommander || isOwner) && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="war-btn war-btn--primary"
                          style={{ fontSize: '8px', padding: '3px 8px' }}
                          onClick={() => mu.acceptApplication(unit.id, app.id)}
                        >
                          ✓ ACCEPT
                        </button>
                        <button
                          className="war-btn"
                          style={{ fontSize: '8px', padding: '3px 8px', color: '#ef4444' }}
                          onClick={() => mu.rejectApplication(unit.id, app.id)}
                        >
                          ✕ REJECT
                        </button>
                      </div>
                    )}
                  </div>
                  {app.message && (
                    <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                      "{app.message}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ VAULT TAB (merged Donations + Transactions) ══ */}
      {activeTab === 'vault' && (
        <DonationsTab unit={unit} isCommander={isCommander} isOwner={isOwner} />
      )}

      {/* ══ RANKINGS TAB ══ */}
      {activeTab === 'rankings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <RankingTable title="⚔️ Weekly Damages" members={sortedByWeekly} field="weeklyDamage" />
          <RankingTable title="⚔️ Total Damages" members={sortedByTotal} field="totalDamage" />
          <RankingTable title="⛰️ Terrain" members={sortedByTerrain} field="terrain" />
          <RankingTable title="💰 Wealth" members={sortedByWealth} field="wealth" />
        </div>
      )}

      {/* ══ BADGES TAB ══ */}
      {activeTab === 'badges' && (
        <div className="war-card">
          <div className="war-card__title" style={{ marginBottom: '8px' }}>BADGES</div>
          {unit.badges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Plus size={24} color="#64748b" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                No badges earned yet. Fight together to unlock badges!
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
              {unit.badges.map(badge => (
                <div key={badge.id} style={{
                  padding: '10px 6px', borderRadius: '6px', textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: '24px' }}>{badge.icon}</div>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0', marginTop: '4px' }}>
                    {badge.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}



      {/* ══ CONTRACTS TAB ══ */}
      {activeTab === 'contracts' && (
        <div className="war-card">
          <div className="war-card__title" style={{ marginBottom: '8px' }}>📄 CONTRACTS</div>
          {unit.contracts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <FileText size={24} color="#64748b" style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                No active contracts. Commanders can create contracts for unit members.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {unit.contracts.map(contract => {
                const statusColors: Record<string, string> = {
                  active: '#22d38a', completed: '#3b82f6', expired: '#64748b',
                }
                return (
                  <div key={contract.id} style={{
                    padding: '10px', borderRadius: '6px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
                          {contract.title}
                        </div>
                        <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                          {contract.description}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '8px', fontWeight: 700, padding: '2px 8px',
                        borderRadius: '4px', textTransform: 'uppercase',
                        background: `${statusColors[contract.status]}15`,
                        color: statusColors[contract.status],
                        border: `1px solid ${statusColors[contract.status]}30`,
                      }}>
                        {contract.status}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginTop: '8px', paddingTop: '6px',
                      borderTop: '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>
                        by {contract.createdBy} • expires {timeAgo(contract.expiresAt)}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 900, color: '#f59e0b' }}>
                        ${contract.reward.toLocaleString()}
                      </span>
                    </div>
                    {contract.assignee && (
                      <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '4px' }}>
                        Assigned to: <strong style={{ color: '#e2e8f0' }}>{contract.assignee}</strong>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Create contract button (commander/owner only) */}
          {(isOwner || isCommander) && (
            <button
              className="war-btn war-btn--primary"
              style={{ width: '100%', marginTop: '10px', fontSize: '10px', padding: '10px', fontWeight: 900 }}
              onClick={() => {
                alert('Contract creation coming soon!')
              }}
            >
              <FileText size={12} style={{ marginRight: '4px' }} /> CREATE CONTRACT
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Upgrades Tab ──
function UpgradesTab({ unit, isCommander, isOwner }: { unit: MilitaryUnit; isCommander: boolean; isOwner: boolean }) {
  const mu = useMUStore()
  const canPurchase = isCommander || isOwner

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Treasury reminder */}
      <div style={{
        padding: '8px 12px', borderRadius: '6px',
        background: 'linear-gradient(135deg, rgba(34,211,138,0.06), rgba(59,130,246,0.04))',
        border: '1px solid rgba(34,211,138,0.15)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>VAULT TREASURY</div>
          <div style={{ fontSize: '14px', fontWeight: 900, color: '#22d38a' }}>
            ${unit.vault.treasury.toLocaleString()}
          </div>
        </div>
        <Wallet size={20} color="#22d38a" />
      </div>

      {/* Upgrade cards */}
      {UPGRADE_TRACKS.map(track => {
        const level = unit.upgrades?.[track.id] ?? 0
        const cost = mu.getUpgradeCost(track.id)
        const bonus = mu.getUpgradeBonus(track.id)
        const isMaxed = level >= track.maxLevel
        const canAfford = cost !== null && unit.vault.treasury >= cost

        return (
          <div key={track.id} className="war-card" style={{
            borderColor: isMaxed ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: isMaxed ? 'rgba(250,204,21,0.12)' : 'rgba(59,130,246,0.1)',
                  border: `1px solid ${isMaxed ? 'rgba(250,204,21,0.3)' : 'rgba(59,130,246,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px',
                }}>
                  {track.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0' }}>
                    {track.name}
                  </div>
                  <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '1px' }}>
                    {track.description}
                  </div>
                </div>
              </div>
              {isMaxed && (
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '8px', fontWeight: 900,
                  background: 'rgba(250,204,21,0.12)', color: '#facc15',
                  border: '1px solid rgba(250,204,21,0.3)',
                }}>MAX</span>
              )}
            </div>

            {/* Level pips */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
              {Array.from({ length: track.maxLevel }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: '6px', borderRadius: '3px',
                  background: i < level
                    ? 'linear-gradient(90deg, #22d38a, #3b82f6)'
                    : 'rgba(255,255,255,0.06)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '9px', color: '#94a3b8' }}>
                Level <strong style={{ color: '#e2e8f0' }}>{level}</strong> / {track.maxLevel}
              </div>
              <div style={{ fontSize: '9px', color: '#22d38a', fontWeight: 700 }}>
                Bonus: {bonus}
              </div>
            </div>

            {/* Purchase button */}
            {!isMaxed && (
              <button
                className="war-btn war-btn--primary"
                style={{
                  width: '100%', fontSize: '10px', padding: '10px', fontWeight: 900,
                  opacity: (!canPurchase || !canAfford) ? 0.4 : 1,
                }}
                disabled={!canPurchase || !canAfford}
                onClick={() => {
                  const r = mu.purchaseUpgrade(track.id)
                  if (!r.success) alert(r.message)
                }}
              >
                <Zap size={12} style={{ marginRight: '4px' }} />
                UPGRADE TO LV.{level + 1} — ${cost?.toLocaleString() ?? '?'}
              </button>
            )}

            {!isMaxed && !canAfford && cost !== null && (
              <div style={{ fontSize: '8px', color: '#ef4444', marginTop: '4px', textAlign: 'center' }}>
                Need ${(cost - unit.vault.treasury).toLocaleString()} more in treasury
              </div>
            )}
            {!isMaxed && !canPurchase && (
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '4px', textAlign: 'center' }}>
                Only commanders/owner can purchase upgrades
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Donations + Vault Tab ──
function DonationsTab({ unit, isCommander, isOwner }: { unit: MilitaryUnit; isCommander: boolean; isOwner: boolean }) {
  const mu = useMUStore()
  const player = usePlayerStore()
  const [donateType, setDonateType] = useState<'money' | 'resource'>('money')
  const [donateAmount, setDonateAmount] = useState('')
  const [donateResource, setDonateResourceId] = useState<string>('wheat')
  const [donateMsg, setDonateMsg] = useState('')
  const [buyResource, setBuyResource] = useState<string>('wheat')
  const [buyAmount, setBuyAmount] = useState('')
  const [buyPrice, setBuyPrice] = useState('')

  // Import RESOURCE_DEFS inline
  const RESOURCE_DEFS = (() => {
    try { return require('../../stores/market/types').RESOURCE_DEFS as { id: string; name: string; icon: string; basePrice: number }[] }
    catch { return [] }
  })()

  const vault = unit.vault
  const vaultEntries = Object.entries(vault.resources).filter(([, qty]) => (qty ?? 0) > 0) as [string, number][]

  const handleDonate = () => {
    const amt = Number(donateAmount)
    if (!amt || amt <= 0) return
    let r
    if (donateType === 'money') {
      r = mu.donateMoney(amt, donateMsg)
    } else {
      r = mu.donateResource(donateResource as any, amt, donateMsg)
    }
    if (r.success) {
      setDonateAmount('')
      setDonateMsg('')
    } else {
      alert(r.message)
    }
  }

  const handleBuy = () => {
    const amt = Number(buyAmount)
    const price = Number(buyPrice)
    if (!amt || !price || amt <= 0 || price <= 0) return
    const r = mu.buyResourceForVault(buyResource as any, amt, price)
    if (r.success) { setBuyAmount(''); setBuyPrice('') }
    else alert(r.message)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* VAULT BALANCE */}
      <div className="war-card">
        <div className="war-card__title" style={{ marginBottom: '8px' }}>🏦 MILITARY VAULT</div>

        {/* Treasury */}
        <div style={{
          padding: '10px', borderRadius: '6px', marginBottom: '8px',
          background: 'linear-gradient(135deg, rgba(34,211,138,0.06), rgba(59,130,246,0.04))',
          border: '1px solid rgba(34,211,138,0.15)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600 }}>TREASURY</div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#22d38a' }}>
              ${vault.treasury.toLocaleString()}
            </div>
          </div>
          <Wallet size={24} color="#22d38a" />
        </div>

        {/* Resource inventory grid */}
        {vaultEntries.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            {vaultEntries.map(([resId, qty]) => {
              const def = RESOURCE_DEFS.find((r: any) => r.id === resId)
              return (
                <div key={resId} style={{
                  padding: '6px', borderRadius: '4px', textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: '16px' }}>{def?.icon || '📦'}</div>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>
                    {qty.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>
                    {def?.name || resId}
                  </div>
                  {(isCommander || isOwner) && (
                    <button
                      style={{
                        marginTop: '3px', background: 'rgba(59,130,246,0.12)',
                        border: '1px solid rgba(59,130,246,0.3)', borderRadius: '3px',
                        padding: '1px 6px', fontSize: '7px', fontWeight: 700, color: '#3b82f6',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const r = mu.distributeResource(resId as any, qty)
                        if (!r.success) alert(r.message)
                      }}
                    >
                      DISTRIBUTE
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center', padding: '8px' }}>
            No resources in vault yet. Donate or buy resources below.
          </div>
        )}
      </div>

      {/* DONATE FORM */}
      <div className="war-card">
        <div className="war-card__title" style={{ marginBottom: '8px' }}>🎁 DONATE</div>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          {(['money', 'resource'] as const).map(t => (
            <button key={t} onClick={() => setDonateType(t)} style={{
              flex: 1, padding: '6px', fontSize: '9px', fontWeight: 700, border: 'none',
              borderRadius: '4px', cursor: 'pointer',
              background: donateType === t ? 'rgba(34,211,138,0.12)' : 'rgba(255,255,255,0.04)',
              color: donateType === t ? '#22d38a' : '#64748b',
            }}>
              {t === 'money' ? '💵 Money' : '📦 Resource'}
            </button>
          ))}
        </div>

        {donateType === 'resource' && (
          <select
            value={donateResource}
            onChange={e => setDonateResourceId(e.target.value)}
            className="war-input"
            style={{ marginBottom: '6px', fontSize: '10px', padding: '6px' }}
          >
            {RESOURCE_DEFS.map((r: any) => (
              <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            className="war-input"
            type="number" min="1"
            placeholder={donateType === 'money' ? 'Amount ($)' : 'Qty'}
            value={donateAmount}
            onChange={e => setDonateAmount(e.target.value)}
            style={{ flex: 1, fontSize: '10px', padding: '6px' }}
          />
          <button
            className="war-btn war-btn--primary"
            style={{ fontSize: '9px', padding: '6px 12px', fontWeight: 900 }}
            onClick={handleDonate}
            disabled={!Number(donateAmount) || Number(donateAmount) <= 0}
          >
            <Gift size={12} /> DONATE
          </button>
        </div>

        <input
          className="war-input"
          placeholder="Message (optional)"
          value={donateMsg}
          onChange={e => setDonateMsg(e.target.value)}
          style={{ marginTop: '4px', fontSize: '9px', padding: '5px' }}
          maxLength={80}
        />
      </div>

      {/* BUY RESOURCES (commanders only) */}
      {(isCommander || isOwner) && (
        <div className="war-card">
          <div className="war-card__title" style={{ marginBottom: '8px' }}>🛒 BUY FOR VAULT</div>
          <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '6px' }}>
            Buy resources using treasury funds (${ vault.treasury.toLocaleString()} available)
          </div>
          <select
            value={buyResource}
            onChange={e => setBuyResource(e.target.value)}
            className="war-input"
            style={{ marginBottom: '4px', fontSize: '10px', padding: '6px' }}
          >
            {RESOURCE_DEFS.map((r: any) => (
              <option key={r.id} value={r.id}>{r.icon} {r.name} (base ${r.basePrice})</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              className="war-input" type="number" min="1"
              placeholder="Qty"
              value={buyAmount}
              onChange={e => setBuyAmount(e.target.value)}
              style={{ flex: 1, fontSize: '10px', padding: '6px' }}
            />
            <input
              className="war-input" type="number" min="0.01" step="0.01"
              placeholder="$/unit"
              value={buyPrice}
              onChange={e => setBuyPrice(e.target.value)}
              style={{ flex: 1, fontSize: '10px', padding: '6px' }}
            />
            <button
              className="war-btn war-btn--primary"
              style={{ fontSize: '9px', padding: '6px 10px', fontWeight: 900 }}
              onClick={handleBuy}
              disabled={!Number(buyAmount) || !Number(buyPrice)}
            >
              BUY
            </button>
          </div>
          {Number(buyAmount) > 0 && Number(buyPrice) > 0 && (
            <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '4px' }}>
              Total: ${(Number(buyAmount) * Number(buyPrice)).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* DONATION HISTORY */}
      <div className="war-card">
        <div className="war-card__title" style={{ marginBottom: '8px' }}>📜 DONATION HISTORY</div>
        {unit.donations.length === 0 ? (
          <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center', padding: '12px' }}>
            No donations yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...unit.donations].reverse().slice(0, 20).map(don => (
              <div key={don.id} style={{
                padding: '6px 8px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Gift size={12} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0' }}>
                      <CountryFlag iso={don.donorCountry} size={11} /> {don.donorName}
                    </div>
                    {don.message && (
                      <div style={{ fontSize: '7px', color: '#94a3b8', fontStyle: 'italic' }}>
                        "{don.message}"
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', fontWeight: 900, color: '#22d38a' }}>
                    +{don.currency === 'money' ? `$${don.amount.toLocaleString()}` : `${don.amount} ${don.currency}`}
                  </div>
                  <div style={{ fontSize: '7px', color: '#64748b' }}>{timeAgo(don.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="war-card">
        <div className="war-card__title" style={{ marginBottom: '8px' }}>💰 TRANSACTIONS</div>
        {unit.transactions.length === 0 ? (
          <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center', padding: '12px' }}>
            No transactions yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...unit.transactions].reverse().slice(0, 20).map(txn => {
              const isIn = txn.type === 'deposit' || txn.type === 'salary'
              return (
                <div key={txn.id} style={{
                  padding: '6px 8px', borderRadius: '4px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isIn
                      ? <ArrowDownLeft size={12} color="#22d38a" />
                      : <ArrowUpRight size={12} color="#ef4444" />}
                    <div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0' }}>{txn.description}</div>
                      <div style={{ fontSize: '7px', color: '#64748b' }}>by {txn.playerName} • {timeAgo(txn.timestamp)}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 900, color: isIn ? '#22d38a' : '#ef4444' }}>
                    {isIn ? '+' : '-'}${txn.amount.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ranking Stat Card (for Home tab grid) ──
function RankingStat({ label, icon, value, rank }: { label: string; icon: React.ReactNode; value: number; rank?: string }) {
  return (
    <div style={{
      padding: '10px', borderRadius: '6px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: '8px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon}
        <span style={{ fontSize: '13px', fontWeight: 900, color: '#e2e8f0' }}>
          {value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString()}
        </span>
      </div>
      {rank && (
        <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '3px' }}>
          ↗ Top: {rank}
        </div>
      )}
    </div>
  )
}

// ── Ranking Table (for Rankings tab) ──
function RankingTable({ title, members, field }: { title: string; members: MUMember[]; field: keyof MUMember }) {
  return (
    <div className="war-card">
      <div className="war-card__title" style={{ marginBottom: '6px' }}>{title}</div>
      {members.map((m, i) => {
        const val = m[field] as number
        return (
          <div key={m.playerId} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 6px', borderRadius: '3px',
            background: i === 0 ? 'rgba(245,158,11,0.06)' : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}>
            <span style={{ fontSize: '9px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '16px', textAlign: 'center', fontWeight: 900,
                color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#475569',
                fontSize: '9px',
              }}>
                {i + 1}
              </span>
              {m.role === 'commander' && <Crown size={10} color="#f59e0b" />}
              <CountryFlag iso={m.countryCode} size={12} />
              {m.name}
            </span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#22d38a' }}>
              {typeof val === 'number' && val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val?.toLocaleString() ?? '0'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
