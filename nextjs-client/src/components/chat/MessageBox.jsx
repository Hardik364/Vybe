'use client'
import { useEffect, useRef } from 'react'

export default function MessageBox({ messages, username, socket, setMessage, strangerUsername, strangerUserId, connectionStatus }) {
  const bottomRef = useRef(null)

  // Receive messages
  useEffect(() => {
    if (!socket) return
    socket.on('messageResponse', data => {
      setMessage(prev => [...prev, { user: 'stranger', message: data.message }])
    })
    return () => socket.removeAllListeners('messageResponse')
  }, [socket])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 min-h-0">
      {!connectionStatus && messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-center px-6 pointer-events-none">
          <div
            className="w-10 h-10 rounded-full border-[2.5px] border-bdr"
            style={{ borderTopColor: 'var(--accent)', animation: 'spinAnim .9s linear infinite' }}
          />
          <p className="text-[15px] font-medium text-t2">
            {strangerUsername ? <><strong className="text-t1">{strangerUsername}</strong> is here 👋</> : 'Finding your match…'}
          </p>
          <p className="text-[13px] text-t4">Messages will appear here once connected</p>
        </div>
      ) : (
        messages.map((msg, i) => {
          const isMe = msg.user === username || msg.user === 'me'
          return (
            <div
              key={i}
              className={`max-w-[72%] text-[14px] leading-[1.65] px-4 py-[11px] break-words whitespace-pre-wrap ${
                isMe
                  ? 'self-end text-white rounded-[20px_20px_5px_20px]'
                  : 'self-start text-t1 bg-elev border border-bdr rounded-[20px_20px_20px_5px]'
              }`}
              style={isMe ? {
                background: 'linear-gradient(135deg,var(--accent),var(--accent-h))',
                boxShadow: '0 4px 16px var(--accent-glow)',
              } : {}}
            >
              {msg.message}
            </div>
          )
        })
      )}
      <div ref={bottomRef} />
    </div>
  )
}
