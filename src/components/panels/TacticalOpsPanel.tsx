/**
 * TacticalOpsPanel — Restyled to match LeyLinePanel / Trade-Lane aesthetic.
 *
 * Tabs:
 *  1. 🏛️ COUNTRY OPS — funded by citizens via micro-missions, president launches
 *  2. 👤 PLAYER OPS  — solo ops (intel scanning, bunker override)
 *  3. 📋 REPORTS     — intel reports + op history
 */
import React, { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useGovernmentStore } from '../../stores/governmentStore'
import { useUIStore } from '../../stores/uiStore'
import {
  useTacticalOpsStore,
  COUNTRY_OPS, PLAYER_OPS, MISSIONS,
  type CountryOpId, type PlayerOpId, type MissionType, type TacticalOpDef,
} from '../../stores/tacticalOpsStore'

type TabId = 'country' | 'player' | 'reports'

/* ─── Ley-line-style palette ─── */
const ACCENT  = '#a855f7' // primary purple
const AMBER   = '#ffb300'
const GREEN   = '#22d38a'
const CYAN    = '#00ccff'
const RED     = '#ef4444'
const MUTED   = '#64748b'
const TEXT     = '#e2e8f0'

const FONT: CSSProperties = { fontFamily: "'Orbitron', sans-serif" }

const TAB_META: { id: TabId; label: string; icon: string }[] = [
  { id: 'country', label: 'COUNTRY', icon: '🏛️' },
  { id: 'player',  label: 'PLAYER',  icon: '👤' },
  { id: 'reports', label: 'REPORTS', icon: '📋' },
]

/* ─── Reusable helpers (mirrors LeyLinePanel) ─── */
function SectionHeader({ label, color = MUTED }: { label: string; color?: string }) {
  return (
    <div style={{
      fontSize: 9, color, letterSpacing: '1px', marginBottom: '6px',
      paddingBottom: '4px', borderBottom: `1px solid ${color}33`,
      fontWeight: 700, ...FONT,
    }}>
      {label}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
      borderRadius: 6, padding: '8px 4px', textAlign: 'center' as const,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, ...FONT }}>{value}</div>
      <div style={{ fontSize: 8, color: MUTED, letterSpacing: '0.5px', marginTop: 2, ...FONT }}>{label}</div>
    </div>
  )
}

function StatusDot({ color }: { color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: `0 0 6px ${color}88`,
    }} />
  )
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 8, padding: '1px 5px', borderRadius: 3,
      background: bg, color, fontWeight: 600, ...FONT,
    }}>
      {label}
    </span>
  )
}

/* ─── Progress bar (ley-line style with glow) ─── */
function ProgressBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{
      marginTop: '6px', height, borderRadius: height / 2,
      background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: `linear-gradient(90deg, ${color}, ${color}99)`,
        boxShadow: `0 0 8px ${color}44`,
        transition: 'width 0.3s',
      }} />
    </div>
  )
}

