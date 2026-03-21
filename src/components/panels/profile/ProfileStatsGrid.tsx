import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useSkillsStore } from '../../../stores/skillsStore'
import { usePrestigeStore } from '../../../stores/prestigeStore'

/** Military + Economic stats grid */
export default function ProfileStatsGrid() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const skillsStore = useSkillsStore()
  const prestigeStore = usePrestigeStore()

  // Equipment Stats
  const equipped = inventory.getEquipped()
  let eqDmg = 0, eqCritRate = 0, eqCritDmg = 0, eqArmor = 0, eqDodge = 0, eqPrecision = 0
  equipped.forEach((item: any) => {
    if (item.stats.damage) eqDmg += item.stats.damage
    if (item.stats.critRate) eqCritRate += item.stats.critRate
    if (item.stats.critDamage) eqCritDmg += item.stats.critDamage
    if (item.stats.armor) eqArmor += item.stats.armor
    if (item.stats.dodge) eqDodge += item.stats.dodge
    if (item.stats.precision) eqPrecision += item.stats.precision
  })

  const equippedPrestige = prestigeStore.items.find((i: any) => i.equipped && i.craftedBy === player.name)
  if (equippedPrestige) {
    const ps = equippedPrestige.bonusStats
    if (ps.damage) eqDmg += ps.damage
    if (ps.critRate || ps.crit_rate) eqCritRate += (ps.critRate || ps.crit_rate)
    if (ps.critDamage || ps.crit_damage) eqCritDmg += (ps.critDamage || ps.crit_damage)
    if (ps.armor) eqArmor += ps.armor
    if (ps.dodge) eqDodge += ps.dodge
    if (ps.precision) eqPrecision += ps.precision
  }

  // Ammo bonuses
  const ammoMultipliers: Record<string, { dmg: number; crit: number; label: string }> = {
    none:   { dmg: 1.0,  crit: 0, label: 'None' },
    green:  { dmg: 1.1,  crit: 0, label: '+10% DMG' },
    blue:   { dmg: 1.2,  crit: 0, label: '+20% DMG' },
    purple: { dmg: 1.4,  crit: 0, label: '+40% DMG' },
    red:    { dmg: 1.4, crit: 10, label: '+40% DMG +10% CRIT' },
  }
  const ammoBonus = ammoMultipliers[player.equippedAmmo] || ammoMultipliers.none

  // Military Skills
  const mil = skillsStore.military
  const baseDmg       = 100 + eqDmg      + mil.attack * 20
  const finalDmg      = Math.floor(baseDmg * ammoBonus.dmg)
  const rawCritDmg    = eqCritDmg  + mil.critDamage * 20
  const finalCritMult = 1.5 + rawCritDmg / 200
  const finalArmor    = 0   + eqArmor    + mil.armor * 5
  const armorMitPct   = finalArmor / (finalArmor + 100) * 100
  const finalDodge    = 5   + eqDodge    + mil.dodge * 3
  const rawHitRate    = 50  + eqPrecision + mil.precision * 5
  const finalHitRate  = Math.min(90, rawHitRate)
  const overflowCrit  = Math.max(0, rawHitRate - 90) * 0.5
  const finalCritRate = 10  + eqCritRate  + mil.critRate * 5 + ammoBonus.crit + overflowCrit

  // Economic Skills
  const eco = skillsStore.economic
  const finalProd     = 10  + eco.production * 5
  const finalWork     = 100 + eco.work * 20
  const finalEnt      = 100 + eco.entrepreneurship * 15
  const finalProspect = eco.prospection * 5
  const finalInd      = eco.industrialist * 5

  return (
    <div className="ptab-stats-duo">
      {/* MILITARY */}
      <div className="ptab-stat-panel ptab-stat-panel--mil">
        <div className="ptab-stat-panel__hdr">
          <span className="ptab-stat-panel__icon">⚔️</span>
          <span>MILITARY</span>
        </div>
        {[
          { label: 'Attack Damage',      val: `${finalDmg}${ammoBonus.dmg > 1 ? ` (\u00d7${ammoBonus.dmg})` : ''}`, color: '#f87171' },
          { label: 'Crit Rate',          val: `${finalCritRate.toFixed(1)}%${ammoBonus.crit > 0 ? ' (+ammo)' : ''}${overflowCrit > 0 ? ` (+${overflowCrit.toFixed(0)} ovf)` : ''}`, color: '#fb923c' },
          { label: 'Crit Multiplier',    val: `${finalCritMult.toFixed(2)}x`, color: '#fb923c' },
          { label: 'Armor Mitigation',   val: `${finalArmor} (${armorMitPct.toFixed(1)}%)`,   color: '#94a3b8' },
          { label: 'Evasion Dodge',      val: `${finalDodge}%`,   color: '#34d399' },
          { label: 'Hit Rate',           val: `${finalHitRate}%${rawHitRate > 90 ? ' (capped)' : ''}`, color: '#fbbf24' },
          { label: 'Ammo Bonus',         val: ammoBonus.label,    color: player.equippedAmmo === 'none' ? '#475569' : '#fbbf24' },
          { label: 'Stamina Cap',        val: `${player.maxStamina}`, color: '#f87171' },
          { label: 'Hunger Cap',         val: `${player.maxHunger}`,  color: '#f59e0b' },
          { label: 'Loot / Hit',         val: '7% (Acc)',         color: '#22d38a' },
        ].map(r => (
          <div key={r.label} className="ptab-stat-row">
            <span className="ptab-stat-row__label">{r.label}</span>
            <span className="ptab-stat-row__val" style={{ color: r.color }}>{r.val}</span>
          </div>
        ))}
      </div>

      {/* ECONOMIC */}
      <div className="ptab-stat-panel ptab-stat-panel--eco">
        <div className="ptab-stat-panel__hdr">
          <span className="ptab-stat-panel__icon">💼</span>
          <span>ECONOMIC</span>
        </div>
        {[
          { label: 'Production PP',   val: `${finalProd} pts`, color: '#38bdf8' },
          { label: 'Work Capacity',   val: `${finalWork} pts`, color: '#38bdf8' },
          { label: 'Enterprise Cap',  val: `${finalEnt} pts`,  color: '#c084fc' },
          { label: 'Prospect Chance', val: `${finalProspect}%`,color: '#38bdf8' },
          { label: 'Industrialist',   val: `${finalInd}%`,     color: '#fbbf24' },
        ].map(r => (
          <div key={r.label} className="ptab-stat-row">
            <span className="ptab-stat-row__label">{r.label}</span>
            <span className="ptab-stat-row__val" style={{ color: r.color }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
