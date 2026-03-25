/**
 * AdminPanel.tsx — Full Ley Line Admin Control Center
 * Accessible only to admin-role players.
 * Features:
 *  - Live ley line list (DB + static) with enable/disable/delete
 *  - Force-run engine
 *  - Per-country generation
 *  - Generate All button
 *  - Create / Edit line form modal
 *  - Game stats overview
 */
import { useState, useEffect, useCallback } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import {
  Zap, Play, RefreshCw, Trash2, ToggleLeft, ToggleRight,
  Plus, Settings, Activity, Globe, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Clock, Database, Shield,
  Users, Swords, TrendingUp
} from 'lucide-react'

// ── helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000) // 12s timeout
  try {
    const res = await fetch(`/api/admin${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts?.headers,
      },
    })
    clearTimeout(timer)
    if (res.status === 401 || res.status === 403) throw new Error('UNAUTHORIZED')
    // Safe parse — 5xx errors may return HTML
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { ok: false, error: `Server error ${res.status}` } }
  } catch (e: any) {
    clearTimeout(timer)
    if (e.name === 'AbortError') return { ok: false, error: 'Request timed out — is the server running?' }
    throw e
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DbLine {
  id: string
  name: string
  continent: string
  archetype: 'dominion' | 'prosperity' | 'convergence'
  blocks: string[]
  bonuses: Record<string, number>
  tradeoffs: Record<string, number>
  enabled: boolean
  autoGen: boolean
  countryCode: string | null
  createdAt: string
  updatedAt: string
}

interface EngineResult {
  lines: number
  nodes: number
  countries: number
  activations: string[]
  deactivations: string[]
  computedAt: string
}

interface GameStats {
  playerCount: number
  activeBattles: number
  activeWars: number
  totalMoneyInCirculation: number
}

// ── Archetype style ──────────────────────────────────────────────────────────

const ARCH_STYLE = {
  dominion:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: '⚔️',  label: 'DOMINION'    },
  prosperity:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   icon: '💰',  label: 'PROSPERITY'  },
  convergence: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',   icon: '🔮',  label: 'CONVERGENCE' },
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string|number, color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
      borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12
    }}>
      <div style={{ color, opacity: 0.9 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', fontFamily: 'Share Tech Mono, monospace' }}>{value}</div>
      </div>
    </div>
  )
}

function Badge({ archetype }: { archetype: keyof typeof ARCH_STYLE }) {
  const s = ARCH_STYLE[archetype]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.color}44`,
      letterSpacing: '0.06em', fontFamily: 'monospace',
    }}>{s.icon} {s.label}</span>
  )
}

