import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useWorldStore } from '../../../stores/worldStore'
import { useUIStore } from '../../../stores/uiStore'
import { useResearchStore, MILITARY_DOCTRINE, ECONOMIC_THEORY, type ResearchNode } from '../../../stores/researchStore'
import { Dna, Microscope, BarChart2, Sword, CircleDollarSign, Shield, Handshake, Check, Medal, ClipboardList, Castle, Target, Skull, Zap, Flame, Hammer, Ship, Landmark, Factory, Package, Star } from 'lucide-react'

const ICON_MAP: Record<string, React.FC<any>> = {
  medal: Medal, clipboard: ClipboardList, castle: Castle, crosshair: Target, skull: Skull, zap: Zap, flame: Flame, hammer: Hammer, ship: Ship, landmark: Landmark, factory: Factory, coins: CircleDollarSign, package: Package, star: Star
}

// ====== RADIAL RESEARCH CHART ======

interface RadialTreeProps {
  title: string
  icon: React.ReactNode
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
      <div style={{ fontSize: '10px', fontWeight: 700, color, letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>{title}</div>
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
              <foreignObject x={x - 8} y={y - 8} width={16} height={16}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', color: isUnlocked ? '#fff' : canDo ? '#ccc' : '#3e4a5c' }}>
                  {(() => {
                    const NodeIcon = ICON_MAP[node.icon]
                    return isUnlocked ? <Check size={12}/> : (NodeIcon ? <NodeIcon size={12}/> : null)
                  })()}
                </div>
              </foreignObject>

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
        <foreignObject x={cx - 12} y={cy - 18} width={24} height={24}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', color }}>
            {icon}
          </div>
        </foreignObject>
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

  if (!gov) return null

  const research = researchStore.getResearch(iso)
  const fund = useWorldStore.getState().getCountry(iso)?.fund

  const handleUnlock = async (tree: 'military' | 'economy', nodeId: string) => {
    if (!isPresident) {
      ui.addFloatingText('PRESIDENT ONLY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444')
      return
    }
    const result = await researchStore.unlockNode(iso, tree, nodeId)
    const color = tree === 'military' ? '#ef4444' : '#22d38a'
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, result.success ? color : '#ef4444')
  }

  return (
    <>
      {/* Skill Tree (Moved from Empire Tab) */}
      {gov.ideology && (
        <div className="gov-section">
          <div className="gov-section__title gov-section__title--purple" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Dna size={14} /> SKILL TREE</div>
          <div style={{ fontSize: '7px', color: '#3e4a5c', marginBottom: '4px' }}>Each ideology upgrade costs $5,000 from National Fund. Max 10 per branch. {isPresident ? '' : '🔒 Only the President can upgrade.'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {([
              { key: 'warBonus' as const, icon: <Sword size={12}/>, label: 'WAR', desc: '+2% attack/pt', color: '#ef4444' },
              { key: 'economyBonus' as const, icon: <CircleDollarSign size={12}/>, label: 'ECONOMY', desc: '+2% production/pt', color: '#22d38a' },
              { key: 'techBonus' as const, icon: <Microscope size={12}/>, label: 'TECH', desc: '+2% cyber/pt', color: '#8b5cf6' },
              { key: 'defenseBonus' as const, icon: <Shield size={12}/>, label: 'DEFENSE', desc: '+2% bunker/pt', color: '#f59e0b' },
              { key: 'diplomacyBonus' as const, icon: <Handshake size={12}/>, label: 'DIPLOMACY', desc: '+1 alliance/pt', color: '#3b82f6' },
            ]).map(skill => {
              const pts = gov.ideologyPoints[skill.key], maxPts = 10
              return (
                <div key={skill.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', width: '18px', flexShrink: 0, color: skill.color }}>{skill.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: skill.color }}>{skill.label}</div>
                    <div style={{ fontSize: '6px', color: '#3e4a5c' }}>{skill.desc}</div>
                    <div style={{ display: 'flex', gap: '1px', marginTop: '2px' }}>
                      {Array.from({ length: maxPts }).map((_, i) => (
                        <div key={i} style={{ width: '12px', height: '4px', borderRadius: '1px', background: i < pts ? skill.color : 'rgba(255,255,255,0.06)' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'var(--font-display)' }}>{pts}/{maxPts}</div>
                    <button className="gov-btn" disabled={pts >= maxPts || !isPresident} style={{
                      borderColor: `${skill.color}50`, color: skill.color, fontSize: '7px', padding: '1px 5px', marginTop: '2px',
                      opacity: pts >= maxPts || !isPresident ? 0.3 : 1,
                    }} onClick={() => {
                      if (!isPresident) { ui.addFloatingText('PRESIDENT ONLY', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
                      const currentFund = useWorldStore.getState().getCountry(iso)?.fund
                      if (!currentFund || currentFund.money < 5000) { ui.addFloatingText('FUND: $5,000 REQUIRED', window.innerWidth / 2, window.innerHeight / 2, '#ef4444'); return }
                      useWorldStore.getState().spendFromFund(iso, { money: 5000 })
                      useGovernmentStore.setState((s: any) => {
                        const g = s.governments[iso]
                        return { governments: { ...s.governments, [iso]: { ...g, ideologyPoints: { ...g.ideologyPoints, [skill.key]: g.ideologyPoints[skill.key] + 1 } } } }
                      })
                      ui.addFloatingText(`+1 ${skill.label}`, window.innerWidth / 2, window.innerHeight / 2, skill.color)
                    }}>+1</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Research Trees */}
      <div className="gov-section">
        <div className="gov-section__title gov-section__title--purple" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Microscope size={14} /> NATIONAL RESEARCH</div>
        <div style={{ fontSize: '7px', color: '#3e4a5c', marginBottom: '2px' }}>
          Unlock technologies from the National Fund. Sequential unlock — requires previous node. {isPresident ? '✅ You are President.' : '🔒 Only the President can research.'}
        </div>
        {fund && <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '6px' }}>💰 Fund: <strong style={{ color: '#22d38a' }}>${fund.money.toLocaleString()}</strong></div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <RadialResearchTree
            title="Military Doctrine"
            icon={<Sword size={20} />}
            color="#ef4444"
            glowColor="#ef4444"
            nodes={MILITARY_DOCTRINE}
            unlocked={research.military}
            canUnlock={(id) => isPresident && researchStore.canUnlock(iso, 'military', id)}
            onUnlock={(id) => handleUnlock('military', id)}
          />
          <RadialResearchTree
            title="Economic Theory"
            icon={<CircleDollarSign size={20} />}
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
          <div className="gov-section__title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart2 size={14} color="#e2e8f0" /> ACTIVE BONUSES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '7px' }}>
            {MILITARY_DOCTRINE.filter(n => research.military.includes(n.id)).map(n => {
              const Icon = ICON_MAP[n.icon]
              return (
              <div key={n.id} style={{ padding: '3px 5px', background: 'rgba(239,68,68,0.08)', borderRadius: '2px', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#ef4444', display: 'flex' }}>{Icon && <Icon size={10} />}</span> <span style={{ color: '#94a3b8' }}>{n.effect}</span>
              </div>
            )})}
            {ECONOMIC_THEORY.filter(n => research.economy.includes(n.id)).map(n => {
              const Icon = ICON_MAP[n.icon]
              return (
              <div key={n.id} style={{ padding: '3px 5px', background: 'rgba(34,211,138,0.08)', borderRadius: '2px', border: '1px solid rgba(34,211,138,0.15)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#22d38a', display: 'flex' }}>{Icon && <Icon size={10} />}</span> <span style={{ color: '#94a3b8' }}>{n.effect}</span>
              </div>
            )})}
          </div>
        </div>
      )}
    </>
  )
}
