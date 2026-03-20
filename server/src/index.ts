import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'

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

import { generalLimiter, authLimiter, casinoLimiter } from './middleware/rateLimit.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initCronJobs } from './services/cron.service.js'

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true },
})

// ── Middleware ──
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }))
app.use(express.json())
app.use(generalLimiter)

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
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

// ── Global error handler (must be AFTER routes) ──
app.use(errorHandler)

// ── WebSocket ──
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`)

  socket.on('join:battle', (battleId: string) => {
    socket.join(`battle:${battleId}`)
  })

  socket.on('join:market', () => {
    socket.join('market')
  })

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`)
  })
})

// Export io for use in routes
export { io }

// ── Start ──
const PORT = parseInt(process.env.PORT || '3001', 10)
httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  XWAR API Server running on port ${PORT}    ║
║  Health: http://localhost:${PORT}/api/health ║
╚══════════════════════════════════════════╝
  `)

  // Start cron jobs after server is listening
  initCronJobs()
})
