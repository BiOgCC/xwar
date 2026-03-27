import { usePlayerStore } from '../../../stores/playerStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useSkillsStore } from '../../../stores/skillsStore'
import { usePrestigeStore } from '../../../stores/prestigeStore'
import { useBattleStore, TACTICAL_ORDERS } from '../../../stores/battleStore'
import type { TacticalOrder } from '../../../types/battle.types'

/** Military + Economic stats grid with per-source breakdowns */
export default function ProfileStatsGrid() {
  const player = usePlayerStore()
  const inventory = useInventoryStore()
  const skillsStore = useSkillsStore()
  const prestigeStore = usePrestigeStore()
  const battleStore = useBattleStore()

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

  // Find active tactical order for this player
  let activeOrder: TacticalOrder = 'none'
  const playerCountry = (player as any).countryCode || ''
  if (playerCountry) {
    const activeBattle = Object.values(battleStore.battles).find(b =>
      b.status === 'active' && (b.attackerId === playerCountry || b.defenderId === playerCountry)
    )
    if (activeBattle) {
      const isAttacker = activeBattle.attackerId === playerCountry
      activeOrder = isAttacker ? activeBattle.attackerOrder : activeBattle.defenderOrder
    }
  }
  const orderFx = TACTICAL_ORDERS[activeOrder || 'none'].effects
  const orderInfo = TACTICAL_ORDERS[activeOrder || 'none']
  const hasOrder = activeOrder !== 'none'

  // Compute individual stats with breakdowns
  const baseDmg       = 100
  const skillDmg      = mil.attack * 20
  const rawDmg        = baseDmg + skillDmg + eqDmg
  const finalDmg      = Math.floor(rawDmg * ammoBonus.dmg * orderFx.atkMult)

  const baseCritRate   = 10
  const skillCritRate  = mil.critRate * 5
  const rawCritRate    = baseCritRate + skillCritRate + eqCritRate + ammoBonus.crit
  const rawHitRate     = 50 + eqPrecision + mil.precision * 5
  const overflowCrit   = Math.max(0, rawHitRate - 90) * 0.5
  const finalCritRate  = rawCritRate + overflowCrit + orderFx.critBonus

  const baseCritDmg    = 1.5
  const skillCritDmg   = mil.critDamage * 20
  const rawCritMult    = baseCritDmg + (skillCritDmg + eqCritDmg) / 200
  const finalCritMult  = rawCritMult * orderFx.critDmgMult

  const baseArmor      = 0
  const skillArmor     = mil.armor * 5
  const rawArmor       = baseArmor + skillArmor + eqArmor
  const finalArmor     = Math.round(rawArmor * orderFx.armorMult)
  const armorMitPct    = finalArmor / (finalArmor + 100) * 100

  const baseDodge      = 5
  const skillDodge     = mil.dodge * 3
  const rawDodge       = baseDodge + skillDodge + eqDodge
  const finalDodge     = rawDodge * orderFx.dodgeMult

  const baseHitRate    = 50
  const skillHitRate   = mil.precision * 5
  const rawHit         = baseHitRate + skillHitRate + eqPrecision
  const finalHitRate   = Math.min(90, rawHit + orderFx.hitBonus * 100)

  // Economic Skills
  const eco = skillsStore.economic
  const finalProd     = 10  + eco.production * 5
  const finalWork     = 100 + eco.work * 20
  const finalEnt      = 100 + eco.entrepreneurship * 15
  const finalProspect = eco.prospection * 5
  const finalInd      = eco.industrialist

  // Source tag component
  const Src = ({ label, val, color }: { label: string; val: string; color: string }) => (
    <span style={{
      fontSize: '7px', fontWeight: 600, color, opacity: 0.9,
      display: 'inline-flex', alignItems: 'center', gap: '1px',
    }}>
      <span style={{ color: '#475569', fontSize: '6px' }}>{label}</span>{val}
    </span>
  )

  // Stat row with breakdown
  const StatRow = ({ label, val, color, breakdown }: {
    label: string; val: string; color: string
    breakdown?: { base?: string; skills?: string; items?: string; order?: string; ammo?: string }
  }) => (
    <div className="ptab-stat-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1px', padding: '4px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="ptab-stat-row__label">{label}</span>
        <span className="ptab-stat-row__val" style={{ color }}>{val}</span>
      </div>
      {breakdown && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '1px' }}>
          {breakdown.base && <Src label="Base " val={breakdown.base} color="#64748b" />}
          {breakdown.skills && <Src label="Skill " val={breakdown.skills} color="#a78bfa" />}
          {breakdown.items && <Src label="Items " val={breakdown.items} color="#22d38a" />}
          {breakdown.ammo && <Src label="Ammo " val={breakdown.ammo} color="#fbbf24" />}
          {breakdown.order && <Src label="Order " val={breakdown.order} color={orderInfo.color} />}
        </div>
      )}
    </div>
  )

  return (
    <div className="ptab-stats-duo">
      {/* MILITARY */}
      <div className="ptab-stat-panel ptab-stat-panel--mil">
        <div className="ptab-stat-panel__hdr">
          <span className="ptab-stat-panel__icon">⚔️</span>
          <span>MILITARY</span>
          {hasOrder && (
            <span style={{
              marginLeft: 'auto', fontSize: '7px', fontWeight: 800, letterSpacing: '0.06em',
              color: orderInfo.color, background: `${orderInfo.color}18`, padding: '2px 6px',
              borderRadius: '3px', border: `1px solid ${orderInfo.color}40`,
            }}>
              ⚡ {orderInfo.label}
            </span>
          )}
        </div>

        <StatRow label="Attack Damage" color="#f87171"
          val={`${finalDmg}${ammoBonus.dmg > 1 ? ` (×${ammoBonus.dmg})` : ''}`}
          breakdown={{
            base: '100',
            skills: mil.attack > 0 ? `+${skillDmg}` : undefined,
            items: eqDmg > 0 ? `+${eqDmg}` : undefined,
            ammo: ammoBonus.dmg > 1 ? `×${ammoBonus.dmg}` : undefined,
            order: hasOrder && orderFx.atkMult !== 1 ? `×${orderFx.atkMult}` : undefined,
          }}
        />

        <StatRow label="Crit Rate" color="#fb923c"
          val={`${finalCritRate.toFixed(1)}%`}
          breakdown={{
            base: '10%',
            skills: mil.critRate > 0 ? `+${skillCritRate}%` : undefined,
            items: eqCritRate > 0 ? `+${eqCritRate}%` : undefined,
            ammo: ammoBonus.crit > 0 ? `+${ammoBonus.crit}%` : undefined,
            order: hasOrder && orderFx.critBonus > 0 ? `+${orderFx.critBonus}%` : undefined,
          }}
        />

        <StatRow label="Crit Multiplier" color="#fb923c"
          val={`${finalCritMult.toFixed(2)}x`}
          breakdown={{
            base: '1.50x',
            skills: mil.critDamage > 0 ? `+${(skillCritDmg / 200).toFixed(2)}x` : undefined,
            items: eqCritDmg > 0 ? `+${(eqCritDmg / 200).toFixed(2)}x` : undefined,
            order: hasOrder && orderFx.critDmgMult !== 1 ? `×${orderFx.critDmgMult}` : undefined,
          }}
        />

        <StatRow label="Armor" color="#94a3b8"
          val={`${finalArmor} (${armorMitPct.toFixed(1)}% mit.)`}
          breakdown={{
            base: '0',
            skills: mil.armor > 0 ? `+${skillArmor}` : undefined,
            items: eqArmor > 0 ? `+${eqArmor}` : undefined,
            order: hasOrder && orderFx.armorMult !== 1 ? `×${orderFx.armorMult}` : undefined,
          }}
        />

        <StatRow label="Agility" color="#34d399"
          val={`${finalDodge.toFixed(1)}%`}
          breakdown={{
            base: '5%',
            skills: mil.dodge > 0 ? `+${skillDodge}%` : undefined,
            items: eqDodge > 0 ? `+${eqDodge}%` : undefined,
            order: hasOrder && orderFx.dodgeMult !== 1 ? `×${orderFx.dodgeMult}` : undefined,
          }}
        />

        <StatRow label="Hit Rate" color="#fbbf24"
          val={`${finalHitRate.toFixed(0)}%${rawHit > 90 ? ' (capped)' : ''}`}
          breakdown={{
            base: '50%',
            skills: mil.precision > 0 ? `+${skillHitRate}%` : undefined,
            items: eqPrecision > 0 ? `+${eqPrecision}%` : undefined,
            order: hasOrder && orderFx.hitBonus > 0 ? `+${(orderFx.hitBonus * 100).toFixed(0)}%` : undefined,
          }}
        />

        <StatRow label="Ammo Bonus" color={player.equippedAmmo === 'none' ? '#475569' : '#fbbf24'}
          val={ammoBonus.label}
        />

        <StatRow label="Stamina Cap" color="#f87171"
          val={`${player.maxStamina}`}
          breakdown={{
            base: '120',
            skills: mil.stamina > 0 ? `+${mil.stamina * 24}` : undefined,
          }}
        />

        <StatRow label="Hunger Cap" color="#f59e0b"
          val={`${player.maxHunger}`}
          breakdown={{
            base: '6',
            skills: mil.hunger > 0 ? `+${mil.hunger}` : undefined,
          }}
        />
      </div>

      {/* ECONOMIC */}
      <div className="ptab-stat-panel ptab-stat-panel--eco">
        <div className="ptab-stat-panel__hdr">
          <span className="ptab-stat-panel__icon">💼</span>
          <span>ECONOMIC</span>
        </div>
        {[
          { label: 'Production PP',   val: `${finalProd} pts`,
            breakdown: { base: '10', skills: eco.production > 0 ? `+${eco.production * 5}` : undefined } },
          { label: 'Work Capacity',   val: `${finalWork} pts`,
            breakdown: { base: '100', skills: eco.work > 0 ? `+${eco.work * 20}` : undefined } },
          { label: 'Enterprise Cap',  val: `${finalEnt} pts`,
            breakdown: { base: '100', skills: eco.entrepreneurship > 0 ? `+${eco.entrepreneurship * 15}` : undefined } },
          { label: 'Prospect Chance', val: `${finalProspect}%`,
            breakdown: { base: '0%', skills: eco.prospection > 0 ? `+${eco.prospection * 5}%` : undefined } },
          { label: 'Industrialist',   val: `${finalInd}% scrap (${finalInd > 0 ? 100 + finalInd * 50 : 0}) | ${finalInd * 2}% 🔴`,
            breakdown: { base: '0', skills: eco.industrialist > 0 ? `+${eco.industrialist}` : undefined } },
        ].map(r => (
          <StatRow key={r.label} label={r.label} val={r.val}
            color={r.label === 'Industrialist' ? '#fbbf24' : r.label === 'Enterprise Cap' ? '#c084fc' : '#38bdf8'}
            breakdown={r.breakdown as any}
          />
        ))}
      </div>
    </div>
  )
}
