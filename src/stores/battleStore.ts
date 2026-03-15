import { create } from 'zustand'
import { useWorldStore } from './worldStore'
import { useGovernmentStore } from './governmentStore'
import {
  useArmyStore,
  TERRAIN_MODIFIERS,
  COUNTRY_TERRAIN,
  DIVISION_TEMPLATES,
  type Division,
  type TerrainType,
} from './armyStore'

// ====== TYPES ======

export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike'
export type CombatPhase = 'planning' | 'engagement' | 'pursuit' | 'resolved'

// ====== COMBAT LOG ======

export interface CombatLogEntry {
  tick: number
  timestamp: number
  type: 'damage' | 'critical' | 'retreat' | 'destroyed' | 'air_strike' | 'artillery_barrage' | 'breakthrough' | 'morale_break' | 'phase_change'
  side: 'attacker' | 'defender'
  divisionName?: string
  targetDivisionName?: string
  damage?: number
  manpowerLost?: number
  message: string
}

// ====== BATTLE SIDE ======

export interface BattleSide {
  countryCode: string
  armyId: string
  divisionIds: string[]
  engagedDivisionIds: string[]   // Currently in combat (limited by combat width)
  reserveDivisionIds: string[]   // Waiting to rotate in

  // Aggregated stats (recalculated each tick)
  totalAttack: number
  totalDefense: number
  totalBreakthrough: number
  totalOrganization: number
  totalManpower: number
  airSuperiority: number         // 0-100, from fighter/bomber presence
  supplyStatus: number           // 0-100, affects organization recovery

  // Accumulated damage
  damageDealt: number
  manpowerLost: number
  divisionsDestroyed: number
  divisionsRetreated: number
}

// ====== BATTLE TICK ======

export interface BattleTick {
  startTime: number
  endTime: number
  attackerDamage: number
  defenderDamage: number
  resolved: boolean
}

export interface DamageEvent {
  playerName: string
  side: 'attacker' | 'defender'
  amount: number
  isCrit: boolean
  isDodged: boolean
  time: number
}

export interface BattleRound {
  attackerPoints: number
  defenderPoints: number
  status: 'active' | 'attacker_won' | 'defender_won'
}

// ====== BATTLE (HOI4-STYLE) ======

export interface Battle {
  id: string
  type: BattleType
  attackerId: string       // Country ISO
  defenderId: string       // Country ISO
  regionName: string       // Target province name
  startedAt: number

  // HOI4-style combat
  terrain: TerrainType
  combatWidth: number      // Total combat width available (typically 80)
  phase: CombatPhase
  ticksElapsed: number
  tickDurationMs: number   // How long each combat tick lasts (3 seconds for game speed)

  // Sides
  attacker: BattleSide
  defender: BattleSide

  // Legacy round system (kept for backward compat + display)
  attackerRoundsWon: number
  defenderRoundsWon: number
  rounds: BattleRound[]
  currentTick: BattleTick
  
  // Combat log
  combatLog: CombatLogEntry[]
  
  // Legacy compat
  attackerDamageDealers: Record<string, number>
  defenderDamageDealers: Record<string, number>
  damageFeed: DamageEvent[]

  status: 'active' | 'attacker_won' | 'defender_won'
}

// ====== HELPERS ======

const TICK_DURATION = 3 * 1000 // 3 seconds per combat tick (fast for gameplay)
const COMBAT_WIDTH = 80
const POINTS_TO_WIN_ROUND = 300
const ROUNDS_TO_WIN_BATTLE = 2

// Country flag emojis from ISO codes
const FLAG_EMOJIS: Record<string, string> = {
  US: '🇺🇸', RU: '🇷🇺', CN: '🇨🇳', DE: '🇩🇪', BR: '🇧🇷', IN: '🇮🇳',
  NG: '🇳🇬', JP: '🇯🇵', GB: '🇬🇧', TR: '🇹🇷', CA: '🇨🇦', MX: '🇲🇽',
  CU: '🇨🇺', BS: '🇧🇸',
}

export function getCountryFlag(iso: string): string {
  return FLAG_EMOJIS[iso] || '🏳️'
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', RU: 'Russia', CN: 'China', DE: 'Germany', BR: 'Brazil', IN: 'India',
  NG: 'Nigeria', JP: 'Japan', GB: 'United Kingdom', TR: 'Turkey', CA: 'Canada', MX: 'Mexico',
  CU: 'Cuba', BS: 'Bahamas',
}

