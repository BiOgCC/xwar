import { create } from 'zustand'
import { useWorldStore } from './worldStore'
import { useGovernmentStore } from './governmentStore'
import { usePlayerStore } from './playerStore'
import { useSkillsStore } from './skillsStore'
import { useInventoryStore } from './inventoryStore'

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

  // Hunger penalty: full hunger (100) = 1.0x, empty (0) = 0.5x
  const hungerMultiplier = 0.5 + (player.hunger / player.maxHunger) * 0.5

  return {
    attackDamage: Math.floor((100 + eqDmg + skills.attack * 20) * hungerMultiplier),
    critRate: 10 + eqCritRate + skills.critRate * 5,
    critMultiplier: (100 + eqCritDmg + skills.critDamage * 20) / 100,
    armorBlock: eqArmor + skills.armor * 5,
    dodgeChance: 5 + eqDodge + skills.dodge * 5,
    hitRate: Math.min(100, 50 + eqPrecision + skills.precision * 5),
    hungerMultiplier,
  }
}

import {
  useArmyStore,
  DIVISION_TEMPLATES,
  type Division,
} from './armyStore'

// ====== TYPES ======

export type BattleType = 'assault' | 'invasion' | 'occupation' | 'sabotage' | 'naval_strike' | 'air_strike'

// ====== COMBAT LOG ======

export interface CombatLogEntry {
  tick: number
  timestamp: number
  type: 'damage' | 'critical' | 'retreat' | 'destroyed' | 'air_strike' | 'artillery_barrage' | 'breakthrough' | 'morale_break' | 'phase_change' | 'reinforcement'
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
}

// ====== BATTLE ======

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

  // Battle Orders: 0 = none, 5/10/15 = % damage buff
  battleOrder: number
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
    rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active' }],
    currentTick: { attackerDamage: 0, defenderDamage: 0 },
    combatLog: [],
    attackerDamageDealers: {}, defenderDamageDealers: {},
    damageFeed: [],
    battleOrder: 0,
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

  combatTickLeft: number
  setCombatTickLeft: (val: number) => void
  setBattleOrder: (battleId: string, order: number) => void
}

