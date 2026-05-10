'use client'
import ThemeToggle from '@/components/ThemeToggle'

export default function Navbar({
  strangerUsername, connectionStatus, promptActive, onPromptClick,
  liveCount, onLogout, onAccount, onCommunity
}) {
  return (
    <nav className="navbar">
      {/* Logo */}
      <div className="nav-logo" onClick={onCommunity}>
        <div className="nav-logo-mark">U</div>
        UniBuddy
      </div>

      {/* Center — stranger chip or searching */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {connectionStatus ? (
          <div className="stranger-chip">
            <span className="online-dot" />
            {strangerUsername || 'Anonymous'}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--t3)', fontSize: 13 }}>
            <div style={{
              width: 16, height: 16, border: '2.5px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spinAnim .9s linear infinite', flexShrink: 0
            }} />
            {liveCount > 0 ? `${liveCount} people waiting…` : 'Finding your match…'}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Live badge */}
        {liveCount > 0 && (
          <div className="live-badge">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.8)', flexShrink: 0 }} />
            {liveCount} live
          </div>
        )}

        {/* Prompt button */}
        <button
          onClick={onPromptClick}
          disabled={!connectionStatus}
          className={`nav-pill${promptActive ? ' active' : ''}`}
          style={!connectionStatus ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
        >
          💬 {promptActive ? 'Hide Prompt' : 'Prompt'}
        </button>

        {/* Account */}
        <button onClick={onAccount} className="nav-ico" title="Account">
          👤
        </button>

        <ThemeToggle />

        {/* Logout */}
        <button
          onClick={onLogout}
          className="nav-ico danger"
          title="Log out"
        >
          🚪
        </button>
      </div>
    </nav>
  )
}
