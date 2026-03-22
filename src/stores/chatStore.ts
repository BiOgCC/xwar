import { create } from 'zustand'

// ====== TYPES ======

export type ChatChannel = 'global' | 'alliance' | 'country' | 'whisper'

export interface ChatMsg {
  id: string
  channel: ChatChannel
  sender: string
  senderCountry: string
  content: string
  timestamp: number
  isSystem?: boolean
}

// ====== STORE ======

export interface ChatState {
  activeChannel: ChatChannel
  messages: Record<ChatChannel, ChatMsg[]>
  switchChannel: (channel: ChatChannel) => void
  sendMessage: (content: string, sender?: string, country?: string) => void
}

let msgCounter = 0

// Seed messages
const SEED_MESSAGES: Record<ChatChannel, ChatMsg[]> = {
  global: [
    { id: 'g1', channel: 'global', sender: 'System', senderCountry: '', content: '🌍 Welcome to XWAR Global Chat. Be respectful.', timestamp: Date.now() - 600000, isSystem: true },
    { id: 'g2', channel: 'global', sender: 'IronWolf', senderCountry: 'RU', content: 'Anyone want to trade? Got excess oil', timestamp: Date.now() - 500000 },
    { id: 'g3', channel: 'global', sender: 'SamuraiX', senderCountry: 'JP', content: 'GG on that last battle, US team put up a fight', timestamp: Date.now() - 400000 },
    { id: 'g4', channel: 'global', sender: 'ReichGuard', senderCountry: 'DE', content: 'NATO needs more members, join up!', timestamp: Date.now() - 300000 },
    { id: 'g5', channel: 'global', sender: 'DragonLord', senderCountry: 'CN', content: 'Eastern Bloc rising 🔴', timestamp: Date.now() - 200000 },
    { id: 'g6', channel: 'global', sender: 'AmazonWarrior', senderCountry: 'BR', content: 'Who controls the Atlantic? Need naval passage', timestamp: Date.now() - 100000 },
  ],
  alliance: [
    { id: 'a1', channel: 'alliance', sender: 'System', senderCountry: '', content: '🤝 Alliance chat — only members can see this', timestamp: Date.now() - 300000, isSystem: true },
    { id: 'a2', channel: 'alliance', sender: 'EagleEye', senderCountry: 'US', content: 'Coordinating attack on RU Caucasus region, need naval support', timestamp: Date.now() - 200000 },
    { id: 'a3', channel: 'alliance', sender: 'CrownForce', senderCountry: 'GB', content: 'I can send warships from East Atlantic', timestamp: Date.now() - 150000 },
  ],
  country: [
    { id: 'c1', channel: 'country', sender: 'System', senderCountry: '', content: '🏳️ Country chat — citizens only', timestamp: Date.now() - 200000, isSystem: true },
    { id: 'c2', channel: 'country', sender: 'Commander', senderCountry: 'US', content: 'Treasury looking good, should we upgrade airport?', timestamp: Date.now() - 100000 },
  ],
  whisper: [
    { id: 'w1', channel: 'whisper', sender: 'System', senderCountry: '', content: '💬 Direct messages — private conversations', timestamp: Date.now() - 100000, isSystem: true },
  ],
}

export const useChatStore = create<ChatState>((set, get) => ({
  activeChannel: 'global',
  messages: SEED_MESSAGES,

  switchChannel: (channel) => set({ activeChannel: channel }),

  sendMessage: (content, sender = 'Commander', country = 'US') => {
    if (!content.trim()) return
    const { activeChannel } = get()
    const msg: ChatMsg = {
      id: `msg-${++msgCounter}-${Date.now()}`,
      channel: activeChannel,
      sender,
      senderCountry: country,
      content: content.trim(),
      timestamp: Date.now(),
    }
    set((state) => ({
      messages: {
        ...state.messages,
        [activeChannel]: [...state.messages[activeChannel], msg],
      },
    }))
  },
}))
