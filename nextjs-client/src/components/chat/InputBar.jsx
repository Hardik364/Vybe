'use client'
import { useState } from 'react'

export default function InputBar({ socket, setMessage, onNewUser, strangerUserId, username, strangerUsername }) {
  const [input, setInput] = useState('')

  function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || !socket || !strangerUserId) return
    socket.emit('chatMessage', { message: input.trim(), to: strangerUserId })
    setMessage(prev => [...prev, { user: username || 'me', message: input.trim() }])
    setInput('')
  }

  return (
    <div className="input-bar">
      {/* Next/Skip */}
      <button onClick={onNewUser} className="next-btn">
        ⏭ Next
      </button>

      {/* Message input */}
      <form onSubmit={sendMessage} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={strangerUserId ? '💬 Type a message…' : '🔍 Waiting for a match…'}
          disabled={!strangerUserId}
          inputMode="text"
          autoComplete="off"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 14, color: 'var(--t1)', padding: '8px 4px', minWidth: 0,
            cursor: !strangerUserId ? 'not-allowed' : 'text',
            fontFamily: 'var(--font-body)',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || !strangerUserId}
          className="send-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
