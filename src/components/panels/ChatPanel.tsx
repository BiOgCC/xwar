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
  const { activeChannel, messages, allianceId, isLoading, error, initialize, switchChannel, sendMessage } = useChatStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const channelMessages = messages[activeChannel] || []

  useEffect(() => {
    initialize()
  }, [initialize])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [channelMessages.length])

  const handleSend = async () => {
    if (!input.trim()) return
    const ok = await sendMessage(input)
    if (ok) setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-panel">
      {/* Channel tabs */}
      <div className="chat-tabs">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            className={`chat-tab ${activeChannel === ch.id ? 'chat-tab--active' : ''}`}
            onClick={() => switchChannel(ch.id)}
            disabled={ch.id === 'alliance' && !allianceId}
          >
            {ch.icon} {ch.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {isLoading && <div className="chat-msg"><div className="chat-msg__body"><div className="chat-msg__text">Loading chat...</div></div></div>}
        {!isLoading && channelMessages.length === 0 && (
          <div className="chat-msg">
            <div className="chat-msg__body">
              <div className="chat-msg__text">
                {activeChannel === 'alliance' && !allianceId ? 'Join an alliance to unlock alliance chat.' : 'No messages yet.'}
              </div>
            </div>
          </div>
        )}
        {channelMessages.map((msg) => (
          <div key={msg.id} className="chat-msg">
            <div className="chat-msg__avatar">
              {msg.isSystem ? (
                '⚙️'
              ) : msg.senderAvatar ? (
                <>
                  <img className="chat-msg__avatar-img" src={msg.senderAvatar} alt={msg.sender} />
                  {msg.senderCountry && (
                    <span className="chat-msg__flag-badge">
                      <CountryFlag iso={msg.senderCountry} size={12} />
                    </span>
                  )}
                </>
              ) : msg.senderCountry ? (
                <CountryFlag iso={msg.senderCountry} size={16} />
              ) : (
                <span className="chat-msg__avatar-fallback">{msg.sender.slice(0, 1).toUpperCase()}</span>
              )}
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
          disabled={isLoading || (activeChannel === 'alliance' && !allianceId) || activeChannel === 'whisper'}
        />
        <button className="chat-send-btn" onClick={() => void handleSend()} disabled={isLoading || !input.trim() || (activeChannel === 'alliance' && !allianceId) || activeChannel === 'whisper'}>SEND</button>
      </div>
      {error && <div className="chat-error">{error}</div>}
    </div>
  )
}
