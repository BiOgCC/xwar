import { create } from 'zustand'
import { usePlayerStore } from './playerStore'
import { useWorldStore } from './worldStore'
import { useNewsStore } from './newsStore'

/* ══════════════════════════════════════════════
   XWAR Crash — "Missile Launch" — MULTIPLAYER
   5 min betting window → launch → 9:45 min cooldown
   Multiple players (bots + real player) share one missile
   15% of each bet → country treasury
   House edge ~9% (EV ≈ 0.91)
   ══════════════════════════════════════════════ */

export const CRASH_BETS = [10_000, 50_000, 100_000, 250_000, 500_000]

// Timing constants (ms)
const BETTING_WINDOW = 5 * 60 * 1000      // 5 minutes
const COOLDOWN_WINDOW = 9.75 * 60 * 1000  // 9:45 minutes
const NEWS_WARN_BEFORE = 60 * 1000        // announce 1 min before close
const TICK_MS = 50
const GROWTH_RATE = 0.0065

// ── Bot names pool ──
const BOT_NAMES = [
  'SgtBlaze', 'IronWolf_x', 'NukeRunner', 'Pvt.Chaos', 'DeathRain',
  'Col.Fury', 'ShadowOps11', 'RPG_King', 'DesertFox88', 'StealthBomber',
  'TankHunter', 'Cpt.Venom', 'ReconElite', 'MortarMike', 'GunshipGary',
  'DronePilot', 'WarheadWill', 'FlakJacket', 'FragMaster', 'MineField',
  'Sniper_Zero', 'AirStrike99', 'RapidFire', 'HeavyMetal', 'BulletStorm',
]

export type CrashPhase = 'betting' | 'flying' | 'crashed' | 'cooldown'

export interface CrashPlayer {
  name: string
  bet: number
  cashedOutAt: number | null  // null = still flying or crashed
  isBot: boolean
  isPlayer: boolean           // the real player
}

export interface CrashChatMsg {
  name: string
  text: string
  time: number // timestamp
  type: 'chat' | 'system' | 'cashout' | 'crash'
}

export interface CrashState {
  phase: CrashPhase
  currentMultiplier: number
  crashPoint: number
  // Timing
  phaseStartTime: number      // when current phase started
  phaseEndTime: number        // when current phase ends
  timeRemaining: number       // seconds left in current phase
  newsAnnounced: boolean
  // Players
  players: CrashPlayer[]
  playerBet: number           // real player's current bet (0 = not bet)
  playerCashedOut: boolean
  playerPayout: number
  // Chat / mock log
  chatLog: CrashChatMsg[]
  // History
  history: number[]
  // Stats
  totalRounds: number
  wins: number
  losses: number
  // Internal
  tickInterval: ReturnType<typeof setInterval> | null
  timerInterval: ReturnType<typeof setInterval> | null
  // Actions
  startRound: () => void
  placeBet: (amount: number) => void
  cashOut: () => void
  sendChat: (text: string) => void
  _tick: () => void
  _timerTick: () => void
  _spawnBots: () => void
  _botCashOutCheck: () => void
  _startCooldown: () => void
  _cleanup: () => void
}

