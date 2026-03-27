/**
 * Battle Service — Server-authoritative combat engine.
 *
 * Ports the core combat tick processor from client-side battleStore.ts
 * to run on the server. All damage calculations, round resolution, and
 * battle outcomes are computed here and broadcast via Socket.IO.
 *
 * Division/player data is read from the database (Drizzle schema).
 * In-memory battle state is held in a Map for tick performance.
 */

import type { Server as SocketServer } from 'socket.io'
import { logger } from '../utils/logger.js'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import {
  players, playerSkills, items, divisions as divisionsTable,
  battles as battlesTable, countries,
} from '../db/schema.js'

// ═══════════════════════════════════════════════
//  SHARED CONSTANTS & TYPES
// ═══════════════════════════════════════════════

// Battle Types (mirrors client types/battle.types.ts)
export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike'
export type TacticalOrder = 'none' | 'charge' | 'fortify' | 'precision' | 'blitz'

export interface OrderEffects {
  atkMult: number
  armorMult: number
  dodgeMult: number
  hitBonus: number
  critBonus: number
  critDmgMult: number
  speedMult: number
}

// Synced with client battleStore.ts TACTICAL_ORDERS — keep in sync!
export const TACTICAL_ORDERS: Record<TacticalOrder, { label: string; effects: OrderEffects }> = {
  none:      { label: 'NONE',      effects: { atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1 } },
  charge:    { label: 'CHARGE',    effects: { atkMult: 1.15, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1 } },
  fortify:   { label: 'FORTIFY',   effects: { atkMult: 1, armorMult: 1.20, dodgeMult: 1.08, hitBonus: 0, critBonus: 0, critDmgMult: 1, speedMult: 1 } },
  precision: { label: 'PRECISION', effects: { atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0.12, critBonus: 10, critDmgMult: 1, speedMult: 1 } },
  blitz:     { label: 'BLITZ',     effects: { atkMult: 1.10, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, critDmgMult: 1.10, speedMult: 1 } },
}

// Division Types (mirrors client stores/army/types.ts)
export type DivisionType = 'recon' | 'assault' | 'sniper' | 'rpg' | 'jeep' | 'tank' | 'jet' | 'warship'

interface DivisionTemplate {
  id: DivisionType
  atkDmgMult: number
  hitRate: number
  critRateMult: number
  critDmgMult: number
  healthMult: number
  dodgeMult: number
  armorMult: number
  attackSpeed: number
}

const DIVISION_TEMPLATES: Record<DivisionType, DivisionTemplate> = {
  recon:    { id: 'recon',    atkDmgMult: 0.10, hitRate: 0.50, critRateMult: 0.80, critDmgMult: 1.50, healthMult: 24.0, dodgeMult: 1.30, armorMult: 1.00, attackSpeed: 1.5 },
  assault:  { id: 'assault',  atkDmgMult: 0.11, hitRate: 0.55, critRateMult: 1.00, critDmgMult: 1.60, healthMult: 28.8, dodgeMult: 0.90, armorMult: 1.10, attackSpeed: 1 },
  sniper:   { id: 'sniper',   atkDmgMult: 0.13, hitRate: 0.70, critRateMult: 1.56, critDmgMult: 2.50, healthMult: 24.0, dodgeMult: 0.90, armorMult: 0.80, attackSpeed: 0.6 },
  rpg:      { id: 'rpg',      atkDmgMult: 0.15, hitRate: 0.50, critRateMult: 1.20, critDmgMult: 2.00, healthMult: 30.0, dodgeMult: 0.70, armorMult: 1.30, attackSpeed: 0.8 },
  jeep:     { id: 'jeep',     atkDmgMult: 0.20, hitRate: 0.60, critRateMult: 0.90, critDmgMult: 1.70, healthMult: 30.0, dodgeMult: 1.50, armorMult: 1.50, attackSpeed: 1.3 },
  tank:     { id: 'tank',     atkDmgMult: 0.22, hitRate: 0.66, critRateMult: 1.10, critDmgMult: 1.80, healthMult: 36.0, dodgeMult: 0.80, armorMult: 2.00, attackSpeed: 0.5 },
  jet:      { id: 'jet',      atkDmgMult: 0.26, hitRate: 0.80, critRateMult: 1.75, critDmgMult: 2.80, healthMult: 26.0, dodgeMult: 1.40, armorMult: 1.00, attackSpeed: 0.7 },
  warship:  { id: 'warship',  atkDmgMult: 0.30, hitRate: 0.60, critRateMult: 1.35, critDmgMult: 2.20, healthMult: 40.0, dodgeMult: 0.70, armorMult: 2.50, attackSpeed: 0.4 },
}

const POINTS_TO_WIN_ROUND = 600
const ROUNDS_TO_WIN_BATTLE = 2
const MAX_DAMAGE_PER_CALL = 50_000

function getPointIncrement(totalGroundPoints: number): number {
  if (totalGroundPoints < 100) return 1
  if (totalGroundPoints < 200) return 2
  if (totalGroundPoints < 300) return 3
  if (totalGroundPoints < 400) return 4
  return 5
}

