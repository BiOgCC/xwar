import { create } from 'zustand'
import { useBattleStore } from './battleStore'
import type { BattleType } from './battleStore'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useGovernmentStore } from './governmentStore'

// ====== TYPES ======

export type MilitaryPillar = 'ground' | 'air' | 'naval' | 'special'

export type MilitaryOperationId =
  | 'assault' | 'invasion' | 'occupation'
  | 'air_strike' | 'naval_strike'
  | 'sabotage'

export type MilTargetType = 'adjacent_country' | 'any_coastal' | 'any_airport'

export interface MilitaryOperationDef {
  id: MilitaryOperationId
  pillar: MilitaryPillar
  battleType: BattleType
  name: string
  description: string
  icon: string
  cost: { energy: number; oil: number; materialX: number; bitcoin: number }
  targetType: MilTargetType
  requiresItem?: 'warship' | 'jet'
  requiresInfra?: 'port' | 'airport'
  successChance: number
  effectDescription: string
}

export interface MilitaryCampaign {
  id: string
  operationId: MilitaryOperationId
  initiator: string
  originCountry: string
  targetCountry: string
  playersJoined: string[]
  invitedPlayers: string[]
  status: 'recruiting' | 'launched' | 'completed' | 'failed'
  createdAt: number
  launchedAt: number | null
  battleId: string | null
}

export interface MilitaryReportData {
  // Battle summary
  battleDurationMs: number
  roundsPlayed: number
  attackerRoundsWon: number
  defenderRoundsWon: number

  // Damage stats
  totalAttackerDamage: number
  totalDefenderDamage: number
  avgDamagePerHit: number
  topAttackers: { name: string; damage: number }[]
  topDefenders: { name: string; damage: number }[]

  // Participants
  attackerCount: number
  defenderCount: number

  // Rewards / Effects (depend on operation type)
  moneyStolen: number
  oilStolen: number
  materialXStolen: number
  bitcoinStolen: number
  regionConquered: boolean
  regionName: string
  infrastructureDamaged: { type: string; previousLevel: number; newLevel: number }[]
  companiesDisabled: number

  // Infrastructure bonuses applied
  militaryBaseBonusApplied: boolean
  bunkerBonusDamage: number // extra % from air/naval vs bunkers
}

export interface MilitaryReport {
  id: string
  campaignId: string
  operationId: MilitaryOperationId
  operationName: string
  originCountry: string
  targetCountry: string
  result: 'victory' | 'defeat'
  participants: string[]
  data: MilitaryReportData
  timestamp: number
}

// ====== OPERATION DEFINITIONS ======

