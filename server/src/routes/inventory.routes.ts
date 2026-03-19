import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { items } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { rollLootBoxItem, rollMilitaryBoxItem } from '../services/inventory.service.js'
import { players } from '../db/schema.js'

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
      t1: 6, t2: 18, t3: 56, t4: 162, t5: 486, t6: 1480,
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

// ── POST /api/inventory/open-box ── Open a loot box (server-side RNG)
router.post('/open-box', async (req, res) => {
  try {
    const { playerId } = (req as AuthRequest).player!
    const { boxType } = req.body // 'loot' or 'military'

    if (!['loot', 'military'].includes(boxType)) {
      res.status(400).json({ error: 'Invalid box type' })
      return
    }

    // Check player has boxes
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
    if (!player) { res.status(404).json({ error: 'Player not found' }); return }

    const boxField = boxType === 'loot' ? 'lootBoxes' : 'militaryBoxes'
    const boxCount = player[boxField]!
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

    // Insert into DB
    await db.insert(items).values(newItem)

    // Add bonus resources for loot boxes
    let bonusMoney = 0
    let bonusScrap = 0
    if (boxType === 'loot') {
      bonusMoney = Math.floor(Math.random() * 300) + 50
      bonusScrap = Math.floor(Math.random() * 180) + 20
      await db.update(players).set({
        money: player.money! + bonusMoney,
        scrap: player.scrap! + bonusScrap,
      }).where(eq(players.id, playerId))
    }

    res.json({
      success: true,
      item: newItem,
      bonusMoney,
      bonusScrap,
    })
  } catch (err) {
    console.error('[INVENTORY] Open box error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
