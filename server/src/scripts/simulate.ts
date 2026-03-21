// server/src/scripts/simulate.ts
// REGION COMBAT ONLY — No duels, no cyber. Real engine formulas.
export {}

// ====== DIVISION TEMPLATES (mirrors src/stores/army/types.ts) ======

const DIVISION_TEMPLATES: Record<string, any> = {
  recon:     { name: 'Recon Squad',      manpowerCost: 200, recruitCost: { money: 40000 },  atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 1.50, healthMult: 24.0, dodgeMult: 1.30, armorMult: 1.30, attackSpeed: 1.5 },
  assault:   { name: 'Assault',          manpowerCost: 350, recruitCost: { money: 60000 },  atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 1.60, healthMult: 28.8, dodgeMult: 0.90, armorMult: 1.30, attackSpeed: 1.0 },
  sniper:    { name: 'Sniper',           manpowerCost: 150, recruitCost: { money: 80000 },  atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.56, critDmgMult: 2.50, healthMult: 24.0, dodgeMult: 1.60, armorMult: 1.20, attackSpeed: 0.6 },
  rpg:       { name: 'RPG',              manpowerCost: 250, recruitCost: { money: 100000 }, atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 2.00, healthMult: 30.0, dodgeMult: 0.70, armorMult: 1.30, attackSpeed: 0.8 },
  jeep:      { name: 'Jeep',             manpowerCost: 150, recruitCost: { money: 100000 }, atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 1.70, healthMult: 30.0, dodgeMult: 1.50, armorMult: 1.50, attackSpeed: 1.3 },
  tank:      { name: 'Tank',             manpowerCost: 200, recruitCost: { money: 150000 }, atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 1.80, healthMult: 36.0, dodgeMult: 0.80, armorMult: 2.00, attackSpeed: 0.5 },
  jet:       { name: 'Jet',              manpowerCost: 100, recruitCost: { money: 200000 }, atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.75, critDmgMult: 2.80, healthMult: 26.0, dodgeMult: 1.40, armorMult: 1.20, attackSpeed: 0.7 },
  warship:   { name: 'Warship',          manpowerCost: 250, recruitCost: { money: 250000 }, atkDmgMult: 0.30, hitRate: 0.60, critRateMult: 1.35, critDmgMult: 2.20, healthMult: 40.0, dodgeMult: 0.70, armorMult: 2.50, attackSpeed: 0.4 },
  submarine: { name: 'Submarine',        manpowerCost: 300, recruitCost: { money: 300000 }, atkDmgMult: 0.35, hitRate: 0.85, critRateMult: 1.50, critDmgMult: 2.50, healthMult: 50.0, dodgeMult: 1.20, armorMult: 3.00, attackSpeed: 0.3 },
}

const divKeys = Object.keys(DIVISION_TEMPLATES)

// ====== ENGINE (same as src/engine/) ======

interface PlayerCombatStats {
  attackDamage: number; critRate: number; critMultiplier: number
  armorBlock: number; dodgeChance: number; hitRate: number
}

interface StarMods {
  atkDmgMult: number; hitRate: number; critRateMult: number; critDmgMult: number
  healthMult: number; dodgeMult: number; armorMult: number; attackSpeed: number
}

function deviate(v: number): number { return v * (0.9 + Math.random() * 0.2) }

function rollStarMods(): StarMods {
  const roll = () => 0.01 + Math.random() * 0.04
  return {
    atkDmgMult: roll(), hitRate: roll(), critRateMult: roll(), critDmgMult: roll(),
    healthMult: roll(), dodgeMult: roll(), armorMult: roll(), attackSpeed: roll(),
  }
}

function computePlayerCombatStats(skillLevel: number): PlayerCombatStats {
  return {
    attackDamage: 100 + skillLevel * 20,
    critRate: 10 + skillLevel * 5,
    critMultiplier: (100 + skillLevel * 20) / 100,
    armorBlock: skillLevel * 5,
    dodgeChance: 5 + skillLevel * 5,
    hitRate: Math.min(100, 50 + skillLevel * 5),
  }
}

