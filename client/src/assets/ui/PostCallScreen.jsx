import { useState, useEffect, useRef } from 'react'

const CONNECT_WINDOW       = 30
const CONTACT_TIMEOUT_MS   = 60000  // 60s — auto-close if partner never submits contact

export default function PostCallScreen({ strangerUsername, strangerUserId, socket, onConnect, onMoveOn }) {
    const [timeLeft,        setTimeLeft]        = useState(CONNECT_WINDOW)
    const [connectPressed,  setConnectPressed]  = useState(false)
    const [waitingForThem,  setWaitingForThem]  = useState(false) // server confirmed our request pending
    const [bothConnected,   setBothConnected]   = useState(false)
    // Contact exchange state
    const [contact,         setContact]         = useState('')
    const [contactType,     setContactType]     = useState('whatsapp')  // 'whatsapp' | 'instagram'
    const [submitted,       setSubmitted]       = useState(false)
    const [revealedContact, setRevealedContact] = useState(null)
    const contactTimeoutRef = useRef(null)

    // ── Server-driven events ─────────────────────────────────
    useEffect(() => {
        if (!socket) return

        // Both pressed Connect — move to contact exchange screen
        socket.on('contactsExchanged', () => setBothConnected(true))

        // Server confirmed our connect request is pending (partner hasn't pressed yet)
        socket.on('connectPending', () => setWaitingForThem(true))

        socket.on('connectExpired', () => onMoveOn())

        socket.on('partnerMovedOn', () => onMoveOn())

        socket.on('contactSubmitted', () => setSubmitted(true))

        socket.on('contactRevealed', ({ contact: theirContact }) => {
            clearTimeout(contactTimeoutRef.current)
            setRevealedContact(theirContact)
        })

        return () => {
            socket.off('contactsExchanged')
            socket.off('connectPending')
            socket.off('connectExpired')
            socket.off('partnerMovedOn')
            socket.off('contactSubmitted')
            socket.off('contactRevealed')
            clearTimeout(contactTimeoutRef.current)
        }
    }, [socket])

    // 60s safety timeout on contact exchange — don't leave user stuck forever
    useEffect(() => {
        if (!submitted) return
        contactTimeoutRef.current = setTimeout(() => onMoveOn(), CONTACT_TIMEOUT_MS)
        return () => clearTimeout(contactTimeoutRef.current)
    }, [submitted])

    // ── Local countdown ───────────────────────────────────────
    // Keep counting even after pressing Connect — server expires at 31s anyway
    useEffect(() => {
        if (bothConnected) return
        if (timeLeft <= 0) { handleMoveOn(); return }
        const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
        return () => clearTimeout(timer)
    }, [timeLeft, bothConnected])

    function handleConnect() {
        setConnectPressed(true)
        if (socket && strangerUserId) {
            socket.emit('connectRequest', { to: strangerUserId })
        }
        onConnect()
    }

    function handleMoveOn() {
        if (socket && strangerUserId) {
            socket.emit('moveOn', { to: strangerUserId })
        }
        onMoveOn()
    }

    function handleSubmitContact(e) {
        e.preventDefault()
        const val = contact.trim()
        if (!val) return
        const prefix = contactType === 'whatsapp' ? `wa:${val}` : `ig:${val}`
        socket.emit('submitContact', { to: strangerUserId, contact: prefix })
        setSubmitted(true)
    }

    // ── Contact exchange screen (after mutual Connect) ────────
    if (bothConnected) {
        // Both revealed
        if (revealedContact) {
            const isWA = revealedContact.startsWith('wa:')
            const handle = revealedContact.replace(/^(wa:|ig:)/, '')
            const link   = isWA
                ? `https://wa.me/${handle.replace(/\D/g, '')}`
                : `https://instagram.com/${handle}`

            return (
                <div id="postCallScreen">
                    <div id="postCall-container">
                        <div id="postCall-success">
                            <span id="postCall-success-emoji">🎉</span>
                            <h2 id="postCall-success-title">Contact Exchanged!</h2>
                            <p id="postCall-success-subtitle">
                                {strangerUsername || 'Your match'} shared their {isWA ? 'WhatsApp' : 'Instagram'}
                            </p>
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="contact-reveal-link"
                            >
                                {isWA ? '📱' : '📸'} {handle}
                            </a>
                            <button className="contact-btn-done" onClick={onMoveOn}>
                                Done →
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        // Waiting for partner to submit / share your own
        return (
            <div id="postCallScreen">
                <div id="postCall-container">
                    <div id="postCall-success">
                        <span id="postCall-success-emoji">🤝</span>
                        <h2 id="postCall-success-title">You're both connected!</h2>
                        <p id="postCall-success-subtitle">
                            {submitted
                                ? `Waiting for ${strangerUsername || 'them'} to share their contact…`
                                : `Share how you'd like to stay in touch`}
                        </p>

                        {!submitted ? (
                            <form id="contact-form" onSubmit={handleSubmitContact}>
                                <div id="contact-type-tabs">
                                    <button
                                        type="button"
                                        className={`contact-tab${contactType === 'whatsapp' ? ' active' : ''}`}
                                        onClick={() => setContactType('whatsapp')}
                                    >
                                        📱 WhatsApp
                                    </button>
                                    <button
                                        type="button"
                                        className={`contact-tab${contactType === 'instagram' ? ' active' : ''}`}
                                        onClick={() => setContactType('instagram')}
                                    >
                                        📸 Instagram
                                    </button>
                                </div>
                                <div id="contact-input-row">
                                    <span id="contact-prefix">
                                        {contactType === 'whatsapp' ? '+91' : '@'}
                                    </span>
                                    <input
                                        id="contact-input"
                                        value={contact}
                                        onChange={e => setContact(e.target.value)}
                                        placeholder={contactType === 'whatsapp' ? '9876543210' : 'username'}
                                        maxLength={50}
                                        autoFocus
                                    />
                                </div>
                                <button type="submit" id="contact-submit-btn" disabled={!contact.trim()}>
                                    Share & Reveal Theirs →
                                </button>
                                <p id="contact-privacy-note">
                                    🔒 Only revealed if they share too
                                </p>
                            </form>
                        ) : (
                            <div id="contact-waiting">
                                <div id="contact-waiting-spinner" />
                                <p>Waiting for {strangerUsername || 'them'} to share…</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ── Default post-call screen ──────────────────────────────
    return (
        <div id="postCallScreen">
            <div id="postCall-container">
                <p id="postCall-subtitle">The call has ended</p>
                <h2 id="postCall-title">
                    ✨ You just talked to {strangerUsername || 'a stranger'}
                </h2>

                <div id="postCall-buttons">
                    <button
                        id="connectBtn"
                        onClick={handleConnect}
                        disabled={connectPressed}
                        className={connectPressed ? 'pressed' : ''}
                    >
                        <span id="connect-btn-label">
                            {waitingForThem
                                ? '⏳ Waiting for them…'
                                : connectPressed
                                    ? 'Connect 🤝'
                                    : 'Connect 🤝'}
                        </span>
                        <span id="connect-timer">
                            {connectPressed ? `${timeLeft}s left` : `${timeLeft}s`}
                        </span>
                    </button>

                    <button id="moveOnBtn" onClick={handleMoveOn}>
                        <span>Move On 👋</span>
                        <span id="moveOn-sub">Gone forever</span>
                    </button>
                </div>

                <p id="liking-gap-nudge">
                    ● Research shows your match liked the conversation more than you think
                </p>
            </div>
        </div>
    )
}
