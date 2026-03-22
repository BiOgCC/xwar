import { useBattleStore, getCountryName } from '../../stores/battleStore'
import { useWorldStore } from '../../stores/worldStore'
import { useUIStore } from '../../stores/uiStore'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/battle-slider.css'

function fmtDmg(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function BattleSlider() {
  const battles = useBattleStore(s => s.battles)
  const countries = useWorldStore(s => s.countries)
  const setActivePanel = useUIStore(s => s.setActivePanel)

  const activeBattles = Object.values(battles).filter(b => b.status === 'active')

  if (activeBattles.length === 0) return null

  return (
    <div className="battle-slider">
      <div className="battle-slider__track">
        {activeBattles.map(battle => {
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
              {/* Flags + Score */}
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

              {/* Region */}
              <div className="battle-slider__region">
                ⚔️ {battle.regionName}
              </div>

              {/* Damage bar */}
              <div className="battle-slider__bar">
                <div
                  className="battle-slider__bar-fill"
                  style={{
                    width: `${atkPct}%`,
                    background: `linear-gradient(90deg, ${atkClr}88, ${atkClr})`,
                  }}
                />
              </div>

              {/* Damage numbers */}
              <div className="battle-slider__dmg">
                <span className="battle-slider__dmg-atk">{fmtDmg(atkDmg)}</span>
                <span className="battle-slider__dmg-def">{fmtDmg(defDmg)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