function divisionAttackTick(
  pStats: PlayerCombatStats,
  div: { manpower: number; health: number; maxHealth: number; experience: number },
  tmpl: any, starMods: StarMods, cooldownAccum: number,
): [number, number] {
  const tAtkDmg = tmpl.atkDmgMult * (1 + starMods.atkDmgMult)
  const tHitRate = tmpl.hitRate * (1 + starMods.hitRate)
  const tCritRate = tmpl.critRateMult * (1 + starMods.critRateMult)
  const tCritDmg = tmpl.critDmgMult * (1 + starMods.critDmgMult)
  const tAtkSpeed = (tmpl.attackSpeed || 1.0) * (1 + starMods.attackSpeed)

  const as = tAtkSpeed
  cooldownAccum += 1.0
  let totalDmg = 0

  while (cooldownAccum >= as) {
    cooldownAccum -= as
    const divLevel = Math.floor((div.experience || 0) / 10)
    if (Math.random() > Math.min(0.95, tHitRate + divLevel * 0.01)) continue
    let dmg = Math.floor((pStats.attackDamage + div.manpower * 3) * (tAtkDmg + divLevel * 0.01))
    const effectiveCritRate = deviate(pStats.critRate * (tCritRate + divLevel * 0.01))
    if (Math.random() * 100 < effectiveCritRate) {
      const effectiveCritMult = pStats.critMultiplier * (tCritDmg + divLevel * 0.01)
      dmg = Math.floor(dmg * effectiveCritMult)
    }
    const strength = div.health / div.maxHealth
    dmg = Math.floor(dmg * strength)
    dmg = Math.floor(deviate(dmg))
    totalDmg += Math.max(1, dmg)
  }
  return [totalDmg, cooldownAccum]
}

function damageToDefender(rawDmg: number, pStats: PlayerCombatStats, tmpl: any): number {
  const dodgeChance = deviate((pStats.dodgeChance || 5) * tmpl.dodgeMult) / 100
  if (Math.random() < dodgeChance) return 0
  const armorReduction = Math.floor((pStats.armorBlock || 0) * tmpl.armorMult)
  let finalDmg = Math.max(1, rawDmg - armorReduction)
  finalDmg = Math.max(1, Math.floor(finalDmg / 1.35)) // healthMult divider at x1.35
  return finalDmg
}

// ====== CONFIG ======

const DAYS = 30
const USERS = 100
const WARS_PER_DAY = 3          // Average wars per day across 100 users
const PLAYERS_PER_SIDE = 6      // Each side has ~6 players with ~3 divisions
const DIVS_PER_PLAYER = 3
const TICKS_PER_WAR = 30        // A war lasts ~30 ticks (30 seconds)
const PLAYER_ATTACKS_PER_WAR = 15 // Each player clicks attack ~15 times during a war

