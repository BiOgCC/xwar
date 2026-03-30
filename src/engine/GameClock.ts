// ══════════════════════════════════════════════
// XWAR — Unified Game Clock
// Single 1-second heartbeat driving all simulation systems.
// Each system fires at its own cadence (10s, 15s, 30min, etc.)
// ══════════════════════════════════════════════

/**
 * Tick phases ordered by priority.
 * Within the same second, phases fire in this deterministic order.
 */
export type TickPhase =
  | 'combat'       // Every 15s — battle resolution, player combat tick
  | 'military'     // Every 15s — detection windows, stamina contests
  | 'cyber'        // Every 15s — cyber detection, stamina contests
  | 'training'     // Every 15s — army training progress
  | 'government'   // Every 15s — shop spawn, contract maturity
  | 'region'       // Every 10s — region capture progress
  | 'stock'        // Every 10s — stock price tick + bond resolution
  | 'economy'      // Every 1800s (30 min) — company production, market prices

/** The deterministic execution order when multiple phases fire in the same second */
const PHASE_ORDER: TickPhase[] = [
  'combat', 'military', 'cyber', 'training', 'government',
  'region', 'stock', 'economy',
]

/** Cadence in seconds for each phase */
const PHASE_CADENCE: Record<TickPhase, number> = {
  combat: 15,
  military: 15,
  cyber: 15,
  training: 15,
  government: 15,
  region: 10,
  stock: 10,
  economy: 1800,
}

type PhaseHandler = () => void
type UnsubscribeFn = () => void

class GameClock {
  private tickNumber = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private subscribers = new Map<TickPhase, Set<PhaseHandler>>()

  // UI-facing countdown timers (seconds until next fire)
  private countdowns: Record<TickPhase, number>

  // Listeners for countdown updates (for React hooks)
  private countdownListeners = new Set<() => void>()

  constructor() {
    // Initialize countdowns to each phase's cadence
    this.countdowns = {} as Record<TickPhase, number>
    for (const phase of PHASE_ORDER) {
      this.countdowns[phase] = PHASE_CADENCE[phase]
      this.subscribers.set(phase, new Set())
    }
  }

  /** Start the global clock. Call once at app mount. */
  start(): void {
    if (this.intervalId !== null) return // Already running

    this.intervalId = setInterval(() => {
      this.tickNumber++

      // Fire phases in deterministic order
      for (const phase of PHASE_ORDER) {
        // Decrement countdown
        this.countdowns[phase]--

        if (this.countdowns[phase] <= 0) {
          // Reset countdown
          this.countdowns[phase] = PHASE_CADENCE[phase]
          // Fire all handlers for this phase
          this.firePhase(phase)
        }
      }

      // Notify countdown listeners (for UI updates)
      this.countdownListeners.forEach(fn => fn())
    }, 1000)
  }

  /** Stop the global clock. Call on app unmount. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /** Subscribe a handler to a phase. Returns an unsubscribe function. */
  subscribe(phase: TickPhase, handler: PhaseHandler): UnsubscribeFn {
    const handlers = this.subscribers.get(phase)!
    handlers.add(handler)
    return () => { handlers.delete(handler) }
  }

  /** Get the current countdown (seconds until next fire) for a phase */
  getCountdown(phase: TickPhase): number {
    return this.countdowns[phase]
  }

  /** Get the total cadence for a phase */
  getCadence(phase: TickPhase): number {
    return PHASE_CADENCE[phase]
  }

  /** Subscribe to countdown updates (fires every second) */
  onCountdownUpdate(fn: () => void): UnsubscribeFn {
    this.countdownListeners.add(fn)
    return () => { this.countdownListeners.delete(fn) }
  }

  /** Force-fire the economy phase (manual tick button) */
  forceEconomy(): void {
    this.firePhase('economy')
    this.countdowns.economy = PHASE_CADENCE.economy
    this.countdownListeners.forEach(fn => fn())
  }

  /** Current global tick number (monotonic) */
  getTick(): number {
    return this.tickNumber
  }

  private firePhase(phase: TickPhase): void {
    const handlers = this.subscribers.get(phase)
    if (!handlers) return
    for (const handler of handlers) {
      try {
        handler()
      } catch (e) {
        console.warn(`[GameClock] ${phase} handler error:`, e)
      }
    }
  }
}

/** Global singleton — import this everywhere */
export const gameClock = new GameClock()
