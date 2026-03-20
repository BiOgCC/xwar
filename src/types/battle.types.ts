// ══════════════════════════════════════════════
// XWAR — Battle / Combat Types
// Shared between frontend stores and backend
// ══════════════════════════════════════════════

export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike'

export interface CombatLogEntry {
  tick: number
  timestamp: number
  type: 'damage' | 'critical' | 'retreat' | 'destroyed' | 'air_strike' | 'artillery_barrage' | 'breakthrough' | 'phase_shift' | 'phase_change' | 'reinforcement'
  side: 'attacker' | 'defender'
  divisionName?: string
  targetDivisionName?: string
  damage?: number
  manpowerLost?: number
  message: string
}

export interface BattleSide {
  countryCode: string
  divisionIds: string[]
  engagedDivisionIds: string[]
  damageDealt: number
  manpowerLost: number
  divisionsDestroyed: number
  divisionsRetreated: number
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
}

export type TacticalOrder = 'none' | 'charge' | 'fortify' | 'precision' | 'blitz'

export interface OrderEffects {
  atkMult: number
  armorMult: number
  dodgeMult: number
  hitBonus: number
  critBonus: number
  speedMult: number
}

export interface Battle {
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
