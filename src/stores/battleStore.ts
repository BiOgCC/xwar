import { create } from 'zustand'
import { computeLeyLineCombatMods } from './leyLineStore'
import { rateLimiter } from '../engine/AntiExploit'
import { computePlayerCombatStats, aggregateEquipmentStats, computeBaseSkillStats, type PlayerCombatStats } from '../engine/stats'
import { computePlayerAttack, deviate, EMPTY_STAR_MODS, EMPTY_EQUIP_BONUS, NO_ORDER, NO_AURA, type AuraBonus, type OrderEffects as EngineOrderEffects } from '../engine/combat'
import { getWarRewards, getWarRewardShare } from '../engine/economy'
import { useResearchStore } from './researchStore'
import { useWorldStore } from './worldStore'
import { useGovernmentStore } from './governmentStore'
import { useAllianceStore, getIdeologyBonus } from './allianceStore'
import { usePlayerStore } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useInventoryStore } from './inventoryStore'
import { useArmyStore, getDivisionEquipBonus, DIVISION_TEMPLATES, rollDebris, type Division } from './army'
import { useSpecializationStore } from './specializationStore'
import { getCountryName, getCountryFlag, getCountryFlagUrl } from '../data/countries'
import { useRegionStore } from './regionStore'
import type { Region } from './regionStore'
import { getCountryDistance, getAttackOilCost } from '../utils/geography'

// Re-export for backwards compatibility — consumers importing from battleStore still work
export { getCountryName, getCountryFlag, getCountryFlagUrl }

// ====== PLAYER COMBAT STATS HELPER (delegates to engine/stats.ts) ======
export function getPlayerCombatStats(): PlayerCombatStats {
  const skills = useSkillsStore.getState().military
  const equipped = useInventoryStore.getState().getEquipped()
  const eqStats = aggregateEquipmentStats(equipped)
  return computePlayerCombatStats(skills, eqStats)
}

export function getBaseSkillStats(): PlayerCombatStats {
  const skills = useSkillsStore.getState().military
  return computeBaseSkillStats(skills)
}

// ====== TYPES ======
import type { BattleType, CombatLogEntry, BattleSide, BattleTick, BattleRound, TacticalOrder, OrderEffects, Battle, MercenaryContract } from '../types/battle.types'
export type { BattleType, CombatLogEntry, BattleSide, BattleTick, BattleRound, TacticalOrder, OrderEffects, Battle, MercenaryContract }

// ====== TACTICAL ORDERS ======
export const TACTICAL_ORDERS: Record<TacticalOrder, { label: string; desc: string; effects: OrderEffects; color: string }> = {
  none: { label: 'NONE', desc: 'No active order', effects: { atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1 }, color: '#64748b' },
  charge: { label: 'CHARGE', desc: '+15% ATK damage', effects: { atkMult: 1.15, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1 }, color: '#ef4444' },
  fortify: { label: 'FORTIFY', desc: '+20% armor, +8% dodge', effects: { atkMult: 1, armorMult: 1.20, dodgeMult: 1.08, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1 }, color: '#3b82f6' },
  precision: { label: 'PRECISION', desc: '+12% hit, +10% crit', effects: { atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0.12, critBonus: 10, critDmgMult: 1, speedMult: 1 }, color: '#f59e0b' },
  blitz: { label: 'BLITZ', desc: '+10% ATK, +10% crit dmg', effects: { atkMult: 1.10, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1.10, speedMult: 1 }, color: '#22d38a' },
}


// ====== WEAPON COUNTER-BUFF SYSTEM ======
// When enemy players use a weapon, your side's counter-weapon gets a per-player cumulative damage buff.
const WEAPON_COUNTER_TABLE: Record<string, { counter: string; perPlayer: number }> = {
  knife:     { counter: 'gun',       perPlayer: 0.03 },  // T1 → T2
  gun:       { counter: 'rifle',     perPlayer: 0.03 },  // T2 → T3
  rifle:     { counter: 'sniper',    perPlayer: 0.03 },  // T3 → T4
  sniper:    { counter: 'tank',      perPlayer: 0.03 },  // T4 → T5
  tank:      { counter: 'rpg',       perPlayer: 0.05 },  // T5 ↔ T5 same-tier
  rpg:       { counter: 'sniper',    perPlayer: 0.03 },  // T5 → T4
  jet:       { counter: 'warship',   perPlayer: 0.05 },  // T6 ↔ T6 same-tier
  warship:   { counter: 'submarine', perPlayer: 0.03 },  // T6 → T7
  submarine: { counter: 'jet',       perPlayer: 0.03 },  // T7 → T6
}
const COUNTER_BUFF_TICKS = 20       // 20 ticks × 15s = 5 minutes
const COUNTER_MIN_HITS = 5          // min hits before a player's weapon presence counts
const COUNTER_MIN_DAMAGE = 3000     // min total damage before a player's weapon presence counts

// ====== HELPERS ======

const POINTS_TO_WIN_ROUND = 600
const ROUNDS_TO_WIN_BATTLE = 2

// Quick battle: lower thresholds for pure PvP
const QB_POINTS_TO_WIN_ROUND = 200
const QB_ROUNDS_TO_WIN_BATTLE = 1

function getPointIncrement(totalGroundPoints: number): number {
  if (totalGroundPoints < 100) return 1
  if (totalGroundPoints < 200) return 2
  if (totalGroundPoints < 300) return 3
  if (totalGroundPoints < 400) return 4
  return 5
}

// Country data (names, flags, flag URLs) now lives in src/data/countries.ts
// and is re-exported at the top of this file for backwards compatibility.

// ====== FACTORY FUNCTIONS ======

function createEmptyBattleSide(countryCode: string): BattleSide {
  return {
    countryCode,
    divisionIds: [], engagedDivisionIds: [],
    damageDealt: 0, manpowerLost: 0,
    divisionsDestroyed: 0, divisionsRetreated: 0,
  }
}

function mkBattle(id: string, attackerId: string, defenderId: string, regionName: string, type: BattleType = 'invasion', regionId?: string): Battle {
  return {
    id, type, attackerId, defenderId, regionName,
    regionId,
    startedAt: Date.now(),
    ticksElapsed: 0,
    status: 'active',
    attacker: createEmptyBattleSide(attackerId),
    defender: createEmptyBattleSide(defenderId),
    attackerRoundsWon: 0, defenderRoundsWon: 0,
    rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: Date.now() }],
    currentTick: { attackerDamage: 0, defenderDamage: 0 },
    combatLog: [],
    attackerDamageDealers: {}, defenderDamageDealers: {},
    damageFeed: [],
    divisionCooldowns: {},
    attackerOrder: 'none' as TacticalOrder,
    defenderOrder: 'none' as TacticalOrder,
    orderMessage: '',
    motd: '',
    playerAdrenaline: {},
    playerSurge: {},
    playerCrash: {},
    playerAdrenalinePeakAt: {},
    vengeanceBuff: { attacker: -1, defender: -1 },
    mercenaryContracts: [],
    weaponPresence: { attacker: {}, defender: {} },
  }
}

// ====== STORE ======

export interface BattleState {
  battles: Record<string, Battle>

  launchAttack: (attackerId: string, defenderId: string, regionName: string, type?: BattleType, regionId?: string) => void
  addDamage: (battleId: string, side: 'attacker' | 'defender', amount: number, isCrit: boolean, isDodged: boolean, playerName: string) => void

  launchHOIBattle: (attackerArmyId: string, defenderCountryCode: string, type?: BattleType) => { success: boolean; message: string; battleId?: string }
  processHOICombatTick: () => void
  processPlayerCombatTick: () => void   // ground points from manual attacks (runs without divisions)

  playerAttack: (battleId: string, side?: 'attacker' | 'defender') => Promise<{ damage: number; isCrit: boolean; isMiss?: boolean; isDodged?: boolean; message: string }>
  playerDefend: (battleId: string, side?: 'attacker' | 'defender') => { blocked: number; message: string }
  deployDivisionsToBattle: (battleId: string, divisionIds: string[], side: 'attacker' | 'defender') => { success: boolean; message: string }
  removeDivisionsFromBattle: (battleId: string, side: 'attacker' | 'defender') => { success: boolean; message: string }
  recallDivisionFromBattle: (battleId: string, divisionId: string, side: 'attacker' | 'defender') => { success: boolean; message: string }

  // Adrenaline system
  activateSurge: (battleId: string) => Promise<void>
  tickAdrenalineDecay: (battleId: string, playerName: string) => void

  combatTickLeft: number
  setCombatTickLeft: (val: number) => void
  setBattleOrder: (battleId: string, side: 'attacker' | 'defender', order: TacticalOrder) => void
  setBattleOrderMessage: (battleId: string, message: string) => void
  setBattleMOTD: (battleId: string, motd: string) => void
  warMotd: string
  setWarMotd: (motd: string) => void

  // Mercenary contracts
  createMercenaryContract: (battleId: string, side: 'attacker' | 'defender', ratePerHit: number, totalPool: number) => { success: boolean; message: string }

  // Missile Launcher
  launchMissile: (battleId: string, side: 'attacker' | 'defender') => { success: boolean; message: string }

