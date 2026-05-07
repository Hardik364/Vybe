'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

export default function CommunityPage() {
  const router = useRouter()

  const [channels,    setChannels]    = useState([])
  const [activeId,    setActiveId]    = useState(null)
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [username]                    = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('ub_username') || 'Student' : 'Student'
  )
  const [showCreate,  setShowCreate]  = useState(false)
  const [reportedIds, setReportedIds] = useState(new Set())
  const [loadingCh,   setLoadingCh]   = useState(true)

  const socketRef  = useRef(null)
  const bottomRef  = useRef(null)
  const activeIdRef = useRef(null)   // always current — used inside socket callbacks

  activeIdRef.current = activeId
  const activeChannel = channels.find(c => c.id === activeId)

  // ── Fetch real channels from REST ────────────────────────────
  async function loadChannels() {
    try {
      const res  = await fetch(`${API}/community/channels`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setChannels(data)
        setActiveId(prev => prev || data[0].id)
      }
    } catch (e) {
      console.error('[Community] loadChannels', e)
    } finally {
      setLoadingCh(false)
    }
  }

  // ── Fetch last 60 messages for a channel ────────────────────
  async function loadHistory(channelId) {
    try {
      const res  = await fetch(`${API}/community/channels/${channelId}/messages`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch {
      setMessages([])
    }
  }

  // ── Socket setup (once on mount) ────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('ub_token')
    const sock  = io(API, {
      transports: ['websocket'],
      auth: { token: token || undefined, username },
    })
    socketRef.current = sock

    // Real-time incoming messages
    sock.on('channel:message', msg => {
      if (msg.channelId === activeIdRef.current) {
        setMessages(p => [...p, msg])
      }
    })

    // Live member count updates
    sock.on('channel:memberCount', ({ channelId, count }) => {
      setChannels(p => p.map(ch =>
        ch.id === channelId ? { ...ch, memberCount: count } : ch
      ))
    })

    return () => sock.disconnect()
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Join/leave when active channel changes ───────────────────
  useEffect(() => {
    if (!activeId || !socketRef.current) return

    socketRef.current.emit('channel:join', { channelId: activeId })
    loadHistory(activeId)

    return () => {
      socketRef.current?.emit('channel:leave', { channelId: activeId })
    }
  }, [activeId])

  // ── Initial channel load ─────────────────────────────────────
  useEffect(() => { loadChannels() }, [])

  // ── Auto-scroll on new messages ──────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send a message ───────────────────────────────────────────
  function sendMsg(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !socketRef.current || !activeId) return

    socketRef.current.emit('channel:message', { channelId: activeId, content: text })
    setInput('')
  }

  // ── Report a message ─────────────────────────────────────────
  function report(msg) {
    setReportedIds(p => new Set([...p, msg.id]))
    socketRef.current?.emit('channel:report_message', {
      channelId: activeId,
      messageId: msg.id,
      author:    msg.author,
    })
  }

  const fmt = ts => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const AVATAR_COLORS = ['#7c3aed','#059669','#d97706','#dc2626','#2563eb']
  const av = name => AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'var(--bg-base)' }}>

      {/* ── Sidebar ── */}
      <aside className="cm-side">
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            onClick={() => router.push('/chat')}
            style={{
              fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 900,
              color: 'var(--accent)', letterSpacing: '-0.5px', textAlign: 'left',
              background: 'none', border: 'none', cursor: 'pointer',
              transition: 'opacity var(--t-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = ''}
          >
            UniBuddy 💬
          </button>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Community
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 8px' }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Channels
            </span>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                width: 22, height: 22, borderRadius: 'var(--r-xs)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: 'var(--t4)', background: 'none', border: 'none',
                cursor: 'pointer', transition: 'all var(--t-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elev)'; e.currentTarget.style.color = 'var(--t1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' }}
            >
              +
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 8px', gap: 2 }}>
            {loadingCh ? (
              <div style={{ padding: '12px 10px', color: 'var(--t4)', fontSize: 13 }}>Loading…</div>
            ) : channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveId(ch.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 'var(--r-sm)',
                  fontSize: 14, fontWeight: 600, textAlign: 'left', width: '100%',
                  border: 'none', cursor: 'pointer', transition: 'all var(--t-fast)',
                  background: activeId === ch.id ? 'var(--accent-glow)' : 'none',
                  color:      activeId === ch.id ? 'var(--t1)'          : 'var(--t3)',
                }}
                onMouseEnter={e => { if (activeId !== ch.id) { e.currentTarget.style.background = 'var(--bg-elev)'; e.currentTarget.style.color = 'var(--t2)' } }}
                onMouseLeave={e => { if (activeId !== ch.id) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '' } }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{ch.emoji}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  # {ch.name}
                </span>
                {/* Real member count — 0 means empty, don't show badge */}
                {(ch.memberCount > 0) && (
                  <span style={{
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 10, fontWeight: 900,
                    padding: '2px 6px', borderRadius: 'var(--r-full)',
                  }}>
                    {ch.memberCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* User footer */}
        <div style={{ padding: '14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            fontSize: 12, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {username}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t4)' }}>✨ Active</div>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Channel header */}
        <header style={{
          height: 56, padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>
              {activeChannel?.emoji} #{activeChannel?.name}
            </span>
            <span style={{ fontSize: 14, color: 'var(--t4)', marginLeft: 12 }}>
              {activeChannel?.description}
            </span>
          </div>
          {/* Real live count from socket room size */}
          <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>
            🟢 {activeChannel?.memberCount ?? 0} online
          </span>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--t4)', fontSize: 14 }}>
              <span style={{ fontSize: 40 }}>💬</span>
              <span>No messages yet — be the first!</span>
            </div>
          ) : messages.map((msg, i) => {
            const isFirst = i === 0 || messages[i - 1]?.author !== msg.author
            return (
              <div key={msg.id || i} style={{ marginTop: isFirst ? 16 : 0 }}>
                {isFirst && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      border: '1px solid var(--border)',
                      background: av(msg.author) + '22', color: av(msg.author),
                      fontSize: 11, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {msg.author?.[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{msg.author}</span>
                    <span style={{ fontSize: 11, color: 'var(--t4)' }}>{fmt(msg.timestamp)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 30, flexShrink: 0 }} />
                  <p style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.6, wordBreak: 'break-word', flex: 1 }}>
                    {msg.content}  {/* ← real field name from server */}
                  </p>
                  <button
                    onClick={() => report(msg)}
                    disabled={reportedIds.has(msg.id)}
                    style={{
                      fontSize: 13, padding: '2px 4px', borderRadius: 'var(--r-xs)',
                      opacity: reportedIds.has(msg.id) ? 1 : 0,
                      color: reportedIds.has(msg.id) ? 'var(--red)' : 'var(--t4)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      transition: 'all var(--t-fast)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; if (!reportedIds.has(msg.id)) e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { if (!reportedIds.has(msg.id)) { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = '' } }}
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
        <form
          onSubmit={sendMsg}
          style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}
        >
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(e) } }}
            placeholder={`💬 Message #${activeChannel?.name ?? ''}…`}
            rows={1}
            style={{
              flex: 1, background: 'var(--bg-elev)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', color: 'var(--t1)', fontSize: 14,
              padding: '10px 14px', outline: 'none', resize: 'none',
              fontFamily: 'var(--font-body)', transition: 'border-color var(--t-fast)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = ''}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            style={{
              background: 'var(--accent)', color: '#fff',
              borderRadius: 'var(--r-md)', padding: '10px 18px',
              fontSize: 13, fontWeight: 900, border: 'none', cursor: 'pointer',
              transition: 'all var(--t-fast)',
              opacity: !input.trim() ? 0.4 : 1,
            }}
            onMouseEnter={e => { if (input.trim()) { e.currentTarget.style.background = 'var(--accent-h)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.transform = '' }}
          >
            Send 🚀
          </button>
        </form>
      </main>

      {/* Create channel modal */}
      {showCreate && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-over)', backdropFilter: 'blur(12px)',
            animation: 'fadeIn 250ms ease',
          }}
          onClick={() => setShowCreate(false)}
        >
          <CreateChanModal
            username={username}
            onCreated={ch => {
              setChannels(p => [...p, ch])
              setShowCreate(false)
              setActiveId(ch.id)
            }}
            onClose={() => setShowCreate(false)}
          />
        </div>
      )}
    </div>
  )
}

