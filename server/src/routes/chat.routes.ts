import { Router } from 'express'
import { desc, eq, and, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../db/connection.js'
import { chatMessages, players } from '../db/schema.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()

type ChatChannel = 'global' | 'country' | 'alliance' | 'whisper'

interface PlayerChatContext {
  id: string
  name: string
  countryCode: string
  avatar: string | null
  allianceId: string | null
}

let schemaReady = false

async function ensureChatSchema() {
  if (schemaReady) return
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      channel varchar(16) NOT NULL,
      scope_id varchar(64),
      sender_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      sender_name varchar(32) NOT NULL,
      sender_country varchar(4) REFERENCES countries(code),
      content text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_scope ON chat_messages(scope_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at)`)
  schemaReady = true
}

async function getPlayerChatContext(playerId: string): Promise<PlayerChatContext | null> {
  const [player] = await db
    .select({
      id: players.id,
      name: players.name,
      countryCode: players.countryCode,
      avatar: players.avatar,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)

  if (!player?.countryCode) return null

  const allianceResult = await db.execute(sql`
    SELECT id
    FROM alliances
    WHERE leader_id = ${playerId}
       OR members @> ${JSON.stringify([{ id: playerId }])}::jsonb
    LIMIT 1
  `)
  const allianceRows = Array.isArray(allianceResult) ? allianceResult : (allianceResult as any)?.rows ?? []

  return {
    id: player.id,
    name: player.name,
    countryCode: player.countryCode,
    avatar: player.avatar ?? null,
    allianceId: allianceRows[0]?.id ?? null,
  }
}

function serializeMessage(row: any, avatarMap: Record<string, string> = {}) {
  return {
    id: row.id,
    channel: row.channel,
    sender: row.senderName,
    senderCountry: row.senderCountry ?? '',
    senderAvatar: avatarMap[row.senderId] ?? null,
    content: row.content,
    timestamp: new Date(row.createdAt).getTime(),
  }
}

router.use(requireAuth as any)

router.get('/bootstrap', async (req, res) => {
  try {
    await ensureChatSchema()

    const { playerId } = (req as AuthRequest).player!
    const ctx = await getPlayerChatContext(playerId)
    if (!ctx) {
      res.status(404).json({ error: 'Player context not found' })
      return
    }

    const [globalRows, countryRows, allianceRows] = await Promise.all([
      db.select().from(chatMessages).where(and(eq(chatMessages.channel, 'global'), isNull(chatMessages.scopeId))).orderBy(desc(chatMessages.createdAt)).limit(50),
      db.select().from(chatMessages).where(and(eq(chatMessages.channel, 'country'), eq(chatMessages.scopeId, ctx.countryCode))).orderBy(desc(chatMessages.createdAt)).limit(50),
      ctx.allianceId
        ? db.select().from(chatMessages).where(and(eq(chatMessages.channel, 'alliance'), eq(chatMessages.scopeId, ctx.allianceId))).orderBy(desc(chatMessages.createdAt)).limit(50)
        : Promise.resolve([] as any[]),
    ])

    const allRows = [...globalRows, ...countryRows, ...allianceRows]
    const senderIds = [...new Set(allRows.map((row: any) => row.senderId).filter(Boolean))]
    const avatarMap: Record<string, string> = {}

    if (senderIds.length > 0) {
      const avatarRows = await db
        .select({ id: players.id, avatar: players.avatar })
        .from(players)
        .where(inArray(players.id, senderIds as [string, ...string[]]))

      for (const avatarRow of avatarRows) {
        avatarMap[avatarRow.id] = avatarRow.avatar ?? ''
      }
    }

    res.json({
      success: true,
      allianceId: ctx.allianceId,
      messages: {
        global: [...globalRows].reverse().map((row) => serializeMessage(row, avatarMap)),
        country: [...countryRows].reverse().map((row) => serializeMessage(row, avatarMap)),
        alliance: [...allianceRows].reverse().map((row) => serializeMessage(row, avatarMap)),
        whisper: [],
      },
    })
  } catch (err) {
    console.error('[CHAT] bootstrap error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/message', async (req, res) => {
  try {
    await ensureChatSchema()

    const { playerId } = (req as AuthRequest).player!
    const ctx = await getPlayerChatContext(playerId)
    if (!ctx) {
      res.status(404).json({ error: 'Player context not found' })
      return
    }

    const channel = req.body?.channel as ChatChannel
    const rawContent = typeof req.body?.content === 'string' ? req.body.content : ''
    const content = rawContent.trim()

    if (!['global', 'country', 'alliance'].includes(channel)) {
      res.status(400).json({ error: 'Unsupported chat channel' })
      return
    }

    if (!content || content.length > 500) {
      res.status(400).json({ error: 'Message must be between 1 and 500 characters' })
      return
    }

    let scopeId: string | null = null
    let room = 'chat:global'

    if (channel === 'country') {
      scopeId = ctx.countryCode
      room = `chat:country:${scopeId}`
    }

    if (channel === 'alliance') {
      if (!ctx.allianceId) {
        res.status(403).json({ error: 'You are not in an alliance' })
        return
      }
      scopeId = ctx.allianceId
      room = `chat:alliance:${scopeId}`
    }

    const [message] = await db.insert(chatMessages).values({
      channel,
      scopeId,
      senderId: ctx.id,
      senderName: ctx.name,
      senderCountry: ctx.countryCode,
      content,
    }).returning()

    const payload = {
      ...serializeMessage(message),
      senderAvatar: ctx.avatar,
    }
    const io = req.app.get('io')
    if (io) {
      io.to(room).emit('chat:message', payload)
    }

    res.status(201).json({ success: true, message: payload })
  } catch (err) {
    console.error('[CHAT] send error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
