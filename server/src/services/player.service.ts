/**
 * Player Service — shared business logic for player actions
 * XP, leveling, damage calc, bar consumption, etc.
 */
import { db } from '../db/connection.js'
import { players, items } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'

// ── XP per level tier ──
function xpForLevel(level: number): number {
  if (level <= 10) return 100
  if (level <= 20) return 150
  return 200
}

/** Grant XP and auto-level-up, returns updated level info */
export async function grantXP(playerId: string, xpAmount: number) {
  const [p] = await db.select({
    experience: players.experience,
    level: players.level,
    expToNext: players.expToNext,
    skillPoints: players.skillPoints,
  }).from(players).where(eq(players.id, playerId)).limit(1)
  if (!p) throw new Error('Player not found')

  let xp = p.experience! + xpAmount
  let level = p.level!
  let sp = p.skillPoints!
  let nextXp = p.expToNext!

  while (xp >= nextXp) {
    xp -= nextXp
    level++
    sp += 4
    nextXp = xpForLevel(level)
  }

  await db.update(players)
    .set({ experience: xp, level, skillPoints: sp, expToNext: nextXp })
    .where(eq(players.id, playerId))

  return { level, experience: xp, skillPoints: sp, expToNext: nextXp }
}

/** Consume a resource bar, returns success */
export async function consumeBar(
  playerId: string,
  bar: 'stamina' | 'hunger' | 'entrepreneurship' | 'work',
  amount: number
): Promise<boolean> {
  const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
  if (!p) return false

  const current = Number(p[bar] ?? 0)
  if (current < amount) return false

  await db.update(players)
    .set({ [bar]: current - amount })
    .where(eq(players.id, playerId))

  return true
}

/** Spend money, returns false if insufficient */
export async function spendMoney(playerId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return false
  const result = await db.execute(sql`
    UPDATE players SET money = money - ${amount}
    WHERE id = ${playerId} AND money >= ${amount}
  `)
  return (result as any).rowCount > 0
}

/** Earn money */
export async function earnMoney(playerId: string, amount: number): Promise<void> {
  if (amount <= 0) return
  await db.execute(sql`
    UPDATE players SET money = money + ${amount}
    WHERE id = ${playerId}
  `)
}

/** Get player by ID (full row) */
export async function getPlayerById(playerId: string) {
  const [p] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
  return p || null
}

/** Compute server-side damage using player stats + equipped items */
export async function calculateAttackDamage(playerId: string): Promise<{
  damage: number
  isCrit: boolean
  isDodged: boolean
  xpGain: number
}> {
  const p = await getPlayerById(playerId)
  if (!p) throw new Error('Player not found')

  // Check stamina
  const stamina = Number(p.stamina ?? 0)
  if (stamina < 1) throw new Error('Not enough stamina')

  // Get equipped items for stat calculation
  const equippedItems = await db.select()
    .from(items)
    .where(sql`player_id = ${playerId} AND equipped = true`)

  // Aggregate item stats
  let eqDmg = 0, eqCritRate = 0, eqCritDmg = 0
  let eqArmor = 0, eqDodge = 0, eqPrecision = 0
  for (const item of equippedItems) {
    const stats = item.stats as any || {}
    eqDmg += stats.damage || 0
    eqCritRate += stats.critRate || 0
    eqCritDmg += stats.critDamage || 0
    eqArmor += stats.armor || 0
    eqDodge += stats.dodge || 0
    eqPrecision += stats.precision || 0
  }

  // Base damage = 100 + equipment
  let totalDmg = 100 + eqDmg
  let totalCritRate = 10 + eqCritRate
  let totalCritDmg = 100 + eqCritDmg
  const totalDodge = 5 + eqDodge
  const totalHitRate = Math.min(100, 50 + eqPrecision)

  // Ammo multiplier
  let damageMultiplier = 1.0
  const equippedAmmo = p.equippedAmmo || 'none'
  if (equippedAmmo !== 'none') {
    const ammoField = `${equippedAmmo}Bullets` as keyof typeof p
    const ammoCount = Number((p as any)[ammoField] ?? 0)
    if (ammoCount > 0) {
      if (equippedAmmo === 'green') damageMultiplier = 1.1
      else if (equippedAmmo === 'blue') damageMultiplier = 1.2
      else if (equippedAmmo === 'purple') damageMultiplier = 1.4
      else if (equippedAmmo === 'red') { damageMultiplier = 1.4; totalCritRate += 10 }

      // Consume 1 ammo
      await db.execute(sql`
        UPDATE players 
        SET ${sql.raw(`${equippedAmmo === 'green' ? 'green_bullets' : equippedAmmo === 'blue' ? 'blue_bullets' : equippedAmmo === 'purple' ? 'purple_bullets' : 'red_bullets'}`)} = 
        ${sql.raw(`${equippedAmmo === 'green' ? 'green_bullets' : equippedAmmo === 'blue' ? 'blue_bullets' : equippedAmmo === 'purple' ? 'purple_bullets' : 'red_bullets'}`)} - 1
        WHERE id = ${playerId}
      `)
    }
  }

  // Dodge check
  const isDodged = Math.random() < (totalDodge / 100)

  // Stamina cost
  let staminaCost = isDodged ? 0 : Math.max(0, 10 - (10 * (eqArmor / 100)))
  if (stamina < staminaCost) throw new Error('Not enough stamina')

  // Hit check
  const didHit = Math.random() * 100 < totalHitRate

  // Crit check
  const isCrit = Math.random() < (totalCritRate / 100)
  let finalMultiplier = damageMultiplier
  if (isCrit) finalMultiplier *= (1.5 + (totalCritDmg / 100))

  const rawDmg = didHit ? Math.floor(totalDmg * finalMultiplier) : Math.floor(totalDmg * finalMultiplier * 0.66)
  const finalDamage = Math.max(1, rawDmg)

  // Deduct stamina + grant XP + rank
  const xpGain = 25
  await db.execute(sql`
    UPDATE players SET 
      stamina = GREATEST(0, stamina::numeric - ${staminaCost})::text::numeric(6,1),
      rank = LEAST(100, rank::numeric + 0.5)::text::numeric(6,1),
      damage_done = damage_done + ${finalDamage}
    WHERE id = ${playerId}
  `)

  return { damage: finalDamage, isCrit, isDodged, xpGain }
}
