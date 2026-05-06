'use client'
import { useEffect, useRef } from 'react'

export default function MessageBox({ messages, username, socket, setMessage, strangerUsername, strangerUserId, connectionStatus }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!socket) return
    socket.on('messageResponse', data => {
      setMessage(prev => [...prev, { user: 'stranger', message: data.message }])
    })
    return () => socket.removeAllListeners('messageResponse')
  }, [socket])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="msg-box">
      {!connectionStatus && messages.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10, textAlign: 'center', padding: '0 24px', pointerEvents: 'none',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2.5px solid var(--border)', borderTopColor: 'var(--accent)',
            animation: 'spinAnim .9s linear infinite',
          }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--t2)' }}>
            {strangerUsername
              ? <><strong style={{ color: 'var(--t1)' }}>{strangerUsername}</strong> is here 👋</>
              : 'Finding your match…'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--t4)' }}>Messages will appear here once connected</p>
        </div>
      ) : (
        messages.map((msg, i) => {
          const isMe = msg.user === username || msg.user === 'me'
          return (
            <div
              key={i}
              className={`bubble ${isMe ? 'right' : 'left'}`}
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
