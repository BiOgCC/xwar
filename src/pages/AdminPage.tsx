/**
 * AdminPage.tsx — Full-stack admin dashboard at /admin
 * Covers: Stats, Players, Pipelines, Ley Lines, Market, News, Trade Routes
 */
import { useState, useEffect, useCallback } from 'react'
import { Shield, RefreshCw, Play, Zap, Database, Users, Swords, Globe,
  TrendingUp, Trash2, ToggleLeft, ToggleRight, Plus, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, LogOut, Activity, Newspaper, Anchor, Search,
  Settings, DollarSign, Package } from 'lucide-react'

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
  const [tab, setTab]                  = useState<'overview'|'players'|'leylines'|'pipelines'|'news'|'market'|'map'>('overview')
  const [stats, setStats]             = useState<Stats|null>(null)
  const [players, setPlayers]         = useState<Player[]>([])
  const [lines, setLines]             = useState<LeyLine[]>([])
  const [staticLines, setStaticLines] = useState<LeyLine[]>([])
  const [news, setNews]               = useState<NewsItem[]>([])
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
  const [lineForm, setLineForm]       = useState({ id:'', name:'', continent:'europe', archetype:'dominion', blocks:'', countryCode:'' })
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
      const d = await api('/api/player/all')
      if (d.success) setPlayers(d.players)
    } catch {}
  },[])

  useEffect(()=>{ load() },[load])
  useEffect(()=>{ if (tab==='players') loadPlayers() },[tab,loadPlayers])

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
    const d = await api('/api/admin/disrupt-route', { method:'POST', body:JSON.stringify({ routeId, minutes:routeMinutes }) })
    if (d.ok) notify(`Route ${routeId} disrupted for ${routeMinutes}m`)
    else notify(d.error??'Failed','err')
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

  const filteredLines = lines.filter(l => !lineFilter || l.id.toLowerCase().includes(lineFilter.toLowerCase()) || l.name.toLowerCase().includes(lineFilter.toLowerCase()) || (l.countryCode??'').toLowerCase().includes(lineFilter.toLowerCase()))
  const filteredPlayers = players.filter(p => !playerSearch || p.name?.toLowerCase().includes(playerSearch.toLowerCase()) || (p.countryCode??'').toLowerCase().includes(playerSearch.toLowerCase()))

  const ARCH_C: Record<string,string> = { dominion:'#ef4444', prosperity:'#f59e0b', convergence:'#8b5cf6' }

  return (
    <div style={{ background:'#070d16', minHeight:'100vh', color:'#e2e8f0', fontFamily:'Inter,system-ui,sans-serif' }}>
      <style>{`
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
          {(['overview','players','leylines','pipelines','news','market','map'] as const).map(t => (
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
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:0, marginBottom:8 }}>
              {['Name','Country','Level','Money','Role'].map(h=>(
                <div key={h} style={{ fontSize:9, color:'#475569', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', padding:'0 8px 6px' }}>{h}</div>
              ))}
            </div>
            {filteredPlayers.slice(0,80).map(p=>(
              <div key={p.id} className="hrow" style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:0, borderRadius:6, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ padding:'0 8px', fontSize:12, color:'#e2e8f0', fontWeight:600 }}>{p.name}<div style={{ fontSize:10, color:'#475569', fontFamily:'monospace' }}>{p.id?.slice(0,16)}…</div></div>
                <div style={{ padding:'0 8px', fontSize:12, color:'#60a5fa' }}>{p.countryCode}</div>
                <div style={{ padding:'0 8px', fontSize:12, color:'#94a3b8' }}>{p.level}</div>
                <div style={{ padding:'0 8px', fontSize:11, color:'#22d38a', fontFamily:'monospace' }}>{p.money!=null?`$${Number(p.money).toLocaleString()}`:'—'}</div>
                <div style={{ padding:'0 8px' }}>
                  <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background: p.role==='admin'?'rgba(139,92,246,0.2)':'rgba(255,255,255,0.06)', color: p.role==='admin'?'#8b5cf6':'#64748b' }}>{p.role||'player'}</span>
                </div>
              </div>
            ))}
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
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
                  {[{l:'Line ID*',k:'id',ph:'DE-DOMINION'},{l:'Name*',k:'name',ph:'Germany — Iron Cross'},{l:'Country',k:'countryCode',ph:'DE'}].map(f=>(
                    <div key={f.k}><label style={S.label}>{f.l}</label><input value={(lineForm as any)[f.k]} onChange={e=>setLineForm(x=>({...x,[f.k]:e.target.value}))} placeholder={f.ph} style={S.input}/></div>
                  ))}
                  <div><label style={S.label}>Archetype</label><select value={lineForm.archetype} onChange={e=>setLineForm(x=>({...x,archetype:e.target.value}))} style={S.input}><option value="dominion">⚔️ Dominion</option><option value="prosperity">💰 Prosperity</option><option value="convergence">🔮 Convergence</option></select></div>
                  <div><label style={S.label}>Continent</label><select value={lineForm.continent} onChange={e=>setLineForm(x=>({...x,continent:e.target.value}))} style={S.input}>{['north_america','south_america','europe','africa','asia','oceania'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                  <div><label style={S.label}>Blocks* (comma separated)</label><input value={lineForm.blocks} onChange={e=>setLineForm(x=>({...x,blocks:e.target.value}))} placeholder="DE-BY, DE-BW" style={S.input}/></div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={submitCreateLine} style={btn('#22d38a')}><Plus size={13}/>Create</button>
                  <button onClick={()=>setCreateLine(false)} style={btn('#475569')}>Cancel</button>
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display:'flex', gap:10 }}>
              <span style={{ fontSize:11, color:'#8b5cf6', background:'rgba(139,92,246,0.1)', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>{lines.length} in DB</span>
              {staticLines.length>0 && <span style={{ fontSize:11, color:'#475569', background:'rgba(71,85,105,0.1)', padding:'4px 12px', borderRadius:20 }}>+{staticLines.length} static-only</span>}
              {filteredLines.length!==lines.length && <span style={{ fontSize:11, color:'#f59e0b', background:'rgba(245,158,11,0.1)', padding:'4px 12px', borderRadius:20 }}>{filteredLines.length} shown</span>}
            </div>

            {/* Line rows */}
            <div style={S.card}>
              {filteredLines.length===0
                ? <div style={{ textAlign:'center', padding:40, color:'#475569' }}>No lines. Use Generate to seed.</div>
                : filteredLines.map(line => {
                  const a = ARCH[line.archetype]??ARCH.dominion
                  const open = expandedLine===line.id
                  return (
                    <div key={line.id} className="hrow" style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', opacity:line.enabled?1:0.5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 4px' }}>
                        <div style={{ width:3, height:32, borderRadius:2, background:line.enabled?a.color:'#1e293b', flexShrink:0 }}/>
                        <span style={{ fontFamily:'monospace', fontSize:11, color:a.color, minWidth:130, fontWeight:700 }}>{line.id}</span>
                        <span style={{ fontSize:12, color:'#cbd5e1', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{line.name}</span>
                        <span style={{ fontSize:9, padding:'2px 7px', borderRadius:12, background:`${a.color}18`, color:a.color, border:`1px solid ${a.color}38`, fontWeight:700 }}>{a.label}</span>
                        <span style={{ fontSize:10, color:'#475569', minWidth:70, textAlign:'right' }}>{line.blocks.length} regions</span>
                        <span style={{ fontSize:10, color:'#334155', minWidth:28 }}>{line.countryCode??'—'}</span>
                        {line.autoGen && <span style={{ fontSize:9, color:'#334155', background:'rgba(51,65,85,0.2)', padding:'1px 5px', borderRadius:3 }}>AUTO</span>}
                        <button onClick={()=>toggleLine(line.id,line.enabled)} style={{ background:'transparent', border:`1px solid ${line.enabled?'#22d38a':'#334155'}30`, borderRadius:5, color:line.enabled?'#22d38a':'#475569', cursor:'pointer', padding:'3px 6px', display:'flex' }}>
                          {line.enabled?<ToggleRight size={15}/>:<ToggleLeft size={15}/>}
                        </button>
                        <button onClick={()=>deleteLine(line.id)} style={{ background:'transparent', border:'1px solid rgba(239,68,68,0.25)', borderRadius:5, color:'#ef4444', cursor:'pointer', padding:'3px 6px', display:'flex' }}><Trash2 size={13}/></button>
                        <button onClick={()=>setExpandedLine(open?null:line.id)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:5, color:'#64748b', cursor:'pointer', padding:'3px 6px', display:'flex' }}>
                          {open?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
                        </button>
                      </div>
                      {open && (
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
