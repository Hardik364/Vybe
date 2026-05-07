'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'

const API = process.env.NEXT_PUBLIC_APP_WEBSOCKET_URL

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
  const [step, setStep] = useState('new')        // 'new' | 'returning' | 'otp'
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingName, setPendingName] = useState('')
  const [isRet, setIsRet] = useState(false)
  const [err, setErr] = useState('')
  const [guestErr, setGuestErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestDone, setGuestDone] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('ub_guest_limit')) setGuestDone(true)
  }, [])

  useEffect(() => {
    // If guest used their free call, keep them on signup — don't auto-redirect
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

  function otpSent(email, name, ret) {
    setPendingEmail(email); setPendingName(name); setIsRet(ret); setStep('otp'); setErr(''); setGuestErr('')
  }

  async function handleVerified(token, username) {
    localStorage.setItem('ub_token', token)
    localStorage.setItem('ub_username', username)
    localStorage.removeItem('ub_guest')
    localStorage.removeItem('ub_guest_limit')   // real account — clear guest flag
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
          UniBuddy matches you with students from your college and beyond for real voice conversations that actually go somewhere.
        </p>

        {/* Stats pills */}
        <div className="hero-stats">
          {[
            { dot: true, text: '1,200+ students online' },
            { text: '🎓 College-verified only' },
            { text: '🔒 Safe & anonymous' },
          ].map((s, i) => (
            <div
              key={i}
              className="hero-stat"
              style={{ animationDelay: `${i * 0.8}s` }}
            >
              {s.dot && <span className="online-dot" />}
              {s.text}
            </div>
          ))}
        </div>

        {/* Floating college cards */}
        <div className="hero-cards">
          {CARDS.map((c, i) => (
            <div key={i} className="hero-card">
              <div
                style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: c.color, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 900, fontSize: 10,
                  letterSpacing: '-0.5px', flexShrink: 0,
                }}
              >
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

        {/* Logo */}
        <div className="form-logo">
          <div className="form-logo-mark">U</div>
          UniBuddy
        </div>

        {guestDone && step !== 'otp' && (
          <div style={{
            background: 'var(--accent-glow)', border: '1.5px solid var(--accent)',
            borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 4,
            fontSize: 13, color: 'var(--t1)', lineHeight: 1.5,
          }}>
            🎉 <strong>Your free call is done!</strong> Create a free account to keep going — no limits, no cost.
          </div>
        )}

        <h2 className="form-heading">
          {step === 'otp' ? '📬 Check your inbox' : step === 'new' ? '👋 Create account' : '👋 Welcome back'}
        </h2>
        <p className="form-sub">
          {step === 'otp'
            ? `We sent a 6-digit code to ${pendingEmail}`
            : step === 'new'
            ? 'College email required — keeps it student-only'
            : 'Log in with your college email'}
        </p>

        {/* Auth Tabs */}
        {step !== 'otp' && (
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

        {step === 'new'       && <StepNew       onOtp={otpSent} err={err} setErr={setErr} loading={loading} setLoading={setLoading} />}
        {step === 'returning' && <StepReturn     onOtp={otpSent} onSwitch={() => setStep('new')} err={err} setErr={setErr} loading={loading} setLoading={setLoading} />}
        {step === 'otp'       && <StepOtp        email={pendingEmail} name={pendingName} isRet={isRet} onVerified={handleVerified} onBack={() => setStep(isRet ? 'returning' : 'new')} />}

        {step !== 'otp' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--t4)', fontSize: 12, margin: '16px 0' }}>
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
          <a
            href="/community"
            style={{ color: 'var(--accent)', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-xs)', transition: 'all var(--t-fast)' }}
          >
            Community 💬
          </a>
        </p>
      </div>
    </div>
  )
}

// Country list (shown in first dropdown)
const COUNTRIES = [
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'US', label: '🇺🇸 United States' },
  { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'CA', label: '🇨🇦 Canada' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'SG', label: '🇸🇬 Singapore' },
  { code: 'NZ', label: '🇳🇿 New Zealand' },
  { code: 'IE', label: '🇮🇪 Ireland' },
  { code: 'NL', label: '🇳🇱 Netherlands' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'JP', label: '🇯🇵 Japan' },
  { code: 'AE', label: '🇦🇪 UAE' },
  { code: 'SE', label: '🇸🇪 Sweden' },
  { code: 'CH', label: '🇨🇭 Switzerland' },
  { code: 'IT', label: '🇮🇹 Italy' },
  { code: 'MY', label: '🇲🇾 Malaysia' },
  { code: 'KR', label: '🇰🇷 South Korea' },
  { code: 'CN', label: '🇨🇳 China' },
  { code: 'RU', label: '🇷🇺 Russia' },
  { code: 'OT', label: '🌐 Other Country' },
]

// State / province / region per country
// Empty array = city-state or no meaningful subdivision → skip 2nd dropdown
const REGIONS = {
  IN: [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
    'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Delhi','Chandigarh','Puducherry','Jammu & Kashmir','Ladakh',
    'Andaman & Nicobar Islands','Dadra & Nagar Haveli','Daman & Diu','Lakshadweep',
  ],
  US: [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado',
    'Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho',
    'Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
    'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
    'New Mexico','New York','North Carolina','North Dakota','Ohio',
    'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
    'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia',
    'Washington','West Virginia','Wisconsin','Wyoming','Washington D.C.',
  ],
  GB: ['England','Scotland','Wales','Northern Ireland'],
  CA: [
    'Alberta','British Columbia','Manitoba','New Brunswick',
    'Newfoundland and Labrador','Nova Scotia','Ontario',
    'Prince Edward Island','Quebec','Saskatchewan',
    'Northwest Territories','Nunavut','Yukon',
  ],
  AU: [
    'New South Wales','Victoria','Queensland','Western Australia',
    'South Australia','Tasmania','Australian Capital Territory','Northern Territory',
  ],
  DE: [
    'Baden-Württemberg','Bavaria','Berlin','Brandenburg','Bremen',
    'Hamburg','Hesse','Lower Saxony','Mecklenburg-Vorpommern',
    'North Rhine-Westphalia','Rhineland-Palatinate','Saarland',
    'Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia',
  ],
  SG: [],   // city-state
  NZ: ['Auckland','Wellington','Canterbury','Waikato','Otago','Other'],
  IE: ['Leinster','Munster','Connacht','Ulster'],
  NL: [
    'North Holland','South Holland','Utrecht','North Brabant',
    'Gelderland','Overijssel','Friesland','Groningen',
    'Limburg','Zeeland','Drenthe','Flevoland',
  ],
  FR: [
    'Île-de-France','Auvergne-Rhône-Alpes','Hauts-de-France','Grand Est',
    'Occitanie','Nouvelle-Aquitaine','Provence-Alpes-Côte d\'Azur',
    'Pays de la Loire','Bretagne','Normandie','Other',
  ],
  JP: ['Tokyo','Osaka','Kyoto','Hokkaido','Kanagawa','Aichi','Fukuoka','Other'],
  AE: ['Abu Dhabi','Dubai','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'],
  SE: ['Stockholm','Västra Götaland','Skåne','Uppsala','Other'],
  CH: ['Zurich','Geneva','Basel','Bern','Vaud','Other'],
  IT: ['Lombardy','Lazio','Tuscany','Campania','Veneto','Emilia-Romagna','Other'],
  MY: ['Selangor','Kuala Lumpur','Johor','Penang','Sabah','Sarawak','Other'],
  KR: ['Seoul','Busan','Daegu','Incheon','Daejeon','Gwangju','Other'],
  CN: ['Beijing','Shanghai','Guangdong','Zhejiang','Jiangsu','Shandong','Other'],
  RU: ['Moscow','Saint Petersburg','Novosibirsk','Other'],
  OT: [],
}

/* ── Step: New Account ── */
function StepNew({ onOtp, err, setErr, loading, setLoading }) {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [country, setCountry] = useState('')   // COUNTRIES[].code
  const [region,  setRegion]  = useState('')   // REGIONS[code][] value

  const regions   = country ? (REGIONS[country] || []) : []
  const needState = regions.length > 0

  function handleCountry(e) {
    setCountry(e.target.value)
    setRegion('')   // reset region when country changes
    setErr('')
  }

  // Build the location string sent to the backend:
  //   India → just the state name      (e.g. "Maharashtra")
  //   Others → "Country > Region"      (e.g. "Australia > Victoria")
  //   City-states / Other → country label without flag emoji
  function locationValue() {
    const label = COUNTRIES.find(c => c.code === country)?.label.replace(/^.{3}/, '').trim() || ''
    if (!needState) return label           // Singapore, Other Country, etc.
    return country === 'IN' ? region : `${label} > ${region}`
  }

  async function submit(e) {
    e.preventDefault()
    if (!name.trim())             return setErr('Enter your name')
    if (!email.trim())            return setErr('Enter your college email')
    if (!country)                 return setErr('Select your country')
    if (needState && !region)     return setErr('Select your state / province')
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), username: name.trim(), state: locationValue() }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to send OTP'); setLoading(false); return }
      onOtp(email.trim(), name.trim(), false)
    } catch {
      setErr('Cannot reach server.'); setLoading(false)
    }
  }

  const selectStyle = val => ({ color: val ? 'var(--t1)' : 'var(--t4)', cursor: 'pointer' })

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <input
        className={`ub-input no-ico${err ? ' err' : ''}`}
        type="text" placeholder="👤 What should we call you?" value={name}
        onChange={e => { setName(e.target.value); setErr('') }}
        autoFocus maxLength={24}
        style={err ? { animation: 'shake 300ms ease' } : {}}
      />
      <input
        className="ub-input no-ico"
        type="email" placeholder="🎓 College email (you@iitb.ac.in)" value={email}
        onChange={e => { setEmail(e.target.value); setErr('') }}
        maxLength={80}
      />

      {/* ── Country picker ── */}
      <select className="ub-input no-ico" value={country} onChange={handleCountry} style={selectStyle(country)}>
        <option value="" disabled>🌍 Select your country</option>
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>

      {/* ── State / province picker — only shown once a country is chosen ── */}
      {country && needState && (
        <select
          className="ub-input no-ico"
          value={region}
          onChange={e => { setRegion(e.target.value); setErr('') }}
          style={selectStyle(region)}
        >
          <option value="" disabled>📍 Select state / province</option>
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}

      {err && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', animation: 'shake 300ms ease' }}>{err}</p>}
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
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <input
        className="ub-input no-ico"
        type="email" placeholder="🎓 Your college email" value={email}
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
