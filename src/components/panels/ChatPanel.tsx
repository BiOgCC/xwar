import { useState, useRef, useEffect } from 'react'
import { useChatStore, type ChatChannel } from '../../stores/chatStore'
import CountryFlag from '../shared/CountryFlag'
import '../../styles/diplomacy-chat.css'

const CHANNELS: { id: ChatChannel; icon: string; label: string }[] = [
  { id: 'global', icon: '🌍', label: 'GLOBAL' },
  { id: 'alliance', icon: '🤝', label: 'ALLIANCE' },
  { id: 'country', icon: '🏳️', label: 'COUNTRY' },
  { id: 'whisper', icon: '💬', label: 'DM' },
]

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function ChatPanel() {
  const { activeChannel, messages, switchChannel, sendMessage } = useChatStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const channelMessages = messages[activeChannel] || []

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [channelMessages.length])

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
      {/* Channel tabs */}
      <div className="chat-tabs">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            className={`chat-tab ${activeChannel === ch.id ? 'chat-tab--active' : ''}`}
            onClick={() => switchChannel(ch.id)}
          >
            {ch.icon} {ch.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {channelMessages.map((msg) => (
          <div key={msg.id} className="chat-msg">
            <div className="chat-msg__avatar">
              {msg.isSystem ? '⚙️' : msg.senderCountry ? <CountryFlag iso={msg.senderCountry} size={16} /> : '👤'}
            </div>
            <div className="chat-msg__body">
              <div className="chat-msg__header">
                <span className="chat-msg__name" style={{ color: msg.isSystem ? '#f59e0b' : '#fff' }}>{msg.sender}</span>
                <span className="chat-msg__time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="chat-msg__text">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-wrap">
        <input
          className="chat-input"
          type="text"
          placeholder={`Message #${activeChannel}...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />
        <button className="chat-send-btn" onClick={handleSend}>SEND</button>
      </div>
    </div>
  )
}