export function getCountryName(iso: string): string {
  return COUNTRY_NAMES[iso] || iso
}

// ====== COMBAT CALCULATION ENGINE ======

function calculateAirSuperiority(divisions: Division[]): number {
  let fighterPower = 0
  let bomberPower = 0
  let antiAirPower = 0

  divisions.forEach(d => {
    if (d.type === 'fighter') fighterPower += d.stats.airAttack * (d.manpower / d.maxManpower)
    if (d.type === 'bomber') bomberPower += d.stats.attack * 0.3 * (d.manpower / d.maxManpower)
    if (d.type === 'anti_air') antiAirPower += d.stats.airAttack * 0.5 * (d.manpower / d.maxManpower)
  })

  return Math.min(100, fighterPower + bomberPower + antiAirPower)
}

function selectEngagedDivisions(divisionIds: string[], divisions: Record<string, Division>, combatWidth: number): { engaged: string[]; reserve: string[] } {
  const engaged: string[] = []
  const reserve: string[] = []
  let usedWidth = 0

  // Sort by priority: tanks first, then mechanized, then infantry, then others
  const priorityOrder: Record<string, number> = {
    tank: 1, mechanized: 2, special_forces: 3, infantry: 4,
    artillery: 5, anti_air: 6, fighter: 7, bomber: 8,
  }

  const sorted = [...divisionIds].sort((a, b) => {
    const da = divisions[a]
    const db = divisions[b]
    if (!da || !db) return 0
    return (priorityOrder[da.type] || 99) - (priorityOrder[db.type] || 99)
  })

  sorted.forEach(id => {
    const div = divisions[id]
    if (!div || div.status === 'destroyed' || div.status === 'retreating') return

    if (usedWidth + div.stats.combatWidth <= combatWidth) {
      engaged.push(id)
      usedWidth += div.stats.combatWidth
    } else {
      reserve.push(id)
    }
  })

  return { engaged, reserve }
}

function calculateSideStats(divisionIds: string[], divisions: Record<string, Division>): Partial<BattleSide> {
  let totalAttack = 0, totalDefense = 0, totalBreakthrough = 0
  let totalOrganization = 0, totalManpower = 0

  divisionIds.forEach(id => {
    const div = divisions[id]
    if (!div || div.status === 'destroyed' || div.status === 'retreating') return

    const strengthRatio = div.manpower / div.maxManpower
    const moraleRatio = div.morale / 100

    totalAttack += Math.floor(div.stats.attack * strengthRatio * moraleRatio)
    totalDefense += Math.floor(div.stats.defense * strengthRatio * moraleRatio)
    totalBreakthrough += Math.floor(div.stats.breakthrough * strengthRatio * moraleRatio)
    totalOrganization += div.stats.organization
    totalManpower += div.manpower
  })

  return { totalAttack, totalDefense, totalBreakthrough, totalOrganization, totalManpower }
}

/**
 * Core HOI4-style combat tick calculation
 * Each tick: attacker's attack vs defender's defense → damage to org + manpower
 */
