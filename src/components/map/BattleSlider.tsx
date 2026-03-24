import { useState } from 'react'
import { useBattleStore } from '../../stores/battleStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/battle-slider.css'

function fmtDmg(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const INITIAL_VISIBLE = 2

export default function BattleSlider() {
  const battles = useBattleStore(s => s.battles)
  const countries = useWorldStore(s => s.countries)
  const setActivePanel = useUIStore(s => s.setActivePanel)
  const [expanded, setExpanded] = useState(false)

  const activeBattles = Object.values(battles).filter(b => b.status === 'active')

  if (activeBattles.length === 0) return null

  const alwaysVisible = activeBattles.slice(0, INITIAL_VISIBLE)
  const hiddenCards = activeBattles.slice(INITIAL_VISIBLE)
  const hiddenCount = hiddenCards.length

  const renderCard = (battle: typeof activeBattles[number]) => {
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
