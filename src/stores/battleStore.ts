import { create } from 'zustand'
import { useWorldStore } from './worldStore'
import { useGovernmentStore } from './governmentStore'
import { usePlayerStore } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useInventoryStore } from './inventoryStore'
import { useArmyStore, getDivisionEquipBonus, DIVISION_TEMPLATES, type Division } from './armyStore'

// ====== PLAYER COMBAT STATS HELPER ======
export function getPlayerCombatStats() {
  const player = usePlayerStore.getState()
  const skills = useSkillsStore.getState().military
  const equipped = useInventoryStore.getState().getEquipped()

  let eqDmg = 0, eqCritRate = 0, eqCritDmg = 0, eqArmor = 0, eqDodge = 0, eqPrecision = 0
  equipped.forEach((item: any) => {
    if (item.stats.damage) eqDmg += item.stats.damage
    if (item.stats.critRate) eqCritRate += item.stats.critRate
    if (item.stats.critDamage) eqCritDmg += item.stats.critDamage
    if (item.stats.armor) eqArmor += item.stats.armor
    if (item.stats.dodge) eqDodge += item.stats.dodge
    if (item.stats.precision) eqPrecision += item.stats.precision
  })

  return {
    attackDamage: 100 + eqDmg + skills.attack * 20,
    critRate: 10 + eqCritRate + skills.critRate * 5,
    critMultiplier: (100 + eqCritDmg + skills.critDamage * 20) / 100,
    armorBlock: eqArmor + skills.armor * 5,
    dodgeChance: 5 + eqDodge + skills.dodge * 5,
    hitRate: Math.min(100, 50 + eqPrecision + skills.precision * 5),
  }
}

export function getBaseSkillStats() {
  const skills = useSkillsStore.getState().military
  return {
    attackDamage: 100 + skills.attack * 20,
    critRate: 10 + skills.critRate * 5,
    critMultiplier: (100 + skills.critDamage * 20) / 100,
    armorBlock: skills.armor * 5,
    dodgeChance: 5 + skills.dodge * 5,
    hitRate: Math.min(100, 50 + skills.precision * 5),
  }
}

// ====== TYPES ======

export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike'

// ====== COMBAT LOG ======

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

// ====== BATTLE SIDE ======

export interface BattleSide {
  countryCode: string
  divisionIds: string[]
  engagedDivisionIds: string[]

  // Report summaries (accumulated)
  damageDealt: number
  manpowerLost: number
  divisionsDestroyed: number
  divisionsRetreated: number
}

// ====== BATTLE TICK ======

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

// ====== BATTLE ======

// ====== TACTICAL ORDERS ======
export type TacticalOrder = 'none' | 'charge' | 'fortify' | 'precision' | 'blitz'

export interface OrderEffects {
  atkMult: number
  armorMult: number
  dodgeMult: number
  hitBonus: number
  critBonus: number
  speedMult: number
}

export const TACTICAL_ORDERS: Record<TacticalOrder, { label: string; desc: string; effects: OrderEffects; color: string }> = {
  none: { label: 'NONE', desc: 'No active order', effects: { atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0, critBonus: 0, speedMult: 1 }, color: '#64748b' },
  charge: { label: 'CHARGE', desc: '+20% ATK, -15% dodge, -10% armor', effects: { atkMult: 1.20, armorMult: 0.90, dodgeMult: 0.85, hitBonus: 0, critBonus: 0, speedMult: 1 }, color: '#ef4444' },
  fortify: { label: 'FORTIFY', desc: '+25% armor, +10% dodge, -15% ATK', effects: { atkMult: 0.85, armorMult: 1.25, dodgeMult: 1.10, hitBonus: 0, critBonus: 0, speedMult: 1 }, color: '#3b82f6' },
  precision: { label: 'PRECISION', desc: '+15% hit, +15% crit, -10% speed', effects: { atkMult: 1, armorMult: 1, dodgeMult: 1, hitBonus: 0.15, critBonus: 15, speedMult: 1.10 }, color: '#f59e0b' },
  blitz: { label: 'BLITZ', desc: '+25% speed, -10% hit, -10% armor', effects: { atkMult: 1, armorMult: 0.90, dodgeMult: 1, hitBonus: -0.10, critBonus: 0, speedMult: 0.75 }, color: '#22d38a' },
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

  // Attack speed accumulators: divisionId → accumulated time (fires when >= attackSpeed)
  divisionCooldowns: Record<string, number>

  // Tactical Orders per side
  attackerOrder: TacticalOrder
  defenderOrder: TacticalOrder
  orderMessage: string
  motd: string
}