/* ── Create Channel Modal — calls real API ── */
function CreateChanModal({ username, onCreated, onClose }) {
  const EMOJIS = ['💬','📚','🎮','🎵','🎨','🏀','💻','🍕','✈️','🐶','🌙','⚡','🔥','💡','🎯']
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [emoji,   setEmoji]   = useState('💬')
  const [err,     setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Name required')
    setLoading(true)
    try {
      const res  = await fetch(`${API}/community/channels`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), description: desc.trim(), emoji, username }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to create channel'); setLoading(false); return }
      onCreated({ id: data.id, name: data.name, emoji, description: desc.trim(), memberCount: 0 })
    } catch {
      setErr('Cannot reach server.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-surf)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)', padding: 32, width: '100%', maxWidth: 420,
        boxShadow: 'var(--sh-lg)', animation: 'popIn 380ms var(--t-spring)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, color: 'var(--t1)', marginBottom: 20 }}>
        ✨ Create a Channel
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {EMOJIS.map(em => (
          <button
            key={em}
            type="button"
            onClick={() => setEmoji(em)}
            style={{
              width: 40, height: 40, borderRadius: 'var(--r-sm)',
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: emoji === em ? 'var(--accent-glow)' : 'var(--bg-elev)',
              border: emoji === em ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all var(--t-fast)',
            }}
          >
            {em}
          </button>
        ))}
      </div>
      <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Channel Name
          </label>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'var(--bg-elev)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', overflow: 'hidden',
          }}>
            <span style={{ padding: '10px 12px', fontSize: 15, fontWeight: 900, color: 'var(--t3)', borderRight: '1px solid var(--border)', userSelect: 'none' }}>
              #
            </span>
            <input
              value={name}
              onChange={e => { setName(e.target.value.toLowerCase().replace(/\s/g, '-')); setErr('') }}
              placeholder="my-channel" maxLength={32} autoFocus
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 14, padding: '10px 12px', fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Description <span style={{ color: 'var(--t4)', textTransform: 'none', fontWeight: 400 }}>optional</span>
          </label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="What's this about?" maxLength={120}
            style={{
              background: 'var(--bg-elev)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', color: 'var(--t1)', fontSize: 14,
              padding: '10px 14px', outline: 'none',
              fontFamily: 'var(--font-body)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = ''}
          />
        </div>
        {err && <p style={{ color: 'var(--red)', fontSize: 13 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            type="button" onClick={onClose}
            style={{
              padding: '10px 18px', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', color: 'var(--t2)',
              fontSize: 14, fontWeight: 600, background: 'none', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.background = 'var(--accent-glow)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; e.currentTarget.style.background = '' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 20px', borderRadius: 'var(--r-md)',
              background: 'var(--accent)', color: '#fff',
              fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-h)' }}
            onMouseLeave={e => e.currentTarget.style.background = ''}
          >
            {loading ? 'Creating…' : `${emoji} Create`}
          </button>
        </div>
      </form>
    </div>
  )
}
