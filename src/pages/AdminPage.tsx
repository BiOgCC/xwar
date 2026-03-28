/**
 * AdminPage.tsx — Full-stack admin dashboard at /admin
 * Covers: Stats, Players, Pipelines, Ley Lines, Market, News, Trade Routes
 */
import { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, Play, Zap, Database, Users, Swords, Globe,
  TrendingUp, Trash2, ToggleLeft, ToggleRight, Plus, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, LogOut, Activity, Newspaper, Anchor, Search,
  Settings, DollarSign, Package, BarChart3, Droplet, Wrench, Atom, Bitcoin,
  Wheat, Fish, Crosshair, CakeSlice, Beef, Medal, Leaf, CupSoda, UtensilsCrossed,
  ShieldAlert, Dices, Ship, Ban, Flame, StopCircle } from 'lucide-react'
import { LEY_LINE_DEFS } from '../data/leyLineRegistry'
import type { LeyLineDef as RegistryLineDef } from '../data/leyLineRegistry'

// ── API ───────────────────────────────────────────────────────────────────────
const B = 'http://localhost:3001'
async function api(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('token') || ''
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000) // 10s timeout
  try {
    const res = await fetch(`${B}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts?.headers },
    })
    clearTimeout(timer)
    if (res.status === 401 || res.status === 403) throw new Error('UNAUTHORIZED')
    // Safe JSON parse — some 5xx responses return HTML
    const text = await res.text()
    try { return JSON.parse(text) } catch { return { ok: false, error: `Server error ${res.status}` } }
  } catch (e: any) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error('Request timed out — is the server running on port 3001?')
    throw e
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats { playerCount: number; activeBattles: number; activeWars: number; totalMoneyInCirculation: number; disruptedTradeRoutes: string[] }
interface Player { id: string; name: string; countryCode: string; level: number; money: number; role: string; lastLogin: string }
interface LeyLine { id: string; name: string; archetype: string; blocks: string[]; bonuses: Record<string,number>; tradeoffs: Record<string,number>; enabled: boolean; autoGen: boolean; countryCode: string | null; updatedAt: string }
interface NewsItem { id: string; headline: string; category: string; createdAt: string }
interface Country { code: string; name: string; controller: string; empire: string | null; population: number; regions: number; military: number; color: string; fund: Record<string,number>; conqueredResources: string[]; player_count: number }

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  card: { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' } as React.CSSProperties,
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#e2e8f0', fontSize: 12, padding: '7px 12px', width: '100%', fontFamily: 'inherit', outline:'none' } as React.CSSProperties,
  label: { display:'block', fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontFamily: 'Share Tech Mono, monospace' },
}
const btn = (color: string, disabled = false): React.CSSProperties => ({
  background: `${color}18`, border: `1px solid ${color}44`, color, borderRadius: 7,
  fontSize: 12, padding: '7px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600,
  opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.15s',
})
const ARCH: Record<string,{color:string;label:string}> = {
  dominion:   { color:'#ef4444', label:'⚔️ Dom'    },
  prosperity: { color:'#f59e0b', label:'💰 Pros'   },
  convergence:{ color:'#8b5cf6', label:'🔮 Conv'   },
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg:string; type:'ok'|'err' }) {
  return (
    <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background: type==='ok'?'rgba(16,185,129,0.96)':'rgba(239,68,68,0.96)', color:'#fff', padding:'10px 22px', borderRadius:9, fontSize:13, fontWeight:600, zIndex:9999, display:'flex', gap:8, alignItems:'center', boxShadow:'0 4px 24px rgba(0,0,0,0.5)', fontFamily:'Share Tech Mono,monospace', animation:'fadeUp 0.2s ease' }}>
      {type==='ok'?<CheckCircle size={14}/>:<AlertTriangle size={14}/>} {msg}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function SC({ icon, label, value, color }: { icon:React.ReactNode; label:string; value:string|number; color:string }) {
  return (
    <div style={{ background:`${color}0d`, border:`1px solid ${color}28`, borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, flex:1, minWidth:130 }}>
      <div style={{ color, background:`${color}1a`, padding:9, borderRadius:8 }}>{icon}</div>
      <div>
        <div style={{ fontSize:9, color:'#64748b', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:20, fontWeight:800, color:'#e2e8f0', fontFamily:'Share Tech Mono,monospace' }}>{value}</div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed]           = useState<boolean|null>(null)
  const [tab, setTab]                  = useState<'overview'|'players'|'countries'|'leylines'|'pipelines'|'news'|'market'|'economy'|'map'|'battles'>('overview')
  const [stats, setStats]             = useState<Stats|null>(null)
  const [players, setPlayers]         = useState<Player[]>([])
  const [lines, setLines]             = useState<LeyLine[]>([])
  const [staticLines, setStaticLines] = useState<LeyLine[]>([])
  const [news, setNews]               = useState<NewsItem[]>([])
  const [countries2, setCountries2]   = useState<Country[]>([])
  const [countrySearch, setCountrySearch] = useState('')
  const [expandedCountry, setExpandedCountry] = useState<string|null>(null)
  const [editCountry, setEditCountry] = useState<{code:string;field:string;value:string}|null>(null)
  const [toast, setToast]             = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [loading, setLoading]         = useState(true)
  const [engineRes, setEngineRes]     = useState<any>(null)
  const [busy, setBusy]               = useState<string|null>(null)
  const [expandedLine, setExpandedLine] = useState<string|null>(null)
  const [lineFilter, setLineFilter]   = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
  const [giveForm, setGiveForm]       = useState({ playerId:'', money:0, oil:0, materialX:0, bitcoin:0 })
  const [genCc, setGenCc]             = useState('')
  const [createLine, setCreateLine]   = useState(false)
  const [lineForm, setLineForm]       = useState({ id:'', name:'', continent:'europe', archetype:'dominion', blocks:'', countryCode:'', lineType:'land' as 'land'|'sea', from:'', fromCountry:'', fromLng:'', fromLat:'', to:'', toCountry:'', toLng:'', toLat:'', oil:'0', fish:'0', tradedGoods:'0', lengthNm:'0' })
  const [lineTypeFilter, setLineTypeFilter] = useState<'all'|'land'|'sea'>('all')
  const [routeId, setRouteId]         = useState('')
  const [routeMinutes, setRouteMinutes] = useState(60)
  const [resetId, setResetId]         = useState('')
  // ── Country Randomizer state ──
  const [randCc, setRandCc]           = useState('')
  const [randCount, setRandCount]     = useState(6)
  const [randClear, setRandClear]     = useState(true)
  const [randBusy, setRandBusy]       = useState(false)
  const [randResult, setRandResult]   = useState<any>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewResult, setPreviewResult] = useState<any>(null)

  // ── Battles / Wars state ──
  const [adminBattles, setAdminBattles] = useState<any[]>([])
  const [adminWars, setAdminWars]       = useState<any[]>([])
  const [battlesLoading, setBattlesLoading] = useState(false)
  const [seedForm, setSeedForm]         = useState({ attackerCode:'', defenderCode:'', regionName:'', createWar:true, maxRounds:3 })
  const [stockForm, setStockForm]       = useState({ countryCode:'', price:'' })

  // ── Economy dashboard state ──
  const [econ, setEcon]                 = useState<any>(null)
  const [econWindow, setEconWindow]     = useState(7)
  const [econLoading, setEconLoading]   = useState(false)
  // ── Wealth distribution state ──
  const [wealthDist, setWealthDist]     = useState<any>(null)
  const [wdLoading, setWdLoading]       = useState(false)
  const [wdHover, setWdHover]           = useState<number | null>(null)

  const notify = (msg:string, type:'ok'|'err'='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),3500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // First check auth with a lightweight call
      const [s, l, n] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/ley-lines'),
        api('/api/world/news?limit=30'),
      ])
      setAuthed(true)
      if (s.ok) setStats(s.result)
      if (l.ok) { setLines(l.result.dbLines??[]); setStaticLines(l.result.staticFallbackLines??[]) }
      if (n.news) setNews(n.news)
    } catch(e:any) {
      if (e.message==='UNAUTHORIZED') {
        setAuthed(false)
      } else {
        // Network / parse error — still authenticated, just data failed
        setAuthed(true)
        notify('Could not load some data. Server may still be starting up.','err')
      }
    } finally {
      setLoading(false)
    }
  },[])

  const loadPlayers = useCallback(async () => {
    try {
      const d = await api('/api/admin/players-list')
      if (d.ok) setPlayers(d.result)
      else {
        // fallback to public player list (limited fields)
        const d2 = await api('/api/player/all')
        if (d2.success) setPlayers(d2.players)
      }
    } catch {}
  },[])

  const loadCountries = useCallback(async (search = '') => {
    try {
      const d = await api(`/api/admin/countries${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      if (d.ok) setCountries2(d.result.countries ?? [])
    } catch {}
  },[])

  const loadEcon = useCallback(async (w?: number) => {
    setEconLoading(true)
    try {
      const d = await api(`/api/admin/economy?window=${w ?? econWindow}`)
      if (d.ok) setEcon(d.result)
      else notify(d.error ?? 'Economy load failed', 'err')
    } catch { notify('Economy request failed', 'err') }
    setEconLoading(false)
  }, [econWindow])

  const loadWealthDist = useCallback(async () => {
    setWdLoading(true)
    try {
      const d = await api('/api/admin/economy/wealth-distribution')
      if (d.ok) setWealthDist(d.result)
      else notify(d.error ?? 'Wealth distribution load failed', 'err')
    } catch { notify('Wealth distribution request failed', 'err') }
    setWdLoading(false)
  }, [])

  const loadBattlesWars = useCallback(async () => {
    setBattlesLoading(true)
    try {
      const [b, w] = await Promise.all([
        api('/api/admin/battles'),
        api('/api/admin/wars'),
      ])
      if (b.ok) setAdminBattles(b.result)
      if (w.ok) setAdminWars(w.result)
    } catch {}
    setBattlesLoading(false)
  }, [])

  useEffect(()=>{ load() },[load])
  useEffect(()=>{ if (tab==='players') loadPlayers() },[tab,loadPlayers])
  useEffect(()=>{ if (tab==='countries') loadCountries() },[tab,loadCountries])
  useEffect(()=>{ if (tab==='economy') { loadEcon(); loadWealthDist() } },[tab,loadEcon,loadWealthDist])
  useEffect(()=>{ if (tab==='battles') loadBattlesWars() },[tab,loadBattlesWars])

  // ── Actions ──
  const runPipeline = async (pipeline: string, job?: string) => {
    setBusy('pipeline')
    try {
      const body = job ? { pipeline, job } : { pipeline }
      const d = await api('/api/admin/tick', { method:'POST', body:JSON.stringify(body) })
      if (d.ok) notify(`✓ ${d.result.result}`)
      else notify(d.error??'Failed','err')
    } catch { notify('Failed','err') }
    setBusy(null)
  }

  const runEngine = async () => {
    setBusy('engine')
    try {
      const d = await api('/api/admin/ley-lines/run-engine', { method:'POST', body:'{}' })
      if (d.ok) { setEngineRes(d.result); notify(`Engine ran — ${d.result.lines} lines`); load() }
      else notify(d.error??'Engine error','err')
    } catch { notify('Engine failed','err') }
    setBusy(null)
  }

  const generateLines = async (cc: string) => {
    if (!cc) return; setBusy('gen')
    try {
      const d = await api(`/api/admin/ley-lines/generate/${cc.toUpperCase()}`, { method:'POST', body:'{}' })
      if (d.ok) { notify(`Generated lines for ${d.result.cc}`); load() }
      else notify(d.error??'Failed','err')
    } catch { notify('Failed','err') }
    setBusy(null)
  }

  const generateAll = async () => {
    setBusy('genAll')
    try {
      const d = await api('/api/admin/ley-lines/generate-all', { method:'POST', body:'{}' })
      if (d.ok) { notify(`Generated ${d.result.generated} lines`); load() }
      else notify(d.error??'Failed','err')
    } catch { notify('Failed','err') }
    setBusy(null)
  }

  const toggleLine = async (id:string, enabled:boolean) => {
    const d = await api(`/api/admin/ley-lines/${id}/${enabled?'disable':'enable'}`, { method:'POST', body:'{}' })
    if (d.ok) { notify(`${id} ${enabled?'disabled':'enabled'}`); load() }
    else notify(d.error??'Toggle failed','err')
  }

  const deleteLine = async (id:string) => {
    if (!confirm(`Delete "${id}"?`)) return
    const d = await api(`/api/admin/ley-lines/${id}`, { method:'DELETE' })
    if (d.ok) { notify(`Deleted ${id}`); load() }
    else notify(d.error??'Delete failed','err')
  }

  const submitCreateLine = async () => {
    const blocks = lineForm.blocks.split(',').map(b=>b.trim()).filter(Boolean)
    if (!lineForm.id||!lineForm.name||blocks.length<2) { notify('Fill all fields','err'); return }
    const d = await api('/api/admin/ley-lines', { method:'POST', body:JSON.stringify({ id:lineForm.id.toUpperCase(), name:lineForm.name, continent:lineForm.continent, archetype:lineForm.archetype, blocks, bonuses:{}, tradeoffs:{}, countryCode:lineForm.countryCode.toUpperCase()||undefined, enabled:true }) })
    if (d.ok) { notify(`Created ${lineForm.id}`); setCreateLine(false); load() }
    else notify(d.error??'Failed','err')
  }

  const giveResources = async () => {
    if (!giveForm.playerId) { notify('Enter player ID','err'); return }
    const d = await api('/api/admin/give', { method:'POST', body:JSON.stringify(giveForm) })
    if (d.ok) notify(`Gave resources to ${d.result.name}`)
    else notify(d.error??'Failed','err')
  }

  const resetPlayer = async () => {
    if (!resetId) { notify('Enter player ID','err'); return }
    if (!confirm('Reset player to starter state?')) return
    const d = await api('/api/admin/reset-player', { method:'POST', body:JSON.stringify({ playerId:resetId }) })
    if (d.ok) notify(`Reset ${d.result.name}`)
    else notify(d.error??'Failed','err')
  }

  const disruptRoute = async () => {
    if (!routeId) { notify('Enter route ID','err'); return }
    const d = await api('/api/admin/disrupt-route', { method: 'POST', body: JSON.stringify({ routeId, minutes: routeMinutes }) })
    if (d.ok) notify(`Route ${routeId} disrupted for ${routeMinutes}m`)
    else notify(d.error??'Failed','err')
  }

  const SPEC_ROLES = ['military', 'economic', 'mercenary', 'politician', 'influencer'] as const
  const ROLE_COLORS: Record<string, string> = {
    military: '#ef4444', economic: '#22c55e', mercenary: '#f59e0b',
    politician: '#3b82f6', influencer: '#8b5cf6', banned: '#71717a'
  }
  const togglePlayerRole = async (playerId: string, currentRole: string) => {
    const idx     = SPEC_ROLES.indexOf(currentRole as any)
    const newRole = SPEC_ROLES[(idx + 1) % SPEC_ROLES.length]
    if (!confirm(`Change role of player to '${newRole}'?`)) return
    const d = await api(`/api/admin/player/${playerId}/role`, { method:'POST', body:JSON.stringify({ role: newRole }) })
    if (d.ok) { notify(`${d.result.name} → ${newRole}`); loadPlayers() }
    else notify(d.error??'Role change failed','err')
  }

  const banPlayer = async (playerId: string, playerName: string, isBanned: boolean) => {
    const action = isBanned ? 'unban' : 'ban'
    if (!confirm(`${action.toUpperCase()} player '${playerName}'?`)) return
    const d = await api(`/api/admin/player/${playerId}/ban`, { method:'POST', body:'{}' })
    if (d.ok) { notify(`${d.result.name} ${d.result.action}`); loadPlayers() }
    else notify(d.error??'Ban failed','err')
  }

  const seedBattle = async () => {
    if (!seedForm.attackerCode || !seedForm.defenderCode) { notify('Enter attacker and defender codes','err'); return }
    setBusy('seed')
    try {
      const d = await api('/api/admin/seed-battle', { method:'POST', body:JSON.stringify(seedForm) })
      if (d.ok) notify(`✓ Battle seeded: ${d.result.attacker} vs ${d.result.defender}${d.result.warId ? ' (+ war)' : ''}`)
      else notify(d.error??'Seed failed','err')
    } catch { notify('Seed request failed','err') }
    setBusy(null)
  }

  const endBattle = async (battleId: string) => {
    if (!confirm('Force-finish this battle?')) return
    const d = await api('/api/admin/end-battle', { method:'POST', body:JSON.stringify({ battleId }) })
    if (d.ok) { notify('Battle finished'); loadBattlesWars() }
    else notify(d.error??'Failed','err')
  }

  const endWar = async (warId: string) => {
    if (!confirm('Force-finish this war?')) return
    const d = await api('/api/admin/end-war', { method:'POST', body:JSON.stringify({ warId }) })
    if (d.ok) { notify('War finished'); loadBattlesWars() }
    else notify(d.error??'Failed','err')
  }

  const setStockPrice = async () => {
    if (!stockForm.countryCode || !stockForm.price) { notify('Enter country code and price','err'); return }
    const d = await api('/api/admin/set-stock-price', { method:'POST', body:JSON.stringify({ countryCode: stockForm.countryCode, price: Number(stockForm.price) }) })
    if (d.ok) notify(`✓ ${d.result.countryCode} stock → $${d.result.newPrice}`)
    else notify(d.error??'Failed','err')
  }

  const saveCountryField = async (code: string, field: string, value: string) => {
    const parsed = field === 'military' ? Number(value) : field === 'empire' && value.trim() === '' ? null : value
    const d = await api(`/api/admin/countries/${code}`, { method:'PATCH', body:JSON.stringify({ [field]: parsed }) })
    if (d.ok) { notify(`${code} ${field} updated`); setEditCountry(null); loadCountries(countrySearch) }
    else notify(d.error??'Update failed','err')
  }

  // ── Country Randomizer ──
  const previewCountry = async () => {
    if (!randCc.trim()) { notify('Enter a country code','err'); return }
    setPreviewBusy(true); setPreviewResult(null)
    try {
      const d = await api(`/api/admin/country/${randCc.trim().toUpperCase()}/preview`)
      if (d.ok) setPreviewResult(d.result)
      else notify(d.error??'Preview failed','err')
    } catch { notify('Preview request failed','err') }
    setPreviewBusy(false)
  }

  const randomizeCountry = async () => {
    if (!randCc.trim()) { notify('Enter a country code','err'); return }
    setRandBusy(true); setRandResult(null)
    try {
      const d = await api(`/api/admin/country/${randCc.trim().toUpperCase()}/randomize`, {
        method: 'POST',
        body: JSON.stringify({ regionCount: randCount, clear: randClear }),
      })
      if (d.ok) { setRandResult(d.result); notify(`✓ Generated ${d.result.regionCount} regions + ${d.result.leyLinesGenerated.length} ley lines for ${d.result.cc}`); load() }
      else notify(d.error??'Randomize failed','err')
    } catch { notify('Request failed','err') }
    setRandBusy(false)
  }

  // ── Auth gates ──
  if (authed===null||loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#070d16', color:'#22d38a', fontFamily:'Share Tech Mono,monospace', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:28, animation:'spin 1s linear infinite' }}>⟳</div>
      <div style={{ fontSize:12, letterSpacing:'0.1em' }}>CONNECTING…</div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (authed===false) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#070d16', flexDirection:'column', gap:14 }}>
      <Shield size={52} color="#ef4444"/>
      <div style={{ color:'#ef4444', fontSize:20, fontWeight:800, fontFamily:'Share Tech Mono,monospace' }}>ACCESS DENIED</div>
      <div style={{ color:'#475569', fontSize:12 }}>No admin token found in localStorage.</div>
      <a href="/" style={{ color:'#3b82f6', fontSize:12, marginTop:8, textDecoration:'none' }}>← Back to Game</a>
    </div>
  )

  // Merge DB lines (land) with client-side sea line defs
  const seaLineDefs: LeyLine[] = LEY_LINE_DEFS.filter(d => d.lineType === 'sea').map(d => ({
    id: d.id, name: d.name, archetype: d.archetype, blocks: d.blocks ?? [],
    bonuses: d.bonuses as Record<string,number>, tradeoffs: d.tradeoffs as Record<string,number>,
    enabled: true, autoGen: false, countryCode: d.seaData?.fromCountry ?? null, updatedAt: '',
    lineType: 'sea' as const, seaData: d.seaData,
  }))
  const allMergedLines: (LeyLine & { lineType?: string; seaData?: any })[] = [
    ...lines.map(l => ({ ...l, lineType: (l as any).lineType ?? 'land' })),
    ...seaLineDefs,
  ]
  const filteredLines = allMergedLines.filter(l => {
    const lt = (l as any).lineType ?? 'land'
    if (lineTypeFilter !== 'all' && lt !== lineTypeFilter) return false
    if (!lineFilter) return true
    const q = lineFilter.toLowerCase()
    return l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || (l.countryCode??'').toLowerCase().includes(q)
  })
  const filteredPlayers = players.filter(p => !playerSearch || p.name?.toLowerCase().includes(playerSearch.toLowerCase()) || (p.countryCode??'').toLowerCase().includes(playerSearch.toLowerCase()))

  const ARCH_C: Record<string,string> = { dominion:'#ef4444', prosperity:'#f59e0b', convergence:'#8b5cf6' }

  return (
    <div style={{ background:'#070d16', minHeight:'100vh', color:'#e2e8f0', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`
        html,body,#root{overflow:auto!important;height:auto!important;min-height:100vh}
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0f172a}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        input:focus,select:focus{outline:none;border-color:rgba(139,92,246,0.5)!important}
        button:hover{filter:brightness(1.1)}
        .hrow:hover{background:rgba(255,255,255,0.04)!important}
      `}</style>

      {toast && <Toast {...toast}/>}

      {/* Header */}
      <header style={{ background:'rgba(7,13,22,0.98)', borderBottom:'1px solid rgba(255,255,255,0.07)', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', position:'sticky', top:0, zIndex:100, backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Shield size={20} color="#8b5cf6"/>
          <span style={{ fontFamily:'Share Tech Mono,monospace', fontSize:14, fontWeight:700, letterSpacing:'0.08em' }}>XWAR <span style={{ color:'#8b5cf6' }}>ADMIN</span></span>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.1)' }}/>
          {/* Tabs */}
          {(['overview','players','countries','battles','leylines','pipelines','news','market','economy','map'] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} style={{ background: tab===t?'rgba(139,92,246,0.15)':'transparent', border:'none', color: tab===t?'#8b5cf6':'#64748b', borderRadius:6, padding:'5px 12px', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'0.06em', textTransform:'uppercase' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={btn('#64748b')}><RefreshCw size={12}/> Refresh</button>
          <a href="/" style={{ ...btn('#3b82f6') as any, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}><LogOut size={12}/> Game</a>
        </div>
      </header>

      <main style={{ maxWidth:1320, margin:'0 auto', padding:'28px 28px 64px' }}>

        {/* ── OVERVIEW ── */}
        {tab==='overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {stats && (
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <SC icon={<Users size={18}/>}      label="Players"       value={stats.playerCount}                                    color="#3b82f6"/>
                <SC icon={<Swords size={18}/>}     label="Battles"       value={stats.activeBattles}                                   color="#ef4444"/>
                <SC icon={<Globe size={18}/>}      label="Active Wars"   value={stats.activeWars}                                      color="#f59e0b"/>
                <SC icon={<DollarSign size={18}/>} label="Money Circ."   value={`$${(stats.totalMoneyInCirculation/1e6).toFixed(1)}M`} color="#22d38a"/>
                <SC icon={<Zap size={18}/>}        label="Lines in DB"   value={lines.length}                                          color="#8b5cf6"/>
                <SC icon={<Anchor size={18}/>}     label="Disrupted Routes" value={stats.disruptedTradeRoutes?.length??0}              color="#f97316"/>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {/* Engine */}
              <div style={S.card}>
                <div style={S.sectionTitle}><Activity size={14} color="#22d38a"/> LEY LINE ENGINE</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.7 }}>Compute ownership, bonuses, and activations for all DB-defined ley lines.</p>
                <button onClick={runEngine} disabled={busy==='engine'} style={btn('#22d38a', busy==='engine')}>
                  {busy==='engine'?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Running…</>:<><Play size={13}/>Run Engine</>}
                </button>
                {engineRes && (
                  <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                    {[{k:'Lines',v:engineRes.lines,c:'#22d38a'},{k:'Nodes',v:engineRes.nodes,c:'#3b82f6'},{k:'Countries',v:engineRes.countries,c:'#f59e0b'}].map(s=>(
                      <div key={s.k} style={{ background:`${s.c}10`, border:`1px solid ${s.c}25`, borderRadius:7, padding:'8px 12px', textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:800, color:s.c, fontFamily:'Share Tech Mono,monospace' }}>{s.v}</div>
                        <div style={{ fontSize:9, color:'#64748b', marginTop:2, textTransform:'uppercase', letterSpacing:'0.06em' }}>{s.k}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate ley lines */}
              <div style={S.card}>
                <div style={S.sectionTitle}><Globe size={14} color="#f59e0b"/> GENERATE LEY LINES</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.7 }}>Auto-generate 3 canonical lines (Dominion / Prosperity / Convergence) per country.</p>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <input value={genCc} onChange={e=>setGenCc(e.target.value)} placeholder="Country code e.g. DE" style={{ ...S.input, width:160 }} maxLength={4} onKeyDown={e=>e.key==='Enter'&&generateLines(genCc)}/>
                  <button onClick={()=>generateLines(genCc)} disabled={busy==='gen'||!genCc} style={btn('#f59e0b',busy==='gen'||!genCc)}><Zap size={13}/>Generate</button>
                </div>
                <button onClick={generateAll} disabled={busy==='genAll'} style={{ ...btn('#8b5cf6',busy==='genAll'), width:'100%', justifyContent:'center' }}>
                  {busy==='genAll'?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Generating…</>:<><Database size={13}/>Generate ALL Countries</>}
                </button>
              </div>

              {/* Give resources */}
              <div style={S.card}>
                <div style={S.sectionTitle}><Package size={14} color="#22d38a"/> GIVE RESOURCES</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={S.label}>Player ID (UUID)</label>
                    <input value={giveForm.playerId} onChange={e=>setGiveForm(f=>({...f,playerId:e.target.value}))} placeholder="Player UUID" style={S.input}/>
                  </div>
                  {(['money','oil','materialX','bitcoin'] as const).map(k=>(
                    <div key={k}>
                      <label style={S.label}>{k}</label>
                      <input type="number" value={giveForm[k]||''} onChange={e=>setGiveForm(f=>({...f,[k]:Number(e.target.value)}))} placeholder="0" style={S.input}/>
                    </div>
                  ))}
                </div>
                <button onClick={giveResources} style={{ ...btn('#22d38a'), marginTop:12 }}><Plus size={13}/>Grant Resources</button>
              </div>

              {/* Reset + Disrupt */}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={S.card}>
                  <div style={S.sectionTitle}><Settings size={14} color="#ef4444"/> RESET PLAYER</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={resetId} onChange={e=>setResetId(e.target.value)} placeholder="Player UUID" style={S.input}/>
                    <button onClick={resetPlayer} style={btn('#ef4444')}><Trash2 size={13}/>Reset</button>
                  </div>
                </div>
                <div style={S.card}>
                  <div style={S.sectionTitle}><Anchor size={14} color="#f97316"/> DISRUPT TRADE ROUTE</div>
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <input value={routeId} onChange={e=>setRouteId(e.target.value)} placeholder="Route ID" style={S.input}/>
                    <input type="number" value={routeMinutes} onChange={e=>setRouteMinutes(Number(e.target.value))} placeholder="Minutes" style={{ ...S.input, width:80 }}/>
                  </div>
                  <button onClick={disruptRoute} style={btn('#f97316')}><AlertTriangle size={13}/>Disrupt</button>
                </div>
              </div>

              {/* Seed Battle */}
              <div style={S.card}>
                <div style={S.sectionTitle}><Flame size={14} color="#ef4444"/> SEED BATTLE</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:12, lineHeight:1.7 }}>Create a battle (+ optional war) between two countries to generate initial engagement for testing.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div><label style={S.label}>Attacker CC</label><input value={seedForm.attackerCode} onChange={e=>setSeedForm(f=>({...f,attackerCode:e.target.value.toUpperCase()}))} placeholder="US" style={S.input} maxLength={4}/></div>
                  <div><label style={S.label}>Defender CC</label><input value={seedForm.defenderCode} onChange={e=>setSeedForm(f=>({...f,defenderCode:e.target.value.toUpperCase()}))} placeholder="RU" style={S.input} maxLength={4}/></div>
                  <div><label style={S.label}>Region Name</label><input value={seedForm.regionName} onChange={e=>setSeedForm(f=>({...f,regionName:e.target.value}))} placeholder="Optional" style={S.input}/></div>
                  <div><label style={S.label}>Max Rounds</label><input type="number" value={seedForm.maxRounds} onChange={e=>setSeedForm(f=>({...f,maxRounds:Number(e.target.value)}))} style={S.input} min={1} max={15}/></div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#94a3b8', cursor:'pointer' }}>
                    <input type="checkbox" checked={seedForm.createWar} onChange={e=>setSeedForm(f=>({...f,createWar:e.target.checked}))}/>
                    Also create war
                  </label>
                  <button onClick={seedBattle} disabled={busy==='seed'} style={btn('#ef4444', busy==='seed')}>
                    {busy==='seed'?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Seeding…</>:<><Flame size={13}/>Seed Battle</>}
                  </button>
                </div>
              </div>

              {/* Set Stock Price */}
              <div style={S.card}>
                <div style={S.sectionTitle}><TrendingUp size={14} color="#22c55e"/> SET STOCK PRICE</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:12, lineHeight:1.7 }}>Override a country's stock price. Useful for testing stock exchange mechanics.</p>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <div style={{ flex:1 }}><label style={S.label}>Country Code</label><input value={stockForm.countryCode} onChange={e=>setStockForm(f=>({...f,countryCode:e.target.value.toUpperCase()}))} placeholder="US" style={S.input} maxLength={4}/></div>
                  <div style={{ flex:1 }}><label style={S.label}>New Price ($)</label><input type="number" value={stockForm.price} onChange={e=>setStockForm(f=>({...f,price:e.target.value}))} placeholder="150.00" style={S.input} step="0.01" min={0.01}/></div>
                </div>
                <button onClick={setStockPrice} style={btn('#22c55e')}><TrendingUp size={13}/>Set Price</button>
              </div>
            </div>
          </div>
        )}

        {/* ── PLAYERS ── */}
        {tab==='players' && (
          <div style={S.card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={S.sectionTitle}><Users size={14} color="#3b82f6"/> PLAYERS ({filteredPlayers.length})</div>
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <Search size={12} style={{ position:'absolute', left:10, color:'#475569', pointerEvents:'none' }}/>
                <input value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} placeholder="Search…" style={{ ...S.input, paddingLeft:28, width:200 }}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1.4fr', gap:0, marginBottom:8 }}>
              {['Name','Country','Level','Money','Role'].map(h=>(
                <div key={h} style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'0 8px 6px' }}>{h}</div>
              ))}
            </div>
            {filteredPlayers.slice(0,80).map(p=>(
              <div key={p.id} className="hrow" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1.4fr', gap:0, borderRadius:6, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
                <div style={{ padding:'0 8px', fontSize:12, color:'#e2e8f0', fontWeight:600 }}>{p.name}<div style={{ fontSize:10, color:'#475569', fontFamily:'monospace' }}>{p.id?.slice(0,16)}…</div></div>
                <div style={{ padding:'0 8px', fontSize:12, color:'#60a5fa' }}>{p.countryCode}</div>
                <div style={{ padding:'0 8px', fontSize:12, color:'#94a3b8' }}>{p.level}</div>
                <div style={{ padding:'0 8px', fontSize:11, color:'#22d38a', fontFamily:'monospace' }}>{p.money!=null?`$${Number(p.money).toLocaleString()}`:'—'}</div>
                <div style={{ padding:'0 8px', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: `${ROLE_COLORS[p.role||'military']||'#64748b'}18`, color: ROLE_COLORS[p.role||'military']||'#64748b', border:`1px solid ${ROLE_COLORS[p.role||'military']||'#64748b'}33` }}>{p.role||'military'}</span>
                  {p.id && p.role !== 'banned' && <button onClick={()=>togglePlayerRole(p.id, p.role||'military')} title="Cycle specialization role" style={{ background:'transparent', border:'1px solid rgba(139,92,246,0.35)', borderRadius:4, color:'#8b5cf6', cursor:'pointer', padding:'2px 6px', fontSize:9, fontWeight:700 }}>⟳ Role</button>}
                  {p.id && <button onClick={()=>banPlayer(p.id, p.name, p.role==='banned')} title={p.role==='banned'?'Unban player':'Ban player'} style={{ background: p.role==='banned'?'rgba(34,211,138,0.12)':'rgba(239,68,68,0.08)', border:`1px solid ${p.role==='banned'?'rgba(34,211,138,0.4)':'rgba(239,68,68,0.3)'}`, borderRadius:4, color: p.role==='banned'?'#22d38a':'#ef4444', cursor:'pointer', padding:'2px 6px', fontSize:9, fontWeight:700 }}>{p.role==='banned'?'Unban':'Ban'}</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── COUNTRIES ── */}
        {tab==='countries' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <div style={S.sectionTitle}><Globe size={14} color="#22d38a"/> COUNTRIES ({countries2.length})</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                  <Search size={12} style={{ position:'absolute', left:10, color:'#475569', pointerEvents:'none' }}/>
                  <input value={countrySearch} onChange={e=>{ setCountrySearch(e.target.value); loadCountries(e.target.value) }} placeholder="Search code or name…" style={{ ...S.input, paddingLeft:28, width:220 }}/>
                </div>
                <button onClick={()=>loadCountries(countrySearch)} style={btn('#64748b')}><RefreshCw size={12}/> Refresh</button>
              </div>
            </div>

            <div style={S.card}>
              {/* Header row */}
              <div style={{ display:'grid', gridTemplateColumns:'55px 1.6fr 1fr 1fr 70px 70px 70px 80px', gap:0, marginBottom:8 }}>
                {['Code','Name','Controller','Empire','Military','Regions','Players','Fund $M'].map(h=>(
                  <div key={h} style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', padding:'0 6px 6px' }}>{h}</div>
                ))}
              </div>

              {countries2.length===0
                ? <div style={{ textAlign:'center', padding:40, color:'#475569' }}>No countries found. Run db:seed first.</div>
                : countries2.map(c => {
                  const isOpen = expandedCountry === c.code
                  const fundMoney = (c.fund as any)?.money ?? 0
                  return (
                    <div key={c.code} className="hrow" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <div
                        style={{ display:'grid', gridTemplateColumns:'55px 1.6fr 1fr 1fr 70px 70px 70px 80px', gap:0, padding:'8px 0', cursor:'pointer', alignItems:'center' }}
                        onClick={()=>setExpandedCountry(isOpen ? null : c.code)}
                      >
                        <div style={{ padding:'0 6px' }}>
                          <span style={{ fontSize:11, fontWeight:800, color:c.color||'#e2e8f0', fontFamily:'monospace', background:`${c.color||'#fff'}18`, padding:'2px 6px', borderRadius:4 }}>{c.code}</span>
                        </div>
                        <div style={{ padding:'0 6px', fontSize:12, color:'#e2e8f0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.controller}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#64748b' }}>{c.empire ?? <span style={{color:'#334155'}}>—</span>}</div>
                        <div style={{ padding:'0 6px', fontSize:12, color: c.military>=80?'#ef4444':c.military>=60?'#f59e0b':'#64748b', fontFamily:'monospace', fontWeight:700 }}>{c.military}</div>
                        <div style={{ padding:'0 6px', fontSize:12, color:'#94a3b8', fontFamily:'monospace' }}>{c.regions}</div>
                        <div style={{ padding:'0 6px', fontSize:12, color:c.player_count>0?'#22d38a':'#334155', fontFamily:'monospace', fontWeight:c.player_count>0?700:400 }}>{c.player_count}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#22c55e', fontFamily:'monospace' }}>${(fundMoney/1e6).toFixed(1)}M</div>
                      </div>

                      {isOpen && (
                        <div style={{ padding:'12px 8px 16px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', flexDirection:'column', gap:12 }}>
                          {/* Fund breakdown */}
                          <div>
                            <div style={{ ...S.label, marginBottom:8 }}>Fund Breakdown</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                              {Object.entries(c.fund as Record<string,number>).map(([k,v])=>(
                                <div key={k} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'6px 12px', minWidth:90 }}>
                                  <div style={{ fontSize:9, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{k}</div>
                                  <div style={{ fontSize:13, color:'#e2e8f0', fontFamily:'monospace', fontWeight:600 }}>{typeof v==='number'&&v>=1e6?`${(v/1e6).toFixed(1)}M`:typeof v==='number'&&v>=1e3?`${(v/1e3).toFixed(0)}K`:String(v)}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Edit fields */}
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }}>
                            {[
                              { field:'controller', label:'Controller', type:'text' },
                              { field:'empire',     label:'Empire',     type:'text', hint:'Leave blank to clear' },
                              { field:'military',   label:'Military',   type:'number' },
                            ].map(f=>(
                              <div key={f.field} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                <label style={S.label}>{f.label}{f.hint && <span style={{fontWeight:400,color:'#334155',marginLeft:4,textTransform:'none'}}>{f.hint}</span>}</label>
                                <div style={{ display:'flex', gap:4 }}>
                                  <input
                                    type={f.type}
                                    defaultValue={f.field==='military'?String((c as any)[f.field]):(c as any)[f.field]??''}
                                    onFocus={e=>setEditCountry({code:c.code,field:f.field,value:e.currentTarget.value})}
                                    onChange={e=>setEditCountry({code:c.code,field:f.field,value:e.target.value})}
                                    style={{ ...S.input, width:160 }}
                                  />
                                  <button
                                    onClick={()=>editCountry&&editCountry.code===c.code&&editCountry.field===f.field&&saveCountryField(c.code,f.field,editCountry.value)}
                                    style={btn('#22d38a')}
                                  >Save</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* ── BATTLES & WARS ── */}
        {tab==='battles' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <div style={S.sectionTitle}><Swords size={14} color="#ef4444"/> BATTLES & WARS</div>
              <button onClick={loadBattlesWars} disabled={battlesLoading} style={btn('#64748b', battlesLoading)}>
                <RefreshCw size={12}/> {battlesLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>

            {/* Seed Battle (also on overview, duplicated here for convenience) */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <div style={{ ...S.card, border:'1px solid rgba(239,68,68,0.18)' }}>
                <div style={S.sectionTitle}><Flame size={14} color="#ef4444"/> SEED BATTLE</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:12, lineHeight:1.7 }}>Create a battle (+ optional war) between two countries for alpha testing.</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                  <div><label style={S.label}>Attacker CC</label><input value={seedForm.attackerCode} onChange={e=>setSeedForm(f=>({...f,attackerCode:e.target.value.toUpperCase()}))} placeholder="US" style={S.input} maxLength={4}/></div>
                  <div><label style={S.label}>Defender CC</label><input value={seedForm.defenderCode} onChange={e=>setSeedForm(f=>({...f,defenderCode:e.target.value.toUpperCase()}))} placeholder="RU" style={S.input} maxLength={4}/></div>
                  <div><label style={S.label}>Region</label><input value={seedForm.regionName} onChange={e=>setSeedForm(f=>({...f,regionName:e.target.value}))} placeholder="Optional" style={S.input}/></div>
                  <div><label style={S.label}>Max Rounds</label><input type="number" value={seedForm.maxRounds} onChange={e=>setSeedForm(f=>({...f,maxRounds:Number(e.target.value)}))} style={S.input} min={1} max={15}/></div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#94a3b8', cursor:'pointer' }}>
                    <input type="checkbox" checked={seedForm.createWar} onChange={e=>setSeedForm(f=>({...f,createWar:e.target.checked}))}/>
                    Also create war
                  </label>
                  <button onClick={seedBattle} disabled={busy==='seed'} style={btn('#ef4444', busy==='seed')}>
                    {busy==='seed'?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Seeding…</>:<><Flame size={13}/>Seed Battle</>}
                  </button>
                </div>
              </div>

              {/* Set Stock Price */}
              <div style={{ ...S.card, border:'1px solid rgba(34,211,138,0.18)' }}>
                <div style={S.sectionTitle}><TrendingUp size={14} color="#22c55e"/> SET STOCK PRICE</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:12, lineHeight:1.7 }}>Override a country's stock price for testing.</p>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <div style={{ flex:1 }}><label style={S.label}>Country Code</label><input value={stockForm.countryCode} onChange={e=>setStockForm(f=>({...f,countryCode:e.target.value.toUpperCase()}))} placeholder="US" style={S.input} maxLength={4}/></div>
                  <div style={{ flex:1 }}><label style={S.label}>New Price ($)</label><input type="number" value={stockForm.price} onChange={e=>setStockForm(f=>({...f,price:e.target.value}))} placeholder="150.00" style={S.input} step="0.01" min={0.01}/></div>
                </div>
                <button onClick={setStockPrice} style={btn('#22c55e')}><TrendingUp size={13}/>Set Price</button>
              </div>
            </div>

            {/* Active Battles Table */}
            <div style={S.card}>
              <div style={S.sectionTitle}><Swords size={14} color="#ef4444"/> ACTIVE BATTLES ({adminBattles.filter((b:any)=>b.status==='active').length})</div>
              {adminBattles.length === 0
                ? <div style={{ textAlign:'center', padding:40, color:'#475569' }}>No battles found. Use Seed Battle to create one.</div>
                : <>
                    <div style={{ display:'grid', gridTemplateColumns:'60px 60px 1fr 60px 100px 100px 80px 80px', gap:0, marginBottom:8 }}>
                      {['ATK','DEF','Region','Round','ATK Dmg','DEF Dmg','Status','Action'].map(h=>(
                        <div key={h} style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', padding:'0 6px 6px' }}>{h}</div>
                      ))}
                    </div>
                    {adminBattles.map((b:any) => (
                      <div key={b.id} className="hrow" style={{ display:'grid', gridTemplateColumns:'60px 60px 1fr 60px 100px 100px 80px 80px', gap:0, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
                        <div style={{ padding:'0 6px', fontSize:12, color:'#ef4444', fontWeight:700, fontFamily:'monospace' }}>{b.attacker_id}</div>
                        <div style={{ padding:'0 6px', fontSize:12, color:'#60a5fa', fontWeight:700, fontFamily:'monospace' }}>{b.defender_id}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.region_name}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#e2e8f0', fontFamily:'monospace' }}>{b.round}/{b.max_rounds}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#ef4444', fontFamily:'monospace' }}>{Number(b.attacker_damage).toLocaleString()}</div>
                        <div style={{ padding:'0 6px', fontSize:11, color:'#60a5fa', fontFamily:'monospace' }}>{Number(b.defender_damage).toLocaleString()}</div>
                        <div style={{ padding:'0 6px' }}>
                          <span style={{ fontSize:9, padding:'2px 8px', borderRadius:10, background: b.status==='active'?'rgba(34,211,138,0.12)':'rgba(100,116,139,0.12)', color: b.status==='active'?'#22d38a':'#64748b', fontWeight:700 }}>{b.status}</span>
                        </div>
                        <div style={{ padding:'0 6px' }}>
                          {b.status==='active' && (
                            <button onClick={()=>endBattle(b.id)} title="Force-finish this battle" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:4, color:'#ef4444', cursor:'pointer', padding:'3px 8px', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                              <StopCircle size={11}/>End
                            </button>
                          )}
                          {b.status!=='active' && b.winner && <span style={{ fontSize:10, color:'#f59e0b', fontWeight:700, fontFamily:'monospace' }}>🏆 {b.winner}</span>}
                        </div>
                      </div>
                    ))}
                  </>
              }
            </div>

            {/* Active Wars Table */}
            <div style={S.card}>
              <div style={S.sectionTitle}><Globe size={14} color="#f59e0b"/> ACTIVE WARS ({adminWars.filter((w:any)=>w.status==='active').length})</div>
              {adminWars.length === 0
                ? <div style={{ textAlign:'center', padding:30, color:'#475569' }}>No wars found.</div>
                : <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 70px 80px 140px 80px', gap:0, marginBottom:8 }}>
                      {['ID','Attacker','Defender','Status','Started','Action'].map(h=>(
                        <div key={h} style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', padding:'0 6px 6px' }}>{h}</div>
                      ))}
                    </div>
                    {adminWars.map((w:any) => (
                      <div key={w.id} className="hrow" style={{ display:'grid', gridTemplateColumns:'1fr 70px 70px 80px 140px 80px', gap:0, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', alignItems:'center' }}>
                        <div style={{ padding:'0 6px', fontSize:10, color:'#64748b', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.id?.slice(0,16)}…</div>
                        <div style={{ padding:'0 6px', fontSize:12, color:'#ef4444', fontWeight:700, fontFamily:'monospace' }}>{w.attacker_code}</div>
                        <div style={{ padding:'0 6px', fontSize:12, color:'#60a5fa', fontWeight:700, fontFamily:'monospace' }}>{w.defender_code}</div>
                        <div style={{ padding:'0 6px' }}>
                          <span style={{ fontSize:9, padding:'2px 8px', borderRadius:10, background: w.status==='active'?'rgba(34,211,138,0.12)':'rgba(100,116,139,0.12)', color: w.status==='active'?'#22d38a':'#64748b', fontWeight:700 }}>{w.status}</span>
                        </div>
                        <div style={{ padding:'0 6px', fontSize:10, color:'#475569' }}>{w.started_at ? new Date(w.started_at).toLocaleString() : '—'}</div>
                        <div style={{ padding:'0 6px' }}>
                          {w.status==='active' && (
                            <button onClick={()=>endWar(w.id)} title="Force-finish this war" style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:4, color:'#f59e0b', cursor:'pointer', padding:'3px 8px', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                              <StopCircle size={11}/>End
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
              }
            </div>
          </div>
        )}

        {/* ── LEY LINES ── */}
        {tab==='leylines' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {/* ── Country Randomizer ── */}
            <div style={{ background:'rgba(34,211,138,0.04)', border:'1px solid rgba(34,211,138,0.18)', borderRadius:12, padding:20 }}>
              <div style={{ ...S.sectionTitle, color:'#22d38a', marginBottom:14 }}>
                <Globe size={14} color="#22d38a"/> COUNTRY LEY LINE RANDOMIZER
              </div>
              <p style={{ fontSize:12, color:'#475569', marginBottom:14, lineHeight:1.7 }}>
                Select a country → <b style={{color:'#22d38a'}}>Preview</b> its current regions + ley lines, or <b style={{color:'#f59e0b'}}>Randomize</b> them and push to the DB (immediately visible on the map).
              </p>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap', marginBottom:12 }}>
                <div>
                  <label style={S.label}>Country Code</label>
                  <input value={randCc} onChange={e=>setRandCc(e.target.value.toUpperCase())} placeholder="e.g. JP" style={{ ...S.input, width:90 }} maxLength={3}
                    onKeyDown={e=>e.key==='Enter'&&previewCountry()}/>
                </div>
                <div>
                  <label style={S.label}>Regions to assign</label>
                  <input type="number" value={randCount} onChange={e=>setRandCount(Number(e.target.value))} style={{ ...S.input, width:80 }} min={2} max={20}/>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6, paddingBottom:1 }}>
                  <input type="checkbox" id="randClear" checked={randClear} onChange={e=>setRandClear(e.target.checked)}/>
                  <label htmlFor="randClear" style={{ ...S.label, marginBottom:0, cursor:'pointer' }}>Clear old regions</label>
                </div>
                <button onClick={previewCountry} disabled={previewBusy||!randCc} style={btn('#3b82f6', previewBusy||!randCc)}>
                  {previewBusy?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Loading…</>:<><Search size={13}/>Preview</>}
                </button>
                <button onClick={randomizeCountry} disabled={randBusy||!randCc} style={btn('#f59e0b', randBusy||!randCc)}>
                  {randBusy?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Working…</>:<><Zap size={13}/>Randomize + Push to Map</>}
                </button>
              </div>

              {/* Preview result */}
              {previewResult && !randResult && (
                <div style={{ background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, padding:14, marginTop:4 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#60a5fa', marginBottom:10 }}>
                    👁 PREVIEW — {previewResult.cc} ({previewResult.continent})
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Regions ({previewResult.regionCount})</div>
                      {previewResult.regionCount===0
                        ? <span style={{ fontSize:11, color:'#475569' }}>No ownership rows yet — click Randomize to seed.</span>
                        : <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                            {previewResult.regions.map((r:any)=><span key={r.regionId} style={{ fontSize:10, background:'rgba(59,130,246,0.12)', color:'#60a5fa', padding:'2px 6px', borderRadius:4, fontFamily:'monospace' }}>{r.regionId}</span>)}
                          </div>}
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Ley Lines ({previewResult.leyLineCount})</div>
                      {previewResult.leyLineCount===0
                        ? <span style={{ fontSize:11, color:'#475569' }}>No lines yet.</span>
                        : <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {previewResult.leyLines.map((l:any)=>(
                              <div key={l.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ width:8, height:8, borderRadius:'50%', background: ARCH_C[l.archetype]||'#fff', flexShrink:0 }}/>
                                <span style={{ fontSize:10, fontFamily:'monospace', color: ARCH_C[l.archetype]||'#fff', fontWeight:700 }}>{l.id}</span>
                                <span style={{ fontSize:10, color:'#64748b' }}>{l.blocks.length} blocks</span>
                                <span style={{ fontSize:9, background: l.enabled?'rgba(34,211,138,0.12)':'rgba(239,68,68,0.12)', color: l.enabled?'#22d38a':'#ef4444', padding:'1px 6px', borderRadius:3 }}>{l.enabled?'ON':'OFF'}</span>
                              </div>
                            ))}
                          </div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Randomize result */}
              {randResult && (
                <div style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:8, padding:14, marginTop:4 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f59e0b', marginBottom:10 }}>
                    ⚡ RANDOMIZED — {randResult.cc} · {randResult.regionCount} regions assigned
                    {randResult.cleared && <span style={{ marginLeft:8, fontSize:9, background:'rgba(239,68,68,0.15)', color:'#ef4444', padding:'1px 6px', borderRadius:3 }}>CLEARED FIRST</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div>
                      <div style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Assigned Regions</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {randResult.regionsAssigned.map((r:string)=><span key={r} style={{ fontSize:10, background:'rgba(245,158,11,0.12)', color:'#fbbf24', padding:'2px 6px', borderRadius:4, fontFamily:'monospace' }}>{r}</span>)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>Generated Ley Lines</div>
                      {randResult.leyLines.map((l:any)=>(
                        <div key={l.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background: ARCH_C[l.archetype]||'#fff', flexShrink:0 }}/>
                          <span style={{ fontSize:10, fontFamily:'monospace', color: ARCH_C[l.archetype]||'#fff', fontWeight:700 }}>{l.id}</span>
                          <span style={{ fontSize:10, color:'#64748b' }}>{l.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(34,211,138,0.06)', borderRadius:6, border:'1px solid rgba(34,211,138,0.15)', fontSize:11, color:'#22d38a' }}>
                    ✓ Lines saved to DB — <b>refresh the game map</b> or run the engine to see them activated.
                    <a href="/" style={{ marginLeft:12, color:'#3b82f6', fontSize:11, textDecoration:'none' }}>→ Open Map</a>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ position:'relative', display:'flex', alignItems:'center', flex:1 }}>
                <Search size={12} style={{ position:'absolute', left:10, color:'#475569', pointerEvents:'none' }}/>
                <input value={lineFilter} onChange={e=>setLineFilter(e.target.value)} placeholder="Filter lines…" style={{ ...S.input, paddingLeft:28 }}/>
              </div>
              {/* Type filter */}
              <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:7, padding:2, border:'1px solid rgba(255,255,255,0.08)' }}>
                {([['all','All','#94a3b8'],['land','🌍 Land','#a855f7'],['sea','⚓ Sea','#00e5ff']] as const).map(([val,label,clr])=>(
                  <button key={val} onClick={()=>setLineTypeFilter(val as any)} style={{ background: lineTypeFilter===val?`${clr}20`:'transparent', border:'none', color: lineTypeFilter===val?clr:'#475569', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'0.04em' }}>
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={()=>setCreateLine(c=>!c)} style={btn('#22d38a')}><Plus size={13}/>New Line</button>
              <button onClick={runEngine} disabled={busy==='engine'} style={btn('#22d38a',busy==='engine')}><Play size={13}/>Run Engine</button>
              <div style={{ display:'flex', gap:8 }}>
                <input value={genCc} onChange={e=>setGenCc(e.target.value)} placeholder="CC" style={{ ...S.input, width:70 }} maxLength={4}/>
                <button onClick={()=>generateLines(genCc)} disabled={busy==='gen'||!genCc} style={btn('#f59e0b',busy==='gen'||!genCc)}><Zap size={13}/>Gen</button>
              </div>
              <button onClick={generateAll} disabled={busy==='genAll'} style={btn('#8b5cf6',busy==='genAll')}><Database size={13}/>Gen All</button>
            </div>

            {/* Create form */}
            {createLine && (
              <div style={{ background:'rgba(34,211,138,0.04)', border:'1px solid rgba(34,211,138,0.18)', borderRadius:10, padding:18 }}>
                <div style={{ ...S.sectionTitle, color:'#22d38a', marginBottom:12 }}><Plus size={13}/>CREATE NEW LINE</div>
                {/* Line type toggle */}
                <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                  {(['land','sea'] as const).map(t=>(
                    <button key={t} onClick={()=>setLineForm(x=>({...x,lineType:t}))} style={{ background: lineForm.lineType===t?(t==='land'?'rgba(168,85,247,0.2)':'rgba(0,229,255,0.2)'):'rgba(255,255,255,0.04)', border:`1px solid ${lineForm.lineType===t?(t==='land'?'#a855f7':'#00e5ff'):'rgba(255,255,255,0.08)'}`, color: lineForm.lineType===t?(t==='land'?'#a855f7':'#00e5ff'):'#64748b', borderRadius:6, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                      {t==='land'?'🌍 Land Line':'⚓ Sea Line'}
                    </button>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
                  {[{l:'Line ID*',k:'id',ph:lineForm.lineType==='land'?'DE-DOMINION':'my-sea-route'},{l:'Name*',k:'name',ph:lineForm.lineType==='land'?'Germany — Iron Cross':'My Sea Route'},{l:'Country',k:'countryCode',ph:'DE'}].map(f=>(
                    <div key={f.k}><label style={S.label}>{f.l}</label><input value={(lineForm as any)[f.k]} onChange={e=>setLineForm(x=>({...x,[f.k]:e.target.value}))} placeholder={f.ph} style={S.input}/></div>
                  ))}
                  <div><label style={S.label}>Archetype</label><select value={lineForm.archetype} onChange={e=>setLineForm(x=>({...x,archetype:e.target.value}))} style={S.input}><option value="dominion">⚔️ Dominion</option><option value="prosperity">💰 Prosperity</option><option value="convergence">🔮 Convergence</option></select></div>
                  <div><label style={S.label}>Continent</label><select value={lineForm.continent} onChange={e=>setLineForm(x=>({...x,continent:e.target.value}))} style={S.input}>{['north_america','south_america','europe','africa','asia','oceania'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                  {lineForm.lineType==='land' && (
                    <div><label style={S.label}>Blocks* (comma separated)</label><input value={lineForm.blocks} onChange={e=>setLineForm(x=>({...x,blocks:e.target.value}))} placeholder="DE-BY, DE-BW" style={S.input}/></div>
                  )}
                </div>
                {/* Sea data fields */}
                {lineForm.lineType==='sea' && (
                  <div style={{ background:'rgba(0,229,255,0.04)', border:'1px solid rgba(0,229,255,0.12)', borderRadius:8, padding:14, marginBottom:12 }}>
                    <div style={{ fontSize:9, color:'#00e5ff', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:10 }}>⚓ SEA ROUTE DATA</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                      <div><label style={S.label}>From Port*</label><input value={lineForm.from} onChange={e=>setLineForm(x=>({...x,from:e.target.value}))} placeholder="New York" style={S.input}/></div>
                      <div><label style={S.label}>From Country*</label><input value={lineForm.fromCountry} onChange={e=>setLineForm(x=>({...x,fromCountry:e.target.value}))} placeholder="US" style={S.input} maxLength={3}/></div>
                      <div><label style={S.label}>From Lng</label><input value={lineForm.fromLng} onChange={e=>setLineForm(x=>({...x,fromLng:e.target.value}))} placeholder="-74" style={S.input}/></div>
                      <div><label style={S.label}>From Lat</label><input value={lineForm.fromLat} onChange={e=>setLineForm(x=>({...x,fromLat:e.target.value}))} placeholder="40.71" style={S.input}/></div>
                      <div><label style={S.label}>To Port*</label><input value={lineForm.to} onChange={e=>setLineForm(x=>({...x,to:e.target.value}))} placeholder="Rotterdam" style={S.input}/></div>
                      <div><label style={S.label}>To Country*</label><input value={lineForm.toCountry} onChange={e=>setLineForm(x=>({...x,toCountry:e.target.value}))} placeholder="NL" style={S.input} maxLength={3}/></div>
                      <div><label style={S.label}>To Lng</label><input value={lineForm.toLng} onChange={e=>setLineForm(x=>({...x,toLng:e.target.value}))} placeholder="4.48" style={S.input}/></div>
                      <div><label style={S.label}>To Lat</label><input value={lineForm.toLat} onChange={e=>setLineForm(x=>({...x,toLat:e.target.value}))} placeholder="51.92" style={S.input}/></div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginTop:8 }}>
                      <div><label style={S.label}>Oil / tick</label><input type="number" value={lineForm.oil} onChange={e=>setLineForm(x=>({...x,oil:e.target.value}))} style={S.input}/></div>
                      <div><label style={S.label}>Fish / tick</label><input type="number" value={lineForm.fish} onChange={e=>setLineForm(x=>({...x,fish:e.target.value}))} style={S.input}/></div>
                      <div><label style={S.label}>Traded Goods $</label><input type="number" value={lineForm.tradedGoods} onChange={e=>setLineForm(x=>({...x,tradedGoods:e.target.value}))} style={S.input}/></div>
                      <div><label style={S.label}>Length (nm)</label><input type="number" value={lineForm.lengthNm} onChange={e=>setLineForm(x=>({...x,lengthNm:e.target.value}))} style={S.input}/></div>
                    </div>
                  </div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={submitCreateLine} style={btn('#22d38a')}><Plus size={13}/>Create</button>
                  <button onClick={()=>setCreateLine(false)} style={btn('#475569')}>Cancel</button>
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display:'flex', gap:10 }}>
              <span style={{ fontSize:11, color:'#a855f7', background:'rgba(168,85,247,0.1)', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>🌍 {lines.length} land in DB</span>
              <span style={{ fontSize:11, color:'#00e5ff', background:'rgba(0,229,255,0.1)', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>⚓ {seaLineDefs.length} sea (static)</span>
              {filteredLines.length!==allMergedLines.length && <span style={{ fontSize:11, color:'#f59e0b', background:'rgba(245,158,11,0.1)', padding:'4px 12px', borderRadius:20 }}>{filteredLines.length} shown</span>}
            </div>

            {/* Line rows */}
            <div style={S.card}>
              {filteredLines.length===0
                ? <div style={{ textAlign:'center', padding:40, color:'#475569' }}>No lines. Use Generate to seed.</div>
                : filteredLines.map(line => {
                  const a = ARCH[line.archetype]??ARCH.dominion
                  const open = expandedLine===line.id
                  const lt = (line as any).lineType ?? 'land'
                  const isSea = lt === 'sea'
                  const sd = (line as any).seaData
                  return (
                    <div key={line.id} className="hrow" style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', opacity:line.enabled?1:0.5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 4px' }}>
                        <div style={{ width:3, height:32, borderRadius:2, background: isSea ? '#00e5ff' : (line.enabled?a.color:'#1e293b'), flexShrink:0 }}/>
                        {/* Type badge */}
                        <span style={{ fontSize:8, padding:'2px 6px', borderRadius:3, background: isSea?'rgba(0,229,255,0.12)':'rgba(168,85,247,0.12)', color: isSea?'#00e5ff':'#a855f7', fontWeight:700, flexShrink:0 }}>
                          {isSea?'⚓ SEA':'🌍 LAND'}
                        </span>
                        <span style={{ fontFamily:'monospace', fontSize:11, color: isSea?'#00e5ff':a.color, minWidth:130, fontWeight:700 }}>{line.id}</span>
                        <span style={{ fontSize:12, color:'#cbd5e1', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{line.name}</span>
                        {!isSea && <span style={{ fontSize:9, padding:'2px 7px', borderRadius:12, background:`${a.color}18`, color:a.color, border:`1px solid ${a.color}38`, fontWeight:700 }}>{a.label}</span>}
                        {isSea && sd && <span style={{ fontSize:10, color:'#64748b' }}>{sd.from} → {sd.to}</span>}
                        {!isSea && <span style={{ fontSize:10, color:'#475569', minWidth:70, textAlign:'right' }}>{line.blocks.length} regions</span>}
                        {isSea && sd && <span style={{ fontSize:10, color:'#475569' }}>{sd.lengthNm?.toLocaleString()} nm</span>}
                        <span style={{ fontSize:10, color:'#334155', minWidth:28 }}>{line.countryCode??'—'}</span>
                        {line.autoGen && <span style={{ fontSize:9, color:'#334155', background:'rgba(51,65,85,0.2)', padding:'1px 5px', borderRadius:3 }}>AUTO</span>}
                        {isSea && <span style={{ fontSize:9, color:'#334155', background:'rgba(0,229,255,0.08)', padding:'1px 5px', borderRadius:3, border:'1px solid rgba(0,229,255,0.15)' }}>STATIC</span>}
                        {!isSea && (
                          <>
                            <button onClick={()=>toggleLine(line.id,line.enabled)} style={{ background:'transparent', border:`1px solid ${line.enabled?'#22d38a':'#334155'}30`, borderRadius:5, color:line.enabled?'#22d38a':'#475569', cursor:'pointer', padding:'3px 6px', display:'flex' }}>
                              {line.enabled?<ToggleRight size={15}/>:<ToggleLeft size={15}/>}
                            </button>
                            <button onClick={()=>deleteLine(line.id)} style={{ background:'transparent', border:'1px solid rgba(239,68,68,0.25)', borderRadius:5, color:'#ef4444', cursor:'pointer', padding:'3px 6px', display:'flex' }}><Trash2 size={13}/></button>
                          </>
                        )}
                        <button onClick={()=>setExpandedLine(open?null:line.id)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:5, color:'#64748b', cursor:'pointer', padding:'3px 6px', display:'flex' }}>
                          {open?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                        </button>
                      </div>
                      {open && !isSea && (
                        <div style={{ padding:'12px 8px 16px', display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                          <div>
                            <div style={{ ...S.label, marginBottom:8 }}>Regions ({line.blocks.length})</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                              {line.blocks.map(b=><span key={b} style={{ fontSize:10, background:'rgba(59,130,246,0.1)', color:'#60a5fa', padding:'2px 7px', borderRadius:4, fontFamily:'monospace', border:'1px solid rgba(59,130,246,0.2)' }}>{b}</span>)}
                            </div>
                          </div>
                          <div>
                            <div style={{ ...S.label, marginBottom:8 }}>Bonuses</div>
                            {Object.entries(line.bonuses).length===0
                              ? <span style={{ color:'#334155', fontSize:11 }}>None</span>
                              : Object.entries(line.bonuses).map(([k,v])=><div key={k} style={{ fontSize:11, color:'#22d38a', fontFamily:'monospace' }}>+{(v*100).toFixed(0)}% {k}</div>)}
                          </div>
                          <div>
                            <div style={{ ...S.label, marginBottom:8 }}>Tradeoffs</div>
                            {Object.entries(line.tradeoffs).length===0
                              ? <span style={{ color:'#334155', fontSize:11 }}>None</span>
                              : Object.entries(line.tradeoffs).map(([k,v])=><div key={k} style={{ fontSize:11, color:'#f87171', fontFamily:'monospace' }}>{v>0?'+':''}{(v*100).toFixed(0)}% {k}</div>)}
                          </div>
                        </div>
                      )}
                      {open && isSea && sd && (
                        <div style={{ padding:'12px 8px 16px', borderTop:'1px solid rgba(0,229,255,0.12)' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:12 }}>
                            <div>
                              <div style={S.label}>From</div>
                              <div style={{ fontSize:12, color:'#00e5ff', fontWeight:600 }}>{sd.from}</div>
                              <div style={{ fontSize:10, color:'#475569' }}>{sd.fromCountry} [{sd.fromCoords?.[0]}, {sd.fromCoords?.[1]}]</div>
                            </div>
                            <div>
                              <div style={S.label}>To</div>
                              <div style={{ fontSize:12, color:'#00e5ff', fontWeight:600 }}>{sd.to}</div>
                              <div style={{ fontSize:10, color:'#475569' }}>{sd.toCountry} [{sd.toCoords?.[0]}, {sd.toCoords?.[1]}]</div>
                            </div>
                            <div>
                              <div style={S.label}>Distance</div>
                              <div style={{ fontSize:14, color:'#e2e8f0', fontWeight:700, fontFamily:'Share Tech Mono,monospace' }}>{sd.lengthNm?.toLocaleString()} nm</div>
                            </div>
                            <div>
                              <div style={S.label}>Resources</div>
                              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                                {sd.oil > 0 && <span style={{ fontSize:10, color:'#3b82f6' }}>🛢️ {sd.oil} oil/tick</span>}
                                {sd.fish > 0 && <span style={{ fontSize:10, color:'#60a5fa' }}>🐟 {sd.fish} fish/tick</span>}
                                {sd.tradedGoods > 0 && <span style={{ fontSize:10, color:'#22d38a' }}>📦 ${sd.tradedGoods.toLocaleString()}/tick</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ── PIPELINES ── */}
        {tab==='pipelines' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {[
              { label:'⚔️ Fast Combat', desc:'Player training, recovery, auto-defence', pipeline:'fast', color:'#ef4444' },
              { label:'📈 Medium Sim', desc:'Stock prices, bond markets, indices', pipeline:'medium', color:'#3b82f6' },
              { label:'🏭 Slow Economy', desc:'Bar companies, salary, market cleanup', pipeline:'slow', color:'#f59e0b' },
            ].map(p=>(
              <div key={p.pipeline} style={S.card}>
                <div style={{ ...S.sectionTitle, color:p.color }}><Activity size={13}/>{p.label}</div>
                <p style={{ fontSize:12, color:'#64748b', marginBottom:16, lineHeight:1.7 }}>{p.desc}</p>
                <button onClick={()=>runPipeline(p.pipeline)} disabled={busy==='pipeline'} style={btn(p.color, busy==='pipeline')}>
                  <Play size={13}/> Force Run
                </button>
              </div>
            ))}
            {/* Daily jobs */}
            <div style={S.card}>
              <div style={{ ...S.sectionTitle, color:'#22d38a' }}><Settings size={13}/>📅 DAILY JOBS</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { job:'bar-refill',      label:'Full bar refill'   },
                  { job:'country-income',  label:'Country income'    },
                  { job:'maintenance',     label:'Maintenance'       },
                  { job:'fund-snapshot',   label:'Fund snapshot'     },
                  { job:'bounty-expiry',   label:'Bounty expiry'     },
                  { job:'election-tally',  label:'Election tally'    },
                  { job:'region-resolve',  label:'Region resolve'    },
                  { job:'cyber-restore',   label:'Cyber restore'     },
                ].map(j=>(
                  <div key={j.job} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize:12, color:'#94a3b8' }}>{j.label}</span>
                    <button onClick={()=>runPipeline('daily', j.job)} disabled={busy==='pipeline'} style={{ ...btn('#22d38a', busy==='pipeline'), padding:'4px 10px', fontSize:11 }}><Play size={11}/>Run</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── NEWS ── */}
        {tab==='news' && (
          <div style={S.card}>
            <div style={{ ...S.sectionTitle }}><Newspaper size={14} color="#f59e0b"/>RECENT NEWS ({news.length})</div>
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {news.map(n=>(
                <div key={n.id} className="hrow" style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'10px 6px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize:10, background:'rgba(245,158,11,0.12)', color:'#f59e0b', padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap', flexShrink:0, marginTop:1 }}>{n.category}</span>
                  <span style={{ fontSize:12, color:'#cbd5e1', flex:1, lineHeight:1.5 }}>{n.headline}</span>
                  <span style={{ fontSize:10, color:'#334155', whiteSpace:'nowrap', flexShrink:0 }}>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MARKET ── */}
        {tab==='market' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={S.card}>
              <div style={S.sectionTitle}><TrendingUp size={14} color="#22d38a"/>MARKET CONTROLS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <p style={{ fontSize:12, color:'#64748b', marginBottom:12, lineHeight:1.7 }}>
                    Run the slow economy pipeline to trigger market activity: company payouts, salary distributions, market listings cleanup.
                  </p>
                  <button onClick={()=>runPipeline('slow')} disabled={busy==='pipeline'} style={btn('#22d38a', busy==='pipeline')}><Play size={13}/>Run Slow Economy</button>
                </div>
                <div>
                  <p style={{ fontSize:12, color:'#64748b', marginBottom:12, lineHeight:1.7 }}>
                    Run the medium simulation pipeline to update stock prices, bond yields, and economic indices.
                  </p>
                  <button onClick={()=>runPipeline('medium')} disabled={busy==='pipeline'} style={btn('#3b82f6', busy==='pipeline')}><Play size={13}/>Run Medium Sim</button>
                </div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.sectionTitle}><Anchor size={14} color="#f97316"/>TRADE ROUTE DISRUPTION</div>
              <p style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.7 }}>Disrupt a specific trade route for a set duration. Route ID comes from the trade_route_state table.</p>
              <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}><label style={S.label}>Route ID</label><input value={routeId} onChange={e=>setRouteId(e.target.value)} placeholder="route-id-here" style={S.input}/></div>
                <div style={{ width:120 }}><label style={S.label}>Duration (minutes)</label><input type="number" value={routeMinutes} onChange={e=>setRouteMinutes(Number(e.target.value))} style={S.input} min={1} max={1440}/></div>
                <button onClick={disruptRoute} style={btn('#f97316')}><AlertTriangle size={13}/>Disrupt Route</button>
              </div>
              {(stats?.disruptedTradeRoutes?.length ?? 0) > 0 && (
                <div style={{ marginTop:14 }}>
                  <div style={{ ...S.label, marginBottom:8 }}>Currently Disrupted</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {stats?.disruptedTradeRoutes?.map(r=><span key={r} style={{ fontSize:11, background:'rgba(249,115,22,0.1)', color:'#f97316', padding:'2px 10px', borderRadius:20, border:'1px solid rgba(249,115,22,0.25)' }}>{r}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ECONOMY ── */}
        {tab==='economy' && (() => {
          // Human-readable resource labels + icons
          const RES_META: Record<string, { label: string; icon: any; color: string }> = {
            money: { label: 'Money', icon: DollarSign, color: '#22c55e' },
            oil: { label: 'Oil', icon: Droplet, color: '#3b82f6' },
            material_x: { label: 'MaterialX', icon: Atom, color: '#a855f7' },
            scrap: { label: 'Scrap', icon: Wrench, color: '#94a3b8' },
            bitcoin: { label: 'Bitcoin', icon: Bitcoin, color: '#f59e0b' },
            wheat: { label: 'Wheat', icon: Wheat, color: '#eab308' },
            fish: { label: 'Fish', icon: Fish, color: '#60a5fa' },
            steak: { label: 'Steak', icon: Beef, color: '#f43f5e' },
            bread: { label: 'Bread', icon: CakeSlice, color: '#fcd34d' },
            sushi: { label: 'Sushi', icon: UtensilsCrossed, color: '#f472b6' },
            wagyu: { label: 'Wagyu', icon: Beef, color: '#ef4444' },
            green_bullets: { label: 'Green Ammo', icon: Crosshair, color: '#22c55e' },
            blue_bullets: { label: 'Blue Ammo', icon: Crosshair, color: '#3b82f6' },
            purple_bullets: { label: 'Purple Ammo', icon: Crosshair, color: '#a855f7' },
            red_bullets: { label: 'Red Ammo', icon: Crosshair, color: '#ef4444' },
            loot_boxes: { label: 'Loot Boxes', icon: Package, color: '#f97316' },
            military_boxes: { label: 'Military Boxes', icon: ShieldAlert, color: '#22d38a' },
            badges_of_honor: { label: 'Badges', icon: Medal, color: '#22d38a' },
            stamina_pills: { label: 'Magic Tea', icon: CupSoda, color: '#a78bfa' },
            energy_leaves: { label: 'Energy Leaves', icon: Leaf, color: '#4ade80' },
          }

          const fmt = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n)

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Header + time range picker */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={S.sectionTitle}><BarChart3 size={14} color="#22d38a"/> ECONOMY DASHBOARD</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[7, 14, 30, 360].map(w => (
                    <button key={w} onClick={() => { setEconWindow(w); loadEcon(w) }}
                      style={{ background: econWindow === w ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${econWindow === w ? '#8b5cf6' : 'rgba(255,255,255,0.08)'}`,
                        color: econWindow === w ? '#8b5cf6' : '#64748b', borderRadius: 6, padding: '5px 12px',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {w}d
                    </button>
                  ))}
                  <button onClick={() => loadEcon()} style={btn('#64748b', econLoading)} disabled={econLoading}>
                    <RefreshCw size={12}/> {econLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
              </div>

              {econLoading && !econ && (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b', fontSize: 13 }}>
                  <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', fontSize: 24 }}>⟳</span>
                  <div style={{ marginTop: 12 }}>Loading economy data…</div>
                </div>
              )}

              {econ && (
                <>
                  {/* ── Resource Circulation Grid ── */}
                  <div style={S.card}>
                    <div style={{ ...S.sectionTitle, marginBottom: 14 }}><TrendingUp size={13} color="#22d38a"/> TOTAL IN CIRCULATION</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                      {Object.entries(econ.circulation).map(([key, val]) => {
                        const meta = RES_META[key]
                        if (!meta) return null
                        const Icon = meta.icon
                        return (
                          <div key={key} style={{
                            background: `${meta.color}08`, border: `1px solid ${meta.color}22`,
                            borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10
                          }}>
                            <div style={{ color: meta.color, background: `${meta.color}15`, padding: 7, borderRadius: 7 }}><Icon size={16}/></div>
                            <div>
                              <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>{meta.label}</div>
                              <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0', fontFamily: 'Share Tech Mono,monospace' }}>{fmt(val as number)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Breakdown footnote */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: '#475569', flexWrap: 'wrap' }}>
                      <span>👤 Player inventories</span>
                      <span>🏛️ Country funds: ${fmt(econ.countryTotals?.money ?? 0)}</span>
                      <span>⚔️ Army vaults: ${fmt(econ.armyTotals?.money ?? 0)}</span>
                    </div>
                  </div>

                  {/* ── Per-Player KPIs ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={S.card}>
                      <div style={{ ...S.sectionTitle, marginBottom: 14 }}><Users size={13} color="#3b82f6"/> PER-PLAYER WEALTH</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Avg Money', value: `$${fmt(econ.perPlayer.avgMoney)}`, color: '#22c55e' },
                          { label: 'Median Money', value: `$${fmt(econ.perPlayer.medianMoney)}`, color: '#3b82f6' },
                          { label: 'Gini Coefficient', value: econ.perPlayer.giniCoefficient.toFixed(4), color: econ.perPlayer.giniCoefficient > 0.6 ? '#ef4444' : econ.perPlayer.giniCoefficient > 0.4 ? '#f59e0b' : '#22c55e' },
                          { label: 'Rich/Poor Ratio', value: `${econ.perPlayer.richPoorRatio}x`, color: econ.perPlayer.richPoorRatio > 100 ? '#ef4444' : '#f59e0b' },
                        ].map(s => (
                          <div key={s.label} style={{ background: `${s.color}0a`, border: `1px solid ${s.color}20`, borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 3 }}>{s.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: 'Share Tech Mono,monospace' }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Gini explanation */}
                      <div style={{ marginTop: 10, fontSize: 10, color: '#475569', lineHeight: 1.6 }}>
                        Gini: 0 = perfect equality, 1 = maximum inequality. 
                        {econ.perPlayer.giniCoefficient > 0.6 && <span style={{ color: '#ef4444' }}> ⚠️ High inequality!</span>}
                        {econ.perPlayer.giniCoefficient <= 0.4 && <span style={{ color: '#22c55e' }}> ✓ Healthy distribution</span>}
                      </div>
                    </div>

                    {/* Top 10 Richest */}
                    <div style={S.card}>
                      <div style={{ ...S.sectionTitle, marginBottom: 10 }}><Medal size={13} color="#f59e0b"/> TOP 10 RICHEST</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {econ.perPlayer.top10?.map((p: any, i: number) => (
                          <div key={p.id} className="hrow" style={{ display: 'grid', gridTemplateColumns: '24px 1fr 60px 80px', gap: 8, alignItems: 'center', padding: '6px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 ? '#f59e0b' : '#475569', textAlign: 'center' }}>{i + 1}</span>
                            <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                            <span style={{ fontSize: 10, color: '#64748b', textAlign: 'right' }}>Lv.{p.level}</span>
                            <span style={{ fontSize: 11, color: '#22c55e', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>${fmt(p.money)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Economy Health + Flows ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    {/* Health metrics */}
                    <div style={S.card}>
                      <div style={{ ...S.sectionTitle, marginBottom: 12 }}><Activity size={13} color="#22d38a"/> ECONOMY HEALTH</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { label: 'Market Velocity', value: `${econ.health.marketVelocity} trades/player`, color: '#3b82f6' },
                          { label: 'Open Market Orders', value: `${econ.health.openMarketOrders} ($${fmt(econ.health.openOrdersValue)})`, color: '#f59e0b' },
                          { label: 'Active Companies', value: econ.health.activeCompanies, color: '#22d38a' },
                          { label: 'Total Items', value: fmt(econ.health.totalItems), color: '#8b5cf6' },
                          { label: 'Avg Player Level', value: econ.health.avgPlayerLevel.toFixed(1), color: '#60a5fa' },
                        ].map(s => (
                          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</span>
                            <span style={{ fontSize: 12, color: s.color, fontFamily: 'monospace', fontWeight: 700 }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Casino flow */}
                    <div style={S.card}>
                      <div style={{ ...S.sectionTitle, marginBottom: 12 }}><Dices size={13} color="#f97316"/> CASINO FLOW ({econWindow}d)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Total Bets', value: `$${fmt(econ.flows.casino.totalBets)}`, color: '#f59e0b' },
                          { label: 'Total Payouts', value: `$${fmt(econ.flows.casino.totalPayout)}`, color: '#22c55e' },
                          { label: 'Net Flow', value: `${econ.flows.casino.netFlow >= 0 ? '+' : ''}$${fmt(econ.flows.casino.netFlow)}`, color: econ.flows.casino.netFlow <= 0 ? '#22c55e' : '#ef4444' },
                          { label: 'Total Spins', value: econ.flows.casino.totalSpins, color: '#94a3b8' },
                        ].map(s => (
                          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</span>
                            <span style={{ fontSize: 13, color: s.color, fontFamily: 'monospace', fontWeight: 700 }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 10, color: '#475569' }}>
                        {econ.flows.casino.netFlow <= 0
                          ? <span style={{ color: '#22c55e' }}>✓ Casino is a net sink (healthy)</span>
                          : <span style={{ color: '#ef4444' }}>⚠️ Casino is a net faucet — players winning more than losing</span>}
                      </div>
                    </div>

                    {/* Player activity */}
                    <div style={S.card}>
                      <div style={{ ...S.sectionTitle, marginBottom: 12 }}><Users size={13} color="#3b82f6"/> PLAYER ACTIVITY ({econWindow}d)</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'New Registrations', value: econ.flows.newPlayers, color: '#22d38a' },
                          { label: 'Active Players', value: econ.flows.activePlayers, color: '#3b82f6' },
                          { label: 'Total Players', value: econ.perPlayer.count, color: '#94a3b8' },
                          { label: 'Retention Rate', value: econ.perPlayer.count > 0 ? `${((econ.flows.activePlayers / econ.perPlayer.count) * 100).toFixed(0)}%` : '—', color: econ.flows.activePlayers / econ.perPlayer.count > 0.5 ? '#22c55e' : '#f59e0b' },
                        ].map(s => (
                          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</span>
                            <span style={{ fontSize: 13, color: s.color, fontFamily: 'monospace', fontWeight: 700 }}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                      {/* Items created */}
                      {econ.flows.itemsCreated?.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ ...S.label, marginBottom: 6 }}>Items Produced ({econWindow}d)</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {econ.flows.itemsCreated.map((i: any) => (
                              <span key={i.tier} style={{ fontSize: 10, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', padding: '3px 10px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.2)', fontWeight: 700 }}>
                                T{i.tier}: {i.count}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Trade Volume table ── */}
                  {econ.flows.tradeVolume?.length > 0 && (
                    <div style={S.card}>
                      <div style={{ ...S.sectionTitle, marginBottom: 14 }}><TrendingUp size={13} color="#f59e0b"/> TRADE VOLUME ({econWindow}d)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, marginBottom: 6 }}>
                        {['Resource', 'Trades', 'Volume', 'Value ($)'].map(h => (
                          <div key={h} style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '0 8px 6px' }}>{h}</div>
                        ))}
                      </div>
                      {econ.flows.tradeVolume.map((tv: any) => {
                        const meta = RES_META[tv.itemType]
                        return (
                          <div key={tv.itemType} className="hrow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 0, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ padding: '0 8px', fontSize: 12, color: meta?.color ?? '#e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {meta && <meta.icon size={13}/>} {meta?.label ?? tv.itemType}
                            </div>
                            <div style={{ padding: '0 8px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>{tv.tradeCount}</div>
                            <div style={{ padding: '0 8px', fontSize: 12, color: '#cbd5e1', fontFamily: 'monospace' }}>{fmt(tv.totalAmount)}</div>
                            <div style={{ padding: '0 8px', fontSize: 12, color: '#22c55e', fontFamily: 'monospace', fontWeight: 700 }}>${fmt(tv.totalValue)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ═══ WEALTH DISTRIBUTION ═══ */}
                  {wealthDist && (() => {
                    const wd = wealthDist
                    const ls = wd.levelStats as any[]
                    const cs = wd.countryStats as any[]
                    const anomalies = wd.anomalies as any[]
                    const ac = wd.anomalyCounts

                    // Chart dimensions
                    const chartW = 1260, chartH = 320, padL = 70, padR = 20, padT = 30, padB = 50
                    const plotW = chartW - padL - padR
                    const plotH = chartH - padT - padB

                    const maxVal = Math.max(...ls.map((l: any) => l.sigma3), ...ls.map((l: any) => l.max), 1)
                    const barW = ls.length > 0 ? Math.max(8, Math.min(48, Math.floor(plotW / ls.length) - 4)) : 20
                    const toY = (v: number) => padT + plotH - (v / maxVal) * plotH
                    const toX = (i: number) => padL + (i / Math.max(ls.length - 1, 1)) * (plotW - barW) + barW / 2

                    // Y-axis gridlines
                    const yTicks: number[] = []
                    const step = Math.pow(10, Math.floor(Math.log10(maxVal / 4 || 1)))
                    for (let v = 0; v <= maxVal; v += step) yTicks.push(v)

                    return (
                      <>
                        {/* Overall Stats */}
                        <div style={S.card}>
                          <div style={{ ...S.sectionTitle, marginBottom: 14, justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={13} color="#8b5cf6"/> WEALTH DISTRIBUTION</span>
                            <button onClick={loadWealthDist} disabled={wdLoading} style={btn('#64748b', wdLoading)}>
                              <RefreshCw size={12}/> {wdLoading ? 'Loading…' : 'Refresh'}
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                            {[
                              { label: 'Total Players', value: wd.overall.count, color: '#3b82f6' },
                              { label: 'Min', value: `$${fmt(wd.overall.min)}`, color: '#64748b' },
                              { label: 'Max', value: `$${fmt(wd.overall.max)}`, color: '#ef4444' },
                              { label: 'Average', value: `$${fmt(wd.overall.avg)}`, color: '#22c55e' },
                              { label: 'Median', value: `$${fmt(wd.overall.median)}`, color: '#3b82f6' },
                              { label: 'Std Dev', value: `$${fmt(wd.overall.stddev)}`, color: '#f59e0b' },
                              { label: 'σ+1', value: `$${fmt(wd.overall.sigma1)}`, color: '#f59e0b' },
                              { label: 'σ+2', value: `$${fmt(wd.overall.sigma2)}`, color: '#f97316' },
                              { label: 'σ+3', value: `$${fmt(wd.overall.sigma3)}`, color: '#ef4444' },
                            ].map(s => (
                              <div key={s.label} style={{ background: `${s.color}0a`, border: `1px solid ${s.color}20`, borderRadius: 8, padding: '8px 14px', minWidth: 100, flex: 1 }}>
                                <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 2 }}>{s.label}</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'Share Tech Mono,monospace' }}>{s.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Interactive SVG Chart */}
                          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '8px 0', overflow: 'hidden', position: 'relative' }}>
                            <svg width={chartW} height={chartH} style={{ display: 'block', width: '100%', height: 'auto' }} viewBox={`0 0 ${chartW} ${chartH}`}>
                              {/* Y-axis gridlines */}
                              {yTicks.map(v => (
                                <g key={v}>
                                  <line x1={padL} y1={toY(v)} x2={chartW - padR} y2={toY(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4"/>
                                  <text x={padL - 8} y={toY(v) + 3} textAnchor="end" fill="#475569" fontSize={9} fontFamily="monospace">{fmt(v)}</text>
                                </g>
                              ))}

                              {/* σ bands */}
                              {ls.length > 1 && (
                                <>
                                  {/* σ1 band */}
                                  <path d={`M ${toX(0)} ${toY(ls[0]?.sigma1 ?? 0)} ${ls.map((l: any, i: number) => `L ${toX(i)} ${toY(l.sigma1)}`).join(' ')}`} fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="6,3" opacity={0.6}/>
                                  {/* σ2 band */}
                                  <path d={`M ${toX(0)} ${toY(ls[0]?.sigma2 ?? 0)} ${ls.map((l: any, i: number) => `L ${toX(i)} ${toY(l.sigma2)}`).join(' ')}`} fill="none" stroke="#f97316" strokeWidth={1} strokeDasharray="4,4" opacity={0.5}/>
                                  {/* σ3 band */}
                                  <path d={`M ${toX(0)} ${toY(ls[0]?.sigma3 ?? 0)} ${ls.map((l: any, i: number) => `L ${toX(i)} ${toY(l.sigma3)}`).join(' ')}`} fill="none" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3,3" opacity={0.5}/>
                                  {/* Labels */}
                                  <text x={chartW - padR + 4} y={toY(ls[ls.length - 1]?.sigma1 ?? 0)} fill="#f59e0b" fontSize={8} fontFamily="monospace" dominantBaseline="middle">σ+1</text>
                                  <text x={chartW - padR + 4} y={toY(ls[ls.length - 1]?.sigma2 ?? 0)} fill="#f97316" fontSize={8} fontFamily="monospace" dominantBaseline="middle">σ+2</text>
                                  <text x={chartW - padR + 4} y={toY(ls[ls.length - 1]?.sigma3 ?? 0)} fill="#ef4444" fontSize={8} fontFamily="monospace" dominantBaseline="middle">σ+3</text>
                                </>
                              )}

                              {/* Bars (avg per level) */}
                              {ls.map((l: any, i: number) => {
                                const x = toX(i) - barW / 2
                                const barH = (l.avg / maxVal) * plotH
                                const isHovered = wdHover === i
                                return (
                                  <g key={l.level}
                                    onMouseEnter={() => setWdHover(i)}
                                    onMouseLeave={() => setWdHover(null)}
                                    style={{ cursor: 'pointer' }}>
                                    {/* Bar */}
                                    <rect x={x} y={toY(l.avg)} width={barW} height={barH}
                                      fill={isHovered ? '#8b5cf6' : '#6366f1'} rx={3} opacity={isHovered ? 1 : 0.7}/>
                                    {/* Min-Max whisker */}
                                    <line x1={toX(i)} y1={toY(l.min)} x2={toX(i)} y2={toY(l.max)}
                                      stroke={isHovered ? '#e2e8f0' : '#64748b'} strokeWidth={1}/>
                                    <line x1={toX(i) - 4} y1={toY(l.max)} x2={toX(i) + 4} y2={toY(l.max)}
                                      stroke={isHovered ? '#ef4444' : '#64748b'} strokeWidth={1.5}/>
                                    <line x1={toX(i) - 4} y1={toY(l.min)} x2={toX(i) + 4} y2={toY(l.min)}
                                      stroke={isHovered ? '#22c55e' : '#64748b'} strokeWidth={1.5}/>
                                    {/* X label */}
                                    <text x={toX(i)} y={chartH - padB + 16} textAnchor="middle"
                                      fill={isHovered ? '#e2e8f0' : '#64748b'} fontSize={10} fontFamily="monospace" fontWeight={isHovered ? 700 : 400}>
                                      Lv{l.level}
                                    </text>
                                    {/* Hover tooltip */}
                                    {isHovered && (
                                      <g>
                                        <rect x={toX(i) - 70} y={toY(l.max) - 74} width={140} height={68}
                                          fill="rgba(15,23,42,0.95)" stroke="rgba(139,92,246,0.4)" rx={6}/>
                                        <text x={toX(i)} y={toY(l.max) - 56} textAnchor="middle" fill="#8b5cf6" fontSize={10} fontWeight={700} fontFamily="monospace">
                                          Level {l.level} ({l.count} players)
                                        </text>
                                        <text x={toX(i)} y={toY(l.max) - 42} textAnchor="middle" fill="#22c55e" fontSize={9} fontFamily="monospace">Avg: ${fmt(l.avg)} | Med: ${fmt(l.median)}</text>
                                        <text x={toX(i)} y={toY(l.max) - 28} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">Min: ${fmt(l.min)} | Max: ${fmt(l.max)}</text>
                                        <text x={toX(i)} y={toY(l.max) - 14} textAnchor="middle" fill="#f59e0b" fontSize={9} fontFamily="monospace">σ: ${fmt(l.stddev)} | σ+3: ${fmt(l.sigma3)}</text>
                                      </g>
                                    )}
                                  </g>
                                )
                              })}

                              {/* Avg line */}
                              {ls.length > 1 && (
                                <path d={`M ${toX(0)} ${toY(ls[0]?.avg ?? 0)} ${ls.map((l: any, i: number) => `L ${toX(i)} ${toY(l.avg)}`).join(' ')}`}
                                  fill="none" stroke="#8b5cf6" strokeWidth={2} opacity={0.8}/>
                              )}
                            </svg>
                            {/* Legend */}
                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '8px 0 4px', fontSize: 10 }}>
                              {[
                                { color: '#6366f1', label: 'Avg Wealth (bar)' },
                                { color: '#8b5cf6', label: 'Avg Line' },
                                { color: '#64748b', label: 'Min–Max Whisker' },
                                { color: '#f59e0b', label: 'σ+1 threshold' },
                                { color: '#f97316', label: 'σ+2 threshold' },
                                { color: '#ef4444', label: 'σ+3 threshold' },
                              ].map(l => (
                                <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>
                                  <span style={{ width: 12, height: 3, background: l.color, borderRadius: 2, display: 'inline-block' }}/> {l.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Per-Level Stats Table */}
                        <div style={S.card}>
                          <div style={{ ...S.sectionTitle, marginBottom: 12 }}><Database size={13} color="#6366f1"/> PER-LEVEL BREAKDOWN</div>
                          <div style={{ overflowX: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '50px 50px 80px 80px 80px 80px 80px 90px 90px 90px', gap: 0, minWidth: 800 }}>
                              {['Level', '#', 'Min', 'Max', 'Avg', 'Median', 'StdDev', 'σ+1', 'σ+2', 'σ+3'].map(h => (
                                <div key={h} style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</div>
                              ))}
                              {ls.map((l: any) => (
                                <>
                                  <div key={`${l.level}-lv`} style={{ padding: '5px 6px', fontSize: 12, color: '#8b5cf6', fontWeight: 700, fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{l.level}</div>
                                  <div key={`${l.level}-n`} style={{ padding: '5px 6px', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{l.count}</div>
                                  <div key={`${l.level}-min`} style={{ padding: '5px 6px', fontSize: 11, color: '#64748b', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.min)}</div>
                                  <div key={`${l.level}-max`} style={{ padding: '5px 6px', fontSize: 11, color: '#ef4444', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.max)}</div>
                                  <div key={`${l.level}-avg`} style={{ padding: '5px 6px', fontSize: 11, color: '#22c55e', fontFamily: 'monospace', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.avg)}</div>
                                  <div key={`${l.level}-med`} style={{ padding: '5px 6px', fontSize: 11, color: '#3b82f6', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.median)}</div>
                                  <div key={`${l.level}-sd`} style={{ padding: '5px 6px', fontSize: 11, color: '#f59e0b', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.stddev)}</div>
                                  <div key={`${l.level}-s1`} style={{ padding: '5px 6px', fontSize: 11, color: '#f59e0b', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.sigma1)}</div>
                                  <div key={`${l.level}-s2`} style={{ padding: '5px 6px', fontSize: 11, color: '#f97316', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.sigma2)}</div>
                                  <div key={`${l.level}-s3`} style={{ padding: '5px 6px', fontSize: 11, color: '#ef4444', fontFamily: 'monospace', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(l.sigma3)}</div>
                                </>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Per-Country Stats */}
                        <div style={S.card}>
                          <div style={{ ...S.sectionTitle, marginBottom: 12 }}><Globe size={13} color="#3b82f6"/> PER-COUNTRY WEALTH</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '60px 50px 80px 80px 80px 80px 80px', gap: 0 }}>
                            {['Country', '#', 'Min', 'Max', 'Avg', 'Median', 'StdDev'].map(h => (
                              <div key={h} style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</div>
                            ))}
                            {cs.map((c: any) => (
                              <>
                                <div key={`${c.countryCode}-cc`} style={{ padding: '5px 6px', fontSize: 12, color: '#60a5fa', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{c.countryCode}</div>
                                <div key={`${c.countryCode}-n`} style={{ padding: '5px 6px', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{c.count}</div>
                                <div key={`${c.countryCode}-min`} style={{ padding: '5px 6px', fontSize: 11, color: '#64748b', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(c.min)}</div>
                                <div key={`${c.countryCode}-max`} style={{ padding: '5px 6px', fontSize: 11, color: '#ef4444', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(c.max)}</div>
                                <div key={`${c.countryCode}-avg`} style={{ padding: '5px 6px', fontSize: 11, color: '#22c55e', fontFamily: 'monospace', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(c.avg)}</div>
                                <div key={`${c.countryCode}-med`} style={{ padding: '5px 6px', fontSize: 11, color: '#3b82f6', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(c.median)}</div>
                                <div key={`${c.countryCode}-sd`} style={{ padding: '5px 6px', fontSize: 11, color: '#f59e0b', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(c.stddev)}</div>
                              </>
                            ))}
                          </div>
                        </div>

                        {/* 🚨 Anomaly Detection */}
                        <div style={{ ...S.card, border: anomalies.length > 0 ? '1px solid rgba(239,68,68,0.25)' : undefined }}>
                          <div style={{ ...S.sectionTitle, marginBottom: 14, justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <AlertTriangle size={13} color={anomalies.length > 0 ? '#ef4444' : '#22c55e'}/>
                              ANOMALY DETECTION (σ OUTLIERS)
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {ac.extreme > 0 && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>🔴 {ac.extreme} EXTREME</span>}
                              {ac.critical > 0 && <span style={{ fontSize: 10, background: 'rgba(249,115,22,0.15)', color: '#f97316', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>🟠 {ac.critical} CRITICAL</span>}
                              {ac.warning > 0 && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>🟡 {ac.warning} WARNING</span>}
                              {anomalies.length === 0 && <span style={{ fontSize: 10, background: 'rgba(34,211,138,0.12)', color: '#22c55e', padding: '2px 10px', borderRadius: 12, fontWeight: 700 }}>✓ No anomalies</span>}
                            </div>
                          </div>

                          {anomalies.length > 0 ? (
                            <>
                              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
                                Players flagged whose money exceeds the standard deviation threshold for their level.
                                <b style={{ color: '#f59e0b' }}> σ+1</b> = warning,
                                <b style={{ color: '#f97316' }}> σ+2</b> = critical (possible exploit),
                                <b style={{ color: '#ef4444' }}> σ+3</b> = extreme (likely hack/dupe).
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 50px 90px 90px 80px 80px', gap: 0 }}>
                                {['Severity', 'Player', 'Level', 'Money', 'Lvl Avg', 'Lvl σ', 'σ Over'].map(h => (
                                  <div key={h} style={{ fontSize: 9, color: '#475569', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, padding: '4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</div>
                                ))}
                                {anomalies.map((a: any, i: number) => {
                                  const severityColors = { warning: '#f59e0b', critical: '#f97316', extreme: '#ef4444' }
                                  const sc = severityColors[a.severity as keyof typeof severityColors] || '#f59e0b'
                                  return (
                                    <>
                                      <div key={`${a.playerId}-sev-${i}`} style={{ padding: '5px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <span style={{ fontSize: 9, background: `${sc}18`, color: sc, padding: '2px 8px', borderRadius: 10, fontWeight: 700, border: `1px solid ${sc}30`, textTransform: 'uppercase' as const }}>
                                          {a.severity === 'extreme' ? '🔴' : a.severity === 'critical' ? '🟠' : '🟡'} {a.severity}
                                        </span>
                                      </div>
                                      <div key={`${a.playerId}-name-${i}`} style={{ padding: '5px 6px', fontSize: 12, color: '#e2e8f0', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {a.playerName}
                                        <span style={{ fontSize: 10, color: '#475569', marginLeft: 6 }}>{a.countryCode}</span>
                                      </div>
                                      <div key={`${a.playerId}-lv-${i}`} style={{ padding: '5px 6px', fontSize: 11, color: '#8b5cf6', fontFamily: 'monospace', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{a.level}</div>
                                      <div key={`${a.playerId}-money-${i}`} style={{ padding: '5px 6px', fontSize: 12, color: sc, fontFamily: 'monospace', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(a.money)}</div>
                                      <div key={`${a.playerId}-avg-${i}`} style={{ padding: '5px 6px', fontSize: 11, color: '#22c55e', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(a.levelAvg)}</div>
                                      <div key={`${a.playerId}-sd-${i}`} style={{ padding: '5px 6px', fontSize: 11, color: '#f59e0b', fontFamily: 'monospace', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>${fmt(a.levelStddev)}</div>
                                      <div key={`${a.playerId}-sig-${i}`} style={{ padding: '5px 6px', fontSize: 11, color: sc, fontFamily: 'monospace', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>&gt; σ+{a.sigmaExceeded}</div>
                                    </>
                                  )
                                })}
                              </div>
                            </>
                          ) : (
                            <div style={{ textAlign: 'center', padding: 30, color: '#22c55e', fontSize: 12 }}>
                              <CheckCircle size={24} style={{ marginBottom: 8, opacity: 0.6 }}/>
                              <div>All players within expected wealth distribution for their level. No suspicious outliers detected.</div>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          )
        })()}

        {/* ── MAP PIPELINE ── */}
        {tab==='map' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={S.card}>
              <div style={S.sectionTitle}><Globe size={14} color="#22d38a"/> DB → MAP PIPELINE</div>
              <p style={{ fontSize:12, color:'#64748b', lineHeight:1.9, marginBottom:20 }}>
                The pipeline below shows how admin ley line changes flow from the database to the live game map.
              </p>
              {[
                { step:1, label:'Admin creates/edits ley lines', detail:'Use the Ley Lines tab → Country Randomizer, or the line editor. Writes to the ley_line_defs table.', color:'#8b5cf6', icon:'🛠️' },
                { step:2, label:'POST /api/admin/country/:cc/randomize', detail:'Upserts region_ownership rows and regenerates ley_line_defs with real geographic region IDs.', color:'#3b82f6', icon:'📡' },
                { step:3, label:'GET /api/ley-lines/defs (new endpoint)', detail:'Returns the merged set of DB-defined + static fallback line definitions to any authenticated frontend.', color:'#f59e0b', icon:'🔗' },
                { step:4, label:'useLeyLineStore.fetchDefs()', detail:'Called on GameMap mount. Downloads live defs and writes them into reactive Zustand state.', color:'#22d38a', icon:'⚙️' },
                { step:5, label:'liveDefs — reactive Zustand state', detail:'All engine functions (computeAllStatuses, etc.) now use live defs from the store instead of the static array.', color:'#22d38a', icon:'⚡' },
                { step:6, label:'GameMap.tsx renders ley line arcs + nodes', detail:'buildLeyLineNodeGeoJSON() and buildLeyLinePathGeoJSON() iterate over liveDefs and plot markers + bezier arcs.', color:'#22d38a', icon:'🗺️' },
              ].map((s, i, arr) => (
                <div key={s.step}>
                  <div style={{ display:'flex', gap:14, alignItems:'flex-start', padding:'12px 0', borderBottom: i<arr.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:`${s.color}18`, border:`1px solid ${s.color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:15 }}>{s.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color: s.color, fontFamily:'Share Tech Mono,monospace', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize:11, color:'#64748b', lineHeight:1.6 }}>{s.detail}</div>
                    </div>
                    <div style={{ width:28, height:28, borderRadius:6, background:`${s.color}18`, border:`1px solid ${s.color}33`, display:'flex', alignItems:'center', justifyContent:'center', color:s.color, fontSize:11, fontWeight:800, flexShrink:0 }}>{s.step}</div>
                  </div>
                  {i < arr.length-1 && <div style={{ marginLeft:16, width:1, height:8, background:'rgba(255,255,255,0.06)' }}/>}
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={S.card}>
                <div style={S.sectionTitle}><Play size={13} color="#22d38a"/> QUICK ACTIONS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <button onClick={runEngine} disabled={busy==='engine'} style={btn('#22d38a', busy==='engine')}>
                    {busy==='engine'?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Running…</>:<><Play size={13}/>Run Ley Line Engine</>}
                  </button>
                  <button onClick={generateAll} disabled={busy==='genAll'} style={btn('#8b5cf6', busy==='genAll')}>
                    {busy==='genAll'?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>⟳</span>Generating…</>:<><Database size={13}/>Re-generate All Countries</>}
                  </button>
                  <a href="/" style={{ ...btn('#3b82f6') as any, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                    <Globe size={13}/> Open Game Map
                  </a>
                </div>
              </div>
              <div style={S.card}>
                <div style={S.sectionTitle}><Database size={13} color="#f59e0b"/> DB STATUS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {[{label:'Lines in DB', value:lines.length, color:'#8b5cf6'},{label:'Countries', value:[...new Set(lines.map(l=>l.countryCode||'?'))].length, color:'#3b82f6'},{label:'Enabled', value:lines.filter(l=>l.enabled).length, color:'#22d38a'},{label:'Disabled', value:lines.filter(l=>!l.enabled).length, color:'#ef4444'}].map(s=>(
                    <div key={s.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color:'#64748b' }}>{s.label}</span>
                      <span style={{ color:s.color, fontFamily:'monospace', fontWeight:700 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
