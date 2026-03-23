/**
 * XWAR -- Division Combat Simulation (Mirror Match)
 * 
 * Standalone test: both sides have identical composition & levels.
 * Runs N battles and reports win rates, damage, and comeback events.
 * 
 * Usage:  npx tsx test_combat_sim.ts
 */

// -- Inline types (no store dependencies) --

interface PlayerCombatStats {
  attackDamage: number
  critRate: number
  critMultiplier: number
  armorBlock: number
  dodgeChance: number
  hitRate: number
}

interface SimDivision {
  id: string
  name: string
  type: string
  health: number
  maxHealth: number
  manpower: number
  experience: number
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  dodgeMult: number
  armorMult: number
  attackSpeed: number
  cooldown: number
  status: 'alive' | 'destroyed'
}

interface SimResult {
  winner: 'attacker' | 'defender' | 'draw'
  ticks: number
  atkDmgTotal: number
  defDmgTotal: number
  atkDivsDestroyed: number
  defDivsDestroyed: number
  atkRoundsWon: number
  defRoundsWon: number
  desperationProcs: number
  vengeanceProcs: number
  comebackWin: boolean
}

// -- Templates (matching game data) --

const TEMPLATES: Record<string, {
  name: string; atkDmgMult: number; hitRate: number; critRateMult: number
  critDmgMult: number; healthMult: number; dodgeMult: number; armorMult: number
  attackSpeed: number; manpower: number
}> = {
  recon:   { name: 'Recon',   atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 1.50, healthMult: 24.0, dodgeMult: 1.30, armorMult: 1.30, attackSpeed: 1.5, manpower: 200 },
  assault: { name: 'Assault', atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 1.60, healthMult: 28.8, dodgeMult: 0.90, armorMult: 1.30, attackSpeed: 1.0, manpower: 350 },
  sniper:  { name: 'Sniper',  atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.30, critDmgMult: 2.50, healthMult: 24.0, dodgeMult: 1.60, armorMult: 1.20, attackSpeed: 0.6, manpower: 150 },
  rpg:     { name: 'RPG',     atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 2.00, healthMult: 30.0, dodgeMult: 0.70, armorMult: 1.30, attackSpeed: 0.8, manpower: 250 },
  tank:    { name: 'Tank',    atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 1.80, healthMult: 36.0, dodgeMult: 0.80, armorMult: 2.00, attackSpeed: 0.5, manpower: 200 },
  jet:     { name: 'Jet',     atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.40, critDmgMult: 2.80, healthMult: 26.0, dodgeMult: 1.40, armorMult: 1.20, attackSpeed: 0.7, manpower: 100 },
}

// -- Config --

const NUM_BATTLES          = 1000
const POINTS_TO_WIN_ROUND  = 600
const ROUNDS_TO_WIN_BATTLE = 2
const MAX_TICKS_PER_ROUND  = 600

const SKILL_LEVEL          = 5
const ARMY_COMPOSITION     = ['assault', 'assault', 'sniper', 'tank']
const DIV_EXPERIENCE       = 50

// Comeback mechanic toggles
const ENABLE_DESPERATION   = true
const ENABLE_VENGEANCE     = true
const VENGEANCE_DURATION   = 3
const DESPERATION_THRESHOLD = 0.30

// -- Pure helpers --

function deviate(v: number): number {
  return v * (0.9 + Math.random() * 0.2)
}

function makePlayerStats(): PlayerCombatStats {
  return {
    attackDamage: 100 + SKILL_LEVEL * 20,
    critRate: 10 + SKILL_LEVEL * 5,
    critMultiplier: 1.5 + (SKILL_LEVEL * 20) / 200,
    armorBlock: SKILL_LEVEL * 5,
    dodgeChance: 5 + SKILL_LEVEL * 3,
    hitRate: Math.min(90, 50 + SKILL_LEVEL * 5),
  }
}

