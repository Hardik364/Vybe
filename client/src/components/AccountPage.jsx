// AccountPage — shows current tier, expiry, and purchase history
// Route: /account  (add to App.jsx router)

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UpgradeModal from '../assets/ui/UpgradeModal'

const API = import.meta.env.VITE_APP_WEBSOCKET_URL

function formatDuration(seconds) {
    if (!seconds) return null
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    if (d > 0) return `${d}d ${h}h remaining`
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m remaining`
}

function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PLAN_LABELS = {
    'day-pass':     'Day Pass',
    'week-pass':    'Week Pass',
    'plus-monthly': 'Plus Monthly',
    'pro-monthly':  'Pro Monthly',
}

const TIER_INFO = {
    free: { label: 'Free',  color: '#A0A0A0', scope: 'Your college only'   },
    plus: { label: 'Plus',  color: '#6C63FF', scope: 'Same state colleges'  },
    pro:  { label: 'Pro',   color: '#F59E0B', scope: 'Any college in India & globally' },
}

export default function AccountPage() {
    const navigate = useNavigate()
    const [sub,         setSub]         = useState(null)   // { tier, expiresIn, expiresAt, history }
    const [loading,     setLoading]     = useState(true)
    const [showUpgrade, setShowUpgrade] = useState(false)
    const [username,    setUsername]    = useState(null)

    const token = localStorage.getItem('ub_token')

    useEffect(() => {
        if (!token) { navigate('/'); return }

        // Load user info + subscription status in parallel
        Promise.all([
            fetch(`${API}/auth/me`,          { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
            fetch(`${API}/payments/status`,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        ]).then(([me, status]) => {
            if (!me.valid) { navigate('/'); return }
            setUsername(me.username)
            setSub(status)
        }).catch(() => navigate('/'))
        .finally(() => setLoading(false))
    }, [])

    function handleTierChange(tier) {
        setSub(prev => ({ ...prev, tier }))
        setShowUpgrade(false)
    }

    if (loading) return (
        <div id="accountPage">
            <div className="account-loading">
                <div className="account-spinner" />
                <p>Loading account…</p>
            </div>
        </div>
    )

    const tier = sub?.tier || 'free'
    const info = TIER_INFO[tier] || TIER_INFO.free

    return (
        <div id="accountPage">
            {/* Back bar */}
            <nav className="account-nav">
                <button className="account-back-btn" onClick={() => navigate('/chat')}>
                    ← Back to UniBuddy
                </button>
                <span className="account-nav-title">Account</span>
            </nav>

            <div className="account-body">

                {/* Profile card */}
                <div className="account-card">
                    <div className="account-avatar">{username?.[0]?.toUpperCase()}</div>
                    <div>
                        <h2 className="account-username">{username}</h2>
                        <p className="account-email-note">Logged in via college email</p>
                    </div>
                </div>

                {/* Subscription card */}
                <div className="account-card">
                    <h3 className="account-section-title">Current Plan</h3>
                    <div className="account-tier-row">
                        <span className="account-tier-badge" style={{ background: info.color }}>
                            {info.label}
                        </span>
                        <span className="account-tier-scope">{info.scope}</span>
                    </div>

                    {sub?.expiresIn && (
                        <div className="account-expiry">
                            <span className="account-expiry-icon">⏱</span>
                            <span>{formatDuration(sub.expiresIn)}</span>
                            <span className="account-expiry-date">
                                (expires {formatDate(sub.expiresAt)})
                            </span>
                        </div>
                    )}

                    {tier === 'free' && (
                        <p className="account-free-note">
                            You're on the free plan. Upgrade to match students beyond your college.
                        </p>
                    )}

                    <button
                        className="account-upgrade-btn"
                        style={{ background: tier === 'free' ? '#6C63FF' : info.color }}
                        onClick={() => setShowUpgrade(true)}
                    >
                        {tier === 'free' ? '⚡ Upgrade Plan' : '🔄 Change Plan'}
                    </button>
                </div>

                {/* Purchase history */}
                <div className="account-card">
                    <h3 className="account-section-title">Purchase History</h3>
                    {(!sub?.history || sub.history.length === 0) ? (
                        <p className="account-empty-history">No purchases yet.</p>
                    ) : (
                        <div className="account-history-list">
                            {sub.history.map((h, i) => (
                                <div key={i} className="account-history-item">
                                    <div>
                                        <span className="account-history-plan">
                                            {PLAN_LABELS[h.planId] || h.tier}
                                        </span>
                                        <span className="account-history-date">
                                            {h.activatedAt ? formatDate(new Date(h.activatedAt).toISOString()) : ''}
                                        </span>
                                    </div>
                                    <span className="account-history-tier" style={{ color: TIER_INFO[h.tier]?.color }}>
                                        {TIER_INFO[h.tier]?.label || h.tier}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Danger zone */}
                <div className="account-card account-danger">
                    <h3 className="account-section-title">Sign Out</h3>
                    <button
                        className="account-logout-btn"
                        onClick={() => {
                            localStorage.removeItem('ub_token')
                            navigate('/')
                        }}
                    >
                        Log Out
                    </button>
                </div>

            </div>

            {showUpgrade && (
                <UpgradeModal
                    currentTier={tier}
                    onClose={() => setShowUpgrade(false)}
                    onTierChange={handleTierChange}
                />
            )}
        </div>
    )
}
