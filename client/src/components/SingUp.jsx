import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = import.meta.env.VITE_APP_WEBSOCKET_URL

// ── Step 1a: NEW USER — name + email ─────────────────────────
function StepNewUser({ onOtpSent }) {
    const [username,    setUsername]    = useState('')
    const [email,       setEmail]       = useState('')
    const [error,       setError]       = useState('')
    const [loading,     setLoading]     = useState(false)
    const [alreadyExists, setAlreadyExists] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setAlreadyExists(false)
        const u = username.trim()
        const m = email.trim().toLowerCase()
        if (!u) return setError('Enter your name')
        if (!m) return setError('Enter your college email')

        setLoading(true)
        try {
            const res  = await fetch(`${API}/auth/send-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: m, username: u }),
            })
            const data = await res.json()
            if (!res.ok) return setError(data.error || 'Something went wrong')

            // Email already has an account — switch to returning flow
            if (data.isReturning) {
                setAlreadyExists(true)
                // Auto-proceed to OTP as returning user after showing message briefly
                setTimeout(() => onOtpSent(m, data.username, true), 1800)
                return
            }

            onOtpSent(m, u, false)
        } catch {
            setError('Cannot reach server. Is it running?')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} id="signup-form">
            <div id="signup-input-wrapper">
                <span id="signup-input-icon">👤</span>
                <input
                    type="text"
                    className="singupInputBox"
                    placeholder="What should we call you?"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus
                    maxLength={24}
                />
            </div>

            <div id="signup-input-wrapper">
                <span id="signup-input-icon">🎓</span>
                <input
                    type="email"
                    className="singupInputBox"
                    placeholder="College email (e.g. you@iitb.ac.in)"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
            </div>

            {error && <p className="signup-error">{error}</p>}
            {alreadyExists && (
                <p className="signup-info">
                    ✅ Account found! Logging you in as your existing account…
                </p>
            )}

            <button
                type="submit"
                className="singupInputBox"
                id="signupSubmitBtn"
                disabled={loading || alreadyExists}
            >
                {loading ? 'Checking...' : alreadyExists ? 'Redirecting…' : 'Send Verification Code →'}
            </button>

            <p id="signup-disclaimer">
                {import.meta.env.VITE_APP_ENV === 'production'
                    ? 'College email required — keeps UniBuddy student-only'
                    : '🛠 Dev mode: any email works for testing'}
            </p>
        </form>
    )
}

// ── Step 1b: RETURNING USER — email only ──────────────────────
function StepReturningUser({ onOtpSent, onSwitchToNew }) {
    const [email,   setEmail]   = useState('')
    const [error,   setError]   = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        const m = email.trim().toLowerCase()
        if (!m) return setError('Enter your college email')

        setLoading(true)
        try {
            const res  = await fetch(`${API}/auth/send-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email: m }),
            })
            const data = await res.json()
            if (!res.ok) {
                // If the server says this email has no account, switch to new-user flow
                if (res.status === 400 && data.error?.includes('Username is required')) {
                    setError('No account found for this email. Sign up instead.')
                } else {
                    setError(data.error || 'Something went wrong')
                }
                return
            }

            if (!data.isReturning) {
                // Email exists but no username saved — treat as new user
                setError('No account found. Please sign up with your name first.')
                return
            }

            onOtpSent(m, data.username, true)
        } catch {
            setError('Cannot reach server. Is it running?')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} id="signup-form">
            <div id="signup-input-wrapper">
                <span id="signup-input-icon">🎓</span>
                <input
                    type="email"
                    className="singupInputBox"
                    placeholder="Your college email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                />
            </div>

            {error && <p className="signup-error">{error}</p>}

            <button
                type="submit"
                className="singupInputBox"
                id="signupSubmitBtn"
                disabled={loading}
            >
                {loading ? 'Sending OTP...' : 'Send Login Code →'}
            </button>

            <button
                type="button"
                id="switch-mode-btn"
                onClick={onSwitchToNew}
            >
                Not registered? Sign up here →
            </button>
        </form>
    )
}

