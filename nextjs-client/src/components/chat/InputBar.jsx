'use client'
import { useState } from 'react'

export default function InputBar({ socket, setMessage, onNewUser, strangerUserId, username, strangerUsername }) {
  const [input, setInput] = useState('')

  function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || !socket || !strangerUserId) return
    socket.emit('message', { message: input.trim(), to: strangerUserId })
    setMessage(prev => [...prev, { user: username || 'me', message: input.trim() }])
    setInput('')
  }

  return (
    <div className="p-2 bg-elev border-t flex items-center gap-2 shrink-0" style={{ borderColor: 'var(--border-s)' }}>
      {/* Next/Skip */}
      <button
        onClick={onNewUser}
        className="shrink-0 px-3.5 h-10 rounded-sm text-[13px] font-bold text-t3 border border-bdr whitespace-nowrap transition-all hover:border-red hover:text-red hover:bg-red-sub"
      >
        ⏭ Next
      </button>

      {/* Message input */}
      <form onSubmit={sendMessage} className="flex-1 flex items-center gap-2 min-w-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={strangerUserId ? '💬 Type a message…' : '🔍 Waiting for a match…'}
          disabled={!strangerUserId}
          className="flex-1 bg-transparent border-none outline-none text-[14px] text-t1 placeholder:text-t4 py-2 px-1 min-w-0 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!input.trim() || !strangerUserId}
          className="w-10 h-10 rounded-sm bg-accent text-white flex items-center justify-center shrink-0 transition-all hover:bg-accent-h hover:scale-[1.07] disabled:opacity-40 disabled:cursor-not-allowed"
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
