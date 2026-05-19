'use client'
import { useState, useEffect, useRef } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

/**
 * AccountDrawer — slides in from the right as an overlay over the chat page.
 * ChatPage stays mounted → socket connection stays alive → stranger is not
 * disconnected when the user browses their account.
 *
 * Props:
 *   open    — boolean, controls visibility
 *   onClose — () => void, called when user clicks X or backdrop
 *   onLogout — () => void, delegated to parent so it can clean up socket too
 */
const GENDER_OPTIONS = [
  { value: 'male',        label: '👨 Male' },
  { value: 'female',      label: '👩 Female' },
  { value: 'transgender', label: '🏳️‍🌈 Transgender' },
  { value: 'unspecified', label: '🤐 Prefer not to say' },
]

export default function AccountDrawer({ open, onClose, onLogout }) {
  const [user, setUser] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [genderEdit, setGenderEdit] = useState(false)
  const [selectedGender, setSelectedGender] = useState('')
  const [genderSaving, setGenderSaving] = useState(false)
  const [genderMsg, setGenderMsg] = useState('')

  // Fetch user data whenever the drawer opens
  useEffect(() => {
    if (!open) return
    const token = localStorage.getItem('ub_token')
    if (!token) { onClose(); return }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (!d.valid) { onClose(); return }
        setUser(d)
        setLoaded(true)
      })
      .catch(() => onClose())
  }, [open])

  // Reset when closed so next open re-fetches fresh data
  useEffect(() => {
    if (!open) {
      setUser(null); setLoaded(false)
      setGenderEdit(false); setSelectedGender(''); setGenderMsg('')
    }
  }, [open])

  async function saveGender() {
    if (!selectedGender) return
    setGenderSaving(true)
    const token = localStorage.getItem('ub_token')
    try {
      const res = await fetch(`${API}/auth/update-gender`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gender: selectedGender }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(u => ({ ...u, gender: selectedGender, genderChanged: true }))
        setGenderEdit(false)
        setGenderMsg('Gender updated successfully.')
      } else {
        setGenderMsg(data.error || 'Failed to update.')
      }
    } catch {
      setGenderMsg('Cannot reach server.')
    } finally {
      setGenderSaving(false)
    }
  }

  // Trap Escape key
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'oklch(0% 0 0 / 0.55)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(420px, 100vw)',
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--border)',
        zIndex: 901,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: 'var(--t1)' }}>
            Account
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 'var(--r-full)',
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--t2)', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background var(--t-fast)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surf)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!loaded ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spinAnim .9s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* Profile card */}
              <div className="acc-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="acc-avatar">
                    {user.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, color: 'var(--t1)' }}>
                      {user.username}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2 }}>
                      ✉️ {user.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Conversations', value: `${user.callCount || 0} total`, border: 'var(--green)', bg: 'var(--green-sub)' },
                  { label: 'Karma Score', value: user.karma || 'Great 😊', border: 'var(--amber)', bg: 'var(--amber-sub)' },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="acc-float-stat"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.border, boxShadow: `0 0 8px ${s.border}`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 15, color: 'var(--t1)', fontWeight: 900 }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gender section */}
              <div style={{
                background: 'var(--bg-surf)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-xl)', padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Gender
                  </div>
                  {!user.genderChanged && !genderEdit && (
                    <button
                      onClick={() => { setGenderEdit(true); setSelectedGender(user.gender || ''); setGenderMsg('') }}
                      style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Change (1× only)
                    </button>
                  )}
                </div>

                {!genderEdit ? (
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>
                    {GENDER_OPTIONS.find(g => g.value === user.gender)?.label || '🤐 Not set'}
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5, margin: 0 }}>
                      You can change your gender <strong>once</strong> after signup. Choose carefully.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {GENDER_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSelectedGender(opt.value)}
                          style={{
                            padding: '8px 10px', borderRadius: 'var(--r-md)',
                            border: selectedGender === opt.value ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                            background: selectedGender === opt.value ? 'var(--accent-glow)' : 'var(--bg-elev)',
                            color: selectedGender === opt.value ? 'var(--accent)' : 'var(--t2)',
                            fontSize: 12, fontWeight: selectedGender === opt.value ? 700 : 500,
                            cursor: 'pointer', transition: 'all var(--t-fast)', textAlign: 'left',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={saveGender}
                        disabled={!selectedGender || genderSaving}
                        style={{
                          flex: 1, padding: '10px 0', borderRadius: 'var(--r-md)',
                          background: 'var(--accent)', color: '#fff',
                          border: 'none', fontSize: 13, fontWeight: 700,
                          cursor: selectedGender && !genderSaving ? 'pointer' : 'not-allowed',
                          opacity: selectedGender && !genderSaving ? 1 : 0.5,
                          transition: 'all var(--t-fast)',
                        }}
                      >
                        {genderSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => { setGenderEdit(false); setGenderMsg('') }}
                        style={{
                          padding: '10px 16px', borderRadius: 'var(--r-md)',
                          border: '1px solid var(--border)', background: 'none',
                          color: 'var(--t3)', fontSize: 13, cursor: 'pointer',
                          transition: 'all var(--t-fast)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
                {genderMsg && (
                  <p style={{ fontSize: 12, color: user.genderChanged ? 'var(--green)' : 'var(--red)', margin: 0 }}>
                    {genderMsg}
                  </p>
                )}
                {user.genderChanged && (
                  <p style={{ fontSize: 11, color: 'var(--t4)', margin: 0 }}>
                    ✓ Gender already changed — cannot update again.
                  </p>
                )}
              </div>

              {/* Sign out */}
              <div style={{
                background: 'var(--bg-surf)',
                border: '1px solid oklch(62% 0.24 25 / 0.2)',
                borderRadius: 'var(--r-xl)', padding: 20,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Sign Out
                </div>
                <button
                  onClick={onLogout}
                  style={{
                    padding: '12px 0', borderRadius: 'var(--r-md)',
                    fontSize: 14, fontWeight: 700,
                    border: '1px solid var(--red)', color: 'var(--red)',
                    background: 'none', cursor: 'pointer',
                    transition: 'background var(--t-fast)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--red-sub)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  🚪 Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}