// ====== HELPERS ======

const POINTS_TO_WIN_ROUND = 600
const ROUNDS_TO_WIN_BATTLE = 2

function getPointIncrement(totalGroundPoints: number): number {
  if (totalGroundPoints < 100) return 1
  if (totalGroundPoints < 200) return 2
  if (totalGroundPoints < 300) return 3
  if (totalGroundPoints < 400) return 4
  return 5
}

// Country flag emojis from ISO codes
const FLAG_EMOJIS: Record<string, string> = {
  US: '🇺🇸', RU: '🇷🇺', CN: '🇨🇳', DE: '🇩🇪', BR: '🇧🇷', IN: '🇮🇳',
  NG: '🇳🇬', JP: '🇯🇵', GB: '🇬🇧', TR: '🇹🇷', CA: '🇨🇦', MX: '🇲🇽',
  CU: '🇨🇺', BS: '🇧🇸',
  FR: '🇫🇷', ES: '🇪🇸', IT: '🇮🇹', PL: '🇵🇱', UA: '🇺🇦', RO: '🇷🇴',
  NL: '🇳🇱', BE: '🇧🇪', SE: '🇸🇪', NO: '🇳🇴', FI: '🇫🇮', DK: '🇩🇰',
  AT: '🇦🇹', CH: '🇨🇭', CZ: '🇨🇿', PT: '🇵🇹', GR: '🇬🇷', HU: '🇭🇺',
  IE: '🇮🇪', IS: '🇮🇸', RS: '🇷🇸', BY: '🇧🇾', BG: '🇧🇬', SK: '🇸🇰',
  HR: '🇭🇷', LT: '🇱🇹', LV: '🇱🇻', EE: '🇪🇪', SI: '🇸🇮', BA: '🇧🇦',
  AL: '🇦🇱', MK: '🇲🇰', ME: '🇲🇪', MD: '🇲🇩', XK: '🇽🇰',
  AR: '🇦🇷', CO: '🇨🇴', VE: '🇻🇪', PE: '🇵🇪', CL: '🇨🇱', EC: '🇪🇨',
  BO: '🇧🇴', PY: '🇵🇾', UY: '🇺🇾', GY: '🇬🇾', SR: '🇸🇷',
  GT: '🇬🇹', HN: '🇭🇳', SV: '🇸🇻', NI: '🇳🇮', CR: '🇨🇷', PA: '🇵🇦',
  DO: '🇩🇴', HT: '🇭🇹', JM: '🇯🇲', TT: '🇹🇹',
  KR: '🇰🇷', KP: '🇰🇵', TW: '🇹🇼', TH: '🇹🇭', VN: '🇻🇳', PH: '🇵🇭',
  MY: '🇲🇾', ID: '🇮🇩', MM: '🇲🇲', BD: '🇧🇩', PK: '🇵🇰', AF: '🇦🇫',
  IQ: '🇮🇶', IR: '🇮🇷', SA: '🇸🇦', AE: '🇦🇪', IL: '🇮🇱', SY: '🇸🇾',
  JO: '🇯🇴', LB: '🇱🇧', YE: '🇾🇪', OM: '🇴🇲', KW: '🇰🇼', QA: '🇶🇦',
  GE: '🇬🇪', AM: '🇦🇲', AZ: '🇦🇿', KZ: '🇰🇿', UZ: '🇺🇿', TM: '🇹🇲',
  KG: '🇰🇬', TJ: '🇹🇯', MN: '🇲🇳', NP: '🇳🇵', LK: '🇱🇰', LA: '🇱🇦',
  KH: '🇰🇭', BN: '🇧🇳', SG: '🇸🇬',
  ZA: '🇿🇦', EG: '🇪🇬', KE: '🇰🇪', ET: '🇪🇹', TZ: '🇹🇿', GH: '🇬🇭',
  CI: '🇨🇮', CM: '🇨🇲', AO: '🇦🇴', MZ: '🇲🇿', MG: '🇲🇬', MA: '🇲🇦',
  DZ: '🇩🇿', TN: '🇹🇳', LY: '🇱🇾', SD: '🇸🇩', SS: '🇸🇸', UG: '🇺🇬',
  SN: '🇸🇳', ML: '🇲🇱', BF: '🇧🇫', NE: '🇳🇪', TD: '🇹🇩', CD: '🇨🇩',
  CG: '🇨🇬', CF: '🇨🇫', GA: '🇬🇦', GQ: '🇬🇶', MW: '🇲🇼', ZM: '🇿🇲',
  ZW: '🇿🇼', BW: '🇧🇼', NA: '🇳🇦', SO: '🇸🇴', ER: '🇪🇷', DJ: '🇩🇯',
  RW: '🇷🇼', BI: '🇧🇮', SL: '🇸🇱', LR: '🇱🇷', GM: '🇬🇲', GW: '🇬🇼',
  MR: '🇲🇷', LS: '🇱🇸', SZ: '🇸🇿', TG: '🇹🇬', BJ: '🇧🇯',
  AU: '🇦🇺', NZ: '🇳🇿', PG: '🇵🇬', FJ: '🇫🇯',
}

