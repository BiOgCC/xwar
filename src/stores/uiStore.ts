import { create } from 'zustand'

export type PanelType = 'region' | 'profile' | 'combat' | 'market' | 'companies' | 'government' | 'social_club' | 'resources' | 'cyberwarfare' | 'missions' | 'prestige' | 'military' | 'armed_forces' | 'foreign_country' | 'casino' | 'bounty' | 'stocks' | 'alliance' | 'settings' | 'help' | 'history' | 'diplomacy' | 'chat' | null
export type ResourceViewMode = 'deposits' | 'strategic' | 'political'

export interface Notification {
  id: string
  type: 'success' | 'warning' | 'danger' | 'info'
  message: string
  timestamp: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: number
}

export interface FloatingText {
  id: string
  text: string
  x: number
  y: number
  color: string
}

export interface UIState {
  activePanel: PanelType
  lastClosedPanel: PanelType
  panelHistory: PanelType[]
  panelFullscreen: boolean
  showModal: boolean
  modalContent: string | null
  notifications: Notification[]
  chatMessages: ChatMessage[]
  floatingTexts: FloatingText[]
  profileDefaultTab: string | null
  warDefaultTab: string | null
  bountyDefaultTab: string | null
  afDefaultTab: string | null
  resourceViewMode: ResourceViewMode
  selectedForeignCountry: string | null
  selectedRegionId: string | null
  setSelectedRegionId: (id: string | null) => void
  setActivePanel: (panel: PanelType) => void
  togglePanel: (panel: PanelType) => void
  goBack: () => void
  setPanelFullscreen: (v: boolean) => void
  setProfileDefaultTab: (tab: string | null) => void
  setWarDefaultTab: (tab: string | null) => void
  setBountyDefaultTab: (tab: string | null) => void
  setAfDefaultTab: (tab: string | null) => void
  cycleResourceView: () => void
  setForeignCountry: (code: string | null) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  addFloatingText: (text: string, x: number, y: number, color?: string) => void
  removeFloatingText: (id: string) => void
  openModal: (content: string) => void
  closeModal: () => void
}

let notifCounter = 0
let chatCounter = 0

export const useUIStore = create<UIState>((set) => ({
  activePanel: null,
  lastClosedPanel: null,
  panelHistory: [],
  panelFullscreen: false,
  selectedForeignCountry: null,
  selectedRegionId: null,
  showModal: false,
  modalContent: null,
  notifications: [],
  floatingTexts: [],
  profileDefaultTab: null,
  warDefaultTab: null,
  bountyDefaultTab: null,
  afDefaultTab: null,
  resourceViewMode: 'political' as ResourceViewMode,
  chatMessages: [
    {
      id: 'welcome',
      role: 'ai',
      content: "Welcome to XWAR, Commander. I'm your strategic advisor. What's your role — Military, Business, or Politics? Tell me and I'll point you in the right direction.",
      timestamp: Date.now(),
    },
  ],

  setActivePanel: (panel) => set((state) => {
    const history = state.activePanel && state.activePanel !== panel
      ? [...state.panelHistory, state.activePanel].slice(-20)
      : state.panelHistory
    return { activePanel: panel, panelHistory: history }
  }),

  togglePanel: (panel) =>
    set((state) => {
      if (state.activePanel === panel) {
        // Closing — remember it, and exit fullscreen
        return { activePanel: null, lastClosedPanel: panel, panelFullscreen: false, panelHistory: [] }
      }
      const history = state.activePanel
        ? [...state.panelHistory, state.activePanel].slice(-20)
        : state.panelHistory
      return { activePanel: panel, panelHistory: history }
    }),

  goBack: () => set((state) => {
    if (state.panelHistory.length === 0) {
      return { activePanel: null, panelFullscreen: false, panelHistory: [] }
    }
    const history = [...state.panelHistory]
    const prev = history.pop()!
    return { activePanel: prev, panelHistory: history }
  }),

  setPanelFullscreen: (v) => set({ panelFullscreen: v }),

  setProfileDefaultTab: (tab) => set({ profileDefaultTab: tab }),
  setWarDefaultTab: (tab) => set({ warDefaultTab: tab }),
  setBountyDefaultTab: (tab) => set({ bountyDefaultTab: tab }),
  setAfDefaultTab: (tab) => set({ afDefaultTab: tab }),

  setForeignCountry: (code) => set({ selectedForeignCountry: code }),
  setSelectedRegionId: (id) => set({ selectedRegionId: id }),

  cycleResourceView: () => set((state) => {
    const modes: ResourceViewMode[] = ['deposits', 'strategic', 'political']
    const idx = modes.indexOf(state.resourceViewMode)
    return { resourceViewMode: modes[(idx + 1) % modes.length] }
  }),

  addFloatingText: (text, x, y, color = '#22d38a') => {
    const id = `float-${Date.now()}-${Math.random()}`
    set((state) => ({
      floatingTexts: [...state.floatingTexts, { id, text, x, y, color }]
    }))
    setTimeout(() => {
      set((state) => ({
        floatingTexts: state.floatingTexts.filter((f) => f.id !== id)
      }))
    }, 2000)
  },

  removeFloatingText: (id) => set((state) => ({
    floatingTexts: state.floatingTexts.filter((f) => f.id !== id)
  })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: `notif-${++notifCounter}`, timestamp: Date.now() },
      ],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        { ...message, id: `chat-${++chatCounter}`, timestamp: Date.now() },
      ],
    })),

  openModal: (content) => set({ showModal: true, modalContent: content }),
  closeModal: () => set({ showModal: false, modalContent: null }),
}))