function resolveCombatTick(battle: Battle, armyStore: ReturnType<typeof useArmyStore.getState>): {
  attackerDamage: number
  defenderDamage: number
  log: CombatLogEntry[]
  manpowerLossAttacker: number
  manpowerLossDefender: number
  orgLossAttacker: number
  orgLossDefender: number
} {
  const terrain = TERRAIN_MODIFIERS[battle.terrain]
  const log: CombatLogEntry[] = []
  const tick = battle.ticksElapsed

  // Get engaged divisions
  const atkDivs = battle.attacker.engagedDivisionIds
    .map(id => armyStore.divisions[id]).filter(d => d && d.status !== 'destroyed' && d.status !== 'retreating')
  const defDivs = battle.defender.engagedDivisionIds
    .map(id => armyStore.divisions[id]).filter(d => d && d.status !== 'destroyed' && d.status !== 'retreating')

  if (atkDivs.length === 0 || defDivs.length === 0) {
    return { attackerDamage: 0, defenderDamage: 0, log, manpowerLossAttacker: 0, manpowerLossDefender: 0, orgLossAttacker: 0, orgLossDefender: 0 }
  }

  // === 1. Calculate raw attack/defense totals ===
  let atkTotalAttack = 0, atkTotalBreakthrough = 0, atkAirSup = battle.attacker.airSuperiority
  let defTotalAttack = 0, defTotalDefense = 0, defAirSup = battle.defender.airSuperiority

  atkDivs.forEach(d => {
    const str = d.manpower / d.maxManpower
    const mor = d.morale / 100
    atkTotalAttack += Math.floor(d.stats.attack * str * mor)
    atkTotalBreakthrough += Math.floor(d.stats.breakthrough * str * mor)

    // Soft vs Hard targeting
    const hasArmor = defDivs.some(dd => dd.type === 'tank' || dd.type === 'mechanized')
    if (hasArmor) {
      atkTotalAttack += Math.floor(d.stats.hardAttack * str * 0.5)
    } else {
      atkTotalAttack += Math.floor(d.stats.softAttack * str * 0.3)
    }

    // Terrain specialty bonus
    if (d.type === terrain.specialBonus) {
      atkTotalAttack = Math.floor(atkTotalAttack * (1 + terrain.specialBonusValue / 100))
    }
  })

  defDivs.forEach(d => {
    const str = d.manpower / d.maxManpower
    const mor = d.morale / 100
    defTotalAttack += Math.floor(d.stats.attack * str * mor * 0.7) // Defenders attack at 70%
    defTotalDefense += Math.floor(d.stats.defense * str * mor)

    // Terrain specialty bonus
    if (d.type === terrain.specialBonus) {
      defTotalDefense = Math.floor(defTotalDefense * (1 + terrain.specialBonusValue / 100))
    }
  })

  // === 2. Apply terrain modifiers ===
  // Defender gets defense bonus from terrain
  defTotalDefense = Math.floor(defTotalDefense * (1 + terrain.defenseBonus / 100))
  // Attacker gets attack penalty from terrain
  atkTotalAttack = Math.floor(atkTotalAttack * (1 - terrain.attackPenalty / 100))

  // === 3. Air superiority bonus ===
  // Side with air superiority gets +15% attack, other side gets -15% defense
  if (atkAirSup > defAirSup + 20) {
    atkTotalAttack = Math.floor(atkTotalAttack * 1.15)
    defTotalDefense = Math.floor(defTotalDefense * 0.85)
    if (tick % 5 === 0) {
      log.push({ tick, timestamp: Date.now(), type: 'air_strike', side: 'attacker', message: '✈️ Attacker air superiority grants +15% attack!' })
    }
  } else if (defAirSup > atkAirSup + 20) {
    defTotalAttack = Math.floor(defTotalAttack * 1.15)
    atkTotalBreakthrough = Math.floor(atkTotalBreakthrough * 0.85)
    if (tick % 5 === 0) {
      log.push({ tick, timestamp: Date.now(), type: 'air_strike', side: 'defender', message: '✈️ Defender air superiority grants +15% defense!' })
    }
  }

  // === 4. Artillery barrage (every 3 ticks) ===
  const atkArtillery = atkDivs.filter(d => d.type === 'artillery')
  const defArtillery = defDivs.filter(d => d.type === 'artillery')
  if (tick % 3 === 0 && atkArtillery.length > 0) {
    const barrageDmg = atkArtillery.reduce((s, d) => s + d.stats.attack * 0.5, 0)
    atkTotalAttack += Math.floor(barrageDmg)
    log.push({ tick, timestamp: Date.now(), type: 'artillery_barrage', side: 'attacker', damage: Math.floor(barrageDmg), message: `💣 Attacker artillery barrage! +${Math.floor(barrageDmg)} attack` })
  }
  if (tick % 3 === 0 && defArtillery.length > 0) {
    const barrageDmg = defArtillery.reduce((s, d) => s + d.stats.attack * 0.3, 0)
    defTotalAttack += Math.floor(barrageDmg)
    log.push({ tick, timestamp: Date.now(), type: 'artillery_barrage', side: 'defender', damage: Math.floor(barrageDmg), message: `💣 Defender artillery barrage! +${Math.floor(barrageDmg)} counter-attack` })
  }

  // === 5. Calculate damage ===
  // Attacker damage to defender: (attack - defense) scaled, minimum 1
  const rawAtkDmg = Math.max(1, Math.floor((atkTotalAttack - defTotalDefense * 0.6) * (0.8 + Math.random() * 0.4)))
  // Defender counter-damage: (defender attack - attacker breakthrough) scaled
  const rawDefDmg = Math.max(1, Math.floor((defTotalAttack - atkTotalBreakthrough * 0.4) * (0.8 + Math.random() * 0.4)))

  // === 6. Convert damage to org loss, manpower loss, and morale loss ===
  // Organization damage: main combat currency
  const orgLossDefender = Math.max(1, Math.floor(rawAtkDmg * 0.02))
  const orgLossAttacker = Math.max(1, Math.floor(rawDefDmg * 0.015)) // Defender does less org damage

  // Manpower loss: percentage of damage
  const manpowerLossDefender = Math.max(0, Math.floor(rawAtkDmg * 0.3 * (0.5 + Math.random() * 0.5)))
  const manpowerLossAttacker = Math.max(0, Math.floor(rawDefDmg * 0.2 * (0.5 + Math.random() * 0.5)))

  // === 7. Breakthrough check ===
  if (atkTotalBreakthrough > defTotalDefense * 0.8 && Math.random() < 0.15) {
    log.push({
      tick, timestamp: Date.now(), type: 'breakthrough', side: 'attacker',
      message: `⚡ BREAKTHROUGH! Attackers pierce defensive line! Double org damage this tick!`,
    })
    // Double org damage on breakthrough
    return {
      attackerDamage: rawAtkDmg * 2,
      defenderDamage: rawDefDmg,
      log,
      manpowerLossAttacker,
      manpowerLossDefender: manpowerLossDefender * 2,
      orgLossAttacker,
      orgLossDefender: orgLossDefender * 2,
    }
  }

  return {
    attackerDamage: rawAtkDmg,
    defenderDamage: rawDefDmg,
    log,
    manpowerLossAttacker,
    manpowerLossDefender,
    orgLossAttacker,
    orgLossDefender,
  }
}

