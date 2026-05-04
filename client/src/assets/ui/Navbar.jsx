import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Navbar({ strangerUsername, connectionStatus, promptActive, onPromptClick, liveCount, setUsername, onUpgradeClick, tier }) {
    const navigate = useNavigate()
    const [theme, setTheme] = useState(() => localStorage.getItem('ub_theme') || 'dark')

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('ub_theme', theme)
    }, [theme])

    function toggleTheme() {
        setTheme(t => t === 'dark' ? 'light' : 'dark')
    }

    function handleLogout() {
        localStorage.removeItem('ub_token')
        if (setUsername) setUsername(null)
        navigate('/')
    }

    return (
        <nav id="navbar">
            <div id="nav-logo">
                <span id="nav-logo-spark">✦</span>
                UniBuddy
            </div>

            <div id="nav-center">
                {connectionStatus ? (
                    <div id="nav-stranger-info">
                        <span className="online-dot"></span>
                        <span id="nav-stranger-name">💬 {strangerUsername}</span>
                    </div>
                ) : (
                    <div id="nav-searching">
                        <div id="nav-loader"></div>
                        <span>
                            {strangerUsername
                                ? '🔗 Connecting...'
                                : liveCount > 0
                                    ? `🔍 ${liveCount} ${liveCount === 1 ? 'person' : 'people'} waiting — finding your match...`
                                    : '🔍 Finding your match...'}
                        </span>
                    </div>
                )}
            </div>

            <div id="nav-right">
                {/* Live count badge — only show when not connected */}
                {!connectionStatus && liveCount > 0 && (
                    <span id="nav-live-count">
                        🟢 {liveCount} online
                    </span>
                )}

                {/* Tier badge */}
                {tier && tier !== 'free' && (
                    <span
                        className={`nav-tier-badge ${tier}`}
                        onClick={onUpgradeClick}
                        title={`${tier === 'plus' ? 'Plus' : 'Pro'} plan active`}
                    >
                        {tier === 'plus' ? '⚡ Plus' : '🌍 Pro'}
                    </span>
                )}

                <button
                    id="promptBtn"
                    className={[
                        promptActive      ? 'active'   : '',
                        !connectionStatus ? 'disabled' : '',
                    ].join(' ').trim()}
                    onClick={connectionStatus ? onPromptClick : undefined}
                    title={connectionStatus ? 'Get a conversation prompt' : 'Connect with someone first'}
                    aria-disabled={!connectionStatus}
                >
                    🎲 Prompts
                </button>

                <button id="themeBtn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>

                <button id="accountBtn" onClick={() => navigate('/account')} title="Account & subscription">
                    👤
                </button>

                <button id="logoutBtn" onClick={handleLogout} title="Log out">
                    ⏏︎
                </button>
            </div>
        </nav>
    )
}
