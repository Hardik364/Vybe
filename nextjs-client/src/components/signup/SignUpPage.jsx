'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

function Spinner({ size = 18 }) {
  return (
    <div
      style={{
        width: size, height: size,
        border: '2.5px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spinAnim .75s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

export default function SignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState('new')        // 'new' | 'returning' | 'otp'
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [isRet, setIsRet] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem('ub_token')
    if (token) {
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.valid) router.push('/chat') })
        .catch(() => {})
    }
  }, [])

  function otpSent(email, name, ret) {
    setPendingEmail(email); setPendingName(name); setIsRet(ret); setStep('otp'); setErr('')
  }

  async function handleVerified(token, username) {
    localStorage.setItem('ub_token', token)
    localStorage.setItem('ub_username', username)
    router.push('/chat')
  }

  async function handleGuest() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('ub_token', data.token)
        localStorage.setItem('ub_username', data.username || 'Guest')
        localStorage.setItem('ub_guest', '1')
        const deviceId = data.deviceId || Math.random().toString(36).slice(2)
        localStorage.setItem('ub_device_id', deviceId)
        router.push('/chat')
      } else {
        // Guest limit reached
        setErr(data.error || 'Guest limit reached. Please sign up.')
      }
    } catch {
      setErr('Cannot reach server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const CARDS = [
    { college: 'IIT Bombay',  color: 'oklch(64% 0.22 280)', letter: 'IIT' },
    { college: 'NIT Trichy',  color: 'oklch(67% 0.2 160)',  letter: 'NIT' },
    { college: 'BITS Pilani', color: 'oklch(72% 0.18 55)',  letter: 'BITS' },
  ]

  return (
    <div className="absolute inset-0 flex items-stretch overflow-hidden">
      {/* ── LEFT HERO ── */}
      <div className="flex-1 flex flex-col justify-end p-[52px_56px] relative overflow-hidden">
        <p className="text-[11px] font-bold tracking-[2.5px] uppercase text-accent mb-5 flex items-center gap-2.5">
          <span className="w-7 h-0.5 bg-accent rounded-sm shrink-0" />
          Real conversations
        </p>
        <h1
          className="font-display font-black text-t1 leading-[1.05] tracking-[-2px] mb-6"
          style={{ fontSize: 'clamp(42px, 5vw, 72px)' }}
        >
          Connect with<br />
          <em
            style={{
              fontStyle: 'normal',
              color: 'transparent',
              WebkitTextStroke: '2px var(--accent)',
            }}
          >strangers</em><br />
          who get it.
        </h1>
        <p className="text-[17px] text-t2 leading-[1.7] max-w-[440px] mb-9">
          UniBuddy matches you with students from your college and beyond for real video conversations that actually go somewhere.
        </p>

        {/* Stats pills */}
        <div className="flex gap-3.5 flex-wrap">
          {[
            { dot: true, text: '1,200+ students online' },
            { text: '🎓 College-verified only' },
            { text: '🔒 Safe & anonymous' },
          ].map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 bg-glass border border-glass-b backdrop-blur-xl rounded-2xl px-[18px] py-2.5 text-[13px] font-semibold"
              style={{ animation: `float 4s ease-in-out ${i * 0.8}s infinite` }}
            >
              {s.dot && (
                <span
                  className="w-2 h-2 rounded-full bg-green shrink-0"
                  style={{ animation: 'pulseDot 2s ease infinite' }}
                />
              )}
              {s.text}
            </div>
          ))}
        </div>

        {/* Floating college cards */}
        <div
          className="absolute top-10 right-[-20px] flex flex-col gap-3.5 pointer-events-none"
          style={{ transform: 'perspective(600px) rotateY(-12deg) rotateX(4deg)' }}
        >
          {CARDS.map((c, i) => (
            <div
              key={i}
              className="bg-glass border border-glass-b backdrop-blur-2xl rounded-lg p-[16px_20px] flex items-center gap-3.5 w-[220px] shadow-md"
            >
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white font-black shrink-0"
                style={{ background: c.color, fontSize: 10, letterSpacing: '-0.5px' }}
              >
                {c.letter}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-[13px] font-bold text-t1 truncate">{c.college}</div>
                <div className="text-[11px] text-t3 mt-0.5">Student connected 🟢</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div
        className="w-[440px] shrink-0 bg-surf border-l border-bdr flex flex-col justify-center px-11 py-12 overflow-y-auto relative"
      >
        <div className="absolute top-5 right-5">
          <ThemeToggle />
        </div>

        {/* Logo */}
        <div className="font-display text-[22px] font-black text-accent flex items-center gap-2.5 mb-8 tracking-[-0.5px]">
          <div className="w-[34px] h-[34px] bg-accent rounded-[10px] flex items-center justify-center text-white text-base font-black font-body shrink-0">
            U
          </div>
          UniBuddy
        </div>

        <h2 className="font-display text-[26px] font-bold text-t1 mb-1.5 tracking-[-0.5px]">
          {step === 'otp' ? '📬 Check your inbox' : step === 'new' ? '👋 Create account' : '👋 Welcome back'}
        </h2>
        <p className="text-[14px] text-t3 mb-7 leading-[1.6]">
          {step === 'otp'
            ? `We sent a 6-digit code to ${pendingEmail}`
            : step === 'new'
            ? 'College email required — keeps it student-only'
            : 'Log in with your college email'}
        </p>

        {/* Tabs */}
        {step !== 'otp' && (
          <div className="flex bg-elev rounded-sm p-[3px] gap-[3px] mb-6">
            {['new', 'returning'].map(s => (
              <button
                key={s}
                onClick={() => { setStep(s); setErr('') }}
                className={`flex-1 py-[9px] rounded-[calc(var(--r-sm)-1px)] text-[14px] font-semibold transition-all ${
                  step === s
                    ? 'bg-surf text-t1 shadow-sm'
                    : 'text-t3 hover:text-t2'
                }`}
              >
                {s === 'new' ? '✨ Sign Up' : '🔑 Log In'}
              </button>
            ))}
          </div>
        )}

        {step === 'new'       && <StepNew       onOtp={otpSent} err={err} setErr={setErr} loading={loading} setLoading={setLoading} />}
        {step === 'returning' && <StepReturn     onOtp={otpSent} onSwitch={() => setStep('new')} err={err} setErr={setErr} loading={loading} setLoading={setLoading} />}
        {step === 'otp'       && <StepOtp        email={pendingEmail} name={pendingName} isRet={isRet} onVerified={handleVerified} onBack={() => setStep(isRet ? 'returning' : 'new')} />}

        {step !== 'otp' && (
          <>
            <div className="flex items-center gap-3 text-t4 text-[12px] my-4">
              <span className="flex-1 h-px bg-bdr" />
              or
              <span className="flex-1 h-px bg-bdr" />
            </div>
            <button
              onClick={handleGuest}
              disabled={loading}
              className="w-full py-[13px] px-5 rounded-md text-[14px] font-semibold text-t2 border border-bdr flex items-center justify-content-center gap-2 disabled:opacity-50 transition-all hover:border-accent hover:text-t1 hover:bg-accent-glow"
              style={{ transition: 'all 120ms cubic-bezier(.4,0,.2,1)', justifyContent: 'center' }}
            >
              {loading ? <Spinner size={16} /> : '🚀 Try as Guest — 1 free call'}
            </button>
            <p className="text-[12px] text-t4 text-center mt-2">No email needed. Jump right in.</p>
          </>
        )}

        {err && <p className="text-red text-[13px] text-center mt-3 animate-shake">{err}</p>}

        <p className="mt-5 text-center text-[13px] text-t3">
          Want community chat?{' '}
          <a href="/community" className="text-accent font-bold px-1.5 py-0.5 rounded-xs transition-all hover:bg-accent-glow">
            Community 💬
          </a>
        </p>
      </div>
    </div>
  )
}

/* ── Step: New Account ── */
function StepNew({ onOtp, err, setErr, loading, setLoading }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setErr('Enter your name')
    if (!email.trim()) return setErr('Enter your college email')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), username: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to send OTP'); setLoading(false); return }
      onOtp(email.trim(), name.trim(), false)
    } catch {
      setErr('Cannot reach server.'); setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 w-full">
      <input
        className={`w-full px-4 py-[14px] text-[15px] bg-elev border-[1.5px] rounded-md text-t1 outline-none transition-all placeholder:text-t4 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)] ${err ? 'border-red animate-shake' : 'border-bdr'}`}
        type="text" placeholder="👤 What should we call you?" value={name}
        onChange={e => { setName(e.target.value); setErr('') }}
        autoFocus maxLength={24}
      />
      <input
        className="w-full px-4 py-[14px] text-[15px] bg-elev border-[1.5px] border-bdr rounded-md text-t1 outline-none transition-all placeholder:text-t4 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)]"
        type="email" placeholder="🎓 College email (you@iitb.ac.in)" value={email}
        onChange={e => { setEmail(e.target.value); setErr('') }}
        maxLength={80}
      />
      {err && <p className="text-red text-[13px] text-center animate-shake">{err}</p>}
      <PrimaryBtn loading={loading}>📨 Send Verification Code →</PrimaryBtn>
    </form>
  )
}

