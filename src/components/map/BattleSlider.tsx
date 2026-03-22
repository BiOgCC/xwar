import { useState } from 'react'
import { useBattleStore } from '../../stores/battleStore'
import { useBountyStore, getMomentumStatus } from '../../stores/bountyStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/battle-slider.css'

function fmtDmg(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n}`
}

const RANK_BADGE: Record<string, string> = { grunt: '🔹', elite: '⭐', boss: '💀' }

const INITIAL_VISIBLE = 2

export default function BattleSlider() {
  const battles = useBattleStore(s => s.battles)
  const countries = useWorldStore(s => s.countries)
  const raidEvents = useBountyStore(s => s.raidEvents)
  const setActivePanel = useUIStore(s => s.setActivePanel)
  const setBountyDefaultTab = useUIStore(s => s.setBountyDefaultTab)
  const [expanded, setExpanded] = useState(false)

  const activeBattles = Object.values(battles).filter(b => b.status === 'active')
  const activeRaids = raidEvents.filter(e => e.status === 'active')

  // Combine all cards
  const allCards = [
    ...activeRaids.map(evt => ({ type: 'raid' as const, evt })),
    ...activeBattles.map(battle => ({ type: 'battle' as const, battle })),
  ]

  if (allCards.length === 0) return null

  const alwaysVisible = allCards.slice(0, INITIAL_VISIBLE)
  const hiddenCards = allCards.slice(INITIAL_VISIBLE)
  const hiddenCount = hiddenCards.length

  const renderCard = (card: typeof allCards[number]) => {
    if (card.type === 'raid') {
      const evt = card.evt
      const momPct = Math.round(evt.momentum * 100)
      const status = getMomentumStatus(evt.momentum, evt.bossStaggered)
      const totalPot = evt.baseBounty + evt.supportPool

      return (
        <div
          key={evt.id}
          className={`battle-slider__card battle-slider__card--bounty battle-slider__card--bounty-${evt.rank}`}
          onClick={() => { setBountyDefaultTab('npc_hunts'); setActivePanel('bounty') }}
        >
          <div className="battle-slider__flags">
            <span className="battle-slider__npc-badge">{RANK_BADGE[evt.rank] || '🔹'}</span>
            <span className="battle-slider__npc-name">{evt.name}</span>
            <CountryFlag iso={evt.countryCode} size={16} />
          </div>
          <div className="battle-slider__region" style={{ color: status.color }}>
            ⚔️ {status.label}
          </div>
          {/* Momentum bar instead of HP bar */}
          <div className="battle-slider__bar battle-slider__bar--momentum">
            <div
              className="battle-slider__bar-fill battle-slider__bar-fill--boss"
              style={{ width: `${100 - momPct}%` }}
            />
            <div
              className="battle-slider__bar-fill battle-slider__bar-fill--hunter"
              style={{ width: `${momPct}%` }}
            />
          </div>
          <div className="battle-slider__dmg">
            <span className="battle-slider__dmg-atk" style={{ color: '#22c55e' }}>
              {momPct}%
            </span>
            <span className="battle-slider__dmg-def" style={{ color: '#f59e0b' }}>
              {fmtMoney(totalPot)} POT
            </span>
          </div>
        </div>
      )
    }

    // Regular battle card
    const battle = card.battle
    const atkClr = countries.find(c => c.code === battle.attackerId)?.color || '#3b82f6'
    const defClr = countries.find(c => c.code === battle.defenderId)?.color || '#ef4444'
    const atkDmg = battle.attacker.damageDealt || 0
    const defDmg = battle.defender.damageDealt || 0
    const totalDmg = atkDmg + defDmg
    const atkPct = totalDmg > 0 ? (atkDmg / totalDmg) * 100 : 50

    const activeRd = battle.rounds[battle.rounds.length - 1]
    const rdAtkPts = activeRd?.attackerPoints || 0
    const rdDefPts = activeRd?.defenderPoints || 0
    const isHot = Math.max(rdAtkPts, rdDefPts) >= 450

    return (
      <div
        key={battle.id}
        className={`battle-slider__card${isHot ? ' battle-slider__card--hot' : ''}`}
        style={{ '--atk-clr': atkClr, '--def-clr': defClr } as React.CSSProperties}
        onClick={() => setActivePanel('combat')}
      >
        <div className="battle-slider__flags">
          <span className="battle-slider__score battle-slider__score--atk">
            {battle.attackerRoundsWon}
          </span>
          <CountryFlag iso={battle.attackerId} size={20} />
          <span className="battle-slider__vs">VS</span>
          <CountryFlag iso={battle.defenderId} size={20} />
          <span className="battle-slider__score battle-slider__score--def">
            {battle.defenderRoundsWon}
          </span>
        </div>
        <div className="battle-slider__region">
          ⚔️ {battle.regionName}
        </div>
        <div className="battle-slider__bar">
          <div
            className="battle-slider__bar-fill"
            style={{
              width: `${atkPct}%`,
              background: `linear-gradient(90deg, ${atkClr}88, ${atkClr})`,
            }}
          />
        </div>
        <div className="battle-slider__dmg">
          <span className="battle-slider__dmg-atk">{fmtDmg(atkDmg)}</span>
          <span className="battle-slider__dmg-def">{fmtDmg(defDmg)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`battle-slider ${expanded ? 'battle-slider--expanded' : ''}`}>
      <div className="battle-slider__grid">
        {alwaysVisible.map(renderCard)}

        {expanded && hiddenCards.map(renderCard)}

        {hiddenCount > 0 && (
          <button
            className="battle-slider__expand"
            onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev) }}
          >
            {expanded ? '◀ LESS' : `+${hiddenCount}`}
          </button>
        )}
      </div>
    </div>
  )
}
