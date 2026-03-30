// ══════════════════════════════════════════════
// XWAR — Battle / Combat Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike' | 'quick_battle' | 'revolt'

export interface CombatLogEntry {
  tick: number
  timestamp: number
  type: 'damage' | 'critical' | 'retreat' | 'destroyed' | 'air_strike' | 'artillery_barrage' | 'breakthrough' | 'phase_shift' | 'phase_change' | 'reinforcement'
  side: 'attacker' | 'defender'
  damage?: number
  message: string
}

export interface BattleSide {
  countryCode: string
  damageDealt: number
}

export interface BattleTick {
  attackerDamage: number
  defenderDamage: number
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
  startedAt: number
  endedAt?: number
  ticksElapsed?: number
  attackerDmgTotal?: number
  defenderDmgTotal?: number
  /** Damage accumulated by attacker during this specific round (resets each round) */
  attackerRoundDmg?: number
  /** Damage accumulated by defender during this specific round (resets each round) */
  defenderRoundDmg?: number
}

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

export interface Battle {
  id: string
  type: BattleType
  attackerId: string
  defenderId: string
  regionName: string
  /** Region ID from regionRegistry (e.g. "US-WA"). Undefined for legacy battles. */
  regionId?: string
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
  attackerOrder: TacticalOrder
  defenderOrder: TacticalOrder
  orderMessage: string
  motd: string
  /** Per-player adrenaline meter (0–100) for manual attack skill expression */
  playerAdrenaline: Record<string, number>
  /** Per-player surge state: { until: timestamp, order: TacticalOrder } */
  playerSurge: Record<string, { until: number; order: TacticalOrder }>
  /** Per-player crash debuff: { until: timestamp } */
  playerCrash: Record<string, { until: number }>
  /** Per-player timestamp when adrenaline first hit 100 (for crash timer) */
  playerAdrenalinePeakAt: Record<string, number>
  /** Per-side Vengeance buff: tracks expiry tick */
  vengeanceBuff: Record<'attacker' | 'defender', number>  // side → tick when buff expires
  /** Active mercenary contracts — funded bounty pools that pay per hit */
  mercenaryContracts: MercenaryContract[]
  /** Missile launcher cooldowns — countryCode → last launch timestamp */
  missileCooldowns?: Record<string, number>
  /** Weapon counter-buff: tracks which weapon subtypes each side has used for counter-buff activation */
  weaponPresence: Record<'attacker' | 'defender', Record<string, WeaponPresenceEntry>>
  /** Region the attacker launched from */
  attackerRegionId?: string
  /** Tick counter for 2-minute terrain gate */
  battleTickCounter?: number
  /** Active battle orders from countries/MUs */
  battleOrders?: BattleOrder[]
  /** Whether defender's region is connected to their capital via supply line */
  defenderHasSupplyLine?: boolean
  /** Revolt pressure value (0-40) for revolt battles */
  revoltPressure?: number
}

/** Per-weapon-subtype presence tracking for counter-buff system */
export interface WeaponPresenceEntry {
  /** playerName → { hitCount, totalDamage } */
  players: Record<string, { hitCount: number; totalDamage: number }>
  /** Tick when this presence expires (refreshed on every qualifying hit) */
  expiryTick: number
}

export interface MercenaryContract {
  id: string
  side: 'attacker' | 'defender'
  ratePerDamage: number  // $ paid per point of damage dealt
  totalPool: number      // total $ funded from treasury
  remaining: number      // $ remaining in pool
  fundedBy: string       // player name who created the contract
  countryCode: string    // country that funded it
  createdAt: number
}

// ── Battle Orders ──

export interface BattleOrder {
  id: string
  battleId: string
  issuerType: 'country' | 'mu'
  issuerCode: string
  side: 'attacker' | 'defender'
  priority: 'low' | 'medium' | 'high'
  issuedBy: string
  issuedAt: number
}
