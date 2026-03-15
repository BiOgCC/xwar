import { create } from 'zustand'

export type PanelType = 'profile' | 'combat' | 'market' | 'companies' | 'government' | 'chat' | 'resources' | 'cyberwarfare' | 'missions' | 'prestige' | 'military' | null
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
  showModal: boolean
  modalContent: string | null
  notifications: Notification[]
  chatMessages: ChatMessage[]
  floatingTexts: FloatingText[]
  profileDefaultTab: string | null
  resourceViewMode: ResourceViewMode
  setActivePanel: (panel: PanelType) => void
  togglePanel: (panel: PanelType) => void
  setProfileDefaultTab: (tab: string | null) => void
  cycleResourceView: () => void
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
  showModal: false,
  modalContent: null,
  notifications: [],
  floatingTexts: [],
  profileDefaultTab: null,
  resourceViewMode: 'political' as ResourceViewMode,
  chatMessages: [
    {
      id: 'welcome',
      role: 'ai',
      content: "Welcome to XWAR, Commander. I'm your strategic advisor. What's your role — Military, Business, or Politics? Tell me and I'll point you in the right direction.",
      timestamp: Date.now(),
    },
  ],

  setActivePanel: (panel) => set({ activePanel: panel }),

  togglePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? null : panel,
    })),

  setProfileDefaultTab: (tab) => set({ profileDefaultTab: tab }),

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