/* ─── Op Row (mirrors LineRow from LeyLinePanel) ─── */
function OpRow({
  opDef, badge, badgeColor, isExpanded, onClick, children,
}: {
  opDef: TacticalOpDef
  badge: string
  badgeColor: string
  isExpanded: boolean
  onClick: () => void
  children?: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const dotColor = badgeColor

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        borderRadius: 6,
        background: isExpanded
          ? `${ACCENT}0a`
          : hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${ACCENT}22`,
        marginBottom: 5,
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header (clickable) */}
      <button
        onClick={onClick}
        style={{
          width: '100%', textAlign: 'left' as const, padding: '8px 10px',
          background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}
      >
        {/* Top line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusDot color={dotColor} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: '0.5px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', ...FONT }}>
              {opDef.icon} {opDef.name}
            </div>
            <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>
              {opDef.description}
            </div>
          </div>
          {/* Badge */}
          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
            <Pill label={badge} color={badgeColor} bg={`${badgeColor}15`} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && children && (
        <div style={{ padding: '0 10px 10px', borderTop: `1px solid rgba(255,255,255,0.06)` }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   MAIN PANEL
   ══════════════════════════════════════════ */
export default function TacticalOpsPanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const ops = useTacticalOpsStore()

  const [tab, setTab] = useState<TabId>('country')
  const [selectedCountryOp, setSelectedCountryOp] = useState<CountryOpId | null>(null)
  const [selectedPlayerOp, setSelectedPlayerOp] = useState<PlayerOpId | null>(null)
  const [targetCountry, setTargetCountry] = useState('')

  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name
  const foreignCountries = world.countries.filter(c => c.code !== iso)

  // Process detection ticks periodically
  useEffect(() => {
    const t = setInterval(() => {
      ops.processDetectionTicks()
      ops.cleanExpiredEffects()
    }, 30000)
    return () => clearInterval(t)
  }, [])

  // Timer for countdown updates
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Active scans
  const activeScans = useMemo(() =>
    Object.values(ops.scans).filter(s => s.status === 'scanning' || s.status === 'detected'),
    [ops.scans]
  )

  // Summary stats
  const stats = useMemo(() => {
    const funded = COUNTRY_OPS.filter(op => {
      const f = ops.getFunding(iso, op.id as CountryOpId)
      return f?.status === 'ready'
    }).length
    const inProgress = COUNTRY_OPS.length - funded
    const activeEffects = ops.activeEffects.filter(e => e.expiresAt > now).length
    return { funded, inProgress, activeEffects }
  }, [ops, iso, now])

  return (
    <div style={{ ...FONT, fontSize: 12, color: TEXT, padding: '4px 2px' }}>

      {/* ── Summary Bar (LeyLine style 3-grid) ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: '6px', marginBottom: '14px',
      }}>
        <StatBox label="FUNDED" value={stats.funded} color={GREEN} />
        <StatBox label="IN PROGRESS" value={stats.inProgress} color={AMBER} />
        <StatBox label="ACTIVE FX" value={stats.activeEffects} color={ACCENT} />
      </div>

      {/* ── Tab Bar (ley-line style) ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
        {TAB_META.map(t => {
          const isActive = tab === t.id
          const badgeCount = t.id === 'player' && activeScans.length > 0 ? activeScans.length : t.id === 'reports' && ops.reports.length > 0 ? ops.reports.length : 0
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '7px 4px', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.8px', cursor: 'pointer',
                border: `1px solid ${isActive ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 5,
                background: isActive
                  ? `linear-gradient(135deg, ${ACCENT}12, ${ACCENT}06)`
                  : 'transparent',
                color: isActive ? ACCENT : MUTED,
                transition: 'all 0.15s',
                ...FONT,
              }}
            >
              {t.icon} {t.label}
              {badgeCount > 0 && (
                <span style={{
                  marginLeft: 4, fontSize: 7, padding: '1px 4px',
                  borderRadius: 3, background: `${ACCENT}20`, color: ACCENT,
                }}>{badgeCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════
          TAB: COUNTRY OPS
          ═══════════════════════════════════════ */}
      {tab === 'country' && (
        <>
          {/* Info banner */}
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 9,
            background: `${ACCENT}08`, border: `1px solid ${ACCENT}22`,
            color: '#c084fc', marginBottom: 10,
          }}>
            ⚡ Citizens fund operations via missions. The <strong>President</strong> launches when fully funded.
          </div>

          <SectionHeader label="COUNTRY OPERATIONS — SORTED BY STATUS" color={MUTED} />

          {COUNTRY_OPS.map(opDef => {
            const isExpanded = selectedCountryOp === opDef.id
            const funding = ops.getFunding(iso, opDef.id as CountryOpId)
            const totalPts = funding?.totalPoints ?? 0
            const required = opDef.fundingRequired
            const pct = Math.min(100, (totalPts / required) * 100)
            const isFunded = funding?.status === 'ready'
            const successChance = ops.getSuccessChance(opDef.id)

            const badge = isFunded ? '✅ READY' : `${totalPts}/${required} pts`
            const badgeColor = isFunded ? GREEN : AMBER

            return (
              <OpRow
                key={opDef.id}
                opDef={opDef}
                badge={badge}
                badgeColor={badgeColor}
                isExpanded={isExpanded}
                onClick={() => setSelectedCountryOp(isExpanded ? null : opDef.id as CountryOpId)}
              >
                {/* Progress bar below header */}
                <ProgressBar pct={pct} color={isFunded ? GREEN : AMBER} />

                {/* Effect description */}
                <div style={{
                  fontSize: 10, color: TEXT, marginTop: 8, marginBottom: 8,
                  padding: '6px 8px', background: `${ACCENT}08`, borderRadius: 4,
                  borderLeft: `3px solid ${ACCENT}`,
                }}>
                  {opDef.effectDescription}
                </div>

                {/* Success chance pill */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Pill label={`✅ ${Math.round(successChance)}% success`} color={GREEN} bg="rgba(34,211,138,0.08)" />
                  <Pill label={`⏱ ${opDef.durationMs ? (opDef.durationMs >= 86400000 ? `${Math.round(opDef.durationMs / 86400000)}d` : opDef.durationMs >= 3600000 ? `${Math.round(opDef.durationMs / 3600000)}h` : `${Math.round(opDef.durationMs / 60000)}m`) : '24h'} duration`} color={CYAN} bg="rgba(0,204,255,0.08)" />
                </div>

                {/* Micro-missions */}
                {!isFunded && (
                  <div style={{ marginBottom: 10 }}>
                    <SectionHeader label="📋 CONTRIBUTE — COMPLETE MISSIONS TO FUND" color={ACCENT} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      {MISSIONS.map(mission => (
                        <button
                          key={mission.id}
                          onClick={() => {
                            const result = ops.completeMission(opDef.id as CountryOpId, mission.id as MissionType)
                            ui.addFloatingText(
                              result.message,
                              window.innerWidth / 2, window.innerHeight / 2,
                              result.success ? GREEN : RED
                            )
                          }}
                          style={{
                            padding: 8, fontSize: 9, fontWeight: 600,
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${ACCENT}15`,
                            borderRadius: 4, color: TEXT, cursor: 'pointer',
                            textAlign: 'left' as const,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = `${ACCENT}10`
                            e.currentTarget.style.borderColor = `${ACCENT}30`
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                            e.currentTarget.style.borderColor = `${ACCENT}15`
                          }}
                        >
                          <div>{mission.icon} {mission.name}</div>
                          <div style={{ fontSize: 8, color: MUTED, marginTop: 2 }}>
                            {mission.cost.work ? `${mission.cost.work} work` : ''}
                            {mission.cost.stamina ? `${mission.cost.stamina} stam` : ''}
                            {mission.cost.badges ? `${mission.cost.badges} 🎖️` : ''}
                            {mission.cost.bitcoin ? `${mission.cost.bitcoin} ₿` : ''}
                            {mission.id === 'battle_veteran' ? '500+ dmg' : ''}
                            {' → '}
                            <span style={{ color: GREEN }}>+{mission.fundingPoints} pts</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent contributors */}
                {funding && funding.contributors.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <SectionHeader label="RECENT CONTRIBUTORS" color={MUTED} />
                    <div style={{ maxHeight: 40, overflow: 'auto' }}>
                      {funding.contributors.slice(-5).reverse().map((c, i) => (
                        <div key={i} style={{ fontSize: 8, color: MUTED, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{c.playerName}</span>
                          <span style={{ color: GREEN }}>+{c.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target + Launch (President only) */}
                {(isFunded || isPresident) && (
                  <>
                    <div style={{ marginBottom: 8, marginTop: 4 }}>
                      <SectionHeader label="🎯 TARGET COUNTRY" color={ACCENT} />
                      <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(17,24,39,0.8)',
                          border: `1px solid ${ACCENT}30`, color: '#fff',
                          padding: 6, fontFamily: "'Orbitron', sans-serif", fontSize: 10,
                          borderRadius: 4,
                        }}>
                        <option value="" disabled>Select Country...</option>
                        {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (!targetCountry) return
                        const result = ops.launchCountryOp(opDef.id as CountryOpId, targetCountry)
                        ui.addFloatingText(
                          result.message,
                          window.innerWidth / 2, window.innerHeight / 2,
                          result.message.includes('✅') ? GREEN : RED
                        )
                      }}
                      disabled={!isPresident || !targetCountry}
                      style={{
                        width: '100%', padding: 10, fontSize: 11, fontWeight: 900,
                        letterSpacing: '1px',
                        cursor: isPresident && targetCountry ? 'pointer' : 'not-allowed',
                        background: isPresident && targetCountry
                          ? `linear-gradient(135deg, ${ACCENT}18, ${ACCENT}08)`
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isPresident && targetCountry ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 5,
                        color: isPresident && targetCountry ? ACCENT : '#475569',
                        boxShadow: isPresident && targetCountry ? `0 0 12px ${ACCENT}22` : 'none',
                        transition: 'all 0.15s',
                        ...FONT,
                      }}
                    >
                      {!isPresident ? '🔒 PRESIDENT ONLY' : !targetCountry ? 'SELECT A TARGET' : isFunded ? '🚀 LAUNCH OPERATION' : '🚀 LAUNCH ($5,000 treasury)'}
                    </button>
                  </>
                )}
              </OpRow>
            )
          })}
        </>
      )}

      {/* ═══════════════════════════════════════
          TAB: PLAYER OPS
          ═══════════════════════════════════════ */}
      {tab === 'player' && (
        <>
          {/* Active Scans (Undercover) */}
          {activeScans.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <SectionHeader label="📡 ACTIVE SCANS" color={CYAN} />
              {activeScans.map(scan => {
                const elapsed = now - scan.startedAt
                const remaining = Math.max(0, scan.scanDurationMs - elapsed)
                const pct = Math.min(100, (elapsed / scan.scanDurationMs) * 100)
                const mins = Math.floor(remaining / 60000)
                const secs = Math.floor((remaining % 60000) / 1000)
                const isDetected = scan.detected

                return (
                  <div key={scan.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '8px 10px', borderRadius: 6,
                    background: isDetected ? 'rgba(255,68,68,0.06)' : `${CYAN}06`,
                    border: `1px solid ${isDetected ? `${RED}30` : `${CYAN}20`}`,
                    marginBottom: 5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusDot color={isDetected ? RED : CYAN} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: isDetected ? RED : CYAN, ...FONT }}>
                          {isDetected ? '🚨 DETECTED!' : '📡 SCANNING...'} — {scan.opId.replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>→ {scan.targetCountry}</div>
                      </div>
                    </div>

                    {!isDetected && (
                      <>
                        <ProgressBar pct={pct} color={CYAN} height={6} />
                        <div style={{ fontSize: 9, color: CYAN, marginTop: 2, textAlign: 'center' as const, ...FONT }}>
                          ⏱️ {mins}m {secs.toString().padStart(2, '0')}s remaining
                        </div>
                      </>
                    )}

                    {isDetected && (
                      <div style={{ marginTop: 4, fontSize: 9, color: RED }}>
                        ⚔️ Fast battle spawned! Win to complete the intel op.
                        {scan.battleId && (
                          <div style={{ marginTop: 3, color: AMBER, fontStyle: 'italic' }}>
                            Battle ID: {scan.battleId.slice(0, 8)}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Player Ops List */}
          <SectionHeader label="PLAYER OPERATIONS — PERSONAL OPS" color={MUTED} />

          {PLAYER_OPS.map(opDef => {
            const isExpanded = selectedPlayerOp === opDef.id
            const isIntelOp = opDef.id === 'resource_intel' || opDef.id === 'war_intel' || opDef.id === 'disinformation'
            const isBunker = opDef.id === 'bunker_override'
            const opColor = isBunker ? RED : CYAN
            const successChance = ops.getSuccessChance(opDef.id)

            return (
              <OpRow
                key={opDef.id}
                opDef={opDef}
                badge={`${opDef.cost.bitcoin}₿ + ${opDef.cost.badgesOfHonor}🎖️`}
                badgeColor={opColor}
                isExpanded={isExpanded}
                onClick={() => setSelectedPlayerOp(isExpanded ? null : opDef.id as PlayerOpId)}
              >
                {/* Effect */}
                <div style={{
                  fontSize: 10, color: TEXT, marginTop: 8, marginBottom: 8,
                  padding: '6px 8px', background: `${opColor}08`, borderRadius: 4,
                  borderLeft: `3px solid ${opColor}`,
                }}>
                  {opDef.effectDescription}
                </div>

                {/* Info pills */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Pill label={`✅ ${Math.round(successChance)}% success`} color={GREEN} bg="rgba(34,211,138,0.08)" />
                  {isIntelOp && <Pill label="📡 30min undercover scan" color={CYAN} bg={`${CYAN}10`} />}
                  {isBunker && <Pill label="💰 High-end op" color={RED} bg={`${RED}10`} />}
                </div>

                {/* Target */}
                <div style={{ marginBottom: 8 }}>
                  <SectionHeader label="🎯 TARGET COUNTRY" color={ACCENT} />
                  <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(17,24,39,0.8)',
                      border: `1px solid ${ACCENT}30`, color: '#fff',
                      padding: 6, fontFamily: "'Orbitron', sans-serif", fontSize: 10,
                      borderRadius: 4,
                    }}>
                    <option value="" disabled>Select Country...</option>
                    {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>

                {/* Launch */}
                <button
                  onClick={() => {
                    if (!targetCountry) return
                    const result = ops.launchPlayerOp(opDef.id as PlayerOpId, targetCountry)
                    ui.addFloatingText(
                      result.message,
                      window.innerWidth / 2, window.innerHeight / 2,
                      result.message.includes('📡') || result.message.includes('✅') ? GREEN : RED
                    )
                  }}
                  disabled={!targetCountry}
                  style={{
                    width: '100%', padding: 10, fontSize: 11, fontWeight: 900,
                    letterSpacing: '1px',
                    cursor: targetCountry ? 'pointer' : 'not-allowed',
                    background: targetCountry
                      ? `linear-gradient(135deg, ${opColor}15, ${opColor}05)`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${targetCountry ? opColor : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 5,
                    color: targetCountry ? opColor : '#475569',
                    boxShadow: targetCountry ? `0 0 12px ${opColor}22` : 'none',
                    transition: 'all 0.15s',
                    ...FONT,
                  }}
                >
                  {!targetCountry ? 'SELECT A TARGET' : isIntelOp ? '📡 GO UNDERCOVER' : '🚀 LAUNCH'}
                </button>
              </OpRow>
            )
          })}

          {/* Active effects on enemies */}
          {ops.activeEffects.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <SectionHeader label="⚡ ACTIVE EFFECTS" color={ACCENT} />
              <div style={{
                background: `${ACCENT}06`, border: `1px solid ${ACCENT}18`,
                borderRadius: 6, padding: '8px 10px',
              }}>
                {ops.activeEffects.filter(e => e.expiresAt > now).map(effect => {
                  const remaining = effect.expiresAt - now
                  const hours = Math.floor(remaining / 3600000)
                  const mins = Math.floor((remaining % 3600000) / 60000)
                  return (
                    <div key={effect.id} style={{
                      padding: '4px 0', display: 'flex', justifyContent: 'space-between',
                      fontSize: 9, borderBottom: `1px solid ${ACCENT}10`,
                    }}>
                      <span style={{ color: TEXT }}>
                        {effect.opId.replace(/_/g, ' ')} → {effect.targetCountry}
                      </span>
                      <span style={{ color: ACCENT, fontWeight: 700, ...FONT }}>
                        {hours > 0 ? `${hours}h ` : ''}{mins}m
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════
          TAB: REPORTS
          ═══════════════════════════════════════ */}
      {tab === 'reports' && (
        <>
          <SectionHeader label="📋 INTELLIGENCE REPORTS" color={ACCENT} />
          {ops.reports.length === 0 ? (
            <div style={{ textAlign: 'center' as const, color: '#475569', fontSize: 11, padding: '20px 0', ...FONT }}>
              No reports yet. Launch intel operations to gather intelligence.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ops.reports.map(report => {
                const succeeded = report.succeeded

                return (
                  <div key={report.id} style={{
                    padding: '8px 10px', borderRadius: 6,
                    background: succeeded ? `${ACCENT}05` : `${RED}05`,
                    border: `1px solid ${succeeded ? `${ACCENT}20` : `${RED}20`}`,
                    transition: 'background 0.15s',
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot color={succeeded ? ACCENT : RED} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, ...FONT }}>
                          {report.data.type || report.opId.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <Pill
                        label={succeeded ? '✅ SUCCESS' : '❌ FAILED'}
                        color={succeeded ? GREEN : RED}
                        bg={succeeded ? 'rgba(34,211,138,0.1)' : `${RED}10`}
                      />
                    </div>

                    {/* Meta */}
                    <div style={{ fontSize: 8, color: MUTED, display: 'flex', gap: 8, paddingLeft: 16 }}>
                      <span>🎯 {report.targetCountry}</span>
                      <span>📅 {new Date(report.timestamp).toLocaleDateString()}</span>
                    </div>

                    {/* Report data */}
                    {succeeded && (
                      <details style={{ marginTop: 6, paddingLeft: 16 }}>
                        <summary style={{ fontSize: 9, color: ACCENT, cursor: 'pointer', fontWeight: 700, ...FONT }}>
                          📊 View Report Data
                        </summary>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3,
                          marginTop: 6, fontSize: 8,
                        }}>
                          {Object.entries(report.data)
                            .filter(([k]) => !['type', 'country', 'countryName'].includes(k))
                            .map(([k, v]) => (
                              <div key={k} style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: '3px 6px', borderRadius: 3,
                                background: 'rgba(255,255,255,0.02)',
                              }}>
                                <span style={{ color: MUTED }}>{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span style={{ color: TEXT, fontWeight: 600 }}>
                                  {typeof v === 'number' ? v.toLocaleString() : String(v)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Legend (LeyLine style) ── */}
      <div style={{
        marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 9, color: MUTED,
        ...FONT,
      }}>
        <span style={{ color: GREEN }}>● Funded = Ready to launch</span>
        <span style={{ color: AMBER }}>● In progress = Needs missions</span>
        <span style={{ color: ACCENT }}>● Active = Effect running</span>
      </div>
    </div>
  )
}
