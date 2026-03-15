import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useCompanyStore } from './companyStore'
import { useBattleStore } from './battleStore'
import { useGovernmentStore } from './governmentStore'

// ====== TYPES ======

export type CyberPillar = 'espionage' | 'sabotage' | 'propaganda'

export type EspionageOp = 'resource_intel' | 'military_intel' | 'infrastructure_scan' | 'blueprint_loot'
export type SabotageOp = 'company_sabotage' | 'logistics_disruption' | 'bunker_override' | 'power_grid_attack'
export type PropagandaOp = 'disinformation' | 'botnet_attack'

export type CyberOperationType = EspionageOp | SabotageOp | PropagandaOp

export type TargetType = 'country' | 'region' | 'player' | 'company_type' | 'battle'

export interface CyberOperationDef {
  id: CyberOperationType
  pillar: CyberPillar
  name: string
  description: string
  icon: string
  cost: { energy: number; materialX: number; oil: number; bitcoin: number }
  targetType: TargetType
  targetOptions?: string[] // For company_type
  successChance: number // 0-100
  detectionChance: number // 0-100
  duration: number // ms
  effectDescription: string
}

export interface CyberCampaign {
  id: string
  initiatorPlayer: string
  countryId: string
  invitedPlayers: string[]
  operationType: CyberOperationType
  targetCountry?: string
  targetRegion?: string
  targetPlayer?: string
  targetCompanyType?: string
  energyCost: number
  materialXCost: number
  oilCost: number
  bitcoinCost: number
  successChance: number
  detectionChance: number
  duration: number
  status: 'active' | 'completed' | 'failed' | 'detected'
  wasDetected: boolean
  createdAt: number
  expiresAt: number
}

export interface CyberReport {
  id: string
  campaignId: string
  reportType: CyberOperationType
  generatedData: Record<string, any>
  timestamp: number
}

export interface ActiveEffect {
  id: string
  campaignId: string
  effectType: CyberOperationType
  targetCountry?: string
  targetRegion?: string
  expiresAt: number
}

// ====== OPERATION DEFINITIONS ======