function makeDivision(type: string, side: string, index: number): SimDivision {
  const t = TEMPLATES[type]
  const maxStamina = 100
  return {
    id: `${side}_${type}_${index}`,
    name: `${side.toUpperCase()} ${t.name} #${index + 1}`,
    type,
    health: Math.floor(t.healthMult * maxStamina),
    maxHealth: Math.floor(t.healthMult * maxStamina),
    manpower: t.manpower,
    experience: DIV_EXPERIENCE,
    atkDmgMult: t.atkDmgMult,
    hitRate: t.hitRate,
    critRateMult: t.critRateMult,
    critDmgMult: t.critDmgMult,
    dodgeMult: t.dodgeMult,
    armorMult: t.armorMult,
    attackSpeed: t.attackSpeed,
    cooldown: 0,
    status: 'alive',
  }
}

function resetDivisions(divs: SimDivision[]) {
  for (const d of divs) {
    d.health = d.maxHealth
    d.status = 'alive'
    d.cooldown = 0
  }
}

// -- Simulation Engine --

function simulateBattle(): SimResult {
  const ps = makePlayerStats()
  const atkDivs = ARMY_COMPOSITION.map((type, i) => makeDivision(type, 'atk', i))
  const defDivs = ARMY_COMPOSITION.map((type, i) => makeDivision(type, 'def', i))

  let atkRoundsWon = 0, defRoundsWon = 0, totalTicks = 0
  let atkDmgTotal = 0, defDmgTotal = 0
  let desperationProcs = 0, vengeanceProcs = 0
  let maxAtkLead = 0, maxDefLead = 0

  while (atkRoundsWon < ROUNDS_TO_WIN_BATTLE && defRoundsWon < ROUNDS_TO_WIN_BATTLE) {
    let atkPoints = 0, defPoints = 0, roundTicks = 0
    resetDivisions(atkDivs)
    resetDivisions(defDivs)
    let atkVengeanceUntil = -1, defVengeanceUntil = -1

    while (atkPoints < POINTS_TO_WIN_ROUND && defPoints < POINTS_TO_WIN_ROUND && roundTicks < MAX_TICKS_PER_ROUND) {
      totalTicks++
      roundTicks++

      const aliveAtk = atkDivs.filter(d => d.status === 'alive')
      const aliveDef = defDivs.filter(d => d.status === 'alive')

      // -- ATTACKER DAMAGE --
      let atkTickDmg = 0
      for (const div of aliveAtk) {
        const divLevel = Math.floor(div.experience / 10)
        const hpRatio = div.health / div.maxHealth
        const isDesperate = ENABLE_DESPERATION && hpRatio < DESPERATION_THRESHOLD
        if (isDesperate) desperationProcs++
        const hasVengeance = ENABLE_VENGEANCE && atkVengeanceUntil >= totalTicks
        if (hasVengeance) vengeanceProcs++

        div.cooldown += 1.0
        while (div.cooldown >= div.attackSpeed) {
          div.cooldown -= div.attackSpeed

          let effectiveHit = Math.min(0.95, div.hitRate + divLevel * 0.01)
          if (hasVengeance) effectiveHit = Math.min(0.95, effectiveHit + 0.10)
          if (Math.random() > effectiveHit) continue

          let dmg = Math.floor((ps.attackDamage + div.manpower * 3) * (div.atkDmgMult + divLevel * 0.01))

          let effectiveCritRate = deviate(ps.critRate * (div.critRateMult + divLevel * 0.01))
          if (isDesperate) effectiveCritRate *= 1.15
          if (Math.random() * 100 < effectiveCritRate) {
            dmg = Math.floor(dmg * ps.critMultiplier * (div.critDmgMult + divLevel * 0.01))
          }

          dmg = Math.floor(dmg * hpRatio)
          if (isDesperate) dmg = Math.floor(dmg * 1.25)
          if (hasVengeance) dmg = Math.floor(dmg * 1.20)
          dmg = Math.floor(deviate(dmg))
          atkTickDmg += Math.max(1, dmg)
        }
      }

      // -- DEFENDER DAMAGE --
      let defTickDmg = 0
      for (const div of aliveDef) {
        const divLevel = Math.floor(div.experience / 10)
        const hpRatio = div.health / div.maxHealth
        const isDesperate = ENABLE_DESPERATION && hpRatio < DESPERATION_THRESHOLD
        if (isDesperate) desperationProcs++
        const hasVengeance = ENABLE_VENGEANCE && defVengeanceUntil >= totalTicks
        if (hasVengeance) vengeanceProcs++

        div.cooldown += 1.0
        while (div.cooldown >= div.attackSpeed) {
          div.cooldown -= div.attackSpeed

          let effectiveHit = Math.min(0.95, div.hitRate + divLevel * 0.01)
          if (hasVengeance) effectiveHit = Math.min(0.95, effectiveHit + 0.10)
          if (Math.random() > effectiveHit) continue

          let dmg = Math.floor((ps.attackDamage + div.manpower * 3) * (div.atkDmgMult + divLevel * 0.01))

          let effectiveCritRate = deviate(ps.critRate * (div.critRateMult + divLevel * 0.01))
          if (isDesperate) effectiveCritRate *= 1.15
          if (Math.random() * 100 < effectiveCritRate) {
            dmg = Math.floor(dmg * ps.critMultiplier * (div.critDmgMult + divLevel * 0.01))
          }

          dmg = Math.floor(dmg * hpRatio)
          if (isDesperate) dmg = Math.floor(dmg * 1.25)
          if (hasVengeance) dmg = Math.floor(dmg * 1.20)
          dmg = Math.floor(deviate(dmg))
          defTickDmg += Math.max(1, dmg)
        }
      }

      atkDmgTotal += atkTickDmg
      defDmgTotal += defTickDmg

      // -- APPLY DAMAGE to defender divisions --
      if (aliveDef.length > 0 && atkTickDmg > 0) {
        const dmgPerDiv = Math.max(1, Math.floor(atkTickDmg * 0.80 / aliveDef.length))
        for (const div of aliveDef) {
          const dodgeChance = deviate(ps.dodgeChance * div.dodgeMult) / 100
          if (Math.random() < dodgeChance) continue

          const armor = ps.armorBlock * div.armorMult * (ENABLE_DESPERATION && (div.health / div.maxHealth < DESPERATION_THRESHOLD) ? 0.90 : 1.0)
          const mit = armor / (armor + 100)
          let finalDmg = Math.max(1, Math.floor(dmgPerDiv * (1 - mit)))
          finalDmg = Math.max(1, Math.floor(finalDmg / 1.35))

          div.health = Math.max(0, div.health - finalDmg)
          if (div.health <= 0) {
            div.status = 'destroyed'
            if (ENABLE_VENGEANCE) defVengeanceUntil = totalTicks + VENGEANCE_DURATION
          }
        }
      }

      // -- APPLY DAMAGE to attacker divisions --
      if (aliveAtk.length > 0 && defTickDmg > 0) {
        const dmgPerDiv = Math.max(1, Math.floor(defTickDmg * 0.80 / aliveAtk.length))
        for (const div of aliveAtk) {
          const dodgeChance = deviate(ps.dodgeChance * div.dodgeMult) / 100
          if (Math.random() < dodgeChance) continue

          const armor = ps.armorBlock * div.armorMult * (ENABLE_DESPERATION && (div.health / div.maxHealth < DESPERATION_THRESHOLD) ? 0.90 : 1.0)
          const mit = armor / (armor + 100)
          let finalDmg = Math.max(1, Math.floor(dmgPerDiv * (1 - mit)))
          finalDmg = Math.max(1, Math.floor(finalDmg / 1.35))

          div.health = Math.max(0, div.health - finalDmg)
          if (div.health <= 0) {
            div.status = 'destroyed'
            if (ENABLE_VENGEANCE) atkVengeanceUntil = totalTicks + VENGEANCE_DURATION
          }
        }
      }

      // -- AWARD GROUND POINTS --
      const totalGP = atkPoints + defPoints
      const inc = totalGP < 100 ? 1 : totalGP < 200 ? 2 : totalGP < 300 ? 3 : totalGP < 400 ? 4 : 5

      if (atkTickDmg > 0 || defTickDmg > 0) {
        if (atkTickDmg > defTickDmg) atkPoints += inc
        else if (defTickDmg > atkTickDmg) defPoints += inc
        else {
          if (aliveAtk.length > aliveDef.length) atkPoints += inc
          else if (aliveDef.length > aliveAtk.length) defPoints += inc
          else if (Math.random() < 0.5) atkPoints += inc
          else defPoints += inc
        }
      } else if (aliveAtk.length > 0 && aliveDef.length === 0) {
        atkPoints += inc
      } else if (aliveDef.length > 0 && aliveAtk.length === 0) {
        defPoints += inc
      }

      maxAtkLead = Math.max(maxAtkLead, atkPoints - defPoints)
      maxDefLead = Math.max(maxDefLead, defPoints - atkPoints)
    }

    if (atkPoints >= POINTS_TO_WIN_ROUND) atkRoundsWon++
    else if (defPoints >= POINTS_TO_WIN_ROUND) defRoundsWon++
    else break
  }

  const winner = atkRoundsWon >= ROUNDS_TO_WIN_BATTLE ? 'attacker'
    : defRoundsWon >= ROUNDS_TO_WIN_BATTLE ? 'defender' : 'draw'

  const comebackWin = (winner === 'attacker' && maxDefLead >= 200)
    || (winner === 'defender' && maxAtkLead >= 200)

  return {
    winner, ticks: totalTicks,
    atkDmgTotal, defDmgTotal,
    atkDivsDestroyed: atkDivs.filter(d => d.status === 'destroyed').length,
    defDivsDestroyed: defDivs.filter(d => d.status === 'destroyed').length,
    atkRoundsWon, defRoundsWon,
    desperationProcs, vengeanceProcs, comebackWin,
  }
}

