import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import pinoHttp from 'pino-http'
import { logger } from './utils/logger.js'

import authRoutes from './routes/auth.routes.js'
import playerRoutes from './routes/player.routes.js'
import inventoryRoutes from './routes/inventory.routes.js'
import worldRoutes from './routes/world.routes.js'
import casinoRoutes from './routes/casino.routes.js'
import armyRoutes from './routes/army.routes.js'
import battleRoutes from './routes/battle.routes.js'
import marketRoutes from './routes/market.routes.js'
import companyRoutes from './routes/company.routes.js'
import govRoutes from './routes/gov.routes.js'
import skillsRoutes from './routes/skills.routes.js'
import stockRoutes from './routes/stock.routes.js'
import bountyRoutes from './routes/bounty.routes.js'
import cyberRoutes from './routes/cyber.routes.js'
import allianceRoutes from './routes/alliance.routes.js'
import warcardsRoutes from './routes/warcards.routes.js'
import dailyRoutes from './routes/daily.routes.js'
import navalRoutes from './routes/naval.routes.js'
import researchRoutes from './routes/research.routes.js'
import tradeRouteRoutes from './routes/trade-routes.routes.js'
import adminRoutes from './routes/admin.routes.js'
import leyLineRoutes from './routes/leylines.router.js'

import { generalLimiter, authLimiter, casinoLimiter } from './middleware/rateLimit.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initCronJobs } from './services/cron.service.js'

// ── Role Management ──
const args = process.argv.slice(2)
const isApi = args.includes('--api')
const isWs = args.includes('--ws')
const isCron = args.includes('--cron')

// If no specific role is passed, run everything (monolith dev mode fallback)
const runAll = !isApi && !isWs && !isCron
const runApi = isApi || runAll
const runWs = isWs || runAll
const runCron = isCron || runAll

const app = express()
const httpServer = createServer(app)

// Export io so it isn't undefined if imported elsewhere (even if disabled)
let ioInstance: SocketServer | null = null
if (runWs) {
  ioInstance = new SocketServer(httpServer, {
    cors: { origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], credentials: true },
  })
}
const io = ioInstance

if (runApi) {
  // ── Middleware ──
  app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], credentials: true }))
  app.use(express.json())
  app.use(pinoHttp({ logger }))
  app.use(generalLimiter)

  // ── Health check ──
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), roles: { api: runApi, ws: runWs, cron: runCron } })
  })

  // ── Routes ──
  app.use('/api/auth', authLimiter, authRoutes)
  app.use('/api/player', playerRoutes)
  app.use('/api/inventory', inventoryRoutes)
  app.use('/api/world', worldRoutes)
  app.use('/api/casino', casinoLimiter, casinoRoutes)
  app.use('/api/army', armyRoutes)
  app.use('/api/battle', battleRoutes)
  app.use('/api/market', marketRoutes)
  app.use('/api/company', companyRoutes)
  app.use('/api/gov', govRoutes)
  app.use('/api/skills', skillsRoutes)
  app.use('/api/stock', stockRoutes)
  app.use('/api/bounty', bountyRoutes)
  app.use('/api/cyber', cyberRoutes)
  app.use('/api/alliance', allianceRoutes)
  app.use('/api/warcards', warcardsRoutes)
  app.use('/api/daily', dailyRoutes)
  app.use('/api/naval', navalRoutes)
  app.use('/api/research', researchRoutes)
  app.use('/api/trade-routes', tradeRouteRoutes)
  app.use('/api/admin', authLimiter, adminRoutes)
  app.use('/api/ley-lines', leyLineRoutes)

  // ── Global error handler (must be AFTER routes) ──
  app.use(errorHandler)
}

// ── WebSocket ──
if (runWs && io) {
  io.on('connection', (socket) => {
    logger.info(`[WS] Client connected: ${socket.id}`)

    // Personal room — allows targeted salary:paid, company:disabled events
    socket.on('authenticate', (playerId: string) => {
      if (typeof playerId === 'string' && playerId.length > 0) {
        socket.join(`player:${playerId}`)
        logger.info(`[WS] ${socket.id} joined personal room player:${playerId}`)
      }
    })

    // Country room — fund:update, election:result, battle:started broadcasts
    socket.on('join:country', (countryCode: string) => {
      if (typeof countryCode === 'string' && countryCode.length >= 2) {
        socket.join(`country:${countryCode}`)
      }
    })

    socket.on('join:battle', (battleId: string) => {
      socket.join(`battle:${battleId}`)
    })

    socket.on('join:market', () => {
      socket.join('market')
    })

    // Global ley line updates
    socket.on('join:leylines', () => {
      socket.join('leylines')
    })

    socket.on('disconnect', () => {
      logger.info(`[WS] Client disconnected: ${socket.id}`)
    })
  })
}

// Export io for use in routes
export { io }

/**
 * Emit a game event to all connected clients or a specific room.
 * Call from any route/cron: emitGameEvent('news', { headline: '...' })
 */
export function emitGameEvent(event: string, data: any, room?: string) {
  if (!io) return
  if (room) {
    io.to(room).emit(event, data)
  } else {
    io.emit(event, data)
  }
}

// ── Start ──
const portArgIndex = args.indexOf('--port')
const portOverride = portArgIndex !== -1 ? args[portArgIndex + 1] : null
const PORT = parseInt(portOverride || process.env.PORT || '3001', 10)

if (runApi || runWs) {
  httpServer.listen(PORT, () => {
    logger.info(`
  ╔══════════════════════════════════════════╗
  ║  XWAR Server running on port ${PORT}      
  ║  Roles Enabled:
  ║  - API:  ${runApi ? 'YES' : 'NO '}
  ║  - WS:   ${runWs ? 'YES' : 'NO '}
  ║  - CRON: ${runCron ? 'YES' : 'NO '}
  ╚══════════════════════════════════════════╝
    `)
  })
}

// Start cron jobs
if (runCron) {
  initCronJobs()
  // If only running cron, we log it separately since the HTTP server won't boot
  if (!runApi && !runWs) {
    logger.info(`[CRON] Standalone Cron Ticker Server Started Successfully.`)
  }
}
