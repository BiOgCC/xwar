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
const COUNTER_BUFF_TICKS = 3        // 3 ticks × 120s = 6 minutes
const COUNTER_MIN_HITS = 5          // min hits before a player's weapon presence counts
const COUNTER_MIN_DAMAGE = 3000     // min total damage before a player's weapon presence counts

// ====== HELPERS ======

const POINTS_TO_WIN_ROUND = 300
const ROUNDS_TO_WIN_BATTLE = 2

// Quick battle: lower thresholds for pure PvP
const QB_POINTS_TO_WIN_ROUND = 200
const QB_ROUNDS_TO_WIN_BATTLE = 1

function getPointIncrement(totalGroundPoints: number): number {
  if (totalGroundPoints < 100) return 1
  if (totalGroundPoints < 200) return 2
  if (totalGroundPoints < 300) return 3
  if (totalGroundPoints < 400) return 4
  if (totalGroundPoints < 500) return 5
  if (totalGroundPoints < 600) return 6
  return 6  // cap at +6
}

// Country data (names, flags, flag URLs) now lives in src/data/countries.ts
// and is re-exported at the top of this file for backwards compatibility.

// ====== FACTORY FUNCTIONS ======

function createEmptyBattleSide(countryCode: string): BattleSide {
  return {
    countryCode,
    damageDealt: 0,
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
    attackerOrder: 'none' as TacticalOrder,
    defenderOrder: 'none' as TacticalOrder,
    orderMessage: '',
    motd: '',
    playerAdrenaline: {},
    playerSurge: {},
    playerCrash: {},
    playerAdrenalinePeakAt: {},
    mercenaryContracts: [],
    vengeanceBuff: { attacker: 0, defender: 0 },
    weaponPresence: { attacker: {}, defender: {} },
  }
}

// ====== STORE ======

export interface BattleState {
  battles: Record<string, Battle>

  launchAttack: (attackerId: string, defenderId: string, regionName: string, type?: BattleType, regionId?: string) => void
  addDamage: (battleId: string, side: 'attacker' | 'defender', amount: number, isCrit: boolean, isDodged: boolean, playerName: string) => void

  processPlayerCombatTick: () => void   // ground points from manual attacks

  playerAttack: (battleId: string, side?: 'attacker' | 'defender') => Promise<{ damage: number; isCrit: boolean; isMiss?: boolean; isDodged?: boolean; message: string }>
  playerDefend: (battleId: string, side?: 'attacker' | 'defender') => Promise<{ blocked: number; message: string }>

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
  createMercenaryContract: (battleId: string, side: 'attacker' | 'defender', ratePerHit: number, totalPool: number) => Promise<{ success: boolean; message: string }>

  // Missile Launcher
  launchMissile: (battleId: string, side: 'attacker' | 'defender') => Promise<{ success: boolean; message: string }>

