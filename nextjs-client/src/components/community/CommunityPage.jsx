'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

const DEFAULT_CHANNELS = [
  { id: '1', emoji: '💬', name: 'general',     description: 'General chat',          count: 24 },
  { id: '2', emoji: '📚', name: 'study-help',  description: 'Academic help',          count: 8  },
  { id: '3', emoji: '🎮', name: 'gaming',      description: 'Gaming & fun',           count: 15 },
  { id: '4', emoji: '💻', name: 'tech-talk',   description: 'Tech discussions',       count: 12 },
  { id: '5', emoji: '🎵', name: 'music',       description: 'Share your playlist',    count: 6  },
]

export default function CommunityPage() {
  const router = useRouter()
  const [channels,   setChannels]   = useState(DEFAULT_CHANNELS)
  const [activeId,   setActiveId]   = useState('1')
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [username,   setUsername]   = useState('You')
  const [showCreate, setShowCreate] = useState(false)
  const [reportedIds, setReportedIds] = useState(new Set())
  const socketRef  = useRef(null)
  const bottomRef  = useRef(null)

  const activeChannel = channels.find(c => c.id === activeId)

  useEffect(() => {
    const u = localStorage.getItem('ub_username') || 'Student'
    setUsername(u)
    const token = localStorage.getItem('ub_token')
    const sock = io(API, {
      transports: ['websocket'],
      auth: { token: token || undefined, username: u },
    })
    socketRef.current = sock
    sock.on('communityMessage', msg => setMessages(p => [...p, msg]))
    sock.on('communityHistory', hist => setMessages(hist || []))
    sock.emit('joinChannel', activeId)
    return () => sock.disconnect()
  }, [])

  useEffect(() => {
    if (!socketRef.current) return
    socketRef.current.emit('joinChannel', activeId)
    setMessages([])
    socketRef.current.emit('getChannelHistory', activeId)
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMsg(e) {
    e.preventDefault()
    if (!input.trim() || !socketRef.current) return
    socketRef.current.emit('communityMessage', { channelId: activeId, message: input.trim() })
    setMessages(p => [...p, { id: Date.now(), author: username, message: input.trim(), timestamp: new Date().toISOString() }])
    setInput('')
  }

  function report(id) {
    setReportedIds(p => new Set([...p, id]))
    socketRef.current?.emit('reportCommunityMessage', { messageId: id })
  }

  const fmt = ts => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const AVATARS = ['#7c3aed','#059669','#d97706','#dc2626','#2563eb','#7c3aed']
  const av = (name) => AVATARS[name?.charCodeAt(0) % AVATARS.length] || AVATARS[0]

  return (
    <div className="absolute inset-0 flex bg-base">
      {/* Sidebar */}
      <aside className="w-[242px] min-w-[242px] bg-surf border-r border-bdr flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-bdr flex flex-col gap-0.5">
          <button
            onClick={() => router.push('/chat')}
            className="font-display text-[18px] font-black text-accent tracking-[-0.5px] text-left transition-opacity hover:opacity-75"
          >
            UniBuddy 💬
          </button>
          <span className="text-[10px] font-black text-t4 uppercase tracking-[1px]">Community</span>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-[10px] font-black text-t4 uppercase tracking-[0.8px]">Channels</span>
            <button
              onClick={() => setShowCreate(true)}
              className="w-[22px] h-[22px] rounded-xs flex items-center justify-center text-t4 text-[16px] transition-all hover:bg-elev hover:text-t1"
            >
              +
            </button>
          </div>
          <div className="flex flex-col px-2 gap-0.5">
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveId(ch.id)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-sm text-[14px] font-semibold text-left w-full transition-all ${
                  activeId === ch.id ? 'bg-accent-glow text-t1' : 'text-t3 hover:bg-elev hover:text-t2'
                }`}
              >
                <span className="text-[15px] shrink-0">{ch.emoji}</span>
                <span className="flex-1 truncate"># {ch.name}</span>
                {ch.count > 0 && (
                  <span className="bg-accent text-white text-[10px] font-black px-1.5 py-0.5 rounded-2xl">{ch.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* User footer */}
        <div className="p-3.5 border-t border-bdr flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-full bg-accent text-white text-[12px] font-black flex items-center justify-center shrink-0">
            {username?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="text-[13px] font-bold text-t1">{username}</div>
            <div className="text-[11px] text-t4">✨ Active</div>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 px-5 border-b border-bdr flex items-center justify-between shrink-0">
          <div>
            <span className="text-[16px] font-bold text-t1">{activeChannel?.emoji} #{activeChannel?.name}</span>
            <span className="text-[14px] text-t4 ml-3">{activeChannel?.description}</span>
          </div>
          <span className="text-[12px] text-green font-bold">🟢 {channels.find(c => c.id === activeId)?.count || 0} online</span>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-0.5">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-t4 text-[14px]">
              <span className="text-[40px]">💬</span>
              <span>No messages yet — be the first!</span>
            </div>
          ) : messages.map((msg, i) => {
            const isFirst = i === 0 || messages[i-1]?.author !== msg.author
            return (
              <div key={msg.id || i} className={`${isFirst ? 'mt-4' : ''}`}>
                {isFirst && (
                  <div className="flex items-center gap-2.5 mb-1">
                    <div
                      className="w-[30px] h-[30px] rounded-full border border-bdr text-t2 text-[11px] font-black flex items-center justify-center shrink-0"
                      style={{ background: av(msg.author) + '22', color: av(msg.author) }}
                    >
                      {msg.author?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-[14px] font-bold text-t1">{msg.author}</span>
                    <span className="text-[11px] text-t4">{fmt(msg.timestamp)}</span>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <div className="w-[30px] shrink-0" />
                  <p className="text-[14px] text-t1 leading-[1.6] break-words flex-1">{msg.message}</p>
                  <button
                    onClick={() => report(msg.id)}
                    disabled={reportedIds.has(msg.id)}
                    className={`text-[13px] px-1 py-0.5 rounded-xs opacity-0 hover:opacity-100 group-hover:opacity-100 transition-all ${reportedIds.has(msg.id) ? 'opacity-100 text-red cursor-default' : 'text-t4 hover:text-red'}`}
                  >
                    {reportedIds.has(msg.id) ? '🚩' : '⚑'}
                  </button>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-4 pt-3 border-t border-bdr flex gap-2.5 items-center shrink-0">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e) } }}
            placeholder={`💬 Message #${activeChannel?.name}…`}
            rows={1}
            className="flex-1 bg-elev border border-bdr rounded-md text-t1 text-[14px] px-3.5 py-2.5 outline-none resize-none transition-all placeholder:text-t4 focus:border-accent font-body"
            style={{ fontFamily: 'var(--font-body)' }}
          />
          <button
            onClick={sendMsg}
            disabled={!input.trim()}
            className="bg-accent text-white rounded-md px-[18px] py-2.5 text-[13px] font-black transition-all hover:bg-accent-h hover:translate-y-[-1px] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send 🚀
          </button>
        </div>
      </main>

      {/* Create channel modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-over backdrop-blur-xl animate-fade-in" onClick={() => setShowCreate(false)}>
          <CreateChanModal
            onCreated={ch => { setChannels(p => [...p, ch]); setShowCreate(false); setActiveId(ch.id) }}
            onClose={() => setShowCreate(false)}
          />
        </div>
      )}
    </div>
  )
}

function CreateChanModal({ onCreated, onClose }) {
  const EMOJIS = ['💬','📚','🎮','🎵','🎨','🏀','💻','🍕','✈️','🐶','🌙','⚡','🔥','💡','🎯']
  const [name, setName]   = useState('')
  const [desc, setDesc]   = useState('')
  const [emoji, setEmoji] = useState('💬')
  const [err, setErr]     = useState('')

  function create(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Name required')
    onCreated({ id: Date.now().toString(), emoji, name: name.trim().toLowerCase().replace(/\s/g, '-'), description: desc.trim(), count: 0 })
  }

  return (
    <div className="bg-surf border border-bdr rounded-xl p-8 w-full max-w-[420px] shadow-lg animate-pop-in" onClick={e => e.stopPropagation()}>
      <h3 className="font-display text-[20px] font-black text-t1 mb-5">✨ Create a Channel</h3>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {EMOJIS.map(e => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`w-10 h-10 rounded-sm text-[20px] flex items-center justify-center transition-all hover:bg-float ${emoji === e ? 'border-2 border-accent bg-accent-glow' : 'bg-elev border-2 border-transparent'}`}
          >
            {e}
          </button>
        ))}
      </div>
      <form onSubmit={create} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black text-t3 uppercase tracking-[0.6px]">Channel Name</label>
          <div className="flex items-center bg-elev border border-bdr rounded-md overflow-hidden focus-within:border-accent transition-all">
            <span className="px-3 py-2.5 text-t3 text-[15px] font-black border-r border-bdr select-none">#</span>
            <input
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
              placeholder="my-channel"
              maxLength={32}
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-t1 text-[14px] px-3 py-2.5"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black text-t3 uppercase tracking-[0.6px]">
            Description <span className="text-t4 normal-case font-normal">optional</span>
          </label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="What's this about?"
            maxLength={120}
            className="bg-elev border border-bdr rounded-md text-t1 text-[14px] px-3.5 py-2.5 outline-none focus:border-accent transition-all placeholder:text-t4"
          />
        </div>
        {err && <p className="text-red text-[13px]">{err}</p>}
        <div className="flex gap-2.5 justify-end mt-2">
          <button type="button" onClick={onClose} className="px-[18px] py-2.5 rounded-md border border-bdr text-t2 text-[14px] font-semibold hover:border-accent hover:text-t1 hover:bg-accent-glow transition-all">Cancel</button>
          <button type="submit" className="px-5 py-2.5 rounded-md bg-accent text-white text-[14px] font-bold hover:bg-accent-h transition-all">{emoji} Create</button>
        </div>
      </form>
    </div>
  )
}
