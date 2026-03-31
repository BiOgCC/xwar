/**
 * Server-side Game Clock — drives all tick-based simulation phases.
 * Mirrors the client-side GameClock.ts but runs authoritatively on the server.
 *
 * Phase 1: Only the 'combat' phase is wired. Future phases (stock, economy,
 * military, cyber, training, government, region) will be added incrementally.
 */

import type { Server as SocketServer } from 'socket.io'
import { logger } from '../utils/logger.js'

// ═══════════════════════════════════════════════
//  TICK PHASES & CADENCE
// ═══════════════════════════════════════════════

export type TickPhase =
  | 'combat'       // Every 120s (2 min)
  | 'military'     // Every 15s
  | 'cyber'        // Every 15s
  | 'training'     // Every 15s
  | 'government'   // Every 15s
  | 'region'       // Every 10s
  | 'stock'        // Every 10s
  | 'economy'      // Every 1800s (30 min)

const PHASE_ORDER: TickPhase[] = [
  'combat', 'military', 'cyber', 'training', 'government',
  'region', 'stock', 'economy',
]

const PHASE_CADENCE: Record<TickPhase, number> = {
  combat: 120,
  military: 15,
  cyber: 15,
  training: 15,
  government: 15,
  region: 10,
  stock: 10,
  economy: 1800,
}

type PhaseHandler = () => void

// ═══════════════════════════════════════════════
//  SERVER GAME CLOCK
// ═══════════════════════════════════════════════

class ServerGameClock {
  private tickNumber = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private subscribers = new Map<TickPhase, Set<PhaseHandler>>()
  private countdowns: Record<TickPhase, number>
  private io: SocketServer | null = null

  constructor() {
    this.countdowns = {} as Record<TickPhase, number>
    for (const phase of PHASE_ORDER) {
      this.countdowns[phase] = PHASE_CADENCE[phase]
      this.subscribers.set(phase, new Set())
    }
  }

  /** Attach Socket.IO server for broadcasting countdown updates */
  setIO(io: SocketServer): void {
    this.io = io
  }

  /** Start the global clock. Call once at server boot. */
  start(): void {
    if (this.intervalId !== null) return
    logger.info('[GameClock] Server clock started — combat tick every 120s (2 min)')

    this.intervalId = setInterval(() => {
      this.tickNumber++

      for (const phase of PHASE_ORDER) {
        this.countdowns[phase]--

        if (this.countdowns[phase] <= 0) {
          this.countdowns[phase] = PHASE_CADENCE[phase]
          this.firePhase(phase)
        }
      }
    }, 1000)
  }

  /** Stop the global clock. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('[GameClock] Server clock stopped')
    }
  }

  /** Subscribe a handler to a phase. Returns an unsubscribe function. */
  subscribe(phase: TickPhase, handler: PhaseHandler): () => void {
    const handlers = this.subscribers.get(phase)!
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  }

  /** Current global tick number */
  getTick(): number {
    return this.tickNumber
  }

  /** Get countdown for a phase */
  getCountdown(phase: TickPhase): number {
    return this.countdowns[phase]
  }

  /** Get cadence for a phase */
  getCadence(phase: TickPhase): number {
    return PHASE_CADENCE[phase]
  }

  private firePhase(phase: TickPhase): void {
    const handlers = this.subscribers.get(phase)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler()
      } catch (e) {
        logger.error(e, `[GameClock] ${phase} handler error:`)
      }
    }
  }
}

/** Global singleton */
export const serverClock = new ServerGameClock()