function deviate(v: number): number {
  return v * (0.9 + Math.random() * 0.2)
}

// ═══════════════════════════════════════════════
//  IN-MEMORY BATTLE STATE
// ═══════════════════════════════════════════════

interface BattleSide {
  countryCode: string
  divisionIds: string[]
  engagedDivisionIds: string[]
  damageDealt: number
  manpowerLost: number
  divisionsDestroyed: number
  divisionsRetreated: number
}

interface BattleRound {
  attackerPoints: number
  defenderPoints: number
  attackerDmgTotal: number
  defenderDmgTotal: number
  status: 'active' | 'attacker_won' | 'defender_won'
  startedAt: number
  endedAt?: number
  ticksElapsed?: number
}

interface CombatLogEntry {
  tick: number
  timestamp: number
  type: string
  side: 'attacker' | 'defender'
  divisionName?: string
  damage?: number
  message: string
}

interface DamageEvent {
  playerName: string
  side: 'attacker' | 'defender'
  amount: number
  isCrit: boolean
  isDodged: boolean
  time: number
}

interface BattleTick {
  attackerDamage: number
  defenderDamage: number
}

interface Battle {
  id: string
  type: BattleType
  attackerId: string
  defenderId: string
  regionName: string
  startedAt: number
  ticksElapsed: number
  status: 'active' | 'attacker_won' | 'defender_won'
  attacker: BattleSide
  defender: BattleSide
  attackerRoundsWon: number
  defenderRoundsWon: number
  rounds: BattleRound[]
  currentTick: BattleTick
  combatLog: CombatLogEntry[]
  attackerDamageDealers: Record<string, number>
  defenderDamageDealers: Record<string, number>
  damageFeed: DamageEvent[]
  divisionCooldowns: Record<string, number>
  attackerOrder: TacticalOrder
  defenderOrder: TacticalOrder
  orderMessage: string
  motd: string
}

// In-memory division snapshot for combat performance (avoids DB reads per tick per div)
interface DivisionSnapshot {
  id: string
  type: DivisionType
  name: string
  countryCode: string
  ownerId: string
  manpower: number
  maxManpower: number
  health: number
  maxHealth: number
  experience: number
  status: string
  starMods: {
    atkDmgMult: number; hitRate: number; critRateMult: number; critDmgMult: number
    healthMult: number; dodgeMult: number; armorMult: number; attackSpeed: number
  }
  deployedAtTick?: number
}

// Rate limiter for player actions
const playerCooldowns = new Map<string, number>()
const PLAYER_ACTION_COOLDOWN_MS = 150

// ═══════════════════════════════════════════════
//  BATTLE SERVICE CLASS
// ═══════════════════════════════════════════════

class BattleService {
  private battles = new Map<string, Battle>()
  private divisionCache = new Map<string, DivisionSnapshot>()
  private io: SocketServer | null = null

  /** Attach Socket.IO server */
  setIO(io: SocketServer): void {
    this.io = io
  }

  // ── Getters ──

  getAllBattles(): Battle[] {
    return Array.from(this.battles.values())
  }

  getActiveBattles(): Battle[] {
    return Array.from(this.battles.values()).filter(b => b.status === 'active')
  }

  getBattle(id: string): Battle | undefined {
    return this.battles.get(id)
  }

  // ── Battle creation ──

  async launchBattle(
    attackerCode: string,
    defenderCode: string,
    regionName: string,
    type: BattleType = 'invasion',
  ): Promise<{ success: boolean; message: string; battleId?: string }> {
    // Check for existing active battle in same region
    for (const b of this.battles.values()) {
      if (b.regionName === regionName && b.status === 'active') {
        return { success: false, message: 'Battle already active in this region.' }
      }
    }

    const id = `srv_battle_${Date.now()}_${attackerCode}_${defenderCode}`
    const now = Date.now()

    // Load attacker divisions
    const atkDivRows = await db.select().from(divisionsTable)
      .where(eq(divisionsTable.countryCode, attackerCode))
    const atkReadyDivs = atkDivRows.filter(d => d.status === 'ready')

    if (atkReadyDivs.length === 0) {
      return { success: false, message: 'No ready divisions to attack with.' }
    }

    // Load defender divisions (auto-defense: all ready divisions)
    const defDivRows = await db.select().from(divisionsTable)
      .where(eq(divisionsTable.countryCode, defenderCode))
    const defReadyDivs = defDivRows.filter(d => d.status === 'ready')

    const atkDivIds = atkReadyDivs.map(d => d.id)
    const defDivIds = defReadyDivs.map(d => d.id)

    // Cache division snapshots
    for (const d of [...atkReadyDivs, ...defReadyDivs]) {
      this.cacheDivision(d)
    }

    // Mark divisions as in_combat in DB
    if (atkDivIds.length > 0) {
      await db.update(divisionsTable).set({ status: 'in_combat' }).where(inArray(divisionsTable.id, atkDivIds))
    }
    if (defDivIds.length > 0) {
      await db.update(divisionsTable).set({ status: 'in_combat' }).where(inArray(divisionsTable.id, defDivIds))
    }

    const battle: Battle = {
      id, type, attackerId: attackerCode, defenderId: defenderCode,
      regionName, startedAt: now, ticksElapsed: 0, status: 'active',
      attacker: {
        countryCode: attackerCode, divisionIds: atkDivIds, engagedDivisionIds: atkDivIds,
        damageDealt: 0, manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0,
      },
      defender: {
        countryCode: defenderCode, divisionIds: defDivIds, engagedDivisionIds: defDivIds,
        damageDealt: 0, manpowerLost: 0, divisionsDestroyed: 0, divisionsRetreated: 0,
      },
      attackerRoundsWon: 0, defenderRoundsWon: 0,
      rounds: [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: now }],
      currentTick: { attackerDamage: 0, defenderDamage: 0 },
      combatLog: [{
        tick: 0, timestamp: now, type: 'phase_change', side: 'attacker',
        message: `⚔️ Battle for ${regionName} begins! ${atkDivIds.length} vs ${defDivIds.length} divisions.`,
      }],
      attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [], divisionCooldowns: {},
      attackerOrder: 'none', defenderOrder: 'none',
      orderMessage: '', motd: '',
    }

