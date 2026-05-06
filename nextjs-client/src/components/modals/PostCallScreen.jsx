'use client'
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function PostCallScreen({ strangerUsername, strangerUserId, socket, onConnect, onMoveOn }) {
  const [myPressed,   setMyPressed]   = useState(false)
  const [theyPressed, setTheyPressed] = useState(false)
  const [timer,       setTimer]       = useState(30)
  const [contactTab,  setContactTab]  = useState('whatsapp')
  const [contactVal,  setContactVal]  = useState('')
  const [exchanged,   setExchanged]   = useState(null)

  // Countdown
  useEffect(() => {
    if (timer <= 0) { onMoveOn(); return }
    const t = setTimeout(() => setTimer(p => p - 1), 1000)
    return () => clearTimeout(t)
  }, [timer])

  // Listen for mutual connect
  useEffect(() => {
    if (!socket) return
    socket.on('partnerConnect', () => setTheyPressed(true))
    socket.on('contactsExchanged', data => setExchanged(data))
    return () => { socket.off('partnerConnect'); socket.off('contactsExchanged') }
  }, [socket])

  function handleConnect() {
    if (!socket || !strangerUserId) return
    setMyPressed(true)
    socket.emit('connectRequest', { to: strangerUserId, contact: { type: contactTab, value: contactVal } })
  }

  // ── Success state ──
  if (exchanged) {
    return (
      <div className="overlay">
        <div className="modal-card">
          <div style={{ fontSize: 40, marginBottom: 4 }}>🤝</div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--t4)' }}>
            You connected!
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--t1)' }}>
            Exchange successful
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {exchanged.whatsapp && (
              <a
                href={`https://wa.me/${exchanged.whatsapp}`}
                target="_blank" rel="noreferrer"
                style={{
                  padding: '12px 28px', borderRadius: 'var(--r-md)',
                  background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                  color: 'var(--accent)', fontSize: 16, fontWeight: 700,
                  transition: 'all var(--t-fast)', textDecoration: 'none',
                }}
              >
                📱 WhatsApp
              </a>
            )}
            {exchanged.instagram && (
              <a
                href={`https://instagram.com/${exchanged.instagram}`}
                target="_blank" rel="noreferrer"
                style={{
                  padding: '12px 28px', borderRadius: 'var(--r-md)',
                  background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                  color: 'var(--accent)', fontSize: 16, fontWeight: 700,
                  transition: 'all var(--t-fast)', textDecoration: 'none',
                }}
              >
                📷 Instagram
              </a>
            )}
          </div>
          <button
            onClick={onConnect}
            style={{ fontSize: 13, color: 'var(--t4)', padding: '8px', cursor: 'pointer', background: 'none', border: 'none', transition: 'color var(--t-fast)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--t3)'}
            onMouseLeave={e => e.currentTarget.style.color = ''}
          >
            Continue →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay">
      <div className="modal-card">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--t4)' }}>
          That's a wrap
        </p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3 }}>
          Stay in touch with {strangerUsername || 'them'}?
        </h2>

        {/* Contact input tabs */}
        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-elev)', borderRadius: 'var(--r-md)', padding: 4, width: '100%', maxWidth: 320 }}>
          {['whatsapp', 'instagram'].map(tab => (
            <button
              key={tab}
              onClick={() => setContactTab(tab)}
              style={{
                flex: 1, padding: '8px 16px',
                borderRadius: 'calc(var(--r-md) - 2px)',
                fontSize: 13, fontWeight: 700,
                background: contactTab === tab ? 'var(--bg-surf)' : 'none',
                color: contactTab === tab ? 'var(--t1)' : 'var(--t3)',
                boxShadow: contactTab === tab ? 'var(--sh-sm)' : 'none',
                border: 'none', cursor: 'pointer', transition: 'all var(--t-fast)',
              }}
            >
              {tab === 'whatsapp' ? '📱 WhatsApp' : '📷 Instagram'}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', width: '100%', maxWidth: 320,
          background: 'var(--bg-elev)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', overflow: 'hidden', transition: 'border-color var(--t-fast)',
        }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlur={e => e.currentTarget.style.borderColor = ''}
        >
          <span style={{
            padding: '12px 14px', fontSize: 13, fontWeight: 700,
            color: 'var(--t3)', borderRight: '1px solid var(--border)', userSelect: 'none',
          }}>
            {contactTab === 'whatsapp' ? '+91' : '@'}
          </span>
          <input
            value={contactVal}
            onChange={e => setContactVal(e.target.value)}
            placeholder={contactTab === 'whatsapp' ? '9876543210' : 'username'}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--t1)', fontSize: 14, padding: '12px 14px',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button
            onClick={handleConnect}
            disabled={myPressed}
            className="btn-connect"
          >
            <span>🤝 Connect</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.75 }}>
              {myPressed ? (theyPressed ? 'Both connected! 🎉' : 'Waiting for them…') : `${timer}s`}
            </span>
          </button>
          <button onClick={onMoveOn} className="btn-moveon">
            <span>👋 Move On</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>Gone forever</span>
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--t4)', maxWidth: 300, lineHeight: 1.6, textAlign: 'center' }}>
          💛 Both must press Connect within {timer}s. Contact info is only shared on mutual agreement.
        </p>
      </div>
    </div>
  )
}