export function getCountryFlag(iso: string): string {
  return FLAG_EMOJIS[iso] || '🏳️'
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', RU: 'Russia', CN: 'China', DE: 'Germany', BR: 'Brazil', IN: 'India',
  NG: 'Nigeria', JP: 'Japan', GB: 'United Kingdom', TR: 'Turkey', CA: 'Canada', MX: 'Mexico',
  CU: 'Cuba', BS: 'Bahamas',
  FR: 'France', ES: 'Spain', IT: 'Italy', PL: 'Poland', UA: 'Ukraine', RO: 'Romania',
  NL: 'Netherlands', BE: 'Belgium', SE: 'Sweden', NO: 'Norway', FI: 'Finland', DK: 'Denmark',
  AT: 'Austria', CH: 'Switzerland', CZ: 'Czech Republic', PT: 'Portugal', GR: 'Greece', HU: 'Hungary',
  IE: 'Ireland', IS: 'Iceland', RS: 'Serbia', BY: 'Belarus', BG: 'Bulgaria', SK: 'Slovakia',
  HR: 'Croatia', LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia', SI: 'Slovenia', BA: 'Bosnia and Herzegovina',
  AL: 'Albania', MK: 'North Macedonia', ME: 'Montenegro', MD: 'Moldova', XK: 'Kosovo',
  AR: 'Argentina', CO: 'Colombia', VE: 'Venezuela', PE: 'Peru', CL: 'Chile', EC: 'Ecuador',
  BO: 'Bolivia', PY: 'Paraguay', UY: 'Uruguay', GY: 'Guyana', SR: 'Suriname',
  GT: 'Guatemala', HN: 'Honduras', SV: 'El Salvador', NI: 'Nicaragua', CR: 'Costa Rica', PA: 'Panama',
  DO: 'Dominican Republic', HT: 'Haiti', JM: 'Jamaica', TT: 'Trinidad and Tobago',
  KR: 'South Korea', KP: 'North Korea', TW: 'Taiwan', TH: 'Thailand', VN: 'Vietnam', PH: 'Philippines',
  MY: 'Malaysia', ID: 'Indonesia', MM: 'Myanmar', BD: 'Bangladesh', PK: 'Pakistan', AF: 'Afghanistan',
  IQ: 'Iraq', IR: 'Iran', SA: 'Saudi Arabia', AE: 'United Arab Emirates', IL: 'Israel', SY: 'Syria',
  JO: 'Jordan', LB: 'Lebanon', YE: 'Yemen', OM: 'Oman', KW: 'Kuwait', QA: 'Qatar',
  GE: 'Georgia', AM: 'Armenia', AZ: 'Azerbaijan', KZ: 'Kazakhstan', UZ: 'Uzbekistan', TM: 'Turkmenistan',
  KG: 'Kyrgyzstan', TJ: 'Tajikistan', MN: 'Mongolia', NP: 'Nepal', LK: 'Sri Lanka', LA: 'Laos',
  KH: 'Cambodia', BN: 'Brunei', SG: 'Singapore',
  ZA: 'South Africa', EG: 'Egypt', KE: 'Kenya', ET: 'Ethiopia', TZ: 'Tanzania', GH: 'Ghana',
  CI: 'Ivory Coast', CM: 'Cameroon', AO: 'Angola', MZ: 'Mozambique', MG: 'Madagascar', MA: 'Morocco',
  DZ: 'Algeria', TN: 'Tunisia', LY: 'Libya', SD: 'Sudan', SS: 'South Sudan', UG: 'Uganda',
  SN: 'Senegal', ML: 'Mali', BF: 'Burkina Faso', NE: 'Niger', TD: 'Chad', CD: 'DR Congo',
  CG: 'Congo', CF: 'Central African Republic', GA: 'Gabon', GQ: 'Equatorial Guinea', MW: 'Malawi', ZM: 'Zambia',
  ZW: 'Zimbabwe', BW: 'Botswana', NA: 'Namibia', SO: 'Somalia', ER: 'Eritrea', DJ: 'Djibouti',
  RW: 'Rwanda', BI: 'Burundi', SL: 'Sierra Leone', LR: 'Liberia', GM: 'Gambia', GW: 'Guinea-Bissau',
  MR: 'Mauritania', LS: 'Lesotho', SZ: 'Eswatini', TG: 'Togo', BJ: 'Benin',
  AU: 'Australia', NZ: 'New Zealand', PG: 'Papua New Guinea', FJ: 'Fiji',
}

