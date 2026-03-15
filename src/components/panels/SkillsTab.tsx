import { usePlayerStore } from '../../stores/playerStore'
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

  const getMilValue = (key: string, level: number) => {
    switch (key) {
      case 'attack': return `${100 + level * 20}`
      case 'critRate': return `${10 + level * 5}%`
      case 'critDamage': return `${100 + level * 20}%`
      case 'precision': return `${Math.min(100, 50 + level * 5)}%`
      case 'stamina': return `${100 + level * 20}`
      case 'hunger': return `${5 + level * 1}`
      case 'armor': return `${0 + level * 5}%`
      case 'dodge': return `${5 + level * 5}%`
      default: return ''
    }
  }

  const getEcoValue = (key: string, level: number) => {
    switch (key) {
      case 'work': return `${100 + level * 20}`
      case 'entrepreneurship': return `${100 + level * 15}`
      case 'production': return `${10 + level * 5}`
      case 'prospection': return `${10 + level * 5}%`
      case 'industrialist': return `${10 + level * 5}%`
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
      </div>
    </div>
  )
}
