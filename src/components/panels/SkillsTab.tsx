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
                <div className="skill-row__info">
                  <span className="skill-row__name">{s.label}</span>
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
                <div className="skill-row__info">
                  <span className="skill-row__name">{s.label}</span>
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
