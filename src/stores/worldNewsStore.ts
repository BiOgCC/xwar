import { create } from 'zustand'

/* ══════════════════════════════════════════════
   XWAR — World News Store (World Monitor API)
   Real-world news feed for the Intel Feed widget
   ══════════════════════════════════════════════ */

const API_URL =
  import.meta.env.DEV
    ? '/api/worldmonitor/news/v1/list-feed-digest?variant=full&lang=en'
    : 'https://api.worldmonitor.app/api/news/v1/list-feed-digest?variant=full&lang=en'
const REFRESH_MS = 5 * 60 * 1000 // 5 minutes
const MAX_ITEMS = 60

/* ── Threat level colours ── */
const THREAT_COLORS: Record<string, string> = {
  THREAT_LEVEL_CRITICAL: '#ef4444',
  THREAT_LEVEL_HIGH:     '#f97316',
  THREAT_LEVEL_MEDIUM:   '#eab308',
  THREAT_LEVEL_LOW:      '#22c55e',
  THREAT_LEVEL_UNSPECIFIED: '#64748b',
}

const THREAT_RANK: Record<string, number> = {
  THREAT_LEVEL_CRITICAL: 4,
  THREAT_LEVEL_HIGH: 3,
  THREAT_LEVEL_MEDIUM: 2,
  THREAT_LEVEL_LOW: 1,
  THREAT_LEVEL_UNSPECIFIED: 0,
}

/* ── Category labels ── */
export const NEWS_CATEGORIES = [
  'all',
  'conflict',
  'military',
  'economic',
  'cyber',
  'tech',
  'diplomatic',
  'disaster',
  'crime',
  'health',
] as const

export type NewsCategoryFilter = (typeof NEWS_CATEGORIES)[number]

const CATEGORY_ICONS: Record<string, string> = {
  all: '🌐',
  conflict: '⚔️',
  military: '🎖️',
  economic: '💰',
  cyber: '🔓',
  tech: '💻',
  diplomatic: '🤝',
  disaster: '🌋',
  crime: '🚨',
  health: '🏥',
}

export { CATEGORY_ICONS }

/* ── Types ── */
export interface WorldNewsItem {
  id: string
  source: string
  title: string
  link: string
  publishedAt: number
  isAlert: boolean
  threatLevel: string
  threatColor: string
  threatRank: number
  category: string
}

export interface WorldNewsState {
  items: WorldNewsItem[]
  loading: boolean
  error: string | null
  lastFetch: number
  categoryFilter: NewsCategoryFilter
  setCategoryFilter: (c: NewsCategoryFilter) => void
  fetchNews: () => Promise<void>
  startAutoRefresh: () => () => void
}

/* ── Helpers ── */
function flattenFeed(data: any): WorldNewsItem[] {
  const seen = new Set<string>()
  const result: WorldNewsItem[] = []

  if (!data?.categories) return result

  for (const catGroup of Object.values(data.categories) as any[]) {
    if (!catGroup?.items) continue
    for (const item of catGroup.items) {
      // Dedupe by title
      const key = item.title?.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)

      const tl = item.threat?.level || 'THREAT_LEVEL_UNSPECIFIED'

      result.push({
        id: `wn_${item.publishedAt}_${Math.random().toString(36).substr(2, 5)}`,
        source: item.source || 'Unknown',
        title: item.title,
        link: item.link,
        publishedAt: item.publishedAt,
        isAlert: !!item.isAlert,
        threatLevel: tl,
        threatColor: THREAT_COLORS[tl] || '#64748b',
        threatRank: THREAT_RANK[tl] || 0,
        category: item.threat?.category || 'general',
      })
    }
  }

  // Sort newest first
  result.sort((a, b) => b.publishedAt - a.publishedAt)
  return result.slice(0, MAX_ITEMS)
}

/* ── Store ── */
export const useWorldNewsStore = create<WorldNewsState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  lastFetch: 0,
  categoryFilter: 'all',

  setCategoryFilter: (c) => set({ categoryFilter: c }),

  fetchNews: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const items = flattenFeed(data)
      set({ items, loading: false, lastFetch: Date.now() })
    } catch (err: any) {
      set({ loading: false, error: err.message || 'Failed to fetch news' })
    }
  },

  startAutoRefresh: () => {
    // Fetch immediately
    get().fetchNews()
    const id = setInterval(() => get().fetchNews(), REFRESH_MS)
    return () => clearInterval(id)
  },
}))
