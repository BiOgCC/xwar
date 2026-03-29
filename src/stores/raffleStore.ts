import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR Casino — Daily Raffle (12-Hour Event)
   
   Draws every 12 hours synced to UTC:
   - Draw #1 at 12:00 UTC (noon)
   - Draw #2 at 00:00 UTC (midnight)
   
   Single ticket price: $100K
   Max 10 tickets per player
   Winner gets 85%, treasury gets 15%
   Bots simulate other players buying in
   ══════════════════════════════════════════════ */

// ─── Bot names ───
const BOT_NAMES = [
  'SgtFury', 'IronWolf', 'NightHawk', 'Delta6', 'ViperX',
  'PhantomAce', 'SteelViper', 'WarDog', 'BlazeRunner', 'Echo9',
  'Reaper77', 'GhostOp', 'TankBuster', 'StormBreaker', 'RogueOne',
  'BlackMamba', 'HellFire', 'ColdSteel', 'RazorEdge', 'ShadowFox',
  'BulletProof', 'IronFist', 'WarHammer', 'NovaStar', 'ThunderX',
  'ApexSniper', 'WildCard', 'SteelRain', 'LoneHunter', 'DarkPulse',
  'BlitzKrieg', 'RaidBoss', 'ArmorKing', 'FlashPoint', 'NightOwl',
  'CopperHead', 'RedStorm', 'IceBreaker', 'FuryRoad', 'DeathBlow',
]

// ─── Constants ───
export const TICKET_PRICE = 100_000  // $100K per ticket
export const MAX_TICKETS_PER_PLAYER = 10
const WINNER_SHARE = 0.85
const TREASURY_SHARE = 0.15
const DRAW_ANIM_DURATION = 6000  // 6 sec draw animation (longer for drama)
const RESULT_DISPLAY_DURATION = 15000  // 15 sec result display (it's a big event)

// ─── UTC Draw Schedule ───
// Draws happen at 00:00 UTC and 12:00 UTC every day
const DRAW_HOURS = [0, 12]

/** Get the next draw time as a Date object */
export function getNextDrawTime(): Date {
  const now = new Date()
  const currentHourUTC = now.getUTCHours()
  const currentMinUTC = now.getUTCMinutes()

  for (const drawHour of DRAW_HOURS) {
    if (currentHourUTC < drawHour || (currentHourUTC === drawHour && currentMinUTC === 0)) {
      const next = new Date(now)
      next.setUTCHours(drawHour, 0, 0, 0)
      return next
    }
  }

  // Next draw is tomorrow at the first draw hour
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(DRAW_HOURS[0], 0, 0, 0)
  return tomorrow
}

/** Get seconds remaining until the next draw */
export function getSecondsUntilDraw(): number {
  const diff = getNextDrawTime().getTime() - Date.now()
  return Math.max(0, Math.floor(diff / 1000))
}

/** Get a label for the current draw period (e.g. "MAR 20 — 12:00 UTC") */
export function getDrawLabel(): string {
  const next = getNextDrawTime()
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const month = months[next.getUTCMonth()]
  const day = next.getUTCDate()
  const hour = next.getUTCHours().toString().padStart(2, '0')
  return `${month} ${day} — ${hour}:00 UTC`
}

export interface RaffleTicket {
  id: string
  owner: string
  isPlayer: boolean
}

export type RafflePhase = 'buying' | 'drawing' | 'result'

export interface RaffleState {
  phase: RafflePhase
  secondsUntilDraw: number
  drawLabel: string
  tickets: RaffleTicket[]
  pot: number
  playerTicketCount: number
  winnerName: string | null
  winnerPayout: number
  isPlayerWinner: boolean
  drawRevealIndex: number
  lastWinner: { name: string; payout: number; drawLabel: string } | null

  // Session stats
  totalSpent: number

  // Weekly Jackpot (Sunday 23:00 UTC)
  weeklyJackpot: number
  weeklyEntrants: string[]  // unique player names who bought tickets this week
  lastWeeklyJackpotAt: number
  lastWeeklyWinner: { name: string; payout: number } | null

  // Actions
  buyTicket: () => void
  processWeeklyJackpot: () => void
  getWeeklyJackpotInfo: () => { pot: number; entrants: number; nextDrawDate: string }
  _init: () => void
  _tick: () => void
  _draw: () => void
  _cleanup: () => void
}

let tickInterval: ReturnType<typeof setInterval> | null = null
let botInterval: ReturnType<typeof setInterval> | null = null
let drawAnimInterval: ReturnType<typeof setInterval> | null = null
let resultTimer: ReturnType<typeof setTimeout> | null = null

