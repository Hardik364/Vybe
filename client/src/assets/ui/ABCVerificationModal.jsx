// ABCVerificationModal — collect and submit the user's ABC (Academic Bank of Credits) ID
// The ABC ID is India's academic identity for enrolled college students (NATS system).
// It verifies: age 18+, active enrollment, college name simultaneously.
//
// Usage: Mount from SingUp.jsx or ProfilePage after successful OTP login.

import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_APP_WEBSOCKET_URL

export default function ABCVerificationModal({ token, onVerified, onSkip }) {
    const [digits,   setDigits]   = useState(Array(12).fill(''))
    const [status,   setStatus]   = useState('idle')   // 'idle'|'loading'|'pending'|'verified'|'error'
    const [errMsg,   setErrMsg]   = useState('')
    const inputs = useRef([])

    // Check if already verified/pending on mount
    useEffect(() => {
        if (!token) return
        fetch(`${API}/auth/abc-status`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then(d => {
                if (d.status === 'verified') { setStatus('verified'); onVerified?.() }
                if (d.status === 'pending')  { setStatus('pending') }
            })
            .catch(() => {})
    }, [token])

    function handleDigit(i, val) {
        if (!/^\d?$/.test(val)) return
        const next = [...digits]
        next[i] = val
        setDigits(next)
        if (val && i < 11) inputs.current[i + 1]?.focus()
    }

    function handleKeyDown(i, e) {
        if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
        if (e.key === 'ArrowLeft'  && i > 0)  inputs.current[i - 1]?.focus()
        if (e.key === 'ArrowRight' && i < 11) inputs.current[i + 1]?.focus()
    }

    function handlePaste(e) {
        const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 12)
        if (text.length === 12) {
            setDigits(text.split(''))
            inputs.current[11]?.focus()
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const id = digits.join('')
        if (id.length < 12) return setErrMsg('Enter all 12 digits')
        setErrMsg('')
        setStatus('loading')

        try {
            const res  = await fetch(`${API}/auth/verify-abc`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body:    JSON.stringify({ abcId: id }),
            })
            const data = await res.json()
            if (!res.ok) { setErrMsg(data.error || 'Verification failed'); setStatus('idle'); return }
            setStatus(data.status)  // 'pending' or 'verified'
            if (data.status === 'verified') onVerified?.()
        } catch {
            setErrMsg('Cannot reach server. Try again.')
            setStatus('idle')
        }
    }

    // ── Already verified ────────────────────────────────────
    if (status === 'verified') return (
        <div className="abc-modal-overlay">
            <div className="abc-modal">
                <div className="abc-status-icon">✅</div>
                <h3 className="abc-modal-title">Identity Verified!</h3>
                <p className="abc-modal-body">Your ABC ID has been verified. You're all set.</p>
                <button className="abc-primary-btn" onClick={onVerified}>Continue →</button>
            </div>
        </div>
    )

    // ── Pending ──────────────────────────────────────────────
    if (status === 'pending') return (
        <div className="abc-modal-overlay">
            <div className="abc-modal">
                <div className="abc-status-icon">⏳</div>
                <h3 className="abc-modal-title">Verification Pending</h3>
                <p className="abc-modal-body">
                    Your ABC ID is under review. You'll receive a notification once approved (within 24h).
                    You can continue using UniBuddy while we verify.
                </p>
                <button className="abc-primary-btn" onClick={onSkip}>Continue for now →</button>
            </div>
        </div>
    )

    // ── Input form ───────────────────────────────────────────
    return (
        <div className="abc-modal-overlay">
            <div className="abc-modal">
                <div className="abc-modal-header">
                    <h3 className="abc-modal-title">Verify Your Age & Enrollment</h3>
                    <p className="abc-modal-subtitle">
                        UniBuddy is for college students aged 18+. Your ABC ID confirms both.
                    </p>
                </div>

                {/* What is ABC ID */}
                <div className="abc-info-box">
                    <strong>📚 What is an ABC ID?</strong>
                    <p>Academic Bank of Credits — India's student identity issued by your college. Find it on your college portal, DigiLocker, or the ABC portal at abc.gov.in</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <p className="abc-label">Enter your 12-digit ABC ID</p>

                    <div className="abc-digit-grid" onPaste={handlePaste}>
                        {digits.map((d, i) => (
                            <input
                                key={i}
                                ref={el => inputs.current[i] = el}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                className="abc-digit"
                                value={d}
                                onChange={e => handleDigit(i, e.target.value)}
                                onKeyDown={e => handleKeyDown(i, e)}
                                autoFocus={i === 0}
                            />
                        ))}
                    </div>

                    {/* Group digits visually as XXXX-XXXX-XXXX */}
                    <p className="abc-format-hint">Format: {
                        [digits.slice(0,4).join('') || 'XXXX',
                         digits.slice(4,8).join('') || 'XXXX',
                         digits.slice(8,12).join('') || 'XXXX'].join(' - ')
                    }</p>

                    {errMsg && <p className="abc-error">{errMsg}</p>}

                    <button
                        type="submit"
                        className="abc-primary-btn"
                        disabled={status === 'loading' || digits.join('').length < 12}
                    >
                        {status === 'loading' ? 'Verifying…' : 'Verify ABC ID →'}
                    </button>
                </form>

                <button className="abc-skip-btn" onClick={onSkip}>
                    Skip for now (verify later)
                </button>

                <p className="abc-privacy-note">
                    🔒 Only used for age verification. We store a one-way hash — never your raw ID.
                </p>
            </div>
        </div>
    )
}
