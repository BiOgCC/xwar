import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useGovernmentStore } from './governmentStore'
import { useBattleStore } from './battleStore'
import { useResearchStore } from './researchStore'

// ====== TYPES ======

export type CountryOpId = 'company_sabotage' | 'logistics_disruption' | 'power_grid_attack' | 'air_strike' | 'naval_strike'
export type PlayerOpId = 'resource_intel' | 'war_intel' | 'disinformation' | 'bunker_override'
export type TacticalOpId = CountryOpId | PlayerOpId

export type MissionType = 'supply_run' | 'field_support' | 'pledge_badge' | 'war_bonds' | 'battle_veteran'

export type OpCategory = 'country' | 'player'

export interface TacticalOpDef {
  id: TacticalOpId
  category: OpCategory
  name: string
  icon: string
  description: string
  effectDescription: string
  /** Direct cost for player ops; country ops are funded via missions */
  cost: { bitcoin: number; badgesOfHonor: number }
  /** Target type */
  targetType: 'country' | 'region'
  /** Base success chance (%) */
  baseSuccessChance: number
  /** Effect duration in ms (0 = instant / report) */
  durationMs: number
  /** Funding points required (country ops only) */
  fundingRequired: number
}

export interface MissionDef {
  id: MissionType
  name: string
  icon: string
  description: string
  cost: { stamina?: number; work?: number; badges?: number; bitcoin?: number }
  fundingPoints: number
  /** Minimum player level to attempt (0 = anyone) */
  minLevel: number
}

export interface FundingEntry {
  playerName: string
  missionType: MissionType
  points: number
  timestamp: number
}

export interface FundingState {
  opId: CountryOpId
  countryCode: string
  totalPoints: number
  required: number
  contributors: FundingEntry[]
  status: 'funding' | 'ready' | 'launched'
  createdAt: number
}

export interface UndercoverScan {
  id: string
  opId: PlayerOpId
  playerName: string
  targetCountry: string
  startedAt: number
  /** 30 minutes */
  scanDurationMs: number
  /** Detection rolls happen every 5 min; detected = true when caught */
  detected: boolean
  detectedAt: number | null
  /** If detected, a fast battle is spawned */
  battleId: string | null
  /** Final status */
  status: 'scanning' | 'detected' | 'success' | 'failed'
}

export interface ActiveEffect {
  id: string
  opId: TacticalOpId
  effectType: string
  targetCountry: string
  targetRegion?: string
  appliedAt: number
  expiresAt: number
}

export interface IntelReport {
  id: string
  opId: PlayerOpId
  targetCountry: string
  data: Record<string, any>
  timestamp: number
  succeeded: boolean
}

// ====== OPERATION DEFINITIONS ======

