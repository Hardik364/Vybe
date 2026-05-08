'use client'

export default function KarmaModal({ strangerUsername, strangerUserId, socket, onRate }) {
  function rate(r) {
    // Use socket — the rateUser handler checks partnership and updates karma in Redis
    if (socket && strangerUserId) {
      socket.emit('rateUser', { to: strangerUserId, rating: r })
    }
    onRate()
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
              className="karma-btn"
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = b.hoverColor
                e.currentTarget.style.color = b.hoverColor
                e.currentTarget.style.background = b.hoverBg
              }}
              onMouseLeave={e => {
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
          onClick={onRate}
          style={{
            fontSize: 13, color: 'var(--t4)', cursor: 'pointer',
            background: 'none', border: 'none',
            textDecoration: 'underline', textUnderlineOffset: 3,
            padding: '8px', marginTop: 4, transition: 'color var(--t-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--t3)'}
          onMouseLeave={e => e.currentTarget.style.color = ''}
        >
          Skip rating
        </button>
      </div>
    </div>
  )
}
