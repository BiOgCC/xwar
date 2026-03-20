import type { ArmyState, ArmyBuff, ArmyVault, DivisionType } from './types'
import { usePlayerStore } from '../playerStore'
import { useInventoryStore } from '../inventoryStore'
import type { StoreApi } from 'zustand'

export function createVaultSlice(
  set: StoreApi<ArmyState>['setState'],
  get: StoreApi<ArmyState>['getState']
) {
  return {
    donateToVault: (armyId: string, resource: keyof ArmyVault, amount: number) => {
      const player = usePlayerStore.getState()
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }

      if (!army.members.some(m => m.playerId === player.name)) {
        return { success: false, message: 'You must be enlisted to donate.' }
      }

      if (resource === 'money' && player.money < amount) return { success: false, message: 'Not enough money.' }
      if (resource === 'oil' && player.oil < amount) return { success: false, message: 'Not enough oil.' }

      if (resource === 'money') usePlayerStore.getState().spendMoney(amount)
      else if (resource === 'oil') usePlayerStore.getState().spendOil(amount)

      const newVault = { ...army.vault }
      if (resource in newVault && resource !== 'equipmentIds') {
        ;(newVault as any)[resource] += amount
      }

      const contributions = [...army.contributions]
      const existing = contributions.find(c => c.playerId === player.name)
      if (existing) {
        existing.totalMoneyDonated += resource === 'money' ? amount : 0
      } else {
        contributions.push({
          playerId: player.name,
          totalMoneyDonated: resource === 'money' ? amount : 0,
          totalEquipmentDonated: 0,
          sponsoredSquadrons: [],
        })
      }

      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: { ...army, vault: newVault, contributions },
        },
      }))

      return { success: true, message: `Donated ${amount} ${resource} to ${army.name} vault!` }
    },

    donateEquipmentToVault: (armyId: string, itemId: string) => {
      const player = usePlayerStore.getState()
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }

      if (!army.members.some(m => m.playerId === player.name)) {
        return { success: false, message: 'You must be enlisted to donate.' }
      }

      const inv = useInventoryStore.getState()
      const item = inv.items.find(i => i.id === itemId && i.location === 'inventory')
      if (!item) return { success: false, message: 'Item not found in inventory.' }
      if (item.equipped) return { success: false, message: 'Unequip the item first.' }

      useInventoryStore.setState(s => ({
        items: s.items.map(i => i.id === itemId ? {
          ...i, location: 'vault' as const, vaultArmyId: armyId, equipped: false,
        } : i)
      }))

      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: {
            ...army,
            vault: { ...army.vault, equipmentIds: [...army.vault.equipmentIds, itemId] },
          },
        },
      }))

      const contributions = [...army.contributions]
      const existing = contributions.find(c => c.playerId === player.name)
      if (existing) {
        existing.totalEquipmentDonated += 1
      } else {
        contributions.push({
          playerId: player.name,
          totalMoneyDonated: 0,
          totalEquipmentDonated: 1,
          sponsoredSquadrons: [],
        })
      }

      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: { ...s.armies[armyId], contributions },
        },
      }))

      return { success: true, message: `Donated ${item.name} to ${army.name} vault!` }
    },

    buyArmyBuff: (armyId: string, stat: ArmyBuff['stat'], percentage: number, durationMs: number, cost: number) => {
      const player = usePlayerStore.getState()
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }

      const member = army.members.find(m => m.playerId === player.name)
      if (!member) return { success: false, message: 'Not in this army.' }
      const rankIdx = ['private', 'corporal', 'sergeant', 'lieutenant', 'captain', 'colonel', 'general'].indexOf(member.role)
      if (rankIdx < 4) return { success: false, message: 'Only Captains+ can buy army buffs.' }

      if (player.money < cost) return { success: false, message: 'Not enough money.' }
      player.spendMoney(cost)

      const buff: ArmyBuff = {
        id: `buff_${Date.now()}`,
        name: `+${percentage}% ${stat.toUpperCase()}`,
        stat, percentage,
        expiresAt: Date.now() + durationMs,
        purchasedBy: player.name,
      }

      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: {
            ...army,
            activeBuffs: [...army.activeBuffs, buff],
          },
        },
      }))

      return { success: true, message: `Purchased ${buff.name} buff for ${army.name}!` }
    },

    equipFromVault: (armyId: string, divisionId: string, equipmentId: string) => {
      const state = get()
      const army = state.armies[armyId]
      const div = state.divisions[divisionId]
      if (!army) return { success: false, message: 'Force not found.' }
      if (!div) return { success: false, message: 'Division not found.' }
      if (!army.vault.equipmentIds.includes(equipmentId)) return { success: false, message: 'Item not in vault.' }
      if (div.equipment.length >= 3) return { success: false, message: 'Division has max 3 equipment slots.' }
      if (div.equipment.includes(equipmentId)) return { success: false, message: 'Already equipped.' }

      useInventoryStore.setState(s => ({
        items: s.items.map(i => i.id === equipmentId ? {
          ...i, location: 'division' as const, assignedToDivision: divisionId, vaultArmyId: undefined,
        } : i)
      }))

      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: {
            ...army,
            vault: { ...army.vault, equipmentIds: army.vault.equipmentIds.filter(id => id !== equipmentId) },
          },
        },
        divisions: {
          ...s.divisions,
          [divisionId]: { ...div, equipment: [...div.equipment, equipmentId] },
        },
      }))

      return { success: true, message: 'Equipment assigned to division.' }
    },

    unequipToVault: (armyId: string, divisionId: string, equipmentId: string) => {
      const state = get()
      const army = state.armies[armyId]
      const div = state.divisions[divisionId]
      if (!army) return { success: false, message: 'Force not found.' }
      if (!div) return { success: false, message: 'Division not found.' }
      if (!div.equipment.includes(equipmentId)) return { success: false, message: 'Not equipped.' }

      useInventoryStore.setState(s => ({
        items: s.items.map(i => i.id === equipmentId ? {
          ...i, location: 'vault' as const, assignedToDivision: undefined, vaultArmyId: armyId,
        } : i)
      }))

      set(s => ({
        armies: {
          ...s.armies,
          [armyId]: {
            ...army,
            vault: { ...army.vault, equipmentIds: [...army.vault.equipmentIds, equipmentId] },
          },
        },
        divisions: {
          ...s.divisions,
          [divisionId]: { ...div, equipment: div.equipment.filter(id => id !== equipmentId) },
        },
      }))
      return { success: true, message: 'Equipment returned to vault.' }
    },

    distributeVaultToMembers: (armyId: string, resource: 'money' | 'oil', amount: number) => {
      const player = usePlayerStore.getState()
      const state = get()
      const army = state.armies[armyId]
      if (!army) return { success: false, message: 'Army not found.' }

      // Only Commander and Colonel can distribute
      const member = army.members.find(m => m.playerId === player.name)
      const isCommander = army.commanderId === player.name
      const hasControl = isCommander || (member && ['colonel', 'general'].includes(member.role))
      if (!hasControl)
        return { success: false, message: 'Only Commander and Colonel can distribute vault resources.' }

      if (amount <= 0) return { success: false, message: 'Invalid amount.' }
      if (army.members.length === 0) return { success: false, message: 'No members to distribute to.' }

      // Check vault balance
      if (army.vault[resource] < amount)
        return { success: false, message: `Vault has ${army.vault[resource]} ${resource}, need ${amount}.` }

      const perMember = Math.floor(amount / army.members.length)
      if (perMember <= 0) return { success: false, message: 'Amount too small to distribute.' }
      const totalDistributed = perMember * army.members.length

      // Deduct from vault
      const newVault = { ...army.vault, [resource]: army.vault[resource] - totalDistributed }

      if (resource === 'money') {
        // Money goes to soldier balances (claimable via claimSalary)
        const newBalances = { ...army.soldierBalances }
        army.members.forEach(m => {
          newBalances[m.playerId] = (newBalances[m.playerId] || 0) + perMember
        })
        set(s => ({
          armies: {
            ...s.armies,
            [armyId]: { ...s.armies[armyId], vault: newVault, soldierBalances: newBalances },
          },
        }))
      } else {
        // Non-money resources: only oil goes directly to each member's player store
        // We can only credit the local player in single-client mode
        // In multiplayer, this would need server coordination
        army.members.forEach(m => {
          if (m.playerId === player.name) {
            usePlayerStore.setState(s => ({ oil: (s.oil || 0) + perMember }))
          }
          // Other players would receive their share when they log in (server-side)
        })
        set(s => ({
          armies: {
            ...s.armies,
            [armyId]: { ...s.armies[armyId], vault: newVault },
          },
        }))
      }

      return { success: true, message: `Distributed ${totalDistributed} ${resource} to ${army.members.length} members ($${perMember} each).` }
    },
  }
}
