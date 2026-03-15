import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useCompanyStore } from './companyStore'
import { useBattleStore } from './battleStore'

// ====== TYPES ======

export type CyberPillar = 'espionage' | 'sabotage' | 'propaganda'

export type EspionageOp = 'resource_intel' | 'military_intel' | 'infrastructure_scan' | 'blueprint_loot'
export type SabotageOp = 'company_shutdown' | 'logistics_disruption' | 'bunker_override' | 'power_grid_attack'
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
    icon: '📊', description: 'Gather economic intelligence on a target country.',
    cost: { energy: 1000, materialX: 5000, oil: 2000, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Report: Total money, food, oil, material X reserves.',
  },
  {
    id: 'military_intel', pillar: 'espionage', name: 'Military Intelligence Report',
    icon: '🎖️', description: 'Scan military installations in a target region.',
    cost: { energy: 1500, materialX: 7000, oil: 2500, bitcoin: 1 },
    targetType: 'region', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Report: Bunker level, defense bonus, capture threshold.',
  },
  {
    id: 'infrastructure_scan', pillar: 'espionage', name: 'Regional Infrastructure Scan',
    icon: '🏗️', description: 'Map out companies and infrastructure in a region.',
    cost: { energy: 2000, materialX: 9000, oil: 3000, bitcoin: 1 },
    targetType: 'region', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Report: Companies, levels, production types, bonuses.',
  },
  {
    id: 'blueprint_loot', pillar: 'espionage', name: 'Blueprint Loot Operation',
    icon: '🔓', description: 'Copy a blueprint from a target player. Creates drama and rivalry.',
    cost: { energy: 3000, materialX: 12000, oil: 3500, bitcoin: 1 },
    targetType: 'player', successChance: 80, detectionChance: 30,
    duration: 0, effectDescription: 'Copy a blueprint from target. Target is notified.',
  },

  // SABOTAGE
  {
    id: 'company_shutdown', pillar: 'sabotage', name: 'Company Shutdown',
    icon: '🔌', description: 'Shut down specific company types in a target country.',
    cost: { energy: 2000, materialX: 10000, oil: 4000, bitcoin: 1 },
    targetType: 'company_type', targetOptions: ['farms', 'oil_rigs', 'material_mines'],
    successChance: 80, detectionChance: 30,
    duration: 2 * 60 * 60 * 1000, // 2 hours
    effectDescription: 'Production -70% for targeted company type for 2 hours.',
  },
  {
    id: 'logistics_disruption', pillar: 'sabotage', name: 'Logistics Disruption',
    icon: '🚚', description: 'Disrupt supply lines, increasing military costs.',
    cost: { energy: 2500, materialX: 12000, oil: 4500, bitcoin: 1 },
    targetType: 'country', successChance: 80, detectionChance: 30,
    duration: 1 * 60 * 60 * 1000, // 1 hour
    effectDescription: 'Food cost +100%, Oil cost +40% for 1 hour.',
  },
  {
    id: 'bunker_override', pillar: 'sabotage', name: 'Bunker Override',
    icon: '🏰', description: 'Override bunker defenses in a target region.',
    cost: { energy: 3000, materialX: 15000, oil: 5000, bitcoin: 1 },
    targetType: 'region', successChance: 80, detectionChance: 30,
    duration: 45 * 60 * 1000, // 45 min
    effectDescription: 'Bunker effectiveness -40% for 45 minutes.',
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
    const country = useWorldStore.getState().getCountry(target.country)
    generatedData = {
      country: target.country,
      countryName: country?.name || target.country,
      treasury: country?.treasury || 0,
      conqueredResources: country?.conqueredResources || [],
      deposits: (useWorldStore.getState() as any).deposits
        ?.filter((d: any) => d.countryCode === target.country) || [],
    }
  }

  if (opType === 'military_intel' && target.region) {
    const country = useWorldStore.getState().countries.find(c => c.name === target.region)
    generatedData = {
      region: target.region,
      controller: country?.controller || 'Unknown',
      military: country?.military || 0,
      empire: country?.empire || 'None',
      regions: country?.regions || 0,
    }
  }

  if (opType === 'infrastructure_scan' && target.region) {
    const companies = useCompanyStore.getState().companies
    const country = useWorldStore.getState().countries.find(c => c.name === target.region)
    const countryCode = country?.code || ''
    const regionCompanies = companies.filter(c => c.location === countryCode)
    generatedData = {
      region: target.region,
      countryCode,
      companies: regionCompanies.map(c => ({
        id: c.id,
        type: c.type,
        level: c.level,
        production: c.productionProgress,
        disabled: c.disabledUntil && c.disabledUntil > Date.now(),
      })),
      totalCompanies: regionCompanies.length,
    }
  }

  if (opType === 'blueprint_loot' && target.player) {
    // Generate a mock "blueprint" loot
    const blueprintTypes = ['Weapon Schematic', 'Armor Design', 'Ammo Formula', 'Vehicle Plan', 'Defense Matrix']
    const tiers = ['T3', 'T4', 'T5', 'T6']
    generatedData = {
      targetPlayer: target.player,
      blueprintName: blueprintTypes[Math.floor(Math.random() * blueprintTypes.length)],
      tier: tiers[Math.floor(Math.random() * tiers.length)],
      copiedFrom: target.player,
      notification: `You have been cyber-probed and a blueprint was copied.`,
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

  if (opType === 'company_shutdown' && target.country) {
    // Disable 70% production for matching company types in the country
    // We'll use disabledUntil for a simpler approach
    const typeMap: Record<string, string[]> = {
      'farms': ['wheat_farm', 'fish_farm', 'steak_farm'],
      'oil_rigs': ['oil_refinery'],
      'material_mines': ['materialx_refiner'],
    }
    const targetTypes = typeMap[target.companyType || ''] || []
    const targetCompanies = companyStore.companies.filter(
      c => c.location === target.country && targetTypes.includes(c.type)
    )
    if (targetCompanies.length > 0) {
      const disableUntil = Date.now() + 2 * 60 * 60 * 1000
      useCompanyStore.setState({
        companies: companyStore.companies.map(c =>
          targetCompanies.some(tc => tc.id === c.id) ? { ...c, disabledUntil: disableUntil } : c
        )
      })
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