export const COUNTRY_OPS: TacticalOpDef[] = [
  {
    id: 'company_sabotage', category: 'country', name: 'Company Sabotage', icon: '🔌',
    description: 'Infiltrate enemy companies and steal 20% of production for 24 hours.',
    effectDescription: 'Steal 20% production from ALL companies for 24h.',
    cost: { bitcoin: 0, badgesOfHonor: 0 }, // funded via missions
    targetType: 'country', baseSuccessChance: 60, durationMs: 24 * 60 * 60 * 1000,
    fundingRequired: 15,
  },
  {
    id: 'logistics_disruption', category: 'country', name: 'Logistics Disruption', icon: '🚚',
    description: 'Disable ports or airports in an enemy country for 48 hours.',
    effectDescription: 'Disables Port or Airport for 48h. Blocks Naval/Air Strikes.',
    cost: { bitcoin: 0, badgesOfHonor: 0 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 48 * 60 * 60 * 1000,
    fundingRequired: 15,
  },
  {
    id: 'power_grid_attack', category: 'country', name: 'Power Grid Attack', icon: '⚡',
    description: 'Attack the power grid, stopping 33% of enemy company production.',
    effectDescription: '33% companies in target country stop production for 90 minutes.',
    cost: { bitcoin: 0, badgesOfHonor: 0 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 90 * 60 * 1000,
    fundingRequired: 15,
  },
  {
    id: 'air_strike', category: 'country', name: 'Air Strike', icon: '✈️',
    description: 'Lightning strike from the skies. Hit enemy infrastructure hard.',
    effectDescription: '+30% damage bonus in the next battle + infrastructure damage.',
    cost: { bitcoin: 0, badgesOfHonor: 0 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 12 * 60 * 60 * 1000,
    fundingRequired: 15,
  },
  {
    id: 'naval_strike', category: 'country', name: 'Naval Strike', icon: '⛴️',
    description: 'Naval assault on coastal targets. Blockade enemy shipping.',
    effectDescription: '+25% damage bonus + trade route disruption for 12h.',
    cost: { bitcoin: 0, badgesOfHonor: 0 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 12 * 60 * 60 * 1000,
    fundingRequired: 15,
  },
]

export const PLAYER_OPS: TacticalOpDef[] = [
  {
    id: 'resource_intel', category: 'player', name: 'Resource Intel', icon: '📊',
    description: 'Scan enemy country funds, citizen resources, and economic strength.',
    effectDescription: 'Report: National fund breakdown, citizen reserves.',
    cost: { bitcoin: 1, badgesOfHonor: 1 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 0,
    fundingRequired: 0,
  },
  {
    id: 'war_intel', category: 'player', name: 'War Intel', icon: '🎖️',
    description: 'Scan enemy military infrastructure, vehicles, and combat readiness.',
    effectDescription: 'Report: Infrastructure levels, divisions, military assets.',
    cost: { bitcoin: 1, badgesOfHonor: 1 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 0,
    fundingRequired: 0,
  },
  {
    id: 'disinformation', category: 'player', name: 'Disinformation', icon: '📰',
    description: 'Spread fake news in enemy country to create confusion.',
    effectDescription: 'Fake invasion/crisis alerts for 30 minutes.',
    cost: { bitcoin: 1, badgesOfHonor: 1 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 30 * 60 * 1000,
    fundingRequired: 0,
  },
  {
    id: 'bunker_override', category: 'player', name: 'Bunker Override', icon: '🏰',
    description: 'Override bunker defenses, halving enemy defense for 24 hours. Extremely expensive.',
    effectDescription: 'Bunker defense -50% for 24 hours.',
    cost: { bitcoin: 20, badgesOfHonor: 20 },
    targetType: 'country', baseSuccessChance: 60, durationMs: 24 * 60 * 60 * 1000,
    fundingRequired: 0,
  },
]

export const ALL_OPS: TacticalOpDef[] = [...COUNTRY_OPS, ...PLAYER_OPS]

export function getOpDef(id: TacticalOpId): TacticalOpDef | undefined {
  return ALL_OPS.find(op => op.id === id)
}

// ====== MISSION DEFINITIONS ======

export const MISSIONS: MissionDef[] = [
  {
    id: 'supply_run', name: 'Supply Run', icon: '🔧',
    description: 'Spend work energy to supply the operation.',
    cost: { work: 10 }, fundingPoints: 1, minLevel: 0,
  },
  {
    id: 'field_support', name: 'Field Support', icon: '💧',
    description: 'Spend stamina to support field operatives.',
    cost: { stamina: 20 }, fundingPoints: 1, minLevel: 0,
  },
  {
    id: 'pledge_badge', name: 'Pledge Badge', icon: '🎖️',
    description: 'Donate a Badge of Honor to the cause.',
    cost: { badges: 1 }, fundingPoints: 2, minLevel: 0,
  },
  {
    id: 'war_bonds', name: 'War Bonds', icon: '₿',
    description: 'Donate Bitcoin to fund the operation.',
    cost: { bitcoin: 1 }, fundingPoints: 3, minLevel: 0,
  },
  {
    id: 'battle_veteran', name: 'Battle Veteran', icon: '⚔️',
    description: 'Deal 500+ damage in any active battle to contribute.',
    cost: {}, fundingPoints: 2, minLevel: 0,
  },
]

// ====== UNDERCOVER SCANNING CONSTANTS ======

const SCAN_DURATION_MS = 30 * 60 * 1000 // 30 minutes
const DETECTION_TICK_MS = 5 * 60 * 1000  // roll every 5 min
const DETECTION_CHANCE_PER_TICK = 30      // 30% per tick
const INTEL_BATTLE_DURATION = 2 * 60 * 60 * 1000 // 2h per round

// ====== STORE ======

export interface TacticalOpsState {
  // Country ops funding
  funding: Record<string, FundingState> // key: `${countryCode}_${opId}`
  // Undercover scans
  scans: Record<string, UndercoverScan>
  // Active effects on countries
  activeEffects: ActiveEffect[]
  // Intel reports
  reports: IntelReport[]

  // ── Actions ──
  // Funding
  completeMission: (opId: CountryOpId, missionType: MissionType) => { success: boolean; message: string }
  getFunding: (countryCode: string, opId: CountryOpId) => FundingState | null
  isOpFunded: (countryCode: string, opId: CountryOpId) => boolean

  // Launch
  launchCountryOp: (opId: CountryOpId, targetCountry: string) => { success: boolean; message: string }
  launchPlayerOp: (opId: PlayerOpId, targetCountry: string) => { success: boolean; message: string }

  // Undercover
  processDetectionTicks: () => void
  resolveScan: (scanId: string, won: boolean) => void

  // Effects
  getActiveEffectsForCountry: (countryCode: string) => ActiveEffect[]
  cleanExpiredEffects: () => void

  // Helpers
  getSuccessChance: (opId: TacticalOpId) => number
}

let scanCounter = 0
let effectCounter = 0
let reportCounter = 0

export const useTacticalOpsStore = create<TacticalOpsState>((set, get) => ({
  funding: {},
  scans: {},
  activeEffects: [],
  reports: [],

  // ═══════════════════════════════════════════════
  //  FUNDING (Country Ops)
  // ═══════════════════════════════════════════════

  completeMission: (opId, missionType) => {
    const mission = MISSIONS.find(m => m.id === missionType)
    if (!mission) return { success: false, message: 'Unknown mission.' }

    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'

    // Check costs
    if (mission.cost.work && Math.floor(player.work) < mission.cost.work)
      return { success: false, message: `Not enough work energy (need ${mission.cost.work}).` }
    if (mission.cost.stamina && player.stamina < mission.cost.stamina)
      return { success: false, message: `Not enough stamina (need ${mission.cost.stamina}).` }
    if (mission.cost.badges && player.badgesOfHonor < mission.cost.badges)
      return { success: false, message: `Not enough Badges of Honor (need ${mission.cost.badges}).` }
    if (mission.cost.bitcoin && player.bitcoin < mission.cost.bitcoin)
      return { success: false, message: `Not enough Bitcoin (need ${mission.cost.bitcoin}).` }

    // Battle veteran check (must have dealt 500+ damage in any active battle)
    if (missionType === 'battle_veteran') {
      const battles = useBattleStore.getState().battles
      const hasRecentDamage = Object.values(battles).some(b => {
        if (b.status !== 'active') return false
        const atkDmg = b.attackerDamageDealers?.[player.name] || 0
        const defDmg = b.defenderDamageDealers?.[player.name] || 0
        return (atkDmg + defDmg) >= 500
      })
      if (!hasRecentDamage) return { success: false, message: 'Deal 500+ damage in any active battle first.' }
    }

    // Deduct resources
    if (mission.cost.work) player.consumeBar('work', mission.cost.work)
    if (mission.cost.stamina) player.consumeBar('stamina', mission.cost.stamina)
    if (mission.cost.badges) player.spendBadgesOfHonor(mission.cost.badges)
    if (mission.cost.bitcoin) player.spendBitcoin(mission.cost.bitcoin)

    // Get or create funding state
    const key = `${countryCode}_${opId}`
    const state = get()
    const opDef = getOpDef(opId)
    if (!opDef) return { success: false, message: 'Unknown operation.' }

    let fs = state.funding[key]
    if (!fs || fs.status === 'launched') {
      fs = {
        opId,
        countryCode,
        totalPoints: 0,
        required: opDef.fundingRequired,
        contributors: [],
        status: 'funding',
        createdAt: Date.now(),
      }
    }

    const entry: FundingEntry = {
      playerName: player.name,
      missionType,
      points: mission.fundingPoints,
      timestamp: Date.now(),
    }

    const newTotal = Math.min(fs.required, fs.totalPoints + mission.fundingPoints)
    const isFunded = newTotal >= fs.required

    set({
      funding: {
        ...state.funding,
        [key]: {
          ...fs,
          totalPoints: newTotal,
          contributors: [...fs.contributors, entry],
          status: isFunded ? 'ready' : 'funding',
        },
      },
    })

    return {
      success: true,
      message: isFunded
        ? `🎯 ${opDef.name} is fully funded! The President can now launch it.`
        : `${mission.icon} +${mission.fundingPoints} funding (${newTotal}/${fs.required}).`,
    }
  },

  getFunding: (countryCode, opId) => {
    const key = `${countryCode}_${opId}`
    return get().funding[key] || null
  },

  isOpFunded: (countryCode, opId) => {
    const key = `${countryCode}_${opId}`
    const fs = get().funding[key]
    return fs?.status === 'ready'
  },

  // ═══════════════════════════════════════════════
  //  LAUNCH — Country Ops (President only)
  // ═══════════════════════════════════════════════

  launchCountryOp: (opId, targetCountry) => {
    const opDef = getOpDef(opId)
    if (!opDef || opDef.category !== 'country') return { success: false, message: 'Unknown country operation.' }

    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'

    // President check
    const gov = useGovernmentStore.getState().governments[countryCode]
    if (!gov || gov.president !== player.name) {
      return { success: false, message: 'Only the President can launch country operations.' }
    }

    // Self-target check
    if (targetCountry === countryCode) {
      return { success: false, message: "Can't target your own country." }
    }

    // Funding check — president can bypass by paying from the national treasury
    if (!get().isOpFunded(countryCode, opId as CountryOpId)) {
      // President direct-launch: spend 5000 money from national treasury
      const directCost = 5000
      const spent = useWorldStore.getState().spendFromFund(countryCode, { money: directCost })
      if (!spent) {
        return { success: false, message: `Operation not funded. President can launch directly for $${directCost.toLocaleString()} from treasury (insufficient funds).` }
      }
      // Mark as funded so it can proceed
    }

    // Roll success
    const successChance = get().getSuccessChance(opId)
    const roll = Math.random() * 100
    const succeeded = roll < successChance

    // Mark funding as launched
    const key = `${countryCode}_${opId}`
    const state = get()

    set({
      funding: {
        ...state.funding,
        [key]: { ...state.funding[key], status: 'launched' },
      },
    })

    if (!succeeded) {
      return { success: true, message: `❌ ${opDef.name} failed! (${Math.round(successChance)}% chance) Resources lost.` }
    }

    // Apply effect
    applyEffect(opId, targetCountry, opDef)

    return { success: true, message: `✅ ${opDef.name} succeeded against ${targetCountry}! Effect active for ${formatDuration(opDef.durationMs)}.` }
  },

  // ═══════════════════════════════════════════════
  //  LAUNCH — Player Ops (Solo)
  // ═══════════════════════════════════════════════

  launchPlayerOp: (opId, targetCountry) => {
    const opDef = getOpDef(opId)
    if (!opDef || opDef.category !== 'player') return { success: false, message: 'Unknown player operation.' }

    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'

    // Self-target check
    if (targetCountry === countryCode) {
      return { success: false, message: "Can't target your own country." }
    }

    // Cost check
    if (player.bitcoin < opDef.cost.bitcoin)
      return { success: false, message: `Not enough Bitcoin (need ${opDef.cost.bitcoin}).` }
    if (player.badgesOfHonor < opDef.cost.badgesOfHonor)
      return { success: false, message: `Not enough Badges of Honor (need ${opDef.cost.badgesOfHonor}).` }

    // Deduct costs
    player.spendBitcoin(opDef.cost.bitcoin)
    player.spendBadgesOfHonor(opDef.cost.badgesOfHonor)

    // Intel ops (resource_intel, war_intel, disinformation) go undercover
    const isIntelOp = opId === 'resource_intel' || opId === 'war_intel' || opId === 'disinformation'

    if (isIntelOp) {
      // Start undercover scan
      const scanId = `scan_${++scanCounter}_${Date.now()}`
      const state = get()
      set({
        scans: {
          ...state.scans,
          [scanId]: {
            id: scanId,
            opId,
            playerName: player.name,
            targetCountry,
            startedAt: Date.now(),
            scanDurationMs: SCAN_DURATION_MS,
            detected: false,
            detectedAt: null,
            battleId: null,
            status: 'scanning',
          },
        },
      })
      return { success: true, message: `📡 ${opDef.name} going undercover... 30-minute scan started.` }
    }

    // Bunker Override — direct roll (no undercover)
    const successChance = get().getSuccessChance(opId)
    const roll = Math.random() * 100
    const succeeded = roll < successChance

    if (!succeeded) {
      return { success: true, message: `❌ ${opDef.name} failed! (${Math.round(successChance)}% chance) 20₿ + 20🎖️ lost.` }
    }

    applyEffect(opId, targetCountry, opDef)
    return { success: true, message: `✅ ${opDef.name} succeeded! Enemy bunker defense halved for 24h.` }
  },

  // ═══════════════════════════════════════════════
  //  UNDERCOVER DETECTION TICKS
  // ═══════════════════════════════════════════════

  processDetectionTicks: () => {
    const state = get()
    const now = Date.now()
    const updatedScans = { ...state.scans }
    let changed = false

    Object.values(updatedScans).forEach(scan => {
      if (scan.status !== 'scanning') return

      const elapsed = now - scan.startedAt

      // Scan completed successfully (30 min passed without detection)
      if (elapsed >= scan.scanDurationMs) {
        // Roll success for the intel op
        const successChance = get().getSuccessChance(scan.opId)
        const roll = Math.random() * 100
        const succeeded = roll < successChance

        if (succeeded) {
          const opDef = getOpDef(scan.opId)
          if (opDef) {
            generateIntelReport(scan.opId, scan.targetCountry)
            if (opDef.durationMs > 0) {
              applyEffect(scan.opId, scan.targetCountry, opDef)
            }
          }
        }

        updatedScans[scan.id] = {
          ...scan,
          status: succeeded ? 'success' : 'failed',
        }
        changed = true
        return
      }

      // Detection roll (every 5 min)
      if (!scan.detected) {
        const ticksPassed = Math.floor(elapsed / DETECTION_TICK_MS)
        const expectedTicks = Math.floor((elapsed - 1000) / DETECTION_TICK_MS) // -1s to avoid duplicate
        if (ticksPassed > expectedTicks) {
          const detectRoll = Math.random() * 100
          if (detectRoll < DETECTION_CHANCE_PER_TICK) {
            // Detected! Spawn a fast battle
            const player = usePlayerStore.getState()
            const countryCode = player.countryCode || 'US'
            const battleStore = useBattleStore.getState()

            // Launch a fast intel battle
            battleStore.launchAttack(countryCode, scan.targetCountry, `Intel Op Zone`, 'quick_battle')

            // Find the created battle
            const battles = useBattleStore.getState().battles
            const battleId = Object.keys(battles).find(id =>
              battles[id].regionName === 'Intel Op Zone' &&
              battles[id].status === 'active' &&
              battles[id].type === 'quick_battle'
            ) || ''

            updatedScans[scan.id] = {
              ...scan,
              detected: true,
              detectedAt: now,
              battleId,
              status: 'detected',
            }
            changed = true
          }
        }
      }
    })

    if (changed) {
      set({ scans: updatedScans })
    }
  },

  resolveScan: (scanId, won) => {
    const state = get()
    const scan = state.scans[scanId]
    if (!scan || scan.status !== 'detected') return

    if (won) {
      // Attacker won the battle — intel succeeds
      const opDef = getOpDef(scan.opId)
      if (opDef) {
        generateIntelReport(scan.opId, scan.targetCountry)
        if (opDef.durationMs > 0) {
          applyEffect(scan.opId, scan.targetCountry, opDef)
        }
      }
    }

    set({
      scans: {
        ...state.scans,
        [scanId]: {
          ...scan,
          status: won ? 'success' : 'failed',
        },
      },
    })
  },

  // ═══════════════════════════════════════════════
  //  EFFECTS
  // ═══════════════════════════════════════════════

  getActiveEffectsForCountry: (countryCode) => {
    const now = Date.now()
    return get().activeEffects.filter(e => e.targetCountry === countryCode && e.expiresAt > now)
  },

  cleanExpiredEffects: () => set(state => ({
    activeEffects: state.activeEffects.filter(e => e.expiresAt > Date.now()),
  })),

  // ═══════════════════════════════════════════════
  //  SUCCESS CHANCE
  // ═══════════════════════════════════════════════

  getSuccessChance: (opId) => {
    const opDef = getOpDef(opId)
    if (!opDef) return 60

    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'
    const bonuses = useResearchStore.getState().getMilitaryBonuses(countryCode)
    const researchBonus = (bonuses as any).tacticalOpsBonus || 0 // +0.10 if researched

    return Math.min(95, opDef.baseSuccessChance + researchBonus * 100)
  },
}))

// ═══════════════════════════════════════════════
//  EFFECT APPLICATION (pure side-effects)
// ═══════════════════════════════════════════════

function applyEffect(opId: TacticalOpId, targetCountry: string, opDef: TacticalOpDef) {
  const now = Date.now()
  const effectId = `eff_${++effectCounter}_${now}`

  // Add to active effects
  useTacticalOpsStore.setState(state => ({
    activeEffects: [
      ...state.activeEffects,
      {
        id: effectId,
        opId,
        effectType: opId,
        targetCountry,
        appliedAt: now,
        expiresAt: now + opDef.durationMs,
      },
    ],
  }))

  // Apply immediate world-state side effects
  const worldStore = useWorldStore.getState()
  const companyStore = (window as any).__xwar_companyStore // lazy import to avoid circular deps

  if (opId === 'bunker_override') {
    // Halve bunker level
    useWorldStore.setState(s => ({
      countries: s.countries.map(c =>
        c.code === targetCountry
          ? { ...c, bunkerLevel: Math.max(1, Math.floor(c.bunkerLevel / 2)) }
          : c
      ),
    }))
  }

  if (opId === 'logistics_disruption') {
    // Randomly disable port or airport
    const pick = Math.random() < 0.5 ? 'portLevel' : 'airportLevel'
    useWorldStore.setState(s => ({
      countries: s.countries.map(c =>
        c.code === targetCountry
          ? { ...c, [pick]: 0 }
          : c
      ),
    }))
  }

  if (opId === 'company_sabotage') {
    // Steal 20% production — add stolen goods to attacker's national fund
    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'
    const stolenOil = 500
    const stolenScrap = 500
    useGovernmentStore.getState().donateToFund(countryCode, 'oil', stolenOil)
    useGovernmentStore.getState().donateToFund(countryCode, 'scrap', stolenScrap)
  }

  // power_grid_attack, air_strike, naval_strike effects are tracked via activeEffects
  // and consumed by the combat/production tick systems
}

// ═══════════════════════════════════════════════
//  INTEL REPORT GENERATION
// ═══════════════════════════════════════════════

function generateIntelReport(opId: PlayerOpId, targetCountry: string) {
  const world = useWorldStore.getState()
  const country = world.countries.find(c => c.code === targetCountry)
  if (!country) return

  let data: Record<string, any> = {}

  if (opId === 'resource_intel') {
    const fund = world.getCountry(targetCountry)?.fund ?? { money: 0, oil: 0, scrap: 0, materialX: 0, bitcoin: 0, jets: 0 }
    data = {
      type: 'Resource Intelligence',
      country: targetCountry,
      countryName: country.name,
      treasury: fund.money,
      oilReserves: fund.oil,
      scrapStockpile: fund.scrap,
      materialX: fund.materialX,
      bitcoin: fund.bitcoin,
      population: country.population || 0,
    }
  }

  if (opId === 'war_intel') {
    data = {
      type: 'Military Intelligence',
      country: targetCountry,
      countryName: country.name,
      militaryStrength: country.military || 0,
      bunkerLevel: country.bunkerLevel || 0,
      militaryBaseLevel: country.militaryBaseLevel || 0,
      portLevel: country.portLevel || 0,
      airportLevel: country.airportLevel || 0,
      regions: country.regions || 0,
    }
  }

  if (opId === 'disinformation') {
    data = {
      type: 'Disinformation Report',
      country: targetCountry,
      countryName: country.name,
      effect: 'Fake alerts planted for 30 minutes',
    }
  }

  const reportId = `rpt_${++reportCounter}_${Date.now()}`
  useTacticalOpsStore.setState(state => ({
    reports: [
      {
        id: reportId,
        opId,
        targetCountry,
        data,
        timestamp: Date.now(),
        succeeded: true,
      },
      ...state.reports,
    ].slice(0, 50), // keep last 50 reports
  }))
}

function formatDuration(ms: number): string {
  if (ms === 0) return 'Instant'
  if (ms >= 86400000) return `${Math.round(ms / 86400000)}d`
  if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`
  return `${Math.round(ms / 60000)}m`
}
