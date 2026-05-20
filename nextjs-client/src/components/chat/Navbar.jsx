'use client'
import { useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import useIsMobile from '@/hooks/useIsMobile'

const PREFS = [
  { value: 'anyone',      label: 'Anyone',  emoji: '🌐' },
  { value: 'male',        label: 'Male',    emoji: '👨' },
  { value: 'female',      label: 'Female',  emoji: '👩' },
  { value: 'transgender', label: 'Trans',   emoji: '🏳️‍🌈' },
]

function pct(stats, key) {
  if (!stats || !stats.total) return 0
  return stats[key] ?? 0
}

export default function Navbar({
  strangerUsername, connectionStatus, promptActive, onPromptClick,
  liveCount, onLogout, onAccount, onCommunity,
  genderPref, onGenderPrefChange, genderStats,
}) {
  const [prefOpen, setPrefOpen] = useState(false)
  const isMobile = useIsMobile(768)

  const activePref = PREFS.find(p => p.value === genderPref) || PREFS[0]

  function choosePref(val) {
    onGenderPrefChange?.(val)
    setPrefOpen(false)
  }

  return (
    <nav className="navbar">

      {/* ── Logo ── */}
      <div className="nav-logo" onClick={onCommunity}>
        <div className="nav-logo-mark">O</div>
        {!isMobile && 'OpenChat'}
      </div>

      {/* ── Center — stranger chip / searching + gender pref ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 6 : 10, minWidth: 0 }}>

        {/* Connection status */}
        {connectionStatus ? (
          <div className="stranger-chip" style={{ maxWidth: isMobile ? 120 : 'unset', overflow: 'hidden' }}>
            <span className="online-dot" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {strangerUsername || 'Anonymous'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t3)', fontSize: isMobile ? 12 : 13 }}>
            <div style={{
              width: 14, height: 14, border: '2.5px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spinAnim .9s linear infinite', flexShrink: 0,
            }} />
            {isMobile
              ? (liveCount > 0 ? `${liveCount} online` : 'Searching…')
              : (liveCount > 0 ? `${liveCount} people online` : 'Finding your match…')
            }
          </div>
        )}

        {/* Gender preference picker */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setPrefOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: isMobile ? '5px 7px' : '5px 10px',
              borderRadius: 'var(--r-md)',
              background: prefOpen ? 'var(--bg-elev)' : 'var(--bg-surf)',
              border: '1px solid var(--border)',
              color: 'var(--t2)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all var(--t-fast)', whiteSpace: 'nowrap',
            }}
            title="Who do you want to meet?"
          >
            <span>{activePref.emoji}</span>
            {!isMobile && <span>{activePref.label}</span>}
            <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
          </button>

          {prefOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--bg-surf)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--sh-md)',
              padding: 6, zIndex: 1000, minWidth: 180,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: 'var(--t4)', padding: '2px 8px 6px', textTransform: 'uppercase' }}>
                Meet with
              </p>
              {PREFS.map(p => {
                const pctVal = p.value === 'male'        ? pct(genderStats, 'pctMale')
                             : p.value === 'female'      ? pct(genderStats, 'pctFemale')
                             : p.value === 'transgender' ? pct(genderStats, 'pctTransgender')
                             : null
                const isActive = genderPref === p.value
                return (
                  <button
                    key={p.value}
                    onClick={() => choosePref(p.value)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', padding: '7px 10px',
                      borderRadius: 'calc(var(--r-md) - 2px)',
                      background: isActive ? 'var(--accent-glow)' : 'none',
                      border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                      color: isActive ? 'var(--accent)' : 'var(--t2)',
                      fontSize: 13, fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer', transition: 'all var(--t-fast)', gap: 8,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                    </span>
                    {pctVal !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isActive ? 'var(--accent)' : 'var(--t3)',
                        background: isActive ? 'none' : 'var(--bg-elev)',
                        padding: '1px 6px', borderRadius: 99,
                      }}>
                        {genderStats?.total > 0 ? `${pctVal}%` : '—'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, flexShrink: 0 }}>

        {/* Live badge — hide on very small screens */}
        {liveCount > 0 && !isMobile && (
          <div className="live-badge">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.8)', flexShrink: 0 }} />
            {liveCount} live
          </div>
        )}

        {/* Prompt button — icon-only on mobile */}
        <button
          onClick={onPromptClick}
          disabled={!connectionStatus}
          className={`nav-pill${promptActive ? ' active' : ''}`}
          style={!connectionStatus ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
          title={promptActive ? 'Hide Prompt' : 'Prompt'}
        >
          💬{!isMobile && ` ${promptActive ? 'Hide Prompt' : 'Prompt'}`}
        </button>

        {/* Account */}
        <button onClick={onAccount} className="nav-ico" title="Account">
          👤
        </button>

        <ThemeToggle />

        {/* Logout */}
        <button onClick={onLogout} className="nav-ico danger" title="Log out">
          🚪
        </button>
      </div>

      {/* Close dropdown on outside click */}
      {prefOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setPrefOpen(false)}
        />
      )}
    </nav>
  )
}