function clearAllTimers() {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
  if (botInterval) { clearInterval(botInterval); botInterval = null }
  if (drawAnimInterval) { clearInterval(drawAnimInterval); drawAnimInterval = null }
  if (resultTimer) { clearTimeout(resultTimer); resultTimer = null }
}

/**
 * Generate bot tickets that simulate a real player pool.
 * Bots buy more tickets as the draw gets closer (building excitement).
 * Total bot tickets scale based on time elapsed in the period.
 */
function generateBotBatch(): RaffleTicket[] {
  const tickets: RaffleTicket[] = []
  const count = 1 + Math.floor(Math.random() * 3) // 1-3 tickets per batch

  for (let i = 0; i < count; i++) {
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
    tickets.push({
      id: `raffle_b_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      owner: botName,
      isPlayer: false,
    })
  }
  return tickets
}

export const useRaffleStore = create<RaffleState>((set, get) => ({
  phase: 'buying',
  secondsUntilDraw: getSecondsUntilDraw(),
  drawLabel: getDrawLabel(),
  tickets: [],
  pot: 0,
  playerTicketCount: 0,
  winnerName: null,
  winnerPayout: 0,
  isPlayerWinner: false,
  drawRevealIndex: -1,
  lastWinner: null,
  totalSpent: 0,
  weeklyJackpot: 500_000,  // Starts with a seed
  weeklyEntrants: [],
  lastWeeklyJackpotAt: 0,
  lastWeeklyWinner: null,

  buyTicket: () => {
    const s = get()
    if (s.phase !== 'buying') return
    if (s.playerTicketCount >= MAX_TICKETS_PER_PLAYER) return

    const player = usePlayerStore.getState()
    if (player.money < TICKET_PRICE) return

    // ALPHA: Deduct money server-side via API (fire-and-forget)
    import('../api/client').then(({ api }) => {
      api.post('/casino/raffle/buy', { amount: TICKET_PRICE }).catch(() => {})
    })
    player.spendMoney(TICKET_PRICE)

    const ticket: RaffleTicket = {
      id: `raffle_p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      owner: player.name,
      isPlayer: true,
    }

    set(prev => ({
      tickets: [...prev.tickets, ticket],
      pot: prev.pot + TICKET_PRICE,
      playerTicketCount: prev.playerTicketCount + 1,
      totalSpent: prev.totalSpent + TICKET_PRICE,
      weeklyEntrants: prev.weeklyEntrants.includes(player.name)
        ? prev.weeklyEntrants
        : [...prev.weeklyEntrants, player.name],
      weeklyJackpot: prev.weeklyJackpot + Math.floor(TICKET_PRICE * 0.10),
    }))
  },

  _init: () => {
    clearAllTimers()

    const secsLeft = getSecondsUntilDraw()

    // Seed initial bot tickets based on how far into the period we are
    // A 12-hour period = 43200 seconds. More elapsed = more bots already bought in
    const elapsed = 43200 - secsLeft
    const elapsedRatio = Math.max(0, elapsed / 43200)
    const baseBotTickets = 15 + Math.floor(elapsedRatio * 60) // 15–75 bot tickets
    const initialBots: RaffleTicket[] = []
    for (let i = 0; i < baseBotTickets; i++) {
      const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
      initialBots.push({
        id: `raffle_seed_${i}_${Math.random().toString(36).substr(2, 6)}`,
        owner: botName,
        isPlayer: false,
      })
    }

    set({
      phase: 'buying',
      secondsUntilDraw: secsLeft,
      drawLabel: getDrawLabel(),
      tickets: initialBots,
      pot: initialBots.length * TICKET_PRICE,
      playerTicketCount: 0,
      winnerName: null,
      winnerPayout: 0,
      isPlayerWinner: false,
      drawRevealIndex: -1,
    })

    // Tick every second to update countdown
    tickInterval = setInterval(() => {
      get()._tick()
    }, 1000)

    // Bots trickle in every 30-90 seconds
    botInterval = setInterval(() => {
      const s = get()
      if (s.phase !== 'buying') return

      const batch = generateBotBatch()
      set(prev => ({
        tickets: [...prev.tickets, ...batch],
        pot: prev.pot + batch.length * TICKET_PRICE,
      }))
    }, 30000 + Math.random() * 60000)
  },

  _tick: () => {
    const s = get()
    if (s.phase !== 'buying') return

    const newSecs = getSecondsUntilDraw()

    if (newSecs <= 0) {
      get()._draw()
    } else {
      set({ secondsUntilDraw: newSecs })
    }
  },

  _draw: () => {
    const s = get()
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
    if (botInterval) { clearInterval(botInterval); botInterval = null }

    // If somehow no tickets, restart for next period
    if (s.tickets.length === 0) {
      setTimeout(() => get()._init(), 2000)
      return
    }

    set({ phase: 'drawing', drawRevealIndex: -1 })

    // Pick the winner
    const winnerIndex = Math.floor(Math.random() * s.tickets.length)
    const winnerTicket = s.tickets[winnerIndex]
    const payout = Math.floor(s.pot * WINNER_SHARE)
    const treasuryTax = Math.floor(s.pot * TREASURY_SHARE)

    // Draw animation: dramatic reveal cycling through names
    let animStep = 0
    const totalSteps = 30 + Math.floor(Math.random() * 15) // 30-45 steps for drama

    drawAnimInterval = setInterval(() => {
      animStep++

      // Random cycling, slowing down near the end
      const idx = animStep < totalSteps
        ? Math.floor(Math.random() * s.tickets.length)
        : winnerIndex

      set({ drawRevealIndex: idx })

      if (animStep >= totalSteps) {
        if (drawAnimInterval) { clearInterval(drawAnimInterval); drawAnimInterval = null }

        // ALPHA: No real money payout — raffle is display-only
        // Winnings are cosmetic to avoid desync between clients

        // News ticker — ALWAYS announce daily raffle winner
        useNewsStore.getState().pushEvent(
          'casino',
          `🏆 ${winnerTicket.owner} WON the Daily Raffle — $${payout.toLocaleString()} JACKPOT from ${s.tickets.length} tickets!`
        )

        const drawLabel = s.drawLabel
        set(prev => ({
          phase: 'result',
          winnerName: winnerTicket.owner,
          winnerPayout: payout,
          isPlayerWinner: winnerTicket.isPlayer,
          lastWinner: { name: winnerTicket.owner, payout, drawLabel },
        }))

        // After showing result, reinitialize for next draw period
        resultTimer = setTimeout(() => {
          get()._init()
        }, RESULT_DISPLAY_DURATION)
      }
    }, DRAW_ANIM_DURATION / totalSteps)
  },

  _cleanup: () => {
    clearAllTimers()
  },

  processWeeklyJackpot: () => {
    const now = new Date()
    const state = get()

    // Draw on Sunday at 23:00 UTC
    const isSunday = now.getUTCDay() === 0
    const isDrawHour = now.getUTCHours() >= 23
    if (!isSunday || !isDrawHour) return

    // Only once per week
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000
    if (now.getTime() - state.lastWeeklyJackpotAt < ONE_WEEK_MS * 0.9) return

    if (state.weeklyJackpot < 100_000) return  // Minimum pot

    // All entrants + bots
    const entrants = [...state.weeklyEntrants]
    // Add some bot entrants for excitement
    const botCount = 5 + Math.floor(Math.random() * 15)
    for (let i = 0; i < botCount; i++) {
      entrants.push(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)])
    }

    if (entrants.length === 0) return

    const winnerName = entrants[Math.floor(Math.random() * entrants.length)]
    const payout = Math.floor(state.weeklyJackpot * 0.90)  // 90% to winner
    const tax = state.weeklyJackpot - payout  // 10% to treasury

    // ALPHA: No real money payout for weekly jackpot — display-only

    useNewsStore.getState().pushEvent('casino',
      `🏆🌟 WEEKLY JACKPOT: ${winnerName} WON $${payout.toLocaleString()}! (${entrants.length} entrants)`
    )

    set({
      weeklyJackpot: 500_000, // Reset with seed
      weeklyEntrants: [],
      lastWeeklyJackpotAt: now.getTime(),
      lastWeeklyWinner: { name: winnerName, payout },
    })
  },

  getWeeklyJackpotInfo: () => {
    const state = get()
    // Next Sunday 23:00 UTC
    const now = new Date()
    const daysUntilSunday = (7 - now.getUTCDay()) % 7
    const next = new Date(now)
    next.setUTCDate(next.getUTCDate() + (daysUntilSunday === 0 && now.getUTCHours() >= 23 ? 7 : daysUntilSunday))
    next.setUTCHours(23, 0, 0, 0)
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
    return {
      pot: state.weeklyJackpot,
      entrants: state.weeklyEntrants.length,
      nextDrawDate: `${months[next.getUTCMonth()]} ${next.getUTCDate()} — 23:00 UTC`,
    }
  },
}))