    this.battles.set(id, battle)

    // Also persist to DB
    await db.insert(battlesTable).values({
      id, attackerId: attackerCode, defenderId: defenderCode,
      regionName, status: 'active',
    })

    // Broadcast battle start
    this.emit(id, 'battle:start', {
      battleId: id, attackerId: attackerCode, defenderId: defenderCode,
      regionName, atkDivCount: atkDivIds.length, defDivCount: defDivIds.length,
    })

    logger.info(`[Battle] Launched: ${attackerCode} → ${defenderCode} (${regionName}), ${atkDivIds.length} vs ${defDivIds.length} divs`)
    return { success: true, message: `Battle for ${regionName} has begun!`, battleId: id }
  }

  // ── Tactical orders ──

  setOrder(battleId: string, side: 'attacker' | 'defender', order: TacticalOrder): boolean {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return false
    if (side === 'attacker') battle.attackerOrder = order
    else battle.defenderOrder = order
    this.emit(battleId, 'battle:order', { battleId, side, order })
    return true
  }

  // ── Player attack ──

  async playerAttack(
    battleId: string, playerId: string, playerName: string, countryCode: string,
  ): Promise<{ damage: number; isCrit: boolean; message: string }> {
    // Rate limit
    const now = Date.now()
    const lastAction = playerCooldowns.get(playerId) ?? 0
    if (now - lastAction < PLAYER_ACTION_COOLDOWN_MS) {
      return { damage: 0, isCrit: false, message: 'Too fast! Wait a moment.' }
    }
    playerCooldowns.set(playerId, now)

    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') {
      return { damage: 0, isCrit: false, message: 'No active battle.' }
    }

    // Auto-detect side from country
    let side: 'attacker' | 'defender'
    if (countryCode === battle.attackerId) side = 'attacker'
    else if (countryCode === battle.defenderId) side = 'defender'
    else return { damage: 0, isCrit: false, message: 'Your country is not in this battle.' }

    // Fetch player + skills + equipped items from DB
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) return { damage: 0, isCrit: false, message: 'Player not found.' }

    const staminaVal = Number(player.stamina ?? 0)
    if (staminaVal < 5) return { damage: 0, isCrit: false, message: 'Not enough stamina (5 required).' }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)

    // Aggregate equipped item stats
    const equippedItems = await db.select().from(items)
      .where(sql`owner_id = ${playerId} AND equipped = true`)
    let eqDmg = 0, eqCritRate = 0, eqCritDmg = 0, eqArmor = 0, eqDodge = 0, eqPrecision = 0
    for (const item of equippedItems) {
      const st = item.stats as any || {}
      eqDmg += st.damage || 0
      eqCritRate += st.critRate || 0
      eqCritDmg += st.critDamage || 0
      eqArmor += st.armor || 0
      eqDodge += st.dodge || 0
      eqPrecision += st.precision || 0
    }

    // Ammo multiplier
    let ammoMult = 1.0
    let ammoCritBonus = 0
    const equippedAmmo = player.equippedAmmo || 'none'
    if (equippedAmmo !== 'none') {
      const ammoField = `${equippedAmmo}Bullets` as keyof typeof player
      const ammoCount = Number((player as any)[ammoField] ?? 0)
      if (ammoCount > 0) {
        if (equippedAmmo === 'green') ammoMult = 1.1
        else if (equippedAmmo === 'blue') ammoMult = 1.2
        else if (equippedAmmo === 'purple') ammoMult = 1.4
        else if (equippedAmmo === 'red') { ammoMult = 1.4; ammoCritBonus = 10 }
        // Consume 1 ammo
        const bulletCol = equippedAmmo === 'green' ? 'green_bullets' : equippedAmmo === 'blue' ? 'blue_bullets' : equippedAmmo === 'purple' ? 'purple_bullets' : 'red_bullets'
        await db.execute(sql`UPDATE players SET ${sql.raw(bulletCol)} = GREATEST(0, ${sql.raw(bulletCol)} - 1) WHERE id = ${playerId}`)
      }
    }

    // Calculate combat stats (mirrors engine/stats.ts + profileStatsGrid)
    const baseDmg = 100 + (skills?.attack ?? 0) * 20 + eqDmg
    const rawHitRate = 50 + eqPrecision + (skills?.precision ?? 0) * 5
    const overflowCrit = Math.max(0, rawHitRate - 90) * 0.5
    const critRate = 10 + (skills?.critRate ?? 0) * 5 + eqCritRate + ammoCritBonus + overflowCrit
    const critMultiplier = 1.5 + ((skills?.critDamage ?? 0) * 20 + eqCritDmg) / 200

    // Tactical order effects
    const orderFx = TACTICAL_ORDERS[side === 'attacker' ? battle.attackerOrder : battle.defenderOrder].effects

    const isCrit = Math.random() * 100 < (critRate + orderFx.critBonus)
    let damage = Math.floor(baseDmg * ammoMult)
    if (isCrit) damage = Math.floor(damage * critMultiplier * orderFx.critDmgMult)
    damage = Math.round(damage * orderFx.atkMult)

    // Cap damage
    damage = Math.min(damage, MAX_DAMAGE_PER_CALL)

    // Apply infra bonus
    const [sideCountry] = await db.select().from(countries)
      .where(eq(countries.code, side === 'attacker' ? battle.attackerId : battle.defenderId)).limit(1)
    if (sideCountry?.militaryBaseLevel && sideCountry.militaryBaseLevel > 0) {
      damage = Math.round(damage * (1 + 0.05 + Math.random() * 0.15))
    }

    // Deduct stamina
    await db.update(players).set({
      stamina: String(Math.max(0, staminaVal - 5)),
    }).where(eq(players.id, playerId))

    // Record damage
    this.addDamage(battleId, side, damage, isCrit, false, playerName)

    // Broadcast hit event
    this.emit(battleId, 'battle:playerHit', {
      battleId, side, playerName, damage, isCrit,
    })

    return {
      damage,
      isCrit,
      message: isCrit ? `💥 CRITICAL HIT! ${damage} damage dealt!` : `⚔️ ${damage} damage dealt.`,
    }
  }

  // ── Player defend ──

  async playerDefend(
    battleId: string, playerId: string, playerName: string, countryCode: string,
  ): Promise<{ blocked: number; message: string }> {
    const now = Date.now()
    const lastAction = playerCooldowns.get(playerId) ?? 0
    if (now - lastAction < PLAYER_ACTION_COOLDOWN_MS) {
      return { blocked: 0, message: 'Too fast! Wait a moment.' }
    }
    playerCooldowns.set(playerId, now)

    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') {
      return { blocked: 0, message: 'No active battle.' }
    }

    let isAttacker: boolean
    if (countryCode === battle.attackerId) isAttacker = true
    else if (countryCode === battle.defenderId) isAttacker = false
    else return { blocked: 0, message: 'Your country is not in this battle.' }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) return { blocked: 0, message: 'Player not found.' }

    const staminaVal = Number(player.stamina ?? 0)
    if (staminaVal < 3) return { blocked: 0, message: 'Not enough stamina (3 required).' }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)

    const armorBlock = (skills?.armor ?? 0) * 5
    const dodgeChance = 5 + (skills?.dodge ?? 0) * 5
    const blocked = armorBlock + Math.floor(dodgeChance * 0.5)

    // Deduct stamina
    await db.update(players).set({
      stamina: String(Math.max(0, staminaVal - 3)),
    }).where(eq(players.id, playerId))

    // Reduce enemy tick damage
    const enemySide = isAttacker ? 'defenderDamage' : 'attackerDamage'
    battle.currentTick[enemySide] = Math.max(0, battle.currentTick[enemySide] - blocked)

    this.emit(battleId, 'battle:playerDefend', { battleId, playerName, blocked, side: isAttacker ? 'attacker' : 'defender' })

    return { blocked, message: `🛡️ Blocked ${blocked} incoming damage!` }
  }

  // ── Deploy divisions ──

  async deployDivisions(
    battleId: string, divisionIds: string[], side: 'attacker' | 'defender', countryCode: string,
  ): Promise<{ success: boolean; message: string }> {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const sideCountry = side === 'attacker' ? battle.attackerId : battle.defenderId
    if (countryCode !== sideCountry) return { success: false, message: 'Country mismatch for this side.' }

    // Load divisions from DB
    const divRows = await db.select().from(divisionsTable).where(inArray(divisionsTable.id, divisionIds))
    const validIds = divRows
      .filter(d => d.countryCode === sideCountry && (d.status === 'ready' || d.status === 'training') && (d.health ?? 0) > 0)
      .map(d => d.id)

    if (validIds.length === 0) return { success: false, message: 'No valid divisions to deploy.' }

    // Update DB status
    await db.update(divisionsTable).set({ status: 'in_combat' }).where(inArray(divisionsTable.id, validIds))

    // Cache snapshots
    for (const d of divRows.filter(r => validIds.includes(r.id))) {
      this.cacheDivision(d)
    }

    // Update battle state
    const sideData = side === 'attacker' ? battle.attacker : battle.defender
    sideData.divisionIds = [...new Set([...sideData.divisionIds, ...validIds])]
    sideData.engagedDivisionIds = [...new Set([...sideData.engagedDivisionIds, ...validIds])]

    battle.combatLog.push({
      tick: battle.ticksElapsed, timestamp: Date.now(), type: 'reinforcement', side,
      message: `🚀 ${validIds.length} division(s) deployed as reinforcements!`,
    })

    this.emit(battleId, 'battle:deploy', { battleId, divisionIds: validIds, side })

    return { success: true, message: `${validIds.length} division(s) deployed to battle!` }
  }

  // ── Recall division ──

  async recallDivision(
    battleId: string, divisionId: string, side: 'attacker' | 'defender',
  ): Promise<{ success: boolean; message: string }> {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const sideData = side === 'attacker' ? battle.attacker : battle.defender
    if (!sideData.engagedDivisionIds.includes(divisionId)) {
      return { success: false, message: 'Division not in battle.' }
    }

    // Check 120-tick deployment cooldown
    const cached = this.divisionCache.get(divisionId)
    if (cached?.deployedAtTick != null) {
      const ticksDeployed = battle.ticksElapsed - cached.deployedAtTick
      if (ticksDeployed < 120) {
        const minsRemaining = Math.ceil(((120 - ticksDeployed) * 15) / 60)
        return { success: false, message: `Division must stay deployed for 30 min. ${minsRemaining} min remaining.` }
      }
    }

    // Remove from engaged
    sideData.engagedDivisionIds = sideData.engagedDivisionIds.filter(id => id !== divisionId)

    // Update DB status
    await db.update(divisionsTable).set({ status: 'recovering' }).where(eq(divisionsTable.id, divisionId))

    const divName = cached?.name || divisionId

    battle.combatLog.push({
      tick: battle.ticksElapsed, timestamp: Date.now(), type: 'retreat', side,
      message: `🛡️ ${divName} withdrawn from battle.`,
    })

    this.emit(battleId, 'battle:recall', { battleId, divisionId, side, divisionName: divName })

    return { success: true, message: `${divName} recalled.` }
  }

  // ═══════════════════════════════════════════════
  //  CORE COMBAT TICK PROCESSOR
  // ═══════════════════════════════════════════════

  /**
   * Process one combat tick for ALL active battles.
   * Called every 15 seconds by the server GameClock.
   */
  async processCombatTick(): Promise<void> {
    const activeBattles = this.getActiveBattles()
    if (activeBattles.length === 0) return

    const tickStart = Date.now()

    for (const battle of activeBattles) {
      try {
        await this.processSingleBattleTick(battle)
      } catch (e) {
        logger.error(e, `[Battle] Error processing tick for ${battle.id}:`)
      }
    }

    const elapsed = Date.now() - tickStart
    if (elapsed > 5000) {
      logger.warn(`[Battle] Combat tick took ${elapsed}ms for ${activeBattles.length} battles — consider optimization`)
    }
  }

  private async processSingleBattleTick(battle: Battle): Promise<void> {
    const now = Date.now()
    const tick = battle.ticksElapsed + 1
    battle.ticksElapsed = tick

    // Reset per-tick damage counter
    battle.currentTick = { attackerDamage: 0, defenderDamage: 0 }

    // Get alive divisions for each side from cache
    const atkDivIds = battle.attacker.engagedDivisionIds.filter(id => {
      const d = this.divisionCache.get(id)
      return d && d.status !== 'destroyed' && d.status !== 'recovering'
    })
    const defDivIds = battle.defender.engagedDivisionIds.filter(id => {
      const d = this.divisionCache.get(id)
      return d && d.status !== 'destroyed' && d.status !== 'recovering'
    })

    // Base player stats (server uses average since multiple players may be in battle)
    // For now, use standard base values — individual player stats are applied in playerAttack
    const baseAttack = 100
    const baseCritRate = 10
    const baseCritMultiplier = 1.0
    const baseDodge = 5
    const baseArmor = 0

    // ── Compute division damage for attacker ──
    let atkTotalDmg = 0
    let atkCrits = 0
    const cooldowns = battle.divisionCooldowns

    for (const divId of atkDivIds) {
      const div = this.divisionCache.get(divId)
      if (!div) continue
      const template = DIVISION_TEMPLATES[div.type]
      if (!template) continue

      const atkOrd = TACTICAL_ORDERS[battle.attackerOrder].effects
      const sm = div.starMods

      const tAtkDmg = template.atkDmgMult * (1 + sm.atkDmgMult)
      const tHitRate = template.hitRate * (1 + sm.hitRate)
      const tCritRate = template.critRateMult * (1 + sm.critRateMult)
      const tCritDmg = template.critDmgMult * (1 + sm.critDmgMult)
      const tAtkSpeed = (template.attackSpeed) * (1 + sm.attackSpeed)

      const as = tAtkSpeed * atkOrd.speedMult
      cooldowns[divId] = (cooldowns[divId] || 0) + 1.0

      while (cooldowns[divId] >= as) {
        cooldowns[divId] -= as

        const divLevel = Math.floor((div.experience || 0) / 10)

        // Hit check
        if (Math.random() > Math.min(0.95, tHitRate + divLevel * 0.01 + atkOrd.hitBonus)) continue

        // Base damage
        let dmg = Math.floor((baseAttack + div.manpower * 3) * (tAtkDmg + divLevel * 0.01))

        // Crit check
        const effectiveCritRate = deviate((baseCritRate + atkOrd.critBonus) * (tCritRate + divLevel * 0.01))
        if (Math.random() * 100 < effectiveCritRate) {
          const effectiveCritMult = baseCritMultiplier * (tCritDmg + divLevel * 0.01)
          dmg = Math.floor(dmg * effectiveCritMult)
          atkCrits++
        }

        // Strength modifier
        const strength = div.health / div.maxHealth
        dmg = Math.floor(dmg * strength)
        dmg = Math.floor(dmg * atkOrd.atkMult)
        dmg = Math.floor(deviate(dmg))
        atkTotalDmg += Math.max(1, dmg)
      }

      // Experience gain
      if (div.experience < 100) {
        div.experience = Math.min(100, div.experience + 0.5)
      }
    }

    // ── Compute division damage for defender ──
    let defTotalDmg = 0
    let defCrits = 0

    for (const divId of defDivIds) {
      const div = this.divisionCache.get(divId)
      if (!div) continue
      const template = DIVISION_TEMPLATES[div.type]
      if (!template) continue

      const defOrd = TACTICAL_ORDERS[battle.defenderOrder].effects
      const sm = div.starMods

      const dAtkDmg = template.atkDmgMult * (1 + sm.atkDmgMult)
      const dHitRate = template.hitRate * (1 + sm.hitRate)
      const dCritRate = template.critRateMult * (1 + sm.critRateMult)
      const dCritDmg = template.critDmgMult * (1 + sm.critDmgMult)
      const dAtkSpeed = (template.attackSpeed) * (1 + sm.attackSpeed)

      const defAS = dAtkSpeed * defOrd.speedMult
      cooldowns[divId] = (cooldowns[divId] || 0) + 1.0

      while (cooldowns[divId] >= defAS) {
        cooldowns[divId] -= defAS

        const divLevel = Math.floor((div.experience || 0) / 10)

        if (Math.random() > Math.min(0.95, dHitRate + divLevel * 0.01 + defOrd.hitBonus)) continue

        let dmg = Math.floor((baseAttack + div.manpower * 3) * (dAtkDmg + divLevel * 0.01))

        const effectiveCritRate = deviate((baseCritRate + defOrd.critBonus) * (dCritRate + divLevel * 0.01))
        if (Math.random() * 100 < effectiveCritRate) {
          const effectiveCritMult = baseCritMultiplier * (dCritDmg + divLevel * 0.01)
          dmg = Math.floor(dmg * effectiveCritMult)
          defCrits++
        }

        const strength = div.health / div.maxHealth
        dmg = Math.floor(dmg * strength)
        dmg = Math.floor(dmg * defOrd.atkMult)
        dmg = Math.floor(deviate(dmg))
        defTotalDmg += Math.max(1, dmg)
      }

      if (div.experience < 100) {
        div.experience = Math.min(100, div.experience + 0.5)
      }
    }

    // ── Apply damage to divisions (25% of total → manpower/health loss) ──
    const manpowerDmgToDefender = Math.floor(atkTotalDmg * 0.25)
    const manpowerDmgToAttacker = Math.floor(defTotalDmg * 0.25)

    // Damage defender divisions
    if (defDivIds.length > 0 && manpowerDmgToDefender > 0) {
      const perDiv = Math.max(1, Math.floor(manpowerDmgToDefender / defDivIds.length))
      for (const id of defDivIds) {
        this.applyDivisionDamage(id, perDiv)
      }
    }

    // Damage attacker divisions
    if (atkDivIds.length > 0 && manpowerDmgToAttacker > 0) {
      const perDiv = Math.max(1, Math.floor(manpowerDmgToAttacker / atkDivIds.length))
      for (const id of atkDivIds) {
        this.applyDivisionDamage(id, perDiv)
      }
    }

    // Update damage totals
    battle.attacker.damageDealt += atkTotalDmg
    battle.defender.damageDealt += defTotalDmg
    battle.attacker.manpowerLost += manpowerDmgToAttacker
    battle.defender.manpowerLost += manpowerDmgToDefender
    battle.currentTick.attackerDamage = atkTotalDmg
    battle.currentTick.defenderDamage = defTotalDmg

    // Check destroyed divisions
    let atkDestroyed = 0
    let defDestroyed = 0
    for (const id of battle.attacker.engagedDivisionIds) {
      const d = this.divisionCache.get(id)
      if (d?.status === 'destroyed') atkDestroyed++
    }
    for (const id of battle.defender.engagedDivisionIds) {
      const d = this.divisionCache.get(id)
      if (d?.status === 'destroyed') defDestroyed++
    }
    battle.attacker.divisionsDestroyed += atkDestroyed
    battle.defender.divisionsDestroyed += defDestroyed

    // Remove destroyed from engaged
    battle.attacker.engagedDivisionIds = battle.attacker.engagedDivisionIds.filter(id => {
      const d = this.divisionCache.get(id)
      return d && d.status !== 'destroyed' && d.status !== 'recovering'
    })
    battle.defender.engagedDivisionIds = battle.defender.engagedDivisionIds.filter(id => {
      const d = this.divisionCache.get(id)
      return d && d.status !== 'destroyed' && d.status !== 'recovering'
    })

    // ── Ground points ──
    const activeRoundIndex = battle.rounds.length - 1
    const activeRound = battle.rounds[activeRoundIndex]

    // Accumulate division damage into round totals
    // (player damage is accumulated separately in addDamage())
    activeRound.attackerDmgTotal += atkTotalDmg
    activeRound.defenderDmgTotal += defTotalDmg

    const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
    const pointIncrement = getPointIncrement(totalGroundPoints)

    // Award ground points based on TOTAL round-accumulated damage, not per-tick
    const roundAtkDmg = activeRound.attackerDmgTotal
    const roundDefDmg = activeRound.defenderDmgTotal

    if (roundAtkDmg > 0 || roundDefDmg > 0) {
      if (roundAtkDmg > roundDefDmg) activeRound.attackerPoints += pointIncrement
      else if (roundDefDmg > roundAtkDmg) activeRound.defenderPoints += pointIncrement
      else {
        // Tie: division count tiebreaker, then random
        const atkAlive = battle.attacker.engagedDivisionIds.length
        const defAlive = battle.defender.engagedDivisionIds.length
        if (atkAlive > defAlive) activeRound.attackerPoints += pointIncrement
        else if (defAlive > atkAlive) activeRound.defenderPoints += pointIncrement
        else if (Math.random() < 0.5) activeRound.attackerPoints += pointIncrement
        else activeRound.defenderPoints += pointIncrement
      }
    } else if (battle.attacker.engagedDivisionIds.length > 0 && battle.defender.engagedDivisionIds.length === 0) {
      activeRound.attackerPoints += pointIncrement
    } else if (battle.defender.engagedDivisionIds.length > 0 && battle.attacker.engagedDivisionIds.length === 0) {
      activeRound.defenderPoints += pointIncrement
    }

    // ── Round / Battle resolution ──
    if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND || activeRound.defenderPoints >= POINTS_TO_WIN_ROUND) {
      activeRound.endedAt = now
      activeRound.ticksElapsed = tick

      if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND) {
        battle.attackerRoundsWon++
        activeRound.status = 'attacker_won'
      } else {
        battle.defenderRoundsWon++
        activeRound.status = 'defender_won'
      }

      if (battle.attackerRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
        battle.status = 'attacker_won'
        battle.combatLog.push({
          tick, timestamp: now, type: 'phase_change', side: 'attacker',
          message: `⚔️ VICTORY! ${battle.attackerId} captures ${battle.regionName}!`,
        })
      } else if (battle.defenderRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
        battle.status = 'defender_won'
        battle.combatLog.push({
          tick, timestamp: now, type: 'phase_change', side: 'defender',
          message: `🛡️ DEFENSE HOLDS! ${battle.defenderId} defends ${battle.regionName}!`,
        })
      } else {
        // New round
        battle.rounds.push({ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: now })
        battle.combatLog.push({
          tick, timestamp: now, type: 'phase_change', side: 'attacker',
          message: `🔔 Round ${battle.rounds.length - 1} complete! New round begins.`,
        })

        this.emit(battle.id, 'battle:roundEnd', {
          battleId: battle.id, roundIndex: activeRoundIndex,
          winner: activeRound.status === 'attacker_won' ? 'attacker' : 'defender',
        })
      }

      // ── Battle end: clean up divisions ──
      if (battle.status !== 'active') {
        await this.finalizeBattle(battle)
      }
    }

    // ── Broadcast tick state ──
    this.emit(battle.id, 'battle:tick', {
      battleId: battle.id,
      tickNumber: tick,
      attackerDamage: atkTotalDmg,
      defenderDamage: defTotalDmg,
      attackerCrits: atkCrits,
      defenderCrits: defCrits,
      rounds: battle.rounds,
      attackerRoundsWon: battle.attackerRoundsWon,
      defenderRoundsWon: battle.defenderRoundsWon,
      status: battle.status,
      attackerEngaged: battle.attacker.engagedDivisionIds.length,
      defenderEngaged: battle.defender.engagedDivisionIds.length,
    })

    // Trim combat log
    if (battle.combatLog.length > 100) {
      battle.combatLog = battle.combatLog.slice(-100)
    }
  }

  // ── Finalize a completed battle ──

  private async finalizeBattle(battle: Battle): Promise<void> {
    // Set all in_combat divisions to recovering
    const allDivIds = [...battle.attacker.divisionIds, ...battle.defender.divisionIds]
    if (allDivIds.length > 0) {
      await db.update(divisionsTable).set({ status: 'recovering' }).where(inArray(divisionsTable.id, allDivIds))
    }

    // Update division cache
    for (const id of allDivIds) {
      const d = this.divisionCache.get(id)
      if (d && d.status !== 'destroyed') {
        d.status = 'recovering'
      }
    }

    // Persist battle result to DB
    await db.update(battlesTable).set({
      status: battle.status,
      attackerDamage: battle.attacker.damageDealt,
      defenderDamage: battle.defender.damageDealt,
      attackerRoundsWon: battle.attackerRoundsWon,
      defenderRoundsWon: battle.defenderRoundsWon,
      winner: battle.status === 'attacker_won' ? battle.attackerId : battle.defenderId,
      finishedAt: new Date(),
      battleLog: battle.combatLog,
    }).where(eq(battlesTable.id, battle.id))

    // Broadcast battle end
    this.emit(battle.id, 'battle:end', {
      battleId: battle.id,
      winner: battle.status === 'attacker_won' ? battle.attackerId : battle.defenderId,
      attackerStats: {
        damageDealt: battle.attacker.damageDealt,
        manpowerLost: battle.attacker.manpowerLost,
        divisionsDestroyed: battle.attacker.divisionsDestroyed,
      },
      defenderStats: {
        damageDealt: battle.defender.damageDealt,
        manpowerLost: battle.defender.manpowerLost,
        divisionsDestroyed: battle.defender.divisionsDestroyed,
      },
    })

    logger.info(`[Battle] ${battle.id} ended: ${battle.status} (ATK ${battle.attacker.damageDealt} / DEF ${battle.defender.damageDealt})`)
  }

  // ── Internal helpers ──

  private addDamage(
    battleId: string, side: 'attacker' | 'defender', amount: number,
    isCrit: boolean, isDodged: boolean, playerName: string,
  ): void {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return

    let finalAmount = Math.min(amount, MAX_DAMAGE_PER_CALL)
    if (finalAmount <= 0 || !Number.isFinite(finalAmount)) return

    if (side === 'attacker') {
      battle.attacker.damageDealt += finalAmount
      battle.attackerDamageDealers[playerName] = (battle.attackerDamageDealers[playerName] || 0) + finalAmount
    } else {
      battle.defender.damageDealt += finalAmount
      battle.defenderDamageDealers[playerName] = (battle.defenderDamageDealers[playerName] || 0) + finalAmount
    }

    battle.currentTick[side === 'attacker' ? 'attackerDamage' : 'defenderDamage'] += finalAmount

    // Also accumulate player damage into the active round's totals
    const activeRound = battle.rounds[battle.rounds.length - 1]
    if (activeRound && activeRound.status === 'active') {
      if (side === 'attacker') activeRound.attackerDmgTotal = (activeRound.attackerDmgTotal ?? 0) + finalAmount
      else activeRound.defenderDmgTotal = (activeRound.defenderDmgTotal ?? 0) + finalAmount
    }

    battle.damageFeed = [
      { playerName, side, amount: finalAmount, isCrit, isDodged, time: Date.now() },
      ...battle.damageFeed,
    ].slice(0, 20)
  }

  private applyDivisionDamage(divisionId: string, damage: number): void {
    const div = this.divisionCache.get(divisionId)
    if (!div || div.status === 'destroyed' || div.status === 'recovering') return

    div.health = Math.max(0, div.health - damage)
    div.manpower = Math.max(0, div.manpower - Math.floor(damage * 0.1))

    if (div.health <= 0) {
      div.status = 'destroyed'
      // Persist to DB
      db.update(divisionsTable).set({
        status: 'destroyed',
        health: 0,
        manpower: div.manpower,
      }).where(eq(divisionsTable.id, divisionId)).catch(e => {
        logger.error(e, `[Battle] Failed to persist destroyed division ${divisionId}:`)
      })
    }
  }

  private cacheDivision(row: any): void {
    const sm = (row.statModifiers ?? {}) as any
    this.divisionCache.set(row.id, {
      id: row.id,
      type: row.type as DivisionType,
      name: row.name,
      countryCode: row.countryCode ?? '',
      ownerId: row.ownerId ?? '',
      manpower: row.manpower ?? 0,
      maxManpower: row.maxManpower ?? 0,
      health: row.health ?? 0,
      maxHealth: row.maxHealth ?? 0,
      experience: row.experience ?? 0,
      status: row.status ?? 'ready',
      starMods: {
        atkDmgMult: sm.atkDmgMult ?? 0,
        hitRate: sm.hitRate ?? 0,
        critRateMult: sm.critRateMult ?? 0,
        critDmgMult: sm.critDmgMult ?? 0,
        healthMult: sm.healthMult ?? 0,
        dodgeMult: sm.dodgeMult ?? 0,
        armorMult: sm.armorMult ?? 0,
        attackSpeed: sm.attackSpeed ?? 0,
      },
    })
  }

  private emit(battleId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`battle:${battleId}`).emit(event, data)
    }
  }
}

/** Global singleton */
export const battleService = new BattleService()
