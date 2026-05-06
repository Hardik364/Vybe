'use client'
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function PostCallScreen({ strangerUsername, strangerUserId, socket, onConnect, onMoveOn }) {
  const [myPressed,    setMyPressed]    = useState(false)
  const [theyPressed,  setTheyPressed]  = useState(false)
  const [timer,        setTimer]        = useState(30)
  const [contactTab,   setContactTab]   = useState('whatsapp')
  const [contactVal,   setContactVal]   = useState('')
  const [exchanged,    setExchanged]    = useState(null)

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

  if (exchanged) {
    return (
      <Overlay>
        <div className="text-[40px] mb-1">🤝</div>
        <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-t4">You connected!</p>
        <h2 className="font-display text-[24px] font-bold text-t1">Exchange successful</h2>
        <div className="flex gap-2 flex-wrap justify-center">
          {exchanged.whatsapp && (
            <a
              href={`https://wa.me/${exchanged.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="px-7 py-3 bg-accent-glow border border-accent rounded-md text-accent text-[16px] font-bold transition-all hover:bg-[oklch(64%_0.22_280/0.28)]"
            >
              📱 WhatsApp
            </a>
          )}
          {exchanged.instagram && (
            <a
              href={`https://instagram.com/${exchanged.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="px-7 py-3 bg-accent-glow border border-accent rounded-md text-accent text-[16px] font-bold transition-all hover:bg-[oklch(64%_0.22_280/0.28)]"
            >
              📷 Instagram
            </a>
          )}
        </div>
        <button onClick={onConnect} className="text-[13px] text-t4 px-2 py-2 hover:text-t3 transition-colors">
          Continue →
        </button>
      </Overlay>
    )
  }

  return (
    <Overlay>
      <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-t4">That's a wrap</p>
      <h2 className="font-display text-[24px] font-bold text-t1 leading-[1.3]">
        Stay in touch with {strangerUsername || 'them'}?
      </h2>

      {/* Contact input */}
      <div className="flex gap-2 bg-elev rounded-md p-1 w-full max-w-xs">
        {['whatsapp', 'instagram'].map(tab => (
          <button
            key={tab}
            onClick={() => setContactTab(tab)}
            className={`flex-1 py-2 px-4 rounded-[calc(var(--r-md)-2px)] text-[13px] font-bold transition-all ${
              contactTab === tab ? 'bg-surf text-t1 shadow-sm' : 'text-t3'
            }`}
          >
            {tab === 'whatsapp' ? '📱 WhatsApp' : '📷 Instagram'}
          </button>
        ))}
      </div>
      <div className="flex items-center w-full max-w-xs bg-elev border border-bdr rounded-md overflow-hidden transition-all focus-within:border-accent">
        <span className="px-3.5 py-3 text-t3 text-[13px] font-bold border-r border-bdr select-none">
          {contactTab === 'whatsapp' ? '+91' : '@'}
        </span>
        <input
          value={contactVal}
          onChange={e => setContactVal(e.target.value)}
          placeholder={contactTab === 'whatsapp' ? '9876543210' : 'username'}
          className="flex-1 bg-transparent border-none outline-none text-t1 text-[14px] px-3.5 py-3 placeholder:text-t4"
        />
      </div>

      <div className="flex gap-3 w-full">
        <button
          onClick={handleConnect}
          disabled={myPressed}
          className={`flex-1 rounded-lg py-[18px] px-4 text-[15px] font-bold flex flex-col items-center gap-1 transition-all border-none text-white ${
            myPressed
              ? 'bg-elev text-t3 cursor-default'
              : 'bg-green hover:translate-y-[-2px] hover:shadow-[0_8px_28px_var(--green-glow)]'
          }`}
        >
          <span>🤝 Connect</span>
          <span className="text-[12px] font-normal opacity-75">
            {myPressed ? (theyPressed ? 'Both connected! 🎉' : 'Waiting for them…') : `${timer}s`}
          </span>
        </button>
        <button
          onClick={onMoveOn}
          className="flex-1 rounded-lg py-[18px] px-4 text-[15px] font-semibold flex flex-col items-center gap-1 transition-all bg-transparent border border-bdr text-t2 hover:border-red hover:text-red hover:bg-red-sub"
        >
          <span>👋 Move On</span>
          <span className="text-[12px] font-normal opacity-60">Gone forever</span>
        </button>
      </div>

      <p className="text-[12px] text-t4 max-w-[300px] leading-[1.6] text-center">
        💛 Both must press Connect within {timer}s. Contact info is only shared on mutual agreement.
      </p>
    </Overlay>
  )
}

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-5 animate-fade-in" style={{ background: 'var(--bg-over)', backdropFilter: 'blur(12px)' }}>
      <div className="bg-surf border border-bdr rounded-xl p-10 w-full max-w-[480px] text-center flex flex-col items-center gap-3.5 shadow-lg animate-pop-in">
        {children}
      </div>
    </div>
  )
}
