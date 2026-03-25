// ══════════════════════════════════════════════════════════════════
// MARKET MODULE — Equipment Marketplace
// ══════════════════════════════════════════════════════════════════

import type { StoreApi } from 'zustand'
import { usePlayerStore } from '../playerStore'
import { useInventoryStore, type EquipItem } from '../inventoryStore'
import { useWorldStore } from '../worldStore'
import type { MarketState, MarketOrder, TradeRecord } from './types'
import { TAX_RATE, LISTING_FEE_RATE, ORDER_EXPIRY_MS, MIN_EQUIP_PRICE } from './types'
import { mkId } from './helpers'

type Set = StoreApi<MarketState>['setState']
type Get = () => MarketState

// ── List Equipment for Sale ──
export function placeEquipmentSellOrder(
  set: Set, get: Get,
  equipItemId: string, price: number
): { success: boolean; message: string } {
  const inv = useInventoryStore.getState()
  const item = inv.items.find(i => i.id === equipItemId)
  if (!item) return { success: false, message: 'Item not found in inventory' }
  if (item.equipped) return { success: false, message: 'Unequip item first' }

  // Per-tier minimum price
  const minPrice = MIN_EQUIP_PRICE[item.tier] || 100
  if (price < minPrice) return { success: false, message: `Minimum price for ${item.tier.toUpperCase()}: $${minPrice.toLocaleString()}` }

  // Check not already listed
  if (get().orders.some(o => o.equipItemId === equipItemId && o.status === 'open'))
    return { success: false, message: 'Item already listed' }

  const player = usePlayerStore.getState()

  // 2% listing fee (non-refundable) → goes to country fund
  const listingFee = Math.ceil(price * LISTING_FEE_RATE)
  if (!usePlayerStore.getState().spendMoney(listingFee))
    return { success: false, message: `Listing fee: $${listingFee.toLocaleString()} (2%) — insufficient funds` }
  const countryCode = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(countryCode, listingFee)

  // Lock item in market (set location instead of removing)
  useInventoryStore.setState(s => ({
    items: s.items.map(i => i.id === equipItemId ? { ...i, location: 'market' as const, equipped: false } : i)
  }))

  const order: MarketOrder = {
    id: mkId('eqord'), type: 'sell', itemType: 'equipment',
    equipItemId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode,
    source: 'player', createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    equipSnapshot: {
      name: item.name, tier: item.tier, slot: item.slot,
      category: item.category, stats: { ...item.stats },
      durability: item.durability, weaponSubtype: item.weaponSubtype,
      superforged: item.superforged,
    },
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Listed ${item.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ── Buy Equipment (instant fill) ──
export function buyEquipment(
  set: Set, get: Get,
  orderId: string
): { success: boolean; message: string } {
  const order = get().orders.find(o => o.id === orderId && o.itemType === 'equipment' && o.status === 'open')
  if (!order) return { success: false, message: 'Listing not found' }

  const player = usePlayerStore.getState()
  if (order.playerId === player.name) return { success: false, message: 'Cannot buy your own item' }
  if (player.money < order.totalPrice) return { success: false, message: 'Not enough money' }

  // Deduct buyer money
  if (!usePlayerStore.getState().spendMoney(order.totalPrice))
    return { success: false, message: 'Not enough money' }

  // Tax (1% of sale price to buyer's country)
  const tax = Math.round(order.totalPrice * TAX_RATE)
  const sellerGets = order.totalPrice - tax

  // Credit seller
  usePlayerStore.getState().earnMoney(sellerGets)

  // Give item to buyer (update location back to inventory)
  if (order.equipItemId) {
    useInventoryStore.setState(s => ({
      items: s.items.map(i => i.id === order.equipItemId ? {
        ...i, location: 'inventory' as const, equipped: false,
      } : i)
    }))
  } else if (order.equipSnapshot) {
    // Fallback: create item from snapshot if original ID doesn't exist
    const newItem: EquipItem = {
      id: order.equipItemId || mkId('eq'), name: order.equipSnapshot.name,
      slot: order.equipSnapshot.slot as EquipItem['slot'],
      category: order.equipSnapshot.category as EquipItem['category'],
      tier: order.equipSnapshot.tier as EquipItem['tier'],
      equipped: false,
      durability: order.equipSnapshot.durability,
      stats: { ...order.equipSnapshot.stats } as EquipItem['stats'],
      weaponSubtype: order.equipSnapshot.weaponSubtype as EquipItem['weaponSubtype'],
      superforged: order.equipSnapshot.superforged,
      location: 'inventory',
    }
    useInventoryStore.getState().addItem(newItem)
  }

  // Tax to buyer's country
  const buyerCountry = player.countryCode || 'US'
  useWorldStore.getState().addTreasuryTax(buyerCountry, tax)

  // Record trade
  const trade: TradeRecord = {
    id: mkId('tr'), buyOrderId: 'instant', sellOrderId: orderId,
    itemType: 'equipment', equipItemId: order.equipItemId,
    amount: 1, pricePerUnit: order.totalPrice, totalPrice: order.totalPrice,
    tax, buyer: player.name, seller: order.playerId,
    buyerCountry, sellerCountry: order.countryCode,
    timestamp: Date.now(),
  }

  set(s => ({
    orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'filled' as const, filledAmount: 1 } : o),
    trades: [trade, ...s.trades].slice(0, 200),
  }))

  return { success: true, message: `Bought ${order.equipSnapshot?.name} for $${order.totalPrice.toLocaleString()}! (Tax: $${tax})` }
}

// ── List Equipment from Army Vault for Sale ──
export function placeVaultEquipmentSellOrder(
  set: Set, get: Get,
  armyId: string, equipItemId: string, price: number
): { success: boolean; message: string } {
  const player = usePlayerStore.getState()

  // Check army and rank
  const { useArmyStore } = require('../army')
  const armyStore = useArmyStore.getState()
  const army = armyStore.armies[armyId]
  if (!army) return { success: false, message: 'Army not found' }

  const member = army.members.find((m: any) => m.playerId === player.name)
  const isCommander = army.commanderId === player.name
  const hasControl = isCommander || (member && ['colonel', 'general'].includes(member.role))
  if (!hasControl) return { success: false, message: 'Only Commander/Colonel can list vault equipment' }

  // Item must be in vault
  if (!army.vault.equipmentIds.includes(equipItemId))
    return { success: false, message: 'Item not in vault' }

  const inv = useInventoryStore.getState()
  const item = inv.items.find(i => i.id === equipItemId)
  if (!item) return { success: false, message: 'Item not found' }

  // Per-tier minimum price
  const minPrice = MIN_EQUIP_PRICE[item.tier] || 100
  if (price < minPrice) return { success: false, message: `Minimum price for ${item.tier.toUpperCase()}: $${minPrice.toLocaleString()}` }

  // Check not already listed
  if (get().orders.some(o => o.equipItemId === equipItemId && o.status === 'open'))
    return { success: false, message: 'Item already listed' }

  // 2% listing fee from vault money (non-refundable) → country fund
  const listingFee = Math.ceil(price * LISTING_FEE_RATE)
  if (army.vault.money < listingFee)
    return { success: false, message: `Vault listing fee: $${listingFee.toLocaleString()} (2%) — insufficient vault funds` }

  useArmyStore.setState((s: any) => ({
    armies: { ...s.armies, [armyId]: {
      ...s.armies[armyId],
      vault: {
        ...s.armies[armyId].vault,
        money: s.armies[armyId].vault.money - listingFee,
        equipmentIds: s.armies[armyId].vault.equipmentIds.filter((id: string) => id !== equipItemId),
      },
    }},
  }))
  useWorldStore.getState().addTreasuryTax(army.countryCode, listingFee)

  // Lock item in market
  useInventoryStore.setState(s => ({
    items: s.items.map(i => i.id === equipItemId ? { ...i, location: 'market' as const, equipped: false, vaultArmyId: undefined } : i)
  }))

  const order: MarketOrder = {
    id: mkId('veqord'), type: 'sell', itemType: 'equipment',
    equipItemId, amount: 1, pricePerUnit: price, totalPrice: price,
    playerId: player.name, countryCode: army.countryCode,
    source: 'force_vault', armyId,
    createdAt: Date.now(),
    expiresAt: Date.now() + ORDER_EXPIRY_MS,
    status: 'open', filledAmount: 0,
    listingFee,
    equipSnapshot: {
      name: item.name, tier: item.tier, slot: item.slot,
      category: item.category, stats: { ...item.stats },
      durability: item.durability, weaponSubtype: item.weaponSubtype,
      superforged: item.superforged,
    },
  }

  set(s => ({ orders: [...s.orders, order] }))
  return { success: true, message: `Vault listed ${item.name} for $${price.toLocaleString()} (fee: $${listingFee})` }
}

// ── Buy Equipment into Army Vault ──
export function buyEquipmentToVault(
  set: Set, get: Get,
  armyId: string, orderId: string
): { success: boolean; message: string } {
  const order = get().orders.find(o => o.id === orderId && o.itemType === 'equipment' && o.status === 'open')
  if (!order) return { success: false, message: 'Listing not found' }

  const player = usePlayerStore.getState()

  // Check army and rank
  const { useArmyStore } = require('../army')
  const armyStore = useArmyStore.getState()
  const army = armyStore.armies[armyId]
  if (!army) return { success: false, message: 'Army not found' }

  const member = army.members.find((m: any) => m.playerId === player.name)
  const isCommander = army.commanderId === player.name
  const hasControl = isCommander || (member && ['colonel', 'general'].includes(member.role))
  if (!hasControl) return { success: false, message: 'Only Commander/Colonel can buy equipment to vault' }

  if (order.playerId === player.name && order.source === 'player')
    return { success: false, message: 'Cannot buy your own item' }
  if (army.vault.money < order.totalPrice) return { success: false, message: 'Not enough vault funds' }

  // Deduct from vault
  useArmyStore.setState((s: any) => ({
    armies: { ...s.armies, [armyId]: {
      ...s.armies[armyId],
      vault: { ...s.armies[armyId].vault, money: s.armies[armyId].vault.money - order.totalPrice },
    }},
  }))

  // Tax (1% of sale price to army's country)
  const tax = Math.round(order.totalPrice * TAX_RATE)
  const sellerGets = order.totalPrice - tax

  // Credit seller
  if (order.source === 'force_vault' && order.armyId) {
    useArmyStore.setState((s: any) => {
      const sellerArmy = s.armies[order.armyId!]
      if (!sellerArmy) return s
      return { armies: { ...s.armies, [order.armyId!]: {
        ...sellerArmy, vault: { ...sellerArmy.vault, money: sellerArmy.vault.money + sellerGets },
      }}}
    })
  } else {
    usePlayerStore.getState().earnMoney(sellerGets)
  }

  // Move item into vault
  if (order.equipItemId) {
    useInventoryStore.setState(s => ({
      items: s.items.map(i => i.id === order.equipItemId ? {
        ...i, location: 'vault' as const, equipped: false, vaultArmyId: armyId,
      } : i)
    }))
    // Add to vault equipmentIds
    useArmyStore.setState((s: any) => ({
      armies: { ...s.armies, [armyId]: {
        ...s.armies[armyId],
        vault: { ...s.armies[armyId].vault, equipmentIds: [...s.armies[armyId].vault.equipmentIds, order.equipItemId] },
      }},
    }))
  }

  // Tax to army's country
  useWorldStore.getState().addTreasuryTax(army.countryCode, tax)

  // Record trade
  const trade: TradeRecord = {
    id: mkId('tr'), buyOrderId: 'vault_buy', sellOrderId: orderId,
    itemType: 'equipment', equipItemId: order.equipItemId,
    amount: 1, pricePerUnit: order.totalPrice, totalPrice: order.totalPrice,
    tax, buyer: `${army.name} [vault]`, seller: order.playerId,
    buyerCountry: army.countryCode, sellerCountry: order.countryCode,
    timestamp: Date.now(),
  }

  set(s => ({
    orders: s.orders.map(o => o.id === orderId ? { ...o, status: 'filled' as const, filledAmount: 1 } : o),
    trades: [trade, ...s.trades].slice(0, 200),
  }))

  return { success: true, message: `Vault bought ${order.equipSnapshot?.name} for $${order.totalPrice.toLocaleString()}! (Tax: $${tax})` }
}
