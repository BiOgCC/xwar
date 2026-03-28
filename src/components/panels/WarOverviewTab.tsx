import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useUIStore } from '../../stores/uiStore'
import { useRegionStore } from '../../stores/regionStore'
import { useBattleStore, TACTICAL_ORDERS, getCountryName } from '../../stores/battleStore'
import { useTacticalOpsStore, COUNTRY_OPS, PLAYER_OPS, ALL_OPS } from '../../stores/tacticalOpsStore'
import { useSpecializationStore } from '../../stores/specializationStore'
import CountryFlag from '../shared/CountryFlag'
import { Shield, Landmark, Anchor, Plane, Rocket, Crosshair, ShieldAlert, Target, Zap, Swords } from 'lucide-react'
import type { TacticalOrder } from '../../types/battle.types'

// ═══════════════════════════════════════════════════════════
//  ATTACK COMMAND CENTER — Region-aware HQ tab
// ═══════════════════════════════════════════════════════════

export default function WarOverviewTab({ iso }: { iso: string }) {
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const regionStore = useRegionStore()
  const battleStore = useBattleStore()
  const tOps = useTacticalOpsStore()
  const specStore = useSpecializationStore()

  const selectedRegionId = ui.selectedRegionId
  const region = selectedRegionId ? regionStore.regions.find(r => r.id === selectedRegionId) : null

  const [selectedOrder, setSelectedOrder] = useState<TacticalOrder>('none')
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set())
  const [launchMsg, setLaunchMsg] = useState<{ text: string; color: string } | null>(null)

  const toggleOp = (opId: string) => {
    setSelectedOps(prev => {
      const next = new Set(prev)
      if (next.has(opId)) next.delete(opId); else next.add(opId)
      return next
    })
  }

  // Is this a valid enemy target?
  const playerIso = player.countryCode || 'US'
  const isEnemy = region && !region.isOcean && region.controlledBy !== playerIso

  // Own country data
  const myCountry = world.getCountry(playerIso)
  const myGov = govStore.governments[playerIso]
  const myFund = myCountry?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }

  // Shared styles
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 7, fontWeight: 700, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }
  const sectionStyle: React.CSSProperties = { padding: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }
  const sectionTitle = (icon: string, text: string, color = '#e2e8f0') => (
    <div style={{ fontSize: '9px', fontWeight: 900, color, fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '6px' }}>
      {icon} {text}
    </div>
  )

  // ── FALLBACK: no region selected ──
  if (!region || !isEnemy) {
    return (
      <div style={{ padding: '30px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🎯</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.08em', marginBottom: 8 }}>
          ATTACK COMMAND CENTER
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#64748b', letterSpacing: '0.05em', lineHeight: 1.6 }}>
          Select an enemy region on the map and click<br />"⚔️ Attack Region" to plan your offensive.
        </div>
      </div>
    )
  }

  // ── TARGET DATA ──
  const targetIso = region.controlledBy
  const targetCountryName = getCountryName(targetIso)
  const targetCountry = world.getCountry(targetIso)
  const targetFund = targetCountry?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
  const targetGov = govStore.governments[targetIso]

  // Active war check
  const hasWar = world.wars.some(w =>
    w.status === 'active' &&
    ((w.attacker === playerIso && w.defender === targetIso) ||
     (w.attacker === targetIso && w.defender === playerIso))
  )

  // Active battles in this region
  const regionBattles = Object.values(battleStore.battles).filter(b =>
    b.status === 'active' && (b.regionId === region.id || b.regionName === region.name)
  )

  // Tactical ops effects on target
  const activeEffects = tOps.getActiveEffectsForCountry(targetIso)

  // Intel reports for target
  const intelReports = tOps.reports.filter(r => r.targetCountry === targetIso).slice(0, 5)

  // Magic tea status
  const now = Date.now()
  const teaBuffActive = now < player.magicTeaBuffUntil
  const teaDebuffActive = !teaBuffActive && now < player.magicTeaDebuffUntil

  // Specialization
  const milTier = specStore.getMilitaryTier()
  const milBonuses = specStore.getMilitaryBonuses()

  // Nuke status
  const nukeAuthorized = myGov?.nuclearAuthorized || false
  const enrichStarted = myGov?.enrichmentStartedAt || null
  const enrichCompleted = myGov?.enrichmentCompletedAt || null
  const nukeReady = myGov?.nukeReady || false

  // INFRA for both sides
  const INFRA_KEYS = [
    { key: 'bunkerLevel' as const, label: 'Bunker', Icon: Shield, color: '#22d38a' },
    { key: 'militaryBaseLevel' as const, label: 'Mil. Base', Icon: Landmark, color: '#ef4444' },
    { key: 'portLevel' as const, label: 'Port', Icon: Anchor, color: '#0ea5e9' },
    { key: 'airportLevel' as const, label: 'Airport', Icon: Plane, color: '#a855f7' },
    { key: 'missileLauncherLevel' as const, label: 'Missile', Icon: Rocket, color: '#f97316' },
  ] as const

  // Find the nearest own region for infra comparison
  const ownRegions = regionStore.regions.filter(r => r.controlledBy === playerIso && !r.isOcean)
  const adjacentOwnRegion = ownRegions.find(r => region.adjacent.includes(r.id))
  const bestOwnRegion = adjacentOwnRegion || ownRegions[0]

  // Helper: format time remaining
  const fmtTimeLeft = (ts: number) => {
    const ms = ts - now
    if (ms <= 0) return 'EXPIRED'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
    return `${h}h ${m}m`
  }

  return (
    <div className="war-overview">

      {/* ══════ 1. TARGET REGION HEADER ══════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', marginBottom: '8px',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0.25) 100%)',
        borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CountryFlag iso={targetIso} size={24} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', letterSpacing: '0.8px' }}>
              ⚔️ {region.name.toUpperCase()}
            </div>
            <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'var(--font-display)' }}>
              Controlled by {targetCountryName}
            </div>
          </div>
        </div>
        <div style={{
          padding: '3px 8px', borderRadius: '4px',
          background: hasWar ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
          border: `1px solid ${hasWar ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          <div style={{ fontSize: '8px', fontWeight: 900, color: hasWar ? '#ef4444' : '#f59e0b', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
            {hasWar ? '⚔️ AT WAR' : '🕊️ NO WAR'}
          </div>
        </div>
      </div>

      {/* Active battles badge */}
      {regionBattles.length > 0 && (
        <div style={{
          padding: '5px 10px', marginBottom: '8px', borderRadius: '4px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: '8px', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-display)',
          letterSpacing: '0.8px', textAlign: 'center',
        }}>
          💥 {regionBattles.length} ACTIVE BATTLE{regionBattles.length > 1 ? 'S' : ''} IN THIS REGION
        </div>
      )}

      {/* Target region infrastructure */}
      <div style={sectionStyle}>
        {sectionTitle('🏗️', 'ENEMY DEFENSES')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
          {INFRA_KEYS.map(inf => {
            const level = region[inf.key] || 0
            const enabled = region.infraEnabled?.[inf.key] !== false
            return (
              <div key={inf.key} style={{
                textAlign: 'center', padding: '5px 2px',
                background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
                opacity: enabled ? 1 : 0.4,
              }}>
                <inf.Icon size={14} color={level > 0 ? inf.color : '#334155'} />
                <div style={{ fontSize: '11px', fontWeight: 900, color: level > 0 ? inf.color : '#475569', fontFamily: 'var(--font-display)', marginTop: 2 }}>
                  {level}
                </div>
                <div style={{ fontSize: '6px', color: '#64748b', fontWeight: 700 }}>{inf.label}</div>
                {!enabled && level > 0 && <div style={{ fontSize: '5px', color: '#ef4444', fontWeight: 700 }}>OFF</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ══════ 2. TACTICAL ORDERS AVAILABLE ══════ */}
      <div style={sectionStyle}>
        {sectionTitle('📋', 'TACTICAL ORDERS')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {(Object.entries(TACTICAL_ORDERS) as [TacticalOrder, typeof TACTICAL_ORDERS[TacticalOrder]][])
            .filter(([key]) => key !== 'none')
            .map(([key, order]) => {
              const isSelected = selectedOrder === key
              return (
                <button key={key} onClick={() => setSelectedOrder(isSelected ? 'none' : key)} style={{
                  padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left',
                  background: isSelected ? `${order.color}15` : 'rgba(0,0,0,0.3)',
                  border: isSelected ? `2px solid ${order.color}` : `1px solid ${order.color}20`,
                  outline: 'none', transition: 'all 0.15s ease',
                  boxShadow: isSelected ? `0 0 12px ${order.color}30` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isSelected ? order.color : 'transparent',
                      border: `2px solid ${order.color}`,
                      transition: 'background 0.15s ease',
                    }} />
                    <span style={{ fontSize: '8px', fontWeight: 900, color: order.color, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
                      {order.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '7px', color: isSelected ? '#cbd5e1' : '#94a3b8', fontFamily: 'var(--font-display)' }}>
                    {order.desc}
                  </div>
                </button>
              )
            })}
        </div>
        {selectedOrder !== 'none' && (
          <div style={{ marginTop: 5, padding: '4px 8px', borderRadius: 4, background: `${TACTICAL_ORDERS[selectedOrder].color}10`, border: `1px solid ${TACTICAL_ORDERS[selectedOrder].color}25` }}>
            <div style={{ fontSize: '7px', fontWeight: 800, color: TACTICAL_ORDERS[selectedOrder].color, fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
              ✓ {TACTICAL_ORDERS[selectedOrder].label} SELECTED — {TACTICAL_ORDERS[selectedOrder].desc}
            </div>
          </div>
        )}
      </div>

      {/* ══════ 3. TACTICAL OPERATIONS ══════ */}
      <div style={{ ...sectionStyle, borderColor: 'rgba(168,85,247,0.15)' }}>
        {sectionTitle('🎯', 'TACTICAL OPERATIONS', '#a855f7')}

        {/* Active effects on target */}
        {activeEffects.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <div style={labelStyle}>ACTIVE ON ENEMY</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
              {activeEffects.map(eff => {
                const def = ALL_OPS.find(o => o.id === eff.opId)
                return (
                  <span key={eff.id} style={{
                    fontSize: '7px', fontWeight: 700, color: '#22d38a',
                    background: 'rgba(34,211,138,0.1)', padding: '2px 6px', borderRadius: 3,
                    fontFamily: 'var(--font-display)',
                  }}>
                    {def?.icon} {def?.name || eff.effectType} — {fmtTimeLeft(eff.expiresAt)}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Country Ops */}
        <div style={labelStyle}>COUNTRY OPS (President)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 3, marginBottom: 8 }}>
          {COUNTRY_OPS.map(op => {
            const funding = tOps.getFunding(playerIso, op.id as any)
            const funded = funding?.status === 'ready'
            const launched = funding?.status === 'launched'
            const pct = funding ? Math.round((funding.totalPoints / funding.required) * 100) : 0
            const isActive = activeEffects.some(e => e.opId === op.id)
            const isSelected = selectedOps.has(op.id)
            const canSelect = funded && !launched && !isActive
            return (
              <button key={op.id} onClick={() => canSelect && toggleOp(op.id)} disabled={!canSelect} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px',
                background: isSelected ? 'rgba(168,85,247,0.12)' : 'rgba(0,0,0,0.25)',
                border: isSelected ? '2px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.03)',
                borderRadius: 4, cursor: canSelect ? 'pointer' : 'default',
                opacity: canSelect || isActive ? 1 : 0.5, textAlign: 'left',
                transition: 'all 0.15s ease', outline: 'none',
                boxShadow: isSelected ? '0 0 10px rgba(168,85,247,0.2)' : 'none',
              }}>
                {/* Checkbox */}
                <div style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${isSelected ? '#a855f7' : isActive ? '#22d38a' : canSelect ? '#64748b' : '#334155'}`,
                  background: isSelected ? '#a855f7' : isActive ? '#22d38a' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  {(isSelected || isActive) && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12 }}>{op.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: isSelected ? '#c4b5fd' : '#e2e8f0', fontFamily: 'var(--font-display)' }}>{op.name}</div>
                  <div style={{ fontSize: '6px', color: '#64748b' }}>{op.effectDescription}</div>
                </div>
                <div style={{
                  fontSize: '7px', fontWeight: 900, fontFamily: 'var(--font-display)',
                  color: isActive ? '#22d38a' : funded ? '#a855f7' : '#f59e0b',
                  padding: '2px 5px', borderRadius: 3,
                  background: isActive ? 'rgba(34,211,138,0.1)' : funded ? 'rgba(168,85,247,0.1)' : 'rgba(245,158,11,0.1)',
                }}>
                  {isActive ? '✅ ACTIVE' : launched ? '🚀 LAUNCHED' : funded ? '✔ READY' : funding ? `${pct}%` : 'UNFUNDED'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Player Ops */}
        <div style={labelStyle}>PLAYER OPS (Solo)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 3 }}>
          {PLAYER_OPS.map(op => {
            const chance = tOps.getSuccessChance(op.id)
            const isActive = activeEffects.some(e => e.opId === op.id)
            const isSelected = selectedOps.has(op.id)
            const canSelect = !isActive
            return (
              <button key={op.id} onClick={() => canSelect && toggleOp(op.id)} disabled={!canSelect} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px',
                background: isSelected ? 'rgba(168,85,247,0.12)' : 'rgba(0,0,0,0.25)',
                border: isSelected ? '2px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.03)',
                borderRadius: 4, cursor: canSelect ? 'pointer' : 'default',
                opacity: canSelect ? 1 : 0.6, textAlign: 'left',
                transition: 'all 0.15s ease', outline: 'none',
                boxShadow: isSelected ? '0 0 10px rgba(168,85,247,0.2)' : 'none',
              }}>
                {/* Checkbox */}
                <div style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${isSelected ? '#a855f7' : isActive ? '#22d38a' : '#64748b'}`,
                  background: isSelected ? '#a855f7' : isActive ? '#22d38a' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  {(isSelected || isActive) && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontSize: 12 }}>{op.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '8px', fontWeight: 800, color: isSelected ? '#c4b5fd' : '#e2e8f0', fontFamily: 'var(--font-display)' }}>{op.name}</div>
                  <div style={{ fontSize: '6px', color: '#64748b' }}>{op.effectDescription}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: '7px', color: isSelected ? '#c4b5fd' : '#64748b', fontFamily: 'var(--font-display)' }}>
                    {op.cost.bitcoin}₿ {op.cost.badgesOfHonor}🎖️
                  </span>
                  <span style={{
                    fontSize: '7px', fontWeight: 900, fontFamily: 'var(--font-display)',
                    color: isActive ? '#22d38a' : chance >= 70 ? '#22d38a' : '#f59e0b',
                  }}>
                    {isActive ? 'ACTIVE' : `${Math.round(chance)}%`}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Summary of selected ops */}
        {selectedOps.size > 0 && (
          <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div style={{ fontSize: '7px', fontWeight: 800, color: '#a855f7', fontFamily: 'var(--font-display)', letterSpacing: '0.5px' }}>
              ✓ {selectedOps.size} OP{selectedOps.size > 1 ? 'S' : ''} QUEUED: {Array.from(selectedOps).map(id => ALL_OPS.find(o => o.id === id)?.icon).join(' ')}
            </div>
          </div>
        )}
      </div>

      {/* ══════ 4. INFRA COMPARISON ══════ */}
      <div style={sectionStyle}>
        {sectionTitle('⚖️', 'INFRASTRUCTURE COMPARISON')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'center' }}>
          {/* Header row */}
          <div style={{ fontSize: '7px', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--font-display)', textAlign: 'center', letterSpacing: '0.5px', paddingBottom: 4 }}>
            <CountryFlag iso={playerIso} size={10} /> YOU
          </div>
          <div style={{ fontSize: '7px', color: '#475569', fontFamily: 'var(--font-display)', textAlign: 'center', paddingBottom: 4 }}>VS</div>
          <div style={{ fontSize: '7px', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-display)', textAlign: 'center', letterSpacing: '0.5px', paddingBottom: 4 }}>
            <CountryFlag iso={targetIso} size={10} /> ENEMY
          </div>

          {/* Rows */}
          {INFRA_KEYS.map(inf => {
            const ours = bestOwnRegion ? (bestOwnRegion[inf.key] || 0) : 0
            const theirs = region[inf.key] || 0
            const oursWin = ours > theirs
            const even = ours === theirs
            return [
              <div key={`${inf.key}-ours`} style={{
                textAlign: 'center', padding: '3px 0', fontSize: '11px', fontWeight: 900,
                color: oursWin ? '#22d38a' : even ? '#94a3b8' : '#ef4444',
                fontFamily: 'var(--font-display)',
              }}>{ours}</div>,
              <div key={`${inf.key}-label`} style={{
                textAlign: 'center', padding: '3px 6px', fontSize: '7px', fontWeight: 700,
                color: '#64748b', fontFamily: 'var(--font-display)',
              }}>
                <inf.Icon size={10} color={inf.color} style={{ verticalAlign: 'middle' }} /> {inf.label}
              </div>,
              <div key={`${inf.key}-theirs`} style={{
                textAlign: 'center', padding: '3px 0', fontSize: '11px', fontWeight: 900,
                color: theirs > ours ? '#ef4444' : even ? '#94a3b8' : '#22d38a',
                fontFamily: 'var(--font-display)',
              }}>{theirs}</div>,
            ]
          })}
        </div>
      </div>

      {/* ══════ 5. WAR READINESS — OWN RESOURCES ══════ */}
      <div style={{ ...sectionStyle, borderColor: 'rgba(245,158,11,0.15)' }}>
        {sectionTitle('💰', 'WAR READINESS', '#f59e0b')}

        {/* Country Fund */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', marginBottom: 8 }}>
          {([
            ['🪙', 'Money', myFund.money],
            ['🛢️', 'Oil', myFund.oil],
            ['🔩', 'Scrap', myFund.scrap],
            ['⚛️', 'MatX', myFund.materialX],
            ['₿', 'BTC', myFund.bitcoin],
            ['✈️', 'Jets', myFund.jets],
          ] as const).map(([icon, label, val]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 5px',
              background: 'rgba(0,0,0,0.3)', borderRadius: 3,
            }}>
              <span style={{ fontSize: 9 }}>{icon}</span>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-display)' }}>{Number(val).toLocaleString()}</div>
                <div style={{ fontSize: '5px', color: '#64748b', fontWeight: 700 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Nuke Status */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <div style={{
            flex: 1, padding: '5px 6px', borderRadius: 4,
            background: nukeReady ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.3)',
            border: `1px solid ${nukeReady ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <div style={labelStyle}>☢️ NUCLEAR</div>
            <div style={{
              fontSize: '9px', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 2,
              color: nukeReady ? '#ef4444' : enrichStarted ? '#f59e0b' : nukeAuthorized ? '#3b82f6' : '#475569',
            }}>
              {nukeReady ? '🔴 READY' :
                enrichStarted && enrichCompleted ? `⏳ ${fmtTimeLeft(enrichCompleted)}` :
                nukeAuthorized ? '🟢 AUTHORIZED' : '⬜ NOT AUTHORIZED'}
            </div>
          </div>

          {/* Magic Tea */}
          <div style={{
            flex: 1, padding: '5px 6px', borderRadius: 4,
            background: teaBuffActive ? 'rgba(168,85,247,0.1)' : teaDebuffActive ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.3)',
            border: `1px solid ${teaBuffActive ? 'rgba(168,85,247,0.3)' : teaDebuffActive ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <div style={labelStyle}>🍵 MAGIC TEA ({player.magicTea})</div>
            <div style={{
              fontSize: '9px', fontWeight: 900, fontFamily: 'var(--font-display)', marginTop: 2,
              color: teaBuffActive ? '#a855f7' : teaDebuffActive ? '#ef4444' : '#475569',
            }}>
              {teaBuffActive ? `+80% DMG — ${fmtTimeLeft(player.magicTeaBuffUntil)}` :
                teaDebuffActive ? `💤 HANGOVER — ${fmtTimeLeft(player.magicTeaDebuffUntil)}` :
                player.magicTea > 0 ? 'AVAILABLE' : 'NONE'}
            </div>
          </div>
        </div>

        {/* Specialization */}
        <div style={{
          padding: '5px 8px', borderRadius: 4,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={labelStyle}>🎖️ SPECIALIZATION</div>
              <div style={{ fontSize: '9px', fontWeight: 900, color: '#e2e8f0', fontFamily: 'var(--font-display)', marginTop: 1 }}>
                {milTier.label} (Tier {milTier.tier})
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {milBonuses.damagePercent > 0 && (
                <span style={{ fontSize: '7px', fontWeight: 700, color: '#22d38a', background: 'rgba(34,211,138,0.1)', padding: '2px 5px', borderRadius: 3, fontFamily: 'var(--font-display)' }}>
                  +{milBonuses.damagePercent}% DMG
                </span>
              )}
              {milBonuses.critRatePercent > 0 && (
                <span style={{ fontSize: '7px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 5px', borderRadius: 3, fontFamily: 'var(--font-display)' }}>
                  +{milBonuses.critRatePercent}% CRIT
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ 6. INTEL REPORTS ══════ */}
      <div style={{ ...sectionStyle, borderColor: 'rgba(96,165,250,0.15)' }}>
        {sectionTitle('🧠', `INTEL ON ${targetCountryName.toUpperCase()}`, '#60a5fa')}

        {intelReports.length === 0 ? (
          <div style={{ padding: '8px', textAlign: 'center', fontSize: '8px', color: '#475569', fontFamily: 'var(--font-display)' }}>
            No intelligence reports. Run Resource Intel or War Intel ops to gather data.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {intelReports.map(report => {
              const data = report.data
              const age = now - report.timestamp
              const ageStr = age < 3600000 ? `${Math.floor(age / 60000)}m ago` : `${Math.floor(age / 3600000)}h ago`
              return (
                <div key={report.id} style={{
                  padding: '5px 8px', borderRadius: 4,
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(96,165,250,0.1)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: '8px', fontWeight: 800, color: '#60a5fa', fontFamily: 'var(--font-display)' }}>
                      {data.type || report.opId}
                    </span>
                    <span style={{ fontSize: '6px', color: '#475569', fontFamily: 'var(--font-display)' }}>{ageStr}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {data.treasury !== undefined && (
                      <span style={{ fontSize: '7px', color: '#fbbf24', fontFamily: 'var(--font-display)' }}>💰 ${Number(data.treasury).toLocaleString()}</span>
                    )}
                    {data.oilReserves !== undefined && (
                      <span style={{ fontSize: '7px', color: '#a855f7', fontFamily: 'var(--font-display)' }}>🛢️ {Number(data.oilReserves).toLocaleString()}</span>
                    )}
                    {data.bunkerLevel !== undefined && (
                      <span style={{ fontSize: '7px', color: '#22d38a', fontFamily: 'var(--font-display)' }}>🛡️ Bk.{data.bunkerLevel}</span>
                    )}
                    {data.militaryBaseLevel !== undefined && (
                      <span style={{ fontSize: '7px', color: '#ef4444', fontFamily: 'var(--font-display)' }}>🏰 Mb.{data.militaryBaseLevel}</span>
                    )}
                    {data.militaryStrength !== undefined && (
                      <span style={{ fontSize: '7px', color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>⚔️ STR:{data.militaryStrength}</span>
                    )}
                    {data.effect && (
                      <span style={{ fontSize: '7px', color: '#94a3b8', fontFamily: 'var(--font-display)' }}>{data.effect}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ══════ LAUNCH ATTACK BUTTON ══════ */}
      {hasWar && (
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={async () => {
              // Check for existing battle in this region
              const existingBattle = Object.values(battleStore.battles).find(b =>
                b.status === 'active' && (b.regionId === region.id || b.regionName === region.name)
              )
              if (existingBattle) {
                // Battle already active — set order and go to combat tab
                if (selectedOrder !== 'none') {
                  const side = existingBattle.attackerId === playerIso ? 'attacker' : 'defender'
                  battleStore.setBattleOrder(existingBattle.id, side, selectedOrder)
                }
                ui.setWarDefaultTab('battles')
                setLaunchMsg({ text: `Joined battle for ${region.name}! Order: ${TACTICAL_ORDERS[selectedOrder].label}`, color: '#22d38a' })
                setTimeout(() => setLaunchMsg(null), 4000)
                return
              }

              // Launch new battle (server-authoritative — awaits server response)
              await battleStore.launchAttack(playerIso, targetIso, region.name, 'invasion', region.id)

              // Fire selected tactical operations
              const opResults: string[] = []
              selectedOps.forEach(opId => {
                const opDef = ALL_OPS.find(o => o.id === opId)
                if (!opDef) return
                let result
                if (opDef.category === 'country') {
                  result = tOps.launchCountryOp(opId as any, targetIso)
                } else {
                  result = tOps.launchPlayerOp(opId as any, targetIso)
                }
                if (result) opResults.push(result.message)
              })

              // Set order on the newly created battle
              const battles = useBattleStore.getState().battles
              const newBattle = Object.values(battles).find(b =>
                b.status === 'active' && (b.regionId === region.id || b.regionName === region.name)
              )
              if (newBattle && selectedOrder !== 'none') {
                useBattleStore.getState().setBattleOrder(newBattle.id, 'attacker', selectedOrder)
              }
              ui.setWarDefaultTab('battles')

              const opsNote = opResults.length > 0 ? ` | Ops: ${opResults.join(' ')}` : ''
              setLaunchMsg({ text: `Battle for ${region.name} launched! Order: ${TACTICAL_ORDERS[selectedOrder].label}${opsNote}`, color: '#22d38a' })
              setTimeout(() => setLaunchMsg(null), 6000)
            }}
            style={{
              width: '100%', padding: '14px 0', border: 'none', borderRadius: '8px',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
              boxShadow: '0 4px 20px rgba(220,38,38,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
              fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 900,
              color: '#fff', letterSpacing: '2px', textTransform: 'uppercase',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.02)'
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(220,38,38,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'
            }}
          >
            {/* Animated scanline */}
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.06,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)',
              animation: 'scanline-scroll 3s linear infinite',
            }} />
            🚀 LAUNCH ATTACK
            {selectedOrder !== 'none' && (
              <span style={{ fontSize: '9px', display: 'block', marginTop: 2, opacity: 0.8, letterSpacing: '1px' }}>
                with {TACTICAL_ORDERS[selectedOrder].label} order
              </span>
            )}
          </button>

          {launchMsg && (
            <div style={{
              marginTop: 6, padding: '6px 10px', borderRadius: 4, textAlign: 'center',
              background: `${launchMsg.color}15`, border: `1px solid ${launchMsg.color}30`,
              fontSize: '8px', fontWeight: 800, color: launchMsg.color,
              fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
            }}>
              {launchMsg.text}
            </div>
          )}
        </div>
      )}

      {!hasWar && (
        <div style={{
          padding: '10px', textAlign: 'center', borderRadius: '6px',
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
          fontSize: '8px', fontWeight: 800, color: '#f59e0b',
          fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
        }}>
          ⚠️ No active war with {targetCountryName}. Declare war in Congress first.
        </div>
      )}

    </div>
  )
}
