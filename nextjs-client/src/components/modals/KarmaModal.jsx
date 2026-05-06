'use client'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function KarmaModal({ strangerUsername, strangerUserId, socket, onRate }) {
  async function rate(r) {
    const token = localStorage.getItem('ub_token')
    try {
      await fetch(`${API}/api/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ratedUserId: strangerUserId, rating: r }),
      })
    } catch {}
    onRate()
  }

  const BTNS = [
    { key: 'great',        label: 'Great',         emoji: '😊', hoverColor: 'var(--green)',  hoverBg: 'var(--green-sub)'  },
    { key: 'okay',         label: 'Okay',           emoji: '😐', hoverColor: 'var(--amber)',  hoverBg: 'var(--amber-sub)'  },
    { key: 'disrespectful',label: 'Disrespectful',  emoji: '😠', hoverColor: 'var(--red)',    hoverBg: 'var(--red-sub)'    },
  ]

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center animate-fade-in"
      style={{ background: 'var(--bg-over)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="bg-surf border border-bdr rounded-t-xl pt-7 pb-12 px-6 w-full max-w-[500px] flex flex-col items-center gap-1.5 shadow-lg animate-slide-up"
      >
        {/* Handle */}
        <div className="w-9 h-1 bg-bdr rounded-2xl mb-2" />

        <h3 className="text-[18px] font-bold text-t1 mt-1">How was the conversation? 💬</h3>
        <p className="text-[13px] text-t3 mb-2.5">Your feedback helps us build a better community</p>

        <div className="flex gap-2.5 w-full mb-1">
          {BTNS.map(b => (
            <button
              key={b.key}
              onClick={() => rate(b.key)}
              className="flex-1 bg-elev border border-bdr rounded-lg py-[18px] px-2 flex flex-col items-center gap-2 text-t2 transition-all hover:translate-y-[-2px]"
              style={{ '--hover-color': b.hoverColor, '--hover-bg': b.hoverBg }}
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
              <span className="text-[28px]">{b.emoji}</span>
              <span className="text-[13px] font-bold">{b.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onRate}
          className="text-[13px] text-t4 underline underline-offset-[3px] px-2 py-2 mt-1 hover:text-t3 transition-colors"
        >
          Skip rating
        </button>
      </div>
    </div>
  )
}