export const MILITARY_OPERATIONS: MilitaryOperationDef[] = [
  // GROUND
  {
    id: 'assault', pillar: 'ground', battleType: 'assault',
    name: 'Assault', icon: '⚔️',
    description: 'Hit-and-run. Steal 10% of enemy national fund.',
    cost: { energy: 500, oil: 1000, materialX: 500, bitcoin: 0 },
    targetType: 'adjacent_country', successChance: 70,
    effectDescription: 'Win → steal 10% of national fund. No occupation.',
  },
  {
    id: 'invasion', pillar: 'ground', battleType: 'invasion',
    name: 'Invasion', icon: '🚩',
    description: 'Full conquest. Annex the region and claim 100% taxes.',
    cost: { energy: 1000, oil: 2000, materialX: 1000, bitcoin: 1 },
    targetType: 'adjacent_country', successChance: 60,
    effectDescription: 'Win → conquer region, gain 100% tax benefit.',
  },
  {
    id: 'occupation', pillar: 'ground', battleType: 'occupation',
    name: 'Occupation', icon: '🛡️',
    description: 'Silent takeover. Occupy without tax benefit.',
    cost: { energy: 800, oil: 1500, materialX: 800, bitcoin: 0 },
    targetType: 'adjacent_country', successChance: 65,
    effectDescription: 'Win → occupy region (no taxes), infrastructure targeting enabled.',
  },

  // AIR
  {
    id: 'air_strike', pillar: 'air', battleType: 'naval_strike', // reuses ns battle logic
    name: 'Air Strike', icon: '✈️',
    description: 'Strike any region with an airport. Requires a Jet.',
    cost: { energy: 1500, oil: 3000, materialX: 2000, bitcoin: 2 },
    targetType: 'any_airport', requiresItem: 'jet', requiresInfra: 'airport',
    successChance: 75,
    effectDescription: 'Win → deals +5-20% bonus vs. bunkers. Non-adjacent reach.',
  },

  // NAVAL
  {
    id: 'naval_strike', pillar: 'naval', battleType: 'naval_strike',
    name: 'Naval Strike', icon: '⛴️',
    description: 'Hit non-adjacent coastal regions. Requires a Warship.',
    cost: { energy: 1500, oil: 3000, materialX: 2000, bitcoin: 2 },
    targetType: 'any_coastal', requiresItem: 'warship', requiresInfra: 'port',
    successChance: 75,
    effectDescription: 'Win → deals +5-20% bonus vs. bunkers. Non-adjacent reach.',
  },

  // SPECIAL
  {
    id: 'sabotage', pillar: 'special', battleType: 'sabotage',
    name: 'Sabotage', icon: '🔥',
    description: 'Destroy infrastructure. No occupation.',
    cost: { energy: 600, oil: 800, materialX: 400, bitcoin: 0 },
    targetType: 'adjacent_country', successChance: 80,
    effectDescription: 'Win → open sub-battles against bunkers/companies.',
  },
]

export function getOperationsByPillar(pillar: MilitaryPillar): MilitaryOperationDef[] {
  return MILITARY_OPERATIONS.filter(op => op.pillar === pillar)
}

// ====== STORE ======

export interface MilitaryState {
  campaigns: Record<string, MilitaryCampaign>
  reports: Record<string, MilitaryReport>

  launchCampaign: (opId: MilitaryOperationId, targetCountry: string, invitedPlayers: string[]) => { success: boolean; message: string; campaignId?: string }
  invitePlayer: (campaignId: string, playerName: string) => void
  joinCampaign: (campaignId: string, playerName: string) => void
  deployCampaign: (campaignId: string) => void
  addReport: (report: Omit<MilitaryReport, 'id' | 'timestamp'>) => void
}

