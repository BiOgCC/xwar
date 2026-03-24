/**
 * CyberwarfarePanel — Full UI for the Mission Board + Breach Protocol system.
 *
 * Tabs:
 *  1. BOARD      — country's mission board, shift button, contributor list, charges
 *  2. OPERATIONS — browse 10 ops, launch with charges
 *  3. ACTIVE     — deployed ops + live breach protocol puzzles
 *  4. REPORTS    — completed op history + intel reports
 */
import React, { useState, useEffect, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import { api } from '../../api/client'
import BreachProtocol from './BreachProtocol'
import RegionPicker from '../shared/RegionPicker'
import BadgeOfHonorIcon from '../shared/BadgeOfHonorIcon'

// ═══════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════

interface BoardData {
  board: {
    id: string; cycle: number; status: string
    slotsFilled: number; slotsRequired: number
    contributors: { playerName: string; contributedAt: string }[]
  }
  totalCharges: number
  canContribute: boolean
  cooldownEndsAt: string | null
  alreadyContributed: boolean
  shiftCost: { stamina: number; work: number }
}

interface OpDef {
  id: string; pillar: string; chargesRequired: number
  successChance: number; detectionChance: number; raceMode: boolean
}

interface ActiveOp {
  id: string; operationId: string; pillar: string
  countryCode: string; targetCountry: string; targetRegion: string
  status: string; result: any; deployedAt: string; expiresAt: string
}

interface PuzzleState {
  attemptId: string
  grid: any
  side: 'attacker' | 'defender'
  raceMode: boolean
  timeRemaining: number
}

interface RaceStatus {
  raceMode: boolean; status: string; timeRemaining: number
  attackers: { joined: number; wins: number; max: number }
  defenders: { joined: number; wins: number; max: number }
  resolved: boolean
}

// ═══════════════════════════════════════════════
//  API HELPERS
// ═══════════════════════════════════════════════

async function cyberGet(path: string) {
  try {
    return await api.get<any>(`/cyber${path}`)
  } catch (err: any) {
    console.error('[CYBER API]', path, err)
    return { success: false, error: err?.message || 'Network error — is the server running?' }
  }
}

async function cyberPost(path: string, body?: any) {
  try {
    return await api.post<any>(`/cyber${path}`, body)
  } catch (err: any) {
    console.error('[CYBER API]', path, err)
    return { success: false, error: err?.message || 'Request failed' }
  }
}

// ═══════════════════════════════════════════════
//  FULL OPERATION DEFINITIONS (all 10 cyber ops)
// ═══════════════════════════════════════════════

interface FullOpDef {
  id: string; name: string; icon: string; pillar: string
  description: string; effectDescription: string
  cost: { scrap: number; materialX: number; oil: number; bitcoin: number; badgesOfHonor: number }
  targetType: 'country' | 'region' | 'player' | 'battle'
  successChance: number; detectionChance: number
  durationMs: number; playersRequired: number
}

const FULL_OPS: FullOpDef[] = [
  // ESPIONAGE
  { id: 'resource_intel', pillar: 'espionage', name: 'Resource Intelligence Report', icon: '📊',
    description: 'Gather economic intelligence: national funds, citizen-owned food & ammo supplies.',
    cost: { scrap: 1000, materialX: 5000, oil: 2000, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 80, detectionChance: 30, durationMs: 0, playersRequired: 5,
    effectDescription: 'Report: National fund breakdown, citizen food & bullet reserves.' },
  { id: 'military_intel', pillar: 'espionage', name: 'Military Intelligence Report', icon: 'mil_intel',
    description: 'Scan ports, airports, bunkers, military bases and report citizen-owned jets, warships & tanks.',
    cost: { scrap: 1500, materialX: 7000, oil: 2500, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 80, detectionChance: 30, durationMs: 0, playersRequired: 5,
    effectDescription: 'Report: Infrastructure levels, jets, warships, tanks owned by citizens.' },
  { id: 'infrastructure_scan', pillar: 'espionage', name: 'Regional Infrastructure Scan', icon: '🏗️',
    description: 'Scan active companies, worker counts, owned materials, and tax revenue in a region.',
    cost: { scrap: 2000, materialX: 9000, oil: 3000, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 80, detectionChance: 30, durationMs: 0, playersRequired: 5,
    effectDescription: 'Report: Active companies, workers, materials, tax generated.' },
  { id: 'blueprint_loot', pillar: 'espionage', name: 'Blueprint Loot Operation', icon: '🔓',
    description: 'Copy a prestigious blueprint from a top player and distribute untradable copies to your citizens.',
    cost: { scrap: 3000, materialX: 12000, oil: 3500, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'player',
    successChance: 80, detectionChance: 30, durationMs: 0, playersRequired: 5,
    effectDescription: 'Copy prestigious blueprint. Citizens receive untradable copy. Enables crafting.' },
  // SABOTAGE
  { id: 'company_sabotage', pillar: 'sabotage', name: 'Company Sabotage', icon: '🔌',
    description: 'Infiltrate any company and steal 20% of production for 24 hours. Distributed to attacker citizens.',
    cost: { scrap: 2000, materialX: 10000, oil: 4000, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 80, detectionChance: 30, durationMs: 86400000, playersRequired: 5,
    effectDescription: 'Steal 20% production from ALL companies for 24h. Distributed to citizens.' },
  { id: 'logistics_disruption', pillar: 'sabotage', name: 'Logistics Disruption', icon: '🚚',
    description: 'Disable ports or airports in the target region for 48 hours.',
    cost: { scrap: 2500, materialX: 12000, oil: 4500, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 85, detectionChance: 20, durationMs: 172800000, playersRequired: 5,
    effectDescription: 'Disables Port or Airport in target country for 48h. Blocks Naval/Air Strikes.' },
  { id: 'bunker_override', pillar: 'sabotage', name: 'Bunker Override', icon: '🏰',
    description: 'Override bunker defenses, reducing defense by 50% for 24 hours.',
    cost: { scrap: 3000, materialX: 15000, oil: 5000, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 80, detectionChance: 30, durationMs: 86400000, playersRequired: 5,
    effectDescription: 'Bunker defense -50% for 24 hours.' },
  { id: 'power_grid_attack', pillar: 'sabotage', name: 'Power Grid Attack', icon: '⚡',
    description: 'Attack the power grid, stopping company production.',
    cost: { scrap: 3500, materialX: 18000, oil: 5500, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'region',
    successChance: 80, detectionChance: 30, durationMs: 5400000, playersRequired: 5,
    effectDescription: '33% companies in region stop production for 90 minutes.' },
  // PROPAGANDA
  { id: 'disinformation', pillar: 'propaganda', name: 'Disinformation Campaign', icon: '📰',
    description: 'Spread fake alerts to create confusion.',
    cost: { scrap: 1500, materialX: 8000, oil: 2500, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'country',
    successChance: 80, detectionChance: 30, durationMs: 1800000, playersRequired: 5,
    effectDescription: 'Fake invasion/mission/cyber alerts for 30 minutes.' },
  { id: 'botnet_attack', pillar: 'propaganda', name: 'Botnet Attack', icon: '🤖',
    description: 'Flood enemy combat logs with 300K fake damage.',
    cost: { scrap: 4000, materialX: 20000, oil: 6000, bitcoin: 1, badgesOfHonor: 1 }, targetType: 'battle',
    successChance: 80, detectionChance: 30, durationMs: 3600000, playersRequired: 5,
    effectDescription: '300,000 fake damage in battle log. Does NOT affect capture.' },
]

// Quick lookup
const OP_MAP: Record<string, FullOpDef> = Object.fromEntries(FULL_OPS.map(o => [o.id, o]))

function formatDuration(ms: number): string {
  if (ms === 0) return 'Instant'
  if (ms >= 86400000) return `${Math.round(ms / 86400000)}d`
  if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`
  return `${Math.round(ms / 60000)}m`
}

function formatCooldown(isoEnd: string): string {
  const diff = new Date(isoEnd).getTime() - Date.now()
  if (diff <= 0) return 'Ready'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const PILLAR_COLORS: Record<string, string> = {
  espionage: '#00cc88',
  sabotage: '#ff4444',
  propaganda: '#ffaa00',
}

type TabId = 'board' | 'operations' | 'active' | 'reports'

// ═══════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════

export default function CyberwarfarePanel() {
  const player = usePlayerStore()
  const world = useWorldStore()
  const ui = useUIStore()

  const [tab, setTab] = useState<TabId>('operations')
  const [loading, setLoading] = useState(false)

  // Board state (legacy, kept for board tab)
  const [board, setBoard] = useState<BoardData | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [contributing, setContributing] = useState(false)

  // Per-operation boards
  interface OpBoard {
    id: string; slotsFilled: number; slotsRequired: number; status: string;
    contributors: { playerName: string; contributedAt: string }[]; isFull: boolean; playerJoined: boolean;
    cooldownEndsAt?: string | null;
  }
  const [opBoards, setOpBoards] = useState<Record<string, OpBoard>>({})
  const [globalCooldown, setGlobalCooldown] = useState<string | null>(null)

  // Operations state
  const [ops, setOps] = useState<OpDef[]>([])
  const [selectedOp, setSelectedOp] = useState<OpDef | null>(null)
  const [targetCountry, setTargetCountry] = useState('')
  const [targetRegion, setTargetRegion] = useState('')
  const [targetPlayer, setTargetPlayer] = useState('')
  const [launching, setLaunching] = useState(false)

  // Active ops state
  const [activeOps, setActiveOps] = useState<ActiveOp[]>([])
  const [puzzle, setPuzzle] = useState<PuzzleState | null>(null) // Puzzle + race state
  const [raceStatus, setRaceStatus] = useState<RaceStatus | null>(null)
  const [sabRaceData, setSabRaceData] = useState<Record<string, any>>({})

  // Reports state
  const [reports, setReports] = useState<ActiveOp[]>([])

  // Stats state
  interface StatsData {
    country: { totalLaunched: number; successful: number; failed: number; detected: number; inProgress: number; byPillar: Record<string, number> } | null;
    personal: { opsLaunched: number; successful: number; failed: number } | null;
    topCoPlayers: { name: string; count: number }[];
    puzzle: { puzzlesPlayed: number; puzzlesWon: number; defended: number };
  }
  const [stats, setStats] = useState<StatsData | null>(null)

  // Cooldown timer
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // ─── Data fetching ───

  const fetchBoard = useCallback(async () => {
    setBoardError(null)
    const data = await cyberGet('/board')
    if (data.success) {
      setBoard(data)
    } else {
      setBoardError(data.error || 'Failed to load board')
      setBoard({
        board: { id: '', cycle: 1, status: 'filling', slotsFilled: 0, slotsRequired: 5, contributors: [] },
        totalCharges: 0, canContribute: false, cooldownEndsAt: null, alreadyContributed: false,
        shiftCost: { stamina: 30, work: 10 },
      })
    }
  }, [])

  const fetchBoards = useCallback(async () => {
    const data = await cyberGet('/boards')
    if (data.success) {
      setOpBoards(data.boards || {})
      setGlobalCooldown(data.cooldownEndsAt || null)
    }
  }, [])

  const fetchOps = useCallback(async () => {
    const data = await cyberGet('/ops')
    if (data.success) setOps(data.operations)
  }, [])

  const fetchActive = useCallback(async () => {
    const data = await cyberGet('/active')
    if (data.success) setActiveOps(data.operations)
  }, [])

  const fetchReports = useCallback(async () => {
    const data = await cyberGet('/reports')
    if (data.success) setReports(data.reports)
  }, [])

  const fetchStats = useCallback(async () => {
    const data = await cyberGet('/stats')
    if (data.success) setStats(data)
  }, [])

  // Load data on tab change
  useEffect(() => {
    if (tab === 'board') fetchStats()
    if (tab === 'operations') { fetchOps(); fetchBoards() }
    if (tab === 'active') fetchActive()
    if (tab === 'reports') fetchReports()
  }, [tab, fetchStats, fetchBoards, fetchOps, fetchActive, fetchReports])

  // ─── Actions ───

  const handleContribute = async (operationType: string) => {
    setContributing(true)
    const data = await cyberPost('/contribute', { operationType })
    if (data.success) {
      ui.addFloatingText(data.message, window.innerWidth / 2, window.innerHeight / 2, '#00ff88')
      fetchBoards()
    } else {
      ui.addFloatingText(data.error || 'Failed', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
    setContributing(false)
  }

  const handleLaunch = async () => {
    if (!selectedOp) return
    setLaunching(true)
    const data = await cyberPost('/launch', {
      operationType: selectedOp.id,
      targetCountry: targetCountry || undefined,
      targetRegion: targetRegion || undefined,
      targetPlayer: targetPlayer || undefined,
    })
    if (data.success) {
      ui.addFloatingText(data.message, window.innerWidth / 2, window.innerHeight / 2, '#00ff88')
      // Switch to active tab if puzzle phase (skip auto-puzzle for sabotage)
      if (data.phase === 'puzzle') {
        setTab('active')
        if (selectedOp.pillar !== 'sabotage') { // Only auto-start puzzle for non-sabotage
          setTimeout(async () => {
            await fetchActive()
            if (data.operationId) {
              await startPuzzle(data.operationId, 'attacker')
            }
          }, 500)
        } else {
          fetchActive() // For sabotage, just fetch active ops to show the race
        }
      }
      setSelectedOp(null)
      fetchBoard()
    } else {
      ui.addFloatingText(data.error || 'Failed', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
    setLaunching(false)
  }

  const startPuzzle = async (opId: string, side: 'attacker' | 'defender') => {
    const data = await cyberPost('/puzzle/start', { cyberOpId: opId, side })
    if (data.success) {
      setPuzzle({
        attemptId: data.attemptId,
        grid: data.grid,
        side: data.side,
        raceMode: data.raceMode,
        timeRemaining: data.timeRemaining,
      })
    } else {
      ui.addFloatingText(data.error || 'Cannot start puzzle', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
  }

  const fetchRaceStatus = async (opId: string) => {
    const data = await cyberGet(`/puzzle/race/${opId}`)
    if (data.success) setRaceStatus(data)
  }

  const handleSabotageContribute = async (opId: string, side: 'attacker' | 'defender') => {
    const data = await cyberPost('/sabotage/contribute', { cyberOpId: opId, side })
    if (data.success) {
      const critMsg = data.isCrit ? ' 💥 CRITICAL!' : ''
      ui.addFloatingText(`+${data.points} pts (×${data.multiplier})${critMsg}`, window.innerWidth / 2, window.innerHeight / 2, data.isCrit ? '#ff6600' : '#00ff88')
      // Update local race data
      setSabRaceData(prev => ({ ...prev, [opId]: data.totals }))
      fetchActive()
    } else {
      ui.addFloatingText(data.error || 'Failed', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
    }
  }

  const fetchSabotageRace = async (opId: string) => {
    const data = await cyberGet(`/sabotage/race/${opId}`)
    if (data.success) {
      setSabRaceData(prev => ({ ...prev, [opId]: { attacker: data.attacker, defender: data.defender, contributions: data.contributions, timeRemaining: data.timeRemaining } }))
    }
  }

  const handlePuzzleComplete = (won: boolean) => {
    setPuzzle(null)
    ui.addFloatingText(
      won ? '✅ BREACH SUCCESSFUL!' : '❌ Breach failed.',
      window.innerWidth / 2, window.innerHeight / 2,
      won ? '#00ff88' : '#ef4444'
    )
    fetchActive()
  }

  // ─── Helpers ───

  const formatCooldown = (isoStr: string | null) => {
    if (!isoStr) return ''
    const ms = new Date(isoStr).getTime() - now
    if (ms <= 0) return 'Ready!'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const iso = player.countryCode || 'US'
  const foreignCountries = world.countries.filter(c => c.code !== iso)

  // ═══════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: '3px' }}>
        {([
          { id: 'board' as TabId, label: '📊 STATS', badge: '' },
          { id: 'operations' as TabId, label: '⚔️ OPS', badge: Object.values(opBoards).filter(b => b.isFull).length > 0 ? `✓${Object.values(opBoards).filter(b => b.isFull).length}` : '' },
          { id: 'active' as TabId, label: '🔄 ACTIVE', badge: activeOps.length > 0 ? String(activeOps.length) : '' },
          { id: 'reports' as TabId, label: '📋 INTEL', badge: '' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px', fontSize: '9px', fontWeight: 700,
              letterSpacing: '0.5px', cursor: 'pointer',
              border: `1px solid ${tab === t.id ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '4px',
              background: tab === t.id ? 'rgba(0,255,136,0.1)' : 'transparent',
              color: tab === t.id ? '#00ff88' : '#94a3b8',
            }}
          >
            {t.label}
            {t.badge && <span style={{ marginLeft: '4px', fontSize: '8px', opacity: 0.7 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════ */}
      {/*  TAB: STATS                            */}
      {/* ══════════════════════════════════════ */}
      {tab === 'board' && (
        <>
          {stats ? (
            <>
              {/* Country Stats */}
              <div className="hud-card" style={{ borderColor: 'rgba(0,255,136,0.2)' }}>
                <div className="hud-card__title" style={{ color: '#00ff88' }}>🏛️ COUNTRY OPERATIONS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
                  {[
                    { label: 'Launched', value: stats.country?.totalLaunched ?? 0, color: '#60a5fa' },
                    { label: 'Success', value: stats.country?.successful ?? 0, color: '#00ff88' },
                    { label: 'Failed', value: stats.country?.failed ?? 0, color: '#ef4444' },
                    { label: 'Detected', value: stats.country?.detected ?? 0, color: '#f59e0b' },
                    { label: 'In Progress', value: stats.country?.inProgress ?? 0, color: '#a78bfa' },
                    { label: 'Success %', value: stats.country?.totalLaunched ? `${Math.round((stats.country.successful / stats.country.totalLaunched) * 100)}%` : '—', color: '#22d38a' },
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: '8px', borderRadius: '4px', textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: s.color as string }}>{s.value}</div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* By Pillar */}
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  {(['espionage', 'sabotage', 'propaganda'] as const).map(p => (
                    <div key={p} style={{
                      flex: 1, padding: '6px', borderRadius: '4px', textAlign: 'center',
                      background: `${PILLAR_COLORS[p]}08`, border: `1px solid ${PILLAR_COLORS[p]}20`,
                    }}>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: PILLAR_COLORS[p] }}>
                        {stats.country?.byPillar?.[p] ?? 0}
                      </div>
                      <div style={{ fontSize: '7px', color: '#64748b', textTransform: 'uppercase' }}>{p}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personal Stats */}
              <div className="hud-card" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
                <div className="hud-card__title" style={{ color: '#60a5fa' }}>👤 YOUR STATS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
                  {[
                    { label: 'Ops Launched', value: stats.personal?.opsLaunched ?? 0, color: '#60a5fa' },
                    { label: 'Successful', value: stats.personal?.successful ?? 0, color: '#00ff88' },
                    { label: 'Failed', value: stats.personal?.failed ?? 0, color: '#ef4444' },
                    { label: 'Puzzles Played', value: stats.puzzle?.puzzlesPlayed ?? 0, color: '#a78bfa' },
                    { label: 'Puzzles Won', value: stats.puzzle?.puzzlesWon ?? 0, color: '#22d38a' },
                    { label: 'Defended', value: stats.puzzle?.defended ?? 0, color: '#f59e0b' },
                  ].map(s => (
                    <div key={s.label} style={{
                      padding: '8px', borderRadius: '4px', textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Co-players */}
              {stats.topCoPlayers && stats.topCoPlayers.length > 0 && (
                <div className="hud-card" style={{ borderColor: 'rgba(167,139,250,0.2)' }}>
                  <div className="hud-card__title" style={{ color: '#a78bfa' }}>🤝 TOP TEAMMATES</div>
                  <div style={{ marginTop: '6px' }}>
                    {stats.topCoPlayers.map((p, i) => (
                      <div key={p.name} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '4px 8px', fontSize: '10px', borderRadius: '3px',
                        background: i === 0 ? 'rgba(167,139,250,0.08)' : 'transparent',
                        marginBottom: '2px',
                      }}>
                        <span style={{ color: '#e2e8f0', fontWeight: i === 0 ? 700 : 400 }}>
                          {i === 0 ? '👑' : `${i + 1}.`} {p.name}
                        </span>
                        <span style={{ color: '#a78bfa', fontWeight: 700 }}>{p.count} ops</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', padding: '20px' }}>
              Loading stats...
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════ */}
      {/*  TAB: OPERATIONS                      */}
      {/* ══════════════════════════════════════ */}
      {tab === 'operations' && (
        <>
          {/* Cooldown Notice */}
          {globalCooldown && new Date(globalCooldown).getTime() > now && (
            <div style={{
              padding: '8px 12px', borderRadius: '6px', fontSize: '10px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              color: '#fbbf24', textAlign: 'center',
            }}>
              ⏱️ Your next shift available in {formatCooldown(globalCooldown)}
            </div>
          )}

          {/* Operation List by Pillar */}
          {(['espionage', 'sabotage', 'propaganda'] as const).map(pillar => {
            const pillarOps = FULL_OPS.filter(o => o.pillar === pillar)
            if (pillarOps.length === 0) return null
            const color = PILLAR_COLORS[pillar] || '#fff'
            const serverOps = ops.reduce((m, o) => { m[o.id] = o; return m }, {} as Record<string, OpDef>)
            return (
              <div key={pillar} className="hud-card" style={{ borderColor: `${color}33` }}>
                <div className="hud-card__title" style={{ color, textTransform: 'uppercase' }}>
                  {pillar === 'espionage' ? '🕵️' : pillar === 'sabotage' ? '💣' : '📰'} {pillar}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  {pillarOps.map(fullOp => {
                    const sOp = serverOps[fullOp.id]
                    const isSelected = selectedOp?.id === fullOp.id
                    const opBoard = opBoards[fullOp.id]
                    const slotsFilled = opBoard?.slotsFilled ?? 0
                    const canLaunch = slotsFilled >= 1
                    const successBonus = (slotsFilled - 1) * 4
                    const raceMode = sOp?.raceMode ?? pillar !== 'espionage'
                    const opCooldownEnd = opBoard?.cooldownEndsAt
                    const onCooldown = opCooldownEnd ? new Date(opCooldownEnd).getTime() > now : false

                    return (
                      <div key={fullOp.id}>
                        {/* Operation Header */}
                        <button
                          onClick={() => setSelectedOp(isSelected ? null : (sOp || { id: fullOp.id, pillar, chargesRequired: 1, successChance: fullOp.successChance, detectionChance: fullOp.detectionChance, raceMode } as OpDef))}
                          style={{
                            width: '100%', textAlign: 'left', padding: '10px',
                            background: isSelected ? `${color}10` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isSelected ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: isSelected ? '4px 4px 0 0' : '4px', cursor: 'pointer', color: '#fff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '11px' }}>{fullOp.icon === 'mil_intel' ? <BadgeOfHonorIcon size={13} /> : fullOp.icon} {fullOp.name}</span>
                            <span style={{
                              fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                              background: canLaunch ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)',
                              color: canLaunch ? '#00ff88' : '#94a3b8',
                              border: `1px solid ${canLaunch ? '#00ff8830' : 'rgba(255,255,255,0.1)'}`,
                            }}>
                              ⚡{slotsFilled}/{fullOp.playersRequired}{successBonus > 0 ? ` +${successBonus}%` : ''} {raceMode ? '(5v5)' : '(Solo)'}
                            </span>
                          </div>
                          <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '3px' }}>{fullOp.description}</div>
                        </button>

                        {/* Expanded details */}
                        {isSelected && (
                          <div style={{
                            padding: '10px',
                            background: 'rgba(0,0,0,0.3)', border: `1px solid ${color}30`,
                            borderTop: 'none', borderRadius: '0 0 4px 4px',
                          }}>
                            {/* Effect Description */}
                            <div style={{
                              fontSize: '10px', color: '#e2e8f0', marginBottom: '8px',
                              padding: '6px 8px', background: `${color}08`, borderRadius: '4px',
                              borderLeft: `3px solid ${color}`,
                            }}>
                              {fullOp.effectDescription}
                            </div>

                            {/* Cost Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', marginBottom: '8px' }}>
                              <div style={{ fontSize: '9px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', color: '#94a3b8' }}>
                                🔩 Scrap: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{fullOp.cost.scrap.toLocaleString()}</span>
                              </div>
                              <div style={{ fontSize: '9px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', color: '#94a3b8' }}>
                                ⚛️ MatX: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{fullOp.cost.materialX.toLocaleString()}</span>
                              </div>
                              <div style={{ fontSize: '9px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', color: '#94a3b8' }}>
                                🛢️ Oil: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{fullOp.cost.oil.toLocaleString()}</span>
                              </div>
                              <div style={{ fontSize: '9px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', color: '#94a3b8' }}>
                                ₿ BTC: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{fullOp.cost.bitcoin}</span>
                              </div>
                              <div style={{ fontSize: '9px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', color: '#94a3b8' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><BadgeOfHonorIcon size={11} /> BOH: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{fullOp.cost.badgesOfHonor}</span></span>
                              </div>
                            </div>

                            {/* Stats row */}
                            <div style={{ display: 'flex', gap: '8px', fontSize: '9px', color: '#f59e0b', marginBottom: '8px' }}>
                              <span>✅ {fullOp.successChance}%{successBonus > 0 ? ` (+${successBonus}%)` : ''}</span>
                              <span>👁️ {fullOp.detectionChance}%</span>
                              <span>⏱️ {formatDuration(fullOp.durationMs)}</span>
                              <span style={{ color: raceMode ? '#ff6666' : '#00cc88' }}>
                                {raceMode ? '🖥️ 5v5 Race' : '🖥️ Solo Puzzle'}
                              </span>
                            </div>

                            {/* 5-Player Slots — clickable! */}
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                                👥 PLAYER SLOTS ({fullOp.playersRequired} REQUIRED) — 30💧 + 10🔧 per slot
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {Array.from({ length: fullOp.playersRequired }).map((_, i) => {
                                  const contributor = opBoard?.contributors?.[i]
                                  const isFilled = i < (opBoard?.slotsFilled ?? 0)
                                  const canJoin = !isFilled && !contributing && !onCooldown && !(opBoard?.playerJoined)
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => canJoin && handleContribute(fullOp.id)}
                                      disabled={!canJoin}
                                      className="cyber-slot-btn"
                                      style={{
                                        flex: 1, height: '38px', borderRadius: '5px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: isFilled ? '8px' : '12px', fontWeight: 700,
                                        cursor: canJoin ? 'pointer' : 'default',
                                        background: isFilled
                                          ? 'linear-gradient(180deg, rgba(0,255,136,0.2) 0%, rgba(0,255,136,0.08) 100%)'
                                          : canJoin
                                            ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)'
                                            : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${isFilled ? '#00ff8850' : canJoin ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                                        color: isFilled ? '#00ff88' : canJoin ? '#e2e8f0' : '#475569',
                                        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: 'translateY(0)',
                                        boxShadow: isFilled
                                          ? '0 0 8px rgba(0,255,136,0.15), inset 0 1px 0 rgba(0,255,136,0.2)'
                                          : canJoin
                                            ? '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                                            : 'none',
                                        position: 'relative',
                                        overflow: 'hidden',
                                      }}
                                      onMouseDown={e => {
                                        if (!canJoin) return
                                        const btn = e.currentTarget
                                        btn.style.transform = 'translateY(2px) scale(0.95)'
                                        btn.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.4)'
                                      }}
                                      onMouseUp={e => {
                                        if (!canJoin) return
                                        const btn = e.currentTarget
                                        btn.style.transform = 'translateY(0) scale(1)'
                                        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                                      }}
                                      onMouseLeave={e => {
                                        if (!canJoin) return
                                        const btn = e.currentTarget
                                        btn.style.transform = 'translateY(0) scale(1)'
                                        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                                      }}
                                      onMouseEnter={e => {
                                        if (!canJoin) return
                                        const btn = e.currentTarget
                                        btn.style.boxShadow = `0 0 12px ${color}30, 0 2px 4px rgba(0,0,0,0.3)`
                                        btn.style.borderColor = `${color}60`
                                      }}
                                      title={isFilled ? (contributor?.playerName || 'Filled') : `Click to join (30 stamina + 10 work)`}
                                    >
                                      {isFilled
                                        ? (contributor?.playerName?.slice(0, 5) || '✓')
                                        : `${i + 1}`}
                                    </button>
                                  )
                                })}
                              </div>
                              <div style={{ fontSize: '8px', color: '#475569', marginTop: '3px', textAlign: 'center' }}>
                                Click an empty slot to join · 30 stamina + 10 work
                              </div>
                            </div>

                            {/* Target Selection */}
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>
                                🎯 TARGET ({fullOp.targetType.toUpperCase()})
                              </div>
                              {(fullOp.targetType === 'country' || fullOp.targetType === 'battle') && (
                                <select value={targetCountry} onChange={e => setTargetCountry(e.target.value)}
                                  style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                                  <option value="" disabled>Select Country...</option>
                                  {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                </select>
                              )}
                              {fullOp.targetType === 'region' && (
                                <>
                                  <select value={targetCountry} onChange={e => { setTargetCountry(e.target.value); setTargetRegion('') }}
                                    style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', marginBottom: '6px' }}>
                                    <option value="" disabled>Select Country...</option>
                                    {foreignCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                  </select>
                                  {targetCountry && (
                                    <RegionPicker
                                      countryCode={targetCountry}
                                      value={targetRegion}
                                      onChange={setTargetRegion}
                                    />
                                  )}
                                </>
                              )}
                              {fullOp.targetType === 'player' && (
                                <input type="text" value={targetPlayer} onChange={e => setTargetPlayer(e.target.value)}
                                  placeholder="Enter player name..."
                                  style={{ width: '100%', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: '#fff', padding: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }} />
                              )}
                            </div>

                            {/* Launch Button */}
                            <button
                              onClick={handleLaunch}
                              disabled={!canLaunch || (!targetCountry && !targetPlayer) || launching}
                              style={{
                                width: '100%', padding: '10px', fontSize: '11px', fontWeight: 900,
                                letterSpacing: '1px',
                                cursor: canLaunch && (targetCountry || targetPlayer) ? 'pointer' : 'not-allowed',
                                background: canLaunch && (targetCountry || targetPlayer)
                                  ? `linear-gradient(135deg, ${color}20, ${color}08)`
                                  : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${canLaunch && (targetCountry || targetPlayer) ? color : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: '4px',
                                color: canLaunch && (targetCountry || targetPlayer) ? color : '#475569',
                                opacity: launching ? 0.5 : 1,
                              }}
                            >
                              {launching ? '⏳ LAUNCHING...' :
                               !canLaunch ? (fullOp.pillar === 'espionage' ? '🔒 NEED 1+ PLAYER' : `🔒 FILL ALL ${fullOp.playersRequired} SLOTS`) :
                               (!targetCountry && !targetPlayer) ? 'SELECT A TARGET' :
                               '🚀 LAUNCH'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ══════════════════════════════════════ */}
      {/*  TAB: ACTIVE OPS + PUZZLE             */}
      {/* ══════════════════════════════════════ */}
      {tab === 'active' && (
        <>
          {/* Breach Protocol Puzzle (fullscreen-ish overlay) */}
          {puzzle && (
            <BreachProtocol
              attemptId={puzzle.attemptId}
              initialGrid={puzzle.grid}
              side={puzzle.side}
              raceMode={puzzle.raceMode}
              timeRemaining={puzzle.timeRemaining}
              onComplete={handlePuzzleComplete}
            />
          )}

          {/* Active Operations List */}
          {!puzzle && (
            <div className="hud-card" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
              <div className="hud-card__title" style={{ color: '#60a5fa' }}>🔄 ACTIVE OPERATIONS</div>
              {activeOps.length === 0 ? (
                <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
                  No active operations. Launch one from the Operations tab.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {activeOps.map(op => {
                    const meta = OP_MAP[op.operationId] || { name: op.operationId, icon: '❓', desc: '' }
                    const color = PILLAR_COLORS[op.pillar] || '#fff'
                    const isPuzzle = op.status === 'puzzle_phase'
                    const isCompleted = op.status === 'completed'
                    const isIncoming = (op as any).isIncoming === true

                    const isSabRace = op.result?.sabotageRace === true

                    return (
                      <div key={op.id} style={{
                        padding: '10px', borderRadius: '6px',
                        background: isIncoming
                          ? 'rgba(255,68,68,0.05)'
                          : isSabRace ? 'rgba(255,136,0,0.05)'
                          : isPuzzle ? 'rgba(0,255,136,0.05)' : 'rgba(59,130,246,0.05)',
                        border: `1px solid ${isIncoming
                          ? 'rgba(255,68,68,0.25)'
                          : isSabRace ? 'rgba(255,136,0,0.25)'
                          : isPuzzle ? 'rgba(0,255,136,0.2)' : isCompleted ? 'rgba(34,211,138,0.2)' : 'rgba(59,130,246,0.2)'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: isIncoming ? '#ff6666' : isSabRace ? '#ff8800' : '#e0f2fe' }}>
                              {isIncoming ? '🚨' : isSabRace ? '⚔️' : meta.icon} {isIncoming ? `INCOMING: ${meta.name}` : meta.name}
                            </div>
                            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                              {isIncoming ? `From: ${op.countryCode}` : `Target: ${op.targetCountry || op.targetRegion || 'Unknown'}`}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '8px', fontWeight: 900, padding: '3px 8px', borderRadius: '3px',
                            textTransform: 'uppercase',
                            background: isIncoming ? 'rgba(255,68,68,0.15)' : isSabRace ? 'rgba(255,136,0,0.15)' : isPuzzle ? 'rgba(0,255,136,0.15)' : isCompleted ? 'rgba(34,211,138,0.15)' : 'rgba(59,130,246,0.15)',
                            color: isIncoming ? '#ff6666' : isSabRace ? '#ff8800' : isPuzzle ? '#00ff88' : isCompleted ? '#22d38a' : '#60a5fa',
                            border: `1px solid ${isIncoming ? '#ff444440' : isSabRace ? '#ff880040' : isPuzzle ? '#00ff8840' : isCompleted ? '#22d38a40' : '#3b82f640'}`,
                          }}>
                            {isIncoming ? '🛡️ DEFEND' : isSabRace ? '⚔️ STAMINA RACE' : op.status === 'puzzle_phase' ? '🖥️ PUZZLE' : op.status}
                          </span>
                        </div>

                        {/* Sabotage Stamina Race UI */}
                        {isPuzzle && isSabRace && (() => {
                          const raceD = sabRaceData[op.id] || op.result?.raceCounter || { attacker: 0, defender: 0 }
                          const total = Math.max(1, raceD.attacker + raceD.defender)
                          const atkPct = (raceD.attacker / total) * 100
                          const mySide = isIncoming ? 'defender' : 'attacker'

                          return (
                            <div style={{ marginTop: '8px' }}>
                              {/* Counter bars */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '3px' }}>
                                <span style={{ color: '#00ff88', fontWeight: 700 }}>⚔️ ATK: {raceD.attacker.toFixed(1)}</span>
                                <span style={{ color: '#ff6666', fontWeight: 700 }}>🛡️ DEF: {raceD.defender.toFixed(1)}</span>
                              </div>
                              <div style={{ height: '10px', borderRadius: '4px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{ width: `${atkPct}%`, background: 'linear-gradient(90deg, #00ff88, #00cc66)', transition: 'width 0.3s' }} />
                                <div style={{ width: `${100 - atkPct}%`, background: 'linear-gradient(90deg, #ff4444, #cc0000)', transition: 'width 0.3s' }} />
                              </div>

                              {/* Contribute button */}
                              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                <button
                                  onClick={() => handleSabotageContribute(op.id, mySide)}
                                  style={{
                                    flex: 1, padding: '8px', fontSize: '10px', fontWeight: 700,
                                    background: mySide === 'attacker' ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                                    border: `1px solid ${mySide === 'attacker' ? '#00ff8840' : '#ff444440'}`,
                                    borderRadius: '4px',
                                    color: mySide === 'attacker' ? '#00ff88' : '#ff6666',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ⚡ CONTRIBUTE (10 stamina)
                                </button>
                                <button
                                  onClick={() => fetchSabotageRace(op.id)}
                                  style={{
                                    padding: '8px', fontSize: '10px', fontWeight: 700,
                                    background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f640',
                                    borderRadius: '4px', color: '#60a5fa', cursor: 'pointer',
                                  }}
                                >
                                  🔄
                                </button>
                              </div>

                              {/* Recent contributions */}
                              {raceD.contributions && raceD.contributions.length > 0 && (
                                <div style={{ marginTop: '6px', maxHeight: '60px', overflow: 'auto' }}>
                                  {raceD.contributions.slice(-5).reverse().map((c: any, i: number) => (
                                    <div key={i} style={{
                                      fontSize: '8px', display: 'flex', justifyContent: 'space-between',
                                      padding: '1px 4px', color: c.side === 'attacker' ? '#00cc66' : '#ff6666',
                                    }}>
                                      <span>{c.playerName}: +{c.points} {c.isCrit ? '💥CRIT' : ''}</span>
                                      <span style={{ color: '#475569' }}>×{c.multiplier}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        {/* Puzzle actions (non-sabotage) */}
                        {isPuzzle && !isSabRace && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                            {isIncoming ? (
                              <button
                                onClick={() => startPuzzle(op.id, 'defender')}
                                style={{
                                  flex: 1, padding: '8px', fontSize: '10px', fontWeight: 700,
                                  background: 'rgba(255,68,68,0.1)', border: '1px solid #ff444440',
                                  borderRadius: '4px', color: '#ff6666', cursor: 'pointer',
                                }}
                              >
                                🛡️ DEFEND (Counter-Hack)
                              </button>
                            ) : (
                              <button
                                onClick={() => startPuzzle(op.id, 'attacker')}
                                style={{
                                  flex: 1, padding: '8px', fontSize: '10px', fontWeight: 700,
                                  background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff8840',
                                  borderRadius: '4px', color: '#00ff88', cursor: 'pointer',
                                }}
                              >
                                🔧 HACK (Attacker)
                              </button>
                            )}
                            <button
                              onClick={() => fetchRaceStatus(op.id)}
                              style={{
                                flex: 1, padding: '8px', fontSize: '10px', fontWeight: 700,
                                background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f640',
                                borderRadius: '4px', color: '#60a5fa', cursor: 'pointer',
                              }}
                            >
                              📊 RACE STATUS
                            </button>
                          </div>
                        )}

                        {/* Results for completed */}
                        {isCompleted && op.result && (
                          <div style={{
                            marginTop: '6px', padding: '6px', fontSize: '9px',
                            background: 'rgba(0,0,0,0.3)', borderRadius: '4px', color: '#94a3b8',
                          }}>
                            {op.result.effect && <div>Effect: <span style={{ color: '#e2e8f0' }}>{op.result.effect}</span></div>}
                            {op.result.succeeded !== undefined && (
                              <div>Result: <span style={{ color: op.result.succeeded ? '#22d38a' : '#ef4444' }}>
                                {op.result.succeeded ? 'SUCCESS' : 'FAILED'}
                              </span></div>
                            )}
                            {op.result.rewards && (
                              <div style={{ marginTop: '2px', color: '#fbbf24' }}>
                                💰 +${op.result.rewards.money?.toLocaleString()} · 🎖️ +{op.result.rewards.divisions} division
                              </div>
                            )}
                            {op.result.raceData?.defenderBlocked && (
                              <div style={{ color: '#ff6666', marginTop: '2px' }}>🛡️ Blocked by defender!</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Race Status Modal */}
          {raceStatus && !puzzle && (
            <div className="hud-card" style={{ borderColor: 'rgba(0,255,136,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="hud-card__title" style={{ color: '#00ff88' }}>📊 BREACH RACE STATUS</div>
                <button onClick={() => setRaceStatus(null)} style={{
                  fontSize: '10px', color: '#64748b', cursor: 'pointer',
                  background: 'none', border: 'none',
                }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div style={{
                  padding: '10px', borderRadius: '6px', textAlign: 'center',
                  background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.2)',
                }}>
                  <div style={{ fontSize: '9px', color: '#ff6666', fontWeight: 700, marginBottom: '4px' }}>⚔️ ATTACKERS</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#ff6666' }}>
                    {raceStatus.attackers.wins}/{raceStatus.attackers.joined}
                  </div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>wins / joined (max {raceStatus.attackers.max})</div>
                </div>
                <div style={{
                  padding: '10px', borderRadius: '6px', textAlign: 'center',
                  background: 'rgba(68,136,255,0.05)', border: '1px solid rgba(68,136,255,0.2)',
                }}>
                  <div style={{ fontSize: '9px', color: '#6699ff', fontWeight: 700, marginBottom: '4px' }}>🛡️ DEFENDERS</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#6699ff' }}>
                    {raceStatus.defenders.wins}/{raceStatus.defenders.joined}
                  </div>
                  <div style={{ fontSize: '8px', color: '#94a3b8' }}>wins / joined (max {raceStatus.defenders.max})</div>
                </div>
              </div>
              <div style={{
                marginTop: '8px', textAlign: 'center', fontSize: '10px',
                color: raceStatus.resolved ? '#22d38a' : '#ffcc00',
              }}>
                {raceStatus.resolved ? '✅ Race resolved' : `⏱️ ${Math.floor(raceStatus.timeRemaining / 60000)}m remaining`}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════ */}
      {/*  TAB: REPORTS                         */}
      {/* ══════════════════════════════════════ */}
      {tab === 'reports' && (
        <div className="hud-card">
          <div className="hud-card__title">📋 INTELLIGENCE REPORTS</div>
          {reports.length === 0 ? (
            <p style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
              No reports yet. Launch operations to gather intelligence.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {reports.map(r => {
                const meta = OP_MAP[r.operationId] || { name: r.operationId, icon: '❓', desc: '' }
                const succeeded = r.result?.succeeded
                const pillarColor = PILLAR_COLORS[r.pillar] || '#fff'
                const report = r.result?.report
                const detected = r.result?.detected

                return (
                  <div key={r.id} style={{
                    padding: '10px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.3)',
                    border: `1px solid ${succeeded ? `${pillarColor}30` : 'rgba(239,68,68,0.2)'}`,
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: pillarColor }}>
                        {meta.icon} {meta.name}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {detected && (
                          <span style={{
                            fontSize: '7px', fontWeight: 700, padding: '2px 5px', borderRadius: '3px',
                            color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
                          }}>👁️ DETECTED</span>
                        )}
                        <span style={{
                          fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                          color: succeeded ? '#22d38a' : '#ef4444',
                          background: succeeded ? 'rgba(34,211,138,0.1)' : 'rgba(239,68,68,0.1)',
                        }}>
                          {succeeded ? '✅ SUCCESS' : '❌ FAILED'}
                        </span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div style={{ fontSize: '8px', color: '#64748b', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span>🎯 {r.targetCountry || 'Unknown'}</span>
                      <span>📅 {new Date(r.deployedAt).toLocaleDateString()}</span>
                      {r.result?.slotsFilled && <span>👥 {r.result.slotsFilled}/5 operators</span>}
                      {r.result?.successBonus > 0 && <span>📈 +{r.result.successBonus}% bonus</span>}
                    </div>

                    {/* Effect */}
                    {r.result?.effect && (
                      <div style={{ fontSize: '9px', color: '#e2e8f0', marginTop: '4px', padding: '4px 6px', background: 'rgba(255,255,255,0.03)', borderRadius: '3px' }}>
                        ⚡ {r.result.effect}
                      </div>
                    )}

                    {/* Rewards */}
                    {r.result?.rewards && (
                      <div style={{ fontSize: '9px', color: '#fbbf24', marginTop: '4px' }}>
                        💰 +${r.result.rewards.money?.toLocaleString()} · 🎖️ +{r.result.rewards.divisions} division
                      </div>
                    )}

                    {/* Race/Defender data */}
                    {r.result?.raceData && (
                      <div style={{ fontSize: '9px', marginTop: '4px' }}>
                        {r.result.raceData.defenderBlocked ? (
                          <span style={{ color: '#ff6666' }}>🛡️ Operation blocked by defender!</span>
                        ) : (
                          <span style={{ color: '#ffcc00' }}>⚔️ Attacker: {r.result.raceData.attackerWins} vs Defender: {r.result.raceData.defenderWins}</span>
                        )}
                      </div>
                    )}

                    {/* Themed Report Data */}
                    {report && (
                      <details style={{ marginTop: '6px' }}>
                        <summary style={{ fontSize: '9px', color: pillarColor, cursor: 'pointer', fontWeight: 700 }}>
                          📊 {report.type || 'View Report Data'}
                        </summary>
                        {report.summary && (
                          <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                            {report.summary}
                          </div>
                        )}
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px',
                          marginTop: '6px', fontSize: '8px',
                        }}>
                          {Object.entries(report)
                            .filter(([k]) => !['type', 'summary', 'note'].includes(k))
                            .map(([k, v]) => (
                              <div key={k} style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: '3px 6px', borderRadius: '3px',
                                background: 'rgba(255,255,255,0.02)',
                              }}>
                                <span style={{ color: '#64748b' }}>{k.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                                  {typeof v === 'boolean' ? (v ? '✅' : '❌') :
                                   typeof v === 'number' ? v.toLocaleString() : String(v)}
                                </span>
                              </div>
                            ))}
                        </div>
                        {report.note && (
                          <div style={{ fontSize: '8px', color: '#a78bfa', marginTop: '4px', fontStyle: 'italic' }}>
                            🔐 {report.note}
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