export const useBattleStore = create<BattleState>((set, get) => ({
  battles: {},
  combatTickLeft: 15,
  setCombatTickLeft: (val: number) => set({ combatTickLeft: val }),
  setBattleOrder: (battleId: string, order: number) => set((state) => {
    const battle = state.battles[battleId]
    if (!battle) return state
    return {
      battles: {
        ...state.battles,
        [battleId]: { ...battle, battleOrder: order },
      },
    }
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

    const defenderArmies = armyStore.getArmiesForCountry(defenderCountryCode)
    const defenderArmy = defenderArmies[0]
    const defenderDivIds = defenderArmy
      ? defenderArmy.divisionIds.filter(id => {
          const d = armyStore.divisions[id]
          return d && d.status === 'ready'
        })
      : []

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
      rounds: [{ attackerPoints: 0, defenderPoints: 0, status: 'active' }],
      currentTick: { attackerDamage: 0, defenderDamage: 0 },
      combatLog: [{
        tick: 0, timestamp: now, type: 'phase_change', side: 'attacker',
        message: `⚔️ Battle for ${targetName} begins! ${attackerDivs.length} vs ${defenderDivIds.length} divisions.`,
      }],
      attackerDamageDealers: {}, defenderDamageDealers: {},
      damageFeed: [],
      battleOrder: 0,
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
    if (battle.battleOrder > 0) {
      finalAmount = Math.round(finalAmount * (1 + battle.battleOrder / 100))
    }

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
    const playerStats = getPlayerCombatStats()
    const playerName = usePlayerStore.getState().name || 'Commander'

    const newBattles = { ...state.battles }
    let hasChanges = false

    Object.values(newBattles).forEach(battle => {
      if (battle.status !== 'active') return

      hasChanges = true
      const tick = battle.ticksElapsed + 1
      const newCombatLog = [...battle.combatLog]

      // --- Auto-deploy: if a side has no engaged divisions, auto-deploy available ones ---
      const autoDeploySide = (side: 'attacker' | 'defender') => {
        const sideData = side === 'attacker' ? battle.attacker : battle.defender
        if (sideData.engagedDivisionIds.length > 0) return  // already has engaged divisions
        const countryDivs = Object.values(armyStore.divisions).filter(
          d => d.countryCode === sideData.countryCode && (d.status === 'ready' || d.status === 'in_combat') && d.manpower > 0
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

      // --- Get alive divisions on each side ---
      const atkDivIds = battle.attacker.engagedDivisionIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'retreating'
      })
      const defDivIds = battle.defender.engagedDivisionIds.filter(id => {
        const d = armyStore.divisions[id]
        return d && d.status !== 'destroyed' && d.status !== 'retreating'
      })

      // --- ATTACKER DAMAGE (player stats × division template multipliers) ---
      let atkTotalDmg = 0
      let atkCrits = 0
      let atkMisses = 0
      atkDivIds.forEach(divId => {
        const div = armyStore.divisions[divId]
        if (!div) return
        const template = DIVISION_TEMPLATES[div.type as keyof typeof DIVISION_TEMPLATES]
        if (!template) { console.warn('[Combat] Unknown division type:', div.type, 'for div', divId); return }

        // Hit check: template hitRate
        if (Math.random() > template.hitRate) {
          atkMisses++
          return
        }
        // Base damage: player attack × division atkDmg multiplier
        let dmg = Math.floor(playerStats.attackDamage * template.atkDmgMult)
        // Crit check: player critRate × division critRate multiplier
        const effectiveCritRate = playerStats.critRate * template.critRateMult
        if (Math.random() * 100 < effectiveCritRate) {
          const effectiveCritMult = playerStats.critMultiplier * template.critDmgMult
          dmg = Math.floor(dmg * effectiveCritMult)
          atkCrits++
        }
        // Scale by division strength and morale
        const strength = div.manpower / div.maxManpower
        const morale = div.morale / 100
        dmg = Math.floor(dmg * strength * morale)
        // Apply battle order buff
        if (battle.battleOrder > 0) dmg = Math.floor(dmg * (1 + battle.battleOrder / 100))
        atkTotalDmg += Math.max(1, dmg)
      })

      // --- DEFENDER DAMAGE (AI — uses division template multipliers with base stats) ---
      let defTotalDmg = 0
      defDivIds.forEach(divId => {
        const d = armyStore.divisions[divId]
        if (!d) return
        const template = DIVISION_TEMPLATES[d.type as keyof typeof DIVISION_TEMPLATES]
        if (!template) { console.warn('[Combat] Unknown defender div type:', d.type, 'for div', divId); return }
        const strength = d.manpower / d.maxManpower
        const morale = d.morale / 100
        // Base AI damage: 80 × atkDmgMult (AI baseline = 80 attack)
        const rawDmg = Math.floor(80 * template.atkDmgMult * strength * morale)
        // Player armor reduces incoming damage
        const blocked = Math.min(rawDmg, playerStats.armorBlock)
        // Player dodge check
        if (Math.random() * 100 < playerStats.dodgeChance) return
        defTotalDmg += Math.max(1, rawDmg - blocked)
      })

      // --- Apply manpower damage to opposing divisions ---
      const manpowerDmgToDefender = Math.floor(atkTotalDmg * 0.3)
      const manpowerDmgToAttacker = Math.floor(defTotalDmg * 0.2)

      if (defDivIds.length > 0 && atkTotalDmg > 0) {
        const perDiv = Math.max(1, Math.floor(manpowerDmgToDefender / defDivIds.length))
        defDivIds.forEach(id => armyStore.applyBattleDamage(id, perDiv, 0, 2, 0.5))
      }
      if (atkDivIds.length > 0 && defTotalDmg > 0) {
        const perDiv = Math.max(1, Math.floor(manpowerDmgToAttacker / atkDivIds.length))
        atkDivIds.forEach(id => armyStore.applyBattleDamage(id, perDiv, 0, 1.5, 0.3))
      }

      // --- Combat log ---
      if (atkTotalDmg > 0 || defTotalDmg > 0) {
        newCombatLog.push({
          tick, timestamp: now, type: 'damage', side: 'attacker',
          damage: atkTotalDmg,
          message: `⚔️ T${tick}: Attacker deals ${atkTotalDmg} dmg (${atkDivIds.length} divs, ${atkCrits} crits, ${atkMisses} miss)`,
        })
        newCombatLog.push({
          tick, timestamp: now, type: 'damage', side: 'defender',
          damage: defTotalDmg,
          message: `🛡️ T${tick}: Defender deals ${defTotalDmg} dmg (${defDivIds.length} divs)`,
        })
      } else if (atkDivIds.length === 0 && defDivIds.length === 0) {
        newCombatLog.push({
          tick, timestamp: now, type: 'phase_change', side: 'attacker',
          message: `⏸️ T${tick}: No divisions engaged — deploy troops to fight!`,
        })
      }

      // --- Refresh division states after damage ---
      const updatedArmyStore = useArmyStore.getState()

      // Check for destroyed/retreating divisions
      let atkDestroyed = 0, atkRetreated = 0, defDestroyed = 0, defRetreated = 0
      battle.attacker.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') { atkDestroyed++; newCombatLog.push({ tick, timestamp: now, type: 'destroyed', side: 'attacker', divisionName: d.name, message: `💀 ${d.name} destroyed!` }) }
        if (d?.status === 'retreating') { atkRetreated++; newCombatLog.push({ tick, timestamp: now, type: 'retreat', side: 'attacker', divisionName: d.name, message: `🏳️ ${d.name} retreating!` }) }
      })
      battle.defender.divisionIds.forEach(id => {
        const d = updatedArmyStore.divisions[id]
        if (d?.status === 'destroyed') { defDestroyed++; newCombatLog.push({ tick, timestamp: now, type: 'destroyed', side: 'defender', divisionName: d.name, message: `💀 ${d.name} destroyed!` }) }
        if (d?.status === 'retreating') { defRetreated++; newCombatLog.push({ tick, timestamp: now, type: 'retreat', side: 'defender', divisionName: d.name, message: `🏳️ ${d.name} retreating!` }) }
      })

      // --- Award ground points ---
      const activeRoundIndex = battle.rounds.length - 1
      const activeRound = { ...battle.rounds[activeRoundIndex] }
      const totalGroundPoints = activeRound.attackerPoints + activeRound.defenderPoints
      const pointIncrement = getPointIncrement(totalGroundPoints)
      if (atkTotalDmg > defTotalDmg) {
        activeRound.attackerPoints += pointIncrement
      } else if (defTotalDmg > atkTotalDmg) {
        activeRound.defenderPoints += pointIncrement
      }
      let newRounds = [...battle.rounds.slice(0, -1), activeRound]

      // --- Victory conditions ---
      const atkAlive = battle.attacker.divisionIds.filter(id => { const d = updatedArmyStore.divisions[id]; return d && d.status !== 'destroyed' && d.status !== 'retreating' }).length
      const defAlive = battle.defender.divisionIds.filter(id => { const d = updatedArmyStore.divisions[id]; return d && d.status !== 'destroyed' && d.status !== 'retreating' }).length

      let newStatus: 'active' | 'attacker_won' | 'defender_won' = battle.status
      let atkRoundsWon = battle.attackerRoundsWon
      let defRoundsWon = battle.defenderRoundsWon

      if (defAlive === 0 && atkAlive > 0 && battle.defender.divisionIds.length > 0) {
        newStatus = 'attacker_won'
        newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'attacker', message: `⚔️ VICTORY! ${getCountryName(battle.attackerId)} captures ${battle.regionName}!` })
      } else if (atkAlive === 0 && defAlive > 0 && battle.attacker.divisionIds.length > 0) {
        newStatus = 'defender_won'
        newCombatLog.push({ tick, timestamp: now, type: 'phase_change', side: 'defender', message: `🛡️ DEFENSE HOLDS! ${getCountryName(battle.defenderId)} defends ${battle.regionName}!` })
      } else if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND || activeRound.defenderPoints >= POINTS_TO_WIN_ROUND) {
        if (activeRound.attackerPoints >= POINTS_TO_WIN_ROUND) { atkRoundsWon++; activeRound.status = 'attacker_won' }
        else { defRoundsWon++; activeRound.status = 'defender_won' }
        if (atkRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'attacker_won'
          const world = useWorldStore.getState()
          if (battle.type === 'invasion') world.occupyCountry(battle.defenderId, battle.attackerId, false)
        } else if (defRoundsWon >= ROUNDS_TO_WIN_BATTLE) {
          newStatus = 'defender_won'
        } else {
          newRounds = [...newRounds, { attackerPoints: 0, defenderPoints: 0, status: 'active' }]
        }
      }

      // --- Update battle state ---
      newBattles[battle.id] = {
        ...battle,
        ticksElapsed: tick,
        status: newStatus,
        attackerRoundsWon: atkRoundsWon,
        defenderRoundsWon: defRoundsWon,
        rounds: newRounds,
        currentTick: {
          attackerDamage: atkTotalDmg,
          defenderDamage: defTotalDmg,
        },
        attacker: {
          ...battle.attacker,
          damageDealt: (battle.attacker.damageDealt || 0) + atkTotalDmg,
          manpowerLost: (battle.attacker.manpowerLost || 0) + manpowerDmgToAttacker,
          divisionsDestroyed: (battle.attacker.divisionsDestroyed || 0) + atkDestroyed,
          divisionsRetreated: (battle.attacker.divisionsRetreated || 0) + atkRetreated,
        },
        defender: {
          ...battle.defender,
          damageDealt: (battle.defender.damageDealt || 0) + defTotalDmg,
          manpowerLost: (battle.defender.manpowerLost || 0) + manpowerDmgToDefender,
          divisionsDestroyed: (battle.defender.divisionsDestroyed || 0) + defDestroyed,
          divisionsRetreated: (battle.defender.divisionsRetreated || 0) + defRetreated,
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
      return d && (d.status === 'ready' || d.status === 'training') && d.manpower > 0
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
}))
