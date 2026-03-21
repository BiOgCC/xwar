// ══════════════════════════════════════════════════════════════
// DETERMINISTIC FLOW SIMULATOR — Combat (Expected Values)
// Every battle produces identical results given same inputs.
// ══════════════════════════════════════════════════════════════

import { computeExpectedDPS, computeExpectedDamageReceived, DIVISION_TEMPLATES, AVG_STAR_MODS } from './data'
import type { PlayerCombatStats, DivisionType, StarModifiers } from './data'
import type { SimDivision, SimBattleResult } from './types'

const MAX_BATTLE_TICKS = 60

/**
 * Deterministic battle simulation.
 * Each tick: compute expected DPS for each side → distribute proportionally → subtract HP.
 * No dice rolls. Outcome is mathematically determined.
 */
export function simulateBattle(
  attackerDivs: SimDivision[],
  defenderDivs: SimDivision[],
  attackerStats: PlayerCombatStats,
  defenderStats: PlayerCombatStats,
  attackerCountry: string,
  defenderCountry: string,
): SimBattleResult {
  // Work on copies
  const atkDivs = attackerDivs.map(d => ({ ...d }))
  const defDivs = defenderDivs.map(d => ({ ...d }))

  let atkTotalDmg = 0, defTotalDmg = 0
  const divPerf = new Map<string, { type: DivisionType; damageDealt: number; survived: boolean; killCount: number }>()
  ;[...atkDivs, ...defDivs].forEach(d => {
    divPerf.set(d.id, { type: d.type, damageDealt: 0, survived: true, killCount: 0 })
  })

  let tick = 0
  for (; tick < MAX_BATTLE_TICKS; tick++) {
    const aliveAtk = atkDivs.filter(d => d.status !== 'destroyed')
    const aliveDef = defDivs.filter(d => d.status !== 'destroyed')
    if (aliveAtk.length === 0 || aliveDef.length === 0) break

    // ── Attacker expected total DPS this tick ──
    let atkTickDPS = 0
    aliveAtk.forEach(div => {
      const template = DIVISION_TEMPLATES[div.type]
      if (!template) return
      const dps = computeExpectedDPS(
        attackerStats, template, div.starModifiers,
        div.manpower, div.health / div.maxHealth, div.experience,
      )
      atkTickDPS += dps
      div.totalDamageDealt += dps
      divPerf.get(div.id)!.damageDealt += dps
    })

    // Distribute attacker damage to defenders proportionally
    if (aliveDef.length > 0 && atkTickDPS > 0) {
      const rawPerDiv = Math.floor((atkTickDPS * 0.8) / aliveDef.length)
      aliveDef.forEach(d => {
        const template = DIVISION_TEMPLATES[d.type]
        if (!template) return
        const received = computeExpectedDamageReceived(rawPerDiv, defenderStats, template, d.starModifiers)
        d.health = Math.max(0, d.health - received)
        if (d.health <= 0) { d.status = 'destroyed'; divPerf.get(d.id)!.survived = false }
      })
    }
    atkTotalDmg += atkTickDPS

    // ── Defender expected total DPS this tick ──
    const stillAliveDef = defDivs.filter(d => d.status !== 'destroyed')
    let defTickDPS = 0
    stillAliveDef.forEach(div => {
      const template = DIVISION_TEMPLATES[div.type]
      if (!template) return
      const dps = computeExpectedDPS(
        defenderStats, template, div.starModifiers,
        div.manpower, div.health / div.maxHealth, div.experience,
      )
      defTickDPS += dps
      div.totalDamageDealt += dps
      divPerf.get(div.id)!.damageDealt += dps
    })

    // Distribute defender damage to attackers
    const stillAliveAtk = atkDivs.filter(d => d.status !== 'destroyed')
    if (stillAliveAtk.length > 0 && defTickDPS > 0) {
      const rawPerDiv = Math.floor((defTickDPS * 0.8) / stillAliveAtk.length)
      stillAliveAtk.forEach(d => {
        const template = DIVISION_TEMPLATES[d.type]
        if (!template) return
        const received = computeExpectedDamageReceived(rawPerDiv, attackerStats, template, d.starModifiers)
        d.health = Math.max(0, d.health - received)
        if (d.health <= 0) { d.status = 'destroyed'; divPerf.get(d.id)!.survived = false }
      })
    }
    defTotalDmg += defTickDPS

    // XP gain (deterministic: fixed 0.5 per tick)
    ;[...atkDivs, ...defDivs].filter(d => d.status !== 'destroyed').forEach(d => {
      d.experience = Math.min(100, d.experience + 0.5)
    })
  }

  // Determine winner
  const atkAlive = atkDivs.filter(d => d.status !== 'destroyed')
  const defAlive = defDivs.filter(d => d.status !== 'destroyed')
  const atkLost = atkDivs.filter(d => d.status === 'destroyed').length
  const defLost = defDivs.filter(d => d.status === 'destroyed').length

  let winner: 'attacker' | 'defender' | 'draw' = 'draw'
  if (atkAlive.length > 0 && defAlive.length === 0) winner = 'attacker'
  else if (defAlive.length > 0 && atkAlive.length === 0) winner = 'defender'
  else if (atkTotalDmg > defTotalDmg * 1.2) winner = 'attacker'
  else if (defTotalDmg > atkTotalDmg * 1.2) winner = 'defender'

  // Kill credit (deterministic: equal split)
  if (winner === 'attacker' && defLost > 0) {
    const credit = Math.ceil(defLost / Math.max(1, atkAlive.length))
    atkAlive.forEach(d => { divPerf.get(d.id)!.killCount += credit })
  } else if (winner === 'defender' && atkLost > 0) {
    const credit = Math.ceil(atkLost / Math.max(1, defAlive.length))
    defAlive.forEach(d => { divPerf.get(d.id)!.killCount += credit })
  }

  // Apply back to originals
  attackerDivs.forEach((orig, i) => {
    orig.health = atkDivs[i].health; orig.status = atkDivs[i].status
    orig.experience = atkDivs[i].experience; orig.totalDamageDealt += atkDivs[i].totalDamageDealt
    if (atkDivs[i].status !== 'destroyed') orig.battlesSurvived++
  })
  defenderDivs.forEach((orig, i) => {
    orig.health = defDivs[i].health; orig.status = defDivs[i].status
    orig.experience = defDivs[i].experience; orig.totalDamageDealt += defDivs[i].totalDamageDealt
    if (defDivs[i].status !== 'destroyed') orig.battlesSurvived++
  })

  return {
    attackerCountry, defenderCountry, winner,
    attackerDivsBefore: attackerDivs.length, defenderDivsBefore: defenderDivs.length,
    attackerDivsLost: atkLost, defenderDivsLost: defLost,
    attackerDamageDealt: atkTotalDmg, defenderDamageDealt: defTotalDmg,
    ticks: tick, divisionPerformance: divPerf,
  }
}
