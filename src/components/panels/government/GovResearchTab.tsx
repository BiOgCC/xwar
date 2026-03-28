import { useState, useEffect } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGovernmentStore } from '../../../stores/governmentStore'
import { useUIStore } from '../../../stores/uiStore'
import { useResearchStore, MILITARY_DOCTRINE, ECONOMIC_THEORY, type ResearchNode, type ActiveResearch } from '../../../stores/researchStore'
import { Microscope, BarChart2, Sword, CircleDollarSign, Check, Medal, ClipboardList, Castle, Target, Skull, Zap, Flame, Hammer, Ship, Landmark, Factory, Package, Star, Users, ChevronRight, FlaskConical } from 'lucide-react'

const ICON_MAP: Record<string, React.FC<any>> = {
  medal: Medal, clipboard: ClipboardList, castle: Castle, crosshair: Target, skull: Skull, zap: Zap, flame: Flame, hammer: Hammer, ship: Ship, landmark: Landmark, factory: Factory, coins: CircleDollarSign, package: Package, star: Star
}

// ====== RESEARCH TREE LIST ======

interface TreeListProps {
  title: string
  icon: React.ReactNode
  color: string
  nodes: ResearchNode[]
  unlocked: string[]
  activeNode: string | null
  activeRp: number
  canSelect: (nodeId: string) => boolean
  onSelect: (nodeId: string) => void
  isPresident: boolean
}

