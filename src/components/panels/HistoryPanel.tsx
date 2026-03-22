import { useState } from 'react'
import { useHistoryStore, type WarHistoryEntry } from '../../stores/historyStore'
import CountryFlag from '../shared/CountryFlag'

type Filter = 'all' | 'won' | 'lost'

function formatDuration(start: number, end: number): string {
  const ms = end - start
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

function formatDamage(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

const OUTCOME_LABELS: Record<WarHistoryEntry['outcome'], { label: string; color: string; icon: string }> = {
  attacker_won: { label: 'ATTACKER WON', color: '#22d38a', icon: '🏆' },
  defender_won: { label: 'DEFENDER WON', color: '#ef4444', icon: '🛡️' },
  ceasefire: { label: 'CEASEFIRE', color: '#f59e0b', icon: '🕊️' },
  draw: { label: 'DRAW', color: '#64748b', icon: '⚖️' },
}

export default function HistoryPanel() {
  const warHistory = useHistoryStore((s) => s.warHistory)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = filter === 'all'
    ? warHistory
    : warHistory.filter((h) => {
        // "won" / "lost" from player (US) perspective
        if (filter === 'won') return (h.attacker === 'US' && h.outcome === 'attacker_won') || (h.defender === 'US' && h.outcome === 'defender_won')
        return (h.attacker === 'US' && h.outcome === 'defender_won') || (h.defender === 'US' && h.outcome === 'attacker_won')
      })

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Filter tabs */}
      <div className="hud-card" style={{ display: 'flex', gap: '4px', padding: '8px' }}>
        {(['all', 'won', 'lost'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1, padding: '6px', fontSize: '10px', cursor: 'pointer',
              borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700,
              letterSpacing: '0.1em', fontFamily: 'var(--font-display)',
              border: `1px solid ${filter === f ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
              background: filter === f ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: filter === f ? '#60a5fa' : 'rgba(255,255,255,0.5)',
            }}
          >
            {f === 'all' ? `ALL (${warHistory.length})` : f === 'won' ? '🏆 WON' : '💀 LOST'}
          </button>
        ))}
      </div>

      {/* History entries */}
      {filtered.length === 0 ? (
        <div className="hud-card" style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>No war history available</div>
        </div>
      ) : (
        filtered.map((entry) => {
          const info = OUTCOME_LABELS[entry.outcome]
          const isExpanded = expanded === entry.id
          return (
            <div key={entry.id} className="hud-card" style={{ cursor: 'pointer', marginBottom: '4px' }} onClick={() => setExpanded(isExpanded ? null : entry.id)}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CountryFlag iso={entry.attacker} size={18} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{entry.attackerName}</span>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>vs</span>
                <CountryFlag iso={entry.defender} size={18} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{entry.defenderName}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '9px', letterSpacing: '0.08em', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, background: `${info.color}15`, color: info.color, border: `1px solid ${info.color}30` }}>
                  {info.icon} {info.label}
                </span>
              </div>

              {/* Date + duration */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                <span>📅 {new Date(entry.startedAt).toLocaleDateString()}</span>
                <span>⏱️ {formatDuration(entry.startedAt, entry.endedAt)}</span>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Damage bars */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                      <span style={{ color: '#3b82f6' }}>⚔️ {entry.attackerName}: {formatDamage(entry.attackerDamage)}</span>
                      <span style={{ color: '#ef4444' }}>🛡️ {entry.defenderName}: {formatDamage(entry.defenderDamage)}</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${(entry.attackerDamage / Math.max(1, entry.attackerDamage + entry.defenderDamage)) * 100}%`, background: '#3b82f6', borderRadius: '2px' }} />
                      <div style={{ flex: 1, background: '#ef4444', borderRadius: '2px' }} />
                    </div>
                  </div>
                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '16px', fontSize: '10px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>🗺️ Regions changed: <b style={{ color: '#f59e0b' }}>{entry.regionsChanged}</b></span>
                    {entry.mvpPlayer && <span style={{ color: 'rgba(255,255,255,0.5)' }}>⭐ MVP: <b style={{ color: '#22d38a' }}>{entry.mvpPlayer}</b></span>}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
