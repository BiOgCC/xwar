import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'
import { useResearchStore, MILITARY_DOCTRINE, ECONOMIC_THEORY, type ResearchNode } from '../../../stores/researchStore'

// ====== RADIAL RESEARCH CHART ======

interface RadialTreeProps {
  title: string
  icon: string
  color: string
  glowColor: string
  nodes: ResearchNode[]
  unlocked: string[]
  canUnlock: (nodeId: string) => boolean
  onUnlock: (nodeId: string) => void
}

function RadialResearchTree({ title, icon, color, glowColor, nodes, unlocked, canUnlock, onUnlock }: RadialTreeProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const cx = 120, cy = 120, radius = 80
  const nodeRadius = 18

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '1px', textTransform: 'uppercase' }}>{icon} {title}</div>
      <svg width={240} height={240} viewBox="0 0 240 240" style={{ filter: `drop-shadow(0 0 8px ${glowColor}30)` }}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke={`${color}15`} strokeWidth="2" strokeDasharray="4 4" />

        {/* Connection lines between sequential nodes */}
        {nodes.map((node, i) => {
          if (i === 0) return null
          const prevAngle = (((i - 1) / nodes.length) * 360 - 90) * (Math.PI / 180)
          const currAngle = ((i / nodes.length) * 360 - 90) * (Math.PI / 180)
          const x1 = cx + radius * Math.cos(prevAngle)
          const y1 = cy + radius * Math.sin(prevAngle)
          const x2 = cx + radius * Math.cos(currAngle)
          const y2 = cy + radius * Math.sin(currAngle)
          const prevUnlocked = unlocked.includes(nodes[i - 1].id)
          const currUnlocked = unlocked.includes(node.id)
          const lineColor = currUnlocked ? color : prevUnlocked ? `${color}60` : `${color}15`
          return <line key={`line-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lineColor} strokeWidth="2" />
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const angle = ((i / nodes.length) * 360 - 90) * (Math.PI / 180)
          const x = cx + radius * Math.cos(angle)
          const y = cy + radius * Math.sin(angle)
          const isUnlocked = unlocked.includes(node.id)
          const canDo = canUnlock(node.id)
          const isHovered = hovered === node.id

          return (
            <g
              key={node.id}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => canDo && onUnlock(node.id)}
              style={{ cursor: canDo ? 'pointer' : 'default' }}
            >
              {/* Glow ring for unlockable */}
              {canDo && (
                <circle cx={x} cy={y} r={nodeRadius + 4} fill="none" stroke={color} strokeWidth="1.5" opacity={0.6}>
                  <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Node circle */}
              <circle
                cx={x} cy={y} r={nodeRadius}
                fill={isUnlocked ? `${color}25` : canDo ? `${color}10` : 'rgba(0,0,0,0.6)'}
                stroke={isUnlocked ? color : canDo ? `${color}80` : 'rgba(255,255,255,0.08)'}
                strokeWidth={isUnlocked ? 2 : 1.5}
              />

              {/* Node icon */}
              <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize="14" fill={isUnlocked ? '#fff' : canDo ? '#ccc' : '#3e4a5c'}>
                {isUnlocked ? '✓' : node.icon}
              </text>

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x - 60} y={y + nodeRadius + 6} width={120} height={48}
                    rx={4} fill="rgba(0,0,0,0.92)" stroke={`${color}40`} strokeWidth="1"
                  />
                  <text x={x} y={y + nodeRadius + 20} textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>{node.name}</text>
                  <text x={x} y={y + nodeRadius + 31} textAnchor="middle" fontSize="7" fill="#94a3b8">{node.effect}</text>
                  <text x={x} y={y + nodeRadius + 42} textAnchor="middle" fontSize="7" fill={canDo ? '#22d38a' : '#ef4444'}>
                    {isUnlocked ? '✓ UNLOCKED' : `$${node.cost.toLocaleString()}`}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16">{icon}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fontWeight="700" fill={color}>{unlocked.length}/{nodes.length}</text>
      </svg>
    </div>
  )
}

// ====== RESEARCH TAB ======

export default function GovResearchTab() {
  const player = usePlayerStore()
  const govStore = useGovernmentStore()
  const ui = useUIStore()
  const researchStore = useResearchStore()
  const iso = player.countryCode || 'US'
  const gov = govStore.governments[iso]
  const isPresident = gov?.president === player.name
  const [empireName, setEmpireName] = useState(gov?.empireName || '')

  if (!gov) return null

  const research = researchStore.getResearch(iso)
  const fund = useWorldStore.getState().getCountry(iso)?.fund

  const handleUnlock = (tree: 'military' | 'economy', nodeId: string) => {
    if (!isPresident) {
      ui.addFloatingText('PRESIDENT ONLY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    const result = researchStore.unlockNode(iso, tree, nodeId)
    const color = tree === 'military' ? '#ef4444' : '#22d38a'
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? color : '#ef4444')
  }

  return (
    <>
      {/* Empire Name (kept from old tab) */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--amber">👑 EMPIRE NAME</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input className="gov-input" type="text" value={empireName} onChange={e => setEmpireName(e.target.value)} maxLength={30} placeholder="Enter empire name..." style={{ flex: 1 }} />
          <button className="gov-btn gov-btn--amber" onClick={() => {
            if (!isPresident) { ui.addFloatingText('PRESIDENT ONLY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
            if (!empireName.trim()) { ui.addFloatingText('ENTER A NAME', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
            useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], empireName: empireName.trim() } } }))
            ui.addFloatingText(`EMPIRE: ${empireName.trim()}`, window.innerWidth / 2, window.innerHeight / 2, '#f59e0b')
          }}>SET</button>
        </div>
        {gov.empireName && <div style={{ fontSize: '9px', color: '#f59e0b', marginTop: '4px' }}>Current: <strong>{gov.empireName}</strong></div>}
      </div>

      {/* Ideology (kept from old tab) */}
      <div className="gov-section">
        <div className="gov-section__title">🏛️ IDEOLOGY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {([
            { id: 'militarist' as const, icon: '⚔️', label: 'MILITARIST', color: '#ef4444', desc: '+ATK & +Crit' },
            { id: 'capitalist' as const, icon: '💰', label: 'CAPITALIST', color: '#22d38a', desc: '+Production & +Tax' },
            { id: 'technocrat' as const, icon: '🔬', label: 'TECHNOCRAT', color: '#8b5cf6', desc: '+Cyber & +Tech' },
            { id: 'expansionist' as const, icon: '🌍', label: 'EXPANSIONIST', color: '#3b82f6', desc: '+Defense & +Diplo' },
          ]).map(ideo => (
            <button key={ideo.id} onClick={() => {
              if (!isPresident) { ui.addFloatingText('PRESIDENT ONLY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
              useGovernmentStore.setState(s => ({ governments: { ...s.governments, [iso]: { ...s.governments[iso], ideology: ideo.id } } }))
              ui.addFloatingText(`IDEOLOGY: ${ideo.label}`, window.innerWidth / 2, window.innerHeight / 2, ideo.color)
            }} style={{
              padding: '6px', borderRadius: '3px', cursor: 'pointer', textAlign: 'left',
              border: `1px solid ${gov.ideology === ideo.id ? ideo.color + '50' : 'rgba(255,255,255,0.05)'}`,
              background: gov.ideology === ideo.id ? `${ideo.color}10` : 'rgba(0,0,0,0.3)',
            }}>
              <div style={{ fontSize: '11px', marginBottom: '1px' }}>
                {ideo.icon} <span style={{ fontSize: '9px', fontWeight: 700, color: gov.ideology === ideo.id ? ideo.color : '#64748b' }}>{ideo.label}</span>
              </div>
              <div style={{ fontSize: '7px', color: '#3e4a5c' }}>{ideo.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Research Trees */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--purple">🔬 NATIONAL RESEARCH</div>
        <div style={{ fontSize: '7px', color: '#3e4a5c', marginBottom: '2px' }}>
          Unlock technologies from the National Fund. Sequential unlock — requires previous node. {isPresident ? '✅ You are President.' : '🔒 Only the President can research.'}
        </div>
        {fund && <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '6px' }}>💰 Fund: <strong style={{ color: '#22d38a' }}>${fund.money.toLocaleString()}</strong></div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <RadialResearchTree
            title="Military Doctrine"
            icon="⚔️"
            color="#ef4444"
            glowColor="#ef4444"
            nodes={MILITARY_DOCTRINE}
            unlocked={research.military}
            canUnlock={(id) => isPresident && researchStore.canUnlock(iso, 'military', id)}
            onUnlock={(id) => handleUnlock('military', id)}
          />
          <RadialResearchTree
            title="Economic Theory"
            icon="💰"
            color="#22d38a"
            glowColor="#22d38a"
            nodes={ECONOMIC_THEORY}
            unlocked={research.economy}
            canUnlock={(id) => isPresident && researchStore.canUnlock(iso, 'economy', id)}
            onUnlock={(id) => handleUnlock('economy', id)}
          />
        </div>
      </div>

      {/* Active Bonuses Summary */}
      {(research.military.length > 0 || research.economy.length > 0) && (
        <div className="gov-section">
          <div className="gov-section__title">📊 ACTIVE BONUSES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '7px' }}>
            {MILITARY_DOCTRINE.filter(n => research.military.includes(n.id)).map(n => (
              <div key={n.id} style={{ padding: '3px 5px', background: 'rgba(239,68,68,0.08)', borderRadius: '2px', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span style={{ color: '#ef4444' }}>{n.icon}</span> <span style={{ color: '#94a3b8' }}>{n.effect}</span>
              </div>
            ))}
            {ECONOMIC_THEORY.filter(n => research.economy.includes(n.id)).map(n => (
              <div key={n.id} style={{ padding: '3px 5px', background: 'rgba(34,211,138,0.08)', borderRadius: '2px', border: '1px solid rgba(34,211,138,0.15)' }}>
                <span style={{ color: '#22d38a' }}>{n.icon}</span> <span style={{ color: '#94a3b8' }}>{n.effect}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
