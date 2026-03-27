import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useMUStore, type MilitaryUnit } from '../../../stores/muStore'
import { useUIStore } from '../../../stores/uiStore'
import CountryFlag from '../../shared/CountryFlag'
import RegionPicker from '../../shared/RegionPicker'
import { Shield, Users, Wallet, Crown, Plus, Trash2, ChevronRight } from 'lucide-react'

export default function GovMilitaryTab() {
  const playerName = usePlayerStore(s => s.name)
  const playerCountryCode = usePlayerStore(s => s.countryCode)
  const govStore = useGovernmentStore()
  const world = useWorldStore()
  const muStore = useMUStore()
  const ui = useUIStore()

  const iso = playerCountryCode || 'US'
  const gov = govStore.governments[iso]
  const country = world.getCountry(iso)

  const presidentName = gov?.president || ''
  const isPresident = !!(playerName && presidentName && playerName === presidentName)
  const citizens = gov?.citizens || []
  const isVPOrMinister = citizens.some((c: any) =>
    (c.id === playerName || c.name === playerName) &&
    (c.role === 'vicepresident' || c.role === 'minister')
  )
  const isCitizenPresident = citizens.some((c: any) =>
    (c.id === playerName || c.name === playerName) && c.role === 'president'
  )
  const isOfficial = isPresident || isCitizenPresident || isVPOrMinister

  // Get state MUs for this country
  const stateMUIds = gov?.stateMilitaryUnits || []
  const stateMUs: MilitaryUnit[] = stateMUIds
    .map((id: string) => muStore.units[id])
    .filter((u: MilitaryUnit | undefined): u is MilitaryUnit => !!u)

  // Also find any MU with isStateOwned matching this country (fallback)
  const allStateMUs = Object.values(muStore.units).filter(
    u => u.isStateOwned && (u.governmentCountryCode === iso || u.countryCode === iso)
  )
  const displayMUs = allStateMUs.length > stateMUs.length ? allStateMUs : stateMUs

  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createRegion, setCreateRegion] = useState('')
  const [expandedMU, setExpandedMU] = useState<string | null>(null)

  const handleCreate = () => {
    const result = muStore.createStateUnit(iso, createName, createRegion || undefined)
    if (result.success) {
      setShowCreate(false)
      setCreateName('')
      setCreateRegion('')
    }
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  const handleDissolve = (unitId: string) => {
    if (!confirm('Are you sure you want to dissolve this State Military Unit? This action is irreversible.')) return
    const result = muStore.dissolveStateUnit(unitId)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
    if (result.success) setExpandedMU(null)
  }

  const handleJoin = (unitId: string) => {
    const result = muStore.joinUnit(unitId)
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? '#22d38a' : '#ef4444')
  }

  const fundBalance = country?.fund.money ?? 0
  const STATE_MU_COST = 100_000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Header */}
      <div className="gov-section gov-section--highlight">
        <div className="gov-section__title gov-section__title--green" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Shield size={12} /> STATE MILITARY UNITS
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: 1.5 }}>
          Government-owned Military Units that persist independently of members. They receive
          <strong style={{ color: '#22d38a' }}> 1.5× budget priority</strong> and only need
          <strong style={{ color: '#22d38a' }}> 1 active fighter</strong> to qualify for payouts.
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px',
      }}>
        <div className="gov-stat-cell">
          <span className="gov-stat-cell__label">State MUs</span>
          <span className="gov-stat-cell__value" style={{ color: '#3b82f6' }}>{displayMUs.length}</span>
        </div>
        <div className="gov-stat-cell">
          <span className="gov-stat-cell__label">Total Members</span>
          <span className="gov-stat-cell__value" style={{ color: '#22d38a' }}>
            {displayMUs.reduce((s, u) => s + u.members.length, 0)}
          </span>
        </div>
        <div className="gov-stat-cell">
          <span className="gov-stat-cell__label">Nat. Fund</span>
          <span className="gov-stat-cell__value" style={{ color: '#f59e0b' }}>
            ${fundBalance >= 1000 ? `${(fundBalance / 1000).toFixed(0)}K` : fundBalance.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Create Button / Form */}
      {isOfficial && !showCreate && (
        <button
          className="gov-btn gov-btn--primary"
          style={{
            width: '100%', padding: '10px', fontSize: '10px', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            opacity: fundBalance < STATE_MU_COST ? 0.5 : 1,
          }}
          onClick={() => setShowCreate(true)}
          disabled={fundBalance < STATE_MU_COST}
        >
          <Plus size={14} /> CREATE STATE MU — ${STATE_MU_COST.toLocaleString()} FROM FUND
        </button>
      )}

      {showCreate && (
        <div className="gov-section" style={{ borderColor: 'rgba(34,211,138,0.2)' }}>
          <div className="gov-section__title gov-section__title--green">
            <Shield size={10} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
            CREATE STATE MILITARY UNIT
          </div>
          <input
            className="gov-input"
            placeholder="Unit name..."
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            maxLength={30}
            style={{ width: '100%', marginTop: '6px', boxSizing: 'border-box' }}
          />
          <div style={{ marginTop: '6px' }}>
            <RegionPicker
              countryCode={iso}
              value={createRegion}
              onChange={setCreateRegion}
              label="📍 HEADQUARTER REGION"
              className="gov-input"
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              className="gov-btn gov-btn--fill-green"
              style={{
                flex: 1, padding: '8px', fontSize: '10px', fontWeight: 900,
                opacity: (!createName.trim() || fundBalance < STATE_MU_COST) ? 0.4 : 1,
              }}
              disabled={!createName.trim() || fundBalance < STATE_MU_COST}
              onClick={handleCreate}
            >
              CONFIRM — ${STATE_MU_COST.toLocaleString()}
            </button>
            <button
              className="gov-btn gov-btn--red"
              style={{ padding: '8px', fontSize: '10px' }}
              onClick={() => { setShowCreate(false); setCreateName(''); setCreateRegion('') }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* MU List */}
      {displayMUs.length === 0 ? (
        <div className="gov-section" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <Shield size={28} color="#3e4a5c" style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            No state-owned Military Units yet.
            {isOfficial ? ' Use the button above to create one.' : ' Only government officials can create them.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {displayMUs.map(mu => {
            const isExpanded = expandedMU === mu.id
            const memberCount = mu.members.length
            const commanders = mu.members.filter(m => m.role === 'commander')
            const playerInUnit = muStore.playerUnitId === mu.id

            return (
              <div key={mu.id} className="gov-section" style={{
                borderColor: isExpanded ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
                transition: 'border-color 0.2s',
              }}>
                {/* Clickable Header Row */}
                <button
                  onClick={() => setExpandedMU(isExpanded ? null : mu.id)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#e2e8f0', padding: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '6px',
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', flexShrink: 0,
                    }}>
                      🏛️
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800 }}>{mu.name}</div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>
                        <Users size={9} style={{ verticalAlign: '-1px', marginRight: '2px' }} />
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                        {commanders.length > 0 && (
                          <> • <Crown size={9} color="#f59e0b" style={{ verticalAlign: '-1px', marginRight: '1px' }} />
                          {commanders.map(c => c.name).join(', ')}</>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, color: '#22d38a',
                    }}>
                      <Wallet size={10} style={{ verticalAlign: '-1px', marginRight: '2px' }} />
                      ${mu.vault.treasury.toLocaleString()}
                    </span>
                    <ChevronRight size={14} color="#475569" style={{
                      transition: 'transform 0.2s',
                      transform: isExpanded ? 'rotate(90deg)' : 'none',
                    }} />
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                      <div className="gov-stat-cell">
                        <span className="gov-stat-cell__label">Vault</span>
                        <span className="gov-stat-cell__value" style={{ color: '#22d38a', fontSize: '10px' }}>
                          ${mu.vault.treasury.toLocaleString()}
                        </span>
                      </div>
                      <div className="gov-stat-cell">
                        <span className="gov-stat-cell__label">Last Payout</span>
                        <span className="gov-stat-cell__value" style={{ color: '#facc15', fontSize: '10px' }}>
                          {mu.lastBudgetPayout > 0 ? `+$${mu.lastBudgetPayout.toLocaleString()}` : '—'}
                        </span>
                      </div>
                      <div className="gov-stat-cell">
                        <span className="gov-stat-cell__label">Total DMG</span>
                        <span className="gov-stat-cell__value" style={{ color: '#ef4444', fontSize: '10px' }}>
                          {mu.totalDamageTotal >= 1000 ? `${(mu.totalDamageTotal / 1000).toFixed(1)}K` : mu.totalDamageTotal}
                        </span>
                      </div>
                    </div>

                    {/* Members List */}
                    {memberCount > 0 ? (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          MEMBERS ({memberCount})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {mu.members.map(m => (
                            <div key={m.playerId} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '4px 6px', borderRadius: '3px',
                              background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {m.role === 'commander' && <Crown size={10} color="#f59e0b" />}
                                <CountryFlag iso={m.countryCode} size={12} />
                                <span style={{ fontSize: '9px', fontWeight: 700, color: '#e2e8f0' }}>{m.name}</span>
                                <span style={{ fontSize: '8px', color: '#64748b' }}>Lv.{m.level}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                <span style={{ fontSize: '8px', color: '#22d38a', fontWeight: 700 }}>
                                  {m.totalDamage >= 1000 ? `${(m.totalDamage / 1000).toFixed(1)}K` : m.totalDamage} dmg
                                </span>
                                {isOfficial && m.name !== playerName && (
                                  <>
                                    {m.role === 'member' ? (
                                      <button
                                        className="gov-btn gov-btn--amber"
                                        style={{ fontSize: '7px', padding: '1px 5px' }}
                                        onClick={() => muStore.promoteMember(mu.id, m.playerId)}
                                        title="Promote to Commander"
                                      >↑ CMD</button>
                                    ) : (
                                      <button
                                        className="gov-btn"
                                        style={{ fontSize: '7px', padding: '1px 5px', color: '#64748b' }}
                                        onClick={() => muStore.demoteMember(mu.id, m.playerId)}
                                        title="Demote to Member"
                                      >↓</button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px', borderRadius: '4px', textAlign: 'center', marginBottom: '10px',
                        background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)',
                      }}>
                        <div style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 700 }}>⚠️ NO MEMBERS</div>
                        <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>
                          This unit is empty. Citizens can join from the MU panel.
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {/* Join / Open MU Panel */}
                      {!playerInUnit && !muStore.playerUnitId && (
                        <button
                          className="gov-btn gov-btn--primary"
                          style={{ flex: 1, fontSize: '9px', padding: '7px', fontWeight: 800 }}
                          onClick={() => handleJoin(mu.id)}
                        >
                          <Users size={11} style={{ marginRight: '3px', verticalAlign: '-2px' }} /> JOIN UNIT
                        </button>
                      )}
                      {playerInUnit && (
                        <button
                          className="gov-btn gov-btn--green"
                          style={{ flex: 1, fontSize: '9px', padding: '7px', fontWeight: 800 }}
                          onClick={() => ui.togglePanel('mu')}
                        >
                          <ChevronRight size={11} style={{ marginRight: '3px', verticalAlign: '-2px' }} /> OPEN MU PANEL
                        </button>
                      )}

                      {/* Dissolve (President only) */}
                      {isPresident && (
                        <button
                          className="gov-btn gov-btn--red"
                          style={{ fontSize: '9px', padding: '7px', fontWeight: 800 }}
                          onClick={() => handleDissolve(mu.id)}
                        >
                          <Trash2 size={11} style={{ marginRight: '3px', verticalAlign: '-2px' }} /> DISSOLVE
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
