/**
 * Battle Service — Server-authoritative combat engine.
 *
 * Ports the core combat tick processor from client-side battleStore.ts
 * to run on the server. All damage calculations, round resolution, and
 * battle outcomes are computed here and broadcast via Socket.IO.
 *
 * Player data is read from the database (Drizzle schema).
 * In-memory battle state is held in a Map for tick performance.
 */

import type { Server as SocketServer } from 'socket.io'
import { logger } from '../utils/logger.js'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import {
  players, playerSkills, items,
  battles as battlesTable, countries, muMembers, governments, militaryUnits, alliances,
} from '../db/schema.js'
import { REGION_ADJACENCY, CAPITAL_REGIONS, isConnectedToCapital } from '../data/region-adjacency.js'
import { warCardEmitter, evaluateBattleCards } from './warCard.service.js'

// ═══════════════════════════════════════════════
//  SHARED CONSTANTS & TYPES
// ═══════════════════════════════════════════════

// Battle Types (mirrors client types/battle.types.ts)
export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike' | 'revolt'
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



const POINTS_TO_WIN_ROUND = 300
const ROUNDS_TO_WIN_BATTLE = 2
const MAX_ROUNDS = 3
const TERRAIN_TICK_GATE = 8  // Only award terrain every 8th tick (8 × 15s = 120s)

// Battle Order costs (money)
const BATTLE_ORDER_COSTS: Record<string, number> = { low: 100, medium: 200, high: 300 }
const BATTLE_ORDER_BONUS: Record<string, number> = { low: 0.05, medium: 0.10, high: 0.15 }

function getPointIncrement(totalGroundPoints: number): number {
  if (totalGroundPoints < 100) return 1
  if (totalGroundPoints < 200) return 2
  if (totalGroundPoints < 300) return 3
  if (totalGroundPoints < 400) return 4
  if (totalGroundPoints < 500) return 5
  if (totalGroundPoints < 600) return 6
  return 6  // cap at +6
}

// ═══════════════════════════════════════════════
//  BATTLE ORDER INTERFACE
// ═══════════════════════════════════════════════

export interface BattleOrder {
  id: string
  battleId: string
  issuerType: 'country' | 'mu'
  issuerCode: string        // country code or MU id
  side: 'attacker' | 'defender'
  priority: 'low' | 'medium' | 'high'
  issuedBy: string          // player name
  issuedAt: number
}

function deviate(v: number): number {
  return v * (0.9 + Math.random() * 0.2)
}

// ═══════════════════════════════════════════════
//  IN-MEMORY BATTLE STATE
// ═══════════════════════════════════════════════

interface BattleSide {
  countryCode: string
  damageDealt: number
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

// Per-player battle stats for war card evaluation
interface PlayerBattleStats {
  critsLanded: number
  hitsTaken: number
  totalDamage: number
}

interface Battle {
  id: string
  type: BattleType
  attackerId: string
  defenderId: string
  regionName: string
  regionId?: string  // e.g. 'US-FL' — for region_ownership table sync
  attackerRegionId?: string  // Region the attacker launched from (for Military Base bonus)
  startedAt: number
  ticksElapsed: number
  battleTickCounter: number  // Counts ticks for 2-min terrain gate (awards terrain every 8th tick)
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
  attackerOrder: TacticalOrder
  defenderOrder: TacticalOrder
  orderMessage: string
  motd: string
  /** Per-player combat stats for war card evaluation (keyed by playerId) */
  playerBattleStats: Record<string, PlayerBattleStats>
  /** Adrenaline state per player — DB-persisted */
  adrenalineState: Record<string, AdrenalineState>
  /** Battle orders — per country/MU, not per side */
  battleOrders: BattleOrder[]
  /** Whether the defended region is connected to the defender's capital via supply line */
  defenderHasSupplyLine: boolean
  /** Revolt pressure value (0-40) — only relevant for type=revolt */
  revoltPressure: number
}



// Rate limiter for player actions
const playerCooldowns = new Map<string, number>()
const PLAYER_ACTION_COOLDOWN_MS = 150

// ── Adrenaline state — now stored inside each Battle object (DB-persisted) ──
interface AdrenalineState {
  value: number        // 0-100
  peakAt: number       // timestamp when hit 100 (0 = not peaked)
  crashUntil: number   // timestamp crash debuff expires
  surgeUntil: number   // timestamp surge buff expires
  surgeOrder: TacticalOrder // order active when surge was triggered
}

// Get adrenaline state from battle object (DB-persisted)
function getAdrenaline(battle: Battle, playerId: string): AdrenalineState {
  const states = (battle as any).adrenalineState as Record<string, AdrenalineState> ?? {}
  if (!states[playerId]) {
    states[playerId] = { value: 0, peakAt: 0, crashUntil: 0, surgeUntil: 0, surgeOrder: 'none' }
    ;(battle as any).adrenalineState = states
  }
  return states[playerId]
}

// ═══════════════════════════════════════════════
//  BATTLE SERVICE CLASS
// ═══════════════════════════════════════════════

class BattleService {
  private battles = new Map<string, Battle>()
  private weaponPresence = new Map<string, Record<'attacker' | 'defender', Record<string, { players: Record<string, { hitCount: number; totalDamage: number }>; expiryTick: number }>>>()
  private io: SocketServer | null = null
  private _migrationRan = false

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

  // ── Admin: Force-end a battle with declared winner ──

  async adminForceEnd(battleId: string, winner: 'attacker' | 'defender'): Promise<void> {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') throw new Error('Battle not active')

    battle.status = winner === 'attacker' ? 'attacker_won' : 'defender_won'
    // Bump rounds to satisfy finalizeBattle
    const now = Date.now()
    const activeRound = battle.rounds[battle.rounds.length - 1]
    if (activeRound) {
      activeRound.endedAt = now
      activeRound.status = battle.status as any
    }
    if (winner === 'attacker') battle.attackerRoundsWon = 3
    else battle.defenderRoundsWon = 3

    battle.combatLog.push({
      tick: battle.ticksElapsed, timestamp: now, type: 'phase_change',
      side: winner,
      message: `🛑 ADMIN: Battle force-ended. ${winner === 'attacker' ? battle.attackerId : battle.defenderId} declared winner.`,
    })

    await this.finalizeBattle(battle)
    logger.info(`[Battle] Admin force-ended ${battleId} — winner: ${winner}`)
  }

  // ── Battle creation ──

  async launchBattle(
    attackerCode: string,
    defenderCode: string,
    regionName: string,
    type: BattleType = 'invasion',
    regionId?: string,
    attackerRegionId?: string,
    revoltPressure: number = 0,
  ): Promise<{ success: boolean; message: string; battleId?: string }> {
    // ── One-battle-per-country-pair check ──
    for (const b of this.battles.values()) {
      if (b.status === 'active' &&
        ((b.attackerId === attackerCode && b.defenderId === defenderCode) ||
         (b.attackerId === defenderCode && b.defenderId === attackerCode))) {
        return { success: false, message: 'A battle is already active between these countries.', battleId: b.id }
      }
    }

    // Check for existing active battle in same region (memory + DB)
    for (const b of this.battles.values()) {
      if (b.regionName === regionName && b.status === 'active') {
        return { success: false, message: 'Battle already active in this region.', battleId: b.id }
      }
    }
    // Also check DB for any persisted active battles in this region
    const existingResult = await db.execute(sql`
      SELECT id FROM battles WHERE region_name = ${regionName} AND status = 'active' LIMIT 1
    `)
    const existingInDB = Array.isArray(existingResult) ? existingResult : (existingResult as any)?.rows ?? []
    if (existingInDB.length > 0) {
      const existingId = existingInDB[0].id as string
      if (!this.battles.has(existingId)) {
        await this.restoreFromDB()
      }
      return { success: false, message: 'Battle already active in this region.', battleId: existingId }
    }

    // ── Compute supply line for defender ──
    const defenderHasSupplyLine = await this.computeDefenderSupplyLine(defenderCode, regionId || regionName)

    // Generate a proper UUID so it matches battlesTable.id (UUID primary key)
    const idResult = await db.execute(sql`SELECT gen_random_uuid() AS id`)
    const idRows = Array.isArray(idResult) ? idResult : (idResult as any)?.rows ?? []
    const id = idRows[0]?.id as string
    const now = Date.now()

    const battle: Battle = {
      id, type, attackerId: attackerCode, defenderId: defenderCode,
      regionName, regionId, attackerRegionId,
      startedAt: now, ticksElapsed: 0, battleTickCounter: 0, status: 'active',
      attacker: { countryCode: attackerCode, damageDealt: 0 },
      defender: { countryCode: defenderCode, damageDealt: 0 },
      attackerRoundsWon: 0, defenderRoundsWon: 0,
      rounds: [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: now }],
      currentTick: { attackerDamage: 0, defenderDamage: 0 },
      combatLog: [{
        tick: 0, timestamp: now, type: 'phase_change', side: 'attacker',
        message: type === 'revolt'
          ? `🔥 REVOLT for ${regionName} begins! Resistance: ${revoltPressure}%`
          : `⚔️ Battle for ${regionName} begins!`,
      }],
      attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [],
      attackerOrder: 'none', defenderOrder: 'none',
      orderMessage: '', motd: '',
      playerBattleStats: {},
      adrenalineState: {},
      battleOrders: [],
      defenderHasSupplyLine,
      revoltPressure: type === 'revolt' ? Math.min(40, Math.max(0, revoltPressure)) : 0,
    }