  // NPC test battles
  spawnNPCBattles: () => void
}

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: {},
  warMotd: '',
  setWarMotd: (motd: string) => set({ warMotd: motd.substring(0, 200) }),

  // ====== MERCENARY CONTRACTS ======
  createMercenaryContract: (battleId, side, ratePerHit, totalPool) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }
    if (ratePerHit <= 0 || totalPool <= 0) return { success: false, message: 'Invalid amounts.' }

    // Only president of the side's country can create
    const countryCode = side === 'attacker' ? battle.attackerId : battle.defenderId
    const gov = useGovernmentStore.getState().governments[countryCode]
    const player = usePlayerStore.getState()
    if (!gov || gov.president !== player.name) return { success: false, message: 'Only the president can fund mercenary contracts.' }

    // Deduct from country treasury
    const success = useWorldStore.getState().spendFromFund(countryCode, { money: totalPool })
    if (!success) return { success: false, message: 'Not enough money in treasury.' }

    const contract: MercenaryContract = {
      id: `merc_${battleId}_${Date.now()}`,
      side,
      ratePerDamage: ratePerHit,
      totalPool,
      remaining: totalPool,
      fundedBy: player.name,
      countryCode,
      createdAt: Date.now(),
    }

    set(s => ({
      battles: { ...s.battles, [battleId]: {
        ...s.battles[battleId],
        mercenaryContracts: [...(s.battles[battleId].mercenaryContracts || []), contract],
      }}
    }))

    return { success: true, message: `Mercenary contract funded: ${ratePerHit.toLocaleString()}/dmg, ${totalPool.toLocaleString()} pool` }
  },

  // ====== NPC TEST BATTLES ======
  // NPC battles removed — server-authoritative battles only
  spawnNPCBattles: () => {},
  combatTickLeft: 15,
  setCombatTickLeft: (val: number) => set({ combatTickLeft: val }),
  setBattleOrder: (battleId: string, side: 'attacker' | 'defender', order: TacticalOrder) => {
    set((state) => {
      const battle = state.battles[battleId]
      if (!battle) return state
      const key = side === 'attacker' ? 'attackerOrder' : 'defenderOrder'
      return {
        battles: {
          ...state.battles,
          [battleId]: { ...battle, [key]: order },
        },
      }
    })
    import('../api/client').then(({ setBattleOrder }) => setBattleOrder(battleId, side, order).catch(() => {}))
  },
  setBattleOrderMessage: (battleId: string, message: string) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle) return state
    return { battles: { ...state.battles, [battleId]: { ...battle, orderMessage: message.substring(0, 100) } } }
  }),
  setBattleMOTD: (battleId: string, motd: string) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle) return state
    return { battles: { ...state.battles, [battleId]: { ...battle, motd: motd.substring(0, 200) } } }
  }),

  // ====== MISSILE LAUNCHER ======
  launchMissile: (battleId, side) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const player = usePlayerStore.getState()
    const countryCode = side === 'attacker' ? battle.attackerId : battle.defenderId

    // Only President, VP, and Minister of Defense can launch
    const gov = useGovernmentStore.getState().governments[countryCode]
    if (!gov) return { success: false, message: 'No government found.' }
    const isAuthorized = gov.president === player.name ||
      (gov.congress.length > 0 && gov.congress[0] === player.name)  // VP = first congress member
    if (!isAuthorized) {
      return { success: false, message: 'Only President or Vice President can launch missiles.' }
    }

    // Check missile launcher level on the region
    const regionStore = useRegionStore.getState()
    const region = battle.regionId ? regionStore.getRegion(battle.regionId) : null
    const level = region?.missileLauncherLevel || 0
    if (level <= 0) {
      return { success: false, message: 'No Missile Launcher built. Upgrade in region infrastructure.' }
    }

    // Check cooldown (5 minutes per country per battle)
    const MISSILE_COOLDOWN = 5 * 60 * 1000
    const now = Date.now()
    const lastLaunch = battle.missileCooldowns?.[countryCode] || 0
    if (now - lastLaunch < MISSILE_COOLDOWN) {
      const remaining = Math.ceil((MISSILE_COOLDOWN - (now - lastLaunch)) / 1000)
      return { success: false, message: `Missile on cooldown! ${remaining}s remaining.` }
    }

    // Oil cost: 50 per launch from national treasury
    const OIL_COST = 50
    const spent = useWorldStore.getState().spendFromFund(countryCode, { oil: OIL_COST })
    if (!spent) {
      return { success: false, message: `Not enough oil in treasury. Needs ${OIL_COST} 🛢️.` }
    }

    // Base damage 666,666 — scales with level: level × (666666 / 5) × 1.5 at max
    // Level 1 = 666,666 | Level 5 = 999,999 (~1M)
    const BASE_DAMAGE = 666_666
    const burstDamage = Math.round(BASE_DAMAGE * (1 + (level - 1) * 0.125))

    // Apply damage
    set(s => ({
      battles: {
        ...s.battles,
        [battleId]: {
          ...s.battles[battleId],
          [side]: {
            ...s.battles[battleId][side],
            damageDealt: (s.battles[battleId][side].damageDealt || 0) + burstDamage,
          },
          missileCooldowns: {
            ...(s.battles[battleId].missileCooldowns || {}),
            [countryCode]: now,
          },
          combatLog: [
            ...s.battles[battleId].combatLog,
            {
              tick: s.battles[battleId].ticksElapsed,
              timestamp: now,
              type: 'damage' as const,
              side,
              message: `🚀 MISSILE LAUNCHED by ${player.name}! ${burstDamage.toLocaleString()} burst damage! (Lv.${level})`,
            },
          ],
          damageFeed: [
            { playerName: player.name, side, amount: burstDamage, isCrit: true, isDodged: false, time: now },
            ...(s.battles[battleId].damageFeed || []),
          ].slice(0, 20),
        },
      },
    }))

    return { success: true, message: `🚀 Missile launched! ${burstDamage.toLocaleString()} damage dealt!` }
  },

  // ====== BATTLE LAUNCH (server-authoritative) ======
  launchAttack: async (attackerId, defenderId, regionName, type = 'invasion', regionId?) => {
    // Check for existing active battle in this region
    const existing = Object.values(get().battles).find(b => b.regionName === regionName && b.status === 'active')
    if (existing) return

    try {
      const { launchBattle, getBattle } = await import('../api/client')
      const res: any = await launchBattle(attackerId, defenderId, regionName, type)

      if (!res?.success || !res?.battleId) {
        console.warn('[Battle] Server launch failed:', res?.message || res?.error || 'Unknown error')
        return
      }

      // Server created the battle — now fetch full state and inject into store
      const serverId = res.battleId
      try {
        const full = await getBattle(serverId)
        if (full?.success && full?.battle) {
          set((state) => ({ battles: { ...state.battles, [serverId]: full.battle } }))
          return
        }
      } catch { /* getBattle failed — create a local shell instead */ }

      // Fallback: create local battle with server's ID
      const battle = mkBattle(serverId, attackerId, defenderId, regionName, type, regionId)
      set((state) => ({ battles: { ...state.battles, [serverId]: battle } }))
    } catch (err: any) {
      console.warn('[Battle] Server launch error:', err?.message || err)
      // Fallback: create local-only battle so UI still shows something
      const localId = `battle_${Date.now()}_${regionName.replace(/\s+/g, '_')}`
      const battle = mkBattle(localId, attackerId, defenderId, regionName, type, regionId)
      set((state) => ({ battles: { ...state.battles, [localId]: battle } }))
    }
  },

  // ====== BATTLE LAUNCH ======
  launchHOIBattle: (attackerArmyId, defenderCountryCode, type = 'invasion') => {
    const armyStore = useArmyStore.getState()
    const attackerArmy = armyStore.armies[attackerArmyId]
    if (!attackerArmy) return { success: false, message: 'Army not found.' }

    const attackerDivs = attackerArmy.divisionIds
      .map((id: string) => armyStore.divisions[id])
      .filter((d: Division | undefined): d is Division => !!d && d.status === 'ready')

    if (attackerDivs.length === 0) return { success: false, message: 'No ready divisions in this army.' }

    const world = useWorldStore.getState()
    if (!world.canAttack(attackerArmy.countryCode, defenderCountryCode)) {
      return { success: false, message: 'Cannot attack: no adjacency or not at war.' }
    }

    const dist = getCountryDistance(attackerArmy.countryCode, defenderCountryCode)
    const cost = getAttackOilCost(dist)
    if (attackerArmy.vault.oil < cost) {
      return { success: false, message: `Not enough oil in Army Vault. Needs ${cost}🛢️.` }
    }

    // Auto-defense: fetch all ready divisions for the defending country (across all armies + unassigned)
    const allDefenderDivs = (Object.values(armyStore.divisions) as Division[])
      .filter((d: Division) => d.countryCode === defenderCountryCode && d.status === 'ready')
    const defenderDivIds = allDefenderDivs.map((d: Division) => d.id)

    const id = `hoi_battle_${Date.now()}`
    const now = Date.now()
    const targetName = getCountryName(defenderCountryCode)
    const atkDivIds = attackerDivs.map((d: Division) => d.id)

    const battle: Battle = {
      id, type, attackerId: attackerArmy.countryCode, defenderId: defenderCountryCode,
      regionName: targetName, startedAt: now,
      ticksElapsed: 0, status: 'active',

      attacker: {
        countryCode: attackerArmy.countryCode,
        divisionIds: atkDivIds,
        engagedDivisionIds: atkDivIds,
        damageDealt: 0, manpowerLost: 0,
        divisionsDestroyed: 0, divisionsRetreated: 0,
      },
      defender: {
        countryCode: defenderCountryCode,
        divisionIds: defenderDivIds,
        engagedDivisionIds: defenderDivIds,
        damageDealt: 0, manpowerLost: 0,
        divisionsDestroyed: 0, divisionsRetreated: 0,
      },

      attackerRoundsWon: 0, defenderRoundsWon: 0,
      rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: now }],
      currentTick: { attackerDamage: 0, defenderDamage: 0 },
      combatLog: [{
        tick: 0, timestamp: now, type: 'phase_change', side: 'attacker',
        message: `⚔️ Battle for ${targetName} begins! ${attackerDivs.length} vs ${defenderDivIds.length} divisions.`,
      }],
      attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [],
      divisionCooldowns: {},
      attackerOrder: 'none' as TacticalOrder,
      defenderOrder: 'none' as TacticalOrder,
      orderMessage: '',
      motd: '',
      playerAdrenaline: {},
      playerSurge: {},
      playerCrash: {},
      playerAdrenalinePeakAt: {},
      vengeanceBuff: { attacker: -1, defender: -1 },
      mercenaryContracts: [],
      weaponPresence: { attacker: {}, defender: {} },
    }

    // Mark divisions as in_combat
    attackerDivs.forEach((d: Division) => {
      useArmyStore.setState((s: any) => ({
        divisions: { ...s.divisions, [d.id]: { ...s.divisions[d.id], status: 'in_combat' } }
      }))
    })
    defenderDivIds.forEach(divId => {
      const div = armyStore.divisions[divId]
      if (div) {
        useArmyStore.setState((s: any) => ({
          divisions: { ...s.divisions, [divId]: { ...s.divisions[divId], status: 'in_combat' } }
        }))
      }
    })

    // Deduct oil cost
    useArmyStore.setState((s: any) => {
      const armyToUpdate = s.armies[attackerArmyId]
      if (!armyToUpdate) return s
      return {
        armies: {
          ...s.armies,
          [attackerArmyId]: {
            ...armyToUpdate,
            vault: { ...armyToUpdate.vault, oil: armyToUpdate.vault.oil - cost }
          }
        }
      }
    })

    set(state => ({ battles: { ...state.battles, [id]: battle } }))

    return { success: true, message: `Battle for ${targetName} has begun!`, battleId: id }
  },

  // ====== ADD DAMAGE ======
  addDamage: (battleId, side, amount, isCrit, isDodged, playerName) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return state

    const now = Date.now()
    const { currentTick, attackerDamageDealers, defenderDamageDealers, damageFeed } = battle

    let finalAmount = amount

    // ── Anti-exploit: cap max damage per addDamage call ──
    const MAX_DAMAGE_PER_CALL = 50000
    if (finalAmount > MAX_DAMAGE_PER_CALL) {
      console.warn(`[AntiExploit] addDamage capped: ${finalAmount} → ${MAX_DAMAGE_PER_CALL} for ${playerName}`)
      finalAmount = MAX_DAMAGE_PER_CALL
    }
    if (finalAmount <= 0 || !Number.isFinite(finalAmount)) return state

    // Apply battle order buff
    // Apply tactical order buff for the side
    const sideOrder = side === 'attacker' ? battle.attackerOrder : battle.defenderOrder
    const orderFx = TACTICAL_ORDERS[sideOrder || 'none'].effects
    finalAmount = Math.round(finalAmount * orderFx.atkMult)

    // ── #8 FIX: Symmetric infra bonus — both sides get military base bonus ──
    const world = useWorldStore.getState()
    const sideCountryCode = side === 'attacker' ? battle.attackerId : battle.defenderId
    const sideCountry = world.countries.find(c => c.code === sideCountryCode)
    if (sideCountry && sideCountry.militaryBaseLevel > 0) {
      finalAmount = Math.round(finalAmount * (1 + 0.05 + Math.random() * 0.15))
    }

    // ── Tactical Ops: Air Strike (+30%) / Naval Strike (+25%) damage bonus ──
    try {
      const { useTacticalOpsStore } = require('./tacticalOpsStore')
      const enemyCode = side === 'attacker' ? battle.defenderId : battle.attackerId
      const enemyEffects = useTacticalOpsStore.getState().getActiveEffectsForCountry(enemyCode)
      const hasAirStrike = enemyEffects.some((e: any) => e.effectType === 'air_strike')
      const hasNavalStrike = enemyEffects.some((e: any) => e.effectType === 'naval_strike')
      if (hasAirStrike) finalAmount = Math.round(finalAmount * 1.30)
      if (hasNavalStrike) finalAmount = Math.round(finalAmount * 1.25)
    } catch (_) { /* tacticalOpsStore not available */ }

    const newAttackerDealers = { ...attackerDamageDealers }
    const newDefenderDealers = { ...defenderDamageDealers }
    if (side === 'attacker') {
      newAttackerDealers[playerName] = (newAttackerDealers[playerName] || 0) + finalAmount
    } else {
      newDefenderDealers[playerName] = (newDefenderDealers[playerName] || 0) + finalAmount
    }

    const newFeed = [{ playerName, side, amount: finalAmount, isCrit, isDodged, time: now }, ...damageFeed].slice(0, 20)

    // --- 5% of manual damage hurts opposing divisions (x0.05 splash) ---
    const splashDmg = Math.floor(finalAmount * 0.05)
    if (splashDmg > 0) {
      const armyStore = useArmyStore.getState()
      const oppositeDivIds = side === 'attacker'
        ? battle.defender.engagedDivisionIds
        : battle.attacker.engagedDivisionIds
      const aliveDivs = oppositeDivIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'recovering'
      })
      if (aliveDivs.length > 0) {
        const perDiv = Math.max(1, Math.floor(splashDmg / aliveDivs.length))
        aliveDivs.forEach(id => armyStore.applyBattleDamage(id, perDiv, 0))
      }
    }

    // --- Quick Battle: award ground points + check victory on every player hit ---
    const updatedBattle = {
      ...battle,
      attacker: side === 'attacker' ? {
        ...battle.attacker,
        damageDealt: (battle.attacker.damageDealt || 0) + finalAmount,
      } : battle.attacker,
      defender: side === 'defender' ? {
        ...battle.defender,
        damageDealt: (battle.defender.damageDealt || 0) + finalAmount,
      } : battle.defender,
      attackerDamageDealers: newAttackerDealers,
      defenderDamageDealers: newDefenderDealers,
      damageFeed: newFeed,
      currentTick: {
        ...currentTick,
        attackerDamage: side === 'attacker' ? currentTick.attackerDamage + finalAmount : currentTick.attackerDamage,
        defenderDamage: side === 'defender' ? currentTick.defenderDamage + finalAmount : currentTick.defenderDamage,
      },
    }

    // For quick battles: award ground points per hit and check victory
    if (battle.type === 'quick_battle') {
      const roundIdx = updatedBattle.rounds.length - 1
      const round = { ...updatedBattle.rounds[roundIdx] }
      // Award 1-3 points per hit based on damage dealt
      const pts = finalAmount >= 500 ? 3 : finalAmount >= 200 ? 2 : 1
      if (side === 'attacker') round.attackerPoints += pts
      else round.defenderPoints += pts

      const winPts = QB_POINTS_TO_WIN_ROUND
      let newStatus = updatedBattle.status
      let atkRounds = updatedBattle.attackerRoundsWon
      let defRounds = updatedBattle.defenderRoundsWon

      if (round.attackerPoints >= winPts || round.defenderPoints >= winPts) {
        round.endedAt = now
        if (round.attackerPoints >= winPts) { atkRounds++; round.status = 'attacker_won' }
        else { defRounds++; round.status = 'defender_won' }
        if (atkRounds >= QB_ROUNDS_TO_WIN_BATTLE) newStatus = 'attacker_won'
        else if (defRounds >= QB_ROUNDS_TO_WIN_BATTLE) newStatus = 'defender_won'
      }

      updatedBattle.rounds = [...updatedBattle.rounds.slice(0, -1), round]
      updatedBattle.status = newStatus
      updatedBattle.attackerRoundsWon = atkRounds
      updatedBattle.defenderRoundsWon = defRounds

      // Award rewards when quick battle resolves
      if (newStatus !== 'active') {
        try {
          const ps = usePlayerStore.getState()
          const playerCountry = ps.countryCode || 'US'
          const isAttacker = playerCountry === updatedBattle.attackerId
          const isDefender = playerCountry === updatedBattle.defenderId
          const playerWon = (newStatus === 'attacker_won' && isAttacker) || (newStatus === 'defender_won' && isDefender)

          // Check if player participated
          const playerDmgAtk = updatedBattle.attackerDamageDealers[ps.name] || 0
          const playerDmgDef = updatedBattle.defenderDamageDealers[ps.name] || 0
          const myDmg = playerDmgAtk + playerDmgDef

          if (myDmg > 0) {
            if (playerWon) {
              // Winner: 1 bitcoin + 1 military case
              set((s) => {
                const p = usePlayerStore.getState()
                usePlayerStore.setState({
                  bitcoin: p.bitcoin + 1,
                  militaryBoxes: p.militaryBoxes + 1,
                })
                return s
              })
            } else {
              // Loser consolation: small money from damage dealt
              const consolation = Math.floor(myDmg * 0.05)
              if (consolation > 0) ps.earnMoney(consolation)
            }
          }
        } catch (e) {
          console.warn('[QuickBattle] Error awarding rewards:', e)
        }
      }
    }

    return {
      battles: {
        ...state.battles,
        [battleId]: updatedBattle,
      },
    }
  }),

  // ====== COMBAT TICK PROCESSOR (uses player stats × division multipliers) ======
  // ══ PLAYER COMBAT TICK: awards ground points from manual attacks (independent of ENABLE_DIVISIONS) ══
  processPlayerCombatTick: () => {
    const state = get()
    const now = Date.now()
    const newBattles = { ...state.battles }
    let hasChanges = false

    Object.values(newBattles).forEach(battle => {
      if (battle.status !== 'active') return

      const atkPlayerDmg = battle.currentTick?.attackerDamage || 0
      const defPlayerDmg = battle.currentTick?.defenderDamage || 0

      // Only process if there's actual player damage this tick
      if (atkPlayerDmg <= 0 && defPlayerDmg <= 0) return

      hasChanges = true
      const tick = (battle.ticksElapsed || 0) + 1
      const activeRoundIndex = battle.rounds.length - 1
      const activeRound = { ...battle.rounds[activeRoundIndex] }
      const isQB = battle.type === 'quick_battle'
      const maxP = isQB ? QB_POINTS_TO_WIN_ROUND : POINTS_TO_WIN_ROUND
      const maxRounds = isQB ? QB_ROUNDS_TO_WIN_BATTLE : ROUNDS_TO_WIN_BATTLE
      const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
      const pointIncrement = getPointIncrement(totalGroundPoints)

      // Accumulate this tick's damage into per-round totals
      activeRound.attackerRoundDmg = (activeRound.attackerRoundDmg || 0) + atkPlayerDmg
      activeRound.defenderRoundDmg = (activeRound.defenderRoundDmg || 0) + defPlayerDmg

      // Award ground points based on ROUND-LONG damage with 50%+ threshold
      const totalRoundDmg = (activeRound.attackerRoundDmg || 0) + (activeRound.defenderRoundDmg || 0)
      if (totalRoundDmg > 0) {
        const atkRoundPct = (activeRound.attackerRoundDmg || 0) / totalRoundDmg
        const defRoundPct = (activeRound.defenderRoundDmg || 0) / totalRoundDmg
        if (atkRoundPct > 0.5) {
          activeRound.attackerPoints += pointIncrement
        } else if (defRoundPct > 0.5) {
          activeRound.defenderPoints += pointIncrement
        }
        // If exactly 50/50, no points awarded (stalemate)
      }

      let newRounds = [...battle.rounds.slice(0, -1), activeRound]
      let newStatus: 'active' | 'attacker_won' | 'defender_won' = battle.status
      let atkRoundsWon = battle.attackerRoundsWon
      let defRoundsWon = battle.defenderRoundsWon
      const newCombatLog = [...battle.combatLog]

      // Check round completion
      if (activeRound.attackerPoints >= maxP || activeRound.defenderPoints >= maxP) {
        activeRound.endedAt = now
        activeRound.ticksElapsed = tick
        activeRound.attackerDmgTotal = activeRound.attackerRoundDmg || 0
        activeRound.defenderDmgTotal = activeRound.defenderRoundDmg || 0
        if (activeRound.attackerPoints >= maxP) { atkRoundsWon++; activeRound.status = 'attacker_won' }
        else { defRoundsWon++; activeRound.status = 'defender_won' }

        if (atkRoundsWon >= maxRounds) {
          newStatus = 'attacker_won'
          if (battle.type === 'invasion') useWorldStore.getState().occupyCountry(battle.defenderId, battle.attackerId, false)
          if (battle.type === 'revolt' && battle.regionId) useRegionStore.getState().liberateRegion(battle.regionId)
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `⚔️ VICTORY! ${getCountryName(battle.attackerId)} captures ${battle.regionName}!` })
        } else if (defRoundsWon >= maxRounds) {
          newStatus = 'defender_won'
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'defender', message: `🛡️ DEFENSE HOLDS! ${getCountryName(battle.defenderId)} defends ${battle.regionName}!` })
        } else {
          // New round
          newRounds = [...newRounds, { attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: now }]
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `🔔 Round ${battle.rounds.length} complete! New round begins.` })
        }
      }

      newBattles[battle.id] = {
        ...battle,
        ticksElapsed: tick,
        status: newStatus,
        attackerRoundsWon: atkRoundsWon,
        defenderRoundsWon: defRoundsWon,
        rounds: newRounds,
        currentTick: { attackerDamage: 0, defenderDamage: 0 },
        combatLog: newCombatLog.slice(-60),
      }
    })

    if (hasChanges) set({ battles: newBattles })
  },

  // ══ HOI COMBAT TICK (division combat — only runs with ENABLE_DIVISIONS) ══
  processHOICombatTick: () => {
    const state = get()
    const armyStore = useArmyStore.getState()
    const now = Date.now()
    const playerStats = getBaseSkillStats()  // Base + skills only for division combat
    const playerName = usePlayerStore.getState().name || 'Commander'

    const newBattles = { ...state.battles }
    let hasChanges = false

    // Decrement HERO buff timer each combat tick
    const heroTicks = usePlayerStore.getState().heroBuffTicksLeft
    if (heroTicks > 0) {
      const newTicks = heroTicks - 1
      usePlayerStore.setState({ heroBuffTicksLeft: newTicks, ...(newTicks === 0 ? { heroBuffBattleId: null } : {}) })
    }

    Object.values(newBattles).forEach(battle => {
      if (battle.status !== 'active') return
      // Quick battles are pure PvP — skip division combat entirely
      if (battle.type === 'quick_battle') return

      hasChanges = true
      const tick = battle.ticksElapsed + 1
      const newCombatLog = [...battle.combatLog]

      // --- Snapshot engaged divisions BEFORE auto-deploy (anti-exploit) ---
      // Divisions deployed mid-tick won't fire until the next tick
      const snapshotAtkDivIds = [...battle.attacker.engagedDivisionIds]
      const snapshotDefDivIds = [...battle.defender.engagedDivisionIds]

      // --- Auto-deploy: if a side has no engaged divisions, auto-deploy available ones ---
      const autoDeploySide = (side: 'attacker' | 'defender') => {
        const sideData = side === 'attacker' ? battle.attacker : battle.defender
        if (sideData.engagedDivisionIds.length > 0) return  // already has engaged divisions

        // ── #10 FIX: Cross-validate country code matches battle side ──
        const expectedCountry = side === 'attacker' ? battle.attackerId : battle.defenderId
        if (sideData.countryCode !== expectedCountry) return
        const govStore = useGovernmentStore.getState()
        const gov = govStore.governments[expectedCountry]
        const armedForceIds = (side === 'defender' && gov?.armedForces) ? gov.armedForces : []
        const countryAutoDefLimit = govStore.autoDefenseLimit  // -1 = all, 0 = off, N = cap

        // Collect eligible divisions by source
        let eligible: string[] = []

        if (side === 'attacker') {
          // Attackers: deploy all ready divisions for the country
          eligible = (Object.values(armyStore.divisions) as Division[])
            .filter((d: Division) => d.countryCode === expectedCountry && (d.status === 'ready' || d.status === 'in_combat') && d.health > 0)
            .map((d: Division) => d.id)
        } else {
          // Defenders: respect autodefense limits

          // 1) Armed Forces ALWAYS deploy (not subject to country limit)
          const afEligible = (Object.values(armyStore.divisions) as Division[])
            .filter((d: Division) => d.countryCode === expectedCountry && (d.status === 'ready' || d.status === 'in_combat') && d.health > 0
              && armedForceIds.includes(d.id))
            .map((d: Division) => d.id)

          // 2) Per-army autodefense: collect divisions from armies with autoDefenseLimit != 0
          const armyEligible: string[] = []
          ;(Object.values(armyStore.armies) as any[]).forEach((army: any) => {
            if (army.countryCode !== expectedCountry) return
            if (army.autoDefenseLimit === 0) return  // this army has autodefense OFF
            const armyReadyDivs = army.divisionIds.filter((did: string) => {
              const d = armyStore.divisions[did]
              return d && (d.status === 'ready' || d.status === 'in_combat') && d.health > 0
                && !armedForceIds.includes(did)  // don't double-count armed forces
            })
            if (army.autoDefenseLimit === -1) {
              armyEligible.push(...armyReadyDivs)
            } else {
              armyEligible.push(...armyReadyDivs.slice(0, army.autoDefenseLimit))
            }
          })

          // 3) Country-level unassigned divisions (not in any army) — only if country limit allows
          const unassignedEligible = countryAutoDefLimit !== 0
            ? (Object.values(armyStore.divisions) as Division[])
                .filter((d: Division) => d.countryCode === expectedCountry && (d.status === 'ready' || d.status === 'in_combat') && d.health > 0
                  && !armedForceIds.includes(d.id)
                  && (d.stance === 'first_line_defense' || d.stance === 'unassigned')
                  && !(Object.values(armyStore.armies) as any[]).some((a: any) => a.divisionIds.includes(d.id)))
                .map((d: Division) => d.id)
            : []

          // Combine: armed forces + army contributions + unassigned
          eligible = [...afEligible]
          const nonAf = [...armyEligible, ...unassignedEligible]

          // Apply country-level limit to non-armed-force divisions
          if (countryAutoDefLimit === 0) {
            // Only armed forces deploy
          } else if (countryAutoDefLimit === -1) {
            eligible.push(...nonAf)
          } else {
            eligible.push(...nonAf.slice(0, countryAutoDefLimit))
          }
        }

        if (eligible.length === 0) return
        const ids = eligible
        // Mark as in_combat with deployedAtTick for recall cooldown
        const currentTick = battle.ticksElapsed || 0
        ids.forEach(id => {
          useArmyStore.setState((s: any) => ({
            divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'in_combat', deployedAtTick: currentTick } }
          }))
        })
        sideData.divisionIds = [...new Set([...sideData.divisionIds, ...ids])]
        sideData.engagedDivisionIds = [...new Set([...sideData.engagedDivisionIds, ...ids])]
        const afCount = ids.filter(id => armedForceIds.includes(id)).length
        const playerCount = ids.length - afCount
        const parts: string[] = []
        if (playerCount > 0) parts.push(`${playerCount} ${side} division(s)`)
        if (afCount > 0) parts.push(`${afCount} Armed Forces reserve(s)`)
        newCombatLog.push({
          tick, timestamp: now, type: 'reinforcement' as const, side,
          message: `🚀 ${parts.join(' + ')} auto-deployed!`,
        })
      }
      autoDeploySide('attacker')
      autoDeploySide('defender')

      // --- Get alive divisions from SNAPSHOT (prevents deploy-last-second exploit) ---
      const atkDivIds = snapshotAtkDivIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'recovering'
      })
      const defDivIds = snapshotDefDivIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'recovering'
      })

      // --- Compute Army Composition Aura for both sides ---
      const findArmyForDiv = (divId: string) => {
        return (Object.values(armyStore.armies) as any[]).find((a: any) => a.divisionIds.includes(divId))
      }
      const atkArmy = atkDivIds.length > 0 ? findArmyForDiv(atkDivIds[0]) : null
      const defArmy = defDivIds.length > 0 ? findArmyForDiv(defDivIds[0]) : null
      const atkAura = atkArmy ? armyStore.getCompositionAura(atkArmy.id) : { critDmgPct: 0, dodgePct: 0, attackPct: 0, precisionPct: 0 }
      const defAura = defArmy ? armyStore.getCompositionAura(defArmy.id) : { critDmgPct: 0, dodgePct: 0, attackPct: 0, precisionPct: 0 }

      // --- Random ±10% deviation for combat variability ---
      const deviate = (v: number) => v * (0.9 + Math.random() * 0.2)

      // --- Military Doctrine research bonuses (fetched once per tick) ---
      const atkMilBonus = useResearchStore.getState().getMilitaryBonuses(battle.attackerId)
      const defMilBonus = useResearchStore.getState().getMilitaryBonuses(battle.defenderId)

      // --- Ley Line corridor bonuses (fetched once per tick) ---
      const atkLeyLine = computeLeyLineCombatMods(battle.attackerId)
      const defLeyLine = computeLeyLineCombatMods(battle.defenderId)

      // --- Revolt Homeland Bonus (attacker = revolting native country) ---
      let revoltAtkMult = 1
      let revoltDodgeMult = 1
      if (battle.type === 'revolt' && battle.regionId) {
        const bonus = useRegionStore.getState().getHomelandBonus(battle.regionId)
        revoltAtkMult = bonus.atkMult      // up to 1.20
        revoltDodgeMult = bonus.dodgeMult   // up to 1.15
      }

      // --- ATTACKER DAMAGE (player stats × division template multipliers) ---
      // Attack speed accumulator: add 1.0 per tick, fire when accum >= attackSpeed
      const cooldowns = { ...(battle.divisionCooldowns || {}) }
      let atkTotalDmg = 0
      let atkCrits = 0
      let atkMisses = 0
      // Per-division event tracking for real-time log
      const divEvents: { divName: string; side: 'atk' | 'def'; event: 'miss' | 'crit' | 'dodge'; dmg?: number }[] = []
      atkDivIds.forEach(divId => {
        const div = armyStore.divisions[divId]
        if (!div) return
        const template = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
        if (!template) { console.warn('[Combat] Unknown division type:', div.type, 'for div', divId); return }

        // Tactical order effects for attacker
        const atkOrd = TACTICAL_ORDERS[battle.attackerOrder || 'none'].effects
        // Apply star quality modifiers to template stats
        const sm = div.statModifiers || { atkDmgMult: 0, hitRate: 0, critRateMult: 0, critDmgMult: 0, healthMult: 0, dodgeMult: 0, armorMult: 0, attackSpeed: 0 }
        const tAtkDmg = template.atkDmgMult * (1 + sm.atkDmgMult)
        const tHitRate = template.hitRate * (1 + sm.hitRate)
        const tCritRate = template.critRateMult * (1 + sm.critRateMult)
        const tCritDmg = template.critDmgMult * (1 + sm.critDmgMult)
        const tAtkSpeed = (template.attackSpeed || 1.0) * (1 + sm.attackSpeed)
        // Equipment bonuses for this division
        const eq = getDivisionEquipBonus(div)
        // Accumulate time — fire as many times as attackSpeed allows (order speedMult)
        const as = (tAtkSpeed - eq.bonusSpeed) * atkOrd.speedMult
        cooldowns[divId] = (cooldowns[divId] || 0) + 1.0

        // 🔥 DESPERATION: +25% ATK, +15% crit when HP < 30%
        const atkStrength = div.health / div.maxHealth
        const atkDesperate = atkStrength > 0 && atkStrength < 0.30
        // ⚡ VENGEANCE: +20% ATK, +10% hit for 3 ticks after ally dies
        const atkVengeanceActive = (battle.vengeanceBuff?.attacker ?? -1) >= tick

        while (cooldowns[divId] >= as) {
          cooldowns[divId] -= as
          const atkDivLevel = Math.floor((div.experience || 0) / 10)
          // Hit check (order hitBonus + aura precisionPct + equip hitRate + research hitRate + vengeance applied)
          const atkVengeanceHitBonus = atkVengeanceActive ? 0.10 : 0
          if (Math.random() > Math.min(0.95, tHitRate + atkDivLevel * 0.01 + atkOrd.hitBonus + atkAura.precisionPct / 100 + eq.bonusHitRate + atkMilBonus.hitRateBonus + atkVengeanceHitBonus)) {
            atkMisses++
            divEvents.push({ divName: div.name, side: 'atk', event: 'miss' })
            continue
          }
          // Base damage: player attack + manpower×3 + equipAtk, scaled by division's attack mult
          let dmg = Math.floor((playerStats.attackDamage + div.manpower * 3 + eq.bonusAtk) * (tAtkDmg + atkDivLevel * 0.01))
          // Apply aura attack bonus
          dmg = Math.floor(dmg * (1 + atkAura.attackPct / 100))
          // Apply HERO buff (+10%) if division owner has active buff on THIS battle
          const ps = usePlayerStore.getState()
          const atkOwnerBuff = div.ownerId === ps.name && ps.heroBuffTicksLeft > 0 && ps.heroBuffBattleId === battle.id
          if (atkOwnerBuff) dmg = Math.floor(dmg * 1.10)
          // Crit check — Desperation boosts crit rate by 15%
          let effectiveCritRate = deviate((playerStats.critRate + atkOrd.critBonus + eq.bonusCritRate) * (tCritRate + atkDivLevel * 0.01))
          if (atkDesperate) effectiveCritRate *= 1.15
          if (Math.random() * 100 < effectiveCritRate) {
            // Apply aura crit damage bonus + equip crit dmg
            const effectiveCritMult = playerStats.critMultiplier * (tCritDmg + atkDivLevel * 0.01) * (1 + atkAura.critDmgPct / 100) * atkMilBonus.critDmgBonus + eq.bonusCritDmg / 100
            dmg = Math.floor(dmg * effectiveCritMult)
            atkCrits++
            divEvents.push({ divName: div.name, side: 'atk', event: 'crit', dmg })
          }
          dmg = Math.floor(dmg * atkStrength)
          dmg = Math.floor(dmg * atkOrd.atkMult)
          // 🔥 DESPERATION: +25% ATK boost
          if (atkDesperate) dmg = Math.floor(dmg * 1.25)
          // ⚡ VENGEANCE: +20% ATK boost
          if (atkVengeanceActive) dmg = Math.floor(dmg * 1.20)
          // Apply Alliance Vanguard Bonus (dynamic, scales with level)
          const atkAllianceState = useAllianceStore.getState()
          const atkAlliance = atkAllianceState.alliances.find(a => a.members.some(m => m.name === battle.attackerId))
          const allianceAtkMult = atkAlliance?.activeIdeology === 'vanguard' ? getIdeologyBonus(atkAlliance) : 1

          // Apply ±10% deviation to final damage, then apply Military Doctrine research bonus + revolt bonus + Ley Line
          dmg = Math.floor(deviate(dmg) * atkMilBonus.attackDamageBonus * atkMilBonus.allCombatBonus * revoltAtkMult * allianceAtkMult * atkLeyLine.damageMult)
          atkTotalDmg += Math.max(1, dmg)
        }
      })

      // --- Experience gain: +0.5 per tick for engaged attacker divisions ---
      atkDivIds.forEach(divId => {
        const d = armyStore.divisions[divId]
        if (d && d.experience < 100) {
          useArmyStore.setState((s: any) => ({
            divisions: { ...s.divisions, [divId]: { ...s.divisions[divId], experience: Math.min(100, d.experience + 0.5) } }
          }))
        }
      })

      // --- DEFENDER DAMAGE (symmetric: same formula with attack speed accumulator) ---
      let defTotalDmg = 0
      let defCrits = 0
      let defMisses = 0
      defDivIds.forEach(divId => {
        const d = armyStore.divisions[divId]
        if (!d) return
        const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
        if (!template) { console.warn('[Combat] Unknown defender div type:', d.type, 'for div', divId); return }

        // Tactical order effects for defender
        const defOrd = TACTICAL_ORDERS[battle.defenderOrder || 'none'].effects
        // Apply star quality modifiers to template stats
        const dsm = d.statModifiers || { atkDmgMult: 0, hitRate: 0, critRateMult: 0, critDmgMult: 0, healthMult: 0, dodgeMult: 0, armorMult: 0, attackSpeed: 0 }
        const dAtkDmg = template.atkDmgMult * (1 + dsm.atkDmgMult)
        const dHitRate = template.hitRate * (1 + dsm.hitRate)
        const dCritRate = template.critRateMult * (1 + dsm.critRateMult)
        const dCritDmg = template.critDmgMult * (1 + dsm.critDmgMult)
        const dAtkSpeed = (template.attackSpeed || 1.0) * (1 + dsm.attackSpeed)
        // Equipment bonuses for defender division
        const deq = getDivisionEquipBonus(d)
        const defAS = (dAtkSpeed - deq.bonusSpeed) * defOrd.speedMult
        cooldowns[divId] = (cooldowns[divId] || 0) + 1.0

        // 🔥 DESPERATION: +25% ATK, +15% crit when HP < 30%
        const defStrength = d.health / d.maxHealth
        const defDesperate = defStrength > 0 && defStrength < 0.30
        // ⚡ VENGEANCE: +20% ATK, +10% hit for 3 ticks after ally dies
        const defVengeanceActive = (battle.vengeanceBuff?.defender ?? -1) >= tick

        while (cooldowns[divId] >= defAS) {
          cooldowns[divId] -= defAS
          const defDivLevel = Math.floor((d.experience || 0) / 10)
          // Hit check (order hitBonus + aura precisionPct + equip hitRate + research hitRate + vengeance applied)
          const defVengeanceHitBonus = defVengeanceActive ? 0.10 : 0
          if (Math.random() > Math.min(0.95, dHitRate + defDivLevel * 0.01 + defOrd.hitBonus + defAura.precisionPct / 100 + deq.bonusHitRate + defMilBonus.hitRateBonus + defVengeanceHitBonus)) {
            defMisses++
            divEvents.push({ divName: d.name, side: 'def', event: 'miss' })
            continue
          }
          // Base damage: player attack + manpower×3 + equipAtk, scaled by division's attack mult
          let dmg = Math.floor((playerStats.attackDamage + d.manpower * 3 + deq.bonusAtk) * (dAtkDmg + defDivLevel * 0.01))
          // Apply aura attack bonus
          dmg = Math.floor(dmg * (1 + defAura.attackPct / 100))
          // Apply HERO buff (+10%) if division owner has active buff on THIS battle
          const dps = usePlayerStore.getState()
          const defOwnerBuff = d.ownerId === dps.name && dps.heroBuffTicksLeft > 0 && dps.heroBuffBattleId === battle.id
          if (defOwnerBuff) dmg = Math.floor(dmg * 1.10)
          // Crit check — Desperation boosts crit rate by 15%
          let effectiveCritRate = deviate((playerStats.critRate + defOrd.critBonus + deq.bonusCritRate) * (dCritRate + defDivLevel * 0.01))
          if (defDesperate) effectiveCritRate *= 1.15
          if (Math.random() * 100 < effectiveCritRate) {
            // Apply aura crit damage bonus + equip crit dmg
            const effectiveCritMult = playerStats.critMultiplier * (dCritDmg + defDivLevel * 0.01) * (1 + defAura.critDmgPct / 100) * defMilBonus.critDmgBonus + deq.bonusCritDmg / 100
            dmg = Math.floor(dmg * effectiveCritMult)
            defCrits++
            divEvents.push({ divName: d.name, side: 'def', event: 'crit', dmg })
          }
          dmg = Math.floor(dmg * defStrength)
          dmg = Math.floor(dmg * defOrd.atkMult)
          // 🔥 DESPERATION: +25% ATK boost
          if (defDesperate) dmg = Math.floor(dmg * 1.25)
          // ⚡ VENGEANCE: +20% ATK boost
          if (defVengeanceActive) dmg = Math.floor(dmg * 1.20)
          // Apply Alliance Sentinel Bonus (dynamic, scales with level)
          const defAllianceState = useAllianceStore.getState()
          const defAlliance = defAllianceState.alliances.find(a => a.members.some(m => m.name === battle.defenderId))
          const allianceDefMult = defAlliance?.activeIdeology === 'sentinel' ? getIdeologyBonus(defAlliance) : 1

          // Apply ±10% deviation to final damage, then apply Military Doctrine research bonus + Ley Line
          dmg = Math.floor(deviate(dmg) * defMilBonus.attackDamageBonus * defMilBonus.allCombatBonus * allianceDefMult * defLeyLine.damageMult)
          defTotalDmg += Math.max(1, dmg)
        }
      })

      // --- Pre-compute per-division defensive hits (for staggered real-time application) ---
      // Collect hits with side info so damage bar can animate per-hit
      const hitSchedule: { divId: string; divName: string; damage: number; equipDmg: number; side: 'atk' | 'def'; displayDmg: number; isCrit: boolean }[] = []
      const manpowerDmgToDefender = Math.floor(atkTotalDmg * 0.80)
      const manpowerDmgToAttacker = Math.floor(defTotalDmg * 0.80)

      // Attacker hits defender divisions
      let defHitCount = 0
      if (defDivIds.length > 0 && manpowerDmgToDefender > 0) {
        const basePerDiv = Math.max(1, Math.floor(manpowerDmgToDefender / defDivIds.length))
        defDivIds.forEach(id => {
          const d = armyStore.divisions[id]
          if (!d) return
          const tmpl = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
          if (!tmpl) return
          const defOrderFx = TACTICAL_ORDERS[battle.defenderOrder || 'none'].effects
          // Aura dodge bonus + equip dodge for defending divisions + ±10% deviation
          const defEq = getDivisionEquipBonus(d)
          const dodgeChance = deviate((playerStats.dodgeChance || 5) * tmpl.dodgeMult * defOrderFx.dodgeMult * (1 + defAura.dodgePct / 100) + defEq.bonusDodge) / 100
          if (Math.random() < dodgeChance) {
            divEvents.push({ divName: d.name, side: 'atk', event: 'dodge' })
            return
          }
          const totalDefArmor = ((playerStats.armorBlock || 0) + defEq.bonusArmor) * tmpl.armorMult * defOrderFx.armorMult * defMilBonus.armorBonus * defLeyLine.armorMult
            * ((d.health / d.maxHealth) < 0.30 ? 0.90 : 1.0)  // 🔥 DESPERATION: -10% armor when HP < 30%
          const defArmorMit = totalDefArmor / (totalDefArmor + 100)
          let finalDmg = Math.max(1, Math.floor(basePerDiv * (1 - defArmorMit)))
          finalDmg = Math.max(1, Math.floor(finalDmg / 1.35)) // healthMult divider x1.35
          hitSchedule.push({ divId: id, divName: d.name, damage: finalDmg, equipDmg: 0.3, side: 'atk', displayDmg: 0, isCrit: false })
          defHitCount++
        })
      }
      // Defender hits attacker divisions
      let atkHitCount = 0
      if (atkDivIds.length > 0 && manpowerDmgToAttacker > 0) {
        const basePerDiv = Math.max(1, Math.floor(manpowerDmgToAttacker / atkDivIds.length))
        atkDivIds.forEach(id => {
          const d = armyStore.divisions[id]
          if (!d) return
          const tmpl = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
          if (!tmpl) return
          const atkOrderFx = TACTICAL_ORDERS[battle.attackerOrder || 'none'].effects
          // Aura dodge bonus + equip dodge for attacking divisions + ±10% deviation
          const atkEq = getDivisionEquipBonus(d)
          const dodgeChance = deviate((playerStats.dodgeChance || 5) * tmpl.dodgeMult * atkOrderFx.dodgeMult * (1 + atkAura.dodgePct / 100) + atkEq.bonusDodge) * revoltDodgeMult / 100
          if (Math.random() < dodgeChance) {
            divEvents.push({ divName: d.name, side: 'def', event: 'dodge' })
            return
          }
          const totalAtkArmor = ((playerStats.armorBlock || 0) + atkEq.bonusArmor) * tmpl.armorMult * atkOrderFx.armorMult * atkMilBonus.armorBonus * atkLeyLine.armorMult
            * ((d.health / d.maxHealth) < 0.30 ? 0.90 : 1.0)  // 🔥 DESPERATION: -10% armor when HP < 30%
          const atkArmorMit = totalAtkArmor / (totalAtkArmor + 100)
          let finalDmg = Math.max(1, Math.floor(basePerDiv * (1 - atkArmorMit)))
          finalDmg = Math.max(1, Math.floor(finalDmg / 1.35)) // healthMult divider x1.35
          hitSchedule.push({ divId: id, divName: d.name, damage: finalDmg, equipDmg: 0.3, side: 'def', displayDmg: 0, isCrit: false })
          atkHitCount++
        })
      }

      // Distribute raw display damage proportionally across hits
      // atk side: attacker dealt atkTotalDmg → distribute across defHitCount hits
      // def side: defender dealt defTotalDmg → distribute across atkHitCount hits
      let atkDmgRemaining = atkTotalDmg
      let defDmgRemaining = defTotalDmg
      let atkHitsSeen = 0, defHitsSeen = 0
      hitSchedule.forEach(hit => {
        if (hit.side === 'atk' && defHitCount > 0) {
          atkHitsSeen++
          if (atkHitsSeen === defHitCount) { hit.displayDmg = atkDmgRemaining } // last hit gets remainder
          else { const share = Math.floor(atkTotalDmg / defHitCount); hit.displayDmg = share; atkDmgRemaining -= share }
        } else if (hit.side === 'def' && atkHitCount > 0) {
          defHitsSeen++
          if (defHitsSeen === atkHitCount) { hit.displayDmg = defDmgRemaining }
          else { const share = Math.floor(defTotalDmg / atkHitCount); hit.displayDmg = share; defDmgRemaining -= share }
        }
      })

      // --- Stagger damage application across 14 seconds (real-time HP + damage bar updates) ---
      const battleId = battle.id
      if (hitSchedule.length > 0) {
        const TICK_SPREAD_MS = 14000
        const interval = Math.floor(TICK_SPREAD_MS / hitSchedule.length)
        // Shuffle hit order for visual variety
        for (let i = hitSchedule.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[hitSchedule[i], hitSchedule[j]] = [hitSchedule[j], hitSchedule[i]]
        }
        const applyHit = (hit: typeof hitSchedule[0]) => {
          useArmyStore.getState().applyBattleDamage(hit.divId, hit.damage, hit.equipDmg)
          // Push real-time per-division combat log entry
          useBattleStore.setState(s => {
            const b = s.battles[battleId]
            if (!b) return s
            const sideLabel = hit.side === 'atk' ? '⚔️' : '🛡️'
            const critTag = hit.isCrit ? ' 💥CRIT' : ''
            const logEntry = {
              tick, timestamp: Date.now(), type: 'damage' as const, side: hit.side === 'atk' ? 'attacker' as const : 'defender' as const,
              damage: hit.displayDmg,
              message: `${sideLabel} ${hit.divName} deals ${hit.displayDmg} dmg${critTag}`,
            }
            return {
              battles: { ...s.battles, [battleId]: {
                ...b,
                combatLog: [...b.combatLog.slice(-50), logEntry],
                currentTick: {
                  attackerDamage: b.currentTick.attackerDamage + (hit.side === 'atk' ? hit.displayDmg : 0),
                  defenderDamage: b.currentTick.defenderDamage + (hit.side === 'def' ? hit.displayDmg : 0),
                },
                attacker: {
                  ...b.attacker,
                  damageDealt: b.attacker.damageDealt + (hit.side === 'atk' ? hit.displayDmg : 0),
                },
                defender: {
                  ...b.defender,
                  damageDealt: b.defender.damageDealt + (hit.side === 'def' ? hit.displayDmg : 0),
                },
              }}
            }
          })
        }
        hitSchedule.forEach((hit, idx) => {
          // All hits are async (min 100ms) to fire AFTER end-of-tick state update
          const delay = Math.min(100 + idx * interval, TICK_SPREAD_MS)
          setTimeout(() => applyHit(hit), delay)
        })
        // Stagger miss/dodge events interleaved with hits
        const totalSlots = hitSchedule.length + divEvents.length
        const eventInterval = totalSlots > 0 ? Math.floor(TICK_SPREAD_MS / totalSlots) : 500
        divEvents.forEach((evt, idx) => {
          const delay = Math.min(100 + (hitSchedule.length + idx) * eventInterval, TICK_SPREAD_MS)
          setTimeout(() => {
            useBattleStore.setState(s => {
              const b = s.battles[battleId]
              if (!b) return s
              const icon = evt.event === 'miss' ? '❌' : evt.event === 'dodge' ? '💨' : '💥'
              const label = evt.event === 'miss' ? 'MISS' : evt.event === 'dodge' ? 'DODGE' : 'CRIT'
              const logEntry = {
                tick, timestamp: Date.now(), type: 'damage' as const,
                side: evt.side === 'atk' ? 'attacker' as const : 'defender' as const,
                message: `${icon} ${evt.divName} — ${label}${evt.dmg ? ` (${evt.dmg} dmg)` : ''}`,
              }
              return {
                battles: { ...s.battles, [battleId]: {
                  ...b,
                  combatLog: [...b.combatLog.slice(-50), logEntry],
                }}
              }
            })
          }, delay)
        })
      }

      // --- Combat log (tick summary — individual hits logged in real-time via applyHit) ---
      if (atkTotalDmg === 0 && defTotalDmg === 0 && atkDivIds.length === 0 && defDivIds.length === 0) {
        newCombatLog.push({
          tick, timestamp: now, type: 'phase_change', side: 'attacker',
          message: `⏸️ T${tick}: No divisions engaged — deploy troops to fight!`,
        })
      }

      // --- Refresh division states after damage ---
      const updatedArmyStore = useArmyStore.getState()

      // Check for destroyed divisions and generate debris
      let atkDestroyed = 0, defDestroyed = 0
      let debrisScrap = 0, debrisMatX = 0, debrisBoxes = 0
      battle.attacker.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') {
          atkDestroyed++
          newCombatLog.push({ tick, timestamp: now, type: 'destroyed', side: 'attacker', divisionName: d.name, message: `💀 ${d.name} destroyed!` })
          const debris = rollDebris(d.type)
          debrisScrap += debris.scrap; debrisMatX += debris.materialX; debrisBoxes += debris.militaryBox ? 1 : 0
        }
      })
      battle.defender.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') {
          defDestroyed++
          newCombatLog.push({ tick, timestamp: now, type: 'destroyed', side: 'defender', divisionName: d.name, message: `💀 ${d.name} destroyed!` })
          const debris = rollDebris(d.type)
          debrisScrap += debris.scrap; debrisMatX += debris.materialX; debrisBoxes += debris.militaryBox ? 1 : 0
        }
      })

      // ⚡ VENGEANCE: When an allied division is destroyed, surviving allies get buffed for 3 ticks
      if (atkDestroyed > 0 && !battle.vengeanceBuff) battle.vengeanceBuff = { attacker: -1, defender: -1 }
      if (atkDestroyed > 0) {
        battle.vengeanceBuff.attacker = tick + 3  // attacker lost divs → attacker survivors get vengeance
        newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `⚡ VENGEANCE! Attacker divisions rage — +20% ATK, +10% hit for 3 ticks!` })
      }
      if (defDestroyed > 0) {
        battle.vengeanceBuff.defender = tick + 3  // defender lost divs → defender survivors get vengeance
        newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'defender', message: `⚡ VENGEANCE! Defender divisions rage — +20% ATK, +10% hit for 3 ticks!` })
      }

      // Deposit debris into the region
      if ((debrisScrap > 0 || debrisMatX > 0 || debrisBoxes > 0) && battle.regionId) {
        useRegionStore.getState().addDebris(battle.regionId, debrisScrap, debrisMatX, debrisBoxes)
      }

      // BOH rewards for division kills: +1 🎖️ per enemy division destroyed
      const ps0 = usePlayerStore.getState()
      const playerCountry0 = ps0.countryCode || 'US'
      if (playerCountry0 === battle.attackerId && defDestroyed > 0) {
        ps0.addResource('badgesOfHonor', defDestroyed, 'division_kill')
      } else if (playerCountry0 === battle.defenderId && atkDestroyed > 0) {
        ps0.addResource('badgesOfHonor', atkDestroyed, 'division_kill')
      }

      // --- Award ground points ---
      const activeRoundIndex = battle.rounds.length - 1
      const activeRound = { ...battle.rounds[activeRoundIndex] }
      const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
      const pointIncrement = getPointIncrement(totalGroundPoints)
      // Accumulate TOTAL damage this tick (division + player manual) into per-round totals
      const atkTickDmgTotal = atkTotalDmg + (battle.currentTick?.attackerDamage || 0)
      const defTickDmgTotal = defTotalDmg + (battle.currentTick?.defenderDamage || 0)
      activeRound.attackerRoundDmg = (activeRound.attackerRoundDmg || 0) + atkTickDmgTotal
      activeRound.defenderRoundDmg = (activeRound.defenderRoundDmg || 0) + defTickDmgTotal

      // Award points based on ROUND-LONG damage with 50%+ threshold
      const totalRoundDmg = (activeRound.attackerRoundDmg || 0) + (activeRound.defenderRoundDmg || 0)
      if (totalRoundDmg > 0) {
        const atkRoundPct = (activeRound.attackerRoundDmg || 0) / totalRoundDmg
        const defRoundPct = (activeRound.defenderRoundDmg || 0) / totalRoundDmg
        if (atkRoundPct > 0.5) {
          activeRound.attackerPoints += pointIncrement
        } else if (defRoundPct > 0.5) {
          activeRound.defenderPoints += pointIncrement
        }
        // 50/50 stalemate → 0 points
      } else if (atkDivIds.length > 0 && defDivIds.length === 0) {
        // Attacker has divisions, defender doesn't: attacker gains ground
        activeRound.attackerPoints += pointIncrement
      } else if (defDivIds.length > 0 && atkDivIds.length === 0) {
        // Defender has divisions, attacker doesn't: defender gains ground
        activeRound.defenderPoints += pointIncrement
      }
      let newRounds = [...battle.rounds.slice(0, -1), activeRound]

      // --- Victory conditions: ONLY ground points decide rounds/battles ---
      // Division wipeout does NOT instantly end the battle — the side with no divs
      // simply can't deal damage, so the other side earns ground points unopposed.
      let newStatus: 'active' | 'attacker_won' | 'defender_won' = battle.status
      let atkRoundsWon = battle.attackerRoundsWon
      let defRoundsWon = battle.defenderRoundsWon

      if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND || activeRound.defenderPoints >= POINTS_TO_WIN_ROUND) {
        // Record round end data
        activeRound.endedAt = now
        activeRound.ticksElapsed = tick - (battle.rounds.slice(0, -1).reduce((sum, r) => sum + (r.ticksElapsed || 0), 0))
        activeRound.attackerDmgTotal = activeRound.attackerRoundDmg || 0
        activeRound.defenderDmgTotal = activeRound.defenderRoundDmg || 0
        if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND) { atkRoundsWon++; activeRound.status = 'attacker_won' }
        else { defRoundsWon++; activeRound.status = 'defender_won' }
        if (atkRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'attacker_won'
          const world = useWorldStore.getState()
          if (battle.type === 'invasion') world.occupyCountry(battle.defenderId, battle.attackerId, false)
          // Revolt victory: liberate the region back to native country
          if (battle.type === 'revolt' && battle.regionId) {
            useRegionStore.getState().liberateRegion(battle.regionId)
          }
          // Flip region control if battle targets a specific region (non-revolt)
          if (battle.type !== 'revolt' && battle.regionId) {
            const regionStore = useRegionStore.getState()
            const regionIdx = regionStore.regions.findIndex(r => r.id === battle.regionId)
            if (regionIdx >= 0) {
              useRegionStore.setState(s => ({
                regions: s.regions.map((r, i) => i === regionIdx ? { ...r, controlledBy: battle.attackerId } : r)
              }))
            }
          }
          // --- War Rewards (damage-weighted, with Economic Theory research bonus) ---
          const atkKills = battle.defender.divisionsDestroyed + defDestroyed
          const defKills = battle.attacker.divisionsDestroyed + atkDestroyed
          const ecoBonuses = useResearchStore.getState().getEconomyBonuses(battle.attackerId)
          const winnerRewards = getWarRewards(atkKills, true, ecoBonuses.allEconomyBonus)
          const loserRewards = getWarRewards(defKills, false)
          const ps = usePlayerStore.getState()
          const playerCC = ps.countryCode || 'US'

          // Damage-weighted reward: share based on player's contribution
          const myAtkDmg = battle.attackerDamageDealers[ps.name] || 0
          const totalAtkDmg = battle.attacker.damageDealt || 1
          const worldState = useWorldStore.getState()
          if (playerCC === battle.attackerId && myAtkDmg > 0) {
            const myShare = getWarRewardShare(winnerRewards.totalMoney, myAtkDmg, totalAtkDmg)
            // Draw from war fund instead of creating money
            const actualPayout = Math.max(5000, worldState.drawFromWarFund(myShare))
            ps.earnMoney(actualPayout)  // local state sync only
            const milB = useSpecializationStore.getState().getMilitaryBonuses()
            ps.addResource('badgesOfHonor', 1 + (milB?.bohWinBonus || 0), 'battle_win')
          } else if (playerCC === battle.defenderId) {
            // Loser consolation is also damage-weighted
            const myDefDmg = battle.defenderDamageDealers[ps.name] || 0
            const totalDefDmg = battle.defender.damageDealt || 1
            if (myDefDmg > 0) {
              const myShare = getWarRewardShare(loserRewards.totalMoney, myDefDmg, totalDefDmg)
              const actualPayout = Math.max(5000, worldState.drawFromWarFund(myShare))
              ps.earnMoney(actualPayout)  // local state sync only
            }
          }
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `⚔️ VICTORY! ${getCountryName(battle.attackerId)} captures ${battle.regionName}! 💰 Pool: $${winnerRewards.totalMoney.toLocaleString()} (damage-weighted)` })
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'defender', message: `🛡️ DEFEAT — ${getCountryName(battle.defenderId)} loses ${battle.regionName}. 💰 Consolation pool: $${loserRewards.totalMoney.toLocaleString()}` })
        } else if (defRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'defender_won'
          // --- War Rewards (damage-weighted, with Economic Theory research bonus) ---
          const dAtkKills = battle.defender.divisionsDestroyed + defDestroyed
          const dDefKills = battle.attacker.divisionsDestroyed + atkDestroyed
          const dEcoBonuses = useResearchStore.getState().getEconomyBonuses(battle.defenderId)
          const dWinnerRewards = getWarRewards(dDefKills, true, dEcoBonuses.allEconomyBonus)
          const dLoserRewards = getWarRewards(dAtkKills, false)
          const dPs = usePlayerStore.getState()
          const dPlayerCC = dPs.countryCode || 'US'

          // Damage-weighted reward: share based on player's contribution
          const dMyDefDmg = battle.defenderDamageDealers[dPs.name] || 0
          const dTotalDefDmg = battle.defender.damageDealt || 1
          const dWorldState = useWorldStore.getState()
          if (dPlayerCC === battle.defenderId && dMyDefDmg > 0) {
            const dMyShare = getWarRewardShare(dWinnerRewards.totalMoney, dMyDefDmg, dTotalDefDmg)
            // Draw from war fund instead of creating money
            const dActualPayout = Math.max(5000, dWorldState.drawFromWarFund(dMyShare))
            dPs.earnMoney(dActualPayout)  // local state sync only
            const milB = useSpecializationStore.getState().getMilitaryBonuses()
            dPs.addResource('badgesOfHonor', 1 + (milB?.bohWinBonus || 0), 'battle_win')
          } else if (dPlayerCC === battle.attackerId) {
            // Loser consolation is also damage-weighted
            const dMyAtkDmg = battle.attackerDamageDealers[dPs.name] || 0
            const dTotalAtkDmg = battle.attacker.damageDealt || 1
            if (dMyAtkDmg > 0) {
              const dMyShare = getWarRewardShare(dLoserRewards.totalMoney, dMyAtkDmg, dTotalAtkDmg)
              const dActualPayout = Math.max(5000, dWorldState.drawFromWarFund(dMyShare))
              dPs.earnMoney(dActualPayout)  // local state sync only
            }
          }
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'defender', message: `🛡️ DEFENSE HOLDS! ${getCountryName(battle.defenderId)} defends ${battle.regionName}! 💰 Pool: $${dWinnerRewards.totalMoney.toLocaleString()} (damage-weighted)` })
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `⚔️ ATTACK FAILED — ${getCountryName(battle.attackerId)} repelled from ${battle.regionName}. 💰 Consolation pool: $${dLoserRewards.totalMoney.toLocaleString()}` })
        } else {
          newRounds = [...newRounds, { attackerPoints: 0, defenderPoints: 0, status: 'active', startedAt: now }]
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `🔔 Round ${battle.rounds.length} complete! New round begins.` })
        }
      }

      // --- Update battle state ---
      // NOTE: currentTick starts at {0,0} and is incremented by staggered hits
      newBattles[battle.id] = {
        ...battle,
        ticksElapsed: tick,
        divisionCooldowns: cooldowns,
        status: newStatus,
        attackerRoundsWon: atkRoundsWon,
        defenderRoundsWon: defRoundsWon,
        rounds: newRounds,
        currentTick: { attackerDamage: 0, defenderDamage: 0 },
        attacker: {
          ...battle.attacker,
          // damageDealt is incremented per-hit in applyHit — don't add here
          manpowerLost: (battle.attacker.manpowerLost || 0) + manpowerDmgToAttacker,
          divisionsDestroyed: (battle.attacker.divisionsDestroyed || 0) + atkDestroyed,
          
        },
        defender: {
          ...battle.defender,
          // damageDealt is incremented per-hit in applyHit — don't add here
          manpowerLost: (battle.defender.manpowerLost || 0) + manpowerDmgToDefender,
          divisionsDestroyed: (battle.defender.divisionsDestroyed || 0) + defDestroyed,
          
        },
        combatLog: newCombatLog.slice(-100),
      }

      // If battle resolved, reset division states and check War Cards
      if (newStatus !== 'active') {
        const finalArmyStore = useArmyStore.getState()
        ;[...battle.attacker.divisionIds, ...battle.defender.divisionIds].forEach(id => {
          const d = finalArmyStore.divisions[id]
          if (d && d.status === 'in_combat') {
            useArmyStore.setState((s: any) => ({
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

        // ── Specialization: round/battle win hooks ──
        try {
          const ps = usePlayerStore.getState()
          const pCC = ps.countryCode || 'US'
          const isAttacking = pCC === battle.attackerId
          const isDefending = pCC === battle.defenderId
          const isAbroad = !isAttacking && !isDefending
          const playerWon = (newStatus === 'attacker_won' && isAttacking) || (newStatus === 'defender_won' && isDefending) ||
            (isAbroad && ((newStatus === 'attacker_won' && (battle.attackerDamageDealers[ps.name] || 0) > 0) ||
                          (newStatus === 'defender_won' && (battle.defenderDamageDealers[ps.name] || 0) > 0)))
          const spec = useSpecializationStore.getState()
          if (playerWon && !isAbroad) spec.recordRoundWin()
          if (playerWon && isAbroad) spec.recordAbroadRoundWin()
          // Mercenary: abroad kill
          if (isAbroad && playerWon) spec.recordAbroadKill()
        } catch (e) { /* silent */ }

        // ── War Cards: combat achievements are now evaluated server-side ──
        // (evaluateBattleCards() in warCard.service.ts handles battle-context cards)
        // No client-side evaluation needed.

        // ── #9 FIX: Feed Global War Fund instead of per-battle treasury drain ──
        try {
          const finalBattle = newBattles[battle.id]
          const winnerSide = newStatus === 'attacker_won' ? 'attacker' : 'defender'
          const loserSide = newStatus === 'attacker_won' ? 'defender' : 'attacker'
          const winnerCountry = winnerSide === 'attacker' ? finalBattle.attackerId : finalBattle.defenderId
          const loserCountry = loserSide === 'attacker' ? finalBattle.attackerId : finalBattle.defenderId

          const worldState = useWorldStore.getState()

          // Contribute 2% from both treasuries to global war fund
          worldState.contributeToWarFund(finalBattle.attackerId, finalBattle.defenderId)

          // Record damage dealt by each side's country for daily distribution
          const atkTotalDmg = Object.values(finalBattle.attackerDamageDealers || {}).reduce((s, d) => s + d, 0)
          const defTotalDmg = Object.values(finalBattle.defenderDamageDealers || {}).reduce((s, d) => s + d, 0)
          if (atkTotalDmg > 0) worldState.recordWarFundDamage(finalBattle.attackerId, atkTotalDmg)
          if (defTotalDmg > 0) worldState.recordWarFundDamage(finalBattle.defenderId, defTotalDmg)

          // Record battle outcome for win/loss multiplier
          worldState.recordWarFundBattleOutcome(winnerCountry, loserCountry)
        } catch (e) {
          console.warn('[WarFund] Error recording battle to war fund:', e)
        }
      }
    })

    if (hasChanges) {
      set({ battles: newBattles })
    }
  },


  // ====== PLAYER COMBAT ACTIONS (SERVER-AUTHORITATIVE) ======
  playerAttack: async (battleId, _forceSide) => {
    const FAIL = (msg: string) => ({ damage: 0, isCrit: false, message: msg })
    if (!rateLimiter.check('playerAttack')) return FAIL('Too fast! Wait a moment.')
    const state = get()
    const battle = state.battles[battleId]

    const player = usePlayerStore.getState()
    const cs = getPlayerCombatStats()
    const playerCountry = player.countryCode || 'US'

    // ── Side detection ──
    // If battle isn't in local store yet (server-created, not synced), skip local
    // pre-validations and let the server handle everything authoritatively.
    let side: 'attacker' | 'defender' = _forceSide || 'attacker'

    if (battle && battle.status === 'active') {
      // ── Pre-validation: stamina (instant rejection UX) ──
      const armorMit = cs.armorBlock / (cs.armorBlock + 100)
      const staCost = Math.max(1, Math.ceil(5 * (1 - armorMit)))
      if (player.stamina < staCost) return FAIL(`Not enough stamina (${staCost} required).`)

      // ── Pre-validation: ammo (instant rejection UX) ──
      const _eqItems = useInventoryStore.getState().getEquipped()
      const _weapon = _eqItems.find((e: any) => e.slot === 'weapon')
      const _weaponSub = _weapon?.weaponSubtype || 'knife'
      if (_weaponSub !== 'knife') {
        const _ammoType = player.equippedAmmo
        if (_ammoType === 'none') return FAIL('No ammo equipped! Equip ammo to fire.')
        const _ammoKey = `${_ammoType}Bullets` as keyof typeof player
        const _ammoCount = (player[_ammoKey] as number) || 0
        if (_ammoCount <= 0) return FAIL(`Out of ${_ammoType} ammo!`)
      }

      // ── Side detection (with local battle data for oil cost pre-check) ──
      if (_forceSide) {
        if (playerCountry !== battle.attackerId && playerCountry !== battle.defenderId) {
          const opponentCountry = _forceSide === 'attacker' ? battle.defenderId : battle.attackerId
          const distance = getCountryDistance(playerCountry, opponentCountry)
          let oilCost = getAttackOilCost(distance) / 10000
          oilCost = Number(oilCost.toFixed(2))
          if (player.oil < oilCost) return FAIL(`Not enough oil (${oilCost} required).`)
          player.spendOil(oilCost)
        }
        side = _forceSide
      } else {
        if (playerCountry === battle.attackerId) {
          side = 'attacker'
        } else if (playerCountry === battle.defenderId) {
          side = 'defender'
        } else {
          side = 'attacker'
          const distance = getCountryDistance(playerCountry, battle.defenderId)
          let oilCost = getAttackOilCost(distance) / 10000
          oilCost = Number(oilCost.toFixed(2))
          if (player.oil < oilCost) return FAIL(`Not enough oil (${oilCost} required).`)
          player.spendOil(oilCost)
        }
      }
    } else if (battle && battle.status !== 'active') {
      // Battle exists locally but is finished
      return FAIL('Battle has ended.')
    }
    // else: battle not in local store — proceed to server call which validates everything

    // ── Server-authoritative: send attack request and await result ──
    try {
      const { battleAttack } = await import('../api/client')
      const result = await battleAttack(battleId, side)

      if (!result.success || result.damage <= 0) {
        return { damage: 0, isCrit: false, message: result.message || 'Attack failed.' }
      }

      // Update local battle state with server-authoritative damage
      get().addDamage(battleId, result.side, result.damage, result.isCrit, result.isDodged, player.name)

      // ── Specialization hooks (military / mercenary / politician) ──
      try {
        const spec = useSpecializationStore.getState()
        const isAbroad = playerCountry !== battle?.attackerId && playerCountry !== battle?.defenderId
        const isCountryWar = battle && useWorldStore.getState().wars.some(w => w.status === 'active' &&
          ((w.attacker === battle.attackerId && w.defender === battle.defenderId) ||
           (w.attacker === battle.defenderId && w.defender === battle.attackerId)))
        // Always record military damage
        spec.recordDamage(result.damage)
        // Mercenary: abroad damage
        if (isAbroad) spec.recordAbroadDamage(result.damage)
        // Politician: country war damage
        if (isCountryWar && !isAbroad) spec.recordCountryWarDamage(result.damage)
        // Research RP from fighting
        useResearchStore.getState().contributeRP(3, 'fight')
      } catch (e) { /* silent */ }

      // Sync stamina from server if provided
      if (result.staminaLeft >= 0) {
        usePlayerStore.setState({ stamina: result.staminaLeft })
      }

      // Sync adrenaline from server (authoritative value)
      if (result.adrenaline !== undefined) {
        set(s => {
          const b = s.battles[battleId]
          if (!b) return s
          return { battles: { ...s.battles, [battleId]: {
            ...b,
            playerAdrenaline: { ...(b.playerAdrenaline || {}), [player.name]: result.adrenaline },
          }}}
        })
      }

      // Hero buff (UI-only, stays client-side)
      usePlayerStore.setState({ heroBuffTicksLeft: 120, heroBuffBattleId: battleId })

      return {
        damage: result.damage,
        isCrit: result.isCrit,
        isMiss: result.isMiss,
        isDodged: result.isDodged,
        message: result.message,
      }
    } catch (err) {
      console.error('[Battle] Server attack failed:', err)
      return FAIL('Server error. Try again.')
    }
  },

  // ══ ADRENALINE: Surge Activation ══
  activateSurge: async (battleId: string) => {
    try {
      const { battleSurge } = await import('../api/client')
      const result = await battleSurge(battleId)
      const pName = usePlayerStore.getState().name

      if (result.success) {
        // Sync adrenaline (should be 0 after surge)
        set(s => {
          const b = s.battles[battleId]
          if (!b) return s
          const playerCountry = usePlayerStore.getState().countryCode || 'US'
          const side: 'attacker' | 'defender' = playerCountry === b.attackerId ? 'attacker' : 'defender'
          const order = (side === 'attacker' ? b.attackerOrder : b.defenderOrder) || 'none'
          const duration = order === 'blitz' ? 5000 : 10000
          return { battles: { ...s.battles, [battleId]: {
            ...b,
            playerAdrenaline: { ...(b.playerAdrenaline || {}), [pName]: 0 },
            playerSurge: { ...(b.playerSurge || {}), [pName]: { until: Date.now() + duration, order } },
            playerAdrenalinePeakAt: { ...(b.playerAdrenalinePeakAt || {}), [pName]: 0 },
          }}}
        })
      }
    } catch (e) {
      console.error('[Surge] Server surge failed:', e)
    }
  },

  // ══ ADRENALINE: Decay Tick (called every 1s from UI) ══
  tickAdrenalineDecay: (battleId: string, playerName: string) => {
    set(s => {
      const b = s.battles[battleId]
      if (!b) return s
      const current = (b.playerAdrenaline || {})[playerName] || 0
      if (current <= 0) return s
      const now = Date.now()
      const next = Math.max(0, current - 3)  // -3 per second
      // Track peak-at timestamp
      let peakAt = (b.playerAdrenalinePeakAt || {})[playerName] || 0
      if (current >= 100 && !peakAt) peakAt = now
      // Check crash: was at 100 for > 20s
      if (current >= 100 && peakAt > 0 && now - peakAt > 20000) {
        return { battles: { ...s.battles, [battleId]: { ...b,
          playerAdrenaline: { ...(b.playerAdrenaline || {}), [playerName]: 0 },
          playerCrash: { ...(b.playerCrash || {}), [playerName]: { until: now + 8000 } },
          playerAdrenalinePeakAt: { ...(b.playerAdrenalinePeakAt || {}), [playerName]: 0 },
        }}}
      }
      return { battles: { ...s.battles, [battleId]: { ...b,
        playerAdrenaline: { ...(b.playerAdrenaline || {}), [playerName]: next },
        playerAdrenalinePeakAt: { ...(b.playerAdrenalinePeakAt || {}), [playerName]: peakAt },
      }}}
    })
  },

  playerDefend: (battleId, _forceSide) => {
    if (!rateLimiter.check('playerDefend')) return { blocked: 0, message: 'Too fast! Wait a moment.' }
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { blocked: 0, message: 'No active battle.' }

    const player = usePlayerStore.getState()
    if (player.stamina < 3) return { blocked: 0, message: 'Not enough stamina (3 required).' }

    // ── #1 FIX: Auto-detect side from player's country ──
    const playerCountry = player.countryCode || 'US'
    let isAttacker: boolean
    if (playerCountry === battle.attackerId) {
      isAttacker = true
    } else if (playerCountry === battle.defenderId) {
      isAttacker = false
    } else {
      // Foreigner logic
      const world = useWorldStore.getState()
      const atWarWithAttacker = world.wars.some(w => w.status === 'active' && ((w.attacker === playerCountry && w.defender === battle.attackerId) || (w.attacker === battle.attackerId && w.defender === playerCountry)))
      const atWarWithDefender = world.wars.some(w => w.status === 'active' && ((w.attacker === playerCountry && w.defender === battle.defenderId) || (w.attacker === battle.defenderId && w.defender === playerCountry)))

      if (atWarWithDefender && !atWarWithAttacker) {
        isAttacker = true
        const distance = getCountryDistance(playerCountry, battle.defenderId)
        const oilCost = Math.max(1, Math.floor(getAttackOilCost(distance) / 100))
        if (player.oil < oilCost) return { blocked: 0, message: `Not enough oil (${oilCost} required for distance).` }
        player.spendOil(oilCost)
      } else if (atWarWithAttacker && !atWarWithDefender) {
        isAttacker = false
        const distance = getCountryDistance(playerCountry, battle.attackerId)
        const oilCost = Math.max(1, Math.floor(getAttackOilCost(distance) / 100))
        if (player.oil < oilCost) return { blocked: 0, message: `Not enough oil (${oilCost} required for distance).` }
        player.spendOil(oilCost)
      } else if (atWarWithAttacker && atWarWithDefender) {
        return { blocked: 0, message: 'You are at war with both sides! Cannot join.' }
      } else {
        return { blocked: 0, message: 'Your country is not in this battle nor at war with either side.' }
      }
    }

    player.consumeBar('stamina', 3)

    const cs = getPlayerCombatStats()
    const isCrit = Math.random() * 100 < cs.critRate
    let blocked = isCrit ? Math.floor(cs.attackDamage * cs.critMultiplier) : cs.attackDamage

    // Revolt Homeland Bonus: +30% player damage for citizens of the occupied land
    if (battle.type === 'revolt' && battle.regionId && isAttacker) {
      const bonus = useRegionStore.getState().getHomelandBonus(battle.regionId)
      blocked = Math.floor(blocked * bonus.playerDmgMult)
    }

    const enemySide = isAttacker ? 'defenderDamage' : 'attackerDamage'

    // ── #4 FIX: Hero buff only for YOUR side in YOUR battle ──
    usePlayerStore.setState({ heroBuffTicksLeft: 120, heroBuffBattleId: battleId })

    // Degrade equipped items durability
    useInventoryStore.getState().degradeEquippedItems(1)

    // ── Hit Loot Drops (7% base + Mercenary Bonus) ──
    let dropMsg = ''
    try {
      const merB = useSpecializationStore.getState().getMercenaryBonuses()
      const dropChance = 7 + (merB?.lootChancePercent || 0)
      if (Math.random() * 100 < dropChance) {
        const roll = Math.random()
        if (roll < 0.01) {
          usePlayerStore.getState().addResource('bitcoin', 1, 'battle_loot_drop')
          dropMsg = ' [₿+1]'
        } else if (roll < 0.34) {
          usePlayerStore.getState().addResource('militaryBoxes', 1, 'battle_loot_drop')
          dropMsg = ' [🧰+1]'
        } else {
          usePlayerStore.getState().addResource('lootBoxes', 1, 'battle_loot_drop')
          dropMsg = ' [📦+1]'
        }
      }
    } catch (e) { console.warn('[Hit Loot] Error', e) }

    // ── 5% chance to drop a Badge of Honor per hit (plus Military bonus) ──
    const milB = useSpecializationStore.getState().getMilitaryBonuses()
    const bohDropChance = 5 + (milB?.bohDropPercent || 0)
    if (Math.random() * 100 < bohDropChance) {
      usePlayerStore.getState().addResource('badgesOfHonor', 1, 'battle_hit_drop')
      dropMsg += ' [🎖️+1]'
    }

    set(s => ({
      battles: {
        ...s.battles,
        [battleId]: {
          ...battle,
          currentTick: {
            ...battle.currentTick,
            [enemySide]: Math.max(0, battle.currentTick[enemySide] - blocked),
          },
          damageFeed: [{
            playerName: `${player.name} 🛡️`,
            side: (isAttacker ? 'attacker' : 'defender') as 'attacker' | 'defender',
            amount: blocked, isCrit, isDodged: false, time: Date.now(),
          }, ...battle.damageFeed].slice(0, 20),
        },
      },
    }))

    // Persist to backend (fire-and-forget)
    import('../api/client').then(({ battleDefend }) => battleDefend(battleId).catch(() => {}))
    // RP contribution from defending
    try { useResearchStore.getState().contributeRP(2, 'defend') } catch (_) {}
    return {
      blocked,
      message: (isCrit ? `💥 CRITICAL BLOCK! ${blocked} incoming damage blocked!` : `🛡️ Blocked ${blocked} incoming damage!`) + dropMsg,
    }
  },

  // ====== DEPLOY DIVISIONS TO BATTLE ======
  deployDivisionsToBattle: (battleId, divisionIds, side) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const armyStore = useArmyStore.getState()

    // ── Anti-grief: block deploying to the enemy side of a war ──
    const playerCountry = usePlayerStore.getState().countryCode || 'US'
    const sideCountry = side === 'attacker' ? battle.attackerId : battle.defenderId
    const enemySide = side === 'attacker' ? battle.defenderId : battle.attackerId
    const world = useWorldStore.getState()
    const atWarWithSide = world.wars.some(w => w.status === 'active' &&
      ((w.attacker === playerCountry && w.defender === sideCountry) || (w.attacker === sideCountry && w.defender === playerCountry)))
    // Block if player is at war with the side they're trying to help (griefing prevention)
    if (atWarWithSide) return { success: false, message: 'Cannot deploy to enemy side.' }

    // ── Validate that divisions are deployable ──
    const validIds = divisionIds.filter(id => {
      const d = armyStore.divisions[id]
      if (!d) return false
      if (d.status !== 'ready' && d.status !== 'training') return false
      if (d.health <= 0) return false
      return true
    })
    if (validIds.length === 0) return { success: false, message: 'No valid divisions to deploy.' }

    // Mark divisions as in_combat with deployment timestamp
    const deployedAtTick = get().battles[battleId]?.ticksElapsed || 0
    validIds.forEach(id => {
      useArmyStore.setState((s: any) => ({
        divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'in_combat', deployedAtTick } }
      }))
    })

    // Add to battle side
    const sideData = side === 'attacker' ? battle.attacker : battle.defender
    const newDivisionIds = [...new Set([...sideData.divisionIds, ...validIds])]
    const newEngaged = [...new Set([...sideData.engagedDivisionIds, ...validIds])]

    set(s => ({
      battles: {
        ...s.battles,
        [battleId]: {
          ...battle,
          [side]: {
            ...sideData,
            divisionIds: newDivisionIds,
            engagedDivisionIds: newEngaged,
          },
          currentTick: {
            attackerDamage: battle.currentTick.attackerDamage,
            defenderDamage: battle.currentTick.defenderDamage,
          },
          combatLog: [...battle.combatLog, {
            tick: battle.ticksElapsed, timestamp: Date.now(), type: 'reinforcement' as const, side,
            message: `🚀 ${validIds.length} division(s) deployed as reinforcements!`,
          }],
        },
      },
    }))

    // Persist to backend (fire-and-forget)
    import('../api/client').then(({ battleDeploy }) => battleDeploy(battleId, validIds, side).catch(() => {}))
    return { success: true, message: `${validIds.length} division(s) deployed to battle!` }
  },

  removeDivisionsFromBattle: (battleId, side) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const sideData = side === 'attacker' ? battle.attacker : battle.defender
    if (sideData.engagedDivisionIds.length === 0) return { success: false, message: 'No divisions to remove.' }

    const count = sideData.engagedDivisionIds.length

    // Set divisions to 'recovering'
    sideData.engagedDivisionIds.forEach(id => {
      useArmyStore.setState((s: any) => {
        const d = s.divisions[id]
        if (!d || d.status === 'destroyed') return s
        return {
          divisions: { ...s.divisions, [id]: { ...d, status: 'recovering', trainingProgress: 0 } }
        }
      })
    })

    // Clear from battle side
    set(s => ({
      battles: {
        ...s.battles,
        [battleId]: {
          ...battle,
          [side]: {
            ...sideData,
            engagedDivisionIds: [],
          },
          combatLog: [...battle.combatLog, {
            tick: battle.ticksElapsed, timestamp: Date.now(), type: 'retreat' as const, side,
            message: `🏳️ ${count} division(s) withdrawn from battle!`,
          }],
        },
      },
    }))

    return { success: true, message: `${count} division(s) withdrawn and recovering.` }
  },

  recallDivisionFromBattle: (battleId, divisionId, side) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const sideData = side === 'attacker' ? battle.attacker : battle.defender
    if (!sideData.engagedDivisionIds.includes(divisionId)) return { success: false, message: 'Division not in battle.' }

    // ── #5 FIX: 120-tick (30 min) minimum deployment before recall ──
    const div = useArmyStore.getState().divisions[divisionId]
    if (div && typeof div.deployedAtTick === 'number') {
      const currentTick = battle.ticksElapsed || 0
      const ticksDeployed = currentTick - div.deployedAtTick
      if (ticksDeployed < 120) {
        const ticksRemaining = 120 - ticksDeployed
        const minsRemaining = Math.ceil((ticksRemaining * 15) / 60)
        return { success: false, message: `Division must stay deployed for 30 min. ${minsRemaining} min remaining.` }
      }
    }

    // Set division to 'recovering'
    useArmyStore.setState((s: any) => {
      const d = s.divisions[divisionId]
      if (!d || d.status === 'destroyed') return s
      return { divisions: { ...s.divisions, [divisionId]: { ...d, status: 'recovering', trainingProgress: 0 } } }
    })

    const divName = useArmyStore.getState().divisions[divisionId]?.name || divisionId

    set(s => ({
      battles: {
        ...s.battles,
        [battleId]: {
          ...battle,
          [side]: {
            ...sideData,
            engagedDivisionIds: sideData.engagedDivisionIds.filter(id => id !== divisionId),
          },
          combatLog: [...battle.combatLog, {
            tick: battle.ticksElapsed, timestamp: Date.now(), type: 'retreat' as const, side,
            message: `🛡️ ${divName} withdrawn from battle.`,
          }],
        },
      },
    }))

    // Persist to backend (fire-and-forget)
    import('../api/client').then(({ battleRecall }) => battleRecall(battleId, divisionId, side).catch(() => {}))
    return { success: true, message: `${divName} recalled.` }
  },
}))

// Register on window for anti-bot circular dependency workaround
;(window as any).__xwar_battleStore = useBattleStore
