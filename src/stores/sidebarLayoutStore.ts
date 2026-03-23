import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  { id: 'bounty', icon: '🎯', label: 'BOUNTY' },
  { id: 'stocks', icon: '📈', label: 'STOCKS' },
  { id: 'alliance', icon: '🤝', label: 'ALLIANCE' },
  { id: 'social_club', icon: '🏛️', label: 'SOCIAL CLUB' },
]

const DEFAULT_BOTTOM: SidebarItem[] = [
  { id: 'government', icon: '🏛️', label: 'COUNTRY' },
  { id: 'missions', icon: '📋', label: 'MISSIONS' },
  { id: 'combat', icon: '⚔️', label: 'COMBAT' },
  { id: 'cyberwarfare', icon: '🖥️', label: 'CYBER' },
  { id: 'armed_forces', icon: '🪖', label: 'ARMED FORCES' },
  { id: 'military', icon: '🎖️', label: 'DUELS' },
  { id: 'prestige', icon: '⭐', label: 'PRESTIGE' },
  { id: 'diplomacy', icon: '🕊️', label: 'DIPLOMACY' },
  { id: 'history', icon: '📜', label: 'HISTORY' },
  { id: 'trade_routes', icon: '⚓', label: 'TRADE LANES' },
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
    }
  )
)