export const useMilitaryStore = create<MilitaryState>((set, get) => ({
  campaigns: {},
  reports: {},

  launchCampaign: (opId, targetCountry, invitedPlayers) => {
    const opDef = MILITARY_OPERATIONS.find(o => o.id === opId)
    if (!opDef) return { success: false, message: 'Unknown operation.' }

    const player = usePlayerStore.getState()
    const iso = player.countryCode || 'US'

    // Cost check
    if (player.stamina < opDef.cost.energy) return { success: false, message: 'Not enough energy.' }
    if (player.oil < opDef.cost.oil) return { success: false, message: 'Not enough oil.' }
    if (player.materialX < opDef.cost.materialX) return { success: false, message: 'Not enough Material X.' }
    if (player.bitcoin < opDef.cost.bitcoin) return { success: false, message: 'Not enough Bitcoin.' }

    // Deduct costs
    player.spendOil(opDef.cost.oil)
    player.spendMaterialX(opDef.cost.materialX)
    if (opDef.cost.bitcoin > 0) player.spendBitcoin(opDef.cost.bitcoin)

    const id = `mil_${Date.now()}_${player.name}`
    const campaign: MilitaryCampaign = {
      id,
      operationId: opId,
      initiator: player.name,
      originCountry: iso,
      targetCountry,
      playersJoined: [player.name],
      invitedPlayers,
      status: opDef.requiresItem ? 'recruiting' : 'launched',
      createdAt: Date.now(),
      launchedAt: opDef.requiresItem ? null : Date.now(),
      battleId: null,
    }

    // If no lobby needed, immediately trigger the battle
    if (!opDef.requiresItem) {
      const battleStore = useBattleStore.getState()
      battleStore.launchAttack(iso, targetCountry, targetCountry, opDef.battleType)
      const battles = useBattleStore.getState().battles
      const battle = Object.values(battles).find(b => b.status === 'active' && b.regionName === targetCountry)
      if (battle) campaign.battleId = battle.id
      campaign.status = 'launched'
      campaign.launchedAt = Date.now()
    }

    set(state => ({ campaigns: { ...state.campaigns, [id]: campaign } }))
    return {
      success: true,
      message: opDef.requiresItem ? 'Mission created! Recruit your crew.' : `${opDef.name} launched!`,
      campaignId: id,
    }
  },

  invitePlayer: (campaignId, playerName) => set(state => {
    const c = state.campaigns[campaignId]
    if (!c || c.status !== 'recruiting') return state
    if (c.invitedPlayers.includes(playerName)) return state
    return { campaigns: { ...state.campaigns, [campaignId]: { ...c, invitedPlayers: [...c.invitedPlayers, playerName] } } }
  }),

  joinCampaign: (campaignId, playerName) => set(state => {
    const c = state.campaigns[campaignId]
    if (!c || c.status !== 'recruiting' || c.playersJoined.length >= 6) return state
    if (c.playersJoined.includes(playerName)) return state
    return { campaigns: { ...state.campaigns, [campaignId]: { ...c, playersJoined: [...c.playersJoined, playerName] } } }
  }),

  deployCampaign: (campaignId) => set(state => {
    const c = state.campaigns[campaignId]
    if (!c || c.status !== 'recruiting') return state

    const opDef = MILITARY_OPERATIONS.find(o => o.id === c.operationId)
    if (!opDef) return state

    const battleStore = useBattleStore.getState()
    battleStore.launchAttack(c.originCountry, c.targetCountry, c.targetCountry, opDef.battleType)
    const battles = useBattleStore.getState().battles
    const battle = Object.values(battles).find(b => b.status === 'active' && b.regionName === c.targetCountry)

    return {
      campaigns: {
        ...state.campaigns,
        [campaignId]: {
          ...c,
          status: 'launched',
          launchedAt: Date.now(),
          battleId: battle?.id || null,
        },
      },
    }
  }),

  addReport: (report: Omit<MilitaryReport, 'id' | 'timestamp'>) => set(state => {
    const id = `milrep_${Date.now()}`
    return { reports: { ...state.reports, [id]: { ...report, id, timestamp: Date.now() } } }
  }),
}))

// ====== REPORT GENERATOR ======

