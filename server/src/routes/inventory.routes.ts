import { Router } from 'express'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { items, playerSkills } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { rollLootBoxItem, rollMilitaryBoxItem, rollItemOfTier, generateWelcomeKit, generateStats, WEAPON_SUBTYPES } from '../services/inventory.service.js'
import { players } from '../db/schema.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()
router.use(requireAuth as any)

// ── GET /api/inventory ── Player's items (optionally filtered by location)
router.get('/', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const location = req.query.location as string | undefined

    let query = db.select().from(items).where(eq(items.ownerId, playerId))

    const allItems = await query
    const filtered = location
      ? allItems.filter(i => i.location === location)
      : allItems

    res.json({ items: filtered })
  } catch (err) {
    console.error('[INVENTORY] Get error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/equip/:id ── Equip an item
router.post('/equip/:id', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const itemId = req.params.id

    // Find the item
    const [item] = await db.select().from(items)
      .where(and(eq(items.id, itemId), eq(items.ownerId, playerId)))
      .limit(1)

    if (!item) { res.status(404).json({ error: 'Item not found' }); return }
    if (item.location !== 'inventory') { res.status(400).json({ error: 'Item not in inventory' }); return }

    // Unequip any item in the same slot
    await db.update(items).set({ equipped: false })
      .where(and(
        eq(items.ownerId, playerId),
        eq(items.slot, item.slot),
        eq(items.equipped, true),
      ))

    // Equip this item
    await db.update(items).set({ equipped: true }).where(eq(items.id, itemId))

    res.json({ success: true, itemId })
  } catch (err) {
    console.error('[INVENTORY] Equip error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/unequip/:id ── Unequip an item
router.post('/unequip/:id', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const itemId = req.params.id

    const [item] = await db.select().from(items)
      .where(and(eq(items.id, itemId), eq(items.ownerId, playerId)))
      .limit(1)

    if (!item) { res.status(404).json({ error: 'Item not found' }); return }

    await db.update(items).set({ equipped: false }).where(eq(items.id, itemId))
    res.json({ success: true, itemId })
  } catch (err) {
    console.error('[INVENTORY] Unequip error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/dismantle/:id ── Dismantle for scrap
router.post('/dismantle/:id', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const itemId = req.params.id

    const [item] = await db.select().from(items)
      .where(and(eq(items.id, itemId), eq(items.ownerId, playerId)))
      .limit(1)

    if (!item) { res.status(404).json({ error: 'Item not found' }); return }
    if (item.equipped) { res.status(400).json({ error: 'Cannot dismantle equipped item' }); return }
    if (item.location !== 'inventory') { res.status(400).json({ error: 'Item not in inventory' }); return }

    const SCRAP_VALUES: Record<string, number> = {
      t1: 6, t2: 18, t3: 56, t4: 162, t5: 486, t6: 1480, t7: 4500,
    }
    const scrapGain = SCRAP_VALUES[item.tier] || 6

    // Delete item + add scrap
    await db.delete(items).where(eq(items.id, itemId))
    await db.update(players).set({
      scrap: (await db.select({ scrap: players.scrap }).from(players).where(eq(players.id, playerId)))[0].scrap! + scrapGain,
    }).where(eq(players.id, playerId))

    res.json({ success: true, scrapGained: scrapGain })
  } catch (err) {
    console.error('[INVENTORY] Dismantle error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/sell/:id ── Sell for money
router.post('/sell/:id', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const itemId = req.params.id

    const [item] = await db.select().from(items)
      .where(and(eq(items.id, itemId), eq(items.ownerId, playerId)))
      .limit(1)

    if (!item) { res.status(404).json({ error: 'Item not found' }); return }
    if (item.equipped) { res.status(400).json({ error: 'Cannot sell equipped item' }); return }
    if (item.location !== 'inventory') { res.status(400).json({ error: 'Item not in inventory' }); return }

    const TIER_SELL_PRICE: Record<string, number> = {
      t1: 1200, t2: 5000, t3: 25000, t4: 90000, t5: 280000, t6: 830000, t7: 2500000
    }
    const moneyGain = TIER_SELL_PRICE[item.tier] || 1200

    await db.delete(items).where(eq(items.id, itemId))
    await db.update(players).set({
      money: (await db.select({ money: players.money }).from(players).where(eq(players.id, playerId)))[0].money! + moneyGain,
    }).where(eq(players.id, playerId))

    res.json({ success: true, moneyGained: moneyGain })
  } catch (err) {
    console.error('[INVENTORY] Sell error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/open-box ── Open a loot/military/supply box (server-side RNG)
router.post('/open-box', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { boxType } = req.body // 'loot', 'military', or 'supply'

    if (!['loot', 'military', 'supply'].includes(boxType)) {
      res.status(400).json({ error: 'Invalid box type' })
      return
    }

    // Check player has boxes
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    // ── Supply Box (no item, only resources) ──────────────────────
    if (boxType === 'supply') {
      const supplyBoxes = (player as any).supplyBoxes ?? 0
      if (supplyBoxes <= 0) {
        res.status(400).json({ error: 'No supply boxes available' })
        return
      }

      // Decrement supply boxes
      await db.execute(sql`UPDATE players SET supply_boxes = supply_boxes - 1 WHERE id = ${playerId}`)

      // Roll reward (server RNG)
      const roll = Math.random() * 100
      let reward: Record<string, unknown> = {}
      let rewardType = 'resources'

      if (roll < 50) {
        // 50%: scrap (2000-8000) [x10]
        const scrap = 2000 + Math.floor(Math.random() * 6001)
        await db.execute(sql`UPDATE players SET scrap = scrap + ${scrap} WHERE id = ${playerId}`)
        reward = { scrap }
      } else if (roll < 80) {
        // 30%: random bullets (100-300) [x10]
        const bulletFields = ['green_bullets', 'blue_bullets', 'purple_bullets', 'red_bullets'] as const
        const bulletTypes = ['greenBullets', 'blueBullets', 'purpleBullets', 'redBullets'] as const
        const rIdx = Math.floor(Math.random() * bulletFields.length)
        const amount = 100 + Math.floor(Math.random() * 201)
        await db.execute(sql`UPDATE players SET ${sql.raw(bulletFields[rIdx])} = ${sql.raw(bulletFields[rIdx])} + ${amount} WHERE id = ${playerId}`)
        reward = { bulletType: bulletTypes[rIdx], bulletAmount: amount }
        rewardType = 'bullets'
      } else {
        // 20%: food (500-1500) [x10]
        const foodTypes = ['bread', 'sushi', 'wagyu'] as const
        const foodType = foodTypes[Math.floor(Math.random() * foodTypes.length)]
        const amount = 500 + Math.floor(Math.random() * 1001)
        await db.execute(sql`UPDATE players SET ${sql.raw(foodType)} = ${sql.raw(foodType)} + ${amount} WHERE id = ${playerId}`)
        reward = { foodType, foodAmount: amount }
        rewardType = 'food'
      }

      res.json({ success: true, rewardType, ...reward })
      return
    }

    // ── Loot / Military Box ───────────────────────────────────────
    const boxField = boxType === 'loot' ? 'lootBoxes' : 'militaryBoxes'
    const boxCount = player[boxField as keyof typeof player] as number
    if (boxCount <= 0) {
      res.status(400).json({ error: `No ${boxType} boxes available` })
      return
    }

    // Decrement box count
    await db.update(players).set({
      [boxField]: boxCount - 1,
    }).where(eq(players.id, playerId))

    // Roll item (server-side RNG)
    const newItem = boxType === 'loot' ? rollLootBoxItem(playerId) : rollMilitaryBoxItem(playerId)

    // Insert into DB with real UUID
    const itemId = uuidv4()
    const insertedItem = { ...newItem, id: itemId }
    await db.insert(items).values(insertedItem)

    // Add bonus resources for loot boxes
    let bonusMoney = 0
    let bonusScrap = 0
    let bonusGreenBullets = 0
    let bonusBlueBullets = 0
    if (boxType === 'loot') {
      bonusMoney = Math.floor(Math.random() * 300) + 50
      bonusScrap = Math.floor(Math.random() * 180) + 20
      // Civilian boxes grant 9-29 green and 9-29 blue ammo
      bonusGreenBullets = 9 + Math.floor(Math.random() * 21)
      bonusBlueBullets = 9 + Math.floor(Math.random() * 21)
      await db.execute(sql`UPDATE players SET money = money + ${bonusMoney}, scrap = scrap + ${bonusScrap}, green_bullets = green_bullets + ${bonusGreenBullets}, blue_bullets = blue_bullets + ${bonusBlueBullets} WHERE id = ${playerId}`)
    }

    res.json({
      success: true,
      item: insertedItem,
      bonusMoney,
      bonusScrap,
      bonusGreenBullets,
      bonusBlueBullets,
    })
  } catch (err) {
    console.error('[INVENTORY] Open box error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/claim-welcome-kit ── One-time welcome kit grant (server-authoritative)
router.post('/claim-welcome-kit', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!

    // Check if already claimed
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    if ((player as any).welcomeKitClaimed) {
      res.status(400).json({ error: 'Welcome kit already claimed' })
      return
    }

    // Generate full gear set (T1-T6, all armor slots + all weapon subtypes)
    const gear = generateWelcomeKit(playerId)

    // Batch insert all items
    if (gear.length > 0) {
      await db.insert(items).values(gear)
    }

    // Grant resources
    // Rebalanced: enough for 6 companies + 24 upgrades + 10 tactical orders
    const RESOURCE_GRANTS: Record<string, number> = {
      money: 500_000,        // 6 companies (~300k) + 24 upgrades (132k) + buffer
      oil: 5_000,            // Starter supply for company upkeep
      material_x: 2_000,     // Starter ammo crafting
      scrap: 2_000,          // Starter item crafting
      bitcoin: 20,           // 6 companies (6) + 10 tac ops (10) + buffer (4)
      bread: 50,             // Moderate food supply
      sushi: 30,             // Moderate food supply
      wagyu: 20,             // Moderate food supply
      loot_boxes: 5,         // Small starting bonus
      military_boxes: 3,     // Small starting bonus
      supply_boxes: 2,       // Small starting bonus
      badges_of_honor: 15,   // 10 tac ops (10) + buffer (5)
    }

    // Build SET clause for resource grants
    const setClauses = Object.entries(RESOURCE_GRANTS)
      .map(([col, amount]) => `${col} = ${col} + ${amount}`)
      .join(', ')
    await db.execute(sql`UPDATE players SET ${sql.raw(setClauses)}, welcome_kit_claimed = true WHERE id = ${playerId}`)

    // Grant XP → exactly 10 levels (L1→L11: 10 × 100 XP = 1000)
    const xpGrant = 1000
    let level = player.level ?? 1
    let experience = (player.experience ?? 0) + xpGrant
    let expToNext = player.expToNext ?? 100
    let skillPoints = player.skillPoints ?? 0
    while (experience >= expToNext) {
      experience -= expToNext
      level++
      skillPoints += 4
      if (level <= 10) expToNext = 100
      else if (level <= 20) expToNext = 150
      else expToNext = 200
    }
    await db.update(players).set({
      level, experience, expToNext, skillPoints,
    }).where(eq(players.id, playerId))

    // Fetch the freshly inserted items to return
    const insertedItems = await db.select().from(items).where(eq(items.ownerId, playerId))

    res.json({
      success: true,
      itemCount: gear.length,
      items: insertedItems,
      xpGranted: xpGrant,
      resourceGrants: RESOURCE_GRANTS,
    })
  } catch (err) {
    console.error('[INVENTORY] Welcome kit claim error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/craft ── Craft an item from scrap + BTC
router.post('/craft', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { tier, slot, category } = req.body

    if (!tier || !slot || !category) {
      res.status(400).json({ error: 'tier, slot, and category are required' })
      return
    }

    const SCRAP_COSTS: Record<string, number> = {
      t1: 50, t2: 150, t3: 450, t4: 1350, t5: 4050, t6: 12150, t7: 36450,
    }
    const BTC_COST = 1
    const cost = SCRAP_COSTS[tier]
    if (!cost) { res.status(400).json({ error: 'Invalid tier' }); return }

    // Check player has scrap + BTC
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }
    if ((player.scrap ?? 0) < cost) {
      res.status(400).json({ error: `Not enough scrap (need ${cost}, have ${player.scrap ?? 0})` })
      return
    }
    if ((player.bitcoin ?? 0) < BTC_COST) {
      res.status(400).json({ error: `Not enough BTC (need ${BTC_COST})` })
      return
    }

    // Deduct scrap + BTC atomically
    const deductResult = await db.update(players).set({
      scrap: sql`${players.scrap} - ${cost}`,
      bitcoin: sql`${players.bitcoin} - ${BTC_COST}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.scrap} >= ${cost} AND ${players.bitcoin} >= ${BTC_COST}`
    ).returning()
    if (deductResult.length === 0) {
      res.status(400).json({ error: 'Not enough resources' }); return
    }

    // Generate item using canonical stats from inventory.service.ts
    const validTier = tier as 't1' | 't2' | 't3' | 't4' | 't5' | 't6' | 't7'
    let subtype: string | undefined
    if (slot === 'weapon' || category === 'weapon') {
      const subtypes = WEAPON_SUBTYPES[validTier]
      if (subtypes?.length) {
        subtype = subtypes[Math.floor(Math.random() * subtypes.length)]
      }
    }

    const result = generateStats(category, slot, validTier, subtype as any)

    // Superforging: industrialist skill gives 2% per level chance (max 20%), +9-16% all stats
    let isSuperforged = false
    const [skills] = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId)).limit(1)
    const indLevel = skills?.industrialist || 0
    const superforgeChance = Math.min(0.20, indLevel * 0.02)
    if (superforgeChance > 0 && Math.random() < superforgeChance) {
      isSuperforged = true
      const sfBonus = 1.09 + Math.random() * 0.07 // +9% to +16%
      for (const key of Object.keys(result.stats)) {
        if (typeof (result.stats as any)[key] === 'number') {
          (result.stats as any)[key] = Math.ceil((result.stats as any)[key] * sfBonus)
        }
      }
    }

    const itemId = uuidv4()
    const craftedItem = {
      id: itemId,
      ownerId: playerId,
      name: isSuperforged ? `\u26a1 ${result.name}` : result.name,
      slot,
      category,
      tier,
      weaponSubtype: result.weaponSubtype || null,
      stats: result.stats,
      equipped: false,
      durability: '100',
      location: 'inventory',
    }

    await db.insert(items).values(craftedItem)

    res.json({ success: true, item: { ...craftedItem, superforged: isSuperforged }, scrapCost: cost, btcCost: BTC_COST })
  } catch (err) {
    console.error('[INVENTORY] Craft error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/inventory/badge-purchase ── Buy equipment with Badges of Honor
router.post('/badge-purchase', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { tier } = req.body

    const BADGE_COSTS: Record<string, number> = { t2: 3, t3: 6, t4: 12 }
    const cost = BADGE_COSTS[tier]
    if (!cost) { res.status(400).json({ error: 'Invalid tier for badge purchase' }); return }

    // Check & deduct badges atomically
    const deductResult = await db.update(players).set({
      badgesOfHonor: sql`${players.badgesOfHonor} - ${cost}`,
    }).where(
      sql`${players.id} = ${playerId} AND ${players.badgesOfHonor} >= ${cost}`
    ).returning()
    if (deductResult.length === 0) {
      res.status(400).json({ error: `Not enough Badges of Honor (need ${cost})` }); return
    }

    // Generate random item of the requested tier
    const newItem = rollItemOfTier(tier as any, playerId)
    const itemId = uuidv4()
    const insertedItem = { ...newItem, id: itemId }
    await db.insert(items).values(insertedItem)

    res.json({ success: true, item: insertedItem, badgeCost: cost })
  } catch (err) {
    console.error('[INVENTORY] Badge purchase error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
