import { create } from 'zustand'

export type PanelType = 'combat' | 'market' | 'companies' | 'government' | 'chat' | null

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

export interface UIState {
  activePanel: PanelType
  showModal: boolean
  modalContent: string | null
  notifications: Notification[]
  chatMessages: ChatMessage[]
  setActivePanel: (panel: PanelType) => void
  togglePanel: (panel: PanelType) => void
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
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
