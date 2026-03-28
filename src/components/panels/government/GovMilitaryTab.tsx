import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore, NUKE_COST } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useMUStore, type MilitaryUnit } from '../../../stores/muStore'
import { useUIStore } from '../../../stores/uiStore'
import { getCountryName } from '../../../stores/battleStore'
import CountryFlag from '../../shared/CountryFlag'
import RegionPicker from '../../shared/RegionPicker'
import ResourceIcon from '../../shared/ResourceIcon'
import { Shield, Users, Wallet, Crown, Plus, Trash2, ChevronRight, Radiation } from 'lucide-react'

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
    (c.role === 'vicepresident' || c.role === 'defense_minister' || c.role === 'eco_minister' || c.role === 'minister')
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
  const [nukeTarget, setNukeTarget] = useState('')

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

  // Nuclear enrichment data
  const activeWars = world.wars?.filter(w => (w.attacker === iso || w.defender === iso) && w.status === 'active') || []
  const warTargets = activeWars.map(w => w.attacker === iso ? w.defender : w.attacker)
  const nuclearAuthorized = gov?.nuclearAuthorized ?? false
  const countryFund = country?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const hasNukeResources = countryFund.oil >= NUKE_COST.oil && countryFund.scrap >= NUKE_COST.scrap &&
    countryFund.materialX >= NUKE_COST.materialX && countryFund.bitcoin >= NUKE_COST.bitcoin && countryFund.jets >= NUKE_COST.jets

  const enrichmentStartedAt = gov?.enrichmentStartedAt ?? null
  const enrichmentCompletedAt = gov?.enrichmentCompletedAt ?? null
  const isEnriching = !!(enrichmentStartedAt && enrichmentCompletedAt && Date.now() < enrichmentCompletedAt)
  const nukeReady = gov?.nukeReady || (!!(enrichmentCompletedAt && Date.now() >= enrichmentCompletedAt))
  const canStartEnrichment = isPresident && nuclearAuthorized && hasNukeResources && !enrichmentStartedAt && !nukeReady
  const canLaunch = isPresident && nukeReady && nukeTarget !== ''

  // Live countdown tick
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!isEnriching) return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isEnriching])

  const getCountdown = () => {
    if (!enrichmentCompletedAt) return { days: 0, hours: 0, minutes: 0, seconds: 0, pct: 0 }
    const remaining = Math.max(0, enrichmentCompletedAt - Date.now())
    const total = enrichmentCompletedAt - (enrichmentStartedAt || enrichmentCompletedAt)
    const pct = total > 0 ? Math.min(100, ((total - remaining) / total) * 100) : 100
    const days = Math.floor(remaining / 86400000)
    const hours = Math.floor((remaining % 86400000) / 3600000)
    const minutes = Math.floor((remaining % 3600000) / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return { days, hours, minutes, seconds, pct }
  }

  const handleStartEnrichment = async () => {
    if (!canStartEnrichment) return
    if (!confirm('☢️ START NUCLEAR ENRICHMENT PROGRAM?\n\nThis will consume resources from the national treasury and begin a 7-day enrichment process. This action cannot be undone.')) return
    try {
      const res: any = await (await import('../../../api/client')).api.post('/gov/start-enrichment', { countryCode: iso })
      ui.addFloatingText(res.message || '☢️ Enrichment started!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
      // Update local store
      govStore.startEnrichment(iso)
      govStore.fetchGovernment(iso)
    } catch (err: any) {
      ui.addFloatingText(err?.response?.data?.error || err.message || 'Enrichment failed', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
  }

  const handleLaunchNuke = async () => {
    if (!canLaunch) return
    if (!confirm(`☢️ LAUNCH NUCLEAR STRIKE against ${getCountryName(nukeTarget)}?\n\nThis will devastate their infrastructure. This action CANNOT be undone.`)) return
    try {
      const res: any = await (await import('../../../api/client')).api.post('/gov/nuke', { countryCode: iso, targetCode: nukeTarget })
      ui.addFloatingText(res.message || '☢️ NUCLEAR STRIKE LAUNCHED!', window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
      setNukeTarget('')
      govStore.fetchGovernment(iso)
    } catch (err: any) {
      ui.addFloatingText(err?.response?.data?.error || err.message || 'Nuke launch failed', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
  }

  // Determine overall nuke phase for border color
  const nukeBorderColor = nukeReady ? '#22d38a' : isEnriching ? '#f59e0b' : nuclearAuthorized ? '#f59e0b' : '#ef4444'

  const countdown = getCountdown()

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

{/* Stats Bar - reusing same code */}
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

      {/* ── NUCLEAR ENRICHMENT PROGRAM ──────────────────────────────────── */}
      <div className="gov-section" style={{ borderLeft: `3px solid ${nukeBorderColor}`, marginTop: '8px' }}>
        <div className="gov-section__title" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radiation size={14} color="#f59e0b" /> NUCLEAR ENRICHMENT PROGRAM
        </div>

        {/* ─── Phase 1: Authorization Status ─── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px',
          background: nuclearAuthorized ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${nuclearAuthorized ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.15)'}`,
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
            background: nuclearAuthorized ? '#f59e0b' : '#ef4444',
            boxShadow: nuclearAuthorized ? '0 0 8px rgba(245,158,11,0.6)' : 'none',
          }} />
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, color: nuclearAuthorized ? '#f59e0b' : '#ef4444' }}>
              {nuclearAuthorized ? '☢️ ENRICHMENT AUTHORIZED' : '🔒 NOT AUTHORIZED'}
            </div>
            <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>
              {nuclearAuthorized
                ? 'Congress has authorized the enrichment program.'
                : 'Requires congressional vote via Laws → Authorize Nuclear Action.'}
            </div>
          </div>
        </div>

        {/* ─── Phase 2: Resource Requirements ─── */}
        {!isEnriching && !nukeReady && (
          <>
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', letterSpacing: '0.5px' }}>
              ENRICHMENT COST {hasNukeResources ? '✅' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginBottom: '10px' }}>
              {([
                ['oil', 'Oil', NUKE_COST.oil, countryFund.oil],
                ['scrap', 'Scrap', NUKE_COST.scrap, countryFund.scrap],
                ['materialX', 'MatX', NUKE_COST.materialX, countryFund.materialX],
                ['bitcoin', 'BTC', NUKE_COST.bitcoin, countryFund.bitcoin],
                ['jets', 'Jets', NUKE_COST.jets, countryFund.jets],
              ] as [string, string, number, number][]).map(([key, label, cost, have]) => {
                const enough = have >= cost
                return (
                  <div key={key} style={{
                    textAlign: 'center', padding: '6px 2px', borderRadius: '4px',
                    background: enough ? 'rgba(34,211,138,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${enough ? 'rgba(34,211,138,0.2)' : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>
                      <ResourceIcon resourceKey={key} size={14} />
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 800, color: enough ? '#22d38a' : '#ef4444' }}>
                      {Number(have).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '7px', color: '#64748b' }}>/ {Number(cost).toLocaleString()}</div>
                    <div style={{ fontSize: '7px', color: '#64748b', marginTop: '1px' }}>{label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: '7px', color: '#475569', marginBottom: '8px' }}>
              💡 Players can donate resources to the national fund via the Account tab.
            </div>

            {/* Start Enrichment Button */}
            <button
              className="gov-btn"
              disabled={!canStartEnrichment}
              onClick={handleStartEnrichment}
              style={{
                width: '100%', padding: '12px', fontWeight: 900, fontSize: '11px', letterSpacing: '1px',
                background: canStartEnrichment
                  ? 'linear-gradient(135deg, #b45309, #92400e)'
                  : 'linear-gradient(135deg, #374151, #1f2937)',
                border: `1px solid ${canStartEnrichment ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px',
                color: canStartEnrichment ? '#fff' : '#64748b',
                cursor: canStartEnrichment ? 'pointer' : 'not-allowed',
                boxShadow: canStartEnrichment ? '0 0 20px rgba(245,158,11,0.15)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <Radiation size={14} /> START ENRICHMENT PROGRAM
            </button>
            {!isPresident && (
              <div style={{ fontSize: '8px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                ⚠️ Only the President can start enrichment.
              </div>
            )}
          </>
        )}

        {/* ─── Phase 3: Enrichment In Progress (Countdown) ─── */}
        {isEnriching && (
          <div style={{ marginTop: '4px' }}>
            <div style={{
              padding: '12px', borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Radiation size={12} color="#f59e0b" style={{ animation: 'pulse 2s infinite' }} /> ENRICHMENT IN PROGRESS
                </div>
                <div style={{ fontSize: '8px', color: '#64748b' }}>{countdown.pct.toFixed(1)}%</div>
              </div>

              {/* Countdown digits */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
                {[
                  { val: countdown.days, label: 'DAYS' },
                  { val: countdown.hours, label: 'HRS' },
                  { val: countdown.minutes, label: 'MIN' },
                  { val: countdown.seconds, label: 'SEC' },
                ].map(({ val, label }) => (
                  <div key={label} style={{
                    textAlign: 'center', padding: '6px 10px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(245,158,11,0.15)',
                    minWidth: '44px',
                  }}>
                    <div style={{
                      fontSize: '18px', fontWeight: 900, color: '#f59e0b',
                      fontFamily: 'var(--font-display, monospace)',
                      letterSpacing: '1px',
                    }}>
                      {String(val).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '7px', color: '#64748b', letterSpacing: '0.5px', marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${countdown.pct}%`, borderRadius: '3px',
                  background: 'linear-gradient(90deg, #b45309, #f59e0b)',
                  boxShadow: '0 0 8px rgba(245,158,11,0.4)',
                  transition: 'width 1s linear',
                }} />
              </div>
              <div style={{ fontSize: '7px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                ⚛️ Uranium enrichment is underway. Warhead will be ready when the countdown completes.
              </div>
            </div>
          </div>
        )}

        {/* ─── Phase 4: Nuke Ready — Target & Launch ─── */}
        {nukeReady && (
          <div style={{ marginTop: '4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', marginBottom: '8px',
              background: 'rgba(34,211,138,0.08)', border: '1px solid rgba(34,211,138,0.25)',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: '#22d38a', boxShadow: '0 0 8px rgba(34,211,138,0.6)',
              }} />
              <div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#22d38a' }}>☢️ WARHEAD READY</div>
                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '1px' }}>
                  Enrichment complete. The president may now launch a nuclear strike.
                </div>
              </div>
            </div>

            {warTargets.length === 0 ? (
              <div style={{ fontSize: '9px', color: '#64748b', padding: '8px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                ⚠️ No active wars. You must be at war to launch a nuclear strike.
              </div>
            ) : (
              <>
                <div style={{ fontSize: '8px', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', letterSpacing: '0.5px' }}>TARGET COUNTRY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px' }}>
                  {warTargets.map(code => (
                    <button
                      key={code}
                      onClick={() => setNukeTarget(nukeTarget === code ? '' : code)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                        background: nukeTarget === code ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.2)',
                        border: `1px solid ${nukeTarget === code ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '4px', cursor: 'pointer', color: '#e2e8f0', width: '100%',
                      }}
                    >
                      <CountryFlag iso={code} size={16} />
                      <span style={{ fontSize: '10px', fontWeight: 700 }}>{getCountryName(code)}</span>
                      {nukeTarget === code && (
                        <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#f59e0b', fontWeight: 800 }}>☢️ TARGETED</span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  className="gov-btn"
                  disabled={!canLaunch}
                  onClick={handleLaunchNuke}
                  style={{
                    width: '100%', padding: '12px', fontWeight: 900, fontSize: '12px', letterSpacing: '1px',
                    background: canLaunch
                      ? 'linear-gradient(135deg, #dc2626, #991b1b)'
                      : 'linear-gradient(135deg, #374151, #1f2937)',
                    border: `1px solid ${canLaunch ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '6px',
                    color: canLaunch ? '#fff' : '#64748b',
                    cursor: canLaunch ? 'pointer' : 'not-allowed',
                    boxShadow: canLaunch ? '0 0 25px rgba(239,68,68,0.2)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  <Radiation size={16} /> LAUNCH NUCLEAR STRIKE
                </button>
                {!isPresident && (
                  <div style={{ fontSize: '8px', color: '#64748b', textAlign: 'center', marginTop: '4px' }}>
                    ⚠️ Only the President can launch a nuclear strike.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
