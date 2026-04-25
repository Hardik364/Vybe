import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const API = import.meta.env.VITE_APP_WEBSOCKET_URL   // http://localhost:3000

// ── Step 1: email + username form ────────────────────────────
function StepEmail({ onOtpSent }) {
    const [username, setUsername] = useState('')
    const [email,    setEmail]    = useState('')
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        const u = username.trim()
        const m = email.trim().toLowerCase()
        if (!u)  return setError('Enter your name')
        if (!m)  return setError('Enter your college email')

        setLoading(true)
        try {
            const res  = await fetch(`${API}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: m, username: u })
            })
            const data = await res.json()
            if (!res.ok) return setError(data.error || 'Something went wrong')
            onOtpSent(m, u)
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

            <button
                type="submit"
                className="singupInputBox"
                id="signupSubmitBtn"
                disabled={loading}
            >
                {loading ? 'Sending OTP...' : 'Send Verification Code →'}
            </button>

            <p id="signup-disclaimer">
                {import.meta.env.VITE_APP_ENV === 'production'
                    ? 'College email required — keeps RealTalk student-only'
                    : '🛠 Dev mode: any email works for testing'}
            </p>
        </form>
    )
}

// ── Step 2: OTP input ─────────────────────────────────────────
function StepOtp({ email, username, onVerified, onBack }) {
    const [otp,      setOtp]      = useState(['', '', '', '', '', ''])
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)
    const [resending, setResending] = useState(false)
    const [resendCd, setResendCd] = useState(30)
    const inputs = useRef([])

    // Countdown for resend
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
        if (e.key === 'Backspace' && !otp[i] && i > 0) {
            inputs.current[i - 1]?.focus()
        }
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: code })
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, username })
            })
            setResendCd(30)
            setError('')
        } finally {
            setResending(false)
        }
    }

    return (
        <form onSubmit={handleVerify} id="signup-form">
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
                {loading ? 'Verifying...' : 'Verify & Start Talking →'}
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
    const [step,        setStep]        = useState('email')   // 'email' | 'otp'
    const [pendingEmail, setPendingEmail] = useState('')
    const [pendingName,  setPendingName]  = useState('')

    // Auto-login if valid JWT already stored
    useEffect(() => {
        const token = localStorage.getItem('rt_token')
        if (!token) return
        fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(data => {
                if (data.valid) {
                    setUsername(data.username)
                    navigate('/chat')
                } else {
                    localStorage.removeItem('rt_token')
                }
            })
            .catch(() => {})
    }, [])

    function handleOtpSent(email, username) {
        setPendingEmail(email)
        setPendingName(username)
        setStep('otp')
    }

    function handleVerified(token, username) {
        localStorage.setItem('rt_token', token)
        localStorage.removeItem('rt_guest')  // clear guest flag if they sign up
        setUsername(username)
        navigate('/chat')
    }

    // ── Guest mode ────────────────────────────────────────────
    function handleGuest() {
        const adjs  = ['Cool', 'Curious', 'Chill', 'Bold', 'Witty', 'Bright', 'Swift', 'Calm']
        const nouns = ['Panda', 'Llama', 'Falcon', 'Otter', 'Gecko', 'Koala', 'Lynx', 'Moose']
        const rand  = n => Math.floor(Math.random() * n)
        const name  = `${adjs[rand(adjs.length)]}${nouns[rand(nouns.length)]}${rand(90) + 10}`
        localStorage.setItem('rt_guest', '1')
        setUsername(name)
        navigate('/chat')
    }

    return (
        <div id="signupPage">
            <div id="signup-glow"></div>

            <div id="signup-card">
                <div id="signup-logo">
                    <span id="signup-logo-spark">✦</span>
                    RealTalk
                </div>

                <p id="signup-tagline">
                    One stranger. Real talk. Your college.
                </p>

                {step === 'email' ? (
                    <StepEmail onOtpSent={handleOtpSent} />
                ) : (
                    <StepOtp
                        email={pendingEmail}
                        username={pendingName}
                        onVerified={handleVerified}
                        onBack={() => setStep('email')}
                    />
                )}

                {/* Guest CTA — only shown on the email step */}
                {step === 'email' && (
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