function rng(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ====== SIM DIVISION ======

interface SimDiv {
  type: string; name: string; manpower: number
  health: number; maxHealth: number; experience: number
  starMods: StarMods; cooldown: number; alive: boolean
  side: 'atk' | 'def'
}

function createDiv(type: string, side: 'atk' | 'def'): SimDiv {
  const tmpl = DIVISION_TEMPLATES[type]
  const maxHp = Math.floor(tmpl.healthMult * 100)
  return {
    type, name: tmpl.name, manpower: tmpl.manpowerCost,
    health: maxHp, maxHealth: maxHp, experience: rng(0, 50),
    starMods: rollStarMods(), cooldown: 0, alive: true, side,
  }
}

// ====== METRICS ======

const metrics = {
  economy: {
    moneyCreated: 0,
    recruitCost: 0,
    reviveCost: 0,
    healCost: 0,
    insuranceCost: 0,
    divsCreated: {} as Record<string, number>,
    divsDestroyed: {} as Record<string, number>,
    xpLost: 0,
    xpAtDeath: [] as { type: string; xp: number }[],
    perType: {} as Record<string, { deployed: number; killed: number; recruitCost: number; reviveCost: number; healCost: number }>,
  },
  combat: {
    totalWars: 0,
    totalTicks: 0,
    atkDivRawDmg: 0,
    defDivRawDmg: 0,
    atkToDefHp: 0,
    defToAtkHp: 0,
    playerToDefDivHp: 0,
    playerToAtkDivHp: 0,
    atkWins: 0,
    defWins: 0,
    draws: 0,
    killsByDiv: 0,
    killsByPlayer: 0,
  },
}
for (const k of divKeys) {
  metrics.economy.divsCreated[k] = 0
  metrics.economy.divsDestroyed[k] = 0
  metrics.economy.perType[k] = { deployed: 0, killed: 0, recruitCost: 0, reviveCost: 0, healCost: 0 }
}

// ====== SIMULATE ONE FULL WAR ======

function simulateRegionWar() {
  metrics.combat.totalWars++

  // Build both sides: random division compositions
  const atkSkill = rng(2, 8)
  const defSkill = rng(2, 8)
  const atkStats = computePlayerCombatStats(atkSkill)
  const defStats = computePlayerCombatStats(defSkill)

  const atkDivs: SimDiv[] = []
  const defDivs: SimDiv[] = []

  for (let p = 0; p < PLAYERS_PER_SIDE; p++) {
    for (let d = 0; d < DIVS_PER_PLAYER; d++) {
      const type = divKeys[Math.floor(Math.random() * divKeys.length)]
      atkDivs.push(createDiv(type, 'atk'))
      metrics.economy.divsCreated[type]++
    }
  }
  for (let p = 0; p < PLAYERS_PER_SIDE; p++) {
    for (let d = 0; d < DIVS_PER_PLAYER; d++) {
      const type = divKeys[Math.floor(Math.random() * divKeys.length)]
      defDivs.push(createDiv(type, 'def'))
      metrics.economy.divsCreated[type]++
    }
  }

  // --- Tick-by-tick combat ---
  for (let tick = 0; tick < TICKS_PER_WAR; tick++) {
    metrics.combat.totalTicks++

    const aliveAtk = atkDivs.filter(d => d.alive)
    const aliveDef = defDivs.filter(d => d.alive)
    if (aliveAtk.length === 0 || aliveDef.length === 0) break

    // --- Division-vs-Division combat ---
    let atkTotalDmg = 0
    let defTotalDmg = 0

    // Each alive attacker division fires
    for (const div of aliveAtk) {
      const tmpl = DIVISION_TEMPLATES[div.type]
      const [dmg, cd] = divisionAttackTick(atkStats, div, tmpl, div.starMods, div.cooldown)
      div.cooldown = cd
      atkTotalDmg += dmg
      metrics.combat.atkDivRawDmg += dmg
    }

    // Each alive defender division fires
    for (const div of aliveDef) {
      const tmpl = DIVISION_TEMPLATES[div.type]
      const [dmg, cd] = divisionAttackTick(defStats, div, tmpl, div.starMods, div.cooldown)
      div.cooldown = cd
      defTotalDmg += dmg
      metrics.combat.defDivRawDmg += dmg
    }

    // Apply 1.11x multiplier and distribute to opposing divisions
    const scaledAtkDmg = Math.floor(atkTotalDmg * 0.80)
    const scaledDefDmg = Math.floor(defTotalDmg * 0.80)

    // Attacker hits defender divisions
    if (scaledAtkDmg > 0 && aliveDef.length > 0) {
      const perDiv = Math.max(1, Math.floor(scaledAtkDmg / aliveDef.length))
      for (const def of aliveDef) {
        const tmpl = DIVISION_TEMPLATES[def.type]
        const hpDmg = damageToDefender(perDiv, defStats, tmpl)
        def.health = Math.max(0, def.health - hpDmg)
        metrics.combat.atkToDefHp += hpDmg
        if (def.health <= 0) { def.alive = false; metrics.combat.killsByDiv++ }
      }
    }

    // Defender hits attacker divisions
    if (scaledDefDmg > 0 && aliveAtk.length > 0) {
      const perDiv = Math.max(1, Math.floor(scaledDefDmg / aliveAtk.length))
      for (const atk of aliveAtk) {
        const tmpl = DIVISION_TEMPLATES[atk.type]
        const hpDmg = damageToDefender(perDiv, atkStats, tmpl)
        atk.health = Math.max(0, atk.health - hpDmg)
        metrics.combat.defToAtkHp += hpDmg
        if (atk.health <= 0) { atk.alive = false; metrics.combat.killsByDiv++ }
      }
    }

    // --- Player manual attacks (10% splash to divs) ---
    // Each side has PLAYERS_PER_SIDE players clicking
    for (let p = 0; p < PLAYERS_PER_SIDE; p++) {
      // Attacker player clicks (on average 10/30 ticks = 33% chance per tick)
      if (Math.random() < PLAYER_ATTACKS_PER_WAR / TICKS_PER_WAR) {
        const playerDmg = atkStats.attackDamage
        const isCrit = Math.random() * 100 < atkStats.critRate
        const totalPlayerDmg = isCrit ? Math.floor(playerDmg * atkStats.critMultiplier) : playerDmg
        const splashDmg = Math.floor(totalPlayerDmg * 4.2) // x4.2 splash
        
        const aliveDefNow = defDivs.filter(d => d.alive)
        if (splashDmg > 0 && aliveDefNow.length > 0) {
          const perDiv = Math.max(1, Math.floor(splashDmg / aliveDefNow.length))
          for (const def of aliveDefNow) {
            def.health = Math.max(0, def.health - perDiv)
            metrics.combat.playerToDefDivHp += perDiv
            if (def.health <= 0) { def.alive = false; metrics.combat.killsByPlayer++ }
          }
        }
      }

      // Defender player clicks
      if (Math.random() < PLAYER_ATTACKS_PER_WAR / TICKS_PER_WAR) {
        const playerDmg = defStats.attackDamage
        const isCrit = Math.random() * 100 < defStats.critRate
        const totalPlayerDmg = isCrit ? Math.floor(playerDmg * defStats.critMultiplier) : playerDmg
        const splashDmg = Math.floor(totalPlayerDmg * 4.2) // x4.2 splash
        
        const aliveAtkNow = atkDivs.filter(d => d.alive)
        if (splashDmg > 0 && aliveAtkNow.length > 0) {
          const perDiv = Math.max(1, Math.floor(splashDmg / aliveAtkNow.length))
          for (const atk of aliveAtkNow) {
            atk.health = Math.max(0, atk.health - perDiv)
            metrics.combat.playerToAtkDivHp += perDiv
            if (atk.health <= 0) { atk.alive = false; metrics.combat.killsByPlayer++ }
          }
        }
      }
    }

    // Gain experience
    for (const d of [...aliveAtk, ...aliveDef]) {
      if (d.alive) d.experience = Math.min(100, d.experience + 0.5)
    }
  }

  // --- Determine winner ---
  const remainingAtk = atkDivs.filter(d => d.alive).length
  const remainingDef = defDivs.filter(d => d.alive).length

  if (remainingAtk > remainingDef) metrics.combat.atkWins++
  else if (remainingDef > remainingAtk) metrics.combat.defWins++
  else metrics.combat.draws++

  // Count destroyed & surviving divisions — economy
  const atkKills = defDivs.filter(d => !d.alive).length
  const defKills = atkDivs.filter(d => !d.alive).length

  for (const d of [...atkDivs, ...defDivs]) {
    const tmpl = DIVISION_TEMPLATES[d.type]
    const recruitMoney = tmpl.recruitCost.money
    metrics.economy.recruitCost += recruitMoney
    metrics.economy.perType[d.type].deployed++
    metrics.economy.perType[d.type].recruitCost += recruitMoney

    // 35% of players insure their divisions (cost = 10% of recruit)
    const insured = Math.random() < 0.35
    if (insured) {
      const insuranceCost = Math.floor(recruitMoney * 0.10)
      metrics.economy.insuranceCost += insuranceCost
    }

    if (!d.alive) {
      // Destroyed — revive: 50% (or 25% if insured)
      const revivePct = insured ? 0.25 : 0.50
      const reviveMoney = Math.floor(recruitMoney * revivePct)
      metrics.economy.divsDestroyed[d.type]++
      metrics.economy.reviveCost += reviveMoney
      metrics.economy.perType[d.type].killed++
      metrics.economy.perType[d.type].reviveCost += reviveMoney
      metrics.economy.xpLost += Math.floor(d.experience / 2)
      metrics.economy.xpAtDeath.push({ type: d.type, xp: d.experience })
    } else {
      // Survived — heal cost = missingHP × $12
      const missingHp = d.maxHealth - d.health
      if (missingHp > 0) {
        const heal = Math.floor(missingHp * 15)
        metrics.economy.healCost += heal
        metrics.economy.perType[d.type].healCost += heal
      }
    }
  }

  // War rewards: $100k for winners + $5k per kill, $15k + $2k per kill for losers
  const atkWon = remainingAtk > remainingDef
  const atkReward = atkWon ? (100000 + atkKills * 5000) : (15000 + atkKills * 2000)
  const defReward = !atkWon && remainingDef > remainingAtk ? (100000 + defKills * 5000) : (15000 + defKills * 2000)
  metrics.economy.moneyCreated += atkReward + defReward
}

// ====== RUN ======

console.log(`REGION-ONLY COMBAT SIMULATION`)
console.log(`${USERS} users | ${DAYS} days | ${WARS_PER_DAY} wars/day`)
console.log(`${PLAYERS_PER_SIDE} players/side × ${DIVS_PER_PLAYER} divs/player = ${PLAYERS_PER_SIDE * DIVS_PER_PLAYER} divs/side`)
console.log(`${TICKS_PER_WAR} ticks/war | ${PLAYER_ATTACKS_PER_WAR} player clicks/war\n`)

const totalWarsToSim = DAYS * WARS_PER_DAY
for (let w = 0; w < totalWarsToSim; w++) simulateRegionWar()

// ====== OUTPUT ======

console.log("================ RESULTS ================\n")

// --- Economy ---
const totalRevive = metrics.economy.reviveCost
const totalHeal = metrics.economy.healCost
const totalInsurance = metrics.economy.insuranceCost
const totalSunk = totalRevive + totalHeal + totalInsurance

console.log("💰 ECONOMY (NEW: heal $12/HP, revive 50%/25%, rewards $400k+$20k/kill)")
console.log(`  Initial Deployment Cost:  $${metrics.economy.recruitCost.toLocaleString()}`)
console.log(`  Insurance Cost (10%×35%): $${totalInsurance.toLocaleString()}`)
console.log(`  Revival Cost (50%/25%):   $${totalRevive.toLocaleString()}`)
console.log(`  Healing Cost ($12/HP):    $${totalHeal.toLocaleString()}`)
console.log(`  Total Post-War Sink:      $${totalSunk.toLocaleString()}`)
console.log(`  War Rewards ($400k+kill): $${metrics.economy.moneyCreated.toLocaleString()}`)
console.log(`  Net Economy Impact:       $${(metrics.economy.moneyCreated - totalSunk).toLocaleString()}`)
console.log(`  XP Lost from Revivals:    ${metrics.economy.xpLost.toLocaleString()}`)

// --- Per-type economy ---
console.log("\n💸 COST PER DIVISION TYPE (sorted by total sink)")
console.log("UNIT TYPE            | RECRUIT$     | REVIVE$    | HEAL$      | TOTAL SINK")
console.log("--------------------------------------------------------------------------")
const typeEcon = divKeys.map(k => {
  const p = metrics.economy.perType[k]
  const sink = p.reviveCost + p.healCost
  return { name: DIVISION_TEMPLATES[k].name, ...p, sink }
})
typeEcon.sort((a, b) => b.sink - a.sink)
typeEcon.forEach(row => {
  console.log(`${row.name.padEnd(20)} | $${String(row.recruitCost.toLocaleString()).padEnd(10)} | $${String(row.reviveCost.toLocaleString()).padEnd(8)} | $${String(row.healCost.toLocaleString()).padEnd(8)} | $${row.sink.toLocaleString()}`)
})

// --- Combat ---
console.log("\n⚔️ COMBAT")
console.log(`- Wars: ${metrics.combat.totalWars} | Ticks: ${metrics.combat.totalTicks.toLocaleString()}`)

const totalRawDmg = metrics.combat.atkDivRawDmg + metrics.combat.defDivRawDmg
console.log(`\n🗡️ RAW DMG: Atk ${metrics.combat.atkDivRawDmg.toLocaleString()} (${totalRawDmg > 0 ? ((metrics.combat.atkDivRawDmg/totalRawDmg)*100).toFixed(1) : 0}%) | Def ${metrics.combat.defDivRawDmg.toLocaleString()} (${totalRawDmg > 0 ? ((metrics.combat.defDivRawDmg/totalRawDmg)*100).toFixed(1) : 0}%)`)

const divHpTotal = metrics.combat.atkToDefHp + metrics.combat.defToAtkHp
const playerHpTotal = metrics.combat.playerToDefDivHp + metrics.combat.playerToAtkDivHp
const allHpTotal = divHpTotal + playerHpTotal
console.log(`\n📊 SOURCES: Div-vs-Div ${divHpTotal.toLocaleString()} (${allHpTotal > 0 ? ((divHpTotal/allHpTotal)*100).toFixed(1) : 0}%) | Player ${playerHpTotal.toLocaleString()} (${allHpTotal > 0 ? ((playerHpTotal/allHpTotal)*100).toFixed(1) : 0}%)`)
console.log(`   Kills: ${metrics.combat.killsByDiv} by Divs | ${metrics.combat.killsByPlayer} by Players`)

const tw = metrics.combat.totalWars
console.log(`\n🏆 W/L: Atk ${metrics.combat.atkWins} (${tw > 0 ? ((metrics.combat.atkWins/tw)*100).toFixed(1) : 0}%) | Def ${metrics.combat.defWins} (${tw > 0 ? ((metrics.combat.defWins/tw)*100).toFixed(1) : 0}%) | Draw ${metrics.combat.draws}`)

// --- Mortality ---
const totalCreated = Object.values(metrics.economy.perType).reduce((a, b) => a + b.deployed, 0)
const totalKilled = Object.values(metrics.economy.perType).reduce((a, b) => a + b.killed, 0)

console.log("\n💀 MORTALITY LADDER")
console.log("UNIT TYPE            | DEPLOYED | KILLED   | SURVIVED | MORTALITY %")
console.log("---------------------------------------------------------------------")
const ladder = divKeys.map(key => {
  const p = metrics.economy.perType[key]
  const survived = p.deployed - p.killed
  const mortality = p.deployed > 0 ? ((p.killed / p.deployed) * 100).toFixed(1) : '0.0'
  return { name: DIVISION_TEMPLATES[key].name, deployed: p.deployed, killed: p.killed, survived, mortality }
})
ladder.sort((a, b) => parseFloat(b.mortality) - parseFloat(a.mortality))
ladder.forEach(row => {
  console.log(`${row.name.padEnd(20)} | ${String(row.deployed).padEnd(8)} | ${String(row.killed).padEnd(8)} | ${String(row.survived).padEnd(8)} | ${row.mortality}%`)
})
console.log("---------------------------------------------------------------------")
console.log(`TOTAL                | ${String(totalCreated).padEnd(8)} | ${String(totalKilled).padEnd(8)} | ${String(totalCreated - totalKilled).padEnd(8)} | ${totalCreated > 0 ? ((totalKilled/totalCreated)*100).toFixed(1) : '0.0'}%`)
console.log("====================================================\n")