export function getCountryName(iso: string): string {
  return COUNTRY_NAMES[iso] || iso
}

// ====== FACTORY FUNCTIONS ======

function createEmptyBattleSide(countryCode: string): BattleSide {
  return {
    countryCode,
    divisionIds: [], engagedDivisionIds: [],
    damageDealt: 0, manpowerLost: 0,
    divisionsDestroyed: 0, divisionsRetreated: 0,
  }
}

function mkBattle(id: string, attackerId: string, defenderId: string, regionName: string, type: BattleType = 'invasion'): Battle {
  return {
    id, type, attackerId, defenderId, regionName,
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
  }
}

// ====== STORE ======

export interface BattleState {
  battles: Record<string, Battle>

  launchAttack: (attackerId: string, defenderId: string, regionName: string, type?: BattleType) => void
  addDamage: (battleId: string, side: 'attacker' | 'defender', amount: number, isCrit: boolean, isDodged: boolean, playerName: string) => void
  resolveTicksAndRounds: () => void

  launchHOIBattle: (attackerArmyId: string, defenderCountryCode: string, type?: BattleType) => { success: boolean; message: string; battleId?: string }
  processHOICombatTick: () => void

  playerAttack: (battleId: string, side?: 'attacker' | 'defender') => { damage: number; isCrit: boolean; message: string }
  playerDefend: (battleId: string, side?: 'attacker' | 'defender') => { blocked: number; message: string }
  deployDivisionsToBattle: (battleId: string, divisionIds: string[], side: 'attacker' | 'defender') => { success: boolean; message: string }
  removeDivisionsFromBattle: (battleId: string, side: 'attacker' | 'defender') => { success: boolean; message: string }
  recallDivisionFromBattle: (battleId: string, divisionId: string, side: 'attacker' | 'defender') => { success: boolean; message: string }

