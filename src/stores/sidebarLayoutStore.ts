import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ENABLE_DIVISIONS } from '../config/features'

export interface SidebarItem {
  id: string
  icon: string
  label: string
}

const DEFAULT_TOP: SidebarItem[] = [
  { id: 'profile', icon: '👤', label: 'PROFILE' },
  { id: 'inventory', icon: '🎒', label: 'INVENTORY' },
  { id: 'market', icon: '📊', label: 'MARKET' },
  { id: 'companies', icon: '🏭', label: 'COMPANIES' },
  { id: 'resources', icon: '💰', label: 'RESOURCES' },
  { id: 'casino', icon: '🎰', label: 'CASINO' },
  { id: 'ley_lines', icon: '⚡', label: 'LEY LINES' },
  { id: 'stocks', icon: '📈', label: 'STOCKS' },
  { id: 'alliance', icon: '🤝', label: 'ALLIANCE' },
  { id: 'social_club', icon: '🏛️', label: 'SOCIAL CLUB' },
]

const DEFAULT_BOTTOM: SidebarItem[] = [
  { id: 'government', icon: '🏛️', label: 'COUNTRY' },
  { id: 'missions', icon: '📋', label: 'MISSIONS' },
  { id: 'combat', icon: '⚔️', label: 'COMBAT' },
  ...(ENABLE_DIVISIONS ? [
    { id: 'armed_forces', icon: '🪖', label: 'ARMED FORCES' },
  ] : []),
  { id: 'mu', icon: '🏴', label: 'MIL. UNIT' },
  { id: 'prestige', icon: '⭐', label: 'PRESTIGE' },
  { id: 'diplomacy', icon: '🕊️', label: 'DIPLOMACY' },
  { id: 'history', icon: '📜', label: 'HISTORY' },
  { id: 'trade_routes', icon: '⚓', label: 'TRADE LANES' },
  { id: 'admin', icon: '🛡️', label: 'ADMIN' },
]


export type PanelId = 'top' | 'bottom'

interface SidebarLayoutState {
  topItems: SidebarItem[]
  bottomItems: SidebarItem[]
  moveItem: (fromPanel: PanelId, toPanel: PanelId, fromIndex: number, toIndex: number) => void
  resetLayout: () => void
}

export const useSidebarLayoutStore = create<SidebarLayoutState>()(
  persist(
    (set) => ({
      topItems: DEFAULT_TOP,
      bottomItems: DEFAULT_BOTTOM,

      moveItem: (fromPanel, toPanel, fromIndex, toIndex) =>
        set((state) => {
          const fromArr = [...(fromPanel === 'top' ? state.topItems : state.bottomItems)]
          const toArr = fromPanel === toPanel ? fromArr : [...(toPanel === 'top' ? state.topItems : state.bottomItems)]

          const [item] = fromArr.splice(fromIndex, 1)
          if (!item) return state

          // If moving within the same panel and removing before insert point, adjust index
          if (fromPanel === toPanel && fromIndex < toIndex) {
            toArr.splice(toIndex - 1, 0, item)
          } else {
            toArr.splice(toIndex, 0, item)
          }

          return {
            topItems: fromPanel === 'top' ? (toPanel === 'top' ? toArr : fromArr) : (toPanel === 'top' ? toArr : state.topItems),
            bottomItems: fromPanel === 'bottom' ? (toPanel === 'bottom' ? toArr : fromArr) : (toPanel === 'bottom' ? toArr : state.bottomItems),
          }
        }),

      resetLayout: () =>
        set({ topItems: DEFAULT_TOP, bottomItems: DEFAULT_BOTTOM }),
    }),
    {
      name: 'xwar-sidebar-layout',
      onRehydrateStorage: () => (state) => {
        // When divisions are disabled, remove armed_forces and military from persisted layout
        if (!ENABLE_DIVISIONS && state) {
          const divisionIds = ['armed_forces']
          state.topItems = state.topItems.filter(i => !divisionIds.includes(i.id))
          state.bottomItems = state.bottomItems.filter(i => !divisionIds.includes(i.id))
        }
      },
    }
  )
)