    // ── Persist to DB immediately so it survives refreshes ──
    await db.insert(battlesTable).values({
      id,
      attackerId: attackerCode,
      defenderId: defenderCode,
      regionName,
      regionId: regionId || null,
      type: type,
      status: 'active',
      round: 1,
      maxRounds: 3,
      attackerDamage: 0,
      defenderDamage: 0,
      attackerRoundsWon: 0,
      defenderRoundsWon: 0,
      startedAt: new Date(now),
      battleLog: [],
    }).onConflictDoNothing()

    this.battles.set(id, battle)

    // Broadcast battle start (matches client socket-hooks.ts 'battle:started' listener)
    this.emit(id, 'battle:started', {
      battleId: id, attackerCode, defenderCode,
      targetRegion: regionName, regionId, type,
    })

    logger.info(`[Battle] Launched & persisted: ${attackerCode} → ${defenderCode} (${regionName}) type=${type} id=${id}`)
    return { success: true, message: `Battle for ${regionName} has begun!`, battleId: id }
  }

  // ── Battle Orders ──

  async addBattleOrder(
    battleId: string,
    issuerType: 'country' | 'mu',
    issuerCode: string,
    side: 'attacker' | 'defender',
    priority: 'low' | 'medium' | 'high',
    issuedBy: string,
  ): Promise<{ success: boolean; message: string }> {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return { success: false, message: 'Battle not active.' }

    // Check for existing order from same issuer
    const existing = battle.battleOrders.find(o => o.issuerType === issuerType && o.issuerCode === issuerCode)
    if (existing) return { success: false, message: `A battle order from this ${issuerType} is already active.` }

    const cost = BATTLE_ORDER_COSTS[priority] ?? 200
    const bonusPct = Math.round((BATTLE_ORDER_BONUS[priority] ?? 0.10) * 100)

    // Deduct cost
    if (issuerType === 'country') {
      // Deduct from country fund
      const updateResult = await db.execute(sql`
        UPDATE countries SET fund = jsonb_set(
          COALESCE(fund, '{}'::jsonb),
          '{money}',
          (GREATEST(0, COALESCE((fund->>'money')::numeric, 0) - ${cost}))::text::jsonb
        )
        WHERE code = ${issuerCode} AND COALESCE((fund->>'money')::numeric, 0) >= ${cost}
      `)
      const rowCount = (updateResult as any)?.rowCount ?? (updateResult as any)?.length ?? 0
      if (rowCount === 0) return { success: false, message: `Not enough money in national fund (${cost} required).` }
    } else {
      // Deduct from MU treasury
      const updateResult = await db.execute(sql`
        UPDATE military_units SET vault = jsonb_set(
          COALESCE(vault, '{}'::jsonb),
          '{treasury}',
          (GREATEST(0, COALESCE((vault->>'treasury')::numeric, 0) - ${cost}))::text::jsonb
        )
        WHERE id = ${issuerCode}::uuid AND COALESCE((vault->>'treasury')::numeric, 0) >= ${cost}
      `)
      const rowCount = (updateResult as any)?.rowCount ?? (updateResult as any)?.length ?? 0
      if (rowCount === 0) return { success: false, message: `Not enough money in MU treasury (${cost} required).` }
    }

    const order: BattleOrder = {
      id: `bo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      battleId,
      issuerType,
      issuerCode,
      side,
      priority,
      issuedBy,
      issuedAt: Date.now(),
    }

    battle.battleOrders.push(order)

    this.emit(battleId, 'battle:order', { battleId, order })
    logger.info(`[Battle] Battle order issued: ${issuerType}=${issuerCode} priority=${priority} side=${side} by ${issuedBy}`)

    return { success: true, message: `🎯 Battle order issued! ${priority.toUpperCase()} priority (+${bonusPct}% damage). Cost: ${cost} money.` }
  }

  // ── Supply Line Computation ──

  private async computeDefenderSupplyLine(defenderCode: string, regionIdOrName: string): Promise<boolean> {
    try {
      // Get all region IDs controlled by the defender from region_ownership table
      const ownedResult = await db.execute(sql`
        SELECT region_id FROM region_ownership WHERE country_code = ${defenderCode}
      `)
      const ownedRows = Array.isArray(ownedResult) ? ownedResult : (ownedResult as any)?.rows ?? []
      const controlledRegions = new Set<string>(ownedRows.map((r: any) => r.region_id as string))

      // Also include the defender's core regions (from REGION_ADJACENCY where cc matches)
      for (const [rId, node] of Object.entries(REGION_ADJACENCY)) {
        if (node.cc === defenderCode) controlledRegions.add(rId)
      }

      // Remove regions occupied by others (from occupied_regions)
      const occupiedResult = await db.execute(sql`
        SELECT occupied_regions FROM countries WHERE code != ${defenderCode}
      `)
      const occupiedRows = Array.isArray(occupiedResult) ? occupiedResult : (occupiedResult as any)?.rows ?? []
      for (const row of occupiedRows as any[]) {
        const occ = row.occupied_regions as Record<string, string> | null
        if (occ) {
          // occupied_regions format: { regionName: originalOwnerCode }
          // We need to map regionName → regionId — but we don't have that mapping here
          // For now, remove from controlledRegions if the region belongs to defender
          for (const [, origOwner] of Object.entries(occ)) {
            if (origOwner === defenderCode) {
              // This region was taken from the defender — but we only have regionName, not regionId
              // The BFS uses regionIds, so this is an approximation
            }
          }
        }
      }

      // Use the target regionId for the BFS check
      const targetId = regionIdOrName  // Expecting regionId format 'US-FL'
      return isConnectedToCapital(defenderCode, targetId, controlledRegions)
    } catch (e) {
      logger.warn(`[Battle] Supply line check failed for ${defenderCode}, defaulting to true`)
      return true  // Default to connected on error
    }
  }

  /** Recompute supply lines for all active battles involving this defender */
  async recomputeSupplyLinesForCountry(defenderCode: string): Promise<void> {
    for (const battle of this.battles.values()) {
      if (battle.status !== 'active') continue
      if (battle.defenderId === defenderCode) {
        battle.defenderHasSupplyLine = await this.computeDefenderSupplyLine(
          defenderCode, battle.regionId || battle.regionName
        )
      }
    }
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
    forceSide?: 'attacker' | 'defender',
  ): Promise<{ damage: number; isCrit: boolean; isMiss: boolean; isDodged: boolean; side: 'attacker' | 'defender'; message: string; staminaLeft: number; adrenaline: number }> {
    const FAIL = (msg: string) => ({ damage: 0, isCrit: false, isMiss: false, isDodged: false, side: 'attacker' as const, message: msg, staminaLeft: -1, adrenaline: 0 })

    // Rate limit
    const now = Date.now()
    const lastAction = playerCooldowns.get(playerId) ?? 0
    if (now - lastAction < PLAYER_ACTION_COOLDOWN_MS) {
      return FAIL('Too fast! Wait a moment.')
    }
    playerCooldowns.set(playerId, now)

    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') {
      return FAIL('No active battle.')
    }

    // Determine side — use forceSide if provided, otherwise auto-detect from country
    let side: 'attacker' | 'defender'
    if (forceSide) {
      side = forceSide
    } else if (countryCode === battle.attackerId) {
      side = 'attacker'
    } else if (countryCode === battle.defenderId) {
      side = 'defender'
    } else {
      // Foreign player without explicit side — default to attacker
      side = 'attacker'
    }

    // Fetch player + skills + equipped items from DB
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) return FAIL('Player not found.')

    const staminaVal = Number(player.stamina ?? 0)
    if (staminaVal < 5) return FAIL('Not enough stamina (5 required).')

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

    // Ammo check: non-knife weapons require ammo
    const weaponItem = equippedItems.find((i: any) => {
      const slot = (i as any).slot || ''
      return slot === 'weapon'
    })
    const weaponSubtype = weaponItem ? ((weaponItem as any).weaponSubtype || (weaponItem.stats as any)?.weaponSubtype || 'knife') : 'knife'

    const equippedAmmo = player.equippedAmmo || 'none'
    let ammoMult = 1.0
    let ammoCritBonus = 0

    // Ammo is optional — players can always fight bare-fist
    // If no ammo or no weapon, they just deal base damage without ammo multiplier

    // Apply ammo multiplier + consume
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

    // Armor-based stamina cost reduction (mirrors client)
    const armorBlock = eqArmor + (skills?.armor ?? 0) * 5
    const armorMit = armorBlock / (armorBlock + 100)
    const staCost = Math.max(1, Math.ceil(5 * (1 - armorMit)))

    if (staminaVal < staCost) return FAIL(`Not enough stamina (${staCost} required).`)

    // ── Dodge check: 8-13% base chance, free hit (no stamina cost) ──
    const baseDodgeChance = 8 + Math.random() * 5
    const dodgeChance = baseDodgeChance * orderFx.dodgeMult
    const isDodged = Math.random() * 100 < dodgeChance

    // Deduct stamina (skip on dodge — free hit)
    const newStamina = isDodged ? staminaVal : Math.max(0, staminaVal - staCost)
    await db.update(players).set({
      stamina: String(newStamina),
    }).where(eq(players.id, playerId))

    // ── Miss check: glancing blow (50% base damage) ──
    const effectiveHitRate = Math.min(100, rawHitRate + (orderFx.hitBonus * 100))
    const missRoll = Math.random() * 100
    const isMiss = !isDodged && missRoll >= effectiveHitRate

    // ── Compute damage (miss = 50% glancing, full hit = 93-108% range) ──
    let damage: number
    let isCrit = false

    // Magic Tea buff/debuff detection (needed for crit bonus)
    const magicTeaBuffActive = player.magicTeaBuffUntil && new Date(player.magicTeaBuffUntil).getTime() > now
    const magicTeaDebuffActive = !magicTeaBuffActive && player.magicTeaDebuffUntil && new Date(player.magicTeaDebuffUntil).getTime() > now
    const magicTeaCritBonus = magicTeaBuffActive ? 10 : 0

    if (isMiss) {
      // Glancing blow: 50% base damage, no crit
      damage = Math.max(1, Math.floor(baseDmg * ammoMult * orderFx.atkMult * 0.50 * (0.7 + Math.random() * 0.3)))
    } else {
      // Full hit: 93-108% range
      const baseRoll = 0.93 + Math.random() * 0.15
      damage = Math.floor(baseDmg * baseRoll * ammoMult * orderFx.atkMult)

      // Crit check (includes Magic Tea +10% bonus)
      isCrit = Math.random() * 100 < (critRate + magicTeaCritBonus + orderFx.critBonus)
      if (isCrit) {
        damage = Math.floor(damage * critMultiplier * orderFx.critDmgMult)
        damage = Math.max(damage, baseDmg)
      }
    }


    // ── Buff multipliers (applied to both miss and full hit) ──
    let buffMsg = ''

    // Magic Tea: +80% buff / -90% debuff
    if (magicTeaBuffActive) {
      damage = Math.floor(damage * 1.80)
      buffMsg += ' 🍵 TEA BUFF!'
    } else if (magicTeaDebuffActive) {
      damage = Math.floor(damage * 0.10)
      buffMsg += ' 🍵 TEA HANGOVER!'
    }

    // MU Bonus: +5% base + 1%/member (capped at +20%)
    try {
      const muMembership = await db.select({ unitId: muMembers.unitId })
        .from(muMembers).where(eq(muMembers.playerId, playerId)).limit(1)
      if (muMembership.length > 0) {
        const memberCount = await db.select({ count: sql<number>`count(*)::int` })
          .from(muMembers).where(eq(muMembers.unitId, muMembership[0].unitId))
        const members = memberCount[0]?.count || 0
        const muBonus = Math.min(1.20, 1.05 + members * 0.01)
        if (muBonus > 1.0) {
          damage = Math.floor(damage * muBonus)
          buffMsg += ` 🏴 MU +${Math.round((muBonus - 1) * 100)}%`
        }
      }
    } catch (e) { /* MU query failed, skip bonus */ }

    // Infrastructure Weapon Bonus: +20% for jet/warship/submarine
    if (weaponSubtype === 'jet' || weaponSubtype === 'warship' || weaponSubtype === 'submarine') {
      try {
        const [playerCountryRow] = await db.select({
          airportLevel: countries.airportLevel,
          portLevel: countries.portLevel,
        }).from(countries).where(eq(countries.code, countryCode)).limit(1)

        const hasAirport = weaponSubtype === 'jet' && playerCountryRow?.airportLevel && playerCountryRow.airportLevel > 0
        const hasPort = (weaponSubtype === 'warship' || weaponSubtype === 'submarine') && playerCountryRow?.portLevel && playerCountryRow.portLevel > 0

        if (hasAirport || hasPort) {
          damage = Math.floor(damage * 1.20)
          const icon = weaponSubtype === 'jet' ? '✈️' : '🚢'
          buffMsg += ` ${icon} INFRA +20%`
        }
      } catch (e) { /* infra query failed, skip bonus */ }
    }

    // Weapon Counter-Buff
    const counterBattle = this.weaponPresence.get(battleId)
    if (counterBattle && weaponSubtype && weaponSubtype !== 'knife') {
      const enemySide = side === 'attacker' ? 'defender' : 'attacker'
      const enemyPresence = counterBattle[enemySide] || {}
      const counterTable: Record<string, { counter: string; perPlayer: number }> = {
        rifle: { counter: 'shotgun', perPlayer: 0.05 },
        shotgun: { counter: 'sniper_rifle', perPlayer: 0.05 },
        sniper_rifle: { counter: 'rifle', perPlayer: 0.05 },
        tank: { counter: 'rpg', perPlayer: 0.08 },
        rpg: { counter: 'jet', perPlayer: 0.08 },
        jet: { counter: 'warship', perPlayer: 0.08 },
        warship: { counter: 'submarine', perPlayer: 0.08 },
        submarine: { counter: 'tank', perPlayer: 0.08 },
      }
      for (const [enemyWeapon, entry] of Object.entries(enemyPresence)) {
        if (!entry || entry.expiryTick <= (battle.ticksElapsed || 0)) continue
        const rule = counterTable[enemyWeapon]
        if (!rule || rule.counter !== weaponSubtype) continue
        const qualifiedCount = Object.values(entry.players)
          .filter(p => p.hitCount >= 3 && p.totalDamage >= 500).length
        if (qualifiedCount <= 0) continue
        const mult = 1 + rule.perPlayer * qualifiedCount
        damage = Math.floor(damage * mult)
        buffMsg += ` 🎯 COUNTER +${Math.round((mult - 1) * 100)}%`
        break
      }
    }

    // Record weapon presence for counter-buff tracking
    this.recordWeaponPresence(battleId, side, weaponSubtype, playerName, damage)

    // ══════════════════════════════════════════════
    //  REGIONAL BATTLE BONUSES (9 total)
    // ══════════════════════════════════════════════

    // 10a. Alliance Bonus (+10%): player's country is in an alliance with the fighting side's country
    try {
      const allyCountry = side === 'attacker' ? battle.attackerId : battle.defenderId
      // Find any alliance that has BOTH this player's country AND the side's country in its members
      const allianceResult = await db.execute(sql`
        SELECT id FROM alliances
        WHERE members @> ${JSON.stringify([{ countryCode }])}::jsonb
          AND members @> ${JSON.stringify([{ countryCode: allyCountry }])}::jsonb
        LIMIT 1
      `)
      const allianceRows = Array.isArray(allianceResult) ? allianceResult : (allianceResult as any)?.rows ?? []
      if (allianceRows.length > 0) {
        damage = Math.floor(damage * 1.10)
        buffMsg += ' 🤝 ALLIANCE +10%'
      }
    } catch (e) { /* alliance query failed */ }

    // 10b. Sworn Enemy Bonus (+10%): player's country has declared the opposing country as sworn enemy
    try {
      const [playerGov] = await db.select({ swornEnemy: governments.swornEnemy })
        .from(governments).where(eq(governments.countryCode, countryCode)).limit(1)
      const enemyCode = side === 'attacker' ? battle.defenderId : battle.attackerId
      if (playerGov?.swornEnemy === enemyCode) {
        damage = Math.floor(damage * 1.10)
        buffMsg += ' 😤 SWORN ENEMY +10%'
      }
    } catch (e) { /* sworn enemy query failed */ }

    // 10c. Resistance Bonus (+1% to +40%): only for revolt battles, attacker side (native country)
    if (battle.type === 'revolt' && side === 'attacker' && battle.revoltPressure > 0) {
      const resistanceMult = 1 + (battle.revoltPressure / 100)  // 0-40 → 1.00-1.40
      damage = Math.floor(damage * resistanceMult)
      buffMsg += ` 🔥 RESISTANCE +${Math.round(battle.revoltPressure)}%`
    }

    // 10d. Core Region Bonus (+15%): defender is defending their OWN homeland region
    if (side === 'defender' && countryCode === battle.defenderId) {
      const regionNode = REGION_ADJACENCY[battle.regionId || '']
      if (regionNode && regionNode.cc === countryCode) {
        damage = Math.floor(damage * 1.15)
        buffMsg += ' 🏠 CORE REGION +15%'
      }
    }

    // 10e. Military Base Bonus (attacker): +5% per level from attacker's launch region
    if (side === 'attacker' && battle.attackerRegionId) {
      try {
        // Look up the country that owns the launch region to find military base level
        const atkRegionNode = REGION_ADJACENCY[battle.attackerRegionId]
        if (atkRegionNode) {
          const [atkCountry] = await db.select({ militaryBaseLevel: countries.militaryBaseLevel })
            .from(countries).where(eq(countries.code, atkRegionNode.cc)).limit(1)
          if (atkCountry?.militaryBaseLevel && atkCountry.militaryBaseLevel > 0) {
            const milBaseMult = 1 + 0.05 * atkCountry.militaryBaseLevel
            damage = Math.floor(damage * milBaseMult)
            buffMsg += ` 🏗️ MIL BASE +${Math.round((milBaseMult - 1) * 100)}%`
          }
        }
      } catch (e) { /* military base query failed */ }
    }

    // 10f. Bunker Bonus (defender): +5% per level from defending country
    if (side === 'defender') {
      try {
        const [defCountry] = await db.select({ bunkerLevel: countries.bunkerLevel })
          .from(countries).where(eq(countries.code, battle.defenderId)).limit(1)
        if (defCountry?.bunkerLevel && defCountry.bunkerLevel > 0) {
          const bunkerMult = 1 + 0.05 * defCountry.bunkerLevel
          damage = Math.floor(damage * bunkerMult)
          buffMsg += ` 🛡️ BUNKER +${Math.round((bunkerMult - 1) * 100)}%`
        }
      } catch (e) { /* bunker query failed */ }
    }

    // 10g. Battle Order Bonus (+5/10/15% per order, stacking for same side)
    if (battle.battleOrders.length > 0) {
      let orderBonusTotal = 0
      for (const bo of battle.battleOrders) {
        if (bo.side !== side) continue
        orderBonusTotal += BATTLE_ORDER_BONUS[bo.priority] ?? 0
      }
      if (orderBonusTotal > 0) {
        damage = Math.floor(damage * (1 + orderBonusTotal))
        buffMsg += ` 🎯 ORDER +${Math.round(orderBonusTotal * 100)}%`
      }
    }

    // 10h. MU Headquarters Bonus (+5% per hq_level, max +20%)
    try {
      const muMembership = await db.select({ unitId: muMembers.unitId })
        .from(muMembers).where(eq(muMembers.playerId, playerId)).limit(1)
      if (muMembership.length > 0) {
        const [mu] = await db.select({ hqLevel: militaryUnits.hqLevel })
          .from(militaryUnits).where(eq(militaryUnits.id, muMembership[0].unitId)).limit(1)
        if (mu?.hqLevel && mu.hqLevel > 0) {
          const hqMult = Math.min(1.20, 1 + 0.05 * mu.hqLevel)
          damage = Math.floor(damage * hqMult)
          buffMsg += ` 🏰 HQ +${Math.round((hqMult - 1) * 100)}%`
        }
      }
    } catch (e) { /* MU HQ query failed */ }

    // 10i. Supply Line Penalty (-25%): defender loses bonus if region is disconnected from capital
    if (side === 'defender' && !battle.defenderHasSupplyLine) {
      damage = Math.floor(damage * 0.75)
      buffMsg += ' ❌ NO SUPPLY -25%'
    }

    // ── Cyber Ops Damage Bonuses (Air Strike / Naval Strike) ──
    // Check for active completed cyber ops granting damage bonuses to the attacker's country
    try {
      const activeOps = await db.execute(sql`
        SELECT operation_id FROM cyber_ops
        WHERE country_code = ${countryCode}
          AND target_country = ${side === 'attacker' ? battle.defenderId : battle.attackerId}
          AND status = 'completed'
          AND expires_at > NOW()
          AND operation_id IN ('air_strike', 'naval_strike')
        LIMIT 2
      `)
      const opRows = Array.isArray(activeOps) ? activeOps : (activeOps as any)?.rows ?? []
      for (const op of opRows as any[]) {
        if (op.operation_id === 'air_strike') {
          damage = Math.floor(damage * 1.30)
          buffMsg += ' ✈️ AIR STRIKE +30%'
        } else if (op.operation_id === 'naval_strike') {
          damage = Math.floor(damage * 1.25)
          buffMsg += ' ⛴️ NAVAL STRIKE +25%'
        }
      }
    } catch (e) { /* cyber ops query failed, skip bonus */ }

    // Ensure minimum 1 damage
    damage = Math.max(1, damage)

    // ── Adrenaline: build + surge/crash multipliers ──
    const adrState = getAdrenaline(battle, playerId)
    const now2 = Date.now()

    // Build adrenaline (+5 per attack, both miss and hit)
    adrState.value = Math.min(100, adrState.value + 5)
    if (adrState.value >= 100 && !adrState.peakAt) adrState.peakAt = now2

    // Crash detection: at 100 for 20+ seconds → crash
    if (adrState.value >= 100 && adrState.peakAt && now2 - adrState.peakAt > 20000) {
      adrState.value = 0
      adrState.peakAt = 0
      adrState.crashUntil = now2 + 8000
    }

    // Apply surge multiplier (if active)
    let surgeMsg = ''
    const isSurging = adrState.surgeUntil > now2
    if (isSurging) {
      let surgeMult = 1.40
      if (adrState.surgeOrder === 'charge') surgeMult = 1.60
      else if (adrState.surgeOrder === 'precision') surgeMult = 1.40
      else if (adrState.surgeOrder === 'blitz') surgeMult = 1.30
      damage = Math.floor(damage * surgeMult)
      surgeMsg = ' ⚡ SURGE!'

      // Precision + Surge: force crit if not already
      if (adrState.surgeOrder === 'precision' && !isCrit) {
        damage = Math.floor(damage * critMultiplier)
        damage = Math.max(damage, baseDmg)
      }
    }

    // Apply crash debuff (-20%)
    const isCrashed = adrState.crashUntil > now2
    if (isCrashed) {
      damage = Math.floor(damage * 0.80)
      surgeMsg = ' 💥 CRASHED!'
    }



    // Re-ensure minimum after mults
    damage = Math.max(1, damage)

    // Record damage
    this.addDamage(battleId, side, damage, isCrit, isDodged, playerName)

    // ── Mercenary per-hit payouts (foreign players on contracted side) ──
    let mercMsg = ''
    try {
      mercMsg = await this.payMercContracts(battle, playerId, playerName, countryCode, side, damage)
    } catch (e) { /* merc payout failed, non-critical */ }

    // ── Track per-player battle stats for war card evaluation ──
    if (!battle.playerBattleStats[playerId]) {
      battle.playerBattleStats[playerId] = { critsLanded: 0, hitsTaken: 0, totalDamage: 0 }
    }
    const pbs = battle.playerBattleStats[playerId]
    pbs.totalDamage += damage
    if (isCrit) pbs.critsLanded += 1
    // hitsTaken is incremented for the enemy side when they receive damage
    // (we track the attacker's hits; enemy's hitsTaken is tracked elsewhere)

    // ── Phase 5: Server-side rewards & side effects ──
    let dropMsg = ''

    // Loot drops: 7% base chance
    const dropRoll = Math.random() * 100
    if (dropRoll < 7) {
      const lootRoll = Math.random()
      if (lootRoll < 0.01) {
        await db.execute(sql`UPDATE players SET bitcoin = bitcoin + 1 WHERE id = ${playerId}`)
        dropMsg += ' [₿+1]'
      } else if (lootRoll < 0.34) {
        await db.execute(sql`UPDATE players SET military_boxes = military_boxes + 1 WHERE id = ${playerId}`)
        dropMsg += ' [🧰+1]'
      } else {
        await db.execute(sql`UPDATE players SET loot_boxes = loot_boxes + 1 WHERE id = ${playerId}`)
        dropMsg += ' [📦+1]'
      }
    }

    // Badge of Honor: 5% chance per hit
    if (Math.random() * 100 < 5) {
      await db.execute(sql`UPDATE players SET badges_of_honor = badges_of_honor + 1 WHERE id = ${playerId}`)
      dropMsg += ' [🎖️+1]'
    }

    // Durability: -1 on all equipped items
    try {
      await db.execute(sql`UPDATE items SET durability = GREATEST(0, CAST(durability AS numeric) - 1) WHERE owner_id = ${playerId} AND equipped = true`)
    } catch (e) { /* durability update failed, non-critical */ }

    // XP: +25
    try {
      await db.execute(sql`UPDATE players SET experience = experience + 25 WHERE id = ${playerId}`)
    } catch (e) { /* xp update failed */ }

    // Specialization: +3 military XP
    try {
      await db.execute(sql`INSERT INTO player_specialization (player_id, military_xp) VALUES (${playerId}, 3) ON CONFLICT (player_id) DO UPDATE SET military_xp = player_specialization.military_xp + 3`)
    } catch (e) { /* spec update failed */ }

    // Damage tracking
    try {
      await db.execute(sql`UPDATE players SET damage_done = COALESCE(damage_done, 0) + ${damage} WHERE id = ${playerId}`)
    } catch (e) { /* damage tracking failed */ }

    // ── War Card evaluation (fire-and-forget) ──
    // Stat-based cards
    warCardEmitter.emit('player_action', playerId)
    // Battle-context cards (check every 5th hit to avoid DB spam)
    if (pbs.totalDamage > 0 && (pbs.critsLanded + pbs.hitsTaken) % 5 === 0) {
      const totalBattleDmg = battle.attacker.damageDealt + battle.defender.damageDealt
      evaluateBattleCards({
        playerId,
        battleId,
        playerDamageInBattle: pbs.totalDamage,
        totalBattleDamage: totalBattleDmg,
        critsLanded: pbs.critsLanded,
        hitsTaken: pbs.hitsTaken,
        singleHitDamage: damage,
        isComeback: false,  // evaluated at battle end
        isLargestBattle: false,
        battleDamageRatio: totalBattleDmg > 0 ? pbs.totalDamage / totalBattleDmg : 0,
      }).catch(() => {})
    }

    // Broadcast hit event
    this.emit(battleId, 'battle:playerHit', {
      battleId, side, playerName, damage, isCrit, isMiss, isDodged,
    })

    const message = (isMiss
      ? `💨 Glancing blow! ${damage} damage.`
      : isDodged
        ? `🎯 FREE HIT! ${damage} damage (no stamina cost)!`
        : isCrit
          ? `💥 CRITICAL HIT! ${damage} damage dealt!`
          : `⚔️ ${damage} damage dealt.`) + surgeMsg + buffMsg + dropMsg + mercMsg

    return { damage, isCrit, isMiss, isDodged, side, message, staminaLeft: newStamina, adrenaline: adrState.value }
  }

  // ── Weapon presence tracking for counter-buff system ──

  private recordWeaponPresence(battleId: string, side: 'attacker' | 'defender', weaponSubtype: string, playerName: string, damage: number): void {
    if (!weaponSubtype || weaponSubtype === 'knife') return
    const battle = this.battles.get(battleId)
    if (!battle) return

    let presence = this.weaponPresence.get(battleId)
    if (!presence) {
      presence = { attacker: {}, defender: {} }
      this.weaponPresence.set(battleId, presence)
    }

    const sidePresence = presence[side]
    if (!sidePresence[weaponSubtype]) {
      sidePresence[weaponSubtype] = { players: {}, expiryTick: 0 }
    }
    const entry = sidePresence[weaponSubtype]
    if (!entry.players[playerName]) {
      entry.players[playerName] = { hitCount: 0, totalDamage: 0 }
    }
    entry.players[playerName].hitCount += 1
    entry.players[playerName].totalDamage += damage
    entry.expiryTick = (battle.ticksElapsed || 0) + 30  // 30 ticks expiry
  }

  private cleanupWeaponPresence(battleId: string): void {
    this.weaponPresence.delete(battleId)
  }

  // ── Activate adrenaline surge (player-initiated) ──

  activateSurge(
    battleId: string, playerId: string, countryCode: string,
  ): { success: boolean; message: string; adrenaline: number } {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') {
      return { success: false, message: 'No active battle.', adrenaline: 0 }
    }

    const adrState = getAdrenaline(battle, playerId)
    if (adrState.value < 80) {
      return { success: false, message: `Need 80+ adrenaline (current: ${adrState.value}).`, adrenaline: adrState.value }
    }

    // Determine side + order
    let side: 'attacker' | 'defender'
    if (countryCode === battle.attackerId) side = 'attacker'
    else if (countryCode === battle.defenderId) side = 'defender'
    else return { success: false, message: 'Not in this battle.', adrenaline: adrState.value }

    const order = side === 'attacker' ? battle.attackerOrder : battle.defenderOrder
    const duration = order === 'blitz' ? 5000 : 10000

    // Consume adrenaline, activate surge
    adrState.value = 0
    adrState.peakAt = 0
    adrState.surgeUntil = Date.now() + duration
    adrState.surgeOrder = order

    // Persist surge to DB immediately
    this.persistBattle(battle).catch(() => {})

    logger.info(`[Battle] ${playerId} activated surge (order: ${order}, duration: ${duration}ms)`)
    return { success: true, message: `⚡ SURGE ACTIVATED! (${duration / 1000}s)`, adrenaline: 0 }
  }

  // ── Get player adrenaline state ──

  getAdrenalineState(battleId: string, playerId: string): { adrenaline: number; isSurging: boolean; isCrashed: boolean } {
    const battle = this.battles.get(battleId)
    if (!battle) return { adrenaline: 0, isSurging: false, isCrashed: false }
    const state = getAdrenaline(battle, playerId)
    const now = Date.now()
    return {
      adrenaline: state.value,
      isSurging: state.surgeUntil > now,
      isCrashed: state.crashUntil > now,
    }
  }

  // ── Player defend ──

  async playerDefend(
    battleId: string, playerId: string, playerName: string, countryCode: string,
  ): Promise<{ blocked: number; message: string; staminaLeft: number }> {
    const now = Date.now()
    const lastAction = playerCooldowns.get(playerId) ?? 0
    if (now - lastAction < PLAYER_ACTION_COOLDOWN_MS) {
      return { blocked: 0, message: 'Too fast! Wait a moment.', staminaLeft: -1 }
    }
    playerCooldowns.set(playerId, now)

    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') {
      return { blocked: 0, message: 'No active battle.', staminaLeft: -1 }
    }

    let isAttacker: boolean
    if (countryCode === battle.attackerId) isAttacker = true
    else if (countryCode === battle.defenderId) isAttacker = false
    else return { blocked: 0, message: 'Your country is not in this battle.', staminaLeft: -1 }

    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) return { blocked: 0, message: 'Player not found.', staminaLeft: -1 }

    const staminaVal = Number(player.stamina ?? 0)
    if (staminaVal < 3) return { blocked: 0, message: 'Not enough stamina (3 required).', staminaLeft: staminaVal }

    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)

    const armorBlock = (skills?.armor ?? 0) * 5
    const dodgeChance = 5 + (skills?.dodge ?? 0) * 5
    const blocked = Math.max(1, armorBlock + Math.floor(dodgeChance * 0.5))

    // Deduct stamina
    const newStamina = Math.max(0, staminaVal - 3)
    await db.update(players).set({
      stamina: String(newStamina),
    }).where(eq(players.id, playerId))

    // XP for defending
    try {
      await db.execute(sql`UPDATE players SET experience = experience + 10 WHERE id = ${playerId}`)
    } catch (e) { /* non-critical */ }

    // Add defensive damage to the player's OWN side (contributes to ground points)
    const defSide: 'attacker' | 'defender' = isAttacker ? 'attacker' : 'defender'
    this.addDamage(battleId, defSide, blocked, false, false, playerName)

    // Broadcast hit event for defend (so client updates damage feed + bar)
    this.emit(battleId, 'battle:playerHit', {
      battleId, side: defSide, playerName: `${playerName} 🛡️`, damage: blocked, isCrit: false, isMiss: false, isDodged: false,
    })

    return { blocked, message: `🛡️ Blocked ${blocked} incoming damage!`, staminaLeft: newStamina }
  }

  // ── Missile Launcher (server-authoritative) ──

  async launchMissile(
    battleId: string, playerId: string, playerName: string, countryCode: string,
    side: 'attacker' | 'defender',
  ): Promise<{ success: boolean; message: string; damage?: number }> {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') {
      return { success: false, message: 'No active battle.' }
    }

    // Verify player is on the correct side
    const sideCountry = side === 'attacker' ? battle.attackerId : battle.defenderId
    if (countryCode !== sideCountry) {
      return { success: false, message: 'You can only launch missiles for your own side.' }
    }

    // Authorization: only president or VP can launch
    try {
      const [gov] = await db.select({
        president: governments.president,
        vicePresident: governments.vicePresident,
      }).from(governments).where(eq(governments.countryCode, countryCode)).limit(1)

      if (gov) {
        const authorizedIds = [gov.president, gov.vicePresident].filter(Boolean)
        if (authorizedIds.length > 0 && !authorizedIds.includes(playerId)) {
          return { success: false, message: 'Only the President or Vice President can launch missiles.' }
        }
      }
    } catch (e) { /* gov check failed, allow for alpha */ }

    // Check missile launcher level from countries table
    const [countryRow] = await db.select({ missileLauncherLevel: countries.missileLauncherLevel })
      .from(countries).where(eq(countries.code, countryCode)).limit(1)

    const level = countryRow?.missileLauncherLevel ?? 0
    if (level <= 0) {
      return { success: false, message: 'No Missile Launcher built. Upgrade in country infrastructure.' }
    }

    // Cooldown check (5 minutes per country per battle) — stored in-memory on battle
    const MISSILE_COOLDOWN = 5 * 60 * 1000
    const now = Date.now()
    const cooldowns = (battle as any)._missileCooldowns ?? {}
    const lastLaunch = cooldowns[countryCode] ?? 0
    if (now - lastLaunch < MISSILE_COOLDOWN) {
      const remaining = Math.ceil((MISSILE_COOLDOWN - (now - lastLaunch)) / 1000)
      return { success: false, message: `Missile on cooldown! ${remaining}s remaining.` }
    }

    // Oil cost: 50 from country fund
    const OIL_COST = 50
    const oilResult = await db.execute(sql`
      UPDATE countries SET fund = jsonb_set(
        COALESCE(fund, '{}'::jsonb),
        '{oil}',
        (GREATEST(0, COALESCE((fund->>'oil')::numeric, 0) - ${OIL_COST}))::text::jsonb
      )
      WHERE code = ${countryCode} AND COALESCE((fund->>'oil')::numeric, 0) >= ${OIL_COST}
    `)
    const oilRowCount = (oilResult as any)?.rowCount ?? (oilResult as any)?.length ?? 0
    if (oilRowCount === 0) {
      return { success: false, message: `Not enough oil in national fund. Needs ${OIL_COST} 🛢️.` }
    }

    // Damage: base 666,666 × (1 + (level-1) × 0.125)
    const BASE_DAMAGE = 666_666
    const burstDamage = Math.round(BASE_DAMAGE * (1 + (level - 1) * 0.125))

    // Apply damage via addDamage (updates round totals, damage dealers, etc.)
    this.addDamage(battleId, side, burstDamage, true, false, playerName)

    // Set cooldown
    ;(battle as any)._missileCooldowns = { ...cooldowns, [countryCode]: now }

    // Combat log entry
    battle.combatLog.push({
      tick: battle.ticksElapsed, timestamp: now, type: 'damage' as const,
      side,
      message: `🚀 MISSILE LAUNCHED by ${playerName}! ${burstDamage.toLocaleString()} burst damage! (Lv.${level})`,
    })

    // Broadcast hit event
    this.emit(battleId, 'battle:playerHit', {
      battleId, side, playerName: `${playerName} 🚀`, damage: burstDamage, isCrit: true, isMiss: false, isDodged: false,
    })

    logger.info(`[Battle] Missile launched by ${playerName} (${countryCode}) in ${battleId}: ${burstDamage} damage (Lv.${level})`)
    return { success: true, message: `🚀 Missile launched! ${burstDamage.toLocaleString()} damage dealt!`, damage: burstDamage }
  }

  // ── Mercenary Contracts (server-authoritative) ──

  async createMercContract(
    battleId: string, playerId: string, playerName: string, countryCode: string,
    side: 'attacker' | 'defender', ratePerHit: number, totalPool: number,
  ): Promise<{ success: boolean; message: string }> {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }
    if (ratePerHit <= 0 || totalPool <= 0) return { success: false, message: 'Invalid amounts.' }

    // Only president of the side's country can create
    const sideCountry = side === 'attacker' ? battle.attackerId : battle.defenderId

    try {
      const [gov] = await db.select({ president: governments.president })
        .from(governments).where(eq(governments.countryCode, sideCountry)).limit(1)
      if (gov && gov.president !== playerId) {
        return { success: false, message: 'Only the President can fund mercenary contracts.' }
      }
    } catch (e) { /* gov check failed */ }

    // Deduct from country fund
    const cost = totalPool
    const fundResult = await db.execute(sql`
      UPDATE countries SET fund = jsonb_set(
        COALESCE(fund, '{}'::jsonb),
        '{money}',
        (GREATEST(0, COALESCE((fund->>'money')::numeric, 0) - ${cost}))::text::jsonb
      )
      WHERE code = ${sideCountry} AND COALESCE((fund->>'money')::numeric, 0) >= ${cost}
    `)
    const fundRowCount = (fundResult as any)?.rowCount ?? (fundResult as any)?.length ?? 0
    if (fundRowCount === 0) {
      return { success: false, message: `Not enough money in national fund (${cost.toLocaleString()} required).` }
    }

    const contract = {
      id: `merc_${battleId}_${Date.now()}`,
      side,
      ratePerHit,
      totalPool,
      remaining: totalPool,
      fundedBy: playerName,
      countryCode: sideCountry,
      createdAt: Date.now(),
    }

    // Store in battle state
    if (!battle.battleOrders) (battle as any).mercContracts = []
    const contracts = (battle as any).mercContracts ?? []
    contracts.push(contract)
    ;(battle as any).mercContracts = contracts

    this.emit(battleId, 'battle:mercenary', { battleId, contract })
    logger.info(`[Battle] Mercenary contract created: ${ratePerHit}/hit, ${totalPool} pool by ${playerName}`)
    return { success: true, message: `Mercenary contract funded: ${ratePerHit.toLocaleString()}/hit, ${totalPool.toLocaleString()} pool` }
  }

  /** Pay mercenary contracts for a hit — called from playerAttack() */
  private async payMercContracts(battle: Battle, playerId: string, playerName: string, countryCode: string, side: 'attacker' | 'defender', damage: number): Promise<string> {
    const contracts = (battle as any).mercContracts as any[] | undefined
    if (!contracts || contracts.length === 0) return ''

    // Foreign player = mercenary (not from either battle country)
    const isForeign = countryCode !== battle.attackerId && countryCode !== battle.defenderId
    if (!isForeign) return ''

    let totalPaid = 0
    for (const c of contracts) {
      if (c.side !== side || c.remaining <= 0) continue
      const payout = Math.min(c.ratePerHit, c.remaining)
      c.remaining -= payout
      totalPaid += payout
    }

    if (totalPaid > 0) {
      // Pay the mercenary player
      await db.execute(sql`UPDATE players SET money = money + ${totalPaid} WHERE id = ${playerId}`)
      return ` 💰 MERC +$${totalPaid}`
    }
    return ''
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
        // ── Persist full state to DB every tick ──
        await this.persistBattle(battle)
      } catch (e) {
        logger.error(e, `[Battle] Error processing tick for ${battle.id}:`)
      }
    }

    const elapsed = Date.now() - tickStart
    if (elapsed > 5000) {
      logger.warn(`[Battle] Combat tick took ${elapsed}ms for ${activeBattles.length} battles — consider optimization`)
    }
  }

  /** Persist ALL battle state to DB — called every tick and after player actions */
  async persistBattle(battle: Battle): Promise<void> {
    await db.update(battlesTable).set({
      status: battle.status,
      round: battle.rounds.length,
      attackerDamage: battle.attacker.damageDealt,
      defenderDamage: battle.defender.damageDealt,
      attackerRoundsWon: battle.attackerRoundsWon,
      defenderRoundsWon: battle.defenderRoundsWon,
      // Full JSONB state
      rounds: battle.rounds as any,
      combatLog: battle.combatLog.slice(-100) as any,
      attackerDamageDealers: battle.attackerDamageDealers as any,
      defenderDamageDealers: battle.defenderDamageDealers as any,
      attackerOrder: battle.attackerOrder,
      defenderOrder: battle.defenderOrder,
      adrenalineState: (battle as any).adrenalineState ?? {},
      playerBattleStats: battle.playerBattleStats as any,
      battleOrders: battle.battleOrders as any,
    }).where(eq(battlesTable.id, battle.id))
  }

  private async processSingleBattleTick(battle: Battle): Promise<void> {
    const now = Date.now()
    const tick = battle.ticksElapsed + 1
    battle.ticksElapsed = tick

    // Reset per-tick damage counter (player damage accumulates via addDamage() between ticks)
    battle.currentTick = { attackerDamage: 0, defenderDamage: 0 }

    // ── Ground points (gated: only every 8th tick = 120s) ──
    const activeRoundIndex = battle.rounds.length - 1
    const activeRound = battle.rounds[activeRoundIndex]

    // Only award terrain points on the 2-minute boundary
    battle.battleTickCounter = (battle.battleTickCounter || 0) + 1
    const isTerrainTick = battle.battleTickCounter % TERRAIN_TICK_GATE === 0

    if (isTerrainTick) {
      const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
      const pointIncrement = getPointIncrement(totalGroundPoints)

      // Award ground points based on TOTAL round-accumulated player damage
      const roundAtkDmg = activeRound.attackerDmgTotal
      const roundDefDmg = activeRound.defenderDmgTotal

      if (roundAtkDmg > 0 || roundDefDmg > 0) {
        if (roundAtkDmg > roundDefDmg) activeRound.attackerPoints += pointIncrement
        else if (roundDefDmg > roundAtkDmg) activeRound.defenderPoints += pointIncrement
        else {
          // Tie: random
          if (Math.random() < 0.5) activeRound.attackerPoints += pointIncrement
          else activeRound.defenderPoints += pointIncrement
        }
      }
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

    // Trim combat log
    if (battle.combatLog.length > 100) {
      battle.combatLog = battle.combatLog.slice(-100)
    }

    // ── Emit full battle:state (replaces battle:tick — client gets authoritative full object) ──
    this.emit(battle.id, 'battle:state', {
      id: battle.id,
      type: battle.type,
      attackerId: battle.attackerId,
      defenderId: battle.defenderId,
      regionName: battle.regionName,
      startedAt: battle.startedAt,
      ticksElapsed: tick,
      status: battle.status,
      attacker: battle.attacker,
      defender: battle.defender,
      attackerRoundsWon: battle.attackerRoundsWon,
      defenderRoundsWon: battle.defenderRoundsWon,
      rounds: battle.rounds,
      currentTick: battle.currentTick,
      attackerOrder: battle.attackerOrder,
      defenderOrder: battle.defenderOrder,
      combatLog: battle.combatLog,
      attackerDamageDealers: battle.attackerDamageDealers,
      defenderDamageDealers: battle.defenderDamageDealers,
      damageFeed: battle.damageFeed,
    })
  }

  // ── Finalize a completed battle ──

  private async finalizeBattle(battle: Battle): Promise<void> {
    // Clean up weapon presence tracking
    this.cleanupWeaponPresence(battle.id)

    // Persist full final state to DB
    await this.persistBattle(battle)
    await db.update(battlesTable).set({
      winner: battle.status === 'attacker_won' ? battle.attackerId : battle.defenderId,
      finishedAt: new Date(),
      battleLog: battle.combatLog as any,
    }).where(eq(battlesTable.id, battle.id))

    // ── TERRITORY CAPTURE: Attacker Won ──
    if (battle.status === 'attacker_won') {
      const conquerorCode  = battle.attackerId   // e.g. "CU"
      const originalOwner  = battle.defenderId   // e.g. "US"
      const regionName     = battle.regionName   // e.g. "Florida"

      try {
        // 1. Add to conqueror's occupied_regions
        await db.execute(sql`
          UPDATE countries
          SET occupied_regions = occupied_regions || jsonb_build_object(${regionName}::text, ${originalOwner}::text)
          WHERE code = ${conquerorCode}
        `)

        // 2. Remove from original owner's occupied_regions (in case it was re-taken)
        await db.execute(sql`
          UPDATE countries
          SET occupied_regions = occupied_regions - ${regionName}::text
          WHERE code = ${originalOwner}
        `)

        // 2b. Sync region_ownership table (for ley line engine)
        if (battle.regionId) {
          await db.execute(sql`
            INSERT INTO region_ownership (region_id, country_code, captured_at, updated_at)
            VALUES (${battle.regionId}, ${conquerorCode}, NOW(), NOW())
            ON CONFLICT (region_id) DO UPDATE SET country_code = ${conquerorCode}, updated_at = NOW()
          `)
        }

        // 3. Award conqueror's national fund — territory capture bonus
        const captureBonus = {
          money: 5000,
          oil:   50,
          scrap: 30,
        }
        await db.execute(sql`
          UPDATE countries
          SET fund = jsonb_set(
            jsonb_set(
              jsonb_set(
                COALESCE(fund, '{}'::jsonb),
                '{money}', (COALESCE((fund->>'money')::numeric, 0) + ${captureBonus.money})::text::jsonb
              ),
              '{oil}', (COALESCE((fund->>'oil')::numeric, 0) + ${captureBonus.oil})::text::jsonb
            ),
            '{scrap}', (COALESCE((fund->>'scraps')::numeric, 0) + ${captureBonus.scrap})::text::jsonb
          )
          WHERE code = ${conquerorCode}
        `)

        // 4. Award all participating attacker players — victory bonuses
        const attackerPlayers = Object.keys(battle.attackerDamageDealers)
        for (const playerName of attackerPlayers) {
          try {
            await db.execute(sql`
              UPDATE players
              SET
                money = money + 500,
                experience = experience + 150,
                badges_of_honor = badges_of_honor + 2
              WHERE name = ${playerName}
            `)
          } catch (e) { logger.warn(`[Battle] Failed to award attacker player ${playerName}`) }
        }

        // 5. Award defending players — consolation bonuses for participation
        const defenderPlayers = Object.keys(battle.defenderDamageDealers)
        for (const playerName of defenderPlayers) {
          try {
            await db.execute(sql`
              UPDATE players
              SET
                money = money + 100,
                experience = experience + 50
              WHERE name = ${playerName}
            `)
          } catch (e) { logger.warn(`[Battle] Failed to award defender player ${playerName}`) }
        }

        // 6. Update countries.regions count
        await db.execute(sql`
          UPDATE countries SET regions = regions + 1 WHERE code = ${conquerorCode}
        `)
        await db.execute(sql`
          UPDATE countries SET regions = GREATEST(0, regions - 1) WHERE code = ${originalOwner}
        `)

        logger.info(`[Battle] Territory captured: ${conquerorCode} ← ${regionName} (was ${originalOwner}). Fund +$${captureBonus.money} +${captureBonus.oil} oil. ${attackerPlayers.length} attackers awarded.`)

        // 7. Broadcast occupation update to all clients via socket
        this.emit(battle.id, 'battle:occupationUpdate', {
          regionName,
          newController: conquerorCode,
          prevController: originalOwner,
          captureBonus,
          attackerCount: attackerPlayers.length,
        })

      } catch (e) {
        logger.error(e, `[Battle] Territory transfer failed for ${battle.id}`)
      }
    }

    // ── DEFENSE HELD: Remove any existing foreign occupation of this region ──
    if (battle.status === 'defender_won') {
      // If a foreign country had previously occupied this region and was attacking to keep it,
      // the defender liberated it — remove the occupation record
      try {
        await db.execute(sql`
          UPDATE countries
          SET occupied_regions = occupied_regions - ${battle.regionName}::text
          WHERE code != ${battle.defenderId}
            AND occupied_regions ? ${battle.regionName}
        `)

        // Restore region_ownership to defender
        if (battle.regionId) {
          await db.execute(sql`
            UPDATE region_ownership SET country_code = ${battle.defenderId}, updated_at = NOW()
            WHERE region_id = ${battle.regionId} AND country_code != ${battle.defenderId}
          `)
        }

        // Award defending players — full defense victory bonuses
        const defenderPlayers = Object.keys(battle.defenderDamageDealers)
        for (const playerName of defenderPlayers) {
          try {
            await db.execute(sql`
              UPDATE players
              SET
                money = money + 300,
                experience = experience + 100,
                badges_of_honor = badges_of_honor + 1
              WHERE name = ${playerName}
            `)
          } catch (e) { logger.warn(`[Battle] Failed to award defense victory to ${playerName}`) }
        }

        // Award attacker players consolation
        const attackerPlayers = Object.keys(battle.attackerDamageDealers)
        for (const playerName of attackerPlayers) {
          try {
            await db.execute(sql`
              UPDATE players SET money = money + 50, experience = experience + 25 WHERE name = ${playerName}
            `)
          } catch (e) {}
        }

        logger.info(`[Battle] Defense held: ${battle.defenderId} defended ${battle.regionName}. ${defenderPlayers.length} defenders awarded.`)

      } catch (e) {
        logger.error(e, '[Battle] Defense cleanup failed')
      }
    }

    // ── REVOLT FINALIZATION ──
    if (battle.type === 'revolt') {
      try {
        if (battle.status === 'attacker_won') {
          // Revolt succeeded: region is liberated back to native country
          // The attacker in a revolt IS the native country, defender is the occupier
          const nativeCountry = battle.attackerId
          const occupier = battle.defenderId

          // Reset region_ownership to native country
          if (battle.regionId) {
            await db.execute(sql`
              INSERT INTO region_ownership (region_id, country_code, captured_at, updated_at)
              VALUES (${battle.regionId}, ${nativeCountry}, NOW(), NOW())
              ON CONFLICT (region_id) DO UPDATE SET country_code = ${nativeCountry}, updated_at = NOW()
            `)
          }

          // Remove from occupier's occupied_regions
          await db.execute(sql`
            UPDATE countries
            SET occupied_regions = occupied_regions - ${battle.regionName}::text
            WHERE code = ${occupier}
          `)

          // Update regions count
          await db.execute(sql`UPDATE countries SET regions = regions + 1 WHERE code = ${nativeCountry}`)
          await db.execute(sql`UPDATE countries SET regions = GREATEST(0, regions - 1) WHERE code = ${occupier}`)

          logger.info(`[Battle] REVOLT SUCCEEDED: ${battle.regionName} liberated by ${nativeCountry} from ${occupier}`)

          this.emit(battle.id, 'battle:occupationUpdate', {
            regionName: battle.regionName,
            newController: nativeCountry,
            prevController: occupier,
            isRevolt: true,
          })
        } else {
          // Revolt failed: occupier holds — no territory change
          logger.info(`[Battle] REVOLT FAILED: ${battle.defenderId} retains control of ${battle.regionName}`)
        }

        // Reset revolt pressure to 0 regardless of winner
        if (battle.regionId) {
          await db.execute(sql`
            UPDATE region_ownership SET updated_at = NOW() WHERE region_id = ${battle.regionId}
          `)
        }
      } catch (e) {
        logger.error(e, `[Battle] Revolt finalization failed for ${battle.id}`)
      }
    }

    // ── SUPPLY LINE RECOMPUTATION after any territory transfer ──
    if (battle.status === 'attacker_won' || battle.status === 'defender_won') {
      try {
        // Recompute supply lines for both sides since territory may have changed
        await this.recomputeSupplyLinesForCountry(battle.attackerId)
        await this.recomputeSupplyLinesForCountry(battle.defenderId)
      } catch (e) {
        logger.warn(`[Battle] Supply line recomputation failed after ${battle.id}`)
      }
    }

    // Broadcast battle end — include full context for client battle summary
    this.emit(battle.id, 'battle:end', {
      battleId: battle.id,
      winner: battle.status === 'attacker_won' ? battle.attackerId : battle.defenderId,
      loser: battle.status === 'attacker_won' ? battle.defenderId : battle.attackerId,
      type: battle.type,
      regionName: battle.regionName,
      attackerId: battle.attackerId,
      defenderId: battle.defenderId,
      attackerRoundsWon: battle.attackerRoundsWon,
      defenderRoundsWon: battle.defenderRoundsWon,
      attackerStats: { damageDealt: battle.attacker.damageDealt },
      defenderStats: { damageDealt: battle.defender.damageDealt },
      attackerDamageDealers: battle.attackerDamageDealers,
      defenderDamageDealers: battle.defenderDamageDealers,
      rewards: {
        winnerPlayers: { money: battle.status === 'attacker_won' ? 500 : 300, xp: battle.status === 'attacker_won' ? 150 : 100, badges: battle.status === 'attacker_won' ? 2 : 1 },
        loserPlayers: { money: battle.status === 'attacker_won' ? 100 : 50, xp: battle.status === 'attacker_won' ? 50 : 25, badges: 0 },
        territoryChanged: battle.status === 'attacker_won',
      },
    })

    logger.info(`[Battle] ${battle.id} ended: ${battle.status} type=${battle.type} (ATK ${battle.attacker.damageDealt} / DEF ${battle.defender.damageDealt})`)
  }

  // ── Internal helpers ──

  private addDamage(
    battleId: string, side: 'attacker' | 'defender', amount: number,
    isCrit: boolean, isDodged: boolean, playerName: string,
  ): void {
    const battle = this.battles.get(battleId)
    if (!battle || battle.status !== 'active') return

    let finalAmount = amount
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



  private emit(battleId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`battle:${battleId}`).emit(event, data)
    }
  }

  /**
   * Restore ALL active battles from DB into memory — call on server boot.
   * Restores full JSONB state: rounds, combatLog, damageDealers, adrenaline, orders.
   */
  async restoreFromDB(): Promise<void> {
    // Run additive migration only once per process lifecycle
    if (!this._migrationRan) {
      this._migrationRan = true
      try {
        // Run additive migration for new columns (safe — IF NOT EXISTS)
        await db.execute(sql`
          ALTER TABLE battles
            ADD COLUMN IF NOT EXISTS type varchar(16) DEFAULT 'invasion',
            ADD COLUMN IF NOT EXISTS rounds jsonb DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS combat_log jsonb DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS attacker_damage_dealers jsonb DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS defender_damage_dealers jsonb DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS attacker_order varchar(16) DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS defender_order varchar(16) DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS adrenaline_state jsonb DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS player_battle_stats jsonb DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS region_id varchar(16),
            ADD COLUMN IF NOT EXISTS attacker_region_id varchar(16),
            ADD COLUMN IF NOT EXISTS battle_orders jsonb DEFAULT '[]'
        `)
        // MU HQ migration
        await db.execute(sql`
          ALTER TABLE military_units
            ADD COLUMN IF NOT EXISTS hq_level integer NOT NULL DEFAULT 0
        `)
        // Missile launcher infrastructure
        await db.execute(sql`
          ALTER TABLE countries
            ADD COLUMN IF NOT EXISTS missile_launcher_level integer DEFAULT 0
        `)
      } catch (e) {
        logger.warn({ err: e }, '[Battle] Schema migration warning (safe to ignore if columns exist)')
      }
    }

    try {
      const dbResult = await db.execute(sql`
        SELECT id, attacker_id, defender_id, region_name, region_id, attacker_region_id,
               type, status,
               attacker_rounds_won, defender_rounds_won,
               attacker_damage, defender_damage, started_at,
               rounds, combat_log,
               attacker_damage_dealers, defender_damage_dealers,
               engaged_divisions, attacker_order, defender_order,
               adrenaline_state, player_battle_stats, division_health_state,
               battle_orders
        FROM battles WHERE status = 'active'
      `)
      // db.execute may return { rows: [...] } or an array directly depending on driver
      const rows = Array.isArray(dbResult) ? dbResult : (dbResult as any)?.rows ?? []

      let restored = 0
      for (const row of rows as any[]) {
        if (this.battles.has(row.id)) continue

        const now = Date.now()

        const restoredRounds = Array.isArray(row.rounds) && row.rounds.length > 0
          ? row.rounds
          : [{ attackerPoints: 0, defenderPoints: 0, attackerDmgTotal: 0, defenderDmgTotal: 0, status: 'active', startedAt: now }]

        const battle: Battle = {
          id: row.id,
          type: (row.type as BattleType) ?? 'invasion',
          attackerId: row.attacker_id,
          defenderId: row.defender_id,
          regionName: row.region_name,
          regionId: row.region_id || undefined,
          attackerRegionId: row.attacker_region_id || undefined,
          startedAt: new Date(row.started_at).getTime(),
          ticksElapsed: Math.max(0, Math.floor((now - new Date(row.started_at).getTime()) / 15000)),
          battleTickCounter: Math.max(0, Math.floor((now - new Date(row.started_at).getTime()) / 15000)) % TERRAIN_TICK_GATE,
          status: 'active',
          attacker: { countryCode: row.attacker_id, damageDealt: Number(row.attacker_damage ?? 0) },
          defender: { countryCode: row.defender_id, damageDealt: Number(row.defender_damage ?? 0) },
          attackerRoundsWon: row.attacker_rounds_won ?? 0,
          defenderRoundsWon: row.defender_rounds_won ?? 0,
          rounds: restoredRounds,
          currentTick: { attackerDamage: 0, defenderDamage: 0 },
          combatLog: Array.isArray(row.combat_log) && row.combat_log.length > 0
            ? row.combat_log
            : [{ tick: 0, timestamp: now, type: 'phase_change', side: 'attacker', message: `🔄 Battle for ${row.region_name} restored.` }],
          attackerDamageDealers: (row.attacker_damage_dealers as Record<string,number>) ?? {},
          defenderDamageDealers: (row.defender_damage_dealers as Record<string,number>) ?? {},
          damageFeed: [],
          attackerOrder: (row.attacker_order as TacticalOrder) ?? 'none',
          defenderOrder: (row.defender_order as TacticalOrder) ?? 'none',
          orderMessage: '', motd: '',
          playerBattleStats: (row.player_battle_stats as any) ?? {},
          adrenalineState: (row.adrenaline_state as any) ?? {},
          battleOrders: Array.isArray((row as any).battle_orders) ? (row as any).battle_orders : [],
          defenderHasSupplyLine: true,
          revoltPressure: 0,
        }

        this.battles.set(row.id, battle)
        restored++
      }

      if (restored > 0) {
        logger.info(`[Battle] Restored ${restored} active battle(s) from DB with full state`)
      }
    } catch (err) {
      logger.error(err, '[Battle] Failed to restore battles from DB')
    }
  }
}

/** Global singleton */
export const battleService = new BattleService()
