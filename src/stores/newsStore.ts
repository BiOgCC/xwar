import { create } from 'zustand'

/* ══════════════════════════════════════════════
   XWAR — News Ticker Store
   Global event feed displayed as a scrolling ticker
   ══════════════════════════════════════════════ */

export type NewsCategory =
  | 'war'       // conquests, battles, declarations
  | 'economy'   // market trades, company events
  | 'casino'    // big wins, jackpots
  | 'combat'    // PvP kills, damage
  | 'bounty'    // bounties placed/claimed
  | 'alliance'  // alliance formed, war declared
  | 'system'    // turns, server events

const CATEGORY_ICONS: Record<NewsCategory, string> = {
  war: '⚔️',
  economy: '💰',
  casino: '🎰',
  combat: '💥',
  bounty: '🎯',
  alliance: '🤝',
  system: '📡',
}

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  war: '#ef4444',
  economy: '#22c55e',
  casino: '#fbbf24',
  combat: '#f97316',
  bounty: '#a855f7',
  alliance: '#3b82f6',
  system: '#64748b',
}

export interface NewsEvent {
  id: string
  category: NewsCategory
  message: string
  timestamp: number
  icon: string
  color: string
}

const MAX_EVENTS = 50
const EXPIRE_MS = 30 * 60 * 1000 // 30 minutes

export interface NewsState {
  events: NewsEvent[]
  pushEvent: (category: NewsCategory, message: string) => void
  clearEvents: () => void
}

export const useNewsStore = create<NewsState>((set) => ({
  events: [
    // Seed with some initial flavor events
    { id: 'seed_1', category: 'system', message: 'XWAR servers online — global operations active', timestamp: Date.now() - 5000, icon: CATEGORY_ICONS.system, color: CATEGORY_COLORS.system },
    { id: 'seed_2', category: 'war', message: 'Tensions rising between NATO and Eastern Bloc', timestamp: Date.now() - 3000, icon: CATEGORY_ICONS.war, color: CATEGORY_COLORS.war },
    { id: 'seed_3', category: 'economy', message: 'Global markets open — oil prices stable', timestamp: Date.now() - 1000, icon: CATEGORY_ICONS.economy, color: CATEGORY_COLORS.economy },
  ],

  pushEvent: (category, message) => {
    const newEvent: NewsEvent = {
      id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      category,
      message,
      timestamp: Date.now(),
      icon: CATEGORY_ICONS[category],
      color: CATEGORY_COLORS[category],
    }

    set(state => {
      // Expire old events
      const now = Date.now()
      const fresh = state.events.filter(e => now - e.timestamp < EXPIRE_MS)

      return {
        events: [newEvent, ...fresh].slice(0, MAX_EVENTS),
      }
    })
  },

  clearEvents: () => set({ events: [] }),
}))
