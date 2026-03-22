import { usePlayerStore } from '../../stores/playerStore'
import { useWorldStore } from '../../stores/worldStore'
import { getCatchUpXPMultiplier } from '../../engine/catchup'
import {
  useSkillsStore,
  MILITARY_SKILLS,
  ECONOMIC_SKILLS,
  type MilitarySkill,
  type EconomicSkill,
} from '../../stores/skillsStore'

export default function SkillsTab() {
  const player = usePlayerStore()
  const skills = useSkillsStore()
  const catchUpMult = getCatchUpXPMultiplier(player.level, useWorldStore.getState().serverMedianLevel)
  const catchUpActive = catchUpMult > 1.0

  const getMilValue = (key: string, level: number) => {
    switch (key) {
      case 'attack': return `${100 + level * 20}`
      case 'critRate': return `${10 + level * 5}%`
      case 'critDamage': return `${(1.5 + (level * 20) / 200).toFixed(2)}x`
      case 'precision': {
        const raw = 50 + level * 5
        const capped = Math.min(90, raw)
        const overflow = Math.max(0, raw - 90) * 0.5
        return `${capped}%${overflow > 0 ? ` +${overflow.toFixed(0)}% crit` : ''}`
      }
      case 'stamina': return `${100 + level * 20}`
      case 'hunger': return `${5 + level * 1}`
      case 'armor': {
        const armor = level * 5
        const mitigation = armor / (armor + 100)
        return `${armor} (${(mitigation * 100).toFixed(1)}%)`
      }
      case 'dodge': return `${5 + level * 3}%`
      default: return ''
    }
  }

  const getEcoValue = (key: string, level: number) => {
    switch (key) {
      case 'work': return `${100 + level * 20}`
      case 'entrepreneurship': return `${100 + level * 15}`
      case 'production': return `+${20 + level * 2} fill`
      case 'prospection': return `${level * 3}%`
      case 'industrialist': return `${level}% 🔧scrap | ${level * 2}% 🔴bullet`
      default: return ''
    }
  }

  return (
    <div className="skills-tab">
      {/* Skill Points Header */}
      <div className="skills-sp">
        <span className="skills-sp__icon">⭐</span>
        <span className="skills-sp__label">Available Skill Points</span>
        <span className="skills-sp__value">{player.skillPoints}</span>
        {catchUpActive && (
          <span style={{
            fontSize: '8px', fontWeight: 700, color: '#22d38a',
            background: 'rgba(34, 211, 138, 0.12)', border: '1px solid rgba(34, 211, 138, 0.3)',
            borderRadius: '4px', padding: '2px 6px', marginLeft: '6px', whiteSpace: 'nowrap',
            textShadow: '0 0 6px rgba(34, 211, 138, 0.4)',
          }}>
            🚀 +{Math.round((catchUpMult - 1) * 100)}% XP BOOST
          </span>
        )}
      </div>

      {/* Military Doctrine */}
      <div className="skills-tree">
        <div className="skills-tree__header skills-tree__header--mil">
          <span>⚔️</span> MILITARY DOCTRINE
        </div>
        <div className="skills-list">
          {MILITARY_SKILLS.map((s) => {
            const level = skills.military[s.key]
            const cost = skills.getSkillCost(level)
            const canAssign = level < 10 && player.skillPoints >= cost
            return (
              <div key={s.key} className="skill-row">
                <span className="skill-row__icon">{s.icon}</span>
                <div className="skill-row__info" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="skill-row__name">{s.label}</span>
                    <span style={{ fontSize: '10px', color: '#22d38a', fontWeight: 'bold', marginLeft: '8px' }}>{getMilValue(s.key, level)}</span>
                  </div>
                  <span className="skill-row__desc">{s.desc}</span>
                </div>
                <div className="skill-row__dots">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={`skill-dot ${i < level ? 'skill-dot--filled skill-dot--mil' : ''}`}
                    />
                  ))}
                </div>
                <span className="skill-row__level">{level}/10</span>
                <button
                  className="skill-row__btn skill-row__btn--mil"
                  disabled={!canAssign}
                  onClick={() => skills.assignSkillPoint('military', s.key)}
                  title={level >= 10 ? 'MAX' : `Cost: ${cost} SP`}
                >
                  {level >= 10 ? '✓' : `+${cost}`}
                </button>
              </div>
            )
          })}
        </div>
        <button
          className="skill-row__btn skill-row__btn--mil"
          style={{ width: '100%', marginTop: '8px', padding: '6px 0', fontSize: '11px', opacity: 0.8 }}
          onClick={() => { if (confirm('Reset all Military skills? Costs 50,000 gold. All SP will be refunded.')) skills.resetSkills('military') }}
        >
          🔄 Reset Military (50k)
        </button>
      </div>

      {/* Economic Theory */}
      <div className="skills-tree">
        <div className="skills-tree__header skills-tree__header--eco">
          <span>💼</span> ECONOMIC THEORY
        </div>
        <div className="skills-list">
          {ECONOMIC_SKILLS.map((s) => {
            const level = skills.economic[s.key]
            const cost = skills.getSkillCost(level)
            const canAssign = level < 10 && player.skillPoints >= cost
            return (
              <div key={s.key} className="skill-row">
                <span className="skill-row__icon">{s.icon}</span>
                <div className="skill-row__info" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="skill-row__name">{s.label}</span>
                    <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 'bold', marginLeft: '8px' }}>{getEcoValue(s.key, level)}</span>
                  </div>
                  <span className="skill-row__desc">{s.desc}</span>
                </div>
                <div className="skill-row__dots">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={`skill-dot ${i < level ? 'skill-dot--filled skill-dot--eco' : ''}`}
                    />
                  ))}
                </div>
                <span className="skill-row__level">{level}/10</span>
                <button
                  className="skill-row__btn skill-row__btn--eco"
                  disabled={!canAssign}
                  onClick={() => skills.assignSkillPoint('economic', s.key)}
                  title={level >= 10 ? 'MAX' : `Cost: ${cost} SP`}
                >
                  {level >= 10 ? '✓' : `+${cost}`}
                </button>
              </div>
            )
          })}
        </div>
        <button
          className="skill-row__btn skill-row__btn--eco"
          style={{ width: '100%', marginTop: '8px', padding: '6px 0', fontSize: '11px', opacity: 0.8 }}
          onClick={() => { if (confirm('Reset all Economic skills? Costs 50,000 gold. All SP will be refunded.')) skills.resetSkills('economic') }}
        >
          🔄 Reset Economic (50k)
        </button>
      </div>
    </div>
  )
}