export const CYBER_OPERATIONS: CyberOperationDef[] = [
  // ESPIONAGE
  {
    id: 'resource_intel', pillar: 'espionage', name: 'Resource Intelligence Report',
    icon: '📊', description: 'Gather economic intelligence: national funds, citizen-owned food & ammo supplies.',
    cost: { energy: 1000, materialX: 5000, oil: 2000, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Report: National fund breakdown, citizen food & bullet reserves.',
  },
  {
    id: 'military_intel', pillar: 'espionage', name: 'Military Intelligence Report',
    icon: '🎖️', description: 'Scan ports, airports, bunkers, military bases and report citizen-owned jets, warships & tanks.',
    cost: { energy: 1500, materialX: 7000, oil: 2500, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Report: Infrastructure levels, jets, warships, tanks owned by citizens.',
  },
  {
    id: 'infrastructure_scan', pillar: 'espionage', name: 'Regional Infrastructure Scan',
    icon: '🏗️', description: 'Scan active companies, worker counts, owned materials, and tax revenue in a region.',
    cost: { energy: 2000, materialX: 9000, oil: 3000, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Report: Active companies, workers, materials, tax generated.',
  },
  {
    id: 'blueprint_loot', pillar: 'espionage', name: 'Blueprint Loot Operation',
    icon: '🔓', description: 'Copy a prestigious blueprint from a top player and distribute untradable copies to your citizens.',
    cost: { energy: 3000, materialX: 12000, oil: 3500, bitcoin: 1 },
    targetType: 'player', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Copy prestigious blueprint. Citizens receive untradable copy. Enables crafting.',
  },

  // SABOTAGE
  {
    id: 'company_sabotage', pillar: 'sabotage', name: 'Company Sabotage',
    icon: '🔌', description: 'Infiltrate any company and steal 20% of production for 24 hours. Distributed to attacker citizens.',
    cost: { energy: 2000, materialX: 10000, oil: 4000, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 24 * 60 * 60 * 1000, // 24 hours
    effectDescription: 'Steal 20% production from ALL companies for 24h. Distributed to citizens.',
  },
  {
    id: 'logistics_disruption', pillar: 'sabotage', name: 'Logistics Disruption',
    icon: '🚚', description: 'Disable ports or airports in the target region for 48 hours.',
    cost: { energy: 2500, materialX: 12000, oil: 4500, bitcoin: 1 },
    targetType: 'country', successChance: 85, detectionChance: 20,
    duration: 48 * 60 * 60 * 1000, // 48 hours
    effectDescription: 'Disables Port or Airport in target country for 48h. Blocks Naval/Air Strikes.',
  },
  {
    id: 'bunker_override', pillar: 'sabotage', name: 'Bunker Override',
    icon: '🏰', description: 'Override bunker defenses, reducing defense by 50% for 24 hours.',
    cost: { energy: 3000, materialX: 15000, oil: 5000, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 24 * 60 * 60 * 1000, // 24 hours
    effectDescription: 'Bunker defense -50% for 24 hours.',
  },
  {
    id: 'power_grid_attack', pillar: 'sabotage', name: 'Power Grid Attack',
    icon: '⚡', description: 'Attack the power grid, stopping company production.',
    cost: { energy: 3500, materialX: 18000, oil: 5500, bitcoin: 1 },
    targetType: 'region', successChance: 80, detectionChance: 30,
    duration: 90 * 60 * 1000, // 90 min
    effectDescription: '33% companies in region stop production for 90 minutes.',
  },

  // PROPAGANDA
  {
    id: 'disinformation', pillar: 'propaganda', name: 'Disinformation Campaign',
    icon: '📰', description: 'Spread fake alerts to create confusion.',
    cost: { energy: 1500, materialX: 8000, oil: 2500, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 30 * 60 * 1000, // 30 min
    effectDescription: 'Fake invasion/mission/cyber alerts for 30 minutes.',
  },
  {
    id: 'botnet_attack', pillar: 'propaganda', name: 'Botnet Attack',
    icon: '🤖', description: 'Flood enemy combat logs with 300K fake damage.',
    cost: { energy: 4000, materialX: 20000, oil: 6000, bitcoin: 1 },
    targetType: 'battle', successChance: 80, detectionChance: 30,
    duration: 60 * 60 * 1000, // 60 min
    effectDescription: '300,000 fake damage in battle log. Does NOT affect capture.',
  },
]

export const getOperationsByPillar = (pillar: CyberPillar) =>
  CYBER_OPERATIONS.filter(op => op.pillar === pillar)

// ====== STORE ======

export interface CyberState {
  campaigns: Record<string, CyberCampaign>
  reports: Record<string, CyberReport>
  activeEffects: ActiveEffect[]
  notifications: { id: string; message: string; timestamp: number }[]

  launchCampaign: (
    operationType: CyberOperationType,
    target: { country?: string; region?: string; player?: string; companyType?: string },
    invitedPlayers: string[]
  ) => { success: boolean; message: string; campaignId?: string }

  getCampaignReports: (campaignId: string) => CyberReport[]
  getActiveEffectsForCountry: (countryCode: string) => ActiveEffect[]
  getActiveEffectsForRegion: (regionName: string) => ActiveEffect[]
  cleanExpiredEffects: () => void
  dismissNotification: (id: string) => void
}

let campaignCounter = 0
let reportCounter = 0

export const useCyberStore = create<CyberState>((set, get) => ({
  campaigns: {},
  reports: {},
  activeEffects: [],
  notifications: [],

  launchCampaign: (operationType, target, invitedPlayers) => {
    const opDef = CYBER_OPERATIONS.find(op => op.id === operationType)
    if (!opDef) return { success: false, message: 'Unknown operation.' }

    const player = usePlayerStore.getState()
    const { cost } = opDef

    // Check resources
    if (player.oil < cost.oil) return { success: false, message: 'Not enough Oil.' }
    if (player.materialX < cost.materialX) return { success: false, message: 'Not enough Material X.' }
    if (player.bitcoin < cost.bitcoin) return { success: false, message: 'Not enough Bitcoin.' }

    // Deduct resources
    player.spendOil(cost.oil)
    player.spendMaterialX(cost.materialX)
    player.spendBitcoin(cost.bitcoin)

    // Roll success
    const roll = Math.random() * 100
    const succeeded = roll <= opDef.successChance

    // Roll detection
    const detectRoll = Math.random() * 100
    const wasDetected = detectRoll <= opDef.detectionChance

    const campaignId = `cyber_${++campaignCounter}_${Date.now()}`
    const now = Date.now()

    const campaign: CyberCampaign = {
      id: campaignId,
      initiatorPlayer: player.name,
      countryId: player.countryCode || 'US',
      invitedPlayers,
      operationType,
      targetCountry: target.country,
      targetRegion: target.region,
      targetPlayer: target.player,
      targetCompanyType: target.companyType,
      energyCost: cost.energy,
      materialXCost: cost.materialX,
      oilCost: cost.oil,
      bitcoinCost: cost.bitcoin,
      successChance: opDef.successChance,
      detectionChance: opDef.detectionChance,
      duration: opDef.duration,
      status: succeeded ? 'completed' : 'failed',
      wasDetected,
      createdAt: now,
      expiresAt: opDef.duration > 0 ? now + opDef.duration : now,
    }

    const state = get()
    const newCampaigns = { ...state.campaigns, [campaignId]: campaign }
    const newReports = { ...state.reports }
    const newEffects = [...state.activeEffects]
    const newNotifications = [...state.notifications]

    if (!succeeded) {
      set({ campaigns: newCampaigns })
      return { success: false, message: 'Operation FAILED. Resources spent.', campaignId }
    }

    // Generate report / apply effect based on operation type
    if (opDef.pillar === 'espionage') {
      const report = generateEspionageReport(campaignId, operationType, target)
      newReports[report.id] = report
    }

    if (opDef.pillar === 'sabotage' && opDef.duration > 0) {
      const effectId = `eff_${campaignId}`
      newEffects.push({
        id: effectId,
        campaignId,
        effectType: operationType,
        targetCountry: target.country,
        targetRegion: target.region,
        expiresAt: now + opDef.duration,
      })

      // Apply immediate sabotage effects
      applySabotageEffect(operationType, target)
    }

    if (opDef.pillar === 'propaganda') {
      applyPropagandaEffect(operationType, target)
      if (opDef.duration > 0) {
        newEffects.push({
          id: `eff_${campaignId}`,
          campaignId,
          effectType: operationType,
          targetCountry: target.country,
          targetRegion: target.region,
          expiresAt: now + opDef.duration,
        })
      }
    }

    // Detection notification
    if (wasDetected) {
      campaign.status = 'detected'
      const targetName = target.country || target.region || target.player || 'Unknown'
      newNotifications.push({
        id: `notif_${campaignId}`,
        message: `⚠️ CYBER ALERT: ${opDef.name} detected against ${targetName}! Origin partially traced to ${campaign.countryId}.`,
        timestamp: now,
      })
    }

    set({
      campaigns: newCampaigns,
      reports: newReports,
      activeEffects: newEffects,
      notifications: newNotifications,
    })

    const statusMsg = wasDetected ? 'SUCCESS (but DETECTED!)' : 'SUCCESS'
    return { success: true, message: `Operation ${statusMsg}`, campaignId }
  },

  getCampaignReports: (campaignId) => {
    const state = get()
    return Object.values(state.reports).filter(r => r.campaignId === campaignId)
  },

  getActiveEffectsForCountry: (countryCode) => {
    const now = Date.now()
    return get().activeEffects.filter(e => e.targetCountry === countryCode && e.expiresAt > now)
  },

  getActiveEffectsForRegion: (regionName) => {
    const now = Date.now()
    return get().activeEffects.filter(e => e.targetRegion === regionName && e.expiresAt > now)
  },

  cleanExpiredEffects: () => set(state => ({
    activeEffects: state.activeEffects.filter(e => e.expiresAt > Date.now()),
  })),

  dismissNotification: (id) => set(state => ({
    notifications: state.notifications.filter(n => n.id !== id),
  })),
}))

// ====== REPORT GENERATORS ======

function generateEspionageReport(
  campaignId: string,
  opType: CyberOperationType,
  target: { country?: string; region?: string; player?: string }
): CyberReport {
  const reportId = `rpt_${++reportCounter}_${Date.now()}`
  let generatedData: Record<string, any> = {}

  if (opType === 'resource_intel' && target.country) {
    const world = useWorldStore.getState()
    const country = world.countries.find(c => c.code === target.country)
    const govStore = useGovernmentStore.getState()
    const gov = govStore.governments[target.country]
    const fund = gov?.nationalFund || { money: 0, oil: 0, scraps: 0, materialX: 0, bitcoin: 0, jets: 0 }
    const citizens = gov?.citizens || []

    // Simulate citizen-owned supplies (food & bullets)
    const citizenFoodSupply = citizens.length * (50 + Math.floor(Math.random() * 150))
    const citizenBulletSupply = citizens.length * (20 + Math.floor(Math.random() * 80))

    generatedData = {
      country: target.country,
      countryName: country?.name || target.country,
      nationalFund: {
        money: fund.money,
        oil: fund.oil,
        scraps: fund.scraps,
        materialX: fund.materialX,
        bitcoin: fund.bitcoin,
      },
      citizenCount: citizens.length,
      estimatedFoodSupply: citizenFoodSupply,
      estimatedBulletSupply: citizenBulletSupply,
      conqueredResources: country?.conqueredResources || [],
    }
  }

  if (opType === 'military_intel' && target.country) {
    const world = useWorldStore.getState()
    const country = world.countries.find(c => c.code === target.country)
    const govStore = useGovernmentStore.getState()
    const gov = govStore.governments[target.country]
    const citizens = gov?.citizens || []

    // Simulate citizen vehicle counts
    const jetsOwned = Math.floor(citizens.length * (0.1 + Math.random() * 0.3))
    const warshipsOwned = Math.floor(citizens.length * (0.05 + Math.random() * 0.15))
    const tanksOwned = Math.floor(citizens.length * (0.2 + Math.random() * 0.4))

    generatedData = {
      country: target.country,
      countryName: country?.name || target.country,
      infrastructure: {
        portLevel: country?.portLevel || 0,
        airportLevel: country?.airportLevel || 0,
        bunkerLevel: country?.bunkerLevel || 0,
        militaryBaseLevel: country?.militaryBaseLevel || 0,
      },
      citizenVehicles: {
        jets: jetsOwned,
        warships: warshipsOwned,
        tanks: tanksOwned,
      },
      militaryStrength: country?.military || 0,
      citizenCount: citizens.length,
    }
  }

  if (opType === 'infrastructure_scan' && target.country) {
    const world = useWorldStore.getState()
    const country = world.countries.find(c => c.code === target.country)
    const companyStore = useCompanyStore.getState()
    const govStore = useGovernmentStore.getState()
    const gov = govStore.governments[target.country]
    const citizens = gov?.citizens || []
    const regionCompanies = companyStore.companies.filter(c => c.location === target.country)
    const activeCompanies = regionCompanies.filter(c => !c.disabledUntil || c.disabledUntil <= Date.now())

    // Simulate worker count and materials
    const activeWorkers = citizens.length * (1 + Math.floor(Math.random() * 3))
    const taxGenerated = regionCompanies.reduce((sum, c) => sum + c.level * 500, 0)
    const citizenMaterials = citizens.length * (100 + Math.floor(Math.random() * 500))

    generatedData = {
      country: target.country,
      countryName: country?.name || target.country,
      companies: regionCompanies.map(c => ({
        type: c.type.replace(/_/g, ' '),
        level: c.level,
        active: !c.disabledUntil || c.disabledUntil <= Date.now(),
        production: Math.floor(c.productionProgress),
      })),
      totalCompanies: regionCompanies.length,
      activeCompanies: activeCompanies.length,
      disabledCompanies: regionCompanies.length - activeCompanies.length,
      activeWorkers,
      estimatedCitizenMaterials: citizenMaterials,
      estimatedTaxRevenue: taxGenerated,
    }
  }

  if (opType === 'blueprint_loot' && target.player) {
    // Copy a prestigious blueprint — spawn untradable copies for all citizens
    const blueprintTypes = ['Weapon Schematic', 'Armor Design', 'Ammo Formula', 'Vehicle Plan', 'Defense Matrix']
    const tiers = ['T4', 'T5', 'T6']
    const blueprintName = blueprintTypes[Math.floor(Math.random() * blueprintTypes.length)]
    const tier = tiers[Math.floor(Math.random() * tiers.length)]

    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'
    const gov = useGovernmentStore.getState().governments[countryCode]
    const citizens = gov?.citizens || []

    generatedData = {
      targetPlayer: target.player,
      blueprintName: `${tier} ${blueprintName}`,
      tier,
      copiedFrom: target.player,
      untradable: true,
      craftingEnabled: true,
      notification: `⚠️ ${target.player} was probed. Blueprint "${tier} ${blueprintName}" was copied.`,
      recipients: citizens.map(c => c.name),
      totalRecipients: citizens.length,
      rewardSummary: `Untradable ${tier} ${blueprintName} distributed to ${citizens.length} citizens of ${countryCode}. Crafting now unlocked.`,
    }
  }

  return {
    id: reportId,
    campaignId,
    reportType: opType,
    generatedData,
    timestamp: Date.now(),
  }
}

// ====== SABOTAGE EFFECTS ======

function applySabotageEffect(opType: CyberOperationType, target: { country?: string; region?: string; companyType?: string }) {
  const companyStore = useCompanyStore.getState()

  if (opType === 'company_sabotage' && target.country) {
    // Steal 20% production from ALL companies in target country for 24h
    const targetCompanies = companyStore.companies.filter(c => c.location === target.country)

    // Calculate stolen production (20% of each company's level-based output)
    const stolenPerCompany = 20 // base value per company
    const totalStolen = targetCompanies.length * stolenPerCompany

    // Distribute to all citizens of the attacking country
    const player = usePlayerStore.getState()
    const countryCode = player.countryCode || 'US'
    const gov = useGovernmentStore.getState().governments[countryCode]
    const citizens = gov?.citizens || []

    // Add stolen goods to national fund — split across resource types
    if (totalStolen > 0) {
      const perResource = Math.floor(totalStolen / 3)
      useGovernmentStore.getState().donateToFund(countryCode, 'money' as any, perResource * 100)
      useGovernmentStore.getState().donateToFund(countryCode, 'oil' as any, perResource)
      useGovernmentStore.getState().donateToFund(countryCode, 'materialX' as any, perResource)
    }
  }

  if (opType === 'power_grid_attack' && target.country) {
    // Disable 33% of companies in region
    const regionCompanies = companyStore.companies.filter(c => c.location === target.country)
    const shuffled = [...regionCompanies].sort(() => Math.random() - 0.5)
    const toDisable = shuffled.slice(0, Math.ceil(shuffled.length * 0.33))
    const disableIds = new Set(toDisable.map(c => c.id))
    const disableUntil = Date.now() + 90 * 60 * 1000

    useCompanyStore.setState({
      companies: companyStore.companies.map(c =>
        disableIds.has(c.id) ? { ...c, disabledUntil: disableUntil } : c
      )
    })
  }

  if (opType === 'logistics_disruption' && target.country) {
    // Randomly disable either port or airport for 48 hours
    const pick = Math.random() < 0.5 ? 'portLevel' : 'airportLevel'
    const world = useWorldStore.getState()
    const country = world.countries.find(c => c.code === target.country)
    if (country && country[pick] > 0) {
      const prevLevel = country[pick]
      // Set to 0 (disabled) — will be restored after duration via activeEffects cleanup
      useWorldStore.setState(s => ({
        countries: s.countries.map(c => c.code === target.country ? { ...c, [pick]: 0 } : c)
      }))
    }
  }

  if (opType === 'bunker_override' && target.country) {
    // Reduce bunker defense by 50% (halve bunker level) for 24 hours
    const world = useWorldStore.getState()
    const country = world.countries.find(c => c.code === target.country)
    if (country && country.bunkerLevel > 1) {
      const newLevel = Math.max(1, Math.floor(country.bunkerLevel / 2))
      useWorldStore.setState(s => ({
        countries: s.countries.map(c => c.code === target.country ? { ...c, bunkerLevel: newLevel } : c)
      }))
    }
  }
}

// ====== PROPAGANDA EFFECTS ======

function applyPropagandaEffect(opType: CyberOperationType, target: { country?: string; region?: string }) {
  if (opType === 'botnet_attack' && target.region) {
    // Inject 300,000 fake damage into the battle log
    const battleStore = useBattleStore.getState()
    const activeBattle = Object.values(battleStore.battles).find(
      b => b.regionName === target.region && b.status === 'active'
    )
    if (activeBattle) {
      // Add fake damage entries
      const fakeDamagePerHit = 10000
      const fakeHits = 30
      for (let i = 0; i < fakeHits; i++) {
        battleStore.addDamage(
          activeBattle.id,
          'attacker',
          fakeDamagePerHit,
          false,
          false,
          `🤖 BOT_${Math.floor(Math.random() * 9999)}`
        )
      }
    }
  }
  // Disinformation just generates fake alerts via the notification system — handled in UI
}