  // NPC test battles
  spawnNPCBattles: () => void
}

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: {},
  warMotd: '',
  setWarMotd: (motd: string) => set({ warMotd: motd.substring(0, 200) }),

  // ====== MERCENARY CONTRACTS (server-authoritative) ======
  createMercenaryContract: async (battleId, side, ratePerHit, totalPool) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }
    if (ratePerHit <= 0 || totalPool <= 0) return { success: false, message: 'Invalid amounts.' }

    try {
      const { api } = await import('../api/client')
      const result: any = await api.post(`/battle/${battleId}/mercenary`, { side, ratePerHit, totalPool })
      return { success: result.success, message: result.message }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Mercenary contract failed.' }
    }
  },

  // ====== NPC TEST BATTLES ======
  // NPC battles removed — server-authoritative battles only
  spawnNPCBattles: () => {},
  combatTickLeft: 120,
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

  // ====== MISSILE LAUNCHER (server-authoritative) ======
  launchMissile: async (battleId, side) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    try {
      const { api } = await import('../api/client')
      const result: any = await api.post(`/battle/${battleId}/missile`, { side })
      return { success: result.success, message: result.message }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Missile launch failed.' }
    }
  },

  // ====== BATTLE LAUNCH (server-authoritative) ======
  launchAttack: async (attackerId, defenderId, regionName, type = 'invasion', regionId?) => {
    // Check for existing active battle in this region (local store)
    const existing = Object.values(get().battles).find(b => b.regionName === regionName && b.status === 'active')
    if (existing) return

    const { launchBattle, getBattle, getActiveBattles } = await import('../api/client')

    try {
      const res: any = await launchBattle(attackerId, defenderId, regionName, type)

      if (!res?.success || !res?.battleId) {
        console.warn('[Battle] Server launch failed:', res?.message || res?.error || 'Unknown error')
        return
      }

      // Server created the battle — now fetch full state and inject into store
      const serverId = res.battleId
      // Join battle socket room so we receive battle:state tick updates
      import('../api/socket').then(({ socketManager }) => socketManager.joinBattle(serverId))
      try {
        const full = await getBattle(serverId)
        if (full?.success && full?.battle) {
          set((state) => ({ battles: { ...state.battles, [serverId]: full.battle } }))
          return
        }
      } catch { /* getBattle failed — create a local shell with the server's UUID */ }

      // Fallback: create local battle shell with the server's UUID (not a fake ID)
      const battle = mkBattle(serverId, attackerId, defenderId, regionName, type, regionId)
      set((state) => ({ battles: { ...state.battles, [serverId]: battle } }))
    } catch (err: any) {
      // Server returned an error (e.g. 400 "Battle already active in this region")
      // Instead of creating a fake local battle, fetch the real active battles from the server
      console.warn('[Battle] Server launch error:', err?.message || err, '— syncing active battles from server...')
      try {
        const activeRes: any = await getActiveBattles()
        if (activeRes?.success && Array.isArray(activeRes.battles) && activeRes.battles.length > 0) {
          const newBattles: Record<string, any> = {}
          for (const b of activeRes.battles) {
            if (b?.id) newBattles[b.id] = b
          }
          set((state) => ({ battles: { ...state.battles, ...newBattles } }))
          console.log(`[Battle] Synced ${Object.keys(newBattles).length} active battle(s) from server`)
        }
      } catch (syncErr) {
        console.error('[Battle] Failed to sync active battles:', syncErr)
      }
    }
  },

  // ====== BATTLE LAUNCH ======
  // ====== ADD DAMAGE ======
  addDamage: (battleId, side, amount, isCrit, isDodged, playerName) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return state

    const now = Date.now()
    const { currentTick, attackerDamageDealers, defenderDamageDealers, damageFeed } = battle

    let finalAmount = amount
    if (finalAmount <= 0 || !Number.isFinite(finalAmount)) return state

    // NOTE: All damage multipliers (tactical orders, military base, tactical ops, ammo,
    // MU bonus, counter-buff, adrenaline, etc.) are applied server-side in
    // battle.service.ts playerAttack(). The `amount` parameter is already
    // the final authoritative damage value. Do NOT re-apply multipliers here.

    const newAttackerDealers = { ...attackerDamageDealers }
    const newDefenderDealers = { ...defenderDamageDealers }
    if (side === 'attacker') {
      newAttackerDealers[playerName] = (newAttackerDealers[playerName] || 0) + finalAmount
    } else {
      newDefenderDealers[playerName] = (newDefenderDealers[playerName] || 0) + finalAmount
    }

    const newFeed = [{ playerName, side, amount: finalAmount, isCrit, isDodged, time: now }, ...damageFeed].slice(0, 20)

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

  // ====== COMBAT TICK PROCESSOR (player damage only) ======
  // ══ PLAYER COMBAT TICK: Ground-point logic for quick_battle (client-side PvP). ══
  // ══ For regular battles (invasion, occupation, etc.), the server handles ground ══
  // ══ points authoritatively via processCombatTick → battle:state socket push.    ══
  processPlayerCombatTick: () => {
    const state = get()
    const now = Date.now()
    const newBattles = { ...state.battles }
    let hasChanges = false

    Object.values(newBattles).forEach(battle => {
      if (battle.status !== 'active') return

      const atkPlayerDmg = battle.currentTick?.attackerDamage || 0
      const defPlayerDmg = battle.currentTick?.defenderDamage || 0

      // ── For regular battles: server handles ground points authoritatively ──
      // We only reset currentTick damage counters; ground points come from battle:state socket events.
      const isQB = battle.type === 'quick_battle'
      if (!isQB) {
        if (atkPlayerDmg <= 0 && defPlayerDmg <= 0) return
        hasChanges = true
        newBattles[battle.id] = {
          ...battle,
          currentTick: { attackerDamage: 0, defenderDamage: 0 },
        }
        return
      }

      // ── Quick-battle: client-side ground points (lobby PvP, not server-ticked) ──
      // Uses the SAME resolution logic as the server's processSingleBattleTick().
      hasChanges = true
      const tick = (battle.ticksElapsed || 0) + 1
      const activeRoundIndex = battle.rounds.length - 1
      const activeRound = { ...battle.rounds[activeRoundIndex] }
      const maxP = QB_POINTS_TO_WIN_ROUND
      const maxRounds = QB_ROUNDS_TO_WIN_BATTLE
      const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
      const pointIncrement = getPointIncrement(totalGroundPoints)

      // Accumulate this tick's damage into per-round totals
      activeRound.attackerRoundDmg = (activeRound.attackerRoundDmg || 0) + atkPlayerDmg
      activeRound.defenderRoundDmg = (activeRound.defenderRoundDmg || 0) + defPlayerDmg

      // ── Unified ground-point resolution (matches server battle.service.ts) ──
      const roundAtkDmg = activeRound.attackerRoundDmg || 0
      const roundDefDmg = activeRound.defenderRoundDmg || 0

      if (roundAtkDmg > 0 || roundDefDmg > 0) {
        // Active combat: side with more accumulated damage gets the point
        if (roundAtkDmg > roundDefDmg) activeRound.attackerPoints += pointIncrement
        else if (roundDefDmg > roundAtkDmg) activeRound.defenderPoints += pointIncrement
        else {
          // Tie: coin flip (same as server)
          if (Math.random() < 0.5) activeRound.attackerPoints += pointIncrement
          else activeRound.defenderPoints += pointIncrement
        }
      } else {
        // No active combat: attrition fallback (same as server)
        const totalAtkDmg = battle.attacker.damageDealt
        const totalDefDmg = battle.defender.damageDealt
        if (totalAtkDmg > totalDefDmg) {
          // Attacker momentum
          activeRound.attackerPoints += Math.max(1, Math.floor(pointIncrement * 0.5))
        } else if (totalDefDmg > totalAtkDmg) {
          // Defender momentum
          activeRound.defenderPoints += Math.max(1, Math.floor(pointIncrement * 0.5))
        } else {
          // Total tie — defender home advantage
          activeRound.defenderPoints += 1
        }
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
          // Territory transfer is handled server-side via finalizeBattle() → battle:occupationUpdate socket event
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

      // ── Optimistic damageDealt update from HTTP response ──
      // The server also emits battle:playerHit via socket which increments
      // damageDealt + updates damageFeed/dealers. If the socket event arrives
      // first (normal path), that handler adds the same damage. The periodic
      // battle:state sync uses Math.max() so the total never exceeds the
      // server's authoritative value — no double-counting risk.
      set(s => {
        const b = s.battles[battleId]
        if (!b) return s
        const sideKey = result.side || side
        const sideObj = b[sideKey as 'attacker' | 'defender']
        return {
          battles: {
            ...s.battles,
            [battleId]: {
              ...b,
              [sideKey]: {
                ...sideObj,
                damageDealt: (sideObj?.damageDealt || 0) + result.damage,
              },
            },
          },
        }
      })

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

  playerDefend: async (battleId, _forceSide) => {
    if (!rateLimiter.check('playerDefend')) return { blocked: 0, message: 'Too fast! Wait a moment.' }
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { blocked: 0, message: 'No active battle.' }

    const player = usePlayerStore.getState()
    if (player.stamina < 3) return { blocked: 0, message: 'Not enough stamina (3 required).' }

    // ── Server-authoritative: send defend request and await result ──
    try {
      const { battleDefend } = await import('../api/client')
      const result: any = await battleDefend(battleId)

      if (!result?.blocked || result.blocked <= 0) {
        return { blocked: 0, message: result?.message || 'Defend failed.' }
      }

      const { blocked, message } = result

      // Sync stamina from server if provided
      if (typeof result.staminaLeft === 'number' && result.staminaLeft >= 0) {
        usePlayerStore.setState({ stamina: result.staminaLeft })
      } else {
        // Optimistic: subtract 3 stamina locally
        usePlayerStore.setState({ stamina: Math.max(0, player.stamina - 3) })
      }

      // NOTE: Defend now adds damage to own side via server's addDamage() + battle:playerHit
      // socket event. No local state mutation needed — the socket handler updates everything.

      // Hero buff (UI-only)
      usePlayerStore.setState({ heroBuffTicksLeft: 120, heroBuffBattleId: battleId })
      // RP contribution from defending
      try { useResearchStore.getState().contributeRP(2, 'defend') } catch (_) {}

      return { blocked, message }
    } catch (err) {
      console.error('[Battle] Server defend failed:', err)
      return { blocked: 0, message: 'Server error. Try again.' }
    }
  },
}))

// Register on window for anti-bot circular dependency workaround
;(window as any).__xwar_battleStore = useBattleStore
