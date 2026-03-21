import { create } from 'zustand'
import type { ArmyState, Division, Army, MilitaryRankType, ArmyMember, BattleOrder } from './types'
import { DIVISION_TEMPLATES, rollStarQuality, getEffectiveManpower, getEffectiveHealth, DEFAULT_DISTRIBUTION_INTERVAL } from './types'
import { usePlayerStore, getMilitaryRank } from '../playerStore'
import { useInventoryStore } from '../inventoryStore'

import { createRecruitmentSlice, initDivCounter } from './recruitment'
import { createCombatSlice } from './combat'
import { createVaultSlice } from './vault'
import { createSalarySlice } from './salary'
import { createQueriesSlice } from './queries'

// ====== SAFE HEALTH CALC (avoids calling usePlayerStore at module eval time) ======

function safeGetEffectiveHealth(template: import('./types').DivisionTemplate): number {
  try {
    return getEffectiveHealth(template)
  } catch {
    // Fallback if playerStore not ready yet
    return Math.floor(template.healthMult * 100)
  }
}

// ====== INITIAL MOCK DIVISION HELPER ======

function makeMockDiv(
  id: string,
  type: import('./types').DivisionType,
  name: string,
  owner: string,
  country: string,
  exp: number,
): Division {
  const t = DIVISION_TEMPLATES[type]
  const { star, modifiers } = rollStarQuality()
  return {
    id, type, name,
    category: t.category, ownerId: owner, countryCode: country,
    manpower: getEffectiveManpower(t), maxManpower: getEffectiveManpower(t),
    health: safeGetEffectiveHealth(t), maxHealth: safeGetEffectiveHealth(t),
    equipment: [], experience: exp,
    status: 'ready', trainingProgress: t.trainingTime,
    reinforcing: false, reinforceProgress: 0, recoveryTicksNeeded: 0,
    readyAt: 0,
    stance: 'unassigned' as const,
    autoTrainingEnabled: false,
    killCount: 0, battlesSurvived: 0,
    starQuality: star, statModifiers: modifiers,
  }
}

let armyCounter = 0

// ====== COMPOSE STORE (lazy init inside create callback) ======

