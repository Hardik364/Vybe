import { useState, useEffect, useRef } from 'react'

const API       = import.meta.env.VITE_APP_WEBSOCKET_URL
const POLL_MS   = 3000

function fmt(sec) {
    if (sec < 60)   return `${sec}s`
    if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`
    return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`
}

function StatCard({ label, value, color = '#6C63FF', sub }) {
    return (
        <div style={{
            background: '#1A1A1A', border: '1px solid #2A2A2A',
            borderRadius: 12, padding: '18px 22px', minWidth: 130,
        }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value ?? '—'}</div>
            <div style={{ fontSize: 13, color: '#A0A0A0', marginTop: 2 }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>}
        </div>
    )
}

function StatusBadge({ status }) {
    const map = {
        'in-call':    { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   label: '● In Call' },
        'waiting':    { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  label: '◌ Waiting' },
        'connecting': { color: '#6C63FF', bg: 'rgba(108,99,255,0.12)', label: '◌ Connecting' },
    }
    const s = map[status] || map['connecting']
    return (
        <span style={{
            background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
            borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            whiteSpace: 'nowrap',
        }}>{s.label}</span>
    )
}

export default function AdminDashboard() {
    const [key,       setKey]       = useState(sessionStorage.getItem('admin_key') || '')
    const [authed,    setAuthed]    = useState(false)
    const [data,      setData]      = useState(null)
    const [error,     setError]     = useState('')
    const [lastPoll,  setLastPoll]  = useState(null)
    const [filter,    setFilter]    = useState('')
    const [tab,       setTab]       = useState('users')  // users | banned
    const [action,    setAction]    = useState(null)     // { type, target }
    const intervalRef = useRef(null)

    async function fetchDashboard(adminKey) {
        try {
            const res  = await fetch(`${API}/admin/dashboard`, {
                headers: { 'x-admin-key': adminKey }
            })
            if (res.status === 403) { setAuthed(false); setError('Wrong admin key'); return }
            const json = await res.json()
            setData(json)
            setLastPoll(new Date())
            setError('')
        } catch {
            setError('Cannot reach server')
        }
    }

    function login(e) {
        e.preventDefault()
        const k = key.trim()
        if (!k) return
        sessionStorage.setItem('admin_key', k)
        setAuthed(true)
        fetchDashboard(k)
    }

    useEffect(() => {
        if (!authed) return
        intervalRef.current = setInterval(() => fetchDashboard(key), POLL_MS)
        return () => clearInterval(intervalRef.current)
    }, [authed, key])

    async function kick(socketId) {
        await fetch(`${API}/admin/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
            body: JSON.stringify({ socketId })
        })
        fetchDashboard(key)
        setAction(null)
    }

    async function ban(email) {
        await fetch(`${API}/admin/ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
            body: JSON.stringify({ email })
        })
        fetchDashboard(key)
        setAction(null)
    }

    async function unban(email) {
        await fetch(`${API}/admin/unban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
            body: JSON.stringify({ email })
        })
        fetchDashboard(key)
    }

    // ── Login screen ─────────────────────────────────────────
    if (!authed) return (
        <div style={{
            minHeight: '100vh', background: '#0D0D0D', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif'
        }}>
            <form onSubmit={login} style={{
                background: '#1A1A1A', border: '1px solid #2A2A2A',
                borderRadius: 16, padding: 40, width: 360, textAlign: 'center'
            }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                    <span style={{ color: '#6C63FF' }}>✦</span> RealTalk Admin
                </div>
                <p style={{ color: '#555', fontSize: 13, marginBottom: 24 }}>Super Admin Dashboard</p>
                {error && <p style={{ color: '#EF4444', marginBottom: 12, fontSize: 13 }}>{error}</p>}
                <input
                    type="password"
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="Enter admin key"
                    autoFocus
                    style={{
                        width: '100%', padding: '12px 16px', background: '#242424',
                        border: '1px solid #333', borderRadius: 10, color: '#fff',
                        fontSize: 14, marginBottom: 16, boxSizing: 'border-box', outline: 'none'
                    }}
                />
                <button type="submit" style={{
                    width: '100%', padding: '12px', background: '#6C63FF',
                    border: 'none', borderRadius: 10, color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer'
                }}>Access Dashboard →</button>
            </form>
        </div>
    )

    const s  = data?.stats  || {}
    const users = (data?.users || []).filter(u =>
        !filter || u.username.toLowerCase().includes(filter.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(filter.toLowerCase()) ||
        u.collegeDomain?.includes(filter) || u.socketId?.includes(filter)
    )

    // ── Dashboard ────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh', background: '#0D0D0D', color: '#fff',
            fontFamily: 'Inter, Arial, sans-serif', fontSize: 14
        }}>
            {/* Header */}
            <div style={{
                background: '#111', borderBottom: '1px solid #1E1E1E',
                padding: '14px 28px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50
            }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                    <span style={{ color: '#6C63FF' }}>✦</span> RealTalk <span style={{ color: '#555', fontWeight: 400 }}>Super Admin</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ color: '#555', fontSize: 12 }}>
                        Last updated: {lastPoll ? lastPoll.toLocaleTimeString() : '—'}
                        <span style={{ color: '#22C55E', marginLeft: 8 }}>● LIVE</span>
                    </div>
                    <button onClick={() => { setAuthed(false); sessionStorage.removeItem('admin_key') }}
                        style={{ background: 'none', border: '1px solid #333', color: '#A0A0A0', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                        Logout
                    </button>
                </div>
            </div>

            <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>

                {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #EF4444', borderRadius: 10, padding: '10px 16px', marginBottom: 20, color: '#EF4444' }}>{error}</div>}

                {/* Stat cards */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
                    <StatCard label="Online Now"    value={s.connected}    color="#22C55E" sub="WebSocket connections" />
                    <StatCard label="Active Calls"  value={s.activeCalls}  color="#6C63FF" sub="Paired conversations" />
                    <StatCard label="Waiting"       value={s.waiting}      color="#F59E0B" sub="In queue" />
                    <StatCard label="Shadow Banned" value={s.shadowBanned} color="#A78BFA" sub="Hidden from normal pool" />
                    <StatCard label="Suspended"     value={s.suspended}    color="#EF4444" sub="Auto-kicked" />
                    <StatCard label="Banned Emails" value={s.bannedEmails} color="#EF4444" sub="Blocked accounts" />
                    <StatCard label="Uptime"        value={data?.server?.uptime} color="#A0A0A0" />
                    <StatCard label="Memory"        value={data?.server?.memory} color="#A0A0A0" />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                    {['users', 'banned'].map(t => (
                        <button key={t} onClick={() => setTab(t)} style={{
                            background: tab === t ? '#6C63FF' : '#1A1A1A',
                            border: '1px solid ' + (tab === t ? '#6C63FF' : '#2A2A2A'),
                            color: tab === t ? '#fff' : '#A0A0A0',
                            padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
                            fontWeight: 600, fontSize: 13, textTransform: 'capitalize'
                        }}>{t === 'users' ? `Live Users (${data?.users?.length || 0})` : `Banned Emails (${s.bannedEmails || 0})`}</button>
                    ))}
                </div>

                {tab === 'users' && <>
                    {/* Search */}
                    <input
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="🔍  Filter by name, email, college, socket ID..."
                        style={{
                            width: '100%', padding: '10px 16px', background: '#1A1A1A',
                            border: '1px solid #2A2A2A', borderRadius: 10, color: '#fff',
                            fontSize: 13, marginBottom: 16, boxSizing: 'border-box', outline: 'none'
                        }}
                    />

                    {/* User table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #1E1E1E', color: '#555', fontSize: 11, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    {['Username', 'Email', 'College', 'Status', 'Talking With', 'Online', 'Shadow?', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', fontWeight: 600 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 && (
                                    <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#555' }}>No users online</td></tr>
                                )}
                                {users.map(u => (
                                    <tr key={u.socketId} style={{
                                        borderBottom: '1px solid #1A1A1A',
                                        background: u.shadowBanned ? 'rgba(167,139,250,0.04)' : 'transparent',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                                    onMouseLeave={e => e.currentTarget.style.background = u.shadowBanned ? 'rgba(167,139,250,0.04)' : 'transparent'}
                                    >
                                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                                            {u.username}
                                            <div style={{ fontSize: 10, color: '#555', fontWeight: 400, marginTop: 2, fontFamily: 'monospace' }}>{u.socketId.slice(0,12)}...</div>
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#A0A0A0', fontSize: 12 }}>{u.email || '—'}</td>
                                        <td style={{ padding: '10px 12px', color: '#A0A0A0', fontSize: 12 }}>{u.collegeDomain || 'global'}</td>
                                        <td style={{ padding: '10px 12px' }}><StatusBadge status={u.status} /></td>
                                        <td style={{ padding: '10px 12px', color: '#A0A0A0', fontSize: 12 }}>
                                            {u.pairedUsername ? <span style={{ color: '#22C55E' }}>↔ {u.pairedUsername}</span> : '—'}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#A0A0A0', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmt(u.onlineSec)}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            {u.shadowBanned
                                                ? <span style={{ color: '#A78BFA', fontSize: 12 }}>👻 Yes</span>
                                                : <span style={{ color: '#555', fontSize: 12 }}>—</span>}
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => setAction({ type: 'kick', target: u })}
                                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                                    Kick
                                                </button>
                                                {u.email && (
                                                    <button onClick={() => setAction({ type: 'ban', target: u })}
                                                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                                        Ban
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>}

                {tab === 'banned' && (
                    <div>
                        {(data?.banned || []).length === 0 && <p style={{ color: '#555', padding: 40, textAlign: 'center' }}>No banned emails</p>}
                        {(data?.banned || []).map(email => (
                            <div key={email} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 16px', borderBottom: '1px solid #1A1A1A', color: '#EF4444'
                            }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{email}</span>
                                <button onClick={() => unban(email)} style={{
                                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                                    color: '#22C55E', padding: '3px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600
                                }}>Unban</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Confirm modal */}
            {action && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999
                }}>
                    <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 16, padding: 32, width: 380 }}>
                        <h3 style={{ marginBottom: 12, fontSize: 18 }}>
                            {action.type === 'kick' ? '⚡ Kick User' : '🚫 Ban User'}
                        </h3>
                        <p style={{ color: '#A0A0A0', marginBottom: 6, fontSize: 13 }}>
                            {action.type === 'kick'
                                ? `Disconnect ${action.target.username} immediately?`
                                : `Permanently ban ${action.target.email}? They won't be able to rejoin.`}
                        </p>
                        <p style={{ color: '#555', fontSize: 11, marginBottom: 24, fontFamily: 'monospace' }}>
                            {action.target.socketId}
                        </p>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setAction(null)} style={{
                                flex: 1, padding: '10px', background: '#242424', border: '1px solid #333',
                                color: '#A0A0A0', borderRadius: 8, cursor: 'pointer', fontWeight: 600
                            }}>Cancel</button>
                            <button
                                onClick={() => action.type === 'kick' ? kick(action.target.socketId) : ban(action.target.email)}
                                style={{
                                    flex: 1, padding: '10px', background: '#EF4444', border: 'none',
                                    color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 700
                                }}>
                                {action.type === 'kick' ? 'Kick' : 'Ban Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
