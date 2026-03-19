import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'

import authRoutes from './routes/auth.routes.js'
import playerRoutes from './routes/player.routes.js'
import inventoryRoutes from './routes/inventory.routes.js'
import worldRoutes from './routes/world.routes.js'

const app = express()
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: { origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true },
})

// ── Middleware ──
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }))
app.use(express.json())

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ──
app.use('/api/auth', authRoutes)
app.use('/api/player', playerRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/world', worldRoutes)

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
})