// -- Run Simulation --

const log = console.log

log('===========================================================')
log('  XWAR Division Combat Simulation -- Mirror Match')
log('===========================================================')
log('')
log('Config:')
log('  Battles:      ' + NUM_BATTLES)
log('  Composition:  ' + ARMY_COMPOSITION.join(', '))
log('  Div Level:    ' + Math.floor(DIV_EXPERIENCE / 10) + ' (' + DIV_EXPERIENCE + ' XP)')
log('  Skill Level:  ' + SKILL_LEVEL + ' (all skills)')
log('  Desperation:  ' + (ENABLE_DESPERATION ? 'ON (HP<30% -> +25%ATK +15%crit -10%armor)' : 'OFF'))
log('  Vengeance:    ' + (ENABLE_VENGEANCE ? 'ON (ally dies -> +20%ATK +10%hit 3 ticks)' : 'OFF'))
log('')

const results: SimResult[] = []
for (let i = 0; i < NUM_BATTLES; i++) results.push(simulateBattle())

// -- Aggregate --

const atkWins = results.filter(r => r.winner === 'attacker').length
const defWins = results.filter(r => r.winner === 'defender').length
const draws = results.filter(r => r.winner === 'draw').length
const avgTicks = results.reduce((s, r) => s + r.ticks, 0) / NUM_BATTLES
const avgAtkDmg = results.reduce((s, r) => s + r.atkDmgTotal, 0) / NUM_BATTLES
const avgDefDmg = results.reduce((s, r) => s + r.defDmgTotal, 0) / NUM_BATTLES
const avgAtkLoss = results.reduce((s, r) => s + r.atkDivsDestroyed, 0) / NUM_BATTLES
const avgDefLoss = results.reduce((s, r) => s + r.defDivsDestroyed, 0) / NUM_BATTLES
const totalDesp = results.reduce((s, r) => s + r.desperationProcs, 0)
const totalVeng = results.reduce((s, r) => s + r.vengeanceProcs, 0)
const comebacks = results.filter(r => r.comebackWin).length

