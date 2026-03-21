// server/src/scripts/calc_damage.ts

const DIVISION_TEMPLATES: any = {
  recon: { name: 'Recon Squad', manpowerCost: 200, atkDmgMult: 0.10, critRateMult: 0.80, critDmgMult: 1.50, attackSpeed: 1.5 },
  assault: { name: 'Assault Infantry', manpowerCost: 350, atkDmgMult: 0.11, critRateMult: 1.00, critDmgMult: 1.60, attackSpeed: 1 },
  sniper: { name: 'Sniper Division', manpowerCost: 150, atkDmgMult: 0.13, critRateMult: 1.56, critDmgMult: 2.50, attackSpeed: 0.6 },
  rpg: { name: 'RPG Squadron', manpowerCost: 250, atkDmgMult: 0.15, critRateMult: 1.20, critDmgMult: 2.00, attackSpeed: 0.8 },
  jeep: { name: 'Recon Jeeps', manpowerCost: 150, atkDmgMult: 0.20, critRateMult: 0.90, critDmgMult: 1.70, attackSpeed: 1.3 },
  tank: { name: 'Tank Battalion', manpowerCost: 200, atkDmgMult: 0.22, critRateMult: 1.10, critDmgMult: 1.80, attackSpeed: 0.5 },
  jet: { name: 'Jet Fighters', manpowerCost: 100, atkDmgMult: 0.26, critRateMult: 1.75, critDmgMult: 2.80, attackSpeed: 0.7 },
  warship: { name: 'Warship Fleet', manpowerCost: 250, atkDmgMult: 0.30, critRateMult: 1.35, critDmgMult: 2.20, attackSpeed: 0.4 },
  submarine: { name: 'Submarine Fleet', manpowerCost: 300, atkDmgMult: 0.35, critRateMult: 1.50, critDmgMult: 2.50, attackSpeed: 0.3 },
}

function calculateMaxDPS() {
  console.log("=========================================")
  console.log("   MAX LEVEL (12) DIVISION DPS LADDER    ")
  console.log("=========================================\n")

  const PLAYER_BASE_ATK = 100
  const SKILL_ATK = 10 * 20
  const TIER5_WEAPON_ATK = 1500
  const totalPlayerAtk = PLAYER_BASE_ATK + SKILL_ATK + TIER5_WEAPON_ATK

  const PLAYER_BASE_CRIT_RATE = 10
  const SKILL_CRIT_RATE = 10 * 5
  const TIER5_WEAPON_CRIT_RATE = 20
  const totalPlayerCritRate = Math.min(100, PLAYER_BASE_CRIT_RATE + SKILL_CRIT_RATE + TIER5_WEAPON_CRIT_RATE)

  const PLAYER_BASE_CRIT_MULT = 1.0
  const SKILL_CRIT_MULT = 10 * 0.2
  const TIER5_WEAPON_CRIT_MULT = 1.5
  const totalPlayerCritMult = PLAYER_BASE_CRIT_MULT + SKILL_CRIT_MULT + TIER5_WEAPON_CRIT_MULT

  const DIV_LEVEL = 12
  const STAR_MULT = 0.08 // 5-Star bonus
  
  const results = []

  for (const [id, tmpl] of Object.entries<any>(DIVISION_TEMPLATES)) {
    const EFFECTIVE_ATK_MULT = tmpl.atkDmgMult * (1 + STAR_MULT)
    
    // Division Damage Formula
    const divBaseDamage = totalPlayerAtk + (tmpl.manpowerCost * 3) + TIER5_WEAPON_ATK
    const divMultiplier = EFFECTIVE_ATK_MULT + (DIV_LEVEL * 0.01)
    
    const rawDivHit = Math.floor(divBaseDamage * divMultiplier)

    // Crit math
    const DIV_BASE_CRIT_RATE = tmpl.critRateMult
    const divCritRatePct = Math.min(100, totalPlayerCritRate * (DIV_BASE_CRIT_RATE * (1 + STAR_MULT)))
    const divCritMultiplier = totalPlayerCritMult * (tmpl.critDmgMult * (1 + STAR_MULT))

    const divCritChance = divCritRatePct / 100
    const avgDivHit = (rawDivHit * (1 - divCritChance)) + (rawDivHit * divCritMultiplier * divCritChance)
    
    const divDPS = avgDivHit * tmpl.attackSpeed
    
    results.push({
      name: tmpl.name,
      dps: Math.floor(divDPS)
    })
  }

  // Sort descending
  results.sort((a, b) => b.dps - a.dps)

  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.name.padEnd(20)} | ${r.dps.toLocaleString()} DPS`)
  })
  console.log("\n=========================================\n")
}

calculateMaxDPS()