export function generateMilitaryReport(campaignId: string): MilitaryReport | null {
  const mil = useMilitaryStore.getState()
  const campaign = mil.campaigns[campaignId]
  if (!campaign) return null

  const opDef = MILITARY_OPERATIONS.find(o => o.id === campaign.operationId)
  if (!opDef) return null

  const battleStore = useBattleStore.getState()
  const battle = campaign.battleId ? battleStore.battles[campaign.battleId] : null

  const world = useWorldStore.getState()
  const govStore = useGovernmentStore.getState()
  const targetCountry = world.countries.find(c => c.code === campaign.targetCountry)

  // Compute battle stats
  const totalAttackerDamage = battle ? Object.values(battle.attackerDamageDealers).reduce((s, v) => s + v, 0) : 0
  const totalDefenderDamage = battle ? Object.values(battle.defenderDamageDealers).reduce((s, v) => s + v, 0) : 0
  const attackerCount = battle ? Object.keys(battle.attackerDamageDealers).length : campaign.playersJoined.length
  const defenderCount = battle ? Object.keys(battle.defenderDamageDealers).length : 0
  const totalHits = attackerCount + defenderCount || 1

  const topAttackers = battle
    ? Object.entries(battle.attackerDamageDealers)
        .map(([name, damage]) => ({ name, damage }))
        .sort((a, b) => b.damage - a.damage)
        .slice(0, 5)
    : []

  const topDefenders = battle
    ? Object.entries(battle.defenderDamageDealers)
        .map(([name, damage]) => ({ name, damage }))
        .sort((a, b) => b.damage - a.damage)
        .slice(0, 5)
    : []

  const isVictory = battle ? battle.status === 'attacker_won' : false
  const result: 'victory' | 'defeat' = isVictory ? 'victory' : 'defeat'

  // Calculate stolen resources (assault = 10% of national fund)
  let moneyStolen = 0, oilStolen = 0, materialXStolen = 0, bitcoinStolen = 0
  if (isVictory && campaign.operationId === 'assault' && campaign.targetCountry) {
    const targetGov = govStore.governments[campaign.targetCountry]
    if (targetGov) {
      moneyStolen = Math.floor((targetGov.nationalFund.money || 0) * 0.1)
      oilStolen = Math.floor((targetGov.nationalFund.oil || 0) * 0.1)
      materialXStolen = Math.floor((targetGov.nationalFund.materialX || 0) * 0.1)
      bitcoinStolen = Math.floor((targetGov.nationalFund.bitcoin || 0) * 0.1)
    }
  }

  // Infrastructure damage (sabotage downgrades random infra)
  const infrastructureDamaged: { type: string; previousLevel: number; newLevel: number }[] = []
  let companiesDisabled = 0
  if (isVictory && campaign.operationId === 'sabotage' && targetCountry) {
    const infraTypes = ['portLevel', 'airportLevel', 'bunkerLevel', 'militaryBaseLevel'] as const
    const pick = infraTypes[Math.floor(Math.random() * infraTypes.length)]
    const prev = targetCountry[pick]
    if (prev > 1) {
      infrastructureDamaged.push({ type: pick.replace('Level', ''), previousLevel: prev, newLevel: prev - 1 })
      // Actually downgrade it
      useWorldStore.setState(s => ({
        countries: s.countries.map(c => c.code === campaign.targetCountry ? { ...c, [pick]: Math.max(1, c[pick] - 1) } : c)
      }))
    }
    companiesDisabled = Math.floor(Math.random() * 3) + 1
  }

  // Region conquered
  const regionConquered = isVictory && (campaign.operationId === 'invasion' || campaign.operationId === 'occupation' || campaign.operationId === 'naval_strike' || campaign.operationId === 'air_strike')

  // Military base bonus
  const originCountry = world.countries.find(c => c.code === campaign.originCountry)
  const militaryBaseBonusApplied = (originCountry?.militaryBaseLevel || 0) > 0
  const bunkerBonusDamage = (campaign.operationId === 'air_strike' || campaign.operationId === 'naval_strike') ? (5 + Math.floor(Math.random() * 16)) : 0

  const data: MilitaryReportData = {
    battleDurationMs: battle ? (Date.now() - battle.startedAt) : 0,
    roundsPlayed: battle ? battle.rounds.length : 0,
    attackerRoundsWon: battle?.attackerRoundsWon || 0,
    defenderRoundsWon: battle?.defenderRoundsWon || 0,
    totalAttackerDamage,
    totalDefenderDamage,
    avgDamagePerHit: Math.round((totalAttackerDamage + totalDefenderDamage) / totalHits),
    topAttackers,
    topDefenders,
    attackerCount,
    defenderCount,
    moneyStolen,
    oilStolen,
    materialXStolen,
    bitcoinStolen,
    regionConquered,
    regionName: targetCountry?.name || campaign.targetCountry,
    infrastructureDamaged,
    companiesDisabled,
    militaryBaseBonusApplied,
    bunkerBonusDamage,
  }

  const report: MilitaryReport = {
    id: `milrep_${Date.now()}`,
    campaignId,
    operationId: campaign.operationId,
    operationName: opDef.name,
    originCountry: campaign.originCountry,
    targetCountry: campaign.targetCountry,
    result,
    participants: campaign.playersJoined,
    data,
    timestamp: Date.now(),
  }

  return report
}