log('-----------------------------------------------------------')
log('  WIN RATES')
log('-----------------------------------------------------------')
log('  Attacker:  ' + atkWins + ' wins (' + (atkWins / NUM_BATTLES * 100).toFixed(1) + '%)')
log('  Defender:  ' + defWins + ' wins (' + (defWins / NUM_BATTLES * 100).toFixed(1) + '%)')
log('  Draws:     ' + draws + ' (' + (draws / NUM_BATTLES * 100).toFixed(1) + '%)')
const bias = Math.abs(atkWins - defWins) / NUM_BATTLES * 100
log('  Fairness:  ' + (bias < 3 ? 'BALANCED' : bias < 8 ? 'SLIGHT BIAS' : 'IMBALANCED') + ' (' + bias.toFixed(1) + '% delta)')
log('')

log('-----------------------------------------------------------')
log('  DAMAGE')
log('-----------------------------------------------------------')
log('  Avg ATK dmg: ' + Math.floor(avgAtkDmg))
log('  Avg DEF dmg: ' + Math.floor(avgDefDmg))
log('  Dmg ratio:   ' + (avgAtkDmg / avgDefDmg).toFixed(3))
log('')

log('-----------------------------------------------------------')
log('  DIVISION LOSSES (per battle avg)')
log('-----------------------------------------------------------')
log('  Avg ATK divs destroyed: ' + avgAtkLoss.toFixed(2) + ' / ' + ARMY_COMPOSITION.length)
log('  Avg DEF divs destroyed: ' + avgDefLoss.toFixed(2) + ' / ' + ARMY_COMPOSITION.length)
log('')