function generateCrashPoint(): number {
  const houseEdge = 0.09
  const r = Math.random()
  if (r < 0.01) return 100
  let crashAt = (1 - houseEdge) / r
  crashAt = Math.max(1.10, crashAt)
  return Math.min(100, Math.round(crashAt * 100) / 100)
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Bot taunt messages
const BOT_TAUNTS = {
  cashout: [
    'ez money 💰', 'im out, gl losers', 'cya broke boys',
    'thanks for the free cash', 'profit secured 🔒', 'gg',
    'too easy', 'not worth the risk lol', 'im rich now',
  ],
  crash: [
    'NOOOOO', 'rip my money', '💀💀💀', 'i knew it...',
    'pain', 'should have cashed out smh', 'bruh',
    'there goes my salary', 'i hate this game',
  ],
  bet: [
    'all in baby 🚀', 'lets go', 'feeling lucky',
    'moon or bust', '10x or nothing', 'diamond hands 💎',
  ],
}

export const useCrashStore = create<CrashState>((set, get) => ({
  phase: 'cooldown',
  currentMultiplier: 1.00,
  crashPoint: 1.00,
  phaseStartTime: 0,
  phaseEndTime: 0,
  timeRemaining: 0,
  newsAnnounced: false,
  players: [],
  playerBet: 0,
  playerCashedOut: false,
  playerPayout: 0,
  chatLog: [],
  history: [],
  totalRounds: 0,
  wins: 0,
  losses: 0,
  tickInterval: null,
  timerInterval: null,

  startRound: () => {
    const s = get()
    // Cleanup existing intervals
    if (s.tickInterval) clearInterval(s.tickInterval)
    if (s.timerInterval) clearInterval(s.timerInterval)

    const now = Date.now()
    set({
      phase: 'betting',
      currentMultiplier: 1.00,
      crashPoint: 1.00,
      phaseStartTime: now,
      phaseEndTime: now + BETTING_WINDOW,
      timeRemaining: BETTING_WINDOW / 1000,
      newsAnnounced: false,
      players: [],
      playerBet: 0,
      playerCashedOut: false,
      playerPayout: 0,
      chatLog: [{
        name: 'SYSTEM',
        text: '🚀 MISSILE LAUNCH — betting is OPEN! Place your bets!',
        time: now,
        type: 'system',
      }],
    })

    // Start timer countdown
    const timerInterval = setInterval(() => get()._timerTick(), 1000)
    set({ timerInterval })

    // Spawn bots over the betting period
    get()._spawnBots()
  },

  _timerTick: () => {
    const s = get()
    const now = Date.now()
    const remaining = Math.max(0, s.phaseEndTime - now)
    const remainingSec = Math.ceil(remaining / 1000)

    set({ timeRemaining: remainingSec })

    // NEWS announcement: 1 minute before betting closes
    if (s.phase === 'betting' && !s.newsAnnounced && remaining <= NEWS_WARN_BEFORE) {
      useNewsStore.getState().pushEvent('casino', '🚀 CRASH: 1 minute left to place bets! Missile launching soon!')
      set({ newsAnnounced: true })
    }

    // Phase transitions
    if (s.phase === 'betting' && remaining <= 0) {
      // Launch the missile!
      if (s.timerInterval) clearInterval(s.timerInterval)

      const crashPoint = generateCrashPoint()
      const launchNow = Date.now()

      set({
        phase: 'flying',
        crashPoint,
        currentMultiplier: 1.00,
        phaseStartTime: launchNow,
        phaseEndTime: 0, // no fixed end — crash point determines
        chatLog: [...s.chatLog, {
          name: 'SYSTEM',
          text: `🚀 MISSILE LAUNCHED! ${s.players.length} players on board!`,
          time: launchNow,
          type: 'system',
        }],
      })

      // Start game tick
      const tickInterval = setInterval(() => get()._tick(), TICK_MS)
      set({ tickInterval })
    }

    if (s.phase === 'cooldown' && remaining <= 0) {
      // Start new round
      if (s.timerInterval) clearInterval(s.timerInterval)
      get().startRound()
    }
  },

  _tick: () => {
    const s = get()
    if (s.phase !== 'flying') return

    const newMult = Math.round((s.currentMultiplier * (1 + GROWTH_RATE)) * 1000) / 1000

    // Check bot cash-outs
    get()._botCashOutCheck()

    if (newMult >= s.crashPoint) {
      // CRASH!
      if (s.tickInterval) clearInterval(s.tickInterval)

      // Check if player crashed
      const playerCrashed = s.playerBet > 0 && !s.playerCashedOut
      const updatedPlayers = s.players.map(p => ({
        ...p,
        cashedOutAt: p.cashedOutAt ?? null, // those who didn't cash out lose
      }))

      // Bot crash reactions
      const crashedBots = updatedPlayers.filter(p => p.isBot && !p.cashedOutAt)
      const botCrashMsgs: CrashChatMsg[] = crashedBots.slice(0, 3).map(b => ({
        name: b.name,
        text: pickRandom(BOT_TAUNTS.crash),
        time: Date.now(),
        type: 'crash' as const,
      }))

      const crashMsg: CrashChatMsg = {
        name: 'SYSTEM',
        text: `💥 MISSILE DESTROYED AT ×${s.crashPoint.toFixed(2)}!`,
        time: Date.now(),
        type: 'system',
      }

      set({
        phase: 'crashed',
        currentMultiplier: s.crashPoint,
        tickInterval: null,
        history: [s.crashPoint, ...s.history].slice(0, 20),
        totalRounds: s.totalRounds + 1,
        losses: playerCrashed ? s.losses + 1 : s.losses,
        chatLog: [...get().chatLog, crashMsg, ...botCrashMsgs],
      })

      // Track casino loss if player crashed
      if (playerCrashed) {
        usePlayerStore.getState().addCasinoLoss(s.playerBet)
      }

      // Push news for big crashes
      if (s.crashPoint >= 10) {
        useNewsStore.getState().pushEvent('casino', `🚀 CRASH missile survived to ×${s.crashPoint.toFixed(2)}!`)
      }

      // Start cooldown after 5 seconds
      setTimeout(() => get()._startCooldown(), 5000)
    } else {
      set({ currentMultiplier: newMult })
    }
  },

  _botCashOutCheck: () => {
    const s = get()
    if (s.phase !== 'flying') return

    const updatedPlayers = [...s.players]
    const newMsgs: CrashChatMsg[] = []
    let changed = false

    for (const p of updatedPlayers) {
      if (!p.isBot || p.cashedOutAt) continue
      // Each bot has a target cashout multiplier (stored as a temp prop)
      const target = (p as any)._target as number
      if (s.currentMultiplier >= target) {
        p.cashedOutAt = s.currentMultiplier
        changed = true
        // 40% chance they taunt
        if (Math.random() < 0.4) {
          newMsgs.push({
            name: p.name,
            text: pickRandom(BOT_TAUNTS.cashout),
            time: Date.now(),
            type: 'cashout',
          })
        }
      }
    }

    if (changed) {
      set({
        players: updatedPlayers,
        chatLog: newMsgs.length > 0 ? [...s.chatLog, ...newMsgs] : s.chatLog,
      })
    }
  },

  _spawnBots: () => {
    const botCount = 4 + Math.floor(Math.random() * 8) // 4-11 bots
    const usedNames = new Set<string>()
    const bots: CrashPlayer[] = []

    for (let i = 0; i < botCount; i++) {
      let name: string
      do { name = pickRandom(BOT_NAMES) } while (usedNames.has(name))
      usedNames.add(name)

      const bet = pickRandom(CRASH_BETS)
      // Target cashout between 1.2× and 8× (weighted toward lower)
      const target = 1.1 + Math.pow(Math.random(), 2) * 7

      const bot: CrashPlayer & { _target: number } = {
        name,
        bet,
        cashedOutAt: null,
        isBot: true,
        isPlayer: false,
        _target: Math.round(target * 100) / 100,
      }
      bots.push(bot)
    }

    // Stagger bot arrivals
    const s = get()
    let addedBots: CrashPlayer[] = []
    const msgs: CrashChatMsg[] = []

    // Add 2-3 immediately
    const immediate = bots.splice(0, 2 + Math.floor(Math.random() * 2))
    addedBots = [...immediate]
    immediate.forEach(b => {
      if (Math.random() < 0.3) {
        msgs.push({
          name: b.name,
          text: pickRandom(BOT_TAUNTS.bet),
          time: Date.now(),
          type: 'chat',
        })
      }
    })

    set({
      players: [...s.players, ...addedBots],
      chatLog: msgs.length > 0 ? [...s.chatLog, ...msgs] : s.chatLog,
    })

    // Add remaining bots at random intervals during betting window
    bots.forEach((bot, i) => {
      const delay = (5000 + Math.random() * (BETTING_WINDOW - 30000)) // 5s to 4.5min
      setTimeout(() => {
        const curr = get()
        if (curr.phase !== 'betting') return
        const chatMsgs: CrashChatMsg[] = []
        if (Math.random() < 0.25) {
          chatMsgs.push({
            name: bot.name,
            text: pickRandom(BOT_TAUNTS.bet),
            time: Date.now(),
            type: 'chat',
          })
        }
        set({
          players: [...curr.players, bot],
          chatLog: chatMsgs.length > 0 ? [...curr.chatLog, ...chatMsgs] : curr.chatLog,
        })
      }, delay)
    })
  },

  placeBet: (amount: number) => {
    const s = get()
    if (s.phase !== 'betting') return
    if (s.playerBet > 0) return // already bet
    const player = usePlayerStore.getState()
    if (player.money < amount) return

    player.spendMoney(amount)
    const tax = Math.floor(amount * 0.15)
    useWorldStore.getState().addTreasuryTax(player.countryCode, tax)

    // Track casino spins
    player.incrementCasinoSpins()

    const playerEntry: CrashPlayer = {
      name: player.name,
      bet: amount,
      cashedOutAt: null,
      isBot: false,
      isPlayer: true,
    }

    set({
      playerBet: amount,
      players: [...s.players, playerEntry],
      chatLog: [...s.chatLog, {
        name: player.name,
        text: `bet $${amount.toLocaleString()}`,
        time: Date.now(),
        type: 'chat',
      }],
    })
  },

  cashOut: () => {
    const s = get()
    if (s.phase !== 'flying') return
    if (s.playerBet <= 0 || s.playerCashedOut) return

    const payout = Math.floor(s.playerBet * s.currentMultiplier)
    usePlayerStore.getState().earnMoney(payout)

    const updatedPlayers = s.players.map(p =>
      p.isPlayer ? { ...p, cashedOutAt: s.currentMultiplier } : p
    )

    set({
      playerCashedOut: true,
      playerPayout: payout,
      players: updatedPlayers,
      wins: s.wins + 1,
      chatLog: [...s.chatLog, {
        name: usePlayerStore.getState().name,
        text: `cashed out at ×${s.currentMultiplier.toFixed(2)} — +$${payout.toLocaleString()}! 💰`,
        time: Date.now(),
        type: 'cashout',
      }],
    })
  },

  sendChat: (text: string) => {
    const s = get()
    const player = usePlayerStore.getState()
    if (!text.trim()) return
    set({
      chatLog: [...s.chatLog, {
        name: player.name,
        text: text.trim().slice(0, 100),
        time: Date.now(),
        type: 'chat',
      }],
    })
  },

  _startCooldown: () => {
    const s = get()
    if (s.timerInterval) clearInterval(s.timerInterval)
    const now = Date.now()
    set({
      phase: 'cooldown',
      phaseStartTime: now,
      phaseEndTime: now + COOLDOWN_WINDOW,
      timeRemaining: Math.ceil(COOLDOWN_WINDOW / 1000),
      newsAnnounced: false,
    })

    const timerInterval = setInterval(() => get()._timerTick(), 1000)
    set({ timerInterval })
  },

  reset: () => {}, // unused now — rounds auto-cycle

  _cleanup: () => {
    const s = get()
    if (s.tickInterval) clearInterval(s.tickInterval)
    if (s.timerInterval) clearInterval(s.timerInterval)
  },
}))

// Auto-start the first round on import
setTimeout(() => {
  useCrashStore.getState().startRound()
}, 500)