// ====== STORE ======

export interface BattleState {
  battles: Record<string, Battle>

  launchAttack: (attackerId: string, defenderId: string, regionName: string, type?: BattleType) => void
  addDamage: (battleId: string, side: 'attacker' | 'defender', amount: number, isCrit: boolean, isDodged: boolean, playerName: string) => void
  resolveTicksAndRounds: () => void
  
  // HOI4-style
  launchHOIBattle: (attackerArmyId: string, defenderCountryCode: string, type?: BattleType) => { success: boolean; message: string; battleId?: string }
  processHOICombatTick: () => void
}

function createEmptyBattleSide(countryCode: string, armyId: string = ''): BattleSide {
  return {
    countryCode, armyId,
    divisionIds: [], engagedDivisionIds: [], reserveDivisionIds: [],
    totalAttack: 0, totalDefense: 0, totalBreakthrough: 0,
    totalOrganization: 0, totalManpower: 0,
    airSuperiority: 0, supplyStatus: 100,
    damageDealt: 0, manpowerLost: 0,
    divisionsDestroyed: 0, divisionsRetreated: 0,
  }
}

function mkBattle(id: string, attackerId: string, defenderId: string, regionName: string, type: BattleType = 'invasion'): Battle {
  const now = Date.now()
  const terrain = COUNTRY_TERRAIN[defenderId] || 'plains'

  return {
    id, type, attackerId, defenderId, regionName,
    startedAt: now,
    terrain: terrain as TerrainType,
    combatWidth: COMBAT_WIDTH,
    phase: 'planning',
    ticksElapsed: 0,
    tickDurationMs: TICK_DURATION,

    attacker: createEmptyBattleSide(attackerId),
    defender: createEmptyBattleSide(defenderId),

    attackerRoundsWon: 0,
    defenderRoundsWon: 0,
    rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active' }],
    currentTick: { startTime: now, endTime: now + TICK_DURATION, attackerDamage: 0, defenderDamage: 0, resolved: false },
    combatLog: [],
    attackerDamageDealers: {},
    defenderDamageDealers: {},
    damageFeed: [],
    status: 'active',
  }
}

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: {},

  // ====== LEGACY LAUNCH (kept for backward compat) ======
  launchAttack: (attackerId, defenderId, regionName, type = 'invasion') => set((state) => {
    const existing = Object.values(state.battles).find(b => b.regionName === regionName && b.status === 'active')
    if (existing) return state

    const id = `battle_${Date.now()}_${regionName.replace(/\s+/g, '_')}`
    const battle = mkBattle(id, attackerId, defenderId, regionName, type)

    return { battles: { ...state.battles, [id]: battle } }
  }),

  // ====== HOI4-STYLE BATTLE LAUNCH ======
  launchHOIBattle: (attackerArmyId, defenderCountryCode, type = 'invasion') => {
    const armyStore = useArmyStore.getState()
    const attackerArmy = armyStore.armies[attackerArmyId]
    if (!attackerArmy) return { success: false, message: 'Army not found.' }

    const attackerDivs = attackerArmy.divisionIds
      .map(id => armyStore.divisions[id])
      .filter(d => d && d.status === 'ready')

    if (attackerDivs.length === 0) return { success: false, message: 'No ready divisions in this army.' }

    // Check adjacency
    const world = useWorldStore.getState()
    if (!world.canAttack(attackerArmy.countryCode, defenderCountryCode)) {
      return { success: false, message: 'Cannot attack: no adjacency or not at war.' }
    }

    // Find or create defender army
    const defenderArmies = armyStore.getArmiesForCountry(defenderCountryCode)
    const defenderArmy = defenderArmies[0] // Auto-select first army as defender

    const defenderDivIds = defenderArmy
      ? defenderArmy.divisionIds.filter(id => {
          const d = armyStore.divisions[id]
          return d && d.status === 'ready'
        })
      : []

    const id = `hoi_battle_${Date.now()}`
    const terrain = (COUNTRY_TERRAIN[defenderCountryCode] || 'plains') as TerrainType
    const now = Date.now()

    // Assign divisions to combat
    const atkSelection = selectEngagedDivisions(
      attackerDivs.map(d => d.id),
      armyStore.divisions,
      COMBAT_WIDTH
    )
    const defSelection = selectEngagedDivisions(
      defenderDivIds,
      armyStore.divisions,
      COMBAT_WIDTH
    )

    // Calculate air superiority
    const atkAirSup = calculateAirSuperiority(atkSelection.engaged.map(id => armyStore.divisions[id]).filter(Boolean))
    const defAirSup = calculateAirSuperiority(defSelection.engaged.map(id => armyStore.divisions[id]).filter(Boolean))

    // Calculate initial stats
    const atkStats = calculateSideStats(atkSelection.engaged, armyStore.divisions)
    const defStats = calculateSideStats(defSelection.engaged, armyStore.divisions)

    const targetName = getCountryName(defenderCountryCode)

    const battle: Battle = {
      id, type, attackerId: attackerArmy.countryCode, defenderId: defenderCountryCode,
      regionName: targetName, startedAt: now,
      terrain, combatWidth: COMBAT_WIDTH, phase: 'engagement',
      ticksElapsed: 0, tickDurationMs: TICK_DURATION,

      attacker: {
        countryCode: attackerArmy.countryCode,
        armyId: attackerArmyId,
        divisionIds: attackerDivs.map(d => d.id),
        engagedDivisionIds: atkSelection.engaged,
        reserveDivisionIds: atkSelection.reserve,
        totalAttack: atkStats.totalAttack || 0,
        totalDefense: atkStats.totalDefense || 0,
        totalBreakthrough: atkStats.totalBreakthrough || 0,
        totalOrganization: atkStats.totalOrganization || 0,
        totalManpower: atkStats.totalManpower || 0,
        airSuperiority: atkAirSup,
        supplyStatus: 100,
        damageDealt: 0, manpowerLost: 0,
        divisionsDestroyed: 0, divisionsRetreated: 0,
      },
      defender: {
        countryCode: defenderCountryCode,
        armyId: defenderArmy?.id || '',
        divisionIds: defenderDivIds,
        engagedDivisionIds: defSelection.engaged,
        reserveDivisionIds: defSelection.reserve,
        totalAttack: defStats.totalAttack || 0,
        totalDefense: defStats.totalDefense || 0,
        totalBreakthrough: defStats.totalBreakthrough || 0,
        totalOrganization: defStats.totalOrganization || 0,
        totalManpower: defStats.totalManpower || 0,
        airSuperiority: defAirSup,
        supplyStatus: 100,
        damageDealt: 0, manpowerLost: 0,
        divisionsDestroyed: 0, divisionsRetreated: 0,
      },

      attackerRoundsWon: 0, defenderRoundsWon: 0,
      rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active' }],
      currentTick: { startTime: now, endTime: now + TICK_DURATION, attackerDamage: 0, defenderDamage: 0, resolved: false },
      combatLog: [{
        tick: 0, timestamp: now, type: 'phase_change', side: 'attacker',
        message: `⚔️ Battle for ${targetName} begins! Terrain: ${terrain}. ${attackerDivs.length} vs ${defenderDivIds.length} divisions.`,
      }],
      attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [],
      status: 'active',
    }

    // Mark divisions as in_combat
    attackerDivs.forEach(d => {
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [d.id]: { ...s.divisions[d.id], status: 'in_combat' } }
      }))
    })
    defenderDivIds.forEach(id => {
      const div = armyStore.divisions[id]
      if (div) {
        useArmyStore.setState(s => ({
          divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'in_combat' } }
        }))
      }
    })

    set(state => ({ battles: { ...state.battles, [id]: battle } }))

    return { success: true, message: `Battle for ${targetName} has begun!`, battleId: id }
  },

  // ====== LEGACY ADD DAMAGE (backward compat) ======
  addDamage: (battleId, side, amount, isCrit, isDodged, playerName) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return state

    const now = Date.now()
    const { currentTick, attackerDamageDealers, defenderDamageDealers, damageFeed } = battle

    let finalAmount = amount

    // Infrastructure bonuses
    const world = useWorldStore.getState()
    const attackerCountry = world.countries.find(c => c.code === battle.attackerId)
    if (side === 'attacker' && attackerCountry && attackerCountry.militaryBaseLevel > 0) {
      finalAmount = Math.round(finalAmount * (1 + 0.05 + Math.random() * 0.15))
    }

    const newAttackerDealers = { ...attackerDamageDealers }
    const newDefenderDealers = { ...defenderDamageDealers }
    if (side === 'attacker') {
      newAttackerDealers[playerName] = (newAttackerDealers[playerName] || 0) + finalAmount
    } else {
      newDefenderDealers[playerName] = (newDefenderDealers[playerName] || 0) + finalAmount
    }

    const newFeed = [{ playerName, side, amount: finalAmount, isCrit, isDodged, time: now }, ...damageFeed].slice(0, 20)

    return {
      battles: {
        ...state.battles,
        [battleId]: {
          ...battle,
          attackerDamageDealers: newAttackerDealers,
          defenderDamageDealers: newDefenderDealers,
          damageFeed: newFeed,
          currentTick: {
            ...currentTick,
            attackerDamage: side === 'attacker' ? currentTick.attackerDamage + finalAmount : currentTick.attackerDamage,
            defenderDamage: side === 'defender' ? currentTick.defenderDamage + finalAmount : currentTick.defenderDamage,
          },
        },
      },
    }
  }),

  // ====== HOI4-STYLE COMBAT TICK PROCESSOR ======
  processHOICombatTick: () => {
    const state = get()
    const armyStore = useArmyStore.getState()
    const now = Date.now()

    const newBattles = { ...state.battles }
    let hasChanges = false

    Object.values(newBattles).forEach(battle => {
      if (battle.status !== 'active') return
      if (battle.phase !== 'engagement') return

      // Check if tick has elapsed
      if (now < battle.currentTick.endTime) return

      hasChanges = true
      const tickResult = resolveCombatTick(battle, armyStore)

      // Apply damage to individual divisions
      // Distribute damage across engaged divisions
      const engagedAtkDivs = battle.attacker.engagedDivisionIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'retreating'
      })
      const engagedDefDivs = battle.defender.engagedDivisionIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'retreating'
      })

      // Apply damage to defenders (from attacker's attack)
      if (engagedDefDivs.length > 0) {
        const perDivManpower = Math.floor(tickResult.manpowerLossDefender / engagedDefDivs.length)
        const perDivOrg = Math.floor(tickResult.orgLossDefender / engagedDefDivs.length)
        engagedDefDivs.forEach(id => {
          armyStore.applyBattleDamage(id, perDivManpower, perDivOrg, 2, 0.5)
        })
      }

      // Apply damage to attackers (from defender's counter-attack)
      if (engagedAtkDivs.length > 0) {
        const perDivManpower = Math.floor(tickResult.manpowerLossAttacker / engagedAtkDivs.length)
        const perDivOrg = Math.floor(tickResult.orgLossAttacker / engagedAtkDivs.length)
        engagedAtkDivs.forEach(id => {
          armyStore.applyBattleDamage(id, perDivManpower, perDivOrg, 1.5, 0.3)
        })
      }

      // Refresh division states after damage
      const updatedArmyStore = useArmyStore.getState()

      // Check for destroyed/retreating divisions
      let atkDestroyed = 0, atkRetreated = 0, defDestroyed = 0, defRetreated = 0
      const newCombatLog = [...battle.combatLog, ...tickResult.log]

      battle.attacker.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') {
          atkDestroyed++
          newCombatLog.push({
            tick: battle.ticksElapsed + 1, timestamp: now, type: 'destroyed', side: 'attacker',
            divisionName: d.name, message: `💀 ${d.name} has been destroyed!`,
          })
        }
        if (d?.status === 'retreating') {
          atkRetreated++
          newCombatLog.push({
            tick: battle.ticksElapsed + 1, timestamp: now, type: 'retreat', side: 'attacker',
            divisionName: d.name, message: `🏳️ ${d.name} is retreating!`,
          })
        }
      })

      battle.defender.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') {
          defDestroyed++
          newCombatLog.push({
            tick: battle.ticksElapsed + 1, timestamp: now, type: 'destroyed', side: 'defender',
            divisionName: d.name, message: `💀 ${d.name} has been destroyed!`,
          })
        }
        if (d?.status === 'retreating') {
          defRetreated++
          newCombatLog.push({
            tick: battle.ticksElapsed + 1, timestamp: now, type: 'retreat', side: 'defender',
            divisionName: d.name, message: `🏳️ ${d.name} is retreating!`,
          })
        }
      })

      // Rotate reserves into combat
      const newAtkEngagement = selectEngagedDivisions(
        battle.attacker.divisionIds.filter(id => {
          const d = updatedArmyStore.divisions[id]
          return d && d.status !== 'destroyed' && d.status !== 'retreating'
        }),
        updatedArmyStore.divisions,
        COMBAT_WIDTH
      )
      const newDefEngagement = selectEngagedDivisions(
        battle.defender.divisionIds.filter(id => {
          const d = updatedArmyStore.divisions[id]
          return d && d.status !== 'destroyed' && d.status !== 'retreating'
        }),
        updatedArmyStore.divisions,
        COMBAT_WIDTH
      )

      // Recalculate stats
      const newAtkStats = calculateSideStats(newAtkEngagement.engaged, updatedArmyStore.divisions)
      const newDefStats = calculateSideStats(newDefEngagement.engaged, updatedArmyStore.divisions)

      // Update round points
      const activeRoundIndex = battle.rounds.length - 1
      const activeRound = { ...battle.rounds[activeRoundIndex] }
      if (tickResult.attackerDamage > tickResult.defenderDamage) {
        activeRound.attackerPoints += 3
      } else if (tickResult.defenderDamage > tickResult.attackerDamage) {
        activeRound.defenderPoints += 3
      }

      // Check win conditions
      const atkAlive = newAtkEngagement.engaged.length + newAtkEngagement.reserve.length
      const defAlive = newDefEngagement.engaged.length + newDefEngagement.reserve.length

      let newStatus: Battle['status'] = battle.status
      let newPhase: CombatPhase = battle.phase
      let atkRoundsWon = battle.attackerRoundsWon
      let defRoundsWon = battle.defenderRoundsWon
      let newRounds = [...battle.rounds.slice(0, activeRoundIndex), activeRound]

      // Victory: all enemy divisions destroyed or retreated
      if (defAlive === 0) {
        newStatus = 'attacker_won'
        newPhase = 'resolved'
        newCombatLog.push({
          tick: battle.ticksElapsed + 1, timestamp: now, type: 'phase_change', side: 'attacker',
          message: `🏆 VICTORY! All defender divisions eliminated. ${getCountryName(battle.attackerId)} conquers ${battle.regionName}!`,
        })

        // Execute win conditions
        const world = useWorldStore.getState()
        if (battle.type === 'invasion' || battle.type === 'naval_strike' || battle.type === 'air_strike') {
          world.occupyCountry(battle.defenderId, battle.attackerId, false)
        } else if (battle.type === 'occupation') {
          world.occupyCountry(battle.defenderId, battle.attackerId, true)
        } else if (battle.type === 'assault') {
          const govStore = useGovernmentStore.getState()
          govStore.stealNationalFund(battle.defenderId, battle.attackerId, 10)
        }
      } else if (atkAlive === 0) {
        newStatus = 'defender_won'
        newPhase = 'resolved'
        newCombatLog.push({
          tick: battle.ticksElapsed + 1, timestamp: now, type: 'phase_change', side: 'defender',
          message: `🛡️ DEFENSE HOLDS! All attacker divisions eliminated. ${getCountryName(battle.defenderId)} defends ${battle.regionName}!`,
        })
      } else if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND || activeRound.defenderPoints >= POINTS_TO_WIN_ROUND) {
        // Round won
        if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND) {
          atkRoundsWon++
          activeRound.status = 'attacker_won'
        } else {
          defRoundsWon++
          activeRound.status = 'defender_won'
        }

        if (atkRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'attacker_won'
          newPhase = 'resolved'
          const world = useWorldStore.getState()
          if (battle.type === 'invasion') world.occupyCountry(battle.defenderId, battle.attackerId, false)
        } else if (defRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'defender_won'
          newPhase = 'resolved'
        } else {
          // Next round
          newRounds = [...newRounds, { attackerPoints: 0, defenderPoints: 0, status: 'active' }]
        }
      }

      // Update battle
      newBattles[battle.id] = {
        ...battle,
        ticksElapsed: battle.ticksElapsed + 1,
        phase: newPhase as CombatPhase,
        status: newStatus as any,
        attackerRoundsWon: atkRoundsWon,
        defenderRoundsWon: defRoundsWon,
        rounds: newRounds,
        currentTick: {
          startTime: now,
          endTime: now + battle.tickDurationMs,
          attackerDamage: tickResult.attackerDamage,
          defenderDamage: tickResult.defenderDamage,
          resolved: false,
        },
        attacker: {
          ...battle.attacker,
          engagedDivisionIds: newAtkEngagement.engaged,
          reserveDivisionIds: newAtkEngagement.reserve,
          totalAttack: newAtkStats.totalAttack || 0,
          totalDefense: newAtkStats.totalDefense || 0,
          totalBreakthrough: newAtkStats.totalBreakthrough || 0,
          totalOrganization: newAtkStats.totalOrganization || 0,
          totalManpower: newAtkStats.totalManpower || 0,
          airSuperiority: calculateAirSuperiority(
            newAtkEngagement.engaged.map(id => updatedArmyStore.divisions[id]).filter(Boolean)
          ),
          damageDealt: battle.attacker.damageDealt + tickResult.attackerDamage,
          manpowerLost: battle.attacker.manpowerLost + tickResult.manpowerLossAttacker,
          divisionsDestroyed: battle.attacker.divisionsDestroyed + atkDestroyed,
          divisionsRetreated: battle.attacker.divisionsRetreated + atkRetreated,
        },
        defender: {
          ...battle.defender,
          engagedDivisionIds: newDefEngagement.engaged,
          reserveDivisionIds: newDefEngagement.reserve,
          totalAttack: newDefStats.totalAttack || 0,
          totalDefense: newDefStats.totalDefense || 0,
          totalBreakthrough: newDefStats.totalBreakthrough || 0,
          totalOrganization: newDefStats.totalOrganization || 0,
          totalManpower: newDefStats.totalManpower || 0,
          airSuperiority: calculateAirSuperiority(
            newDefEngagement.engaged.map(id => updatedArmyStore.divisions[id]).filter(Boolean)
          ),
          damageDealt: battle.defender.damageDealt + tickResult.defenderDamage,
          manpowerLost: battle.defender.manpowerLost + tickResult.manpowerLossDefender,
          divisionsDestroyed: battle.defender.divisionsDestroyed + defDestroyed,
          divisionsRetreated: battle.defender.divisionsRetreated + defRetreated,
        },
        combatLog: newCombatLog.slice(-100), // Keep last 100 entries
      }

      // If battle resolved, reset division states
      if (newStatus !== 'active') {
        const finalArmyStore = useArmyStore.getState()
        ;[...battle.attacker.divisionIds, ...battle.defender.divisionIds].forEach(id => {
          const d = finalArmyStore.divisions[id]
          if (d && d.status === 'in_combat') {
            useArmyStore.setState(s => ({
              divisions: {
                ...s.divisions,
                [id]: {
                  ...s.divisions[id],
                  status: 'recovering',
                  experience: Math.min(100, d.experience + 10),
                  battlesSurvived: d.battlesSurvived + 1,
                },
              },
            }))
          }
        })
      }
    })

    if (hasChanges) {
      set({ battles: newBattles })
    }
  },

  // ====== LEGACY TICK RESOLVER ======
  resolveTicksAndRounds: () => {
    // Process HOI4 combat ticks
    get().processHOICombatTick()

    // Process cyber detection
    import('./cyberStore').then(mod => {
      mod.useCyberStore.getState().processDetectionTicks()
    })

    // Process army training
    useArmyStore.getState().processTrainingTick()
  },
}))
