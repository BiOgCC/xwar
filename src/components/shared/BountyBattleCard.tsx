import { useState, useEffect } from 'react'
import { useBountyStore, getMomentumStatus, type RaidBossEvent } from '../../stores/bountyStore'
import { usePlayerStore } from '../../stores/playerStore'
import CountryFlag from './CountryFlag'

/* ══════════════════════════════════════════════
   XWAR — Bounty Battle Card v2
   Momentum-based UI for Raid Boss system
   ══════════════════════════════════════════════ */

const RANK_CFG: Record<string, { label: string; color: string; glow: string; badge: string }> = {
  grunt:  { label: 'GRUNT',  color: '#94a3b8', glow: 'rgba(148,163,184,0.3)', badge: '🔹' },
  elite:  { label: 'ELITE',  color: '#f59e0b', glow: 'rgba(245,158,11,0.4)',  badge: '⭐' },
  boss:   { label: 'BOSS',   color: '#ef4444', glow: 'rgba(239,68,68,0.5)',   badge: '💀' },
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n}`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeRemaining(expiresAt: number): string {
  const diff = expiresAt - Date.now()
  if (diff <= 0) return 'ENDED'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

const FUND_AMOUNTS = [500, 1_000, 5_000, 10_000, 50_000]

interface BountyBattleCardProps {
  event: RaidBossEvent
  compact?: boolean
}

export default function BountyBattleCard({ event, compact = false }: BountyBattleCardProps) {
  const player = usePlayerStore()
  const attackRaidBoss = useBountyStore(s => s.attackRaidBoss)
  const fundRaidBoss = useBountyStore(s => s.fundRaidBoss)
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')
  const [isAttacking, setIsAttacking] = useState(false)
  const [showFund, setShowFund] = useState(false)
  const [fundAmount, setFundAmount] = useState(1_000)
  const [, forceUpdate] = useState(0)

  // Re-render every second for timer countdown
  useEffect(() => {
    if (event.status !== 'active') return
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000)
    return () => clearInterval(interval)
  }, [event.status])

  const rank = RANK_CFG[event.rank] || RANK_CFG.grunt
  const status = getMomentumStatus(event.momentum, event.bossStaggered)
  const totalPot = event.baseBounty + event.supportPool
  const isEnded = event.status !== 'active'

  // Player's current side
  const isFighter = !!event.fighters[player.name]
  const isSupporter = !!event.supporters[player.name]
  const myDmg = event.fighters[player.name]?.totalDmg || 0
  const myFunded = event.supporters[player.name]?.totalFunded || 0

  // Recent tick data for wave chart (last 20)
  const ticks = event.tickHistory.slice(-20)

  // Top fighters
  const topFighters = Object.entries(event.fighters)
    .sort((a, b) => b[1].totalDmg - a[1].totalDmg)
    .slice(0, 5)
  const totalFighterDmg = Object.values(event.fighters).reduce((s, f) => s + f.totalDmg, 0)

  // Top supporters
  const topSupporters = Object.entries(event.supporters)
    .sort((a, b) => b[1].totalFunded - a[1].totalFunded)
    .slice(0, 5)

  const showFeedback = (msg: string, type: 'success' | 'error') => {
    setFeedback(msg)
    setFeedbackType(type)
    setTimeout(() => setFeedback(''), 4000)
  }

  const handleAttack = async () => {
    if (isAttacking) return
    setIsAttacking(true)
    const result = await attackRaidBoss(event.id)
    showFeedback(result.message, result.success ? 'success' : 'error')
    setTimeout(() => setIsAttacking(false), 300)
  }

  const handleFund = async () => {
    const result = await fundRaidBoss(event.id, fundAmount)
    showFeedback(result.message, result.success ? 'success' : 'error')
  }

  // Who's winning the race?
  const hunterLeads = event.totalHunterDmg > event.totalBossDmg
  const leadGap = Math.abs(event.totalHunterDmg - event.totalBossDmg)

  // ── Compact mode: for slider cards ──
  if (compact) {
    return (
      <div className="bounty-bc bounty-bc--compact" style={{ '--rank-clr': rank.color, '--rank-glow': rank.glow } as React.CSSProperties}>
        <div className="bounty-bc__header">
          <span className="bounty-bc__rank-badge">{rank.badge}</span>
          <span className="bounty-bc__name">{event.name}</span>
          <CountryFlag iso={event.countryCode} size={14} />
        </div>
        <div className="bounty-bc__race-mini">
          <span style={{ color: '#22c55e' }}>⚔️ {fmtNum(event.totalHunterDmg)}</span>
          <span className="bounty-bc__timer">⏱ {timeRemaining(event.expiresAt)}</span>
          <span style={{ color: '#3b82f6' }}>💰 {fmtNum(event.totalBossDmg)}</span>
        </div>
        <div className="bounty-bc__money-row">
          <span className="bounty-bc__money">{fmtMoney(totalPot)}</span>
          <span className="bounty-bc__status-label" style={{ color: status.color }}>{status.label}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bounty-bc ${isEnded ? 'bounty-bc--dead' : ''}`}
      style={{ '--rank-clr': rank.color, '--rank-glow': rank.glow } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <div className="bounty-bc__header">
        <div className="bounty-bc__identity">
          <span className="bounty-bc__rank-badge">{rank.badge}</span>
          <span className="bounty-bc__name">{event.name}</span>
          <span className="bounty-bc__rank-label" style={{ color: rank.color }}>{rank.label}</span>
        </div>
        <div className="bounty-bc__location">
          <CountryFlag iso={event.countryCode} size={18} />
        </div>
      </div>

      {/* ── End status ── */}
      {isEnded && (
        <div className={`bounty-bc__end-status bounty-bc__end-status--${event.status}`}>
          {event.status === 'hunters_win' && '💀 TIME\'S UP — HUNTERS WIN x2!'}
          {event.status === 'boss_survives' && '💰 TIME\'S UP — ECO WINS x2!'}
          {event.status === 'boss_dominates' && '💰 TIME\'S UP — ECO DOMINATES!'}
        </div>
      )}

      {/* ── Countdown Timer (big, central) ── */}
      {!isEnded && (
        <div className="bounty-bc__countdown">
          ⏱ {timeRemaining(event.expiresAt)}
        </div>
      )}

      {/* ── Damage Race Scoreboard ── */}
      <div className="bounty-bc__race-board">
        <div className={`bounty-bc__race-side bounty-bc__race-side--hunter ${hunterLeads ? 'bounty-bc__race-side--leading' : ''}`}>
          <div className="bounty-bc__race-label">⚔️ HUNTERS</div>
          <div className="bounty-bc__race-dmg">{fmtNum(event.totalHunterDmg)}</div>
        </div>
        <div className="bounty-bc__race-vs">
          <span style={{ color: status.color, fontWeight: 900 }}>{status.label}</span>
          <span className="bounty-bc__race-gap">Δ {fmtNum(leadGap)}</span>
        </div>
        <div className={`bounty-bc__race-side bounty-bc__race-side--eco ${!hunterLeads && event.totalBossDmg > 0 ? 'bounty-bc__race-side--leading' : ''}`}>
          <div className="bounty-bc__race-label">💰 ECO</div>
          <div className="bounty-bc__race-dmg">{fmtNum(event.totalBossDmg)}</div>
        </div>
      </div>

      {/* ── Pot ── */}
      <div className="bounty-bc__money-section">
        <div className="bounty-bc__money-counter">
          <span className="bounty-bc__money-icon">💰</span>
          <span className="bounty-bc__money-value">{fmtMoney(totalPot)}</span>
          <span className="bounty-bc__money-total">JACKPOT · Winner takes x2</span>
        </div>
      </div>

      {/* ── Top Fighters ── */}
      {topFighters.length > 0 && (
        <div className="bounty-bc__contributors">
          <div className="bounty-bc__contrib-title">⚔️ TOP FIGHTERS — {fmtNum(totalFighterDmg)} total dmg</div>
          {topFighters.map(([name, data]) => {
            const pct = totalFighterDmg > 0 ? ((data.totalDmg / totalFighterDmg) * 100).toFixed(1) : '0'
            const isMe = name === player.name
            return (
              <div key={name} className={`bounty-bc__contrib-row ${isMe ? 'bounty-bc__contrib-row--me' : ''}`}>
                <span className="bounty-bc__contrib-name">{isMe ? `⭐ ${name}` : name}</span>
                <span className="bounty-bc__contrib-dmg">{fmtNum(data.totalDmg)} dmg</span>
                <span className="bounty-bc__contrib-pct" style={{ color: isMe ? '#22c55e' : '#94a3b8' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Top Supporters ── */}
      {topSupporters.length > 0 && (
        <div className="bounty-bc__contributors bounty-bc__supporters-section">
          <div className="bounty-bc__contrib-title">🛡️ TOP SUPPORTERS — {fmtMoney(event.supportPool)} POOL</div>
          {topSupporters.map(([name, data]) => {
            const isMe = name === player.name
            return (
              <div key={name} className={`bounty-bc__contrib-row ${isMe ? 'bounty-bc__contrib-row--me-support' : ''}`}>
                <span className="bounty-bc__contrib-name">{isMe ? `⭐ ${name}` : name}</span>
                <span className="bounty-bc__contrib-dmg">{fmtMoney(data.totalFunded)}</span>
                <span className="bounty-bc__contrib-pct" style={{ color: isMe ? '#3b82f6' : '#94a3b8' }}>→ {fmtMoney(data.totalFunded * 2)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Action Buttons — Battle Card Style ── */}
      {!isEnded && (
        <div className="bounty-bc__actions">
          {/* ── HUNTERS: Attack with stamina ── */}
          {!isSupporter ? (
            <button
              className={`bounty-bc__attack ${isAttacking ? 'bounty-bc__attack--cooldown' : ''} ${isFighter ? 'bounty-bc__attack--committed' : ''}`}
              onClick={handleAttack}
              disabled={player.stamina < 5 || isAttacking}
              title={player.stamina < 5 ? 'Need 5 stamina' : 'Attack this boss'}
            >
              {isAttacking ? '⚡ ATTACKING...' : `⚔️ ATTACK (5 STA)${isFighter ? ` · ${fmtNum(myDmg)} dmg` : ''}`}
            </button>
          ) : (
            <button className="bounty-bc__attack bounty-bc__attack--locked" disabled>
              ⚔️ LOCKED (You're supporting)
            </button>
          )}

          {/* ── ECO: Hit with money → x2 boss damage ── */}
          {!isFighter ? (
            <button
              className={`bounty-bc__fund-hit ${isSupporter ? 'bounty-bc__fund-hit--committed' : ''}`}
              onClick={handleFund}
              disabled={player.money < fundAmount}
              title={`Spend ${fmtMoney(fundAmount)} → ${fmtMoney(fundAmount * 2)} boss dmg`}
            >
              💰 HIT {fmtMoney(fundAmount)} → x2 DMG{isSupporter ? ` · ${fmtMoney(myFunded)}` : ''}
            </button>
          ) : (
            <button className="bounty-bc__fund-hit bounty-bc__fund-hit--locked" disabled>
              💰 LOCKED (You're fighting)
            </button>
          )}
        </div>
      )}

      {/* ── Quick-bet amount selector (only for eco side) ── */}
      {!isEnded && !isFighter && (
        <div className="bounty-bc__bet-pills">
          {FUND_AMOUNTS.map(a => (
            <button
              key={a}
              className={`bounty-bc__bet-pill ${fundAmount === a ? 'bounty-bc__bet-pill--active' : ''}`}
              onClick={() => setFundAmount(a)}
            >
              {fmtMoney(a)}
            </button>
          ))}
        </div>
      )}

      {/* ── My commitment badge ── */}
      {(isFighter || isSupporter) && (
        <div className={`bounty-bc__my-side ${isFighter ? 'bounty-bc__my-side--fighter' : 'bounty-bc__my-side--supporter'}`}>
          {isFighter
            ? `⚔️ FIGHTER · ${fmtNum(myDmg)} dmg dealt`
            : `💰 SUPPORTER · ${fmtMoney(myFunded)} bet → ${fmtMoney(myFunded * 2)} if survives`
          }
        </div>
      )}

      {/* ── Feedback ── */}
      {feedback && (
        <div className={`bounty-bc__feedback bounty-bc__feedback--${feedbackType}`}>
          {feedback}
        </div>
      )}
    </div>
  )
}
