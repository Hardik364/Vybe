'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const API             = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

function Spinner({ size = 18, white = false }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: `2.5px solid ${white ? 'rgba(255,255,255,0.3)' : 'var(--border)'}`,
        borderTopColor: white ? '#fff' : 'var(--accent)',
        borderRadius: '50%',
        animation: 'spinAnim .75s linear infinite',
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  )
}

export default function SignUpPage() {
  const router = useRouter()
  // steps: 'new' | 'returning' | 'otp' | 'google-gender'
  const [step, setStep]               = useState('new')
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingName, setPendingName]   = useState('')
  const [isRet, setIsRet]             = useState(false)
  const [err, setErr]                 = useState('')
  const [guestErr, setGuestErr]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [guestDone, setGuestDone]     = useState(false)
  // Google new-user state
  const [googlePending, setGooglePending] = useState(null)  // { nonce, displayName }

  // Google callback ref — always points to latest closure so we avoid stale values
  const googleCallbackRef = useRef(null)
  const googleBtnRef      = useRef(null)

  useEffect(() => {
    if (localStorage.getItem('ub_guest_limit')) setGuestDone(true)
  }, [])

  useEffect(() => {
    const guestLimitHit = localStorage.getItem('ub_guest_limit')
    if (guestLimitHit) return
    const token = localStorage.getItem('ub_token')
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.valid) router.push('/chat') })
        .catch(() => {})
    }
  }, [])

  // ── Google sign-in handler ──────────────────────────────────
  // Assigned to ref so Google's callback closure always reads the latest version
  googleCallbackRef.current = useCallback(async (response) => {
    setLoading(true); setGuestErr('')
    try {
      const res  = await fetch(`${API}/auth/google`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ credential: response.credential }),
      })
      const data = await res.json()
      if (!res.ok) { setGuestErr(data.error || 'Google sign-in failed'); return }

      if (data.token) {
        // Returning user — straight to chat
        await handleVerified(data.token, data.username)
      } else if (data.isNew) {
        // New user — collect gender before creating account
        setGooglePending({ nonce: data.nonce, displayName: data.displayName })
        setStep('google-gender')
      }
    } catch {
      setGuestErr('Cannot reach server. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Load Google Identity Services script ────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    function initGoogle() {
      if (!window.google || !googleBtnRef.current) return
      window.google.accounts.id.initialize({
        client_id:   GOOGLE_CLIENT_ID,
        callback:    (resp) => googleCallbackRef.current(resp),
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      renderGoogleBtn()
    }

    if (window.google) {
      initGoogle()
    } else {
      const script = document.createElement('script')
      script.src   = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initGoogle
      document.head.appendChild(script)
      return () => { try { document.head.removeChild(script) } catch {} }
    }
  }, [])

  // Re-render Google button whenever the step changes back to a visible tab
  useEffect(() => {
    if (step === 'otp' || step === 'google-gender') return
    if (!window.google?.accounts?.id || !googleBtnRef.current) return
    renderGoogleBtn()
  }, [step])

  function renderGoogleBtn() {
    if (!googleBtnRef.current || !window.google?.accounts?.id) return
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type:   'standard',
      theme:  'outline',
      size:   'large',
      text:   'continue_with',
      shape:  'rectangular',
      width:  Math.min(googleBtnRef.current.getBoundingClientRect().width || 320, 400),
      locale: 'en',
    })
  }

  function otpSent(email, name, ret) {
    setLoading(false)   // reset before step change — prevents stuck spinner if user navigates back
    setPendingEmail(email); setPendingName(name)
    setIsRet(ret); setStep('otp'); setErr(''); setGuestErr('')
  }

  async function handleVerified(token, username) {
    localStorage.setItem('ub_token', token)
    localStorage.setItem('ub_username', username)
    localStorage.removeItem('ub_guest')
    localStorage.removeItem('ub_guest_limit')
    router.push('/chat')
  }

  async function handleGuest() {
    setLoading(true)
    // Generate or retrieve a persistent device ID so the server can track
    // the one-free-call limit by device (survives tab closes, cookie clears won't help)
    let deviceId = localStorage.getItem('ub_device_id')
    if (!deviceId) {
      deviceId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('ub_device_id', deviceId)
    }
    try {
      const res  = await fetch(`${API}/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('ub_token', data.token)
        localStorage.setItem('ub_username', data.username || 'Guest')
        localStorage.setItem('ub_guest', '1')
        router.push('/chat')
      } else {
        setGuestErr(data.error || 'Guest limit reached. Please sign up.')
      }
    } catch {
      setGuestErr('Cannot reach server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const CARDS = [
    { college: 'IIT Bombay',  color: 'oklch(64% 0.22 280)', letter: 'IIT' },
    { college: 'NIT Trichy',  color: 'oklch(67% 0.2 160)',  letter: 'NIT' },
    { college: 'BITS Pilani', color: 'oklch(72% 0.18 55)',  letter: 'BITS' },
  ]

  const showTabs = step !== 'otp' && step !== 'google-gender'

  return (
    <div className="screen-signup">
      {/* ── LEFT HERO ── */}
      <div className="signup-hero">
        <p className="hero-eyebrow">
          <span style={{ width: 28, height: 2, background: 'var(--accent)', borderRadius: 2, flexShrink: 0 }} />
          Real conversations
        </p>
        <h1 className="hero-title">
          Connect with<br />
          <em style={{ fontStyle: 'normal', color: 'transparent', WebkitTextStroke: '2px var(--accent)' }}>strangers</em><br />
          who get it.
        </h1>
        <p className="hero-desc">
          OpenChat matches you with people for real voice conversations that actually go somewhere. Open to everyone — just bring yourself.
        </p>

        <div className="hero-stats">
          {[
            { dot: true, text: '1,200+ people online' },
            { text: '🔐 Email-verified accounts' },
            { text: '🔒 Safe & anonymous' },
          ].map((s, i) => (
            <div key={i} className="hero-stat" style={{ animationDelay: `${i * 0.8}s` }}>
              {s.dot && <span className="online-dot" />}
              {s.text}
            </div>
          ))}
        </div>

        <div className="hero-cards">
          {CARDS.map((c, i) => (
            <div key={i} className="hero-card">
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: c.color, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 900, fontSize: 10,
                letterSpacing: '-0.5px', flexShrink: 0,
              }}>
                {c.letter}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.college}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Student connected 🟢</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="signup-form-panel">
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <ThemeToggle />
        </div>

        <div className="form-logo">
          <div className="form-logo-mark">O</div>
          OpenChat
        </div>

        {guestDone && showTabs && (
          <div style={{
            background: 'var(--accent-glow)', border: '1.5px solid var(--accent)',
            borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 4,
            fontSize: 13, color: 'var(--t1)', lineHeight: 1.5,
          }}>
            🎉 <strong>Your free call is done!</strong> Create a free account to keep going — no limits, no cost.
          </div>
        )}

        <h2 className="form-heading">
          {step === 'otp'           ? '📬 Check your inbox'
           : step === 'google-gender' ? '👋 One last step'
           : step === 'new'          ? '👋 Create account'
           : '👋 Welcome back'}
        </h2>
        <p className="form-sub">
          {step === 'otp'
            ? `We sent a 6-digit code to ${pendingEmail}`
            : step === 'google-gender'
            ? `Hi ${googlePending?.displayName || 'there'}! Just pick your gender to finish.`
            : step === 'new'
            ? 'Any email works — verify once, talk forever'
            : 'Log in with your email'}
        </p>

        {/* Auth Tabs */}
        {showTabs && (
          <div className="auth-tabs">
            {['new', 'returning'].map(s => (
              <button
                key={s}
                onClick={() => { setStep(s); setErr('') }}
                className={`auth-tab${step === s ? ' active' : ''}`}
              >
                {s === 'new' ? '✨ Sign Up' : '🔑 Log In'}
              </button>
            ))}
          </div>
        )}

        {step === 'new'          && <StepNew     onOtp={otpSent} err={err} setErr={setErr} loading={loading} setLoading={setLoading} />}
        {step === 'returning'    && <StepReturn   onOtp={otpSent} onSwitch={() => setStep('new')} err={err} setErr={setErr} loading={loading} setLoading={setLoading} />}
        {step === 'otp'          && <StepOtp      email={pendingEmail} name={pendingName} isRet={isRet} onVerified={handleVerified} onBack={() => setStep(isRet ? 'returning' : 'new')} />}
        {step === 'google-gender' && googlePending && (
          <StepGoogleGender
            displayName={googlePending.displayName}
            nonce={googlePending.nonce}
            onVerified={handleVerified}
            onBack={() => { setStep('new'); setGooglePending(null) }}
          />
        )}

        {/* Google Sign-In + divider + guest — shown on email tabs only */}
        {showTabs && (
          <>
            {/* Google button — rendered by Google's library into this div */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--t4)', fontSize: 12, margin: '16px 0 10px' }}>
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  or continue with
                  <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                {/* Google renders its iframe button here */}
                <div
                  ref={googleBtnRef}
                  style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                >
                  {/* Fallback while script loads */}
                  {loading && <Spinner />}
                </div>
              </>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--t4)', fontSize: 12, margin: '12px 0' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              or
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button
              onClick={() => { setGuestErr(''); handleGuest() }}
              disabled={loading}
              className="btn-ghost"
            >
              {loading ? <Spinner size={16} /> : '🚀 Try as Guest — 1 free call'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--t4)', textAlign: 'center', marginTop: 8 }}>No email needed. Jump right in.</p>
            {guestErr && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 8, animation: 'shake 300ms ease' }}>{guestErr}</p>}
          </>
        )}

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--t3)' }}>
          Want community chat?{' '}
          <a href="/community" style={{ color: 'var(--accent)', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-xs)', transition: 'all var(--t-fast)' }}>
            Community 💬
          </a>
        </p>
      </div>
    </div>
  )
}

/* ── Shared gender options ── */
const GENDER_OPTIONS = [
  { value: 'male',        label: '👨 Male' },
  { value: 'female',      label: '👩 Female' },
  { value: 'transgender', label: '🏳️‍🌈 Transgender' },
  { value: 'unspecified', label: '🤐 Prefer not to say' },
]

function GenderGrid({ gender, setGender, setErr }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 2 }}>
        I identify as
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {GENDER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setGender(opt.value); setErr?.('') }}
            style={{
              padding: '9px 12px', borderRadius: 'var(--r-md)',
              border: gender === opt.value ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
              background: gender === opt.value ? 'var(--accent-glow)' : 'var(--bg-elev)',
              color: gender === opt.value ? 'var(--accent)' : 'var(--t2)',
              fontSize: 13, fontWeight: gender === opt.value ? 700 : 500,
              cursor: 'pointer', transition: 'all var(--t-fast)', textAlign: 'left',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Step: New Account (email) ── */
function StepNew({ onOtp, err, setErr, loading, setLoading }) {
  const [name,   setName]   = useState('')
  const [email,  setEmail]  = useState('')
  const [gender, setGender] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim())  return setErr('Enter your name')
    if (!email.trim()) return setErr('Enter your email')
    if (!gender)       return setErr('Select your gender to continue')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), username: name.trim(), gender }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to send OTP'); setLoading(false); return }
      onOtp(email.trim(), name.trim(), false)
    } catch {
      setErr('Cannot reach server.'); setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <input
        className={`ub-input no-ico${err && !name ? ' err' : ''}`}
        type="text" placeholder="👤 What should we call you?" value={name}
        onChange={e => { setName(e.target.value); setErr('') }}
        autoFocus maxLength={24}
      />
      <input
        className="ub-input no-ico"
        type="email" placeholder="📧 Your email address" value={email}
        onChange={e => { setEmail(e.target.value); setErr('') }}
        maxLength={80}
      />
      <GenderGrid gender={gender} setGender={setGender} setErr={setErr} />
      {err && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', animation: 'shake 300ms ease' }}>{err}</p>}
      <PrimaryBtn loading={loading}>📨 Send Verification Code →</PrimaryBtn>
    </form>
  )
}

/* ── Step: Returning (email) ── */
function StepReturn({ onOtp, onSwitch, err, setErr, loading, setLoading }) {
  const [email, setEmail] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) return setErr('Enter your email address')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to send OTP'); setLoading(false); return }
      onOtp(email.trim(), data.username || '', true)
    } catch {
      setErr('Cannot reach server.'); setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <input
        className="ub-input no-ico"
        type="email" placeholder="📧 Your email address" value={email}
        onChange={e => { setEmail(e.target.value); setErr('') }}
        autoFocus
      />
      {err && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center' }}>{err}</p>}
      <PrimaryBtn loading={loading}>🔑 Send Login Code →</PrimaryBtn>
      <button type="button" onClick={onSwitch} style={{ fontSize: 13, color: 'var(--accent)', padding: '4px 0', cursor: 'pointer', background: 'none', border: 'none' }}>
        Not registered? Sign up →
      </button>
    </form>
  )
}

/* ── Step: Google new user — collect gender + optional username ── */
function StepGoogleGender({ displayName, nonce, onVerified, onBack }) {
  const [username, setUsername] = useState(displayName || '')
  const [gender,   setGender]   = useState('')
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)

  async function complete(e) {
    e.preventDefault()
    if (!gender)          return setErr('Please select your gender')
    if (!username.trim()) return setErr('Enter a display name')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/google/complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nonce, gender, username: username.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Something went wrong.'); setLoading(false); return }
      onVerified(data.token, data.username)
    } catch {
      setErr('Cannot reach server.'); setLoading(false)
    }
  }

  return (
    <form onSubmit={complete} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <input
        className="ub-input no-ico"
        type="text" placeholder="👤 Display name" value={username}
        onChange={e => { setUsername(e.target.value); setErr('') }}
        maxLength={24} autoFocus
      />
      <GenderGrid gender={gender} setGender={setGender} setErr={setErr} />
      {err && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', animation: 'shake 300ms ease' }}>{err}</p>}
      <PrimaryBtn loading={loading}>🚀 Finish & Start Talking →</PrimaryBtn>
      <button type="button" onClick={onBack} style={{ fontSize: 13, color: 'var(--t3)', padding: '4px 0', cursor: 'pointer', background: 'none', border: 'none' }}>
        ← Use email instead
      </button>
    </form>
  )
}

/* ── Step: OTP ── */
function StepOtp({ email, name, isRet, onVerified, onBack }) {
  const [otp, setOtp]       = useState(['', '', '', '', '', ''])
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const [cd, setCd]         = useState(60)
  const refs = useRef([])

  useEffect(() => {
    if (cd <= 0) return
    const t = setTimeout(() => setCd(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cd])

  function digit(i, v) {
    if (!/^\d?$/.test(v)) return
    const n = [...otp]; n[i] = v; setOtp(n)
    if (v && i < 5) refs.current[i + 1]?.focus()
  }
  function keydown(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }
  function paste(e) {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (t.length === 6) { setOtp(t.split('')); refs.current[5]?.focus() }
  }

  async function verify(e) {
    e.preventDefault()
    if (otp.join('').length < 6) return setErr('Enter all 6 digits')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.join('') }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Invalid code'); setLoading(false); return }
      onVerified(data.token, data.username)
    } catch {
      setErr('Cannot reach server.'); setLoading(false)
    }
  }

  async function resend() {
    setCd(60)
    try {
      await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {}
  }

  return (
    <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', alignItems: 'center' }}>
      {isRet && name && (
        <p style={{ fontSize: 14, color: 'var(--t2)', textAlign: 'center' }}>
          Welcome back, <strong style={{ color: 'var(--t1)' }}>{name}</strong> 👋
        </p>
      )}
      <p style={{ fontSize: 14, color: 'var(--t2)', textAlign: 'center', lineHeight: 1.6 }}>
        Code sent to <strong style={{ color: 'var(--t1)' }}>{email}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }} onPaste={paste}>
        {otp.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            className={`otp-box${d ? ' filled' : ''}`}
            type="text" inputMode="numeric" maxLength={1} placeholder="·"
            value={d} onChange={ev => digit(i, ev.target.value)} onKeyDown={ev => keydown(i, ev)}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {err && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', animation: 'shake 300ms ease' }}>{err}</p>}
      <PrimaryBtn loading={loading}>
        {isRet ? '✅ Verify & Log In →' : '🚀 Verify & Start Talking →'}
      </PrimaryBtn>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <button type="button" onClick={onBack} style={{ fontSize: 13, color: 'var(--t3)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 6px', borderRadius: 'var(--r-xs)', transition: 'color var(--t-fast)' }}>
          ← Change email
        </button>
        <button
          type="button"
          disabled={cd > 0}
          onClick={resend}
          style={{ fontSize: 13, color: 'var(--accent)', cursor: cd > 0 ? 'not-allowed' : 'pointer', opacity: cd > 0 ? 0.4 : 1, background: 'none', border: 'none', padding: '4px 6px', borderRadius: 'var(--r-xs)', transition: 'all var(--t-fast)' }}
        >
          {cd > 0 ? `Resend in ${cd}s ⏳` : '📨 Resend code'}
        </button>
      </div>
    </form>
  )
}

/* ── Shared: Primary Button ── */
function PrimaryBtn({ children, loading, onClick, disabled }) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick}
      disabled={loading || disabled}
      className="btn-primary"
    >
      {loading ? <Spinner size={16} white /> : children}
    </button>
  )
}