export const useArmyStore = create<ArmyState>((set, get) => {
  // ── Build initial divisions lazily ──
  const playerName = (() => { try { return usePlayerStore.getState().name || 'Commander' } catch { return 'Commander' } })()

  const divs: Record<string, Division> = {}

  // US Army
  const usDefs: [import('./types').DivisionType, string][] = [
    ['recon', '1st Recon "Big Red Eye"'], ['assault', '82nd Airborne'],
    ['sniper', '101st Marksmen'], ['rpg', '10th Mountain RPG'],
    ['jeep', '1st Fast Attack Brigade'], ['tank', '3rd Armored Brigade'],
  ]
  usDefs.forEach(([type, name], i) => { divs[`div_us_${i}`] = makeMockDiv(`div_us_${i}`, type, name, playerName, 'US', 20 + i * 5) })

  // RU Army
  const ruDefs: [import('./types').DivisionType, string][] = [
    ['assault', '4th Guards Assault'], ['rpg', '20th Guards RPG'],
    ['sniper', '150th Sniper Division'], ['tank', 'T-90 Heavy Armor'],
  ]
  ruDefs.forEach(([type, name], i) => { divs[`div_ru_${i}`] = makeMockDiv(`div_ru_${i}`, type, name, 'AI_Commander_Putin', 'RU', 30) })

  // CN Army
  const cnDefs: [import('./types').DivisionType, string][] = [
    ['recon', 'PLA 1st Recon Group'], ['assault', 'PLA 2nd Assault Group'],
    ['sniper', 'PLA 3rd Sniper Group'], ['tank', 'Type 99A Battalion'],
    ['jet', 'J-20 Strike Wing'],
  ]
  cnDefs.forEach(([type, name], i) => { divs[`div_cn_${i}`] = makeMockDiv(`div_cn_${i}`, type, name, 'AI_Commander_Xi', 'CN', 25) })

  initDivCounter(Object.keys(divs).length)

  // ── Build initial armies ──
  function mkArmy(id: string, name: string, commander: string, country: string, prefix: string, vault: import('./types').ArmyVault): Army {
    const ids = Object.keys(divs).filter(k => k.startsWith(prefix))
    return {
      id, name, commanderId: commander, countryCode: country,
      divisionIds: ids, deployedProvince: country,
      members: [{ playerId: commander, role: 'general' as MilitaryRankType, joinedAt: Date.now(), contributedPower: 0, totalDamageThisPeriod: 0 }],
      maxSquadSize: 12, vault,
      contributions: [], activeBuffs: [], activeOrders: [],
      deployedToBattleId: null, status: 'idle',
      totalManpower: ids.reduce((s, did) => s + divs[did].manpower, 0),
      totalAttack: ids.length * 100, totalDefense: ids.length * 100,
      autoDefenseLimit: 0,
      salaryPool: 0, splitMode: 'equal', soldierBalances: {}, distributionInterval: DEFAULT_DISTRIBUTION_INTERVAL, lastDistribution: Date.now(), lastClaimed: {},
    }
  }

  const armies: Record<string, Army> = {
    army_us_1: mkArmy('army_us_1', 'US Army Group Alpha', playerName, 'US', 'div_us_', { ammo: 0, jets: 0, tanks: 0, oil: 0, money: 0, equipmentIds: [] }),
    army_ru_1: mkArmy('army_ru_1', 'Russian Western Front', 'AI_Commander_Putin', 'RU', 'div_ru_', { ammo: 500, jets: 2, tanks: 3, oil: 5000, money: 100000, equipmentIds: [] }),
    army_cn_1: mkArmy('army_cn_1', 'PLA Northern Command', 'AI_Commander_Xi', 'CN', 'div_cn_', { ammo: 600, jets: 3, tanks: 5, oil: 8000, money: 200000, equipmentIds: [] }),
  }
  armyCounter = Object.keys(armies).length

  return {
  divisions: divs,
  armies,

  // Spread all slice actions into the store
  ...createRecruitmentSlice(set, get),
  ...createCombatSlice(set, get),
  ...createVaultSlice(set, get),
  ...createSalarySlice(set, get),
  ...createQueriesSlice(set, get),

  // ====== EQUIPMENT (simple inline) ======

  equipItemToDivision: (divisionId, itemId) => {
    const state = get()
    const div = state.divisions[divisionId]
    if (!div) return false
    if (div.equipment.length >= 3) return false
    if (div.equipment.includes(itemId)) return false

    set(s => ({
      divisions: {
        ...s.divisions,
        [divisionId]: {
          ...div,
          equipment: [...div.equipment, itemId],
        },
      },
    }))
    return true
  },

  unequipItemFromDivision: (divisionId, itemId) => {
    const state = get()
    const div = state.divisions[divisionId]
    if (!div || !div.equipment.includes(itemId)) return false

    set(s => ({
      divisions: {
        ...s.divisions,
        [divisionId]: {
          ...div,
          equipment: div.equipment.filter(e => e !== itemId),
        },
      },
    }))
    return true
  },

  recalculateDivisionStats: (_divisionId) => {
    // No-op: division stats are now computed at combat time
  },

  // ====== ARMY MANAGEMENT ======

  createArmy: (name, province) => {
    const player = usePlayerStore.getState()
    const id = `army_${++armyCounter}_${Date.now()}`

    set(state => ({
      armies: {
        ...state.armies,
        [id]: {
          id, name,
          commanderId: player.name,
          countryCode: player.countryCode || 'US',
          divisionIds: [],
          members: [{ playerId: player.name, role: getMilitaryRank(player.level).rank, joinedAt: Date.now(), contributedPower: 0, totalDamageThisPeriod: 0 }],
          maxSquadSize: 12,
          vault: { ammo: 0, jets: 0, tanks: 0, oil: 0, money: 0, equipmentIds: [] },
          contributions: [], activeBuffs: [], activeOrders: [],
          deployedToBattleId: null,
          deployedProvince: province,
          status: 'idle',
          totalManpower: 0,
          totalAttack: 0,
          totalDefense: 0,
          autoDefenseLimit: 0,
          salaryPool: 0, splitMode: 'equal', soldierBalances: {}, distributionInterval: DEFAULT_DISTRIBUTION_INTERVAL, lastDistribution: Date.now(), lastClaimed: {},
        },
      },
    }))

    return id
  },

  assignDivisionToArmy: (divisionId, armyId) => {
    const state = get()
    const div = state.divisions[divisionId]
    const army = state.armies[armyId]
    if (!div || !army) return false

    get().removeDivisionFromArmy(divisionId)

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          divisionIds: [...army.divisionIds, divisionId],
        },
      },
    }))

    get().recalculateArmyTotals(armyId)
    return true
  },

  removeDivisionFromArmy: (divisionId) => {
    const state = get()
    let removedFrom: string | null = null

    Object.values(state.armies).forEach(army => {
      if (army.divisionIds.includes(divisionId)) {
        removedFrom = army.id
      }
    })

    if (!removedFrom) return false

    set(s => ({
      armies: {
        ...s.armies,
        [removedFrom!]: {
          ...s.armies[removedFrom!],
          divisionIds: s.armies[removedFrom!].divisionIds.filter(id => id !== divisionId),
        },
      },
    }))

    get().recalculateArmyTotals(removedFrom!)
    return true
  },

  disbandDivision: (divisionId) => {
    const state = get()
    const div = state.divisions[divisionId]
    if (!div) return { success: false, message: 'Division not found.' }
    if (div.status === 'in_combat') return { success: false, message: 'Cannot disband a division in combat.' }
    const player = usePlayerStore.getState()
    if (div.ownerId !== player.name) return { success: false, message: 'Not your division.' }

    div.equipment.forEach(eqId => {
      useInventoryStore.setState(s => ({
        items: s.items.map(i => i.id === eqId ? {
          ...i, location: 'inventory' as const, assignedToDivision: undefined, equipped: false,
        } : i)
      }))
    })

    get().removeDivisionFromArmy(divisionId)

    set(s => {
      const newDivisions = { ...s.divisions }
      delete newDivisions[divisionId]
      return { divisions: newDivisions }
    })

    return { success: true, message: `${div.name} has been disbanded.` }
  },

  recalculateArmyTotals: (armyId) => {
    set(state => {
      const army = state.armies[armyId]
      if (!army) return state

      let totalManpower = 0
      let totalAttack = 0
      let totalDefense = 0

      army.divisionIds.forEach(id => {
        const div = state.divisions[id]
        if (div) {
          totalManpower += div.manpower
          totalAttack += div.manpower
          totalDefense += div.manpower
        }
      })

      return {
        armies: {
          ...state.armies,
          [armyId]: { ...army, totalManpower, totalAttack, totalDefense },
        },
      }
    })
  },

  // ====== ENLISTMENT ======

  enlistInArmy: (armyId) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }
    if (army.countryCode !== (player.countryCode || 'US')) return { success: false, message: 'You can only join armies from your country.' }

    const alreadyIn = Object.values(state.armies).find(a => a.members.some(m => m.playerId === player.name))
    if (alreadyIn) return { success: false, message: `Already enlisted in ${alreadyIn.name}. Leave first.` }

    const rank = getMilitaryRank(player.level)
    const newMember: ArmyMember = {
      playerId: player.name,
      role: rank.rank,
      joinedAt: Date.now(),
      contributedPower: 0,
      totalDamageThisPeriod: 0,
    }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          members: [...army.members, newMember],
        },
      },
    }))

    usePlayerStore.setState({ enlistedArmyId: armyId })
    return { success: true, message: `Enlisted in ${army.name} as ${rank.label}!` }
  },

  leaveArmy: () => {
    const player = usePlayerStore.getState()
    const state = get()
    const currentArmy = Object.values(state.armies).find(a => a.members.some(m => m.playerId === player.name))
    if (!currentArmy) return { success: false, message: 'Not enlisted in any army.' }

    if (currentArmy.commanderId === player.name) return { success: false, message: 'Commanders cannot leave. Disband or transfer command first.' }

    set(s => ({
      armies: {
        ...s.armies,
        [currentArmy.id]: {
          ...currentArmy,
          members: currentArmy.members.filter(m => m.playerId !== player.name),
        },
      },
    }))

    usePlayerStore.setState({ enlistedArmyId: null })
    return { success: true, message: `Left ${currentArmy.name}.` }
  },

  promoteMember: (armyId, playerId, newRole) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    const promoter = army.members.find(m => m.playerId === player.name)
    if (!promoter) return { success: false, message: 'You are not in this army.' }
    const promoterRankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(promoter.role)
    if (promoterRankIdx < 5) return { success: false, message: 'Only Colonels and Generals can promote.' }

    const target = army.members.find(m => m.playerId === playerId)
    if (!target) return { success: false, message: 'Player not found in army.' }

    const newRoleIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(newRole)
    if (newRoleIdx >= promoterRankIdx) return { success: false, message: 'Cannot promote to your rank or higher.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          members: army.members.map(m =>
            m.playerId === playerId ? { ...m, role: newRole } : m
          ),
        },
      },
    }))

    return { success: true, message: `${playerId} promoted to ${newRole}.` }
  },

  // ====== DEPLOYMENT ======

  deployArmyToBattle: (armyId, battleId) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 3) return { success: false, message: 'Only Lieutenants+ can deploy armies.' }

    if (army.deployedToBattleId) return { success: false, message: `Already deployed to battle ${army.deployedToBattleId}. Recall first.` }
    if (army.divisionIds.length === 0) return { success: false, message: 'No divisions to deploy.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, deployedToBattleId: battleId, status: 'attacking' as const },
      },
    }))

    return { success: true, message: `${army.name} deployed to battle!` }
  },

  recallArmy: (armyId) => {
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }
    if (!army.deployedToBattleId) return { success: false, message: 'Army is not deployed.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, deployedToBattleId: null, status: 'idle' as const },
      },
    }))

    return { success: true, message: `${army.name} recalled.` }
  },

  deployToRegion: (armyId, regionCode) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 3) return { success: false, message: 'Only Lieutenants+ can deploy armies.' }

    if (army.deployedToBattleId) return { success: false, message: 'Army is in battle. Recall from battle first.' }
    if (army.divisionIds.length === 0) return { success: false, message: 'No divisions to deploy.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, deployedProvince: regionCode, status: 'idle' as const },
      },
    }))

    return { success: true, message: `${army.name} deployed to ${regionCode}!` }
  },

  // ====== AUTODEFENSE LIMIT ======

  setArmyAutoDefenseLimit: (armyId, limit) => {
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, autoDefenseLimit: limit },
      },
    }))

    const label = limit === -1 ? 'ALL' : limit === 0 ? 'OFF' : `${limit}`
    return { success: true, message: `Autodefense set to ${label} for ${army.name}.` }
  },

  // ====== BATTLE ORDERS ======

  issueOrder: (armyId, orderType, targetRegion, bountyPool, durationMs, damageMultiplier) => {
    const player = usePlayerStore.getState()
    const state = get()
    const army = state.armies[armyId]
    if (!army) return { success: false, message: 'Army not found.' }

    const member = army.members.find(m => m.playerId === player.name)
    if (!member) return { success: false, message: 'Not in this army.' }
    const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
    if (rankIdx < 4) return { success: false, message: 'Only Captains+ can issue orders.' }

    if (army.vault.money < bountyPool) return { success: false, message: `Not enough vault money. Vault has $${army.vault.money}.` }

    const order: BattleOrder = {
      id: `order_${Date.now()}`,
      armyId,
      orderType,
      targetRegion,
      issuedBy: player.name,
      issuedAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      damageMultiplier,
      bountyPool,
      claimedBy: [],
    }

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: {
          ...army,
          activeOrders: [...army.activeOrders, order],
          vault: { ...army.vault, money: army.vault.money - bountyPool },
        },
      },
    }))

    return { success: true, message: `Order issued: ${orderType} at ${targetRegion} with $${bountyPool} bounty!` }
  },

  recordDamageContribution: (armyId, orderId, playerId, damage) => {
    const state = get()
    const army = state.armies[armyId]
    if (!army) return

    const orders = army.activeOrders.map(o => {
      if (o.id !== orderId) return o
      const existing = o.claimedBy.find(c => c.playerId === playerId)
      if (existing) {
        return {
          ...o,
          claimedBy: o.claimedBy.map(c =>
            c.playerId === playerId ? { ...c, damageContribution: c.damageContribution + damage } : c
          ),
        }
      } else {
        return {
          ...o,
          claimedBy: [...o.claimedBy, { playerId, damageContribution: damage }],
        }
      }
    })

    set(s => ({
      armies: {
        ...s.armies,
        [armyId]: { ...army, activeOrders: orders },
      },
    }))
  },

  processEconomyUpkeepTick: () => {
    const playerStore = usePlayerStore.getState()
    const state = get()
    let totalOil = 0
    let totalMatX = 0

    Object.values(state.divisions).forEach(div => {
      if (div.ownerId === playerStore.name && div.status !== 'destroyed') {
        const template = DIVISION_TEMPLATES[div.type]
        if (template && template.upkeepCost) {
          totalOil += template.upkeepCost.oil
          totalMatX += template.upkeepCost.materialX
        }
      }
    })

    if (totalOil > 0) playerStore.spendOil(totalOil)
    if (totalMatX > 0) playerStore.spendMaterialX(totalMatX)
  },
}})

// Re-export everything from types for backward compatibility
export * from './types'
