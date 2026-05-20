'use client'
import { useState } from 'react'

export default function KarmaModal({ strangerUsername, strangerUserId, socket, onRate }) {
  const [rated, setRated] = useState(false)

  function rate(r) {
    if (rated) return
    setRated(true)
    if (socket && strangerUserId) {
      socket.emit('rateUser', { to: strangerUserId, rating: r })
    }
    // Brief delay so user sees the button state change before modal closes
    setTimeout(onRate, 300)
  }

  const BTNS = [
    { key: 'great',         label: 'Great',         emoji: '😊', hoverColor: 'var(--green)',  hoverBg: 'var(--green-sub)'  },
    { key: 'okay',          label: 'Okay',           emoji: '😐', hoverColor: 'var(--amber)',  hoverBg: 'var(--amber-sub)'  },
    { key: 'disrespectful', label: 'Disrespectful',  emoji: '😠', hoverColor: 'var(--red)',    hoverBg: 'var(--red-sub)'    },
  ]

  return (
    <div className="karma-overlay">
      <div className="karma-sheet">
        <div className="karma-handle" />

        <h3 className="karma-title">How was the conversation? 💬</h3>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 10 }}>
          Your feedback helps us build a better community
        </p>

        <div className="karma-btns">
          {BTNS.map(b => (
            <button
              key={b.key}
              onClick={() => rate(b.key)}
              disabled={rated}
              className="karma-btn"
              style={rated ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
              onMouseEnter={e => {
                if (rated) return
                e.currentTarget.style.borderColor = b.hoverColor
                e.currentTarget.style.color = b.hoverColor
                e.currentTarget.style.background = b.hoverBg
              }}
              onMouseLeave={e => {
                if (rated) return
                e.currentTarget.style.borderColor = ''
                e.currentTarget.style.color = ''
                e.currentTarget.style.background = ''
              }}
            >
              <span style={{ fontSize: 28 }}>{b.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{b.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => { if (!rated) { setRated(true); setTimeout(onRate, 100) } }}
          disabled={rated}
          style={{
            fontSize: 13, color: 'var(--t4)', cursor: rated ? 'not-allowed' : 'pointer',
            background: 'none', border: 'none',
            textDecoration: 'underline', textUnderlineOffset: 3,
            padding: '8px', marginTop: 4, transition: 'color var(--t-fast)',
            opacity: rated ? 0.4 : 1,
          }}
          onMouseEnter={e => { if (!rated) e.currentTarget.style.color = 'var(--t3)' }}
          onMouseLeave={e => { if (!rated) e.currentTarget.style.color = '' }}
        >
          Skip rating
        </button>
      </div>
    </div>
  )
}