log('-----------------------------------------------------------')
log('  BATTLE DURATION')
log('-----------------------------------------------------------')
log('  Avg ticks: ' + avgTicks.toFixed(1) + ' (~' + (avgTicks * 15 / 60).toFixed(1) + ' min)')
const buckets: Record<string, number> = { '<200': 0, '200-400': 0, '400-600': 0, '600-800': 0, '800+': 0 }
results.forEach(r => {
  if (r.ticks < 200) buckets['<200']++
  else if (r.ticks < 400) buckets['200-400']++
  else if (r.ticks < 600) buckets['400-600']++
  else if (r.ticks < 800) buckets['600-800']++
  else buckets['800+']++
})
for (const [b, c] of Object.entries(buckets)) {
  log('  ' + b.padEnd(8) + ' ' + '#'.repeat(Math.ceil(c / NUM_BATTLES * 40)) + ' ' + c)
}
log('')

log('-----------------------------------------------------------')
log('  COMEBACK MECHANICS')
log('-----------------------------------------------------------')
log('  DESPERATION procs:  ' + totalDesp + ' total (' + (totalDesp / NUM_BATTLES).toFixed(1) + ' avg/battle)')
log('  VENGEANCE procs:    ' + totalVeng + ' total (' + (totalVeng / NUM_BATTLES).toFixed(1) + ' avg/battle)')
log('  COMEBACK wins:      ' + comebacks + ' / ' + NUM_BATTLES + ' (' + (comebacks / NUM_BATTLES * 100).toFixed(1) + '%)')
log('')

log('-----------------------------------------------------------')
log('  DETERMINISM CHECK (10 sample battles)')
log('-----------------------------------------------------------')
const sample = results.slice(0, 10)
sample.forEach((r, i) => {
  const w = r.winner === 'attacker' ? 'ATK' : r.winner === 'defender' ? 'DEF' : 'DRW'
  const cb = r.comebackWin ? ' *COMEBACK*' : ''
  log('  #' + String(i + 1).padStart(2) + ' ' + w + '  ' + String(r.ticks).padStart(4) + ' ticks  ATK:' + String(r.atkDmgTotal).padStart(10) + '  DEF:' + String(r.defDmgTotal).padStart(10) + '  Lost:' + r.atkDivsDestroyed + '/' + r.defDivsDestroyed + cb)
})

const winnerSet = new Set(sample.map(r => r.winner))
const dmgArr = sample.map(r => r.atkDmgTotal)
const spread = ((Math.max(...dmgArr) - Math.min(...dmgArr)) / ((Math.max(...dmgArr) + Math.min(...dmgArr)) / 2) * 100)

log('')
log('  Winners vary: ' + (winnerSet.size > 1 ? 'YES (non-deterministic)' : 'NO (same winner)'))
log('  Damage spread: ' + spread.toFixed(1) + '% -> ' + (spread > 10 ? 'High variance' : 'Low variance'))
log('')
log('===========================================================')