function Spinner() {
  return <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 14 }}>⟳</span>
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminPanel() {
  const player = usePlayerStore()

  const [loading,       setLoading]       = useState(false)
  const [lines,         setLines]         = useState<DbLine[]>([])
  const [staticLines,   setStaticLines]   = useState<DbLine[]>([])
  const [stats,         setStats]         = useState<GameStats | null>(null)
  const [engineResult,  setEngineResult]  = useState<EngineResult | null>(null)
  const [engineRunning, setEngineRunning] = useState(false)
  const [genCc,         setGenCc]         = useState('')
  const [genRunning,    setGenRunning]    = useState(false)
  const [toast,         setToast]         = useState<{ msg: string; type: 'ok'|'err' } | null>(null)
  const [expandedLine,  setExpandedLine]  = useState<string | null>(null)
  const [showCreate,    setShowCreate]    = useState(false)
  const [createForm,    setCreateForm]    = useState({
    id: '', name: '', continent: 'north_america', archetype: 'dominion', blocks: '', countryCode: '',
  })
  const [filter,        setFilter]        = useState('')
  // ── Country Randomizer ──
  const [randCc,        setRandCc]        = useState('')
  const [randCount,     setRandCount]     = useState(6)
  const [randClear,     setRandClear]     = useState(true)
  const [randBusy,      setRandBusy]      = useState(false)
  const [randResult,    setRandResult]    = useState<any>(null)
  const [previewBusy,   setPreviewBusy]   = useState(false)
  const [previewResult, setPreviewResult] = useState<any>(null)

  // ── notifications ──
  const notify = useCallback((msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── load data ──
  const loadLines = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('/ley-lines')
      if (data.ok) {
        setLines(data.result.dbLines ?? [])
        setStaticLines(data.result.staticFallbackLines ?? [])
      }
    } catch { notify('Failed to load lines', 'err') }
    setLoading(false)
  }, [notify])

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch('/stats')
      if (data.ok) setStats(data.result)
    } catch {}
  }, [])

  useEffect(() => { loadLines(); loadStats() }, [loadLines, loadStats])

  // ── engine run ──
  const runEngine = async () => {
    setEngineRunning(true)
    try {
      const data = await apiFetch('/ley-lines/run-engine', { method: 'POST', body: '{}' })
      if (data.ok) {
        setEngineResult(data.result)
        notify(`Engine ran — ${data.result.lines} lines, ${data.result.activations?.length ?? 0} activations`)
        await loadLines()
      } else { notify(data.error ?? 'Engine error', 'err') }
    } catch (e) { notify('Engine request failed', 'err') }
    setEngineRunning(false)
  }

  // ── generate for country ──
  const generateCountry = async () => {
    if (!genCc.trim()) return
    setGenRunning(true)
    try {
      const data = await apiFetch(`/ley-lines/generate/${genCc.trim().toUpperCase()}`, { method: 'POST', body: '{}' })
      if (data.ok) { notify(`Generated ${data.result.generated?.length ?? 3} lines for ${data.result.cc}`); await loadLines() }
      else notify(data.error ?? 'Generation failed', 'err')
    } catch { notify('Generation request failed', 'err') }
    setGenRunning(false)
  }

  // ── Country Randomizer ──
  const previewCountry = async () => {
    if (!randCc.trim()) { notify('Enter a country code', 'err'); return }
    setPreviewBusy(true); setPreviewResult(null); setRandResult(null)
    try {
      const data = await apiFetch(`/country/${randCc.trim().toUpperCase()}/preview`)
      if (data.ok) setPreviewResult(data.result)
      else notify(data.error ?? 'Preview failed', 'err')
    } catch { notify('Preview request failed', 'err') }
    setPreviewBusy(false)
  }

  const randomizeCountry = async () => {
    if (!randCc.trim()) { notify('Enter a country code', 'err'); return }
    setRandBusy(true); setRandResult(null); setPreviewResult(null)
    try {
      const data = await apiFetch(`/country/${randCc.trim().toUpperCase()}/randomize`, {
        method: 'POST',
        body: JSON.stringify({ regionCount: randCount, clear: randClear }),
      })
      if (data.ok) { setRandResult(data.result); notify(`✓ ${data.result.regionCount} regions + ${data.result.leyLinesGenerated?.length ?? 3} lines for ${data.result.cc}`); await loadLines() }
      else notify(data.error ?? 'Randomize failed', 'err')
    } catch { notify('Randomize request failed', 'err') }
    setRandBusy(false)
  }

  // ── generate all ──
  const generateAll = async () => {
    setGenRunning(true)
    try {
      const data = await apiFetch('/ley-lines/generate-all', { method: 'POST', body: '{}' })
      if (data.ok) { notify(`Generated ${data.result.generated} lines for ${data.result.total} countries`); await loadLines() }
      else notify(data.error ?? 'Generation failed', 'err')
    } catch { notify('Generate-all failed', 'err') }
    setGenRunning(false)
  }

  // ── toggle enable ──
  const toggleLine = async (id: string, enabled: boolean) => {
    const endpoint = enabled ? 'disable' : 'enable'
    const data = await apiFetch(`/ley-lines/${id}/${endpoint}`, { method: 'POST', body: '{}' })
    if (data.ok) { notify(`${id} ${enabled ? 'disabled' : 'enabled'}`); await loadLines() }
    else notify(data.error ?? 'Toggle failed', 'err')
  }

  // ── delete ──
  const deleteLine = async (id: string) => {
    if (!confirm(`Delete ley line "${id}"? This cannot be undone.`)) return
    const data = await apiFetch(`/ley-lines/${id}`, { method: 'DELETE' })
    if (data.ok) { notify(`${id} deleted`); await loadLines() }
    else notify(data.error ?? 'Delete failed', 'err')
  }

  // ── create ──
  const createLine = async () => {
    if (!createForm.id || !createForm.name || !createForm.blocks) { notify('Fill all required fields', 'err'); return }
    const blocks = createForm.blocks.split(',').map(b => b.trim()).filter(Boolean)
    if (blocks.length < 2) { notify('Need at least 2 region blocks', 'err'); return }
    const body = JSON.stringify({
      id: createForm.id.toUpperCase(),
      name: createForm.name,
      continent: createForm.continent,
      archetype: createForm.archetype,
      blocks,
      bonuses: {},
      tradeoffs: {},
      countryCode: createForm.countryCode.toUpperCase() || undefined,
      enabled: true,
    })
    const data = await apiFetch('/ley-lines', { method: 'POST', body })
    if (data.ok) {
      notify(`Created ${createForm.id}`)
      setShowCreate(false)
      setCreateForm({ id: '', name: '', continent: 'north_america', archetype: 'dominion', blocks: '', countryCode: '' })
      await loadLines()
    } else notify(data.error ?? 'Create failed', 'err')
  }

  // ── filter ──
  const filtered = lines.filter(l =>
    !filter || l.id.toLowerCase().includes(filter.toLowerCase()) ||
    l.name.toLowerCase().includes(filter.toLowerCase()) ||
    (l.countryCode ?? '').toLowerCase().includes(filter.toLowerCase())
  )

  // ── access guard ──
  if (player.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <Shield size={40} color="#ef4444" />
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14, letterSpacing: '0.1em' }}>ACCESS DENIED</div>
        <div style={{ color: '#64748b', fontSize: 11 }}>Admin role required.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0', height: '100%', overflowY: 'auto' }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'ok' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', display: 'flex', gap: 8, alignItems: 'center',
          fontFamily: 'Share Tech Mono, monospace',
        }}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.12) 100%)',
        border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Shield size={22} color="#8b5cf6" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.08em', fontFamily: 'Share Tech Mono, monospace' }}>
            ADMIN CONTROL CENTER
          </div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
            Logged in as <span style={{ color: '#8b5cf6' }}>{player.name}</span> · Role: <span style={{ color: '#22d38a' }}>ADMIN</span>
          </div>
        </div>
        <button onClick={() => { loadLines(); loadStats() }} style={btnStyle('#0f172a', '#3b82f6')} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <StatCard icon={<Users size={18}/>}    label="Players"    value={stats.playerCount}        color="#3b82f6" />
          <StatCard icon={<Swords size={18}/>}   label="Battles"    value={stats.activeBattles}      color="#ef4444" />
          <StatCard icon={<Globe size={18}/>}    label="Wars"       value={stats.activeWars}         color="#f59e0b" />
          <StatCard icon={<TrendingUp size={18}/>} label="$M Total" value={`$${(stats.totalMoneyInCirculation/1e6).toFixed(1)}M`} color="#22d38a" />
        </div>
      )}

      {/* ── Engine control card ── */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={15} color="#22d38a" /> LEY LINE ENGINE</span>
          {engineResult && (
            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
              Last run: {new Date(engineResult.computedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={runEngine} disabled={engineRunning} style={btnStyle('#22d38a22', '#22d38a', engineRunning)}>
            {engineRunning ? <><Spinner /> Running…</> : <><Play size={13}/> Run Engine</>}
          </button>
          {engineResult && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Lines',    val: engineResult.lines,    color: '#22d38a' },
                { label: 'Nodes',    val: engineResult.nodes,    color: '#3b82f6' },
                { label: 'Countries',val: engineResult.countries, color: '#f59e0b' },
              ].map(s => (
                <span key={s.label} style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 4, color: s.color, fontFamily: 'monospace' }}>
                  {s.label}: <b>{s.val}</b>
                </span>
              ))}
              {engineResult.activations?.length > 0 && (
                <span style={{ fontSize: 10, color: '#22d38a' }}>⚡ +{engineResult.activations.length} activated</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Country Randomizer card ── */}
      <div style={{ ...cardStyle, border: '1px solid rgba(34,211,138,0.25)', background: 'rgba(34,211,138,0.03)' }}>
        <div style={{ ...cardHeader, color: '#22d38a' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={15} color="#22d38a" /> COUNTRY RANDOMIZER</span>
          <span style={{ fontSize: 9, color: '#475569', fontWeight: 400, fontFamily: 'sans-serif', textTransform: 'none' }}>Seed regions &amp; ley lines from real map IDs</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={labelStyle}>Country Code</div>
            <input value={randCc} onChange={e => setRandCc(e.target.value.toUpperCase())}
              placeholder="JP" maxLength={3} style={{ ...inputStyle, width: 64 }}
              onKeyDown={e => e.key === 'Enter' && previewCountry()}/>
          </div>
          <div>
            <div style={labelStyle}>Regions</div>
            <input type="number" value={randCount} onChange={e => setRandCount(Number(e.target.value))}
              min={2} max={20} style={{ ...inputStyle, width: 60 }}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingBottom: 2 }}>
            <input type="checkbox" id="ap-randClear" checked={randClear} onChange={e => setRandClear(e.target.checked)} style={{ accentColor: '#22d38a' }}/>
            <label htmlFor="ap-randClear" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer', color: '#94a3b8' }}>Clear old</label>
          </div>
          <button onClick={previewCountry} disabled={previewBusy || !randCc} style={btnStyle('#3b82f622', '#3b82f6', previewBusy || !randCc)}>
            {previewBusy ? <Spinner /> : <Settings size={13} />} Preview
          </button>
          <button onClick={randomizeCountry} disabled={randBusy || !randCc} style={btnStyle('#f59e0b22', '#f59e0b', randBusy || !randCc)}>
            {randBusy ? <Spinner /> : <Zap size={13} />} Randomize → Map
          </button>
        </div>

        {/* Preview result */}
        {previewResult && !randResult && (
          <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 7, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>👁 {previewResult.cc} — {previewResult.regionCount} regions · {previewResult.leyLineCount} ley lines</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {previewResult.regions?.map((r: any) => (
                <span key={r.regionId} style={{ fontSize: 9, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{r.regionId}</span>
              ))}
              {previewResult.regionCount === 0 && <span style={{ fontSize: 11, color: '#475569' }}>No ownership rows — click Randomize to seed.</span>}
            </div>
            {previewResult.leyLines?.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {previewResult.leyLines.map((l: any) => (
                  <span key={l.id} style={{ fontSize: 9, fontFamily: 'monospace', color: ARCH_STYLE[l.archetype as keyof typeof ARCH_STYLE]?.color ?? '#fff', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 3 }}>{l.id}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Randomize result */}
        {randResult && (
          <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>⚡ {randResult.cc} — {randResult.regionCount} regions assigned{randResult.cleared ? ' (cleared first)' : ''}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {randResult.regionsAssigned?.map((r: string) => (
                <span key={r} style={{ fontSize: 9, background: 'rgba(245,158,11,0.12)', color: '#fbbf24', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{r}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(randResult.leyLines ?? randResult.leyLinesGenerated)?.map((l: any) => (
                <span key={l.id ?? l} style={{ fontSize: 9, fontFamily: 'monospace', color: ARCH_STYLE[l.archetype as keyof typeof ARCH_STYLE]?.color ?? '#22d38a', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 3 }}>{l.id ?? l}</span>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#22d38a' }}>✓ Saved to DB — refresh game map to see changes.</div>
          </div>
        )}
      </div>

      {/* ── Generate card ── */}
      <div style={cardStyle}>
        <div style={cardHeader}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Globe size={15} color="#f59e0b" /> GENERATE LEY LINES</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={genCc} onChange={e => setGenCc(e.target.value)}
            placeholder="Country code (e.g. DE)"
            style={inputStyle}
            maxLength={4}
          />
          <button onClick={generateCountry} disabled={genRunning || !genCc.trim()} style={btnStyle('#f59e0b22', '#f59e0b', genRunning || !genCc.trim())}>
            {genRunning ? <Spinner /> : <Zap size={13} />} Generate
          </button>
          <button onClick={generateAll} disabled={genRunning} style={btnStyle('#8b5cf622', '#8b5cf6', genRunning)}>
            {genRunning ? <Spinner /> : <Database size={13} />} Generate ALL Countries
          </button>
        </div>
      </div>

      {/* ── Ley Lines table ── */}
      <div style={cardStyle}>
        <div style={{ ...cardHeader, marginBottom: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={15} color="#8b5cf6" />
            LEY LINE DEFINITIONS
            <span style={{ fontSize: 10, background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', padding: '1px 8px', borderRadius: 10 }}>
              {filtered.length} lines
            </span>
            {staticLines.length > 0 && (
              <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.15)', color: '#64748b', padding: '1px 8px', borderRadius: 10 }}>
                +{staticLines.length} static-only
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." style={{ ...inputStyle, width: 130 }} />
            <button onClick={() => setShowCreate(s => !s)} style={btnStyle('#22d38a22', '#22d38a')}>
              <Plus size={13} /> New Line
            </button>
          </div>
        </div>

        {/* ── Create form ── */}
        {showCreate && (
          <div style={{
            background: 'rgba(34,211,138,0.05)', border: '1px solid rgba(34,211,138,0.2)',
            borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#22d38a', letterSpacing: '0.08em' }}>+ CREATE NEW LINE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <div>
                <label style={labelStyle}>Line ID *</label>
                <input value={createForm.id} onChange={e => setCreateForm(f => ({...f, id: e.target.value}))} placeholder="e.g. DE-DOMINION" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Name *</label>
                <input value={createForm.name} onChange={e => setCreateForm(f => ({...f, name: e.target.value}))} placeholder="Germany — The Iron Cross" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Country Code</label>
                <input value={createForm.countryCode} onChange={e => setCreateForm(f => ({...f, countryCode: e.target.value}))} placeholder="DE" style={inputStyle} maxLength={4} />
              </div>
              <div>
                <label style={labelStyle}>Archetype *</label>
                <select value={createForm.archetype} onChange={e => setCreateForm(f => ({...f, archetype: e.target.value}))} style={inputStyle}>
                  <option value="dominion">⚔️ Dominion</option>
                  <option value="prosperity">💰 Prosperity</option>
                  <option value="convergence">🔮 Convergence</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Continent *</label>
                <select value={createForm.continent} onChange={e => setCreateForm(f => ({...f, continent: e.target.value}))} style={inputStyle}>
                  <option value="north_america">North America</option>
                  <option value="south_america">South America</option>
                  <option value="europe">Europe</option>
                  <option value="africa">Africa</option>
                  <option value="asia">Asia</option>
                  <option value="oceania">Oceania</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Region Blocks * (comma separated)</label>
                <input value={createForm.blocks} onChange={e => setCreateForm(f => ({...f, blocks: e.target.value}))} placeholder="DE-BY, DE-BW, DE-NW" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createLine} style={btnStyle('#22d38a22', '#22d38a')}><Plus size={13}/> Create</button>
              <button onClick={() => setShowCreate(false)} style={btnStyle('rgba(255,255,255,0.05)', '#64748b')}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Line rows ── */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 24, fontSize: 12 }}><Spinner /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b', padding: 24, fontSize: 12 }}>
            No lines found. Use "Generate All" to seed every country.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(line => {
              const isExpanded = expandedLine === line.id
              const s = ARCH_STYLE[line.archetype] ?? ARCH_STYLE.dominion
              return (
                <div key={line.id} style={{
                  background: line.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${line.enabled ? s.color + '33' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 7, overflow: 'hidden', opacity: line.enabled ? 1 : 0.6,
                }}>
                  {/* Row header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: s.color, minWidth: 120, fontWeight: 700 }}>
                      {line.id}
                    </span>
                    <span style={{ fontSize: 11, color: '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {line.name}
                    </span>
                    <Badge archetype={line.archetype} />
                    <span style={{ fontSize: 10, color: '#475569', minWidth: 60, textAlign: 'center' }}>
                      {line.blocks.length} regions
                    </span>
                    {line.autoGen && (
                      <span style={{ fontSize: 9, color: '#475569', background: 'rgba(71,85,105,0.2)', padding: '1px 5px', borderRadius: 3 }}>AUTO</span>
                    )}
                    {/* Actions */}
                    <button onClick={() => toggleLine(line.id, line.enabled)} title={line.enabled ? 'Disable' : 'Enable'} style={iconBtn(line.enabled ? '#22d38a' : '#64748b')}>
                      {line.enabled ? <ToggleRight size={15}/> : <ToggleLeft size={15}/>}
                    </button>
                    <button onClick={() => deleteLine(line.id)} title="Delete" style={iconBtn('#ef4444')}>
                      <Trash2 size={13}/>
                    </button>
                    <button onClick={() => setExpandedLine(isExpanded ? null : line.id)} style={iconBtn('#64748b')}>
                      {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={detailLabel}>Region Blocks</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {line.blocks.map(b => (
                              <span key={b} style={{ fontSize: 10, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={detailLabel}>Bonuses</div>
                          {Object.entries(line.bonuses).length === 0
                            ? <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>None</div>
                            : Object.entries(line.bonuses).map(([k,v]) => (
                              <div key={k} style={{ fontSize: 10, color: '#22d38a', fontFamily: 'monospace' }}>
                                +{(v*100).toFixed(0)}% {k}
                              </div>
                            ))
                          }
                        </div>
                        <div>
                          <div style={detailLabel}>Tradeoffs</div>
                          {Object.entries(line.tradeoffs).length === 0
                            ? <div style={{ color: '#475569', fontSize: 10, marginTop: 4 }}>None</div>
                            : Object.entries(line.tradeoffs).map(([k,v]) => (
                              <div key={k} style={{ fontSize: 10, color: '#f87171', fontFamily: 'monospace' }}>
                                {v < 0 ? '' : '+'}{(v*100).toFixed(0)}% {k}
                              </div>
                            ))
                          }
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#475569', flexWrap: 'wrap', marginTop: 2 }}>
                        <span>Continent: <b style={{ color: '#94a3b8' }}>{line.continent}</b></span>
                        {line.countryCode && <span>Country: <b style={{ color: '#94a3b8' }}>{line.countryCode}</b></span>}
                        <span>Updated: <b style={{ color: '#94a3b8' }}>{new Date(line.updatedAt).toLocaleDateString()}</b></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Static-only fallback lines info */}
        {staticLines.length > 0 && !filter && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(100,116,139,0.06)', borderRadius: 7, border: '1px solid rgba(100,116,139,0.15)' }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 700 }}>
              📦 STATIC-ONLY LINES (not in DB — use Generate to persist)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {staticLines.map(l => (
                <span key={l.id} style={{ fontSize: 10, background: 'rgba(100,116,139,0.12)', color: '#94a3b8', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                  {l.id}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '14px 16px',
}
const cardHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em',
  fontFamily: 'Share Tech Mono, monospace', marginBottom: 12,
  textTransform: 'uppercase',
}
const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '5px 10px',
  outline: 'none', width: '100%', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', display: 'block', marginBottom: 3,
}
const detailLabel: React.CSSProperties = {
  fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase',
}
const btnStyle = (bg: string, col: string, disabled = false): React.CSSProperties => ({
  background: bg, color: col, border: `1px solid ${col}44`,
  borderRadius: 5, fontSize: 11, padding: '5px 12px', cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
  opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.2s',
  fontFamily: 'inherit',
})
const iconBtn = (col: string): React.CSSProperties => ({
  background: 'transparent', border: 'none', cursor: 'pointer', color: col,
  display: 'flex', alignItems: 'center', padding: '3px', borderRadius: 4,
  opacity: 0.7, transition: 'opacity 0.15s',
})
