import { create } from 'zustand'
import { getChatBootstrap, sendChatMessage, type ChatMessageDto } from '../api/client'
import { socketManager } from '../api/socket'

export type ChatChannel = 'global' | 'alliance' | 'country' | 'whisper'

export interface ChatMsg {
  id: string
  channel: ChatChannel
  sender: string
  senderCountry: string
  senderAvatar?: string | null
  content: string
  timestamp: number
  isSystem?: boolean
}

type ChatMessages = Record<ChatChannel, ChatMsg[]>

const EMPTY_MESSAGES: ChatMessages = {
  global: [],
  alliance: [],
  country: [],
  whisper: [
    {
      id: 'whisper-system',
      channel: 'whisper',
      sender: 'System',
      senderCountry: '',
      content: 'Direct messages are not implemented yet.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ],
}

function dedupeMessages(messages: ChatMsg[]): ChatMsg[] {
  const seen = new Set<string>()
  return messages.filter((msg) => {
    if (seen.has(msg.id)) return false
    seen.add(msg.id)
    return true
  })
}

function normalizeMessage(msg: ChatMessageDto): ChatMsg {
  return {
    id: msg.id,
    channel: msg.channel,
    sender: msg.sender,
    senderCountry: msg.senderCountry,
    senderAvatar: msg.senderAvatar ?? null,
    content: msg.content,
    timestamp: msg.timestamp,
  }
}

let socketBound = false

export interface ChatState {
  activeChannel: ChatChannel
  allianceId: string | null
  messages: ChatMessages
  isLoading: boolean
  error: string | null
  initialized: boolean
  switchChannel: (channel: ChatChannel) => void
  initialize: () => Promise<void>
  sendMessage: (content: string) => Promise<boolean>
  receiveMessage: (message: ChatMsg) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeChannel: 'global',
  allianceId: null,
  messages: EMPTY_MESSAGES,
  isLoading: false,
  error: null,
  initialized: false,

  switchChannel: (channel) => set({ activeChannel: channel }),

  initialize: async () => {
    if (get().initialized || get().isLoading) return

    set({ isLoading: true, error: null })

    try {
      socketManager.connect()
      const res = await getChatBootstrap()

      set({
        allianceId: res.allianceId,
        initialized: true,
        isLoading: false,
        messages: {
          global: res.messages.global.map(normalizeMessage),
          country: res.messages.country.map(normalizeMessage),
          alliance: res.messages.alliance.map(normalizeMessage),
          whisper: EMPTY_MESSAGES.whisper,
        },
      })

      socketManager.joinChat('global')
      socketManager.joinChat('country')
      if (res.allianceId) socketManager.joinChat('alliance')

      if (!socketBound) {
        socketBound = true
        socketManager.on('chat:message', (message: ChatMessageDto) => {
          get().receiveMessage(normalizeMessage(message))
        })
      }
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to initialize chat',
      })
    }
  },

  sendMessage: async (content) => {
    const trimmed = content.trim()
    const { activeChannel } = get()

    if (!trimmed) return false
    if (activeChannel === 'whisper') {
      set({ error: 'Direct messages are not implemented yet.' })
      return false
    }

    try {
      const res = await sendChatMessage(activeChannel as 'global' | 'country' | 'alliance', trimmed)
      get().receiveMessage(normalizeMessage(res.message))
      set({ error: null })
      return true
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to send message' })
      return false
    }
  },

  receiveMessage: (message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.channel]: dedupeMessages([...state.messages[message.channel], message]).slice(-100),
      },
    }))
  },

  reset: () => set({
    activeChannel: 'global',
    allianceId: null,
    messages: EMPTY_MESSAGES,
    isLoading: false,
    error: null,
    initialized: false,
  }),
}))