  combatTickLeft: number
  setCombatTickLeft: (val: number) => void
  setBattleOrder: (battleId: string, side: 'attacker' | 'defender', order: TacticalOrder) => void
  setBattleOrderMessage: (battleId: string, message: string) => void
  setBattleMOTD: (battleId: string, motd: string) => void
  warMotd: string
  setWarMotd: (motd: string) => void
}

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: {},
  warMotd: '',
  setWarMotd: (motd: string) => set({ warMotd: motd.substring(0, 200) }),
  combatTickLeft: 15,
  setCombatTickLeft: (val: number) => set({ combatTickLeft: val }),
  setBattleOrder: (battleId: string, side: 'attacker' | 'defender', order: TacticalOrder) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle) return state
    const key = side === 'attacker' ? 'attackerOrder' : 'defenderOrder'
    return {
      battles: {
        ...state.battles,
        [battleId]: { ...battle, [key]: order },
      },
    }
  }),
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

  // ====== LEGACY LAUNCH ======
  launchAttack: (attackerId, defenderId, regionName, type = 'invasion') => set((state) => {
    const existing = Object.values(state.battles).find(b => b.regionName === regionName && b.status === 'active')
    if (existing) return state

    const id = `battle_${Date.now()}_${regionName.replace(/\s+/g, '_')}`
    const battle = mkBattle(id, attackerId, defenderId, regionName, type)

    return { battles: { ...state.battles, [id]: battle } }
  }),

  // ====== BATTLE LAUNCH ======
  launchHOIBattle: (attackerArmyId, defenderCountryCode, type = 'invasion') => {
    const armyStore = useArmyStore.getState()
    const attackerArmy = armyStore.armies[attackerArmyId]
    if (!attackerArmy) return { success: false, message: 'Army not found.' }

    const attackerDivs = attackerArmy.divisionIds
      .map(id => armyStore.divisions[id])
      .filter(d => d && d.status === 'ready')

    if (attackerDivs.length === 0) return { success: false, message: 'No ready divisions in this army.' }

    const world = useWorldStore.getState()
    if (!world.canAttack(attackerArmy.countryCode, defenderCountryCode)) {
      return { success: false, message: 'Cannot attack: no adjacency or not at war.' }
    }

    // Auto-defense: fetch all ready divisions for the defending country (across all armies + unassigned)
    const allDefenderDivs = Object.values(armyStore.divisions)
      .filter(d => d.countryCode === defenderCountryCode && d.status === 'ready')
    const defenderDivIds = allDefenderDivs.map(d => d.id)

    const id = `hoi_battle_${Date.now()}`
    const now = Date.now()
    const targetName = getCountryName(defenderCountryCode)
    const atkDivIds = attackerDivs.map(d => d.id)

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
    }

    // Mark divisions as in_combat
    attackerDivs.forEach(d => {
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [d.id]: { ...s.divisions[d.id], status: 'in_combat' } }
      }))
    })
    defenderDivIds.forEach(divId => {
      const div = armyStore.divisions[divId]
      if (div) {
        useArmyStore.setState(s => ({
          divisions: { ...s.divisions, [divId]: { ...s.divisions[divId], status: 'in_combat' } }
        }))
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

    // Apply battle order buff
    // Apply tactical order buff for the side
    const sideOrder = side === 'attacker' ? battle.attackerOrder : battle.defenderOrder
    const orderFx = TACTICAL_ORDERS[sideOrder || 'none'].effects
    finalAmount = Math.round(finalAmount * orderFx.atkMult)

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

    // --- 2% of manual damage hurts opposing divisions ---
    const splashDmg = Math.floor(finalAmount * 0.02)
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

    return {
      battles: {
        ...state.battles,
        [battleId]: {
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
        },
      },
    }
  }),

  // ====== COMBAT TICK PROCESSOR (uses player stats × division multipliers) ======
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
        const govStore = useGovernmentStore.getState()
        const countryDivs = Object.values(armyStore.divisions).filter(
          d => d.countryCode === sideData.countryCode && (d.status === 'ready' || d.status === 'in_combat') && d.health > 0
            && (side === 'attacker' || (govStore.autoDefenseEnabled && (d.stance === 'first_line_defense' || d.stance === 'unassigned')))
        )
        if (countryDivs.length === 0) return
        const ids = countryDivs.map(d => d.id)
        // Mark as in_combat
        ids.forEach(id => {
          useArmyStore.setState(s => ({
            divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'in_combat' } }
          }))
        })
        sideData.divisionIds = [...new Set([...sideData.divisionIds, ...ids])]
        sideData.engagedDivisionIds = [...new Set([...sideData.engagedDivisionIds, ...ids])]
        newCombatLog.push({
          tick, timestamp: now, type: 'reinforcement' as const, side,
          message: `🚀 ${ids.length} ${side} division(s) auto-deployed!`,
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
        return Object.values(armyStore.armies).find(a => a.divisionIds.includes(divId))
      }
      const atkArmy = atkDivIds.length > 0 ? findArmyForDiv(atkDivIds[0]) : null
      const defArmy = defDivIds.length > 0 ? findArmyForDiv(defDivIds[0]) : null
      const atkAura = atkArmy ? armyStore.getCompositionAura(atkArmy.id) : { critDmgPct: 0, dodgePct: 0, attackPct: 0, precisionPct: 0 }
      const defAura = defArmy ? armyStore.getCompositionAura(defArmy.id) : { critDmgPct: 0, dodgePct: 0, attackPct: 0, precisionPct: 0 }

      // --- Random ±10% deviation for combat variability ---
      const deviate = (v: number) => v * (0.9 + Math.random() * 0.2)

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
        while (cooldowns[divId] >= as) {
          cooldowns[divId] -= as
          const atkDivLevel = Math.floor((div.experience || 0) / 10)
          // Hit check (order hitBonus + aura precisionPct + equip hitRate applied)
          if (Math.random() > Math.min(0.95, tHitRate + atkDivLevel * 0.01 + atkOrd.hitBonus + atkAura.precisionPct / 100 + eq.bonusHitRate)) {
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
          const effectiveCritRate = deviate((playerStats.critRate + atkOrd.critBonus + eq.bonusCritRate) * (tCritRate + atkDivLevel * 0.01))
          if (Math.random() * 100 < effectiveCritRate) {
            // Apply aura crit damage bonus + equip crit dmg
            const effectiveCritMult = playerStats.critMultiplier * (tCritDmg + atkDivLevel * 0.01) * (1 + atkAura.critDmgPct / 100) + eq.bonusCritDmg / 100
            dmg = Math.floor(dmg * effectiveCritMult)
            atkCrits++
            divEvents.push({ divName: div.name, side: 'atk', event: 'crit', dmg })
          }
          const strength = div.health / div.maxHealth
          dmg = Math.floor(dmg * strength)
          dmg = Math.floor(dmg * atkOrd.atkMult)
          // Apply ±10% deviation to final damage
          dmg = Math.floor(deviate(dmg))
          atkTotalDmg += Math.max(1, dmg)
        }
      })

      // --- Experience gain: +0.5 per tick for engaged attacker divisions ---
      atkDivIds.forEach(divId => {
        const d = armyStore.divisions[divId]
        if (d && d.experience < 100) {
          useArmyStore.setState(s => ({
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
        while (cooldowns[divId] >= defAS) {
          cooldowns[divId] -= defAS
          const defDivLevel = Math.floor((d.experience || 0) / 10)
          // Hit check (order hitBonus + aura precisionPct + equip hitRate applied)
          if (Math.random() > Math.min(0.95, dHitRate + defDivLevel * 0.01 + defOrd.hitBonus + defAura.precisionPct / 100 + deq.bonusHitRate)) {
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
          const effectiveCritRate = deviate((playerStats.critRate + defOrd.critBonus + deq.bonusCritRate) * (dCritRate + defDivLevel * 0.01))
          if (Math.random() * 100 < effectiveCritRate) {
            // Apply aura crit damage bonus + equip crit dmg
            const effectiveCritMult = playerStats.critMultiplier * (dCritDmg + defDivLevel * 0.01) * (1 + defAura.critDmgPct / 100) + deq.bonusCritDmg / 100
            dmg = Math.floor(dmg * effectiveCritMult)
            defCrits++
            divEvents.push({ divName: d.name, side: 'def', event: 'crit', dmg })
          }
          const strength = d.health / d.maxHealth
          dmg = Math.floor(dmg * strength)
          dmg = Math.floor(dmg * defOrd.atkMult)
          // Apply ±10% deviation to final damage
          dmg = Math.floor(deviate(dmg))
          defTotalDmg += Math.max(1, dmg)
        }
      })

      // --- Pre-compute per-division defensive hits (for staggered real-time application) ---
      // Collect hits with side info so damage bar can animate per-hit
      const hitSchedule: { divId: string; divName: string; damage: number; equipDmg: number; side: 'atk' | 'def'; displayDmg: number; isCrit: boolean }[] = []
      const manpowerDmgToDefender = Math.floor(atkTotalDmg * 0.25)
      const manpowerDmgToAttacker = Math.floor(defTotalDmg * 0.25)

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
          const armorReduction = Math.floor(((playerStats.armorBlock || 0) + defEq.bonusArmor) * tmpl.armorMult * defOrderFx.armorMult)
          let finalDmg = Math.max(1, basePerDiv - armorReduction)
          finalDmg = Math.max(1, Math.floor(finalDmg / tmpl.healthMult))
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
          const dodgeChance = deviate((playerStats.dodgeChance || 5) * tmpl.dodgeMult * atkOrderFx.dodgeMult * (1 + atkAura.dodgePct / 100) + atkEq.bonusDodge) / 100
          if (Math.random() < dodgeChance) {
            divEvents.push({ divName: d.name, side: 'def', event: 'dodge' })
            return
          }
          const armorReduction = Math.floor(((playerStats.armorBlock || 0) + atkEq.bonusArmor) * tmpl.armorMult * atkOrderFx.armorMult)
          let finalDmg = Math.max(1, basePerDiv - armorReduction)
          finalDmg = Math.max(1, Math.floor(finalDmg / tmpl.healthMult))
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

      // Check for destroyed divisions
      let atkDestroyed = 0, defDestroyed = 0
      battle.attacker.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') { atkDestroyed++; newCombatLog.push({ tick, timestamp: now, type: 'destroyed', side: 'attacker', divisionName: d.name, message: `💀 ${d.name} destroyed!` }) }
      })
      battle.defender.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') { defDestroyed++; newCombatLog.push({ tick, timestamp: now, type: 'destroyed', side: 'defender', divisionName: d.name, message: `💀 ${d.name} destroyed!` }) }
      })

      // --- Award ground points ---
      const activeRoundIndex = battle.rounds.length - 1
      const activeRound = { ...battle.rounds[activeRoundIndex] }
      const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
      const pointIncrement = getPointIncrement(totalGroundPoints)
      // Award points based on damage dealt this tick
      // If damage is equal, award based on who has more alive divisions (tiebreaker)
      // If still tied, flip a coin so points always move forward
      if (atkTotalDmg > 0 || defTotalDmg > 0) {
        if (atkTotalDmg > defTotalDmg) {
          activeRound.attackerPoints += pointIncrement
        } else if (defTotalDmg > atkTotalDmg) {
          activeRound.defenderPoints += pointIncrement
        } else {
          // Tie: use division count as tiebreaker, then random
          if (atkDivIds.length > defDivIds.length) {
            activeRound.attackerPoints += pointIncrement
          } else if (defDivIds.length > atkDivIds.length) {
            activeRound.defenderPoints += pointIncrement
          } else {
            // True tie: random
            if (Math.random() < 0.5) activeRound.attackerPoints += pointIncrement
            else activeRound.defenderPoints += pointIncrement
          }
        }
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
        activeRound.attackerDmgTotal = battle.attacker.damageDealt
        activeRound.defenderDmgTotal = battle.defender.damageDealt
        if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND) { atkRoundsWon++; activeRound.status = 'attacker_won' }
        else { defRoundsWon++; activeRound.status = 'defender_won' }
        if (atkRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'attacker_won'
          const world = useWorldStore.getState()
          if (battle.type === 'invasion') world.occupyCountry(battle.defenderId, battle.attackerId, false)
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `⚔️ VICTORY! ${getCountryName(battle.attackerId)} captures ${battle.regionName}!` })
        } else if (defRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'defender_won'
          newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'defender', message: `🛡️ DEFENSE HOLDS! ${getCountryName(battle.defenderId)} defends ${battle.regionName}!` })
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
    // NOTE: processHOICombatTick, cyber, and military processing are called
    // directly in App.tsx timer — do NOT call them here to avoid double-fire.
    // Army training is handled by armyStore internally.
  },

  // ====== PLAYER COMBAT ACTIONS ======
  playerAttack: (battleId, forceSide) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { damage: 0, isCrit: false, message: 'No active battle.' }

    const player = usePlayerStore.getState()
    if (player.stamina < 5) return { damage: 0, isCrit: false, message: 'Not enough stamina (5 required).' }
    player.consumeBar('stamina', 5)

    const cs = getPlayerCombatStats()
    const isCrit = Math.random() * 100 < cs.critRate
    const damage = isCrit ? Math.floor(cs.attackDamage * cs.critMultiplier) : cs.attackDamage

    const playerCountry = player.countryCode || 'US'
    const side: 'attacker' | 'defender' = forceSide || (playerCountry === battle.attackerId ? 'attacker' : 'defender')

    get().addDamage(battleId, side, damage, isCrit, false, player.name)

    // Activate HERO buff: +10% division damage for 120 ticks, scoped to THIS battle
    usePlayerStore.setState({ heroBuffTicksLeft: 120, heroBuffBattleId: battleId })

    // Degrade equipped items durability
    useInventoryStore.getState().degradeEquippedItems(1)

    return {
      damage,
      isCrit,
      message: isCrit ? `💥 CRITICAL HIT! ${damage} damage dealt!` : `⚔️ ${damage} damage dealt.`,
    }
  },

  playerDefend: (battleId, forceSide) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { blocked: 0, message: 'No active battle.' }

    const player = usePlayerStore.getState()
    if (player.stamina < 3) return { blocked: 0, message: 'Not enough stamina (3 required).' }
    player.consumeBar('stamina', 3)

    const cs = getPlayerCombatStats()
    const blocked = cs.armorBlock + Math.floor(cs.dodgeChance * 0.5)

    const playerCountry = player.countryCode || 'US'
    const isAttacker = forceSide ? forceSide === 'attacker' : playerCountry === battle.attackerId
    const enemySide = isAttacker ? 'defenderDamage' : 'attackerDamage'

    // Activate HERO buff: +10% division damage for 120 ticks, scoped to THIS battle
    usePlayerStore.setState({ heroBuffTicksLeft: 120, heroBuffBattleId: battleId })

    // Degrade equipped items durability
    useInventoryStore.getState().degradeEquippedItems(1)

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
            amount: blocked, isCrit: false, isDodged: false, time: Date.now(),
          }, ...battle.damageFeed].slice(0, 20),
        },
      },
    }))

    return {
      blocked,
      message: `🛡️ Blocked ${blocked} incoming damage!`,
    }
  },

  // ====== DEPLOY DIVISIONS TO BATTLE ======
  deployDivisionsToBattle: (battleId, divisionIds, side) => {
    const state = get()
    const battle = state.battles[battleId]
    if (!battle || battle.status !== 'active') return { success: false, message: 'No active battle.' }

    const armyStore = useArmyStore.getState()
    const validIds = divisionIds.filter(id => {
      const d = armyStore.divisions[id]
      return d && (d.status === 'ready' || d.status === 'training') && d.health > 0
    })
    if (validIds.length === 0) return { success: false, message: 'No valid divisions to deploy.' }

    // Mark divisions as in_combat
    validIds.forEach(id => {
      useArmyStore.setState(s => ({
        divisions: { ...s.divisions, [id]: { ...s.divisions[id], status: 'in_combat' } }
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
      useArmyStore.setState(s => {
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

    // Set division to 'recovering'
    useArmyStore.setState(s => {
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

    return { success: true, message: `${divName} recalled.` }
  },
}))
