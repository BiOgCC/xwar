// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Country Fund & Force Vault Trading
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useWorldStore } from '../worldStore'
import { useGovernmentStore } from '../governmentStore'
import { useArmyStore } from '../army'
import type { MarketState, ResourceId, MarketOrder } from './types'
import { RESOURCE_DEFS, ORDER_EXPIRY_MS } from './types'
import { mkId, round2 } from './helpers'
import { matchResourceOrders } from './resourceMarket'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── Vault resource key mapping ──
// ArmyVault keys: money, oil, materialX, ammo, jets, tanks, equipmentIds
// Market resource keys that map to storable vault keys:
const VAULT_RESOURCE_MAP: Record<string, 'money' | 'oil' | 'materialX'> = {
  oil: 'oil',
  materialX: 'materialX',
}

export function placeCountryOrder(
  set: Set, get: Get,
  type: 'buy' | 'sell', resourceId: ResourceId, amount: number, pricePerUnit: number
): { success: boolean; message: string } {
  if (amount <= 0 || pricePerUnit <= 0)
    return { success: false, message: 'Invalid amount or price' }

  const def = RESOURCE_DEFS.find(r => r.id === resourceId)
  if (!def || !def.fundKey)
    return { success: false, message: 'Resource cannot be traded from country fund' }

  const player = usePlayerStore.getState()
  const countryCode = player.countryCode || 'US'
  const gov = useGovernmentStore.getState().governments[countryCode]
  if (!gov || gov.president !== player.name)
    return { success: false, message: 'Only the president can trade from the national fund' }

  const ws = useWorldStore.getState()
  const country = ws.getCountry(countryCode)
  if (!country) return { success: false, message: 'Country not found' }

  const totalPrice = round2(amount * pricePerUnit)

  if (type === 'buy') {
    if (country.fund.money < totalPrice)
      return { success: false, message: `National fund needs $${totalPrice.toFixed(2)}` }
    ws.spendFromFund(countryCode, { money: totalPrice })
  } else {
    const available = country.fund[def.fundKey]
    if (available < amount)
      return { success: false, message: `National fund has ${available} ${def.name}, need ${amount}` }
    ws.spendFromFund(countryCode, { [def.fundKey]: amount })
  }

  const order: MarketOrder = {
    id: mkId('cntord'), type, itemType: 'resource', resourceId,
    amount, pricePerUnit, totalPrice,
    playerId: player.name, countryCode,
    source: 'country', createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
  }

  set(s => ({ orders: [...s.orders, order] }))
  matchResourceOrders(set, get, resourceId)

  return { success: true, message: `Country ${type.toUpperCase()}: ${amount}× ${def.name} @ $${pricePerUnit.toFixed(2)}` }
}

// ══════════════════════════════════════════════════════════════════
// FORCE VAULT TRADING — Commander & Colonel only
// ══════════════════════════════════════════════════════════════════
//
// Vault management ranks (5 tiers):
//   1. Commander (general) — full vault control
//   2. Colonel             — full vault control
//   3. Captain             — view vault only
//   4. Lieutenant          — view vault only
//   5. Sergeant & below    — no vault access
//
const VAULT_CONTROL_RANKS = ['colonel', 'general'] // top 2 ranks = full control

export function placeForceVaultOrder(
  set: Set, get: Get,
  armyId: string, type: 'buy' | 'sell', resourceId: ResourceId,
  amount: number, pricePerUnit: number
): { success: boolean; message: string } {
  if (amount <= 0 || pricePerUnit <= 0)
    return { success: false, message: 'Invalid amount or price' }

  const def = RESOURCE_DEFS.find(r => r.id === resourceId)
  if (!def) return { success: false, message: 'Unknown resource' }

  // Only oil can be stored in the army vault (vault has: money, oil, ammo, jets, tanks)
  // For buy orders: vault pays money → receives resources (credited to vault.oil or player)
  // For sell orders: vault provides oil → receives money (credited to vault.money)
  const vaultKey = VAULT_RESOURCE_MAP[resourceId]

  const player = usePlayerStore.getState()
  const armyStore = useArmyStore.getState()
  const army = armyStore.armies[armyId]
  if (!army) return { success: false, message: 'Army not found' }

  // Check rank — only Commander (commanderId) and Colonel can trade from vault
  const member = army.members.find(m => m.playerId === player.name)
  if (!member) return { success: false, message: 'You are not in this army' }
  const isCommander = army.commanderId === player.name
  const hasVaultControl = isCommander || VAULT_CONTROL_RANKS.includes(member.role)
  if (!hasVaultControl)
    return { success: false, message: 'Only Commander and Colonel can trade from the force vault' }

  const totalPrice = round2(amount * pricePerUnit)

  if (type === 'buy') {
    // Vault pays money to buy resources
    if (army.vault.money < totalPrice)
      return { success: false, message: `Force vault needs $${totalPrice.toFixed(2)}, has $${army.vault.money.toFixed(2)}` }
    // Lock money from vault
    useArmyStore.setState(s => ({
      armies: { ...s.armies, [armyId]: {
        ...s.armies[armyId],
        vault: { ...s.armies[armyId].vault, money: s.armies[armyId].vault.money - totalPrice },
      }},
    }))
  } else {
    // Vault provides resources to sell
    if (!vaultKey)
      return { success: false, message: `${def.name} cannot be sold from force vault (vault only stores oil)` }
    const available = army.vault[vaultKey]
    if (available < amount)
      return { success: false, message: `Force vault has ${available} ${def.name}, need ${amount}` }
    // Lock resources from vault
    useArmyStore.setState(s => ({
      armies: { ...s.armies, [armyId]: {
        ...s.armies[armyId],
        vault: { ...s.armies[armyId].vault, [vaultKey]: s.armies[armyId].vault[vaultKey] - amount },
      }},
    }))
  }

  const order: MarketOrder = {
    id: mkId('vaultord'), type, itemType: 'resource', resourceId,
    amount, pricePerUnit, totalPrice,
    playerId: player.name, countryCode: army.countryCode,
    source: 'force_vault', armyId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
  }

  set(s => ({ orders: [...s.orders, order] }))
  matchResourceOrders(set, get, resourceId)

  return { success: true, message: `Vault ${type.toUpperCase()}: ${amount}× ${def.name} @ $${pricePerUnit.toFixed(2)}` }
}
