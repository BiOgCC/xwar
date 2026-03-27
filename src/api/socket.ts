import { io, Socket } from 'socket.io-client'
import { getAuthToken } from './client'
import { syncLeyLineStateFromServer } from '../stores/leyLineStore'

const SOCKET_URL = 'http://localhost:3001'

class SocketManager {
  public socket: Socket | null = null

  connect() {
    if (this.socket?.connected) return

    const token = getAuthToken()
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true
    })

    this.socket.on('connect', () => {
      console.log('[WS] Connected to XWAR Server:', this.socket?.id)
      // Auto-join ley line broadcast room
      this.socket?.emit('join:leylines')
    })

    this.socket.on('disconnect', () => {
      console.log('[WS] Disconnected from server')
    })

    // ── Ley Line real-time events ──
    this.socket.on('leyline:state', (payload: unknown) => {
      syncLeyLineStateFromServer(payload as Parameters<typeof syncLeyLineStateFromServer>[0])
    })

    this.socket.on('leyline:activated', (payload: { lineId: string; lineName: string; archetype: string }) => {
      console.log(`[LEY LINE] ⚡ ${payload.lineName} activated (${payload.archetype})`)
    })

    this.socket.on('leyline:deactivated', (payload: { lineId: string; lineName: string }) => {
      console.log(`[LEY LINE] 💀 ${payload.lineName} deactivated`)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinBattle(battleId: string) {
    this.socket?.emit('join:battle', battleId)
  }

  joinMarket() {
    this.socket?.emit('join:market')
  }

  joinCountry(countryCode: string) {
    this.socket?.emit('join:country', countryCode)
  }

  // Add event listener
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.socket) this.connect()
    this.socket?.on(event, callback)
  }

  // Remove event listener
  off(event: string, callback: (...args: any[]) => void) {
    this.socket?.off(event, callback)
  }
}

export const socketManager = new SocketManager()

// ── Presence Heartbeat ──
let _presenceInterval: ReturnType<typeof setInterval> | null = null

export function startPresenceHeartbeat() {
  if (_presenceInterval) return
  _presenceInterval = setInterval(() => {
    socketManager.socket?.emit('presence:heartbeat')
  }, 30_000)
}

export function stopPresenceHeartbeat() {
  if (_presenceInterval) {
    clearInterval(_presenceInterval)
    _presenceInterval = null
  }
}