/* ── Step: Returning ── */
function StepReturn({ onOtp, onSwitch, err, setErr, loading, setLoading }) {
  const [email, setEmail] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!email.trim()) return setErr('Enter your college email')
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
    <form onSubmit={submit} className="flex flex-col gap-3 w-full">
      <input
        className="w-full px-4 py-[14px] text-[15px] bg-elev border-[1.5px] border-bdr rounded-md text-t1 outline-none transition-all placeholder:text-t4 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)]"
        type="email" placeholder="🎓 Your college email" value={email}
        onChange={e => { setEmail(e.target.value); setErr('') }}
        autoFocus
      />
      {err && <p className="text-red text-[13px] text-center">{err}</p>}
      <PrimaryBtn loading={loading}>🔑 Send Login Code →</PrimaryBtn>
      <button type="button" onClick={onSwitch} className="text-[13px] text-accent py-1">
        Not registered? Sign up →
      </button>
    </form>
  )
}

/* ── Step: OTP ── */
function StepOtp({ email, name, isRet, onVerified, onBack }) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [cd, setCd] = useState(60)
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
    <form onSubmit={verify} className="flex flex-col gap-3.5 w-full items-center">
      {isRet && name && (
        <p className="text-[14px] text-t2 text-center">
          Welcome back, <strong className="text-t1">{name}</strong> 👋
        </p>
      )}
      <p className="text-[14px] text-t2 text-center leading-[1.6]">
        Code sent to <strong className="text-t1">{email}</strong>
      </p>
      <div className="flex gap-2 justify-center" onPaste={paste}>
        {otp.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            className="w-12 h-14 bg-elev border-[1.5px] rounded-md text-t1 text-[22px] font-bold text-center outline-none transition-all [caret-color:var(--accent)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)] [&:not(:placeholder-shown)]:text-accent [&:not(:placeholder-shown)]:border-accent"
            style={{ borderColor: d ? 'var(--accent)' : undefined, color: d ? 'var(--accent)' : undefined }}
            type="text" inputMode="numeric" maxLength={1} placeholder="·"
            value={d} onChange={ev => digit(i, ev.target.value)} onKeyDown={ev => keydown(i, ev)}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {err && <p className="text-red text-[13px] text-center animate-shake">{err}</p>}
      <PrimaryBtn loading={loading}>
        {isRet ? '✅ Verify & Log In →' : '🚀 Verify & Start Talking →'}
      </PrimaryBtn>
      <div className="flex justify-between items-center w-full">
        <button type="button" onClick={onBack} className="text-[13px] text-t3 px-1.5 py-1 rounded-xs hover:text-t2 transition-colors">
          ← Change email
        </button>
        <button
          type="button"
          disabled={cd > 0}
          onClick={resend}
          className="text-[13px] text-accent px-1.5 py-1 rounded-xs disabled:opacity-40 hover:text-accent-h transition-colors"
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
      className="w-full py-[15px] px-6 bg-accent text-white rounded-md text-[15px] font-bold flex items-center justify-center gap-2 relative overflow-hidden transition-all hover:translate-y-[-2px] hover:shadow-[0_8px_28px_var(--accent-glow)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
      style={{ transition: 'all 220ms cubic-bezier(.4,0,.2,1)' }}
    >
      <span className="absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,oklch(100%_0_0/0.12),transparent_60%)]" />
      {loading ? (
        <span
          style={{
            width: 16, height: 16,
            border: '2.5px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spinAnim .75s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : children}
    </button>
  )
}