// ── Step 2: OTP input ─────────────────────────────────────────
function StepOtp({ email, username, isReturning, onVerified, onBack }) {
    const [otp,       setOtp]      = useState(['', '', '', '', '', ''])
    const [error,     setError]    = useState('')
    const [loading,   setLoading]  = useState(false)
    const [resending, setResending] = useState(false)
    const [resendCd,  setResendCd] = useState(60)
    const inputs = useRef([])

    useEffect(() => {
        if (resendCd <= 0) return
        const t = setTimeout(() => setResendCd(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [resendCd])

    function handleDigit(i, val) {
        if (!/^\d?$/.test(val)) return
        const next = [...otp]
        next[i] = val
        setOtp(next)
        if (val && i < 5) inputs.current[i + 1]?.focus()
    }

    function handleKeyDown(i, e) {
        if (e.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus()
        if (e.key === 'ArrowLeft'  && i > 0) inputs.current[i - 1]?.focus()
        if (e.key === 'ArrowRight' && i < 5) inputs.current[i + 1]?.focus()
    }

    function handlePaste(e) {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (text.length === 6) {
            setOtp(text.split(''))
            inputs.current[5]?.focus()
        }
    }

    async function handleVerify(e) {
        e.preventDefault()
        const code = otp.join('')
        if (code.length < 6) return setError('Enter the full 6-digit code')
        setError('')
        setLoading(true)
        try {
            const res  = await fetch(`${API}/auth/verify-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, otp: code }),
            })
            const data = await res.json()
            if (!res.ok) return setError(data.error || 'Wrong OTP')
            onVerified(data.token, data.username)
        } catch {
            setError('Cannot reach server.')
        } finally {
            setLoading(false)
        }
    }

    async function handleResend() {
        setResending(true)
        try {
            await fetch(`${API}/auth/send-otp`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, username }),
            })
            setResendCd(60)
            setError('')
        } finally {
            setResending(false)
        }
    }

    return (
        <form onSubmit={handleVerify} id="signup-form">
            {isReturning && username && (
                <p id="returning-welcome">👋 Welcome back, <strong>{username}</strong>!</p>
            )}
            <p id="otp-sent-msg">
                Code sent to <strong>{email}</strong>
            </p>

            <div id="otp-inputs" onPaste={handlePaste}>
                {otp.map((d, i) => (
                    <input
                        key={i}
                        ref={el => inputs.current[i] = el}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className="otp-digit"
                        value={d}
                        onChange={e => handleDigit(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        autoFocus={i === 0}
                    />
                ))}
            </div>

            {error && <p className="signup-error">{error}</p>}

            <button
                type="submit"
                className="singupInputBox"
                id="signupSubmitBtn"
                disabled={loading}
            >
                {loading
                    ? 'Verifying...'
                    : isReturning
                        ? 'Verify & Log In →'
                        : 'Verify & Start Talking →'}
            </button>

            <div id="otp-footer">
                <button type="button" id="otp-back-btn" onClick={onBack}>
                    ← Change email
                </button>
                <button
                    type="button"
                    id="otp-resend-btn"
                    onClick={handleResend}
                    disabled={resendCd > 0 || resending}
                >
                    {resendCd > 0 ? `Resend in ${resendCd}s` : resending ? 'Sending...' : 'Resend code'}
                </button>
            </div>
        </form>
    )
}

// ── Main SignUp component ─────────────────────────────────────
export default function SingUp({ setUsername }) {
    const navigate = useNavigate()

    // 'new' | 'returning' | 'otp'
    const [step,          setStep]         = useState(() => {
        // If they've logged in before, default to returning-user (login) flow
        return localStorage.getItem('ub_has_account') === '1' ? 'returning' : 'new'
    })
    const [pendingEmail,  setPendingEmail]  = useState('')
    const [pendingName,   setPendingName]   = useState('')
    const [isReturning,   setIsReturning]   = useState(false)

    const guestLimitHit = localStorage.getItem('ub_guest_limit') === '1'
    useEffect(() => {
        if (guestLimitHit) localStorage.removeItem('ub_guest_limit')
    }, [])

    // Auto-login if valid JWT already stored
    useEffect(() => {
        const token = localStorage.getItem('ub_token')
        if (!token) return
        fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                if (data.valid) {
                    setUsername(data.username)
                    navigate('/chat')
                } else {
                    localStorage.removeItem('ub_token')
                }
            })
            .catch(() => {})
    }, [])

    function handleOtpSent(email, username, returning) {
        setPendingEmail(email)
        setPendingName(username)
        setIsReturning(returning)
        setStep('otp')
    }

    function handleVerified(token, username) {
        localStorage.removeItem('ub_guest')
        localStorage.setItem('ub_token', token)
        localStorage.setItem('ub_has_account', '1')  // next visit defaults to login
        setUsername(username)
        navigate('/chat')
    }

    // ── Guest mode ────────────────────────────────────────────
    function getOrCreateDeviceId() {
        let id = localStorage.getItem('ub_device_id')
        if (!id) {
            const arr = new Uint8Array(16)
            crypto.getRandomValues(arr)
            id = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
            localStorage.setItem('ub_device_id', id)
        }
        return id
    }

    function handleGuest() {
        const adjs  = ['Cool', 'Curious', 'Chill', 'Bold', 'Witty', 'Bright', 'Swift', 'Calm']
        const nouns = ['Panda', 'Llama', 'Falcon', 'Otter', 'Gecko', 'Koala', 'Lynx', 'Moose']
        const rand  = n => Math.floor(Math.random() * n)
        const name  = `${adjs[rand(adjs.length)]}${nouns[rand(nouns.length)]}${rand(90) + 10}`
        localStorage.setItem('ub_guest', '1')
        localStorage.setItem('ub_guest_device', getOrCreateDeviceId())
        setUsername(name)
        navigate('/chat')
    }

    const showGuestCta = step !== 'otp'

    return (
        <div id="signupPage">
            <div id="signup-glow"></div>

            <div id="signup-card">
                <div id="signup-logo">
                    <span id="signup-logo-spark">✦</span>
                    UniBuddy
                </div>

                <p id="signup-tagline">
                    One stranger. Real talk. Your college.
                </p>

                {guestLimitHit && (
                    <div id="guest-limit-banner">
                        🎉 You had a great call! Sign up free to keep going.
                    </div>
                )}

                {/* ── Mode toggle tabs (new / returning) ───── */}
                {step !== 'otp' && (
                    <div id="auth-mode-tabs">
                        <button
                            className={`auth-tab${step === 'new' ? ' active' : ''}`}
                            onClick={() => setStep('new')}
                        >
                            Sign Up
                        </button>
                        <button
                            className={`auth-tab${step === 'returning' ? ' active' : ''}`}
                            onClick={() => setStep('returning')}
                        >
                            Log In
                        </button>
                    </div>
                )}

                {step === 'new' && (
                    <StepNewUser onOtpSent={handleOtpSent} />
                )}
                {step === 'returning' && (
                    <StepReturningUser
                        onOtpSent={handleOtpSent}
                        onSwitchToNew={() => setStep('new')}
                    />
                )}
                {step === 'otp' && (
                    <StepOtp
                        email={pendingEmail}
                        username={pendingName}
                        isReturning={isReturning}
                        onVerified={handleVerified}
                        onBack={() => setStep(isReturning ? 'returning' : 'new')}
                    />
                )}

                {showGuestCta && (
                    <div id="signup-guest-cta">
                        <div id="signup-divider"><span>or</span></div>
                        <button id="guestBtn" onClick={handleGuest}>
                            👀 Try as Guest — 1 free call, no signup
                        </button>
                        <p id="guest-cta-note">No email needed · Just jump right in</p>
                    </div>
                )}
            </div>
        </div>
    )
}
