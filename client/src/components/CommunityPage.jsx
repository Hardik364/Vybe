import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

const API = import.meta.env.VITE_APP_WEBSOCKET_URL

function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000)
    if (diff < 60)   return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString()
}

// ── Create channel modal ──────────────────────────────────────
function CreateChannelModal({ username, onCreated, onClose }) {
    const [name,  setName]  = useState('')
    const [desc,  setDesc]  = useState('')
    const [emoji, setEmoji] = useState('💬')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const EMOJIS = ['💬','📚','🎮','🎵','🎨','🏀','💻','🍕','✈️','🐶','🌙','⚡','🔥','💡','🎯']

    async function handleCreate(e) {
        e.preventDefault()
        if (!name.trim()) return setError('Channel name is required')
        setLoading(true)
        try {
            const res  = await fetch(`${API}/community/channels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: desc.trim(), emoji, username })
            })
            const data = await res.json()
            if (!res.ok) return setError(data.error || 'Failed to create channel')
            onCreated(data.id)
        } catch { setError('Cannot reach server') }
        finally { setLoading(false) }
    }

    return (
        <div className="cm-overlay" onClick={onClose}>
            <div className="cm-modal" onClick={e => e.stopPropagation()}>
                <h3 className="cm-modal-title">Create a Channel</h3>

                <div className="cm-emoji-grid">
                    {EMOJIS.map(e => (
                        <button key={e} className={`cm-emoji-btn${emoji === e ? ' selected' : ''}`}
                            onClick={() => setEmoji(e)}>{e}</button>
                    ))}
                </div>

                <form onSubmit={handleCreate}>
                    <div className="cm-field">
                        <label>Channel Name</label>
                        <div className="cm-input-prefix">
                            <span>#</span>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                                placeholder="my-channel"
                                maxLength={32}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="cm-field">
                        <label>Description <span style={{color:'#555'}}>optional</span></label>
                        <input
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            placeholder="What's this channel about?"
                            maxLength={120}
                        />
                    </div>
                    {error && <p className="cm-error">{error}</p>}
                    <div className="cm-modal-actions">
                        <button type="button" className="cm-btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="cm-btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : `${emoji} Create Channel`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Main Community Page ───────────────────────────────────────
export default function CommunityPage({ username: propUsername }) {
    const navigate  = useNavigate()
    const [username, setUsername] = useState(propUsername || localStorage.getItem('rt_username') || null)

    const [channels,    setChannels]    = useState([])
    const [activeId,    setActiveId]    = useState(null)
    const [messages,    setMessages]    = useState([])
    const [input,       setInput]       = useState('')
    const [showCreate,  setShowCreate]  = useState(false)
    const [liveCount,   setLiveCount]   = useState({})  // channelId → member count
    const [guestName,   setGuestName]   = useState('')
    const [showGuest,   setShowGuest]   = useState(!username)
    const [toast,       setToast]       = useState(null) // { text, type: 'error'|'warn' }
    const [typers,      setTypers]      = useState([])   // usernames currently typing
    const [reported,    setReported]    = useState(new Set()) // messageIds already reported
    const [karma,       setKarma]       = useState(null)  // { great, okay, disrespectful, total }

    const typingTimerRef = useRef(null)
    const isTypingRef    = useRef(false)

    const socketRef  = useRef(null)
    const bottomRef  = useRef(null)
    const prevCh     = useRef(null)

    const activeChannel = channels.find(c => c.id === activeId)

    // ── Toast helper ─────────────────────────────────────────
    function showToast(text, type = 'error') {
        setToast({ text, type })
        setTimeout(() => setToast(null), 3500)
    }

    // ── Guest login ──────────────────────────────────────────
    function handleGuestJoin(e) {
        e.preventDefault()
        const name = guestName.trim()
        if (!name) return
        localStorage.setItem('rt_username', name)
        setUsername(name)
        setShowGuest(false)
    }

    // ── Socket connection ────────────────────────────────────
    useEffect(() => {
        if (!username) return
        const token = localStorage.getItem('rt_token')
        const sock  = io(API, {
            transports: ['websocket'],
            auth: { username, token: token || undefined }
        })
        socketRef.current = sock

        sock.on('channel:message', msg => {
            setMessages(prev => {
                if (msg.channelId !== activeId) return prev
                return [...prev, msg]
            })
        })

        sock.on('channel:memberCount', ({ channelId, count }) => {
            setLiveCount(prev => ({ ...prev, [channelId]: count }))
        })

        sock.on('channel:messageDeleted', ({ channelId, messageId }) => {
            if (channelId === activeId) {
                setMessages(prev => prev.filter(m => m.id !== messageId))
            }
        })

        sock.on('channel:typing', ({ channelId, username }) => {
            if (channelId !== activeId) return
            setTypers(prev => prev.includes(username) ? prev : [...prev, username])
        })

        sock.on('channel:stopTyping', ({ channelId, username }) => {
            if (channelId !== activeId) return
            setTypers(prev => prev.filter(u => u !== username))
        })

        sock.on('connect', () => {
            // Fetch own karma once connected (socket id is stable per session)
            fetch(`${API}/community/karma/${sock.id}`)
                .then(r => r.json())
                .then(k => { if (k && !k.error) setKarma(k) })
                .catch(() => {})
        })

        sock.on('channel:reportAck', ({ messageId }) => {
            setReported(prev => new Set([...prev, messageId]))
        })

        sock.on('channel:rateLimited', ({ message }) => {
            showToast(message || 'Slow down! Too many messages.', 'warn')
        })

        sock.on('channel:error', ({ message }) => {
            showToast(message || 'Failed to send message.', 'error')
        })

        return () => sock.disconnect()
    }, [username])

    // Update message listener when activeId changes
    useEffect(() => {
        const sock = socketRef.current
        if (!sock) return
        sock.off('channel:message')
        sock.on('channel:message', msg => {
            if (msg.channelId === activeId) {
                setMessages(prev => [...prev, msg])
            }
        })
    }, [activeId])

    // ── Load channels list ───────────────────────────────────
    useEffect(() => {
        fetch(`${API}/community/channels`)
            .then(r => r.json())
            .then(list => {
                const arr = Array.isArray(list) ? list : []
                setChannels(arr)
                if (!activeId && arr.length) setActiveId(arr[0].id)
            })
            .catch(console.error)
    }, [])

    // ── Switch channel ───────────────────────────────────────
    useEffect(() => {
        if (!activeId || !socketRef.current) return
        // Leave previous channel
        if (prevCh.current && prevCh.current !== activeId) {
            socketRef.current.emit('channel:leave', { channelId: prevCh.current })
        }
        prevCh.current = activeId

        // Join new channel
        socketRef.current.emit('channel:join', { channelId: activeId })

        // Clear typers from previous channel
        setTypers([])

        // Load history
        fetch(`${API}/community/channels/${activeId}/messages`)
            .then(r => r.json())
            .then(msgs => setMessages(msgs))
            .catch(() => setMessages([]))
    }, [activeId])

    // ── Auto scroll to bottom ────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // ── Report message ───────────────────────────────────────
    function reportMessage(msg) {
        if (!socketRef.current || reported.has(msg.id)) return
        socketRef.current.emit('channel:report_message', {
            channelId: msg.channelId,
            messageId: msg.id,
            author:    msg.author,
        })
        // Optimistic update
        setReported(prev => new Set([...prev, msg.id]))
        showToast('Message reported. Thanks for keeping the community safe.', 'warn')
    }

    // ── Typing events ────────────────────────────────────────
    function handleInputChange(e) {
        setInput(e.target.value)
        if (!socketRef.current || !activeId) return
        if (!isTypingRef.current) {
            isTypingRef.current = true
            socketRef.current.emit('channel:typing', { channelId: activeId })
        }
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = setTimeout(() => {
            isTypingRef.current = false
            socketRef.current?.emit('channel:stopTyping', { channelId: activeId })
        }, 2000)
    }

    // ── Send message ─────────────────────────────────────────
    function sendMessage(e) {
        e.preventDefault()
        const text = input.trim()
        if (!text || !activeId || !socketRef.current) return
        // Stop typing indicator immediately on send
        isTypingRef.current = false
        clearTimeout(typingTimerRef.current)
        socketRef.current.emit('channel:stopTyping', { channelId: activeId })
        socketRef.current.emit('channel:message', { channelId: activeId, content: text })
        setInput('')
    }

    function handleChannelCreated(newId) {
        setShowCreate(false)
        // Refresh channel list
        fetch(`${API}/community/channels`)
            .then(r => r.json())
            .then(list => {
                const arr = Array.isArray(list) ? list : []
                setChannels(arr)
                setActiveId(newId)
            })
            .catch(console.error)
    }

    // ── Guest name prompt ────────────────────────────────────
    if (showGuest) return (
        <div className="cm-guest-screen">
            <div className="cm-guest-card">
                <div className="cm-logo"><span>✦</span> RealTalk</div>
                <h2>Join the Community</h2>
                <p>Pick a name to start chatting in channels</p>
                <form onSubmit={handleGuestJoin}>
                    <input
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="Your display name"
                        autoFocus maxLength={24}
                        className="cm-guest-input"
                    />
                    <button type="submit" className="cm-btn-primary" style={{width:'100%',marginTop:12}}>
                        Enter Community →
                    </button>
                </form>
                <button className="cm-back-link" onClick={() => navigate('/')}>← Back to home</button>
            </div>
        </div>
    )

    return (
        <div className="cm-page">
            {/* ── Left sidebar ── */}
            <aside className="cm-sidebar">
                <div className="cm-sidebar-header">
                    <button className="cm-logo-btn" onClick={() => navigate('/')}>
                        <span>✦</span> RealTalk
                    </button>
                    <span className="cm-sidebar-label">Community</span>
                </div>

                <div className="cm-channel-section">
                    <div className="cm-section-header">
                        <span>Channels</span>
                        <button className="cm-add-btn" onClick={() => setShowCreate(true)} title="Create channel">+</button>
                    </div>

                    <div className="cm-channel-list">
                        {channels.map(ch => (
                            <button
                                key={ch.id}
                                className={`cm-channel-item${activeId === ch.id ? ' active' : ''}`}
                                onClick={() => setActiveId(ch.id)}
                            >
                                <span className="cm-ch-emoji">{ch.emoji || '💬'}</span>
                                <span className="cm-ch-name">#{ch.name}</span>
                                {liveCount[ch.id] > 0 && (
                                    <span className="cm-ch-count">{liveCount[ch.id]}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="cm-sidebar-footer">
                    <div className="cm-user-info">
                        <div className="cm-user-avatar">{username?.[0]?.toUpperCase()}</div>
                        <div className="cm-user-details">
                            <span className="cm-user-name">{username}</span>
                            {karma && karma.total > 0 && (
                                <span className="cm-user-karma" title={`${karma.great} great · ${karma.okay} okay · ${karma.disrespectful} disrespectful`}>
                                    {karma.disrespectful / karma.total > 0.2
                                        ? '⚠️ Low karma'
                                        : karma.great / karma.total > 0.6
                                            ? '⭐ Great karma'
                                            : '👍 Good karma'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main chat area ── */}
            <main className="cm-main">
                {activeChannel ? <>
                    {/* Channel header */}
                    <div className="cm-chat-header">
                        <div>
                            <span className="cm-chat-title">
                                {activeChannel.emoji} #{activeChannel.name}
                            </span>
                            {activeChannel.description && (
                                <span className="cm-chat-desc"> — {activeChannel.description}</span>
                            )}
                        </div>
                        <div className="cm-chat-meta">
                            {liveCount[activeId] > 0 && (
                                <span className="cm-online-badge">
                                    ● {liveCount[activeId]} online
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="cm-messages">
                        {messages.length === 0 && (
                            <div className="cm-empty">
                                <div className="cm-empty-emoji">{activeChannel.emoji}</div>
                                <p>No messages yet. Say something!</p>
                            </div>
                        )}

                        {messages.map((msg, i) => {
                            const isFirst = i === 0 || messages[i-1].author !== msg.author
                            return (
                                <div key={msg.id} className={`cm-msg${isFirst ? ' cm-msg-first' : ''}`}>
                                    {isFirst && (
                                        <div className="cm-msg-header">
                                            <span className="cm-msg-avatar">{msg.author?.[0]?.toUpperCase()}</span>
                                            <span className="cm-msg-author">{msg.author}</span>
                                            <span className="cm-msg-time">{timeAgo(msg.timestamp)}</span>
                                        </div>
                                    )}
                                    <div className="cm-msg-body">
                                        {!isFirst && <span className="cm-msg-gap-avatar" />}
                                        <p className="cm-msg-text">{msg.content}</p>
                                        {msg.author !== username && (
                                            <button
                                                className={`cm-report-btn${reported.has(msg.id) ? ' reported' : ''}`}
                                                onClick={() => reportMessage(msg)}
                                                title={reported.has(msg.id) ? 'Reported' : 'Report message'}
                                                disabled={reported.has(msg.id)}
                                            >
                                                {reported.has(msg.id) ? '🚩' : '⚑'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={bottomRef} />
                    </div>

                    {/* Typing indicator */}
                    {typers.length > 0 && (
                        <div className="cm-typing-indicator">
                            <span className="cm-typing-dots"><span/><span/><span/></span>
                            <span className="cm-typing-text">
                                {typers.length === 1
                                    ? `${typers[0]} is typing…`
                                    : typers.length === 2
                                        ? `${typers[0]} and ${typers[1]} are typing…`
                                        : 'Several people are typing…'}
                            </span>
                        </div>
                    )}

                    {/* Rate limit / error toast */}
                    {toast && (
                        <div className={`cm-toast cm-toast-${toast.type}`}>
                            {toast.type === 'warn' ? '⚠️' : '❌'} {toast.text}
                        </div>
                    )}

                    {/* Input */}
                    <form className="cm-input-row" onSubmit={sendMessage}>
                        <input
                            value={input}
                            onChange={handleInputChange}
                            placeholder={`Message #${activeChannel.name}`}
                            className="cm-input"
                            maxLength={500}
                            autoFocus
                        />
                        <button type="submit" className="cm-send-btn" disabled={!input.trim()}>
                            Send ↑
                        </button>
                    </form>
                </> : (
                    <div className="cm-empty" style={{margin:'auto'}}>
                        <p style={{color:'#555'}}>Select a channel to start chatting</p>
                    </div>
                )}
            </main>

            {showCreate && (
                <CreateChannelModal
                    username={username}
                    onCreated={handleChannelCreated}
                    onClose={() => setShowCreate(false)}
                />
            )}
        </div>
    )
}