function ResearchTreeList({ title, icon, color, nodes, unlocked, activeNode, activeRp, canSelect, onSelect, isPresident }: TreeListProps) {
  return (
    <div className="gov-section" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="gov-section__title" style={{ color, display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon} {title} ({unlocked.length}/{nodes.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {nodes.map((node, i) => {
          const isUnlocked = unlocked.includes(node.id)
          const isActive = activeNode === node.id
          const canDo = canSelect(node.id)
          const prevUnlocked = i === 0 || unlocked.includes(nodes[i - 1].id)
          const isLocked = !isUnlocked && !isActive && !prevUnlocked
          const NodeIcon = ICON_MAP[node.icon]
          const progress = isActive ? Math.min(100, Math.round((activeRp / node.rpRequired) * 100)) : 0

          return (
            <div key={node.id} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px',
              background: isActive ? `${color}08` : isUnlocked ? 'rgba(34,211,138,0.04)' : 'rgba(0,0,0,0.25)',
              borderRadius: '4px',
              border: isActive ? `1px solid ${color}40` : isUnlocked ? '1px solid rgba(34,211,138,0.15)' : '1px solid rgba(255,255,255,0.03)',
              opacity: isLocked ? 0.4 : 1,
            }}>
              {/* Icon */}
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isUnlocked ? `${color}20` : isActive ? `${color}15` : 'rgba(255,255,255,0.04)',
                border: isUnlocked ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
              }}>
                {isUnlocked
                  ? <Check size={12} color={color} />
                  : NodeIcon ? <NodeIcon size={12} color={isActive ? color : '#64748b'} /> : null
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: isUnlocked ? color : '#e2e8f0' }}>{node.name}</div>
                <div style={{ fontSize: '7px', color: '#64748b' }}>{node.effect}</div>

                {/* RP Progress Bar */}
                {isActive && (
                  <div style={{ marginTop: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', marginBottom: '2px' }}>
                      <span style={{ color: color, fontWeight: 700 }}>{activeRp} / {node.rpRequired} RP</span>
                      <span style={{ color: '#64748b' }}>{progress}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${progress}%`, borderRadius: '2px',
                        background: `linear-gradient(90deg, ${color}80, ${color})`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                )}

                {/* Not active, not unlocked — show RP requirement */}
                {!isActive && !isUnlocked && !isLocked && (
                  <div style={{ fontSize: '7px', color: '#475569', marginTop: '1px' }}>{node.rpRequired} RP needed</div>
                )}
              </div>

              {/* Select Button */}
              {canDo && (
                <button onClick={() => onSelect(node.id)} style={{
                  padding: '3px 8px', fontSize: '7px', fontWeight: 700, borderRadius: '3px', cursor: 'pointer',
                  background: isPresident ? `${color}12` : 'rgba(255,255,255,0.03)',
                  color: isPresident ? color : '#64748b',
                  border: `1px solid ${isPresident ? `${color}40` : 'rgba(255,255,255,0.1)'}`,
                  display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0,
                  opacity: isPresident ? 1 : 0.7,
                }}>
                  <ChevronRight size={10} /> START
                </button>
              )}

              {/* Unlocked badge */}
              {isUnlocked && (
                <div style={{ fontSize: '7px', fontWeight: 700, color, flexShrink: 0 }}>✓</div>
              )}
            </div>
          )
        })}
      </div>
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

  useEffect(() => {
    researchStore.fetchResearch(iso)
  }, [iso])

  if (!gov) return null

  const research = researchStore.getResearch(iso)
  const active = researchStore.getActive(iso)
  const totalRp = researchStore.getTotalRp(iso)
  const completedCount = research.military.length + research.economy.length
  const totalNodes = MILITARY_DOCTRINE.length + ECONOMIC_THEORY.length

  const handleSelect = async (tree: 'military' | 'economy', nodeId: string) => {
    const result = await researchStore.selectResearch(iso, tree, nodeId)
    const color = result.success ? '#22d38a' : '#ef4444'
    ui.addFloatingText(result.message, window.innerWidth / 2, window.innerHeight / 2, color)
    // If successful, refresh research state
    if (result.success) {
      researchStore.fetchResearch(iso)
    }
  }

  return (
    <>
      {/* Active Research Banner */}
      {active && (
        <div className="gov-section gov-section--highlight" style={{ borderLeft: '3px solid #a78bfa' }}>
          <div className="gov-section__title" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Microscope size={14} /> ACTIVE RESEARCH
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>
                {[...MILITARY_DOCTRINE, ...ECONOMIC_THEORY].find(n => n.id === active.nodeId)?.name || active.nodeId}
              </div>
              <div style={{ fontSize: '8px', color: '#64748b' }}>
                {active.tree === 'military' ? '⚔️ Military' : '💰 Economic'} · Citizens contribute RP by playing
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#a78bfa', fontFamily: 'var(--font-display)' }}>
                {Math.round((active.rpCollected / active.rpRequired) * 100)}%
              </div>
            </div>
          </div>

          {/* Big progress bar */}
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{
              height: '100%', borderRadius: '4px',
              width: `${Math.min(100, Math.round((active.rpCollected / active.rpRequired) * 100))}%`,
              background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
              transition: 'width 0.5s',
              boxShadow: '0 0 8px rgba(139,92,246,0.4)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px' }}>
            <span style={{ color: '#a78bfa', fontWeight: 700 }}>{active.rpCollected} / {active.rpRequired} RP</span>
            <span style={{ color: '#64748b' }}>{Object.keys(active.contributors || {}).length} contributors</span>
          </div>

          {/* Top contributors */}
          {Object.keys(active.contributors || {}).length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Users size={10} /> Top Contributors
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {Object.entries(active.contributors)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .slice(0, 8)
                  .map(([name, rp]) => (
                    <div key={name} style={{
                      padding: '2px 5px', fontSize: '7px', borderRadius: '3px',
                      background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
                      color: '#a78bfa',
                    }}>
                      {name}: <strong>{rp as number}</strong>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No active research notice */}
      {!active && (
        <div style={{ padding: '8px 10px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '4px', fontSize: '9px', color: '#a78bfa', textAlign: 'center' }}>
          {isPresident
            ? '🔬 Select a research node below to start. Citizens will contribute RP through gameplay.'
            : '🔬 No active research. The President must select a node to begin.'}
        </div>
      )}

      {/* Research Points Pool */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(34,211,138,0.06) 100%)',
        border: '1px solid rgba(139,92,246,0.2)', borderRadius: '6px',
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(139,92,246,0.15)', border: '2px solid rgba(139,92,246,0.3)', flexShrink: 0,
        }}>
          <FlaskConical size={16} color="#a78bfa" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Country Research Points
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 900, color: '#a78bfa', fontFamily: 'var(--font-display)' }}>
              {totalRp.toLocaleString()}
            </span>
            <span style={{ fontSize: '8px', color: '#64748b' }}>RP contributed</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#22d38a', fontFamily: 'var(--font-display)' }}>
            {completedCount}/{totalNodes}
          </div>
          <div style={{ fontSize: '7px', color: '#64748b' }}>researched</div>
        </div>
      </div>

      {/* How RP Works */}
      <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '7px', color: '#64748b', lineHeight: '1.5' }}>
        <strong style={{ color: '#94a3b8' }}>How Research Points work:</strong> Citizens earn RP through gameplay — fighting (+3), working (+2), producing (+2), donating (+3). The president selects which tech to research, and all citizens collectively fill the progress bar.
      </div>

      {/* Military Tree */}
      <ResearchTreeList
        title="MILITARY DOCTRINE"
        icon={<Sword size={14} />}
        color="#ef4444"
        nodes={MILITARY_DOCTRINE}
        unlocked={research.military}
        activeNode={active?.tree === 'military' ? active.nodeId : null}
        activeRp={active?.tree === 'military' ? active.rpCollected : 0}
        canSelect={(id) => researchStore.canSelect(iso, 'military', id)}
        onSelect={(id) => handleSelect('military', id)}
        isPresident={isPresident}
      />

      {/* Economy Tree */}
      <ResearchTreeList
        title="ECONOMIC THEORY"
        icon={<CircleDollarSign size={14} />}
        color="#22d38a"
        nodes={ECONOMIC_THEORY}
        unlocked={research.economy}
        activeNode={active?.tree === 'economy' ? active.nodeId : null}
        activeRp={active?.tree === 'economy' ? active.rpCollected : 0}
        canSelect={(id) => researchStore.canSelect(iso, 'economy', id)}
        onSelect={(id) => handleSelect('economy', id)}
        isPresident={isPresident}
      />

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
              )
            })}
            {ECONOMIC_THEORY.filter(n => research.economy.includes(n.id)).map(n => {
              const Icon = ICON_MAP[n.icon]
              return (
                <div key={n.id} style={{ padding: '3px 5px', background: 'rgba(34,211,138,0.08)', borderRadius: '2px', border: '1px solid rgba(34,211,138,0.15)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#22d38a', display: 'flex' }}>{Icon && <Icon size={10} />}</span> <span style={{ color: '#94a3b8' }}>{n.effect}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
